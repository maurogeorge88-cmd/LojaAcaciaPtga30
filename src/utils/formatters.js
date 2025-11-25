// Formatar CPF: 123.456.789-01
export const formatarCPF = (cpf) => {
  if (!cpf) return '';
  const numeros = cpf.replace(/\D/g, '');
  return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

// Limpar CPF (remover formatação)
export const limparCPF = (cpf) => {
  if (!cpf) return '';
  return cpf.replace(/\D/g, '');
};

// Formatar Telefone: (65) 99999-9999
export const formatarTelefone = (telefone) => {
  if (!telefone) return '';
  const numeros = telefone.replace(/\D/g, '');
  
  if (numeros.length <= 10) {
    return numeros.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return numeros.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
};

// Limpar telefone (remover formatação)
export const limparTelefone = (telefone) => {
  if (!telefone) return '';
  return telefone.replace(/\D/g, '');
};

// Validar Email
export const validarEmail = (email) => {
  if (!email) return true;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

// Calcular Idade
export const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return '';
  
  const nascimento = new Date(dataNascimento + 'T00:00:00');
  const hoje = new Date();
  
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  
  return idade + ' anos';
};

// Formatar Data: DD/MM/YYYY
export const formatarData = (data) => {
  if (!data) return '';
  
  const date = new Date(data + 'T00:00:00');
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const ano = date.getFullYear();
  
  return dia + '/' + mes + '/' + ano;
};

// Formatar Moeda: R$ 1.234,56
export const formatarMoeda = (valor) => {
  if (valor === null || valor === undefined) return 'R$ 0,00';
  
  const numero = typeof valor === 'string' ? parseFloat(valor) : valor;
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numero);
};
