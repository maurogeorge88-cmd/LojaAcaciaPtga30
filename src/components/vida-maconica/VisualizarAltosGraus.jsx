import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function VisualizarAltosGraus() {
  const [irmaosComGraus, setIrmaosComGraus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroRito, setFiltroRito] = useState('');
  const [irmaoSelecionado, setIrmaoSelecionado] = useState(null);

  useEffect(() => {
    carregarIrmaosComGraus();
  }, []);

  const carregarIrmaosComGraus = async () => {
    setLoading(true);

    const { data: grausData } = await supabase
      .from('vida_maconica')
      .select(`
        *,
        irmao:irmaos(id, nome, cim),
        grau:graus_maconicos(*)
      `)
      .order('irmao_id');

    if (grausData) {
      const irmaosMap = {};
      
      grausData.forEach(item => {
        if (!irmaosMap[item.irmao_id]) {
          irmaosMap[item.irmao_id] = {
            irmao: item.irmao,
            graus: []
          };
        }
        irmaosMap[item.irmao_id].graus.push({
          ...item.grau,
          data_conquista: item.data_conquista,
          loja_conferente: item.loja_conferente,
          oriente_conferente: item.oriente_conferente
        });
      });

      Object.values(irmaosMap).forEach(irmaoData => {
        const grausPorRito = {};
        irmaoData.graus.forEach(grau => {
          if (!grausPorRito[grau.rito]) {
            grausPorRito[grau.rito] = [];
          }
          grausPorRito[grau.rito].push(grau);
        });

        Object.keys(grausPorRito).forEach(rito => {
          grausPorRito[rito].sort((a, b) => a.numero_grau - b.numero_grau);
        });

        irmaoData.grausPorRito = grausPorRito;
      });

      setIrmaosComGraus(Object.values(irmaosMap));
    }

    setLoading(false);
  };

  const irmaosFiltrados = filtroRito
    ? irmaosComGraus.filter(i => i.grausPorRito[filtroRito])
    : irmaosComGraus;

  const ritos = [...new Set(irmaosComGraus.flatMap(i => Object.keys(i.grausPorRito)))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg p-6 shadow-lg">
        <h2 className="text-3xl font-bold mb-2">🔺 Altos Graus Maçônicos</h2>
        <p className="text-indigo-100">Irmãos com graus filosóficos conquistados</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Rito</label>
            <select
              value={filtroRito}
              onChange={(e) => setFiltroRito(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos os Ritos</option>
              {ritos.map(rito => (
                <option key={rito} value={rito}>{rito}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              <strong>{irmaosFiltrados.length}</strong> irmãos encontrados
            </div>
          </div>
        </div>
      </div>

      {irmaosFiltrados.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {irmaosFiltrados.map((irmaoData) => (
            <div key={irmaoData.irmao.id} className="bg-white rounded-lg shadow-lg border-2 border-indigo-100 overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 border-b-2 border-indigo-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-indigo-900">{irmaoData.irmao.nome}</h3>
                    <p className="text-sm text-gray-600">CIM: {irmaoData.irmao.cim}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-indigo-600">{irmaoData.graus.length}</div>
                    <div className="text-xs text-gray-600">{irmaoData.graus.length === 1 ? 'grau' : 'graus'}</div>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {Object.entries(irmaoData.grausPorRito).map(([rito, graus]) => (
                  <div key={rito} className="space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="text-lg font-bold text-indigo-900">{rito}</div>
                      <div className="flex-1 h-px bg-indigo-200"></div>
                      <div className="text-sm text-gray-600">{graus.length} {graus.length === 1 ? 'grau' : 'graus'}</div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {graus.map((grau) => (
                        <div
                          key={grau.numero_grau}
                          className="group relative bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-lg p-3 hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                          onClick={() => setIrmaoSelecionado({ irmao: irmaoData.irmao, grau })}
                        >
                          {grau.imagem_url ? (
                            <div className="flex flex-col items-center">
                              <img 
                                src={grau.imagem_url} 
                                alt={grau.nome_grau}
                                className="w-12 h-12 object-contain mb-1"
                              />
                              <div className="text-xl font-bold">{grau.numero_grau}º</div>
                            </div>
                          ) : (
                            <div className="text-center">
                              <div className="text-2xl font-bold mb-1">{grau.numero_grau}º</div>
                              <div className="text-xs leading-tight">{grau.nome_grau}</div>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-white bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-all"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-6xl mb-4">🔺</div>
          <p className="text-gray-600 text-lg font-medium">Nenhum irmão com graus filosóficos cadastrados</p>
          <p className="text-gray-500 text-sm mt-2">
            {filtroRito ? `Nenhum grau do rito ${filtroRito} encontrado` : 'Cadastre graus no perfil dos irmãos'}
          </p>
        </div>
      )}

      {irmaoSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-indigo-900">Detalhes do Grau</h3>
              <button onClick={() => setIrmaoSelecionado(null)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Irmão</p>
                <p className="font-semibold text-gray-900">{irmaoSelecionado.irmao.nome}</p>
                <p className="text-xs text-gray-500">CIM: {irmaoSelecionado.irmao.cim}</p>
              </div>

              <div className="border-t pt-3">
                <p className="text-3xl font-bold text-indigo-600 mb-2">{irmaoSelecionado.grau.numero_grau}º Grau</p>
                <p className="text-lg font-semibold text-gray-900">{irmaoSelecionado.grau.nome_grau}</p>
                <p className="text-sm text-gray-600 mt-1">Rito: {irmaoSelecionado.grau.rito}</p>
              </div>

              {irmaoSelecionado.grau.data_conquista && (
                <div>
                  <p className="text-sm text-gray-600">Data de Conquista</p>
                  <p className="font-semibold text-gray-900">{irmaoSelecionado.grau.data_conquista.split('-').reverse().join('/')}</p>
                </div>
              )}

              {irmaoSelecionado.grau.loja_conferente && (
                <div>
                  <p className="text-sm text-gray-600">Loja Conferente</p>
                  <p className="font-semibold text-gray-900">{irmaoSelecionado.grau.loja_conferente}</p>
                </div>
              )}

              {irmaoSelecionado.grau.oriente_conferente && (
                <div>
                  <p className="text-sm text-gray-600">Oriente</p>
                  <p className="font-semibold text-gray-900">{irmaoSelecionado.grau.oriente_conferente}</p>
                </div>
              )}

              {irmaoSelecionado.grau.descricao && (
                <div>
                  <p className="text-sm text-gray-600">Descrição</p>
                  <p className="text-sm text-gray-700 italic">{irmaoSelecionado.grau.descricao}</p>
                </div>
              )}
            </div>

            <button onClick={() => setIrmaoSelecionado(null)} className="mt-6 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
