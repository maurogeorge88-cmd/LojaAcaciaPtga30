import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

// ── Constantes ─────────────────────────────────────────────────────────────
const STATUS = {
  planejado:    { label: 'Planejado',    cor: '#6366f1', bg: 'rgba(99,102,241,0.15)'  },
  em_andamento: { label: 'Em Andamento', cor: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  encerrado:    { label: 'Encerrado',    cor: '#10b981', bg: 'rgba(16,185,129,0.15)'  },
};

const CAT_ITEM = {
  bebida:      { label: 'Bebida',      emoji: '🥤' },
  comida:      { label: 'Comida',      emoji: '🍔' },
  equipamento: { label: 'Equipamento', emoji: '📦' },
  embalagem:   { label: 'Embalagem',   emoji: '🛍️' },
  outros:      { label: 'Outros',      emoji: '📋' },
};

const fmtR = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const fmtN = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 });
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

const EVENTO_VAZIO = { nome: '', descricao: '', data_evento: hoje(), local_evento: '', status: 'planejado', observacoes: '' };
const ITEM_VAZIO   = { nome: '', categoria: 'bebida', unidade: 'un', qtd_comprada: '', valor_unit_compra: '', preco_venda_unit: '', qtd_vendida: '', qtd_devolvida: '', valor_devolvido: '', observacoes: '' };
const GASTO_VAZIO  = { descricao: '', categoria: 'outros', valor: '', observacoes: '' };
const PARC_VAZIO   = { nome: '', percentual: '', observacoes: '' };

