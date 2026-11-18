import { supabase } from '../supabaseClient';

// Estrutura única dos familiares de um membro do Arco Real (mesmo desenho
// do cadastro de irmãos da Loja: cônjuge, pais e filhos).
export const CONJUGE_VAZIO = { nome: '', cpf: '', data_nascimento: '', data_casamento: '', profissao: '', email: '' };
export const PAIS_VAZIO = {
  nome_pai: '', pai_vivo: true, data_nascimento_pai: '', data_obito_pai: '',
  nome_mae: '', mae_viva: true, data_nascimento_mae: '', data_obito_mae: '',
};
export const FAMILIA_VAZIA = () => ({ temConjuge: false, conjuge: { ...CONJUGE_VAZIO }, pais: { ...PAIS_VAZIO }, filhos: [] });

const s = (v) => (v === undefined || v === null ? '' : v);

// Converte linhas das tabelas (Arco Real ou Loja) para a estrutura do formulário
const montar = ({ esposa, pais, filhos }) => {
  const f = FAMILIA_VAZIA();
  if (esposa) {
    f.temConjuge = true;
    f.conjuge = {
      nome: s(esposa.nome), cpf: s(esposa.cpf), data_nascimento: s(esposa.data_nascimento),
      data_casamento: s(esposa.data_casamento), profissao: s(esposa.profissao), email: s(esposa.email),
    };
  }
  (pais || []).forEach(p => {
    if (p.tipo === 'pai') {
      f.pais.nome_pai = s(p.nome); f.pais.pai_vivo = !p.falecido;
      f.pais.data_nascimento_pai = s(p.data_nascimento); f.pais.data_obito_pai = s(p.data_obito);
    } else if (p.tipo === 'mae') {
      f.pais.nome_mae = s(p.nome); f.pais.mae_viva = !p.falecido;
      f.pais.data_nascimento_mae = s(p.data_nascimento); f.pais.data_obito_mae = s(p.data_obito);
    }
  });
  f.filhos = (filhos || []).map(x => ({
    nome: s(x.nome), data_nascimento: s(x.data_nascimento), sexo: x.sexo || 'M',
    tipo_vinculo: x.tipo_vinculo || (x.sexo === 'F' ? 'filha' : 'filho'),
    vivo: x.vivo !== false, data_obito: s(x.data_obito),
  }));
  return f;
};

const tabelaAusente = (e) => /does not exist|schema cache|42P01|PGRST205/i.test(`${e?.code || ''} ${e?.message || ''}`);

// Familiares gravados no Arco Real. { familia, semTabela }
export const carregarFamiliaresArcoReal = async (membroId) => {
  const [r1, r2, r3] = await Promise.all([
    supabase.from('arco_real_esposas').select('*').eq('membro_id', membroId).limit(1),
    supabase.from('arco_real_pais').select('*').eq('membro_id', membroId),
    supabase.from('arco_real_filhos').select('*').eq('membro_id', membroId).order('data_nascimento', { ascending: true }),
  ]);
  const erro = r1.error || r2.error || r3.error;
  if (erro) {
    if (tabelaAusente(erro)) return { familia: FAMILIA_VAZIA(), semTabela: true };
    throw erro;
  }
  return { familia: montar({ esposa: r1.data?.[0], pais: r2.data, filhos: r3.data }), semTabela: false };
};

// Familiares do irmão na Loja (usado ao importar um irmão)
export const carregarFamiliaresDaLoja = async (irmaoId) => {
  try {
    const [r1, r2, r3] = await Promise.all([
      supabase.from('esposas').select('*').eq('irmao_id', irmaoId).limit(1),
      supabase.from('pais').select('*').eq('irmao_id', irmaoId),
      supabase.from('filhos').select('*').eq('irmao_id', irmaoId),
    ]);
    return montar({ esposa: r1.data?.[0], pais: r2.data, filhos: r3.data });
  } catch {
    return FAMILIA_VAZIA();
  }
};

