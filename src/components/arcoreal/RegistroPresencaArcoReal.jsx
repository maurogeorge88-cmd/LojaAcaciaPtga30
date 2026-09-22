import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

// Elegibilidade simples do Arco Real: apenas situação "regular" ou "licenciado"
// podem ter presença registrada. desligado/excluido/falecido nunca aparecem.
// (Sem as regras complexas de grau-na-data usadas na Loja — o Arco Real tem grau único.)
const SITUACOES_ELEGIVEIS = ['regular', 'licenciado'];

export default function RegistroPresencaArcoReal({ sessaoId, onVoltar, showSuccess, showError }) {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sessao, setSessao] = useState(null);
  const [membrosElegiveis, setMembrosElegiveis] = useState([]);
  const [presencas, setPresencas] = useState({});
  const [justificativas, setJustificativas] = useState({});
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [busca, setBusca] = useState('');

  const [visitantes, setVisitantes] = useState([]);
  const [visitanteForm, setVisitanteForm] = useState({ nome_visitante: '', nome_loja: '', cidade: '', eh_autoridade: false, cargo_autoridade: '' });
  const [visitanteEditandoId, setVisitanteEditandoId] = useState(null);

  useEffect(() => { if (sessaoId) carregarDados(); }, [sessaoId]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const { data: sessaoData, error: sessaoError } = await supabase
        .from('arco_real_sessoes')
        .select('*')
        .eq('id', sessaoId)
        .single();
      if (sessaoError) throw sessaoError;
      setSessao(sessaoData);

      const { data: membrosData, error: membrosError } = await supabase
        .from('arco_real_membros')
        .select('id, nome, cargo, situacao, foto_url')
        .eq('ativo', true)
        .order('nome');
      if (membrosError) throw membrosError;

      const elegiveis = (membrosData || []).filter(m => SITUACOES_ELEGIVEIS.includes(m.situacao));
      setMembrosElegiveis(elegiveis);

      const { data: presencasExistentes, error: presencasError } = await supabase
        .from('arco_real_registros_presenca')
        .select('*')
        .eq('sessao_id', sessaoId);
      if (presencasError) throw presencasError;

      const presencasObj = {};
      const justificativasObj = {};
      (presencasExistentes || []).forEach(p => {
        presencasObj[p.membro_id] = p.presente;
        if (p.justificativa) justificativasObj[p.membro_id] = p.justificativa;
      });
      setPresencas(presencasObj);
      setJustificativas(justificativasObj);

      const { data: visitantesData, error: visitantesError } = await supabase
        .from('arco_real_visitantes_sessao')
        .select('*')
        .eq('sessao_id', sessaoId)
        .order('created_at', { ascending: false });
      if (visitantesError) throw visitantesError;
      setVisitantes(visitantesData || []);
    } catch (err) {
      console.error('Erro ao carregar dados da sessão:', err);
      setMensagem({ tipo: 'erro', texto: 'Erro ao carregar dados da sessão.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePresencaChange = (membroId, presente) => {
    setPresencas(prev => ({ ...prev, [membroId]: presente }));
    if (presente && justificativas[membroId]) {
      const novas = { ...justificativas };
      delete novas[membroId];
      setJustificativas(novas);
    }
  };

  const handleJustificativaChange = (membroId, texto) => {
    setJustificativas(prev => ({ ...prev, [membroId]: texto }));
  };

  const marcarTodosPresentes = () => {
    const todas = {};
    membrosElegiveis.forEach(m => { todas[m.id] = true; });
    setPresencas(todas);
    setJustificativas({});
  };

  const desmarcarTodos = () => {
    setPresencas({});
    setJustificativas({});
  };

  const handleSalvar = async () => {
    setSalvando(true);
    setMensagem({ tipo: '', texto: '' });
    try {
      const registros = membrosElegiveis.map(m => ({
        sessao_id: sessaoId,
        membro_id: m.id,
        presente: presencas[m.id] || false,
        justificativa: (!presencas[m.id] && justificativas[m.id]) ? justificativas[m.id] : null,
      }));

      const { error } = await supabase
        .from('arco_real_registros_presenca')
        .upsert(registros, { onConflict: 'sessao_id,membro_id', ignoreDuplicates: false });
      if (error) throw error;

      setMensagem({ tipo: 'sucesso', texto: 'Presenças salvas com sucesso!' });
      showSuccess?.('Presenças salvas com sucesso!');
      setTimeout(carregarDados, 1200);
    } catch (err) {
      console.error('Erro ao salvar presenças:', err);
      setMensagem({ tipo: 'erro', texto: err.message || 'Erro ao salvar presenças.' });
      showError?.('Erro ao salvar presenças.');
    } finally {
      setSalvando(false);
    }
  };

  const adicionarVisitante = async () => {
    if (!visitanteForm.nome_visitante || !visitanteForm.nome_loja || !visitanteForm.cidade) return;

    const payloadVisitante = {
      nome_visitante: visitanteForm.nome_visitante,
      nome_loja: visitanteForm.nome_loja,
      cidade: visitanteForm.cidade,
      eh_autoridade: visitanteForm.eh_autoridade,
      cargo_autoridade: visitanteForm.eh_autoridade ? (visitanteForm.cargo_autoridade || '').trim() : null,
    };

    if (visitanteEditandoId) {
      const { data, error } = await supabase
        .from('arco_real_visitantes_sessao')
        .update(payloadVisitante)
        .eq('id', visitanteEditandoId)
        .select();

      if (error) {
        console.error('Erro ao atualizar visitante:', error);
        setMensagem({ tipo: 'erro', texto: `❌ Erro ao atualizar visitante: ${error.message || error.details || 'erro desconhecido'}` });
        return;
      }
      if (!data || data.length === 0) {
        setMensagem({ tipo: 'erro', texto: '❌ A edição não foi salva: nenhuma linha foi alterada no banco (provável falta de permissão/RLS na tabela arco_real_visitantes_sessao para UPDATE). Fale com o administrador do sistema.' });
        return;
      }

      carregarDados();
      setVisitanteForm({ nome_visitante: '', nome_loja: '', cidade: '', eh_autoridade: false, cargo_autoridade: '' });
      setVisitanteEditandoId(null);
      setMensagem({ tipo: 'sucesso', texto: '✅ Visitante atualizado com sucesso!' });
      return;
    }

    const { error } = await supabase
      .from('arco_real_visitantes_sessao')
      .insert([{ sessao_id: sessaoId, ...payloadVisitante }]);

    if (error) {
      console.error('Erro ao adicionar visitante:', error);
      setMensagem({ tipo: 'erro', texto: `❌ Erro ao adicionar visitante: ${error.message || error.details || 'erro desconhecido'}` });
      return;
    }

    carregarDados();
    setVisitanteForm({ nome_visitante: '', nome_loja: '', cidade: '', eh_autoridade: false, cargo_autoridade: '' });
  };

  const editarVisitante = (v) => {
    setVisitanteForm({
      nome_visitante: v.nome_visitante,
      nome_loja: v.nome_loja,
      cidade: v.cidade,
      eh_autoridade: v.eh_autoridade || false,
      cargo_autoridade: v.cargo_autoridade || '',
    });
    setVisitanteEditandoId(v.id);
  };

  const cancelarEdicaoVisitante = () => {
    setVisitanteForm({ nome_visitante: '', nome_loja: '', cidade: '', eh_autoridade: false, cargo_autoridade: '' });
    setVisitanteEditandoId(null);
  };

  const excluirVisitante = async (id) => {
    const { data, error } = await supabase
      .from('arco_real_visitantes_sessao')
      .delete()
      .eq('id', id)
      .select();

    if (error) {
      console.error('Erro ao excluir visitante:', error);
      setMensagem({ tipo: 'erro', texto: `❌ Erro ao excluir visitante: ${error.message || error.details || 'erro desconhecido'}` });
      return;
    }
    if (!data || data.length === 0) {
      setMensagem({ tipo: 'erro', texto: '❌ A exclusão não foi aplicada: nenhuma linha foi removida (provável falta de permissão/RLS).' });
      return;
    }

    carregarDados();
    if (visitanteEditandoId === id) {
      setVisitanteForm({ nome_visitante: '', nome_loja: '', cidade: '', eh_autoridade: false, cargo_autoridade: '' });
      setVisitanteEditandoId(null);
    }
  };

  const membrosFiltrados = membrosElegiveis.filter(m =>
    m.nome?.toLowerCase().includes(busca.toLowerCase())
  );

  const totalMembros = membrosElegiveis.length;
  const totalPresentes = Object.values(presencas).filter(p => p === true).length;
  const totalAusentes = totalMembros - totalPresentes;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: '#2d6a9f' }}></div>
          <p style={{ marginTop: '1rem', color: 'var(--color-text-muted)' }}>Carregando dados da sessão...</p>
        </div>
      </div>
    );
  }

  if (!sessao) {
    return (
      <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', textAlign: 'center', margin: '1.5rem' }}>
        <p style={{ color: '#ef4444' }}>Sessão não encontrada.</p>
        <button onClick={onVoltar} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600' }}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '1.5rem', background: 'var(--color-bg)', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* Cabeçalho */}
      <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '1.5rem', border: '1px solid var(--color-border)' }}>
        <div style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fff', margin: 0 }}>Registro de Presença — Arco Real</h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', marginTop: '0.3rem', fontSize: '0.85rem' }}>
              {sessao.classificacao || 'Sessão'} · {new Date(sessao.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
          </div>
          <button onClick={onVoltar} style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600' }}>
            ← Voltar
          </button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-3 gap-4" style={{ padding: '1.25rem 1.5rem', background: 'var(--color-surface)' }}>
          <div style={{ background: 'rgba(45,106,159,0.1)', border: '1px solid rgba(45,106,159,0.3)', borderLeft: '4px solid #2d6a9f', borderRadius: 'var(--radius-lg)', padding: '1rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.82rem', fontWeight: '600', color: '#2d6a9f', marginBottom: '0.25rem' }}>Total de Membros</p>
            <p style={{ fontSize: '1.875rem', fontWeight: '800', color: 'var(--color-text)' }}>{totalMembros}</p>
          </div>
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderLeft: '4px solid #10b981', borderRadius: 'var(--radius-lg)', padding: '1rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.82rem', fontWeight: '600', color: '#10b981', marginBottom: '0.25rem' }}>Presentes</p>
            <p style={{ fontSize: '1.875rem', fontWeight: '800', color: '#10b981' }}>{totalPresentes}</p>
          </div>
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderLeft: '4px solid #ef4444', borderRadius: 'var(--radius-lg)', padding: '1rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.82rem', fontWeight: '600', color: '#ef4444', marginBottom: '0.25rem' }}>Ausentes</p>
            <p style={{ fontSize: '1.875rem', fontWeight: '800', color: '#ef4444' }}>{totalAusentes}</p>
          </div>
        </div>
      </div>

      {/* Mensagens */}
      {mensagem.texto && (
        <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: 'var(--radius-lg)', background: mensagem.tipo === 'sucesso' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: mensagem.tipo === 'sucesso' ? '#10b981' : '#ef4444', border: `1px solid ${mensagem.tipo === 'sucesso' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
          {mensagem.texto}
        </div>
      )}

      {/* Ferramentas */}
      <div className="rounded-lg p-4 mb-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex gap-4 items-center">
          <input
            type="text"
            placeholder="🔍 Buscar membro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ flex: 1, background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 1rem', outline: 'none' }}
          />
          <button onClick={marcarTodosPresentes} style={{ padding: '0.5rem 1rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '700' }}>
            ✓ Marcar Todos Presentes
          </button>
          <button onClick={desmarcarTodos} style={{ padding: '0.5rem 1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600' }}>
            ✗ Desmarcar Todos
          </button>
        </div>
      </div>

      {/* Lista de Membros */}
      <div className="rounded-lg overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y">
            <thead style={{ background: 'var(--color-surface-2)' }}>
              <tr>
                <th style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-2)' }}>Membro</th>
                <th style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-2)' }}>Presença</th>
                <th style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-2)' }}>Justificativa (se ausente)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {membrosFiltrados.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ color: 'var(--color-text)' }}>
                    <div className="flex items-center gap-2">
                      {m.foto_url && (
                        <img src={m.foto_url} alt={m.nome} className="h-10 w-10 rounded-full object-cover" />
                      )}
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text)' }}>{m.nome}</div>
                        {m.cargo && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{m.cargo}</div>
                        )}
                        {m.situacao === 'licenciado' && (
                          <span style={{ display: 'inline-block', marginTop: '0.25rem', padding: '0.1rem 0.5rem', fontSize: '0.7rem', fontWeight: '700', borderRadius: '999px', background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                            Licenciado
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--color-text)' }}>
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={presencas[m.id] || false}
                        onChange={(e) => handlePresencaChange(m.id, e.target.checked)}
                        style={{ width: '1.25rem', height: '1.25rem', accentColor: '#2d6a9f', cursor: 'pointer' }}
                      />
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text)' }}>
                        {presencas[m.id] ? 'Presente' : 'Ausente'}
                      </span>
                    </label>
                  </td>
                  <td style={{ color: 'var(--color-text)' }}>
                    {!presencas[m.id] && (
                      <input
                        type="text"
                        placeholder="Motivo da ausência..."
                        value={justificativas[m.id] || ''}
                        onChange={(e) => handleJustificativaChange(m.id, e.target.value)}
                        style={{ width: '100%', padding: '0.35rem 0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', outline: 'none' }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {membrosFiltrados.length === 0 && (
          <div className="text-center py-8">
            <span style={{ color: 'var(--color-text-muted)' }}>
              {busca ? 'Nenhum membro encontrado com esse nome.' : 'Nenhum membro elegível para esta sessão.'}
            </span>
          </div>
        )}
      </div>

      {/* Seção de Visitantes */}
      <div className="rounded-lg p-6 mt-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text)' }}>👥 Visitantes</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input
            type="text"
            placeholder="Nome do Visitante"
            value={visitanteForm.nome_visitante}
            onChange={(e) => setVisitanteForm({ ...visitanteForm, nome_visitante: e.target.value })}
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', outline: 'none', width: '100%' }}
          />
          <input
            type="text"
            placeholder="Loja / Capítulo"
            value={visitanteForm.nome_loja}
            onChange={(e) => setVisitanteForm({ ...visitanteForm, nome_loja: e.target.value })}
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', outline: 'none', width: '100%' }}
          />
          <input
            type="text"
            placeholder="Cidade"
            value={visitanteForm.cidade}
            onChange={(e) => setVisitanteForm({ ...visitanteForm, cidade: e.target.value })}
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', outline: 'none', width: '100%' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={adicionarVisitante}
              style={{ flex: 1, padding: '0.5rem 1rem', background: visitanteEditandoId ? '#10b981' : 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600' }}
            >
              {visitanteEditandoId ? '💾 Salvar' : '➕ Adicionar'}
            </button>
            {visitanteEditandoId && (
              <button
                onClick={cancelarEdicaoVisitante}
                style={{ padding: '0.5rem 1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600' }}
              >
                ✖️
              </button>
            )}
          </div>
        </div>

        <div className="mb-4" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text)' }}>
            <input
              type="checkbox"
              checked={visitanteForm.eh_autoridade}
              onChange={(e) => setVisitanteForm({ ...visitanteForm, eh_autoridade: e.target.checked, cargo_autoridade: e.target.checked ? visitanteForm.cargo_autoridade : '' })}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            🎖️ É autoridade (Grão-Mestre, corpo administrativo, etc.)
          </label>
          {visitanteForm.eh_autoridade && (
            <input
              type="text"
              placeholder="Cargo (ex: Sereníssimo Grão-Mestre)"
              value={visitanteForm.cargo_autoridade}
              onChange={(e) => setVisitanteForm({ ...visitanteForm, cargo_autoridade: e.target.value })}
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid #c9a84c', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', outline: 'none', width: '100%', maxWidth: '420px' }}
            />
          )}
        </div>

        {visitantes.length > 0 ? (
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--color-surface-2)' }}>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-2)' }}>Nome</th>
                <th style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-2)' }}>Loja/Capítulo</th>
                <th style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-2)' }}>Cidade</th>
                <th style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-2)' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visitantes.map((v) => (
                <tr key={v.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.1s', background: visitanteEditandoId === v.id ? 'var(--color-accent-bg)' : 'transparent' }}>
                  <td style={{ color: 'var(--color-text)' }}>
                    {v.eh_autoridade && (
                      <span title={v.cargo_autoridade || 'Autoridade'} style={{ marginRight: '0.35rem' }}>🎖️</span>
                    )}
                    {v.nome_visitante}
                  </td>
                  <td style={{ color: 'var(--color-text)' }}>{v.nome_loja}</td>
                  <td style={{ color: 'var(--color-text)' }}>{v.cidade}</td>
                  <td style={{ color: 'var(--color-text)' }}>
                    <button
                      onClick={() => editarVisitante(v)}
                      style={{ color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', marginRight: '0.5rem' }}
                      title="Editar visitante"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => excluirVisitante(v.id)}
                      style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                      title="Excluir visitante"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: '0.875rem', textAlign: 'center', padding: '0.75rem', color: 'var(--color-text-muted)' }}>Nenhum visitante registrado</p>
        )}
      </div>

      {/* Botão Salvar */}
      <div className="mt-6 flex justify-end gap-4">
        <button onClick={onVoltar} style={{ padding: '0.75rem 1.5rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600' }}>
          Cancelar
        </button>
        <button
          onClick={handleSalvar}
          disabled={salvando}
          style={{ padding: '0.75rem 1.5rem', background: salvando ? 'var(--color-surface-3)' : 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: '700', opacity: salvando ? 0.6 : 1 }}
        >
          {salvando ? 'Salvando...' : 'Salvar Presenças'}
        </button>
      </div>
    </div>
  );
}
