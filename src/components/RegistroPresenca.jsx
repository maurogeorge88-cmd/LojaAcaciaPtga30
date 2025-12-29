import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Função auxiliar para calcular idade
const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
};

export default function RegistroPresenca({ sessaoId, onVoltar }) {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sessao, setSessao] = useState(null);
  const [irmaosElegiveis, setIrmaosElegiveis] = useState([]);
  const [presencas, setPresencas] = useState({});
  const [justificativas, setJustificativas] = useState({});
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (sessaoId) {
      carregarDados();
    }
  }, [sessaoId]);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Buscar dados da sessão
      const { data: sessaoData, error: sessaoError } = await supabase
        .from('sessoes_presenca')
        .select(`
          *,
          graus_sessao:grau_sessao_id (
            id,
            nome,
            grau_minimo_requerido
          ),
          classificacoes_sessao:classificacao_id (
            nome
          )
        `)
        .eq('id', sessaoId)
        .single();

      if (sessaoError) throw sessaoError;
      setSessao(sessaoData);

      // Buscar histórico de situações (licenças, desligamentos, etc)
      const { data: historicoSituacoes } = await supabase
        .from('historico_situacoes')
        .select('*')
        .eq('status', 'ativa');

      // Buscar irmãos elegíveis DIRETO da tabela (sem usar função RPC)
      const grauMinimo = sessaoData.graus_sessao?.grau_minimo_requerido || 1;
      
      let query = supabase
        .from('irmaos')
        .select('id, nome, cim, foto_url, situacao, data_nascimento, data_iniciacao, data_elevacao, data_exaltacao, data_licenca, data_desligamento, data_falecimento, data_ingresso_loja')
        .eq('status', 'ativo');

      // Filtrar por grau
      if (grauMinimo === 2) {
        query = query.not('data_elevacao', 'is', null);
      } else if (grauMinimo === 3) {
        query = query.not('data_exaltacao', 'is', null);
      }

      const { data: irmaosData, error: irmaosError } = await query.order('nome');

      console.log('DEBUG - Sessão:', sessaoData);
      console.log('DEBUG - Irmãos retornados:', irmaosData);
      console.log('DEBUG - Erro ao buscar irmãos:', irmaosError);

      if (irmaosError) {
        console.error('Erro ao buscar irmãos:', irmaosError);
        throw irmaosError;
      }

      // Aplicar lógica de filtro por datas (ingresso/falecimento/desligamento)
      const dataSessao = new Date(sessaoData.data_sessao + 'T00:00:00');
      const irmaosFiltrados = irmaosData?.filter(i => {
        // FILTRO 0: INGRESSO NA LOJA - só aparece se sessão for DEPOIS do ingresso
        // Prioridade: data_ingresso_loja > data_iniciacao
        const dataIngresso = i.data_ingresso_loja ? new Date(i.data_ingresso_loja + 'T00:00:00') : null;
        const dataIniciacao = i.data_iniciacao ? new Date(i.data_iniciacao + 'T00:00:00') : null;
        const dataInicio = dataIngresso || dataIniciacao;
        
        if (dataInicio && dataSessao < dataInicio) {
          return false; // Sessão antes do ingresso na loja
        }
        
        // FILTRO: Situações INDEFINIDAS (sem data_fim) na data da sessão
        // Ex: licença sem prazo, desligamento definitivo
        const situacaoIndefinida = historicoSituacoes?.find(sit => 
          sit.membro_id === i.id &&
          sit.data_fim === null && // SEM data de fim = indefinido
          dataSessao >= new Date(sit.data_inicio + 'T00:00:00')
        );
        
        if (situacaoIndefinida) {
          return false; // Licença/desligamento indefinido → não aparece
        }
        
        // FILTRO: FALECIDO - só aparece se sessão for ANTES da data de falecimento
        if (i.situacao === 'falecido' && i.data_falecimento) {
          const dataFalecimento = new Date(i.data_falecimento + 'T00:00:00');
          return dataSessao < dataFalecimento;
        }
        
        // Outros aparecem (incluindo licenças/desligamentos TEMPORÁRIOS com data_fim)
        return true;
        return true;
      }) || [];

      // Mapear para formato esperado
      const irmaos = irmaosFiltrados.map(i => ({
        membro_id: i.id,
        nome_completo: i.nome,
        cim: i.cim,
        grau_atual: i.data_exaltacao ? 'Mestre' : i.data_elevacao ? 'Companheiro' : i.data_iniciacao ? 'Aprendiz' : 'Não Iniciado',
        foto_url: i.foto_url,
        situacao: i.situacao,
        data_nascimento: i.data_nascimento,
        data_licenca: i.data_licenca
      }));

      // Adicionar idade e verificar situação na data da sessão
      const irmaosComIdade = irmaos.map(irmao => {
        const idade = irmao.data_nascimento ? calcularIdade(irmao.data_nascimento) : null;
        
        // Verificar se tem situação ativa na data da sessão (licença, desligamento, etc)
        const situacaoNaData = historicoSituacoes?.find(sit => 
          sit.membro_id === irmao.membro_id &&
          dataSessao >= new Date(sit.data_inicio + 'T00:00:00') &&
          (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'))
        );
        
        return {
          ...irmao,
          idade,
          tem_prerrogativa: idade >= 70,
          esta_licenciado_efetivo: situacaoNaData?.tipo_situacao === 'licenca',
          situacao_na_data: situacaoNaData // guardar para usar depois
        };
      });

      setIrmaosElegiveis(irmaosComIdade);

      // Buscar presenças já registradas (se houver)
      const { data: presencasExistentes, error: presencasError } = await supabase
        .from('registros_presenca')
        .select('*')
        .eq('sessao_id', sessaoId);

      if (presencasError) throw presencasError;

      // Preencher estado de presenças e justificativas
      const presencasObj = {};
      const justificativasObj = {};

      presencasExistentes?.forEach(p => {
        presencasObj[p.membro_id] = p.presente;
        if (p.justificativa) {
          justificativasObj[p.membro_id] = p.justificativa;
        }
      });

      setPresencas(presencasObj);
      setJustificativas(justificativasObj);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setMensagem({
        tipo: 'erro',
        texto: 'Erro ao carregar dados da sessão.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePresencaChange = (membroId, presente) => {
    setPresencas(prev => ({
      ...prev,
      [membroId]: presente
    }));

    // Se marcar como presente, limpar justificativa
    if (presente && justificativas[membroId]) {
      const novasJustificativas = { ...justificativas };
      delete novasJustificativas[membroId];
      setJustificativas(novasJustificativas);
    }
  };

  const handleJustificativaChange = (membroId, texto) => {
    setJustificativas(prev => ({
      ...prev,
      [membroId]: texto
    }));
  };

  const marcarTodosPresentes = () => {
    const todasPresencas = {};
    irmaosElegiveis.forEach(irmao => {
      todasPresencas[irmao.membro_id] = true;
    });
    setPresencas(todasPresencas);
    setJustificativas({});
  };

  const desmarcarTodos = () => {
    setPresencas({});
    setJustificativas({});
  };

  const handleSalvar = async () => {
    try {
      setSalvando(true);
      setMensagem({ tipo: '', texto: '' });

      // Buscar ID do usuário logado (só para verificar permissão)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Preparar registros de presença (SEM registrado_por)
      const registros = irmaosElegiveis.map(irmaoElegivel => ({
        sessao_id: sessaoId,
        membro_id: irmaoElegivel.membro_id,
        presente: presencas[irmaoElegivel.membro_id] || false,
        justificativa: (!presencas[irmaoElegivel.membro_id] && justificativas[irmaoElegivel.membro_id]) 
          ? justificativas[irmaoElegivel.membro_id] 
          : null
      }));

      // Usar UPSERT (inserir ou atualizar) para evitar duplicação
      const { error: upsertError } = await supabase
        .from('registros_presenca')
        .upsert(registros, {
          onConflict: 'sessao_id,membro_id',
          ignoreDuplicates: false
        });

      if (upsertError) throw upsertError;

      setMensagem({
        tipo: 'sucesso',
        texto: 'Presenças salvas com sucesso!'
      });

      // Recarregar dados
      setTimeout(() => {
        carregarDados();
      }, 1500);

    } catch (error) {
      console.error('Erro ao salvar presenças:', error);
      setMensagem({
        tipo: 'erro',
        texto: error.message || 'Erro ao salvar presenças. Tente novamente.'
      });
    } finally {
      setSalvando(false);
    }
  };

  // Filtrar irmãos pela busca
  const irmaosFiltrados = irmaosElegiveis.filter(irmao =>
    irmao.nome_completo?.toLowerCase().includes(busca.toLowerCase())
  );

  // Estatísticas
  const totalIrmaos = irmaosElegiveis.length;
  const totalPresentes = Object.values(presencas).filter(p => p === true).length;
  const totalAusentes = totalIrmaos - totalPresentes;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados da sessão...</p>
        </div>
      </div>
    );
  }

  if (!sessao) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-800">Sessão não encontrada.</p>
        <button
          onClick={onVoltar}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Registro de Presença
            </h2>
            <p className="text-gray-600 mt-1">
              {sessao.graus_sessao?.nome}
              {sessao.classificacoes_sessao && ` - ${sessao.classificacoes_sessao.nome}`}
            </p>
            <p className="text-sm text-gray-500">
              Data: {new Date(sessao.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
          </div>
          <button
            onClick={onVoltar}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            ← Voltar
          </button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <p className="text-sm text-blue-600 font-medium">Total de Irmãos</p>
            <p className="text-3xl font-bold text-blue-800">{totalIrmaos}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-sm text-green-600 font-medium">Presentes</p>
            <p className="text-3xl font-bold text-green-800">{totalPresentes}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-sm text-red-600 font-medium">Ausentes</p>
            <p className="text-3xl font-bold text-red-800">{totalAusentes}</p>
          </div>
        </div>
      </div>

      {/* Mensagens */}
      {mensagem.texto && (
        <div className={`mb-4 p-4 rounded-lg ${
          mensagem.tipo === 'sucesso'
            ? 'bg-green-100 text-green-800 border border-green-300'
            : 'bg-red-100 text-red-800 border border-red-300'
        }`}>
          {mensagem.texto}
        </div>
      )}

      {/* Ferramentas */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex gap-4 items-center">
          <input
            type="text"
            placeholder="🔍 Buscar irmão..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={marcarTodosPresentes}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
          >
            ✓ Marcar Todos Presentes
          </button>
          <button
            onClick={desmarcarTodos}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
          >
            ✗ Desmarcar Todos
          </button>
        </div>
      </div>

      {/* Lista de Irmãos */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Irmão
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grau
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Presença
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Justificativa (se ausente)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {irmaosFiltrados.map((irmao) => (
                <tr key={irmao.membro_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {irmao.foto_url && (
                        <img
                          src={irmao.foto_url}
                          alt={irmao.nome_completo}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {irmao.nome_completo}
                        </div>
                        {irmao.esta_licenciado_efetivo && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded bg-orange-100 text-orange-800">
                            Licenciado
                          </span>
                        )}
                        {irmao.tem_prerrogativa && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800">
                            Com Prerrogativa
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {irmao.grau_atual}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={presencas[irmao.membro_id] || false}
                        onChange={(e) => handlePresencaChange(irmao.membro_id, e.target.checked)}
                        className="w-6 h-6 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">
                        {presencas[irmao.membro_id] ? 'Presente' : 'Ausente'}
                      </span>
                    </label>
                  </td>
                  <td className="px-6 py-4">
                    {!presencas[irmao.membro_id] && (
                      <input
                        type="text"
                        placeholder="Motivo da ausência..."
                        value={justificativas[irmao.membro_id] || ''}
                        onChange={(e) => handleJustificativaChange(irmao.membro_id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {irmaosFiltrados.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {busca ? 'Nenhum irmão encontrado com esse nome.' : 'Nenhum irmão elegível para esta sessão.'}
          </div>
        )}
      </div>

      {/* Botão Salvar */}
      <div className="mt-6 flex justify-end gap-4">
        <button
          onClick={onVoltar}
          className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 transition"
        >
          Cancelar
        </button>
        <button
          onClick={handleSalvar}
          disabled={salvando}
          className={`px-6 py-3 rounded-md text-white font-medium transition ${
            salvando
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {salvando ? 'Salvando...' : 'Salvar Presenças'}
        </button>
      </div>
    </div>
  );
}
