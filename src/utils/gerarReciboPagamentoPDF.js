import jsPDF from 'jspdf';
import { valorPorExtenso } from './valorPorExtenso';

const fmtR = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

// 11 dígitos viram 000.000.000-00; qualquer outra coisa é impressa como veio.
const formatarCpf = (cpf) => {
  const d = String(cpf || '').replace(/\D/g, '');
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : String(cpf || '').trim();
};

// A Helvetica padrão do jsPDF não tem "∴" nem emojis — saem corrompidos.
const sanitizeTexto = (str) => (str || '')
  .replace(/∴/g, '')
  .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
  .replace(/[\u2600-\u27BF]/gu, '')
  .replace(/[\uFE00-\uFE0F]/gu, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

// Como o pagamento entrou, escrito pra frase do recibo.
const descreverMeio = (tipo) => {
  const t = String(tipo || '').toLowerCase().trim();
  if (t === 'pix') return 'via PIX';
  if (t === 'dinheiro') return 'em espécie (dinheiro)';
  if (t === 'transferencia' || t === 'transferência' || t === 'ted' || t === 'doc') return 'via transferência bancária';
  if (t === 'cartao' || t === 'cartão') return 'via cartão';
  if (t === 'boleto') return 'via boleto';
  if (t === 'deposito' || t === 'depósito') return 'via depósito bancário';
  return t ? `via ${t}` : '';
};

/**
 * Recibo de pagamento — a Loja recebeu do irmão o valor de um lançamento pago.
 * Número = ID do lançamento (mesmo número a cada emissão: reemitir é 2ª via).
 *
 * @param {Object} dados
 *   numero        ID do lançamento
 *   irmao         { nome, cpf, cim, ehProfano }
 *   pagamento     { valor, descricao, dataPagamento, tipoPagamento }
 *   dadosLoja     { nome, endereco, logo_url, cidade, estado }
 *   tesoureiro    nome (opcional — sem nome, fica só a linha pra assinar)
 */
export const gerarReciboPagamentoPDF = ({ numero, irmao, pagamento, dadosLoja, tesoureiro }) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 25;
  const larguraUtil = W - M * 2;
  const alturaLinha = 6.4;
  let y = 20;

  const txt = (text, x, yy, opts = {}) => doc.text(String(text), x, yy, opts);
  const valor = Number(pagamento.valor || 0);
  const anoRef = (pagamento.dataPagamento || '').substring(0, 4) || String(new Date().getFullYear());

  // Parágrafo com trechos normal/negrito, justificado (menos a última linha).
  // Pontuação que abre um trecho (", inscrito...") é COLADA na palavra anterior.
  // "~" dentro de um trecho é um espaço que não quebra linha (ex.: "R$~10,00").
  const desenharParagrafoJustificado = (partes, tamanhoFonte = 11.5) => {
    doc.setFontSize(tamanhoFonte);
    doc.setFont('helvetica', 'normal');
    const espacoLargura = doc.getTextWidth(' ');

    const palavras = [];
    let anteriorTerminaComEspaco = true;
    partes.forEach(parte => {
      const raw = parte.t || '';
      const comecaComEspaco = /^\s/.test(raw);
      sanitizeTexto(raw).split(' ').filter(Boolean).forEach((p, i) => {
        const seg = { texto: p.replace(/~/g, ' '), b: parte.b };
        const colar = i === 0 && !comecaComEspaco && !anteriorTerminaComEspaco && palavras.length > 0;
        if (colar) palavras[palavras.length - 1].segs.push(seg);
        else palavras.push({ segs: [seg] });
      });
      anteriorTerminaComEspaco = /\s$/.test(raw);
    });

    const larguraPalavra = (w) => w.segs.reduce((s, sg) => {
      doc.setFont('helvetica', sg.b ? 'bold' : 'normal');
      return s + doc.getTextWidth(sg.texto);
    }, 0);

    const linhas = [];
    let linhaAtual = [];
    let larguraAtual = 0;
    palavras.forEach(w => {
      const lw = larguraPalavra(w);
      const espacoExtra = linhaAtual.length > 0 ? espacoLargura : 0;
      if (larguraAtual + espacoExtra + lw > larguraUtil && linhaAtual.length > 0) {
        linhas.push(linhaAtual);
        linhaAtual = [];
        larguraAtual = 0;
      }
      if (linhaAtual.length > 0) larguraAtual += espacoLargura;
      linhaAtual.push(w);
      larguraAtual += lw;
    });
    if (linhaAtual.length > 0) linhas.push(linhaAtual);

    linhas.forEach((linha, idxLinha) => {
      const ehUltima = idxLinha === linhas.length - 1;
      const larguraPalavras = linha.reduce((s, w) => s + larguraPalavra(w), 0);
      const gaps = linha.length - 1;
      const espacoUsado = (!ehUltima && gaps > 0) ? (larguraUtil - larguraPalavras) / gaps : espacoLargura;

      let x = M;
      linha.forEach((w, i) => {
        w.segs.forEach(sg => {
          doc.setFont('helvetica', sg.b ? 'bold' : 'normal');
          txt(sg.texto, x, y);
          x += doc.getTextWidth(sg.texto);
        });
        if (i < linha.length - 1) x += espacoUsado;
      });
      y += alturaLinha;
    });
  };

  // ── Cabeçalho da Loja (mesmo padrão da certidão) ────────────────────────
  if (dadosLoja?.logo_url) {
    try {
      doc.addImage(dadosLoja.logo_url, 'PNG', (W - 26) / 2, y, 26, 26);
      y += 30;
    } catch (e) { y += 2; }
  }

  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
  txt(sanitizeTexto(dadosLoja?.nome) || 'ARLS Acacia de Paranatinga no 30', W / 2, y, { align: 'center' }); y += 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
  txt(sanitizeTexto(dadosLoja?.endereco) || 'Avenida Brasil, 2.300, Centro — Paranatinga/MT', W / 2, y, { align: 'center' }); y += 6;

  doc.setDrawColor(60); doc.setLineWidth(0.6); doc.line(M, y, W - M, y);
  doc.setLineWidth(0.2); doc.line(M, y + 1, W - M, y + 1);
  y += 14;
  doc.setTextColor(0);

  // ── Título + número ─────────────────────────────────────────────────────
  doc.setFontSize(17); doc.setFont('helvetica', 'bold');
  txt('RECIBO', W / 2, y, { align: 'center' });
  y += 6.5;
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
  txt(`Nº ${numero}/${anoRef}`, W / 2, y, { align: 'center' });
  doc.setTextColor(0);
  y += 10;

  // ── Faixa de destaque do valor ──────────────────────────────────────────
  doc.setFillColor(238, 240, 244);
  doc.roundedRect(M, y, larguraUtil, 16, 2, 2, 'F');
  doc.setDrawColor(150); doc.setLineWidth(0.3);
  doc.roundedRect(M, y, larguraUtil, 16, 2, 2, 'S');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  txt('VALOR RECEBIDO', M + 5, y + 6.5);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(0);
  txt(fmtR(valor), W - M - 5, y + 11.5, { align: 'right' });
  y += 26;

  // ── Corpo ───────────────────────────────────────────────────────────────
  // Irmão (cadastro maçônico) ou Senhor (ainda não iniciado). CIM e CPF só
  // entram quando existirem no cadastro.
  const cim = String(irmao.cim || '').trim();
  const cpf = formatarCpf(irmao.cpf);
  const partes = [
    { t: 'Recebemos ', b: false },
    { t: irmao.ehProfano ? 'do Senhor ' : 'do Irmão ', b: false },
    { t: irmao.nome || '—', b: true },
  ];
  if (cim) partes.push({ t: ', portador do Cadastro de Identidade Maçônica – CIM nº ', b: false }, { t: cim, b: true });
  if (cpf) partes.push({ t: ', inscrito no CPF nº ', b: false }, { t: cpf, b: true });
  partes.push(
    { t: ', a importância de ', b: false },
    { t: fmtR(valor).replace(' ', '~'), b: true },
    { t: ` (${valorPorExtenso(valor)}), referente a `, b: false },
    { t: sanitizeTexto(pagamento.descricao) || 'pagamento', b: true },
  );
  const meio = descreverMeio(pagamento.tipoPagamento);
  partes.push(
    { t: ', paga em ', b: false },
    { t: fmtData(pagamento.dataPagamento), b: true },
    { t: `${meio ? ', ' + meio : ''}.`, b: false },
  );
  desenharParagrafoJustificado(partes);

  y += 6;
  desenharParagrafoJustificado([
    { t: 'Pelo que firmamos o presente recibo, dando plena e geral quitação do valor ora recebido.', b: false },
  ]);

  y += 14;

  // ── Local, data e assinatura ────────────────────────────────────────────
  const hoje = new Date();
  const cidade = dadosLoja?.cidade || 'Paranatinga';
  const estado = dadosLoja?.estado || 'MT';
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(0);
  txt(`${cidade}/${estado}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`, M, y);
  y += 28;

  if (tesoureiro) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0);
    txt(sanitizeTexto(tesoureiro), M, y - 2);
  }
  doc.setDrawColor(0); doc.setLineWidth(0.3);
  doc.line(M, y, M + 80, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  txt('Tesoureiro', M, y + 5);

  // ── Rodapé ──────────────────────────────────────────────────────────────
  doc.setFontSize(7); doc.setTextColor(150);
  txt('SysMaçom-MG - Desenvolvedor: Mauro George', M, 285);
  txt(`Emitido em ${hoje.toLocaleDateString('pt-BR')} às ${hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, W - M, 285, { align: 'right' });

  doc.save(`Recibo_${numero}_${(irmao.nome || 'irmao').replace(/\s+/g, '_')}.pdf`);
};
