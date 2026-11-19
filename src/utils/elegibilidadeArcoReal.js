// Elegibilidade de presença do Arco Real POR DATA DA SESSÃO (mesma lógica da Loja):
//  - só aparece a partir da data de exaltação (sem data = considera todo o período);
//  - desligado / excluído / irregular / suspenso bloqueiam enquanto o período cobrir a data;
//  - falecido aparece até o dia do falecimento;
//  - licença não bloqueia: aparece, mas não conta ("–");
//  - prerrogativa de idade (70 anos): aparece, mas não conta (informativo).
// Datas sempre 'YYYY-MM-DD' (comparação textual, sem fuso).

export const TIPOS_BLOQUEIO = ['desligado', 'excluido', 'irregular', 'suspenso'];
const IDADE_PRERROGATIVA = 70;

const cobre = (p, d) => p.data_inicio <= d && (!p.data_fim || d <= p.data_fim);

// Data (YYYY-MM-DD) em que o membro completa 70 anos
export const dataPrerrogativa = (nasc) => {
  if (!nasc) return null;
  const [a, m, d] = String(nasc).substring(0, 10).split('-');
  if (!a || !m || !d) return null;
  return `${Number(a) + IDADE_PRERROGATIVA}-${m}-${d}`;
};

// Situação do membro numa data. periodos = linhas de arco_real_situacoes (sem canceladas).
export const situacaoNaData = (membro, periodos, dataISO) => {
  if (!membro || !dataISO) return { elegivel: false, conta: false, motivo: 'fora' };
  if (membro.data_exaltacao && dataISO < String(membro.data_exaltacao).substring(0, 10)) {
    return { elegivel: false, conta: false, motivo: 'exaltacao' };
  }
  const meus = (periodos || []).filter(p => p.membro_id === membro.id);

  // Falecido: aparece até o dia do falecimento
  const fal = meus.find(p => p.tipo_situacao === 'falecido');
  if (fal ? dataISO > fal.data_inicio : membro.situacao === 'falecido' && !meus.length) {
    return { elegivel: false, conta: false, motivo: 'falecido' };
  }

  // Bloqueios por período
  if (meus.some(p => TIPOS_BLOQUEIO.includes(p.tipo_situacao) && cobre(p, dataISO))) {
    return { elegivel: false, conta: false, motivo: 'bloqueio' };
  }
  // Cadastro já em situação bloqueadora, mas sem período lançado (dado antigo) → bloqueia sempre
  if (TIPOS_BLOQUEIO.includes(membro.situacao) && !meus.some(p => p.tipo_situacao === membro.situacao)) {
    return { elegivel: false, conta: false, motivo: 'bloqueio' };
  }

  // Licença: aparece, não conta
  const licenca = meus.some(p => p.tipo_situacao === 'licenciado' && cobre(p, dataISO))
    || (membro.situacao === 'licenciado' && !meus.some(p => p.tipo_situacao === 'licenciado'));
  if (licenca) return { elegivel: true, conta: false, motivo: 'licenca', licenca: true };

  // Prerrogativa de idade
  const dp = dataPrerrogativa(membro.data_nascimento);
  if (dp && dataISO >= dp) return { elegivel: true, conta: false, motivo: 'prerrogativa', prerrogativa: true };

  return { elegivel: true, conta: true, motivo: null };
};

// Membros que devem aparecer na sessão, já com a situação NA DATA (licenciado/regular)
export const membrosDaSessao = (membros, periodos, dataISO) =>
  (membros || [])
    .filter(m => m.ativo !== false)
    .map(m => ({ m, s: situacaoNaData(m, periodos, dataISO) }))
    .filter(x => x.s.elegivel)
    .map(({ m, s }) => ({ ...m, situacao: s.licenca ? 'licenciado' : 'regular', prerrogativa: !!s.prerrogativa }));
