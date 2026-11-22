import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import GestaoEntidades from './GestaoEntidades';
import GestaoOperacoes from './GestaoOperacoes';
import RelatorioCreditosDebitos from './RelatorioCreditosDebitos';

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
      .eq('status', 'ativo');

    const { data: debitosGeral } = await supabase
      .from('operacoes_credito_debito')
      .select('valor_total')
      .eq('tipo_operacao', 'debito')
      .eq('status', 'ativo');

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
    <div className="space-y-4">
      {/* NAVEGAÇÃO */}
      <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",padding:"0.5rem",background:"var(--color-surface)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)"}}>
        {[
          { id: 'dashboard', rotulo: '📊 Dashboard', cor: 'var(--color-accent)' },
          { id: 'entidades', rotulo: '🏢 Entidades', cor: 'var(--color-accent)' },
          { id: 'creditos', rotulo: '💵 Créditos (A Receber)', cor: '#059669' },
          { id: 'debitos', rotulo: '💳 Débitos (A Pagar)', cor: '#dc2626' },
          { id: 'relatorio', rotulo: '📋 Relatório', cor: 'var(--color-accent)' },
        ].map(aba => (
          <button
            key={aba.id}
            onClick={() => setView(aba.id)}
            style={{padding:'0.5rem 1rem',borderRadius:'var(--radius-md)',fontWeight:'600',fontSize:'0.88rem',cursor:'pointer',border:'none',transition:'all 0.2s',background:view===aba.id?aba.cor:'var(--color-surface-2)',color:view===aba.id?'#fff':'var(--color-text)'}}
          >
            {aba.rotulo}
          </button>
        ))}
      </div>

      {/* DASHBOARD */}
      {view === 'dashboard' && (() => {
        const brl = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const positivo = stats.posicao_liquida >= 0;
        const corLiquida = positivo ? '#10b981' : '#ef4444';
        const atrasadas = alertas.filter(a => a.tipo === 'atrasada');
        const vencendo = alertas.filter(a => a.tipo === 'vencendo');

        const Kpi = ({ icone, rotulo, valor, sub, cor, badge, onClick }) => (
          <div
            onClick={onClick}
            style={{background:'var(--color-surface)',border:`1px solid ${cor}66`,borderLeft:`4px solid ${cor}`,borderRadius:'var(--radius-lg)',padding:'0.85rem 1rem',cursor:onClick?'pointer':'default',minWidth:0}}
          >
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'0.5rem',marginBottom:'0.35rem'}}>
              <span style={{fontSize:'0.82rem',fontWeight:600,color:'var(--color-text-muted)'}}>{icone} {rotulo}</span>
              {badge !== undefined && (
                <span style={{fontSize:'0.7rem',fontWeight:700,padding:'0.1rem 0.5rem',borderRadius:999,background:`${cor}26`,color:cor,border:`1px solid ${cor}55`,whiteSpace:'nowrap'}}>{badge}</span>
              )}
            </div>
            <div style={{fontSize:'1.4rem',fontWeight:700,color:cor,lineHeight:1.15,wordBreak:'break-word'}}>{valor}</div>
            <div style={{fontSize:'0.74rem',color:'var(--color-text-muted)',marginTop:'0.25rem'}}>{sub}</div>
          </div>
        );

        const ListaAlertas = ({ titulo, itens, cor, vazio, textoData }) => (
          <div style={{background:'var(--color-surface)',border:`1px solid ${cor}55`,borderLeft:`4px solid ${cor}`,borderRadius:'var(--radius-lg)',padding:'0.85rem 1rem',minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.6rem'}}>
              <span style={{fontSize:'0.95rem',fontWeight:700,color:'var(--color-text)'}}>{titulo}</span>
              <span style={{fontSize:'0.75rem',fontWeight:700,padding:'0.1rem 0.55rem',borderRadius:999,background:`${cor}26`,color:cor,border:`1px solid ${cor}55`}}>{itens.length}</span>
            </div>
            {itens.length === 0 ? (
              <p style={{textAlign:'center',padding:'0.6rem 0',fontSize:'0.82rem',color:'var(--color-text-muted)'}}>{vazio}</p>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'0.4rem',maxHeight:'16rem',overflowY:'auto'}}>
                {itens.map(alerta => (
                  <div
                    key={alerta.id}
                    onClick={() => setView(alerta.operacao?.tipo_operacao === 'debito' ? 'debitos' : 'creditos')}
                    title="Abrir operações"
                    style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.75rem',background:'var(--color-surface-2)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.7rem',cursor:'pointer'}}
                  >
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:'0.86rem',fontWeight:600,color:'var(--color-text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{alerta.operacao?.entidade_nome}</div>
                      <div style={{fontSize:'0.74rem',color:'var(--color-text-muted)'}}>Parcela {alerta.numero_parcela} • {textoData(alerta)}</div>
                    </div>
                    <span style={{fontSize:'0.86rem',fontWeight:700,color:cor,whiteSpace:'nowrap'}}>{brl(alerta.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

        return (
          <div className="space-y-4">
            {/* INDICADORES */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(215px,1fr))',gap:'0.75rem'}}>
              <Kpi icone="💵" rotulo="A Receber" valor={brl(stats.total_a_receber)} sub="Saldo pendente de recebimento" cor="#10b981" badge={`${stats.num_creditos_ativos} ativas`} onClick={() => setView('creditos')} />
              <Kpi icone="💳" rotulo="A Pagar" valor={brl(stats.total_a_pagar)} sub="Saldo pendente de pagamento" cor="#ef4444" badge={`${stats.num_debitos_ativos} ativas`} onClick={() => setView('debitos')} />
              <Kpi icone="⚖️" rotulo="Posição Líquida" valor={brl(Math.abs(stats.posicao_liquida))} sub={positivo ? 'Saldo credor' : 'Saldo devedor'} cor={corLiquida} />
              <Kpi icone="🚨" rotulo="Parcelas Atrasadas" valor={String(stats.parcelas_atrasadas)} sub={stats.parcelas_atrasadas > 0 ? 'Requer atenção' : 'Tudo em dia'} cor={stats.parcelas_atrasadas > 0 ? '#ef4444' : '#10b981'} />
            </div>

            {/* TOTAIS DAS OPERAÇÕES EM ANDAMENTO */}
            <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',padding:'0.7rem 1rem',display:'flex',flexWrap:'wrap',gap:'0.5rem 2rem',alignItems:'center'}}>
              <span style={{fontSize:'0.82rem',fontWeight:700,color:'var(--color-text)'}}>📊 Negócios em andamento (valor original)</span>
              <span style={{fontSize:'0.82rem',color:'var(--color-text-muted)'}}>📤 Emprestado a terceiros: <strong style={{color:'#10b981'}}>{brl(stats.total_geral_emprestado)}</strong></span>
              <span style={{fontSize:'0.82rem',color:'var(--color-text-muted)'}}>📥 Tomado emprestado: <strong style={{color:'#ef4444'}}>{brl(stats.total_geral_tomado)}</strong></span>
            </div>

            {/* ALERTAS */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:'0.75rem'}}>
              <ListaAlertas
                titulo="🚨 Parcelas Atrasadas"
                itens={atrasadas}
                cor="#ef4444"
                vazio="✅ Nenhuma parcela atrasada"
                textoData={a => `${a.dias_atraso} dias de atraso`}
              />
              <ListaAlertas
                titulo="⏰ Vencendo em 7 dias"
                itens={vencendo}
                cor="#f59e0b"
                vazio="✅ Nenhuma parcela próxima"
                textoData={a => `vence em ${new Date(a.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}`}
              />
            </div>
          </div>
        );
      })()}

      {/* ENTIDADES */}
      {view === 'entidades' && (
        <GestaoEntidades 
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      {/* RELATÓRIO POR OPERAÇÃO */}
      {view === 'relatorio' && (
        <RelatorioCreditosDebitos showError={showError} />
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
