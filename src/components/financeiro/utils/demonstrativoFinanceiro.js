// ════════════════════════════════════════════════════════════════════════
// DEMONSTRATIVO FINANCEIRO — cálculo e PDF
// Mesma regra do Relatório de Fechamento (Quadro 05 "Resultado por Mês"):
// só lançamentos PAGOS, pela data do pagamento; banco + caixa somados.
// ════════════════════════════════════════════════════════════════════════
import { supabase } from '../../../supabaseClient';
import { formatarMoeda } from './formatadores';
import { ehAjusteInternoTronco } from './ajusteTronco';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export const TIPOS_PERIODO = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
  { value: 'ultimos12', label: 'Últimos 12 meses' },
];

const pad = (n) => String(n).padStart(2, '0');

// Resolve o período escolhido em: data inicial/final, lista de meses e rótulo.
// sel = { tipo, ano, mes (1-12), trimestre (1-4), semestre (1-2) }
export function resolverPeriodo(sel, hoje = new Date()) {
  let primeiro; // { ano, mes }
  let qtd;
  let label;
  if (sel.tipo === 'mensal') { primeiro = { ano: sel.ano, mes: sel.mes }; qtd = 1; label = `${MESES[sel.mes - 1]} de ${sel.ano}`; }
  else if (sel.tipo === 'trimestral') { primeiro = { ano: sel.ano, mes: (sel.trimestre - 1) * 3 + 1 }; qtd = 3; label = `${sel.trimestre}º Trimestre de ${sel.ano}`; }
  else if (sel.tipo === 'semestral') { primeiro = { ano: sel.ano, mes: sel.semestre === 1 ? 1 : 7 }; qtd = 6; label = `${sel.semestre}º Semestre de ${sel.ano}`; }
  else if (sel.tipo === 'anual') { primeiro = { ano: sel.ano, mes: 1 }; qtd = 12; label = `Ano de ${sel.ano}`; }
  else {
    // últimos 12 meses: termina no mês corrente (inclusive)
    const fimA = hoje.getFullYear(); const fimM = hoje.getMonth() + 1;
    let a = fimA, m = fimM - 11;
    if (m < 1) { m += 12; a -= 1; }
    primeiro = { ano: a, mes: m }; qtd = 12;
    label = `Últimos 12 meses (${MESES_ABREV[m - 1]}/${a} a ${MESES_ABREV[fimM - 1]}/${fimA})`;
  }
  const meses = [];
  let a = primeiro.ano, m = primeiro.mes;
  for (let i = 0; i < qtd; i++) {
    meses.push({ ano: a, mes: m, chave: `${a}-${pad(m)}`, rotulo: `${MESES_ABREV[m - 1]}/${a}` });
    m += 1; if (m > 12) { m = 1; a += 1; }
  }
  const ult = meses[meses.length - 1];
  const ultimoDia = new Date(ult.ano, ult.mes, 0).getDate();
  return { label, meses, inicio: `${meses[0].chave}-01`, fim: `${ult.chave}-${pad(ultimoDia)}` };
}

