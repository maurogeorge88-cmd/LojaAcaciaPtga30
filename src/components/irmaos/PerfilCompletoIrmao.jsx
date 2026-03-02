import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const PerfilCompletoIrmao = ({ irmaoId, userData, onClose }) => {
  const [irmao, setIrmao] = useState(null);
  const [anoPresencaSelecionado, setAnoPresencaSelecionado] = useState(new Date().getFullYear().toString());
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [mesFinanceiroSelecionado, setMesFinanceiroSelecionado] = useState('todos');
  const [anoFinanceiroSelecionado, setAnoFinanceiroSelecionado] = useState('todos');
  const [dadosPresenca, setDadosPresenca] = useState(null);
  const [dadosFinanceiro, setDadosFinanceiro] = useState(null);
  const [grausFilosoficos, setGrausFilosoficos] = useState([]);
  const [comissoesAtivas, setComissoesAtivas] = useState([]);
  const [comissoesInativas, setComissoesInativas] = useState([]);
  const [eventosParticipados, setEventosParticipados] = useState([]);
  const [loading, setLoading] = useState(true);

  const podeVerOutrosIrmaos = 
    userData?.nivel_acesso === 'admin' || 
    userData?.cargo?.toLowerCase() === 'veneravel' ||
    userData?.cargo?.toLowerCase() === 'tesoureiro' ||
    userData?.cargo?.toLowerCase() === 'chanceler';

  useEffect(() => {
    if (!podeVerOutrosIrmaos && irmaoId !== userData?.membro_id) {
      alert('Acesso negado. Você só pode visualizar seu próprio perfil completo.');
      onClose();
      return;
    }
    carregarDados();
  }, [irmaoId, anoPresencaSelecionado, mesFinanceiroSelecionado, anoFinanceiroSelecionado]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const { data: irmaoData, error: irmaoError } = await supabase.from('irmaos').select('*').eq('id', irmaoId).single();
      if (irmaoError) throw irmaoError;
      setIrmao(irmaoData);

      const { data: sessoesAnosData } = await supabase.from('registros_presenca').select('sessoes_presenca!inner(data_sessao)').eq('membro_id', irmaoId);
      const anos = [...new Set(sessoesAnosData?.map(r => new Date(r.sessoes_presenca.data_sessao).getFullYear()))].sort((a, b) => b - a);
      setAnosDisponiveis(anos);

      await carregarPresenca(irmaoData);
      await carregarFinanceiro();
      await carregarGrausFilosoficos();
      await carregarComissoes();
      await carregarEventos();
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar perfil do irmão');
      setLoading(false);
    }
  };

  const carregarPresenca = async (irmaoData) => {
    try {
      let querySessoes = supabase.from('sessoes_presenca').select('id, data_sessao, grau_sessao_id');
      if (anoPresencaSelecionado !== 'todos') {
        querySessoes = querySessoes.gte('data_sessao', `${anoPresencaSelecionado}-01-01`).lte('data_sessao', `${anoPresencaSelecionado}-12-31`);
      }
      const { data: sessoes } = await querySessoes.order('data_sessao', { ascending: false });
      const sessoesIds = sessoes?.map(s => s.id) || [];
      const { data: registros } = await supabase.from('registros_presenca').select('*').eq('membro_id', irmaoId).in('sessao_id', sessoesIds);
      const { data: historicoSituacoes } = await supabase.from('historico_situacoes').select('*').eq('membro_id', irmaoId);

      let totalSessoes = 0, presencas = 0, ausenciasJustificadas = 0, ausenciasInjustificadas = 0;
      const ultimasSessoes = [];

      const obterGrauNaData = (dataSessao) => {
        const data = new Date(dataSessao + 'T12:00:00');
        let grau = 0;
        if (irmaoData.data_exaltacao && data >= new Date(irmaoData.data_exaltacao + 'T12:00:00')) grau = 3;
        else if (irmaoData.data_elevacao && data >= new Date(irmaoData.data_elevacao + 'T12:00:00')) grau = 2;
        else if (irmaoData.data_iniciacao && data >= new Date(irmaoData.data_iniciacao + 'T12:00:00')) grau = 1;
        return grau;
      };

      sessoes?.forEach((sessao, index) => {
        let grauSessao = sessao.grau_sessao_id || 1;
        if (grauSessao === 4) grauSessao = 1;
        const grauIrmao = obterGrauNaData(sessao.data_sessao);
        const dataSessao = new Date(sessao.data_sessao + 'T12:00:00');
        if (grauIrmao < grauSessao) return;

        const dataInicio = irmaoData.data_ingresso_loja ? new Date(irmaoData.data_ingresso_loja + 'T12:00:00') : irmaoData.data_iniciacao ? new Date(irmaoData.data_iniciacao + 'T12:00:00') : null;
        if (dataInicio && dataSessao < dataInicio) return;

        const situacaoBloqueadora = historicoSituacoes?.find(sit => {
          const tipoNormalizado = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
          const situacoesQueExcluem = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio', 'licenca'];
          const ehBloqueadora = situacoesQueExcluem.includes(tipoNormalizado) || situacoesQueExcluem.some(s => tipoNormalizado.includes(s));
          if (!ehBloqueadora) return false;
          const dataInicio = new Date(sit.data_inicio + 'T00:00:00');
          dataInicio.setHours(0, 0, 0, 0);
          const dataSessaoNorm = new Date(dataSessao);
          dataSessaoNorm.setHours(0, 0, 0, 0);
          if (dataSessaoNorm.getTime() < dataInicio.getTime()) return false;
          if (sit.data_fim) {
            const dataFim = new Date(sit.data_fim + 'T00:00:00');
            dataFim.setHours(0, 0, 0, 0);
            return dataSessaoNorm.getTime() >= dataInicio.getTime() && dataSessaoNorm.getTime() <= dataFim.getTime();
          }
          return dataSessaoNorm.getTime() >= dataInicio.getTime();
        });
        if (situacaoBloqueadora) return;

        totalSessoes++;
        const registro = registros?.find(r => r.sessao_id === sessao.id);
        let status = 'F';
        if (registro) {
          if (registro.presente) { presencas++; status = 'P'; }
          else if (registro.justificativa) { ausenciasJustificadas++; status = 'J'; }
          else { ausenciasInjustificadas++; }
        } else { ausenciasInjustificadas++; }
        if (index < 10) { ultimasSessoes.push({ data: sessao.data_sessao, status }); }
      });

      const taxa = totalSessoes > 0 ? Math.round((presencas / totalSessoes) * 100) : 0;
      setDadosPresenca({ totalSessoes, presencas, ausenciasJustificadas, ausenciasInjustificadas, taxa, ultimasSessoes });
    } catch (error) {
      console.error('Erro ao carregar presença:', error);
    }
  };

  const carregarFinanceiro = async () => {
    try {
      let query = supabase
        .from('lancamentos_loja')
        .select('*, categorias_financeiras(nome, tipo)')
        .eq('origem_irmao_id', irmaoId)
        .eq('origem_tipo', 'Irmao');

      if (anoFinanceiroSelecionado !== 'todos') {
        query = query
          .gte('data_vencimento', `${anoFinanceiroSelecionado}-01-01`)
          .lte('data_vencimento', `${anoFinanceiroSelecionado}-12-31`);
        
        if (mesFinanceiroSelecionado !== 'todos') {
          const mes = mesFinanceiroSelecionado.padStart(2, '0');
          const ultimoDiaMes = new Date(anoFinanceiroSelecionado, mesFinanceiroSelecionado, 0).getDate();
          query = query
            .gte('data_vencimento', `${anoFinanceiroSelecionado}-${mes}-01`)
            .lte('data_vencimento', `${anoFinanceiroSelecionado}-${mes}-${ultimoDiaMes}`);
        }
      }

      const { data: lancamentos, error } = await query.limit(300);
      
      if (error) {
        console.error('Erro na query financeira:', error);
        setDadosFinanceiro({ receitasPendentes: 0, despesasPendentes: 0, receitasPagas: 0, despesasPagas: 0, saldo: 0, situacao: 'Em dia' });
        return;
      }

      const receitasPendentes = (lancamentos || []).filter(l => l.categorias_financeiras?.tipo === 'receita' && l.status === 'pendente');
      const despesasPendentes = (lancamentos || []).filter(l => l.categorias_financeiras?.tipo === 'despesa' && l.status === 'pendente');
      const receitasPagas = (lancamentos || []).filter(l => l.categorias_financeiras?.tipo === 'receita' && l.status === 'pago');
      const despesasPagas = (lancamentos || []).filter(l => l.categorias_financeiras?.tipo === 'despesa' && l.status === 'pago');

      const totalReceitasPendentes = receitasPendentes.reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
      const totalDespesasPendentes = despesasPendentes.reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
      const totalReceitasPagas = receitasPagas.reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
      const totalDespesasPagas = despesasPagas.reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);

      const saldo = totalReceitasPendentes - totalDespesasPendentes;
      const situacao = saldo <= 0 ? 'Em dia' : 'Pendente';

      setDadosFinanceiro({
        receitasPendentes: totalReceitasPendentes,
        despesasPendentes: totalDespesasPendentes,
        receitasPagas: totalReceitasPagas,
        despesasPagas: totalDespesasPagas,
        saldo,
        situacao
      });
    } catch (error) {
      console.error('Erro ao carregar financeiro:', error);
      setDadosFinanceiro({ receitasPendentes: 0, despesasPendentes: 0, receitasPagas: 0, despesasPagas: 0, saldo: 0, situacao: 'Em dia' });
    }
  };

  const carregarGrausFilosoficos = async () => {
    try {
      setGrausFilosoficos([]);
    } catch (error) {
      console.error('Erro ao carregar graus filosóficos:', error);
      setGrausFilosoficos([]);
    }
  };

  const carregarComissoes = async () => {
    try {
      const { data: comissoes, error } = await supabase
        .from('comissoes_integrantes')
        .select('id, irmao_id, comissao_id, funcao, data_entrada, data_saida, ativo, comissoes(nome)')
        .eq('irmao_id', irmaoId);
      
      if (error) {
        console.error('Erro na query comissões:', error);
        setComissoesAtivas([]);
        setComissoesInativas([]);
        return;
      }
      
      setComissoesAtivas(comissoes?.filter(c => c.ativo === true || (!c.data_saida)) || []);
      setComissoesInativas(comissoes?.filter(c => c.ativo === false && c.data_saida) || []);
    } catch (error) {
      console.error('Erro ao carregar comissões:', error);
      setComissoesAtivas([]);
      setComissoesInativas([]);
    }
  };

  const carregarEventos = async () => {
    try {
      const { data: eventos, error } = await supabase
        .from('eventos_participantes')
        .select('id, irmao_id, evento_id, eventos_loja(nome, descricao, data_evento)')
        .eq('irmao_id', irmaoId)
        .limit(20);
      
      if (error) {
        console.error('Erro na query eventos:', error);
        setEventosParticipados([]);
        return;
      }
      
      setEventosParticipados(eventos || []);
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      setEventosParticipados([]);
    }
  };

  const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
  const formatarData = (data) => data ? new Date(data + 'T12:00:00').toLocaleDateString('pt-BR') : '-';
  const obterGrauAtual = () => {
    if (!irmao) return '-';
    if (irmao.mestre_instalado) return 'Mestre Instalado';
    if (irmao.data_exaltacao) return 'Mestre';
    if (irmao.data_elevacao) return 'Companheiro';
    if (irmao.data_iniciacao) return 'Aprendiz';
    return '-';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-lg">Carregando perfil...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!irmao) return null;

  const anoAtual = new Date().getFullYear();
  const anosFinanceiro = Array.from({ length: 5 }, (_, i) => anoAtual - i);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
          <div className="flex justify-between items-start">
            <div className="flex gap-4">
              {irmao.foto_url && <img src={irmao.foto_url} alt={irmao.nome} className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg" />}
              <div>
                <h2 className="text-2xl font-bold mb-1">{irmao.nome}</h2>
                <p className="text-blue-100">CIM: {irmao.cim || 'Não informado'}</p>
                <p className="text-blue-100">Grau: {obterGrauAtual()} | Iniciado em: {formatarData(irmao.data_iniciacao)}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl font-bold">✕</button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <section className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">📊 Presença</h3>
              <select value={anoPresencaSelecionado} onChange={(e) => setAnoPresencaSelecionado(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="todos">Todos os anos</option>
                {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
              </select>
            </div>
            {dadosPresenca && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-600 font-medium mb-1">Total Sessões</p>
                    <p className="text-2xl font-bold text-blue-800">{dadosPresenca.totalSessoes}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p className="text-sm text-green-600 font-medium mb-1">Presenças</p>
                    <p className="text-2xl font-bold text-green-800">{dadosPresenca.presencas}</p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-600 font-medium mb-1">Justificadas</p>
                    <p className="text-2xl font-bold text-yellow-800">{dadosPresenca.ausenciasJustificadas}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-sm text-red-600 font-medium mb-1">Ausências</p>
                    <p className="text-2xl font-bold text-red-800">{dadosPresenca.ausenciasInjustificadas}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <p className="text-sm text-purple-600 font-medium mb-1">Taxa</p>
                    <p className="text-2xl font-bold text-purple-800">{dadosPresenca.taxa}%</p>
                  </div>
                </div>
                {dadosPresenca.ultimasSessoes.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">Últimas {dadosPresenca.ultimasSessoes.length} sessões:</p>
                    <div className="flex gap-2 flex-wrap">
                      {dadosPresenca.ultimasSessoes.map((sessao, idx) => (
                        <div key={idx} className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-white text-lg ${sessao.status === 'P' ? 'bg-green-500' : sessao.status === 'J' ? 'bg-yellow-500' : 'bg-red-500'}`} title={`${formatarData(sessao.data)} - ${sessao.status === 'P' ? 'Presente' : sessao.status === 'J' ? 'Justificado' : 'Ausente'}`}>{sessao.status}</div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">💰 Situação Financeira</h3>
              <div className="flex gap-2">
                <select value={anoFinanceiroSelecionado} onChange={(e) => setAnoFinanceiroSelecionado(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="todos">Todos os anos</option>
                  {anosFinanceiro.map(ano => <option key={ano} value={ano}>{ano}</option>)}
                </select>
                {anoFinanceiroSelecionado !== 'todos' && (
                  <select value={mesFinanceiroSelecionado} onChange={(e) => setMesFinanceiroSelecionado(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="todos">Todos os meses</option>
                    <option value="1">Janeiro</option>
                    <option value="2">Fevereiro</option>
                    <option value="3">Março</option>
                    <option value="4">Abril</option>
                    <option value="5">Maio</option>
                    <option value="6">Junho</option>
                    <option value="7">Julho</option>
                    <option value="8">Agosto</option>
                    <option value="9">Setembro</option>
                    <option value="10">Outubro</option>
                    <option value="11">Novembro</option>
                    <option value="12">Dezembro</option>
                  </select>
                )}
              </div>
            </div>
            {dadosFinanceiro && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <p className="text-sm text-orange-600 font-medium mb-1">Você Deve</p>
                  <p className="text-xl font-bold text-orange-800">{formatarMoeda(dadosFinanceiro.receitasPendentes)}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-green-600 font-medium mb-1">Loja Deve</p>
                  <p className="text-xl font-bold text-green-800">{formatarMoeda(dadosFinanceiro.despesasPendentes)}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-600 font-medium mb-1">Saldo</p>
                  <p className={`text-xl font-bold ${dadosFinanceiro.saldo <= 0 ? 'text-blue-800' : 'text-red-800'}`}>{formatarMoeda(dadosFinanceiro.saldo)}</p>
                </div>
                <div className={`p-4 rounded-lg border ${dadosFinanceiro.situacao === 'Em dia' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className={`text-sm font-medium mb-1 ${dadosFinanceiro.situacao === 'Em dia' ? 'text-green-600' : 'text-red-600'}`}>Situação</p>
                  <p className={`text-xl font-bold ${dadosFinanceiro.situacao === 'Em dia' ? 'text-green-800' : 'text-red-800'}`}>{dadosFinanceiro.situacao === 'Em dia' ? '✅ Em dia' : '⚠️ Pendente'}</p>
                </div>
              </div>
            )}
          </section>

          <section className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">🎓 Graus Filosóficos</h3>
            {grausFilosoficos.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {grausFilosoficos.map((grau, idx) => (
                  <div key={grau.id} className={`flex justify-between items-center p-4 ${idx !== grausFilosoficos.length - 1 ? 'border-b border-gray-200' : ''} hover:bg-gray-50`}>
                    <div>
                      <p className="font-semibold text-gray-800">Grau {grau.grau}° - {grau.nome_grau}</p>
                      {grau.observacoes && <p className="text-sm text-gray-600 mt-1">{grau.observacoes}</p>}
                    </div>
                    <span className="text-sm text-gray-500">{formatarData(grau.data_recebimento)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-gray-400 text-center py-4">Nenhum grau filosófico registrado</p>}
          </section>

          <section className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">👥 Comissões</h3>
            <div className="mb-4">
              <h4 className="font-semibold text-green-700 mb-2">✓ Ativas ({comissoesAtivas.length})</h4>
              {comissoesAtivas.length > 0 ? (
                <div className="bg-white border border-green-200 rounded-lg overflow-hidden">
                  {comissoesAtivas.map((c, idx) => (
                    <div key={c.id} className={`flex justify-between items-center p-3 ${idx !== comissoesAtivas.length - 1 ? 'border-b border-green-100' : ''} hover:bg-green-50`}>
                      <span className="font-medium text-gray-800">{c.comissoes?.nome || 'Sem nome'}</span>
                      <span className="text-sm text-gray-600 bg-green-100 px-3 py-1 rounded-full">{c.funcao || 'Membro'}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-400 text-sm pl-4">Nenhuma comissão ativa</p>}
            </div>
            <div>
              <h4 className="font-semibold text-gray-600 mb-2">✗ Inativas ({comissoesInativas.length})</h4>
              {comissoesInativas.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {comissoesInativas.map((c, idx) => (
                    <div key={c.id} className={`flex justify-between items-center p-3 ${idx !== comissoesInativas.length - 1 ? 'border-b border-gray-100' : ''} hover:bg-gray-50`}>
                      <span className="text-gray-600">{c.comissoes?.nome || 'Sem nome'}</span>
                      <span className="text-xs text-gray-500">Até {formatarData(c.data_saida)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-400 text-sm pl-4">Nenhuma comissão inativa</p>}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-bold text-gray-800 mb-4">🎉 Eventos Participados ({eventosParticipados.length})</h3>
            {eventosParticipados.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                {eventosParticipados.map((e, idx) => (
                  <div key={e.id} className={`p-4 ${idx !== eventosParticipados.length - 1 ? 'border-b border-gray-200' : ''} hover:bg-gray-50`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{e.eventos_loja?.nome || 'Sem nome'}</p>
                        {e.eventos_loja?.descricao && <p className="text-sm text-gray-600 mt-1">{e.eventos_loja.descricao}</p>}
                      </div>
                      <span className="text-sm text-gray-500 ml-4 whitespace-nowrap">{formatarData(e.eventos_loja?.data_evento)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-gray-400 text-center py-4">Nenhum evento participado</p>}
          </section>
        </div>
      </div>
    </div>
  );
};

export default PerfilCompletoIrmao;
