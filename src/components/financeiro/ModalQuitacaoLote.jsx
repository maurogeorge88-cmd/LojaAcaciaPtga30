import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarDataBR, formatarMoeda } from './utils/formatadores';

const tiposPagamento = [
  { value: 'dinheiro', label: '💵 Dinheiro' },
  { value: 'pix', label: '📱 PIX' },
  { value: 'transferencia', label: '🏦 Transferência' },
  { value: 'deposito', label: '🏧 Depósito' },
  { value: 'debito', label: '💳 Débito' },
  { value: 'credito', label: '💳 Crédito' },
  { value: 'cheque', label: '📝 Cheque' },
];

export default function ModalQuitacaoLote({ isOpen, onClose, lancamentos, onSuccess, showSuccess, showError }) {
  const [quitacaoLote, setQuitacaoLote] = useState({
    lancamentos_selecionados: [],
    data_pagamento: new Date().toISOString().split('T')[0],
    tipo_pagamento: 'dinheiro'
  });

  const toggleLancamentoParaQuitacao = (lancamentoId) => {
    setQuitacaoLote(prev => ({
      ...prev,
      lancamentos_selecionados: prev.lancamentos_selecionados.includes(lancamentoId)
        ? prev.lancamentos_selecionados.filter(id => id !== lancamentoId)
        : [...prev.lancamentos_selecionados, lancamentoId]
    }));
  };

  const selecionarTodosParaQuitacao = () => {
    const lancamentosPendentes = lancamentos
      .filter(l => l.status === 'pendente')
      .map(l => l.id);
    setQuitacaoLote(prev => ({
      ...prev,
      lancamentos_selecionados: lancamentosPendentes
    }));
  };

  const limparSelecaoQuitacao = () => {
    setQuitacaoLote(prev => ({
      ...prev,
      lancamentos_selecionados: []
    }));
  };

  const handleQuitacaoLote = async (e) => {
    e.preventDefault();

    if (quitacaoLote.lancamentos_selecionados.length === 0) {
      showError('Selecione pelo menos um lançamento!');
      return;
    }

    try {
      const { error } = await supabase
        .from('lancamentos_loja')
        .update({
          status: 'pago',
          data_pagamento: quitacaoLote.data_pagamento,
          tipo_pagamento: quitacaoLote.tipo_pagamento
        })
        .in('id', quitacaoLote.lancamentos_selecionados);

      if (error) throw error;

      showSuccess(`${quitacaoLote.lancamentos_selecionados.length} lançamentos quitados com sucesso!`);
      onClose();
      setQuitacaoLote({
        lancamentos_selecionados: [],
        data_pagamento: new Date().toISOString().split('T')[0],
        tipo_pagamento: 'dinheiro'
      });
      await onSuccess();
    } catch (error) {
      console.error('Erro ao quitar lançamentos:', error);
      showError('Erro ao quitar lançamentos: ' + error.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div style={{background:'var(--color-accent)',padding:'1rem 1.5rem',borderRadius:'var(--radius-xl) var(--radius-xl) 0 0'}}>
          <h3 style={{color:'#fff',fontWeight:'800',fontSize:'1.1rem',margin:0}}>💰 Quitação em Lote</h3>
          <p style={{fontSize:'0.82rem',color:'rgba(255,255,255,0.8)',marginTop:'0.2rem',marginBottom:0}}>
            {quitacaoLote.lancamentos_selecionados.length} lançamentos selecionados
          </p>
        </div>

        <form onSubmit={handleQuitacaoLote} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                Data de Pagamento *
              </label>
              <input
                type="date"
                value={quitacaoLote.data_pagamento}
                onChange={(e) => setQuitacaoLote({ ...quitacaoLote, data_pagamento: e.target.value })}
                style={{width:'100%',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem'}}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                Tipo de Pagamento *
              </label>
              <select
                value={quitacaoLote.tipo_pagamento}
                onChange={(e) => setQuitacaoLote({ ...quitacaoLote, tipo_pagamento: e.target.value })}
                style={{width:'100%',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem'}}
              >
                {tiposPagamento.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium" style={{color:"var(--color-text-muted)"}}>
                Lançamentos Pendentes
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selecionarTodosParaQuitacao}
                  style={{fontSize:"0.875rem",color:"#10b981",background:"none",border:"none",cursor:"pointer"}}
                >
                  ✅ Selecionar Todos
                </button>
                <button
                  type="button"
                  onClick={limparSelecaoQuitacao}
                  style={{fontSize:"0.875rem",color:"#ef4444",background:"none",border:"none",cursor:"pointer",fontWeight:"600"}}
                >
                  ❌ Limpar Seleção
                </button>
              </div>
            </div>
            <div className="border rounded-lg p-4 max-h-96 overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <div className="space-y-2">
                {lancamentos
                  .filter(l => l.status === 'pendente')
                  .map(lanc => (
                    <label
                      key={lanc.id}
                      style={{display:'flex',alignItems:'flex-start',cursor:'pointer',padding:'0.6rem',borderRadius:'var(--radius-md)',border:'1px solid var(--color-border)',background:'var(--color-surface-2)'}}
                    >
                      <input
                        type="checkbox"
                        checked={quitacaoLote.lancamentos_selecionados.includes(lanc.id)}
                        onChange={() => toggleLancamentoParaQuitacao(lanc.id)}
                        style={{marginTop:"0.25rem",width:"1rem",height:"1rem",accentColor:"#10b981"}}
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{lanc.descricao}</p>
                            <p style={{fontSize:"0.875rem",color:"var(--color-text-muted)"}}>
                              {lanc.categorias_financeiras?.nome} •
                              Venc: {formatarDataBR(lanc.data_vencimento)}
                            </p>
                          </div>
                          <p style={{fontSize:"1.1rem",fontWeight:"800",color:"#10b981"}}>
                            {formatarMoeda(parseFloat(lanc.valor))}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))}
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <p style={{fontSize:"0.875rem",color:"var(--color-text)"}}>
              <strong>Total a quitar:</strong> {formatarMoeda(
                lancamentos
                  .filter(l => quitacaoLote.lancamentos_selecionados.includes(l.id))
                  .reduce((sum, l) => sum + parseFloat(l.valor), 0)
              )}
              {' '}({quitacaoLote.lancamentos_selecionados.length} lançamentos)
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 px-6 py-2 text-white rounded-lg font-medium"
              style={{background:'var(--color-accent)',border:'none',cursor:'pointer',opacity:quitacaoLote.lancamentos_selecionados.length===0?0.5:1}}
              disabled={quitacaoLote.lancamentos_selecionados.length === 0}
            >
              ✅ Quitar Selecionados
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{padding:"0.5rem 1.5rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
