import { useState } from 'react';
import { supabase } from '../../supabaseClient';

const tiposPagamento = [
  { value: 'dinheiro', label: '💵 Dinheiro' },
  { value: 'pix', label: '📱 PIX' },
  { value: 'transferencia', label: '🏦 Transferência' },
  { value: 'deposito', label: '🏧 Depósito' },
  { value: 'debito', label: '💳 Débito' },
  { value: 'credito', label: '💳 Crédito' },
  { value: 'cheque', label: '📝 Cheque' },
];

export default function ModalQuitacao({ isOpen, quitacaoForm, setQuitacaoForm, onClose, onSuccess, showSuccess, showError }) {
  const handleQuitacao = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('lancamentos_loja')
        .update({
          status: 'pago',
          data_pagamento: quitacaoForm.data_pagamento,
          tipo_pagamento: quitacaoForm.tipo_pagamento,
          observacoes: quitacaoForm.observacoes
        })
        .eq('id', quitacaoForm.lancamento_id);

      if (error) throw error;

      showSuccess('Lançamento quitado com sucesso!');
      onClose();
      await onSuccess();
    } catch (error) {
      console.error('Erro ao quitar lançamento:', error);
      showError('Erro ao quitar lançamento: ' + error.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:'1rem'}}>
      <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',width:'100%',maxWidth:'440px',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,0.4)'}}>
        <div style={{background:'var(--color-accent)',padding:'1rem 1.5rem'}}>
          <h3 style={{color:'#fff',fontWeight:'800',fontSize:'1.1rem',margin:0}}>💰 Quitar Lançamento</h3>
        </div>

        <form onSubmit={handleQuitacao} style={{padding:'1.25rem',display:'flex',flexDirection:'column',gap:'0.75rem'}}>
          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
              Data de Pagamento *
            </label>
            <input
              type="date"
              value={quitacaoForm.data_pagamento}
              onChange={(e) => setQuitacaoForm({ ...quitacaoForm, data_pagamento: e.target.value })}
              style={{width:'100%',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem'}}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
              Tipo de Pagamento *
            </label>
            <select
              value={quitacaoForm.tipo_pagamento}
              onChange={(e) => setQuitacaoForm({ ...quitacaoForm, tipo_pagamento: e.target.value })}
              style={{width:'100%',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem'}}
            >
              {tiposPagamento.map(tipo => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
              Observações
            </label>
            <textarea
              value={quitacaoForm.observacoes}
              onChange={(e) => setQuitacaoForm({ ...quitacaoForm, observacoes: e.target.value })}
              style={{width:'100%',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem'}}
              rows="3"
              placeholder="Observações sobre o pagamento (opcional)"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 px-6 py-2 text-white rounded-lg font-medium"
              style={{background:'var(--color-accent)',border:'none',cursor:'pointer'}}
            >
              ✅ Confirmar Quitação
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
