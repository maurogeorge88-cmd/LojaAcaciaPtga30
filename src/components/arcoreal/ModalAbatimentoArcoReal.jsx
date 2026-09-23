import { useState } from 'react';
import { supabase } from '../../supabaseClient';

const fmtR = (v) => 'R$ ' + Math.abs(Number(v || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const fmtD = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

// Abatimento entre um membro do Arco Real e o Arco Real — quando o membro
// deve algo (receita pendente) e o Arco Real deve a ele (despesa pendente,
// ex.: reembolso de algo que ele pagou do bolso), cruza os dois. Marca
// tudo com tipo_pagamento='compensacao', que fica de fora dos totais do
// Arco Real e NUNCA é sincronizado com o Finanças da Loja (não é dinheiro
// real movimentando o banco).
export default function ModalAbatimentoArcoReal({ membro, debitos, creditos, onClose, onSuccess, showSuccess, showError }) {
  const [debitosSelecionados, setDebitosSelecionados] = useState([]);
  const [creditosSelecionados, setCreditosSelecionados] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const totalDebitos = debitosSelecionados.reduce((sum, id) => {
    const d = debitos.find(x => x.id === id);
    return sum + (d ? parseFloat(d.valor) : 0);
  }, 0);

  const totalCreditos = creditosSelecionados.reduce((sum, id) => {
    const c = creditos.find(x => x.id === id);
    return sum + (c ? parseFloat(c.valor) : 0);
  }, 0);

  const valorAbater = Math.min(totalDebitos, totalCreditos);
  const saldoFinal = totalDebitos - totalCreditos;

  const toggleDebito = (id) => {
    setDebitosSelecionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const toggleCredito = (id) => {
    setCreditosSelecionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleAbater = async (e) => {
    e.preventDefault();
    if (debitosSelecionados.length === 0 || creditosSelecionados.length === 0) {
      showError('Selecione pelo menos um débito e um crédito para abater');
      return;
    }
    if (valorAbater === 0) {
      showError('Não há valor a abater');
      return;
    }

    setSalvando(true);
    try {
      const dataAbatimento = new Date().toISOString().split('T')[0];

      const quitarLancamento = async (id) => {
        const { error } = await supabase
          .from('arco_real_lancamentos')
          .update({ status: 'pago', data_pagamento: dataAbatimento, tipo_pagamento: 'compensacao' })
          .eq('id', id);
        if (error) throw error;
      };

      // Abate parcialmente um lançamento: cria um registro do valor abatido
      // (já pago por compensação) e reduz o valor pendente do original.
      const abaterParcial = async (lancamento, valorParcial, tipoLanc) => {
        const { error: errIns } = await supabase
          .from('arco_real_lancamentos')
          .insert({
            tipo: tipoLanc,
            categoria_id: lancamento.categoria_id,
            descricao: `💰 Abatimento: ${lancamento.descricao}`,
            valor: valorParcial,
            data_vencimento: dataAbatimento,
            data_pagamento: dataAbatimento,
            tipo_pagamento: 'compensacao',
            status: 'pago',
            origem: 'manual',
            lancamento_loja_id: null,
            origem_membro_id: lancamento.origem_membro_id,
          });
        if (errIns) throw errIns;

        const valorRestante = parseFloat(lancamento.valor) - valorParcial;
        let obs = lancamento.observacoes || '';
        if (!obs.includes('Valor original:')) {
          obs = `[Valor original: R$ ${parseFloat(lancamento.valor).toFixed(2)}]\n${obs}`.trim();
        }
        obs += `\n[Abatimento de ${fmtR(valorParcial)} em ${new Date(dataAbatimento + 'T00:00:00').toLocaleDateString('pt-BR')}]`;

        let descricaoAtualizada = lancamento.descricao || '';
        if (!descricaoAtualizada.startsWith('🔸 Restante Abatimento:')) {
          descricaoAtualizada = `🔸 Restante Abatimento: ${descricaoAtualizada}`;
        }

        const { error: errUpd } = await supabase
          .from('arco_real_lancamentos')
          .update({ valor: valorRestante, observacoes: obs.trim(), descricao: descricaoAtualizada })
          .eq('id', lancamento.id);
        if (errUpd) throw errUpd;
      };

      // Processa débitos (receitas — membro deve) até esgotar o valor a abater.
      let saldoDebitos = valorAbater;
      for (const id of debitosSelecionados) {
        if (saldoDebitos <= 0) break;
        const d = debitos.find(x => x.id === id);
        if (!d) continue;
        const valorD = parseFloat(d.valor);
        if (saldoDebitos >= valorD - 0.001) {
          await quitarLancamento(id);
          saldoDebitos -= valorD;
        } else {
          await abaterParcial(d, saldoDebitos, 'receita');
          saldoDebitos = 0;
        }
      }

      // Processa créditos (despesas — Arco Real deve, ex. reembolsos) até esgotar.
      let saldoCreditos = valorAbater;
      for (const id of creditosSelecionados) {
        if (saldoCreditos <= 0) break;
        const c = creditos.find(x => x.id === id);
        if (!c) continue;
        const valorC = parseFloat(c.valor);
        if (saldoCreditos >= valorC - 0.001) {
          await quitarLancamento(id);
          saldoCreditos -= valorC;
        } else {
          await abaterParcial(c, saldoCreditos, 'despesa');
          saldoCreditos = 0;
        }
      }

      showSuccess(`✅ Abatimento realizado! Valor abatido: ${fmtR(valorAbater)}`);
      onClose();
      onSuccess();
    } catch (error) {
      console.error('Erro ao abater:', error);
      showError('Erro ao realizar abatimento: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000, padding:'1rem', overflowY:'auto' }}>
      <div style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', maxWidth:'56rem', width:'100%', margin:'2rem 0' }}>
        <div style={{ padding:'1rem 1.5rem', borderTopLeftRadius:'var(--radius-xl)', borderTopRightRadius:'var(--radius-xl)', background:'var(--color-surface-2)', borderBottom:'1px solid var(--color-border)' }}>
          <h3 style={{ fontSize:'1.15rem', fontWeight:'800', color:'var(--color-text)', margin:0 }}>⚖️ Abatimento — Irmão × Arco Real</h3>
          <p style={{ fontSize:'0.85rem', color:'var(--color-text-muted)', margin:'0.2rem 0 0' }}>Membro: {membro?.nome}</p>
        </div>

        <form onSubmit={handleAbater} style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
            {/* DÉBITOS — o que o irmão deve ao Arco Real */}
            <div>
              <h4 style={{ fontWeight:'700', marginBottom:'0.6rem', color:'var(--color-text)', fontSize:'0.9rem' }}>📤 Débitos (Ele deve)</h4>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', maxHeight:'20rem', overflowY:'auto' }}>
                {debitos.length > 0 ? debitos.map(d => (
                  <div key={d.id} onClick={() => toggleDebito(d.id)} style={{
                    padding:'0.65rem', borderRadius:'var(--radius-md)', cursor:'pointer', transition:'all 0.15s',
                    background: debitosSelecionados.includes(d.id) ? 'rgba(239,68,68,0.1)' : 'var(--color-surface-2)',
                    border: debitosSelecionados.includes(d.id) ? '1px solid rgba(239,68,68,0.5)' : '1px solid var(--color-border)',
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:'0.5rem' }}>
                      <div style={{ minWidth:0 }}>
                        <p style={{ fontWeight:'600', fontSize:'0.82rem', color:'var(--color-text)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.descricao}</p>
                        <p style={{ fontSize:'0.7rem', color:'var(--color-text-muted)', margin:0 }}>Venc: {fmtD(d.data_vencimento)}</p>
                      </div>
                      <p style={{ fontWeight:'700', color:'#ef4444', margin:0, flexShrink:0 }}>{fmtR(d.valor)}</p>
                    </div>
                  </div>
                )) : <p style={{ textAlign:'center', padding:'1rem', color:'var(--color-text-muted)', fontSize:'0.85rem' }}>Sem débitos pendentes</p>}
              </div>
              <div style={{ marginTop:'0.6rem', padding:'0.6rem', borderRadius:'var(--radius-lg)', background:'var(--color-surface-2)', border:'1px solid var(--color-border)' }}>
                <p style={{ fontSize:'0.78rem', color:'var(--color-text-muted)', margin:0 }}>Total:</p>
                <p style={{ fontSize:'1.15rem', fontWeight:'800', color:'#ef4444', margin:0 }}>{fmtR(totalDebitos)}</p>
              </div>
            </div>

            {/* CRÉDITOS — o que o Arco Real deve ao irmão (ex. reembolso) */}
            <div>
              <h4 style={{ fontWeight:'700', marginBottom:'0.6rem', color:'var(--color-text)', fontSize:'0.9rem' }}>📥 Créditos (Arco Real deve)</h4>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', maxHeight:'20rem', overflowY:'auto' }}>
                {creditos.length > 0 ? creditos.map(c => (
                  <div key={c.id} onClick={() => toggleCredito(c.id)} style={{
                    padding:'0.65rem', borderRadius:'var(--radius-md)', cursor:'pointer', transition:'all 0.15s',
                    background: creditosSelecionados.includes(c.id) ? 'rgba(16,185,129,0.1)' : 'var(--color-surface-2)',
                    border: creditosSelecionados.includes(c.id) ? '1px solid rgba(16,185,129,0.5)' : '1px solid var(--color-border)',
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:'0.5rem' }}>
                      <div style={{ minWidth:0 }}>
                        <p style={{ fontWeight:'600', fontSize:'0.82rem', color:'var(--color-text)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.descricao}</p>
                        <p style={{ fontSize:'0.7rem', color:'var(--color-text-muted)', margin:0 }}>Venc: {fmtD(c.data_vencimento)}</p>
                      </div>
                      <p style={{ fontWeight:'700', color:'#10b981', margin:0, flexShrink:0 }}>{fmtR(c.valor)}</p>
                    </div>
                  </div>
                )) : <p style={{ textAlign:'center', padding:'1rem', color:'var(--color-text-muted)', fontSize:'0.85rem' }}>Sem créditos pendentes</p>}
              </div>
              <div style={{ marginTop:'0.6rem', padding:'0.6rem', borderRadius:'var(--radius-lg)', background:'var(--color-surface-2)', border:'1px solid var(--color-border)' }}>
                <p style={{ fontSize:'0.78rem', color:'var(--color-text-muted)', margin:0 }}>Total:</p>
                <p style={{ fontSize:'1.15rem', fontWeight:'800', color:'#10b981', margin:0 }}>{fmtR(totalCreditos)}</p>
              </div>
            </div>
          </div>

          {(debitosSelecionados.length > 0 || creditosSelecionados.length > 0) && (
            <div style={{ borderRadius:'var(--radius-lg)', padding:'0.9rem', background:'var(--color-surface-2)', border:'1px solid var(--color-border)' }}>
              <h4 style={{ fontWeight:'700', marginBottom:'0.6rem', color:'var(--color-text)', fontSize:'0.88rem' }}>📊 Resumo</h4>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.75rem', textAlign:'center' }}>
                <div>
                  <p style={{ fontSize:'0.78rem', color:'var(--color-text-muted)', margin:0 }}>Abater</p>
                  <p style={{ fontSize:'1.3rem', fontWeight:'800', color:'#8b5cf6', margin:0 }}>{fmtR(valorAbater)}</p>
                </div>
                <div>
                  <p style={{ fontSize:'0.78rem', color:'var(--color-text-muted)', margin:0 }}>Saldo Final</p>
                  <p style={{ fontSize:'1.3rem', fontWeight:'800', color:saldoFinal>0?'#ef4444':'#10b981', margin:0 }}>{fmtR(Math.abs(saldoFinal))}</p>
                </div>
                <div>
                  <p style={{ fontSize:'0.78rem', color:'var(--color-text-muted)', margin:0 }}>Status</p>
                  <p style={{ fontSize:'1rem', fontWeight:'700', color:'var(--color-text)', margin:0 }}>{saldoFinal === 0 ? '✅ Quitado' : '⚖️ Abatido'}</p>
                </div>
              </div>
            </div>
          )}

          <p style={{ fontSize:'0.75rem', color:'var(--color-text-muted)', margin:0, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.25)', borderRadius:'var(--radius-md)', padding:'0.6rem 0.75rem' }}>
            🔒 Abatimento não conta nos totais do Arco Real e nunca é enviado ao Finanças da Loja — é só um acerto de contas interno.
          </p>

          <div style={{ display:'flex', gap:'0.75rem', paddingTop:'0.75rem', borderTop:'1px solid var(--color-border)' }}>
            <button type="submit" disabled={debitosSelecionados.length === 0 || creditosSelecionados.length === 0 || salvando}
              style={{
                flex:1, padding:'0.7rem 1.5rem', borderRadius:'var(--radius-md)', fontWeight:'700',
                background: (debitosSelecionados.length === 0 || creditosSelecionados.length === 0) ? 'var(--color-surface-2)' : 'rgba(139,92,246,0.18)',
                border: (debitosSelecionados.length === 0 || creditosSelecionados.length === 0) ? '1px solid var(--color-border)' : '1px solid rgba(139,92,246,0.4)',
                color: (debitosSelecionados.length === 0 || creditosSelecionados.length === 0) ? 'var(--color-text-muted)' : '#8b5cf6',
                cursor: (debitosSelecionados.length === 0 || creditosSelecionados.length === 0 || salvando) ? 'not-allowed' : 'pointer',
                opacity: (debitosSelecionados.length === 0 || creditosSelecionados.length === 0) ? 0.5 : 1,
              }}>
              {salvando ? '⏳ Abatendo...' : '⚖️ Abater'}
            </button>
            <button type="button" onClick={onClose}
              style={{ padding:'0.7rem 1.5rem', borderRadius:'var(--radius-md)', fontWeight:'600', background:'var(--color-surface-2)', border:'1px solid var(--color-border)', color:'var(--color-text-muted)', cursor:'pointer' }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
