import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function DetalhesOperacao({ operacaoId, onClose, onUpdate, showSuccess, showError }) {
  const [operacao, setOperacao] = useState(null);
  const [parcelas, setParcelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalQuitacao, setModalQuitacao] = useState(false);
  const [parcelaAtual, setParcelaAtual] = useState(null);

  // Formulário de quitação
  const [formQuitacao, setFormQuitacao] = useState({
    valor_pago: '',
    data_pagamento: new Date().toISOString().split('T')[0],
    meio_pagamento: 'pix',
    observacoes: ''
  });

  useEffect(() => {
    carregarDados();
  }, [operacaoId]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Carregar operação
      const { data: opData, error: opError } = await supabase
        .from('operacoes_credito_debito')
        .select('*, entidades_financeiras(nome, tipo)')
        .eq('id', operacaoId)
        .single();

      if (opError) throw opError;
      setOperacao(opData);

      // Carregar parcelas
      const { data: parcData, error: parcError } = await supabase
        .from('parcelas_operacoes')
        .select('*')
        .eq('operacao_id', operacaoId)
        .order('numero_parcela');

      if (parcError) throw parcError;
      setParcelas(parcData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showError('Erro ao carregar detalhes');
    } finally {
      setLoading(false);
    }
  };

  const abrirModalQuitacao = (parcela) => {
    setParcelaAtual(parcela);
    setFormQuitacao({
      valor_pago: parcela.valor.toFixed(2),
      data_pagamento: new Date().toISOString().split('T')[0],
      meio_pagamento: operacao?.meio_pagamento || 'pix',
      observacoes: ''
    });
    setModalQuitacao(true);
  };

  const quitarParcela = async (e) => {
    e.preventDefault();

    try {
      const valorPago = parseFloat(formQuitacao.valor_pago);
      
      if (!valorPago || valorPago <= 0) {
        showError('Valor pago deve ser maior que zero');
        return;
      }

      setLoading(true);

      // Atualizar parcela
      const { error: errorParcela } = await supabase
        .from('parcelas_operacoes')
        .update({
          status: 'pago',
          valor_pago: valorPago,
          data_pagamento: formQuitacao.data_pagamento,
          meio_pagamento: formQuitacao.meio_pagamento,
          observacoes: formQuitacao.observacoes.trim() || null,
          dias_atraso: 0
        })
        .eq('id', parcelaAtual.id);

      if (errorParcela) throw errorParcela;

      // Recalcular totais da operação
      const { data: todasParcelas } = await supabase
        .from('parcelas_operacoes')
        .select('valor_pago')
        .eq('operacao_id', operacaoId);

      const totalPago = todasParcelas.reduce((sum, p) => sum + (p.valor_pago || 0), 0);
      const saldoDevedor = operacao.valor_total - totalPago;
      const novoStatus = saldoDevedor <= 0.01 ? 'quitado' : 'ativo';

      // Atualizar operação
      const { error: errorOp } = await supabase
        .from('operacoes_credito_debito')
        .update({
          valor_pago: totalPago,
          saldo_devedor: saldoDevedor,
          status: novoStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', operacaoId);

      if (errorOp) throw errorOp;

      // Fechar modal e mostrar sucesso
      setModalQuitacao(false);
      showSuccess('Parcela quitada com sucesso!');
      
      // FORÇAR RECARREGAMENTO COMPLETO
      setLoading(true);
      await carregarDados();
      
      // Notificar componente pai para atualizar lista
      if (onUpdate) {
        await onUpdate();
      }
    } catch (error) {
      console.error('Erro ao quitar parcela:', error);
      showError('Erro ao quitar parcela');
    } finally {
      setLoading(false);
    }
  };

  const estornarParcela = async (parcela) => {
    if (!window.confirm(`Deseja estornar o pagamento da parcela ${parcela.numero_parcela}?`)) {
      return;
    }

    try {
      setLoading(true);

      // Atualizar parcela
      const { error: errorParcela } = await supabase
        .from('parcelas_operacoes')
        .update({
          status: 'pendente',
          valor_pago: 0,
          data_pagamento: null,
          observacoes: `Estornado em ${new Date().toLocaleDateString('pt-BR')}. ${parcela.observacoes || ''}`
        })
        .eq('id', parcela.id);

      if (errorParcela) throw errorParcela;

      // Recalcular totais
      const { data: todasParcelas } = await supabase
        .from('parcelas_operacoes')
        .select('valor_pago')
        .eq('operacao_id', operacaoId);

      const totalPago = todasParcelas.reduce((sum, p) => sum + (p.valor_pago || 0), 0);
      const saldoDevedor = operacao.valor_total - totalPago;

      await supabase
        .from('operacoes_credito_debito')
        .update({
          valor_pago: totalPago,
          saldo_devedor: saldoDevedor,
          status: 'ativo',
          updated_at: new Date().toISOString()
        })
        .eq('id', operacaoId);

      showSuccess('Pagamento estornado com sucesso!');
      
      // FORÇAR RECARREGAMENTO COMPLETO
      setLoading(true);
      await carregarDados();
      
      // Notificar componente pai para atualizar lista
      if (onUpdate) {
        await onUpdate();
      }
    } catch (error) {
      console.error('Erro ao estornar parcela:', error);
      showError('Erro ao estornar parcela');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status, diasAtraso = 0) => {
    const badges = {
      'pendente': { styleObj: {background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.3)'}, label: '⏳ Pendente', icon: '⏳' },
      'pago':     { styleObj: {background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)'}, label: '✓ Pago', icon: '✓' },
      'atrasado': { styleObj: {background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}, label: `🚨 Atrasado (${diasAtraso}d)`, icon: '🚨' },
      'cancelado':{ styleObj: {background:'var(--color-surface-2)',color:'var(--color-text-muted)',border:'1px solid var(--color-border)'}, label: '✗ Cancelado', icon: '✗' }
    };
    return badges[status] || badges.pendente;
  };

  const getTipoIcon = () => {
    return operacao?.tipo_operacao === 'credito' ? '💵' : '💳';
  };

  const getTipoLabel = () => {
    return operacao?.tipo_operacao === 'credito' ? 'Crédito (A Receber)' : 'Débito (A Pagar)';
  };

  const getTipoColor = () => {
    return operacao?.tipo_operacao === 'credito' ? 'green' : 'red';
  };

  if (loading && !operacao) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="rounded-xl p-8 text-center" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"></div>
          <p>Carregando detalhes...</p>
        </div>
      </div>
    );
  }

  if (!operacao) {
    return null;
  }

  const percentualPago = operacao.valor_total > 0 
    ? ((operacao.valor_pago / operacao.valor_total) * 100).toFixed(1)
    : 0;

  const parcelasPagas = parcelas.filter(p => p.status === 'pago').length;
  const parcelasAtrasadas = parcelas.filter(p => p.status === 'atrasado').length;
  const parcelasPendentes = parcelas.filter(p => p.status === 'pendente').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-xl)",width:"100%",maxWidth:"72rem",margin:"2rem auto"}}>
        {/* HEADER */}
        <div 
          className="p-6 text-white flex items-center justify-between"
          style={{
            background: operacao.tipo_operacao === 'credito' 
              ? 'linear-gradient(to right, #16a34a, #15803d)'
              : 'linear-gradient(to right, #dc2626, #b91c1c)'
          }}
        >
          <div>
            <h2 style={{fontSize:"1.5rem",fontWeight:"700",color:"#fff",display:"flex",alignItems:"center",gap:"0.5rem",margin:0}}>
              {getTipoIcon()} Detalhes da Operação
            </h2>
            <p style={{color:"rgba(255,255,255,0.8)",marginTop:"0.25rem"}}>{getTipoLabel()}</p>
          </div>
          <button
            onClick={onClose}
            style={{color:"#fff",background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:"50%",width:"2rem",height:"2rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1rem",fontWeight:"700"}}
          >
            ✕
          </button>
        </div>

        <div style={{padding:"1rem",display:"flex",flexDirection:"column",gap:"1rem",maxHeight:"80vh",overflowY:"auto",background:"var(--color-bg)"}}>
          {/* INFORMAÇÕES DA OPERAÇÃO */}
          <div className="rounded-xl p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <h3 className="text-lg font-bold mb-3" style={{color:"var(--color-text)"}}>📋 Informações Gerais</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <span style={{fontSize:"0.72rem",color:"var(--color-text-muted)",display:"block"}}>Entidade</span>
                <span style={{fontWeight:"700",fontSize:"0.875rem",color:"var(--color-text)"}}>{operacao.entidade_nome}</span>
              </div>
              <div>
                <span style={{fontSize:"0.72rem",color:"var(--color-text-muted)",display:"block"}}>Data de Lançamento</span>
                <span style={{fontWeight:"700",fontSize:"0.875rem",color:"var(--color-text)"}}>{new Date(operacao.data_lancamento).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

            {operacao.descricao && (
              <div className="mb-3">
                <span style={{fontSize:"0.72rem",color:"var(--color-text-muted)",display:"block"}}>Descrição</span>
                <span style={{fontWeight:"700",fontSize:"0.875rem",color:"var(--color-text)"}}>{operacao.descricao}</span>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg p-3 border-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <span style={{fontSize:"0.72rem",color:"var(--color-text-muted)",display:"block"}}>Valor Total</span>
                <span style={{fontWeight:"700",fontSize:"1.1rem",color:"var(--color-text)"}}>
                  R$ {operacao.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="rounded-lg p-3 border-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <span style={{fontSize:"0.72rem",color:"var(--color-text-muted)",display:"block"}}>Valor Pago</span>
                <span style={{fontWeight:"700",fontSize:"1.1rem",color:"var(--color-text)"}}>
                  R$ {operacao.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="rounded-lg p-3 border-2 border-orange-200" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <span style={{fontSize:"0.72rem",color:"var(--color-text-muted)",display:"block"}}>Saldo Devedor</span>
                <span style={{fontWeight:"700",fontSize:"1.1rem",color:"#f59e0b"}}>
                  R$ {operacao.saldo_devedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="rounded-lg p-3 border-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <span style={{fontSize:"0.72rem",color:"var(--color-text-muted)",display:"block"}}>Progresso</span>
                <div className="flex items-center gap-2 mt-1">
                  <div style={{flex:1,background:"var(--color-surface-2)",borderRadius:"999px",height:"0.5rem"}}>
                    <div 
                      style={{background:"#8b5cf6",height:"0.5rem",borderRadius:"999px",transition:"width 0.3s"}}
                      style={{ width: `${percentualPago}%` }}
                    />
                  </div>
                  <span style={{fontSize:"0.82rem",fontWeight:"700",color:"#8b5cf6"}}>{percentualPago}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* RESUMO DAS PARCELAS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg p-3 border-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <div className="text-center">
                <div style={{fontSize:"1.5rem",fontWeight:"800",color:"var(--color-text)"}}>{parcelas.length}</div>
                <div style={{fontSize:"0.72rem",fontWeight:"700",color:"var(--color-text-muted)"}}>Total</div>
              </div>
            </div>

            <div className="rounded-lg p-3 border-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <div className="text-center">
                <div style={{fontSize:"1.5rem",fontWeight:"800",color:"#10b981"}}>{parcelasPagas}</div>
                <div style={{fontSize:"0.72rem",fontWeight:"700",color:"#10b981"}}>✓ Pagas</div>
              </div>
            </div>

            <div className="rounded-lg p-3 border-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <div className="text-center">
                <div style={{fontSize:"1.5rem",fontWeight:"800",color:"#f59e0b"}}>{parcelasPendentes}</div>
                <div style={{fontSize:"0.72rem",fontWeight:"700",color:"#f59e0b"}}>⏳ Pendentes</div>
              </div>
            </div>

            <div className="rounded-lg p-3 border-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <div className="text-center">
                <div style={{fontSize:"1.5rem",fontWeight:"800",color:"#ef4444"}}>{parcelasAtrasadas}</div>
                <div style={{fontSize:"0.72rem",fontWeight:"700",color:"#ef4444"}}>🚨 Atrasadas</div>
              </div>
            </div>
          </div>

          {/* LISTA DE PARCELAS */}
          <div>
            <h3 className="text-lg font-bold mb-3" style={{color:"var(--color-text)"}}>📅 Parcelas</h3>
            
            {parcelas.length === 0 ? (
              <div className="rounded-lg p-8 text-center" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <p>Nenhuma parcela cadastrada</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {parcelas.map(parcela => {
                  const statusBadge = getStatusBadge(parcela.status, parcela.dias_atraso);
                  
                  return (
                    <div 
                      key={parcela.id} 
                      style={{
                        background:parcela.status==='pago'?'rgba(16,185,129,0.06)':parcela.status==='atrasado'?'rgba(239,68,68,0.06)':parcela.status==='pendente'?'rgba(245,158,11,0.06)':'var(--color-surface-2)',
                        border:parcela.status==='pago'?'1px solid rgba(16,185,129,0.3)':parcela.status==='atrasado'?'1px solid rgba(239,68,68,0.3)':parcela.status==='pendente'?'1px solid rgba(245,158,11,0.3)':'1px solid var(--color-border)',
                        borderRadius:'var(--radius-lg)',padding:'0.75rem',
                      }}
                    >
                      {/* Número e Status */}
                      <div className="text-center mb-2">
                        <div style={{fontSize:"1rem",fontWeight:"800",color:"var(--color-text)"}}>
                          {parcela.numero_parcela}/{parcelas.length}
                        </div>
                        <span style={{...statusBadge.styleObj,display:"inline-block",padding:"0.15rem 0.5rem",borderRadius:"999px",fontSize:"0.7rem",fontWeight:"700"}}>
                          {statusBadge.icon}
                        </span>
                      </div>

                      {/* Valor */}
                      <div className="text-center mb-2">
                        <div style={{fontSize:"0.65rem",color:"var(--color-text-muted)"}}>Valor</div>
                        <div style={{fontWeight:"700",fontSize:"0.82rem",color:"var(--color-text)"}}>
                          R$ {parcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      {/* Vencimento */}
                      <div className="text-center mb-2">
                        <div style={{fontSize:"0.65rem",color:"var(--color-text-muted)"}}>Vencimento</div>
                        <div style={{fontWeight:"600",fontSize:"0.72rem",color:"var(--color-text)"}}>
                          {new Date(parcela.data_vencimento).toLocaleDateString('pt-BR')}
                        </div>
                      </div>

                      {/* Pagamento (se pago) */}
                      {parcela.status === 'pago' && (
                        <div className="text-center mb-2 rounded p-1" style={{background:"rgba(16,185,129,0.1)"}}>
                          <div style={{fontSize:"0.65rem",color:"var(--color-text-muted)"}}>Pago em</div>
                          <div style={{fontWeight:"600",fontSize:"0.72rem",color:"var(--color-text)"}}>
                            {new Date(parcela.data_pagamento).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      )}

                      {/* Dias de atraso */}
                      {parcela.status === 'atrasado' && parcela.dias_atraso > 0 && (
                        <div className="text-center mb-2 rounded p-1" style={{background:"rgba(239,68,68,0.1)"}}>
                          <div style={{fontSize:"0.72rem",fontWeight:"700",color:"#ef4444"}}>
                            {parcela.dias_atraso} dias
                          </div>
                        </div>
                      )}

                      {/* Botão */}
                      <div className="text-center mt-2">
                        {parcela.status === 'pago' ? (
                          <button
                            onClick={() => estornarParcela(parcela)}
                            style={{width:"100%",background:"rgba(245,158,11,0.15)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.3)",padding:"0.25rem 0.5rem",borderRadius:"var(--radius-sm)",fontWeight:"700",cursor:"pointer",fontSize:"0.72rem"}}
                          >
                            ↶ Estornar
                          </button>
                        ) : parcela.status !== 'cancelado' && (
                          <button
                            onClick={() => abrirModalQuitacao(parcela)}
                            style={{width:"100%",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.3)",padding:"0.25rem 0.5rem",borderRadius:"var(--radius-sm)",fontWeight:"700",cursor:"pointer",fontSize:"0.72rem"}}
                          >
                            💰 Quitar
                          </button>
                        )}
                      </div>

                      {/* Observações (se houver) */}
                      {parcela.observacoes && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="text-xs truncate" title={parcela.observacoes}>
                            {parcela.observacoes}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* BOTÃO FECHAR */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              style={{padding:"0.75rem 1.5rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE QUITAÇÃO */}
      {modalQuitacao && parcelaAtual && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-xl)",width:"100%",maxWidth:"28rem"}}>
            <div style={{background:"#10b981",padding:"1.25rem 1.5rem",borderRadius:"var(--radius-xl) var(--radius-xl) 0 0"}}>
              <h3 style={{fontSize:"1.1rem",fontWeight:"700",color:"#fff",margin:0}}>💰 Quitar Parcela {parcelaAtual.numero_parcela}</h3>
            </div>

            <form onSubmit={quitarParcela} style={{padding:"1.5rem",display:"flex",flexDirection:"column",gap:"1rem"}}>
              <div className="rounded-lg p-4 mb-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <div style={{fontSize:"0.82rem",color:"var(--color-text-muted)"}}>Valor da Parcela</div>
                <div style={{fontSize:"1.5rem",fontWeight:"800",color:"var(--color-text)"}}>
                  R$ {parcelaAtual.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{color:"var(--color-text-muted)"}}>
                  Valor Pago <span>*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formQuitacao.valor_pago}
                  onChange={(e) => setFormQuitacao({ ...formQuitacao, valor_pago: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-green-500 focus:border-transparent" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{color:"var(--color-text-muted)"}}>
                  Data do Pagamento <span>*</span>
                </label>
                <input
                  type="date"
                  value={formQuitacao.data_pagamento}
                  onChange={(e) => setFormQuitacao({ ...formQuitacao, data_pagamento: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-green-500 focus:border-transparent" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{color:"var(--color-text-muted)"}}>
                  Meio de Pagamento
                </label>
                <select
                  value={formQuitacao.meio_pagamento}
                  onChange={(e) => setFormQuitacao({ ...formQuitacao, meio_pagamento: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-green-500 focus:border-transparent" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                >
                  <option value="pix">PIX</option>
                  <option value="transferencia">Transferência</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cheque">Cheque</option>
                  <option value="boleto">Boleto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{color:"var(--color-text-muted)"}}>
                  Observações
                </label>
                <textarea
                  value={formQuitacao.observacoes}
                  onChange={(e) => setFormQuitacao({ ...formQuitacao, observacoes: e.target.value })}
                  placeholder="Informações adicionais sobre o pagamento..."
                  rows="3"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-green-500 focus:border-transparent" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalQuitacao(false)}
                  style={{flex:1,padding:"0.75rem 1.5rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{flex:1,padding:"0.75rem 1.5rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700",opacity:loading?0.6:1}}
                  disabled={loading}
                >
                  {loading ? 'Quitando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
