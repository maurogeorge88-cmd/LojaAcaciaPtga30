import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import GestaoEntidades from './GestaoEntidades';
import GestaoOperacoes from './GestaoOperacoes';

export default function CreditosDebitos({ permissoes, showSuccess, showError }) {
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Estados do Dashboard
  const [stats, setStats] = useState({
    total_a_receber: 0,
    total_a_pagar: 0,
    posicao_liquida: 0,
    parcelas_atrasadas: 0,
    parcelas_vencendo_7dias: 0,
    num_creditos_ativos: 0,
    num_debitos_ativos: 0,
    total_geral_emprestado: 0,  // NOVO: Total histórico emprestado
    total_geral_tomado: 0        // NOVO: Total histórico tomado
  });
  
  // Estados das Entidades
  const [entidades, setEntidades] = useState([]);
  const [modalEntidade, setModalEntidade] = useState(false);
  const [entidadeAtual, setEntidadeAtual] = useState(null);
  
  // Estados das Operações
  const [operacoes, setOperacoes] = useState([]);
  const [modalOperacao, setModalOperacao] = useState(false);
  const [operacaoAtual, setOperacaoAtual] = useState(null);
  
  // Estados dos Alertas
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    carregarDados();
  }, [view]);

  const carregarDados = async () => {
    setLoading(true);
    
    try {
      // Dashboard
      if (view === 'dashboard') {
        await carregarDashboard();
        await carregarAlertas();
      }
      
      // Entidades
      if (view === 'entidades') {
        await carregarEntidades();
      }
      
      // Operações
      if (view === 'operacoes' || view === 'creditos' || view === 'debitos') {
        await carregarOperacoes();
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const carregarDashboard = async () => {
    const { data, error } = await supabase
      .from('vw_dashboard_creditos_debitos')
      .select('*')
      .single();

    if (error) {
      console.error('Erro:', error);
      return;
    }

    // Calcular totais gerais (todos os créditos e débitos, incluindo quitados)
    const { data: creditosGeral } = await supabase
      .from('operacoes_credito_debito')
      .select('valor_total')
      .eq('tipo_operacao', 'credito')
      .neq('status', 'cancelado');

    const { data: debitosGeral } = await supabase
      .from('operacoes_credito_debito')
      .select('valor_total')
      .eq('tipo_operacao', 'debito')
      .neq('status', 'cancelado');

    const totalGeralEmprestado = creditosGeral?.reduce((sum, op) => sum + op.valor_total, 0) || 0;
    const totalGeralTomado = debitosGeral?.reduce((sum, op) => sum + op.valor_total, 0) || 0;

    setStats({
      ...(data || {}),
      total_a_receber: data?.total_a_receber || 0,
      total_a_pagar: data?.total_a_pagar || 0,
      posicao_liquida: data?.posicao_liquida || 0,
      parcelas_atrasadas: data?.parcelas_atrasadas || 0,
      parcelas_vencendo_7dias: data?.parcelas_vencendo_7dias || 0,
      num_creditos_ativos: data?.num_creditos_ativos || 0,
      num_debitos_ativos: data?.num_debitos_ativos || 0,
      total_geral_emprestado: totalGeralEmprestado,
      total_geral_tomado: totalGeralTomado
    });
  };

  const carregarAlertas = async () => {
    // Parcelas atrasadas
    const { data: atrasadas } = await supabase
      .from('parcelas_operacoes')
      .select(`
        *,
        operacao:operacoes_credito_debito(
          tipo_operacao,
          entidade_nome,
          descricao
        )
      `)
      .eq('status', 'atrasado')
      .order('data_vencimento', { ascending: true })
      .limit(10);

    // Parcelas vencendo em 7 dias
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() + 7);
    
    const { data: vencendo } = await supabase
      .from('parcelas_operacoes')
      .select(`
        *,
        operacao:operacoes_credito_debito(
          tipo_operacao,
          entidade_nome,
          descricao
        )
      `)
      .eq('status', 'pendente')
      .gte('data_vencimento', new Date().toISOString().split('T')[0])
      .lte('data_vencimento', dataLimite.toISOString().split('T')[0])
      .order('data_vencimento', { ascending: true })
      .limit(10);

    setAlertas([
      ...(atrasadas || []).map(p => ({ ...p, tipo: 'atrasada' })),
      ...(vencendo || []).map(p => ({ ...p, tipo: 'vencendo' }))
    ]);
  };

  const carregarEntidades = async () => {
    const { data, error } = await supabase
      .from('entidades_financeiras')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    if (!error) {
      setEntidades(data || []);
    }
  };

  const carregarOperacoes = async () => {
    let query = supabase
      .from('operacoes_credito_debito')
      .select('*')
      .order('data_lancamento', { ascending: false });

    if (view === 'creditos') {
      query = query.eq('tipo_operacao', 'credito');
    } else if (view === 'debitos') {
      query = query.eq('tipo_operacao', 'debito');
    }

    const { data, error } = await query;

    if (!error) {
      setOperacoes(data || []);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center" style={{color:"var(--color-text-muted)"}}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto"></div>
          <p className="mt-4">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{background:"var(--color-bg)",minHeight:"100vh",padding:"1rem",overflowX:"hidden"}}>
      {/* HEADER */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-xl p-6 text-white" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" style={{color:"var(--color-text)"}}>
              💰 Créditos e Débitos
            </h1>
            <p style={{color:"rgba(255,255,255,0.85)",marginTop:"0.5rem"}}>
              Controle de operações financeiras com terceiros
            </p>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO */}
      <div className="rounded-xl p-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setView('dashboard')}
            style={{padding:'0.75rem 1.5rem',borderRadius:'var(--radius-lg)',fontWeight:'600',cursor:'pointer',border:'none',transition:'all 0.2s',background:view==='dashboard'?'var(--color-accent)':'var(--color-surface-2)',color:view==='dashboard'?'#fff':'var(--color-text)'}}
          >
            📊 Dashboard
          </button>

          <button
            onClick={() => setView('entidades')}
            style={{padding:'0.75rem 1.5rem',borderRadius:'var(--radius-lg)',fontWeight:'600',cursor:'pointer',border:'none',transition:'all 0.2s',background:view==='entidades'?'var(--color-accent)':'var(--color-surface-2)',color:view==='entidades'?'#fff':'var(--color-text)'}}
          >
            🏢 Entidades
          </button>

          <button
            onClick={() => setView('creditos')}
            style={{padding:'0.75rem 1.5rem',borderRadius:'var(--radius-lg)',fontWeight:'600',cursor:'pointer',border:'none',transition:'all 0.2s',background:view==='creditos'?'#059669':'var(--color-surface-2)',color:view==='creditos'?'#fff':'var(--color-text)'}}
          >
            💵 Créditos (A Receber)
          </button>

          <button
            onClick={() => setView('debitos')}
            style={{padding:'0.75rem 1.5rem',borderRadius:'var(--radius-lg)',fontWeight:'600',cursor:'pointer',border:'none',transition:'all 0.2s',background:view==='debitos'?'#dc2626':'var(--color-surface-2)',color:view==='debitos'?'#fff':'var(--color-text)'}}
          >
            💳 Débitos (A Pagar)
          </button>
        </div>
      </div>

      {/* DASHBOARD */}
      {view === 'dashboard' && (
        <div className="space-y-6">
          {/* NEGÓCIOS CONSOLIDADOS (TOTAIS HISTÓRICOS) */}
          <div className="rounded-xl p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <h3 className="text-xl font-bold mb-4" style={{color:"var(--color-text)"}}>📊 Negócios Consolidados</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* TOTAL EMPRESTADO A TERCEIROS */}
              <div className="rounded-xl p-6 border-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <div className="flex items-center gap-3 mb-3">
                  <div style={{background:"#10b981",color:"#fff",width:"3rem",height:"3rem",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem"}}>
                    📤
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold" style={{color:"var(--color-text)"}}>Emprestado a Terceiros</h4>
                    <p style={{fontSize:"0.875rem",color:"var(--color-text-muted)"}}>Total histórico de créditos concedidos</p>
                  </div>
                </div>
                <p style={{fontSize:"2.25rem",fontWeight:"700",color:"var(--color-text)",marginBottom:"0.5rem"}}>
                  R$ {stats.total_geral_emprestado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span>✓ Inclui operações ativas e quitadas</span>
                </div>
              </div>

              {/* TOTAL TOMADO EMPRESTADO */}
              <div className="rounded-xl p-6 border-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <div className="flex items-center gap-3 mb-3">
                  <div style={{background:"#ef4444",color:"#fff",width:"3rem",height:"3rem",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem"}}>
                    📥
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold" style={{color:"var(--color-text)"}}>Tomado Emprestado</h4>
                    <p style={{fontSize:"0.875rem",color:"var(--color-text-muted)"}}>Total histórico de débitos assumidos</p>
                  </div>
                </div>
                <p style={{fontSize:"2.25rem",fontWeight:"700",color:"var(--color-text)",marginBottom:"0.5rem"}}>
                  R$ {stats.total_geral_tomado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span>✓ Inclui operações ativas e quitadas</span>
                </div>
              </div>
            </div>
          </div>

          {/* CENÁRIO ATUAL (SALDOS PENDENTES) */}
          <div className="rounded-xl p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <h3 className="text-xl font-bold mb-4" style={{color:"var(--color-text)"}}>💼 Cenário Atual</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* A RECEBER */}
              <div className="rounded-xl p-6 border-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold" style={{color:"var(--color-text)"}}>💵 A Receber</h3>
                  <span className="bg-green-600 text-white text-xs px-3 py-1 rounded-full">
                    {stats.num_creditos_ativos} ativas
                  </span>
                </div>
                <p className="text-3xl font-bold">
                  R$ {stats.total_a_receber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p style={{fontSize:"0.875rem",marginTop:"0.5rem",color:"var(--color-text-muted)"}}>Saldo pendente de recebimento</p>
              </div>

              {/* A PAGAR */}
              <div className="rounded-xl p-6 border-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold" style={{color:"var(--color-text)"}}>💳 A Pagar</h3>
                  <span className="bg-red-600 text-white text-xs px-3 py-1 rounded-full">
                    {stats.num_debitos_ativos} ativas
                  </span>
                </div>
                <p className="text-3xl font-bold">
                  R$ {stats.total_a_pagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p style={{fontSize:"0.875rem",marginTop:"0.5rem",color:"var(--color-text-muted)"}}>Saldo pendente de pagamento</p>
              </div>

              {/* POSIÇÃO LÍQUIDA */}
              <div className={` ${
                stats.posicao_liquida >= 0 
                  ? ' ' 
                  : ' '
              } rounded-xl p-6 border-2`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 style={{fontSize:"1.1rem",fontWeight:"700",color:"var(--color-text)"}}>⚖️ Posição Líquida</h3>
                </div>
                <p style={{fontSize:"1.875rem",fontWeight:"700",color:stats.posicao_liquida>=0?"#10b981":"#ef4444"}}>R$ {Math.abs(stats.posicao_liquida).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p style={{fontSize:"0.875rem",marginTop:"0.5rem",color:"var(--color-text-muted)"}}>  {stats.posicao_liquida >= 0 ? 'Saldo credor' : 'Saldo devedor'}
                </p>
              </div>
            </div>
          </div>

          {/* ALERTAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ATRASADAS */}
            <div className="rounded-xl p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{color:"var(--color-text)"}}>🚨 Parcelas Atrasadas</h3>
                <span style={{padding:"0.25rem 0.55rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}>
                  {stats.parcelas_atrasadas}
                </span>
              </div>
              
              {alertas.filter(a => a.tipo === 'atrasada').length === 0 ? (
                <p className="text-center py-4">✅ Nenhuma parcela atrasada</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {alertas.filter(a => a.tipo === 'atrasada').map(alerta => (
                    <div key={alerta.id} className="bg-red-50 border rounded-lg p-3" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">
                            {alerta.operacao.entidade_nome}
                          </p>
                          <p className="text-sm">
                            Parcela {alerta.numero_parcela} - {alerta.dias_atraso} dias
                          </p>
                        </div>
                        <span className="font-bold">
                          R$ {alerta.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* VENCENDO */}
            <div className="rounded-xl p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{color:"var(--color-text)"}}>⏰ Vencendo em 7 dias</h3>
                <span className="bg-yellow-600 text-white text-sm px-3 py-1 rounded-full">
                  {stats.parcelas_vencendo_7dias}
                </span>
              </div>
              
              {alertas.filter(a => a.tipo === 'vencendo').length === 0 ? (
                <p className="text-center py-4">✅ Nenhuma parcela próxima</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {alertas.filter(a => a.tipo === 'vencendo').map(alerta => (
                    <div key={alerta.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-yellow-800">
                            {alerta.operacao.entidade_nome}
                          </p>
                          <p className="text-sm text-yellow-600">
                            Parcela {alerta.numero_parcela} - Vence em {new Date(alerta.data_vencimento).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <span className="text-yellow-700 font-bold">
                          R$ {alerta.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ENTIDADES */}
      {view === 'entidades' && (
        <GestaoEntidades 
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      {/* CRÉDITOS E DÉBITOS */}
      {(view === 'creditos' || view === 'debitos') && (
        <GestaoOperacoes
          tipo={view === 'creditos' ? 'credito' : 'debito'}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}
    </div>
  );
}
