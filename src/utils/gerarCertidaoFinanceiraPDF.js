import jsPDF from 'jspdf';

const fmtR = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const obterGrauLabel = (situacaoOuGrau) => {
  // Aceita tanto um objeto irmão (com data_exaltacao/data_elevacao) quanto
  // uma string de grau já pronta, pra ficar flexível com o que o chamador tiver.
  if (!situacaoOuGrau) return '—';
  if (typeof situacaoOuGrau === 'string') return situacaoOuGrau;
  if (situacaoOuGrau.mestre_instalado) return 'Mestre Instalado';
  if (situacaoOuGrau.data_exaltacao)   return 'Mestre';
  if (situacaoOuGrau.data_elevacao)    return 'Companheiro';
  if (situacaoOuGrau.data_iniciacao)   return 'Aprendiz';
  return '—';
};

/**
 * Gera a Certidão Negativa (sem débito) ou Positiva (com débito) de um irmão,
 * decidido automaticamente pelo valor de `valorDevido`.
 *
 * @param {Object} irmao        { nomeIrmao, cim, grau (string) }
 * @param {number} valorDevido  soma de receitasPendentes (0 = negativa)
 * @param {Object} dadosLoja    { nome, endereco, logo_url, cidade, estado }
 * @param {Object} assinantes   { tesoureiro, veneravelMestre }
 */
