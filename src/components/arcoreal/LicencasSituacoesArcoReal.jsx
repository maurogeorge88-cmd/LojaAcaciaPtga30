import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { nomeCurto } from '../../utils/arcoRealMembros';

// ════════════════════════════════════════════════════════════════════════
// Licenças e Situações do Arco Real — mesma lógica da tela da Loja, sobre a
// tabela arco_real_situacoes. Aqui também é possível LANÇAR a situação
// (a Loja faz isso em outra tela).
// ════════════════════════════════════════════════════════════════════════

const pad = (n) => String(n).padStart(2, '0');
const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const diasEntre = (a, b) => {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
};
const fmtData = (d) => (d ? d.split('-').reverse().join('/') : '—');
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

const TIPOS = { licenciado: 'Licença', irregular: 'Irregular', suspenso: 'Suspenso', desligado: 'Desligado', excluido: 'Excluído', falecido: 'Falecido' };
// Tipos que aceitam data final (temporários)
const TIPOS_COM_PRAZO = ['licenciado', 'suspenso'];
const DIAS_AVISO = 10;

const GRUPOS = {
  vencida:   { label: 'Vencidas',                     sub: 'aguardando encerramento', cor: '#ef4444', ordem: 0 },
  vencendo:  { label: `Vencem em ${DIAS_AVISO} dias`, sub: 'ou menos',                cor: '#f59e0b', ordem: 1 },
  vigente:   { label: 'Vigentes',                     sub: `com prazo > ${DIAS_AVISO} dias`, cor: '#10b981', ordem: 2 },
  futura:    { label: 'Agendadas',                    sub: 'ainda não iniciaram',     cor: '#3b82f6', ordem: 3 },
  sem_prazo: { label: 'Em vigor',                     sub: 'sem data final',          cor: '#64748b', ordem: 4 },
  encerrada: { label: 'Encerradas',                   sub: '',                        cor: '#94a3b8', ordem: 5 },
  cancelada: { label: 'Canceladas',                   sub: '',                        cor: '#94a3b8', ordem: 6 },
};
const ABAS = {
  prazo:      { label: 'Com data final',   grupos: ['vencida', 'vencendo', 'vigente', 'futura'] },
  indefinido: { label: 'Prazo indefinido', grupos: ['sem_prazo', 'futura'] },
};

const classificar = (s, hoje) => {
  if (s.status === 'cancelada') return { grupo: 'cancelada', dias: null };
  if (s.status === 'vencida') return { grupo: 'encerrada', dias: null };
  if (s.data_inicio > hoje) return { grupo: 'futura', dias: diasEntre(hoje, s.data_inicio) };
  if (!s.data_fim) return { grupo: 'sem_prazo', dias: null };
  const dias = diasEntre(hoje, s.data_fim);
  if (dias < 0) return { grupo: 'vencida', dias };
  if (dias <= DIAS_AVISO) return { grupo: 'vencendo', dias };
  return { grupo: 'vigente', dias };
};

const textoPrazo = (grupo, dias) => {
  if (grupo === 'vencida') return `venceu há ${plural(-dias, 'dia', 'dias')}`;
  if (grupo === 'vencendo') return dias === 0 ? 'vence hoje' : dias === 1 ? 'vence amanhã' : `vence em ${dias} dias`;
  if (grupo === 'vigente') return `faltam ${dias} dias`;
  if (grupo === 'futura') return `inicia em ${plural(dias, 'dia', 'dias')}`;
  if (grupo === 'sem_prazo') return 'sem data final';
  return '';
};
const corDoPrazo = (grupo, dias) => (grupo === 'vencendo' ? (dias <= 3 ? '#ef4444' : '#f59e0b') : GRUPOS[grupo]?.cor || 'var(--color-text-muted)');

const tabelaAusente = (e) => /does not exist|schema cache|42P01|PGRST205/i.test(`${e?.code || ''} ${e?.message || ''}`);

