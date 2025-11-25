/**
 * FORMATADORES E FUNÇÕES UTILITÁRIAS
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

/**
 * Formata data para padrão brasileiro (DD/MM/YYYY)
 */
export const formatarData = (dataISO) => {
  if (!dataISO) return '-';
  const [ano, mes, dia] = dataISO.split('T')[0].split('-');
  return `${dia}/${mes}/${ano}`;
};

/**
 * Formata data e hora para padrão brasileiro
 */
export const formatarDataHora = (dataISO) => {
  if (!dataISO) return '-';
  const data = new Date(dataISO);
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  const hora = String(data.getHours()).padStart(2, '0');
  const min = String(data.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} às ${hora}:${min}`;
};

/**
 * Formata telefone para padrão brasileiro
 */
export const formatarTelefone = (telefone) => {
  if (!telefone) return '-';
  const numeros = telefone.replace(/\D/g, '');
  if (numeros.length === 11) {
    return `(${numeros.substring(0, 2)}) ${numeros.substring(2, 7)}-${numeros.substring(7)}`;
  }
  if (numeros.length === 10) {
    return `(${numeros.substring(0, 2)}) ${numeros.substring(2, 6)}-${numeros.substring(6)}`;
  }
  return telefone;
};

/**
 * Formata CPF
 */
export const formatarCPF = (cpf) => {
  if (!cpf) return '-';
  const numeros = cpf.replace(/\D/g, '');
  if (numeros.length === 11) {
    return `${numeros.substring(0, 3)}.${numeros.substring(3, 6)}.${numeros.substring(6, 9)}-${numeros.substring(9)}`;
  }
  return cpf;
};

/**
 * Calcula idade a partir da data de nascimento
 */
export const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mesAtual = hoje.getMonth();
  const mesNascimento = nascimento.getMonth();
  
  if (mesAtual < mesNascimento || (mesAtual === mesNascimento && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  
  return idade;
};

/**
 * Valida email
 */
export const validarEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

/**
 * Trunca texto com reticências
 */
export const truncarTexto = (texto, tamanho = 50) => {
  if (!texto) return '-';
  if (texto.length <= tamanho) return texto;
  return texto.substring(0, tamanho) + '...';
};

/**
 * Formata moeda para padrão brasileiro
 */
export const formatarMoeda = (valor) => {
  if (valor === null || valor === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
};

/**
 * Remove formatação de CPF
 */
export const limparCPF = (cpf) => {
  return cpf.replace(/\D/g, '');
};

/**
 * Remove formatação de telefone
 */
export const limparTelefone = (telefone) => {
  return telefone.replace(/\D/g, '');
};

/**
 * Capitaliza primeira letra
 */
export const capitalize = (texto) => {
  if (!texto) return '';
  return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
};

/**
 * Capitaliza todas as palavras
 */
export const capitalizeWords = (texto) => {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .split(' ')
    .map(palavra => capitalize(palavra))
    .join(' ');
};

/**
 * Obter data atual no formato ISO (YYYY-MM-DD)
 */
export const obterDataAtual = () => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Adicionar dias a uma data
 */
export const adicionarDias = (dataISO, dias) => {
  const data = new Date(dataISO + 'T00:00:00');
  data.setDate(data.getDate() + dias);
  return data.toISOString().split('T')[0];
};

/**
 * Verificar se data está atrasada
 */
export const estaAtrasado = (dataISO) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(dataISO + 'T00:00:00');
  return data < hoje;
};

/**
 * Calcular dias de atraso
 */
export const calcularDiasAtraso = (dataISO) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(dataISO + 'T00:00:00');
  if (data >= hoje) return 0;
  const diff = hoje - data;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};
