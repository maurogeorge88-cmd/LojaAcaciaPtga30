import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { ordenarComendas } from '../../utils/ordemComendas';
import {
  CORPO_PADRAO_COMENDAS, buscarAssinantes, gerarPranchaComendasDocx, gerarPranchaComendasPDF,
} from '../../utils/gerarPranchaComendas';

const fmtD = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '');
const tabelaAusente = (e) => /does not exist|schema cache|42P01|PGRST205/i.test(`${e?.code || ''} ${e?.message || ''}`);
const sInp = { background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', fontSize: '0.85rem', width: '100%', outline: 'none' };
const sCard = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem' };
const sLabel = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' };
const FORM_VAZIO = { prancha_expedida_id: '', glemt_numero: '', glemt_oriente: 'Cuiabá-MT', glemt_data: '', grande_chanceler: '', assunto: '', texto: CORPO_PADRAO_COMENDAS };

// Aba "Prancha à GLEMT" da tela de Comendas: indica os irmãos que serão agraciados
// (pré-preenchido com os elegíveis das comendas da Grande Loja) e gera Word/PDF.
export default function PranchaComendasGLEMT({ comendas, elegiveisPorComenda, irmaos, dadosLoja, showSuccess, showError }) {
  const [pranchas, setPranchas] = useState([]);
  const [salvas, setSalvas] = useState([]);
  const [semTabela, setSemTabela] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [selec, setSelec] = useState(new Set());
  const [extras, setExtras] = useState([]);
  const [ocupado, setOcupado] = useState('');
  const iniciado = useRef(false);

  const comendasGL = useMemo(() => comendas.filter(c => c.ativo && (c.origem || 'grande_loja') === 'grande_loja').sort(ordenarComendas), [comendas]);

  // Candidatos = elegíveis calculados + irmãos adicionados à mão
  const candidatosElegiveis = useMemo(() => comendasGL.flatMap(c => (elegiveisPorComenda[c.id] || []).map(it => ({
    key: `${c.id}|${it.irmao.id}|${it.ano || ''}`, comendaId: c.id, comenda: c.nome,
    irmaoId: it.irmao.id, nome: it.irmao.nome, cim: it.irmao.cim || '', detalhe: it.ano ? `ano ${it.ano}` : '',
  }))), [comendasGL, elegiveisPorComenda]);
  const candidatos = useMemo(() => [...candidatosElegiveis, ...extras], [candidatosElegiveis, extras]);

  const carregar = async () => {
    const [pr, sv] = await Promise.all([
      supabase.from('pranchas_expedidas').select('id, numero_prancha, data_prancha, assunto, destinatario').order('data_prancha', { ascending: false }),
      supabase.from('comendas_pranchas_glemt').select('*').order('created_at', { ascending: false }),
    ]);
    setPranchas(pr.data || []);
    if (sv.error) { if (tabelaAusente(sv.error)) setSemTabela(true); return; }
    setSemTabela(false);
    setSalvas(sv.data || []);
    // repete o Grande Chanceler da última prancha salva
    if (sv.data?.[0]?.grande_chanceler) setForm(f => (f.grande_chanceler ? f : { ...f, grande_chanceler: sv.data[0].grande_chanceler }));
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Marca todos os elegíveis na primeira vez que a lista fica pronta
  useEffect(() => {
    if (iniciado.current || editandoId || candidatosElegiveis.length === 0) return;
    iniciado.current = true;
    setSelec(new Set(candidatosElegiveis.map(c => c.key)));
  }, [candidatosElegiveis, editandoId]);

  const toggle = (key) => setSelec(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const marcarComenda = (comendaId, marcar) => setSelec(prev => {
    const n = new Set(prev);
    candidatos.filter(c => c.comendaId === comendaId).forEach(c => (marcar ? n.add(c.key) : n.delete(c.key)));
    return n;
  });
  const adicionarIrmao = (comenda, irmaoId) => {
    const ir = irmaos.find(i => String(i.id) === String(irmaoId));
    if (!ir) return;
    const key = `${comenda.id}|${ir.id}|`;
    if (candidatos.some(c => c.key === key)) { setSelec(p => new Set(p).add(key)); return; }
    setExtras(p => [...p, { key, comendaId: comenda.id, comenda: comenda.nome, irmaoId: ir.id, nome: ir.nome, cim: ir.cim || '', detalhe: '', extra: true }]);
    setSelec(p => new Set(p).add(key));
  };

  const pranchaEscolhida = pranchas.find(p => String(p.id) === String(form.prancha_expedida_id));
  const usadas = new Set(salvas.filter(s => s.id !== editandoId).map(s => String(s.prancha_expedida_id)));
  const pranchasOrdenadas = [...pranchas].sort((a, b) => (/comend/i.test(b.assunto || '') ? 1 : 0) - (/comend/i.test(a.assunto || '') ? 1 : 0));

  const itensSelecionados = () => {
    const ordem = new Map(comendasGL.map((c, i) => [c.id, i]));
    return candidatos.filter(c => selec.has(c.key))
      .sort((a, b) => (ordem.get(a.comendaId) ?? 99) - (ordem.get(b.comendaId) ?? 99) || a.nome.localeCompare(b.nome))
      .map(({ key, comendaId, comenda, irmaoId, nome, cim, detalhe }) => ({ key, comendaId, comenda, irmaoId, nome, cim, detalhe }));
  };

  const salvar = async () => {
    if (!pranchaEscolhida) { showError('Escolha a prancha da Loja (cadastre antes em Expedientes → Pranchas).'); return null; }
    if (!form.glemt_numero.trim() || !form.glemt_data || !form.grande_chanceler.trim() || !form.glemt_oriente.trim()) {
      showError('Preencha nº da prancha da GLEMT, Oriente, data de expedição e Grande Chanceler do Selo.'); return null;
    }
    const itens = itensSelecionados();
    if (itens.length === 0) { showError('Marque ao menos um irmão.'); return null; }
    const payload = {
      prancha_expedida_id: String(pranchaEscolhida.id), prancha_numero: pranchaEscolhida.numero_prancha, prancha_data: pranchaEscolhida.data_prancha || null,
      assunto: form.assunto.trim() || null, glemt_numero: form.glemt_numero.trim(), glemt_oriente: form.glemt_oriente.trim(),
      glemt_data: form.glemt_data, grande_chanceler: form.grande_chanceler.trim(), texto: form.texto, itens, updated_at: new Date().toISOString(),
    };
    const q = editandoId
      ? supabase.from('comendas_pranchas_glemt').update(payload).eq('id', editandoId).select().single()
      : supabase.from('comendas_pranchas_glemt').insert(payload).select().single();
    const { data, error } = await q;
    if (error) { showError('Erro ao salvar: ' + (tabelaAusente(error) ? 'rode o SQL comendas_pranchas_glemt.sql no Supabase.' : error.message)); return null; }
    setEditandoId(data.id);
    carregar();
    return data;
  };

  const gerar = async (formato, registro = null) => {
    setOcupado(formato);
    try {
      const reg = registro || await salvar();
      if (!reg) return;
      const assinantes = await buscarAssinantes();
      if (formato === 'pdf') await gerarPranchaComendasPDF({ registro: reg, dadosLoja: dadosLoja || {}, assinantes });
      else await gerarPranchaComendasDocx({ registro: reg, dadosLoja: dadosLoja || {}, assinantes });
      showSuccess(`Prancha gerada em ${formato === 'pdf' ? 'PDF' : 'Word'}!`);
    } catch (e) {
      showError('Erro ao gerar a prancha: ' + e.message);
    } finally {
      setOcupado('');
    }
  };

  const editar = (s) => {
    iniciado.current = true;
    setEditandoId(s.id);
    setForm({ prancha_expedida_id: s.prancha_expedida_id || '', glemt_numero: s.glemt_numero || '', glemt_oriente: s.glemt_oriente || '', glemt_data: s.glemt_data || '', grande_chanceler: s.grande_chanceler || '', assunto: s.assunto || '', texto: s.texto || CORPO_PADRAO_COMENDAS });
    const salvos = s.itens || [];
    setSelec(new Set(salvos.map(i => i.key)));
    // salvo mas não mais elegível → continua na lista como adicionado à mão
    setExtras(salvos.filter(i => !candidatosElegiveis.some(c => c.key === i.key)).map(i => ({ ...i, extra: true })));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const novo = () => {
    setEditandoId(null); setExtras([]);
    setForm(f => ({ ...FORM_VAZIO, grande_chanceler: f.grande_chanceler }));
    setSelec(new Set(candidatosElegiveis.map(c => c.key)));
  };

  const excluir = async (s) => {
    if (!window.confirm(`Excluir a prancha ${s.prancha_numero} (GLEMT ${s.glemt_numero})?`)) return;
    const { data, error } = await supabase.from('comendas_pranchas_glemt').delete().eq('id', s.id).select();
    if (error || !data || data.length === 0) { showError('Erro ao excluir' + (error ? ': ' + error.message : ' (sem permissão).')); return; }
    showSuccess('Prancha excluída.');
    if (editandoId === s.id) novo();
    carregar();
  };

  const total = candidatos.filter(c => selec.has(c.key)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {semTabela && (
        <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.85rem', fontSize: '0.8rem', color: '#b45309' }}>
          ⚠️ Tabela ainda não criada. Rode o SQL <strong>comendas_pranchas_glemt.sql</strong> no Supabase.
        </div>
      )}

      <div style={sCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <p style={{ fontWeight: 700, color: 'var(--color-text)', margin: 0, fontSize: '0.95rem' }}>
            {editandoId ? '✏️ Editando prancha' : '📨 Nova prancha à GLEMT'}
          </p>
          {editandoId && <button onClick={novo} style={{ padding: '0.3rem 0.8rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.78rem' }}>+ Nova</button>}
        </div>

        <label style={sLabel}>Prancha da Loja (Expedientes → Pranchas)</label>
        <select value={form.prancha_expedida_id} onChange={e => setForm(f => ({ ...f, prancha_expedida_id: e.target.value }))} style={sInp}>
          <option value="">— Escolha a prancha já cadastrada —</option>
          {pranchasOrdenadas.map(p => (
            <option key={p.id} value={p.id}>{p.numero_prancha} · {fmtD(p.data_prancha)} · {p.assunto || 'sem assunto'}{usadas.has(String(p.id)) ? ' (já usada)' : ''}</option>
          ))}
        </select>
        {pranchas.length === 0 && <p style={{ fontSize: '0.78rem', color: '#b45309', margin: '0.4rem 0 0' }}>Nenhuma prancha cadastrada. Cadastre primeiro em Expedientes → Pranchas para obter o número.</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
          <div><label style={sLabel}>Prancha nº (GLEMT)</label>
            <input style={sInp} placeholder="083/2024-2027 – Grão Mestrado" value={form.glemt_numero} onChange={e => setForm(f => ({ ...f, glemt_numero: e.target.value }))} /></div>
          <div><label style={sLabel}>Oriente</label>
            <input style={sInp} placeholder="Cuiabá-MT" value={form.glemt_oriente} onChange={e => setForm(f => ({ ...f, glemt_oriente: e.target.value }))} /></div>
          <div><label style={sLabel}>Data de expedição da prancha</label>
            <input type="date" style={sInp} value={form.glemt_data} onChange={e => setForm(f => ({ ...f, glemt_data: e.target.value }))} /></div>
          <div><label style={sLabel}>Grande Chanceler do Selo</label>
            <input style={sInp} placeholder="Nome do Grande Chanceler" value={form.grande_chanceler} onChange={e => setForm(f => ({ ...f, grande_chanceler: e.target.value }))} /></div>
        </div>

        <label style={{ ...sLabel, marginTop: '1rem' }}>Assunto (opcional)</label>
        <input style={sInp} placeholder={`Resposta à Prancha nº ${form.glemt_numero || '…'} – Informações para entrega de Comendas`} value={form.assunto} onChange={e => setForm(f => ({ ...f, assunto: e.target.value }))} />

        <label style={{ ...sLabel, marginTop: '1rem' }}>Texto da prancha</label>
        <textarea rows={9} style={{ ...sInp, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical' }} value={form.texto} onChange={e => setForm(f => ({ ...f, texto: e.target.value }))} />
        <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '0.3rem 0 0' }}>
          {'{relacao_comendas}'} marca onde entra a lista de irmãos. Também valem {'{glemt_numero}'}, {'{glemt_oriente}'}, {'{glemt_data_extenso}'}, {'{grande_chanceler}'} e {'{nome_loja}'}. Trechos entre *asteriscos* saem em negrito.
          <button onClick={() => setForm(f => ({ ...f, texto: CORPO_PADRAO_COMENDAS }))} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '0.72rem', textDecoration: 'underline' }}>restaurar texto padrão</button>
        </p>
      </div>

      <div style={sCard}>
        <p style={{ fontWeight: 700, color: 'var(--color-text)', margin: '0 0 0.25rem', fontSize: '0.95rem' }}>Irmãos a indicar <span style={{ color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.8rem' }}>({total} marcado(s))</span></p>
        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0 0 0.85rem' }}>
          Já vêm marcados os elegíveis de cada comenda da Grande Loja (os mesmos da aba Elegíveis). Desmarque quem não deve constar ou adicione outro irmão.
        </p>
        {comendasGL.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Nenhuma comenda ativa da Grande Loja.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {comendasGL.map(c => {
            const lista = candidatos.filter(x => x.comendaId === c.id);
            const livres = irmaos.filter(i => !lista.some(x => String(x.irmaoId) === String(i.id))).sort((a, b) => a.nome.localeCompare(b.nome));
            return (
              <div key={c.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.55rem 0.85rem', background: 'var(--color-surface-2)' }}>
                  <strong style={{ fontSize: '0.86rem', color: 'var(--color-text)' }}>{c.nome} <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>({lista.filter(x => selec.has(x.key)).length}/{lista.length})</span></strong>
                  {lista.length > 0 && (
                    <span style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem' }}>
                      <button onClick={() => marcarComenda(c.id, true)} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer' }}>marcar todos</button>
                      <button onClick={() => marcarComenda(c.id, false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>limpar</button>
                    </span>
                  )}
                </div>
                {lista.length === 0 ? (
                  <p style={{ margin: 0, padding: '0.6rem 0.85rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Nenhum elegível no momento.</p>
                ) : lista.map(it => (
                  <label key={it.key} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.85rem', cursor: 'pointer', fontSize: '0.84rem', color: 'var(--color-text)', borderTop: '1px solid var(--color-border)' }}>
                    <input type="checkbox" checked={selec.has(it.key)} onChange={() => toggle(it.key)} />
                    <span style={{ flex: 1 }}>{it.nome}{it.extra && <span style={{ marginLeft: '0.4rem', fontSize: '0.68rem', color: '#b45309', fontWeight: 700 }}>adicionado</span>}</span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>{it.cim ? `CIM ${it.cim}` : ''}{it.detalhe ? ` · ${it.detalhe}` : ''}</span>
                  </label>
                ))}
                <div style={{ padding: '0.4rem 0.85rem', borderTop: '1px solid var(--color-border)' }}>
                  <select value="" onChange={e => { adicionarIrmao(c, e.target.value); }} style={{ ...sInp, fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}>
                    <option value="">➕ Adicionar outro irmão a esta comenda…</option>
                    {livres.map(i => <option key={i.id} value={i.id}>{i.nome}{i.cim ? ` — CIM ${i.cim}` : ''}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '1rem' }}>
          <button disabled={!!ocupado} onClick={async () => { setOcupado('salvar'); const r = await salvar(); setOcupado(''); if (r) showSuccess('Prancha salva.'); }}
            style={{ padding: '0.55rem 1.1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: ocupado ? 'not-allowed' : 'pointer' }}>
            {ocupado === 'salvar' ? '⏳ Salvando...' : '💾 Salvar'}
          </button>
          <button disabled={!!ocupado} onClick={() => gerar('docx')}
            style={{ padding: '0.55rem 1.1rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: ocupado ? 'not-allowed' : 'pointer' }}>
            {ocupado === 'docx' ? '⏳ Gerando...' : '📄 Salvar e gerar Word'}
          </button>
          <button disabled={!!ocupado} onClick={() => gerar('pdf')}
            style={{ padding: '0.55rem 1.1rem', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: ocupado ? 'not-allowed' : 'pointer' }}>
            {ocupado === 'pdf' ? '⏳ Gerando...' : '📕 Salvar e gerar PDF'}
          </button>
        </div>
      </div>

      <div style={sCard}>
        <p style={{ fontWeight: 700, color: 'var(--color-text)', margin: '0 0 0.75rem', fontSize: '0.95rem' }}>📜 Pranchas geradas</p>
        {salvas.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', margin: 0, padding: '0.75rem' }}>Nenhuma prancha salva ainda.</p>
        ) : salvas.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', padding: '0.5rem 0', borderBottom: i < salvas.length - 1 ? '1px solid var(--color-border)' : 'none', fontSize: '0.84rem' }}>
            <strong style={{ color: 'var(--color-accent)', minWidth: '78px' }}>{s.prancha_numero}</strong>
            <span style={{ color: 'var(--color-text-muted)', minWidth: '78px' }}>{fmtD(s.prancha_data)}</span>
            <span style={{ flex: 1, color: 'var(--color-text)' }}>Resposta à prancha GLEMT {s.glemt_numero} · {(s.itens || []).length} irmão(s)</span>
            <button onClick={() => editar(s)} style={{ padding: '0.25rem 0.6rem', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.75rem' }}>✏️ Editar</button>
            <button disabled={!!ocupado} onClick={() => gerar('docx', s)} style={{ padding: '0.25rem 0.6rem', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.75rem' }}>📄 Word</button>
            <button disabled={!!ocupado} onClick={() => gerar('pdf', s)} style={{ padding: '0.25rem 0.6rem', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.75rem' }}>📕 PDF</button>
            <button onClick={() => excluir(s)} style={{ padding: '0.25rem 0.6rem', border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#ef4444', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.75rem' }}>🗑️</button>
          </div>
        ))}
      </div>
    </div>
  );
}
