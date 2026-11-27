/**
 * COMPONENTE CORPO ADMINISTRATIVO
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { CARGOS_ADMINISTRATIVOS } from '../../utils/constants';
import { gerarPainelCargosPDF } from '../../utils/gerarPainelCargosPDF';
import { gerarGestoesPDF } from '../../utils/gerarGestoesPDF';
import { normalizarCargo, CARGOS_PRINCIPAIS, ORDEM_HIERARQUICA, ordenarCargos, calcularResumoCargos, montarGestoes } from './cargosAdmin';

const STATUS_ELEICAO = {
  rascunho:            { label: 'Em Processo de Eleição', emoji: '📝', cor: '#f59e0b' },
  eleicao_realizada:   { label: 'Eleita — Aguardando Posse', emoji: '✅', cor: '#3b82f6' },
  posse_realizada:     { label: 'Empossada', emoji: '🎖️', cor: '#10b981' },
  registrado_cartorio: { label: 'Registrada em Cartório', emoji: '🏛️', cor: '#d97706' },
};

const formatarData = (d) => {
  if (!d) return '';
  const [ano, mes, dia] = d.split('-');
  return `${dia}/${mes}/${ano}`;
};

// Ordem hierárquica maçônica — mesma lista oficial usada no cadastro (CARGOS_ADMINISTRATIVOS),
// garantindo que a ordem de exibição sempre bata com os valores realmente salvos no banco.
const ORDEM_CARGOS_ADM = CARGOS_ADMINISTRATIVOS;

const COLUNAS = [
  { key: 'veneravel mestre',   label: 'Venerável Mestre', curto: 'VM' },
  { key: 'primeiro vigilante', label: '1º Vigilante',     curto: '1º Vig' },
  { key: 'segundo vigilante',  label: '2º Vigilante',     curto: '2º Vig' },
  { key: 'orador',             label: 'Orador',           curto: 'Orador' },
  { key: 'secretario',         label: 'Secretário',       curto: 'Secret.' },
  { key: 'tesoureiro',         label: 'Tesoureiro',       curto: 'Tesour.' },
  { key: 'chanceler',          label: 'Chanceler',        curto: 'Chanc.' },
];

const GOLD = '217,119,6';

export const PainelCorpoAdmin = ({ corpoAdmin = [], irmaos = [] }) => {
  const [busca, setBusca] = useState('');
  const [soVM, setSoVM] = useState(false);
  const [ordem, setOrdem] = useState({ key: 'total', dir: 'desc' });
  const [detalhe, setDetalhe] = useState(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const baixarImagemDataUrl = async (url) => {
    const r = await fetch(url);
    const blob = await r.blob();
    return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
  };

  const gerarPdf = async () => {
    setGerandoPdf(true);
    try {
      const { data: loja } = await supabase.from('dados_loja').select('*').limit(1).maybeSingle();
      let logo = null;
      if (loja?.logo_url) { try { logo = await baixarImagemDataUrl(loja.logo_url); } catch (e) { /* sem logo */ } }
      const filtros = [busca.trim() && `Busca: "${busca.trim()}"`, soVM && 'Somente quem já foi VM'].filter(Boolean).join(' • ');
      gerarPainelCargosPDF({ linhas, resumo: dados, dadosLoja: loja || {}, logo, filtro: filtros });
    } catch (e) {
      alert('Erro ao gerar o PDF: ' + e.message);
    } finally {
      setGerandoPdf(false);
    }
  };

  const dados = useMemo(() => calcularResumoCargos(corpoAdmin, irmaos), [corpoAdmin, irmaos]);

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let l = dados.lista.filter(r => (!q || r.nome.toLowerCase().includes(q)) && (!soVM || r.cargos['veneravel mestre']));
    const { key, dir } = ordem;
    l = [...l].sort((a, b) => {
      const va = key === 'nome' ? a.nome : key === 'total' ? a.total : (a.cargos[key] || 0);
      const vb = key === 'nome' ? b.nome : key === 'total' ? b.total : (b.cargos[key] || 0);
      const c = key === 'nome' ? va.localeCompare(vb) : va - vb;
      return (dir === 'asc' ? c : -c) || b.total - a.total || a.nome.localeCompare(b.nome);
    });
    return l;
  }, [dados, busca, soVM, ordem]);

  const ordenar = (key) => setOrdem(o => o.key === key ? { key, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'nome' ? 'asc' : 'desc' });
  const seta = (key) => ordem.key === key ? (ordem.dir === 'asc' ? ' ▲' : ' ▼') : '';

  const kpi = (icone, valor, rotulo, sub) => (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `rgba(${GOLD},0.14)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>{icone}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1, wordBreak: 'break-word' }}>{valor}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{rotulo}</div>
        {sub && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{sub}</div>}
      </div>
    </div>
  );

  const th = { padding: '0.6rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none', textAlign: 'center', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border)' };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {kpi('📜', dados.totalGestoes, 'Gestões registradas', dados.anoAtual ? `até ${dados.anoAtual}` : null)}
        {kpi('👑', dados.jaForamVM, 'Irmãos que já foram VM', 'cada irmão conta 1 vez')}
        {kpi('👥', dados.jaForamOficiais, 'Irmãos que já ocuparam 1º Vig. a Chanceler', 'cada irmão conta 1 vez')}
        {kpi('🎖️', dados.vmAtual ? `Ir∴ ${dados.vmAtual}` : '—', 'Veneralato mais recente', dados.anoAtual)}
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '0.85rem 1rem', background: 'var(--color-accent)', color: '#fff', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, flex: 1, minWidth: 200 }}>📊 Irmão × Cargo — quantas vezes</h3>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar irmão..."
            style={{ padding: '0.4rem 0.7rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.85rem', outline: 'none' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={soVM} onChange={e => setSoVM(e.target.checked)} /> Só quem já foi VM
          </label>
          <button onClick={gerarPdf} disabled={gerandoPdf || linhas.length === 0}
            style={{ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', opacity: gerandoPdf ? 0.6 : 1 }}>
            {gerandoPdf ? 'Gerando...' : '📄 PDF'}
          </button>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '70vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', paddingLeft: '1rem' }} onClick={() => ordenar('nome')}>Irmão{seta('nome')}</th>
                {COLUNAS.map(c => (
                  <th key={c.key} style={th} title={c.label} onClick={() => ordenar(c.key)}>{c.curto}{seta(c.key)}</th>
                ))}
                <th style={th} onClick={() => ordenar('total')}>Total{seta('total')}</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.5rem 1rem', minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      {r.foto
                        ? <img src={r.foto} alt={r.nome} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-border)', flexShrink: 0 }} />
                        : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>👤</div>}
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>{r.nome}</span>
                    </div>
                  </td>
                  {COLUNAS.map(c => {
                    const n = r.cargos[c.key] || 0;
                    const alpha = n ? Math.min(0.9, 0.18 + 0.72 * (n / dados.max)) : 0;
                    return (
                      <td key={c.key} style={{ padding: '0.3rem', textAlign: 'center' }}>
                        {n ? (
                          <button onClick={() => setDetalhe({ nome: r.nome, cargo: c.label, anos: [...r.anos[c.key]].sort() })}
                            title="Ver anos"
                            style={{ width: 38, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', background: `rgba(${GOLD},${alpha})`, color: alpha > 0.55 ? '#fff' : 'var(--color-text)' }}>{n}</button>
                        ) : <span style={{ color: 'var(--color-text-muted)', opacity: 0.4 }}>·</span>}
                      </td>
                    );
                  })}
                  <td style={{ padding: '0.3rem', textAlign: 'center', fontWeight: 800, color: 'var(--color-accent)', fontSize: '0.95rem' }}>{r.total}</td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr><td colSpan={COLUNAS.length + 2} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhum irmão encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detalhe && (
        <div onClick={() => setDetalhe(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', maxWidth: 360, width: '100%', border: '1px solid var(--color-border)' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text)' }}>Ir∴ {detalhe.nome}</h4>
            <p style={{ margin: '0.15rem 0 0.75rem', fontSize: '0.82rem', color: 'var(--color-accent)', fontWeight: 700 }}>{detalhe.cargo} — {detalhe.anos.length}x</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {detalhe.anos.map((a, i) => (
                <span key={i} style={{ padding: '0.25rem 0.65rem', borderRadius: 999, background: `rgba(${GOLD},0.16)`, color: 'var(--color-text)', fontWeight: 700, fontSize: '0.85rem' }}>{a}</span>
              ))}
            </div>
            <button onClick={() => setDetalhe(null)} style={{ marginTop: '1rem', width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontWeight: 600, cursor: 'pointer' }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export const CorpoAdmin = ({ 
  corpoAdmin, 
  irmaos, 
  permissoes, 
  onUpdate,
  showSuccess,
  showError 
}) => {
  const [eleicaoAtiva, setEleicaoAtiva] = React.useState(null);
  const [chapasEleicao, setChapasEleicao] = React.useState([]);

  React.useEffect(() => {
    carregarEleicaoAtiva();
  }, []);

  const carregarEleicaoAtiva = async () => {
    try {
      const { data } = await supabase
        .from('eleicoes')
        .select('*')
        .in('status', ['rascunho','eleicao_realizada','posse_realizada','registrado_cartorio'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setEleicaoAtiva(data);
        const { data: chapas } = await supabase
          .from('eleicao_chapas')
          .select('*')
          .eq('eleicao_id', data.id)
          .eq('eleita', true)
          .order('ordem');
        setChapasEleicao(chapas || []);
      }
    } catch (e) {
      console.error('Erro ao carregar eleição ativa:', e);
    }
  };
  const [corpoAdminForm, setCorpoAdminForm] = useState({
    irmao_id: '',
    cargo: '',
    ano_exercicio: new Date().getFullYear().toString()
  });
  
  const [modoEdicaoCorpoAdmin, setModoEdicaoCorpoAdmin] = useState(false);
  const [corpoAdminEditando, setCorpoAdminEditando] = useState(null);
  const [anoFiltroAdmin, setAnoFiltroAdmin] = useState('');
  const [loading, setLoading] = useState(false);

  const cargosAdministrativos = CARGOS_ADMINISTRATIVOS;
  const podeEditarCorpo = !!permissoes?.pode_editar_corpo_admin;

  // ── Modal: cadastrar/editar todos os cargos de um ano de uma vez ──
  const [modalCorpo, setModalCorpo] = useState(false);
  const [anoModal, setAnoModal] = useState(new Date().getFullYear().toString());
  const [cargosModal, setCargosModal] = useState({}); // { cargo: irmao_id }
  const [salvandoModal, setSalvandoModal] = useState(false);
  const irmaosAtivosOrdenados = (irmaos || []).filter(i => i.status === 'ativo').sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  const carregarAnoNoModal = (ano) => {
    const mapa = {};
    corpoAdmin.filter(ca => String(ca.ano_exercicio) === String(ano)).forEach(ca => { mapa[ca.cargo] = String(ca.irmao_id ?? ''); });
    setCargosModal(mapa);
  };
  const abrirModalCorpo = (ano = new Date().getFullYear().toString()) => {
    setAnoModal(String(ano));
    carregarAnoNoModal(ano);
    setModalCorpo(true);
  };
  const copiarAnoAnterior = () => {
    const anos = [...new Set(corpoAdmin.map(ca => String(ca.ano_exercicio)))].filter(a => a < String(anoModal)).sort().reverse();
    if (!anos.length) { showError('Não há ano anterior cadastrado para copiar.'); return; }
    carregarAnoNoModal(anos[0]);
    showSuccess(`Cargos copiados de ${anos[0]} — revise e salve.`);
  };
  const salvarModalCorpo = async () => {
    if (!anoModal) { showError('Informe o ano de exercício.'); return; }
    setSalvandoModal(true);
    try {
      const existentes = corpoAdmin.filter(ca => String(ca.ano_exercicio) === String(anoModal));
      const inserir = [], atualizar = [], excluir = [];
      cargosAdministrativos.forEach(cargo => {
        const val = cargosModal[cargo] || '';
        const ex = existentes.find(ca => ca.cargo === cargo);
        if (val && !ex) inserir.push({ cargo, irmao_id: val, ano_exercicio: String(anoModal) });
        else if (val && ex && String(ex.irmao_id) !== String(val)) atualizar.push({ id: ex.id, irmao_id: val });
        else if (!val && ex) excluir.push(ex.id);
      });
      if (inserir.length) {
        const { error } = await supabase.from('corpo_administrativo').insert(inserir);
        if (error) throw error;
      }
      for (const u of atualizar) {
        const { data, error } = await supabase.from('corpo_administrativo').update({ irmao_id: u.irmao_id }).eq('id', u.id).select();
        if (error) throw error;
        if (!data?.length) throw new Error('o banco não permitiu a alteração (sem permissão).');
      }
      if (excluir.length) {
        const { data, error } = await supabase.from('corpo_administrativo').delete().in('id', excluir).select();
        if (error) throw error;
        if ((data || []).length < excluir.length) throw new Error('o banco não permitiu remover todos os cargos (sem permissão).');
      }
      showSuccess(`✅ Corpo Administrativo ${anoModal} salvo (${inserir.length} novo(s), ${atualizar.length} alterado(s), ${excluir.length} removido(s)).`);
      setModalCorpo(false);
      onUpdate();
    } catch (err) {
      showError('Erro ao salvar: ' + err.message);
    } finally {
      setSalvandoModal(false);
    }
  };

  // Faixas por ano recolhidas; clique expande
  const [anosAbertos, setAnosAbertos] = useState({});
  const alternarAno = (ano) => setAnosAbertos(a => ({ ...a, [ano]: !a[ano] }));
  const [extrasAbertos, setExtrasAbertos] = useState({});
  const alternarExtras = (ano) => setExtrasAbertos(a => ({ ...a, [ano]: !a[ano] }));
  const [abaAdmin, setAbaAdmin] = useState('gestoes');
  const [periodoGestoes, setPeriodoGestoes] = useState('todas');
  const [gerandoPdfGestoes, setGerandoPdfGestoes] = useState(false);

  // anos exibidos: filtro por ano (busca) + período (atual / 5 / 10 / todas)
  const anosGestoes = useMemo(() => {
    const todos = [...new Set(corpoAdmin
      .filter(ca => !anoFiltroAdmin || ca.ano_exercicio?.includes(anoFiltroAdmin))
      .map(ca => ca.ano_exercicio))].sort((a, b) => b - a);
    const n = periodoGestoes === 'atual' ? 1 : periodoGestoes === '5' ? 5 : periodoGestoes === '10' ? 10 : todos.length;
    return todos.slice(0, n);
  }, [corpoAdmin, anoFiltroAdmin, periodoGestoes]);
  const anoAtualGestao = useMemo(() => corpoAdmin.reduce((m, ca) => (ca.ano_exercicio && ca.ano_exercicio > m ? ca.ano_exercicio : m), ''), [corpoAdmin]);
  const gestoesTela = useMemo(() => montarGestoes(corpoAdmin, irmaos || [], anosGestoes), [corpoAdmin, irmaos, anosGestoes]);
  const rotuloPeriodo = { atual: 'Gestão atual', '5': '5 últimas gestões', '10': '10 últimas gestões', todas: 'Todas as gestões' }[periodoGestoes];

  const gerarPdfGestoes = async () => {
    setGerandoPdfGestoes(true);
    try {
      const { data: loja } = await supabase.from('dados_loja').select('*').limit(1).maybeSingle();
      let logo = null;
      if (loja?.logo_url) {
        try {
          const r = await fetch(loja.logo_url); const blob = await r.blob();
          logo = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
        } catch (e) { /* sem logo */ }
      }
      const filtro = [rotuloPeriodo, anoFiltroAdmin && `Ano: ${anoFiltroAdmin}`].filter(Boolean).join(' • ');
      gerarGestoesPDF({ gestoes: gestoesTela, dadosLoja: loja || {}, logo, filtro });
    } catch (e) {
      alert('Erro ao gerar o PDF: ' + e.message);
    } finally {
      setGerandoPdfGestoes(false);
    }
  };

  const limparFormularioCorpoAdmin = () => {
    setCorpoAdminForm({
      irmao_id: '',
      cargo: '',
      ano_exercicio: new Date().getFullYear().toString()
    });
    setModoEdicaoCorpoAdmin(false);
    setCorpoAdminEditando(null);
  };

  const handleSubmitCorpoAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('corpo_administrativo')
        .insert([corpoAdminForm]);

      if (error) throw error;

      showSuccess('✅ Cargo administrativo registrado com sucesso!');
      limparFormularioCorpoAdmin();
      onUpdate();
    } catch (err) {
      showError('Erro ao registrar cargo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarCorpoAdmin = (item) => {
    setCorpoAdminForm({
      irmao_id: item.irmao_id,
      cargo: item.cargo,
      ano_exercicio: item.ano_exercicio
    });
    setModoEdicaoCorpoAdmin(true);
    setCorpoAdminEditando(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAtualizarCorpoAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('corpo_administrativo')
        .update(corpoAdminForm)
        .eq('id', corpoAdminEditando.id);

      if (error) throw error;

      showSuccess('✅ Cargo administrativo atualizado com sucesso!');
      limparFormularioCorpoAdmin();
      onUpdate();
    } catch (err) {
      showError('Erro ao atualizar cargo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirCorpoAdmin = async (id) => {
    if (!confirm('Tem certeza que deseja remover este cargo?')) return;

    try {
      const { error } = await supabase
        .from('corpo_administrativo')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('✅ Cargo administrativo removido com sucesso!');
      onUpdate();
    } catch (err) {
      showError('Erro ao remover cargo: ' + err.message);
    }
  };

  return (
    <div style={{ 
      padding: '2rem', 
      background: 'var(--color-bg)', 
      minHeight: '100vh' 
    }}>

      {/* ── BANNER: DIRETORIA ELEITA / EM PROCESSO ── */}
      {eleicaoAtiva && (
        <div style={{
          marginBottom: '1.5rem',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          {/* Cabeçalho do banner */}
          <div style={{
            padding: '1rem 1.5rem',
            background: 'var(--color-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <span style={{ fontWeight: '700', fontSize: '1rem', color: 'white' }}>
                {STATUS_ELEICAO[eleicaoAtiva.status]?.emoji} Gestão {eleicaoAtiva.gestao}
              </span>
              {eleicaoAtiva.data_posse && (
                <span style={{ marginLeft: '1rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>
                  Posse: {formatarData(eleicaoAtiva.data_posse)}
                </span>
              )}
            </div>
            <span style={{
              background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '0.75rem',
              fontWeight: '700', padding: '0.25rem 0.75rem', borderRadius: '999px',
            }}>
              {STATUS_ELEICAO[eleicaoAtiva.status]?.label}
            </span>
          </div>

          {/* Grade de cargos eleitos */}
          {chapasEleicao.length > 0 && (
            <div style={{ padding: '1rem 1.5rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '0.5rem',
              }}>
                {chapasEleicao
                  .sort((a, b) => {
                    const indexA = ORDEM_CARGOS_ADM.indexOf(a.cargo);
                    const indexB = ORDEM_CARGOS_ADM.indexOf(b.cargo);
                    if (indexA === -1 && indexB === -1) return (a.cargo || '').localeCompare(b.cargo || '');
                    if (indexA === -1) return 1;  // cargo não reconhecido vai para o fim
                    if (indexB === -1) return -1;
                    return indexA - indexB;
                  })
                  .map(c => {
                    const irmao = irmaos?.find(i => i.id === c.irmao_id);
                    return (
                      <div key={c.id} style={{
                        display: 'flex', gap: '0.6rem', alignItems: 'center',
                        padding: '0.4rem 0.75rem',
                        background: 'var(--color-surface-2)',
                        borderRadius: 'var(--radius-md)',
                      }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-accent)', minWidth: '140px' }}>
                          {c.cargo}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>
                          {irmao?.nome || '—'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CADASTRO EM LOTE (modal) */}
      {podeEditarCorpo && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button onClick={() => abrirModalCorpo()}
            style={{ padding: '0.6rem 1.2rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer' }}>
            ➕ Cadastrar / Editar Corpo Administrativo
          </button>
        </div>
      )}

      {modalCorpo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setModalCorpo(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '900px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, flex: 1, fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>👔 Corpo Administrativo</h3>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Ano de exercício</label>
              <input className="form-input" style={{ width: '110px' }} value={anoModal}
                onChange={e => { setAnoModal(e.target.value); if (/^\d{4}$/.test(e.target.value)) carregarAnoNoModal(e.target.value); }} />
              <button type="button" onClick={copiarAnoAnterior}
                style={{ padding: '0.45rem 0.85rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                ↺ Copiar do ano anterior
              </button>
            </div>
            <div style={{ padding: '1rem 1.25rem', overflowY: 'auto' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                {cargosAdministrativos.map(cargo => {
                  const repetido = cargosModal[cargo] && Object.entries(cargosModal).some(([c, v]) => c !== cargo && v && v === cargosModal[cargo]);
                  return (
                    <div key={cargo} style={{ display: 'grid', gridTemplateColumns: '170px minmax(0,1fr)', gap: '0.5rem', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: repetido ? '#ef4444' : 'var(--color-text-muted)' }}>{cargo}</label>
                      <select className="form-input" value={cargosModal[cargo] || ''}
                        onChange={e => setCargosModal(m => ({ ...m, [cargo]: e.target.value }))}
                        style={repetido ? { border: '2px solid #ef4444' } : undefined}>
                        <option value="">— vago —</option>
                        {irmaosAtivosOrdenados.map(i => <option key={i.id} value={String(i.id)}>{i.nome}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '0.75rem 0 0' }}>
                Campo "— vago —" remove o cargo do ano. Em vermelho: irmão escolhido em mais de um cargo.
              </p>
            </div>
            <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setModalCorpo(false)}
                style={{ padding: '0.6rem 1.2rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarModalCorpo} disabled={salvandoModal}
                style={{ padding: '0.6rem 1.2rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer', opacity: salvandoModal ? 0.6 : 1 }}>
                {salvandoModal ? 'Salvando...' : '💾 Salvar todos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FILTRO POR ANO */}
      <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <div className="flex gap-4 items-center">
          <label style={{ fontWeight: '600', color: 'var(--color-text)' }}>Filtrar por Ano:</label>
          <input
            type="text"
            placeholder="Digite o ano (ex: 2024)"
            value={anoFiltroAdmin}
            onChange={(e) => setAnoFiltroAdmin(e.target.value)}
            className="form-input"
            style={{ flex: 1 }}
            pattern="[0-9]*"
          />
          {anoFiltroAdmin && (
            <button
              onClick={() => setAnoFiltroAdmin('')}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--color-surface-2)',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontWeight: '600',
                color: 'var(--color-text)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--color-surface-3)'}
              onMouseLeave={(e) => e.target.style.background = 'var(--color-surface-2)'}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* ABAS */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {[['gestoes', '📋 Gestões'], ['painel', '📊 Painel']].map(([k, l]) => (
          <button key={k} onClick={() => setAbaAdmin(k)}
            style={{ padding: '0.5rem 1.1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-accent)', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
              background: abaAdmin === k ? 'var(--color-accent)' : 'var(--color-surface)', color: abaAdmin === k ? '#fff' : 'var(--color-accent)' }}>{l}</button>
        ))}
      </div>

      {abaAdmin === 'painel' && <PainelCorpoAdmin corpoAdmin={corpoAdmin} irmaos={irmaos} />}

      {/* GESTÕES EM QUADROS */}
      {abaAdmin === 'gestoes' && (
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          {[['atual', 'Gestão atual'], ['5', '5 últimas'], ['10', '10 últimas'], ['todas', 'Todas']].map(([k, l]) => (
            <button key={k} onClick={() => setPeriodoGestoes(k)}
              style={{ padding: '0.35rem 0.85rem', borderRadius: 999, border: '1px solid var(--color-border)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                background: periodoGestoes === k ? 'var(--color-accent)' : 'var(--color-surface)', color: periodoGestoes === k ? '#fff' : 'var(--color-text)' }}>{l}</button>
          ))}
          <button onClick={gerarPdfGestoes} disabled={gerandoPdfGestoes || gestoesTela.length === 0}
            style={{ marginLeft: 'auto', padding: '0.35rem 0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-accent)', background: 'var(--color-surface)', color: 'var(--color-accent)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', opacity: gerandoPdfGestoes ? 0.6 : 1 }}>
            {gerandoPdfGestoes ? 'Gerando...' : '📄 PDF das gestões'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '0.9rem' }}>
          {gestoesTela.map(g => (
            <div key={g.ano} style={{ background: 'var(--color-surface)', border: g.ano === anoAtualGestao ? '2px solid #d4a017' : '1px solid var(--color-border)', borderTop: g.ano === anoAtualGestao ? '3px solid #d4a017' : '3px solid var(--color-accent)', boxShadow: g.ano === anoAtualGestao ? '0 0 0 1px rgba(212,160,23,0.25), 0 2px 10px rgba(212,160,23,0.15)' : 'none', borderRadius: 'var(--radius-lg)', padding: '0.7rem 0.9rem 0.8rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#f59e0b' }}>Gestão {g.ano}</h3>
                {podeEditarCorpo && (
                  <button onClick={() => abrirModalCorpo(g.ano)} title="Editar gestão"
                    style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)', padding: '0.2rem 0.45rem', cursor: 'pointer', fontSize: '0.75rem', lineHeight: 1 }}>✏️</button>
                )}
              </div>
              {g.principais.map((p, i) => (
                <div key={p.chave} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', padding: '0.28rem 0', borderTop: i ? '1px solid var(--color-border)' : 'none' }}>
                  <span style={{ width: 98, flexShrink: 0, fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--color-text-muted)' }}>{p.label}</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: p.nomes.length ? 'var(--color-text)' : 'var(--color-text-muted)', lineHeight: 1.25, wordBreak: 'break-word' }}>{p.nomes.length ? p.nomes.join(' / ') : '—'}</span>
                </div>
              ))}
              {g.demais.length > 0 && (
                <>
                  <button onClick={() => alternarExtras(g.ano)}
                    style={{ marginTop: '0.5rem', padding: '0.3rem', background: 'var(--color-surface-2)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-accent)', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                    {extrasAbertos[g.ano] ? '▴ Recolher demais cargos' : `▾ Ver mais ${g.demais.length} cargo${g.demais.length > 1 ? 's' : ''}`}
                  </button>
                  {extrasAbertos[g.ano] && g.demais.map((d, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', padding: '0.25rem 0', borderTop: '1px solid var(--color-border)' }}>
                      <span style={{ width: 98, flexShrink: 0, fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{d.cargo}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text)', lineHeight: 1.25 }}>{d.nome}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          ))}
        </div>

        {gestoesTela.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            {anoFiltroAdmin ? `Nenhum registro encontrado para o ano "${anoFiltroAdmin}"` : 'Nenhum cargo administrativo registrado'}
          </div>
        )}
      </div>
      )}
    </div>
  );
};
