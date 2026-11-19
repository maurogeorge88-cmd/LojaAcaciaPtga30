import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import EmailEventosArcoReal from './EmailEventosArcoReal';
import { proximoAniversario } from '../../utils/arcoRealMembros';

// Mesma estrutura do EmailIrmaos.jsx da Loja: tipos de envio em cartões
// empilhados à esquerda, conteúdo do tipo escolhido à direita.
// Chama a Edge Function irmã (enviar-email-arcoreal) em vez da da Loja.
const TIPOS_LOG = ['lembrete_financeiro_arcoreal', 'resumo_pendencias_arcoreal', 'lembrete_evento_arcoreal', 'felicitacao_aniversario_arcoreal'];
const PERIODOS_FELIC = [['hoje', 'Hoje'], ['semana', 'Próximos 7 dias'], ['mes', 'Este mês']];
export default function EmailArcoReal({ showSuccess, showError, permissoes }) {
  const podeEnviarEmail = !!permissoes?.canViewFinancial; // e-mails financeiros
  const podeEventos = !!(permissoes?.canViewFinancial || permissoes?.canEditMembers); // lembrete de eventos
  const podeConfigurarEventos = !!permissoes?.canEditMembers;

  const [membros, setMembros] = useState([]);
  const [membrosSelec, setMembrosSelec] = useState([]);
  const [filtroBusca, setFiltroBusca] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [logs, setLogs] = useState([]);
  const [statusPorMembro, setStatusPorMembro] = useState({}); // id -> 'vencido' | 'ok'
  const [aba, setAba] = useState(permissoes?.canViewFinancial ? 'individual' : 'eventos'); // 'individual' | 'resumo' | 'eventos' | 'automatico'
  const [destinatariosResumo, setDestinatariosResumo] = useState([]);
  const [filtroBuscaResumo, setFiltroBuscaResumo] = useState('');
  const [enviandoResumo, setEnviandoResumo] = useState(false);
  const [resultadosResumo, setResultadosResumo] = useState([]);
  const [periodoFelic, setPeriodoFelic] = useState('semana');
  const [felicSelec, setFelicSelec] = useState([]);
  const [enviandoFelic, setEnviandoFelic] = useState(false);
  const [resultadosFelic, setResultadosFelic] = useState([]);
  const [felicitadosAno, setFelicitadosAno] = useState({}); // nome -> true (já felicitado este ano)

  useEffect(() => { carregarMembros(); carregarLogs(); carregarDirigentesPadrao(); carregarFelicitados(); }, []);

  // Pré-marca quem hoje ocupa Tesoureiro e 1º Principal — só um ponto de
  // partida, dá pra marcar/desmarcar qualquer um livremente depois.
  const carregarDirigentesPadrao = async () => {
    const anoAtual = String(new Date().getFullYear());
    const { data } = await supabase
      .from('arco_real_corpo_administrativo')
      .select('membro_id, cargo')
      .eq('ano_exercicio', anoAtual)
      .in('cargo', ['Tesoureiro', '1º Principal']);
    setDestinatariosResumo((data || []).map(d => d.membro_id));
  };

  const carregarMembros = async () => {
    const { data } = await supabase
      .from('arco_real_membros')
      .select('id, nome, email, situacao, data_nascimento, homenagem')
      .not('email', 'is', null)
      .neq('email', '')
      .eq('ativo', true)
      .order('nome');
    const lista = (data || []).filter(m => !m.homenagem);
    setMembros(lista);
    if (lista.length > 0) carregarStatusFinanceiro(lista.map(m => m.id));
  };

  // Mesma regra da Edge Function: só o que já venceu conta como débito de
  // verdade (crédito do membro abate o vencido primeiro). "A vencer" não
  // deixa a bolinha vermelha — é só aviso, não é dívida ainda.
  const carregarStatusFinanceiro = async (idsMembros) => {
    const { data } = await supabase
      .from('arco_real_lancamentos')
      .select('origem_membro_id, valor, tipo, data_vencimento')
      .in('origem_membro_id', idsMembros)
      .eq('status', 'pendente');

    const hoje = new Date().toISOString().split('T')[0];
    const porMembro = {};
    (data || []).forEach(l => {
      const id = l.origem_membro_id;
      if (!porMembro[id]) porMembro[id] = { vencido: 0, credito: 0 };
      if (l.tipo === 'receita' && l.data_vencimento < hoje) porMembro[id].vencido += Number(l.valor || 0);
      if (l.tipo === 'despesa') porMembro[id].credito += Number(l.valor || 0);
    });

    const status = {};
    idsMembros.forEach(id => {
      const v = porMembro[id];
      status[id] = (v && (v.vencido - v.credito) > 0) ? 'vencido' : 'ok';
    });
    setStatusPorMembro(status);
  };

  const carregarLogs = async () => {
    const { data } = await supabase
      .from('log_email_irmao')
      .select('*')
      .in('tipo', podeEnviarEmail ? TIPOS_LOG : ['lembrete_evento_arcoreal', 'felicitacao_aniversario_arcoreal'])
      .order('enviado_em', { ascending: false })
      .limit(50);
    setLogs(data || []);
  };

  const carregarFelicitados = async () => {
    const { data } = await supabase
      .from('log_email_irmao')
      .select('destinatario_nome, status')
      .eq('tipo', 'felicitacao_aniversario_arcoreal')
      .gte('enviado_em', `${new Date().getFullYear()}-01-01`);
    const mapa = {};
    (data || []).filter(l => l.status === 'enviado').forEach(l => { mapa[l.destinatario_nome] = true; });
    setFelicitadosAno(mapa);
  };

  // Felicitações só para membros do quadro (nunca familiares): ativos, com e-mail, não falecidos.
  const aniversariantes = membros
    .filter(m => m.data_nascimento && !String(m.situacao || '').toLowerCase().includes('falec'))
    .map(m => {
      const p = proximoAniversario(m.data_nascimento);
      const mesNasc = Number(m.data_nascimento.substring(5, 7));
      const diaNasc = Number(m.data_nascimento.substring(8, 10));
      return { ...m, ...p, mesNasc, diaNasc, idadeAno: new Date().getFullYear() - Number(m.data_nascimento.substring(0, 4)) };
    })
    .filter(m => {
      if (periodoFelic === 'hoje') return m.dias === 0;
      if (periodoFelic === 'semana') return m.dias <= 6;
      return m.mesNasc === new Date().getMonth() + 1;
    })
    .sort((a, b) => periodoFelic === 'mes' ? a.diaNasc - b.diaNasc : a.dias - b.dias);

  // Ao abrir a aba ou trocar o período: marca quem ainda não foi felicitado este ano.
  useEffect(() => {
    if (aba !== 'felicitacoes') return;
    setFelicSelec(aniversariantes.filter(m => !felicitadosAno[m.nome]).map(m => m.id));
  }, [aba, periodoFelic, membros, felicitadosAno]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFelic = (id) => setFelicSelec(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const enviarFelicitacoes = async () => {
    if (!podeEventos) { showError('Você não tem permissão para enviar e-mails.'); return; }
    if (felicSelec.length === 0) { showError('Selecione ao menos um companheiro.'); return; }
    setEnviandoFelic(true);
    setResultadosFelic([]);
    try {
      const { data: json, error } = await supabase.functions.invoke('enviar-email-arcoreal', {
        body: { acao: 'felicitacao_aniversario_arcoreal', membros_ids: felicSelec },
      });
      if (error) throw error;
      if (!json?.ok) throw new Error(json?.erro || 'Erro desconhecido');
      setResultadosFelic(json.resultados || []);
      const enviados = (json.resultados || []).filter(r => r.status === 'enviado').length;
      showSuccess(`✅ Felicitações enviadas para ${enviados} companheiro(s)!`);
      carregarLogs();
      carregarFelicitados();
    } catch (e) {
      showError('Erro ao enviar: ' + e.message);
    } finally {
      setEnviandoFelic(false);
    }
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

  const toggleDestinatarioResumo = (id) => {
    setDestinatariosResumo(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const enviarResumo = async () => {
    if (!podeEnviarEmail) { showError('Você não tem permissão para enviar e-mails.'); return; }
    if (destinatariosResumo.length === 0) { showError('Selecione ao menos um destinatário.'); return; }

    setEnviandoResumo(true);
    setResultadosResumo([]);
    try {
      const { data: json, error } = await supabase.functions.invoke('enviar-email-arcoreal', {
        body: { acao: 'resumo_pendencias_arcoreal', destinatarios_ids: destinatariosResumo },
      });
      if (error) throw error;
      if (!json?.ok) throw new Error(json?.erro || 'Erro desconhecido');
      setResultadosResumo(json.resultados || []);
      const enviados = (json.resultados || []).filter(r => r.status === 'enviado').length;
      showSuccess(`✅ Resumo enviado para ${enviados} dirigente(s)!`);
      carregarLogs();
    } catch (e) {
      showError('Erro ao enviar: ' + e.message);
    } finally {
      setEnviandoResumo(false);
    }
  };

  if (!podeEnviarEmail && !podeEventos) {
    return (
      <div className="p-10 text-center" style={{ color: 'var(--color-text-muted)' }}>
        <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</p>
        <p>Você não tem permissão para acessar esta tela.</p>
      </div>
    );
  }

  const TIPOS_ARCO = [
    { id: 'individual',   emoji: '✉️', label: 'Lembrete Individual',    desc: 'Só para quem tem pendência financeira', visivel: podeEnviarEmail },
    { id: 'resumo',       emoji: '📋', label: 'Resumo aos Dirigentes',   desc: 'Tabela de pendentes para Tesoureiro e Principais', visivel: podeEnviarEmail },
    { id: 'felicitacoes', emoji: '🎂', label: 'Felicitações',           desc: 'Aniversário dos companheiros do quadro (sem familiares)', visivel: podeEventos },
    { id: 'eventos',      emoji: '📅', label: 'Lembrete de Evento',      desc: 'Aviso de evento do Cronograma', visivel: podeEventos },
    { id: 'automatico',   emoji: '⏰', label: 'Automático',              desc: 'Eventos e felicitações, todo dia às 08:00', visivel: podeEventos },
  ];

  return (
    <div className="p-6" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)', margin: '0 0 0.75rem' }}>✉️ E-mails — Arco Real</h2>

      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>

      {/* Coluna esquerda: tipo de envio (cartões empilhados, igual à Loja) */}
      <div style={{ flex: '1 1 250px', maxWidth: '320px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem' }}>
        <p style={{ fontWeight: 700, color: 'var(--color-text)', margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Tipo de envio</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {TIPOS_ARCO.filter(t => t.visivel).map(t => (
            <div key={t.id} onClick={() => setAba(t.id)}
              style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)', cursor: 'pointer', border: '1px solid ' + (aba === t.id ? 'var(--color-accent)' : 'var(--color-border)'), background: aba === t.id ? 'var(--color-accent-bg)' : 'var(--color-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>{t.emoji}</span>
                <div>
                  <p style={{ fontWeight: 600, margin: 0, fontSize: '0.875rem', color: aba === t.id ? 'var(--color-accent)' : 'var(--color-text)' }}>{t.label}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coluna direita: conteúdo do tipo escolhido */}
      <div style={{ flex: '3 1 420px', minWidth: 0 }}>

      {aba === 'eventos' && podeEventos && <EmailEventosArcoReal modo="manual" showSuccess={showSuccess} showError={showError} podeConfigurar={podeConfigurarEventos} />}
      {aba === 'automatico' && podeEventos && <EmailEventosArcoReal modo="automatico" showSuccess={showSuccess} showError={showError} podeConfigurar={podeConfigurarEventos} />}

      {aba === 'individual' && podeEnviarEmail && (
      <>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>
        Envia e-mail só para quem está com pendência — quem estiver em dia é pulado automaticamente.
        <br />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.3rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> débito vencido
          <span style={{ marginLeft: '0.6rem', width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} /> em dia (sem vencido)
        </span>
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
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span title={statusPorMembro[m.id] === 'vencido' ? 'Tem débito vencido' : 'Sem débito vencido'}
                  style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: statusPorMembro[m.id] === 'vencido' ? '#ef4444' : '#3b82f6' }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: '0.86rem' }}>{m.nome}</p>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{m.email}</p>
                </div>
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
      </>
      )}

      {aba === 'resumo' && podeEnviarEmail && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', marginBottom: '1.25rem' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0 0 1rem' }}>
            Um único e-mail com a tabela de todo mundo pendente (vencido e a vencer), enviado pra quem você escolher —
            já vem com <strong>Tesoureiro</strong> e <strong>1º Principal</strong> do ano marcados, mas dá pra ajustar livremente.
          </p>

          <input
            type="text" placeholder="🔍 Buscar membro..." value={filtroBuscaResumo} onChange={e => setFiltroBuscaResumo(e.target.value)}
            style={{ width: '100%', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', outline: 'none', fontSize: '0.85rem', marginBottom: '0.75rem' }}
          />

          <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            {membros.filter(m => m.nome.toLowerCase().includes(filtroBuscaResumo.toLowerCase())).map((m, idx, arr) => (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.85rem', cursor: 'pointer', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', borderBottom: idx < arr.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <input type="checkbox" checked={destinatariosResumo.includes(m.id)} onChange={() => toggleDestinatarioResumo(m.id)} style={{ width: '15px', height: '15px', cursor: 'pointer', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: '0.86rem' }}>{m.nome}</p>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{m.email}</p>
                </div>
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{destinatariosResumo.length} destinatário(s)</span>
            <button onClick={enviarResumo} disabled={enviandoResumo || destinatariosResumo.length === 0}
              style={{ padding: '0.6rem 1.4rem', background: (enviandoResumo || destinatariosResumo.length === 0) ? 'var(--color-surface-2)' : '#7c5e1e', color: (enviandoResumo || destinatariosResumo.length === 0) ? 'var(--color-text-muted)' : '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: (enviandoResumo || destinatariosResumo.length === 0) ? 'not-allowed' : 'pointer' }}>
              {enviandoResumo ? '⏳ Enviando...' : '📋 Enviar Resumo'}
            </button>
          </div>

          {resultadosResumo.length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
              {resultadosResumo.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--color-text)' }}>{r.nome}</span>
                  <span style={{ fontWeight: 700, color: r.status === 'enviado' ? '#10b981' : '#ef4444' }}>{r.status === 'enviado' ? '✓ Enviado' : '✗ Erro'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {aba === 'felicitacoes' && podeEventos && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', marginBottom: '1.25rem' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0 0 1rem' }}>
            Envia a mensagem de felicitações de aniversário <strong>somente aos companheiros do quadro</strong> — familiares não recebem.
            Quem já foi felicitado este ano vem desmarcado. O 1º Principal e o Administrador recebem um informativo do envio.
          </p>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
            {PERIODOS_FELIC.map(([k, l]) => (
              <button key={k} onClick={() => setPeriodoFelic(k)}
                style={{ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-lg)', border: '1px solid ' + (periodoFelic === k ? 'var(--color-accent)' : 'var(--color-border)'), fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', background: periodoFelic === k ? 'var(--color-accent-bg)' : 'var(--color-surface-2)', color: periodoFelic === k ? 'var(--color-accent)' : 'var(--color-text)' }}>
                {l}
              </button>
            ))}
          </div>
          <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            {aniversariantes.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1.5rem', margin: 0 }}>Nenhum aniversariante neste período.</p>
            ) : aniversariantes.map((m, idx) => (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.85rem', cursor: 'pointer', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', borderBottom: idx < aniversariantes.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <input type="checkbox" checked={felicSelec.includes(m.id)} onChange={() => toggleFelic(m.id)} style={{ width: '15px', height: '15px', cursor: 'pointer', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: '0.86rem' }}>{m.nome}</p>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{m.email}</p>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
                  {m.dias === 0 ? '🎂 hoje' : `${String(m.diaNasc).padStart(2, '0')}/${String(m.mesNasc).padStart(2, '0')}`} · {m.idadeAno} anos
                  {felicitadosAno[m.nome] && <><br /><span style={{ color: '#10b981', fontWeight: 700 }}>✅ já felicitado</span></>}
                </span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{felicSelec.length} selecionado(s)</span>
            <button onClick={enviarFelicitacoes} disabled={enviandoFelic || felicSelec.length === 0}
              style={{ padding: '0.6rem 1.4rem', background: (enviandoFelic || felicSelec.length === 0) ? 'var(--color-surface-2)' : '#7c5e1e', color: (enviandoFelic || felicSelec.length === 0) ? 'var(--color-text-muted)' : '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: (enviandoFelic || felicSelec.length === 0) ? 'not-allowed' : 'pointer' }}>
              {enviandoFelic ? '⏳ Enviando...' : '🎂 Enviar Felicitações'}
            </button>
          </div>
          {resultadosFelic.length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
              {resultadosFelic.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--color-text)' }}>{r.nome}</span>
                  <span style={{ fontWeight: 700, color: r.status === 'enviado' ? '#10b981' : '#ef4444' }}>{r.status === 'enviado' ? '✓ Enviado' : '✗ Erro'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      </div>{/* fim coluna direita */}
      </div>{/* fim layout 2 colunas */}

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', marginTop: '1.25rem' }}>
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
