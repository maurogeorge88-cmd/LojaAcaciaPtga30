import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const ListaPresenca = ({ balaustres, irmaos, showSuccess, showError }) => {
  const [balausteSelecionado, setBalausteSelecionado] = useState('');
  const [presencas, setPresencas] = useState({});
  const [loading, setLoading] = useState(false);

  const irmaosAtivos = irmaos.filter(i => {
    const sit = (i.situacao || 'regular').toLowerCase();
    return sit === 'regular' || sit === 'licenciado';
  });

  const handleTogglePresenca = (irmaoId) => {
    setPresencas(prev => ({
      ...prev,
      [irmaoId]: !prev[irmaoId]
    }));
  };

  const handleMarcarTodos = (presente) => {
    const novasPresencas = {};
    irmaosAtivos.forEach(irmao => {
      novasPresencas[irmao.id] = presente;
    });
    setPresencas(novasPresencas);
  };

  const handleSalvar = async () => {
    if (!balausteSelecionado) {
      showError('Selecione um balaustre');
      return;
    }

    setLoading(true);
    try {
      const presencasArray = Object.entries(presencas)
        .filter(([_, presente]) => presente)
        .map(([irmaoId]) => ({
          balaustre_id: balausteSelecionado,
          irmao_id: parseInt(irmaoId),
          presente: true
        }));

      // Deletar presencas antigas deste balaustre
      await supabase
        .from('presencas')
        .delete()
        .eq('balaustre_id', balausteSelecionado);

      // Inserir novas presencas
      if (presencasArray.length > 0) {
        const { error } = await supabase
          .from('presencas')
          .insert(presencasArray);

        if (error) throw error;
      }

      showSuccess('Lista de presenca salva!');
    } catch (error) {
      showError('Erro ao salvar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const carregarPresencas = async (balausterId) => {
    try {
      const { data, error } = await supabase
        .from('presencas')
        .select('irmao_id')
        .eq('balaustre_id', balausterId);

      if (error) throw error;

      const novasPresencas = {};
      data.forEach(p => {
        novasPresencas[p.irmao_id] = true;
      });
      setPresencas(novasPresencas);
    } catch (error) {
      showError('Erro ao carregar presencas');
    }
  };

  useEffect(() => {
    if (balausteSelecionado) {
      carregarPresencas(balausteSelecionado);
    }
  }, [balausteSelecionado]);

  const totalPresentes = Object.values(presencas).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Lista de Presenca</h2>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecione o Balaustre
          </label>
          <select
            value={balausteSelecionado}
            onChange={(e) => setBalausteSelecionado(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione...</option>
            {balaustres.map(b => (
              <option key={b.id} value={b.id}>
                Balaustre {b.numero} - {b.data} - {b.tipo_sessao}
              </option>
            ))}
          </select>
        </div>

        {balausteSelecionado && (
          <>
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => handleMarcarTodos(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Marcar Todos
              </button>
              <button
                onClick={() => handleMarcarTodos(false)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Desmarcar Todos
              </button>
              <div className="flex-1 text-right">
                <span className="text-lg font-semibold">
                  Presentes: {totalPresentes} / {irmaosAtivos.length}
                </span>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {irmaosAtivos.map(irmao => (
                <label
                  key={irmao.id}
                  className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={presencas[irmao.id] || false}
                    onChange={() => handleTogglePresenca(irmao.id)}
                    className="w-5 h-5 text-blue-600"
                  />
                  <span className="ml-3 flex-1">
                    <span className="font-semibold">{irmao.nome}</span>
                    <span className="text-sm text-gray-600 ml-2">CIM: {irmao.cim}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-6">
              <button
                onClick={handleSalvar}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Salvando...' : 'Salvar Lista de Presenca'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ListaPresenca;
