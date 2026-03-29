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
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2" style={{color:"var(--color-text)"}}>🔺 Gerenciar Graus Maçônicos</h2>
            <p className="text-purple-100">Cadastre ritos e graus filosóficos</p>
          </div>
          <button
            onClick={() => {
              limparFormulario();
              setMostrarFormulario(!mostrarFormulario);
            }}
            className="px-6 py-3 text-purple-600 rounded-lg transition-colors font-semibold"
          >
            {mostrarFormulario ? '✖️ Cancelar' : '➕ Novo Grau'}
          </button>
        </div>
      </div>

      {/* Formulário */}
      {mostrarFormulario && (
        <div className="rounded-lg p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <h3 className="text-xl font-bold mb-4" style={{color:"var(--color-text)"}}>
            {grauEditando ? '✏️ Editar Grau' : '➕ Cadastrar Novo Grau'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Rito */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Rito *
                </label>
                <input
                  type="text"
                  value={grauForm.rito}
                  onChange={(e) => setGrauForm({ ...grauForm, rito: e.target.value })}
                  placeholder="Ex: REAA, Arco Real, York"
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  required
                />
              </div>

              {/* Número do Grau */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Número do Grau *
                </label>
                <input
                  type="number"
                  value={grauForm.numero_grau}
                  onChange={(e) => setGrauForm({ ...grauForm, numero_grau: e.target.value })}
                  placeholder="Ex: 4, 18, 33"
                  min="1"
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  required
                />
              </div>

              {/* Ordem de Exibição */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Ordem de Exibição
                </label>
                <input
                  type="number"
                  value={grauForm.ordem_exibicao}
                  onChange={(e) => setGrauForm({ ...grauForm, ordem_exibicao: e.target.value })}
                  placeholder="Ex: 1, 2, 3..."
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                />
              </div>

              {/* Nome do Grau */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Nome do Grau *
                </label>
                <input
                  type="text"
                  value={grauForm.nome_grau}
                  onChange={(e) => setGrauForm({ ...grauForm, nome_grau: e.target.value })}
                  placeholder="Ex: Mestre Secreto"
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  required
                />
              </div>

              {/* Cor Representativa */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Cor
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={grauForm.cor_representativa}
                    onChange={(e) => setGrauForm({ ...grauForm, cor_representativa: e.target.value })}
                    className="w-16 h-10 rounded cursor-pointer" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  />
                  <input
                    type="text"
                    value={grauForm.cor_representativa}
                    onChange={(e) => setGrauForm({ ...grauForm, cor_representativa: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  />
                </div>
              </div>

              {/* URL da Imagem */}
              <div className="md:col-span-3">
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  URL da Imagem
                </label>
                <input
                  type="url"
                  value={grauForm.imagem_url}
                  onChange={(e) => setGrauForm({ ...grauForm, imagem_url: e.target.value })}
                  placeholder="https://exemplo.com/imagem-grau.png"
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Descrição
                </label>
                <textarea
                  value={grauForm.descricao}
                  onChange={(e) => setGrauForm({ ...grauForm, descricao: e.target.value })}
                  rows={3}
                  placeholder="Descrição opcional do grau"
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                />
              </div>

              {/* Status Ativo */}
              <div className="md:col-span-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={grauForm.ativo}
                    onChange={(e) => setGrauForm({ ...grauForm, ativo: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="text-sm font-medium">Grau ativo (disponível para seleção)</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                {grauEditando ? '💾 Salvar Alterações' : '➕ Cadastrar Grau'}
              </button>
              <button
                type="button"
                onClick={limparFormulario}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg transition-colors" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
              >
                ❌ Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-lg shadow p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Filtrar por Rito</label>
            <select
              value={filtroRito}
              onChange={(e) => setFiltroRito(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
            >
              <option value="">Todos os Ritos ({graus.length} graus)</option>
              {ritos.map(rito => (
                <option key={rito} value={rito}>
                  {rito} ({graus.filter(g => g.rito === rito).length})
                </option>
              ))}
            </select>
          </div>
          
          <div className="text-sm">
            <strong>{grausFiltrados.length}</strong> graus encontrados
          </div>
        </div>
      </div>

      {/* Lista de Graus por Rito */}
      <div className="space-y-6">
        {Object.entries(grausPorRito).map(([rito, grausDoRito]) => (
          <div key={rito} className="rounded-lg overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="p-4 text-white" style={{background:"var(--color-accent)"}}>
              <h3 className="text-xl font-bold" style={{color:"#fff"}}>{rito}</h3>
              <p className="text-sm" style={{color:"rgba(255,255,255,0.85)"}}>{grausDoRito.length} graus cadastrados</p>
            </div>

            <div className="p-3">
                <div className="space-y-2">
                    {grausDoRito.map((grau, idx) => (
                      <div key={grau.id}
                        className="rounded-lg border-l-4 flex items-center gap-3 px-3 py-3 transition-opacity hover:opacity-90"
                        style={{borderLeftColor:'var(--color-accent)',background:idx%2===0?'var(--color-surface)':'var(--color-surface-2)'}}>
                        {/* Número */}
                        <div style={{flexShrink:0,width:'42px'}}>
                          <span className="font-bold text-lg" style={{color:'var(--color-accent)'}}>{grau.numero_grau}º</span>
                        </div>
                        {/* Imagem */}
                        <div style={{flexShrink:0,width:'44px'}}>
                          {grau.imagem_url
                            ? <img src={grau.imagem_url} alt={grau.nome_grau} style={{width:'36px',height:'36px',objectFit:'contain',borderRadius:'var(--radius-md)'}}/>
                            : <span style={{fontSize:'1.5rem'}}>🔺</span>}
                        </div>
                        {/* Nome + Descrição */}
                        <div style={{flex:1,minWidth:0,width:0,overflow:'hidden'}}>
                          <p className="font-semibold text-sm" style={{color:'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{grau.nome_grau}</p>
                          <p className="text-xs" style={{color:'var(--color-text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{grau.descricao||'—'}</p>
                        </div>
                        {/* Status */}
                        <div style={{flexShrink:0}}>
                          <button onClick={()=>toggleAtivo(grau)}
                            style={{padding:'0.2rem 0.55rem',borderRadius:'999px',fontSize:'0.72rem',fontWeight:'700',cursor:'pointer',
                              background:grau.ativo?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.1)',
                              color:grau.ativo?'#10b981':'#ef4444',
                              border:`1px solid ${grau.ativo?'rgba(16,185,129,0.3)':'rgba(239,68,68,0.3)'}`}}>
                            {grau.ativo?'✓ Ativo':'✗ Inativo'}
                          </button>
                        </div>
                        {/* Ações */}
                        <div className="flex gap-1.5" style={{flexShrink:0}}>
                          <button onClick={()=>editarGrau(grau)} title="Editar" style={{padding:"0.25rem 0.55rem",background:"var(--color-accent-bg)",color:"var(--color-accent)",border:"1px solid var(--color-accent)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}>✏️</button>
                          <button onClick={()=>excluirGrau(grau)} title="Excluir" style={{padding:"0.25rem 0.55rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}>🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            </div>
        ))}

        {grausFiltrados.length === 0 && (
          <div className="text-center py-12 rounded-lg border-2 border-dashed" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="text-6xl mb-4">🔺</div>
            <p className="text-lg font-medium">Nenhum grau cadastrado</p>
            <p className="text-sm mt-2">Clique em "Novo Grau" para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}
