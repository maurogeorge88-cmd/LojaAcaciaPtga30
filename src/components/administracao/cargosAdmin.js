// Normalização e hierarquia dos cargos administrativos (compartilhado por CorpoAdmin e PainelCorpoAdmin)
export const normalizarCargo = (cargo) => {
  if (!cargo) return '';
  const c = cargo.toLowerCase().trim();
  if (c.includes('veneravel') || c.includes('venerável')) return 'veneravel mestre';
  if (c.includes('1') && c.includes('vigilante')) return 'primeiro vigilante';
  if (c.includes('primeiro') && c.includes('vigilante')) return 'primeiro vigilante';
  if (c.includes('2') && c.includes('vigilante')) return 'segundo vigilante';
  if (c.includes('segundo') && c.includes('vigilante')) return 'segundo vigilante';
  if (c.includes('orador')) return 'orador';
  if (c.includes('secretario') || c.includes('secretário')) return 'secretario';
  if (c.includes('tesoureiro')) return 'tesoureiro';
  if (c.includes('chanceler')) return 'chanceler';
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
