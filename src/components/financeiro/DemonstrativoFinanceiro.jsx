import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarMoeda } from './utils/formatadores';
import { TIPOS_PERIODO, calcularDemonstrativo, gerarPDFDemonstrativo } from './utils/demonstrativoFinanceiro';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const sSelect = { padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: '0.82rem' };

// Aba "Demonstrativo Financeiro" do Rel. Financeiro — PDF para banco / contabilidade
export default function DemonstrativoFinanceiro({ showError, showSuccess }) {
  const hoje = new Date();
  const [sel, setSel] = useState({ tipo: 'anual', ano: hoje.getFullYear(), mes: hoje.getMonth() + 1, trimestre: Math.floor(hoje.getMonth() / 3) + 1, semestre: hoje.getMonth() < 6 ? 1 : 2 });
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [dadosLoja, setDadosLoja] = useState(null);

  const anos = Array.from({ length: 8 }, (_, i) => hoje.getFullYear() - i);

  useEffect(() => {
    supabase.from('dados_loja').select('*').limit(1).maybeSingle().then(({ data }) => setDadosLoja(data));
  }, []);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    calcularDemonstrativo(sel)
      .then(d => { if (vivo) setDados(d); })
      .catch(e => showError?.('Erro ao calcular: ' + e.message))
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [sel.tipo, sel.ano, sel.mes, sel.trimestre, sel.semestre]); // eslint-disable-line react-hooks/exhaustive-deps

  const contador = dadosLoja ? {
    nome: dadosLoja.contador_nome, crc: dadosLoja.contador_crc, cpf: dadosLoja.contador_cpf,
    telefone: dadosLoja.contador_telefone, email: dadosLoja.contador_email,
  } : null;

  const gerar = async () => {
    if (!dados) return;
    setGerando(true);
    try { await gerarPDFDemonstrativo({ dados, dadosLoja, contador, showError, showSuccess }); }
    finally { setGerando(false); }
  };

  const set = (k) => (e) => setSel(s => ({ ...s, [k]: parseInt(e.target.value) }));
  const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1rem 1.25rem' };
  const kpi = (rot, val, cor) => (
    <div style={{ ...card, padding: '0.7rem 1rem' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{rot}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: cor }}>{formatarMoeda(val)}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Período:</span>
        <select value={sel.tipo} onChange={e => setSel(s => ({ ...s, tipo: e.target.value }))} style={sSelect}>
          {TIPOS_PERIODO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {sel.tipo === 'mensal' && <select value={sel.mes} onChange={set('mes')} style={sSelect}>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select>}
        {sel.tipo === 'trimestral' && <select value={sel.trimestre} onChange={set('trimestre')} style={sSelect}>{[1, 2, 3, 4].map(t => <option key={t} value={t}>{t}º Trimestre</option>)}</select>}
        {sel.tipo === 'semestral' && <select value={sel.semestre} onChange={set('semestre')} style={sSelect}><option value={1}>1º Semestre (Jan-Jun)</option><option value={2}>2º Semestre (Jul-Dez)</option></select>}
        {sel.tipo !== 'ultimos12' && <select value={sel.ano} onChange={set('ano')} style={sSelect}>{anos.map(a => <option key={a} value={a}>{a}</option>)}</select>}
        <div style={{ flex: 1 }} />
        <button onClick={gerar} disabled={!dados || carregando || gerando}
          style={{ padding: '0.45rem 1.1rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: (!dados || carregando || gerando) ? 0.6 : 1 }}>
          {gerando ? 'Gerando...' : '📄 Gerar PDF'}
        </button>
      </div>

      {carregando && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>⏳ Calculando...</div>}

      {!carregando && dados && (
        <>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {dados.periodo.label} · {dados.qtdLancamentos} lançamento(s) pago(s) · soma de todo o movimento (banco + caixa), sem distinção.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))', gap: '0.75rem' }}>
            {kpi('Saldo inicial', dados.saldoInicial, 'var(--color-text)')}
            {kpi('Receitas', dados.receitas, '#10b981')}
            {kpi('Despesas', dados.despesas, '#ef4444')}
            {kpi('Resultado', dados.resultado, dados.resultado >= 0 ? '#10b981' : '#ef4444')}
            {kpi('Saldo final', dados.saldoFinal, 'var(--color-accent)')}
          </div>
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead><tr style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', fontSize: '0.74rem', textAlign: 'right' }}>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.9rem' }}>Mês</th><th style={{ padding: '0.55rem 0.9rem' }}>Receitas</th><th style={{ padding: '0.55rem 0.9rem' }}>Despesas</th><th style={{ padding: '0.55rem 0.9rem' }}>Resultado</th>
              </tr></thead>
              <tbody>
                {dados.mensal.map(m => (
                  <tr key={m.chave} style={{ borderTop: '1px solid var(--color-border)', textAlign: 'right' }}>
                    <td style={{ textAlign: 'left', padding: '0.45rem 0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>{m.rotulo}</td>
                    <td style={{ padding: '0.45rem 0.9rem', color: '#10b981' }}>{formatarMoeda(m.receitas)}</td>
                    <td style={{ padding: '0.45rem 0.9rem', color: '#ef4444' }}>{formatarMoeda(m.despesas)}</td>
                    <td style={{ padding: '0.45rem 0.9rem', fontWeight: 700, color: m.resultado >= 0 ? '#10b981' : '#ef4444' }}>{m.resultado >= 0 ? '+' : '-'}{formatarMoeda(Math.abs(m.resultado))}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--color-border)', textAlign: 'right', background: 'var(--color-surface-2)', fontWeight: 800 }}>
                  <td style={{ textAlign: 'left', padding: '0.55rem 0.9rem', color: 'var(--color-text)' }}>TOTAL</td>
                  <td style={{ padding: '0.55rem 0.9rem', color: '#10b981' }}>{formatarMoeda(dados.receitas)}</td>
                  <td style={{ padding: '0.55rem 0.9rem', color: '#ef4444' }}>{formatarMoeda(dados.despesas)}</td>
                  <td style={{ padding: '0.55rem 0.9rem', color: dados.resultado >= 0 ? '#10b981' : '#ef4444' }}>{dados.resultado >= 0 ? '+' : '-'}{formatarMoeda(Math.abs(dados.resultado))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            Contador no PDF: {contador?.nome ? <strong style={{ color: 'var(--color-text)' }}>{contador.nome}{contador.crc ? ` (CRC ${contador.crc})` : ''}</strong> : 'não informado — cadastre em Dados da Loja.'}
          </div>
        </>
      )}
    </div>
  );
}
