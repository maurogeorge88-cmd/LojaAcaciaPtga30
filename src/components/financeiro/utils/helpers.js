// 🛠️ FUNÇÕES AUXILIARES - FINANÇAS LOJA
// Funções utilitárias para eliminar duplicação de código

/**
 * Verifica se um lançamento está vencido
 * @param {Object} lancamento - Objeto do lançamento
 * @returns {boolean} - true se estiver vencido
 */
export const verificarVencido = (lancamento) => {
  if (lancamento.status !== 'pendente') return false;
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const dataVenc = new Date(lancamento.data_vencimento);
  dataVenc.setHours(0, 0, 0, 0);
  
  return dataVenc < hoje;
};

/**
 * Filtra irmãos baseado nos status permitidos e bloqueados
 * @param {Array} todosIrmaos - Array com todos os irmãos
 * @param {Array} statusPermitidos - Status permitidos
 * @param {Array} statusBloqueados - Status bloqueados
 * @returns {Array} - Irmãos filtrados
 */
export const filtrarIrmaosPorStatus = (todosIrmaos, statusPermitidos, statusBloqueados) => {
  return todosIrmaos.filter(irmao => {
    const status = (irmao.situacao || '').trim();
    
    const estaPermitido = statusPermitidos.some(sp => 
      sp.toLowerCase() === status.toLowerCase()
    );
    
    const estaBloqueado = statusBloqueados.some(sb => 
      sb.toLowerCase() === status.toLowerCase()
    );
    
    return estaPermitido && !estaBloqueado;
  });
};

/**
 * Calcula totais financeiros de lançamentos
 * @param {Array} lancamentos - Array de lançamentos
 * @returns {Object} - Objeto com totais calculados
 */
export const calcularTotaisFinanceiros = (lancamentos) => {
  return lancamentos.reduce((acc, lanc) => {
    const valor = parseFloat(lanc.valor) || 0;
    
    if (lanc.tipo === 'receita') {
      if (lanc.status === 'pago') {
        acc.receitasPagas += valor;
      } else if (lanc.status === 'pendente' || verificarVencido(lanc)) {
        acc.receitasPendentes += valor;
      }
    } else if (lanc.tipo === 'despesa') {
      if (lanc.status === 'pago') {
        acc.despesasPagas += valor;
      } else if (lanc.status === 'pendente' || verificarVencido(lanc)) {
        acc.despesasPendentes += valor;
      }
    }
    
    return acc;
  }, {
    receitasPagas: 0,
    despesasPagas: 0,
    receitasPendentes: 0,
    despesasPendentes: 0,
    saldo: 0
  });
};

/**
 * Calcula o saldo atual (receitas pagas - despesas pagas)
 * @param {Array} lancamentos - Array de lançamentos
 * @returns {number} - Saldo calculado
 */
export const calcularSaldo = (lancamentos) => {
  const totais = calcularTotaisFinanceiros(lancamentos);
  return totais.receitasPagas - totais.despesasPagas;
};

/**
 * Obtém o badge de status com cor e ícone
 * @param {Object} lancamento - Objeto do lançamento
 * @returns {Object} - { cor, texto, icone }
 */
export const obterBadgeStatus = (lancamento) => {
  if (lancamento.status === 'pago') {
    return {
      cor: 'bg-green-100 text-green-800 border-green-300',
      texto: 'Pago',
      icone: '✓'
    };
  }
  
  if (lancamento.status === 'cancelado') {
    return {
      cor: 'bg-gray-100 text-gray-800 border-gray-300',
      texto: 'Cancelado',
      icone: '✗'
    };
  }
  
  if (verificarVencido(lancamento)) {
    return {
      cor: 'bg-red-100 text-red-800 border-red-300',
      texto: 'Vencido',
      icone: '⚠️'
    };
  }
  
  return {
    cor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    texto: 'Pendente',
    icone: '⏳'
  };
};

/**
 * Valida formulário de lançamento
 * @param {Object} form - Dados do formulário
 * @returns {string|null} - Mensagem de erro ou null se válido
 */
