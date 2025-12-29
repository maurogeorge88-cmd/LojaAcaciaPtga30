import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ModalGradePresenca({ onFechar }) {
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [grade, setGrade] = useState({});
  const [busca, setBusca] = useState('');

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    try {
      setLoading(true);

      // 1. Buscar TODAS as sessões
      const { data: sessoesData } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id')
        .order('data_sessao');

      console.log('Sessões:', sessoesData?.length);

      // 2. Buscar TODOS os irmãos (incluir datas de grau e ingresso)
      const { data: irmaosData } = await supabase
        .from('irmaos')
        .select('id, nome, data_nascimento, data_licenca, data_falecimento, data_desligamento, data_iniciacao, data_elevacao, data_exaltacao, data_ingresso_loja, situacao, status')
        .order('nome');

      console.log('Irmãos:', irmaosData?.length);

      // Filtrar: remover falecidos/desligados de MESES ANTERIORES
      const hoje = new Date();
      const mesAtual = hoje.getMonth();
      const anoAtual = hoje.getFullYear();

      const irmaosValidos = irmaosData.filter(i => {
        if (i.data_falecimento) {
          const dataFalec = new Date(i.data_falecimento);
          // Se faleceu em mês anterior, remove
          if (dataFalec.getFullYear() < anoAtual || 
             (dataFalec.getFullYear() === anoAtual && dataFalec.getMonth() < mesAtual)) {
            return false;
          }
        }
        if (i.data_desligamento) {
          const dataDeslg = new Date(i.data_desligamento);
          // Se desligou em mês anterior, remove
          if (dataDeslg.getFullYear() < anoAtual || 
             (dataDeslg.getFullYear() === anoAtual && dataDeslg.getMonth() < mesAtual)) {
            return false;
          }
        }
        return true;
      });

      // Adicionar flags de prerrogativa
      const irmaosComFlags = irmaosValidos.map(i => {
        let idade = null;
        let dataPrerrogativa = null;
        
        if (i.data_nascimento) {
          const nasc = new Date(i.data_nascimento);
          const hoje = new Date();
          idade = hoje.getFullYear() - nasc.getFullYear();
          if (hoje.getMonth() < nasc.getMonth() || 
             (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) {
            idade--;
          }
          
          if (idade >= 70) {
            dataPrerrogativa = new Date(nasc);
            dataPrerrogativa.setFullYear(nasc.getFullYear() + 70);
          }
        }
        
        return {
          ...i,
          idade,
          data_prerrogativa: dataPrerrogativa
        };
      });

      // 3. Buscar TODOS os registros em lotes (paginação)
      const sessaoIds = sessoesData?.map(s => s.id) || [];
      
      let todosRegistros = [];
      let inicio = 0;
      const tamanhoPagina = 1000;
      let continuar = true;

      while (continuar) {
        const { data: lote } = await supabase
          .from('registros_presenca')
          .select('membro_id, sessao_id, presente, justificativa')
          .in('sessao_id', sessaoIds)
          .range(inicio, inicio + tamanhoPagina - 1);

        if (lote && lote.length > 0) {
          todosRegistros = [...todosRegistros, ...lote];
          inicio += tamanhoPagina;
          
          // Se retornou menos que o tamanho da página, acabou
          if (lote.length < tamanhoPagina) {
            continuar = false;
          }
        } else {
          continuar = false;
        }
      }

      console.log('📊 Registros carregados:', todosRegistros.length);

      // Criar grade agrupando por irmão
      const gradeCompleta = {};
      todosRegistros.forEach(reg => {
        if (!gradeCompleta[reg.membro_id]) {
          gradeCompleta[reg.membro_id] = {};
        }
        gradeCompleta[reg.membro_id][reg.sessao_id] = {
          presente: reg.presente,
          justificativa: reg.justificativa
        };
      });

      console.log('Grade montada');

      setSessoes(sessoesData || []);
      setIrmaos(irmaosComFlags || []);
      setGrade(gradeCompleta);

    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data) => {
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit' 
    });
  };

  const renderizarCelula = (irmaoId, sessaoId) => {
    const reg = grade[irmaoId]?.[sessaoId];
    const irmao = irmaos.find(i => i.id === irmaoId);
    const sessao = sessoes.find(s => s.id === sessaoId);
    
    if (!irmao || !sessao) {
      return (
        <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-gray-100">
          <span className="text-gray-400">-</span>
        </td>
      );
    }

    const dataSessao = new Date(sessao.data_sessao);
    
    // 1. Verificar se sessão é ANTES da iniciação OU ingresso na loja
    const dataIniciacao = irmao.data_iniciacao ? new Date(irmao.data_iniciacao) : null;
    const dataIngresso = irmao.data_ingresso_loja ? new Date(irmao.data_ingresso_loja) : null;
    const dataInicio = dataIniciacao || dataIngresso;
    
    // Debug para Michel
    if (irmao.nome.includes('Michel')) {
      console.log('Michel:', {
        sessao: sessao.data_sessao,
        dataIniciacao,
        dataIngresso,
        dataInicio,
        antes: dataInicio && dataSessao < dataInicio
      });
    }
    
    if (dataInicio && dataSessao < dataInicio) {
      // Sessão antes de iniciar/ingressar → não se aplica
      return (
        <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-gray-100">
          <span className="text-gray-400">-</span>
        </td>
      );
    }

    // 2. Calcular grau do irmão
    let grauIrmao = 0;
    if (irmao.data_exaltacao) grauIrmao = 3;
    else if (irmao.data_elevacao) grauIrmao = 2;
    else if (irmao.data_iniciacao) grauIrmao = 1;

    // 3. Verificar grau da sessão
    const grauSessao = sessao.grau_sessao_id || 1;

    // 4. Se sessão é de grau superior ao do irmão → não pode participar
    if (grauSessao > grauIrmao) {
      return (
        <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-gray-100">
          <span className="text-gray-400">-</span>
        </td>
      );
    }

    // 5. Verificar se computa (prerrogativa/licença/falecimento/desligamento)
    let computa = true;
    
    if (irmao.data_prerrogativa) {
      const dataPrer = new Date(irmao.data_prerrogativa);
      if (dataSessao >= dataPrer) computa = false;
    }
    if (irmao.data_licenca) {
      const dataLic = new Date(irmao.data_licenca);
      if (dataSessao >= dataLic) computa = false;
    }
    if (irmao.data_falecimento) {
      const dataFalec = new Date(irmao.data_falecimento);
      if (dataSessao >= dataFalec) computa = false;
    }
    if (irmao.data_desligamento) {
      const dataDeslg = new Date(irmao.data_desligamento);
      if (dataSessao >= dataDeslg) computa = false;
    }

    // Se NÃO TEM registro
    if (!reg) {
      // Se não computa, mostra - (sem obrigação)
      if (!computa) {
        return (
          <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-gray-100">
            <span className="text-gray-400">-</span>
          </td>
        );
      }
      // Se computa, mostra ausência (✗ vermelho)
      return (
        <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-red-50">
          <span className="text-red-600 text-lg font-bold">✗</span>
        </td>
      );
    }

    // Se TEM registro e não computa
    if (!computa) {
      // Se veio (presente), mostra ✓ normal
      if (reg.presente) {
        return (
          <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-green-50">
            <span className="text-green-600 text-lg font-bold">✓</span>
          </td>
        );
      }
      // Se ausente (não computa), mostra -
      return (
        <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-gray-100">
          <span className="text-gray-400">-</span>
        </td>
      );
    }

    // Computa normalmente
    if (reg.presente) {
      return (
        <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-green-50">
          <span className="text-green-600 text-lg font-bold">✓</span>
        </td>
      );
    }

    if (reg.justificativa) {
      return (
        <td 
          key={sessaoId} 
          className="border border-gray-300 px-2 py-2 text-center bg-yellow-50"
          title={reg.justificativa}
        >
          <span className="text-yellow-600 text-lg font-bold">J</span>
        </td>
      );
    }

    return (
      <td key={sessaoId} className="border border-gray-300 px-2 py-2 text-center bg-red-50">
        <span className="text-red-600 text-lg font-bold">✗</span>
      </td>
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg">
          <div className="text-center">Carregando grade...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full h-[90vh] max-w-[95vw] flex flex-col">
        
        {/* Cabeçalho */}
        <div className="bg-blue-600 text-white p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold">Grade de Presença</h2>
              <p className="text-sm text-blue-100 mt-1">
                {sessoes.length} sessões • {irmaos.length} irmãos
              </p>
            </div>
            <button
              onClick={onFechar}
              className="hover:bg-blue-700 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Campo de Busca */}
          <input
            type="text"
            placeholder="🔍 Buscar irmão..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full px-4 py-2 rounded text-gray-800 placeholder-gray-500"
          />
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="border border-gray-300 px-4 py-3 text-left font-semibold bg-gray-100 sticky left-0 z-10">
                  Irmão
                </th>
                {sessoes.map(s => (
                  <th key={s.id} className="border border-gray-300 px-2 py-2 text-center whitespace-nowrap">
                    {formatarData(s.data_sessao)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {irmaos
                .filter(irmao => 
                  busca === '' || irmao.nome.toLowerCase().includes(busca.toLowerCase())
                )
                .map(irmao => (
                <tr key={irmao.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-3 font-medium bg-white sticky left-0 z-10">
                    <div>{irmao.nome.split(' ').slice(0, 2).join(' ')}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {irmao.situacao === 'licenciado' && irmao.data_licenca && (
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                          Lic
                        </span>
                      )}
                      {irmao.idade >= 70 && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                          70+
                        </span>
                      )}
                      {irmao.data_falecimento && (
                        <span className="text-xs bg-gray-200 text-gray-800 px-2 py-0.5 rounded">
                          †
                        </span>
                      )}
                      {irmao.data_desligamento && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                          Deslg
                        </span>
                      )}
                    </div>
                  </td>
                  {sessoes.map(sessao => renderizarCelula(irmao.id, sessao.id))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rodapé */}
        <div className="bg-gray-50 px-6 py-4 border-t">
          <button
            onClick={onFechar}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
