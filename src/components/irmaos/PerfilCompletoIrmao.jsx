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
      let query = supabase.from('lancamentos_loja').select('*, categorias_financeiras(nome, tipo)').eq('origem_irmao_id', irmaoId).eq('origem_tipo', 'Irmao');
      if (anoFinanceiroSelecionado !== 'todos') {
        query = query.gte('data_vencimento', `${anoFinanceiroSelecionado}-01-01`).lte('data_vencimento', `${anoFinanceiroSelecionado}-12-31`);
        if (mesFinanceiroSelecionado !== 'todos') {
          const mes = mesFinanceiroSelecionado.padStart(2, '0');
          const ultimoDiaMes = new Date(anoFinanceiroSelecionado, mesFinanceiroSelecionado, 0).getDate();
          query = query.gte('data_vencimento', `${anoFinanceiroSelecionado}-${mes}-01`).lte('data_vencimento', `${anoFinanceiroSelecionado}-${mes}-${ultimoDiaMes}`);
        }
      }
      const { data: lancamentos } = await query.limit(300);
      const receitas = (lancamentos || []).filter(l => l.categorias_financeiras?.tipo === 'receita');
      const despesas = (lancamentos || []).filter(l => l.categorias_financeiras?.tipo === 'despesa');
      const totalReceitas = receitas.reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
      const totalDespesas = despesas.reduce((sum, l) => sum + parseFloat(l.valor || 0), 0);
      const saldo = totalReceitas - totalDespesas;
      setDadosFinanceiro({ receitasPendentes: totalReceitas, despesasPendentes: totalDespesas, saldo, situacao: saldo >= 0 ? 'Pago' : 'Devendo' });
    } catch (error) {
      console.error('Erro ao carregar financeiro:', error);
    }
  };

  const carregarGrausFilosoficos = async () => {
    try {
      const { data: vidaMaconica } = await supabase
        .from('vida_maconica')
        .select('*, graus_maconicos(numero_grau, nome_grau)')
        .eq('irmao_id', irmaoId)
        .order('data_conquista', { ascending: false });
      setGrausFilosoficos(vidaMaconica || []);
    } catch (error) {
      console.error('Erro ao carregar graus filosóficos:', error);
      setGrausFilosoficos([]);
    }
  };

  const carregarComissoes = async () => {
    try {
      const { data: comissoes } = await supabase.from('comissoes_integrantes').select('*, comissoes(nome, status)').eq('irmao_id', irmaoId);
      if (!comissoes) { setComissoesAtivas([]); setComissoesInativas([]); return; }
      const ativas = comissoes.filter(c => c.comissoes?.status !== 'encerrada');
      const inativas = comissoes.filter(c => c.comissoes?.status === 'encerrada');
      setComissoesAtivas(ativas);
      setComissoesInativas(inativas);
    } catch (error) {
      console.error('Erro ao carregar comissões:', error);
    }
  };

  const carregarEventos = async () => {
    try {
      const { data: eventos } = await supabase.from('eventos_participantes').select('*, eventos_loja(nome_evento, descricao, data_aviso)').eq('irmao_id', irmaoId).limit(20);
      setEventosParticipados(eventos || []);
    } catch (error) {
      console.error('Erro eventos:', error);
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

  if (loading) return (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="rounded-lg p-8"><div className="flex items-center gap-3"><div className="animate-spin rounded-full h-8 w-8 border-b-2"></div><p className="text-lg">Carregando perfil...</p></div></div></div>);
  if (!irmao) return null;

  const anoAtual = new Date().getFullYear();
  const anosFinanceiro = Array.from({ length: 5 }, (_, i) => anoAtual - i);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",boxShadow:"0 25px 50px rgba(0,0,0,0.5)"}}>
        <div className="p-6 text-white" style={{background:"var(--color-accent)"}}>
          <div className="flex justify-between items-start">
            <div className="flex gap-4">
              {irmao.foto_url && <img src={irmao.foto_url} alt={irmao.nome} className="w-20 h-20 rounded-full object-cover border-4" />}
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
              <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>📊 Presença</h3>
              <select value={anoPresencaSelecionado} onChange={(e) => setAnoPresencaSelecionado(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}>
                <option value="todos">Todos os anos</option>
                {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
              </select>
            </div>
            {dadosPresenca && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <div style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem"}}><p style={{fontSize:"0.8rem",color:"var(--color-text-muted)",fontWeight:"600",marginBottom:"0.25rem"}}>Total Sessões</p><p style={{fontSize:"1.5rem",fontWeight:"700",color:"var(--color-accent)"}}>{dadosPresenca.totalSessoes}</p></div>
                  <div style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem"}}><p style={{fontSize:"0.8rem",color:"var(--color-text-muted)",fontWeight:"600",marginBottom:"0.25rem"}}>Presenças</p><p style={{fontSize:"1.5rem",fontWeight:"700",color:"#10b981"}}>{dadosPresenca.presencas}</p></div>
                  <div style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem"}}><p style={{fontSize:"0.8rem",color:"var(--color-text-muted)",fontWeight:"600",marginBottom:"0.25rem"}}>Justificadas</p><p style={{fontSize:"1.5rem",fontWeight:"700",color:"#f59e0b"}}>{dadosPresenca.ausenciasJustificadas}</p></div>
                  <div style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem"}}><p style={{fontSize:"0.8rem",color:"var(--color-text-muted)",fontWeight:"600",marginBottom:"0.25rem"}}>Ausências</p><p style={{fontSize:"1.5rem",fontWeight:"700",color:"#ef4444"}}>{dadosPresenca.ausenciasInjustificadas}</p></div>
                  <div style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem"}}><p style={{fontSize:"0.8rem",color:"var(--color-text-muted)",fontWeight:"600",marginBottom:"0.25rem"}}>Taxa</p><p style={{fontSize:"1.5rem",fontWeight:"700",color:"#a855f7"}}>{dadosPresenca.taxa}%</p></div>
                </div>
                {dadosPresenca.ultimasSessoes.length > 0 && (
                  <div className="p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                    <p className="text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Últimas {dadosPresenca.ultimasSessoes.length} sessões:</p>
                    <div className="flex gap-2 flex-wrap">{dadosPresenca.ultimasSessoes.map((s, i) => (<div key={i} className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-white text-lg ${s.status === 'P' ? 'bg-green-500' : s.status === 'J' ? 'bg-yellow-500' : 'bg-red-500'}`}>{s.status}</div>))}</div>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>💰 Situação Financeira</h3>
              <div className="flex gap-2">
                <select value={anoFinanceiroSelecionado} onChange={(e) => setAnoFinanceiroSelecionado(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}>
                  <option value="todos">Todos os anos</option>
                  {anosFinanceiro.map(ano => <option key={ano} value={ano}>{ano}</option>)}
                </select>
                {anoFinanceiroSelecionado !== 'todos' && (
                  <select value={mesFinanceiroSelecionado} onChange={(e) => setMesFinanceiroSelecionado(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}>
                    <option value="todos">Todos os meses</option>
                    {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                  </select>
                )}
              </div>
            </div>
            {dadosFinanceiro && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem"}}><p style={{fontSize:"0.8rem",color:"var(--color-text-muted)",fontWeight:"600",marginBottom:"0.25rem"}}>Receitas</p><p style={{fontSize:"1.25rem",fontWeight:"700",color:"var(--color-accent)"}}>{formatarMoeda(dadosFinanceiro.receitasPendentes)}</p></div>
                <div style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem"}}><p style={{fontSize:"0.8rem",color:"var(--color-text-muted)",fontWeight:"600",marginBottom:"0.25rem"}}>Despesas</p><p style={{fontSize:"1.25rem",fontWeight:"700",color:"#10b981"}}>{formatarMoeda(dadosFinanceiro.despesasPendentes)}</p></div>
                <div style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem"}}><p style={{fontSize:"0.8rem",color:"var(--color-text-muted)",fontWeight:"600",marginBottom:"0.25rem"}}>Saldo</p><p style={{fontSize:"1.25rem",fontWeight:"700",color:dadosFinanceiro.saldo>=0?"var(--color-accent)":"#ef4444"}}>{formatarMoeda(dadosFinanceiro.saldo)}</p></div>
                <div style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem"}}><p style={{fontSize:"0.8rem",color:"var(--color-text-muted)",fontWeight:"600",marginBottom:"0.25rem"}}>Situação</p><p style={{fontSize:"1.25rem",fontWeight:"700",color:dadosFinanceiro.saldo>=0?"#10b981":"#ef4444"}}>{dadosFinanceiro.saldo >= 0 ? '✅ Pago' : '⚠️ Devendo'}</p></div>
              </div>
            )}
          </section>

          <section className="mb-8">
            <h3 className="text-xl font-bold mb-4" style={{color:"var(--color-text)"}}>🎓 Graus Filosóficos ({grausFilosoficos.length})</h3>
            {grausFilosoficos.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                {grausFilosoficos.map((g, i) => (
                  <div key={g.id} className={`flex justify-between items-center p-4 ${i !== grausFilosoficos.length - 1 ? 'border-b ' : ''} hover:`}>
                    <div>
                      <p className="font-semibold">Grau {g.graus_maconicos?.numero_grau}° - {g.graus_maconicos?.nome_grau}</p>
                    </div>
                    <span className="text-sm">{formatarData(g.data_conquista)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-center py-4">Nenhum grau filosófico registrado</p>}
          </section>

          <section className="mb-8">
            <h3 className="text-xl font-bold mb-4" style={{color:"var(--color-text)"}}>👥 Comissões</h3>
            <div className="mb-4">
              <h4 className="font-semibold text-green-700 mb-2" style={{color:"var(--color-text)"}}>✓ Ativas ({comissoesAtivas.length})</h4>
              {comissoesAtivas.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  {comissoesAtivas.map((c, i) => (
                    <div key={c.id} className={`flex justify-between items-center p-3 ${i !== comissoesAtivas.length - 1 ? 'border-b ' : ''} `}>
                      <span className="font-medium">{c.comissoes?.nome || 'Sem nome'}</span>
                      <span className="text-sm px-3 py-1 rounded-full" style={{background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.25)"}}>{c.funcao || 'Membro'}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm pl-4">Nenhuma comissão ativa</p>}
            </div>
            <div>
              <h4 className="font-semibold mb-2" style={{color:"var(--color-text)"}}>✗ Inativas ({comissoesInativas.length})</h4>
              {comissoesInativas.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  {comissoesInativas.map((c, i) => (
                    <div key={c.id} className="flex justify-between items-center p-3" style={{borderBottom:"1px solid var(--color-border)"}}>
                      <span>{c.comissoes?.nome || 'Sem nome'}</span>
                      <span className="text-xs" style={{color:"var(--color-text-muted)"}}>Até {formatarData(c.data_saida)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm pl-4">Nenhuma comissão inativa</p>}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-bold mb-4" style={{color:"var(--color-text)"}}>🎉 Eventos Participados ({eventosParticipados.length})</h3>
            {eventosParticipados.length > 0 ? (
              <div className="border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                {eventosParticipados.map((e, i) => (
                  <div key={e.id} className="p-4" style={{borderBottom:"1px solid var(--color-border)"}}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold">{e.eventos_loja?.nome_evento || 'Sem nome'}</p>
                        {e.eventos_loja?.descricao && <p className="text-sm mt-1">{e.eventos_loja.descricao}</p>}
                      </div>
                      <span className="text-sm ml-4 whitespace-nowrap">{formatarData(e.eventos_loja?.data_aviso)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center py-4">Nenhum evento participado</p>}
          </section>
        </div>
      </div>
    </div>
  );
};

export default PerfilCompletoIrmao;
