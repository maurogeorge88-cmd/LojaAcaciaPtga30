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
          <h3 className="text-2xl font-bold text-gray-900">🔺 Vida Maçônica</h3>
          <p className="text-gray-600 mt-1">Graus filosóficos conquistados</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (mostrarFormulario) {
              cancelarEdicao(); // Limpa tudo ao cancelar
            }
            setMostrarFormulario(!mostrarFormulario);
          }}
          className={`px-4 py-2 ${modoEdicao ? 'bg-gray-600 hover:bg-gray-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-lg transition-colors`}
        >
          {mostrarFormulario ? '✖️ Cancelar' : '➕ Adicionar Grau'}
        </button>
      </div>

      {/* Formulário */}
      {mostrarFormulario && (
        <div className={`p-6 rounded-lg border-2 ${modoEdicao ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'}`}>
          <h4 className="text-lg font-bold text-gray-900 mb-4">
            {modoEdicao ? '✏️ Editar Grau' : '➕ Adicionar Novo Grau'}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Filtro de Rito */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filtrar por Rito
              </label>
              <select
                value={filtroRito}
                onChange={(e) => setFiltroRito(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Todos os Ritos</option>
                {ritos.map(rito => (
                  <option key={rito} value={rito}>{rito}</option>
                ))}
              </select>
            </div>

            {/* Seleção de Grau */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grau Conquistado *
              </label>
              <select
                value={grauForm.grau_id}
                onChange={(e) => setGrauForm({ ...grauForm, grau_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de Conquista *
              </label>
              <input
                type="date"
                value={grauForm.data_conquista}
                onChange={(e) => setGrauForm({ ...grauForm, data_conquista: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Loja Conferente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Loja Conferente
              </label>
              <input
                type="text"
                value={grauForm.loja_conferente}
                onChange={(e) => setGrauForm({ ...grauForm, loja_conferente: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Oriente Conferente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Oriente Conferente
              </label>
              <input
                type="text"
                value={grauForm.oriente_conferente}
                onChange={(e) => setGrauForm({ ...grauForm, oriente_conferente: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Observações */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                value={grauForm.observacoes}
                onChange={(e) => setGrauForm({ ...grauForm, observacoes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Preview do Grau Selecionado */}
          {grauSelecionado && (
            <div className="mt-4 p-4 bg-white rounded border border-indigo-200 flex gap-4">
              {grauSelecionado.imagem_url && (
                <img 
                  src={grauSelecionado.imagem_url} 
                  alt={grauSelecionado.nome_grau}
                  className="w-20 h-20 object-contain rounded"
                />
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold text-indigo-900">
                  🔺 {grauSelecionado.numero_grau}º Grau - {grauSelecionado.nome_grau}
                </p>
              <p className="text-xs text-gray-600 mt-1">
                Rito: {grauSelecionado.rito}
              </p>
              {grauSelecionado.descricao && (
                <p className="text-xs text-gray-500 mt-1">{grauSelecionado.descricao}</p>
              )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={adicionarGrau}
            className={`mt-4 px-4 py-2 text-white rounded transition-colors ${
              modoEdicao ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {modoEdicao ? '💾 Atualizar Grau' : '💾 Salvar Grau'}
          </button>
        </div>
      )}

      {/* Lista de Graus Conquistados */}
      {grausConquistados.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-lg font-bold text-gray-900">Graus Conquistados ({grausConquistados.length})</h4>
          {grausConquistados.map((conquista) => (
            <div
              key={conquista.id}
              className="bg-white border-2 border-indigo-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
            >
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
                      <p className="text-sm text-gray-600">
                        Rito: {conquista.grau.rito}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-semibold text-gray-700">Data:</span>{' '}
                      {conquista.data_conquista.split('-').reverse().join('/')}
                    </div>
                    {conquista.loja_conferente && (
                      <div>
                        <span className="font-semibold text-gray-700">Loja:</span>{' '}
                        {conquista.loja_conferente}
                      </div>
                    )}
                    {conquista.oriente_conferente && (
                      <div>
                        <span className="font-semibold text-gray-700">Oriente:</span>{' '}
                        {conquista.oriente_conferente}
                      </div>
                    )}
                  </div>

                  {conquista.observacoes && (
                    <div className="mt-2 text-sm text-gray-600 italic">
                      {conquista.observacoes}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    type="button"
                    onClick={() => editarGrau(conquista)}
                    className="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600 transition-colors"
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
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-6xl mb-4">🔺</div>
          <p className="text-gray-600 text-lg font-medium">
            Nenhum grau filosófico cadastrado
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Clique em "Adicionar Grau" para começar
          </p>
        </div>
      )}
    </div>
  );
}
