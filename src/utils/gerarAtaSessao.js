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
export const listarModelosAta = async (grau) => {
  const { data } = await supabase.from('modelos_documentos').select('id, tipo, nome, grau').eq('modulo', 'balaustres');
  const g = String(grau || '').toLowerCase();
  return (data || [])
    .filter(m => String(m.grau || m.tipo.replace('ata_sessao_', '')).toLowerCase() === g)
    .sort((a, b) => (a.tipo === `ata_sessao_${g}` ? -1 : b.tipo === `ata_sessao_${g}` ? 1 : a.nome.localeCompare(b.nome)));
};

export const gerarAtaSessao = async ({ balaustre, modeloId = null }) => {
  // Dados da Loja e nomes dos irmãos (busca própria: o componente não precisa passar nada)
  const [{ data: lojaData }, { data: irmaosData }] = await Promise.all([
    supabase.from('dados_loja').select('*').limit(1),
    supabase.from('irmaos').select('id, nome'),
  ]);
  const dadosLoja = (lojaData && lojaData[0]) || {};
  const irmaos = irmaosData || [];
  const grau = balaustre.grau_sessao || 'Aprendiz';
  const anoSessao = parseInt(balaustre.ano_balaustre || String(balaustre.data_sessao || '').substring(0, 4)) || new Date().getFullYear();

  // Modelo
  const { data: mod } = modeloId
    ? await supabase.from('modelos_documentos').select('*').eq('id', modeloId).maybeSingle()
    : await supabase.from('modelos_documentos').select('*').eq('tipo', TIPO_MODELO_ATA[grau]).maybeSingle();
  const modelo = mod || {};

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
  };
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
      if (linhasTit.length === 1) linhasTit.push(`Sessão de ${VARS.grau_extenso}`);
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
