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
  const BadgeTipo = ({ tipo }) => (
    <span style={{padding:"0.15rem 0.6rem",borderRadius:"999px",fontSize:"0.7rem",fontWeight:"700",
      background: tipo==='receita'?"rgba(16,185,129,0.15)":"rgba(239,68,68,0.15)",
      color: tipo==='receita'?"#10b981":"#ef4444",
      border: `1px solid ${tipo==='receita'?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`}}>
      {tipo === 'receita' ? '📈 Receita' : '📉 Despesa'}
    </span>
  );

  const BadgeNivel = ({ nivel }) => (
    <span style={{padding:"0.15rem 0.6rem",borderRadius:"999px",fontSize:"0.7rem",fontWeight:"700",
      background: nivel===1?"rgba(59,130,246,0.15)":"rgba(139,92,246,0.15)",
      color: nivel===1?"#3b82f6":"#8b5cf6",
      border: `1px solid ${nivel===1?"rgba(59,130,246,0.3)":"rgba(139,92,246,0.3)"}`}}>
      Nível {nivel}
    </span>
  );

  const BadgeStatus = ({ ativo }) => (
    <span style={{padding:"0.15rem 0.6rem",borderRadius:"999px",fontSize:"0.7rem",fontWeight:"700",
      background: ativo?"rgba(16,185,129,0.15)":"rgba(239,68,68,0.1)",
      color: ativo?"#10b981":"#ef4444",
      border: `1px solid ${ativo?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`}}>
      {ativo ? '✅ Ativo' : '⏸️ Inativo'}
    </span>
  );

  const BotoesAcao = ({ cat }) => (
    <div style={{display:"flex",gap:"0.35rem"}}>
      <button onClick={() => handleEditar(cat)} title="Editar"
        style={{padding:"0.25rem 0.55rem",background:"var(--color-accent-bg)",color:"var(--color-accent)",
          border:"1px solid var(--color-accent)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}>
        ✏️
      </button>
      <button onClick={() => handleExcluir(cat.id)} title="Excluir"
        style={{padding:"0.25rem 0.55rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",
          border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}>
        🗑️
      </button>
    </div>
  );

  const renderizarGrupos = (arvore) => {
    return (
      <div style={{display:"flex",flexDirection:"column",gap:"0.75rem",padding:"0.75rem"}}>
        {arvore.map(cat => (
          <div key={cat.id} style={{borderRadius:"var(--radius-xl)",border:"1px solid var(--color-border)",overflow:"hidden",borderLeft:"4px solid var(--color-accent)"}}>
            {/* Linha da categoria principal */}
            <div style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.65rem 1rem",
              background:"var(--color-surface-2)",borderBottom: cat.filhos?.length?"1px solid var(--color-border)":"none"}}>
              <span style={{flex:1,fontWeight:"700",fontSize:"0.95rem",color:"var(--color-accent)"}}>{cat.nome}</span>
              <BadgeTipo tipo={cat.tipo} />
              <BadgeNivel nivel={cat.nivel} />
              <BadgeStatus ativo={cat.ativo} />
              <BotoesAcao cat={cat} />
            </div>
            {/* Subcategorias */}
            {cat.filhos && cat.filhos.map((sub, idx) => (
              <div key={sub.id} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.5rem 1rem 0.5rem 2rem",
                background: idx%2===0?"var(--color-surface)":"var(--color-surface-2)",
                borderBottom:"1px solid var(--color-border)"}}>
                <span style={{color:"var(--color-text-muted)",fontSize:"0.8rem",flexShrink:0}}>└─</span>
                <span style={{flex:1,fontSize:"0.875rem",color:"var(--color-text)"}}>{sub.nome}</span>
                <BadgeTipo tipo={sub.tipo} />
                <BadgeNivel nivel={sub.nivel} />
                <BadgeStatus ativo={sub.ativo} />
                <BotoesAcao cat={sub} />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg" style={{color:"var(--color-text-muted)"}}>Carregando categorias...</div>
      </div>
    );
  }

  const arvoreReceitas = construirArvore(categorias, 'receita');
  const arvoreDespesas = construirArvore(categorias, 'despesa');
  const categoriasPrincipais = categorias.filter(c => c.nivel === 1 && c.tipo === formCategoria.tipo);

  return (
    <div className="space-y-6" style={{background:"var(--color-bg)",minHeight:"100vh",padding:"1rem",overflowX:"hidden"}}>
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
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                >
                  <option value="">Principal (sem categoria pai)</option>
                  {categoriasPrincipais.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nome}
                    </option>
                  ))}
                </select>
                <p className="text-xs mt-1" style={{color:"var(--color-text-muted)"}}>
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
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
                style={{padding:"0.5rem 1.5rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer"}}
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
        {renderizarGrupos(arvoreReceitas)}
      </div>

      {/* LISTA DE DESPESAS */}
      <div className="rounded-lg shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold" style={{color:"var(--color-text)"}}>📉 Despesas</h3>
        </div>
        {renderizarGrupos(arvoreDespesas)}
      </div>
    </div>
  );
}
