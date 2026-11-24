import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { montarArvore } from '../recursospublicos/comum';

// Quadro do Controle de Acesso: acessos de entes públicos ao módulo de Comodato.
const fmt = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export default function EntePublicoAcessos() {
  const [carregando, setCarregando] = useState(true);
  const [entes, setEntes] = useState([]);
  const [logs, setLogs] = useState([]);
  const [aberto, setAberto] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [u, o] = await Promise.all([
          supabase.from('usuarios').select('id, nome, email, ativo, ente_origem_id, ente_acesso_estendido').eq('nivel_acesso', 'ente_publico').order('nome'),
          supabase.from('comodato_origens_recurso').select('id, nome, parent_id'),
        ]);
        let od = o.data;
        if (o.error) od = (await supabase.from('comodato_origens_recurso').select('id, nome')).data;
        const orig = {}; montarArvore(od || []).forEach(x => { orig[x.id] = x.caminho; });
        const lista = (u.data || []).map(x => ({ ...x, entidade: orig[x.ente_origem_id] || '—' }));
        setEntes(lista);
        if (lista.length) {
          const { data } = await supabase.from('logs_acesso').select('*').in('usuario_id', lista.map(x => x.id)).order('created_at', { ascending: false }).limit(300);
          setLogs(data || []);
        }
      } catch (e) { console.error(e); } finally { setCarregando(false); }
    })();
  }, []);

  const hoje = new Date().toISOString().substring(0, 10);
  const doEnte = (id) => logs.filter(l => l.usuario_id === id);

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid rgba(16,185,129,0.5)', borderLeft: '4px solid #10b981', borderRadius: 'var(--radius-xl)', marginBottom: '1.25rem', overflow: 'hidden' }}>
      <button onClick={() => setAberto(a => !a)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 1rem', background: 'var(--color-surface-2)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div>
          <div style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '0.98rem' }}>🏛️ Controle de Acesso — Ente Público (Controle de Comodato)</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{entes.length} usuário(s) de ente público • acessos de hoje: {logs.filter(l => String(l.created_at).startsWith(hoje) && l.acao === 'acesso_sistema').length}</div>
        </div>
        <span style={{ color: 'var(--color-text-muted)' }}>{aberto ? '▲' : '▼'}</span>
      </button>
      {aberto && (
        <div style={{ padding: '0.8rem 1rem' }}>
          {carregando ? <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Carregando...</p>
            : entes.length === 0 ? <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0 }}>Nenhum acesso de ente público criado.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {entes.map(e => {
                  const l = doEnte(e.id); const logins = l.filter(x => x.acao === 'acesso_sistema');
                  return (
                    <div key={e.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.55rem 0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{e.nome}</span>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}> • {e.entidade}{e.ente_acesso_estendido ? ' • 🔓 estendido' : ''}{e.ativo === false ? ' • inativo' : ''}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                          {logins.length} acesso(s) • último: <strong style={{ color: 'var(--color-text)' }}>{fmt(logins[0]?.created_at)}</strong>
                        </div>
                      </div>
                      {l.length > 0 && (
                        <details style={{ marginTop: '0.35rem' }}>
                          <summary style={{ cursor: 'pointer', fontSize: '0.76rem', color: 'var(--color-accent)', fontWeight: 600 }}>Ver atividade ({l.length})</summary>
                          <div style={{ maxHeight: '12rem', overflowY: 'auto', marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            {l.slice(0, 60).map(x => (
                              <div key={x.id} style={{ display: 'flex', gap: '0.6rem', fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                                <span style={{ whiteSpace: 'nowrap' }}>{fmt(x.created_at)}</span>
                                <span style={{ color: 'var(--color-text)' }}>{x.acao === 'acesso_sistema' ? 'Entrou no sistema' : (x.detalhes || x.acao)}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
