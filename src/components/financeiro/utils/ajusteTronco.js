// ════════════════════════════════════════════════════════════════════════
// "Ajuste Interno Tronco" — subcategoria de "Tronco Saida"
// Abate o valor disponível do Tronco (conta bancária) sem alterar o financeiro da
// Loja: o valor já foi computado na Loja, o lançamento é só informativo para o Tronco.
//   • Tronco: entra normalmente (é filha de "Tronco Saida" → reduz o banco do Tronco)
//   • Loja:   fica FORA do saldo bancário, das estatísticas e das análises por categoria
// ════════════════════════════════════════════════════════════════════════
export const NOME_AJUSTE_INTERNO_TRONCO = 'Ajuste Interno Tronco';

const normalizar = (s) => String(s || '').trim().toLowerCase();

// Aceita o lançamento com categorias_financeiras { nome } (ou cat_nome já normalizado pelo relatório)
export const ehAjusteInternoTronco = (l) =>
  normalizar(l?.categorias_financeiras?.nome ?? l?.cat_nome) === normalizar(NOME_AJUSTE_INTERNO_TRONCO);
