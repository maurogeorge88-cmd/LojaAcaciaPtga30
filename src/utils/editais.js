import { supabase } from '../supabaseClient';

// ════════════════════════════════════════════════════════════════════════
// Editais — fonte única: tabela `editais` (tela Expedientes → Editais).
// Numeração sequencial POR ANO (reinicia a cada ano), compartilhada entre
// todos os tipos. O ano do edital é o ano da data do edital.
// ════════════════════════════════════════════════════════════════════════

export const TIPOS_EDITAL = {
  eleicao_loja: 'Eleição da Loja',
  posse_loja: 'Posse da Loja',
  eleicao_glemt: 'Eleição da GLEMT',
  outro: 'Outro',
};

export const formatarNumeroEdital = (n, ano) => (n ? `${String(n).padStart(2, '0')}/${ano}` : '');

export const anoDeData = (d) => parseInt(String(d || '').substring(0, 4)) || new Date().getFullYear();

export const proximoNumeroEdital = async (ano) => {
  const { data, error } = await supabase.from('editais').select('numero')
    .eq('ano', ano).order('numero', { ascending: false }).limit(1);
  if (error) throw error;
  return (data && data[0] ? Number(data[0].numero) || 0 : 0) + 1;
};

// Cria o edital com o próximo número do ano. Em conflito (duas emissões ao mesmo tempo) tenta de novo.
export const emitirEdital = async ({ tipo, dataEdital, descricao, origemId = null }) => {
  const ano = anoDeData(dataEdital);
  for (let t = 0; t < 4; t++) {
    const numero = await proximoNumeroEdital(ano);
    const { data, error } = await supabase.from('editais')
      .insert([{ numero, ano, tipo, data_edital: dataEdital || null, descricao, origem_id: origemId ? String(origemId) : null }])
      .select().single();
    if (!error) return data;
    if (error.code !== '23505') throw error;
  }
  throw new Error('Não foi possível reservar o número do edital (conflito). Tente novamente.');
};

export const buscarEdital = async (id) => {
  if (!id) return null;
  const { data, error } = await supabase.from('editais').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data || null;
};
