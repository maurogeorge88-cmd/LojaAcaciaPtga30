/**
 * FILA DE ESPERA - BIBLIOTECA  
 * Versão final corrigida (sem erros)
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function FilaEspera({ permissoes, showSuccess, showError, livros, irmaos }) {
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState([]);
  
  // Modal adicionar
  const [modalAdicionar, setModalAdicionar] = useState(false);
  const [filaForm, setFilaForm] = useState({
    livro_id: '',
    irmao_id: '',
    observacoes: ''
  });

  // Filtros
  const [filtroLivro, setFiltroLivro] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('aguardando');

  useEffect(() => {
    carregarFilas();
  }, []);

  const carregarFilas = async () => {
    setLoading(true);
    try {
      // Buscar direto da tabela
      const { data, error } = await supabase
        .from('fila_espera_livros')
        .select('*')
        .order('livro_id')
        .order('posicao');

      if (error) {
        console.error('❌ Erro ao carregar filas:', error);
        throw error;
      }
      
      // Enriquecer com dados de livros e irmãos
      const filasEnriquecidas = (data || []).map(fila => {
        const livro = livros?.find(l => l.id === fila.livro_id);
        const irmao = irmaos?.find(i => i.id === fila.irmao_id);
        
        return {
          ...fila,
          livro_titulo: livro?.titulo || 'Livro não encontrado',
          livro_autor: livro?.autor || '',
          irmao_nome: irmao?.nome || 'Irmão não encontrado',
          irmao_cim: irmao?.cim || '',
          irmao_telefone: irmao?.telefone || '',
          irmao_email: irmao?.email || ''
        };
      });
      
      setFilas(filasEnriquecidas);
    } catch (error) {
      console.error('❌ Erro ao carregar filas:', error);
      // Não mostrar erro se for apenas vazio
      setFilas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdicionar = async (e) => {
    e.preventDefault();

    if (!filaForm.livro_id || !filaForm.irmao_id) {
      showError('Selecione o livro e o irmão');
      return;
    }

    try {
      console.log('➕ Adicionando à fila...', filaForm);
      
      // Verificar se já está na fila (SEM .single())
      const { data: jaExiste, error: errorCheck } = await supabase
        .from('fila_espera_livros')
        .select('id')
        .eq('livro_id', filaForm.livro_id)
        .eq('irmao_id', filaForm.irmao_id)
        .eq('status', 'aguardando');

      if (errorCheck) {
        console.error('Erro ao verificar:', errorCheck);
        throw errorCheck;
      }

      if (jaExiste && jaExiste.length > 0) {
        showError('Este irmão já está na fila de espera deste livro');
        return;
      }

      // Calcular próxima posição (SEM .single())
      const { data: filasDesseLivro, error: errorPosicao } = await supabase
        .from('fila_espera_livros')
        .select('posicao')
        .eq('livro_id', filaForm.livro_id)
        .eq('status', 'aguardando')
        .order('posicao', { ascending: false })
        .limit(1);

      if (errorPosicao) {
        console.error('Erro ao buscar posição:', errorPosicao);
        throw errorPosicao;
      }

      const proximaPosicao = filasDesseLivro && filasDesseLivro.length > 0 
        ? filasDesseLivro[0].posicao + 1 
        : 1;

      console.log('📍 Próxima posição:', proximaPosicao);

      // Inserir
      const { data: inserted, error: errorInsert } = await supabase
        .from('fila_espera_livros')
        .insert([{
          livro_id: parseInt(filaForm.livro_id),
          irmao_id: parseInt(filaForm.irmao_id),
          observacoes: filaForm.observacoes || null,
          posicao: proximaPosicao,
          status: 'aguardando'
        }])
        .select();

      if (errorInsert) {
        console.error('❌ Erro ao inserir:', errorInsert);
        throw errorInsert;
      }

      console.log('✅ Inserido:', inserted);
      showSuccess('Irmão adicionado à fila de espera!');
      setModalAdicionar(false);
      limparForm();
      carregarFilas();
    } catch (error) {
      console.error('❌ Erro ao adicionar:', error);
      showError(`Erro ao adicionar à fila: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleAtender = async (filaId, irmaoNome) => {
    if (!confirm(`Marcar como atendido: ${irmaoNome}?`)) return;

    try {
      const { error } = await supabase
        .from('fila_espera_livros')
        .update({
          status: 'atendido',
          data_atendimento: new Date().toISOString(),
          atendido_por: 'Sistema'
        })
        .eq('id', filaId);

      if (error) throw error;

      showSuccess('Solicitação atendida! Irmão saiu da fila.');
      carregarFilas();
    } catch (error) {
      console.error('Erro ao atender:', error);
      showError('Erro ao atender solicitação');
    }
  };

  const handleCancelar = async (filaId, irmaoNome) => {
    if (!confirm(`Cancelar solicitação de: ${irmaoNome}?`)) return;

    try {
      const { error } = await supabase
        .from('fila_espera_livros')
        .update({ status: 'cancelado' })
        .eq('id', filaId);

      if (error) throw error;

      showSuccess('Solicitação cancelada');
      carregarFilas();
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      showError('Erro ao cancelar solicitação');
    }
  };

  const handleExcluir = async (filaId) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;

    try {
      const { error } = await supabase
        .from('fila_espera_livros')
        .delete()
        .eq('id', filaId);

      if (error) throw error;

      showSuccess('Registro excluído');
      carregarFilas();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      showError('Erro ao excluir registro');
    }
  };

  const limparForm = () => {
    setFilaForm({
      livro_id: '',
      irmao_id: '',
      observacoes: ''
    });
  };

  // Usar livros e irmãos das props
  const livrosDisponiveis = livros || [];
  const irmaosAptos = (irmaos || [])
    .filter(i => ['regular', 'licenciado'].includes(String(i?.situacao || 'regular').toLowerCase()))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));

  // Filtrar filas
  const filasFiltradas = filas.filter(f => {
    const matchLivro = filtroLivro === 'todos' || f.livro_id?.toString() === filtroLivro;
    const matchStatus = filtroStatus === 'todos' || f.status === filtroStatus;
    return matchLivro && matchStatus;
  });

  // Agrupar por livro
  const filasAgrupadas = filasFiltradas.reduce((acc, fila) => {
    const livroId = fila.livro_id;
    if (!acc[livroId]) {
      acc[livroId] = { livro: { id: fila.livro_id, titulo: fila.livro_titulo, autor: fila.livro_autor }, filas: [] };
    }
    acc[livroId].filas.push(fila);
    return acc;
  }, {});

  // Estatísticas
  const totalAguardando = filas.filter(f => f.status === 'aguardando').length;
  const totalAtendidos = filas.filter(f => f.status === 'atendido').length;
  const totalCancelados = filas.filter(f => f.status === 'cancelado').length;
  const livrosComFila = new Set(filas.filter(f => f.status === 'aguardando').map(f => f.livro_id)).size;
  const podeEditar = !!(permissoes?.canEdit || permissoes?.canEditMembers || permissoes?.pode_editar_biblioteca);

  const COR_STATUS = { aguardando: '#f59e0b', atendido: '#10b981', cancelado: '#94a3b8' };
  const ROTULO_STATUS = { aguardando: '⏳ Aguardando', atendido: '✅ Atendido', cancelado: '❌ Cancelado' };
  const rotuloKpi = { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const cartaoKpi = (cor) => ({ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: `3px solid ${cor}`, borderRadius: 'var(--radius-xl)', padding: '1rem 1.1rem', minWidth: 0 });
  const campo = { width: '100%', height: '2.5rem', padding: '0 0.8rem', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border-light)', fontSize: '0.875rem', boxSizing: 'border-box' };
  const rotuloCampo = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' };
  const btnIcone = (cor) => ({ width: '2rem', height: '2rem', borderRadius: 'var(--radius-md)', border: `1px solid ${cor}66`, background: `${cor}1f`, cursor: 'pointer', fontSize: '0.85rem' });

  const fecharModal = () => { setModalAdicionar(false); limparForm(); };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">⏳ Carregando fila de espera...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div style={cartaoKpi('#f59e0b')}>
          <p style={rotuloKpi}>Aguardando</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '2rem', fontWeight: 800, color: '#f59e0b', lineHeight: 1.1 }}>{totalAguardando}</p>
        </div>
        <div style={cartaoKpi('#10b981')}>
          <p style={rotuloKpi}>Atendidos</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '2rem', fontWeight: 800, color: '#10b981', lineHeight: 1.1 }}>{totalAtendidos}</p>
        </div>
        <div style={cartaoKpi('var(--color-accent)')}>
          <p style={rotuloKpi}>Livros com fila</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>{livrosComFila}</p>
        </div>
      </div>

      {/* Filtros e ação */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '0.9rem 1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
        <select value={filtroLivro} onChange={(e) => setFiltroLivro(e.target.value)} aria-label="Filtrar por livro" style={{ ...campo, width: 'auto', minWidth: '14rem', maxWidth: '22rem' }}>
          <option value="todos">Todos os livros</option>
          {livrosDisponiveis.map(livro => <option key={livro.id} value={livro.id}>{livro.titulo}</option>)}
        </select>
        <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {[['aguardando', 'Aguardando', totalAguardando], ['atendido', 'Atendidos', totalAtendidos], ['cancelado', 'Cancelados', totalCancelados], ['todos', 'Todos', filas.length]].map(([valor, rotulo, qtd]) => {
            const ativo = filtroStatus === valor;
            return (
              <button key={valor} onClick={() => setFiltroStatus(valor)}
                style={{ height: '2.2rem', padding: '0 0.85rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                  border: `1px solid ${ativo ? 'var(--color-accent)' : 'var(--color-border-light)'}`, background: ativo ? 'var(--color-accent)' : 'var(--color-bg)', color: ativo ? '#fff' : 'var(--color-text)' }}>
                {rotulo} <span style={{ opacity: 0.85, fontWeight: 600 }}>{qtd}</span>
              </button>
            );
          })}
        </div>
        {podeEditar && (
          <button onClick={() => setModalAdicionar(true)}
            style={{ marginLeft: 'auto', height: '2.6rem', padding: '0 1.2rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            ➕ Adicionar à Fila
          </button>
        )}
      </div>

      {/* Lista agrupada por livro */}
      {Object.keys(filasAgrupadas).length === 0 ? (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>📚</p>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text)' }}>Nenhuma solicitação encontrada</p>
          {podeEditar && <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem' }}>Use "Adicionar à Fila" para registrar uma reserva</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.values(filasAgrupadas).map(({ livro, filas: filasDoLivro }) => (
            <div key={livro.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1.1rem', background: 'var(--color-surface-2)', borderLeft: '4px solid #f59e0b', borderBottom: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{livro.titulo}</h3>
                  {livro.autor && <p style={{ margin: '0.1rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{livro.autor}</p>}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{filasDoLivro.filter(f => f.status === 'aguardando').length} aguardando</span>
              </div>

              <div>
                {filasDoLivro.map((fila) => {
                  const cor = COR_STATUS[fila.status] || '#94a3b8';
                  return (
                    <div key={fila.id} style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem 1rem', padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--color-border)', opacity: fila.status === 'cancelado' ? 0.7 : 1 }}>
                      <div style={{ width: '2.2rem', height: '2.2rem', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', color: cor, background: `${cor}22`, border: `1px solid ${cor}66` }}>
                        {fila.status === 'aguardando' ? fila.posicao : fila.status === 'atendido' ? '✓' : '×'}
                      </div>

                      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>{fila.irmao_nome}</p>
                          <span style={{ display: 'inline-flex', justifyContent: 'center', width: '7.5rem', boxSizing: 'border-box', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 999, background: `${cor}22`, color: cor, border: `1px solid ${cor}66` }}>
                            {ROTULO_STATUS[fila.status] || fila.status}
                          </span>
                        </div>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                          {fila.irmao_cim ? `CIM ${fila.irmao_cim} · ` : ''}📅 {new Date(fila.data_solicitacao || fila.created_at).toLocaleString('pt-BR')}
                        </p>
                        {fila.observacoes && <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>💬 {fila.observacoes}</p>}
                      </div>

                      {podeEditar && (
                        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                          {fila.status === 'aguardando' && (
                            <>
                              <button onClick={() => handleAtender(fila.id, fila.irmao_nome)}
                                style={{ height: '2rem', padding: '0 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                ✅ Atender
                              </button>
                              <button onClick={() => handleCancelar(fila.id, fila.irmao_nome)} title="Cancelar solicitação" aria-label="Cancelar solicitação" style={btnIcone('#f59e0b')}>❌</button>
                            </>
                          )}
                          <button onClick={() => handleExcluir(fila.id)} title="Excluir" aria-label="Excluir registro" style={btnIcone('#ef4444')}>🗑️</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Janela: adicionar à fila */}
      {modalAdicionar && (
        <div onClick={fecharModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: '3px solid #f59e0b', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
            <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>⏳ Adicionar à Fila de Espera</h3>
              <button onClick={fecharModal} aria-label="Fechar"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)', borderRadius: 'var(--radius-md)', width: '2.2rem', height: '2.2rem', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer' }}>×</button>
            </div>

            <form onSubmit={handleAdicionar} style={{ padding: '1.2rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={rotuloCampo}>Livro *</label>
                <select value={filaForm.livro_id} onChange={(e) => setFilaForm({ ...filaForm, livro_id: e.target.value })} style={campo} required>
                  <option value="">Selecione o livro</option>
                  {livrosDisponiveis.map(livro => <option key={livro.id} value={livro.id}>{livro.titulo}</option>)}
                </select>
              </div>
              <div>
                <label style={rotuloCampo}>Irmão *</label>
                <select value={filaForm.irmao_id} onChange={(e) => setFilaForm({ ...filaForm, irmao_id: e.target.value })} style={campo} required>
                  <option value="">Selecione o irmão</option>
                  {irmaosAptos.map(irmao => <option key={irmao.id} value={irmao.id}>{irmao.nome}{irmao.cim ? ` - CIM: ${irmao.cim}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={rotuloCampo}>Observações</label>
                <textarea value={filaForm.observacoes} onChange={(e) => setFilaForm({ ...filaForm, observacoes: e.target.value })} rows="3" placeholder="Ex: Preciso para estudo"
                  style={{ ...campo, height: 'auto', padding: '0.6rem 0.8rem', fontFamily: 'inherit', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.65rem', paddingTop: '0.25rem' }}>
                <button type="button" onClick={fecharModal} style={{ flex: 1, height: '2.6rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ flex: 2, height: '2.6rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer' }}>➕ Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
