/**
 * Retorna emoji adequado baseado em idade e sexo
 * @param {number} idade - Idade da pessoa
 * @param {string} sexo - 'M' ou 'F'
 * @param {string} tipo - 'filho', 'pai', 'mae', 'esposa' (opcional)
 * @returns {string} Emoji adequado
 */
export const obterEmojiPessoa = (idade, sexo, tipo = null) => {
  // Bebê (0-2 anos)
  if (idade <= 2) {
    return '👶';
  }
  
  // Criança (3-12 anos)
  if (idade <= 12) {
    return sexo === 'F' ? '👧' : '👦';
  }
  
  // Adolescente (13-17 anos)
  if (idade <= 17) {
    return sexo === 'F' ? '👧' : '👦';
  }
  
  // Adulto (18-59 anos)
  if (idade <= 59) {
    if (tipo === 'esposa') return '💑'; // Caso especial para esposa
    return sexo === 'F' ? '👩' : '👨';
  }
  
  // Idoso (60+ anos)
  return sexo === 'F' ? '👵' : '👴';
};

/**
 * Retorna emoji para casais/relacionamentos
 */
export const obterEmojiCasal = () => '💑';

/**
 * Retorna emoji para família
 */
export const obterEmojiFamilia = () => '👨‍👩‍👧‍👦';
