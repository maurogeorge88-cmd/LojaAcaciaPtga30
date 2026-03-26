/**
 * ACESSO CUNHADAS
 * Gerencia cargos e define senhas de acesso ao portal.
 * Presidente e Tesoureira têm acesso total — sem distinção.
 * A senha é definida diretamente no sistema via Edge Function.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const Campo = ({ label, children, style }) => (
  <div style={style}>
    <label style={{
      display: 'block', fontSize: '0.78rem', fontWeight: '600',
      color: 'var(--color-text-muted)', marginBottom: '0.35rem',
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>{label}</label>
    {children}
  </div>
);

const CARGOS = [
  { value: 'presidente', label: '👑 Presidente', cor: '#a855f7' },
  { value: 'tesoureira', label: '💼 Tesoureira', cor: '#3b82f6' },
  { value: 'membro',     label: '👤 Membro',     cor: '#64748b' },
];

const corCargo   = (c) => CARGOS.find((x) => x.value === c)?.cor   || '#64748b';
const labelCargo = (c) => CARGOS.find((x) => x.value === c)?.label || c;
const temAcesso  = (c) => c === 'presidente' || c === 'tesoureira';

export const AcessoCunhadas = () => {
  const [cunhadas, setCunhadas]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [salvando, setSalvando]   = useState(false);
  const [msg, setMsg]             = useState({ tipo: '', texto: '' });

  const [modalCargo, setModalCargo] = useState(null);
  const [novoCargo, setNovoCargo]   = useState('membro');

  const [modalSenha, setModalSenha]         = useState(null);
  const [novaSenha, setNovaSenha]           = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [verSenha, setVerSenha]             = useState(false);

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cunhadas')
        .select('id, nome, email, cargo, ativa')
        .order('nome');
      if (error) throw error;
      setCunhadas(data || []);
    } catch (err) {
      mostrarMsg('erro', 'Erro ao carregar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const salvarCargo = async () => {
    if (!modalCargo) return;
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('cunhadas')
        .update({ cargo: novoCargo })
        .eq('id', modalCargo.id);
      if (error) throw error;
      mostrarMsg('sucesso', `Cargo de ${modalCargo.nome} atualizado para ${labelCargo(novoCargo)}!`);
      setModalCargo(null);
      carregar();
    } catch (err) {
      mostrarMsg('erro', 'Erro: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const salvarSenha = async () => {
    if (!modalSenha) return;
    if (!modalSenha.email) {
      mostrarMsg('erro', 'Cadastre o e-mail da cunhada antes de definir a senha.');
      return;
    }
    if (novaSenha.length < 6) {
      mostrarMsg('erro', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      mostrarMsg('erro', 'As senhas não coincidem.');
      return;
    }

    setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke('set-cunhada-password', {
        body: { email: modalSenha.email, password: novaSenha },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.user_id) {
        await supabase
          .from('cunhadas')
          .update({ supabase_user_id: data.user_id })
          .eq('id', modalSenha.id);
      }

      mostrarMsg('sucesso', `Senha de ${modalSenha.nome} definida! Acesso liberado.`);
      setModalSenha(null);
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (err) {
      mostrarMsg('erro', 'Erro ao definir senha: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const mostrarMsg = (tipo, texto) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg({ tipo: '', texto: '' }), 5000);
  };

  const s = {
    page:    { padding: '2rem', maxWidth: '1000px', margin: '0 auto' },
    card:    { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' },
    input:   { width: '100%', padding: '0.65rem 0.9rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' },
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
    modal:   { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-2xl)', width: '100%', maxWidth: '440px', boxShadow: 'var(--shadow-xl)' },
    mHead:   { padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    mBody:   { padding: '1.5rem 1.75rem' },
    mFoot:   { padding: '1rem 1.75rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' },
    btnSec:  { padding: '0.6rem 1.25rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text-muted)', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' },
    btnSave: (cor) => ({ padding: '0.6rem 1.25rem', background: `linear-gradient(135deg, ${cor}cc, ${cor})`, border: 'none', borderRadius: 'var(--radius-lg)', color: '#fff', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' }),
  };

  return (
    <div style={s.page}>

      {msg.texto && (
        <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-xl)', background: msg.tipo === 'sucesso' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${msg.tipo === 'sucesso' ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`, color: msg.tipo === 'sucesso' ? '#10b981' : '#ef4444', fontWeight: '600', fontSize: '0.875rem', zIndex: 2000, boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {msg.tipo === 'sucesso' ? '✅' : '❌'} {msg.texto}
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)', margin: 0 }}>🔐 Acesso das Cunhadas</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>Gerencie cargos e senhas de acesso ao portal</p>
      </div>

      <div style={{ padding: '1rem 1.25rem', background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 'var(--radius-xl)', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>💜</span>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--color-text)' }}>Regras:</strong> cunhadas com cargo <strong>Presidente</strong> ou <strong>Tesoureira</strong> têm acesso completo ao portal.
          Ao trocar de diretoria, mude o cargo das anteriores para <strong>Membro</strong>, promova as novas e redefina as senhas.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {CARGOS.map((c) => (
          <div key={c.value} style={{ ...s.card, borderTop: `3px solid ${c.cor}`, padding: '1rem 1.25rem' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{c.label}</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '1.75rem', fontWeight: '700', color: c.cor }}>
              {cunhadas.filter((cu) => cu.cargo === c.value).length}
            </p>
            {temAcesso(c.value) && <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-faint)' }}>✓ acesso ao portal</p>}
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-faint)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />Carregando...
        </div>
      ) : (
        <div style={s.card}>
          {cunhadas.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-faint)', padding: '2rem' }}>Nenhuma cunhada cadastrada.</p>
          ) : cunhadas.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 0', borderBottom: i < cunhadas.length - 1 ? '1px solid var(--color-border)' : 'none' }}>

              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: `${corCargo(c.cargo)}20`, border: `2px solid ${corCargo(c.cargo)}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: corCargo(c.cargo), fontSize: '1rem', flexShrink: 0 }}>
                {c.nome?.charAt(0).toUpperCase()}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '0.9rem', color: 'var(--color-text)' }}>{c.nome}</p>
                  <span style={{ padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700', background: `${corCargo(c.cargo)}18`, color: corCargo(c.cargo), border: `1px solid ${corCargo(c.cargo)}30` }}>
                    {labelCargo(c.cargo)}
                  </span>
                  {temAcesso(c.cargo) ? (
                    <span style={{ padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '600', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>✓ Portal liberado</span>
                  ) : (
                    <span style={{ padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '600', background: 'rgba(100,116,139,0.1)', color: '#64748b', border: '1px solid rgba(100,116,139,0.2)' }}>✗ Sem acesso</span>
                  )}
                  {!c.ativa && <span style={{ padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>Inativa</span>}
                </div>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: c.email ? 'var(--color-text-faint)' : '#ef4444' }}>
                  {c.email || '⚠️ Sem e-mail — cadastre no módulo Cadastro'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button onClick={() => { setModalCargo(c); setNovoCargo(c.cargo || 'membro'); }}
                  style={{ padding: '0.4rem 0.85rem', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 'var(--radius-lg)', color: '#a855f7', fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer' }}>
                  🏅 Cargo
                </button>
                <button
                  onClick={() => { setModalSenha(c); setNovaSenha(''); setConfirmarSenha(''); setVerSenha(false); }}
                  disabled={!c.email}
                  title={!c.email ? 'Cadastre o e-mail antes' : 'Definir senha'}
                  style={{ padding: '0.4rem 0.85rem', background: c.email ? 'rgba(59,130,246,0.1)' : 'rgba(100,116,139,0.06)', border: `1px solid ${c.email ? 'rgba(59,130,246,0.25)' : 'rgba(100,116,139,0.15)'}`, borderRadius: 'var(--radius-lg)', color: c.email ? '#3b82f6' : '#64748b', fontWeight: '600', fontSize: '0.78rem', cursor: c.email ? 'pointer' : 'not-allowed', opacity: c.email ? 1 : 0.5 }}>
                  🔑 Senha
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Cargo */}
      {modalCargo && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setModalCargo(null)}>
          <div style={s.modal}>
            <div style={s.mHead}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-text)' }}>🏅 Alterar Cargo</h2>
              <button onClick={() => setModalCargo(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={s.mBody}>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                Cargo de <strong style={{ color: 'var(--color-text)' }}>{modalCargo.nome}</strong>:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {CARGOS.map((c) => (
                  <button key={c.value} onClick={() => setNovoCargo(c.value)} style={{ padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-xl)', border: '2px solid', textAlign: 'left', borderColor: novoCargo === c.value ? c.cor : 'var(--color-border)', background: novoCargo === c.value ? `${c.cor}12` : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div style={{ fontWeight: '700', color: novoCargo === c.value ? c.cor : 'var(--color-text)', fontSize: '0.9rem' }}>{c.label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', marginTop: '0.2rem' }}>
                      {temAcesso(c.value) ? '✓ Acesso completo ao portal das cunhadas' : '✗ Sem acesso ao portal (por enquanto)'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div style={s.mFoot}>
              <button style={s.btnSec} onClick={() => setModalCargo(null)} disabled={salvando}>Cancelar</button>
              <button style={s.btnSave('#a855f7')} onClick={salvarCargo} disabled={salvando}>
                {salvando ? '⏳ Salvando...' : '💾 Salvar cargo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Senha */}
      {modalSenha && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setModalSenha(null)}>
          <div style={s.modal}>
            <div style={s.mHead}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-text)' }}>🔑 Definir Senha de Acesso</h2>
              <button onClick={() => setModalSenha(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={s.mBody}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)', marginBottom: '1.25rem' }}>
                <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: `${corCargo(modalSenha.cargo)}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: corCargo(modalSenha.cargo), flexShrink: 0 }}>
                  {modalSenha.nome?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '0.875rem', color: 'var(--color-text)' }}>{modalSenha.nome}</p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-faint)' }}>{modalSenha.email}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Campo label="Nova senha (mínimo 6 caracteres)">
                  <div style={{ position: 'relative' }}>
                    <input type={verSenha ? 'text' : 'password'} style={{ ...s.input, paddingRight: '2.75rem' }} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="••••••••" />
                    <button onClick={() => setVerSenha(!verSenha)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1rem' }}>
                      {verSenha ? '🙈' : '👁️'}
                    </button>
                  </div>
                </Campo>
                <Campo label="Confirmar senha">
                  <input type={verSenha ? 'text' : 'password'} style={{ ...s.input, borderColor: confirmarSenha && confirmarSenha !== novaSenha ? '#ef4444' : 'var(--color-border)' }} value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} placeholder="••••••••" />
                  {confirmarSenha && confirmarSenha !== novaSenha && <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>As senhas não coincidem</p>}
                  {confirmarSenha && confirmarSenha === novaSenha && novaSenha.length >= 6 && <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: '#10b981' }}>✓ Senhas coincidem</p>}
                </Campo>
              </div>
            </div>
            <div style={s.mFoot}>
              <button style={s.btnSec} onClick={() => setModalSenha(null)} disabled={salvando}>Cancelar</button>
              <button style={{ ...s.btnSave('#3b82f6'), opacity: (!novaSenha || novaSenha !== confirmarSenha || novaSenha.length < 6) ? 0.5 : 1 }} onClick={salvarSenha} disabled={salvando || !novaSenha || novaSenha !== confirmarSenha || novaSenha.length < 6}>
                {salvando ? '⏳ Salvando...' : '🔑 Definir senha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcessoCunhadas;
