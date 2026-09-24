import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

// Ordem oficial dos cargos — mesma da "Primeira Nominata do Capítulo
// Guardiões da Aliança do Sagrado Arco Real". Cadastro simples: cargo +
// membro + ano de exercício, sem fluxo de eleição/chapas/posse.
const CARGOS_ARCO_REAL = [
  '1º Principal', '2º Principal', '3º Principal',
  'Tesoureiro',
  'Escriba Esdras', 'Assistente do Escriba Esdras', 'Escriba Neemias',
  '1º Forasteiro', '1º Assistente do Forasteiro', '2º Assistente do Forasteiro',
  'Diretor de Cerimônias', 'Assistente do Diretor de Cerimônias',
  'Esmoler', 'Guardião', 'Organista', 'Mestre de Caridade', 'Intendente',
];

export default function CorpoAdministrativoArcoReal({ permissoes = {}, showSuccess, showError }) {
  const podeEditar = !!permissoes?.canEditMembers;
  const anoAtual = new Date().getFullYear();

  const [anoExercicio, setAnoExercicio] = useState(String(anoAtual));
  const [anosDisponiveis, setAnosDisponiveis] = useState([String(anoAtual), String(anoAtual + 1)]);
  const [membros, setMembros] = useState([]);
  const [ocupantes, setOcupantes] = useState({}); // cargo -> { id, membro_id, nome }
  const [loading, setLoading] = useState(true);
  const [editandoCargo, setEditandoCargo] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { carregarMembros(); carregarAnos(); }, []);
  useEffect(() => { carregarOcupantes(); }, [anoExercicio]);

  const carregarMembros = async () => {
    const { data } = await supabase.from('arco_real_membros').select('id, nome').eq('ativo', true).order('nome');
    setMembros(data || []);
  };

  const carregarAnos = async () => {
    const { data } = await supabase.from('arco_real_corpo_administrativo').select('ano_exercicio');
    const anos = [...new Set([...(data || []).map(d => d.ano_exercicio), String(anoAtual), String(anoAtual + 1)])].sort((a, b) => b.localeCompare(a));
    setAnosDisponiveis(anos);
  };

  const carregarOcupantes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('arco_real_corpo_administrativo')
        .select('id, cargo, membro_id, arco_real_membros(nome)')
        .eq('ano_exercicio', anoExercicio);
      if (error) throw error;
      const mapa = {};
      (data || []).forEach(l => { mapa[l.cargo] = { id: l.id, membro_id: l.membro_id, nome: l.arco_real_membros?.nome || '—' }; });
      setOcupantes(mapa);
    } catch (e) {
      showError?.('Erro ao carregar Corpo Administrativo: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const salvarOcupante = async (cargo, membroId) => {
    setSalvando(true);
    try {
      const existente = ocupantes[cargo];
      if (!membroId) {
        if (existente) {
          const { error } = await supabase.from('arco_real_corpo_administrativo').delete().eq('id', existente.id);
          if (error) throw error;
        }
      } else if (existente) {
        const { error } = await supabase.from('arco_real_corpo_administrativo').update({ membro_id: membroId }).eq('id', existente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('arco_real_corpo_administrativo').insert({ cargo, membro_id: membroId, ano_exercicio: anoExercicio });
        if (error) throw error;
      }
      showSuccess?.('✅ Corpo Administrativo atualizado!');
      setEditandoCargo(null);
      carregarOcupantes();
    } catch (e) {
      showError?.('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="p-6" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>🏛️ Corpo Administrativo</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0 }}>Capítulo Guardiões da Aliança Nº 04</p>
        </div>
        <select value={anoExercicio} onChange={e => setAnoExercicio(e.target.value)}
          style={{ padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}>
          {anosDisponiveis.map(a => <option key={a} value={a}>Exercício {a}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>Carregando...</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
          {CARGOS_ARCO_REAL.map((cargo, idx) => {
            const ocupante = ocupantes[cargo];
            const emEdicao = editandoCargo === cargo;
            return (
              <div key={cargo} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1.25rem', borderBottom: idx < CARGOS_ARCO_REAL.length - 1 ? '1px solid var(--color-border)' : 'none', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                <div style={{ width: '230px', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontWeight: '700', color: 'var(--color-text)', fontSize: '0.88rem' }}>{cargo}</p>
                </div>
                <div style={{ flex: 1 }}>
                  {emEdicao ? (
                    <select
                      autoFocus
                      defaultValue={ocupante?.membro_id || ''}
                      onChange={e => salvarOcupante(cargo, e.target.value ? Number(e.target.value) : null)}
                      disabled={salvando}
                      style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-accent)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: '0.85rem' }}
                    >
                      <option value="">— Vago —</option>
                      {membros.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>
                  ) : (
                    <p style={{ margin: 0, color: ocupante ? 'var(--color-text)' : 'var(--color-text-muted)', fontStyle: ocupante ? 'normal' : 'italic', fontSize: '0.88rem' }}>
                      {ocupante?.nome || 'Vago'}
                    </p>
                  )}
                </div>
                {podeEditar && !emEdicao && (
                  <button onClick={() => setEditandoCargo(cargo)}
                    style={{ padding: '0.3rem 0.7rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', flexShrink: 0 }}>
                    ✏️ {ocupante ? 'Alterar' : 'Definir'}
                  </button>
                )}
                {podeEditar && emEdicao && (
                  <button onClick={() => setEditandoCargo(null)} disabled={salvando}
                    style={{ padding: '0.3rem 0.7rem', background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', flexShrink: 0 }}>
                    Cancelar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!podeEditar && (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.78rem', marginTop: '1rem' }}>Somente visualização — sem permissão de gestão pra alterar os cargos.</p>
      )}
    </div>
  );
}
