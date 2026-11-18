// ═════════════════════════════════════════════════════════════════════════
// PERMISSÕES POR TELA DO ARCO REAL
//
// usuarios.permissoes_arco_real (jsonb) = { tela: 'ver' | 'editar' }  (ausente = nenhum)
//
// • Coluna NULL  = "herdando": vale a regra de sempre (derivada das permissões
//   atuais do usuário), então nada muda para quem nunca foi personalizado.
// • Coluna preenchida = grade personalizada: vale só para o Arco Real. As
//   permissões da Loja (usuarios.permissoes / pode_*) NÃO são lidas nem
//   alteradas por este arquivo.
// • Admin / Venerável: sempre acesso total.
// ═════════════════════════════════════════════════════════════════════════
import { ehAdminTotal } from './permissoes';

const ORDEM = { nenhum: 0, ver: 1, editar: 2 };

export const TELAS_ARCO_REAL = [
  { id: 'dashboard',       label: 'Dashboard',                 icone: '📊', grupo: 'Geral',      niveis: ['nenhum', 'ver'] },
  { id: 'membros',         label: 'Membros e perfis',          icone: '🔎', grupo: 'Membros',    niveis: ['nenhum', 'ver', 'editar'], ajuda: 'Nenhum esconde também "Meus Dados". Editar = cadastrar/alterar membros.' },
  { id: 'quadro',          label: 'Quadro de Membros',         icone: '📋', grupo: 'Membros',    niveis: ['nenhum', 'ver'] },
  { id: 'licencas',        label: 'Licenças e Situações',      icone: '🗓️', grupo: 'Membros',    niveis: ['nenhum', 'ver', 'editar'] },
  { id: 'presenca',        label: 'Presença Irmãos',           icone: '✅', grupo: 'Presença',   niveis: ['nenhum', 'ver', 'editar'], ajuda: 'Ver = dashboard, sessões e matrix. Editar = cadastrar sessão e registrar presença.' },
  { id: 'financeiro',      label: 'Finanças',                  icone: '💰', grupo: 'Financeiro', niveis: ['nenhum', 'ver', 'editar'], ajuda: 'Ver = consulta e relatórios, sem lançar/editar/excluir.' },
  { id: 'inadimplentes',   label: 'Inadimplentes',             icone: '⚠️', grupo: 'Financeiro', niveis: ['nenhum', 'editar'], ajuda: 'Acessar a tela e as ações de cobrança.' },
  { id: 'email',           label: 'E-mails',                   icone: '✉️', grupo: 'Financeiro', niveis: ['nenhum', 'editar'], ajuda: 'Enviar e-mails financeiros e lembretes de eventos.' },
  { id: 'estatisticas',    label: 'Estatísticas',              icone: '📈', grupo: 'Geral',      niveis: ['nenhum', 'ver'] },
  { id: 'cronograma',      label: 'Cronograma',                icone: '📅', grupo: 'Geral',      niveis: ['nenhum', 'ver', 'editar'] },
  { id: 'corpo_admin',     label: 'Corpo Administrativo',      icone: '🏛️', grupo: 'Geral',      niveis: ['nenhum', 'ver', 'editar'] },
  { id: 'dados_arco',      label: 'Dados do Arco Real',        icone: '🔺', grupo: 'Geral',      niveis: ['nenhum', 'ver', 'editar'] },
  { id: 'controle_acesso', label: 'Controle de Acesso',        icone: '🔐', grupo: 'Sistema',    niveis: ['nenhum', 'editar'] },
];

// Página do menu do Arco Real -> tela do catálogo
export const TELA_DA_PAGINA = {
  'dashboard': 'dashboard',
  'visualizar-membros': 'membros',
  'quadro-membros': 'quadro',
  'licencas': 'licencas',
  'dashboard-presenca': 'presenca',
  'cadastro-sessao': 'presenca',
  'lista-sessoes': 'presenca',
  'financeiro': 'financeiro',
  'inadimplentes': 'inadimplentes',
  'email-financeiro': 'email',
  'estatisticas': 'estatisticas',
  'cronograma': 'cronograma',
  'corpo-admin': 'corpo_admin',
  'dados-arco-real': 'dados_arco',
  'controle-acesso': 'controle_acesso',
};

