import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function GestaoSituacoes({ irmaId }) {
  const [situacoes, setSituacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  // Form state
  const [form, setForm] = useState({
    tipo_situacao: 'licenca',
    data_inicio: '',
    data_fim: '',
    motivo: '',
    destino_transferencia: '',
    documento: '',
    observacoes: ''
  });

  useEffect(() => {
    if (irmaId) {
      carregar();
    }
  }, [irmaId]);

  const carregar = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('historico_situacoes')
        .select('*')
        .eq('membro_id', irmaId)
        .order('data_inicio', { ascending: false });

      if (error) throw error;
      setSituacoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar situações:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao carregar situações' });
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (situacao = null) => {
    if (situacao) {
      setEditando(situacao.id);
      setForm({
        tipo_situacao: situacao.tipo_situacao,
        data_inicio: situacao.data_inicio,
        data_fim: situacao.data_fim || '',
        motivo: situacao.motivo || '',
        destino_transferencia: situacao.destino_transferencia || '',
        documento: situacao.documento || '',
        observacoes: situacao.observacoes || ''
      });
    } else {
      setEditando(null);
      setForm({
        tipo_situacao: 'licenca',
        data_inicio: '',
        data_fim: '',
        motivo: '',
        destino_transferencia: '',
        documento: '',
        observacoes: ''
      });
    }
    setMostrarModal(true);
  };

  const fecharModal = () => {
    setMostrarModal(false);
    setEditando(null);
    setForm({
      tipo_situacao: 'licenca',
      data_inicio: '',
      data_fim: '',
      motivo: '',
      destino_transferencia: '',
      documento: '',
      observacoes: ''
    });
  };

  const salvar = async () => {
    try {
      if (!form.data_inicio) {
        setMensagem({ tipo: 'erro', texto: 'Data de início é obrigatória' });
        return;
      }

      const dados = {
        membro_id: irmaId,
        tipo_situacao: form.tipo_situacao,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null,
        motivo: form.motivo,
        destino_transferencia: form.tipo_situacao === 'desligado' ? form.destino_transferencia : null,
        documento: form.documento,
        observacoes: form.observacoes,
        status: 'ativa'
      };

      let error;
      if (editando) {
        ({ error } = await supabase
          .from('historico_situacoes')
          .update(dados)
          .eq('id', editando));
      } else {
        ({ error } = await supabase
          .from('historico_situacoes')
          .insert([dados]));
      }

      if (error) throw error;

      setMensagem({ 
        tipo: 'sucesso', 
        texto: editando ? 'Situação atualizada com sucesso!' : 'Situação criada com sucesso!' 
      });
      
      fecharModal();
      carregar();
      
      setTimeout(() => setMensagem({ tipo: '', texto: '' }), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar situação' });
    }
  };

  const encerrar = async (situacaoId) => {
    if (!window.confirm('Deseja encerrar esta situação hoje?')) return;

    try {
      const hoje = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('historico_situacoes')
        .update({ 
          data_fim: hoje,
          status: 'vencida'
        })
        .eq('id', situacaoId);

      if (error) throw error;

      setMensagem({ tipo: 'sucesso', texto: 'Situação encerrada!' });
      carregar();
      setTimeout(() => setMensagem({ tipo: '', texto: '' }), 3000);
    } catch (error) {
      console.error('Erro ao encerrar:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao encerrar situação' });
    }
  };

  const cancelar = async (situacaoId) => {
    if (!window.confirm('Deseja cancelar esta situação?')) return;

    try {
      const { error } = await supabase
        .from('historico_situacoes')
        .update({ status: 'cancelada' })
        .eq('id', situacaoId);

      if (error) throw error;

      setMensagem({ tipo: 'sucesso', texto: 'Situação cancelada!' });
      carregar();
      setTimeout(() => setMensagem({ tipo: '', texto: '' }), 3000);
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao cancelar situação' });
    }
  };

  const formatarData = (data) => {
    if (!data) return '-';
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const getTipoLabel = (tipo) => {
    const labels = {
      'licenca': 'Licença',
      'desligado': 'Desligado',
      'ex_oficio': 'Ex-Ofício',
      'suspenso': 'Suspenso',
      'irregular': 'Irregular'
    };
    return labels[tipo] || tipo;
  };

  const getStatusIcon = (situacao) => {
    const hoje = new Date();
    const inicio = new Date(situacao.data_inicio + 'T00:00:00');
    const fim = situacao.data_fim ? new Date(situacao.data_fim + 'T00:00:00') : null;

    if (situacao.status === 'cancelada') return '🚫';
    if (situacao.status === 'vencida') return '⚪';
    if (hoje < inicio) return '🔵'; // Futura
    if (!fim || hoje <= fim) return '🟢'; // Ativa
    return '⚪'; // Vencida
  };

  const getStatusTexto = (situacao) => {
    const hoje = new Date();
    const inicio = new Date(situacao.data_inicio + 'T00:00:00');
    const fim = situacao.data_fim ? new Date(situacao.data_fim + 'T00:00:00') : null;

    if (situacao.status === 'cancelada') return 'CANCELADA';
    if (situacao.status === 'vencida') return 'VENCIDA';
    if (hoje < inicio) return 'AGENDADA';
    if (!fim || hoje <= fim) return 'ATIVA';
    return 'VENCIDA';
  };

  if (loading) {
    return <div className="p-4 text-center">Carregando situações...</div>;
  }

  return (
    <div className="rounded-lg p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>Histórico de Situações</h3>
        <button
          type="button"
          onClick={() => abrirModal()}
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-600 transition-colors"
        >
          + Nova Situação
        </button>
      </div>

      {/* Mensagem */}
      {mensagem.texto && (
        <div className={`mb-4 p-3 rounded ${
          mensagem.tipo === 'sucesso' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {mensagem.texto}
        </div>
      )}

      {/* Lista de Situações */}
      {situacoes.length === 0 ? (
        <p className="text-center py-8">Nenhuma situação registrada</p>
      ) : (
        <div className="space-y-3">
          {situacoes.map(sit => (
            <div 
              key={sit.id} 
              className={`border rounded-lg p-4 ${
                sit.status === 'cancelada' ? ' opacity-60' : 
                getStatusTexto(sit) === 'ATIVA' ? 'bg-green-50 border-green-300' : 
                ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getStatusIcon(sit)}</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                      getStatusTexto(sit) === 'ATIVA' ? 'bg-green-200 text-green-800' :
                      getStatusTexto(sit) === 'AGENDADA' ? 'bg-blue-200 text-blue-800' :
                      ' '
                    }`}>
                      {getStatusTexto(sit)}
                    </span>
                    <span className="font-semibold text-lg">{getTipoLabel(sit.tipo_situacao)}</span>
                  </div>
                  
                  <div className="text-sm space-y-1">
                    <div>
                      <strong>Período:</strong> {formatarData(sit.data_inicio)} 
                      {sit.data_fim ? ` → ${formatarData(sit.data_fim)}` : ' → Indefinido'}
                    </div>
                    {sit.motivo && (
                      <div><strong>Motivo:</strong> {sit.motivo}</div>
                    )}
                    {sit.destino_transferencia && (
                      <div><strong>Destino:</strong> {sit.destino_transferencia}</div>
                    )}
                    {sit.documento && (
                      <div><strong>Documento:</strong> {sit.documento}</div>
                    )}
                    {sit.observacoes && (
                      <div><strong>Obs:</strong> {sit.observacoes}</div>
                    )}
                  </div>
                </div>

                {/* Ações */}
                {sit.status !== 'cancelada' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => abrirModal(sit)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Editar
                    </button>
                    {sit.status === 'ativa' && sit.data_fim === null && getStatusTexto(sit) === 'ATIVA' && (
                      <button
                        type="button"
                        onClick={() => encerrar(sit.id)}
                        className="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                      >
                        Encerrar
                      </button>
                    )}
                    {sit.status === 'ativa' && (
                      <button
                        type="button"
                        onClick={() => cancelar(sit.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="bg-primary-600 text-white p-4 flex justify-between items-center">
              <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>
                {editando ? 'Editar Situação' : 'Nova Situação'}
              </h3>
              <button onClick={fecharModal} className="text-white hover:text-gray-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Tipo de Situação *
                </label>
                <select
                  value={form.tipo_situacao}
                  onChange={(e) => setForm({ ...form, tipo_situacao: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                >
                  <option value="licenca">Licença</option>
                  <option value="desligado">Desligado (Transferência)</option>
                  <option value="ex_oficio">Ex-Ofício</option>
                  <option value="suspenso">Suspenso</option>
                  <option value="irregular">Irregular</option>
                </select>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Data de Início *
                  </label>
                  <input
                    type="date"
                    value={form.data_inicio}
                    onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Data de Fim
                    <span className="text-xs ml-2">(vazio = indefinido)</span>
                  </label>
                  <input
                    type="date"
                    value={form.data_fim}
                    onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  />
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Motivo
                </label>
                <textarea
                  value={form.motivo}
                  onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded focus:outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  placeholder="Ex: Problemas de saúde, viagem, questões pessoais..."
                />
              </div>

              {/* Destino (apenas para desligados) */}
              {form.tipo_situacao === 'desligado' && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Destino da Transferência
                  </label>
                  <input
                    type="text"
                    value={form.destino_transferencia}
                    onChange={(e) => setForm({ ...form, destino_transferencia: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    placeholder="Ex: ARLS Estrela do Sul nº 45"
                  />
                </div>
              )}

              {/* Documento */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Documento de Referência
                </label>
                <input
                  type="text"
                  value={form.documento}
                  onChange={(e) => setForm({ ...form, documento: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  placeholder="Ex: Ata nº 123/2025, Ofício 45/2025"
                />
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Observações
                </label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded focus:outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                />
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={salvar}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-600 transition-colors"
                >
                  {editando ? 'Atualizar' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={fecharModal}
                  className="px-4 py-2 bg-gray-300 rounded transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
