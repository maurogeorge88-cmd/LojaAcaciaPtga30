import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';

export default function GerenciarCategorias({ showSuccess, showError }) {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState(null);
  
  const [formCategoria, setFormCategoria] = useState({
    nome: '',
    tipo: 'receita',
    descricao: '',
    ativo: true
  });

  useEffect(() => {
    carregarCategorias();
  }, []);

  const carregarCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('categorias_financeiras')
        .select('*')
        .order('tipo')
        .order('nome');

      if (error) throw error;
      setCategorias(data || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      showError('Erro ao carregar categorias: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const dados = {
        nome: formCategoria.nome.trim(),
        tipo: formCategoria.tipo,
        descricao: formCategoria.descricao.trim() || null,
        ativo: formCategoria.ativo
      };

      if (editando) {
        // Atualizar
        const { error } = await supabase
          .from('categorias_financeiras')
          .update(dados)
          .eq('id', editando);

        if (error) throw error;
        showSuccess('Categoria atualizada com sucesso!');
      } else {
        // Criar
        const { error } = await supabase
          .from('categorias_financeiras')
          .insert(dados);

        if (error) throw error;
        showSuccess('Categoria criada com sucesso!');
      }

      limparFormulario();
      await carregarCategorias();

    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      showError('Erro ao salvar categoria: ' + error.message);
    }
  };

  const editarCategoria = (categoria) => {
    setFormCategoria({
      nome: categoria.nome,
      tipo: categoria.tipo,
      descricao: categoria.descricao || '',
      ativo: categoria.ativo
    });
    setEditando(categoria.id);
    setMostrarFormulario(true);
  };

  const toggleAtivo = async (id, ativoAtual) => {
    try {
      const { error } = await supabase
        .from('categorias_financeiras')
        .update({ ativo: !ativoAtual })
        .eq('id', id);

      if (error) throw error;

      showSuccess(`Categoria ${!ativoAtual ? 'ativada' : 'desativada'} com sucesso!`);
      await carregarCategorias();

    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      showError('Erro ao atualizar categoria: ' + error.message);
    }
  };

  const excluirCategoria = async (id) => {
    if (!window.confirm('Deseja realmente excluir esta categoria?\n\nAtenção: Isso pode afetar lançamentos existentes que usam esta categoria.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('categorias_financeiras')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('Categoria excluída com sucesso!');
      await carregarCategorias();

    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
      showError('Erro ao excluir: ' + error.message);
    }
  };

  const limparFormulario = () => {
    setFormCategoria({
      nome: '',
      tipo: 'receita',
      descricao: '',
      ativo: true
    });
    setEditando(null);
    setMostrarFormulario(false);
  };

  const categoriasReceita = categorias.filter(c => c.tipo === 'receita');
  const categoriasDespesa = categorias.filter(c => c.tipo === 'despesa');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Carregando categorias...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          📊 Gerenciar Categorias Financeiras
        </h2>
        <button
          onClick={() => setMostrarFormulario(!mostrarFormulario)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
        >
          {mostrarFormulario ? '❌ Cancelar' : '➕ Nova Categoria'}
        </button>
      </div>

      {/* FORMULÁRIO */}
      {mostrarFormulario && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editando ? '✏️ Editar Categoria' : '➕ Nova Categoria'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  value={formCategoria.nome}
                  onChange={(e) => setFormCategoria({ ...formCategoria, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Mensalidade, Água, Energia"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo *
                </label>
                <select
                  value={formCategoria.tipo}
                  onChange={(e) => setFormCategoria({ ...formCategoria, tipo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="receita">💰 Receita</option>
                  <option value="despesa">💸 Despesa</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  value={formCategoria.descricao}
                  onChange={(e) => setFormCategoria({ ...formCategoria, descricao: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Descrição opcional da categoria"
                />
              </div>

              <div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formCategoria.ativo}
                    onChange={(e) => setFormCategoria({ ...formCategoria, ativo: e.target.checked })}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Categoria ativa</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                {editando ? '✅ Salvar Alterações' : '➕ Criar Categoria'}
              </button>
              <button
                type="button"
                onClick={limparFormulario}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LISTA DE CATEGORIAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* RECEITAS */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-green-700 mb-4 flex items-center">
            💰 Receitas ({categoriasReceita.length})
          </h3>
          
          <div className="space-y-2">
            {categoriasReceita.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma categoria de receita cadastrada</p>
            ) : (
              categoriasReceita.map(categoria => (
                <div
                  key={categoria.id}
                  className={`p-3 rounded-lg border ${
                    categoria.ativo 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{categoria.nome}</h4>
                        {!categoria.ativo && (
                          <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded">
                            Inativa
                          </span>
                        )}
                      </div>
                      {categoria.descricao && (
                        <p className="text-sm text-gray-600 mt-1">{categoria.descricao}</p>
                      )}
                    </div>

                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => editarCategoria(categoria)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => toggleAtivo(categoria.id, categoria.ativo)}
                        className="p-1 text-yellow-600 hover:bg-yellow-100 rounded"
                        title={categoria.ativo ? 'Desativar' : 'Ativar'}
                      >
                        {categoria.ativo ? '👁️' : '👁️‍🗨️'}
                      </button>
                      <button
                        onClick={() => excluirCategoria(categoria.id)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                        title="Excluir"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* DESPESAS */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-red-700 mb-4 flex items-center">
            💸 Despesas ({categoriasDespesa.length})
          </h3>
          
          <div className="space-y-2">
            {categoriasDespesa.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma categoria de despesa cadastrada</p>
            ) : (
              categoriasDespesa.map(categoria => (
                <div
                  key={categoria.id}
                  className={`p-3 rounded-lg border ${
                    categoria.ativo 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{categoria.nome}</h4>
                        {!categoria.ativo && (
                          <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded">
                            Inativa
                          </span>
                        )}
                      </div>
                      {categoria.descricao && (
                        <p className="text-sm text-gray-600 mt-1">{categoria.descricao}</p>
                      )}
                    </div>

                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => editarCategoria(categoria)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => toggleAtivo(categoria.id, categoria.ativo)}
                        className="p-1 text-yellow-600 hover:bg-yellow-100 rounded"
                        title={categoria.ativo ? 'Desativar' : 'Ativar'}
                      >
                        {categoria.ativo ? '👁️' : '👁️‍🗨️'}
                      </button>
                      <button
                        onClick={() => excluirCategoria(categoria.id)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                        title="Excluir"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ESTATÍSTICAS */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>💡 Dica:</strong> Categorias inativas não aparecem nos formulários de lançamento,
          mas os lançamentos antigos que usam essas categorias continuam visíveis.
        </p>
      </div>
    </div>
  );
}
