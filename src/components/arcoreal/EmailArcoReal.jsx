import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

// Versão enxuta do EmailIrmaos.jsx da Loja — só o modo "Lembrete Financeiro",
// chamando a Edge Function irmã (enviar-email-arcoreal) em vez da da Loja.
export default function EmailArcoReal({ showSuccess, showError, permissoes }) {
  const podeEnviarEmail = !!permissoes?.canViewFinancial;

  const [membros, setMembros] = useState([]);
  const [membrosSelec, setMembrosSelec] = useState([]);
  const [filtroBusca, setFiltroBusca] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => { carregarMembros(); carregarLogs(); }, []);

  const carregarMembros = async () => {
    const { data } = await supabase
      .from('arco_real_membros')
      .select('id, nome, email, situacao')
      .not('email', 'is', null)
      .neq('email', '')
      .eq('ativo', true)
      .order('nome');
    setMembros(data || []);
  };

  const carregarLogs = async () => {
    const { data } = await supabase
      .from('log_email_irmao')
      .select('*')
      .eq('tipo', 'lembrete_financeiro_arcoreal')
      .order('enviado_em', { ascending: false })
      .limit(50);
    setLogs(data || []);
  };

  const filtrados = membros.filter(m => m.nome.toLowerCase().includes(filtroBusca.toLowerCase()));

  const toggleMembro = (id) => {
    setMembrosSelec(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selecionarTodos = () => {
    if (membrosSelec.length === filtrados.length) setMembrosSelec([]);
    else setMembrosSelec(filtrados.map(m => m.id));
  };

  const enviar = async () => {
    if (!podeEnviarEmail) { showError('Você não tem permissão para enviar e-mails.'); return; }
    if (membrosSelec.length === 0) { showError('Selecione ao menos um membro.'); return; }

    setEnviando(true);
    setResultados([]);
    try {
      const { data: json, error } = await supabase.functions.invoke('enviar-email-arcoreal', {
        body: { acao: 'lembrete_financeiro_arcoreal', membros_ids: membrosSelec },
      });
      if (error) throw error;
      if (!json?.ok) throw new Error(json?.erro || 'Erro desconhecido');
      setResultados(json.resultados || []);
      const enviados = (json.resultados || []).filter(r => r.status === 'enviado').length;
      showSuccess(`✅ ${enviados} e-mail(s) enviado(s) com sucesso!`);
      carregarLogs();
    } catch (e) {
      showError('Erro ao enviar: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (!podeEnviarEmail) {
    return (
      <div className="p-10 text-center" style={{ color: 'var(--color-text-muted)' }}>
        <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</p>
        <p>Você não tem permissão para acessar esta tela.</p>
      </div>
    );
  }

  return (
    <div className="p-6" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)', margin: '0 0 0.3rem' }}>✉️ Lembrete Financeiro — Arco Real</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>
        Envia e-mail só para quem está com pendência — quem estiver em dia é pulado automaticamente.
      </p>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text" placeholder="🔍 Buscar membro..." value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)}
            style={{ flex: 1, minWidth: '200px', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', outline: 'none', fontSize: '0.85rem' }}
          />
          <button onClick={selecionarTodos}
            style={{ padding: '0.5rem 1rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.82rem' }}>
            {membrosSelec.length === filtrados.length && filtrados.length > 0 ? 'Desmarcar Todos' : 'Marcar Todos'}
          </button>
        </div>

        <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {filtrados.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1.5rem', margin: 0 }}>Nenhum membro com e-mail cadastrado.</p>
          ) : filtrados.map((m, idx) => (
            <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.85rem', cursor: 'pointer', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', borderBottom: idx < filtrados.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
              <input type="checkbox" checked={membrosSelec.includes(m.id)} onChange={() => toggleMembro(m.id)} style={{ width: '15px', height: '15px', cursor: 'pointer', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: '0.86rem' }}>{m.nome}</p>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{m.email}</p>
              </div>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{membrosSelec.length} selecionado(s)</span>
          <button onClick={enviar} disabled={enviando || membrosSelec.length === 0}
            style={{ padding: '0.6rem 1.4rem', background: (enviando || membrosSelec.length === 0) ? 'var(--color-surface-2)' : '#7c5e1e', color: (enviando || membrosSelec.length === 0) ? 'var(--color-text-muted)' : '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: (enviando || membrosSelec.length === 0) ? 'not-allowed' : 'pointer' }}>
            {enviando ? '⏳ Enviando...' : '✉️ Enviar Lembrete'}
          </button>
        </div>
      </div>

      {resultados.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 0.75rem' }}>Resultado do Envio</h3>
          {resultados.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: i < resultados.length - 1 ? '1px solid var(--color-border)' : 'none', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--color-text)' }}>{r.nome}</span>
              <span style={{ fontWeight: 700, color: r.status === 'enviado' ? '#10b981' : r.status === 'pulado_sem_pendencia' ? 'var(--color-text-muted)' : '#ef4444' }}>
                {r.status === 'enviado' ? '✓ Enviado' : r.status === 'pulado_sem_pendencia' ? '— Sem pendência' : '✗ Erro'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 0.75rem' }}>📜 Histórico de Envios</h3>
        {logs.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1rem', margin: 0 }}>Nenhum envio registrado ainda.</p>
        ) : logs.map((l, i) => (
          <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: i < logs.length - 1 ? '1px solid var(--color-border)' : 'none', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--color-text)' }}>{l.destinatario_nome}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{new Date(l.enviado_em).toLocaleString('pt-BR')}</span>
            <span style={{ fontWeight: 700, color: l.status === 'enviado' ? '#10b981' : '#ef4444' }}>{l.status === 'enviado' ? '✓' : '✗'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
