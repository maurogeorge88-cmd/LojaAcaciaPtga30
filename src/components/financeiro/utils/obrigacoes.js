import { supabase } from '../../../supabaseClient';
import { ehAdminTotal, ehTesoureiro } from '../../../config/permissoes';

// ════════════════════════════════════════════════════════════════════════
// OBRIGAÇÕES — lembretes de contas recorrentes (água, energia, IPTU…).
// Não geram lançamento: só avisam, e a baixa por período fica na própria tela.
// ════════════════════════════════════════════════════════════════════════

export const PERIODICIDADES = {
  mensal: { rotulo: 'Mensal', meses: 1 },
  bimestral: { rotulo: 'Bimestral', meses: 2 },
  trimestral: { rotulo: 'Trimestral', meses: 3 },
  semestral: { rotulo: 'Semestral', meses: 6 },
  anual: { rotulo: 'Anual', meses: 12 },
};

// Quem cadastra e dá baixa: Admin, Venerável e Tesoureiro
const ehVeneravelMestre = (u) => String(u?.cargo || '').toLowerCase().includes('vener');
export const podeGerirObrigacoes = (u) => ehAdminTotal(u) || ehTesoureiro(u) || ehVeneravelMestre(u);

const iso = (d) => d.toISOString().split('T')[0];
export const dataBR = (s) => (s ? String(s).substring(0, 10).split('-').reverse().join('/') : '');
export const competenciaDe = (dataISO) => String(dataISO).substring(0, 7);

// Vencimento do período em que a obrigação está agora (ou o próximo, se já passou e foi resolvida)
const vencimentoNoMes = (o, ano, mes) => {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dia = Math.min(o.dia_vencimento || 10, ultimoDia);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

// Os vencimentos de uma obrigação dentro de uma janela (do passado recente ao futuro próximo)
export const vencimentosNaJanela = (o, deISO, ateISO) => {
  const passo = PERIODICIDADES[o.periodicidade]?.meses || 1;
  const base = o.periodicidade === 'mensal' ? null : (o.mes_referencia || 1);
  const saida = [];
  const ini = new Date(`${deISO}T00:00:00`);
  const fim = new Date(`${ateISO}T00:00:00`);
  for (let ano = ini.getFullYear(); ano <= fim.getFullYear(); ano++) {
    for (let mes = 1; mes <= 12; mes++) {
      // nas não mensais, só os meses no ciclo a partir do mês de referência
      if (base !== null && ((mes - base) % passo + passo) % passo !== 0) continue;
      const venc = vencimentoNoMes(o, ano, mes);
      if (venc >= deISO && venc <= ateISO) saida.push(venc);
    }
  }
  return saida;
};

// Obrigações a avisar: dentro do prazo de antecedência ou já vencidas e não resolvidas
export const buscarAvisosObrigacoes = async () => {
  const [{ data: obrigacoes }, { data: baixas }] = await Promise.all([
    supabase.from('obrigacoes').select('*').eq('ativa', true).order('nome'),
    supabase.from('obrigacoes_baixas').select('obrigacao_id, competencia'),
  ]);
  const resolvidas = new Set((baixas || []).map(b => `${b.obrigacao_id}|${b.competencia}`));
  const hoje = iso(new Date());
  const ate = new Date(); ate.setMonth(ate.getMonth() + 14);  // cobre até o próximo ciclo anual

  const avisos = [];
  (obrigacoes || []).forEach((o) => {
    // Começa na data do cadastro (nunca antes): não inventa pendências do passado
    const inicio = o.created_at ? String(o.created_at).substring(0, 10) : hoje;
    const de = inicio > hoje ? inicio : (inicio || hoje);
    // Uma linha por obrigação: o vencimento pendente mais antigo
    const pendente = vencimentosNaJanela(o, de, iso(ate))
      .find(v => !resolvidas.has(`${o.id}|${competenciaDe(v)}`));
    if (!pendente) return;
    const dias = Math.round((new Date(`${pendente}T00:00:00`) - new Date(`${hoje}T00:00:00`)) / 86400000);
    // só entra no aviso quando chega o prazo de antecedência (ou já venceu)
    if (dias > (o.dias_aviso ?? 5)) return;
    avisos.push({ ...o, vencimento: pendente, competencia: competenciaDe(pendente), dias, vencida: dias < 0 });
  });
  return avisos.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
};

// Próximo vencimento de cada obrigação (mesmo fora do prazo de aviso) — para a tela
export const proximosVencimentos = async () => {
  const [{ data: obrigacoes }, { data: baixas }] = await Promise.all([
    supabase.from('obrigacoes').select('*').eq('ativa', true).order('nome'),
    supabase.from('obrigacoes_baixas').select('obrigacao_id, competencia'),
  ]);
  const resolvidas = new Set((baixas || []).map(b => `${b.obrigacao_id}|${b.competencia}`));
  const hoje = iso(new Date());
  const ate = new Date(); ate.setMonth(ate.getMonth() + 14);
  return (obrigacoes || []).map((o) => {
    const inicio = o.created_at ? String(o.created_at).substring(0, 10) : hoje;
    const pendente = vencimentosNaJanela(o, inicio, iso(ate))
      .find(v => !resolvidas.has(`${o.id}|${competenciaDe(v)}`));
    if (!pendente) return null;
    const dias = Math.round((new Date(`${pendente}T00:00:00`) - new Date(`${hoje}T00:00:00`)) / 86400000);
    return { ...o, vencimento: pendente, competencia: competenciaDe(pendente), dias, vencida: dias < 0, noPrazoDeAviso: dias <= (o.dias_aviso ?? 5) };
  }).filter(Boolean).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
};

export const darBaixa = async (obrigacaoId, competencia) => {
  const { data, error } = await supabase.from('obrigacoes_baixas')
    .insert([{ obrigacao_id: obrigacaoId, competencia }]).select();
  if (error) throw error;
  if (!data?.length) throw new Error('o banco não permitiu a baixa (sem permissão).');
  return data[0];
};

export const desfazerBaixa = async (obrigacaoId, competencia) => {
  const { error } = await supabase.from('obrigacoes_baixas').delete()
    .eq('obrigacao_id', obrigacaoId).eq('competencia', competencia);
  if (error) throw error;
};
