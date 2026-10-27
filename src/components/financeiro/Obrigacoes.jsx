import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import {
  PERIODICIDADES, podeGerirObrigacoes, proximosVencimentos,
  darBaixa, desfazerBaixa, dataBR,
} from './utils/obrigacoes';

// ════════════════════════════════════════════════════════════════════════
// OBRIGAÇÕES — lembretes de contas recorrentes (água, energia, IPTU…).
// Nada aqui entra no financeiro: é só aviso. A baixa por período fica
// gravada nesta tela e a obrigação volta sozinha no período seguinte.
// ════════════════════════════════════════════════════════════════════════

const VAZIO = { nome: '', periodicidade: 'mensal', dia_vencimento: 10, mes_referencia: 1, dias_aviso: 5, responsavel_id: '', observacoes: '', ativa: true };
const lab = { fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' };
const inp = { width: '100%', padding: '0.55rem 0.8rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' };
// Mesma regra de nome curto usada nas outras telas: dois nomes, três quando houver preposição
const PREPOSICOES = ['de', 'da', 'do', 'das', 'dos', 'e'];
const nomeCurto = (nome) => {
  const p = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (p.length <= 2) return p.join(' ');
  if (PREPOSICOES.includes(p[1].toLowerCase())) return p.slice(0, 3).join(' ');
  return p.slice(0, 2).join(' ');
};

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function Obrigacoes({ userData, showSuccess, showError }) {
  const [obrigacoes, setObrigacoes] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [baixas, setBaixas] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [editando, setEditando] = useState(null);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aba, setAba] = useState('pendentes');     // pendentes | historico | configurar
  const [irmaos, setIrmaos] = useState([]);
  const [filtroResp, setFiltroResp] = useState('');

  const podeGerir = podeGerirObrigacoes(userData);

  const carregar = async () => {
    try {
      const [{ data: obr }, { data: bx }, av] = await Promise.all([
        supabase.from('obrigacoes').select('*').order('nome'),
        supabase.from('obrigacoes_baixas').select('*').order('resolvida_em', { ascending: false }).limit(60),
        proximosVencimentos(),
      ]);
      setObrigacoes(obr || []);
      const { data: irm } = await supabase.from('irmaos').select('id, nome, cargo').order('nome');
      setIrmaos(irm || []);
      setBaixas(bx || []);
      setAvisos(av);
    } catch (e) {
      showError?.('Erro ao carregar as obrigações: ' + e.message);
    }
  };
  useEffect(() => { carregar(); }, []);

  const salvar = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        periodicidade: form.periodicidade,
        dia_vencimento: Number(form.dia_vencimento) || 10,
        mes_referencia: form.periodicidade === 'mensal' ? null : (Number(form.mes_referencia) || 1),
        dias_aviso: Number(form.dias_aviso) || 0,
        responsavel_id: form.responsavel_id || null,
        observacoes: form.observacoes.trim() || null,
        ativa: form.ativa,
      };
      const { data, error } = editando
        ? await supabase.from('obrigacoes').update(payload).eq('id', editando.id).select()
        : await supabase.from('obrigacoes').insert([payload]).select();
      if (error) throw error;
      if (!data?.length) throw new Error('o banco não permitiu a gravação (sem permissão).');
      showSuccess?.(editando ? 'Obrigação atualizada!' : 'Obrigação cadastrada!');
      setModal(false); setForm(VAZIO); setEditando(null);
      carregar();
    } catch (err) {
      showError?.('Erro ao salvar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const excluir = async (o) => {
    if (!window.confirm(`Excluir a obrigação "${o.nome}"?\nO histórico de baixas dela também será apagado.`)) return;
    try {
      const { data, error } = await supabase.from('obrigacoes').delete().eq('id', o.id).select();
      if (error) throw error;
      if (!data?.length) throw new Error('o banco não permitiu a exclusão (sem permissão).');
      showSuccess?.('Obrigação excluída!');
      carregar();
    } catch (e) { showError?.('Erro ao excluir: ' + e.message); }
  };

  const resolver = async (a) => {
    try {
      await darBaixa(a.id, a.competencia);
      showSuccess?.(`${a.nome} de ${a.competencia.split('-').reverse().join('/')} marcada como resolvida!`);
      carregar();
    } catch (e) { showError?.('Erro: ' + e.message); }
  };

  const desfazer = async (b) => {
    if (!window.confirm('Desfazer esta baixa? A obrigação volta a aparecer nos avisos.')) return;
    try {
      await desfazerBaixa(b.obrigacao_id, b.competencia);
      showSuccess?.('Baixa desfeita!');
      carregar();
    } catch (e) { showError?.('Erro: ' + e.message); }
  };

  const etiqueta = (a) => (a.vencida ? `Atrasado ${Math.abs(a.dias)}d` : a.dias === 0 ? 'Vence hoje' : `Em ${a.dias}d`);
  const nomeDe = (id) => obrigacoes.find(o => String(o.id) === String(id))?.nome || '—';
  // Sem responsável escolhido, vale o padrão da Loja: o Tesoureiro
  const temCargo = (i, termo) => String(i?.cargo || '').toLowerCase().includes(termo);
  const padraoResp = irmaos.find(i => temCargo(i, 'tesoureiro') && !temCargo(i, 'adjunto'))
    || irmaos.find(i => temCargo(i, 'tesoureiro'));
  const irmaoResp = (x) => irmaos.find(i => String(i.id) === String(x?.responsavel_id)) || padraoResp || null;
  const nomeResp = (x) => {
    const i = irmaoResp(x);
    return i ? `${nomeCurto(i.nome)}${x?.responsavel_id ? '' : ' (padrão)'}` : '';
  };
  const resp = (x) => String(x?.responsavel_id || padraoResp?.id || '');
  const avisosFiltrados = avisos.filter(a => !filtroResp || resp(a) === filtroResp);
  const obrigacoesFiltradas = obrigacoes.filter(o => !filtroResp || resp(o) === filtroResp);
  const baixasFiltradas = baixas.filter(b => {
    if (!filtroResp) return true;
    const o = obrigacoes.find(x => String(x.id) === String(b.obrigacao_id));
    return resp(o) === filtroResp;
  });
  const estiloAba = (id) => ({
    padding: '0.45rem 0.9rem', border: 'none', background: 'transparent', cursor: 'pointer',
    fontWeight: 700, fontSize: '0.85rem',
    color: aba === id ? 'var(--color-accent)' : 'var(--color-text-muted)',
    borderBottom: `2px solid ${aba === id ? 'var(--color-accent)' : 'transparent'}`,
  });

  return (
    <div style={{ padding: '0.5rem', maxWidth: '1000px', margin: '0 auto' }}>

      {/* ABAS + FILTRO */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)', marginBottom: '1rem' }}>
        <button type="button" onClick={() => setAba('pendentes')} style={estiloAba('pendentes')}>⏳ Pendentes ({avisosFiltrados.length})</button>
        <button type="button" onClick={() => setAba('historico')} style={estiloAba('historico')}>✔ Histórico ({baixasFiltradas.length})</button>
        <button type="button" onClick={() => setAba('configurar')} style={estiloAba('configurar')}>⚙ Configurar ({obrigacoesFiltradas.length})</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', paddingBottom: '0.3rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Responsável:</span>
          <select value={filtroResp} onChange={e => setFiltroResp(e.target.value)}
            style={{ ...inp, width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.82rem' }}>
            <option value="">Todos</option>
            {irmaos.map(i => <option key={i.id} value={String(i.id)}>{nomeCurto(i.nome)}</option>)}
          </select>
        </div>
      </div>

      {/* PENDENTES */}
      {aba === 'pendentes' && (
      <section style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.6rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>🧾 Próximos vencimentos ({avisosFiltrados.length})</h3>
          {podeGerir && (
            <button type="button" onClick={() => { setForm(VAZIO); setEditando(null); setModal(true); }}
              style={{ padding: '0.45rem 0.9rem', borderRadius: 'var(--radius-lg)', border: 'none', background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
              ➕ Nova Obrigação
            </button>
          )}
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {avisos.length === 0 ? (
            <p style={{ margin: 0, padding: '0.9rem 1rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Nenhuma obrigação pendente no momento.
            </p>
          ) : avisosFiltrados.map((a, i) => (
            <div key={`${a.id}-${a.competencia}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.6rem 1rem', borderTop: i ? '1px solid var(--color-border)' : 'none', borderLeft: `4px solid ${a.vencida ? '#ef4444' : a.noPrazoDeAviso ? '#f59e0b' : 'var(--color-border)'}` }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>{a.nome}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Vence: {dataBR(a.vencimento)} · {PERIODICIDADES[a.periodicidade]?.rotulo}
                  {nomeResp(a) ? ` · 👤 ${nomeResp(a)}` : ''}
                  {a.observacoes ? ` · ${a.observacoes}` : ''}
                </p>
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.6rem', borderRadius: '999px', color: a.vencida ? '#ef4444' : a.noPrazoDeAviso ? '#f59e0b' : 'var(--color-text-muted)', border: `1px solid ${a.vencida ? 'rgba(239,68,68,0.5)' : a.noPrazoDeAviso ? 'rgba(245,158,11,0.5)' : 'var(--color-border)'}` }}>
                {etiqueta(a)}
              </span>
              {podeGerir && (
                <button type="button" onClick={() => resolver(a)}
                  style={{ padding: '0.35rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid #10b981', background: 'rgba(16,185,129,0.12)', color: '#10b981', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                  ✔ Resolvida
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      )}

      {/* CADASTRO */}
      {aba === 'configurar' && (
      <section style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.6rem', fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>📋 Obrigações cadastradas</h3>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {obrigacoesFiltradas.length === 0 && (
            <p style={{ margin: 0, padding: '0.9rem 1rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Nenhuma obrigação cadastrada.</p>
          )}
          {obrigacoesFiltradas.map((o, i) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', borderTop: i ? '1px solid var(--color-border)' : 'none', opacity: o.ativa ? 1 : 0.55 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>{o.nome}{!o.ativa && ' (inativa)'}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {PERIODICIDADES[o.periodicidade]?.rotulo} · dia {o.dia_vencimento}
                  {nomeResp(o) ? ` · 👤 ${nomeResp(o)}` : ''}
                  {o.periodicidade !== 'mensal' && o.mes_referencia ? ` · a partir de ${MESES[o.mes_referencia - 1]}` : ''}
                  {` · avisar ${o.dias_aviso} dia(s) antes`}
                </p>
              </div>
              {podeGerir && (<>
                <button type="button" onClick={() => { setForm({ ...VAZIO, ...o, observacoes: o.observacoes || '', mes_referencia: o.mes_referencia || 1 }); setEditando(o); setModal(true); }}
                  style={{ padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-accent)', background: 'transparent', color: 'var(--color-accent)', cursor: 'pointer' }}>✏️</button>
                <button type="button" onClick={() => excluir(o)}
                  style={{ padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.12)', color: '#ef4444', cursor: 'pointer' }}>🗑️</button>
              </>)}
            </div>
          ))}
        </div>
      </section>
      )}

      {/* HISTÓRICO DE BAIXAS */}
      {aba === 'historico' && (
      <section>
        <h3 style={{ margin: '0 0 0.6rem', fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>✔ Resolvidas recentemente</h3>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {baixasFiltradas.length === 0 && (
            <p style={{ margin: 0, padding: '0.9rem 1rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Nada resolvido ainda.</p>
          )}
          {baixasFiltradas.map((b, i) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', borderTop: i ? '1px solid var(--color-border)' : 'none', fontSize: '0.82rem' }}>
              <strong style={{ color: 'var(--color-text)', minWidth: '140px' }}>{nomeDe(b.obrigacao_id)}</strong>
              <span style={{ color: 'var(--color-text-muted)' }}>{b.competencia.split('-').reverse().join('/')}</span>
              <span style={{ flex: 1, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{b.resolvida_por || ''}</span>
              {podeGerir && (
                <button type="button" onClick={() => desfazer(b)}
                  style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '0.72rem', cursor: 'pointer' }}>
                  ↩️ Desfazer
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      )}

      {/* MODAL */}
      {modal && podeGerir && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <form onClick={e => e.stopPropagation()} onSubmit={salvar}
            style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', width: '100%', maxWidth: '540px', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>
              {editando ? 'Editar Obrigação' : 'Nova Obrigação'}
            </h3>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={lab}>Nome *</label>
              <input type="text" required placeholder="Ex.: Energia, IPTU, Receita Federal"
                value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} style={inp} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px', gap: '0.7rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={lab}>Periodicidade *</label>
                <select value={form.periodicidade} onChange={e => setForm({ ...form, periodicidade: e.target.value })} style={inp}>
                  {Object.entries(PERIODICIDADES).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
                </select>
              </div>
              <div>
                <label style={lab}>Dia *</label>
                <input type="number" min="1" max="31" required value={form.dia_vencimento}
                  onChange={e => setForm({ ...form, dia_vencimento: e.target.value })} style={inp} />
              </div>
              <div>
                <label style={lab}>Avisar antes</label>
                <input type="number" min="0" max="60" value={form.dias_aviso}
                  onChange={e => setForm({ ...form, dias_aviso: e.target.value })} style={inp} />
              </div>
            </div>
            {form.periodicidade !== 'mensal' && (
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={lab}>Mês de referência (primeiro do ciclo)</label>
                <select value={form.mes_referencia} onChange={e => setForm({ ...form, mes_referencia: e.target.value })} style={inp}>
                  {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
            )}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={lab}>Responsável</label>
              <select value={form.responsavel_id || ''} onChange={e => setForm({ ...form, responsavel_id: e.target.value })} style={inp}>
                <option value="">Padrão da Loja{padraoResp ? ` — ${nomeCurto(padraoResp.nome)} (Tesoureiro)` : ''}</option>
                {irmaos.map(i => <option key={i.id} value={i.id}>{nomeCurto(i.nome)}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={lab}>Observações</label>
              <input type="text" placeholder="Ex.: débito automático, emitir no site…"
                value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} style={inp} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', color: 'var(--color-text)', marginBottom: '1rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.ativa} onChange={e => setForm({ ...form, ativa: e.target.checked })} />
              Ativa (aparece nos avisos)
            </label>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button type="button" onClick={() => setModal(false)}
                style={{ flex: 1, height: '38px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" disabled={loading}
                style={{ flex: 2, height: '38px', borderRadius: 'var(--radius-lg)', border: 'none', background: loading ? 'var(--color-surface-3)' : 'var(--color-accent)', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Salvando...' : editando ? 'Atualizar' : 'Cadastrar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
