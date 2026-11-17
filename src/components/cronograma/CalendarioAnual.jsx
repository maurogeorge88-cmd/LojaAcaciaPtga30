/**
 * CALENDÁRIO — AGENDA MAÇÔNICA
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 *
 * Coluna esquerda: mini-calendários dos meses do período escolhido
 * (mensal / trimestral / semestral / anual — a escolha fica salva).
 * Coluna direita: agenda do mês selecionado, com os detalhes do evento na própria linha.
 */

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { corDoTipo, corDoEvento, rotuloDoTipo, TIPOS_EVENTO, NOME_GRAU_CRONOGRAMA } from './tiposEvento';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const DIAS_ABREV = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const PERIODOS = [
  { value: 'mensal', label: 'Mensal', tam: 1 },
  { value: 'trimestral', label: 'Trimestral', tam: 3 },
  { value: 'semestral', label: 'Semestral', tam: 6 },
  { value: 'anual', label: 'Anual', tam: 12 },
];
const STATUS_ROTULO = { planejado: 'Planejado', confirmado: 'Confirmado', realizado: 'Realizado', cancelado: 'Cancelado' };
const CHAVE_PERIODO = 'cronograma_calendario_periodo';
const pad = (n) => String(n).padStart(2, '0');
const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const lerPeriodo = () => {
  try {
    const v = localStorage.getItem(CHAVE_PERIODO);
    if (PERIODOS.some(p => p.value === v)) return v;
  } catch (e) { /* sem armazenamento: usa o padrão */ }
  return 'semestral';
};

