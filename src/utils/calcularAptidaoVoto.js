import { supabase } from '../supabaseClient';

// ════════════════════════════════════════════════════════════════════════
// Aptidão para votar (mesma regra da eleição da Loja)
//  • Tesouraria: 3 meses ou mais em aberto (consecutivos ou não) = inapto
//  • Presença: mínimo 50% no período (sessões em licença não contam)
//  • Prerrogativa: 70 anos há 6 meses ou mais → presença dispensada (★)
//  • Licença em qualquer parte do período → "Lic" (inapto)
//  • Ajuste manual: { irmao_id: { status: 'apto', justificativa } }
// ════════════════════════════════════════════════════════════════════════

export const LIMITE_MESES_PENDENTES = 3;
export const PRESENCA_MINIMA = 50;

const PREPOSICOES = ['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du', 'del'];
export const nomeCurto = (nome) => {
  const p = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (p.length <= 2) return p.join(' ');
  if (PREPOSICOES.includes(p[1].toLowerCase())) return p.slice(0, 3).join(' ');
  return p.slice(0, 2).join(' ');
};

// Situação do irmão na data (usa o histórico de situações)
const situacaoNaData = (i, dataISO, historico) => {
  const atual = String(i?.situacao || 'regular').toLowerCase();
  if (!dataISO) return atual;
  const d = String(dataISO).substring(0, 10);
  if (i.data_falecimento && i.data_falecimento <= d) return 'falecido';
  const hist = (historico || []).filter(h => h.membro_id === i.id && h.status !== 'cancelada');
  // Situação sem data de fim: vale até hoje se o cadastro já voltou a "regular"
  // (licença resolvida sem lançar a data de fim no histórico); senão, continua em aberto.
  const hojeSit = new Date().toISOString().substring(0, 10);
  const fimEfetivo = (h) => h.data_fim || (atual === 'regular' ? hojeSit : null);
  const cobre = hist.find(h => h.data_inicio && h.data_inicio <= d && (!fimEfetivo(h) || (h.data_fim ? h.data_fim >= d : d < fimEfetivo(h))));
  if (cobre) {
    const t = String(cobre.tipo_situacao || '').toLowerCase();
    if (t.includes('licen')) return 'licenciado';
    if (t.includes('deslig') || t.includes('exclu') || t.includes('quite') || t.includes('placet')) return 'desligado';
    if (t.includes('falec')) return 'falecido';
    return 'irregular';
  }
  if (atual === 'regular') return 'regular';
  // Licença já encerrada antes da data (cadastro ainda marcado como licenciado) → regular
  if (atual.includes('licen')) {
    const lics = hist.filter(h => String(h.tipo_situacao || '').toLowerCase().includes('licen'));
    if (lics.length && lics.every(h => h.data_fim && h.data_fim < d)) return 'regular';
  }
  if (hist.some(h => h.data_inicio && h.data_inicio > d)) return 'regular';
  if (i.data_desligamento && i.data_desligamento > d) return 'regular';
  return atual;
};

export const calcularAptidaoVoto = async ({ ref, ini, irmaos, ajustes = {} }) => {
  // Presença: até a última sessão já realizada (nunca além de hoje), mesmo que a eleição seja futura
  const hoje = new Date().toISOString().substring(0, 10);
  const refPresenca = ref < hoje ? ref : hoje;
  const { data: historico } = await supabase.from('historico_situacoes').select('membro_id, tipo_situacao, data_inicio, data_fim, status');

  // Universo: Mestres regulares ou licenciados na data (irregulares, desligados e falecidos ficam fora)
  const universo = (irmaos || []).filter(i => i.data_exaltacao && i.data_exaltacao <= ref
    && ['regular', 'licenciado'].includes(situacaoNaData(i, ref, historico)));

  // Tesouraria
  let lanc = [];
  for (let pg = 0; ; pg++) {
    const { data, error } = await supabase.from('lancamentos_loja')
      .select('origem_irmao_id, data_vencimento, status')
      .eq('origem_tipo', 'Irmao').in('status', ['pendente', 'parcial']).lte('data_vencimento', ref)
      .range(pg * 1000, pg * 1000 + 999);
    if (error) throw error;
    lanc = lanc.concat(data || []);
    if (!data || data.length < 1000) break;
  }

  // Presença
  const { data: sessoes } = await supabase.from('sessoes_presenca').select('id, data_sessao').gte('data_sessao', ini).lte('data_sessao', refPresenca);
  const dataSessao = Object.fromEntries((sessoes || []).map(x => [x.id, x.data_sessao]));
  const ids = (sessoes || []).map(x => x.id);
  let regs = [];
  for (let i = 0; i < ids.length; i += 100) {
    for (let pg = 0; ; pg++) {
      const { data } = await supabase.from('registros_presenca').select('membro_id, presente, sessao_id')
        .in('sessao_id', ids.slice(i, i + 100)).range(pg * 1000, pg * 1000 + 999);
      regs = regs.concat(data || []);
      if (!data || data.length < 1000) break;
    }
  }

  return universo.map(i => {
    const meses = [...new Set(lanc.filter(l => String(l.origem_irmao_id) === String(i.id))
      .map(l => String(l.data_vencimento || '').substring(0, 7)).filter(Boolean))].sort();
    const finOk = meses.length < LIMITE_MESES_PENDENTES;

    let data70 = null, isento70 = false;
    if (i.data_nascimento) {
      const n = new Date(String(i.data_nascimento).substring(0, 10) + 'T00:00:00');
      const d70 = new Date(n); d70.setFullYear(n.getFullYear() + 70);
      data70 = d70.toISOString().substring(0, 10);
      const lim = new Date(d70); lim.setMonth(lim.getMonth() + 6);
      isento70 = lim.toISOString().substring(0, 10) <= ref;
    }
    // Licença: só deixa inapto se ainda estiver licenciado na data da eleição (licença encerrada = regular)
        const licenca = situacaoNaData(i, ref, historico) === 'licenciado';

    const meus = regs.filter(r => String(r.membro_id) === String(i.id))
      .filter(r => situacaoNaData(i, dataSessao[r.sessao_id], historico) === 'regular')
      .filter(r => !data70 || String(dataSessao[r.sessao_id]) < data70);
    const presentes = meus.filter(r => r.presente).length;
    const total = meus.length;
    const pct = total ? Math.round((presentes / total) * 100) : 0;
    const presOk = isento70 || pct >= PRESENCA_MINIMA;
    const aptoAuto = finOk && presOk && !licenca;
    const ajuste = ajustes[String(i.id)];
    return {
      irmao: i, nome: i.nome, nomeCurto: nomeCurto(i.nome), cim: i.cim, meses, finOk,
      textoTesouraria: meses.length === 0 ? 'Em dia' : `${meses.length} mês(es) em aberto`,
      presentes, total, pct, presOk, isento70, licenca, aptoAuto, ajuste,
      motivos: [licenca && 'licenciado', !finOk && `tesouraria: ${meses.length} meses em aberto`, !presOk && `presença ${pct}%`].filter(Boolean).join(' · '),
      textoPresenca: isento70 ? `Dispensada (${pct}%)` : `${pct}% (${presentes}/${total})`,
      apto: ajuste ? ajuste.status === 'apto' : aptoAuto,
    };
  }).sort((a, b) => a.nomeCurto.localeCompare(b.nomeCurto));
};
