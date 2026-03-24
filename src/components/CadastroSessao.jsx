import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const CadastroSessao = ({ onSuccess, onClose }) => {
  const [dataSessao, setDataSessao] = useState('');
  const [grauSessao, setGrauSessao] = useState(1);
  const [classificacaoSessaoId, setClassificacaoSessaoId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [graus, setGraus] = useState([]);
  const [classificacoesSessao, setClassificacoesSessao] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [sessoes, setSessoes] = useState([]);
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    carregarGraus();
    carregarClassificacoesSessao();
    carregarSessoes();
  }, []);

  const carregarGraus = async () => {
    try {
      const { data, error } = await supabase
        .from('graus_sessao')
        .select('*')
        .order('grau_minimo_requerido');

      if (error) throw error;
      setGraus(data || []);
      
      // Definir primeiro grau como padrão
      if (data && data.length > 0) {
        setGrauSessao(data[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar graus:', error);
    }
  };

  const carregarClassificacoesSessao = async () => {
    try {
      const { data, error } = await supabase
        .from('classificacoes_sessao')
        .select('*')
        .order('nome');

      if (error) throw error;
      setClassificacoesSessao(data || []);
    } catch (error) {
      console.error('Erro ao carregar classificações de sessão:', error);
    }
  };

  const carregarSessoes = async () => {
    try {
      const { data, error } = await supabase
        .from('sessoes_presenca')
        .select('*, graus_sessao:grau_sessao_id(nome), classificacoes_sessao:classificacao_id(nome)')
        .order('data_sessao', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSessoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
    }
  };

  const editarSessao = (sessao) => {
    setDataSessao(sessao.data_sessao);
    setGrauSessao(sessao.grau_sessao_id);
    setClassificacaoSessaoId(sessao.classificacao_id || '');
    setObservacoes(sessao.observacoes || '');
    setEditando(sessao.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const excluirSessao = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta sessão?')) return;

    try {
      const { error } = await supabase
        .from('sessoes_presenca')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMensagem({ tipo: 'sucesso', texto: 'Sessão excluída com sucesso!' });
      carregarSessoes();
    } catch (error) {
      console.error('Erro ao excluir sessão:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao excluir sessão' });
    }
  };

  const cancelarEdicao = () => {
    setDataSessao('');
    setGrauSessao(graus[0]?.id || 1);
    setClassificacaoSessaoId('');
    setObservacoes('');
    setEditando(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!dataSessao) {
      setMensagem({ tipo: 'erro', texto: 'Por favor, informe a data da sessão' });
      return;
    }

    setLoading(true);
    setMensagem({ tipo: '', texto: '' });

    try {
      console.log('📝 Salvando sessão...', { dataSessao, grauSessao, classificacaoSessaoId, observacoes });

      if (editando) {
        // Atualizar sessão existente
        const { error } = await supabase
          .from('sessoes_presenca')
          .update({
            data_sessao: dataSessao,
            grau_sessao_id: grauSessao,
            classificacao_id: classificacaoSessaoId || null,
            observacoes: observacoes || null
          })
          .eq('id', editando);

        if (error) throw error;
      } else {
        // Inserir nova sessão
        const { error } = await supabase
          .from('sessoes_presenca')
          .insert([{
            data_sessao: dataSessao,
            grau_sessao_id: grauSessao,
            classificacao_id: classificacaoSessaoId || null,
            observacoes: observacoes || null
          }]);

        if (error) throw error;
      }

      console.log('✅ Sessão salva');

      setMensagem({ 
        tipo: 'sucesso', 
        texto: editando ? 'Sessão atualizada com sucesso!' : 'Sessão cadastrada com sucesso!' 
      });

      // Limpar formulário
      setDataSessao('');
      setGrauSessao(graus[0]?.id || 1);
      setClassificacaoSessaoId('');
      setObservacoes('');
      setEditando(null);

      // Recarregar lista
      carregarSessoes();

      // Chamar callback de sucesso
      if (onSuccess) {
        setTimeout(() => onSuccess(), 1000);
      }

    } catch (error) {
      console.error('💥 Erro ao cadastrar sessão:', error);
      setMensagem({ 
        tipo: 'erro', 
        texto: error.message || 'Erro ao cadastrar sessão. Tente novamente.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div className="card" style={{ maxWidth: '42rem', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--color-text)' }}>
          📋 Cadastrar Nova Sessão
        </h2>

      {mensagem.texto && (
        <div style={{
          marginBottom: '1rem',
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          background: mensagem.tipo === 'sucesso' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
          color: mensagem.tipo === 'sucesso' ? 'var(--color-success)' : 'var(--color-danger)'
        }}>
          {mensagem.texto}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Data da Sessão */}
        <div>
          <label className="form-label">
            Data da Sessão *
          </label>
          <input
            type="date"
            value={dataSessao}
            onChange={(e) => setDataSessao(e.target.value)}
            className="form-input"
            required
          />
        </div>

        {/* Grau da Sessão */}
        <div>
          <label className="form-label">
            Grau da Sessão *
          </label>
          <select
            value={grauSessao}
            onChange={(e) => setGrauSessao(parseInt(e.target.value))}
            className="form-input"
            required
          >
            {graus.map(grau => (
              <option key={grau.id} value={grau.id}>
                {grau.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Classificação da Sessão */}
        <div>
          <label className="form-label">
            Classificação da Sessão
          </label>
          <select
            value={classificacaoSessaoId}
            onChange={(e) => setClassificacaoSessaoId(e.target.value)}
            className="form-input"
          >
            <option value="">Selecione a classificação</option>
            {classificacoesSessao.map(classificacao => (
              <option key={classificacao.id} value={classificacao.id}>
                {classificacao.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Observação */}
        <div>
          <label className="form-label">
            Observações
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            placeholder="Digite observações sobre a sessão (opcional)"
            className="form-input"
          />
        </div>

        {/* Botões */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            style={{
              flex: 1,
              background: loading ? 'var(--color-surface-3)' : 'var(--color-accent)',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-lg)',
              border: 'none',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { if (!loading) e.target.style.background = 'var(--color-accent-hover)'; }}
            onMouseLeave={(e) => { if (!loading) e.target.style.background = 'var(--color-accent)'; }}
          >
            {loading ? 'Salvando...' : editando ? '✏️ Atualizar Sessão' : '✅ Cadastrar Sessão'}
          </button>

          {editando && (
            <button
              type="button"
              onClick={cancelarEdicao}
              style={{
                flex: 1,
                background: 'var(--color-warning)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.opacity = '0.9'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              🔙 Cancelar Edição
            </button>
          )}

          {onClose && !editando && (
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                background: 'var(--color-surface-3)',
                color: 'var(--color-text)',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--color-surface-2)'}
              onMouseLeave={(e) => e.target.style.background = 'var(--color-surface-3)'}
            >
              ❌ Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Lista de Sessões Cadastradas */}
      {sessoes.length > 0 && (
        <div className="mt-8">
          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--color-text)', marginBottom: '1rem' }}>
            📋 Últimas Sessões Cadastradas
          </h3>
          <div className="overflow-x-auto">
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <table className="w-full">
                <thead style={{ background: 'var(--color-surface-2)' }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Data</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Grau</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Classificação</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Ações</th>
                  </tr>
                </thead>
                <tbody style={{ borderTop: '1px solid var(--color-border)' }}>
                {sessoes.map((sessao) => (
                  <tr 
                    key={sessao.id} 
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--color-text)' }}>
                      {new Date(sessao.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', background: '#dbeafe', color: '#1e40af', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
                        {sessao.graus_sessao?.nome}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        background: sessao.classificacoes_sessao?.nome ? '#f3e8ff' : 'var(--color-surface-2)',
                        color: sessao.classificacoes_sessao?.nome ? '#6b21a8' : 'var(--color-text-muted)'
                      }}>
                        {sessao.classificacoes_sessao?.nome || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => editarSessao(sessao)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => excluirSessao(sessao.id)}
                          className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                        >
                          🗑️ Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--color-info-bg)', borderRadius: 'var(--radius-lg)' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-info)' }}>
          <strong>💡 Dica:</strong> Após cadastrar a sessão, você poderá lançar as presenças dos irmãos na tela de Sessões Realizadas.
        </p>
      </div>
      </div>
    </div>
  );
};

export default CadastroSessao;
