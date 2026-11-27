// Normalização e hierarquia dos cargos administrativos (compartilhado por CorpoAdmin e PainelCorpoAdmin)
export const normalizarCargo = (cargo) => {
  if (!cargo) return '';
  const c = cargo.toLowerCase().trim();
  // Cargos principais: casam por PALAVRA inteira (evita "Arquiteto Decorador" virar "Orador")
  const cs = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\bveneravel\b/.test(cs)) return 'veneravel mestre';
  if (/\bvigilante\b/.test(cs)) {
    if (c.includes('1') || /\bprimeiro\b/.test(cs)) return 'primeiro vigilante';
    if (c.includes('2') || /\bsegundo\b/.test(cs)) return 'segundo vigilante';
  }
  if (/\borador\b/.test(cs)) return 'orador';
  if (/\bsecretario\b/.test(cs)) return 'secretario';
  if (/\btesoureiro\b/.test(cs)) return 'tesoureiro';
  if (/\bchanceler\b/.test(cs)) return 'chanceler';
  if (c.includes('hospitaleiro')) return 'hospitaleiro';
  if (c.includes('mestre') && c.includes('cerimonia')) return 'mestre de cerimonia';
  if (c.includes('mestre') && c.includes('harmonia')) return 'mestre de harmonia';
  if (c.includes('mestre') && c.includes('banquete')) return 'mestre de banquetes';
  if (c.includes('porta') && c.includes('espada')) return 'porta espada';
  if (c.includes('porta') && c.includes('estandarte')) return 'porta estandarte';
  if (c.includes('1') && (c.includes('diacono') || c.includes('diácono'))) return '1º diacono';
  if (c.includes('2') && (c.includes('diacono') || c.includes('diácono'))) return '2º diacono';
  if (c.includes('diacono') || c.includes('diácono')) return '1º diacono';
  if (c.includes('cobridor') && c.includes('externo')) return 'cobridor externo';
  if (c.includes('guarda') && c.includes('templo')) return 'guarda do templo';
  if (c.includes('cobridor') && c.includes('interno')) return 'guarda do templo';
  if (c.includes('bibliotecario') || c.includes('bibliotecário')) return 'bibliotecario';
  return c;
};

export const CARGOS_PRINCIPAIS = [
  'veneravel mestre', 'primeiro vigilante', 'segundo vigilante',
  'orador', 'secretario', 'tesoureiro', 'chanceler',
];

export const ORDEM_HIERARQUICA = [
  ...CARGOS_PRINCIPAIS,
  'hospitaleiro', 'mestre de cerimonia', 'mestre de harmonia', 'mestre de banquetes',
  'porta espada', 'porta estandarte', '1º diacono', '2º diacono',
  'cobridor externo', 'guarda do templo', 'bibliotecario',
];

export const ordenarCargos = (a, b) => {
  const ca = normalizarCargo(a.cargo), cb = normalizarCargo(b.cargo);
  const ia = ORDEM_HIERARQUICA.indexOf(ca), ib = ORDEM_HIERARQUICA.indexOf(cb);
  if (ia === -1 && ib === -1) return ca.localeCompare(cb);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
};

// ── Contagem do Painel da Administração (usada por CorpoAdmin, PainelCorpoAdmin e pelo PDF) ──
// Regras: cada PESSOA conta uma única vez em cada indicador, não importa quantas vezes repetiu o cargo
// (VM 2x = 1; Tesoureiro 3x = 1). Pessoa = nome normalizado (junta cadastros duplicados do mesmo irmão).
// Cargos de adjunto / pró / vice / ex / past NÃO contam como cargo principal.
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const RE_NAO_TITULAR = /(adjunt|\bpast\b|\bex[- ]|\bpro[- ]|\bvice\b)/;

export const cargoPrincipalDe = (texto) => {
  if (RE_NAO_TITULAR.test(semAcento(texto))) return null;
  const n = normalizarCargo(texto);
  return CARGOS_PRINCIPAIS.includes(n) ? n : null;
};

export const calcularResumoCargos = (corpoAdmin = [], irmaos = []) => {
  const irmaoPorId = new Map((irmaos || []).map(i => [i.id, i]));
  const porPessoa = {};
  const anos = new Set();
  const vistos = new Set();
  (corpoAdmin || []).forEach(ca => {
    if (ca.ano_exercicio) anos.add(String(ca.ano_exercicio));
    const cargo = cargoPrincipalDe(ca.cargo);
    if (!cargo || !ca.irmao_id) return;
    const ref = irmaoPorId.get(ca.irmao_id);
    const nome = ca.irmao?.nome || ref?.nome;
    if (!nome) return;
    const pessoa = semAcento(nome);
    const ano = String(ca.ano_exercicio ?? '');
    const chave = `${pessoa}|${cargo}|${ano}`;
    if (vistos.has(chave)) return;      // mesma pessoa, cargo e ano lançados em duplicidade
    vistos.add(chave);
    const foto = ca.irmao?.foto_url || ref?.foto_url;
    if (!porPessoa[pessoa]) porPessoa[pessoa] = { id: ca.irmao_id, ids: [], nome, foto, cargos: {}, anos: {}, total: 0 };
    const r = porPessoa[pessoa];
    if (!r.ids.includes(ca.irmao_id)) r.ids.push(ca.irmao_id);
    if (!r.foto && foto) r.foto = foto;
    r.cargos[cargo] = (r.cargos[cargo] || 0) + 1;
    (r.anos[cargo] = r.anos[cargo] || []).push(ano);
    r.total += 1;
  });
  const lista = Object.values(porPessoa);
  const anoAtual = [...anos].sort().pop();
  const vmAtualReg = (corpoAdmin || []).find(ca => String(ca.ano_exercicio) === anoAtual && cargoPrincipalDe(ca.cargo) === 'veneravel mestre');
  const OFICIAIS = CARGOS_PRINCIPAIS.filter(c => c !== 'veneravel mestre');   // 1º Vigilante até Chanceler
  return {
    lista,
    totalGestoes: anos.size,
    irmaosDistintos: lista.length,                                   // VM até Chanceler (pessoas distintas)
    jaForamVM: lista.filter(r => r.cargos['veneravel mestre']).length,
    jaForamOficiais: lista.filter(r => OFICIAIS.some(c => r.cargos[c])).length,   // 1º Vig até Chanceler (pessoas distintas)
    distintosPorCargo: Object.fromEntries(CARGOS_PRINCIPAIS.map(c => [c, lista.filter(r => r.cargos[c]).length])),
    anoAtual,
    vmAtual: vmAtualReg ? (vmAtualReg.irmao?.nome || irmaoPorId.get(vmAtualReg.irmao_id)?.nome) : null,
    max: Math.max(1, ...lista.flatMap(r => Object.values(r.cargos))),
  };
};