const TELA = Object.fromEntries(TELAS_ARCO_REAL.map(t => [t.id, t]));

export const nivelMax = (id) => { const n = TELA[id]?.niveis || ['nenhum']; return n[n.length - 1]; };

// Mantém só telas conhecidas e níveis válidos para a tela
export const limparMapaArcoReal = (mapa) => {
  const out = {};
  if (!mapa || typeof mapa !== 'object') return out;
  Object.entries(mapa).forEach(([id, nivel]) => {
    const t = TELA[id];
    if (!t || nivel === 'nenhum') return;
    if (t.niveis.includes(nivel)) out[id] = nivel;
    else if (nivel === 'editar' && t.niveis.includes('ver')) out[id] = 'ver';
  });
  return out;
};

// O que o usuário tem HOJE no Arco Real, derivado das permissões atuais
// (mesmas regras que o ArcoRealApp sempre usou). `p` = objeto "legado":
// canEditMembers, canEdit, canViewFinancial, pode_editar_presenca, canManageUsers.
export const derivarAcessoArcoReal = (p = {}) => {
  const edM = !!p.canEditMembers;
  const fin = !!p.canViewFinancial;
  return {
    dashboard: 'ver',
    membros: edM ? 'editar' : 'ver',
    quadro: 'ver',
    licencas: edM ? 'editar' : 'ver',
    presenca: (p.pode_editar_presenca || edM) ? 'editar' : 'nenhum',
    ...(fin ? { financeiro: 'editar', inadimplentes: 'editar' } : {}),
    ...((fin || edM) ? { email: 'editar' } : {}),
    estatisticas: 'ver',
    cronograma: (edM || p.canEdit) ? 'editar' : 'ver',
    corpo_admin: edM ? 'editar' : 'ver',
    dados_arco: edM ? 'editar' : 'ver',
    ...(p.canManageUsers ? { controle_acesso: 'editar' } : {}),
  };
};

// Acesso efetivo do usuário logado no Arco Real
// -> { mapa, personalizado, total }
export const acessoArcoReal = (usuario, permissoesLegado) => {
  if (ehAdminTotal(usuario)) {
    return { mapa: Object.fromEntries(TELAS_ARCO_REAL.map(t => [t.id, nivelMax(t.id)])), personalizado: false, total: true };
  }
  const g = usuario?.permissoes_arco_real;
  if (g && typeof g === 'object' && !Array.isArray(g)) {
    return { mapa: limparMapaArcoReal(g), personalizado: true, total: false };
  }
  return { mapa: derivarAcessoArcoReal(permissoesLegado), personalizado: false, total: false };
};

export const nivelNaTela = (mapa, id) => mapa?.[id] || 'nenhum';
export const podeNivel = (mapa, id, minimo = 'ver') => ORDEM[nivelNaTela(mapa, id)] >= ORDEM[minimo];

// Modelos prontos para preencher a grade
export const MODELOS_ARCO_REAL = {
  simples: { label: '👤 Acesso simples', mapa: { dashboard: 'ver', membros: 'ver', quadro: 'ver', licencas: 'ver', estatisticas: 'ver', cronograma: 'ver', corpo_admin: 'ver', dados_arco: 'ver' } },
  consulta: { label: '👁️ Somente consulta', mapa: { dashboard: 'ver', membros: 'ver', quadro: 'ver', licencas: 'ver', presenca: 'ver', financeiro: 'ver', estatisticas: 'ver', cronograma: 'ver', corpo_admin: 'ver', dados_arco: 'ver' } },
  gestao: { label: '🔺 Gestão completa', mapa: { dashboard: 'ver', membros: 'editar', quadro: 'ver', licencas: 'editar', presenca: 'editar', financeiro: 'editar', inadimplentes: 'editar', email: 'editar', estatisticas: 'ver', cronograma: 'editar', corpo_admin: 'editar', dados_arco: 'editar' } },
};
