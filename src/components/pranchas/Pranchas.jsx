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

  // Filtrar pranchas por busca
  const pranchasFiltradas = pranchas.filter(p => 
    !searchTerm || 
    p.numero_prancha?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.assunto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.destinatario?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      {/* BUSCA */}
      <div className="rounded-xl p-4 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="🔍 Buscar por número, assunto ou destinatário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
          />
        </div>
      </div>

      {/* LISTA DE PRANCHAS */}
      <div className="rounded-xl overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="p-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
          <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>Pranchas Registradas</h3>
          <p className="text-sm text-blue-100">
            Total: {pranchasFiltradas.length} prancha(s)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
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
            <div className="p-3 space-y-2">
              {pranchasFiltradas.length > 0 ? (
                pranchasFiltradas
                  .sort((a, b) => new Date(b.data_prancha) - new Date(a.data_prancha))
                  .map((prancha, idx) => (
                    <div key={prancha.id}
                      className="rounded-lg border-l-4 flex items-center gap-4 px-4 py-3 transition-opacity hover:opacity-90"
                      style={{
                        borderLeftColor: 'var(--color-accent)',
                        background: idx%2===0 ? 'var(--color-surface)' : 'var(--color-surface-2)'
                      }}
                    >
                      {/* Número */}
                      <div style={{flexShrink:0,minWidth:'60px'}}>
                        <p className="font-bold text-sm" style={{color:'var(--color-accent)'}}>{prancha.numero_prancha}</p>
                        <p className="text-xs" style={{color:'var(--color-text-muted)'}}>{formatarData(prancha.data_prancha)}</p>
                      </div>
                      {/* Destinatário */}
                      <div style={{flexShrink:0,minWidth:'140px'}}>
                        <p className="text-xs font-medium" style={{color:'var(--color-text-muted)'}}>Para:</p>
                        <p className="text-sm" style={{color:'var(--color-text)'}}>{prancha.destinatario}</p>
                      </div>
                      {/* Assunto */}
                      <div style={{flex:1,minWidth:0}}>
                        <p className="text-sm truncate" style={{color:'var(--color-text)'}}>{prancha.assunto}</p>
                      </div>
                      {/* Ações */}
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
                  ))
              ) : (
                <div className="text-center py-8" style={{color:'var(--color-text-faint)'}}>
                  {searchTerm ? 'Nenhuma prancha encontrada com os critérios de busca' : 'Nenhuma prancha cadastrada'}
                </div>
              )}
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
