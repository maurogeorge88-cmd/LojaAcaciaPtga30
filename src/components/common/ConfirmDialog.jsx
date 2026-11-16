/**
 * Confirmação em modal (substitui window.confirm).
 *
 * Uso em qualquer tela (a função que chama precisa ser async):
 *   import { confirmar } from '../common/ConfirmDialog';
 *   if (!(await confirmar('Excluir este item?'))) return;
 *   if (!(await confirmar({ titulo: 'Fechar mês', mensagem: '...', confirmarTexto: 'Fechar mês', perigo: false }))) return;
 *
 * O <ConfirmHost /> é montado uma única vez no App.jsx.
 */
import React, { useState, useEffect, useRef } from 'react';

let abrirDialogo = null;

export function confirmar(opcoes) {
  const o = typeof opcoes === 'string' ? { mensagem: opcoes } : (opcoes || {});
  // Sem host montado (não deveria ocorrer): cai no confirm do navegador
  if (!abrirDialogo) return Promise.resolve(window.confirm(o.mensagem || o.titulo || 'Confirmar?'));
  return new Promise(resolve => abrirDialogo({ ...o, resolve }));
}

const EH_DESTRUTIVO = /exclu|remov|apag|delet/i;

export function ConfirmHost() {
  const [dlg, setDlg] = useState(null);
  const btnRef = useRef(null);

  useEffect(() => {
    abrirDialogo = (d) => setDlg(d);
    return () => { abrirDialogo = null; };
  }, []);

  const fechar = (resultado) => {
    if (dlg) dlg.resolve(resultado);
    setDlg(null);
  };

  useEffect(() => {
    if (!dlg) return undefined;
    const t = setTimeout(() => btnRef.current && btnRef.current.focus(), 30);
    const aoTeclar = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); fechar(false); }
    };
    window.addEventListener('keydown', aoTeclar, true);
    return () => { clearTimeout(t); window.removeEventListener('keydown', aoTeclar, true); };
  }, [dlg]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!dlg) return null;

  const texto = dlg.mensagem || '';
  const perigo = dlg.perigo !== undefined ? dlg.perigo : EH_DESTRUTIVO.test(`${dlg.titulo || ''} ${texto}`);
  const titulo = dlg.titulo || (perigo ? 'Confirmar exclusão' : 'Confirmar ação');
  const textoOk = dlg.confirmarTexto || (perigo ? 'Excluir' : 'Confirmar');
  const cor = perigo ? '#ef4444' : 'var(--color-accent)';

  return (
    <div onClick={() => fechar(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div role="alertdialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: `3px solid ${cor}`, borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '26rem', boxShadow: '0 25px 50px rgba(0,0,0,0.45)', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.4rem 1rem', display: 'flex', gap: '0.9rem', alignItems: 'flex-start' }}>
          <div style={{ width: '2.4rem', height: '2.4rem', flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem',
            background: perigo ? 'rgba(239,68,68,0.15)' : 'var(--color-accent-bg)' }}>
            {perigo ? '🗑️' : '❓'}
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: 'var(--color-text)' }}>{titulo}</h3>
            {texto && <p style={{ margin: '0.45rem 0 0', fontSize: '0.88rem', lineHeight: 1.45, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{texto}</p>}
            {dlg.detalhe && (
              <p style={{ margin: '0.6rem 0 0', padding: '0.5rem 0.7rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', wordBreak: 'break-word' }}>{dlg.detalhe}</p>
            )}
            {perigo && <p style={{ margin: '0.6rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>Esta ação não pode ser desfeita.</p>}
          </div>
        </div>
        <div style={{ padding: '0.8rem 1.4rem 1.1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button onClick={() => fechar(false)}
            style={{ height: '2.5rem', padding: '0 1.2rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
            {dlg.cancelarTexto || 'Cancelar'}
          </button>
          <button ref={btnRef} onClick={() => fechar(true)}
            style={{ height: '2.5rem', padding: '0 1.3rem', background: cor, color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
            {textoOk}
          </button>
        </div>
      </div>
    </div>
  );
}
