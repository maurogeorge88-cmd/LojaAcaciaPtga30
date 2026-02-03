import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const ParticipacaoComissoes = () => {
  const [aba, setAba] = useState('irmao'); // 'irmao' ou 'comissao'
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      // Buscar todas as relações comissão-integrante com JOIN
      const { data, error } = await supabase
        .from('comissoes_integrantes')
        .select(`
          funcao,
          comissoes!inner (
            id,
            nome,
            status,
            origem
          ),
          irmaos!inner (
            id,
            nome,
            cim,
            situacao
          )
        `)
        .eq('comissoes.status', 'em_andamento')
        .eq('irmaos.situacao', 'regular')
        .order('irmaos.nome');

      if (error) throw error;
      setDados(data || []);
    } catch (error) {
      console.error('Erro ao carregar participações:', error);
    } finally {
      setLoading(false);
    }
  };

  // Agrupar por irmão
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

  // Agrupar por comissão
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
    
    // Ordenar integrantes por função (Presidente > Secretário > Tesoureiro > Membro)
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

  // Badge de função
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
      <span className={`px-2 py-1 rounded text-xs font-semibold ${cores[funcao] || cores.Membro}`}>
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

  // Se não há dados
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
      {/* Header com abas */}
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

      {/* Conteúdo */}
      <div className="p-4">
        {aba === 'irmao' ? (
          // VISUALIZAÇÃO POR IRMÃO
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {porIrmao.map((irmao, index) => (
              <div key={index} className="border-2 border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-3xl">👤</span>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900">{irmao.nome}</h4>
                    <p className="text-xs text-gray-500">CIM {irmao.cim}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {irmao.comissoes.map((com, idx) => (
                    <div key={idx} className="bg-gray-50 p-2 rounded border-l-4 border-primary-500">
                      <p className="text-sm font-medium text-gray-800">{com.nome}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getBadgeFuncao(com.funcao)}
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          com.origem === 'interna' 
                            ? 'bg-blue-50 text-blue-700' 
                            : 'bg-purple-50 text-purple-700'
                        }`}>
                          {com.origem === 'interna' ? '🏛️ Interna' : '🌐 Externa'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // VISUALIZAÇÃO POR COMISSÃO
          <div className="space-y-4">
            {porComissao.map((comissao, index) => (
              <div key={index} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                <div className={`p-4 ${
                  comissao.origem === 'interna' 
                    ? 'bg-blue-50 border-l-4 border-blue-500' 
                    : 'bg-purple-50 border-l-4 border-purple-500'
                }`}>
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-900 text-lg">{comissao.nome}</h4>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        🟢 Em Andamento
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        comissao.origem === 'interna'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {comissao.origem === 'interna' ? '🏛️ Interna' : '🌐 Externa'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  <p className="text-xs font-semibold text-gray-600 mb-3">
                    INTEGRANTES ({comissao.integrantes.length})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {comissao.integrantes.map((integrante, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded border border-gray-200">
                        <div>
                          <p className="font-semibold text-gray-900">{integrante.nome}</p>
                          <p className="text-xs text-gray-500">CIM {integrante.cim}</p>
                        </div>
                        {getBadgeFuncao(integrante.funcao)}
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