async function buscarTodos(fabrica) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await fabrica().range(de, de + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// Mesma classificação do Relatório de Fechamento
const classificar = (l) => {
  if (l.status !== 'pago') return null;
  const nomeCat = l.cat_nome?.toLowerCase() || '';
  const isTronco = nomeCat.includes('tronco');
  const isDinheiro = l.tipo_pagamento === 'dinheiro';
  const isTransf = l.eh_transferencia_interna === true;
  if (l.tipo_pagamento === 'compensacao') return null;
  if (l.cat_tipo === 'despesa' && ehAjusteInternoTronco(l)) return null;
  if (l.cat_tipo === 'receita') {
    if (isTronco && isTransf) return 'banco_receita';
    if (isTronco && isDinheiro) return null;
    if (isTransf) return 'banco_deposito';
    if (isDinheiro) return 'caixa_receita';
    return 'banco_receita';
  }
  if (l.cat_tipo === 'despesa') {
    if (isTransf) return 'sangria';
    if (isDinheiro) return 'caixa_despesa';
    return 'banco_despesa';
  }
  return null;
};

// Saldo (banco + caixa) acumulado ANTES da data informada — igual ao fechamento
async function saldoAnteriorTotal(dataLimite) {
  const d = await buscarTodos(() =>
    supabase.from('lancamentos_loja')
      .select('valor, tipo_pagamento, eh_transferencia_interna, categorias_financeiras(tipo, nome)')
      .eq('status', 'pago').lt('data_pagamento', dataLimite));
  const nome = (l) => l.categorias_financeiras?.nome?.toLowerCase() || '';
  const soma = (f) => d.filter(f).reduce((s, l) => s + parseFloat(l.valor), 0);
  const tipo = (l) => l.categorias_financeiras?.tipo;
  const recBanco = soma(l => tipo(l) === 'receita' && l.tipo_pagamento !== 'compensacao' && l.tipo_pagamento !== 'dinheiro' && !l.eh_transferencia_interna);
  const depositos = soma(l => tipo(l) === 'receita' && l.eh_transferencia_interna === true);
  const despBanco = soma(l => tipo(l) === 'despesa' && !ehAjusteInternoTronco(l) && l.tipo_pagamento !== 'compensacao' && l.tipo_pagamento !== 'dinheiro' && !l.eh_transferencia_interna);
  const recCaixa = soma(l => tipo(l) === 'receita' && l.tipo_pagamento === 'dinheiro' && !l.eh_transferencia_interna && !nome(l).includes('tronco'));
  const sangrias = soma(l => tipo(l) === 'despesa' && l.eh_transferencia_interna === true && !nome(l).includes('tronco'));
  const despCaixa = soma(l => tipo(l) === 'despesa' && l.tipo_pagamento === 'dinheiro' && l.eh_transferencia_interna === false && !nome(l).includes('tronco'));
  return (recBanco + depositos - despBanco) + (recCaixa - sangrias - despCaixa);
}

function agruparCategorias(lancs, tipo, catMap) {
  const porCat = {};
  lancs.forEach(l => {
    const g = classificar(l);
    if (!g || g === 'banco_deposito' || g === 'sangria' || l.cat_tipo !== tipo) return;
    const id = l.cat_id || 'sem';
    if (!porCat[id]) porCat[id] = { id, nome: l.cat_nome || 'Sem categoria', valor: 0, pai_id: l.cat_pai_id };
    porCat[id].valor += parseFloat(l.valor || 0);
  });
  const grupos = {};
  Object.values(porCat).forEach(cat => {
    if (!cat.pai_id) {
      if (!grupos[cat.id]) grupos[cat.id] = { ...cat, filhos: [] };
      else grupos[cat.id].valor += cat.valor;
    } else {
      const pai = catMap[cat.pai_id];
      const paiId = pai?.id || cat.pai_id;
      if (!grupos[paiId]) grupos[paiId] = { id: paiId, nome: pai?.nome || 'Outros', valor: 0, filhos: [] };
      grupos[paiId].filhos.push(cat);
      grupos[paiId].valor += cat.valor;
    }
  });
  return Object.values(grupos).sort((a, b) => b.valor - a.valor);
}

// Carrega e calcula tudo do período
export async function calcularDemonstrativo(sel) {
  const per = resolverPeriodo(sel);
  const [cats, lancsBrutos, anterior] = await Promise.all([
    buscarTodos(() => supabase.from('categorias_financeiras').select('id, nome, tipo, categoria_pai_id, nivel').order('id')),
    buscarTodos(() => supabase.from('lancamentos_loja')
      .select('id, valor, status, tipo_pagamento, eh_transferencia_interna, data_pagamento, categorias_financeiras(id, nome, tipo, categoria_pai_id, nivel)')
      .eq('status', 'pago').gte('data_pagamento', per.inicio).lte('data_pagamento', per.fim).order('id')),
    saldoAnteriorTotal(per.inicio),
  ]);
  const catMap = {}; cats.forEach(c => { catMap[c.id] = c; });
  const lancs = lancsBrutos.map(l => ({
    ...l,
    cat_id: l.categorias_financeiras?.id, cat_nome: l.categorias_financeiras?.nome,
    cat_tipo: l.categorias_financeiras?.tipo, cat_pai_id: l.categorias_financeiras?.categoria_pai_id,
    eh_transferencia_interna: l.eh_transferencia_interna ?? false,
  }));

  const mensal = per.meses.map(m => ({ ...m, receitas: 0, despesas: 0, depositos: 0, sangrias: 0 }));
  const idx = {}; mensal.forEach((m, i) => { idx[m.chave] = i; });
  lancs.forEach(l => {
    const g = classificar(l); if (!g) return;
    const i = idx[String(l.data_pagamento).slice(0, 7)]; if (i === undefined) return;
    const v = parseFloat(l.valor || 0);
    if (g === 'banco_receita' || g === 'caixa_receita') mensal[i].receitas += v;
    else if (g === 'banco_despesa' || g === 'caixa_despesa') mensal[i].despesas += v;
    else if (g === 'banco_deposito') mensal[i].depositos += v;
    else if (g === 'sangria') mensal[i].sangrias += v;
  });
  mensal.forEach(m => { m.resultado = m.receitas - m.despesas; });

  const receitas = mensal.reduce((s, m) => s + m.receitas, 0);
  const despesas = mensal.reduce((s, m) => s + m.despesas, 0);
  const transf = mensal.reduce((s, m) => s + m.depositos - m.sangrias, 0); // movimentação interna banco x caixa (normalmente ~0)
  return {
    periodo: per,
    saldoInicial: anterior,
    receitas, despesas, resultado: receitas - despesas,
    saldoFinal: anterior + receitas - despesas + transf,
    mensal,
    gruposReceitas: agruparCategorias(lancs, 'receita', catMap),
    gruposDespesas: agruparCategorias(lancs, 'despesa', catMap),
    qtdLancamentos: lancs.length,
  };
}

// ───────────────────────── PDF ─────────────────────────
const getJsPDF = async () => {
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
  const module = await import('jspdf');
  return module.default;
};

export async function gerarPDFDemonstrativo({ dados, dadosLoja, contador, showError, showSuccess }) {
  try {
    showSuccess?.('Gerando PDF...');
    const jsPDF = await getJsPDF();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const nomeLoja = `${dadosLoja?.nome_loja || 'ARLS Acácia de Paranatinga'} Nº ${dadosLoja?.numero_loja || '30'}`;
    const W = 210, margin = 14, colRight = W - margin;
    let y = 10;
    const COR_ACCENT = [79, 70, 229], COR_VERDE = [16, 185, 129], COR_VERM = [239, 68, 68];
    const COR_CINZA = [107, 114, 128], COR_FUNDO = [248, 250, 252], COR_FUNDO2 = [241, 245, 249];

    const limpar = (s) => String(s ?? '').split('').filter(c => c.charCodeAt(0) < 256).join('');
    const txt = (t, x, yy, o = {}) => {
      doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
      doc.setFontSize(o.size || 9);
      doc.setTextColor(...(o.color || [30, 30, 30]));
      doc.text(limpar(t), x, yy, o.align ? { align: o.align } : {});
    };
    const linha = (yy, x1 = margin, x2 = colRight, cor = [220, 220, 230]) => { doc.setDrawColor(...cor); doc.setLineWidth(0.2); doc.line(x1, yy, x2, yy); };
    const rect = (x, yy, w, h, cor, raio = 0) => { doc.setFillColor(...cor); doc.roundedRect(x, yy, w, h, raio, raio, 'F'); };
    const nova = (h = 20) => { if (y + h > 272) { doc.addPage(); y = 15; } };
    const titulo = (t, direita) => {
      nova(24);
      rect(margin, y, colRight - margin, 6, COR_ACCENT, 2);
      txt(t, margin + 3, y + 4.2, { bold: true, size: 9, color: [255, 255, 255] });
      if (direita) txt(direita, colRight - 3, y + 4.2, { size: 8, color: [200, 210, 255], align: 'right' });
      y += 9;
    };
    const moldura = (cor, fn) => {
      const yIni = y, pIni = doc.internal.getNumberOfPages();
      fn();
      if (doc.internal.getNumberOfPages() === pIni) {
        doc.setDrawColor(...cor); doc.setLineWidth(0.5);
        doc.rect(margin, yIni, colRight - margin, y + 2 - yIni, 'S');
      }
      y += 6;
    };

    // ── Cabeçalho ──
    rect(0, 0, W, 28, COR_ACCENT);
    if (dadosLoja?.logo_url) { try { doc.addImage(dadosLoja.logo_url, 'PNG', margin, 2, 22, 22); } catch { /* sem logo */ } }
    txt(nomeLoja, W / 2, 10, { bold: true, size: 13, color: [255, 255, 255], align: 'center' });
    txt('DEMONSTRATIVO FINANCEIRO', W / 2, 16, { bold: true, size: 10, color: [200, 210, 255], align: 'center' });
    txt(`Período: ${dados.periodo.label}  ·  Emissão: ${new Date().toLocaleDateString('pt-BR')}`, W / 2, 22, { size: 8, color: [200, 210, 255], align: 'center' });
    y = 34;

    // ── Identificação ──
    const cnpj = dadosLoja?.cnpj ? `CNPJ: ${dadosLoja.cnpj}` : '';
    const end = [dadosLoja?.endereco, dadosLoja?.cidade && `${dadosLoja.cidade}${dadosLoja.estado ? '-' + dadosLoja.estado : ''}`].filter(Boolean).join(' - ');
    [cnpj, end].filter(Boolean).forEach(t => { txt(t, W / 2, y, { size: 8, color: COR_CINZA, align: 'center' }); y += 4.5; });
    txt('Valores efetivamente recebidos e pagos no período (regime de caixa), somando todo o movimento da Loja.', W / 2, y, { size: 7.5, color: COR_CINZA, align: 'center' });
    y += 7;

    // ── 1. Resumo ──
    titulo('1. RESUMO DO PERÍODO');
    moldura(COR_ACCENT, () => {
      const itens = [
        ['Saldo inicial do período', dados.saldoInicial, [30, 30, 30], false],
        ['(+) Total de receitas', dados.receitas, COR_VERDE, false],
        ['(-) Total de despesas', dados.despesas, COR_VERM, false],
        ['(=) Resultado do período', dados.resultado, dados.resultado >= 0 ? COR_VERDE : COR_VERM, true],
        ['Saldo final do período', dados.saldoFinal, COR_ACCENT, true],
      ];
      itens.forEach(([l, v, c, b], i) => {
        if (i % 2 === 0) rect(margin, y - 1, colRight - margin, 7, COR_FUNDO);
        txt(l, margin + 3, y + 3.8, { size: 9, bold: b });
        txt((v < 0 ? '-' : '') + formatarMoeda(Math.abs(v)), colRight - 3, y + 3.8, { size: 9.5, bold: true, color: c, align: 'right' });
        y += 7;
      });
    });

    // ── 2. Resultado por mês ──
    if (dados.mensal.length > 0) {
      titulo('2. RESULTADO POR MÊS', dados.periodo.label);
      moldura(COR_ACCENT, () => {
        rect(margin, y, colRight - margin, 6, [60, 55, 200], 1);
        const c = { mes: margin + 2, rec: margin + 33, desp: margin + 76, res: margin + 122, bar: margin + 156 };
        txt('Mês', c.mes, y + 4, { size: 7, bold: true, color: [255, 255, 255] });
        txt('Receitas', c.rec, y + 4, { size: 7, bold: true, color: [255, 255, 255] });
        txt('Despesas', c.desp, y + 4, { size: 7, bold: true, color: [255, 255, 255] });
        txt('Resultado', c.res, y + 4, { size: 7, bold: true, color: [255, 255, 255] });
        y += 7;
        const maxAbs = Math.max(...dados.mensal.map(m => Math.abs(m.resultado)), 1);
        const barMax = 26;
        dados.mensal.forEach((m, i) => {
          nova(8);
          if (i % 2 === 0) rect(margin, y - 1, colRight - margin, 5.5, COR_FUNDO);
          const cor = m.resultado >= 0 ? COR_VERDE : COR_VERM;
          txt(m.rotulo, c.mes, y + 3.5, { size: 7.5, bold: true });
          txt(formatarMoeda(m.receitas), c.rec, y + 3.5, { size: 7, color: COR_VERDE });
          txt(formatarMoeda(m.despesas), c.desp, y + 3.5, { size: 7, color: COR_VERM });
          txt((m.resultado >= 0 ? '+' : '-') + formatarMoeda(Math.abs(m.resultado)), c.res, y + 3.5, { size: 7.5, bold: true, color: cor });
          rect(c.bar, y + 1.5, barMax, 2.5, [220, 220, 220]);
          const bw = Math.abs(m.resultado) / maxAbs * barMax;
          if (bw > 0) rect(c.bar, y + 1.5, bw, 2.5, cor);
          y += 5.5;
        });
        nova(10);
        linha(y, margin, colRight, COR_ACCENT); y += 1;
        rect(margin, y, colRight - margin, 7, [219, 234, 254], 1);
        const cor = dados.resultado >= 0 ? COR_VERDE : COR_VERM;
        txt('TOTAL', c.mes, y + 4.5, { bold: true, size: 8 });
        txt(formatarMoeda(dados.receitas), c.rec, y + 4.5, { bold: true, size: 7.5, color: COR_VERDE });
        txt(formatarMoeda(dados.despesas), c.desp, y + 4.5, { bold: true, size: 7.5, color: COR_VERM });
        txt((dados.resultado >= 0 ? '+' : '-') + formatarMoeda(Math.abs(dados.resultado)), c.res, y + 4.5, { bold: true, size: 8, color: cor });
        y += 8;
      });
    }

    // ── 3 e 4. Categorias ──
    const blocoCategorias = (num, nome, grupos, total, cor) => {
      titulo(`${num}. ${nome}`, formatarMoeda(total));
      if (grupos.length === 0) { txt('Sem lançamentos no período.', margin + 3, y + 3, { size: 8, color: COR_CINZA }); y += 9; return; }
      moldura(cor, () => {
        grupos.forEach(g => {
          nova(14);
          const pct = total > 0 ? (g.valor / total * 100).toFixed(1) : '0.0';
          rect(margin, y, colRight - margin, 6, COR_FUNDO2, 1);
          txt(g.nome, margin + 3, y + 4, { bold: true, size: 8.5 });
          txt(`${pct}%`, margin + 110, y + 4, { size: 7.5, color: COR_CINZA });
          txt(formatarMoeda(g.valor), colRight - 3, y + 4, { bold: true, size: 8.5, color: cor, align: 'right' });
          y += 7.5;
          [...(g.filhos || [])].sort((a, b) => b.valor - a.valor).forEach(f => {
            nova(6);
            const pf = g.valor > 0 ? (f.valor / g.valor * 100).toFixed(1) : '0.0';
            txt(`  > ${f.nome}`, margin + 3, y + 3.5, { size: 7.5, color: COR_CINZA });
            txt(`${pf}%`, margin + 110, y + 3.5, { size: 7, color: COR_CINZA });
            txt(formatarMoeda(f.valor), colRight - 3, y + 3.5, { size: 7.5, color: cor, align: 'right' });
            y += 5;
          });
          linha(y, margin, colRight); y += 2;
        });
      });
    };
    blocoCategorias(3, 'RECEITAS POR CATEGORIA', dados.gruposReceitas, dados.receitas, COR_VERDE);
    blocoCategorias(4, 'DESPESAS POR CATEGORIA', dados.gruposDespesas, dados.despesas, COR_VERM);

    // ── Declaração e assinaturas ──
    nova(70);
    y += 2;
    const cidade = dadosLoja?.cidade || 'Paranatinga';
    const uf = dadosLoja?.estado || 'MT';
    const hoje = new Date();
    const dataExt = `${hoje.getDate()} de ${MESES[hoje.getMonth()].toLowerCase()} de ${hoje.getFullYear()}`;
    const decl = `Declaramos, para os devidos fins, que as informações acima refletem os registros financeiros da ${nomeLoja}${dadosLoja?.cnpj ? ` (CNPJ ${dadosLoja.cnpj})` : ''}, referentes ao período de ${dados.periodo.label}, considerando somente valores efetivamente recebidos e pagos.`;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(40, 40, 40);
    const linhasDecl = doc.splitTextToSize(limpar(decl), colRight - margin);
    doc.text(linhasDecl, margin, y); y += linhasDecl.length * 4.3 + 4;
    txt(`${cidade}-${uf}, ${dataExt}.`, margin, y, { size: 8.5 }); y += 22;

    const meio = W / 2;
    linha(y, margin + 2, meio - 8, [90, 90, 90]); linha(y, meio + 8, colRight - 2, [90, 90, 90]);
    txt('Venerável Mestre', (margin + 2 + meio - 8) / 2, y + 4, { bold: true, size: 8.5, align: 'center' });
    txt(nomeLoja, (margin + 2 + meio - 8) / 2, y + 8, { size: 7, color: COR_CINZA, align: 'center' });
    const xc = (meio + 8 + colRight - 2) / 2;
    txt('Contador', xc, y + 4, { bold: true, size: 8.5, align: 'center' });
    let yy = y + 8;
    if (contador?.nome) { txt(contador.nome, xc, yy, { size: 8, align: 'center' }); yy += 4; }
    if (contador?.crc) { txt(`CRC: ${contador.crc}`, xc, yy, { size: 7.5, color: COR_CINZA, align: 'center' }); yy += 4; }
    if (contador?.cpf) { txt(`CPF: ${contador.cpf}`, xc, yy, { size: 7.5, color: COR_CINZA, align: 'center' }); yy += 4; }
    if (contador?.telefone || contador?.email) txt([contador.telefone, contador.email].filter(Boolean).join(' - '), xc, yy, { size: 7, color: COR_CINZA, align: 'center' });

    // ── Rodapé em todas as páginas ──
    const total = doc.internal.getNumberOfPages();
    const emissao = new Date().toLocaleDateString('pt-BR');
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setDrawColor(200, 200, 210); doc.setLineWidth(0.3); doc.line(margin, 284, colRight, 284);
      txt('SysMaçom-MG - Desenvolvedor: Mauro George', margin, 289, { size: 7, color: COR_CINZA });
      txt(`Emitido em ${emissao}  ·  ${i} de ${total}`, colRight, 289, { size: 7, color: COR_CINZA, align: 'right' });
    }

    doc.save(`Demonstrativo_Financeiro_${dados.periodo.inicio}_a_${dados.periodo.fim}.pdf`);
    showSuccess?.('PDF gerado com sucesso!');
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    showError?.('Erro ao gerar PDF: ' + err.message);
  }
}