export const gerarCertidaoFinanceiraPDF = (irmao, valorDevido, dadosLoja, assinantes = {}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 25;
  let y = 20;

  const txt = (text, x, yy, opts = {}) => doc.text(String(text), x, yy, opts);
  const negativa = !(valorDevido > 0);

  // ── Cabeçalho da Loja (mesmo padrão dos demais relatórios) ─────────────────
  if (dadosLoja?.logo_url) {
    try {
      doc.addImage(dadosLoja.logo_url, 'PNG', (W - 26) / 2, y, 26, 26);
      y += 30;
    } catch (e) { y += 2; }
  }

  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
  txt(dadosLoja?.nome || 'A∴R∴L∴S∴ Acácia de Paranatinga nº 30', W / 2, y, { align: 'center' }); y += 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
  txt(dadosLoja?.endereco || 'Avenida Brasil, 2.300, Centro — Paranatinga/MT', W / 2, y, { align: 'center' }); y += 6;

  doc.setDrawColor(60); doc.setLineWidth(0.6); doc.line(M, y, W - M, y);
  doc.setLineWidth(0.2); doc.line(M, y + 1, W - M, y + 1);
  y += 14;
  doc.setTextColor(0);

  // ── Título ──────────────────────────────────────────────────────────────
  doc.setFontSize(15); doc.setFont('helvetica', 'bold');
  txt(negativa ? 'CERTIDÃO NEGATIVA DE DÉBITOS' : 'CERTIDÃO POSITIVA DE DÉBITOS', W / 2, y, { align: 'center' });
  y += 16;

  // ── Corpo do texto — parágrafo com trechos em negrito ──────────────────────
  // jsPDF não tem "negrito inline" nativo dentro de splitTextToSize, então o
  // texto é montado manualmente, trecho a trecho, medindo a largura de cada
  // pedaço pra quebrar linha corretamente e destacar só as partes importantes.
  const larguraUtil = W - M * 2;
  const alturaLinha = 6.2;

  const montarPartes = () => {
    if (negativa) {
      return [
        { t: 'Certificamos, para os devidos fins, que o Irmão ', b: false },
        { t: irmao.nomeIrmao || '—', b: true },
        { t: ', portador do Cadastro de Identidade Maçônica – CIM nº ', b: false },
        { t: irmao.cim || '—', b: true },
        { t: ', detentor do Grau ', b: false },
        { t: obterGrauLabel(irmao.grau), b: true },
        { t: ', encontra-se em ', b: false },
        { t: 'plena regularidade financeira', b: true },
        { t: ' perante a Tesouraria desta Augusta e Respeitável Loja Simbólica Acácia de Paranatinga nº 30, ', b: false },
        { t: 'inexistindo, até a presente data, quaisquer débitos, pendências financeiras ou obrigações pecuniárias em aberto em seu nome.', b: true },
      ];
    }
    return [
      { t: 'Certificamos, para os devidos fins, que o Irmão ', b: false },
      { t: irmao.nomeIrmao || '—', b: true },
      { t: ', portador do Cadastro de Identidade Maçônica – CIM nº ', b: false },
      { t: irmao.cim || '—', b: true },
      { t: ', detentor do Grau ', b: false },
      { t: obterGrauLabel(irmao.grau), b: true },
      { t: ', consta com débito(s) pendente(s) perante a Tesouraria desta Augusta e Respeitável Loja Simbólica Acácia de Paranatinga nº 30, no valor total de ', b: false },
      { t: fmtR(valorDevido), b: true },
      { t: ', relativo(s) a obrigação(ões) financeira(s) em aberto até a presente data.', b: false },
    ];
  };

  // Quebra as "partes" (cada uma com seu próprio estilo normal/negrito) em
  // palavras, remontando linha a linha respeitando a largura útil da página.
  const palavras = [];
  montarPartes().forEach(parte => {
    parte.t.split(' ').forEach((p, i, arr) => {
      palavras.push({ texto: p + (i < arr.length - 1 ? ' ' : ''), b: parte.b });
    });
  });

  doc.setFontSize(11.5);
  let linhaAtual = [];
  let larguraAtual = 0;

  const desenharLinha = (linha) => {
    let x = M;
    linha.forEach(w => {
      doc.setFont('helvetica', w.b ? 'bold' : 'normal');
      txt(w.texto, x, y);
      x += doc.getTextWidth(w.texto);
    });
    y += alturaLinha;
  };

  palavras.forEach(w => {
    doc.setFont('helvetica', w.b ? 'bold' : 'normal');
    const largura = doc.getTextWidth(w.texto);
    if (larguraAtual + largura > larguraUtil) {
      desenharLinha(linhaAtual);
      linhaAtual = [];
      larguraAtual = 0;
    }
    linhaAtual.push(w);
    larguraAtual += largura;
  });
  if (linhaAtual.length > 0) desenharLinha(linhaAtual);

  y += 8;

  // ── Parágrafo final ──────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11.5);
  const paragrafoFinal = doc.splitTextToSize(
    'A presente certidão é expedida a pedido do interessado e destina-se aos fins que se fizerem necessários, produzindo seus efeitos na data de sua emissão.',
    larguraUtil
  );
  paragrafoFinal.forEach(linha => { txt(linha, M, y); y += alturaLinha; });

  y += 14;

  // ── Local e data ──────────────────────────────────────────────────────────
  const hoje = new Date();
  const cidade = dadosLoja?.cidade || 'Paranatinga';
  const estado = dadosLoja?.estado || 'MT';
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  doc.setFontSize(11);
  txt(`${cidade}/${estado}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`, M, y);
  y += 26;

  // ── Assinaturas ─────────────────────────────────────────────────────────
  const assinatura = (nome, cargo, yy) => {
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.line(M, yy, M + 80, yy);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    txt(nome || '_____________________________', M, yy + 5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
    txt(cargo, M, yy + 10);
    doc.setTextColor(0);
  };
  assinatura(assinantes.tesoureiro, 'Tesoureiro', y);
  y += 26;
  assinatura(assinantes.veneravelMestre, 'Venerável Mestre', y);

  // ── Rodapé ──────────────────────────────────────────────────────────────
  doc.setFontSize(7); doc.setTextColor(150);
  txt('SysMaçom-MG - Desenvolvedor: Mauro George', M, 285);
  txt(`Emitido em ${hoje.toLocaleDateString('pt-BR')} às ${hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, W - M, 285, { align: 'right' });

  const tipoArquivo = negativa ? 'Negativa' : 'Positiva';
  doc.save(`Certidao_${tipoArquivo}_${(irmao.nomeIrmao || 'irmao').replace(/\s+/g, '_')}_${hoje.toISOString().split('T')[0]}.pdf`);
};