export default function LicencasSituacoesArcoReal({ podeEditar = false, showSuccess, showError }) {
  const [situacoes, setSituacoes] = useState([]);
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [semTabela, setSemTabela] = useState(false);

  const [aba, setAba] = useState('prazo');
  const [grupoSel, setGrupoSel] = useState('andamento');
  const [tipoSel, setTipoSel] = useState('todos');
  const [busca, setBusca] = useState('');

  const [modalPrazo, setModalPrazo] = useState(null);
  const [modalNova, setModalNova] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const hoje = hojeLocal();
  const ok = (m) => (showSuccess ? showSuccess(m) : window.alert(m));
  const erro = (m) => (showError ? showError(m) : window.alert(m));

  const carregar = async () => {
    setLoading(true);
    try {
      const { data: mb, error: e1 } = await supabase.from('arco_real_membros').select('id, nome, situacao, ativo').order('nome');
      if (e1) throw e1;
      setMembros(mb || []);

      const { data: ss, error: e2 } = await supabase.from('arco_real_situacoes').select('*').order('id', { ascending: true });
      if (e2) {
        if (tabelaAusente(e2)) { setSemTabela(true); setSituacoes([]); return; }
        throw e2;
      }
      setSemTabela(false);
      setSituacoes(ss || []);

      // Licença que já começou e membro ainda "regular" → alinha o cadastro
      if (podeEditar) {
        const mapaM = {}; (mb || []).forEach(m => { mapaM[m.id] = m; });
        const pendentes = (ss || []).filter(s => s.status === 'ativa' && s.tipo_situacao === 'licenciado'
          && s.data_inicio <= hoje && (!s.data_fim || s.data_fim >= hoje) && mapaM[s.membro_id]?.situacao === 'regular');
        for (const s of pendentes) {
          await supabase.from('arco_real_membros').update({ situacao: 'licenciado' }).eq('id', s.membro_id);
        }
      }
    } catch (e) {
      console.error('Erro ao carregar licenças/situações:', e);
      erro('Erro ao carregar dados: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mapaMembros = useMemo(() => { const m = {}; membros.forEach(x => { m[x.id] = x; }); return m; }, [membros]);

  const registros = useMemo(() => situacoes
    .map(s => ({ ...s, membro: mapaMembros[s.membro_id], ...classificar(s, hoje) }))
    .filter(r => r.membro), [situacoes, mapaMembros, hoje]);

  const registrosAba = useMemo(() => registros.filter(r => (aba === 'prazo' ? !!r.data_fim : !r.data_fim)), [registros, aba]);

  const qtdAbas = useMemo(() => {
    const q = { prazo: 0, indefinido: 0 };
    registros.forEach(r => { const k = r.data_fim ? 'prazo' : 'indefinido'; if (ABAS[k].grupos.includes(r.grupo)) q[k] += 1; });
    return q;
  }, [registros]);

  const baseFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return registrosAba.filter(r => (tipoSel === 'todos' || r.tipo_situacao === tipoSel) && (!q || (r.membro.nome || '').toLowerCase().includes(q)));
  }, [registrosAba, tipoSel, busca]);

  const contagem = useMemo(() => {
    const c = {}; Object.keys(GRUPOS).forEach(g => { c[g] = 0; });
    baseFiltrada.forEach(r => { c[r.grupo] += 1; });
    return c;
  }, [baseFiltrada]);

  const lista = useMemo(() => {
    const vis = baseFiltrada.filter(r => (grupoSel === 'andamento' ? ABAS[aba].grupos.includes(r.grupo) : r.grupo === grupoSel));
    return vis.sort((a, b) => {
      if (grupoSel === 'encerrada' || grupoSel === 'cancelada') return String(b.data_fim || b.data_inicio).localeCompare(String(a.data_fim || a.data_inicio));
      const oa = GRUPOS[a.grupo].ordem, ob = GRUPOS[b.grupo].ordem;
      if (oa !== ob) return oa - ob;
      const fa = a.data_fim || a.data_inicio || '', fb = b.data_fim || b.data_inicio || '';
      if (fa !== fb) return fa.localeCompare(fb);
      return String(a.membro.nome).localeCompare(String(b.membro.nome), 'pt-BR');
    });
  }, [baseFiltrada, grupoSel, aba]);

  // ── Ações ───────────────────────────────────────────────────────────────
  // Depois de encerrar/cancelar: se não restou nenhuma situação em vigor e o
  // cadastro ainda está com a situação que acabou, volta para Regular.
  const reverterCadastro = async (membroId, restantes, tipoEncerrado) => {
    const emVigor = restantes.some(x => x.status === 'ativa' && x.data_inicio <= hoje && (!x.data_fim || x.data_fim >= hoje));
    if (emVigor) return;
    const { data: m } = await supabase.from('arco_real_membros').select('situacao').eq('id', membroId).maybeSingle();
    if (m && m.situacao === tipoEncerrado) {
      await supabase.from('arco_real_membros').update({ situacao: 'regular' }).eq('id', membroId).select();
    }
  };

  const atualizar = async (r, dados, msgOk) => {
    const { data, error } = await supabase.from('arco_real_situacoes').update(dados).eq('id', r.id).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Sem permissão para atualizar (RLS).');
    const restantes = situacoes.filter(x => x.membro_id === r.membro_id).map(x => (x.id === r.id ? { ...x, ...dados } : x));
    if (dados.status === 'vencida' || dados.status === 'cancelada') await reverterCadastro(r.membro_id, restantes, r.tipo_situacao);
    ok(msgOk);
    carregar();
  };

  const encerrar = async (r) => {
    const antecipado = r.data_fim && r.data_fim > hoje;
    const msg = r.grupo === 'vencida'
      ? `Encerrar a situação de ${r.membro.nome}?\nO período (até ${fmtData(r.data_fim)}) continua registrado.`
      : antecipado
        ? `Encerrar a situação de ${r.membro.nome} ANTECIPADAMENTE hoje (${fmtData(hoje)})?\nO fim previsto era ${fmtData(r.data_fim)}.`
        : `Encerrar a situação de ${r.membro.nome} hoje (${fmtData(hoje)})?\nO cadastro volta a Regular.`;
    if (!window.confirm(msg)) return;
    try {
      const dados = r.grupo === 'vencida' ? { status: 'vencida' } : { status: 'vencida', data_fim: hoje };
      await atualizar(r, dados, 'Situação encerrada!');
    } catch (e) { erro('Erro ao encerrar situação: ' + (e.message || e)); }
  };

  const cancelar = async (r) => {
    if (!window.confirm(`Cancelar este lançamento de ${r.membro.nome}? Use apenas para lançamento feito por engano.`)) return;
    try { await atualizar(r, { status: 'cancelada' }, 'Lançamento cancelado!'); }
    catch (e) { erro('Erro ao cancelar: ' + (e.message || e)); }
  };

  const salvarPrazo = async () => {
    const { sit, novaData } = modalPrazo;
    if (!novaData) { erro('Informe a nova data final.'); return; }
    if (novaData < sit.data_inicio) { erro('A data final não pode ser anterior ao início.'); return; }
    try {
      setSalvando(true);
      const { data, error } = await supabase.from('arco_real_situacoes').update({ data_fim: novaData, status: 'ativa' }).eq('id', sit.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão para atualizar (RLS).');
      ok('Prazo atualizado!');
      setModalPrazo(null);
      carregar();
    } catch (e) { erro('Erro ao alterar prazo: ' + (e.message || e)); }
    finally { setSalvando(false); }
  };

  const salvarNova = async () => {
    const f = modalNova;
    if (!f.membro_id) { erro('Selecione o membro.'); return; }
    if (!f.data_inicio) { erro('Informe a data de início.'); return; }
    if (!TIPOS_COM_PRAZO.includes(f.tipo_situacao) && f.data_fim) { erro('Somente licença e suspensão têm data final.'); return; }
    if (f.data_fim && f.data_fim < f.data_inicio) { erro('A data final não pode ser anterior ao início.'); return; }
    const membro = mapaMembros[f.membro_id];
    try {
      setSalvando(true);
      const { error } = await supabase.from('arco_real_situacoes').insert([{
        membro_id: membro.id, tipo_situacao: f.tipo_situacao, data_inicio: f.data_inicio,
        data_fim: TIPOS_COM_PRAZO.includes(f.tipo_situacao) && f.data_fim ? f.data_fim : null,
        motivo: f.motivo.trim() || null, status: 'ativa',
      }]);
      if (error) throw error;
      // situação já em vigor → atualiza o cadastro do membro
      if (f.data_inicio <= hoje && (!f.data_fim || f.data_fim >= hoje)) {
        const { error: e2 } = await supabase.from('arco_real_membros').update({ situacao: f.tipo_situacao }).eq('id', membro.id);
        if (e2) throw e2;
      }
      ok('Situação registrada!');
      setModalNova(null);
      carregar();
    } catch (e) { erro('Erro ao registrar situação: ' + (e.message || e)); }
    finally { setSalvando(false); }
  };

  const abrirNova = () => setModalNova({ membro_id: '', tipo_situacao: 'licenciado', data_inicio: hoje, data_fim: '', motivo: '' });

  // ── Estilos ─────────────────────────────────────────────────────────────
  const sCard = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem' };
  const sInput = { padding: '0.5rem 0.75rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', width: '100%' };
  const sBtn = (cor, bg, borda) => ({ padding: '0.25rem 0.65rem', fontSize: '0.8rem', background: bg, color: cor, border: `1px solid ${borda}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 });
  const sLabel = { display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.3rem' };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>;

  if (semTabela) {
    return (
      <div className="p-6" style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ ...sCard, borderLeft: '4px solid #f59e0b' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>🗓️ Licenças e Situações</h2>
          <p style={{ color: 'var(--color-text-muted)', margin: '0.6rem 0 0', fontSize: '0.9rem' }}>
            A tabela <strong>arco_real_situacoes</strong> ainda não existe no banco. Execute o arquivo <strong>arco_real_situacoes.sql</strong> no SQL Editor do Supabase e recarregue esta tela.
          </p>
        </div>
      </div>
    );
  }

  const membrosSelecionaveis = membros.filter(m => m.situacao !== 'falecido');

  return (
    <div className="p-6" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>🗓️ Licenças e Situações</h2>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
            Licenças com data final e situações de prazo indefinido (Desligado, Excluído, Falecido)
          </p>
        </div>
        {podeEditar && (
          <button type="button" onClick={abrirNova} style={{ padding: '0.55rem 1.1rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer' }}>
            ➕ Nova situação
          </button>
        )}
      </div>

      {/* Abas */}
      <div role="tablist" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
        {Object.entries(ABAS).map(([k, a]) => (
          <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => { setAba(k); setGrupoSel('andamento'); }}
            style={{ padding: '0.6rem 1.25rem', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer', background: 'transparent', marginBottom: '-1px',
              borderBottom: aba === k ? '3px solid var(--color-accent)' : '3px solid transparent', color: aba === k ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
            {a.label}
            <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '999px', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>{qtdAbas[k]}</span>
          </button>
        ))}
      </div>

      {/* Cartões-resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
        {ABAS[aba].grupos.map(g => {
          const info = GRUPOS[g]; const ativo = grupoSel === g;
          return (
            <button key={g} type="button" aria-pressed={ativo} onClick={() => setGrupoSel(ativo ? 'andamento' : g)}
              style={{ textAlign: 'left', cursor: 'pointer', padding: '0.85rem 1rem', background: ativo ? 'var(--color-accent-bg)' : 'var(--color-surface)',
                border: `1px solid ${ativo ? 'var(--color-accent)' : 'var(--color-border)'}`, borderLeft: `4px solid ${info.cor}`, borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: contagem[g] > 0 && (g === 'vencida' || g === 'vencendo') ? info.cor : 'var(--color-text)', lineHeight: 1.1 }}>{contagem[g]}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)', marginTop: '0.25rem' }}>{info.label}</div>
              {info.sub && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{info.sub}</div>}
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <input type="text" placeholder="🔍 Buscar membro..." value={busca} onChange={e => setBusca(e.target.value)} style={{ ...sInput, flex: '1 1 200px', width: 'auto', minWidth: 0 }} />
        <select value={tipoSel} onChange={e => setTipoSel(e.target.value)} style={{ ...sInput, width: 'auto' }} aria-label="Tipo de situação">
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {[
            { id: 'andamento', label: 'Em andamento' },
            { id: 'encerrada', label: `Encerradas (${contagem.encerrada})` },
            { id: 'cancelada', label: `Canceladas (${contagem.cancelada})` },
          ].filter(b => !(aba === 'indefinido' && b.id === 'encerrada')).map(b => (
            <button key={b.id} type="button" aria-pressed={grupoSel === b.id} onClick={() => setGrupoSel(b.id)}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius-md)',
                background: grupoSel === b.id ? 'var(--color-accent)' : 'var(--color-surface-2)', color: grupoSel === b.id ? '#fff' : 'var(--color-text)',
                border: `1px solid ${grupoSel === b.id ? 'var(--color-accent)' : 'var(--color-border)'}` }}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Nenhum registro para os filtros selecionados.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {lista.map(r => {
            const info = GRUPOS[r.grupo]; const corPrazo = corDoPrazo(r.grupo, r.dias);
            const cadastroLicenciado = r.membro.situacao === 'licenciado';
            const emAndamento = ['vencida', 'vencendo', 'vigente', 'sem_prazo', 'futura'].includes(r.grupo);
            const podeAlterarPrazo = podeEditar && TIPOS_COM_PRAZO.includes(r.tipo_situacao) && ['vencida', 'vencendo', 'vigente', 'futura'].includes(r.grupo);
            const podeEncerrar = podeEditar && r.tipo_situacao !== 'falecido' && ['vencida', 'vencendo', 'vigente', 'sem_prazo'].includes(r.grupo);
            const podeCancelar = podeEditar && emAndamento;
            return (
              <div key={r.id} style={{ ...sCard, borderLeft: `4px solid ${info.cor}`, opacity: r.grupo === 'cancelada' ? 0.65 : 1, display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>{nomeCurto(r.membro.nome)}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '999px', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>{TIPOS[r.tipo_situacao] || r.tipo_situacao}</span>
                    {textoPrazo(r.grupo, r.dias) && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: corPrazo }}>● {textoPrazo(r.grupo, r.dias)}</span>}
                    {r.grupo === 'encerrada' && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>encerrada</span>}
                    {r.grupo === 'cancelada' && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>cancelada</span>}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--color-text)', lineHeight: 1.6 }}>
                    <div><strong>Período:</strong> {fmtData(r.data_inicio)}{r.data_fim ? ` → ${fmtData(r.data_fim)}` : ' → sem data final'}</div>
                    {r.motivo && <div><strong>Motivo:</strong> {r.motivo}</div>}
                    {r.grupo === 'vencida' && r.tipo_situacao === 'licenciado' && cadastroLicenciado && (
                      <div style={{ color: '#ef4444', fontWeight: 600 }}>⚠️ O cadastro do membro ainda consta como Licenciado — encerre para regularizar.</div>
                    )}
                  </div>
                </div>
                {(podeAlterarPrazo || podeEncerrar || podeCancelar) && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {podeAlterarPrazo && (
                      <button type="button" onClick={() => setModalPrazo({ sit: r, novaData: r.data_fim || '' })} style={sBtn('var(--color-accent)', 'var(--color-accent-bg)', 'var(--color-accent)')}>Alterar prazo</button>
                    )}
                    {podeEncerrar && (
                      <button type="button" onClick={() => encerrar(r)} style={sBtn('#f59e0b', 'rgba(245,158,11,0.15)', 'rgba(245,158,11,0.3)')}>Encerrar</button>
                    )}
                    {podeCancelar && (
                      <button type="button" onClick={() => cancelar(r)} title="Lançamento feito por engano" style={sBtn('#ef4444', 'rgba(239,68,68,0.12)', 'rgba(239,68,68,0.3)')}>Cancelar</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: alterar prazo */}
      {modalPrazo && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', zIndex: 9000 }} role="dialog" aria-modal="true">
          <div className="rounded-lg w-full max-w-md" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div style={{ background: 'var(--color-accent)', padding: '1rem 1.5rem' }}><h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', margin: 0 }}>Alterar prazo</h3></div>
            <div className="p-6" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text)' }}><strong>{modalPrazo.sit.membro.nome}</strong> — início em {fmtData(modalPrazo.sit.data_inicio)}</p>
              <div><label style={sLabel}>Nova data final</label><input type="date" value={modalPrazo.novaData} onChange={e => setModalPrazo({ ...modalPrazo, novaData: e.target.value })} style={sInput} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" onClick={() => setModalPrazo(null)} disabled={salvando} style={{ ...sBtn('var(--color-text)', 'var(--color-surface-2)', 'var(--color-border)'), padding: '0.5rem 1rem' }}>Cancelar</button>
                <button type="button" onClick={salvarPrazo} disabled={salvando} style={{ ...sBtn('#fff', 'var(--color-accent)', 'var(--color-accent)'), padding: '0.5rem 1rem' }}>{salvando ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: nova situação */}
      {modalNova && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', zIndex: 9000 }} role="dialog" aria-modal="true">
          <div className="rounded-lg w-full max-w-lg" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ background: 'var(--color-accent)', padding: '1rem 1.5rem' }}><h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', margin: 0 }}>➕ Nova situação</h3></div>
            <div className="p-6" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={sLabel}>Membro *</label>
                <select value={modalNova.membro_id} onChange={e => setModalNova({ ...modalNova, membro_id: e.target.value })} style={sInput}>
                  <option value="">Selecione...</option>
                  {membrosSelecionaveis.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={sLabel}>Tipo *</label>
                <select value={modalNova.tipo_situacao} onChange={e => setModalNova({ ...modalNova, tipo_situacao: e.target.value, data_fim: TIPOS_COM_PRAZO.includes(e.target.value) ? modalNova.data_fim : '' })} style={sInput}>
                  {Object.entries(TIPOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label style={sLabel}>Início *</label><input type="date" value={modalNova.data_inicio} onChange={e => setModalNova({ ...modalNova, data_inicio: e.target.value })} style={sInput} /></div>
                <div>
                  <label style={sLabel}>Data final {TIPOS_COM_PRAZO.includes(modalNova.tipo_situacao) ? '(opcional)' : ''}</label>
                  <input type="date" value={modalNova.data_fim} disabled={!TIPOS_COM_PRAZO.includes(modalNova.tipo_situacao)} onChange={e => setModalNova({ ...modalNova, data_fim: e.target.value })} style={{ ...sInput, opacity: !TIPOS_COM_PRAZO.includes(modalNova.tipo_situacao) ? 0.5 : 1 }} />
                </div>
              </div>
              <div><label style={sLabel}>Motivo</label><textarea rows={3} value={modalNova.motivo} onChange={e => setModalNova({ ...modalNova, motivo: e.target.value })} style={{ ...sInput, resize: 'vertical' }} /></div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Se a situação já estiver em vigor, o cadastro do membro é atualizado automaticamente. As datas da licença não contam na presença 100%.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" onClick={() => setModalNova(null)} disabled={salvando} style={{ ...sBtn('var(--color-text)', 'var(--color-surface-2)', 'var(--color-border)'), padding: '0.5rem 1rem' }}>Cancelar</button>
                <button type="button" onClick={salvarNova} disabled={salvando} style={{ ...sBtn('#fff', 'var(--color-accent)', 'var(--color-accent)'), padding: '0.5rem 1rem' }}>{salvando ? 'Salvando...' : 'Registrar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
