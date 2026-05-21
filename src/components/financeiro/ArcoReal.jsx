import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const fmtR = (v) => 'R$ ' + Math.abs(Number(v || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const fmtData = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const hoje = new Date();
const mesAtual = hoje.getMonth() + 1;
const anoAtual = hoje.getFullYear();

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function ArcoReal({ isOpen, onClose, showSuccess, showError }) {
  const [filtro, setFiltro]         = useState('mes'); // mes | ano | geral
  const [mes, setMes]               = useState(mesAtual);
  const [ano, setAno]               = useState(anoAtual);
  const [receitas, setReceitas]     = useState([]);
  const [despesas, setDespesas]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [verLancs, setVerLancs]     = useState(false); // expandir lista

  useEffect(() => { if (isOpen) carregar(); }, [isOpen, filtro, mes, ano]);

  const carregar = async () => {
    setLoading(true);
    try {
      // Buscar IDs das categorias Arco Real
      const { data: cats } = await supabase
        .from('categorias_financeiras')
        .select('id, nome, tipo')
        .ilike('nome', '%arco real%');

      const idsRec  = (cats || []).filter(c => c.tipo === 'receita').map(c => c.id);
      const idsDesp = (cats || []).filter(c => c.tipo === 'despesa').map(c => c.id);

      const buildFiltroData = (campo) => {
        if (filtro === 'mes') {
          const ini = `${ano}-${String(mes).padStart(2,'0')}-01`;
          const fim = `${ano}-${String(mes).padStart(2,'0')}-${new Date(ano, mes, 0).getDate()}`;
          return { gte: ini, lte: fim, campo };
        } else if (filtro === 'ano') {
          return { gte: `${ano}-01-01`, lte: `${ano}-12-31`, campo };
        }
        return null;
      };

      const buscar = async (ids, tipo) => {
        if (!ids.length) return [];
        let q = supabase
          .from('lancamentos_loja')
          .select('*, categorias_financeiras(nome, tipo), irmaos(nome)')
          .in('categoria_id', ids)
          .order('data_vencimento');

        if (filtro !== 'geral') {
          const campoData = tipo === 'receita' ? 'data_pagamento' : 'data_vencimento';
          const fd = buildFiltroData(campoData);
          q = q.gte('data_vencimento', fd.gte).lte('data_vencimento', fd.lte);
        }
        const { data } = await q;
        return data || [];
      };

      const [r, d] = await Promise.all([buscar(idsRec, 'receita'), buscar(idsDesp, 'despesa')]);
      setReceitas(r);
      setDespesas(d);
    } catch (e) {
      showError('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const recPagas  = receitas.filter(l => l.status === 'pago');
  const recPend   = receitas.filter(l => l.status === 'pendente');
  const totRec    = recPagas.reduce((s, l) => s + Number(l.valor || 0), 0);   // só pagos
  const totPend   = recPend.reduce((s, l) => s + Number(l.valor || 0), 0);    // pendentes
  const totDesp   = despesas.reduce((s, l) => s + Number(l.valor || 0), 0);   // repasses
  const saldo     = totRec - totDesp;  // recebido pago - repassado

  const gerarPDF = async () => {
    try {
      showSuccess('Gerando PDF...');
      const { data: dadosLoja } = await supabase.from('dados_loja').select('*').single();

      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default;
      const doc = new jsPDF();
      let y = 10;

      const rodape = () => {
        const tot = doc.getNumberOfPages();
        for (let p = 1; p <= tot; p++) {
          doc.setPage(p);
          doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(150);
          doc.text('SysMaçom-MG - Desenvolvedor: Mauro George', 15, 290);
          doc.text('Página ' + p + ' de ' + tot, 105, 290, { align: 'center' });
          doc.text('Emitido em ' + new Date().toLocaleDateString('pt-BR'), 195, 290, { align: 'right' });
          doc.setTextColor(0);
        }
      };

      // Logo
      if (dadosLoja?.logo_url) {
        try { doc.addImage(dadosLoja.logo_url, 'PNG', 88, y, 28, 28); y += 33; } catch {}
      }

      // Cabeçalho
      const nomeLoja = (dadosLoja?.nome_loja || 'ARLS Acácia de Paranatinga') + ' Nº ' + (dadosLoja?.numero_loja || '30');
      doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(0);
      doc.text(nomeLoja, 105, y, { align: 'center' }); y += 6;
      doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(80);
      doc.text('Arco Real - Controle Financeiro', 105, y, { align: 'center' }); y += 5;
      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(0);

      const labelFiltro = filtro === 'mes' ? MESES[mes-1] + '/' + ano
        : filtro === 'ano' ? 'Ano ' + ano : 'Todos os Períodos';
      doc.text('Extrato de Movimentação — ' + labelFiltro, 105, y, { align: 'center' }); y += 10;

      // Tabela de resumo
      doc.setFontSize(9); doc.setFont('helvetica','normal');
      const linhasResumo = [
        { label: 'Recebido (Pago)', val: fmtR(totRec), cor: [16,120,60] },
        { label: 'Pendente (não recebido)', val: fmtR(totPend), cor: [200,130,0] },
        { label: 'Repassado ao Arco Real', val: fmtR(totDesp), cor: [200,0,0] },
        { label: saldo >= 0 ? 'Saldo a Repassar' : 'Saldo a Receber', val: fmtR(saldo), cor: saldo >= 0 ? [37,99,235] : [16,120,60] },
      ];
      linhasResumo.forEach((lr, i) => {
        const bg = i % 2 === 0 ? [245,245,245] : [255,255,255];
        doc.setFillColor(...bg); doc.rect(15, y, 180, 7, 'F');
        doc.setDrawColor(200); doc.setLineWidth(0.2);
        doc.rect(15, y, 180, 7, 'S');
        doc.setFont('helvetica','bold'); doc.setTextColor(60);
        doc.text(lr.label, 20, y + 4.5);
        doc.setTextColor(...lr.cor);
        doc.text(lr.val, 192, y + 4.5, { align: 'right' });
        y += 7;
      });
      y += 8;

      // Função bloco
      const renderBloco = (titulo, lancs, corTit, corVal) => {
        if (!lancs.length) return 0;
        if (y > 240) { doc.addPage(); y = 15; }

        doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...corTit);
        doc.text(titulo, 15, y); y += 3;
        doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, y, 195, y); y += 4;

        doc.setFillColor(230,230,230); doc.rect(15, y, 180, 6, 'F');
        doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(0);
        doc.text('Data', 17, y+4); doc.text('Vencimento', 43, y+4); doc.text('Descrição', 75, y+4);
        doc.text('Irmão', 140, y+4); doc.text('Valor', 192, y+4, { align: 'right' });
        y += 11;

        let sub = 0;
        doc.setFontSize(8); doc.setFont('helvetica','normal');
        lancs.forEach(l => {
          if (y > 275) { doc.addPage(); y = 15; }
          const dataL = fmtData(l.data_pagamento || l.data_lancamento || l.data_vencimento);
          const dataV = fmtData(l.data_vencimento);
          const desc  = (l.descricao || '').substring(0, 35);
          const irmao = (l.irmaos?.nome || 'Loja').split(' ').slice(0,2).join(' ');
          const val   = Number(l.valor || 0);
          sub += val;

          doc.setTextColor(0);
          doc.text(dataL, 17, y); doc.text(dataV, 43, y); doc.text(desc, 75, y);
          doc.text(irmao, 140, y);
          doc.setTextColor(...corVal);
          doc.text(fmtR(val), 192, y, { align: 'right' });
          doc.setTextColor(0);
          y += 5;
        });

        y += 1;
        doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(15, y, 195, y); y += 5;
        doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(0);
        doc.text('Sub Total:', 140, y, { align: 'right' });
        doc.setTextColor(...corVal); doc.text(fmtR(sub), 192, y, { align: 'right' });
        y += 2;
        doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, y, 195, y);
        y += 12; doc.setTextColor(0);
        return sub;
      };

      // Separar por status para o PDF
      const recPagasPDF  = receitas.filter(l => l.status === 'pago');
      const recPendPDF   = receitas.filter(l => l.status === 'pendente');
      const despPagasPDF = despesas.filter(l => l.status === 'pago');
      const despPendPDF  = despesas.filter(l => l.status === 'pendente');

      renderBloco('Recebido (Pago) — Arco Real', recPagasPDF, [16,120,60], [16,120,60]);
      renderBloco('Pendente (Nao Recebido) — Arco Real', recPendPDF, [200,130,0], [200,130,0]);
      renderBloco('Repassado ao Arco Real', despPagasPDF, [200,0,0], [200,0,0]);
      renderBloco('Repasse Pendente', despPendPDF, [150,50,0], [150,50,0]);

      // Resumo final
      if (y > 240) { doc.addPage(); y = 15; }
      y += 5;
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(0);
      doc.text('Resumo Geral:', 192, y, { align: 'right' }); y += 7;
      doc.setFontSize(10);
      doc.setTextColor(16,120,60);
      doc.text('Recebido (Pago):', 155, y, { align: 'right' }); doc.text(fmtR(totRec), 192, y, { align: 'right' }); y += 5;
      doc.setTextColor(200,130,0);
      doc.text('Pendente (nao recebido):', 155, y, { align: 'right' }); doc.text(fmtR(totPend), 192, y, { align: 'right' }); y += 5;
      doc.setTextColor(200,0,0);
      doc.text('Repassado:', 155, y, { align: 'right' }); doc.text(fmtR(totDesp), 192, y, { align: 'right' }); y += 3;
      doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(115, y, 195, y); y += 5;
      doc.setFontSize(11); doc.setFont('helvetica','bold');
      if (saldo > 0) {
        doc.setTextColor(37,99,235);
        doc.text('Saldo a Repassar:', 155, y, { align: 'right' });
        doc.text(fmtR(saldo), 192, y, { align: 'right' });
      } else if (saldo < 0) {
        doc.setTextColor(16,120,60);
        doc.text('Saldo a Receber:', 155, y, { align: 'right' });
        doc.text(fmtR(Math.abs(saldo)), 192, y, { align: 'right' });
      } else {
        doc.setTextColor(0,150,80);
        doc.text('Zerado', 155, y, { align: 'right' });
      }

      rodape();
      doc.save('ArcoReal_' + labelFiltro.replace(/\//g,'_').replace(/ /g,'_') + '.pdf');
      showSuccess('PDF gerado!');
    } catch (e) {
      showError('Erro ao gerar PDF: ' + e.message);
    }
  };

  if (!isOpen) return null;

  const sInp = { background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.6rem', fontSize: '0.85rem' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '860px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d6a9f)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ color: '#fff', fontWeight: '800', fontSize: '1.2rem', margin: 0 }}>🔺 Arco Real — Controle Financeiro</h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', margin: '0.2rem 0 0', fontSize: '0.82rem' }}>Movimentação de receitas e repasses</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: '2.25rem', height: '2.25rem', fontSize: '1.3rem', fontWeight: '700', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', background: 'var(--color-surface-2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
            {[['mes','Mês'],['ano','Ano'],['geral','Geral']].map(([v,l]) => (
              <button key={v} onClick={() => setFiltro(v)}
                style={{ padding: '0.35rem 0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer', background: filtro === v ? '#2d6a9f' : 'var(--color-surface)', color: filtro === v ? '#fff' : 'var(--color-text)', borderColor: filtro === v ? '#2d6a9f' : 'var(--color-border)' }}>
                {l}
              </button>
            ))}
            {filtro !== 'geral' && (
              <>
                {filtro === 'mes' && (
                  <select value={mes} onChange={e => setMes(parseInt(e.target.value))} style={sInp}>
                    {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                  </select>
                )}
                <select value={ano} onChange={e => setAno(parseInt(e.target.value))} style={sInp}>
                  {[2024,2025,2026,2027].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setVerLancs(v => !v)}
                style={{ padding: '0.35rem 0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer', background: verLancs ? 'var(--color-accent-bg)' : 'var(--color-surface-2)', color: verLancs ? 'var(--color-accent)' : 'var(--color-text)' }}>
                {verLancs ? '📋 Ocultar lançamentos' : '📋 Ver lançamentos'}
              </button>
              <button onClick={gerarPDF}
                style={{ padding: '0.35rem 0.9rem', borderRadius: 'var(--radius-md)', border: 'none', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', background: '#1e3a5f', color: '#fff' }}>
                📄 Gerar PDF
              </button>
            </div>
          </div>

          {/* Cards resumo */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Carregando...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                {[
                  { label: 'Recebido (Pago)', val: totRec, sub: recPagas.length + ' lançamento(s)', cor: '#16a34a', bg: 'rgba(22,163,74,0.08)', brd: 'rgba(22,163,74,0.3)' },
                  { label: 'Pendente', val: totPend, sub: recPend.length + ' lançamento(s)', cor: '#d97706', bg: 'rgba(217,119,6,0.08)', brd: 'rgba(217,119,6,0.3)' },
                  { label: 'Repassado', val: totDesp, sub: despesas.length + ' lançamento(s)', cor: '#dc2626', bg: 'rgba(220,38,38,0.08)', brd: 'rgba(220,38,38,0.3)' },
                  { label: 'Saldo a Repassar', val: saldo, sub: 'Recebido - Repassado', cor: saldo >= 0 ? '#2563eb' : '#16a34a', bg: saldo >= 0 ? 'rgba(37,99,235,0.08)' : 'rgba(22,163,74,0.08)', brd: saldo >= 0 ? 'rgba(37,99,235,0.3)' : 'rgba(22,163,74,0.3)' },
                ].map((c, i) => (
                  <div key={i} style={{ background: c.bg, border: '1px solid ' + c.brd, borderLeft: '4px solid ' + c.cor, borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
                    <p style={{ margin: '0 0 0.25rem', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{c.label}</p>
                    <p style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: '800', color: c.cor }}>{fmtR(c.val)}</p>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{c.sub}</p>
                  </div>
                ))}
              </div>

              {/* Lançamentos expandidos */}
              {verLancs && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                  {/* Receitas */}
                  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
                    <div style={{ background: 'rgba(22,163,74,0.1)', padding: '0.6rem 1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', color: '#16a34a', fontSize: '0.9rem' }}>✅ Receitas — Recebido para o Arco Real</span>
                      <span style={{ fontWeight: '800', color: '#16a34a' }}>{fmtR(totRec)}</span>
                    </div>
                    {receitas.length === 0 ? (
                      <p style={{ padding: '1rem', color: 'var(--color-text-muted)', textAlign: 'center', margin: 0 }}>Nenhuma receita no período</p>
                    ) : receitas.map((l, i) => (
                      <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '90px 90px 1fr 120px 90px 70px', gap: '0.5rem', padding: '0.5rem 1rem', borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', fontSize: '0.8rem', alignItems: 'center' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>{fmtData(l.data_pagamento || l.data_vencimento)}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>{fmtData(l.data_vencimento)}</span>
                        <span style={{ color: 'var(--color-text)', fontWeight: '600' }}>{l.descricao}</span>
                        <span style={{ color: '#8b5cf6' }}>👤 {(l.irmaos?.nome || 'Loja').split(' ').slice(0,2).join(' ')}</span>
                        <span style={{ fontWeight: '700', color: '#16a34a', textAlign: 'right' }}>{fmtR(l.valor)}</span>
                        <span style={{ fontSize: '0.68rem', color: l.status === 'pago' ? '#16a34a' : '#d97706', textAlign: 'center', fontWeight: '600' }}>{l.status === 'pago' ? '✓ Pago' : '⏳ Pend.'}</span>
                      </div>
                    ))}
                  </div>

                  {/* Despesas / Repasses */}
                  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
                    <div style={{ background: 'rgba(220,38,38,0.1)', padding: '0.6rem 1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', color: '#dc2626', fontSize: '0.9rem' }}>🔺 Repasses — Enviado ao Arco Real</span>
                      <span style={{ fontWeight: '800', color: '#dc2626' }}>{fmtR(totDesp)}</span>
                    </div>
                    {despesas.length === 0 ? (
                      <p style={{ padding: '1rem', color: 'var(--color-text-muted)', textAlign: 'center', margin: 0 }}>Nenhum repasse no período</p>
                    ) : despesas.map((l, i) => (
                      <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '90px 90px 1fr 120px 90px 70px', gap: '0.5rem', padding: '0.5rem 1rem', borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', fontSize: '0.8rem', alignItems: 'center' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>{fmtData(l.data_pagamento || l.data_vencimento)}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>{fmtData(l.data_vencimento)}</span>
                        <span style={{ color: 'var(--color-text)', fontWeight: '600' }}>{l.descricao}</span>
                        <span style={{ color: '#8b5cf6' }}>👤 {(l.irmaos?.nome || 'Loja').split(' ').slice(0,2).join(' ')}</span>
                        <span style={{ fontWeight: '700', color: '#dc2626', textAlign: 'right' }}>{fmtR(l.valor)}</span>
                        <span style={{ fontSize: '0.68rem', color: l.status === 'pago' ? '#16a34a' : '#d97706', textAlign: 'center', fontWeight: '600' }}>{l.status === 'pago' ? '✓ Pago' : '⏳ Pend.'}</span>
                      </div>
                    ))}
                  </div>

                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1.5rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer' }}>Fechar</button>
        </div>

      </div>
    </div>
  );
}
