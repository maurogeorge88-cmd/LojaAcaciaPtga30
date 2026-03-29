import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarData } from '../../utils/formatters';

const Pranchas = ({ pranchas, onUpdate, showSuccess, showError, permissoes, grauUsuario }) => {
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
  const [anoSelecionado, setAnoSelecionado] = useState(null);

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
    if (typeof window !== 'undefined' && !window.confirm('Tem certeza que deseja excluir esta prancha?')) return;

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

  const anosDisponiveis = [...new Set(
    pranchas.map(p => p.data_prancha ? new Date(p.data_prancha + 'T00:00:00').getFullYear() : new Date().getFullYear())
  )].sort((a, b) => b - a);

  // Filtrar pranchas por ano e busca
  const pranchasFiltradas = pranchas.filter(p => {
    if (anoSelecionado) {
      const anoPrancha = p.data_prancha ? new Date(p.data_prancha + 'T00:00:00').getFullYear() : new Date().getFullYear();
      if (anoPrancha !== anoSelecionado) return false;
    }
    if (!searchTerm) return true;
    const termo = searchTerm.toLowerCase();
    return (
      p.numero_prancha?.toLowerCase().includes(termo) ||
      p.assunto?.toLowerCase().includes(termo) ||
      p.destinatario?.toLowerCase().includes(termo)
    );
  });

  // CONTROLE DE ACESSO POR GRAU
  // Aprendizes e Companheiros NÃO podem acessar Pranchas
  // Apenas Mestres podem visualizar
  if (grauUsuario && (grauUsuario.toLowerCase() === 'aprendiz' || grauUsuario.toLowerCase() === 'companheiro')) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center bg-yellow-50 border-2 border-yellow-400 rounded-lg p-8 max-w-md" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold mb-3" style={{color:"var(--color-text)"}}>Acesso Restrito</h2>
          <p className="mb-2">
            Pranchas são documentos oficiais de nível <strong>Mestre</strong>.
          </p>
          <p className="text-sm">
            Você precisa ser Mestre Maçom para acessar esta seção.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* FORMULÁRIO DE CADASTRO - Só aparece para quem pode editar */}
      {permissoes?.pode_editar_pranchas && (
        <div className="rounded-xl p-6 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <h3 className="text-xl font-bold text-blue-900 mb-4" style={{color:"var(--color-text)"}}>
            {modoEdicao ? '✏️ Editar Prancha' : '➕ Registrar Nova Prancha'}
          </h3>

        <form onSubmit={modoEdicao ? handleAtualizar : handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Número da Prancha *</label>
              <input
                type="text"
                value={pranchaForm.numero_prancha}
                onChange={(e) => setPranchaForm({ ...pranchaForm, numero_prancha: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                placeholder="Ex: 001/2024"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Data da Prancha *</label>
              <input
                type="date"
                value={pranchaForm.data_prancha}
                onChange={(e) => setPranchaForm({ ...pranchaForm, data_prancha: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Destinatário *</label>
              <input
                type="text"
                value={pranchaForm.destinatario}
                onChange={(e) => setPranchaForm({ ...pranchaForm, destinatario: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                placeholder="Ex: Grande Oriente de Mato Grosso"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Assunto *</label>
              <input
                type="text"
                value={pranchaForm.assunto}
                onChange={(e) => setPranchaForm({ ...pranchaForm, assunto: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
                className="px-6 py-2 border rounded-lg font-semibold hover: transition" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Salvando...' : modoEdicao ? '💾 Atualizar Prancha' : '💾 Registrar Prancha'}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* BUSCA + FILTRO ANO */}
      <div className="rounded-xl p-4 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="🔍 Buscar por número, assunto ou destinatário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",minWidth:'200px'}}
          />
          {/* Seletor de ano */}
          {anosDisponiveis.length >= 1 && (
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
              <span style={{fontSize:'0.75rem',fontWeight:'600',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em',flexShrink:0}}>Ano:</span>
              <select
                value={anoSelecionado ?? ''}
                onChange={e => setAnoSelecionado(e.target.value ? parseInt(e.target.value) : null)}
                style={{padding:'0.3rem 0.75rem',borderRadius:'var(--radius-lg)',border:'1px solid var(--color-border)',background:'var(--color-surface-2)',color:'var(--color-text)',fontSize:'0.85rem',cursor:'pointer',outline:'none'}}
              >
                <option value=''>Todos</option>
                {anosDisponiveis.map(ano => (
                  <option key={ano} value={ano}>{ano}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* LISTA DE PRANCHAS */}
      <div className="rounded-xl overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="p-4 text-white" style={{background:"var(--color-accent)"}}>
          <h3 className="text-xl font-bold" style={{color:"#fff"}}>Pranchas Registradas</h3>
          <p className="text-sm" style={{color:"rgba(255,255,255,0.8)"}}>
            Total: {pranchasFiltradas.length} prancha(s)
          </p>
        </div>

        <div>
          <table className="w-full">
            <thead style={{background:"var(--color-surface-2)",borderBottom:"2px solid var(--color-accent)"}}>
              <tr>
                <th className="px-4 py-3 text-left font-bold w-32" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Número</th>
                <th className="px-4 py-3 text-left font-bold w-32" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Data</th>
                <th className="px-4 py-3 text-left font-bold w-48" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Destinatário</th>
                <th className="px-4 py-3 text-left font-bold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Assunto</th>
                <th className="px-4 py-3 text-center font-bold w-80" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Ações</th>
              </tr>
            </thead>
            </table>
            <div className="p-3 space-y-2" style={{width:"100%",boxSizing:"border-box",overflow:"hidden"}}>
              {(() => {
                const getAnoPrancha = p => p.data_prancha ? new Date(p.data_prancha+'T00:00:00').getFullYear() : new Date().getFullYear();
                const lista = [...pranchasFiltradas].sort((a,b) => new Date(b.data_prancha) - new Date(a.data_prancha));
                if (lista.length === 0) return (
                  <div className="text-center py-8" style={{color:'var(--color-text-faint)'}}>
                    {searchTerm ? 'Nenhuma prancha encontrada' : 'Nenhuma prancha cadastrada'}
                  </div>
                );
                // Agrupar por ano
                const grupos = lista.reduce((acc, p) => {
                  const ano = getAnoPrancha(p);
                  if (!acc[ano]) acc[ano] = [];
                  acc[ano].push(p);
                  return acc;
                }, {});
                const anosGrupo = Object.keys(grupos).map(Number).sort((a,b) => b-a);
                return anosGrupo.map(ano => (
                  <div key={ano}>
                    {/* Cabeçalho do ano */}
                    <div style={{display:'flex',alignItems:'center',gap:'0.75rem',margin:'0.75rem 0 0.5rem',padding:'0.4rem 0.75rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',borderLeft:'3px solid var(--color-accent)'}}>
                      <span style={{fontWeight:'700',fontSize:'0.9rem',color:'var(--color-accent)'}}>📅 {ano}</span>
                      <span style={{fontSize:'0.75rem',color:'var(--color-text-muted)'}}>{grupos[ano].length} prancha(s)</span>
                    </div>
                    {grupos[ano].map((prancha, idx) => (
                      <div key={prancha.id}
                        className="rounded-lg border-l-4 flex items-center gap-3 px-3 py-3 transition-opacity hover:opacity-90"
                        style={{
                          borderLeftColor: 'var(--color-accent)',
                          background: idx%2===0 ? 'var(--color-surface)' : 'var(--color-surface-2)',
                          marginBottom:'0.4rem'
                        }}
                      >
                        <div style={{flexShrink:0,width:'58px'}}>
                          <p className="font-bold text-sm" style={{color:'var(--color-accent)'}}>{prancha.numero_prancha}</p>
                          <p className="text-xs" style={{color:'var(--color-text-muted)'}}>{formatarData(prancha.data_prancha)}</p>
                        </div>
                        <div style={{flexShrink:0,width:'130px',overflow:'hidden'}}>
                          <p className="text-xs font-medium" style={{color:'var(--color-text-muted)'}}>Para:</p>
                          <p className="text-sm" style={{color:'var(--color-text)'}}>{prancha.destinatario}</p>
                        </div>
                        <div style={{flex:1,minWidth:0,overflow:'hidden'}}>
                          <p className="text-sm truncate" style={{color:'var(--color-text)'}}>{prancha.assunto}</p>
                        </div>
                        <div className="flex gap-1.5" style={{flexShrink:0}}>
                          <button onClick={() => handleVisualizar(prancha)}
                            style={{padding:'0.25rem 0.55rem',background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)',borderRadius:'var(--radius-md)',fontSize:'0.82rem',cursor:'pointer'}}
                            title="Visualizar">👁️</button>
                          {permissoes?.pode_editar_pranchas && (<>
                            <button onClick={() => handleEditar(prancha)}
                              style={{padding:'0.25rem 0.55rem',background:'var(--color-accent-bg)',color:'var(--color-accent)',border:'1px solid var(--color-accent)',borderRadius:'var(--radius-md)',fontSize:'0.82rem',cursor:'pointer'}}>✏️</button>
                            <button onClick={() => handleExcluir(prancha.id)}
                              style={{padding:'0.25rem 0.55rem',background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'var(--radius-md)',fontSize:'0.82rem',cursor:'pointer'}}>🗑️</button>
                          </>)}
                        </div>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
        </div>
      </div>

      {/* MODAL DE VISUALIZAÇÃO */}
      {modalVisualizar && pranchaVisualizando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6 rounded-t-xl">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>
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
                <div className="bg-blue-50 p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold text-blue-900 mb-2" style={{color:"var(--color-text-muted)"}}>Número da Prancha</label>
                  <p className="text-lg font-medium">{pranchaVisualizando.numero_prancha}</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold text-blue-900 mb-2" style={{color:"var(--color-text-muted)"}}>Data</label>
                  <p className="text-lg font-medium">{formatarData(pranchaVisualizando.data_prancha)}</p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold text-green-900 mb-2" style={{color:"var(--color-text-muted)"}}>👤 Destinatário</label>
                  <p className="text-lg font-medium">{pranchaVisualizando.destinatario}</p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold text-yellow-900 mb-2" style={{color:"var(--color-text-muted)"}}>📋 Assunto</label>
                  <p className="text-lg">{pranchaVisualizando.assunto}</p>
                </div>
              </div>

              {/* Botão Fechar */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => setModalVisualizar(false)}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg transition-colors"
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