export default function CalendarioAnual({ eventos = [], ano = new Date().getFullYear(), podeEditar = false, onEditar, onExcluir, onVisualizar }) {
  const hoje = hojeLocal();
  const [periodo, setPeriodo] = useState(lerPeriodo);
  const [mesSel, setMesSel] = useState(() => (ano === new Date().getFullYear() ? new Date().getMonth() : 0));
  const [diaDestaque, setDiaDestaque] = useState(null);
  const [expandidos, setExpandidos] = useState(() => new Set()); // eventos passados abertos pelo usuário
  const [simboloMasonico, setSimboloMasonico] = useState(null);
  const refsLinhas = useRef({});
  const refsMeses = useRef({});

  const tam = PERIODOS.find(p => p.value === periodo).tam;
  const blocoIni = Math.floor(mesSel / tam) * tam;
  const mesesBloco = Array.from({ length: tam }, (_, i) => blocoIni + i);

  useEffect(() => {
    const carregarSimbolo = async () => {
      try {
        const { data } = await supabase.from('dados_loja').select('simbolo_masonico_url').single();
        if (data?.simbolo_masonico_url) setSimboloMasonico(data.simbolo_masonico_url);
      } catch (error) { /* segue sem símbolo */ }
    };
    carregarSimbolo();
  }, []);

  const trocarPeriodo = (valor) => {
    setPeriodo(valor);
    try { localStorage.setItem(CHAVE_PERIODO, valor); } catch (e) { /* ignora */ }
  };

  const dataStr = (dia, mesIndex) => `${ano}-${pad(mesIndex + 1)}-${pad(dia)}`;
  const getDiasMes = (mes) => {
    const primeiroDia = new Date(ano, mes, 1);
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const dias = [];
    for (let i = 0; i < primeiroDia.getDay(); i++) dias.push(null);
    for (let dia = 1; dia <= diasNoMes; dia++) dias.push(dia);
    return dias;
  };
  const eventosDoDia = (ds) => eventos.filter(e => e.data_evento === ds);
  const eventosDoMes = (mesIndex) => eventos
    .filter(e => String(e.data_evento || '').startsWith(`${ano}-${pad(mesIndex + 1)}`))
    .sort((a, b) => (a.data_evento + (a.hora_inicio || '')).localeCompare(b.data_evento + (b.hora_inicio || '')));

  const irParaMes = (m) => { if (m >= 0 && m <= 11) { setMesSel(m); setDiaDestaque(null); } };
  const moverBloco = (dir) => {
    const novoIni = blocoIni + dir * tam;
    if (novoIni < 0 || novoIni > 11) return;
    const hojeNoBloco = ano === new Date().getFullYear() && new Date().getMonth() >= novoIni && new Date().getMonth() < novoIni + tam;
    irParaMes(hojeNoBloco ? new Date().getMonth() : novoIni);
  };

  const clicarDia = (ds, mesIndex) => {
    if (mesIndex !== mesSel) setMesSel(mesIndex);
    setDiaDestaque(ds);
    // Sessões que já passaram abrem os detalhes ao clicar no dia
    const doDia = eventosDoDia(ds).filter(e => e.data_evento < hoje);
    if (doDia.length) setExpandidos(prev => { const n = new Set(prev); doDia.forEach(e => n.add(e.id)); return n; });
  };

  const alternarExpandido = (id) => setExpandidos(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Rola a agenda até a primeira linha do dia destacado
  useEffect(() => {
    if (!diaDestaque) return;
    const primeira = eventosDoDia(diaDestaque)[0];
    const el = primeira && refsLinhas.current[primeira.id];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [diaDestaque, mesSel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mês selecionado sempre visível na coluna da esquerda
  useEffect(() => {
    const el = refsMeses.current[mesSel];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [mesSel, periodo]);

  const tiposPresentes = TIPOS_EVENTO.filter(t => eventos.some(e => e.tipo === t.value));
  const listaMes = eventosDoMes(mesSel);

  const renderMiniMes = (mesIndex) => {
    const dias = getDiasMes(mesIndex);
    const qtd = eventosDoMes(mesIndex).length;
    const selecionado = mesIndex === mesSel;
    return (
      <div key={mesIndex} ref={(el) => { refsMeses.current[mesIndex] = el; }}
        style={{ background: 'var(--color-surface)', border: selecionado ? '2px solid var(--color-accent)' : '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', flexShrink: 0 }}>
        <div onClick={() => irParaMes(mesIndex)} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') irParaMes(mesIndex); }}
          style={{ cursor: 'pointer', background: selecionado ? 'var(--color-accent-bg)' : 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', padding: '0.5rem 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.04em', color: selecionado ? 'var(--color-accent)' : 'var(--color-text)' }}>{MESES[mesIndex].toUpperCase()}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{qtd > 0 ? `${qtd} evento${qtd === 1 ? '' : 's'}` : '—'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0.25rem 0.35rem 0' }}>
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-text-muted)', padding: '0.15rem 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 0.35rem 0.4rem', rowGap: '1px' }}>
          {dias.map((dia, idx) => {
            if (!dia) return <div key={idx} />;
            const ds = dataStr(dia, mesIndex);
            const evs = eventosDoDia(ds);
            const tem = evs.length > 0;
            const ehHoje = ds === hoje;
            const dest = ds === diaDestaque;
            return (
              <div key={idx} onClick={() => { if (tem) clicarDia(ds, mesIndex); else irParaMes(mesIndex); }}
                title={tem ? evs.map(e => e.titulo).join(', ') : ''}
                style={{ textAlign: 'center', padding: '0.2rem 0', cursor: 'pointer', borderRadius: 'var(--radius-md)', minHeight: '2.1rem',
                  background: dest ? 'var(--color-accent)' : tem ? 'var(--color-accent-bg)' : 'transparent',
                  outline: ehHoje ? '2px solid var(--color-accent)' : 'none', outlineOffset: '-2px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: tem || ehHoje ? 800 : 500, color: dest ? '#fff' : tem ? 'var(--color-accent)' : 'var(--color-text)' }}>{dia}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', minHeight: '0.45rem', marginTop: '1px' }}>
                  {evs.slice(0, 3).map((ev, i) => (
                    <span key={i} style={{ width: '0.38rem', height: '0.38rem', borderRadius: '50%', background: dest ? '#fff' : corDoEvento(ev.tipo, ev.cor_destaque) }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderLinha = (ev) => {
    const cor = corDoEvento(ev.tipo, ev.cor_destaque);
    const d = new Date(ev.data_evento + 'T00:00:00');
    const dest = ev.data_evento === diaDestaque;
    const passado = ev.data_evento < hoje;
    const ehHoje = ev.data_evento === hoje;
    const cancelado = ev.status === 'cancelado';
    const compacto = passado && !expandidos.has(ev.id); // sessão que já passou: só título e tipo
    return (
      <div key={ev.id} ref={(el) => { refsLinhas.current[ev.id] = el; }}
        onClick={() => {
          if (passado) alternarExpandido(ev.id);
          setDiaDestaque(ev.data_evento === diaDestaque && !passado ? null : ev.data_evento);
        }}
        style={{ display: 'flex', gap: '0.9rem', padding: compacto ? '0.55rem 1rem' : '0.85rem 1rem', cursor: 'pointer', transition: 'background .2s',
          background: dest ? 'var(--color-accent-bg)' : 'transparent', borderBottom: '1px solid var(--color-border)',
          borderLeft: `4px solid ${dest ? 'var(--color-accent)' : cor}`, opacity: passado && !dest && !ehHoje ? 0.72 : 1 }}>
        <div style={{ width: '3.2rem', flexShrink: 0, textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1, color: ehHoje ? 'var(--color-accent)' : 'var(--color-text)' }}>{pad(d.getDate())}</div>
          <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>{DIAS_ABREV[d.getDay()]}</div>
          {ehHoje && <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#fff', background: 'var(--color-accent)', borderRadius: 999, marginTop: '0.25rem', padding: '0.05rem 0' }}>HOJE</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{ margin: compacto ? '0 0 0.3rem' : '0 0 0.45rem', fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text)', textDecoration: cancelado ? 'line-through' : 'none' }}>{ev.titulo}</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginBottom: compacto ? 0 : '0.45rem' }}>
            <span style={{ padding: '0.1rem 0.6rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, color: cor, background: `${cor}22`, border: `1px solid ${cor}66` }}>{rotuloDoTipo(ev.tipo)}</span>
            {!compacto && ev.tipo !== 'feriado' && ev.grau_sessao_id && NOME_GRAU_CRONOGRAMA[ev.grau_sessao_id] && (
              <span style={{ padding: '0.1rem 0.6rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border-light)' }}>{NOME_GRAU_CRONOGRAMA[ev.grau_sessao_id]}</span>
            )}
            {!compacto && ev.tipo !== 'feriado' && ev.status && ev.status !== 'planejado' && (
              <span style={{ padding: '0.1rem 0.6rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)' }}>{STATUS_ROTULO[ev.status] || ev.status}</span>
            )}
          </div>
          {!compacto && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 1.1rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {ev.hora_inicio && <span>🕐 {String(ev.hora_inicio).substring(0, 5)}{ev.hora_fim && ` – ${String(ev.hora_fim).substring(0, 5)}`}</span>}
            {ev.local && <span>📍 {ev.local}</span>}
            {ev.responsavel && <span>👤 {ev.responsavel}</span>}
          </div>}
          {!compacto && (ev.descricao || ev.observacoes) && <div style={{ marginTop: '0.6rem' }}>
            <div style={{ width: '4cm', maxWidth: '100%', height: '1px', background: 'var(--color-border-light)', marginBottom: '0.6rem' }} />
            {ev.descricao && <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>{ev.descricao}</p>}
            {ev.observacoes && <p style={{ margin: ev.descricao ? '0.5rem 0 0' : 0, fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap' }}>📝 {ev.observacoes}</p>}
          </div>}
        </div>
        {!compacto && (
          <div style={{ display: 'flex', gap: '0.4rem', alignSelf: 'flex-start', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            {onVisualizar && <button onClick={() => onVisualizar(ev)} title="Ver detalhes / enviar aos irmãos"
              style={{ padding: '0.25rem 0.55rem', background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', cursor: 'pointer' }}>👁️</button>}
            {podeEditar && <button onClick={() => onEditar && onEditar(ev)} title="Editar"
              style={{ padding: '0.25rem 0.55rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', cursor: 'pointer' }}>✏️</button>}
            {podeEditar && <button onClick={() => onExcluir && onExcluir(ev.id)} title="Excluir"
              style={{ padding: '0.25rem 0.55rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', cursor: 'pointer' }}>🗑️</button>}
          </div>
        )}
      </div>
    );
  };

  const btnSeta = (ativo) => ({ width: '2rem', height: '2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)', background: 'var(--color-bg)', color: ativo ? 'var(--color-text)' : 'var(--color-text-muted)', opacity: ativo ? 1 : 0.4, cursor: ativo ? 'pointer' : 'default', fontSize: '1rem', lineHeight: 1 });

  return (
    <div>
      <style>{`
        .cal-agenda { display: grid; grid-template-columns: minmax(250px, 320px) 1fr; gap: 1rem; align-items: start; }
        .cal-agenda-esq { max-height: 74vh; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; padding-right: 0.25rem; }
        @media (max-width: 900px) { .cal-agenda { grid-template-columns: 1fr; } .cal-agenda-esq { max-height: none; } }
      `}</style>

      {/* Barra: título, ano e período */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          📅 Calendário {ano}
          {simboloMasonico && <img src={simboloMasonico} alt="" style={{ width: '1.6rem', height: '1.6rem', objectFit: 'contain' }} />}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {ano === new Date().getFullYear() && (
            <button onClick={() => { setMesSel(new Date().getMonth()); setDiaDestaque(null); }}
              style={{ height: '2.2rem', padding: '0 0.9rem', background: 'transparent', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>Hoje</button>
          )}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            Exibir
            <select value={periodo} onChange={(e) => trocarPeriodo(e.target.value)}
              style={{ height: '2.2rem', padding: '0 0.7rem', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 600 }}>
              {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="cal-agenda">
        {/* Coluna esquerda: meses */}
        <div>
          {tam < 12 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <button onClick={() => moverBloco(-1)} disabled={blocoIni === 0} style={btnSeta(blocoIni > 0)} aria-label="Período anterior">◀</button>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                {tam === 1 ? MESES[blocoIni] : `${MESES[blocoIni].substring(0, 3)} – ${MESES[blocoIni + tam - 1].substring(0, 3)}`} {ano}
              </span>
              <button onClick={() => moverBloco(1)} disabled={blocoIni + tam > 11} style={btnSeta(blocoIni + tam <= 11)} aria-label="Próximo período">▶</button>
            </div>
          )}
          <div className="cal-agenda-esq">
            {(tam === 12 ? Array.from({ length: 12 }, (_, i) => i) : mesesBloco).map(renderMiniMes)}
          </div>
        </div>

        {/* Coluna direita: agenda do mês */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
          <div style={{ background: 'var(--color-surface-2)', borderTop: '3px solid var(--color-accent)', borderBottom: '1px solid var(--color-border)', padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={() => irParaMes(mesSel - 1)} disabled={mesSel === 0} style={btnSeta(mesSel > 0)} aria-label="Mês anterior">◀</button>
              <button onClick={() => irParaMes(mesSel + 1)} disabled={mesSel === 11} style={btnSeta(mesSel < 11)} aria-label="Próximo mês">▶</button>
              <h3 style={{ margin: '0 0 0 0.4rem', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.03em', color: 'var(--color-text)' }}>{MESES[mesSel].toUpperCase()} {ano}</h3>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{listaMes.length} evento{listaMes.length === 1 ? '' : 's'}</span>
          </div>
          {listaMes.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <p style={{ fontSize: '1.8rem', margin: '0 0 0.4rem' }}>📅</p>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Nenhum evento neste mês</p>
            </div>
          ) : listaMes.map(renderLinha)}
        </div>
      </div>

      {/* Legenda: só os tipos que existem */}
      {tiposPresentes.length > 0 && (
        <div style={{ marginTop: '1rem', padding: '0.8rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 1.1rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legenda</span>
          {tiposPresentes.map(t => (
            <span key={t.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--color-text)' }}>
              <span style={{ width: '0.7rem', height: '0.7rem', borderRadius: '50%', background: corDoTipo(t.value) }} />
              {t.label.replace(/^\S+\s/, '')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
