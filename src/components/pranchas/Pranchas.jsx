import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarData } from '../../utils/formatters';

const Pranchas = ({ pranchas, onUpdate, showSuccess, showError, permissoes }) => {
  // Estados do formulário
  const [pranchaForm, setPranchaForm] = useState({
    numero_prancha: '',
    data_prancha: '',
    assunto: '',
    destinatario: ''
  });

  // Estados de controle
  const [modoEdicao, setModoEdicao] = useState(false);
  const [pranchaEditando, setPranchaEditando] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pranchaVisualizando, setPranchaVisualizando] = useState(null);
  const [modalVisualizar, setModalVisualizar] = useState(false);

  // Função para tratar datas vazias
  const tratarData = (data) => {
    if (!data || data === '' || data === 'undefined' || data === 'null') {
      return null;
    }
    return data;
  };

  // Limpar formulário
  const limparFormulario = () => {
    setPranchaForm({
      numero_prancha: '',
      data_prancha: '',
      assunto: '',
      destinatario: ''
    });
    setModoEdicao(false);
    setPranchaEditando(null);
  };

  // Cadastrar prancha
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dadosPrancha = {
        numero_prancha: pranchaForm.numero_prancha,
        data_prancha: tratarData(pranchaForm.data_prancha),
        assunto: pranchaForm.assunto,
        destinatario: pranchaForm.destinatario
      };

      const { error } = await supabase
        .from('pranchas_expedidas')
        .insert([dadosPrancha]);

      if (error) throw error;

      showSuccess('Prancha cadastrada com sucesso!');
      limparFormulario();
      onUpdate();

    } catch (err) {
      showError('Erro ao cadastrar prancha: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar prancha
  const handleAtualizar = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dadosPrancha = {
        numero_prancha: pranchaForm.numero_prancha,
        data_prancha: tratarData(pranchaForm.data_prancha),
        assunto: pranchaForm.assunto,
        destinatario: pranchaForm.destinatario
      };

      const { error } = await supabase
        .from('pranchas_expedidas')
        .update(dadosPrancha)
        .eq('id', pranchaEditando.id);

      if (error) throw error;

      showSuccess('Prancha atualizada com sucesso!');
      limparFormulario();
      onUpdate();

    } catch (err) {
      showError('Erro ao atualizar prancha: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Editar prancha
  const handleEditar = (prancha) => {
    setModoEdicao(true);
    setPranchaEditando(prancha);
    setPranchaForm({
      numero_prancha: prancha.numero_prancha,
      data_prancha: prancha.data_prancha,
      assunto: prancha.assunto,
      destinatario: prancha.destinatario
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Visualizar prancha completa
  const handleVisualizar = (prancha) => {
    setPranchaVisualizando(prancha);
    setModalVisualizar(true);
  };

  // Excluir prancha
  const handleExcluir = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta prancha?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('pranchas_expedidas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('Prancha excluída com sucesso!');
      onUpdate();

    } catch (err) {
      showError('Erro ao excluir prancha: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar pranchas por busca
  const pranchasFiltradas = pranchas.filter(p => 
    !searchTerm || 
    p.numero_prancha?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.assunto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.destinatario?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      {/* FORMULÁRIO DE CADASTRO - Só aparece para quem pode editar */}
      {(permissoes?.canEdit || permissoes?.canEditMembers) && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="text-xl font-bold text-blue-900 mb-4">
            {modoEdicao ? '✏️ Editar Prancha' : '➕ Registrar Nova Prancha'}
          </h3>

        <form onSubmit={modoEdicao ? handleAtualizar : handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Número da Prancha *</label>
              <input
                type="text"
                value={pranchaForm.numero_prancha}
                onChange={(e) => setPranchaForm({ ...pranchaForm, numero_prancha: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ex: 001/2024"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Data da Prancha *</label>
              <input
                type="date"
                value={pranchaForm.data_prancha}
                onChange={(e) => setPranchaForm({ ...pranchaForm, data_prancha: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Destinatário *</label>
              <input
                type="text"
                value={pranchaForm.destinatario}
                onChange={(e) => setPranchaForm({ ...pranchaForm, destinatario: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ex: Grande Oriente de Mato Grosso"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assunto *</label>
              <input
                type="text"
                value={pranchaForm.assunto}
                onChange={(e) => setPranchaForm({ ...pranchaForm, assunto: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ex: Solicitação de Regularização"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-6">
            {modoEdicao && (
              <button
                type="button"
                onClick={limparFormulario}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:bg-gray-400"
            >
              {loading ? 'Salvando...' : modoEdicao ? '💾 Atualizar Prancha' : '💾 Registrar Prancha'}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* BUSCA */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="🔍 Buscar por número, assunto ou destinatário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* LISTA DE PRANCHAS */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <h3 className="text-xl font-bold">Pranchas Registradas</h3>
          <p className="text-sm text-blue-100">
            Total: {pranchasFiltradas.length} prancha(s)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-100 border-b-2 border-blue-600">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-700 w-32">Número</th>
                <th className="px-4 py-3 text-left font-bold text-gray-700 w-32">Data</th>
                <th className="px-4 py-3 text-left font-bold text-gray-700 w-48">Destinatário</th>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Assunto</th>
                <th className="px-4 py-3 text-center font-bold text-gray-700 w-80">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pranchasFiltradas.length > 0 ? (
                pranchasFiltradas
                  .sort((a, b) => new Date(b.data_prancha) - new Date(a.data_prancha))
                  .map((prancha) => (
                    <tr key={prancha.id} className="hover:bg-blue-50 transition">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-blue-900 whitespace-nowrap">{prancha.numero_prancha}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatarData(prancha.data_prancha)}</td>
                      <td className="px-4 py-3 text-gray-700">{prancha.destinatario}</td>
                      <td className="px-4 py-3 text-gray-700">{prancha.assunto}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2 flex-nowrap">
                          <button
                            onClick={() => handleVisualizar(prancha)}
                            className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-semibold whitespace-nowrap"
                            title="Visualizar detalhes"
                          >
                            👁️ Ver
                          </button>
                          {(permissoes?.canEdit || permissoes?.canEditMembers) && (
                            <>
                              <button
                                onClick={() => handleEditar(prancha)}
                                className="px-3 py-1 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition text-sm font-semibold whitespace-nowrap"
                              >
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => handleExcluir(prancha.id)}
                                className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-semibold whitespace-nowrap"
                              >
                                🗑️ Excluir
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                    {searchTerm ? 'Nenhuma prancha encontrada com os critérios de busca' : 'Nenhuma prancha cadastrada'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE VISUALIZAÇÃO */}
      {modalVisualizar && pranchaVisualizando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-xl">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold">
                  📄 Prancha Nº {pranchaVisualizando.numero_prancha}
                </h3>
                <button
                  onClick={() => setModalVisualizar(false)}
                  className="text-white hover:text-gray-200 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Informações da Prancha */}
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <label className="block text-sm font-semibold text-blue-900 mb-2">Número da Prancha</label>
                  <p className="text-lg font-medium text-gray-900">{pranchaVisualizando.numero_prancha}</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <label className="block text-sm font-semibold text-blue-900 mb-2">Data</label>
                  <p className="text-lg font-medium text-gray-900">{formatarData(pranchaVisualizando.data_prancha)}</p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <label className="block text-sm font-semibold text-green-900 mb-2">👤 Destinatário</label>
                  <p className="text-lg font-medium text-gray-900">{pranchaVisualizando.destinatario}</p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <label className="block text-sm font-semibold text-yellow-900 mb-2">📋 Assunto</label>
                  <p className="text-lg text-gray-900">{pranchaVisualizando.assunto}</p>
                </div>
              </div>

              {/* Botão Fechar */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => setModalVisualizar(false)}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pranchas;
