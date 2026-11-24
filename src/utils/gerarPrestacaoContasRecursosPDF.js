import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ════════════════════════════════════════════════════════════════════════
// Prestação de contas — Recursos Públicos
// Por ente → por recurso: recebido, aplicações (comodato, doações, obras...) e saldo.
// Usado pela Loja (módulo Recursos Públicos) e pelo acesso do ente público.
// ════════════════════════════════════════════════════════════════════════

const AZUL = [30, 58, 138];
const DOURADO = [201, 168, 76];
const CINZA = [100, 116, 139];
const TEXTO = [30, 41, 59];
const VERDE = [21, 128, 61];
const VERMELHO = [185, 28, 28];

const fmtData = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '—');
const fmtMoeda = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

const ROTULO = { doacao: 'Doação/Repasse', obra: 'Obra/Serviço', outro: 'Outro' };

const linhaLoja = (doc, nomeLoja, y, W) => {
  const partes = ['AUG', '∴', ' E RESP', '∴', ' LOJA SIMB', '∴', ` ${nomeLoja}`];
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  const lt = 1.9;
  const total = partes.reduce((t, p) => t + (p === '∴' ? lt : doc.getTextWidth(p)), 0);
  let x = (W - total) / 2;
  doc.setTextColor(...AZUL); doc.setFillColor(...AZUL);
  partes.forEach(p => {
    if (p === '∴') {
      const r = 0.32;
      doc.circle(x + lt / 2, y - 2.6, r, 'F');
      doc.circle(x + 0.45, y - 0.55, r, 'F');
      doc.circle(x + lt - 0.45, y - 0.55, r, 'F');
      x += lt;
    } else { doc.text(p, x, y); x += doc.getTextWidth(p); }
  });
};

// Monta a estrutura do relatório a partir dos dados carregados na tela
export function montarDadosPrestacao({ entes = [], recursos = [], saldos = {}, nfs = [], equipamentos = [], aplicacoes = [], anexos = [] }) {
  const nomeEnte = {}; entes.forEach(e => { nomeEnte[e.id] = e.nome; });
  return recursos.map(r => {
    const s = saldos[r.id] || {};
    const nfsR = nfs.filter(n => n.recurso_publico_id === r.id).sort((a, b) => String(a.data_nf || '').localeCompare(String(b.data_nf || '')));
    return {
      id: r.id,
      ente: nomeEnte[r.origem_id] || 'Ente não informado',
      titulo: r.titulo,
      data_recebimento: r.data_recebimento,
      numero_processo: r.numero_processo,
      documento_ref: r.documento_ref,
      finalidade: r.finalidade,
      situacao: r.situacao,
      resumo: {
        recebido: Number(s.valor_recebido ?? r.valor_recebido) || 0,
        comodato: Number(s.comodato_nf) || 0,
        outras: Number(s.outras_aplicacoes) || 0,
        saldo: Number(s.saldo ?? r.valor_recebido) || 0,
      },
      nfs: nfsR.map(n => ({
        numero_nf: n.numero_nf, data_nf: n.data_nf, fornecedor: n.fornecedor, valor_total: n.valor_total,
        equipamentos: equipamentos.filter(e => e.recurso_id === n.id).map(e => ({
          numero_patrimonio: e.numero_patrimonio, tipo: e.tipos_equipamentos?.nome || 'Sem tipo', valor: e.valor_aquisicao,
        })),
      })),
      aplicacoes: aplicacoes.filter(a => a.recurso_id === r.id).sort((a, b) => String(a.data_aplicacao || '').localeCompare(String(b.data_aplicacao || ''))),
      qtdAnexos: anexos.filter(a => a.recurso_id === r.id).length,
    };
  });
}

const resumoTipos = (equipamentos) => {
  const m = {};
  equipamentos.forEach(e => { m[e.tipo] = (m[e.tipo] || 0) + 1; });
  return Object.keys(m).sort((a, b) => a.localeCompare(b)).map(t => `${m[t]} ${t}`).join(', ');
};

/**
 * @param {Object} p
 * @param {Array}  p.dados     retorno de montarDadosPrestacao
 * @param {Object} p.dadosLoja
 * @param {string} p.logo      data URL
 * @param {string} p.filtro    descrição dos filtros
 * @param {string} p.nomeArquivo
 */
