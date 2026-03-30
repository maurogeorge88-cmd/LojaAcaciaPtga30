import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function VidaMaconica({ irmaoId, showSuccess, showError }) {
  const [grausDisponiveis, setGrausDisponiveis] = useState([]);
  const [grausConquistados, setGrausConquistados] = useState([]);
  const [filtroRito, setFiltroRito] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [grauEditando, setGrauEditando] = useState(null);
  
  const [grauForm, setGrauForm] = useState({
    grau_id: '',
    data_conquista: '',
    loja_conferente: '',
    oriente_conferente: '',
    observacoes: ''
  });

  // Carregar graus disponíveis
  useEffect(() => {
    carregarGrausDisponiveis();
    if (irmaoId) {
      carregarGrausConquistados();
    }
  }, [irmaoId]);

  const carregarGrausDisponiveis = async () => {
    const { data } = await supabase
      .from('graus_maconicos')
      .select('*')
      .eq('ativo', true)
      .order('rito')
      .order('numero_grau');
    
    if (data) setGrausDisponiveis(data);
  };

  const carregarGrausConquistados = async () => {
    const { data } = await supabase
      .from('vida_maconica')
      .select(`
        *,
        grau:graus_maconicos(*)
      `)
      .eq('irmao_id', irmaoId);
    
    if (data) {
      // Ordenar por rito e depois por número do grau
      const grausOrdenados = data.sort((a, b) => {
        // Primeiro por rito
        if (a.grau.rito !== b.grau.rito) {
          return a.grau.rito.localeCompare(b.grau.rito);
        }
        // Depois por número do grau (crescente)
        return a.grau.numero_grau - b.grau.numero_grau;
      });
      setGrausConquistados(grausOrdenados);
    }
  };

  const adicionarGrau = async () => {
    if (!grauForm.grau_id || !grauForm.data_conquista) {
      showError('Preencha o grau e a data de conquista');
      return;
    }

    if (modoEdicao) {
      // Está editando
      await salvarEdicaoGrau();
    } else {
      // Está adicionando novo
      const { error } = await supabase
        .from('vida_maconica')
        .insert([{
          irmao_id: irmaoId,
          ...grauForm
        }]);

      if (error) {
        showError('Erro ao adicionar grau: ' + error.message);
      } else {
        showSuccess('Grau adicionado com sucesso!');
        setGrauForm({
          grau_id: '',
          data_conquista: '',
          loja_conferente: '',
          oriente_conferente: '',
          observacoes: ''
        });
        setMostrarFormulario(false);
        carregarGrausConquistados();
      }
    }
  };

  const removerGrau = async (id) => {
    if (!confirm('Deseja remover este grau?')) return;

    const { error } = await supabase
      .from('vida_maconica')
      .delete()
      .eq('id', id);

    if (error) {
      showError('Erro ao remover grau');
    } else {
      showSuccess('Grau removido');
      carregarGrausConquistados();
    }
  };

  const editarGrau = (conquista) => {
    setGrauForm({
      grau_id: conquista.grau_id,
      data_conquista: conquista.data_conquista,
      loja_conferente: conquista.loja_conferente || '',
      oriente_conferente: conquista.oriente_conferente || '',
      observacoes: conquista.observacoes || ''
    });
    setGrauEditando(conquista);
    setModoEdicao(true);
    setMostrarFormulario(true);
  };

  const salvarEdicaoGrau = async () => {
    if (!grauForm.grau_id || !grauForm.data_conquista) {
      showError('Preencha o grau e a data de conquista');
      return;
    }

    const { error } = await supabase
      .from('vida_maconica')
      .update({
        grau_id: grauForm.grau_id,
        data_conquista: grauForm.data_conquista,
        loja_conferente: grauForm.loja_conferente,
        oriente_conferente: grauForm.oriente_conferente,
        observacoes: grauForm.observacoes
      })
      .eq('id', grauEditando.id);

    if (error) {
      showError('Erro ao atualizar grau: ' + error.message);
    } else {
      showSuccess('Grau atualizado com sucesso!');
      cancelarEdicao();
      carregarGrausConquistados();
    }
  };

  const cancelarEdicao = () => {
    setGrauForm({
      grau_id: '',
      data_conquista: '',
      loja_conferente: '',
      oriente_conferente: '',
      observacoes: ''
    });
    setModoEdicao(false);
    setGrauEditando(null);
    setMostrarFormulario(false);
  };

  const grausFiltrados = filtroRito 
    ? grausDisponiveis.filter(g => g.rito === filtroRito)
    : grausDisponiveis;

  const ritos = [...new Set(grausDisponiveis.map(g => g.rito))];

  const grauSelecionado = grausDisponiveis.find(g => g.id === parseInt(grauForm.grau_id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>🔺 Vida Maçônica</h3>
          <p className="mt-1">Graus filosóficos conquistados</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (mostrarFormulario) {
              cancelarEdicao(); // Limpa tudo ao cancelar
            }
            setMostrarFormulario(!mostrarFormulario);
          }}
          className={`px-4 py-2 ${modoEdicao ? 'bg-primary-600 hover:bg-primary-600' : 'bg-primary-600 hover:bg-primary-600'} text-white rounded-lg transition-colors`}
        >
          {mostrarFormulario ? '✖️ Cancelar' : '➕ Adicionar Grau'}
        </button>
      </div>

      {/* Formulário */}
      {mostrarFormulario && (
        <div className="p-6 rounded-lg border-l-4" style={{background:"var(--color-surface-2)",borderLeftColor:modoEdicao?"#f59e0b":"var(--color-accent)",border:"1px solid var(--color-border)"}}>
          <h4 className="text-lg font-bold mb-4" style={{color:"var(--color-text)"}}>
            {modoEdicao ? '✏️ Editar Grau' : '➕ Adicionar Novo Grau'}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Filtro de Rito */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                Filtrar por Rito
              </label>
              <select
                value={filtroRito}
                onChange={(e) => setFiltroRito(e.target.value)}
                className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
              >
                <option value="">Todos os Ritos</option>
                {ritos.map(rito => (
                  <option key={rito} value={rito}>{rito}</option>
                ))}
              </select>
            </div>

            {/* Seleção de Grau */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                Grau Conquistado *
              </label>
              <select
                value={grauForm.grau_id}
                onChange={(e) => setGrauForm({ ...grauForm, grau_id: e.target.value })}
                className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
              >
                <option value="">Selecione o grau</option>
                {grausFiltrados.map(grau => (
                  <option key={grau.id} value={grau.id}>
                    {grau.numero_grau}º - {grau.nome_grau} ({grau.rito})
                  </option>
                ))}
              </select>
            </div>

            {/* Data de Conquista */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                Data de Conquista *
              </label>
              <input
                type="date"
                value={grauForm.data_conquista}
                onChange={(e) => setGrauForm({ ...grauForm, data_conquista: e.target.value })}
                className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
              />
            </div>

            {/* Loja Conferente */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                Loja Conferente
              </label>
              <input
                type="text"
                value={grauForm.loja_conferente}
                onChange={(e) => setGrauForm({ ...grauForm, loja_conferente: e.target.value })}
                className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
              />
            </div>

            {/* Oriente Conferente */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                Oriente Conferente
              </label>
              <input
                type="text"
                value={grauForm.oriente_conferente}
                onChange={(e) => setGrauForm({ ...grauForm, oriente_conferente: e.target.value })}
                className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
              />
            </div>

            {/* Observações */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                Observações
              </label>
              <textarea
                value={grauForm.observacoes}
                onChange={(e) => setGrauForm({ ...grauForm, observacoes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
              />
            </div>
          </div>

          {/* Preview do Grau Selecionado */}
          {grauSelecionado && (
            <div className="mt-4 p-4 rounded flex gap-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              {grauSelecionado.imagem_url && (
                <img 
                  src={grauSelecionado.imagem_url} 
                  alt={grauSelecionado.nome_grau}
                  className="w-20 h-20 object-contain rounded"
                />
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{color:"var(--color-text)"}}>
                  🔺 {grauSelecionado.numero_grau}º Grau - {grauSelecionado.nome_grau}
                </p>
              <p className="text-xs mt-1">
                Rito: {grauSelecionado.rito}
              </p>
              {grauSelecionado.descricao && (
                <p className="text-xs mt-1">{grauSelecionado.descricao}</p>
              )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={adicionarGrau}
            style={{marginTop:"1rem",padding:"0.5rem 1rem",background:modoEdicao?"#d97706":"#059669",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",fontWeight:"600",cursor:"pointer"}}
          >
            {modoEdicao ? '💾 Atualizar Grau' : '💾 Salvar Grau'}
          </button>
        </div>
      )}

      {/* Lista de Graus Conquistados */}
      {grausConquistados.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-lg font-bold" style={{color:"var(--color-text)"}}>Graus Conquistados ({grausConquistados.length})</h4>
          {grausConquistados.map((conquista) => (
            <div
              key={conquista.id}
              className="rounded-lg p-4 hover: transition-shadow"
             style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    {conquista.grau.imagem_url ? (
                      <img 
                        src={conquista.grau.imagem_url} 
                        alt={conquista.grau.nome_grau}
                        className="w-20 h-20 object-contain rounded"
                      />
                    ) : (
                      <div className="text-3xl">🔺</div>
                    )}
                    <div>
                      <h5 className="text-lg font-bold text-indigo-900">
                        {conquista.grau.numero_grau}º - {conquista.grau.nome_grau}
                      </h5>
                      <p className="text-sm">
                        Rito: {conquista.grau.rito}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-semibold">Data:</span>{' '}
                      {conquista.data_conquista.split('-').reverse().join('/')}
                    </div>
                    {conquista.loja_conferente && (
                      <div>
                        <span className="font-semibold">Loja:</span>{' '}
                        {conquista.loja_conferente}
                      </div>
                    )}
                    {conquista.oriente_conferente && (
                      <div>
                        <span className="font-semibold">Oriente:</span>{' '}
                        {conquista.oriente_conferente}
                      </div>
                    )}
                  </div>

                  {conquista.observacoes && (
                    <div className="mt-2 text-sm italic">
                      {conquista.observacoes}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    type="button"
                    onClick={() => editarGrau(conquista)}
                    style={{padding:"0.25rem 0.55rem",background:"rgba(245,158,11,0.15)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                    title="Editar grau"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => removerGrau(conquista.id)}
                    className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                    title="Remover grau"
                  >
                    🗑️ Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 rounded-lg border-2 border-dashed" style={{background:"var(--color-surface-2)",borderColor:"var(--color-border)"}} style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <div className="text-6xl mb-4">🔺</div>
          <p className="text-lg font-medium">
            Nenhum grau filosófico cadastrado
          </p>
          <p className="text-sm mt-2">
            Clique em "Adicionar Grau" para começar
          </p>
        </div>
      )}
    </div>
  );
}
