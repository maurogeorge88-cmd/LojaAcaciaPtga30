import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ════════════════════════════════════════════════════════════════════════
// PDF da Visão Geral — o ano da Loja para apresentar aos Irmãos.
// Recebe os números já calculados pela tela (nada é recalculado aqui).
// ════════════════════════════════════════════════════════════════════════

const AZUL = [30, 58, 138];
const DOURADO = [201, 168, 76];
const TEXTO = [30, 41, 59];
const CINZA = [100, 116, 139];
const VERDE = [16, 122, 87];
const VERMELHO = [190, 40, 40];

const moeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '—');

export const gerarVisaoGeralPDF = ({ ano, r, dadosLoja = {}, logoB64 }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  let y = 12;

  // ── Cabeçalho da Loja ──────────────────────────────────────────────────
  if (logoB64) {
    try { doc.addImage(`data:image/jpeg;base64,${logoB64}`, 'JPEG', M, y, 30, 30); } catch (e) { /* sem logo */ }
  }
  const xt = M + 34 + (W - M - (M + 34)) / 2;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...AZUL);
  doc.text(`A.R.L.S. ACÁCIA DE PARANATINGA Nº ${dadosLoja.numero_loja || '30'}`, xt, y + 8, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...TEXTO);
  doc.text(`Fundada em ${dadosLoja.data_fundacao ? fmt(dadosLoja.data_fundacao) : '20/12/1997'}`, xt, y + 14, { align: 'center' });
  doc.text('Jurisdicionada à', xt, y + 19, { align: 'center' });
  doc.text('Grande Loja Maçônica do Estado de Mato Grosso', xt, y + 24, { align: 'center' });
  y += 36;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.6); doc.line(M, y, W - M, y);
  y += 10;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...AZUL);
  doc.text(`VISÃO GERAL — ${ano}`, W / 2, y, { align: 'center' });
  y += 8;

  // ── Blocos de números (cartões) ────────────────────────────────────────
  const cartoes = (itens, colunas = 3) => {
    const larg = (W - 2 * M - (colunas - 1) * 4) / colunas;
    const alt = 18;
    const linhas = Math.ceil(itens.length / colunas);
    itens.forEach((it, i) => {
      const linha = Math.floor(i / colunas);
      const col = i % colunas;
      if (col === 0 && i > 0) y += alt + 3;
      if (y + alt > H - 18) { doc.addPage(); y = 20; }
      // última linha incompleta: centraliza os cartões que sobraram
      const nestaLinha = linha === linhas - 1 ? itens.length - linha * colunas : colunas;
      const sobra = (colunas - nestaLinha) * (larg + 4) / 2;
      const x = M + sobra + col * (larg + 4);
      doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3);
      doc.roundedRect(x, y, larg, alt, 2, 2, 'FD');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
      doc.text(String(it[0]).toUpperCase(), x + 3, y + 5, { maxWidth: larg - 6 });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...(it[2] || TEXTO));
      doc.text(String(it[1]), x + 3, y + 11, { maxWidth: larg - 6 });
      if (it[3]) {
        // detalhe pode ocupar duas linhas, sem estourar o quadro
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...CINZA);
        const ls = doc.splitTextToSize(String(it[3]), larg - 6).slice(0, 2);
        ls.forEach((l, k) => doc.text(l, x + 3, y + 14.2 + k * 2.8));
      }
    });
    y += alt + 7;
  };

  const titulo = (txt) => {
    if (y + 14 > H - 18) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...AZUL);
    doc.text(txt, M, y);
    y += 5;
  };

  const tabela = (head, body, vazio) => {
    if (!body.length) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...CINZA);
      doc.text(vazio || 'Nada registrado neste ano.', M, y);
      y += 8;
      return;
    }
    doc.autoTable({
      startY: y, margin: { left: M, right: M },
      head: [head.map(h => h.t)], body,
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, textColor: TEXTO },
      headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontSize: 8, halign: 'left' },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      columnStyles: Object.fromEntries(head.map((h, i) => [i, { halign: h.align || 'left' }])),
      theme: 'grid',
    });
    y = doc.lastAutoTable.finalY + 8;
  };

  // ── 1. O ano em números ────────────────────────────────────────────────
  titulo('O ano em números');
  cartoes([
    ['Sessões realizadas', r.sessoes],
    ['Balaústres', r.totalBalaustres],
    ['Ágapes e festas', r.agapes.length],
    ['Eventos', r.eventos.length],
    ['Famílias atendidas', r.familiasAtendidas, null, `${r.ajudas} ajuda(s)`],
    ['Comodatos ativos', r.comodatosAtivos.length, null, `${r.comodatosAno.length} no ano`],
    ['Pranchas', r.pranchas],
    ['Editais', r.editais],
  ]);

  titulo('Balaústres por grau');
  tabela(
    [{ t: 'Grau' }, { t: 'Quantidade', align: 'right' }],
    [...r.balaustresGrau.map(([g, q]) => [g, String(q)]), ['TOTAL', String(r.totalBalaustres)]],
  );

  // ── 3. Financeiro: conta, espécie e movimento (igual a Finanças da Loja) ──
  titulo('Conta bancária');
  cartoes([
    [`Saldo 1º de Janeiro/${ano}`, moeda(r.inicio.banco)],
    ['Receitas pagas', moeda(r.movimento.receitasPagas), VERDE, `Em espécie: ${moeda(r.movimento.especie.recebido)}`],
    ['Despesas pagas', moeda(r.movimento.despesasPagas), VERMELHO],
    ['Saldo no período', moeda(r.movimento.saldoPeriodo), r.movimento.saldoPeriodo >= 0 ? AZUL : VERMELHO],
  ]);

  titulo('Saldos atuais');
  cartoes([
    ['Caixa físico hoje', moeda(r.fim.caixa), VERDE, 'Dinheiro não depositado'],
    ['Saldo em conta hoje', moeda(r.fim.banco), AZUL, 'PIX, Transf., Cartão'],
    ['Saldo total', moeda(r.fim.total), TEXTO, 'Conta + caixa'],
  ]);

  titulo('Maiores receitas e despesas');
  tabela(
    [{ t: 'Maiores receitas' }, { t: 'Valor', align: 'right' }],
    r.topReceitas.map(([n2, v]) => [n2, moeda(v)]),
  );
  tabela(
    [{ t: 'Maiores despesas' }, { t: 'Valor', align: 'right' }],
    r.topDespesas.map(([n2, v]) => [n2, moeda(v)]),
  );

  // ── Tronco de Solidariedade ────────────────────────────────────────────
  titulo('Tronco de Solidariedade e Arco Real');
  cartoes([
    [`Saldo 1º de Janeiro/${ano}`, moeda(r.troncoAntes.total), TEXTO, `Conta ${moeda(r.troncoAntes.banco)} · Espécie ${moeda(r.troncoAntes.especie)}`],
    ['Arrecadado no ano', moeda(r.troncoAno.arrecadado), VERDE],
    ['Aplicado no ano', moeda(r.troncoAno.aplicado), VERMELHO],
    ['Disponível hoje', moeda(r.troncoAtual.total), AZUL, `Conta ${moeda(r.troncoAtual.banco)} · Espécie ${moeda(r.troncoAtual.especie)}`],
    ['Arco Real — disponível', moeda(r.arco.saldo), AZUL, `Receita ${moeda(r.arco.receita)} · Despesa ${moeda(r.arco.despesa)}`],
  ]);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
  doc.text('Informativo: Tronco e Arco Real ja estao somados nos saldos acima.', M, y);
  y += 8;

  // ── 4. Ágapes e festas ─────────────────────────────────────────────────
  titulo(`Ágapes e festas (${r.agapes.length})`);
  cartoes([
    ['Valor total', moeda(r.agTotal)],
    ['Pago pelos Irmãos', moeda(r.agIrmaos), VERDE],
    ['Custo da Loja', moeda(r.agLoja), null, `Convidados: ${moeda(r.agConvidados)}`],
    ['Saldo final', moeda(r.agSaldo), r.agSaldo < 0 ? VERMELHO : VERDE, r.agSaldo < 0 ? 'Pago pela Loja' : 'Sobrou para a Loja'],
    ['Média por ágape', moeda(r.agapes.length ? r.agTotal / r.agapes.length : 0), null, `${r.agapes.length} ágape(s) no ano`],
  ]);
  tabela(
    [{ t: 'Ágape / Festa' }, { t: 'Data' }, { t: 'Valor total', align: 'right' }, { t: 'Irmãos', align: 'right' }, { t: 'Convidados', align: 'right' }, { t: 'Custo Loja', align: 'right' }, { t: 'Saldo', align: 'right' }],
    r.agapes.map(a => [a.nome, fmt(a.data), moeda(a.total), moeda(a.irmaos), moeda(a.convidados), moeda(a.loja), moeda(a.saldo)]),
    'Nenhum ágape registrado neste ano.',
  );

  // ── 5. Eventos e projetos ──────────────────────────────────────────────
  titulo('Eventos');
  tabela(
    [{ t: 'Evento' }, { t: 'Tipo' }, { t: 'Data' }, { t: 'Situação' }],
    r.eventos.map(e => [e.nome_evento || '', e.tipo_evento === 'externo' ? 'Externo' : 'Interno', fmt(e.data_prevista), e.status || '—']),
    'Nenhum evento neste ano.',
  );
  titulo('Projetos');
  tabela(
    [{ t: 'Projeto' }, { t: 'Início' }, { t: 'Custo', align: 'right' }, { t: 'Receita', align: 'right' }, { t: 'Resultado', align: 'right' }],
    r.projetos.map(p => [p.nome || '', fmt(p.data), moeda(p.custo), moeda(p.receita), moeda(p.receita - p.custo)]),
    'Nenhum projeto iniciado neste ano.',
  );

  // ── Relações e distinções ──────────────────────────────────────────────
  titulo('Visitas e comendas');
  cartoes([
    ['Visitas a outras Lojas', String(r.visitas), null, `${r.lojasVisitadas} loja(s)`],
    ['Visitantes em nossa Loja', String(r.visitantes), VERDE, `${r.lojasDiferentes} loja(s)`],
    ['Autoridades recebidas', String(r.autoridades)],
    ['Comendas entregues', String(r.comendasEntregues.length)],
  ]);

  // ── 6. Filantropia e comodatos ─────────────────────────────────────────
  titulo('Filantropia e comodatos');
  cartoes([
    ['Famílias atendidas', String(r.familiasAtendidas), VERDE, `${r.familiasCadastradas} cadastradas`],
    ['Ajudas concedidas', String(r.ajudas)],
    ['Valor aplicado', moeda(r.totalAjudas)],
    ['Comodatos no ano', String(r.comodatosAno.length)],
    ['Comodatos ativos', String(r.comodatosAtivos.length), null, 'Ainda não devolvidos'],
  ]);

  // ── Rodapé em todas as páginas ─────────────────────────────────────────
  const total = doc.internal.getNumberOfPages();
  const hoje = new Date().toLocaleDateString('pt-BR');
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...CINZA);
    doc.text(`Emitido em ${hoje}`, M, H - 10);
    doc.text(`${p} de ${total}`, W - M, H - 10, { align: 'right' });
  }

  doc.save(`Visao_Geral_${ano}.pdf`);
};
