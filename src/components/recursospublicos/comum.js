// Estilos e utilitários compartilhados da Central de Recursos Públicos
import { supabase } from '../../supabaseClient';

export const BUCKET_NF = 'comodato-notas';
export const BUCKET_RP = 'recursos-publicos';

export const inp = (extra = {}) => ({
  background: 'var(--color-surface-2)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
  padding: '0.5rem 1rem', width: '100%', outline: 'none', boxSizing: 'border-box', ...extra,
});
export const lbl = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.35rem' };
export const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 50, padding: '1rem', overflowY: 'auto' };
export const box = (w = '40rem') => ({ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: w, marginTop: '0.5rem' });
export const head = { padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
export const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.1rem 1.4rem' };
export const btn = (cor = '99,102,241') => ({ padding: '0.5rem 1rem', background: `rgba(${cor},0.15)`, color: `rgb(${cor})`, border: `1px solid rgba(${cor},0.35)`, borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' });
export const btnPequeno = (cor = '99,102,241') => ({ ...btn(cor), padding: '0.3rem 0.7rem', fontSize: '0.78rem' });

export const moeda = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
export const dataBR = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '—');
export const num = (v) => Number(v) || 0;
export const arred = (v) => Math.round((Number(v) || 0) * 100) / 100;

export const TIPOS_APLICACAO = {
  doacao: { rotulo: 'Doações / Repasses', icone: '🎁', novo: 'Nova doação / repasse', descLabel: 'O que foi entregue *', descPh: 'Ex.: Respirador', destLabel: 'Destinatário (hospital, entidade...)', destPh: 'Ex.: Hospital Municipal' },
  obra:   { rotulo: 'Obras / Serviços', icone: '🏗️', novo: 'Nova obra / serviço', descLabel: 'Obra ou serviço *', descPh: 'Ex.: Construção de sala de leitura', destLabel: 'Entidade beneficiada', destPh: 'Ex.: Escola Municipal' },
  outro:  { rotulo: 'Outros', icone: '📌', novo: 'Nova aplicação', descLabel: 'Descrição *', descPh: 'Descreva a aplicação', destLabel: 'Destinatário / beneficiado', destPh: '' },
};
export const ROTULO_TIPO_ANEXO = { termo: 'Termo / ofício', nota_fiscal: 'Nota fiscal', comprovante: 'Comprovante / recibo', foto: 'Foto', outro: 'Outro' };

// Busca todas as linhas de uma consulta (blocos de 1000, contorna o limite do Supabase)
export async function buscarTudo(fabrica) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await fabrica().range(de, de + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export const nomeSeguro = (nome) => String(nome || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');

export async function abrirArquivo(bucket, path, showError) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
  if (error) { showError && showError('Não foi possível abrir o arquivo: ' + error.message); return; }
  window.open(data.signedUrl, '_blank', 'noopener');
}

export const urlParaDataUrl = async (url) => {
  const r = await fetch(url); const b = await r.blob();
  return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); });
};

// Resumo financeiro de um recurso (usa a view quando houver; senão calcula)
export function resumoDoRecurso(r, saldos) {
  const s = saldos?.[r.id];
  const recebido = num(s ? s.valor_recebido : r.valor_recebido);
  const comodato = num(s?.comodato_nf);
  const outras = num(s?.outras_aplicacoes);
  const equipamentos = num(s?.comodato_equipamentos);
  return { recebido, comodato, outras, equipamentos, aplicado: arred(comodato + outras), saldo: arred(recebido - comodato - outras) };
}

// ── Árvore de entes (qualquer profundidade) ──
// Devolve os entes em ordem de árvore, com `nivel`, `caminho` ("A › B › C") e `rotulo` (recuado, para selects).
export function montarArvore(lista) {
  const itens = lista || [];
  const porPai = {};
  itens.forEach(e => { const k = e.parent_id == null ? '' : String(e.parent_id); (porPai[k] = porPai[k] || []).push(e); });
  Object.values(porPai).forEach(l => l.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')));
  const ids = new Set(itens.map(e => String(e.id)));
  const out = []; const vistos = new Set();
  const visitar = (e, nivel, caminhoPai) => {
    if (vistos.has(String(e.id))) return; vistos.add(String(e.id));
    const caminho = caminhoPai ? `${caminhoPai} › ${e.nome}` : e.nome;
    const filhos = porPai[String(e.id)] || [];
    out.push({ ...e, nivel, caminho, rotulo: `${'\u00A0\u00A0\u00A0'.repeat(nivel)}${nivel ? '└ ' : ''}${e.nome}`, qtdFilhos: filhos.length });
    filhos.forEach(f => visitar(f, nivel + 1, caminho));
  };
  // raízes: sem pai, ou cujo pai não está visível para o usuário
  itens.filter(e => e.parent_id == null || !ids.has(String(e.parent_id)))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
    .forEach(e => visitar(e, 0, ''));
  return out;
}
// ids do ente e de todos os descendentes (para filtrar "Fórum" incluindo suas varas)
export function idsDoRamo(entes, id) {
  const set = new Set([String(id)]);
  let mudou = true;
  while (mudou) {
    mudou = false;
    (entes || []).forEach(e => { if (e.parent_id != null && set.has(String(e.parent_id)) && !set.has(String(e.id))) { set.add(String(e.id)); mudou = true; } });
  }
  return set;
}
