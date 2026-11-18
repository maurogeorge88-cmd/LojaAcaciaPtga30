// Tipos de evento do Cronograma do Arco Real — fonte única de rótulo e cor (lista e calendário usam a mesma paleta).
export const TIPOS_EVENTO = [
  { value: 'sessao',            label: '📜 Sessão',               cor: '#3b82f6' },
  { value: 'trabalho_irmao',    label: '📖 Trabalho de Irmão',    cor: '#8b5cf6' },
  { value: 'instrucao',         label: '🎓 Instrução',            cor: '#10b981' },
  { value: 'treinamento',       label: '🏋️ Treinamento',          cor: '#ec4899' },
  { value: 'sessao_magna',      label: '👑 Sessão Magna',         cor: '#ef4444' },
  { value: 'sessao_posse',      label: '📜 Sessão de Posse',      cor: '#14b8a6' },
  { value: 'sessao_instalacao', label: '👑 Sessão de Instalação', cor: '#6366f1' },
  { value: 'sessao_festiva',    label: '🥂 Sessão Festiva',       cor: '#c9a84c' },
  { value: 'feriado',           label: '🎌 Feriado',              cor: '#f97316' },
  { value: 'evento_externo',    label: '🌍 Evento Externo',       cor: '#06b6d4' },
  { value: 'outro',             label: '📌 Outro',                cor: '#6b7280' },
];

// Cores padrão que cada tipo tinha antes (Sessão e Instalação eram iguais; Posse e Instrução também).
const COR_PADRAO_ANTIGA = {
  sessao: '#3b82f6', trabalho_irmao: '#8b5cf6', instrucao: '#10b981', treinamento: '#ec4899', sessao_magna: '#ef4444',
  sessao_posse: '#10b981', sessao_instalacao: '#3b82f6', sessao_festiva: '#c9a84c',
  feriado: '#f97316', evento_externo: '#f59e0b', outro: '#6b7280',
};

export const corDoTipo = (tipo) => TIPOS_EVENTO.find(t => t.value === tipo)?.cor || '#6b7280';
export const rotuloDoTipo = (tipo) => TIPOS_EVENTO.find(t => t.value === tipo)?.label || tipo;

// Cor de exibição do evento: quem ainda está com a cor padrão (antiga) do tipo passa a usar a cor nova do tipo;
// cor personalizada no cadastro do evento é respeitada.
export const corDoEvento = (tipo, corDestaque) => {
  const c = String(corDestaque || '').toLowerCase();
  if (!c || c === String(COR_PADRAO_ANTIGA[tipo] || '').toLowerCase() || c === corDoTipo(tipo).toLowerCase()) return corDoTipo(tipo);
  return corDestaque;
};

// O Arco Real não usa grau no cronograma (mantido vazio por compatibilidade com o calendário).
export const NOME_GRAU_CRONOGRAMA = {};

// Rótulo sem emoji (para listas e e-mails)
export const tipoRotulo = (tipo) => rotuloDoTipo(tipo).replace(/^[^\p{L}]+/u, '');
