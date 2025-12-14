// ========================================
// 🛠️ FUNÇÕES UTILITÁRIAS - CÁLCULOS FINANCEIROS
// ========================================
// Funções reutilizáveis para cálculos de valores, saldos e totais
// Extraídas de FinancasLoja.jsx para melhor organização

/**
 * Calcula o valor restante de um lançamento após pagamentos parciais
 * @param {number} valorOriginal - Valor total do lançamento
 * @param {number} valorPago - Valor já pago
 * @returns {number} Valor restante
 */
export const calcularValorRestante = (valorOriginal, valorPago) => {
  const original = parseFloat(valorOriginal) || 0;
  const pago = parseFloat(valorPago) || 0;
  return Math.max(0, original - pago);
};

/**
 * Calcula o total de um array de lançamentos
 * @param {Array} lancamentos - Array de lançamentos
 * @param {string} campo - Campo a somar (padrão: 'valor')
 * @returns {number} Total calculado
 */
export const calcularTotal = (lancamentos, campo = 'valor') => {
  if (!Array.isArray(lancamentos)) return 0;
  return lancamentos.reduce((total, lanc) => {
    return total + (parseFloat(lanc[campo]) || 0);
  }, 0);
};

/**
 * Calcula total de receitas
 * @param {Array} lancamentos - Array de lançamentos
 * @returns {number} Total de receitas
 */
export const calcularTotalReceitas = (lancamentos) => {
  if (!Array.isArray(lancamentos)) return 0;
  return lancamentos
    .filter(l => l.categorias_financeiras?.tipo === 'receita')
    .reduce((total, l) => total + (parseFloat(l.valor) || 0), 0);
};

/**
 * Calcula total de despesas
 * @param {Array} lancamentos - Array de lançamentos
 * @returns {number} Total de despesas
 */
export const calcularTotalDespesas = (lancamentos) => {
  if (!Array.isArray(lancamentos)) return 0;
  return lancamentos
    .filter(l => l.categorias_financeiras?.tipo === 'despesa')
    .reduce((total, l) => total + (parseFloat(l.valor) || 0), 0);
};

/**
 * Calcula saldo (receitas - despesas)
 * @param {Array} lancamentos - Array de lançamentos
 * @returns {number} Saldo
 */
export const calcularSaldo = (lancamentos) => {
  const receitas = calcularTotalReceitas(lancamentos);
  const despesas = calcularTotalDespesas(lancamentos);
  return receitas - despesas;
};

/**
 * Agrupa lançamentos por categoria
 * @param {Array} lancamentos - Array de lançamentos
 * @returns {Object} Objeto com categorias e totais
 */
export const agruparPorCategoria = (lancamentos) => {
  if (!Array.isArray(lancamentos)) return {};
  
  const agrupado = {};
  
  lancamentos.forEach(lanc => {
    const categoriaId = lanc.categoria_id;
    const categoriaNome = lanc.categorias_financeiras?.nome || 'Sem Categoria';
    
    if (!agrupado[categoriaId]) {
      agrupado[categoriaId] = {
        nome: categoriaNome,
        total: 0,
        quantidade: 0,
        tipo: lanc.categorias_financeiras?.tipo
      };
    }
    
    agrupado[categoriaId].total += parseFloat(lanc.valor) || 0;
    agrupado[categoriaId].quantidade += 1;
  });
  
  return agrupado;
};

/**
 * Filtra lançamentos por status
 * @param {Array} lancamentos - Array de lançamentos
 * @param {string} status - Status desejado
 * @returns {Array} Lançamentos filtrados
 */
export const filtrarPorStatus = (lancamentos, status) => {
  if (!Array.isArray(lancamentos)) return [];
  if (!status) return lancamentos;
  return lancamentos.filter(l => l.status === status);
};

/**
 * Filtra lançamentos por período
 * @param {Array} lancamentos - Array de lançamentos
 * @param {string} dataInicio - Data início
 * @param {string} dataFim - Data fim
 * @returns {Array} Lançamentos filtrados
 */
