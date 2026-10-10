import {
  Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType,
} from 'docx';
import { supabase } from '../supabaseClient';
import { LOGO_LOJA_B64 } from './logoLoja';

// ════════════════════════════════════════════════════════════════════════
// Ata (Balaústre) das sessões normais — Aprendiz, Companheiro e Mestre
// Texto vem de Modelos de Documentos (tipo ata_sessao_<grau>), com fallback.
// Assinam: Venerável Mestre, Orador e Secretário do Corpo Administrativo
// do ano da sessão.
// ════════════════════════════════════════════════════════════════════════

export const TIPO_ATA_ELEICAO_GLEMT = 'ata_eleicao_glemt';

export const TIPO_MODELO_ATA = {
  Aprendiz: 'ata_sessao_aprendiz',
  Companheiro: 'ata_sessao_companheiro',
  Mestre: 'ata_sessao_mestre',
};

const GRAU_EXTENSO = {
  Aprendiz: 'Aprendiz Maçom (Grau 1)',
  Companheiro: 'Companheiro Maçom (Grau 2)',
  Mestre: 'Mestre Maçom (Grau 3)',
};
const GRAU_REUNIAO = { Aprendiz: 'Aprendiz Maçom', Companheiro: 'Companheiro Maçom', Mestre: 'Mestre Maçom' };

export const CORPO_ATA_PADRAO = [
  'Aos {data_sessao_extenso} da E∴ V∴, no Templo Maçônico, sito à {endereco_loja}, no Oriente de {cidade}-{estado}, reuniram-se no grau de {grau_reuniao} os obreiros do quadro da Augusta e Respeitável Loja Simbólica {nome_loja}, em nome e sob os auspícios da Sereníssima Grande Loja Maçônica do Estado de Mato Grosso – GLEMT. Os trabalhos foram abertos ritualisticamente às {hora_abertura} horas. A Loja estava assim constituída: V∴ M∴ {vm_nome}, 1º Vig∴ {primeiro_vigilante_nome}, 2º Vig∴ {segundo_vigilante_nome}, Orad∴ {orador_nome}, Secr∴ {secretario_nome}. O V∴ M∴ iniciou os trabalhos determinando que o Ir∴ Secr∴ procedesse à leitura do Balaústre da sessão anterior.',
  '*EXPEDIENTE:* ',
  '*BOLSA DE PROPOSTA E INFORMAÇÕES:* ',
  '*ORDEM DO DIA:* {ordem_dia}',
  '*TRONCO DE SOLIDARIEDADE:* Em seu giro recolheu a importância de R$ ______, moedas cunhadas e gravadas, a serem creditadas à Hospitalaria e debitadas à Tesouraria.',
  '*PALAVRA A BEM DA ORDEM E DO QUADRO EM PARTICULAR:* ',
  '*ENCERRAMENTO:* O V∴ M∴ encerrou a presente sessão ritualisticamente às {hora_encerramento} horas, tendo eu, {secretario_nome}, que a tudo assisti, elaborei e redigi o presente Balaústre, tomando o cuidado de fazê-lo em local ermo e longe das vistas profanas, o qual lido e, se aprovado, será assinado por quem de direito.',
].join('\n');
export const TITULO_ATA_PADRAO = 'ATA DE REUNIÃO Nº {numero_balaustre}/{ano_balaustre}';

