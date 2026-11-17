import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { supabase } from '../../supabaseClient';
import { gerarQuadroMembrosArcoRealPDF } from '../../utils/gerarQuadroMembrosArcoRealPDF';
import { fmtData, mesesEntre, tempoTexto, calcularIdade, iniciais, nomeCurto, carregarLogoArcoRealBase64 } from '../../utils/arcoRealMembros';

// ════════════════════════════════════════════════════════════════════════
// Quadro de Membros do Arco Real — mesma estrutura do Quadro de Irmãos da
// Loja (KPIs, gráficos, filtros, tabela/cartões, PDF), com "Tempo de Arco
// Real" contado a partir da data de exaltação.
// ════════════════════════════════════════════════════════════════════════

const COR_SIT = { regular: '#10b981', licenciado: '#6366f1', desligado: '#94a3b8', excluido: '#ef4444', falecido: '#8b5cf6' };
const ROTULO_SIT = { regular: 'Regular', licenciado: 'Licenciado', desligado: 'Desligado', excluido: 'Excluído', falecido: 'Falecido' };
const corSit = (s) => COR_SIT[s] || '#64748b';

const formatarMeses = (m) => (m == null ? '-' : `${Math.floor(m / 12)}a ${m % 12}m`);

const Chip = ({ texto, cor, largura }) => (
  <span style={{
    display: 'inline-block', width: largura, textAlign: 'center', boxSizing: 'border-box',
    padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
    background: cor + '26', color: cor, border: `1px solid ${cor}`, whiteSpace: 'nowrap',
  }}>{texto}</span>
);

const COLUNAS = [
  { chave: 'nome', rotulo: 'Membro', largura: 'minmax(220px, 1fr)', alinha: 'left' },
  { chave: 'cargo', rotulo: 'Cargo', largura: '150px', alinha: 'left' },
  { chave: 'idade', rotulo: 'Idade', largura: '70px', alinha: 'center' },
  { chave: 'exaltacao', rotulo: 'Exaltação', largura: '100px', alinha: 'center' },
  { chave: 'tempo', rotulo: 'Tempo de A.R.', largura: '110px', alinha: 'center' },
  { chave: 'situacao', rotulo: 'Situação', largura: '110px', alinha: 'center' },
];
const GRID = COLUNAS.map(c => c.largura).join(' ');

