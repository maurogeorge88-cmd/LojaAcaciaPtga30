// ========================================
// 🛠️ FUNÇÕES UTILITÁRIAS - FORMATAÇÃO
// ========================================
// Funções reutilizáveis para formatação de datas, moedas e valores
// Extraídas de FinancasLoja.jsx para melhor organização

/**
 * Corrige timezone de uma data para evitar problemas de fuso horário
 * @param {string} data - Data no formato ISO (YYYY-MM-DD)
 * @returns {string} Data corrigida no formato ISO
 */
export const corrigirTimezone = (data) => {
  if (!data) return '';
  const d = new Date(data + 'T00:00:00'); // Força horário local
  return d.toISOString().split('T')[0];
};

/**
 * Formata uma data para o padrão brasileiro (DD/MM/YYYY)
 * @param {string} data - Data no formato ISO (YYYY-MM-DD)
 * @returns {string} Data formatada em PT-BR
 */
export const formatarDataBR = (data) => {
  if (!data) return '';
  const d = new Date(data + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
};

/**
 * Formata um valor numérico para moeda brasileira (R$)
 * @param {number|string} valor - Valor a ser formatado
 * @returns {string} Valor formatado em R$
 */
export const formatarMoeda = (valor) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor || 0);
};

/**
 * Converte string de moeda brasileira para número
 * @param {string} moeda - String no formato "R$ 1.234,56"
 * @returns {number} Valor numérico
 */
export const moedaParaNumero = (moeda) => {
  if (!moeda) return 0;
  return parseFloat(
    moeda
      .replace('R$', '')
      .replace(/\./g, '') // Remove pontos de milhares
      .replace(',', '.') // Troca vírgula por ponto
      .trim()
  ) || 0;
};

/**
 * Formata uma data/hora completa para o padrão brasileiro
 * @param {string} dataHora - Data/hora no formato ISO
 * @returns {string} Data/hora formatada em PT-BR
 */
export const formatarDataHoraBR = (dataHora) => {
  if (!dataHora) return '';
  const d = new Date(dataHora);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Retorna a data atual no formato ISO (YYYY-MM-DD)
 * @returns {string} Data atual
 */
export const dataAtual = () => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Calcula a diferença em dias entre duas datas
 * @param {string} data1 - Data inicial
 * @param {string} data2 - Data final
 * @returns {number} Diferença em dias
 */
export const diferencaEmDias = (data1, data2) => {
  const d1 = new Date(data1 + 'T00:00:00');
  const d2 = new Date(data2 + 'T00:00:00');
  const diff = Math.abs(d2 - d1);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

/**
 * Verifica se uma data está vencida
 * @param {string} dataVencimento - Data de vencimento
 * @returns {boolean} True se vencida
 */
export const estaVencido = (dataVencimento) => {
  if (!dataVencimento) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(dataVencimento + 'T00:00:00');
  return vencimento < hoje;
};

/**
 * Formata um número com separador de milhares
 * @param {number} numero - Número a formatar
 * @returns {string} Número formatado
 */
export const formatarNumero = (numero) => {
  return new Intl.NumberFormat('pt-BR').format(numero || 0);
};

/**
 * Formata porcentagem
 * @param {number} valor - Valor decimal (0.15 = 15%)
 * @param {number} casasDecimais - Número de casas decimais
 * @returns {string} Porcentagem formatada
 */
export const formatarPorcentagem = (valor, casasDecimais = 2) => {
  return `${(valor * 100).toFixed(casasDecimais)}%`;
};

/**
 * Obtém o primeiro e último dia de um mês
 * @param {number} mes - Mês (1-12)
 * @param {number} ano - Ano
 * @returns {object} { primeiroDia, ultimoDia }
 */
export const obterDiasMes = (mes, ano) => {
  const primeiroDia = `${ano}-${mes.toString().padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const ultimoDiaFormatado = `${ano}-${mes.toString().padStart(2, '0')}-${ultimoDia}`;
  
  return {
    primeiroDia,
    ultimoDia: ultimoDiaFormatado
  };
};

/**
 * Valida se uma string é uma data válida
 * @param {string} data - Data para validar
 * @returns {boolean} True se válida
 */
export const validarData = (data) => {
  if (!data) return false;
  const d = new Date(data + 'T00:00:00');
  return d instanceof Date && !isNaN(d);
};