// Ata da Sessão Eleitoral — eleição de Grão-Mestre e Adjunto da GLEMT
export const TITULO_ELEICAO_GLEMT_PADRAO = "ATA DA ASSEMBLEIA GERAL ORDINÁRIA DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA {nome_loja}, PARA ELEIÇÃO DA GRANDE LOJA DO ESTADO DE MATO GROSSO PARA O PERÍODO {periodo_glemt_barra}";
export const CORPO_ELEICAO_GLEMT_PADRAO = "Aos {data_sessao} da era vulgar, às {hora_abertura} horas, reuniram-se nesta A∴R∴L∴S∴ Acácia de Paranatinga nº 30, na sua sede localizada na {endereco_loja}, cidade de {cidade}/{estado}, em Sessão Ordinária para Eleição da Administração da Grande Loja do Estado de Mato Grosso – GLEMT, para os cargos do Sereníssimo Grão-Mestre, Eminente Grão-Mestre Adjunto, atendendo à convocação feita pelo Respeitabilíssimo Mestre (Presidente) e Membros da Diretoria, para cumprimento do que determinam a Constituição, Regulamento Geral da Ordem e Código Eleitoral Maçônico da GLEMT.\n\nPreenchidos os lugares em Loja, os trabalhos foram abertos em Grau de Mestre Maçom com um simples golpe de malhete pelo Respeitabilíssimo Mestre da Oficina, dispensando-se a Leitura da Ata dos últimos trabalhos e dos Expedientes, passando diretamente à deliberação da Ordem do Dia.\n*ORDEM DO DIA:* Consta da Ordem do Dia eleição do Sereníssimo Grão-Mestre e Eminente Grão-Mestre Adjunto da GLEMT, de acordo com o Edital de Convocação, para o período maçônico de {periodo_glemt}. De acordo com o Regulamento Geral da Ordem, os Veneráveis Irmãos Orador e Secretário foram convidados para formarem a Mesa Eleitoral, consequentemente, foram nomeados os Veneráveis Irmãos {escrutinador1_nome} e {escrutinador2_nome}, para ocuparem respectivamente, os lugares dos Veneráveis Irmãos Orador e Secretário de Ofício e serem os Escrutinadores. Por ordem do Respeitabilíssimo Mestre, houve a COMPOSIÇÃO DA MESA ELEITORAL E ESCRUTINADORES, formados pelo Respeitab∴ Mestre, Ir∴ {vm_nome}; Ven∴ Orador, Ir∴ {orador_nome}; Ven∴ Secretário, Ir∴ {secretario_nome}; Ven∴ Escrutinador, Ir∴ {escrutinador1_nome}; Ven∴ Escrutinador, Ir∴ {escrutinador2_nome}.\nA Mesa Eleitoral composta, o Respeitabilíssimo Mestre ordenou ao Ir∴ Secretário Substituto, que procedesse a leitura das Chapas apresentadas, a fim que todos os Veneráveis Irmãos presentes tomassem conhecimento dos nomes dos candidatos e seus respectivos cargos; e, assim o fez, sendo apresentada {chapas_apresentadas}\nEm seguida, por ordem do Respeitabilíssimo Mestre, o Venerável Chanceler, Ir∴ {chanceler_nome}, anunciou os Veneráveis Irmãos aptos a votar e ser votados. Em seguida, o Ir∴ Tesoureiro da Loja, anunciou os Ir∴ aptos a votar e ser votados, conforme o Regulamento Geral da Ordem e o Código Eleitoral Maçônico.\nEstando os Obreiros aptos a votar e serem votados, o Venerável Mestre de Cerimônias, procedeu a distribuição das Cédulas a todos os Obreiros Eleitores presentes à Sessão e por ordem do Respeitabilíssimo Mestre houve a suspensão dos trabalhos temporariamente para que os IIr∴ exercessem o direito de voto. Finalizado o processo de votação, o Respeitabilíssimo Mestre reencetou os trabalhos. Neste momento, o Ir∴ Secretário realizou a chamada dos Obreiros Eleitores em ordem, a fim de assinarem a Folha de Votação e depositarem o seu voto na urna.\nPor ordem do Respeitabilíssimo Mestre, o Venerável Mestre de Cerimônias em posse da urna contendo as Cédulas Eleitorais entregou no Trono, e com a ajuda dos Veneráveis Irmãos Orador e Secretário Substitutos, houve a conferência da quantidade de Cédulas com o número de votantes presentes, bem como, a fazer a apuração, com o seguinte resultado: {resultado_apuracao} Votos em branco: {votos_brancos}; votos nulos: {votos_nulos}; total de votantes: {total_votantes}. Com a finalização do processo de votação e apuração, o Respeitabilíssimo Mestre solicitou aos Veneráveis Irmãos Orador e Secretário de Ofício que retornem a seus postos e reassumam suas respectivas Joias e que os Veneráveis Irmãos Escrutinadores retornem, cada qual, a seu lugar, já em seguida, colocou a Palavra nas Colunas e no Oriente, a fim que os Veneráveis Irmãos se manifestassem exclusivamente sobre o Ato Eleitoral.\n*TRONCO DE SOLIDARIEDADE:* O Tronco de Solidariedade após fazer seu giro, sem formalidades conforme Regulamento Geral e do Código Eleitoral Maçônico, recolheu ______ kg de moedas cunhadas.\nEsta Ata é o que foi deliberado em Assembleia da Loja, em {data_sessao}, e é de responsabilidade dos dirigentes e de todos os participantes. Nada mais foi tratado. Eu, {secretario_nome} (Secretário), lavrei a presente Ata que vai assinada pelo Venerável Mestre, Orador e Secretário. Os trabalhos foram encerrados com um simples golpe de malhete.";

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze',
  'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte'];
