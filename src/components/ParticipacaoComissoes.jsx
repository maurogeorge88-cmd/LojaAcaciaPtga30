import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const ParticipacaoComissoes = () => {
  const [aba, setAba] = useState('irmao');
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      // Buscar integrantes
      const { data: integrantes, error: errorIntegrantes } = await supabase
        .from('comissoes_integrantes')
        .select('funcao, comissao_id, irmao_id');

      if (errorIntegrantes) throw errorIntegrantes;
      if (!integrantes || integrantes.length === 0) {
        setDados([]);
        setLoading(false);
        return;
      }

      // Buscar comissões em andamento
      const { data: comissoes, error: errorComissoes } = await supabase
        .from('comissoes')
        .select('id, nome, status, origem')
        .eq('status', 'em_andamento');

      if (errorComissoes) throw errorComissoes;

      // Buscar irmãos regulares
      const { data: irmaos, error: errorIrmaos } = await supabase
        .from('irmaos')
        .select('id, nome, cim, situacao')
        .eq('situacao', 'regular');

      if (errorIrmaos) throw errorIrmaos;

      // Fazer o join manual
      const dadosCompletos = integrantes
        .map(integrante => {
          const comissao = comissoes?.find(c => c.id === integrante.comissao_id);
          const irmao = irmaos?.find(i => i.id === integrante.irmao_id);
          
          if (!comissao || !irmao) return null;
          
          return {
            funcao: integrante.funcao,
            comissoes: comissao,
            irmaos: irmao
          };
        })
        .filter(item => item !== null);

      setDados(dadosCompletos);
    } catch (error) {
      console.error('Erro ao carregar participações:', error);
    } finally {
      setLoading(false);
    }
  };

  const agruparPorIrmao = () => {
    const grupos = {};
    
    dados.forEach(item => {
      const irmaoId = item.irmaos.id;
      
      if (!grupos[irmaoId]) {
        grupos[irmaoId] = {
          nome: item.irmaos.nome,
          cim: item.irmaos.cim,
          comissoes: []
        };
      }
      
      grupos[irmaoId].comissoes.push({
        nome: item.comissoes.nome,
        funcao: item.funcao,
        origem: item.comissoes.origem
      });
    });
    
    return Object.values(grupos).sort((a, b) => a.nome.localeCompare(b.nome));
  };

  const agruparPorComissao = () => {
    const grupos = {};
    
    dados.forEach(item => {
      const comissaoId = item.comissoes.id;
      
      if (!grupos[comissaoId]) {
        grupos[comissaoId] = {
          nome: item.comissoes.nome,
          status: item.comissoes.status,
          origem: item.comissoes.origem,
          integrantes: []
        };
      }
      
      grupos[comissaoId].integrantes.push({
        nome: item.irmaos.nome,
        cim: item.irmaos.cim,
        funcao: item.funcao
      });
    });
    
    Object.values(grupos).forEach(grupo => {
      const ordemFuncao = {
        'Presidente': 1,
        'Vice-Presidente': 2,
        'Secretário': 3,
        'Tesoureiro': 4,
        'Membro': 5
      };
      
      grupo.integrantes.sort((a, b) => {
        const ordemA = ordemFuncao[a.funcao] || 999;
        const ordemB = ordemFuncao[b.funcao] || 999;
        return ordemA - ordemB;
      });
    });
    
    return Object.values(grupos).sort((a, b) => a.nome.localeCompare(b.nome));
  };

  const getBadgeFuncao = (funcao) => {
    const cores = {
      'Presidente': 'bg-blue-100 text-blue-800',
      'Vice-Presidente': 'bg-indigo-100 text-indigo-800',
      'Secretário': 'bg-green-100 text-green-800',
      'Tesoureiro': 'bg-yellow-100 text-yellow-800',
      'Membro': 'bg-gray-100 text-gray-800'
    };
    
    const icones = {
      'Presidente': '👑',
      'Vice-Presidente': '👔',
      'Secretário': '📝',
      'Tesoureiro': '💰',
      'Membro': '👤'
    };
    
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${cores[funcao] || cores.Membro}`}>
        {icones[funcao] || icones.Membro} {funcao}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <p className="text-center text-gray-500">⏳ Carregando participações...</p>
      </div>
    );
  }

  const porIrmao = agruparPorIrmao();
  const porComissao = agruparPorComissao();

  if (dados.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-2">📋 Participação em Comissões</h3>
        <p className="text-center text-gray-500 py-4">Nenhuma participação em comissões ativas</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-4">
        <h3 className="text-lg font-bold text-white mb-3">📋 Participação em Comissões</h3>
        
        <div className="flex gap-2">
          <button
            onClick={() => setAba('irmao')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              aba === 'irmao'
                ? 'bg-white text-primary-700'
                : 'bg-primary-500 text-white hover:bg-primary-400'
            }`}
          >
            👥 Por Irmão ({porIrmao.length})
          </button>
          <button
            onClick={() => setAba('comissao')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              aba === 'comissao'
                ? 'bg-white text-primary-700'
                : 'bg-primary-500 text-white hover:bg-primary-400'
            }`}
          >
            📊 Por Comissão ({porComissao.length})
          </button>
        </div>
      </div>

      <div className="p-4">
        {aba === 'irmao' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {porIrmao.map((irmao, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-2xl">👤</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-gray-900 truncate" title={irmao.nome}>{irmao.nome}</h4>
                    <p className="text-xs text-gray-500">CIM {irmao.cim}</p>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  {irmao.comissoes.map((com, idx) => (
                    <div key={idx} className="bg-gray-50 p-1.5 rounded border-l-2 border-primary-500">
                      <p className="text-xs font-medium text-gray-800 truncate" title={com.nome}>{com.nome}</p>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {getBadgeFuncao(com.funcao)}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          com.origem === 'interna' 
                            ? 'bg-blue-50 text-blue-700' 
                            : 'bg-purple-50 text-purple-700'
                        }`}>
                          {com.origem === 'interna' ? '🏛️' : '🌐'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {porComissao.map((comissao, index) => (
              <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className={`p-3 ${
                  comissao.origem === 'interna' 
                    ? 'bg-blue-50 border-l-4 border-blue-500' 
                    : 'bg-purple-50 border-l-4 border-purple-500'
                }`}>
                  <h4 className="font-bold text-gray-900 text-sm mb-2" title={comissao.nome}>{comissao.nome}</h4>
                  <div className="flex gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800">
                      🟢 Em Andamento
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      comissao.origem === 'interna'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {comissao.origem === 'interna' ? '🏛️ Interna' : '🌐 Externa'}
                    </span>
                  </div>
                </div>
                
                <div className="p-3">
                  <p className="text-[10px] font-semibold text-gray-600 mb-2">
                    INTEGRANTES ({comissao.integrantes.length})
                  </p>
                  <div className="space-y-2">
                    {comissao.integrantes.map((integrante, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-xs text-gray-900 truncate" title={integrante.nome}>{integrante.nome}</p>
                          <p className="text-[10px] text-gray-500">CIM {integrante.cim}</p>
                        </div>
                        <div className="ml-2">
                          {getBadgeFuncao(integrante.funcao)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipacaoComissoes;
