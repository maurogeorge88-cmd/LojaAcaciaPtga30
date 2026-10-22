import { supabase } from '../../../supabaseClient';
import { ehAdminTotal, ehTesoureiro } from '../../../config/permissoes';

// ════════════════════════════════════════════════════════════════════════
// Conferência financeira — marco por data ("conferido até dd/mm/aaaa")
// Fechamento = Loja (bancário e caixa) + Tronco. Arco Real fica à parte.
// ════════════════════════════════════════════════════════════════════════

// Quem pode marcar a conferência e ver a Auditoria: Admin, Venerável e Tesoureiro
export const podeConferirFinanceiro = (u) => ehAdminTotal(u) || ehTesoureiro(u);

export const dataBR = (iso) => (iso ? String(iso).substring(0, 10).split('-').reverse().join('/') : '');

export const buscarUltimoFechamento = async () => {
  const { data, error } = await supabase.from('fechamentos_financeiros').select('*')
    .order('data_corte', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data || null;
};

export const buscarFechamentos = async (limite = 12) => {
  const { data, error } = await supabase.from('fechamentos_financeiros').select('*')
    .order('data_corte', { ascending: false }).order('id', { ascending: false }).limit(limite);
  if (error) throw error;
  return data || [];
};

// Valores da Loja e do Tronco até a data (calculados no banco)
export const snapshotFinanceiro = async (corte) => {
  const { data, error } = await supabase.rpc('fn_snapshot_financeiro', { p_corte: corte });
  if (error) throw error;
  return data || {};
};

const ROTULOS = {
  saldo_bancario: 'Saldo bancário',
  caixa_fisico: 'Caixa físico',
  tronco_banco: 'Tronco (banco)',
  tronco_especie: 'Tronco (espécie)',
};
const CHAVE_SNAPSHOT = {
  saldo_bancario: 'bancario',
  caixa_fisico: 'caixa',
  tronco_banco: 'tronco_banco',
  tronco_especie: 'tronco_especie',
};

// Compara o que foi conferido com o que o sistema calcula hoje para a mesma data
export const compararComFechamento = (fechamento, atual) => {
  if (!fechamento || !atual) return { mudou: false, itens: [] };
  const itens = Object.keys(ROTULOS).map((campo) => {
    const antes = Number(fechamento[campo] || 0);
    const agora = Number(atual[CHAVE_SNAPSHOT[campo]] || 0);
    return { campo, rotulo: ROTULOS[campo], antes, agora, diferenca: Math.round((agora - antes) * 100) / 100 };
  }).filter(i => Math.abs(i.diferenca) >= 0.005);
  return { mudou: itens.length > 0, itens };
};

// Alterações em lançamentos com data de pagamento até o corte, feitas DEPOIS da conferência
export const buscarAlteracoesAposConferencia = async (fechamento, limite = 2000) => {
  if (!fechamento) return [];
  const { data, error } = await supabase.from('auditoria_lancamentos')
    .select('id, em, operacao, lancamento_id, usuario_nome, usuario_email, antes, depois, data_pagamento_min')
    .gt('em', fechamento.conferido_em)
    .lte('data_pagamento_min', fechamento.data_corte)
    .order('em', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data || [];
};
