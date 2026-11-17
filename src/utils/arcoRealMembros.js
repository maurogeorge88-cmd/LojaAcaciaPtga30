// Helpers compartilhados das telas de Membros do Arco Real
// (Dashboard, Visualização de Membros, Quadro de Membros, Licenças e Situações).
import { supabase } from '../supabaseClient';

export const SITUACOES_ARCO_REAL = {
  regular:    { label: 'Regular',    cor: '#10b981', icone: '✅' },
  licenciado: { label: 'Licenciado', cor: '#6366f1', icone: '📋' },
  desligado:  { label: 'Desligado',  cor: '#64748b', icone: '🚪' },
  excluido:   { label: 'Excluído',   cor: '#ef4444', icone: '❌' },
  falecido:   { label: 'Falecido',   cor: '#8b5cf6', icone: '🕊️' },
};

export const situacaoCor = (s) => SITUACOES_ARCO_REAL[s]?.cor || '#64748b';
export const situacaoLabel = (s) => SITUACOES_ARCO_REAL[s]?.label || (s || '—');

// "Ativo" no quadro = regular ou licenciado
export const membroNoQuadro = (m) => m && m.ativo !== false && (m.situacao === 'regular' || m.situacao === 'licenciado');

// 'YYYY-MM-DD' -> dd/mm/aaaa (sem passar por Date, evita problema de fuso)
export const fmtData = (d) => {
  if (!d) return '—';
  const [a, m, dia] = String(d).substring(0, 10).split('-');
  return a && m && dia ? `${dia}/${m}/${a}` : '—';
};

const hojeISO = () => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
};
export { hojeISO };

// Diferença em meses inteiros entre duas datas ISO (ini <= fim)
export const mesesEntre = (ini, fim = hojeISO()) => {
  if (!ini) return null;
  const [a1, m1, d1] = ini.substring(0, 10).split('-').map(Number);
  const [a2, m2, d2] = fim.substring(0, 10).split('-').map(Number);
  let meses = (a2 - a1) * 12 + (m2 - m1);
  if (d2 < d1) meses -= 1;
  return meses < 0 ? 0 : meses;
};

// Tempo de Arco Real (a partir da data de exaltação) -> "12 anos e 3 meses"
export const tempoTexto = (meses) => {
  if (meses === null || meses === undefined) return '—';
  const a = Math.floor(meses / 12), m = meses % 12;
  const pa = a === 1 ? '1 ano' : `${a} anos`;
  const pm = m === 1 ? '1 mês' : `${m} meses`;
  if (a === 0) return m === 0 ? 'menos de 1 mês' : pm;
  return m === 0 ? pa : `${pa} e ${pm}`;
};
export const tempoDeArcoReal = (dataExaltacao) => tempoTexto(mesesEntre(dataExaltacao));

export const calcularIdade = (nasc) => {
  if (!nasc) return null;
  const [a, m, d] = nasc.substring(0, 10).split('-').map(Number);
  const h = new Date();
  let idade = h.getFullYear() - a;
  if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) idade -= 1;
  return idade;
};

// Primeiro nome + último sobrenome (ignora "de/da/do...")
export const nomeCurto = (nome) => {
  if (!nome) return '';
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return nome.trim();
  if (['de', 'da', 'do', 'das', 'dos'].includes(partes[1].toLowerCase())) return `${partes[0]} ${partes[partes.length - 1]}`;
  return partes.slice(0, 2).join(' ');
};

export const iniciais = (nome) => (nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

// Próximo aniversário a partir de hoje: { dias, idade } (dias = 0 se for hoje)
export const proximoAniversario = (nasc) => {
  if (!nasc) return null;
  const [a, m, d] = nasc.substring(0, 10).split('-').map(Number);
  const h = new Date();
  const hoje = new Date(h.getFullYear(), h.getMonth(), h.getDate());
  let prox = new Date(h.getFullYear(), m - 1, d);
  if (prox < hoje) prox = new Date(h.getFullYear() + 1, m - 1, d);
  const dias = Math.round((prox - hoje) / 86400000);
  return { dias, idade: prox.getFullYear() - a, data: prox };
};

// Períodos de licença/situação (tabela nova). Se a tabela ainda não existe
// (SQL não rodado), devolve lista vazia sem quebrar as telas.
export const buscarPeriodosSituacao = async () => {
  try {
    const { data, error } = await supabase
      .from('arco_real_situacoes')
      .select('id, membro_id, tipo_situacao, data_inicio, data_fim, motivo, status')
      .order('data_inicio', { ascending: false });
    if (error) return [];
    return (data || []).filter(p => p.status !== 'cancelada');
  } catch {
    return [];
  }
};

// Período cobre a data? (data_fim vazia = em aberto/indefinido)
export const periodoCobre = (p, dataISO) =>
  p.data_inicio <= dataISO && (!p.data_fim || dataISO <= p.data_fim);

// Presença do membro nas sessões informadas, no padrão da Loja:
// só conta sessões com registro, a partir da exaltação e fora de períodos de situação.
// sessoes: [{id, data_sessao}], regs: Set de `${membro_id}|${sessao_id}` -> presente(bool) via Map
export const calcularPresencaMembro = (membro, sessoes, mapaPresenca, periodos = []) => {
  const meus = periodos.filter(p => p.membro_id === membro.id);
  let elegiveis = 0, presentes = 0;
  sessoes.forEach(s => {
    if (membro.data_exaltacao && s.data_sessao < membro.data_exaltacao) return;
    if (meus.some(p => periodoCobre(p, s.data_sessao))) return;
    elegiveis += 1;
    if (mapaPresenca.get(`${membro.id}|${s.id}`)) presentes += 1;
  });
  return { elegiveis, presentes, pct: elegiveis ? Math.round((presentes / elegiveis) * 100) : null };
};

// Logo do Arco Real (bucket público) convertida em data URL — o jsPDF.addImage
// falha em silêncio com URL; precisa de base64.
export const carregarLogoArcoRealBase64 = async () => {
  try {
    const url = supabase.storage.from('arcoreal').getPublicUrl('logo.png').data.publicUrl;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};
