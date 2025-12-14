import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';

export default function CategoriasFinanceiras({ showSuccess, showError }) {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState(null);
  
  const [formCategoria, setFormCategoria] = useState({
    nome: '',
    tipo: 'receita',
    categoria_pai_id: null,
    nivel: 1,
    ordem: 0,
    ativo: true
  });

  // ========================================
  // 📊 CARREGAR CATEGORIAS
  // ========================================
  const loadCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('categorias_financeiras')
        .select('*')
        .order('tipo')
        .order('nivel')
        .order('ordem')
        .order('nome');

      if (error) throw error;
      setCategorias(data || []);
    } catch (error) {
      showError('Erro ao carregar categorias: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategorias();
  }, []);

  // ========================================
  // 🌳 CONSTRUIR ÁRVORE HIERÁRQUICA
  // ========================================
  const construirArvore = (categoriasLista, tipo) => {
    const categoriasPorTipo = categoriasLista.filter(c => c.tipo === tipo);
    const principais = categoriasPorTipo.filter(c => c.nivel === 1 || !c.categoria_pai_id);
    
    const construirFilhos = (pai) => {
      const filhos = categoriasPorTipo.filter(c => c.categoria_pai_id === pai.id);
      return filhos.map(filho => ({
        ...filho,
        filhos: construirFilhos(filho)
      }));
    };
    
    return principais.map(cat => ({
      ...cat,
      filhos: construirFilhos(cat)
    }));
  };

  // ========================================
  // 💾 SALVAR CATEGORIA
  // ========================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Calcular nível automaticamente
      let nivel = 1;
      if (formCategoria.categoria_pai_id) {
        const pai = categorias.find(c => c.id === parseInt(formCategoria.categoria_pai_id));
        nivel = pai ? pai.nivel + 1 : 1;
      }

      const dadosCategoria = {
        ...formCategoria,
        nivel,
        categoria_pai_id: formCategoria.categoria_pai_id ? parseInt(formCategoria.categoria_pai_id) : null
      };

      if (editando) {
        const { error } = await supabase
          .from('categorias_financeiras')
          .update(dadosCategoria)
          .eq('id', editando.id);
        
        if (error) throw error;
        showSuccess('Categoria atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('categorias_financeiras')
          .insert([dadosCategoria]);
        
        if (error) throw error;
        showSuccess('Categoria criada com sucesso!');
      }
      
      limparFormulario();
      loadCategorias();
    } catch (error) {
      showError('Erro ao salvar categoria: ' + error.message);
    }
  };

  // ========================================
  // ✏️ EDITAR CATEGORIA
  // ========================================
  const handleEditar = (categoria) => {
    setEditando(categoria);
    setFormCategoria({
      nome: categoria.nome,
      tipo: categoria.tipo,
      categoria_pai_id: categoria.categoria_pai_id || null,
      nivel: categoria.nivel,
      ordem: categoria.ordem,
      ativo: categoria.ativo
    });
    setMostrarFormulario(true);
  };

  // ========================================
  // 🗑️ EXCLUIR CATEGORIA
  // ========================================
  const handleExcluir = async (id) => {
    // Verificar se tem subcategorias
    const temFilhos = categorias.some(c => c.categoria_pai_id === id);
    if (temFilhos) {
      showError('Não é possível excluir categoria com subcategorias!');
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm('Deseja realmente excluir esta categoria?')) return;
    
    try {
      const { error } = await supabase
        .from('categorias_financeiras')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      showSuccess('Categoria excluída com sucesso!');
      loadCategorias();
    } catch (error) {
      showError('Erro ao excluir categoria: ' + error.message);
    }
  };

  const limparFormulario = () => {
    setFormCategoria({
      nome: '',
      tipo: 'receita',
      categoria_pai_id: null,
      nivel: 1,
      ordem: 0,
      ativo: true
    });
    setEditando(null);
    setMostrarFormulario(false);
  };

  // ========================================
  // 🎨 RENDERIZAR ÁRVORE
  // ========================================
  const renderizarArvore = (categorias, profundidade = 0) => {
    return categorias.map(cat => (
      <React.Fragment key={cat.id}>
        <tr className="hover:bg-gray-50">
          <td className="px-6 py-3 text-sm" style={{ paddingLeft: `${24 + profundidade * 32}px` }}>
            {profundidade > 0 && (
              <span className="text-gray-400 mr-2">
                {'└─ '}
              </span>
            )}
            <span className={profundidade === 0 ? 'font-bold' : ''}>
              {cat.nome}
            </span>
          </td>
          <td className="px-6 py-3 text-sm">
            <span className={`px-2 py-1 text-xs rounded-full ${
              cat.tipo === 'receita' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {cat.tipo === 'receita' ? '📈 Receita' : '📉 Despesa'}
            </span>
          </td>
          <td className="px-6 py-3 text-sm text-center">
            <span className={`px-2 py-1 text-xs rounded-full ${
              cat.nivel === 1 ? 'bg-blue-100 text-blue-800' :
              cat.nivel === 2 ? 'bg-purple-100 text-purple-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              Nível {cat.nivel}
            </span>
          </td>
          <td className="px-6 py-3 text-sm text-center">
            <span className={`px-2 py-1 text-xs rounded-full ${
              cat.ativo 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {cat.ativo ? '✅ Ativo' : '⏸️ Inativo'}
            </span>
          </td>
          <td className="px-6 py-3 text-sm">
            <div className="flex gap-2">
              <button
                onClick={() => handleEditar(cat)}
                className="text-blue-600 hover:text-blue-900"
                title="Editar"
              >
                ✏️
              </button>
              <button
                onClick={() => handleExcluir(cat.id)}
                className="text-red-600 hover:text-red-900"
                title="Excluir"
              >
                🗑️
              </button>
            </div>
          </td>
        </tr>
        {cat.filhos && cat.filhos.length > 0 && renderizarArvore(cat.filhos, profundidade + 1)}
      </React.Fragment>
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Carregando categorias...</div>
      </div>
    );
  }

  const arvoreReceitas = construirArvore(categorias, 'receita');
  const arvoreDespesas = construirArvore(categorias, 'despesa');
  const categoriasPrincipais = categorias.filter(c => c.nivel === 1 && c.tipo === formCategoria.tipo);

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">🏷️ Categorias Financeiras</h2>
        <button
          onClick={() => setMostrarFormulario(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          ➕ Nova Categoria
        </button>
      </div>

      {/* FORMULÁRIO */}
      {mostrarFormulario && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            {editando ? '✏️ Editar Categoria' : '➕ Nova Categoria'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  value={formCategoria.nome}
                  onChange={(e) => setFormCategoria({ ...formCategoria, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo *
                </label>
                <select
                  value={formCategoria.tipo}
                  onChange={(e) => setFormCategoria({ ...formCategoria, tipo: e.target.value, categoria_pai_id: null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="receita">📈 Receita</option>
                  <option value="despesa">📉 Despesa</option>
                </select>
              </div>

              {/* Categoria Pai */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria Pai (opcional)
                </label>
                <select
                  value={formCategoria.categoria_pai_id || ''}
                  onChange={(e) => setFormCategoria({ ...formCategoria, categoria_pai_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Principal (sem categoria pai)</option>
                  {categoriasPrincipais.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nome}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Deixe vazio para criar categoria principal
                </p>
              </div>

              {/* Ordem */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ordem de Exibição
                </label>
                <input
                  type="number"
                  value={formCategoria.ordem}
                  onChange={(e) => setFormCategoria({ ...formCategoria, ordem: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
            </div>

            {/* Ativo */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ativo"
                checked={formCategoria.ativo}
                onChange={(e) => setFormCategoria({ ...formCategoria, ativo: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="ativo" className="text-sm font-medium text-gray-700">
                Categoria Ativa
              </label>
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                {editando ? '💾 Salvar Alterações' : '➕ Criar Categoria'}
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

      {/* LISTA DE RECEITAS */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">📈 Receitas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Nível</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {renderizarArvore(arvoreReceitas)}
            </tbody>
          </table>
        </div>
      </div>

      {/* LISTA DE DESPESAS */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">📉 Despesas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Nível</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {renderizarArvore(arvoreDespesas)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