// Regrava os familiares do membro (apaga e reinsere, como na Loja)
export const salvarFamiliaresArcoReal = async (membroId, fam) => {
  const del = await Promise.all([
    supabase.from('arco_real_esposas').delete().eq('membro_id', membroId),
    supabase.from('arco_real_pais').delete().eq('membro_id', membroId),
    supabase.from('arco_real_filhos').delete().eq('membro_id', membroId),
  ]);
  const eDel = del.find(r => r.error)?.error;
  if (eDel) throw eDel;

  const nul = (v) => (v === '' || v === undefined ? null : v);
  if (fam.temConjuge && fam.conjuge.nome.trim()) {
    const c = fam.conjuge;
    const { error } = await supabase.from('arco_real_esposas').insert([{
      membro_id: membroId, nome: c.nome.trim(), cpf: nul((c.cpf || '').replace(/\D/g, '')),
      data_nascimento: nul(c.data_nascimento), data_casamento: nul(c.data_casamento),
      profissao: nul(c.profissao), email: nul(c.email),
    }]);
    if (error) throw error;
  }
  const pais = [];
  const p = fam.pais;
  if (p.nome_pai.trim()) pais.push({ membro_id: membroId, tipo: 'pai', nome: p.nome_pai.trim(), falecido: !p.pai_vivo, data_nascimento: nul(p.data_nascimento_pai), data_obito: p.pai_vivo ? null : nul(p.data_obito_pai) });
  if (p.nome_mae.trim()) pais.push({ membro_id: membroId, tipo: 'mae', nome: p.nome_mae.trim(), falecido: !p.mae_viva, data_nascimento: nul(p.data_nascimento_mae), data_obito: p.mae_viva ? null : nul(p.data_obito_mae) });
  if (pais.length) {
    const { error } = await supabase.from('arco_real_pais').insert(pais);
    if (error) throw error;
  }
  if (fam.filhos.length) {
    const { error } = await supabase.from('arco_real_filhos').insert(fam.filhos.map(f => ({
      membro_id: membroId, nome: f.nome.trim(), data_nascimento: nul(f.data_nascimento), sexo: f.sexo,
      tipo_vinculo: f.tipo_vinculo || (f.sexo === 'M' ? 'filho' : 'filha'),
      vivo: f.vivo !== false, data_obito: f.vivo === false ? nul(f.data_obito) : null,
    })));
    if (error) throw error;
  }
};

// Copia da Loja os familiares dos membros vinculados que ainda não têm
// nenhum familiar no Arco Real. Não sobrescreve quem já tem cadastro.
export const sincronizarFamiliaresDaLoja = async (membros) => {
  const vinculados = (membros || []).filter(m => m.irmao_vinculado_id);
  if (!vinculados.length) return { copiados: 0, ignorados: 0, semTabela: false };
  const ids = vinculados.map(m => m.id);
  const [e, p, f] = await Promise.all([
    supabase.from('arco_real_esposas').select('membro_id').in('membro_id', ids),
    supabase.from('arco_real_pais').select('membro_id').in('membro_id', ids),
    supabase.from('arco_real_filhos').select('membro_id').in('membro_id', ids),
  ]);
  const erro = e.error || p.error || f.error;
  if (erro) {
    if (tabelaAusente(erro)) return { copiados: 0, ignorados: 0, semTabela: true };
    throw erro;
  }
  const jaTem = new Set([...(e.data || []), ...(p.data || []), ...(f.data || [])].map(r => String(r.membro_id)));
  let copiados = 0, ignorados = 0;
  for (const m of vinculados) {
    if (jaTem.has(String(m.id))) { ignorados++; continue; }
    const fam = await carregarFamiliaresDaLoja(m.irmao_vinculado_id);
    const vazia = !fam.temConjuge && !fam.filhos.length && !fam.pais.nome_pai && !fam.pais.nome_mae;
    if (vazia) { ignorados++; continue; }
    await salvarFamiliaresArcoReal(m.id, fam);
    copiados++;
  }
  return { copiados, ignorados, semTabela: false };
};
