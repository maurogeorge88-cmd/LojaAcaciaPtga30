import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const AZUL     = '#1e3a5f';
const DOURADO  = '#c9a84c';
const VERDE    = '#10b981';
const LARANJA  = '#f59e0b';
const VERMELHO = '#ef4444';

const fmtR = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtP = (v) => Number(v || 0).toFixed(1) + '%';
const MESES_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const anoAtual = new Date().getFullYear();

const Card = ({ label, valor, sub, cor = 'var(--color-accent)', icon, compacto = false }) => (
  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: `3px solid ${cor}`, borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: '0 0 0.3rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{label}</p>
        <p style={{ margin: 0, fontSize: compacto ? '1.1rem' : '1.4rem', fontWeight: 800, color: cor }}>{valor}</p>
        {sub && <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{sub}</p>}
      </div>
      {icon && <span style={{ fontSize: '1.4rem', opacity: 0.7 }}>{icon}</span>}
    </div>
  </div>
);

const Painel = ({ titulo, children }) => (
  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
    <h3 style={{ margin: '0 0 0.75rem', fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-accent)' }}>{titulo}</h3>
    {children}
  </div>
);

export default function EstatisticasArcoReal() {
  const [anoSel, setAnoSel] = useState(anoAtual);
  const [anosDisp, setAnosDisp] = useState([anoAtual]);
  const [loading, setLoading] = useState(true);

  const [membros, setMembros] = useState([]);
  const [sessoes, setSessoes] = useState([]);
  const [presencas, setPresencas] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [saldoBancarioAtual, setSaldoBancarioAtual] = useState(null);

  useEffect(() => { carregarAnos(); }, []);
  useEffect(() => { carregarDados(); }, [anoSel]);

  const carregarAnos = async () => {
    const { data } = await supabase.from('arco_real_sessoes').select('data_sessao');
    const anos = [...new Set([...(data || []).map(s => new Date(s.data_sessao + 'T00:00:00').getFullYear()), anoAtual])].sort((a, b) => b - a);
    setAnosDisp(anos);
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      const inicioAno = `${anoSel}-01-01`, fimAno = `${anoSel}-12-31`;

      const [{ data: mb }, { data: ss }, { data: lc }, { data: cat }] = await Promise.all([
        supabase.from('arco_real_membros').select('id, situacao, ativo'),
        supabase.from('arco_real_sessoes').select('id, data_sessao, classificacao').gte('data_sessao', inicioAno).lte('data_sessao', fimAno),
        supabase.from('arco_real_lancamentos').select('tipo, valor, status, data_pagamento, tipo_pagamento, categoria_id, categoria_manual:categoria_id(nome)').eq('status', 'pago').gte('data_pagamento', inicioAno).lte('data_pagamento', fimAno),
        supabase.from('categorias_financeiras').select('id, nome'),
      ]);

      setMembros(mb || []);
      setSessoes(ss || []);
      setLancamentos((lc || []).filter(l => l.tipo_pagamento !== 'compensacao'));
      setCategorias(cat || []);

      const sessaoIds = (ss || []).map(s => s.id);
      let pres = [];
      if (sessaoIds.length > 0) {
        const { data } = await supabase.from('arco_real_registros_presenca').select('membro_id, sessao_id, presente').in('sessao_id', sessaoIds);
        pres = data || [];
      }
      setPresencas(pres);

      // Saldo bancário atual — histórico completo, excluindo dinheiro e compensação
      const { data: todosLancs } = await supabase.from('arco_real_lancamentos').select('tipo, valor, tipo_pagamento').eq('status', 'pago');
      const saldoBanco = (todosLancs || [])
        .filter(l => l.tipo_pagamento !== 'compensacao' && l.tipo_pagamento !== 'dinheiro')
        .reduce((s, l) => s + (l.tipo === 'receita' ? 1 : -1) * Number(l.valor || 0), 0);
      setSaldoBancarioAtual(saldoBanco);
    } catch (e) {
      console.error('Erro ao carregar estatísticas do Arco Real:', e);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const ativos = membros.filter(m => m.ativo).length;
    const regulares = membros.filter(m => m.ativo && m.situacao === 'regular').length;
    const licenciados = membros.filter(m => m.ativo && m.situacao === 'licenciado').length;

    // Presença mensal
    const presencaMensal = MESES_ABR.map((mes, i) => {
      const sessoesDoMes = sessoes.filter(s => new Date(s.data_sessao + 'T00:00:00').getMonth() === i);
      if (sessoesDoMes.length === 0) return { mes, taxa: 0, sessoes: 0 };
      const idsSessoesMes = sessoesDoMes.map(s => s.id);
      const presDoMes = presencas.filter(p => idsSessoesMes.includes(p.sessao_id));
      const totalPossivel = sessoesDoMes.length * (ativos || 1);
      const totalPresente = presDoMes.filter(p => p.presente).length;
      return { mes, taxa: totalPossivel > 0 ? Math.round((totalPresente / totalPossivel) * 1000) / 10 : 0, sessoes: sessoesDoMes.length };
    });
    const mesesComSessao = presencaMensal.filter(m => m.sessoes > 0);
    const taxaGeralAno = mesesComSessao.length > 0 ? Math.round(mesesComSessao.reduce((s, m) => s + m.taxa, 0) / mesesComSessao.length * 10) / 10 : 0;

    // Financeiro mensal
    const finMensal = MESES_ABR.map((mes, i) => {
      const doMes = lancamentos.filter(l => l.data_pagamento && new Date(l.data_pagamento + 'T00:00:00').getMonth() === i);
      return {
        mes,
        receita: doMes.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0),
        despesa: doMes.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0),
      };
    });
    const totalReceita = lancamentos.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0);
    const totalDespesa = lancamentos.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0);

    // Top categorias (receita)
    const recCat = {};
    lancamentos.filter(l => l.tipo === 'receita').forEach(l => {
      const nome = l.categoria_manual?.nome || 'Sem categoria';
      recCat[nome] = (recCat[nome] || 0) + Number(l.valor);
    });
    const graficoRecCat = Object.entries(recCat).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([n, v]) => ({ nome: n.length > 22 ? n.substring(0, 20) + '…' : n, valor: Math.round(v * 100) / 100 }));

    return { ativos, regulares, licenciados, presencaMensal, taxaGeralAno, finMensal, totalReceita, totalDespesa, graficoRecCat };
  }, [membros, sessoes, presencas, lancamentos]);

  const sBtn = (ativo) => ({
    padding: '0.35rem 0.85rem', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', border: 'none',
    background: ativo ? 'var(--color-accent)' : 'var(--color-surface-2)', color: ativo ? '#fff' : 'var(--color-text)',
  });

  if (loading) return <div className="p-10 text-center" style={{ color: 'var(--color-text-muted)' }}>Carregando estatísticas...</div>;

  return (
    <div className="p-6" style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.3rem', color: 'var(--color-accent)' }}>📊 Estatísticas — Arco Real</h2>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {anosDisp.map(a => <button key={a} onClick={() => setAnoSel(a)} style={sBtn(anoSel === a)}>{a}</button>)}
        </div>
      </div>

      {/* Membros */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <Card label="Membros Ativos" valor={stats.ativos} sub={`${stats.regulares} reg. · ${stats.licenciados} lic.`} cor="var(--color-accent)" icon="👥" />
        <Card label="Taxa de Presença" valor={fmtP(stats.taxaGeralAno)} sub={`Média do ano ${anoSel}`} cor={stats.taxaGeralAno >= 70 ? VERDE : stats.taxaGeralAno >= 50 ? LARANJA : VERMELHO} icon="✅" />
        <Card label="Sessões Realizadas" valor={sessoes.length} sub={`em ${anoSel}`} cor="var(--color-accent)" icon="🏛️" />
        <Card label="Saldo Bancário" valor={saldoBancarioAtual === null ? '...' : fmtR(saldoBancarioAtual)} sub="PIX, Transf., Cartão" cor="#0ea5e9" icon="🏦" />
      </div>

      {/* Presença mensal */}
      <Painel titulo={`📋 Presença Mensal — ${anoSel}`}>
        {stats.presencaMensal.some(m => m.sessoes > 0) ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={stats.presencaMensal}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="taxa" name="Taxa de Presença" stroke={AZUL} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1.5rem' }}>Sem sessões registradas em {anoSel}.</p>}
      </Painel>

      {/* Financeiro */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
        <Card compacto label={`Receitas ${anoSel}`} valor={fmtR(stats.totalReceita)} sub="Entradas pagas" cor={VERDE} icon="📈" />
        <Card compacto label={`Despesas ${anoSel}`} valor={fmtR(stats.totalDespesa)} sub="Saídas pagas" cor={VERMELHO} icon="📉" />
        <Card compacto label="Resultado" valor={fmtR(stats.totalReceita - stats.totalDespesa)} sub={stats.totalReceita >= stats.totalDespesa ? 'Superávit' : 'Déficit'} cor={stats.totalReceita >= stats.totalDespesa ? VERDE : VERMELHO} icon="⚖️" />
        <Card compacto label="Melhor Mês (Rec.)" valor={[...stats.finMensal].sort((a, b) => b.receita - a.receita)[0]?.mes || '—'} sub={fmtR(Math.max(0, ...stats.finMensal.map(m => m.receita)))} cor="var(--color-accent)" icon="🏆" />
      </div>

      <Painel titulo={`💰 Receitas × Despesas Mensais — ${anoSel}`}>
        {stats.totalReceita + stats.totalDespesa > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.finMensal}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmtR(v)} />
              <Legend />
              <Bar dataKey="receita" name="Receitas" fill={VERDE} radius={[3, 3, 0, 0]} />
              <Bar dataKey="despesa" name="Despesas" fill={VERMELHO} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1.5rem' }}>Sem movimentação financeira em {anoSel}.</p>}
      </Painel>

      <Painel titulo="🏷️ Receitas por Categoria (Top 8)">
        {stats.graficoRecCat.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, stats.graficoRecCat.length * 36)}>
            <BarChart data={stats.graficoRecCat} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={140} />
              <Tooltip formatter={(v) => fmtR(v)} />
              <Bar dataKey="valor" fill={DOURADO} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1.5rem' }}>Sem receitas categorizadas em {anoSel}.</p>}
      </Painel>
    </div>
  );
}
