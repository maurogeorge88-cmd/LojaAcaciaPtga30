import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarMoeda, formatarDataBR } from './utils/formatadores';

export default function ModalCompensacao({ irmao, debitos, creditos, onClose, onSuccess, showSuccess, showError }) {
  const [debitosSelecionados, setDebitosSelecionados] = useState([]);
  const [creditosSelecionados, setCreditosSelecionados] = useState([]);

  // Calcular totais
  const totalDebitos = debitosSelecionados.reduce((sum, id) => {
    const debito = debitos.find(d => d.id === id);
    return sum + (debito ? parseFloat(debito.valor) : 0);
  }, 0);

  const totalCreditos = creditosSelecionados.reduce((sum, id) => {
    const credito = creditos.find(c => c.id === id);
    return sum + (credito ? parseFloat(credito.valor) : 0);
  }, 0);

  const valorCompensar = Math.min(totalDebitos, totalCreditos);
  const saldoFinal = totalDebitos - totalCreditos;

  const toggleDebito = (id) => {
    setDebitosSelecionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleCredito = (id) => {
    setCreditosSelecionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleCompensar = async (e) => {
    e.preventDefault();
    
    if (debitosSelecionados.length === 0 || creditosSelecionados.length === 0) {
      showError('Selecione pelo menos um débito e um crédito para compensar');
      return;
    }
    
    if (valorCompensar === 0) {
      showError('Não há valor a compensar');
      return;
    }
    
    try {
      const dataCompensacao = new Date().toISOString().split('T')[0];
      
      // Processar débitos selecionados (receitas - irmão deve)
      for (const debitoId of debitosSelecionados) {
        const debito = debitos.find(d => d.id === debitoId);
        if (!debito) continue;
        
        const valorDebito = parseFloat(debito.valor);
        const proporcao = valorDebito / totalDebitos;
        const valorACompensar = Math.min(valorDebito, valorCompensar * proporcao);
        
        if (valorACompensar >= valorDebito - 0.01) {
          // Quitar completamente o débito
          const { error } = await supabase
            .from('lancamentos_loja')
            .update({
              status: 'pago',
              data_pagamento: dataCompensacao,
              tipo_pagamento: 'compensacao'
            })
            .eq('id', debitoId);
            
          if (error) throw error;
        } else {
          // Compensação parcial do débito
          
          const { error: errorInsert } = await supabase
            .from('lancamentos_loja')
            .insert({
              tipo: 'receita', // Débito é sempre receita
              categoria_id: debito.categoria_id,
              descricao: `💰 Compensação: ${debito.descricao}`,
              valor: valorACompensar,
              data_lancamento: dataCompensacao,
              data_vencimento: dataCompensacao,
              data_pagamento: dataCompensacao,
              tipo_pagamento: 'compensacao',
              status: 'pago',
              origem_tipo: debito.origem_tipo,
              origem_irmao_id: debito.origem_irmao_id,
              evento_comemorativo_id: debito.evento_comemorativo_id || null,
              eh_pagamento_parcial: true,
              lancamento_principal_id: debitoId
            });
            
          if (errorInsert) throw errorInsert;
          
          // ATUALIZAR o valor do lançamento original para refletir a compensação
          const novoValor = valorDebito - valorACompensar;
          
          // Preparar observações com valor original (se ainda não tiver)
          let novasObservacoes = debito.observacoes || '';
          if (!novasObservacoes.includes('Valor original:')) {
            // Primeira alteração - guardar valor original
            novasObservacoes = `[Valor original: R$ ${valorDebito.toFixed(2)}]\n${novasObservacoes}`.trim();
          }
          novasObservacoes += `\n[Compensação de ${formatarMoeda(valorACompensar)} em ${new Date(dataCompensacao + 'T00:00:00').toLocaleDateString('pt-BR')}]`;
          
          const { error: errorUpdate } = await supabase
            .from('lancamentos_loja')
            .update({
              valor: novoValor,
              observacoes: novasObservacoes.trim()
            })
            .eq('id', debitoId);
            
          if (errorUpdate) throw errorUpdate;
        }
      }
      
      // Processar créditos selecionados (despesas - loja deve)
      for (const creditoId of creditosSelecionados) {
        const credito = creditos.find(c => c.id === creditoId);
        if (!credito) continue;
        
        const valorCredito = parseFloat(credito.valor);
        const proporcao = valorCredito / totalCreditos;
        const valorACompensar = Math.min(valorCredito, valorCompensar * proporcao);
        
        if (valorACompensar >= valorCredito - 0.01) {
          // Quitar completamente o crédito
          const { error } = await supabase
            .from('lancamentos_loja')
            .update({
              status: 'pago',
              data_pagamento: dataCompensacao,
              tipo_pagamento: 'compensacao'
            })
            .eq('id', creditoId);
            
          if (error) throw error;
        } else {
          // Compensação parcial do crédito
          
          const { error: errorInsert } = await supabase
            .from('lancamentos_loja')
            .insert({
              tipo: 'despesa', // Crédito é sempre despesa
              categoria_id: credito.categoria_id,
              descricao: `💰 Compensação: ${credito.descricao}`,
              valor: valorACompensar,
              data_lancamento: dataCompensacao,
              data_vencimento: dataCompensacao,
              data_pagamento: dataCompensacao,
              tipo_pagamento: 'compensacao',
              status: 'pago',
              origem_tipo: credito.origem_tipo,
              origem_irmao_id: credito.origem_irmao_id,
              evento_comemorativo_id: credito.evento_comemorativo_id || null,
              eh_pagamento_parcial: true,
              lancamento_principal_id: creditoId
            });
            
          if (errorInsert) throw errorInsert;
          
          // ATUALIZAR o valor do lançamento original para refletir a compensação
          const novoValor = valorCredito - valorACompensar;
          
          // Preparar observações com valor original (se ainda não tiver)
          let novasObservacoes = credito.observacoes || '';
          if (!novasObservacoes.includes('Valor original:')) {
            // Primeira alteração - guardar valor original
            novasObservacoes = `[Valor original: R$ ${valorCredito.toFixed(2)}]\n${novasObservacoes}`.trim();
          }
          novasObservacoes += `\n[Compensação de ${formatarMoeda(valorACompensar)} em ${new Date(dataCompensacao + 'T00:00:00').toLocaleDateString('pt-BR')}]`;
          
          const { error: errorUpdate } = await supabase
            .from('lancamentos_loja')
            .update({
              valor: novoValor,
              observacoes: novasObservacoes.trim()
            })
            .eq('id', creditoId);
            
          if (errorUpdate) throw errorUpdate;
        }
      }
      
      showSuccess(`✅ Compensação realizada! Valor compensado: ${formatarMoeda(valorCompensar)}`);
      onClose();
      onSuccess();
      
    } catch (error) {
      console.error('Erro ao compensar:', error);
      showError('Erro ao realizar compensação: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto" style={{background:"rgba(0,0,0,0.7)"}}>
      <div className="rounded-lg max-w-4xl w-full my-8" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="px-6 py-4 rounded-t-lg" style={{background:"var(--color-surface-2)",borderBottom:"1px solid var(--color-border)"}}>
          <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>🔄 Compensação de Valores</h3>
          <p style={{fontSize:"0.875rem",color:"var(--color-text-muted)"}}>Irmão: {irmao?.nome}</p>
        </div>
        <form onSubmit={handleCompensar} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* DÉBITOS */}
            <div>
              <h4 style={{fontWeight:"700",marginBottom:"0.75rem",color:"var(--color-text)"}}>📤 Débitos (Ele deve)</h4>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {debitos.length > 0 ? debitos.map(d => (
                  <div key={d.id} onClick={() => toggleDebito(d.id)}
                    style={{
                      padding:"0.75rem",
                      borderRadius:"var(--radius-md)",
                      cursor:"pointer",
                      background: debitosSelecionados.includes(d.id) ? "rgba(239,68,68,0.1)" : "var(--color-surface-2)",
                      border: debitosSelecionados.includes(d.id) ? "1px solid rgba(239,68,68,0.5)" : "1px solid var(--color-border)",
                      transition:"all 0.15s",
                    }}>
                    <div className="flex justify-between">
                      <div><p style={{fontWeight:"500",fontSize:"0.875rem",color:"var(--color-text)"}}>{d.descricao}</p><p style={{fontSize:"0.75rem",color:"var(--color-text-muted)"}}>Venc: {formatarDataBR(d.data_vencimento)}</p></div>
                      <p style={{fontWeight:"700",color:"#ef4444"}}>{formatarMoeda(d.valor)}</p>
                    </div>
                  </div>
                )) : <p style={{textAlign:"center",padding:"1rem",color:"var(--color-text-muted)"}}>Sem débitos</p>}
              </div>
              <div className="mt-3 p-3 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}><p style={{fontSize:"0.875rem",color:"var(--color-text-muted)"}}>Total:</p><p style={{fontSize:"1.25rem",fontWeight:"800",color:"#ef4444"}}>{formatarMoeda(totalDebitos)}</p></div>
            </div>
            {/* CRÉDITOS */}
            <div>
              <h4 style={{fontWeight:"700",marginBottom:"0.75rem",color:"var(--color-text)"}}>📥 Créditos (Loja deve)</h4>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {creditos.length > 0 ? creditos.map(c => (
                  <div key={c.id} onClick={() => toggleCredito(c.id)}
                    style={{
                      padding:"0.75rem",
                      borderRadius:"var(--radius-md)",
                      cursor:"pointer",
                      background: creditosSelecionados.includes(c.id) ? "rgba(16,185,129,0.1)" : "var(--color-surface-2)",
                      border: creditosSelecionados.includes(c.id) ? "1px solid rgba(16,185,129,0.5)" : "1px solid var(--color-border)",
                      transition:"all 0.15s",
                    }}>
                    <div className="flex justify-between">
                      <div><p style={{fontWeight:"500",fontSize:"0.875rem",color:"var(--color-text)"}}>{c.descricao}</p><p style={{fontSize:"0.75rem",color:"var(--color-text-muted)"}}>Venc: {formatarDataBR(c.data_vencimento)}</p></div>
                      <p style={{fontWeight:"700",color:"#10b981"}}>{formatarMoeda(c.valor)}</p>
                    </div>
                  </div>
                )) : <p style={{textAlign:"center",padding:"1rem",color:"var(--color-text-muted)"}}>Sem créditos</p>}
              </div>
              <div className="mt-3 p-3 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}><p style={{fontSize:"0.875rem",color:"var(--color-text-muted)"}}>Total:</p><p style={{fontSize:"1.25rem",fontWeight:"800",color:"#10b981"}}>{formatarMoeda(totalCreditos)}</p></div>
            </div>
          </div>
          {/* RESUMO */}
          {(debitosSelecionados.length > 0 || creditosSelecionados.length > 0) && (
            <div className="rounded-lg p-4" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
              <h4 className="font-bold mb-3" style={{color:"var(--color-text)"}}>📊 Resumo</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p style={{fontSize:"0.875rem",color:"var(--color-text-muted)"}}>Compensar</p><p style={{fontSize:"1.5rem",fontWeight:"800",color:"#8b5cf6"}}>{formatarMoeda(valorCompensar)}</p></div>
                <div><p style={{fontSize:"0.875rem",color:"var(--color-text-muted)"}}>Saldo Final</p><p style={{fontSize:'1.5rem',fontWeight:'800',color:saldoFinal>0?'#ef4444':'#10b981'}}>{formatarMoeda(Math.abs(saldoFinal))}</p></div>
                <div><p style={{fontSize:"0.875rem",color:"var(--color-text-muted)"}}>Status</p><p style={{fontSize:"1.125rem",fontWeight:"700",color:"var(--color-text)"}}>{saldoFinal === 0 ? '✅ Quitado' : '⚖️ Compensado'}</p></div>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-4" style={{borderTop:"1px solid var(--color-border)"}}>
            <button type="submit" disabled={debitosSelecionados.length === 0 || creditosSelecionados.length === 0}
              style={{
                flex:1,padding:"0.75rem 1.5rem",borderRadius:"var(--radius-md)",fontWeight:"700",
                background: (debitosSelecionados.length === 0 || creditosSelecionados.length === 0) ? "var(--color-surface-2)" : "rgba(139,92,246,0.18)",
                border: (debitosSelecionados.length === 0 || creditosSelecionados.length === 0) ? "1px solid var(--color-border)" : "1px solid rgba(139,92,246,0.4)",
                color: (debitosSelecionados.length === 0 || creditosSelecionados.length === 0) ? "var(--color-text-muted)" : "#8b5cf6",
                cursor: (debitosSelecionados.length === 0 || creditosSelecionados.length === 0) ? "not-allowed" : "pointer",
                opacity: (debitosSelecionados.length === 0 || creditosSelecionados.length === 0) ? 0.5 : 1,
              }}>
              🔄 Compensar
            </button>
            <button type="button" onClick={onClose}
              style={{padding:"0.75rem 1.5rem",borderRadius:"var(--radius-md)",fontWeight:"500",background:"var(--color-surface-2)",border:"1px solid var(--color-border)",color:"var(--color-text-muted)",cursor:"pointer"}}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