export const gerarPrestacaoContasRecursosPDF = ({ dados = [], dadosLoja = {}, logo = null, filtro = '', nomeArquivo = 'Prestacao_Contas_Recursos.pdf' }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const nomeLoja = `ACÁCIA DE PARANATINGA Nº ${dadosLoja?.numero_loja || '30'}`;

  // ── Cabeçalho padrão da Loja ──
  let y = 8;
  if (logo) {
    try { doc.addImage(logo, logo.includes('image/png') ? 'PNG' : 'JPEG', (W - 28) / 2, y, 28, 28); } catch (e) { /* sem logo */ }
  }
  y += 33;
  linhaLoja(doc, nomeLoja, y, W);
  y += 5.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...TEXTO);
  doc.text(`Fundada em ${dadosLoja?.data_fundacao ? fmtData(dadosLoja.data_fundacao) : '20/12/1997'}`, W / 2, y, { align: 'center' });
  y += 4.5;
  doc.setFontSize(8.5); doc.setTextColor(...CINZA);
  doc.text('Sob os auspícios da Sereníssima Grande Loja Maçônica do Estado de Mato Grosso', W / 2, y, { align: 'center' });
  const end = [dadosLoja?.endereco, [dadosLoja?.cidade || 'Paranatinga', dadosLoja?.estado || 'MT'].join('/')].filter(Boolean).join(' — ');
  y += 4;
  doc.text(end, W / 2, y, { align: 'center' });
  y += 4;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.8); doc.line(M, y, W - M, y);
  doc.setLineWidth(0.2); doc.line(M, y + 1.2, W - M, y + 1.2);

  // ── Título ──
  y += 9;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...AZUL);
  doc.text('PRESTAÇÃO DE CONTAS — RECURSOS PÚBLICOS', W / 2, y, { align: 'center' });
  y += 5.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...CINZA);
  doc.text('Recursos recebidos e sua aplicação — Filantropia', W / 2, y, { align: 'center' });
  if (filtro) { y += 4.5; doc.setFontSize(8); doc.text(filtro, W / 2, y, { align: 'center' }); }
  y += 7;

  // ── Agrupar por ente ──
  const porEnte = {};
  dados.forEach(r => { (porEnte[r.ente] = porEnte[r.ente] || []).push(r); });
  const entes = Object.keys(porEnte).sort((a, b) => a.localeCompare(b));
  entes.forEach(n => porEnte[n].sort((a, b) => String(a.data_recebimento || '').localeCompare(String(b.data_recebimento || ''))));
  const soma = (rs, campo) => rs.reduce((t, r) => t + (Number(r.resumo[campo]) || 0), 0);

  if (dados.length === 0) {
    doc.setFontSize(10); doc.setTextColor(...CINZA);
    doc.text('Nenhum recurso encontrado para os filtros informados.', W / 2, y + 8, { align: 'center' });
  } else {
    // ── Resumo por ente ──
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...AZUL);
    doc.text('RESUMO POR ENTE', M, y);
    doc.autoTable({
      startY: y + 2,
      head: [['Ente', 'Recursos', 'Recebido', 'Comodato', 'Outras aplicações', 'Saldo']],
      body: [
        ...entes.map(n => [n, porEnte[n].length, fmtMoeda(soma(porEnte[n], 'recebido')), fmtMoeda(soma(porEnte[n], 'comodato')), fmtMoeda(soma(porEnte[n], 'outras')), fmtMoeda(soma(porEnte[n], 'saldo'))]),
        ['TOTAL GERAL', dados.length, fmtMoeda(soma(dados, 'recebido')), fmtMoeda(soma(dados, 'comodato')), fmtMoeda(soma(dados, 'outras')), fmtMoeda(soma(dados, 'saldo'))],
      ],
      margin: { left: M, right: M },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: [226, 232, 240], lineWidth: 0.15, textColor: TEXTO },
      headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: { 1: { halign: 'center', cellWidth: 18 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.row.index === entes.length) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [241, 245, 249]; }
      },
    });
    y = doc.lastAutoTable.finalY + 8;

    const garantir = (h) => { if (y + h > H - 20) { doc.addPage(); y = 16; } };

    // ── Detalhe por ente e recurso ──
    entes.forEach(nomeEnte => {
      const rs = porEnte[nomeEnte];
      garantir(40);
      doc.setFillColor(...AZUL); doc.rect(M, y, W - 2 * M, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(255, 255, 255);
      doc.text(nomeEnte.toUpperCase(), M + 3, y + 4.9);
      doc.text(`${plural(rs.length, 'recurso', 'recursos')} • ${fmtMoeda(soma(rs, 'recebido'))}`, W - M - 3, y + 4.9, { align: 'right' });
      y += 10;

      rs.forEach(r => {
        garantir(40);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...TEXTO);
        doc.text(`${r.titulo}  •  ${fmtData(r.data_recebimento)}  •  Recebido: ${fmtMoeda(r.resumo.recebido)}`, M, y);
        y += 4.5;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...CINZA);
        const sub = [r.numero_processo && `Processo: ${r.numero_processo}`, r.documento_ref && `Termo/Ofício: ${r.documento_ref}`].filter(Boolean).join('   |   ');
        if (sub) { doc.text(sub, M, y); y += 4.2; }
        if (r.finalidade) {
          const lin = doc.splitTextToSize(`Finalidade: ${r.finalidade}`, W - 2 * M);
          doc.text(lin, M, y); y += lin.length * 4 + 0.5;
        }

        // linhas de aplicação (comodato + demais)
        const corpo = [];
        r.nfs.forEach(n => {
          const tipos = resumoTipos(n.equipamentos);
          const desc = `Aquisição de equipamentos para comodato${n.fornecedor ? ` — ${n.fornecedor}` : ''}${n.equipamentos.length ? ` (${tipos})` : ''}`;
          corpo.push(['Comodato', desc, fmtData(n.data_nf), n.numero_nf || '—', fmtMoeda(n.valor_total)]);
        });
        r.aplicacoes.forEach(a => {
          const partes = [a.descricao, a.destinatario && `Destino: ${a.destinatario}`, a.local && `Local: ${a.local}`, a.quantidade && `Qtd: ${a.quantidade}`].filter(Boolean).join(' — ');
          corpo.push([`${ROTULO[a.tipo] || 'Outro'}${a.situacao === 'prevista' ? ' (prevista)' : ''}`, partes, fmtData(a.data_aplicacao), a.numero_nf || '—', fmtMoeda(a.valor)]);
        });
        if (corpo.length === 0) corpo.push(['—', 'Nenhuma aplicação registrada até o momento.', '—', '—', '—']);

        doc.autoTable({
          startY: y + 1,
          head: [['Tipo', 'Descrição / Destino', 'Data', 'NF', 'Valor']],
          body: corpo,
          margin: { left: M, right: M },
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 1.6, lineColor: [226, 232, 240], lineWidth: 0.15, textColor: TEXTO, valign: 'top' },
          headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' },
          columnStyles: { 0: { cellWidth: 27 }, 2: { cellWidth: 19, halign: 'center' }, 3: { cellWidth: 18, halign: 'center' }, 4: { cellWidth: 28, halign: 'right' } },
        });
        y = doc.lastAutoTable.finalY + 2;

        garantir(10);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
        doc.setTextColor(...TEXTO);
        doc.text(`Aplicado: ${fmtMoeda(r.resumo.comodato + r.resumo.outras)}`, M, y + 3);
        const neg = r.resumo.saldo < -0.005;
        doc.setTextColor(...(neg ? VERMELHO : VERDE));
        doc.text(`Saldo a aplicar: ${fmtMoeda(r.resumo.saldo)}`, W - M, y + 3, { align: 'right' });
        y += 5;
        if (r.qtdAnexos) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...CINZA);
          doc.text(`${plural(r.qtdAnexos, 'documento anexado', 'documentos anexados')} (termos, notas, comprovantes) arquivados no sistema.`, M, y + 3);
          y += 5;
        }
        y += 6;
      });
      y += 2;
    });
  }

  // ── Rodapé ──
  const hoje = new Date().toLocaleDateString('pt-BR');
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...DOURADO); doc.setLineWidth(0.3);
    doc.line(M, H - 14, W - M, H - 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...CINZA);
    doc.text('SysMaçom-MG - Desenvolvedor: Mauro George', M, H - 9);
    doc.text(`Emitido em ${hoje}  •  ${p} de ${total}`, W - M, H - 9, { align: 'right' });
  }

  doc.save(nomeArquivo);
};
