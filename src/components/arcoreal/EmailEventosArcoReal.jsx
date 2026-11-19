import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { tipoRotulo } from './tiposEventoArcoReal';

const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', marginBottom: '1.25rem' };
const campo = { width: '100%', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', outline: 'none', fontSize: '0.85rem' };
const btnPrim = { padding: '0.6rem 1.3rem', background: '#7c5e1e', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer' };
const OPCOES_DIAS = [
  { v: 3, l: '3 dias antes' }, { v: 2, l: '2 dias antes' }, { v: 1, l: '1 dia antes' }, { v: 0, l: 'No dia do evento' },
];
const fmtD = (d) => (d ? d.split('-').reverse().join('/') : '');
const tabelaAusente = (e) => /does not exist|schema cache|42P01|PGRST205/i.test(`${e?.code || ''} ${e?.message || ''}`);

// modo = 'manual' | 'automatico'
export default function EmailEventosArcoReal({ modo, showSuccess, showError, podeConfigurar }) {
  const [eventos, setEventos] = useState([]);
  const [membros, setMembros] = useState([]);
  const [eventoId, setEventoId] = useState('');
  const [selec, setSelec] = useState([]);
  const [busca, setBusca] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState([]);

  const [cfg, setCfg] = useState({ ativo: false, dias_antes: [2, 0] });
  const [felicAtivo, setFelicAtivo] = useState(false);
  const [salvandoFelic, setSalvandoFelic] = useState(false);
  const [semTabela, setSemTabela] = useState(false);
  const [avisos, setAvisos] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

  useEffect(() => {
    (async () => {
      const [ev, mb] = await Promise.all([
        supabase.from('arco_real_cronograma').select('id, titulo, tipo, data_evento, hora_inicio, status')
          .gte('data_evento', hoje).neq('status', 'cancelado').neq('tipo', 'feriado').order('data_evento', { ascending: true }),
        supabase.from('arco_real_membros').select('id, nome, email, situacao, homenagem')
          .eq('ativo', true).in('situacao', ['regular', 'licenciado']).not('email', 'is', null).neq('email', '').order('nome'),
      ]);
      setEventos(ev.data || []);
      const mbOk = (mb.data || []).filter(m => !m.homenagem);
      setMembros(mbOk);
      setSelec(mbOk.map(m => m.id)); // padrão: todos
      if (modo === 'automatico') carregarConfig();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const carregarConfig = async () => {
    const { data, error } = await supabase.from('arco_real_config_email').select('*').eq('tipo', 'lembrete_evento').maybeSingle();
    if (error) { if (tabelaAusente(error)) setSemTabela(true); return; }
    if (data) setCfg({ ativo: !!data.ativo, dias_antes: data.dias_antes || [2, 0] });
    const f = await supabase.from('arco_real_config_email').select('ativo').eq('tipo', 'felicitacao_aniversario').maybeSingle();
    setFelicAtivo(!!f.data?.ativo);
    const av = await supabase.from('arco_real_evento_aviso').select('id, dias_antes, destinatarios, enviado_em, arco_real_cronograma(titulo, data_evento)')
      .order('enviado_em', { ascending: false }).limit(15);
    setAvisos(av.data || []);
  };

  const salvarConfig = async (novo) => {
    setSalvando(true);
    try {
      const { error } = await supabase.from('arco_real_config_email')
        .upsert({ tipo: 'lembrete_evento', ativo: novo.ativo, dias_antes: novo.dias_antes, updated_at: new Date().toISOString() }, { onConflict: 'tipo' });
      if (error) throw error;
      setCfg(novo);
      showSuccess('✅ Configuração salva.');
    } catch (e) {
      showError('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const salvarFelic = async (ativo) => {
    setSalvandoFelic(true);
    try {
      const { error } = await supabase.from('arco_real_config_email')
        .upsert({ tipo: 'felicitacao_aniversario', ativo, dias_antes: [], updated_at: new Date().toISOString() }, { onConflict: 'tipo' });
      if (error) throw error;
      setFelicAtivo(ativo);
      showSuccess('✅ Configuração salva.');
    } catch (e) {
      showError('Erro ao salvar: ' + e.message);
    } finally {
      setSalvandoFelic(false);
    }
  };

  const toggleDia = (v) => {
    const dias = cfg.dias_antes.includes(v) ? cfg.dias_antes.filter(d => d !== v) : [...cfg.dias_antes, v];
    salvarConfig({ ...cfg, dias_antes: dias.sort((a, b) => b - a) });
  };

  const filtrados = membros.filter(m => m.nome.toLowerCase().includes(busca.toLowerCase()));
  const toggle = (id) => setSelec(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  const todosMarcados = filtrados.length > 0 && filtrados.every(m => selec.includes(m.id));
  const marcarTodos = () => setSelec(p => todosMarcados ? p.filter(id => !filtrados.some(m => m.id === id)) : [...new Set([...p, ...filtrados.map(m => m.id)])]);

  const enviar = async () => {
    if (!eventoId) { showError('Escolha o evento.'); return; }
    if (selec.length === 0) { showError('Selecione ao menos um destinatário.'); return; }
    setEnviando(true); setResultados([]);
    try {
      const { data: json, error } = await supabase.functions.invoke('enviar-email-arcoreal', {
        body: { acao: 'lembrete_evento_arcoreal', evento_id: Number(eventoId), membros_ids: selec },
      });
      if (error) throw error;
      if (!json?.ok) throw new Error(json?.erro || 'Erro desconhecido');
      setResultados(json.resultados || []);
      showSuccess(`✅ ${(json.resultados || []).filter(r => r.status === 'enviado').length} e-mail(s) enviado(s)!`);
    } catch (e) {
      showError('Erro ao enviar: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  // ───────────────────────── AUTOMÁTICO ─────────────────────────
  if (modo === 'automatico') {
    return (
      <>
        {semTabela && (
          <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.85rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#b45309' }}>
            ⚠️ Tabelas ainda não criadas. Rode o SQL <strong>arco_real_email_eventos.sql</strong> no Supabase.
          </div>
        )}
        <div style={card}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 0.4rem' }}>⏰ Lembrete automático de eventos</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '0 0 1rem' }}>
            Todo dia de manhã (08:00), o sistema avisa por e-mail os eventos do Cronograma que se aproximam. Vai para todos os membros do quadro (regulares e licenciados) com e-mail cadastrado. Cada evento é avisado uma vez por prazo. Feriados e eventos cancelados não são enviados.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', cursor: podeConfigurar && !semTabela ? 'pointer' : 'not-allowed', background: cfg.ativo ? 'rgba(16,185,129,0.1)' : 'var(--color-surface-2)', border: '1px solid ' + (cfg.ativo ? 'rgba(16,185,129,0.3)' : 'var(--color-border)'), marginBottom: '1rem' }}>
            <input type="checkbox" checked={cfg.ativo} disabled={!podeConfigurar || semTabela || salvando} onChange={e => salvarConfig({ ...cfg, ativo: e.target.checked })} />
            <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{cfg.ativo ? '▶ Envio automático ativo' : '⏸ Envio automático desligado'}</span>
          </label>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: '0 0 0.4rem' }}>Quando avisar</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            {OPCOES_DIAS.map(o => (
              <label key={o.v} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--color-text)', cursor: 'pointer' }}>
                <input type="checkbox" checked={cfg.dias_antes.includes(o.v)} disabled={!podeConfigurar || semTabela || salvando} onChange={() => toggleDia(o.v)} />
                {o.l}
              </label>
            ))}
          </div>
          {!podeConfigurar && <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>Somente quem pode editar membros altera esta configuração.</p>}
        </div>

        <div style={card}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 0.4rem' }}>🎂 Felicitações automáticas de aniversário</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '0 0 1rem' }}>
            Todo dia às 08:00, o sistema envia a mensagem de felicitações aos companheiros que fazem aniversário no dia (regulares e licenciados, com e-mail). Familiares não recebem. Cada companheiro é felicitado uma vez por ano. O 1º Principal e o Administrador recebem um informativo de quem foi felicitado.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', cursor: podeConfigurar && !semTabela ? 'pointer' : 'not-allowed', background: felicAtivo ? 'rgba(16,185,129,0.1)' : 'var(--color-surface-2)', border: '1px solid ' + (felicAtivo ? 'rgba(16,185,129,0.3)' : 'var(--color-border)') }}>
            <input type="checkbox" checked={felicAtivo} disabled={!podeConfigurar || semTabela || salvandoFelic} onChange={e => salvarFelic(e.target.checked)} />
            <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{felicAtivo ? '▶ Felicitações automáticas ativas' : '⏸ Felicitações automáticas desligadas'}</span>
          </label>
        </div>

        <div style={card}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 0.75rem' }}>📜 Últimos avisos automáticos</h3>
          {avisos.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1rem', margin: 0 }}>Nenhum aviso automático enviado ainda.</p>
          ) : avisos.map((a, i) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', padding: '0.4rem 0', borderBottom: i < avisos.length - 1 ? '1px solid var(--color-border)' : 'none', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--color-text)' }}>{a.arco_real_cronograma?.titulo || 'Evento'} · {fmtD(a.arco_real_cronograma?.data_evento)}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>{a.dias_antes === 0 ? 'no dia' : `${a.dias_antes} dia(s) antes`} · {a.destinatarios ?? '—'} destinatário(s) · {new Date(a.enviado_em).toLocaleString('pt-BR')}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  // ───────────────────────── MANUAL ─────────────────────────
  return (
    <>
      <div style={card}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 0.75rem' }}>📅 Enviar lembrete de evento</h3>
        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Evento</label>
        <select value={eventoId} onChange={e => setEventoId(e.target.value)} style={campo}>
          <option value="">— Escolha um evento futuro —</option>
          {eventos.map(ev => (
            <option key={ev.id} value={ev.id}>{fmtD(ev.data_evento)}{ev.hora_inicio ? ` ${String(ev.hora_inicio).substring(0, 5)}` : ''} — {ev.titulo} ({tipoRotulo(ev.tipo)})</option>
          ))}
        </select>
        {eventos.length === 0 && <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Nenhum evento futuro no Cronograma.</p>}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" placeholder="🔍 Buscar membro..." value={busca} onChange={e => setBusca(e.target.value)} style={{ ...campo, flex: 1, minWidth: '200px', width: 'auto' }} />
          <button onClick={marcarTodos} style={{ padding: '0.5rem 1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
            {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
          </button>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0 0 0.6rem' }}>{selec.length} de {membros.length} destinatário(s) selecionado(s) — só aparecem membros ativos com e-mail.</p>
        <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {filtrados.map(m => (
            <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.75rem', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text)' }}>
              <input type="checkbox" checked={selec.includes(m.id)} onChange={() => toggle(m.id)} />
              <span style={{ flex: 1 }}>{m.nome}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{m.email}</span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <button onClick={enviar} disabled={enviando} style={{ ...btnPrim, opacity: enviando ? 0.6 : 1 }}>{enviando ? '⏳ Enviando...' : `✉️ Enviar para ${selec.length}`}</button>
        </div>
      </div>

      {resultados.length > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 0.75rem' }}>Resultado do Envio</h3>
          {resultados.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--color-text)' }}>{r.nome}</span>
              <span style={{ fontWeight: 700, color: r.status === 'enviado' ? '#10b981' : '#ef4444' }}>{r.status === 'enviado' ? '✓ Enviado' : '✗ Erro'}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