export default function QuadroMembrosArcoReal({ showError }) {
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [situacaoSel, setSituacaoSel] = useState('ativos');
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState({ chave: 'nome', dir: 'asc' });
  const [visao, setVisao] = useState('tabela');
  const [gerandoPdf, setGerandoPdf] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('arco_real_membros')
          .select('id, nome, cargo, situacao, ativo, data_nascimento, data_exaltacao, foto_url')
          .order('nome');
        if (error) throw error;
        setMembros(data || []);
      } catch (e) {
        showError && showError('Erro ao carregar o quadro: ' + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = useMemo(() => membros.map(m => {
    const idade = calcularIdade(m.data_nascimento);
    return {
      ...m,
      _sit: m.situacao || 'regular',
      _idade: idade,
      _meses: m.data_exaltacao ? mesesEntre(m.data_exaltacao) : null,
      _prerrogativa: idade != null && idade >= 70,
      _aniversarioMes: !!m.data_nascimento && Number(m.data_nascimento.substring(5, 7)) === new Date().getMonth() + 1,
    };
  }), [membros]);

  const ativos = useMemo(() => lista.filter(m => m.ativo !== false && (m._sit === 'regular' || m._sit === 'licenciado')), [lista]);
  const outras = useMemo(() => lista.filter(m => !ativos.includes(m)), [lista, ativos]);

  const kpi = useMemo(() => {
    const idades = ativos.map(m => m._idade).filter(v => v != null);
    const tempos = ativos.map(m => m._meses).filter(v => v != null);
    return {
      total: ativos.length,
      regulares: ativos.filter(m => m._sit === 'regular').length,
      licenciados: ativos.filter(m => m._sit === 'licenciado').length,
      idadeMedia: idades.length ? Math.round(idades.reduce((a, b) => a + b, 0) / idades.length) : null,
      tempoMedio: tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null,
      prerrogativa: ativos.filter(m => m._prerrogativa).length,
      aniversariantes: ativos.filter(m => m._aniversarioMes).length,
    };
  }, [ativos]);

  const dadosPizza = [
    { nome: 'Regulares', valor: kpi.regulares, cor: COR_SIT.regular },
    { nome: 'Licenciados', valor: kpi.licenciados, cor: COR_SIT.licenciado },
  ].filter(d => d.valor > 0);

  const dadosFaixa = useMemo(() => {
    const faixas = [
      { f: 'até 30', min: 0, max: 30 }, { f: '31–40', min: 31, max: 40 }, { f: '41–50', min: 41, max: 50 },
      { f: '51–60', min: 51, max: 60 }, { f: '61–69', min: 61, max: 69 }, { f: '70+', min: 70, max: 200 },
    ];
    return faixas.map(x => ({ faixa: x.f, membros: ativos.filter(m => m._idade != null && m._idade >= x.min && m._idade <= x.max).length }));
  }, [ativos]);

  const dadosTempo = useMemo(() => {
    const faixas = [
      { f: '< 1 ano', min: 0, max: 0 }, { f: '1–2', min: 1, max: 2 }, { f: '3–5', min: 3, max: 5 },
      { f: '6–10', min: 6, max: 10 }, { f: '11–20', min: 11, max: 20 }, { f: '21+', min: 21, max: 200 },
    ];
    return faixas.map(x => ({
      faixa: x.f,
      membros: ativos.filter(m => m._meses != null && Math.floor(m._meses / 12) >= x.min && Math.floor(m._meses / 12) <= x.max).length,
    }));
  }, [ativos]);

  const extremosIdade = useMemo(() => {
    const com = ativos.filter(m => m._idade != null);
    if (!com.length) return null;
    return { novo: com.reduce((a, b) => (b._idade < a._idade ? b : a)), velho: com.reduce((a, b) => (b._idade > a._idade ? b : a)) };
  }, [ativos]);

  const extremosTempo = useMemo(() => {
    const com = ativos.filter(m => m._meses != null);
    if (!com.length) return null;
    return { recente: com.reduce((a, b) => (b._meses < a._meses ? b : a)), antigo: com.reduce((a, b) => (b._meses > a._meses ? b : a)) };
  }, [ativos]);

  const escala = (dados, chave) => {
    const topo = Math.max(3, Math.ceil((Math.max(0, ...dados.map(d => d[chave])) + 1) / 3) * 3);
    return { topo, ticks: Array.from({ length: topo / 3 + 1 }, (_, i) => i * 3) };
  };
  const escFaixa = escala(dadosFaixa, 'membros');
  const escTempo = escala(dadosTempo, 'membros');

  const baseSituacao = useMemo(() => {
    switch (situacaoSel) {
      case 'licenciados': return ativos.filter(m => m._sit === 'licenciado');
      case 'prerrogativa': return ativos.filter(m => m._prerrogativa);
      case 'outras': return outras;
      case 'todas': return lista;
      default: return ativos;
    }
  }, [situacaoSel, ativos, outras, lista]);

  const exibidos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrados = baseSituacao.filter(m => !q || (m.nome || '').toLowerCase().includes(q) || (m.cargo || '').toLowerCase().includes(q));
    const { chave, dir } = ordem;
    const val = (m) => {
      switch (chave) {
        case 'nome': return (m.nome || '').toLowerCase();
        case 'cargo': return (m.cargo || '').toLowerCase();
        case 'idade': return m._idade ?? -1;
        case 'exaltacao': return m.data_exaltacao || '';
        case 'tempo': return m._meses ?? -1;
        case 'situacao': return m._sit;
        default: return '';
      }
    };
    return [...filtrados].sort((a, b) => {
      const va = val(a), vb = val(b);
      const ea = va === '' || va === -1, eb = vb === '' || vb === -1;
      if (ea && !eb) return 1;
      if (!ea && eb) return -1;
      const r = va < vb ? -1 : va > vb ? 1 : (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
      return dir === 'asc' ? r : -r;
    });
  }, [baseSituacao, busca, ordem]);

  const alternarOrdem = (chave) =>
    setOrdem(o => (o.chave === chave ? { chave, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { chave, dir: chave === 'tempo' || chave === 'idade' ? 'desc' : 'asc' }));

  const ROTULO_FILTRO = {
    ativos: 'Ativos (Regular + Licenciado)', licenciados: 'Licenciados', prerrogativa: 'Prerrogativa (70+)',
    outras: 'Outras situações', todas: 'Todas as situações',
  };

  const handlePdf = async () => {
    setGerandoPdf(true);
    try {
      const logo = await carregarLogoArcoRealBase64();
      gerarQuadroMembrosArcoRealPDF(exibidos, logo, { ordenacao: ordem.chave, direcao: ordem.dir, situacaoLabel: ROTULO_FILTRO[situacaoSel] });
    } catch (e) {
      console.error('Erro ao gerar PDF do quadro:', e);
      showError && showError('Erro ao gerar PDF: ' + e.message);
    } finally {
      setGerandoPdf(false);
    }
  };

  const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' };
  const segBtn = (ativo, cor) => ({
    padding: '0.4rem 0.85rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${ativo ? (cor || 'var(--color-accent)') : 'var(--color-border)'}`,
    background: ativo ? (cor || 'var(--color-accent)') : 'var(--color-surface-2)',
    color: ativo ? '#fff' : 'var(--color-text-muted)', whiteSpace: 'nowrap',
  });
  const tooltipStyle = { background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', fontSize: 12 };

  const KpiSit = ({ titulo, valor, cor }) => {
    const pct = kpi.total ? Math.round((valor / kpi.total) * 100) : 0;
    return (
      <div style={{ ...card, borderTop: `4px solid ${cor}`, padding: '1rem 1.25rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{titulo}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)' }}>{valor}</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{pct}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--color-surface-2)', marginTop: '0.5rem', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: cor }} />
        </div>
      </div>
    );
  };

  const KpiMini = ({ icone, titulo, valor }) => (
    <div style={{ ...card, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ fontSize: '1.5rem' }}>{icone}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{titulo}</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>{valor}</div>
      </div>
    </div>
  );

  const Marcadores = ({ m }) => (
    <>
      {m._prerrogativa && <span title="Prerrogativa (70+)" style={{ marginLeft: 6, fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: '#f59e0b26', color: '#f59e0b', border: '1px solid #f59e0b' }}>70+</span>}
      {m._aniversarioMes && <span title="Aniversariante do mês" style={{ marginLeft: 6, fontSize: '0.8rem' }}>🎂</span>}
    </>
  );

  const Extremo = ({ icone, rotulo, m, detalhe }) => (
    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.nome}>
      {icone} {rotulo}: <strong style={{ color: 'var(--color-text)' }}>{nomeCurto(m.nome)}</strong> ({detalhe})
    </div>
  );

  if (loading) return <div className="p-6" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>;

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', padding: '1rem', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Cabeçalho */}
      <div style={{ ...card, borderTop: '4px solid var(--color-accent)', padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)' }}>📋 Quadro de Membros</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            {kpi.total} membros ativos · posição em {new Date().toLocaleDateString('pt-BR')}
          </div>
        </div>
        <button onClick={handlePdf} disabled={gerandoPdf} title="PDF igual à tela: mesmos filtros e mesma ordenação"
          style={{ padding: '0.5rem 1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: gerandoPdf ? 'wait' : 'pointer', opacity: gerandoPdf ? 0.7 : 1 }}>
          {gerandoPdf ? '⏳ Gerando...' : '📄 PDF do Quadro'}
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
        <div style={{ ...card, borderTop: '4px solid var(--color-text-muted)', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Total ativos</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '0.25rem' }}>{kpi.total}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Regular + Licenciado</div>
        </div>
        <KpiSit titulo="Regulares" valor={kpi.regulares} cor={COR_SIT.regular} />
        <KpiSit titulo="Licenciados" valor={kpi.licenciados} cor={COR_SIT.licenciado} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
        <KpiMini icone="🎂" titulo="Idade média" valor={kpi.idadeMedia != null ? `${kpi.idadeMedia} anos` : '-'} />
        <KpiMini icone="🔺" titulo="Tempo médio de Arco Real" valor={formatarMeses(kpi.tempoMedio)} />
        <KpiMini icone="🧓" titulo="Prerrogativa (70+)" valor={kpi.prerrogativa} />
        <KpiMini icone="🎉" titulo="Aniversariantes do mês" valor={kpi.aniversariantes} />
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.75rem' }}>
        <div style={{ ...card, padding: '1rem 1.25rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Composição por situação</div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dadosPizza} dataKey="valor" nameKey="nome" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
                  {dadosPizza.map(d => <Cell key={d.nome} fill={d.cor} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--color-text)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            {dadosPizza.map(d => (
              <span key={d.nome} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: d.cor }} />{d.nome} ({d.valor})
              </span>
            ))}
          </div>
        </div>

        <div style={{ ...card, padding: '1rem 1.25rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Faixa etária</div>
          <div style={{ height: 196 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosFaixa} margin={{ top: 24, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="faixa" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} domain={[0, escFaixa.topo]} ticks={escFaixa.ticks} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.12)' }} formatter={(v) => [v, 'Membros']} />
                <Bar dataKey="membros" fill="var(--color-accent)" radius={[6, 6, 0, 0]} label={{ position: 'top', fill: 'var(--color-text-muted)', fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {extremosIdade && (
            <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              <Extremo icone="🌱" rotulo="Mais novo" m={extremosIdade.novo} detalhe={`${extremosIdade.novo._idade} anos`} />
              <Extremo icone="🏛️" rotulo="Mais velho" m={extremosIdade.velho} detalhe={`${extremosIdade.velho._idade} anos`} />
            </div>
          )}
        </div>

        <div style={{ ...card, padding: '1rem 1.25rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Tempo de Arco Real</div>
          <div style={{ height: 196 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosTempo} margin={{ top: 24, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="faixa" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} domain={[0, escTempo.topo]} ticks={escTempo.ticks} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.12)' }} formatter={(v) => [v, 'Membros']} labelFormatter={(l) => `${l}${/\d$|\+$/.test(l) ? ' anos' : ''}`} />
                <Bar dataKey="membros" fill="#f59e0b" radius={[6, 6, 0, 0]} label={{ position: 'top', fill: 'var(--color-text-muted)', fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {extremosTempo && (
            <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              <Extremo icone="🌱" rotulo="Mais recente" m={extremosTempo.recente} detalhe={tempoTexto(extremosTempo.recente._meses)} />
              <Extremo icone="🏛️" rotulo="Mais antigo" m={extremosTempo.antigo} detalhe={tempoTexto(extremosTempo.antigo._meses)} />
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ ...card, padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar por nome ou cargo..."
            style={{ flex: '1 1 240px', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} />
          <div style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 999, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
            {[['tabela', '☰ Tabela'], ['cartoes', '▦ Cartões']].map(([v, r]) => (
              <button key={v} onClick={() => setVisao(v)} style={{ ...segBtn(visao === v), border: 'none' }}>{r}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', width: 64 }}>SITUAÇÃO</span>
          {[
            ['ativos', `Ativos (${ativos.length})`],
            ['licenciados', `Licenciados (${kpi.licenciados})`],
            ['prerrogativa', `Prerrogativa 70+ (${kpi.prerrogativa})`],
            ['outras', `Outras situações (${outras.length})`],
            ['todas', `Todas (${lista.length})`],
          ].map(([v, r]) => (
            <button key={v} onClick={() => setSituacaoSel(v)} style={segBtn(situacaoSel === v)}>{r}</button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {exibidos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ fontSize: '3rem' }}>📋</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)' }}>Nenhum membro encontrado</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Ajuste a busca ou os filtros</div>
          </div>
        ) : visao === 'tabela' ? (
          <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
            <div style={{ minWidth: 820 }}>
              <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '0.5rem', padding: '0.65rem 1rem', position: 'sticky', top: 0, zIndex: 2, background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                {COLUNAS.map(c => {
                  const ativo = ordem.chave === c.chave;
                  return (
                    <button key={c.chave} onClick={() => alternarOrdem(c.chave)}
                      style={{ textAlign: c.alinha, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', color: ativo ? 'var(--color-accent)' : 'var(--color-text-muted)', padding: 0 }}>
                      {c.rotulo}{ativo ? (ordem.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </button>
                  );
                })}
              </div>
              {exibidos.map((m, idx) => (
                <div key={m.id} style={{ display: 'grid', gridTemplateColumns: GRID, gap: '0.5rem', alignItems: 'center', padding: '0.6rem 1rem', borderLeft: `4px solid ${corSit(m._sit)}`, background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}<Marcadores m={m} /></div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.cargo || '-'}</span>
                  <span style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{m._idade != null ? `${m._idade} anos` : '-'}</span>
                  <span style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{m.data_exaltacao ? fmtData(m.data_exaltacao) : '-'}</span>
                  <span style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{formatarMeses(m._meses)}</span>
                  <div style={{ textAlign: 'center' }}><Chip texto={ROTULO_SIT[m._sit] || m._sit} cor={corSit(m._sit)} largura={94} /></div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem', maxHeight: '75vh', overflow: 'auto' }}>
            {exibidos.map(m => {
              const cor = corSit(m._sit);
              return (
                <div key={m.id} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderTop: `4px solid ${cor}`, borderRadius: 'var(--radius-lg)', padding: '0.9rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: cor, background: cor + '26', border: `2px solid ${cor}` }}>{iniciais(m.nome)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}<Marcadores m={m} /></div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.cargo || 'Sem cargo'}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '0.7rem' }}><Chip texto={ROTULO_SIT[m._sit] || m._sit} cor={cor} largura={94} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.7rem', textAlign: 'center' }}>
                    {[['Idade', m._idade != null ? `${m._idade} anos` : '-'], ['Exaltação', m.data_exaltacao ? fmtData(m.data_exaltacao) : '-'], ['Tempo A.R.', formatarMeses(m._meses)]].map(([r, v]) => (
                      <div key={r}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{r}</div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {exibidos.length > 0 && (
          <div style={{ padding: '0.7rem 1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            <span>Exibindo <strong style={{ color: 'var(--color-text)' }}>{exibidos.length}</strong> membro(s) · {ROTULO_FILTRO[situacaoSel]}</span>
            <span>🎂 aniversariante do mês · <strong style={{ color: '#f59e0b' }}>70+</strong> prerrogativa</span>
          </div>
        )}
      </div>
    </div>
  );
}
