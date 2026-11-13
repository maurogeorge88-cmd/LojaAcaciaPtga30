/**
 * CALENDÁRIO ANUAL MAÇÔNICO
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { corDoTipo, corDoEvento, rotuloDoTipo, TIPOS_EVENTO, NOME_GRAU_CRONOGRAMA } from './tiposEvento';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const pad = (n) => String(n).padStart(2, '0');
const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function CalendarioAnual({ eventos = [], ano = new Date().getFullYear() }) {
  // Abre no semestre vigente quando o ano exibido é o ano atual
  const [semestre, setSemestre] = useState(() => (ano === new Date().getFullYear() && new Date().getMonth() >= 6 ? 2 : 1));
  const [eventosSelecionados, setEventosSelecionados] = useState([]);
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [simboloMasonico, setSimboloMasonico] = useState(null);
  const hoje = hojeLocal();

  useEffect(() => {
    const carregarSimbolo = async () => {
      try {
        const { data } = await supabase.from('dados_loja').select('simbolo_masonico_url').single();
        if (data?.simbolo_masonico_url) setSimboloMasonico(data.simbolo_masonico_url);
      } catch (error) {
        // sem símbolo configurado: segue sem ele
      }
    };
    carregarSimbolo();
  }, []);

  // Esc fecha a janela de eventos do dia
  useEffect(() => {
    if (eventosSelecionados.length === 0) return undefined;
    const aoTeclar = (e) => { if (e.key === 'Escape') { setEventosSelecionados([]); setDiaSelecionado(null); } };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [eventosSelecionados]);

  const dataStr = (dia, mesIndex) => `${ano}-${pad(mesIndex + 1)}-${pad(dia)}`;

  const getDiasMes = (mes) => {
    const primeiroDia = new Date(ano, mes, 1);
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const dias = [];
    for (let i = 0; i < primeiroDia.getDay(); i++) dias.push(null);
    for (let dia = 1; dia <= diasNoMes; dia++) dias.push(dia);
    return dias;
  };

  const getEventosDia = (dia, mesIndex) => (dia ? eventos.filter(e => e.data === dataStr(dia, mesIndex)) : []);

  const buscarDetalhesEventos = async (dia, mesIndex) => {
    const { data } = await supabase.from('cronograma').select('*').eq('data_evento', dataStr(dia, mesIndex));
    return data || [];
  };

  const qtdEventosMes = (mesIndex) => eventos.filter(e => String(e.data || '').startsWith(`${ano}-${pad(mesIndex + 1)}`)).length;

  const renderMes = (mesIndex) => {
    const dias = getDiasMes(mesIndex);
    const qtd = qtdEventosMes(mesIndex);

    return (
      <div key={mesIndex} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        {/* Cabeçalho do mês */}
        <div style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', borderTop: '3px solid var(--color-accent)', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--color-text)' }}>{MESES[mesIndex].toUpperCase()}</h3>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            {qtd > 0 ? `${qtd} evento${qtd === 1 ? '' : 's'}` : ano}
            {simboloMasonico && <img src={simboloMasonico} alt="" style={{ width: '1.2rem', height: '1.2rem', objectFit: 'contain', opacity: 0.8 }} />}
          </span>
        </div>

        {/* Dias da semana */}
        <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--color-border)' }}>
          {DIAS_SEMANA.map((dia, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '0.35rem 0', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{dia}</div>
          ))}
        </div>

        {/* Grade de dias */}
        <div className="grid grid-cols-7">
          {dias.map((dia, index) => {
            const eventosHoje = getEventosDia(dia, mesIndex);
            const temEvento = eventosHoje.length > 0;
            const ehHoje = !!dia && dataStr(dia, mesIndex) === hoje;
            return (
              <div
                key={index}
                onClick={async () => {
                  if (!temEvento) return;
                  const detalhes = await buscarDetalhesEventos(dia, mesIndex);
                  setDiaSelecionado(`${pad(dia)}/${pad(mesIndex + 1)}/${ano}`);
                  setEventosSelecionados(detalhes);
                }}
                title={temEvento ? eventosHoje.map(e => e.titulo).join(', ') : ''}
                style={{
                  minHeight: '3.1rem', padding: '0.3rem 0.35rem', position: 'relative',
                  border: ehHoje ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                  background: temEvento ? 'var(--color-accent-bg)' : 'transparent',
                  cursor: temEvento ? 'pointer' : 'default',
                }}
              >
                {dia && (
                  <>
                    <div style={{ fontSize: '0.82rem', fontWeight: temEvento || ehHoje ? 800 : 500, color: temEvento ? 'var(--color-accent)' : 'var(--color-text)' }}>{dia}</div>
                    {temEvento && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '0.25rem' }}>
                        {eventosHoje.slice(0, 3).map((evento, i) => (
                          <span key={i} title={evento.titulo} style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: evento.cor || corDoTipo(evento.tipo) }} />
                        ))}
                        {eventosHoje.length > 3 && <span style={{ fontSize: '0.55rem', color: 'var(--color-accent)', marginLeft: '2px' }}>+{eventosHoje.length - 3}</span>}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const mesesSemestre = semestre === 1 ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11];
  const tiposPresentes = TIPOS_EVENTO.filter(t => eventos.some(e => e.tipo === t.value));
  const fecharDia = () => { setEventosSelecionados([]); setDiaSelecionado(null); };

  return (
    <div>
      {/* Barra: ano e semestre */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          📅 Calendário {ano}
          {simboloMasonico && <img src={simboloMasonico} alt="" style={{ width: '1.6rem', height: '1.6rem', objectFit: 'contain' }} />}
        </h3>
        <div style={{ display: 'inline-flex', gap: '0.25rem', padding: '0.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-lg)' }}>
          {[[1, '1º Semestre (Jan-Jun)'], [2, '2º Semestre (Jul-Dez)']].map(([valor, rotulo]) => (
            <button key={valor} onClick={() => setSemestre(valor)}
              style={{ padding: '0.45rem 1rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
                background: semestre === valor ? 'var(--color-accent)' : 'transparent', color: semestre === valor ? '#fff' : 'var(--color-text-muted)' }}>
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {/* Grade de meses */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {mesesSemestre.map(mesIndex => renderMes(mesIndex))}
      </div>

      {/* Legenda: só os tipos que existem */}
      {tiposPresentes.length > 0 && (
        <div style={{ marginTop: '1rem', padding: '0.8rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 1.1rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legenda</span>
          {tiposPresentes.map(t => (
            <span key={t.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--color-text)' }}>
              <span style={{ width: '0.7rem', height: '0.7rem', borderRadius: '50%', background: t.cor }} />
              {t.label.replace(/^\S+\s/, '')}
            </span>
          ))}
        </div>
      )}

      {/* Janela: eventos do dia */}
      {eventosSelecionados.length > 0 && (
        <div onClick={fecharDia} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: '3px solid var(--color-accent)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '40rem', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
            <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>📅 Eventos do dia</h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{diaSelecionado}</p>
              </div>
              <button onClick={fecharDia} aria-label="Fechar" title="Fechar (Esc)"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)', borderRadius: 'var(--radius-md)', width: '2.2rem', height: '2.2rem', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '1.1rem 1.4rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {eventosSelecionados.map((evento, i) => {
                const cor = corDoEvento(evento.tipo, evento.cor_destaque);
                return (
                  <div key={i} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderLeft: `4px solid ${cor}`, borderRadius: 'var(--radius-lg)', padding: '0.9rem 1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>{evento.titulo}</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
                      <span style={{ padding: '0.15rem 0.65rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, color: cor, background: `${cor}22`, border: `1px solid ${cor}66` }}>{rotuloDoTipo(evento.tipo)}</span>
                      {evento.grau_sessao_id && NOME_GRAU_CRONOGRAMA[evento.grau_sessao_id] && (
                        <span style={{ padding: '0.15rem 0.65rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border-light)' }}>
                          {NOME_GRAU_CRONOGRAMA[evento.grau_sessao_id]}
                        </span>
                      )}
                    </div>
                    {evento.descricao && <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>{evento.descricao}</p>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 1.2rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {evento.hora_inicio && <span>🕐 {String(evento.hora_inicio).substring(0, 5)}{evento.hora_fim && ` – ${String(evento.hora_fim).substring(0, 5)}`}</span>}
                      {evento.local && <span>📍 {evento.local}</span>}
                      {evento.responsavel && <span>👤 {evento.responsavel}</span>}
                    </div>
                    {evento.observacoes && <p style={{ margin: '0.6rem 0 0', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>📝 {evento.observacoes}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
