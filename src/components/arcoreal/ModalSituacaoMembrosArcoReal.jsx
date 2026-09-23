import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const fmtR = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const sTh = { border: '1px solid var(--color-border)', padding: '0.6rem 0.75rem', fontWeight: '700', fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', background: 'var(--color-surface-2)', textAlign: 'right' };
const sTd = { border: '1px solid var(--color-border)', padding: '0.55rem 0.75rem', textAlign: 'right', fontSize: '0.85rem' };

export default function ModalSituacaoMembrosArcoReal({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [linhas, setLinhas] = useState([]);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState('nome'); // 'nome' | 'valor'

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data: membros } = await supabase.from('arco_real_membros').select('id, nome, situacao').order('nome');
      const { data: lancs } = await supabase
        .from('arco_real_lancamentos')
        .select('tipo, valor, status, origem_membro_id, tipo_pagamento')
        .not('origem_membro_id', 'is', null);

      const porMembro = {};
      (lancs || []).forEach(l => {
        if (l.tipo_pagamento === 'compensacao') return; // abatimento não conta na situação
        const id = l.origem_membro_id;
        if (!porMembro[id]) porMembro[id] = { despesasPagas: 0, despesasPendentes: 0, receitasPagas: 0, receitasPendentes: 0 };
        const valor = Number(l.valor || 0);
        if (l.tipo === 'despesa') {
          if (l.status === 'pago') porMembro[id].despesasPagas += valor;
          else porMembro[id].despesasPendentes += valor;
        } else {
          if (l.status === 'pago') porMembro[id].receitasPagas += valor;
          else porMembro[id].receitasPendentes += valor;
        }
      });

      const lista = (membros || []).map(m => {
        const t = porMembro[m.id] || { despesasPagas: 0, despesasPendentes: 0, receitasPagas: 0, receitasPendentes: 0 };
        return { membroId: m.id, nome: m.nome, situacao: m.situacao, ...t };
      });

      setLinhas(lista);
    } catch (e) {
      console.error('Erro ao carregar situação dos membros:', e);
    } finally {
      setLoading(false);
    }
  };

  const filtrados = linhas.filter(l => !busca || l.nome.toLowerCase().includes(busca.toLowerCase()));
  const sorted = [...filtrados].sort((a, b) =>
    ordem === 'valor' ? b.receitasPendentes - a.receitasPendentes : a.nome.localeCompare(b.nome)
  );

  const totDespPagas = filtrados.reduce((s, l) => s + l.despesasPagas, 0);
  const totArcoRealDeve = filtrados.reduce((s, l) => s + l.despesasPendentes, 0);
  const totRecPagas = filtrados.reduce((s, l) => s + l.receitasPagas, 0);
  const totValorDevido = filtrados.reduce((s, l) => s + l.receitasPendentes, 0);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000, padding:'1rem' }}>
      <div style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', maxWidth:'62rem', width:'100%', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'1rem 1.5rem', background:'linear-gradient(135deg,#1e3a5f,#2d6a9f)', borderTopLeftRadius:'var(--radius-xl)', borderTopRightRadius:'var(--radius-xl)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ fontSize:'1.1rem', fontWeight:800, color:'#fff', margin:0 }}>📊 Situação dos Membros — Arco Real</h3>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', borderRadius:'50%', width:'2rem', height:'2rem', cursor:'pointer', fontWeight:700, fontSize:'1.1rem' }}>×</button>
        </div>

        <div style={{ padding:'0.85rem 1.5rem', borderBottom:'1px solid var(--color-border)', display:'flex', gap:'0.75rem', alignItems:'center', flexWrap:'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Buscar membro..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ flex:1, minWidth:'180px', background:'var(--color-surface-2)', color:'var(--color-text)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', padding:'0.4rem 0.75rem', outline:'none', fontSize:'0.85rem' }}
          />
          <select value={ordem} onChange={e => setOrdem(e.target.value)}
            style={{ padding:'0.4rem 0.75rem', borderRadius:'var(--radius-md)', border:'1px solid var(--color-border)', background:'var(--color-surface-2)', color:'var(--color-text)', fontSize:'0.85rem', cursor:'pointer' }}>
            <option value="nome">Ordenar por nome</option>
            <option value="valor">Ordenar por valor devido</option>
          </select>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'1rem 1.5rem' }}>
          {loading ? (
            <p style={{ textAlign:'center', color:'var(--color-text-muted)', padding:'2rem' }}>Carregando...</p>
          ) : sorted.length === 0 ? (
            <p style={{ textAlign:'center', color:'var(--color-text-muted)', padding:'2rem' }}>Nenhum membro encontrado.</p>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'700px' }}>
                <thead>
                  <tr>
                    <th style={{ ...sTh, textAlign:'left' }}>Membro</th>
                    <th style={sTh}>Desp. Pagas<div style={{ fontSize:'0.6rem', fontWeight:400, marginTop:'0.1rem' }}>Arco Real → Membro (pago)</div></th>
                    <th style={{ ...sTh, color:'#7c3aed' }}>Arco Real Deve<div style={{ fontSize:'0.6rem', fontWeight:400, marginTop:'0.1rem', color:'var(--color-text-muted)' }}>Pendente</div></th>
                    <th style={{ ...sTh, color:'#16a34a' }}>Rec. Pagas<div style={{ fontSize:'0.6rem', fontWeight:400, marginTop:'0.1rem', color:'var(--color-text-muted)' }}>Membro → Arco Real (pago)</div></th>
                    <th style={{ ...sTh, color:'#ea580c' }}>Valor Devido<div style={{ fontSize:'0.6rem', fontWeight:400, marginTop:'0.1rem', color:'var(--color-text-muted)' }}>Pendente</div></th>
                    <th style={{ ...sTh, textAlign:'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((l, idx) => {
                    const devedor = l.receitasPendentes > 0;
                    return (
                      <tr key={l.membroId} style={{ background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                        <td style={{ ...sTd, textAlign:'left' }}>
                          <p style={{ margin:0, fontWeight:700, color:'var(--color-text)', fontSize:'0.875rem' }}>{l.nome}</p>
                          {l.situacao === 'licenciado' && <p style={{ margin:0, fontSize:'0.68rem', color:'#4ade80' }}>Licenciado</p>}
                        </td>
                        <td style={{ ...sTd, color:'#6b7280' }}>{fmtR(l.despesasPagas)}</td>
                        <td style={{ ...sTd, color: l.despesasPendentes > 0 ? '#7c3aed' : 'var(--color-text-muted)', fontWeight: l.despesasPendentes > 0 ? 700 : 400 }}>{fmtR(l.despesasPendentes)}</td>
                        <td style={{ ...sTd, color:'#16a34a', fontWeight:600 }}>{fmtR(l.receitasPagas)}</td>
                        <td style={{ ...sTd, color: devedor ? '#ea580c' : '#16a34a', fontWeight: devedor ? 800 : 600, fontSize: devedor ? '0.95rem' : '0.85rem' }}>{fmtR(l.receitasPendentes)}</td>
                        <td style={{ ...sTd, textAlign:'center' }}>
                          <span style={{ padding:'0.2rem 0.6rem', borderRadius:'999px', fontSize:'0.72rem', fontWeight:700, background: devedor ? 'rgba(234,88,12,0.12)' : 'rgba(22,163,74,0.12)', color: devedor ? '#ea580c' : '#16a34a', border:'1px solid ' + (devedor ? 'rgba(234,88,12,0.3)' : 'rgba(22,163,74,0.3)') }}>
                            {devedor ? 'Devedor' : 'Em Dia'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background:'var(--color-surface-2)', fontWeight:800 }}>
                    <td style={{ ...sTd, textAlign:'left', color:'var(--color-text)' }}>Total</td>
                    <td style={{ ...sTd, color:'#6b7280' }}>{fmtR(totDespPagas)}</td>
                    <td style={{ ...sTd, color:'#7c3aed' }}>{fmtR(totArcoRealDeve)}</td>
                    <td style={{ ...sTd, color:'#16a34a' }}>{fmtR(totRecPagas)}</td>
                    <td style={{ ...sTd, color:'#ea580c' }}>{fmtR(totValorDevido)}</td>
                    <td style={sTd}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div style={{ padding:'0.85rem 1.5rem', borderTop:'1px solid var(--color-border)', display:'flex', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'0.55rem 1.25rem', background:'var(--color-surface-2)', color:'var(--color-text)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-lg)', fontWeight:600, cursor:'pointer' }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
