import { useState } from 'react';
import { supabase } from '../../supabaseClient';

export default function ModalPagamentoParcial({ lancamento, pagamentosExistentes, onClose, onSuccess, showSuccess, showError }) {
  const [valorPagar, setValorPagar] = useState('');
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);

  // LÓGICA CORRETA DE CÁLCULO
  // 1. Buscar o PRIMEIRO valor do lançamento (antes de qualquer alteração)
  // 2. Calcular quanto foi compensado
  // 3. Calcular quanto foi pago (pagamentos parciais reais)
  // 4. Valor Restante = Original - Compensado - Pago
  // 5. Valor no banco = Valor Restante (sempre atualizado)
  
  // Separar pagamentos reais e compensações
  const pagamentosReais = pagamentosExistentes.filter(pag => pag.tipo_pagamento !== 'compensacao');
  const compensacoes = pagamentosExistentes.filter(pag => pag.tipo_pagamento === 'compensacao');
  
  const totalPago = pagamentosReais.reduce((sum, pag) => sum + parseFloat(pag.valor), 0);
  const totalCompensado = compensacoes.reduce((sum, pag) => sum + parseFloat(pag.valor), 0);
  
  // VALOR ORIGINAL: Tentar pegar das observações primeiro, senão calcular
  let valorOriginal;
  
  // Tentar extrair das observações: "[Valor original: R$ 200.00 |" (formato com ponto decimal)
  const matchObservacoes = lancamento.observacoes?.match(/Valor original: R\$ ([\d.]+)/);
  if (matchObservacoes) {
    // Valor está salvo como "200.00" (formato padrão toFixed)
    valorOriginal = parseFloat(matchObservacoes[1]);
  } else if (totalCompensado > 0 || totalPago > 0) {
    // Se já tem compensação ou pagamento, calcular valor original
    valorOriginal = parseFloat(lancamento.valor) + totalPago + totalCompensado;
  } else {
    // Primeiro pagamento/compensação - valor do banco É o original
    valorOriginal = parseFloat(lancamento.valor);
  }
  
  // VALOR RESTANTE = simplesmente o valor no banco (já está correto)
  const valorRestante = parseFloat(lancamento.valor);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const valorAPagar = parseFloat(valorPagar);
      
      if (valorAPagar <= 0) {
        showError('Valor deve ser maior que zero');
        return;
      }

      if (valorAPagar > valorRestante) {
        showError(`Valor não pode ser maior que o restante (R$ ${valorRestante.toFixed(2)})`);
        return;
      }

      // Calcular novo valor restante
      const novoRestante = valorRestante - valorAPagar;
      const novoTotalPago = totalPago + valorAPagar;

      if (novoRestante <= 0.01) {  // <= 0.01 para evitar problemas de arredondamento
        // ÚLTIMO PAGAMENTO: Não criar registro separado, apenas atualizar o original
        const { error: errorUpdate } = await supabase
          .from('lancamentos_loja')
          .update({
            valor: valorAPagar, // Altera o valor para o restante
            status: 'pago',
            data_pagamento: dataPagamento,
            tipo_pagamento: lancamento.tipo_pagamento
          })
          .eq('id', lancamento.id);

        if (errorUpdate) throw errorUpdate;
        
        showSuccess('✅ Lançamento quitado completamente!');
      } else {
        // PAGAMENTO PARCIAL: Criar registro separado E atualizar valor original
        const novoPagamento = {
          tipo: lancamento.tipo,
          categoria_id: lancamento.categoria_id,
          descricao: `💰 Pagamento Parcial: ${lancamento.descricao}`,
          valor: valorAPagar,
          data_lancamento: dataPagamento,
          data_vencimento: dataPagamento,
          data_pagamento: dataPagamento,
          tipo_pagamento: lancamento.tipo_pagamento,
          status: 'pago',
          origem_tipo: lancamento.origem_tipo,
          origem_irmao_id: lancamento.origem_irmao_id,
          observacoes: `Pagamento parcial de R$ ${valorAPagar.toFixed(2)} do lançamento "${lancamento.descricao}" (Valor original: R$ ${valorOriginal.toFixed(2)})`,
          eh_pagamento_parcial: true,
          lancamento_principal_id: lancamento.id
        };

        const { error: errorInsert } = await supabase
          .from('lancamentos_loja')
          .insert(novoPagamento);

        if (errorInsert) throw errorInsert;

        // ATUALIZAR o valor do lançamento original para refletir apenas o saldo restante
        const { error: errorUpdate } = await supabase
          .from('lancamentos_loja')
          .update({
            valor: novoRestante,
            observacoes: `${lancamento.observacoes || ''}\n[Valor original: R$ ${valorOriginal.toFixed(2)} | Já pago: R$ ${novoTotalPago.toFixed(2)}]`.trim()
          })
          .eq('id', lancamento.id);

        if (errorUpdate) throw errorUpdate;

        showSuccess(`✅ Pagamento de R$ ${valorAPagar.toFixed(2)} registrado! Resta: R$ ${novoRestante.toFixed(2)}`);
      }
      
      onClose();
      onSuccess();
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao registrar pagamento: ' + error.message);
    }
  };

  const previewTotalPago = valorPagar ? (totalPago + parseFloat(valorPagar)).toFixed(2) : totalPago.toFixed(2);
  const previewRestante = valorPagar ? (valorRestante - parseFloat(valorPagar)).toFixed(2) : valorRestante.toFixed(2);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto" style={{background:"rgba(0,0,0,0.7)"}}>
      <div className="rounded-lg max-w-2xl w-full my-8" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="px-6 py-4 rounded-t-lg" style={{background:"var(--color-surface-2)",borderBottom:"1px solid var(--color-border)"}}>
          <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>💰 Pagamento Parcial</h3>
          <p style={{fontSize:"0.875rem",color:"var(--color-text-muted)"}}>Cada pagamento gera um registro que entra no balanço mensal</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Informações do Lançamento */}
          <div className="rounded-lg p-4 space-y-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="flex justify-between">
              <span className="font-medium">Descrição:</span>
              <span className="text-right">{lancamento.descricao}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">Valor Original:</span>
              <span className="font-bold text-lg">R$ {valorOriginal.toFixed(2)}</span>
            </div>
            {totalCompensado > 0 && (
              <div className="flex justify-between">
                <span style={{fontWeight:"600",color:"#8b5cf6"}}>🔄 Compensado:</span>
                <span style={{fontWeight:"700",color:"#8b5cf6"}}>R$ {totalCompensado.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span style={{fontWeight:"600",color:"#10b981"}}>✅ Pago:</span>
              <span style={{fontWeight:"700",color:"#10b981"}}>R$ {totalPago.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span style={{fontWeight:"600",color:"#ef4444",fontSize:"1.1rem"}}>Valor Restante:</span>
              <span style={{fontWeight:"700",color:"#ef4444",fontSize:"1.1rem"}}>R$ {valorRestante.toFixed(2)}</span>
            </div>
          </div>

          {/* Histórico de Compensações */}
          {compensacoes.length > 0 && (
            <div className="rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <h4 style={{fontWeight:"600",marginBottom:"0.5rem",color:"#8b5cf6"}}>🔄 Compensações Realizadas:</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {compensacoes.map((comp, idx) => (
                  <div key={comp.id} className="flex justify-between text-sm">
                    <span>#{idx + 1} - {new Date(comp.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    <span style={{fontWeight:"600",color:"#8b5cf6"}}>R$ {parseFloat(comp.valor).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Histórico de Pagamentos */}
          {pagamentosReais.length > 0 && (
            <div className="rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <h4 className="font-medium mb-2">📋 Pagamentos Anteriores:</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {pagamentosReais.map((pag, idx) => (
                  <div key={pag.id} className="flex justify-between text-sm">
                    <span>#{idx + 1} - {new Date(pag.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    <span className="font-medium">R$ {parseFloat(pag.valor).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulário de Novo Pagamento */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Valor a Pagar *</label>
              <input 
                type="number" 
                required 
                step="0.01" 
                min="0.01" 
                max={valorRestante}
                value={valorPagar}
                onChange={(e) => setValorPagar(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-lg font-bold" 
                style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                placeholder="0.00"
                autoFocus
              />
              <p className="text-xs mt-1">Máximo: R$ {valorRestante.toFixed(2)}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data do Pagamento *</label>
              <input 
                type="date" 
                required
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}} 
              />
              <p className="text-xs mt-1">Entra no balanço desta data</p>
            </div>
          </div>

          {/* Prévia */}
          {valorPagar && parseFloat(valorPagar) > 0 && (
            <div className="border rounded p-4 space-y-2" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
              <p style={{fontSize:"0.875rem",fontWeight:"600",color:"var(--color-text)"}}>📊 Após este pagamento:</p>
              <div className="flex justify-between text-sm">
                <span style={{color:"#10b981"}}>Total Pago:</span>
                <span style={{fontWeight:"700",color:"#10b981"}}>R$ {previewTotalPago}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{color:"#ef4444"}}>Restante:</span>
                <span style={{fontWeight:"700",color:"#ef4444"}}>R$ {previewRestante}</span>
              </div>
              {parseFloat(previewRestante) === 0 && (
                <div style={{marginTop:"0.5rem",padding:"0.5rem",borderRadius:"var(--radius-md)",color:"var(--color-text)",fontSize:"0.875rem",fontWeight:"600",textAlign:"center"}}>
                  ✅ Este pagamento quitará o lançamento completamente!
                </div>
              )}
              <div className="mt-2 p-2 rounded text-sm" style={{background:"var(--color-surface)",color:"var(--color-text-muted)"}}>
                💡 Será criado um novo registro que entra no balanço de <strong>{new Date(dataPagamento + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-4" style={{borderTop:"1px solid var(--color-border)"}}>
            <button type="submit" 
              className="flex-1 px-6 py-2 rounded-lg font-medium"
              style={{background:"rgba(201,168,76,0.18)",border:"1px solid rgba(201,168,76,0.4)",color:"#c9a84c"}}>
              💰 Registrar Pagamento
            </button>
            <button type="button" onClick={onClose}
              className="px-6 py-2 rounded-lg font-medium"
              style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",color:"var(--color-text-muted)"}}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
