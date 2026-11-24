/**
 * Anexos de um recurso (aplicacao = null) ou de uma aplicação específica.
 * Arquivos ficam no bucket privado 'recursos-publicos'.
 */
import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { inp, lbl, overlay, box, head, btn, btnPequeno, dataBR, BUCKET_RP, ROTULO_TIPO_ANEXO, nomeSeguro, abrirArquivo } from './comum';

export default function ModalAnexos({ recurso, aplicacao = null, anexos, podeEditar, onClose, onChange, showSuccess, showError }) {
  const [tipo, setTipo] = useState('comprovante');
  const [nome, setNome] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const lista = (anexos || []).filter(a => (aplicacao ? a.aplicacao_id === aplicacao.id : (a.recurso_id === recurso.id && !a.aplicacao_id)));

  const enviar = async (e) => {
    e.preventDefault();
    if (!arquivo) { showError('Escolha o arquivo.'); return; }
    setEnviando(true);
    const path = `${recurso.id}/${Date.now()}_${nomeSeguro(arquivo.name)}`;
    let subiu = false;
    try {
      const { error: up } = await supabase.storage.from(BUCKET_RP).upload(path, arquivo, { contentType: arquivo.type || undefined });
      if (up) throw up;
      subiu = true;
      const { data, error } = await supabase.from('recurso_anexos').insert([{
        recurso_id: recurso.id, aplicacao_id: aplicacao ? aplicacao.id : null,
        tipo, nome: nome.trim() || arquivo.name, arquivo_path: path,
      }]).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão para anexar.');
      showSuccess('✅ Arquivo anexado!');
      setArquivo(null); setNome('');
      const campo = document.getElementById('input-anexo-rp'); if (campo) campo.value = '';
      onChange();
    } catch (err) {
      if (subiu) await supabase.storage.from(BUCKET_RP).remove([path]);
      showError('Erro ao anexar: ' + err.message);
    } finally { setEnviando(false); }
  };

  const excluir = async (a) => {
    if (!confirm(`Excluir o anexo "${a.nome}"?`)) return;
    try {
      const { data, error } = await supabase.from('recurso_anexos').delete().eq('id', a.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão para excluir.');
      await supabase.storage.from(BUCKET_RP).remove([a.arquivo_path]);
      showSuccess('✅ Anexo excluído.');
      onChange();
    } catch (err) { showError('Erro ao excluir: ' + err.message); }
  };

  return (
    <div style={overlay}>
      <div style={box('38rem')}>
        <div style={head}>
          <h3 style={{ margin: 0, color: 'var(--color-text)', fontSize: '1.05rem' }}>
            📎 Anexos — {aplicacao ? aplicacao.descricao : recurso.titulo}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '1.1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {lista.length === 0 && <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Nenhum arquivo anexado.</p>}
          {lista.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nome}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{ROTULO_TIPO_ANEXO[a.tipo] || 'Outro'} • {dataBR(a.created_at)}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <button onClick={() => abrirArquivo(BUCKET_RP, a.arquivo_path, showError)} style={btnPequeno('59,130,246')}>Abrir</button>
                {podeEditar && <button onClick={() => excluir(a)} style={btnPequeno('239,68,68')}>🗑️</button>}
              </div>
            </div>
          ))}

          {podeEditar && (
            <form onSubmit={enviar} style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                <div>
                  <label style={lbl}>Tipo de documento</label>
                  <select value={tipo} onChange={e => setTipo(e.target.value)} style={inp()}>
                    {Object.entries(ROTULO_TIPO_ANEXO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Nome (opcional)</label><input value={nome} onChange={e => setNome(e.target.value)} style={inp()} placeholder="Ex.: Recibo de entrega" /></div>
              </div>
              <div><label style={lbl}>Arquivo (PDF ou imagem)</label><input id="input-anexo-rp" type="file" accept=".pdf,image/*" onChange={e => setArquivo(e.target.files?.[0] || null)} style={inp({ padding: '0.4rem 0.75rem' })} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" onClick={onClose} style={btn('100,116,139')}>Fechar</button>
                <button type="submit" disabled={enviando} style={btn('16,185,129')}>{enviando ? 'Enviando...' : '📤 Anexar'}</button>
              </div>
            </form>
          )}
          {!podeEditar && <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={onClose} style={btn('100,116,139')}>Fechar</button></div>}
        </div>
      </div>
    </div>
  );
}
