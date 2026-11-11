import jsPDF from 'jspdf';

export const fmtR = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtData = (d) => d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

export const hojeISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// A Helvetica padrão do jsPDF não tem "∴" nem emojis — saem corrompidos.
const sanitizeTexto = (str) => (str || '')
  .replace(/∴/g, '')
  .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
  .replace(/[\u2600-\u27BF]/gu, '')
  .replace(/[\uFE00-\uFE0F]/gu, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

// paga | cancelada | atrasada | a_vencer
export const classificarParcela = (p, hoje = hojeISO()) => {
  if (p.status === 'pago') return 'paga';
  if (p.status === 'cancelado') return 'cancelada';
  const venc = p.data_vencimento ? String(p.data_vencimento).slice(0, 10) : null;
  if (p.status === 'atrasado' || (venc && venc < hoje)) return 'atrasada';
  return 'a_vencer';
};

const diasEntre = (vencISO, hoje) => {
  if (!vencISO) return 0;
  const a = new Date(String(vencISO).slice(0, 10) + 'T00:00:00');
  const b = new Date(hoje + 'T00:00:00');
  return Math.max(0, Math.floor((b - a) / 86400000));
};

export const SITUACAO_PARCELA_LABEL = {
  paga: 'Paga',
  a_vencer: 'A vencer',
  atrasada: 'Atrasada',
  cancelada: 'Cancelada'
};

/**
 * Consolida UMA operação: valor buscado, juros, valor final, pago, restante
 * e a situação das parcelas (pagas / a vencer / atrasadas).
 * Os valores da operação (valor_pago, saldo_devedor) são usados como estão
 * gravados — o mesmo número que os cards de Créditos/Débitos mostram.
 */
export const montarResumoOperacao = (op, parcelas, hoje = hojeISO()) => {
  const principal = Number(op.valor_principal ?? op.valor_total) || 0;
  const final = Number(op.valor_total) || 0;
  const juros = final - principal;
  const jurosPct = principal > 0 ? (juros / principal) * 100 : 0;
  const cancelada = op.status === 'cancelado';
  const pago = Number(op.valor_pago) || 0;
  const saldo = cancelada ? 0 : (Number(op.saldo_devedor) || 0);
  const progresso = final > 0 ? Math.min(100, (pago / final) * 100) : 0;

  const lista = (parcelas || [])
    .slice()
    .sort((a, b) => a.numero_parcela - b.numero_parcela)
    .map((p) => {
      const situacao = classificarParcela(p, hoje);
      const dias = situacao === 'atrasada'
        ? (Number(p.dias_atraso) > 0 ? Number(p.dias_atraso) : diasEntre(p.data_vencimento, hoje))
        : 0;
      return { ...p, situacao, dias };
    });

  const grupo = (sit, campo) => {
    const itens = lista.filter((p) => p.situacao === sit);
    return { qtd: itens.length, valor: itens.reduce((s, p) => s + Number(p[campo] || 0), 0) };
  };

  const pagas = grupo('paga', 'valor_pago');
  const aVencer = grupo('a_vencer', 'valor');
  const atrasadas = grupo('atrasada', 'valor');
  const totalParcelas = lista.filter((p) => p.situacao !== 'cancelada').length;

  const proxima = lista
    .filter((p) => p.situacao === 'a_vencer' || p.situacao === 'atrasada')
    .sort((a, b) => String(a.data_vencimento).localeCompare(String(b.data_vencimento)))[0] || null;

  // Soma das parcelas em aberto x saldo da operação (diferença de centavos = arredondamento)
  const emAbertoParcelas = aVencer.valor + atrasadas.valor;
  const difCentavos = Math.abs(emAbertoParcelas - saldo);
  const arredondamento = lista.length > 0 && difCentavos > 0.005 && difCentavos < 1;

  return {
    op, principal, juros, jurosPct, final, pago, saldo, progresso,
    parcelas: lista, totalParcelas, pagas, aVencer, atrasadas, proxima, arredondamento
  };
};

const TIPO_LABEL = { credito: 'Credito (a receber)', debito: 'Debito (a pagar)' };
const STATUS_LABEL = { ativo: 'Ativo', quitado: 'Quitado', cancelado: 'Cancelado' };
const FORMA_LABEL = { unico: 'Pagamento unico', parcelado: 'Parcelado', compensacao: 'Compensacao' };

/**
 * PDF de uma ou mais operações (uma operação por seção).
 * @param {Array}  resumos  saída de montarResumoOperacao()
 * @param {string} titulo   título do relatório
 */
export const gerarRelatorioOperacoesPDF = async (resumos, titulo = 'Relatorio de Creditos e Debitos') => {
  await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 14;
  let y = 16;

  const cabecalho = () => {
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
    doc.text('ARLS Acacia de Paranatinga no 30', W / 2, y, { align: 'center' }); y += 6;
    doc.setFontSize(11);
    doc.text(sanitizeTexto(titulo), W / 2, y, { align: 'center' }); y += 5;
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
    doc.text('Emitido em ' + fmtData(hojeISO()), W / 2, y, { align: 'center' }); y += 4;
    doc.setDrawColor(60); doc.setLineWidth(0.4); doc.line(M, y, W - M, y);
    y += 6;
    doc.setTextColor(0);
  };

  cabecalho();

  resumos.forEach((r, idx) => {
    const { op } = r;
    // Cada operação começa com espaço suficiente para o bloco de valores
    if (y > 215) { doc.addPage(); y = 16; }

    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
    doc.text(sanitizeTexto(op.entidade_nome) || 'Entidade', M, y);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
    doc.text(
      `${TIPO_LABEL[op.tipo_operacao] || ''}  |  ${STATUS_LABEL[op.status] || op.status || ''}`,
      W - M, y, { align: 'right' }
    );
    y += 5;
    if (op.descricao) {
      const linhas = doc.splitTextToSize(sanitizeTexto(op.descricao), W - M * 2);
      doc.setTextColor(60);
      doc.text(linhas, M, y);
      y += linhas.length * 4;
    }
    doc.setTextColor(0);

    const info = [
      'Lancamento: ' + fmtData(op.data_lancamento),
      'Forma: ' + (FORMA_LABEL[op.forma_pagamento] || op.forma_pagamento || '—') +
        (op.forma_pagamento === 'parcelado' && op.numero_parcelas ? ` (${op.numero_parcelas}x de ${fmtR(op.valor_parcela)})` : ''),
      'Meio: ' + (op.meio_pagamento || '—')
    ].join('   |   ');
    doc.setFontSize(8.5); doc.setTextColor(90);
    doc.text(sanitizeTexto(info), M, y); y += 3;
    doc.setTextColor(0);

    // Bloco de valores
    doc.autoTable({
      startY: y,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60], textColor: 255 },
      head: [['Valor buscado', 'Juros', 'Valor final', 'Valor pago', 'Restante a ' + (op.tipo_operacao === 'credito' ? 'receber' : 'pagar')]],
      body: [[
        fmtR(r.principal),
        fmtR(r.juros) + (r.principal > 0 && r.juros !== 0 ? ` (${r.jurosPct.toFixed(2)}%)` : ''),
        fmtR(r.final),
        fmtR(r.pago) + ` (${r.progresso.toFixed(1)}%)`,
        fmtR(r.saldo)
      ]],
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 3;

    // Situação das parcelas
    if (r.parcelas.length > 0) {
      doc.autoTable({
        startY: y,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [100, 100, 100], textColor: 255 },
        head: [['Parcelas', 'Quantidade', 'Valor']],
        body: [
          ['Pagas', `${r.pagas.qtd} de ${r.totalParcelas}`, fmtR(r.pagas.valor)],
          ['A vencer', String(r.aVencer.qtd), fmtR(r.aVencer.valor)],
          ['Atrasadas', String(r.atrasadas.qtd), fmtR(r.atrasadas.valor)]
        ],
        margin: { left: M, right: M }
      });
      y = doc.lastAutoTable.finalY + 3;

      doc.autoTable({
        startY: y,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 1.6 },
        headStyles: { fillColor: [60, 60, 60], textColor: 255 },
        head: [['N', 'Vencimento', 'Valor', 'Situacao', 'Pago em', 'Valor pago', 'Atraso']],
        body: r.parcelas.map((p) => [
          p.numero_parcela,
          fmtData(p.data_vencimento),
          fmtR(p.valor),
          SITUACAO_PARCELA_LABEL[p.situacao],
          p.data_pagamento ? fmtData(p.data_pagamento) : '—',
          p.situacao === 'paga' ? fmtR(p.valor_pago) : '—',
          p.dias > 0 ? `${p.dias} dias` : '—'
        ]),
        margin: { left: M, right: M }
      });
      y = doc.lastAutoTable.finalY + 2;

      if (r.arredondamento) {
        doc.setFontSize(7.5); doc.setTextColor(110);
        doc.text('Obs.: diferenca de centavos entre a soma das parcelas e o restante decorre do arredondamento das parcelas.', M, y + 2);
        doc.setTextColor(0);
        y += 5;
      }
    } else {
      doc.setFontSize(8.5); doc.setTextColor(90);
      doc.text('Operacao sem parcelas cadastradas (pagamento unico sem vencimento ou compensacao).', M, y + 3);
      doc.setTextColor(0);
      y += 7;
    }

    if (op.observacoes) {
      const linhas = doc.splitTextToSize('Obs.: ' + sanitizeTexto(op.observacoes), W - M * 2);
      doc.setFontSize(8.5); doc.setTextColor(90);
      doc.text(linhas, M, y + 3);
      doc.setTextColor(0);
      y += linhas.length * 4 + 3;
    }

    y += 8;
    if (idx < resumos.length - 1 && y > 270) { doc.addPage(); y = 16; }
  });

  // Rodapé com numeração
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`Pagina ${i} de ${total}`, W / 2, 290, { align: 'center' });
  }

  const nome = resumos.length === 1
    ? `extrato_${sanitizeTexto(resumos[0].op.entidade_nome).replace(/\s+/g, '_')}.pdf`
    : 'relatorio_creditos_debitos.pdf';
  doc.save(nome);
};
