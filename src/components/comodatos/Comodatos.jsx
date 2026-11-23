import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import GestaoEquipamentos from './GestaoEquipamentos';
import GestaoBeneficiarios from './GestaoBeneficiarios';
import GestaoEmprestimos from './GestaoEmprestimos';

const MS_DIA = 1000 * 60 * 60 * 24;
const DIAS_A_VENCER = 30;
const MAX_LISTA = 8;

// ── Telefones ─────────────────────────────────────────────────────────────────
const fmtTelefone = (t) => {
  const d = String(t || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(t || '').trim();
};
const telefonesDe = (o) => [...new Set([o?.celular, o?.telefone].map(t => String(t || '').trim()).filter(Boolean))];

export default function Comodatos({ permissoes, showSuccess, showError }) {
  const [view, setView]     = useState('dashboard');
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [filtroAno, setFiltroAno] = useState('todos');

  useEffect(() => { carregarEstatisticas(); }, []);
  useEffect(() => { if (view === 'dashboard') carregarEstatisticas(); }, [view]);
  useEffect(() => { if (stats !== null) calcularStats(); }, [filtroAno]);

  // Dados brutos armazenados para re-calcular ao trocar ano sem nova query
  const [dadosBrutos, setDadosBrutos] = useState(null);

  const carregarEstatisticas = async () => {
    setLoading(true);
    try {
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

      // Equipamentos (não dependem de ano)
      const { data: equips } = await supabase
        .from('equipamentos')
        .select('id, status');

      // Beneficiários (não dependem de ano)
      const { data: beneficiarios } = await supabase
        .from('beneficiarios')
        .select('id');

      // Todos os empréstimos com itens, beneficiário (contato) e equipamento
      const { data: emprestimos } = await supabase
        .from('comodatos')
        .select(`
          id, status, data_emprestimo, data_devolucao_prevista, data_devolucao_real,
          beneficiarios (id, nome, telefone, celular),
          itens:comodato_itens (id, status, equipamentos (numero_patrimonio, tipos_equipamentos (nome)))
        `)
        .order('data_emprestimo', { ascending: false });

      // Responsáveis (contato) — agrupados por beneficiário
      const { data: respData } = await supabase
        .from('responsaveis')
        .select('id, beneficiario_id, nome, parentesco, telefone, celular');
      const respPorBen = {};
      (respData || []).forEach(r => {
        if (!respPorBen[r.beneficiario_id]) respPorBen[r.beneficiario_id] = [];
        respPorBen[r.beneficiario_id].push(r);
      });

      const brutos = { equips: equips || [], beneficiarios: beneficiarios || [], emprestimos: emprestimos || [], respPorBen, hoje };
      setDadosBrutos(brutos);

      // Anos disponíveis dos empréstimos
      const anos = [...new Set((emprestimos || [])
        .map(e => e.data_emprestimo ? new Date(e.data_emprestimo + 'T00:00:00').getFullYear() : null)
        .filter(Boolean)
      )].sort((a, b) => b - a);
      setAnosDisponiveis(anos);

      calcularStatsComDados(brutos, filtroAno);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calcularStats = () => {
    if (dadosBrutos) calcularStatsComDados(dadosBrutos, filtroAno);
  };

  const calcularStatsComDados = (brutos, ano) => {
    const { equips, beneficiarios, emprestimos, respPorBen, hoje } = brutos;

    // Empréstimos do ano selecionado (afeta só os cartões de "Empréstimos")
    const empFiltrados = ano === 'todos'
      ? emprestimos
      : emprestimos.filter(e => {
          if (!e.data_emprestimo) return false;
          return new Date(e.data_emprestimo + 'T00:00:00').getFullYear() === ano;
        });

    const ativosNoFiltro     = empFiltrados.filter(e => e.status === 'ativo');
    const devolvidosNoFiltro = empFiltrados.filter(e => e.status === 'devolvido');

    // Ativos de anos ANTERIORES ao filtrado (só quando há ano específico)
    const ativosOutrosAnos = ano !== 'todos'
      ? emprestimos.filter(e => e.status === 'ativo' && e.data_emprestimo
          && new Date(e.data_emprestimo + 'T00:00:00').getFullYear() < ano)
      : [];

    // Ação: vencidos e a vencer — SEMPRE de todos os anos (são pendências reais)
    const montarLinha = (e, dataPrev, dias) => {
      const ben = e.beneficiarios || {};
      const responsaveis = (respPorBen[ben.id] || [])
        .map(r => ({ nome: r.nome, parentesco: r.parentesco, tels: telefonesDe(r) }))
        .filter(r => r.tels.length > 0);
      return {
        id: e.id,
        nome: ben.nome || '—',
        telsBen: telefonesDe(ben),
        responsaveis,
        equipamentos: (e.itens || [])
          .filter(i => i.status === 'emprestado')
          .map(i => `${i.equipamentos?.numero_patrimonio || ''} ${i.equipamentos?.tipos_equipamentos?.nome || ''}`.trim()),
        dataPrev,
        dias,
      };
    };

    const vencidos = [];
    const aVencer = [];
    emprestimos.filter(e => e.status === 'ativo' && e.data_devolucao_prevista).forEach(e => {
      const prev = new Date(e.data_devolucao_prevista + 'T00:00:00');
      const diff = Math.round((prev - hoje) / MS_DIA); // >0 = dias que faltam; <0 = atraso
      if (diff < 0) vencidos.push(montarLinha(e, prev, -diff));
      else if (diff <= DIAS_A_VENCER) aVencer.push(montarLinha(e, prev, diff));
    });
    vencidos.sort((a, b) => b.dias - a.dias);
    aVencer.sort((a, b) => a.dias - b.dias);

    setStats({
      equip_disponiveis:  equips.filter(e => e.status === 'disponivel').length,
      equip_emprestados:  equips.filter(e => e.status === 'emprestado').length,
      equip_manutencao:   equips.filter(e => e.status === 'manutencao').length,
      equip_descartados:  equips.filter(e => e.status === 'descartado').length,
      total_beneficiarios: beneficiarios.length,
      emp_ativos:          ativosNoFiltro.length,
      emp_devolvidos:      devolvidosNoFiltro.length,
      emp_total:           empFiltrados.length,
      ativos_outros_anos:  ativosOutrosAnos.length,
      vencidos,
      aVencer,
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--color-accent)' }}></div>
      </div>
    );
  }

  const s = stats || {};
  const temFiltroAno = filtroAno !== 'todos';
  const labelFiltro  = temFiltroAno ? `ano ${filtroAno}` : 'todos os anos';
  const vencidos = s.vencidos || [];
  const aVencer = s.aVencer || [];

  // ── Equipamentos: barra empilhada ──
  const totalEquip = (s.equip_disponiveis || 0) + (s.equip_emprestados || 0) + (s.equip_manutencao || 0) + (s.equip_descartados || 0);
  const segmentosEquip = [
    { label: 'Disponíveis', val: s.equip_disponiveis || 0, cor: '#10b981' },
    { label: 'Emprestados', val: s.equip_emprestados || 0, cor: '#3b82f6' },
    { label: 'Manutenção',  val: s.equip_manutencao  || 0, cor: '#f59e0b' },
    { label: 'Descartados', val: s.equip_descartados || 0, cor: '#64748b' },
  ];

  const irParaVencidos = () => document.getElementById('dash-vencidos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const tabs = [
    { key: 'dashboard',     label: 'Dashboard'    },
    { key: 'equipamentos',  label: 'Equipamentos' },
    { key: 'beneficiarios', label: 'Beneficiários' },
    { key: 'emprestimos',   label: 'Empréstimos'  },
  ];

  const cardBase = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' };
  const tituloBloco = { margin: 0, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)' };

  return (
    <div className="space-y-6" style={{ background: 'var(--color-bg)', minHeight: '100vh', padding: '0.5rem', overflowX: 'hidden' }}>

      {/* TOPO: título + abas numa faixa só */}
      <div className="card" style={{ padding: '1rem 1.25rem 0' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)' }}>♿ Controle de Comodatos</h1>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            Gestão de empréstimos de equipamentos de assistência
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.9rem', borderBottom: '1px solid var(--color-border)' }}>
          {tabs.map(tab => {
            const ativa = view === tab.key;
            return (
              <button key={tab.key} onClick={() => setView(tab.key)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: '0.6rem 1.1rem', fontSize: '0.9rem', fontWeight: ativa ? 800 : 600,
                  color: ativa ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  borderBottom: `3px solid ${ativa ? 'var(--color-accent)' : 'transparent'}`,
                  marginBottom: '-1px',
                }}>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* DASHBOARD */}
      {view === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* ── Equipamentos ── */}
          <div style={{ ...cardBase, padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <p style={tituloBloco}>Equipamentos</p>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                <strong style={{ color: 'var(--color-text)', fontSize: '1.1rem' }}>{totalEquip}</strong> no total
              </span>
            </div>
            <div style={{ display: 'flex', height: '14px', borderRadius: '999px', overflow: 'hidden', background: 'var(--color-surface-2)', margin: '0.8rem 0' }}>
              {segmentosEquip.filter(x => x.val > 0).map(x => (
                <div key={x.label} title={`${x.label}: ${x.val}`} style={{ width: `${(x.val / (totalEquip || 1)) * 100}%`, background: x.cor }} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
              {segmentosEquip.map(x => (
                <div key={x.label} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: x.cor, flexShrink: 0 }} />
                  <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>{x.val}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{x.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Empréstimos (com filtro de ano) ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
              <p style={tituloBloco}>Empréstimos — {labelFiltro}</p>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {['todos', ...anosDisponiveis].map(a => {
                  const ativo = filtroAno === a;
                  return (
                    <button key={a} onClick={() => setFiltroAno(a)}
                      style={{ padding: '0.25rem 0.8rem', borderRadius: '999px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', border: ativo ? '1px solid var(--color-accent)' : '1px solid var(--color-border)', background: ativo ? 'var(--color-accent)' : 'var(--color-surface-2)', color: ativo ? '#fff' : 'var(--color-text)' }}>
                      {a === 'todos' ? 'Todos' : a}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
              <Kpi titulo="Total" valor={s.emp_total} sub="registros efetuados" cor="#64748b" />
              <Kpi titulo="Ativos" valor={s.emp_ativos} cor="#3b82f6"
                sub={temFiltroAno && s.ativos_outros_anos > 0 ? `em andamento · +${s.ativos_outros_anos} de anos anteriores` : 'em andamento'} />
              <Kpi titulo="Devolvidos" valor={s.emp_devolvidos} sub="finalizados" cor="#10b981" />
              <Kpi titulo="Beneficiários" valor={s.total_beneficiarios} sub="cadastrados (total geral)" cor="var(--color-accent)" />
              <Kpi titulo="Vencidos" valor={vencidos.length} cor="#ef4444"
                sub={vencidos.length > 0 ? `mais antigo: ${vencidos[0].dias} dia${vencidos[0].dias === 1 ? '' : 's'} de atraso` : 'nenhum em atraso'} />
              <Kpi titulo={`A vencer em ${DIAS_A_VENCER} dias`} valor={aVencer.length} cor="#f59e0b"
                sub={aVencer.length > 0 ? 'devolução prevista próxima' : 'nenhum a vencer'} />
            </div>
          </div>

        </div>
      )}

      {view === 'equipamentos'  && <GestaoEquipamentos  showSuccess={showSuccess} showError={showError} permissoes={permissoes} />}
      {view === 'beneficiarios' && <GestaoBeneficiarios showSuccess={showSuccess} showError={showError} permissoes={permissoes} />}
      {view === 'emprestimos'   && <GestaoEmprestimos   showSuccess={showSuccess} showError={showError} permissoes={permissoes} />}
    </div>
  );
}

// ── Cartão de indicador (padrão das telas novas) ─────────────────────────────
function Kpi({ titulo, valor, sub, cor }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', borderTop: `4px solid ${cor}`, padding: '0.9rem 1.1rem' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{titulo}</div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.15, marginTop: '0.15rem' }}>{valor ?? 0}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>{sub}</div>
    </div>
  );
}

// ── Lista de empréstimos que exigem ação (com contato) ───────────────────────
function ListaAcao({ titulo, cor, linhas, rotuloPrazo }) {
  const visiveis = linhas.slice(0, MAX_LISTA);
  const restantes = linhas.length - visiveis.length;
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', borderTop: `4px solid ${cor}`, overflow: 'hidden' }}>
      <div style={{ padding: '0.75rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{titulo}</span>
        <span style={{ padding: '0.1rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 800, color: cor, background: `${cor}22`, border: `1px solid ${cor}66` }}>{linhas.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {visiveis.map(l => (
          <div key={l.id} style={{ padding: '0.6rem 1.1rem', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text)', minWidth: 0 }}>{l.nome}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: cor, whiteSpace: 'nowrap' }}>{rotuloPrazo(l)}</span>
            </div>
            {l.equipamentos.length > 0 && (
              <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>{l.equipamentos.join(' · ')}</span>
            )}
            {(l.telsBen.length > 0 || l.responsaveis.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', marginTop: '0.1rem' }}>
                {l.telsBen.length > 0 && (
                  <LinhaTel icone="📞" rotulo="Beneficiário" tels={l.telsBen} />
                )}
                {l.responsaveis.map((r, i) => (
                  <LinhaTel key={i} icone="👤" rotulo={`${r.nome}${r.parentesco ? ` (${r.parentesco})` : ''}`} tels={r.tels} />
                ))}
              </div>
            )}
          </div>
        ))}
        {restantes > 0 && (
          <div style={{ padding: '0.55rem 1.1rem', borderTop: '1px solid var(--color-border)', fontSize: '0.76rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
            + {restantes} outro{restantes === 1 ? '' : 's'} — veja todos na aba Empréstimos
          </div>
        )}
      </div>
    </div>
  );
}

function LinhaTel({ icone, rotulo, tels }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.76rem' }}>
      <span>{icone}</span>
      <span style={{ color: 'var(--color-text-muted)' }}>{rotulo}:</span>
      {tels.map(t => (
        <a key={t} href={`tel:${String(t).replace(/\D/g, '')}`}
          style={{ color: 'var(--color-text)', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          {fmtTelefone(t)}
        </a>
      ))}
    </div>
  );
}
