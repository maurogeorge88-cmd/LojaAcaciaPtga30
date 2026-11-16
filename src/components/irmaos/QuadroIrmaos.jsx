import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { formatarData } from '../../utils/formatters';
import { supabase } from '../../supabaseClient';
import { gerarRelatorioSituacoesPDF } from '../../utils/gerarRelatorioSituacoesPDF';
import { gerarQuadroIrmaosPDF } from '../../utils/gerarQuadroIrmaosPDF';

// ════════════════════════════════════════════════════════════════════════
// Quadro de Irmãos — visão geral do quadro da loja (KPIs, gráficos,
// tabela ordenável e cartões). Cores de grau no padrão do sistema.
// ════════════════════════════════════════════════════════════════════════

const COR_GRAU = {
  'Aprendiz': '#eab308',
  'Companheiro': '#10b981',
  'Mestre': '#3b82f6',
  'Mestre Instalado': '#3b82f6',
  'Não iniciado': '#94a3b8',
};
const ROTULO_GRAU_CURTO = { 'Mestre Instalado': 'M. Instalado' };

const COR_SITUACAO = {
  regular: '#10b981',
  licenciado: '#eab308',
  irregular: '#f97316',
  suspenso: '#ef4444',
  desligado: '#94a3b8',
  excluido: '#ef4444',
  falecido: '#64748b',
  ex_oficio: '#8b5cf6',
};
const corSituacao = (s) => COR_SITUACAO[(s || 'regular').toLowerCase().replace(/[-\s]/g, '_')] || '#64748b';
const rotuloSituacao = (s) => {
  const v = (s || 'regular').toLowerCase().replace(/[-\s]/g, '_');
  const mapa = { desligado: 'Quite Placet', ex_oficio: 'Ex-Ofício', excluido: 'Excluído' };
  return mapa[v] || v.charAt(0).toUpperCase() + v.slice(1);
};

const dataLocal = (s) => (s ? new Date(String(s).slice(0, 10) + 'T00:00:00') : null);

const idadeEmAnos = (nasc) => {
  const n = dataLocal(nasc);
  if (!n) return null;
  const h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--;
  return a;
};

// Meses completos desde a iniciação (considera o dia)
const mesesDesde = (ini) => {
  const i = dataLocal(ini);
  if (!i) return null;
  const h = new Date();
  let m = (h.getFullYear() - i.getFullYear()) * 12 + (h.getMonth() - i.getMonth());
  if (h.getDate() < i.getDate()) m--;
  return Math.max(m, 0);
};
const formatarMeses = (m) => (m == null ? '-' : `${Math.floor(m / 12)}a ${m % 12}m`);

const obterGrau = (i) => {
  if (i.data_exaltacao) return i.mestre_instalado ? 'Mestre Instalado' : 'Mestre';
  if (i.data_elevacao) return 'Companheiro';
  if (i.data_iniciacao) return 'Aprendiz';
  return 'Não iniciado';
};
const grauBase = (g) => (g === 'Mestre Instalado' ? 'Mestre' : g);

const iniciais = (nome) => {
  const p = (nome || '?').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
};

const Chip = ({ texto, cor, largura }) => (
  <span style={{
    display: 'inline-block', width: largura, textAlign: 'center', boxSizing: 'border-box',
    padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
    background: cor + '26', color: cor, border: `1px solid ${cor}`, whiteSpace: 'nowrap',
  }}>{texto}</span>
);

const COLUNAS = [
  { chave: 'cim', rotulo: 'CIM', largura: '70px', alinha: 'left' },
  { chave: 'nome', rotulo: 'Irmão', largura: 'minmax(220px, 1fr)', alinha: 'left' },
  { chave: 'grau', rotulo: 'Grau', largura: '120px', alinha: 'center' },
  { chave: 'idade', rotulo: 'Idade', largura: '70px', alinha: 'center' },
  { chave: 'iniciacao', rotulo: 'Iniciação', largura: '100px', alinha: 'center' },
  { chave: 'elevacao', rotulo: 'Elevação', largura: '100px', alinha: 'center' },
  { chave: 'exaltacao', rotulo: 'Exaltação', largura: '100px', alinha: 'center' },
  { chave: 'tempo', rotulo: 'Tempo', largura: '80px', alinha: 'center' },
  { chave: 'situacao', rotulo: 'Situação', largura: '110px', alinha: 'center' },
];
const GRID = COLUNAS.map(c => c.largura).join(' ');
const ORDEM_GRAU = { 'Mestre Instalado': 0, 'Mestre': 1, 'Companheiro': 2, 'Aprendiz': 3, 'Não iniciado': 4 };

