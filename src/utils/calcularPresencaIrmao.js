import { supabase } from '../supabaseClient';

// ════════════════════════════════════════════════════════════════════════
// Presença de UM irmão — mesma regra do Dashboard de Presença (resumoCompleto),
// para que "Minhas Presenças" e "Meu Perfil Completo" mostrem o mesmo número.
//
//  • Só contam as sessões em que o irmão TEM registro de presença
//    (sessão sem registro não é falta registrada — fica como "Sem registro").
//  • Fora da conta: sessão antes do ingresso/iniciação, depois do falecimento,
//    de grau superior ao que o irmão tinha NA DATA e durante situação bloqueadora
//    (desligado, irregular, suspenso, excluído, ex-ofício…). Licença NÃO exclui.
//  • Sessões só até hoje (nunca futuras).
//  • taxa = presentes / registros válidos.
// ════════════════════════════════════════════════════════════════════════

const semAcento = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const TIPOS_ENCERRAMENTO = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio'];

async function paginar(montar) {
  let tudo = [];
  for (let pg = 0; pg < 50; pg++) {
    const { data, error } = await montar().range(pg * 1000, pg * 1000 + 999);
    if (error) throw error;
    tudo = tudo.concat(data || []);
    if (!data || data.length < 1000) break;
  }
  return tudo;
}

export async function calcularPresencaIrmao({ irmao, inicio, fim }) {
  const hoje = new Date().toISOString().split('T')[0];
  const fimEfetivo = fim && fim < hoje ? fim : hoje;
  const vazio = { sessoes: [], registros: {}, validas: [], stats: { total: 0, presencas: 0, justificadas: 0, ausencias: 0, taxa: 0 } };
  if (!irmao?.id) return vazio;

  // 1) Sessões do período, até hoje
  const sessoesPerio = await paginar(() => supabase.from('sessoes_presenca')
    .select('id, data_sessao, grau_sessao_id, graus_sessao:grau_sessao_id(nome, grau_minimo_requerido)')
    .gte('data_sessao', inicio || '1900-01-01').lte('data_sessao', fimEfetivo)
    .order('data_sessao', { ascending: false }));
  if (!sessoesPerio.length) return vazio;

  // 2) Situações do irmão (só as ativas, como no Dashboard)
  const historico = await paginar(() => supabase.from('historico_situacoes')
    .select('membro_id, tipo_situacao, data_inicio, data_fim, status')
    .eq('status', 'ativa').eq('membro_id', irmao.id));

  // 3) Registros do irmão nessas sessões (em lotes — evita URL gigante)
  const ids = sessoesPerio.map(s => s.id);
  let regs = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from('registros_presenca')
      .select('sessao_id, presente, justificativa').eq('membro_id', irmao.id).in('sessao_id', ids.slice(i, i + 100));
    if (error) throw error;
    regs = regs.concat(data || []);
  }
  const mapaRegs = {};
  regs.forEach(r => { mapaRegs[r.sessao_id] = r; });

  // Irmão sem nenhum grau cadastrado não entra na conta
  if (!irmao.data_exaltacao && !irmao.data_elevacao && !irmao.data_iniciacao) return { ...vazio, sessoes: [] };

  // Mesma construção de datas do Dashboard (garante o mesmo resultado dia a dia)
  const dataExaltacao = irmao.data_exaltacao ? new Date(irmao.data_exaltacao) : null;
  const dataElevacao = irmao.data_elevacao ? new Date(irmao.data_elevacao) : null;
  const dataInicio = irmao.data_ingresso_loja ? new Date(irmao.data_ingresso_loja)
    : (irmao.data_iniciacao ? new Date(irmao.data_iniciacao) : null);
  const dataFalecimento = irmao.data_falecimento ? new Date(irmao.data_falecimento) : null;

  // Desligado/irregular/etc. SEM data de fim e já em vigor desde antes de todas as sessões do período → sem vínculo
  const semVinculo = historico.some(sit => {
    const tipo = semAcento(sit.tipo_situacao);
    if (!TIPOS_ENCERRAMENTO.some(t => tipo === t || tipo.includes(t))) return false;
    if (sit.data_fim) return false;
    const di = new Date(sit.data_inicio + 'T00:00:00');
    return sessoesPerio.every(s => new Date(s.data_sessao + 'T00:00:00') >= di);
  });
  if (semVinculo) return vazio;

  const sessoes = [];
  const validas = [];
  sessoesPerio.forEach(sessao => {
    const dataSessao = new Date(sessao.data_sessao);
    let grauSessao = sessao.grau_sessao_id || 1;
    if (grauSessao === 4) grauSessao = 1; // administrativa conta como Aprendiz

    if (dataInicio && dataSessao < dataInicio) return;
    if (dataFalecimento && dataSessao >= dataFalecimento) return;

    // Grau EFETIVO do irmão na data da sessão
    let grauNaSessao = 1;
    if (dataExaltacao && dataSessao >= dataExaltacao) grauNaSessao = 3;
    else if (dataElevacao && dataSessao >= dataElevacao) grauNaSessao = 2;
    if (grauSessao > grauNaSessao) return;

    // Situação em vigor na data (qualquer uma, exceto licença) → fora da conta
    const bloqueada = historico.some(sit => {
      if (semAcento(sit.tipo_situacao).includes('licen')) return false;
      return dataSessao >= new Date(sit.data_inicio + 'T00:00:00')
        && (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'));
    });
    if (bloqueada) return;

    sessoes.push(sessao);                     // elegível (exibição)
    if (mapaRegs[sessao.id]) validas.push(sessao); // com registro (conta)
  });

  const registros = {};
  sessoes.forEach(s => { if (mapaRegs[s.id]) registros[s.id] = mapaRegs[s.id]; });

  const total = validas.length;
  const presencas = validas.filter(s => registros[s.id].presente).length;
  const justificadas = validas.filter(s => !registros[s.id].presente && registros[s.id].justificativa).length;
  const ausencias = Math.max(0, total - presencas - justificadas);
  return { sessoes, registros, validas, stats: { total, presencas, justificadas, ausencias, taxa: total > 0 ? Math.round((presencas / total) * 100) : 0 } };
}
