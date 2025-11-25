/**
 * CONSTANTES DO SISTEMA
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

// Graus Maçônicos
export const GRAUS_MACONICOS = [
  { value: 'Aprendiz', label: 'Aprendiz' },
  { value: 'Companheiro', label: 'Companheiro' },
  { value: 'Mestre', label: 'Mestre' }
];

// Status de Irmãos
export const STATUS_IRMAOS = {
  ATIVO: 'ativo',
  INATIVO: 'inativo',
  AFASTADO: 'afastado',
  FALECIDO: 'falecido'
};

// Cargos na Loja (ordem hierárquica)
export const CARGOS_LOJA = [
  'Venerável Mestre',
  '1º Vigilante',
  '2º Vigilante',
  'Orador',
  'Secretário',
  'Tesoureiro',
  'Chanceler',
  'Mestre de Cerimônias',
  '1º Diácono',
  '2º Diácono',
  'Hospitaleiro',
  'Mestre de Banquetes',
  'Guarda do Templo',
  'Porta-Estandarte',
  'Porta-Espada'
];

// Tipos de Sessão
export const TIPOS_SESSAO = [
  'Ordinária',
  'Extraordinária',
  'Magna',
  'Fúnebre',
  'Branca',
  'Iniciação',
  'Elevação',
  'Exaltação'
];

// Status de Comissões
export const STATUS_COMISSAO = {
  EM_ANDAMENTO: 'em_andamento',
  ENCERRADA: 'encerrada'
};

// Origem de Comissões
export const ORIGEM_COMISSAO = {
  INTERNA: 'interna',
  EXTERNA: 'externa'
};

// Funções em Comissões
export const FUNCOES_COMISSAO = [
  'Coordenador',
  'Vice-Coordenador',
  'Secretário',
  'Tesoureiro',
  'Membro'
];

// Categorias de Livros
export const CATEGORIAS_LIVROS = [
  'Ritualística',
  'Filosofia',
  'História',
  'Simbolismo',
  'Legislação',
  'Geral'
];

// Status de Empréstimos
export const STATUS_EMPRESTIMO = {
  EMPRESTADO: 'emprestado',
  DEVOLVIDO: 'devolvido',
  ATRASADO: 'atrasado'
};

// Níveis de Permissão
export const NIVEIS_PERMISSAO = {
  ADMIN: 'Administrador',
  SECRETARIO: 'Secretário',
  TESOUREIRO: 'Tesoureiro',
  IRMAO: 'Irmão'
};

// Tipos de Prancha
export const TIPOS_PRANCHA = {
  TRACADA: 'Prancha Tracada',
  ARQUITETURA: 'Prancha de Arquitetura',
  BALAUSTRE: 'Balaustre'
};

// Parentesco Familiar
export const TIPOS_PARENTESCO = [
  'Cônjuge',
  'Filho(a)',
  'Neto(a)',
  'Enteado(a)',
  'Pai',
  'Mãe',
  'Irmão(ã)',
  'Outro'
];

// Estados Civis
export const ESTADOS_CIVIS = [
  'Solteiro',
  'Casado',
  'Divorciado',
  'Viúvo',
  'União Estável'
];

// Escolaridade
export const NIVEIS_ESCOLARIDADE = [
  'Fundamental Incompleto',
  'Fundamental Completo',
  'Médio Incompleto',
  'Médio Completo',
  'Superior Incompleto',
  'Superior Completo',
  'Pós-Graduação',
  'Mestrado',
  'Doutorado'
];

// Prazo padrão de empréstimo (dias)
export const PRAZO_EMPRESTIMO_PADRAO = 15;

// Número máximo de empréstimos por irmão
export const MAX_EMPRESTIMOS_POR_IRMAO = 3;

// Cores do tema
export const CORES = {
  PRIMARY: '#1e40af', // blue-800
  SECONDARY: '#3b82f6', // blue-500
  SUCCESS: '#10b981', // green-500
  DANGER: '#ef4444', // red-500
  WARNING: '#f59e0b', // amber-500
  INFO: '#06b6d4', // cyan-500
  DARK: '#1e293b', // slate-800
  LIGHT: '#f1f5f9' // slate-100
};

// Mensagens do sistema
export const MENSAGENS = {
  ERRO_GENERICO: 'Ocorreu um erro inesperado. Tente novamente.',
  SUCESSO_CADASTRO: 'Cadastro realizado com sucesso!',
  SUCESSO_EDICAO: 'Atualização realizada com sucesso!',
  SUCESSO_EXCLUSAO: 'Exclusão realizada com sucesso!',
  CONFIRMAR_EXCLUSAO: 'Tem certeza que deseja excluir este registro?',
  CAMPOS_OBRIGATORIOS: 'Preencha todos os campos obrigatórios!',
  SESSAO_EXPIRADA: 'Sua sessão expirou. Faça login novamente.'
};

// Validações
export const VALIDACOES = {
  MIN_SENHA: 6,
  MAX_NOME: 100,
  MAX_DESCRICAO: 500,
  MAX_OBSERVACAO: 1000
};

// Paginação
export const ITENS_POR_PAGINA = 50;

// Duração de mensagens (milissegundos)
export const DURACAO_MENSAGEM = 3000;
export const DURACAO_MENSAGEM_ERRO = 5000;