export const validarFormLancamento = (form) => {
  if (!form.tipo) {
    return 'Tipo é obrigatório';
  }
  
  if (!form.categoria_id) {
    return 'Categoria é obrigatória';
  }
  
  if (!form.descricao || form.descricao.trim() === '') {
    return 'Descrição é obrigatória';
  }
  
  if (!form.valor || parseFloat(form.valor) <= 0) {
    return 'Valor deve ser maior que zero';
  }
  
  if (!form.data_lancamento) {
    return 'Data de lançamento é obrigatória';
  }
  
  if (!form.data_vencimento) {
    return 'Data de vencimento é obrigatória';
  }
  
  if (form.status === 'pago' && !form.data_pagamento) {
    return 'Data de pagamento é obrigatória para status "Pago"';
  }
  
  if (!form.origem_tipo) {
    return 'Origem é obrigatória';
  }
  
  if (form.origem_tipo === 'Irmao' && !form.origem_irmao_id) {
    return 'Selecione um irmão para lançamentos de origem "Irmão"';
  }
  
  return null; // Válido
};

/**
 * Calcula dias entre duas datas
 * @param {Date|string} data1 - Data inicial
 * @param {Date|string} data2 - Data final
 * @returns {number} - Número de dias
 */
export const calcularDiasEntre = (data1, data2) => {
  const d1 = new Date(data1);
  const d2 = new Date(data2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

/**
 * Calcula dias de atraso de um lançamento
 * @param {Object} lancamento - Objeto do lançamento
 * @returns {number} - Dias de atraso (0 se não estiver atrasado)
 */
export const calcularDiasAtraso = (lancamento) => {
  if (!verificarVencido(lancamento)) return 0;
  
  const hoje = new Date();
  const vencimento = new Date(lancamento.data_vencimento);
  
  return calcularDiasEntre(vencimento, hoje);
};

/**
 * Agrupa lançamentos por mês/ano
 * @param {Array} lancamentos - Array de lançamentos
 * @returns {Object} - Lançamentos agrupados por período
 */
export const agruparPorPeriodo = (lancamentos) => {
  return lancamentos.reduce((acc, lanc) => {
    // Usar data_pagamento se pago, senão data_vencimento
    const data = lanc.status === 'pago' && lanc.data_pagamento 
      ? new Date(lanc.data_pagamento)
      : new Date(lanc.data_vencimento);
    
    const mes = data.getMonth() + 1;
    const ano = data.getFullYear();
    const periodo = `${mes.toString().padStart(2, '0')}/${ano}`;
    
    if (!acc[periodo]) {
      acc[periodo] = [];
    }
    
    acc[periodo].push(lanc);
    return acc;
  }, {});
};

/**
 * Filtra lançamentos por período (mês/ano)
 * @param {Array} lancamentos - Array de lançamentos
 * @param {number} mes - Mês (1-12, 0 para todos)
 * @param {number} ano - Ano (0 para todos)
 * @returns {Array} - Lançamentos filtrados
 */
export const filtrarPorPeriodo = (lancamentos, mes, ano) => {
  return lancamentos.filter(lanc => {
    // Usar data_pagamento se pago, senão data_vencimento
    const data = lanc.status === 'pago' && lanc.data_pagamento 
      ? new Date(lanc.data_pagamento)
      : new Date(lanc.data_vencimento);
    
    const lancMes = data.getMonth() + 1;
    const lancAno = data.getFullYear();
    
    // Se ambos forem 0, retorna todos
    if (mes === 0 && ano === 0) return true;
    
    // Se só ano for 0, filtra só por mês
    if (ano === 0) return lancMes === mes;
    
    // Se só mês for 0, filtra só por ano
    if (mes === 0) return lancAno === ano;
    
    // Filtra por ambos
    return lancMes === mes && lancAno === ano;
  });
};

/**
 * Ordena lançamentos por data (mais recente primeiro)
 * @param {Array} lancamentos - Array de lançamentos
 * @returns {Array} - Lançamentos ordenados
 */
export const ordenarPorData = (lancamentos) => {
  return [...lancamentos].sort((a, b) => {
    const dataA = a.status === 'pago' && a.data_pagamento 
      ? new Date(a.data_pagamento)
      : new Date(a.data_vencimento);
    
    const dataB = b.status === 'pago' && b.data_pagamento 
      ? new Date(b.data_pagamento)
      : new Date(b.data_vencimento);
    
    return dataB - dataA; // Mais recente primeiro
  });
};