const diaExtenso = (n) => {
  if (n <= 20) return n === 1 ? 'primeiro' : UNIDADES[n];
  if (n < 30) return `vinte e ${UNIDADES[n - 20]}`;
  if (n === 30) return 'trinta';
  return 'trinta e um';
};
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// "Aos sete dias do mês de outubro de 2.026" → aqui sem o "Aos" (fica no modelo)
const dataSessaoExtenso = (iso) => {
  if (!iso) return '[data da sessão]';
  const [a, m, d] = String(iso).substring(0, 10).split('-').map(Number);
  const dia = diaExtenso(d);
  const ano = String(a).replace(/^(\d)(\d{3})$/, '$1.$2');
  return `${dia} ${d === 1 ? 'dia' : 'dias'} do mês de ${MESES[m - 1]} de ${ano}`;
};
const hora = (h, padrao) => (h ? String(h).substring(0, 5) : padrao);

const NORM = (c) => String(c || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const b64ToBuffer = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

// Modelos de ata disponíveis para o grau (base + extras criados em Modelos de Documentos)
export const listarModelosAta = async (grau, { eleicao = false } = {}) => {
  const { data } = await supabase.from('modelos_documentos').select('id, tipo, nome, grau').eq('modulo', 'balaustres');
  const g = String(grau || '').toLowerCase();
  return (data || [])
    .filter(m => String(m.grau || m.tipo.replace('ata_sessao_', '')).toLowerCase() === g)
    // Sessão de eleição da GLEMT usa só o modelo de eleição; sessões normais não o mostram
    .filter(m => (eleicao ? m.tipo === TIPO_ATA_ELEICAO_GLEMT : m.tipo !== TIPO_ATA_ELEICAO_GLEMT))
    .sort((a, b) => (a.tipo === `ata_sessao_${g}` ? -1 : b.tipo === `ata_sessao_${g}` ? 1 : a.nome.localeCompare(b.nome)));
};

export const gerarAtaSessao = async ({ balaustre, modeloId = null }) => {
  // Dados da Loja e nomes dos irmãos (busca própria: o componente não precisa passar nada)
  const [{ data: lojaData }, { data: irmaosData }] = await Promise.all([
    supabase.from('dados_loja').select('*').limit(1),
    supabase.from('irmaos').select('id, nome, cim, data_exaltacao, situacao, data_falecimento'),
  ]);
  const dadosLoja = (lojaData && lojaData[0]) || {};
  const irmaos = irmaosData || [];
  const grau = balaustre.grau_sessao || 'Aprendiz';
  const anoSessao = parseInt(balaustre.ano_balaustre || String(balaustre.data_sessao || '').substring(0, 4)) || new Date().getFullYear();

  // Modelo
  const ehEleicao = !!(balaustre.eleicao_glemt && balaustre.eleicao_glemt.ativo);
  const { data: mod } = modeloId
    ? await supabase.from('modelos_documentos').select('*').eq('id', modeloId).maybeSingle()
    : await supabase.from('modelos_documentos').select('*').eq('tipo', ehEleicao ? TIPO_ATA_ELEICAO_GLEMT : TIPO_MODELO_ATA[grau]).maybeSingle();
  const modelo = mod || (ehEleicao ? { titulo_doc: TITULO_ELEICAO_GLEMT_PADRAO, corpo: CORPO_ELEICAO_GLEMT_PADRAO } : {});

  // Balaustre anterior do mesmo grau (sessão imediatamente antes desta)
  const { data: anteriores } = await supabase.from('balaustres')
    .select('numero_balaustre, ano_balaustre, data_sessao')
    .eq('grau_sessao', grau)
    .lt('data_sessao', balaustre.data_sessao || '9999-12-31')
    .order('data_sessao', { ascending: false })
    .limit(1);
  const anterior = (anteriores || [])[0] || null;
  const fmt = (iso) => (iso ? String(iso).substring(0, 10).split('-').reverse().join('/') : '');
  const hoje = new Date();
  const dataAtual = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;

  // Corpo Administrativo do ano da sessão
  // (ano_exercicio pode ser "2026" ou "2026/2027")
  const { data: corpoTodos } = await supabase.from('corpo_administrativo').select('cargo, ano_exercicio, irmao_id');
  const corpo = (corpoTodos || []).filter(c => String(c.ano_exercicio || '').split(/[^0-9]+/).includes(String(anoSessao)));
  const nomeCargo = (...alvos) => {
    const reg = (corpo || []).find(c => alvos.includes(NORM(c.cargo)));
    const ir = reg ? irmaos.find(i => i.id === reg.irmao_id) : null;
    return ir?.nome || null;
  };
  const vm = nomeCargo('veneravel mestre', 'veneravel');
  const v1 = nomeCargo('primeiro vigilante', '1º vigilante', '1o vigilante');
  const v2 = nomeCargo('segundo vigilante', '2º vigilante', '2o vigilante');
  const orador = nomeCargo('orador');
  const secretario = nomeCargo('secretario');
  const chanceler = nomeCargo('chanceler');

  const VARS = {
    numero_balaustre: String(balaustre.numero_balaustre ?? ''),
    data_atual: dataAtual,
    balaustre_anterior: anterior ? `${anterior.numero_balaustre}/${anterior.ano_balaustre || String(anterior.data_sessao || '').substring(0, 4)}` : '[sem balaustre anterior]',
    data_balaustre_anterior: anterior ? fmt(anterior.data_sessao) : '[sem data]',
    ano_balaustre: String(anoSessao),
    data_sessao: balaustre.data_sessao ? balaustre.data_sessao.split('-').reverse().join('/') : '',
    data_sessao_extenso: dataSessaoExtenso(balaustre.data_sessao),
    dia_semana: balaustre.dia_semana || '',
    grau: grau,
    grau_extenso: GRAU_EXTENSO[grau] || grau,
    grau_reuniao: GRAU_REUNIAO[grau] || grau,
    hora_abertura: hora(balaustre.hora_abertura, '20:00'),
    hora_encerramento: hora(balaustre.hora_encerramento, '22:00'),
    ordem_dia: balaustre.ordem_dia || '',
    observacoes: balaustre.observacoes || '',
    nome_loja: `ACÁCIA DE PARANATINGA Nº ${dadosLoja.numero_loja || '30'}`,
    endereco_loja: dadosLoja.endereco || '[endereço da Loja]',
    cidade: dadosLoja.cidade || 'Paranatinga',
    estado: dadosLoja.estado || 'MT',
    vm_nome: vm || '[Venerável Mestre]',
    primeiro_vigilante_nome: v1 || '[1º Vigilante]',
    segundo_vigilante_nome: v2 || '[2º Vigilante]',
    orador_nome: orador || '[Orador]',
    secretario_nome: secretario || '[Secretário]',
    chanceler_nome: chanceler || '[Chanceler]',
  };
  // ── Eleição da GLEMT (balaustre.eleicao_glemt) ──
  const el = balaustre.eleicao_glemt && balaustre.eleicao_glemt.ativo ? balaustre.eleicao_glemt : null;
  if (el) {
    const nomeIr = (id) => irmaos.find(i => String(i.id) === String(id))?.nome || '';
    const chapas = (el.chapas || []).filter(c => c && (c.nome || c.gm));
    const num = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v) || 0);
    const vencedora = [...chapas].map((c, i) => ({ ...c, i })).sort((a, b) => num(b.votos) - num(a.votos))[0];
    const empate = chapas.filter(c => num(c.votos) === num(vencedora?.votos)).length > 1;
    Object.assign(VARS, {
      periodo_glemt: el.ano_inicio && el.ano_fim ? `${el.ano_inicio} a ${el.ano_fim}` : '[período]',
      periodo_glemt_barra: el.ano_inicio && el.ano_fim ? `${el.ano_inicio}/${el.ano_fim}` : '[período]',
      chapas_apresentadas: chapas.length
        ? chapas.map(c => `a Chapa ${c.nome || '[nome]'}, para a qual o Ir∴ ${c.gm || '[nome]'} é candidato para o cargo de Grão-Mestre e o Ir∴ ${c.gm_adjunto || '[nome]'}, para o cargo de Grão-Mestre Adjunto`).join('; e, ') + '.'
        : '[chapas].',
      escrutinador1_nome: nomeIr(el.escrutinador1_id) || '[Escrutinador 1]',
      escrutinador2_nome: nomeIr(el.escrutinador2_id) || '[Escrutinador 2]',
      chapas_lista: chapas.map((c, i) => `Chapa ${i + 1} – ${c.nome || '[nome]'}: Grão-Mestre Ir∴ ${c.gm || '[nome]'} e Grão-Mestre Adjunto Ir∴ ${c.gm_adjunto || '[nome]'}`).join('; ') + '.',
      resultado_apuracao: chapas.map((c, i) => `Chapa ${i + 1} – ${c.nome || '[nome]'}: ${num(c.votos)} voto(s)`).join('; ') + '.',
      votos_brancos: String(num(el.brancos)),
      votos_nulos: String(num(el.nulos)),
      total_votantes: String(num(el.votantes) || (chapas.reduce((t, c) => t + num(c.votos), 0) + num(el.brancos) + num(el.nulos)) || (el.presentes || []).length),
      chapa_vencedora: !vencedora ? '[chapa]' : empate ? 'votação empatada entre as chapas' : `Chapa ${vencedora.i + 1} – ${vencedora.nome}`,
    });
    chapas.forEach((c, i) => {
      VARS[`chapa${i + 1}_nome`] = c.nome || '';
      VARS[`chapa${i + 1}_gm`] = c.gm || '';
      VARS[`chapa${i + 1}_gm_adjunto`] = c.gm_adjunto || '';
      VARS[`votos_chapa${i + 1}`] = String(num(c.votos));
    });
  }
  const interp = (t) => Object.entries(VARS).reduce((x, [k, v]) => x.replaceAll(`{${k}}`, v ?? ''), String(t || ''));

  // ── Helpers de formatação (Times New Roman 12, como os demais documentos) ──
  const ar = (txt, o = {}) => new TextRun({ text: String(txt ?? ''), font: 'Times New Roman', size: 24, bold: !!o.bold });
  const runs = (t) => String(t).split(/(\*[^*]+\*)/g).filter(Boolean)
    .map(p => (p.length > 2 && p.startsWith('*') && p.endsWith('*') ? ar(p.slice(1, -1), { bold: true }) : ar(p)));
  const par = (children, o = {}) => new Paragraph({
    alignment: o.align ?? AlignmentType.JUSTIFIED,
    spacing: { before: o.before ?? 0, after: o.after ?? 120, line: o.line ?? 276 },
    children,
  });
  const LINHA = '_____________________________________';
  const linhaSimples = (t, bold = false, before = 0) => par([ar(t, { bold })], { align: AlignmentType.CENTER, before, after: 0, line: 240 });

  const corpoTexto = interp(modelo.corpo || CORPO_ATA_PADRAO);
  const paragrafos = corpoTexto.split('\n').map(l => (l.trim() === ''
    ? par([ar('')], { after: 0 })
    : par(runs(l), { align: modelo.alinhamento_corpo === 'left' ? AlignmentType.LEFT : AlignmentType.JUSTIFIED })));

  const children = [
    // Logo opcional (Modelos de Documentos → "Exibir o logo da Loja")
    ...(modelo.mostrar_logo ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
      children: [new ImageRun({ type: 'jpg', data: b64ToBuffer(LOGO_LOJA_B64), transformation: { width: 90, height: 90 } })] })] : []),
    // Título: cada linha do modelo = uma linha (título de 1 linha ganha "Sessão de <grau>")
    ...(() => {
      const linhasTit = interp(modelo.titulo_doc || TITULO_ATA_PADRAO).replace(/\*/g, '').split('\n').filter(l => l.trim() !== '');
      if (linhasTit.length === 1 && !ehEleicao) linhasTit.push(`Sessão de ${VARS.grau_extenso}`);
      return linhasTit.map((l, i) => par([ar(l, { bold: true })], { align: AlignmentType.CENTER, after: i === linhasTit.length - 1 ? 280 : 0 }));
    })(),
    ...paragrafos,
    // Assinaturas (centralizadas): Venerável Mestre, Orador e Secretário
    ...[[VARS.vm_nome, 'Venerável Mestre'], [VARS.orador_nome, 'Orador'], [VARS.secretario_nome, 'Secretário']].flatMap(([n, c], i) => [
      linhaSimples(LINHA, false, i === 0 ? 700 : 600),
      linhaSimples(`Ir∴ ${String(n).toUpperCase()}`, true),
      linhaSimples(c),
    ]),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 2835, bottom: 1588, left: 1984, right: 1134 } /* sup. 5 cm · inf. 2,8 cm · esq. 3,5 cm · dir. 2 cm */ } },
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  const nome = `Ata_${grau}_${VARS.numero_balaustre}-${VARS.ano_balaustre}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { faltando: [!vm && 'Venerável Mestre', !orador && 'Orador', !secretario && 'Secretário'].filter(Boolean) };
};

// ════════════════════════════════════════════════════════════════════════
// Lista de presença — Sessão Eleitoral da GLEMT (Mestres regulares na data)
// ════════════════════════════════════════════════════════════════════════
export const gerarListaPresencaEleicaoGLEMT = async ({ balaustre }) => {
  const { Table, TableRow, TableCell, WidthType, BorderStyle } = await import('docx');
  const [{ data: lojaData }, { data: irmaosData }] = await Promise.all([
    supabase.from('dados_loja').select('*').limit(1),
    supabase.from('irmaos').select('id, nome, cim, data_exaltacao, situacao, data_falecimento'),
  ]);
  const dadosLoja = (lojaData && lojaData[0]) || {};
  const d = String(balaustre.data_sessao || '').substring(0, 10);
  const el = balaustre.eleicao_glemt || {};
  // Presença marcada no balaustre → só os presentes; sem marcação → todos os Mestres aptos
  const presentes = (el.presentes || []).map(String);
  const mestres = (irmaosData || [])
    .filter(i => !presentes.length || presentes.includes(String(i.id)))
    .filter(i => presentes.length || String(i.situacao || 'regular').toLowerCase() === 'regular')
    .filter(i => i.data_exaltacao && (!d || i.data_exaltacao <= d))
    .filter(i => !i.data_falecimento || (d && i.data_falecimento > d))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const periodo = el.ano_inicio && el.ano_fim ? `${el.ano_inicio} a ${el.ano_fim}` : '';

  const ar = (t, o = {}) => new TextRun({ text: String(t ?? ''), font: 'Times New Roman', size: o.size || 24, bold: !!o.bold });
  const par = (children, o = {}) => new Paragraph({ alignment: o.align ?? AlignmentType.CENTER, spacing: { before: 0, after: o.after ?? 0, line: 240 }, children });
  const fino = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
  const bd = { top: fino, bottom: fino, left: fino, right: fino };
  const W = 11906 - 1984 - 1134;
  const CW = [600, 4400, 1300, W - 6300];
  const cel = (t, w, o = {}) => new TableCell({ borders: bd, width: { size: w, type: WidthType.DXA }, margins: { top: 150, bottom: 150, left: 80, right: 80 }, // espaço para assinar
    children: [par([ar(t, o)], { align: o.align ?? AlignmentType.LEFT })] });

  const tabela = new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: CW,
    rows: [
      new TableRow({ tableHeader: true, children: [cel('Nº', CW[0], { bold: true, align: AlignmentType.CENTER }), cel('Irmão', CW[1], { bold: true }), cel('CIM', CW[2], { bold: true, align: AlignmentType.CENTER }), cel('Assinatura', CW[3], { bold: true, align: AlignmentType.CENTER })] }),
      ...mestres.map((m, i) => new TableRow({ children: [
        cel(String(i + 1), CW[0], { align: AlignmentType.CENTER }), cel(m.nome, CW[1]), cel(m.cim || '', CW[2], { align: AlignmentType.CENTER }), cel('', CW[3]),
      ] })),
    ],
  });

  const dataFmt = d ? d.split('-').reverse().join('/') : '';
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1418, bottom: 1418, left: 1984, right: 1134 } } },
      children: [
        par([ar('LISTA DE PRESENÇA — SESSÃO ELEITORAL', { bold: true })]),
        par([ar(`Eleição de Grão-Mestre e Grão-Mestre Adjunto da GLEMT${periodo ? ` — Período ${periodo}` : ''}`, { bold: true })]),
        par([ar(`A∴R∴L∴S∴ Acácia de Paranatinga nº ${dadosLoja.numero_loja || '30'} — ${dadosLoja.cidade || 'Paranatinga'}-${dadosLoja.estado || 'MT'} — Sessão de ${dataFmt}`)], { after: 240 }),
        tabela,
        par([ar(presentes.length ? `Total de Mestres presentes: ${mestres.length}` : `Total de Mestres aptos: ${mestres.length}`)], { align: AlignmentType.LEFT, after: 0 }),
      ],
    }],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `Lista_Presenca_Eleicao_GLEMT_${dataFmt.replace(/\//g, '-')}.docx`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