export const filtrarPorPeriodo = (lancamentos, dataInicio, dataFim) => {
  if (!Array.isArray(lancamentos)) return [];
  if (!dataInicio || !dataFim) return lancamentos;
  
  return lancamentos.filter(l => {
    const dataLanc = l.data_lancamento;
    return dataLanc >= dataInicio && dataLanc <= dataFim;
  });
};

/**
 * Calcula juros simples
 * @param {number} valor - Valor principal
 * @param {number} taxa - Taxa de juros (decimal, ex: 0.01 = 1%)
 * @param {number} periodo - Período em dias/meses
 * @returns {number} Valor dos juros
 */
export const calcularJurosSimples = (valor, taxa, periodo) => {
  return parseFloat(valor) * parseFloat(taxa) * periodo;
};

/**
 * Calcula multa por atraso
 * @param {number} valor - Valor principal
 * @param {number} percentualMulta - Percentual de multa (ex: 2 = 2%)
 * @returns {number} Valor da multa
 */
export const calcularMulta = (valor, percentualMulta) => {
  return parseFloat(valor) * (parseFloat(percentualMulta) / 100);
};

/**
 * Calcula o valor com desconto
 * @param {number} valor - Valor original
 * @param {number} percentualDesconto - Percentual de desconto (ex: 10 = 10%)
 * @returns {number} Valor com desconto aplicado
 */
export const calcularDesconto = (valor, percentualDesconto) => {
  const desconto = parseFloat(valor) * (parseFloat(percentualDesconto) / 100);
  return parseFloat(valor) - desconto;
};

/**
 * Divide um valor em parcelas
 * @param {number} valorTotal - Valor total
 * @param {number} numeroParcelas - Número de parcelas
 * @returns {Array} Array com valor de cada parcela
 */
export const dividirEmParcelas = (valorTotal, numeroParcelas) => {
  const valor = parseFloat(valorTotal);
  const parcelas = parseInt(numeroParcelas);
  
  if (!valor || !parcelas || parcelas < 1) return [];
  
  const valorParcela = Math.floor((valor / parcelas) * 100) / 100; // Arredonda para baixo
  const diferenca = valor - (valorParcela * parcelas); // Diferença de centavos
  
  const resultado = Array(parcelas).fill(valorParcela);
  
  // Adiciona a diferença de centavos na última parcela
  if (diferenca > 0) {
    resultado[resultado.length - 1] += diferenca;
  }
  
  return resultado;
};

/**
 * Calcula a média de valores
 * @param {Array} valores - Array de números
 * @returns {number} Média
 */
export const calcularMedia = (valores) => {
  if (!Array.isArray(valores) || valores.length === 0) return 0;
  const total = valores.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  return total / valores.length;
};

/**
 * Encontra o maior valor em um array de lançamentos
 * @param {Array} lancamentos - Array de lançamentos
 * @param {string} campo - Campo a comparar (padrão: 'valor')
 * @returns {number} Maior valor
 */
export const encontrarMaiorValor = (lancamentos, campo = 'valor') => {
  if (!Array.isArray(lancamentos) || lancamentos.length === 0) return 0;
  return Math.max(...lancamentos.map(l => parseFloat(l[campo]) || 0));
};

/**
 * Encontra o menor valor em um array de lançamentos
 * @param {Array} lancamentos - Array de lançamentos
 * @param {string} campo - Campo a comparar (padrão: 'valor')
 * @returns {number} Menor valor
 */
export const encontrarMenorValor = (lancamentos, campo = 'valor') => {
  if (!Array.isArray(lancamentos) || lancamentos.length === 0) return 0;
  const valores = lancamentos.map(l => parseFloat(l[campo]) || 0).filter(v => v > 0);
  return valores.length > 0 ? Math.min(...valores) : 0;
};

/**
 * Calcula porcentagem de um valor em relação ao total
 * @param {number} valor - Valor parcial
 * @param {number} total - Valor total
 * @returns {number} Porcentagem (0-100)
 */
export const calcularPorcentagem = (valor, total) => {
  if (!total || total === 0) return 0;
  return (parseFloat(valor) / parseFloat(total)) * 100;
};
