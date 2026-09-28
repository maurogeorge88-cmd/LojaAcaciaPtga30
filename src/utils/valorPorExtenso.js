// Valor monetário por extenso em português do Brasil.
//   2146.5  -> "dois mil cento e quarenta e seis reais e cinquenta centavos"
//   1000    -> "mil reais"            (não "um mil")
//   1100    -> "mil e cem reais"
//   1000000 -> "um milhão de reais"
//
// Regra do "e" entre grupos (milhão / mil / centenas): só entra antes do
// ÚLTIMO grupo não-nulo, e apenas quando ele é menor que 100 ou é uma
// centena redonda (100, 200, ... 900). Nos demais casos os grupos são
// separados por espaço.

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_19 = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

// 1..999
const centena = (n) => {
  if (n === 100) return 'cem';
  const partes = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(DEZ_A_19[resto - 10]);
    else {
      const d = Math.floor(resto / 10), u = resto % 10;
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(' e ');
};

// Inteiro 1..999.999.999
const inteiro = (n) => {
  const milhoes = Math.floor(n / 1000000);
  const milhares = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;

  const grupos = [];
  if (milhoes > 0) grupos.push({ valor: milhoes, texto: `${centena(milhoes)} ${milhoes === 1 ? 'milhão' : 'milhões'}` });
  if (milhares > 0) grupos.push({ valor: milhares, texto: milhares === 1 ? 'mil' : `${centena(milhares)} mil` });
  if (resto > 0) grupos.push({ valor: resto, texto: centena(resto) });

  return grupos.reduce((acc, g, i) => {
    if (i === 0) return g.texto;
    const ehUltimo = i === grupos.length - 1;
    const usaE = ehUltimo && (g.valor < 100 || g.valor % 100 === 0);
    return `${acc}${usaE ? ' e ' : ' '}${g.texto}`;
  }, '');
};

export const valorPorExtenso = (valor) => {
  const total = Math.round(Number(valor || 0) * 100); // trabalha em centavos p/ evitar erro de ponto flutuante
  const reais = Math.floor(total / 100);
  const centavos = total % 100;

  const partes = [];
  if (reais > 0) {
    const sufixo = reais === 1 ? 'real' : (reais % 1000000 === 0 ? 'de reais' : 'reais');
    partes.push(`${inteiro(reais)} ${sufixo}`);
  }
  if (centavos > 0) partes.push(`${inteiro(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  return partes.length ? partes.join(' e ') : 'zero reais';
};
