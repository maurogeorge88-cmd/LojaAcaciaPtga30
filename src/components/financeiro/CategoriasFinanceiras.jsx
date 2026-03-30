import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

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

    if (!window.confirm('Deseja realmente excluir esta categoria?')) return;
    
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
        <tr className="hover:">
          <td className="px-6 py-3 text-sm" style={{ paddingLeft: `${24 + profundidade * 32}px` }}>
            {profundidade > 0 && (
              <span className="mr-2">
                {'└─ '}
              </span>
            )}
            <span className={profundidade === 0 ? 'font-bold' : ''}>
              {cat.nome}
            </span>
          </td>
          <td className="px-6 py-3 text-sm" style={{color:"var(--color-text)"}}>
            <span className={`px-2 py-1 text-xs rounded-full ${
              cat.tipo === 'receita' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {cat.tipo === 'receita' ? '📈 Receita' : '📉 Despesa'}
            </span>
          </td>
          <td className="px-6 py-3 text-sm text-center" style={{color:"var(--color-text)"}}>
            <span className={`px-2 py-1 text-xs rounded-full ${
              cat.nivel === 1 ? 'bg-blue-100 text-blue-800' :
              cat.nivel === 2 ? 'bg-purple-100 text-purple-800' :
              ' '
            }`}>
              Nível {cat.nivel}
            </span>
          </td>
          <td className="px-6 py-3 text-sm text-center" style={{color:"var(--color-text)"}}>
            <span className={`px-2 py-1 text-xs rounded-full ${
              cat.ativo 
                ? 'bg-green-100 text-green-800' 
                : ' '
            }`}>
              {cat.ativo ? '✅ Ativo' : '⏸️ Inativo'}
            </span>
          </td>
          <td className="px-6 py-3 text-sm" style={{color:"var(--color-text)"}}>
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
        <div className="text-lg">Carregando categorias...</div>
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
        <h2 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>🏷️ Categorias Financeiras</h2>
        <button
          onClick={() => setMostrarFormulario(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
        >
          ➕ Nova Categoria
        </button>
      </div>

      {/* FORMULÁRIO */}
      {mostrarFormulario && (
        <div className="rounded-lg p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <h3 className="text-lg font-semibold mb-4" style={{color:"var(--color-text)"}}>
            {editando ? '✏️ Editar Categoria' : '➕ Nova Categoria'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  value={formCategoria.nome}
                  onChange={(e) => setFormCategoria({ ...formCategoria, nome: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Tipo *
                </label>
                <select
                  value={formCategoria.tipo}
                  onChange={(e) => setFormCategoria({ ...formCategoria, tipo: e.target.value, categoria_pai_id: null })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="receita">📈 Receita</option>
                  <option value="despesa">📉 Despesa</option>
                </select>
              </div>

              {/* Categoria Pai */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Categoria Pai (opcional)
                </label>
                <select
                  value={formCategoria.categoria_pai_id || ''}
                  onChange={(e) => setFormCategoria({ ...formCategoria, categoria_pai_id: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Principal (sem categoria pai)</option>
                  {categoriasPrincipais.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nome}
                    </option>
                  ))}
                </select>
                <p className="text-xs mt-1">
                  Deixe vazio para criar categoria principal
                </p>
              </div>

              {/* Ordem */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Ordem de Exibição
                </label>
                <input
                  type="number"
                  value={formCategoria.ordem}
                  onChange={(e) => setFormCategoria({ ...formCategoria, ordem: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
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
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="ativo" className="text-sm font-medium" style={{color:"var(--color-text-muted)"}}>
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
                className="px-6 py-2 bg-gray-300 rounded-lg"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LISTA DE RECEITAS */}
      <div className="rounded-lg shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold" style={{color:"var(--color-text)"}}>📈 Receitas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead style={{background:"var(--color-surface-2)"}}>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Categoria</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Tipo</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Nível</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {renderizarArvore(arvoreReceitas)}
            </tbody>
          </table>
        </div>
      </div>

      {/* LISTA DE DESPESAS */}
      <div className="rounded-lg shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold" style={{color:"var(--color-text)"}}>📉 Despesas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead style={{background:"var(--color-surface-2)"}}>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Categoria</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Tipo</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Nível</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {renderizarArvore(arvoreDespesas)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
