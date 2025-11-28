import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function GerenciarGraus({ showSuccess, showError }) {
  const [graus, setGraus] = useState([]);
  const [ritos, setRitos] = useState([]);
  const [filtroRito, setFiltroRito] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [grauEditando, setGrauEditando] = useState(null);
  
  const [grauForm, setGrauForm] = useState({
    rito: '',
    numero_grau: '',
    nome_grau: '',
    descricao: '',
    imagem_url: '',
    cor_representativa: '#6366f1',
    ordem_exibicao: '',
    ativo: true
  });

  useEffect(() => {
    carregarGraus();
  }, []);

  const carregarGraus = async () => {
    const { data } = await supabase
      .from('graus_maconicos')
      .select('*')
      .order('rito')
      .order('numero_grau');
    
    if (data) {
      setGraus(data);
      const ritosUnicos = [...new Set(data.map(g => g.rito))];
      setRitos(ritosUnicos);
    }
  };

  const limparFormulario = () => {
    setGrauForm({
      rito: '',
      numero_grau: '',
      nome_grau: '',
      descricao: '',
      imagem_url: '',
      cor_representativa: '#6366f1',
      ordem_exibicao: '',
      ativo: true
    });
    setGrauEditando(null);
    setMostrarFormulario(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!grauForm.rito || !grauForm.numero_grau || !grauForm.nome_grau) {
      showError('Preencha os campos obrigatórios');
      return;
    }

    const dados = {
      ...grauForm,
      numero_grau: parseInt(grauForm.numero_grau),
      ordem_exibicao: grauForm.ordem_exibicao ? parseInt(grauForm.ordem_exibicao) : null
    };

    if (grauEditando) {
      const { error } = await supabase
        .from('graus_maconicos')
        .update(dados)
        .eq('id', grauEditando.id);

      if (error) {
        showError('Erro ao atualizar grau');
      } else {
        showSuccess('Grau atualizado com sucesso!');
        limparFormulario();
        carregarGraus();
      }
    } else {
      const { error } = await supabase
        .from('graus_maconicos')
        .insert([dados]);

      if (error) {
        showError('Erro ao cadastrar grau: ' + error.message);
      } else {
        showSuccess('Grau cadastrado com sucesso!');
        limparFormulario();
        carregarGraus();
      }
    }
  };

  const editarGrau = (grau) => {
    setGrauForm({
      rito: grau.rito,
      numero_grau: grau.numero_grau,
      nome_grau: grau.nome_grau,
      descricao: grau.descricao || '',
      imagem_url: grau.imagem_url || '',
      cor_representativa: grau.cor_representativa || '#6366f1',
      ordem_exibicao: grau.ordem_exibicao || '',
      ativo: grau.ativo
    });
    setGrauEditando(grau);
    setMostrarFormulario(true);
  };

  const toggleAtivo = async (grau) => {
    const { error } = await supabase
      .from('graus_maconicos')
      .update({ ativo: !grau.ativo })
      .eq('id', grau.id);

    if (error) {
      showError('Erro ao alterar status');
    } else {
      showSuccess(grau.ativo ? 'Grau desativado' : 'Grau ativado');
      carregarGraus();
    }
  };

  const excluirGrau = async (grau) => {
    if (!confirm(`Deseja excluir o grau ${grau.numero_grau}º - ${grau.nome_grau}?`)) return;

    const { error } = await supabase
      .from('graus_maconicos')
      .delete()
      .eq('id', grau.id);

    if (error) {
      showError('Erro ao excluir grau. Pode ter irmãos associados.');
    } else {
      showSuccess('Grau excluído com sucesso!');
      carregarGraus();
    }
  };

  const grausFiltrados = filtroRito
    ? graus.filter(g => g.rito === filtroRito)
    : graus;

  const grausPorRito = {};
  grausFiltrados.forEach(grau => {
    if (!grausPorRito[grau.rito]) {
      grausPorRito[grau.rito] = [];
    }
    grausPorRito[grau.rito].push(grau);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">🔺 Gerenciar Graus Maçônicos</h2>
            <p className="text-purple-100">Cadastre ritos e graus filosóficos</p>
          </div>
          <button
            onClick={() => {
              limparFormulario();
              setMostrarFormulario(!mostrarFormulario);
            }}
            className="px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-semibold"
          >
            {mostrarFormulario ? '✖️ Cancelar' : '➕ Novo Grau'}
          </button>
        </div>
      </div>

      {/* Formulário */}
      {mostrarFormulario && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-purple-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {grauEditando ? '✏️ Editar Grau' : '➕ Cadastrar Novo Grau'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Rito */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rito *
                </label>
                <input
                  type="text"
                  value={grauForm.rito}
                  onChange={(e) => setGrauForm({ ...grauForm, rito: e.target.value })}
                  placeholder="Ex: REAA, Arco Real, York"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              {/* Número do Grau */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número do Grau *
                </label>
                <input
                  type="number"
                  value={grauForm.numero_grau}
                  onChange={(e) => setGrauForm({ ...grauForm, numero_grau: e.target.value })}
                  placeholder="Ex: 4, 18, 33"
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              {/* Ordem de Exibição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ordem de Exibição
                </label>
                <input
                  type="number"
                  value={grauForm.ordem_exibicao}
                  onChange={(e) => setGrauForm({ ...grauForm, ordem_exibicao: e.target.value })}
                  placeholder="Ex: 1, 2, 3..."
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Nome do Grau */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Grau *
                </label>
                <input
                  type="text"
                  value={grauForm.nome_grau}
                  onChange={(e) => setGrauForm({ ...grauForm, nome_grau: e.target.value })}
                  placeholder="Ex: Mestre Secreto"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              {/* Cor Representativa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cor
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={grauForm.cor_representativa}
                    onChange={(e) => setGrauForm({ ...grauForm, cor_representativa: e.target.value })}
                    className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={grauForm.cor_representativa}
                    onChange={(e) => setGrauForm({ ...grauForm, cor_representativa: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* URL da Imagem */}
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL da Imagem
                </label>
                <input
                  type="url"
                  value={grauForm.imagem_url}
                  onChange={(e) => setGrauForm({ ...grauForm, imagem_url: e.target.value })}
                  placeholder="https://exemplo.com/imagem-grau.png"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                />
                {grauForm.imagem_url && (
                  <div className="mt-2">
                    <img
                      src={grauForm.imagem_url}
                      alt="Preview"
                      className="w-20 h-20 object-contain border rounded"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Descrição */}
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={grauForm.descricao}
                  onChange={(e) => setGrauForm({ ...grauForm, descricao: e.target.value })}
                  rows={3}
                  placeholder="Descrição opcional do grau"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Status Ativo */}
              <div className="md:col-span-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={grauForm.ativo}
                    onChange={(e) => setGrauForm({ ...grauForm, ativo: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Grau ativo (disponível para seleção)</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                {grauEditando ? '💾 Salvar Alterações' : '➕ Cadastrar Grau'}
              </button>
              <button
                type="button"
                onClick={limparFormulario}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                ❌ Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Rito</label>
            <select
              value={filtroRito}
              onChange={(e) => setFiltroRito(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Todos os Ritos ({graus.length} graus)</option>
              {ritos.map(rito => (
                <option key={rito} value={rito}>
                  {rito} ({graus.filter(g => g.rito === rito).length})
                </option>
              ))}
            </select>
          </div>
          
          <div className="text-sm text-gray-600">
            <strong>{grausFiltrados.length}</strong> graus encontrados
          </div>
        </div>
      </div>

      {/* Lista de Graus por Rito */}
      <div className="space-y-6">
        {Object.entries(grausPorRito).map(([rito, grausDoRito]) => (
          <div key={rito} className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white p-4">
              <h3 className="text-xl font-bold">{rito}</h3>
              <p className="text-sm text-purple-100">{grausDoRito.length} graus cadastrados</p>
            </div>

            <div className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Nº</th>
                      <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Nome</th>
                      <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Descrição</th>
                      <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700">Imagem</th>
                      <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700">Status</th>
                      <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grausDoRito.map((grau) => (
                      <tr key={grau.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-3">
                          <span className="font-bold text-lg text-purple-600">{grau.numero_grau}º</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-gray-900">{grau.nome_grau}</div>
                        </td>
                        <td className="py-3 px-3 text-sm text-gray-600 max-w-xs truncate">
                          {grau.descricao || '-'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {grau.imagem_url ? (
                            <img
                              src={grau.imagem_url}
                              alt={grau.nome_grau}
                              className="w-12 h-12 object-contain mx-auto rounded"
                            />
                          ) : (
                            <span className="text-2xl">🔺</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => toggleAtivo(grau)}
                            className={`px-3 py-1 rounded text-xs font-medium ${
                              grau.ativo
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {grau.ativo ? '✓ Ativo' : '✗ Inativo'}
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => editarGrau(grau)}
                              className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                              title="Editar"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => excluirGrau(grau)}
                              className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                              title="Excluir"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}

        {grausFiltrados.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-6xl mb-4">🔺</div>
            <p className="text-gray-600 text-lg font-medium">Nenhum grau cadastrado</p>
            <p className="text-gray-500 text-sm mt-2">Clique em "Novo Grau" para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}
