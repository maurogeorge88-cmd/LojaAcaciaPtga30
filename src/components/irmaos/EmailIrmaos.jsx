import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

// ── Helpers ───────────────────────────────────────────────────────────────────
const TIPOS = [
  { id: 'resumo_individual', label: 'Resumo Individual', emoji: '📋', desc: 'Financeiro, presença, comissões e eventos de cada irmão' },
  { id: 'aniversariantes',   label: 'Aniversariantes',  emoji: '🎂', desc: 'Lista semanal enviada ao Venerável e Chanceler' },
  { id: 'lembrete_financeiro', label: 'Lembrete Financeiro', emoji: '⚠️', desc: 'Apenas irmãos com saldo devedor' },
];

const FREQ = [
  { id: 'semanal',    label: 'Semanal' },
  { id: 'quinzenal',  label: 'Quinzenal' },
  { id: 'mensal',     label: 'Mensal' },
];

const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const OPCOES_CONTEUDO = [
  { id: 'financeiro', label: '💰 Financeiro' },
  { id: 'presenca',   label: '📊 Presença' },
  { id: 'comissoes',  label: '👥 Comissões' },
  { id: 'eventos',    label: '🎉 Eventos do mês' },
];

export default function EmailIrmaos({ showSuccess, showError }) {
  const [aba, setAba] = useState('manual');
  const [irmaos, setIrmaos] = useState([]);
  const [irmaosSelec, setIrmaosSelec] = useState([]);
  const [tipoSelec, setTipoSelec] = useState('resumo_individual');
  const [opcoesConteudo, setOpcoesConteudo] = useState({ financeiro: true, presenca: true, comissoes: true, eventos: true });
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(null);
  const [modalConfig, setModalConfig] = useState(null); // tipo sendo configurado
  const [formConfig, setFormConfig] = useState({ ativo: false, frequencia: 'mensal', dia_semana: 1, dia_mes: 1, hora: 8 });
  const [irmaosConfigSelec, setIrmaosConfigSelec] = useState([]);
  const [opcoesConfig, setOpcoesConfig] = useState({ financeiro: true, presenca: true, comissoes: true, eventos: true });
  const [filtroBuscaConfig, setFiltroBuscaConfig] = useState('');
  const [filtroBusca, setFiltroBusca] = useState('');

  // ── Carregar dados ──────────────────────────────────────────────────────────
  useEffect(() => {
    carregarIrmaos();
    carregarConfigs();
    carregarLogs();
  }, []);

  const carregarIrmaos = async () => {
    const { data } = await supabase
      .from('irmaos')
      .select('id, nome, email, situacao, cim')
      .not('email', 'is', null)
      .neq('email', '')
      .order('nome');
    setIrmaos(data || []);
  };

  const carregarConfigs = async () => {
    setLoadingConfigs(true);
    const { data } = await supabase.from('config_email_automatico').select('*').order('tipo');
    setConfigs(data || []);
    setLoadingConfigs(false);
  };

  const carregarLogs = async () => {
    const { data } = await supabase
      .from('log_email_irmao')
      .select('*')
      .order('enviado_em', { ascending: false })
      .limit(50);
    setLogs(data || []);
  };

  // ── Selecionar irmãos ───────────────────────────────────────────────────────
  const toggleIrmao = (id) => {
    setIrmaosSelec(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selecionarTodos = () => {
    const filtrados = irmaos.filter(i => i.nome.toLowerCase().includes(filtroBusca.toLowerCase()));
    if (irmaosSelec.length === filtrados.length) setIrmaosSelec([]);
    else setIrmaosSelec(filtrados.map(i => i.id));
  };

  // ── Envio manual ────────────────────────────────────────────────────────────
  const enviarManual = async () => {
    if (tipoSelec === 'resumo_individual' && irmaosSelec.length === 0) {
      showError('Selecione ao menos um irmão.'); return;
    }
    if (tipoSelec === 'lembrete_financeiro' && irmaosSelec.length === 0) {
      showError('Selecione ao menos um irmão.'); return;
    }

    setEnviando(true);
    setResultados([]);
    try {
      const { data: json, error: fnError } = await supabase.functions.invoke('enviar-email-irmao', {
        body: {
          acao: tipoSelec,
          irmaos_ids: irmaosSelec,
          opcoes: opcoesConteudo,
        },
      });
      if (fnError) throw fnError;
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

  // ── Salvar configuração automática ─────────────────────────────────────────
  const salvarConfig = async () => {
    if (!modalConfig) return;
    setSalvandoConfig(modalConfig);
    try {
      const existente = configs.find(c => c.tipo === modalConfig);
      if (existente) {
        await supabase.from('config_email_automatico').update({ ...formConfig, tipo: modalConfig, irmaos_ids: irmaosConfigSelec, opcoes_conteudo: opcoesConfig }).eq('id', existente.id);
      } else {
        await supabase.from('config_email_automatico').insert([{ ...formConfig, tipo: modalConfig, irmaos_ids: irmaosConfigSelec, opcoes_conteudo: opcoesConfig }]);
      }
      showSuccess('✅ Configuração salva!');
      carregarConfigs();
      setModalConfig(null);
    } catch (e) {
      showError('Erro: ' + e.message);
    } finally {
      setSalvandoConfig(null);
    }
  };

  const abrirModalConfig = (tipo) => {
    const existente = configs.find(c => c.tipo === tipo);
    if (existente) {
      setFormConfig({ ativo: existente.ativo, frequencia: existente.frequencia || 'mensal', dia_semana: existente.dia_semana || 1, dia_mes: existente.dia_mes || 1, hora: existente.hora ?? 8 });
      setIrmaosConfigSelec(existente.irmaos_ids || []);
      setOpcoesConfig(existente.opcoes_conteudo || { financeiro: true, presenca: true, comissoes: true, eventos: true });
    } else {
      setFormConfig({ ativo: false, frequencia: 'mensal', dia_semana: 1, dia_mes: 1, hora: 8 });
      setIrmaosConfigSelec([]);
      setOpcoesConfig({ financeiro: true, presenca: true, comissoes: true, eventos: true });
    }
    setFiltroBuscaConfig('');
    setModalConfig(tipo);
  };

  const toggleAtivacao = async (tipo) => {
    const existente = configs.find(c => c.tipo === tipo);
    if (!existente) { abrirModalConfig(tipo); return; }
    await supabase.from('config_email_automatico').update({ ativo: !existente.ativo }).eq('id', existente.id);
    carregarConfigs();
    showSuccess(existente.ativo ? '⏸ Agendamento pausado.' : '▶ Agendamento ativado.');
  };

  // ── Estilos ─────────────────────────────────────────────────────────────────
  const sInput = { background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' };
  const sCard = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem' };
  const sCardSel = (sel) => ({ ...sCard, borderColor: sel ? 'var(--color-accent)' : 'var(--color-border)', background: sel ? 'var(--color-accent-bg)' : 'var(--color-surface)', cursor: 'pointer' });

  const irmaosVisiveis = irmaos.filter(i => i.nome.toLowerCase().includes(filtroBusca.toLowerCase()));

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '1.5rem', background: 'var(--color-bg)', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* Cabeçalho */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)', margin: 0 }}>📧 E-mails para Irmãos</h2>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>Envio manual e agendado de informações personalizadas</p>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0' }}>
        {[{ id: 'manual', label: '📤 Envio Manual' }, { id: 'automatico', label: '⏰ Automático' }, { id: 'historico', label: '📋 Histórico' }].map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            style={{ padding: '0.6rem 1.25rem', fontWeight: '600', fontSize: '0.875rem', border: 'none', cursor: 'pointer', borderBottom: aba === a.id ? '3px solid var(--color-accent)' : '3px solid transparent', background: 'transparent', color: aba === a.id ? 'var(--color-accent)' : 'var(--color-text-muted)', borderRadius: '0', marginBottom: '-1px' }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* ── ABA: MANUAL ──────────────────────────────────────────────────────── */}
      {aba === 'manual' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

          {/* Coluna esquerda: Tipo + Opções */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Tipo de envio */}
            <div style={sCard}>
              <p style={{ fontWeight: '700', color: 'var(--color-text)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>1. Tipo de envio</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {TIPOS.map(t => (
                  <div key={t.id} onClick={() => setTipoSelec(t.id)} style={sCardSel(tipoSelec === t.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>{t.emoji}</span>
                      <div>
                        <p style={{ fontWeight: '600', color: tipoSelec === t.id ? 'var(--color-accent)' : 'var(--color-text)', margin: 0, fontSize: '0.875rem' }}>{t.label}</p>
                        <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.75rem' }}>{t.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Opções de conteúdo (só para resumo individual) */}
            {tipoSelec === 'resumo_individual' && (
              <div style={sCard}>
                <p style={{ fontWeight: '700', color: 'var(--color-text)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>2. Conteúdo do e-mail</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {OPCOES_CONTEUDO.map(o => (
                    <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem', borderRadius: 'var(--radius-md)', background: opcoesConteudo[o.id] ? 'var(--color-accent-bg)' : 'var(--color-surface-2)', border: '1px solid ' + (opcoesConteudo[o.id] ? 'var(--color-accent)' : 'var(--color-border)') }}>
                      <input type="checkbox" checked={opcoesConteudo[o.id]} onChange={() => setOpcoesConteudo(p => ({ ...p, [o.id]: !p[o.id] }))} style={{ accentColor: 'var(--color-accent)' }} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: '600' }}>{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Info para aniversariantes */}
            {tipoSelec === 'aniversariantes' && (
              <div style={{ ...sCard, background: 'var(--color-accent-bg)', borderColor: 'var(--color-accent)' }}>
                <p style={{ color: 'var(--color-text)', margin: 0, fontSize: '0.875rem' }}>
                  ℹ️ O e-mail de aniversariantes é enviado automaticamente para o <strong>Venerável Mestre</strong> e o <strong>Chanceler</strong> cadastrados no sistema.
                </p>
              </div>
            )}

            {/* Botão enviar */}
            <button onClick={enviarManual} disabled={enviando}
              style={{ padding: '0.75rem', background: enviando ? 'var(--color-surface-3)' : 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', fontSize: '1rem', cursor: enviando ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
              {enviando ? '📤 Enviando...' : `📤 Enviar ${tipoSelec === 'aniversariantes' ? 'para Liderança' : `para ${irmaosSelec.length} irmão(s)`}`}
            </button>

            {/* Resultados */}
            {resultados.length > 0 && (
              <div style={sCard}>
                <p style={{ fontWeight: '700', color: 'var(--color-text)', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Resultado do envio:</p>
                <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {resultados.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.5rem', borderRadius: 'var(--radius-md)', background: r.status === 'enviado' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>{r.nome}</span>
                      <span style={{ color: r.status === 'enviado' ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                        {r.status === 'enviado' ? '✓ Enviado' : r.status === 'pulado_sem_pendencia' ? '— Sem pendência' : '✗ Erro'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Coluna direita: Seleção de irmãos */}
          <div style={sCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <p style={{ fontWeight: '700', color: 'var(--color-text)', margin: 0, fontSize: '0.95rem' }}>
                {tipoSelec === 'aniversariantes' ? 'Irmãos com e-mail' : `${irmaosSelec.length === 0 ? 'Selecionar' : `${irmaosSelec.length} selecionado(s)`}`}
              </p>
              {tipoSelec !== 'aniversariantes' && (
                <button onClick={selecionarTodos}
                  style={{ padding: '0.25rem 0.75rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', cursor: 'pointer' }}>
                  {irmaosSelec.length === irmaosVisiveis.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              )}
            </div>

            <input type="text" placeholder="🔍 Buscar irmão..." value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)}
              style={{ ...sInput, marginBottom: '0.75rem' }} />

            <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {irmaosVisiveis.map((irmao, idx) => {
                const sel = irmaosSelec.includes(irmao.id);
                return (
                  <div key={irmao.id} onClick={() => tipoSelec !== 'aniversariantes' && toggleIrmao(irmao.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-lg)', background: sel ? 'var(--color-accent-bg)' : idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', border: '1px solid ' + (sel ? 'var(--color-accent)' : 'transparent'), cursor: tipoSelec !== 'aniversariantes' ? 'pointer' : 'default', transition: 'all 0.15s' }}>
                    {tipoSelec !== 'aniversariantes' && (
                      <input type="checkbox" checked={sel} readOnly
                        style={{ accentColor: 'var(--color-accent)', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: '600', fontSize: '0.875rem', color: sel ? 'var(--color-accent)' : 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{irmao.nome}</p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{irmao.email}</p>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>CIM {irmao.cim}</span>
                  </div>
                );
              })}
              {irmaosVisiveis.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem', fontSize: '0.875rem' }}>Nenhum irmão encontrado</p>
              )}
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
              {irmaos.length} irmão(s) com e-mail cadastrado
            </p>
          </div>
        </div>
      )}

      {/* ── ABA: AUTOMÁTICO ──────────────────────────────────────────────────── */}
      {aba === 'automatico' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ ...sCard, background: 'var(--color-accent-bg)', borderColor: 'var(--color-accent)' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text)' }}>
              ℹ️ Os agendamentos automáticos precisam de <strong>pg_cron</strong> ativado no Supabase. Configure o horário e ative cada tipo individualmente.
            </p>
          </div>

          {TIPOS.map(tipo => {
            const cfg = configs.find(c => c.tipo === tipo.id);
            const ativo = cfg?.ativo || false;
            return (
              <div key={tipo.id} style={{ ...sCard, borderLeft: '4px solid ' + (ativo ? '#10b981' : 'var(--color-border)') }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                    <span style={{ fontSize: '1.5rem' }}>{tipo.emoji}</span>
                    <div>
                      <p style={{ fontWeight: '700', color: 'var(--color-text)', margin: 0 }}>{tipo.label}</p>
                      <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.8rem' }}>{tipo.desc}</p>
                      {cfg && (
                        <p style={{ color: ativo ? '#10b981' : 'var(--color-text-muted)', margin: '0.25rem 0 0', fontSize: '0.75rem', fontWeight: '600' }}>
                          {ativo ? '▶ Ativo' : '⏸ Pausado'} — {cfg.frequencia} {cfg.frequencia === 'semanal' ? `(${DIAS_SEMANA[cfg.dia_semana]})` : `(dia ${cfg.dia_mes})`} às {String(cfg.hora).padStart(2,'0')}h
                          {cfg.irmaos_ids?.length > 0 ? ` · ${cfg.irmaos_ids.length} irmão(s)` : ' · Todos os irmãos'}
                        </p>
                      )}
                      {!cfg && <p style={{ color: 'var(--color-text-muted)', margin: '0.25rem 0 0', fontSize: '0.75rem' }}>Não configurado</p>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button onClick={() => abrirModalConfig(tipo.id)}
                      style={{ padding: '0.4rem 0.9rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', cursor: 'pointer', fontWeight: '600' }}>
                      ⚙️ Configurar
                    </button>
                    <button onClick={() => toggleAtivacao(tipo.id)}
                      style={{ padding: '0.4rem 0.9rem', background: ativo ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: ativo ? '#ef4444' : '#10b981', border: `1px solid ${ativo ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`, borderRadius: 'var(--radius-md)', fontSize: '0.82rem', cursor: 'pointer', fontWeight: '600' }}>
                      {ativo ? '⏸ Pausar' : '▶ Ativar'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Instruções pg_cron */}
          <div style={sCard}>
            <p style={{ fontWeight: '700', color: 'var(--color-text)', marginBottom: '0.75rem' }}>📌 Como ativar o envio automático</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Após configurar, execute no SQL Editor do Supabase para cada tipo ativo:
            </p>
            <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--color-text)', overflowX: 'auto', border: '1px solid var(--color-border)' }}>
              {`-- Exemplo: envio mensal todo dia 1 às 8h\nSELECT cron.schedule(\n  'email-irmao-mensal',\n  '0 8 1 * *',\n  $$\n  SELECT net.http_post(\n    url := 'SUA_SUPABASE_URL/functions/v1/enviar-email-irmao',\n    headers := '{"Content-Type":"application/json","Authorization":"Bearer SUA_ANON_KEY"}'::jsonb,\n    body := '{"acao":"resumo_individual","irmaos_ids":[],"opcoes":{"financeiro":true,"presenca":true,"comissoes":true,"eventos":true}}'::jsonb\n  );\n  $$\n);`}
            </div>
          </div>
        </div>
      )}

      {/* ── ABA: HISTÓRICO ───────────────────────────────────────────────────── */}
      {aba === 'historico' && (
        <div style={sCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ fontWeight: '700', color: 'var(--color-text)', margin: 0, fontSize: '0.95rem' }}>
              📋 Histórico de Envios ({logs.length})
            </p>
            <button onClick={carregarLogs}
              style={{ padding: '0.35rem 0.75rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', cursor: 'pointer' }}>
              🔄 Atualizar
            </button>
          </div>

          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
              <p style={{ margin: 0 }}>Nenhum envio registrado ainda</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {/* Cabeçalho */}
              <div style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0.75rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-text-muted)' }}>
                <span style={{ flex: '0 0 140px' }}>Data/Hora</span>
                <span style={{ flex: '0 0 120px' }}>Tipo</span>
                <span style={{ flex: 1 }}>Destinatário</span>
                <span style={{ flex: '0 0 80px', textAlign: 'center' }}>Status</span>
              </div>
              {logs.map((log, idx) => (
                <div key={log.id}
                  style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', fontSize: '0.8rem', alignItems: 'center' }}>
                  <span style={{ flex: '0 0 140px', color: 'var(--color-text-muted)' }}>
                    {new Date(log.enviado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ flex: '0 0 120px', color: 'var(--color-text)', fontWeight: '600', fontSize: '0.75rem' }}>
                    {TIPOS.find(t => t.id === log.tipo)?.label || log.tipo}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.destinatario_nome}</p>
                    <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.destinatario_email}</p>
                  </div>
                  <span style={{ flex: '0 0 80px', textAlign: 'center' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700', background: log.status === 'enviado' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: log.status === 'enviado' ? '#10b981' : '#ef4444' }}>
                      {log.status === 'enviado' ? '✓ OK' : '✗ Erro'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal de configuração automática ─────────────────────────────────── */}
      {modalConfig && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--color-text)', margin: 0, fontSize: '1.1rem' }}>
                ⚙️ Configurar — {TIPOS.find(t => t.id === modalConfig)?.label}
              </h3>
              <button onClick={() => setModalConfig(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Ativar */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: formConfig.ativo ? 'rgba(16,185,129,0.1)' : 'var(--color-surface-2)', border: '1px solid ' + (formConfig.ativo ? 'rgba(16,185,129,0.3)' : 'var(--color-border)') }}>
                <input type="checkbox" checked={formConfig.ativo} onChange={e => setFormConfig(p => ({ ...p, ativo: e.target.checked }))} style={{ accentColor: '#10b981', width: '16px', height: '16px' }} />
                <span style={{ fontWeight: '600', color: 'var(--color-text)', fontSize: '0.875rem' }}>Ativar envio automático</span>
              </label>

              {/* Frequência */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>Frequência</label>
                <select value={formConfig.frequencia} onChange={e => setFormConfig(p => ({ ...p, frequencia: e.target.value }))} style={sInput}>
                  {FREQ.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>

              {/* Dia da semana (se semanal) */}
              {formConfig.frequencia === 'semanal' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>Dia da semana</label>
                  <select value={formConfig.dia_semana} onChange={e => setFormConfig(p => ({ ...p, dia_semana: parseInt(e.target.value) }))} style={sInput}>
                    {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              )}

              {/* Dia do mês */}
              {(formConfig.frequencia === 'mensal' || formConfig.frequencia === 'quinzenal') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>Dia do mês</label>
                  <select value={formConfig.dia_mes} onChange={e => setFormConfig(p => ({ ...p, dia_mes: parseInt(e.target.value) }))} style={sInput}>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Dia {d}</option>)}
                  </select>
                </div>
              )}

              {/* Hora */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>Horário de envio</label>
                <select value={formConfig.hora} onChange={e => setFormConfig(p => ({ ...p, hora: parseInt(e.target.value) }))} style={sInput}>
                  {Array.from({ length: 24 }, (_, i) => i).map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
                </select>
              </div>

              {/* Opções de conteúdo — só para resumo_individual */}
              {modalConfig === 'resumo_individual' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>
                    📦 Conteúdo do e-mail
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {OPCOES_CONTEUDO.map(o => (
                      <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.45rem 0.6rem', borderRadius: 'var(--radius-md)', background: opcoesConfig[o.id] ? 'var(--color-accent-bg)' : 'var(--color-surface-2)', border: '1px solid ' + (opcoesConfig[o.id] ? 'var(--color-accent)' : 'var(--color-border)') }}>
                        <input type="checkbox" checked={opcoesConfig[o.id]} onChange={e => setOpcoesConfig(p => ({ ...p, [o.id]: e.target.checked }))}
                          style={{ accentColor: 'var(--color-accent)', width: '15px', height: '15px' }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: '600', color: opcoesConfig[o.id] ? 'var(--color-accent)' : 'var(--color-text)' }}>{o.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Seleção de irmãos — só para tipos que enviam individualmente */}
              {(modalConfig === 'resumo_individual' || modalConfig === 'lembrete_financeiro') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>
                    👥 Irmãos que receberão ({irmaosConfigSelec.length === 0 ? 'todos' : `${irmaosConfigSelec.length} selecionado(s)`})
                  </label>
                  <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.35rem' }}>
                    <input type="text" placeholder="🔍 Buscar..." value={filtroBuscaConfig}
                      onChange={e => setFiltroBuscaConfig(e.target.value)}
                      style={{ flex: 1, padding: '0.35rem 0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }} />
                    <button onClick={() => setIrmaosConfigSelec(irmaosConfigSelec.length === irmaos.length ? [] : irmaos.map(i => i.id))}
                      style={{ padding: '0.35rem 0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {irmaosConfigSelec.length === irmaos.length ? 'Desmarcar' : 'Todos'}
                    </button>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '0 0 0.35rem' }}>
                    ℹ️ Deixe vazio para enviar a todos os irmãos com e-mail cadastrado
                  </p>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.25rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    {irmaos.filter(i => i.nome.toLowerCase().includes(filtroBuscaConfig.toLowerCase())).map((irmao, idx) => {
                      const sel = irmaosConfigSelec.includes(irmao.id);
                      return (
                        <div key={irmao.id} onClick={() => setIrmaosConfigSelec(p => p.includes(irmao.id) ? p.filter(x => x !== irmao.id) : [...p, irmao.id])}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            background: sel ? 'var(--color-accent-bg)' : idx%2===0 ? 'var(--color-surface)' : 'transparent',
                            border: sel ? '1px solid var(--color-accent)' : '1px solid transparent' }}>
                          <input type="checkbox" checked={sel} readOnly style={{ accentColor: 'var(--color-accent)', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.78rem', color: sel ? 'var(--color-accent)' : 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{irmao.nome}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Botões */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button onClick={() => setModalConfig(null)}
                  style={{ flex: 1, padding: '0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={salvarConfig} disabled={!!salvandoConfig}
                  style={{ flex: 2, padding: '0.6rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer' }}>
                  {salvandoConfig ? 'Salvando...' : '💾 Salvar configuração'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
