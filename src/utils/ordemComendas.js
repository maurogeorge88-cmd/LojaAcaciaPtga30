// Ordem oficial das comendas (por trecho do nome, sem acento/maiúsculas).
// Índices 0 a 6 = comendas que dão a medalha no quadro de Visualizar Irmãos.
const ORDEM_COMENDAS = [
  ['ersio'],              // 1 - Érsio
  ['osmar'],              // 2 - Osmar
  ['edroim'],             // 3 - Edroim
  ['othel', 'otel'],      // 4 - Othelo
  ['sebastiao'],          // 5 - Sebastião
  ['hanz', 'hans'],       // 6 - Antonio Hanz
  ['roldao'],             // 7 - Roldão
  ['100'],                // 8 - Maçom 100%
];

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Posição da comenda na ordem; as não listadas (ex.: comendas da Loja) vão para o fim
export const indiceComenda = (nome) => {
  const n = norm(nome);
  const i = ORDEM_COMENDAS.findIndex(chaves => chaves.some(k => n.includes(k)));
  return i === -1 ? ORDEM_COMENDAS.length : i;
};

export const ordenarComendas = (a, b) =>
  indiceComenda(a?.nome) - indiceComenda(b?.nome) || String(a?.nome || '').localeCompare(String(b?.nome || ''));

// Comendas 1 a 7 (Érsio … Roldão)
export const comendaDaMedalha = (nome) => indiceComenda(nome) <= 6;