const QuadroIrmaos = ({ irmaos, onViewPerfilCompleto }) => {
  const [grauSel, setGrauSel] = useState('todos');
  const [situacaoSel, setSituacaoSel] = useState('ativos');
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState({ chave: 'nome', dir: 'asc' });
  const [visao, setVisao] = useState('tabela');
  const [dadosLoja, setDadosLoja] = useState(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [gerandoQuadroPdf, setGerandoQuadroPdf] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('dados_loja').select('*').limit(1).maybeSingle();
      if (data) setDadosLoja(data);
    })();
  }, []);

  // ── Enriquece cada irmão com valores derivados ──
  const lista = useMemo(() => (irmaos || []).map(i => {
    const sit = (i.situacao || 'regular').toLowerCase().replace(/[-\s]/g, '_');
    const idade = idadeEmAnos(i.data_nascimento);
    const nasc = dataLocal(i.data_nascimento);
    return {
      ...i,
      _grau: obterGrau(i),
      _sit: sit,
      _idade: idade,
      _meses: mesesDesde(i.data_iniciacao),
      _prerrogativa: idade != null && idade >= 70,
      _aniversarioMes: !!nasc && nasc.getMonth() === new Date().getMonth(),
    };
  }), [irmaos]);

  const ativos = useMemo(() => lista.filter(i => i._sit === 'regular' || i._sit === 'licenciado'), [lista]);
  const outras = useMemo(() => lista.filter(i => i._sit !== 'regular' && i._sit !== 'licenciado'), [lista]);

  // ── KPIs (sempre sobre o quadro ativo) ──
  const kpi = useMemo(() => {
    const por = (g) => ativos.filter(i => grauBase(i._grau) === g).length;
    const idades = ativos.map(i => i._idade).filter(v => v != null);
    const tempos = ativos.map(i => i._meses).filter(v => v != null);
    return {
      total: ativos.length,
      mestres: por('Mestre'),
      companheiros: por('Companheiro'),
      aprendizes: por('Aprendiz'),
      idadeMedia: idades.length ? Math.round(idades.reduce((a, b) => a + b, 0) / idades.length) : null,
      tempoMedio: tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null,
      prerrogativa: ativos.filter(i => i._prerrogativa).length,
      licenciados: ativos.filter(i => i._sit === 'licenciado').length,
    };
  }, [ativos]);

  const dadosPizza = [
    { nome: 'Mestres', valor: kpi.mestres, cor: COR_GRAU.Mestre },
    { nome: 'Companheiros', valor: kpi.companheiros, cor: COR_GRAU.Companheiro },
    { nome: 'Aprendizes', valor: kpi.aprendizes, cor: COR_GRAU.Aprendiz },
  ].filter(d => d.valor > 0);

  const dadosFaixa = useMemo(() => {
    // Primeira faixa começa na menor idade do quadro (ex.: 21–30)
    const idadesAtivas = ativos.map(i => i._idade).filter(v => v != null);
    const menorIdade = idadesAtivas.length ? Math.min(...idadesAtivas) : null;
    const rotuloPrimeira = menorIdade != null && menorIdade <= 30 ? (menorIdade === 30 ? '30' : `${menorIdade}–30`) : 'até 30';
    const faixas = [
      { f: rotuloPrimeira, min: 0, max: 30 }, { f: '31–40', min: 31, max: 40 }, { f: '41–50', min: 41, max: 50 },
      { f: '51–60', min: 51, max: 60 }, { f: '61–69', min: 61, max: 69 }, { f: '70+', min: 70, max: 200 },
    ];
    return faixas.map(x => ({
      faixa: x.f,
      irmaos: ativos.filter(i => i._idade != null && i._idade >= x.min && i._idade <= x.max).length,
    }));
  }, [ativos]);

  const extremos = useMemo(() => {
    const comIdade = ativos.filter(i => i._idade != null);
    if (!comIdade.length) return null;
    const novo = comIdade.reduce((a, b) => (b._idade < a._idade ? b : a));
    const velho = comIdade.reduce((a, b) => (b._idade > a._idade ? b : a));
    return { novo, velho };
  }, [ativos]);

  // ── Tempo de maçonaria (desde a iniciação) ──
  const dadosTempo = useMemo(() => {
    const faixas = [
      { f: '< 1 ano', min: 0, max: 0 }, { f: '1–2', min: 1, max: 2 }, { f: '3–5', min: 3, max: 5 },
      { f: '6–10', min: 6, max: 10 }, { f: '11–20', min: 11, max: 20 }, { f: '21+', min: 21, max: 200 },
    ];
    return faixas.map(x => ({
      faixa: x.f,
      irmaos: ativos.filter(i => i._meses != null && Math.floor(i._meses / 12) >= x.min && Math.floor(i._meses / 12) <= x.max).length,
    }));
  }, [ativos]);

  const extremosTempo = useMemo(() => {
    const com = ativos.filter(i => i._meses != null);
    if (!com.length) return null;
    return {
      recente: com.reduce((a, b) => (b._meses < a._meses ? b : a)),
      antigo: com.reduce((a, b) => (b._meses > a._meses ? b : a)),
    };
  }, [ativos]);

  const fmtTempo = (m) => {
    const a = Math.floor(m / 12), r = m % 12;
    if (a === 0) return `${r} ${r === 1 ? 'mês' : 'meses'}`;
    return `${a} ${a === 1 ? 'ano' : 'anos'}${r ? ` e ${r} ${r === 1 ? 'mês' : 'meses'}` : ''}`;
  };

  const topoTempo = Math.max(3, Math.ceil((Math.max(0, ...dadosTempo.map(d => d.irmaos)) + 1) / 3) * 3);
  const ticksTempo = Array.from({ length: topoTempo / 3 + 1 }, (_, i) => i * 3);

  const topoFaixa = Math.max(3, Math.ceil((Math.max(0, ...dadosFaixa.map(d => d.irmaos)) + 1) / 3) * 3);
  const ticksFaixa = Array.from({ length: topoFaixa / 3 + 1 }, (_, i) => i * 3);

  // ── Filtros ──
  const baseSituacao = useMemo(() => {
    switch (situacaoSel) {
      case 'licenciados': return ativos.filter(i => i._sit === 'licenciado');
      case 'prerrogativa': return ativos.filter(i => i._prerrogativa);
      case 'outras': return outras;
      case 'todas': return lista;
      default: return ativos;
    }
  }, [situacaoSel, ativos, outras, lista]);

  const contaGrau = (g) => baseSituacao.filter(i => g === 'todos' || grauBase(i._grau) === g).length;

  const exibidos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrados = baseSituacao.filter(i => {
      if (grauSel !== 'todos' && grauBase(i._grau) !== grauSel) return false;
      if (!q) return true;
      return (i.nome || '').toLowerCase().includes(q) || String(i.cim || '').toLowerCase().includes(q);
    });
    const { chave, dir } = ordem;
    const val = (i) => {
      switch (chave) {
        case 'cim': return parseInt(i.cim, 10) || 0;
        case 'nome': return (i.nome || '').toLowerCase();
        case 'grau': return ORDEM_GRAU[i._grau] ?? 9;
        case 'idade': return i._idade ?? -1;
        case 'iniciacao': return i.data_iniciacao || '';
        case 'elevacao': return i.data_elevacao || '';
        case 'exaltacao': return i.data_exaltacao || '';
        case 'tempo': return i._meses ?? -1;
        case 'situacao': return i._sit;
        default: return '';
      }
    };
    return [...filtrados].sort((a, b) => {
      const va = val(a), vb = val(b);
      // vazios sempre por último
      const ea = va === '' || va === -1, eb = vb === '' || vb === -1;
      if (ea && !eb) return 1;
      if (!ea && eb) return -1;
      const r = va < vb ? -1 : va > vb ? 1 : (a.nome || '').localeCompare(b.nome || '');
      return dir === 'asc' ? r : -r;
    });
  }, [baseSituacao, grauSel, busca, ordem]);

  const alternarOrdem = (chave) =>
    setOrdem(o => (o.chave === chave ? { chave, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { chave, dir: chave === 'tempo' || chave === 'idade' ? 'desc' : 'asc' }));

  const ROTULO_SITUACAO_FILTRO = {
    ativos: 'Ativos (Regular + Licenciado)', licenciados: 'Licenciados', prerrogativa: 'Prerrogativa (70+)',
    outras: 'Outras situações', todas: 'Todas as situações',
  };

  const handleGerarQuadroPdf = () => {
    setGerandoQuadroPdf(true);
    try {
      gerarQuadroIrmaosPDF(exibidos, dadosLoja, grauSel, ordem.chave, { direcao: ordem.dir, situacaoLabel: ROTULO_SITUACAO_FILTRO[situacaoSel] });
    } catch (e) {
      console.error('Erro ao gerar PDF do quadro:', e);
    } finally {
      setGerandoQuadroPdf(false);
    }
  };

  const handleGerarRelatorioSituacoes = async () => {
    setGerandoPdf(true);
    try {
      await gerarRelatorioSituacoesPDF(irmaos, dadosLoja);
    } catch (e) {
      console.error('Erro ao gerar relatório de situações:', e);
    } finally {
      setGerandoPdf(false);
    }
  };

  const abrirPerfil = (i) => { if (onViewPerfilCompleto) onViewPerfilCompleto(i.id); };

  // ── Estilos base ──
  const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' };
  const segBtn = (ativo, cor) => ({
    padding: '0.4rem 0.85rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${ativo ? (cor || 'var(--color-accent)') : 'var(--color-border)'}`,
    background: ativo ? (cor || 'var(--color-accent)') : 'var(--color-surface-2)',
    color: ativo ? '#fff' : 'var(--color-text-muted)', whiteSpace: 'nowrap',
  });
  const tooltipStyle = { background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', fontSize: 12 };

  const KpiGrau = ({ titulo, valor, cor }) => {
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

  const KpiMini = ({ icone, titulo, valor, sub }) => (
    <div style={{ ...card, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ fontSize: '1.5rem' }}>{icone}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{titulo}</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>{valor}</div>
        {sub && <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{sub}</div>}
      </div>
    </div>
  );

  const Marcadores = ({ i }) => (
    <>
      {i._prerrogativa && <span title="Prerrogativa (70+)" style={{ marginLeft: 6, fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: '#f59e0b26', color: '#f59e0b', border: '1px solid #f59e0b' }}>70+</span>}
      {i._aniversarioMes && <span title="Aniversariante do mês" style={{ marginLeft: 6, fontSize: '0.8rem' }}>🎂</span>}
    </>
  );

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', padding: '0.5rem', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Cabeçalho */}
      <div style={{ ...card, borderTop: '4px solid var(--color-accent)', padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)' }}>📋 Quadro de Irmãos</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            {kpi.total} irmãos ativos · posição em {new Date().toLocaleDateString('pt-BR')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={handleGerarQuadroPdf} disabled={gerandoQuadroPdf}
            title="PDF igual à tela: mesmos filtros e mesma ordenação"
            style={{ padding: '0.5rem 1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: gerandoQuadroPdf ? 'wait' : 'pointer', opacity: gerandoQuadroPdf ? 0.7 : 1 }}>
            {gerandoQuadroPdf ? '⏳ Gerando...' : '📄 PDF do Quadro'}
          </button>
          <button onClick={handleGerarRelatorioSituacoes} disabled={gerandoPdf}
            style={{ padding: '0.5rem 1rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: gerandoPdf ? 'wait' : 'pointer', opacity: gerandoPdf ? 0.7 : 1 }}>
            {gerandoPdf ? '⏳ Gerando...' : '📄 Relatório de Situações'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
        <div style={{ ...card, borderTop: '4px solid var(--color-text-muted)', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Total ativos</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '0.25rem' }}>{kpi.total}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Regular + Licenciado</div>
        </div>
        <KpiGrau titulo="Mestres" valor={kpi.mestres} cor={COR_GRAU.Mestre} />
        <KpiGrau titulo="Companheiros" valor={kpi.companheiros} cor={COR_GRAU.Companheiro} />
        <KpiGrau titulo="Aprendizes" valor={kpi.aprendizes} cor={COR_GRAU.Aprendiz} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
        <KpiMini icone="🎂" titulo="Idade média" valor={kpi.idadeMedia != null ? `${kpi.idadeMedia} anos` : '-'} />
        <KpiMini icone="⏳" titulo="Tempo médio de loja" valor={formatarMeses(kpi.tempoMedio)} />
        <KpiMini icone="🧓" titulo="Prerrogativa (70+)" valor={kpi.prerrogativa} />
        <KpiMini icone="🗓️" titulo="Licenciados" valor={kpi.licenciados} />
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.75rem' }}>
        <div style={{ ...card, padding: '1rem 1.25rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Composição por grau</div>
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
                <YAxis allowDecimals={false} domain={[0, topoFaixa]} ticks={ticksFaixa} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.12)' }} formatter={(v) => [v, 'Irmãos']} />
                <Bar dataKey="irmaos" fill="var(--color-accent)" radius={[6, 6, 0, 0]} label={{ position: 'top', fill: 'var(--color-text-muted)', fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {extremos && (
            <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={extremos.novo.nome}>
                🌱 Mais novo: <strong style={{ color: 'var(--color-text)' }}>{extremos.novo.nome}</strong> ({extremos.novo._idade} anos)
              </div>
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={extremos.velho.nome}>
                🏛️ Mais velho: <strong style={{ color: 'var(--color-text)' }}>{extremos.velho.nome}</strong> ({extremos.velho._idade} anos)
              </div>
            </div>
          )}
        </div>
        <div style={{ ...card, padding: '1rem 1.25rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Tempo de maçonaria</div>
          <div style={{ height: 196 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosTempo} margin={{ top: 24, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="faixa" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} domain={[0, topoTempo]} ticks={ticksTempo} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.12)' }} formatter={(v) => [v, 'Irmãos']} labelFormatter={(l) => `${l}${/\d$|\+$/.test(l) ? ' anos' : ''}`} />
                <Bar dataKey="irmaos" fill="#10b981" radius={[6, 6, 0, 0]} label={{ position: 'top', fill: 'var(--color-text-muted)', fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {extremosTempo && (
            <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={extremosTempo.recente.nome}>
                🌱 Mais recente: <strong style={{ color: 'var(--color-text)' }}>{extremosTempo.recente.nome}</strong> ({fmtTempo(extremosTempo.recente._meses)})
              </div>
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={extremosTempo.antigo.nome}>
                🏛️ Mais antigo: <strong style={{ color: 'var(--color-text)' }}>{extremosTempo.antigo.nome}</strong> ({fmtTempo(extremosTempo.antigo._meses)})
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barra de filtros */}
      <div style={{ ...card, padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar por nome ou CIM..."
            style={{ flex: '1 1 240px', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
          />
          <div style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 999, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
            {[['tabela', '☰ Tabela'], ['cartoes', '▦ Cartões']].map(([v, r]) => (
              <button key={v} onClick={() => setVisao(v)} style={{ ...segBtn(visao === v), border: 'none' }}>{r}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', width: 64 }}>GRAU</span>
          <button onClick={() => setGrauSel('todos')} style={segBtn(grauSel === 'todos')}>Todos ({contaGrau('todos')})</button>
          {[['Mestre', 'Mestres'], ['Companheiro', 'Companheiros'], ['Aprendiz', 'Aprendizes']].map(([g, r]) => (
            <button key={g} onClick={() => setGrauSel(g)} style={segBtn(grauSel === g, COR_GRAU[g])}>{r} ({contaGrau(g)})</button>
          ))}
          {situacaoSel !== 'ativos' && contaGrau('Não iniciado') > 0 && (
            <button onClick={() => setGrauSel('Não iniciado')} style={segBtn(grauSel === 'Não iniciado', COR_GRAU['Não iniciado'])}>Não iniciados ({contaGrau('Não iniciado')})</button>
          )}
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
            <button key={v} onClick={() => { setSituacaoSel(v); setGrauSel('todos'); }} style={segBtn(situacaoSel === v)}>{r}</button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {exibidos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ fontSize: '3rem' }}>📋</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)' }}>Nenhum irmão encontrado</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Ajuste a busca ou os filtros</div>
          </div>
        ) : visao === 'tabela' ? (
          <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
            <div style={{ minWidth: 1000 }}>
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
              {exibidos.map((i, idx) => (
                <div key={i.id} onClick={() => abrirPerfil(i)}
                  style={{ display: 'grid', gridTemplateColumns: GRID, gap: '0.5rem', alignItems: 'center', padding: '0.6rem 1rem', cursor: onViewPerfilCompleto ? 'pointer' : 'default',
                    borderLeft: `4px solid ${COR_GRAU[i._grau] || 'var(--color-border)'}`, background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-accent)' }}>{i.cim || '-'}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {i.nome}<Marcadores i={i} />
                    </div>
                    {i.profissao && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.profissao}</div>}
                  </div>
                  <div style={{ textAlign: 'center' }}><Chip texto={ROTULO_GRAU_CURTO[i._grau] || i._grau} cor={COR_GRAU[i._grau]} largura={104} /></div>
                  <span style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{i._idade != null ? `${i._idade} anos` : '-'}</span>
                  <span style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{i.data_iniciacao ? formatarData(i.data_iniciacao) : '-'}</span>
                  <span style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{i.data_elevacao ? formatarData(i.data_elevacao) : '-'}</span>
                  <span style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{i.data_exaltacao ? formatarData(i.data_exaltacao) : '-'}</span>
                  <span style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{formatarMeses(i._meses)}</span>
                  <div style={{ textAlign: 'center' }}><Chip texto={rotuloSituacao(i.situacao)} cor={corSituacao(i.situacao)} largura={94} /></div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem', maxHeight: '75vh', overflow: 'auto' }}>
            {exibidos.map(i => {
              const cor = COR_GRAU[i._grau] || '#94a3b8';
              return (
                <div key={i.id} onClick={() => abrirPerfil(i)}
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderTop: `4px solid ${cor}`, borderRadius: 'var(--radius-lg)', padding: '0.9rem', cursor: onViewPerfilCompleto ? 'pointer' : 'default' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: cor, background: cor + '26', border: `2px solid ${cor}` }}>
                      {iniciais(i.nome)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.nome}<Marcadores i={i} /></div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        CIM {i.cim || '-'}{i.profissao ? ` · ${i.profissao}` : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.7rem' }}>
                    <Chip texto={ROTULO_GRAU_CURTO[i._grau] || i._grau} cor={cor} largura={104} />
                    <Chip texto={rotuloSituacao(i.situacao)} cor={corSituacao(i.situacao)} largura={94} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.7rem', textAlign: 'center' }}>
                    {[['Idade', i._idade != null ? `${i._idade} anos` : '-'], ['Iniciação', i.data_iniciacao ? formatarData(i.data_iniciacao) : '-'], ['Tempo', formatarMeses(i._meses)]].map(([r, v]) => (
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
            <span>Exibindo <strong style={{ color: 'var(--color-text)' }}>{exibidos.length}</strong> irmão(s) · {ROTULO_SITUACAO_FILTRO[situacaoSel]}</span>
            <span>🎂 aniversariante do mês · <strong style={{ color: '#f59e0b' }}>70+</strong> prerrogativa · clique na linha para abrir o perfil</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuadroIrmaos;