const sInp = { background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' };
const sLbl = { display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' };

// ── Componente ──────────────────────────────────────────────────────────────
export default function EventosArrecadacao({ permissoes, showSuccess, showError }) {
  const [eventos, setEventos]       = useState([]);
  const [eventoSel, setEventoSel]   = useState(null); // evento aberto
  const [aba, setAba]               = useState('itens'); // itens | gastos | parceiros | relatorio
  const [loading, setLoading]       = useState(true);

  // Dados do evento selecionado
  const [itens, setItens]           = useState([]);
  const [gastos, setGastos]         = useState([]);
  const [parceiros, setParceiros]   = useState([]);

  // Modais
  const [mEvento, setMEvento]       = useState(false);
  const [mItem, setMItem]           = useState(false);
  const [mGasto, setMGasto]         = useState(false);
  const [mParc, setMParc]           = useState(false);

  // Forms
  const [fEvento, setFEvento]       = useState(EVENTO_VAZIO);
  const [fItem, setFItem]           = useState(ITEM_VAZIO);
  const [fGasto, setFGasto]         = useState(GASTO_VAZIO);
  const [fParc, setFParc]           = useState(PARC_VAZIO);
  const [editId, setEditId]         = useState(null);
  const [salvando, setSalvando]     = useState(false);

  useEffect(() => { carregarEventos(); }, []);
  useEffect(() => { if (eventoSel) carregarDetalhe(eventoSel.id); }, [eventoSel]);

  // ── Carregamento ──────────────────────────────────────────────────────────
  const carregarEventos = async () => {
    setLoading(true);
    const { data } = await supabase.from('eventos_arrecadacao').select('*').order('data_evento', { ascending: false });
    setEventos(data || []);
    setLoading(false);
  };

  const carregarDetalhe = async (id) => {
    const [{ data: its }, { data: gas }, { data: pars }] = await Promise.all([
      supabase.from('eventos_itens').select('*').eq('evento_id', id).order('categoria').order('nome'),
      supabase.from('eventos_gastos').select('*').eq('evento_id', id).order('created_at'),
      supabase.from('eventos_parceiros').select('*').eq('evento_id', id),
    ]);
    setItens(its || []);
    setGastos(gas || []);
    setParceiros(pars || []);
  };

  // ── CRUD Evento ───────────────────────────────────────────────────────────
  const abrirMEvento = (ev = null) => {
    setEditId(ev?.id || null);
    setFEvento(ev ? { nome: ev.nome, descricao: ev.descricao || '', data_evento: ev.data_evento, local_evento: ev.local_evento || '', status: ev.status, observacoes: ev.observacoes || '' } : EVENTO_VAZIO);
    setMEvento(true);
  };

  const salvarEvento = async () => {
    if (!fEvento.nome) { showError('Nome obrigatório.'); return; }
    setSalvando(true);
    try {
      if (editId) {
        const { error } = await supabase.from('eventos_arrecadacao').update(fEvento).eq('id', editId);
        if (error) throw error;
        showSuccess('Evento atualizado!');
        if (eventoSel?.id === editId) setEventoSel(prev => ({ ...prev, ...fEvento }));
      } else {
        const { data, error } = await supabase.from('eventos_arrecadacao').insert([{ ...fEvento, criado_por: (await supabase.auth.getUser()).data.user?.id }]).select().single();
        if (error) throw error;
        showSuccess('Evento criado!');
        setEventoSel(data);
        setAba('itens');
      }
      setMEvento(false);
      carregarEventos();
    } catch (e) { showError(e.message); }
    finally { setSalvando(false); }
  };

  const excluirEvento = async (ev) => {
    if (!window.confirm(`Excluir "${ev.nome}"? Todos os itens, gastos e parceiros serão removidos.`)) return;
    const { error } = await supabase.from('eventos_arrecadacao').delete().eq('id', ev.id);
    if (error) { showError(error.message); return; }
    showSuccess('Evento excluído.');
    if (eventoSel?.id === ev.id) setEventoSel(null);
    carregarEventos();
  };

  // ── CRUD Item ─────────────────────────────────────────────────────────────
  const abrirMItem = (it = null) => {
    setEditId(it?.id || null);
    setFItem(it ? { nome: it.nome, categoria: it.categoria, unidade: it.unidade, qtd_comprada: String(it.qtd_comprada), valor_unit_compra: String(it.valor_unit_compra), preco_venda_unit: String(it.preco_venda_unit || ''), qtd_vendida: String(it.qtd_vendida || ''), qtd_devolvida: String(it.qtd_devolvida || ''), valor_devolvido: String(it.valor_devolvido || ''), observacoes: it.observacoes || '' } : ITEM_VAZIO);
    setMItem(true);
  };

  const salvarItem = async () => {
    if (!fItem.nome || !fItem.qtd_comprada) { showError('Nome e quantidade obrigatórios.'); return; }
    setSalvando(true);
    try {
      const payload = { evento_id: eventoSel.id, nome: fItem.nome, categoria: fItem.categoria, unidade: fItem.unidade, qtd_comprada: Number(fItem.qtd_comprada), valor_unit_compra: Number(fItem.valor_unit_compra || 0), preco_venda_unit: Number(fItem.preco_venda_unit || 0), qtd_vendida: Number(fItem.qtd_vendida || 0), qtd_devolvida: Number(fItem.qtd_devolvida || 0), valor_devolvido: Number(fItem.valor_devolvido || 0), observacoes: fItem.observacoes || null };
      if (editId) { const { error } = await supabase.from('eventos_itens').update(payload).eq('id', editId); if (error) throw error; }
      else        { const { error } = await supabase.from('eventos_itens').insert([payload]);                if (error) throw error; }
      showSuccess(editId ? 'Item atualizado!' : 'Item adicionado!');
      setMItem(false);
      carregarDetalhe(eventoSel.id);
    } catch (e) { showError(e.message); }
    finally { setSalvando(false); }
  };

  const excluirItem = async (id) => {
    if (!window.confirm('Excluir este item?')) return;
    await supabase.from('eventos_itens').delete().eq('id', id);
    carregarDetalhe(eventoSel.id);
  };

  // ── CRUD Gasto ────────────────────────────────────────────────────────────
  const salvarGasto = async () => {
    if (!fGasto.descricao || !fGasto.valor) { showError('Descrição e valor obrigatórios.'); return; }
    setSalvando(true);
    try {
      const payload = { evento_id: eventoSel.id, descricao: fGasto.descricao, categoria: fGasto.categoria, valor: Number(fGasto.valor), observacoes: fGasto.observacoes || null };
      if (editId) { await supabase.from('eventos_gastos').update(payload).eq('id', editId); }
      else        { await supabase.from('eventos_gastos').insert([payload]); }
      showSuccess(editId ? 'Gasto atualizado!' : 'Gasto adicionado!');
      setMGasto(false);
      setFGasto(GASTO_VAZIO);
      setEditId(null);
      carregarDetalhe(eventoSel.id);
    } catch (e) { showError(e.message); }
    finally { setSalvando(false); }
  };

  const excluirGasto = async (id) => {
    if (!window.confirm('Excluir este gasto?')) return;
    await supabase.from('eventos_gastos').delete().eq('id', id);
    carregarDetalhe(eventoSel.id);
  };

  // ── CRUD Parceiro ─────────────────────────────────────────────────────────
  const salvarParc = async () => {
    if (!fParc.nome) { showError('Nome obrigatório.'); return; }
    setSalvando(true);
    try {
      const payload = { evento_id: eventoSel.id, nome: fParc.nome, percentual: Number(fParc.percentual || 0), observacoes: fParc.observacoes || null };
      if (editId) { await supabase.from('eventos_parceiros').update(payload).eq('id', editId); }
      else        { await supabase.from('eventos_parceiros').insert([payload]); }
      showSuccess('Parceiro salvo!');
      setMParc(false);
      setFParc(PARC_VAZIO);
      setEditId(null);
      carregarDetalhe(eventoSel.id);
    } catch (e) { showError(e.message); }
    finally { setSalvando(false); }
  };

  const excluirParc = async (id) => {
    if (!window.confirm('Remover parceiro?')) return;
    await supabase.from('eventos_parceiros').delete().eq('id', id);
    carregarDetalhe(eventoSel.id);
  };

  // ── Cálculos do Relatório ─────────────────────────────────────────────────
  const calculos = () => {
    const totalCompras = itens.reduce((s, i) => s + Number(i.qtd_comprada) * Number(i.valor_unit_compra), 0);
    const totalVendas  = itens.reduce((s, i) => s + Number(i.qtd_vendida)  * Number(i.preco_venda_unit), 0);
    const totalDevol   = itens.reduce((s, i) => s + Number(i.valor_devolvido), 0);
    const totalGastos  = gastos.reduce((s, g) => s + Number(g.valor), 0);
    const custoLiq     = totalCompras - totalDevol;
    const custoTotal   = custoLiq + totalGastos;
    const lucroSobreParceiros = totalVendas - custoTotal;
    const totalRepasse = parceiros.reduce((s, p) => s + (lucroSobreParceiros * Number(p.percentual) / 100), 0);
    const lucroLiquido = lucroSobreParceiros - totalRepasse;
    return { totalCompras, totalVendas, totalDevol, totalGastos, custoLiq, custoTotal, lucroSobreParceiros, totalRepasse, lucroLiquido };
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', padding: '0.75rem' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>🎪 Eventos de Arrecadação</h2>
          <p style={{ color: 'var(--color-text-muted)', margin: '0.2rem 0 0', fontSize: '0.85rem' }}>Gestão de eventos, compras, vendas e resultados</p>
        </div>
        <button onClick={() => abrirMEvento()} style={{ padding: '0.6rem 1.25rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer', fontSize: '0.875rem' }}>
          ➕ Novo Evento
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Lista de eventos */}
        <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {loading ? (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem' }}>Carregando...</p>
          ) : eventos.length === 0 ? (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <p style={{ fontSize: '2rem', margin: 0 }}>🎪</p>
              <p style={{ margin: '0.5rem 0 0', fontWeight: '600' }}>Nenhum evento cadastrado</p>
            </div>
          ) : eventos.map(ev => {
            const st = STATUS[ev.status] || STATUS.planejado;
            const ativo = eventoSel?.id === ev.id;
            return (
              <div key={ev.id} onClick={() => { setEventoSel(ev); setAba('itens'); }}
                style={{ background: ativo ? 'var(--color-accent-bg)' : 'var(--color-surface)', border: `1px solid ${ativo ? 'var(--color-accent)' : 'var(--color-border)'}`, borderLeft: `4px solid ${st.cor}`, borderRadius: 'var(--radius-lg)', padding: '0.75rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '0.875rem', color: 'var(--color-text)', flex: 1 }}>{ev.nome}</p>
                  <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                    <button onClick={e => { e.stopPropagation(); abrirMEvento(ev); }} style={{ padding: '0.15rem 0.35rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.7rem' }}>✏️</button>
                    <button onClick={e => { e.stopPropagation(); excluirEvento(ev); }} style={{ padding: '0.15rem 0.35rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.7rem', color: '#ef4444' }}>🗑</button>
                  </div>
                </div>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>📅 {new Date(ev.data_evento + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                {ev.local_evento && <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>📍 {ev.local_evento}</p>}
                <span style={{ display: 'inline-block', marginTop: '0.4rem', padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: '700', background: st.bg, color: st.cor }}>{st.label}</span>
              </div>
            );
          })}
        </div>

        {/* Detalhe do evento */}
        {eventoSel ? (
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Header do evento */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontWeight: '800', color: 'var(--color-text)', fontSize: '1.1rem' }}>{eventoSel.nome}</h3>
                  {eventoSel.descricao && <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{eventoSel.descricao}</p>}
                </div>
                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '700', background: STATUS[eventoSel.status].bg, color: STATUS[eventoSel.status].cor }}>
                  {STATUS[eventoSel.status].label}
                </span>
              </div>
            </div>

            {/* Abas */}
            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', background: 'var(--color-surface-2)', padding: '0.25rem', borderRadius: 'var(--radius-lg)', flexWrap: 'wrap' }}>
              {[['itens','📦 Compras/Estoque'],['gastos','💸 Outros Gastos'],['parceiros','🤝 Parceiros'],['relatorio','📊 Relatório']].map(([id, label]) => (
                <button key={id} onClick={() => setAba(id)} style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: 'none', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', background: aba === id ? 'var(--color-accent)' : 'transparent', color: aba === id ? '#fff' : 'var(--color-text-muted)', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── ABA ITENS ── */}
            {aba === 'itens' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <p style={{ margin: 0, fontWeight: '700', color: 'var(--color-text)', fontSize: '0.9rem' }}>Itens ({itens.length})</p>
                  <button onClick={() => { setEditId(null); setFItem(ITEM_VAZIO); setMItem(true); }} style={{ padding: '0.4rem 0.9rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer', fontSize: '0.8rem' }}>➕ Adicionar Item</button>
                </div>

                {Object.keys(CAT_ITEM).map(cat => {
                  const catItens = itens.filter(i => i.categoria === cat);
                  if (!catItens.length) return null;
                  return (
                    <div key={cat} style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1rem' }}>{CAT_ITEM[cat].emoji}</span>
                        <span style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '0.85rem' }}>{CAT_ITEM[cat].label}</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {catItens.map(it => {
                          const custTotal = Number(it.qtd_comprada) * Number(it.valor_unit_compra);
                          const vendTotal = Number(it.qtd_vendida)  * Number(it.preco_venda_unit);
                          const qtdPerd   = Number(it.qtd_comprada) - Number(it.qtd_vendida) - Number(it.qtd_devolvida);
                          const lucroIt   = vendTotal + Number(it.valor_devolvido) - custTotal;
                          return (
                            <div key={it.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.75rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <p style={{ margin: 0, fontWeight: '700', color: 'var(--color-text)', fontSize: '0.875rem' }}>{it.nome}</p>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  <button onClick={() => abrirMItem(it)} style={{ padding: '0.2rem 0.4rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.72rem' }}>✏️</button>
                                  <button onClick={() => excluirItem(it.id)} style={{ padding: '0.2rem 0.4rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.72rem' }}>🗑</button>
                                </div>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.4rem', fontSize: '0.75rem' }}>
                                {[
                                  ['🛒 Comprado', `${fmtN(it.qtd_comprada)} ${it.unidade}`, 'var(--color-text-muted)'],
                                  ['💰 Custo',    fmtR(custTotal),                          '#ef4444'],
                                  ['✅ Vendido',  `${fmtN(it.qtd_vendida)} ${it.unidade}`,  '#10b981'],
                                  ['💵 Receita',  fmtR(vendTotal),                          '#10b981'],
                                  ['↩️ Devolvido',`${fmtN(it.qtd_devolvida)} ${it.unidade}`,'#6366f1'],
                                  ['💸 Dev.(R$)', fmtR(it.valor_devolvido),                 '#6366f1'],
                                  ['⚠️ Perdido',  `${fmtN(qtdPerd)} ${it.unidade}`,         qtdPerd > 0 ? '#f59e0b' : 'var(--color-text-muted)'],
                                  ['📈 Resultado',fmtR(lucroIt),                            lucroIt >= 0 ? '#10b981' : '#ef4444'],
                                ].map(([k, v, cor]) => (
                                  <div key={k} style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.5rem' }}>
                                    <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.65rem' }}>{k}</p>
                                    <p style={{ margin: 0, fontWeight: '700', color: cor }}>{v}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {itens.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    <p style={{ fontSize: '2rem', margin: 0 }}>📦</p>
                    <p>Nenhum item cadastrado. Adicione compras e estoque do evento.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── ABA GASTOS ── */}
            {aba === 'gastos' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <p style={{ margin: 0, fontWeight: '700', color: 'var(--color-text)', fontSize: '0.9rem' }}>Outros Gastos ({gastos.length})</p>
                  <button onClick={() => { setEditId(null); setFGasto(GASTO_VAZIO); setMGasto(true); }} style={{ padding: '0.4rem 0.9rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer', fontSize: '0.8rem' }}>➕ Adicionar Gasto</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {gastos.map(g => (
                    <div key={g.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: '600', color: 'var(--color-text)', fontSize: '0.875rem' }}>{g.descricao}</p>
                        {g.categoria && <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{g.categoria}</p>}
                        {g.observacoes && <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{g.observacoes}</p>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: '800', color: '#ef4444', fontSize: '0.95rem' }}>{fmtR(g.valor)}</span>
                        <button onClick={() => { setEditId(g.id); setFGasto({ descricao: g.descricao, categoria: g.categoria, valor: String(g.valor), observacoes: g.observacoes || '' }); setMGasto(true); }} style={{ padding: '0.2rem 0.4rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.72rem' }}>✏️</button>
                        <button onClick={() => excluirGasto(g.id)} style={{ padding: '0.2rem 0.4rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.72rem' }}>🗑</button>
                      </div>
                    </div>
                  ))}
                  {gastos.length === 0 && <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>Nenhum gasto adicional registrado.</p>}
                </div>
              </div>
            )}

            {/* ── ABA PARCEIROS ── */}
            {aba === 'parceiros' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <p style={{ margin: 0, fontWeight: '700', color: 'var(--color-text)', fontSize: '0.9rem' }}>Parceiros ({parceiros.length})</p>
                  <button onClick={() => { setEditId(null); setFParc(PARC_VAZIO); setMParc(true); }} style={{ padding: '0.4rem 0.9rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer', fontSize: '0.8rem' }}>➕ Adicionar Parceiro</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {parceiros.map(p => {
                    const { lucroSobreParceiros } = calculos();
                    const repasse = lucroSobreParceiros * Number(p.percentual) / 100;
                    return (
                      <div key={p.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: '700', color: 'var(--color-text)' }}>{p.nome}</p>
                          <p style={{ margin: '0.1rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {p.percentual}% do lucro → <span style={{ fontWeight: '700', color: '#f59e0b' }}>{fmtR(repasse)}</span>
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button onClick={() => { setEditId(p.id); setFParc({ nome: p.nome, percentual: String(p.percentual), observacoes: p.observacoes || '' }); setMParc(true); }} style={{ padding: '0.2rem 0.4rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.72rem' }}>✏️</button>
                          <button onClick={() => excluirParc(p.id)} style={{ padding: '0.2rem 0.4rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.72rem' }}>🗑</button>
                        </div>
                      </div>
                    );
                  })}
                  {parceiros.length === 0 && <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>Nenhum parceiro cadastrado.</p>}
                </div>
              </div>
            )}

            {/* ── ABA RELATÓRIO ── */}
            {aba === 'relatorio' && (() => {
              const c = calculos();
              const cards = [
                { label: 'Total Compras',      val: c.totalCompras,         cor: '#ef4444', sub: 'Investimento em estoque' },
                { label: 'Total Vendas',       val: c.totalVendas,          cor: '#10b981', sub: 'Receita de vendas' },
                { label: 'Devoluções',         val: c.totalDevol,           cor: '#6366f1', sub: 'Valor devolvido ao comércio' },
                { label: 'Outros Gastos',      val: c.totalGastos,          cor: '#f59e0b', sub: 'Equipamentos, taxas, etc.' },
                { label: 'Custo Líquido',      val: c.custoLiq,             cor: '#ef4444', sub: 'Compras - Devoluções' },
                { label: 'Custo Total',        val: c.custoTotal,           cor: '#ef4444', sub: 'Custo Líq. + Outros Gastos' },
                { label: 'Lucro s/ Parceiros', val: c.lucroSobreParceiros,  cor: c.lucroSobreParceiros >= 0 ? '#10b981' : '#ef4444', sub: 'Vendas - Custo Total' },
                { label: 'Repasse Parceiros',  val: c.totalRepasse,         cor: '#f59e0b', sub: parceiros.map(p => `${p.nome} (${p.percentual}%)`).join(', ') || '—' },
                { label: 'LUCRO LÍQUIDO LOJA', val: c.lucroLiquido,         cor: c.lucroLiquido >= 0 ? '#10b981' : '#ef4444', sub: 'Resultado final', destaque: true },
              ];
              return (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {cards.map(cd => (
                      <div key={cd.label} style={{ background: cd.destaque ? `${cd.cor}22` : 'var(--color-surface)', border: `1px solid ${cd.destaque ? cd.cor : 'var(--color-border)'}`, borderLeft: `4px solid ${cd.cor}`, borderRadius: 'var(--radius-lg)', padding: '0.85rem' }}>
                        <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{cd.label}</p>
                        <p style={{ margin: '0.2rem 0 0', fontSize: cd.destaque ? '1.3rem' : '1.1rem', fontWeight: '800', color: cd.cor }}>{fmtR(cd.val)}</p>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{cd.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Estimativa por item */}
                  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
                    <div style={{ background: 'var(--color-surface-2)', padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
                      <p style={{ margin: 0, fontWeight: '700', color: 'var(--color-text)', fontSize: '0.9rem' }}>📈 Performance por Item</p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--color-surface-2)' }}>
                            {['Item', 'Comprado', 'Vendido', 'Devolvido', 'Perdido', 'Custo', 'Receita', 'Resultado'].map(h => (
                              <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: h === 'Item' ? 'left' : 'right', fontWeight: '700', color: 'var(--color-text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {itens.map((it, idx) => {
                            const custo = Number(it.qtd_comprada) * Number(it.valor_unit_compra);
                            const receita = Number(it.qtd_vendida) * Number(it.preco_venda_unit);
                            const res = receita + Number(it.valor_devolvido) - custo;
                            const perd = Number(it.qtd_comprada) - Number(it.qtd_vendida) - Number(it.qtd_devolvida);
                            return (
                              <tr key={it.id} style={{ background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--color-text)', fontWeight: '600' }}>{CAT_ITEM[it.categoria]?.emoji} {it.nome}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>{fmtN(it.qtd_comprada)} {it.unidade}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#10b981', fontWeight: '600' }}>{fmtN(it.qtd_vendida)} {it.unidade}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#6366f1' }}>{fmtN(it.qtd_devolvida)} {it.unidade}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: perd > 0 ? '#f59e0b' : 'var(--color-text-muted)' }}>{fmtN(perd)} {it.unidade}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#ef4444' }}>{fmtR(custo)}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#10b981' }}>{fmtR(receita)}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700', color: res >= 0 ? '#10b981' : '#ef4444' }}>{fmtR(res)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '3rem', margin: 0 }}>👈</p>
              <p style={{ fontWeight: '600', marginTop: '0.5rem' }}>Selecione um evento para ver os detalhes</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Evento ── */}
      {mEvento && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: 'var(--color-accent)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#fff', fontWeight: '800', margin: 0 }}>{editId ? '✏️ Editar Evento' : '🎪 Novo Evento'}</h3>
              <button onClick={() => setMEvento(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: '2rem', height: '2rem', cursor: 'pointer', fontWeight: '700' }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div><label style={sLbl}>Nome *</label><input value={fEvento.nome} onChange={e => setFEvento(p => ({ ...p, nome: e.target.value }))} style={sInp} /></div>
              <div><label style={sLbl}>Descrição</label><textarea value={fEvento.descricao} onChange={e => setFEvento(p => ({ ...p, descricao: e.target.value }))} rows={2} style={{ ...sInp, resize: 'vertical', fontFamily: 'inherit' }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div><label style={sLbl}>Data *</label><input type="date" value={fEvento.data_evento} onChange={e => setFEvento(p => ({ ...p, data_evento: e.target.value }))} style={sInp} /></div>
                <div><label style={sLbl}>Status</label>
                  <select value={fEvento.status} onChange={e => setFEvento(p => ({ ...p, status: e.target.value }))} style={sInp}>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={sLbl}>Local</label><input value={fEvento.local_evento} onChange={e => setFEvento(p => ({ ...p, local_evento: e.target.value }))} style={sInp} /></div>
              <div><label style={sLbl}>Observações</label><textarea value={fEvento.observacoes} onChange={e => setFEvento(p => ({ ...p, observacoes: e.target.value }))} rows={2} style={{ ...sInp, resize: 'vertical', fontFamily: 'inherit' }} /></div>
            </div>
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setMEvento(false)} style={{ flex: 1, padding: '0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarEvento} disabled={salvando} style={{ flex: 2, padding: '0.6rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer' }}>{salvando ? 'Salvando...' : editId ? '💾 Salvar' : '✅ Criar Evento'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Item ── */}
      {mItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: 'var(--color-accent)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#fff', fontWeight: '800', margin: 0 }}>{editId ? '✏️ Editar Item' : '📦 Novo Item'}</h3>
              <button onClick={() => setMItem(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: '2rem', height: '2rem', cursor: 'pointer', fontWeight: '700' }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
                <div><label style={sLbl}>Nome *</label><input value={fItem.nome} onChange={e => setFItem(p => ({ ...p, nome: e.target.value }))} style={sInp} /></div>
                <div><label style={sLbl}>Categoria</label>
                  <select value={fItem.categoria} onChange={e => setFItem(p => ({ ...p, categoria: e.target.value }))} style={sInp}>
                    {Object.entries(CAT_ITEM).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                  </select>
                </div>
                <div><label style={sLbl}>Unidade</label><input value={fItem.unidade} onChange={e => setFItem(p => ({ ...p, unidade: e.target.value }))} placeholder="un, kg, L..." style={sInp} /></div>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-lg)', padding: '0.75rem' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase' }}>🛒 Compra</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div><label style={sLbl}>Qtd Comprada *</label><input type="number" step="0.001" value={fItem.qtd_comprada} onChange={e => setFItem(p => ({ ...p, qtd_comprada: e.target.value }))} style={sInp} /></div>
                  <div><label style={sLbl}>Valor Unit. Compra</label><input type="number" step="0.01" value={fItem.valor_unit_compra} onChange={e => setFItem(p => ({ ...p, valor_unit_compra: e.target.value }))} style={sInp} /></div>
                </div>
              </div>
              <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-lg)', padding: '0.75rem' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', fontWeight: '700', color: '#10b981', textTransform: 'uppercase' }}>✅ Venda</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div><label style={sLbl}>Qtd Vendida</label><input type="number" step="0.001" value={fItem.qtd_vendida} onChange={e => setFItem(p => ({ ...p, qtd_vendida: e.target.value }))} style={sInp} /></div>
                  <div><label style={sLbl}>Preço Venda Unit.</label><input type="number" step="0.01" value={fItem.preco_venda_unit} onChange={e => setFItem(p => ({ ...p, preco_venda_unit: e.target.value }))} style={sInp} /></div>
                </div>
              </div>
              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-lg)', padding: '0.75rem' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', fontWeight: '700', color: '#6366f1', textTransform: 'uppercase' }}>↩️ Devolução</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div><label style={sLbl}>Qtd Devolvida</label><input type="number" step="0.001" value={fItem.qtd_devolvida} onChange={e => setFItem(p => ({ ...p, qtd_devolvida: e.target.value }))} style={sInp} /></div>
                  <div><label style={sLbl}>Valor Devolvido (R$)</label><input type="number" step="0.01" value={fItem.valor_devolvido} onChange={e => setFItem(p => ({ ...p, valor_devolvido: e.target.value }))} style={sInp} /></div>
                </div>
              </div>
              <div><label style={sLbl}>Observações</label><textarea value={fItem.observacoes} onChange={e => setFItem(p => ({ ...p, observacoes: e.target.value }))} rows={2} style={{ ...sInp, resize: 'vertical', fontFamily: 'inherit' }} /></div>
            </div>
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setMItem(false)} style={{ flex: 1, padding: '0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarItem} disabled={salvando} style={{ flex: 2, padding: '0.6rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer' }}>{salvando ? 'Salvando...' : '💾 Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Gasto ── */}
      {mGasto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '440px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#ef4444', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#fff', fontWeight: '800', margin: 0 }}>💸 {editId ? 'Editar Gasto' : 'Novo Gasto'}</h3>
              <button onClick={() => setMGasto(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: '2rem', height: '2rem', cursor: 'pointer', fontWeight: '700' }}>×</button>
            </div>
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div><label style={sLbl}>Descrição *</label><input value={fGasto.descricao} onChange={e => setFGasto(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Aluguel de tenda, gelo, etc." style={sInp} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div><label style={sLbl}>Categoria</label>
                  <select value={fGasto.categoria} onChange={e => setFGasto(p => ({ ...p, categoria: e.target.value }))} style={sInp}>
                    {['equipamento','logistica','taxa','outros'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={sLbl}>Valor (R$) *</label><input type="number" step="0.01" value={fGasto.valor} onChange={e => setFGasto(p => ({ ...p, valor: e.target.value }))} style={sInp} /></div>
              </div>
              <div><label style={sLbl}>Observações</label><textarea value={fGasto.observacoes} onChange={e => setFGasto(p => ({ ...p, observacoes: e.target.value }))} rows={2} style={{ ...sInp, resize: 'vertical', fontFamily: 'inherit' }} /></div>
            </div>
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setMGasto(false)} style={{ flex: 1, padding: '0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarGasto} disabled={salvando} style={{ flex: 2, padding: '0.6rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer' }}>{salvando ? 'Salvando...' : '💾 Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Parceiro ── */}
      {mParc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '420px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#f59e0b', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#fff', fontWeight: '800', margin: 0 }}>🤝 {editId ? 'Editar Parceiro' : 'Novo Parceiro'}</h3>
              <button onClick={() => setMParc(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: '2rem', height: '2rem', cursor: 'pointer', fontWeight: '700' }}>×</button>
            </div>
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div><label style={sLbl}>Nome *</label><input value={fParc.nome} onChange={e => setFParc(p => ({ ...p, nome: e.target.value }))} style={sInp} /></div>
              <div>
                <label style={sLbl}>% do Lucro Líquido</label>
                <input type="number" step="0.1" min="0" max="100" value={fParc.percentual} onChange={e => setFParc(p => ({ ...p, percentual: e.target.value }))} style={sInp} />
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Percentual que este parceiro recebe do lucro total do evento</p>
              </div>
              <div><label style={sLbl}>Observações</label><textarea value={fParc.observacoes} onChange={e => setFParc(p => ({ ...p, observacoes: e.target.value }))} rows={2} style={{ ...sInp, resize: 'vertical', fontFamily: 'inherit' }} /></div>
            </div>
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setMParc(false)} style={{ flex: 1, padding: '0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarParc} disabled={salvando} style={{ flex: 2, padding: '0.6rem', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer' }}>{salvando ? 'Salvando...' : '💾 Salvar'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
