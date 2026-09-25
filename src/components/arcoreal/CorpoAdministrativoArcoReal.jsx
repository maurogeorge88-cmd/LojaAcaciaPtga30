import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { CARGOS_ARCO_REAL } from '../../utils/cargosArcoReal';

const anoAtualNum = new Date().getFullYear();

export default function CorpoAdministrativoArcoReal({ permissoes = {}, showSuccess, showError }) {
  const podeEditar = !!permissoes?.canEditMembers;

  const [membros, setMembros] = useState([]);
  const [registros, setRegistros] = useState([]); // todos os registros, todos os anos
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ membro_id: '', cargo: '', ano_exercicio: String(anoAtualNum) });
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const [anoFiltro, setAnoFiltro] = useState('');

  useEffect(() => { carregarMembros(); carregarRegistros(); }, []);

  const carregarMembros = async () => {
    const { data } = await supabase.from('arco_real_membros').select('id, nome').eq('ativo', true).order('nome');
    setMembros(data || []);
  };

  const carregarRegistros = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('arco_real_corpo_administrativo')
        .select('id, cargo, ano_exercicio, membro_id, arco_real_membros(nome)')
        .order('ano_exercicio', { ascending: false });
      if (error) throw error;
      setRegistros(data || []);
    } catch (e) {
      showError?.('Erro ao carregar Corpo Administrativo: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const ordenarPorCargo = (lista) => {
    return [...lista].sort((a, b) => {
      const ia = CARGOS_ARCO_REAL.indexOf(a.cargo), ib = CARGOS_ARCO_REAL.indexOf(b.cargo);
      if (ia === -1 && ib === -1) return (a.cargo || '').localeCompare(b.cargo || '');
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  };

  // Gestão mais recente — o ano de exercício mais alto que já tem algum cargo registrado.
  const anoMaisRecente = registros.length > 0 ? registros.map(r => r.ano_exercicio).sort((a, b) => b.localeCompare(a))[0] : null;
  const registrosGestaoAtual = anoMaisRecente ? ordenarPorCargo(registros.filter(r => r.ano_exercicio === anoMaisRecente)) : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.membro_id || !form.cargo || !form.ano_exercicio.trim()) {
      showError?.('Preencha irmão, cargo e ano de exercício.');
      return;
    }
    setSalvando(true);
    try {
      if (editandoId) {
        const { error } = await supabase.from('arco_real_corpo_administrativo')
          .update({ membro_id: Number(form.membro_id), cargo: form.cargo, ano_exercicio: form.ano_exercicio.trim() })
          .eq('id', editandoId);
        if (error) throw error;
        showSuccess?.('✅ Cargo atualizado!');
      } else {
        const { error } = await supabase.from('arco_real_corpo_administrativo')
          .upsert({ membro_id: Number(form.membro_id), cargo: form.cargo, ano_exercicio: form.ano_exercicio.trim() }, { onConflict: 'cargo,ano_exercicio' });
        if (error) throw error;
        showSuccess?.('✅ Cargo registrado!');
      }
      setForm({ membro_id: '', cargo: '', ano_exercicio: form.ano_exercicio });
      setEditandoId(null);
      carregarRegistros();
    } catch (e2) {
      showError?.('Erro ao salvar: ' + e2.message);
    } finally {
      setSalvando(false);
    }
  };

  const iniciarEdicao = (r) => {
    setEditandoId(r.id);
    setForm({ membro_id: String(r.membro_id), cargo: r.cargo, ano_exercicio: r.ano_exercicio });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setForm({ membro_id: '', cargo: '', ano_exercicio: String(anoAtualNum) });
  };

  const excluirRegistro = async (id) => {
    try {
      const { error } = await supabase.from('arco_real_corpo_administrativo').delete().eq('id', id);
      if (error) throw error;
      showSuccess?.('✅ Cargo removido.');
      carregarRegistros();
    } catch (e) {
      showError?.('Erro ao remover: ' + e.message);
    }
  };

  const sInp = { background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.55rem 0.75rem', fontSize: '0.875rem', width: '100%' };

  const anosParaListar = [...new Set(
    registros.filter(r => !anoFiltro || (r.ano_exercicio || '').includes(anoFiltro)).map(r => r.ano_exercicio)
  )].sort((a, b) => b.localeCompare(a));

  return (
    <div className="p-6" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)', margin: '0 0 1.25rem' }}>🏛️ Corpo Administrativo</h2>

      {/* Gestão mais recente em destaque */}
      {anoMaisRecente && (() => {
        const principais = ['1º Principal', '2º Principal', '3º Principal']
          .map(c => registrosGestaoAtual.find(r => r.cargo === c))
          .filter(Boolean);
        const demais = registrosGestaoAtual.filter(r => !['1º Principal', '2º Principal', '3º Principal'].includes(r.cargo));

        return (
          <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.85rem 1.25rem', background: 'var(--color-accent)' }}>
              <span style={{ fontWeight: '700', fontSize: '1rem', color: '#fff' }}>🏛️ Gestão {anoMaisRecente}</span>
              <span style={{ marginLeft: '1rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>{registrosGestaoAtual.length} cargo(s) preenchido(s)</span>
            </div>
            <div style={{ padding: '1rem', background: 'var(--color-surface)' }}>
              {principais.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: demais.length > 0 ? '0.75rem' : 0 }}>
                  {principais.map(r => (
                    <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.85rem 1rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)', border: '3px solid #f59e0b' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{r.cargo}</span>
                      <span style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--color-text)' }}>{r.arco_real_membros?.nome || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
              {demais.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem' }}>
                  {demais.map(r => (
                    <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem 0.85rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-accent)' }}>{r.cargo}</span>
                      <span style={{ fontSize: '0.88rem', color: 'var(--color-text)' }}>{r.arco_real_membros?.nome || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Formulário de registro/edição */}
      {podeEditar && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-text)', margin: '0 0 1rem' }}>
            {editandoId ? '✏️ Editar Cargo Administrativo' : '➕ Registrar Cargo Administrativo'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.3rem' }}>Irmão *</label>
                <select value={form.membro_id} onChange={e => setForm(f => ({ ...f, membro_id: e.target.value }))} style={sInp}>
                  <option value="">Selecione um irmão</option>
                  {membros.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.3rem' }}>Cargo *</label>
                <select value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} style={sInp}>
                  <option value="">Selecione um cargo</option>
                  {CARGOS_ARCO_REAL.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.3rem' }}>Ano de Exercício *</label>
                <input type="text" placeholder="Ex: 2026" value={form.ano_exercicio} onChange={e => setForm(f => ({ ...f, ano_exercicio: e.target.value }))} style={sInp} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.1rem', justifyContent: 'flex-end' }}>
              {editandoId && (
                <button type="button" onClick={cancelarEdicao}
                  style={{ padding: '0.55rem 1.1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
              )}
              <button type="submit" disabled={salvando}
                style={{ padding: '0.55rem 1.4rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: salvando ? 'not-allowed' : 'pointer', opacity: salvando ? 0.7 : 1 }}>
                {salvando ? 'Salvando...' : editandoId ? '💾 Atualizar Cargo' : '💾 Registrar Cargo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtro por ano */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.85rem' }}>Filtrar por Ano:</label>
        <input type="text" placeholder="Digite o ano (ex: 2024)" value={anoFiltro} onChange={e => setAnoFiltro(e.target.value)} style={{ ...sInp, flex: 1, minWidth: '160px' }} />
        {anoFiltro && (
          <button onClick={() => setAnoFiltro('')}
            style={{ padding: '0.5rem 1rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer' }}>
            Limpar
          </button>
        )}
      </div>

      {/* Lista agrupada por ano */}
      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>Carregando...</p>
      ) : anosParaListar.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>Nenhum registro encontrado.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {anosParaListar.map(ano => {
            const doAno = ordenarPorCargo(registros.filter(r => r.ano_exercicio === ano));
            return (
              <div key={ano} style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <div style={{ padding: '0.85rem 1.25rem', background: 'var(--color-accent)' }}>
                  <span style={{ fontWeight: '700', fontSize: '1rem', color: '#fff' }}>Administração {ano}</span>
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>{doAno.length} cargo(s)</span>
                </div>
                <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.6rem', background: 'var(--color-surface)' }}>
                  {doAno.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.85rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-accent)' }}>{r.cargo}</p>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text)' }}>{r.arco_real_membros?.nome || '—'}</p>
                      </div>
                      {podeEditar && (
                        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                          <button onClick={() => iniciarEdicao(r)} title="Editar"
                            style={{ padding: '0.2rem 0.4rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem' }}>
                            ✏️
                          </button>
                          <button onClick={() => excluirRegistro(r.id)} title="Excluir"
                            style={{ padding: '0.2rem 0.4rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem' }}>
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
