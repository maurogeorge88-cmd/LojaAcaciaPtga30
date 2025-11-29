import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function ConfigurarMensalidades({ showSuccess, showError }) {
  const [irmaos, setIrmaos] = useState([]);
  const [configuracoes, setConfiguracoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [formConfig, setFormConfig] = useState({
    irmao_id: '',
    periodicidade: 'mensal',
    valor_mensalidade: '',
    data_inicio: new Date().toISOString().split('T')[0],
    ativo: true,
    observacoes: ''
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Carregar irmãos ativos
      const { data: irmaoData, error: irmaoError } = await supabase
        .from('irmaos')
        .select('id, nome, situacao')
        .eq('situacao', 'Ativo')
        .order('nome');

      if (irmaoError) throw irmaoError;
      setIrmaos(irmaoData || []);

      // Carregar configurações
      const { data: configData, error: configError } = await supabase
        .from('configuracao_pagamento_irmaos')
        .select(`
          *,
          irmaos(nome, situacao)
        `)
        .order('created_at', { ascending: false });

      if (configError) throw configError;
      setConfiguracoes(configData || []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showError('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editando) {
        // Atualizar
        const { error } = await supabase
          .from('configuracao_pagamento_irmaos')
          .update({
            periodicidade: formConfig.periodicidade,
            valor_mensalidade: parseFloat(formConfig.valor_mensalidade),
            data_inicio: formConfig.data_inicio,
            ativo: formConfig.ativo,
            observacoes: formConfig.observacoes || null
          })
          .eq('id', editando);

        if (error) throw error;
        showSuccess('Configuração atualizada com sucesso!');
      } else {
        // Criar
        const { error } = await supabase
          .from('configuracao_pagamento_irmaos')
          .insert({
            irmao_id: parseInt(formConfig.irmao_id),
            periodicidade: formConfig.periodicidade,
            valor_mensalidade: parseFloat(formConfig.valor_mensalidade),
            data_inicio: formConfig.data_inicio,
            ativo: formConfig.ativo,
            observacoes: formConfig.observacoes || null
          });

        if (error) throw error;
        showSuccess('Configuração criada com sucesso!');
      }

      limparForm();
      await carregarDados();

    } catch (error) {
      console.error('Erro ao salvar:', error);
      showError('Erro ao salvar: ' + error.message);
    }
  };

  const editarConfig = (config) => {
    setFormConfig({
      irmao_id: config.irmao_id?.toString() || '',
      periodicidade: config.periodicidade || 'mensal',
      valor_mensalidade: config.valor_mensalidade?.toString() || '',
      data_inicio: config.data_inicio || '',
      ativo: config.ativo !== false,
      observacoes: config.observacoes || ''
    });
    setEditando(config.id);
    setMostrarForm(true);
  };

  const toggleAtivo = async (id, ativoAtual) => {
    try {
      const { error } = await supabase
        .from('configuracao_pagamento_irmaos')
        .update({ ativo: !ativoAtual })
        .eq('id', id);

      if (error) throw error;

      showSuccess(ativoAtual ? 'Configuração desativada!' : 'Configuração ativada!');
      await carregarDados();

    } catch (error) {
      console.error('Erro ao alterar status:', error);
      showError('Erro ao alterar status: ' + error.message);
    }
  };

  const excluirConfig = async (id) => {
    if (!confirm('Confirma a exclusão desta configuração?')) return;

    try {
      const { error } = await supabase
        .from('configuracao_pagamento_irmaos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('Configuração excluída com sucesso!');
      await carregarDados();

    } catch (error) {
      console.error('Erro ao excluir:', error);
      showError('Erro ao excluir: ' + error.message);
    }
  };

  const limparForm = () => {
    setFormConfig({
      irmao_id: '',
      periodicidade: 'mensal',
      valor_mensalidade: '',
      data_inicio: new Date().toISOString().split('T')[0],
      ativo: true,
      observacoes: ''
    });
    setEditando(null);
    setMostrarForm(false);
  };

  // Irmãos que já têm configuração
  const irmaosComConfig = configuracoes.map(c => c.irmao_id);
  const irmaosDisponiveis = irmaos.filter(i => !irmaosComConfig.includes(i.id));

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl text-gray-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">⚙️ Configurar Mensalidades</h2>
        <p className="text-purple-100">Configure valores e periodicidade das mensalidades dos irmãos</p>
      </div>

      {/* BOTÃO NOVA CONFIGURAÇÃO */}
      <div className="bg-white rounded-lg shadow p-4">
        <button
          onClick={() => setMostrarForm(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
        >
          ➕ Nova Configuração
        </button>
      </div>

      {/* FORMULÁRIO */}
      {mostrarForm && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {editando ? '✏️ Editar Configuração' : '➕ Nova Configuração'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!editando && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Irmão *</label>
                  <select
                    value={formConfig.irmao_id}
                    onChange={(e) => setFormConfig({ ...formConfig, irmao_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Selecione um irmão</option>
                    {irmaosDisponiveis.map(irmao => (
                      <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Periodicidade *</label>
                <select
                  value={formConfig.periodicidade}
                  onChange={(e) => setFormConfig({ ...formConfig, periodicidade: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="mensal">📅 Mensal</option>
                  <option value="trimestral">📅 Trimestral</option>
                  <option value="semestral">📅 Semestral</option>
                  <option value="anual">📅 Anual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor da Mensalidade *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formConfig.valor_mensalidade}
                  onChange={(e) => setFormConfig({ ...formConfig, valor_mensalidade: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Início</label>
                <input
                  type="date"
                  value={formConfig.data_inicio}
                  onChange={(e) => setFormConfig({ ...formConfig, data_inicio: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formConfig.ativo}
                    onChange={(e) => setFormConfig({ ...formConfig, ativo: e.target.checked })}
                    className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">Ativo</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea
                value={formConfig.observacoes}
                onChange={(e) => setFormConfig({ ...formConfig, observacoes: e.target.value })}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Informações adicionais (opcional)"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
              >
                {editando ? '💾 Salvar Alterações' : '➕ Criar Configuração'}
              </button>
              <button
                type="button"
                onClick={limparForm}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LISTA DE CONFIGURAÇÕES */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Configurações Cadastradas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Irmão</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodicidade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {configuracoes.map((config) => (
                <tr key={config.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{config.irmaos?.nome}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 capitalize">{config.periodicidade}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      R$ {parseFloat(config.valor_mensalidade).toFixed(2)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleAtivo(config.id, config.ativo)}
                      className={`px-2 py-1 text-xs font-medium rounded-full cursor-pointer ${
                        config.ativo
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {config.ativo ? '✅ Ativo' : '⏸️ Inativo'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => editarConfig(config)}
                      className="text-purple-600 hover:text-purple-900 mr-3"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => excluirConfig(config.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      🗑️ Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {configuracoes.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Nenhuma configuração cadastrada
            </div>
          )}
        </div>
      </div>

      {/* IRMÃOS SEM CONFIGURAÇÃO */}
      {irmaosDisponiveis.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-yellow-800 mb-2">
            ⚠️ Irmãos sem configuração de mensalidade ({irmaosDisponiveis.length})
          </h4>
          <div className="text-sm text-yellow-700 space-y-1">
            {irmaosDisponiveis.map(irmao => (
              <div key={irmao.id}>• {irmao.nome}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
