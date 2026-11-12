// Regras compartilhadas pelos quadros do Dashboard de Presença.
//
// 1) Falecido: sai de TODOS os quadros.
// 2) Desligado (Quite Placet) / Irregular / Suspenso / Excluído / Ex-ofício SEM data de retorno:
//    se TODAS as sessões do período já são posteriores ao início da situação, o irmão não tem
//    mais vínculo relevante no período e sai do quadro (ex.: irregular desde 2005). Se a situação
//    começou DENTRO do período (ainda houve sessões antes dela), ele continua aparecendo.
//    É a mesma regra que o resumo geral do Dashboard (carregar) e a Matrix já usavam.

const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const SITUACOES_QUE_ENCERRAM = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio'];

export const estaFalecido = (irmao) =>
  !!(irmao?.data_falecimento || irmao?.status === 'falecido' || normalizar(irmao?.situacao) === 'falecido');

export const semVinculoNoPeriodo = (irmaoId, historicoSituacoes, sessoesPeriodo) => {
  if (!sessoesPeriodo || sessoesPeriodo.length === 0) return false; // sem sessões, não há como avaliar
  return !!historicoSituacoes?.some((sit) => {
    if (sit.membro_id !== irmaoId) return false;
    const tipo = normalizar(sit.tipo_situacao);
    const ehEncerramento = SITUACOES_QUE_ENCERRAM.includes(tipo) || SITUACOES_QUE_ENCERRAM.some((s) => tipo.includes(s));
    if (!ehEncerramento) return false;
    if (sit.data_fim) return false; // já foi regularizado: entra na conta

    const dataInicioSit = new Date(sit.data_inicio + 'T00:00:00');
    return sessoesPeriodo.every((s) => new Date(s.data_sessao + 'T00:00:00') >= dataInicioSit);
  });
};
