/**
 * Detalhe de um recurso: resumo (recebido / aplicado / saldo) e abas
 * Comodato · Doações/Repasses · Obras/Serviços · Outros · Anexos.
 */
import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import ComodatoRecurso from './ComodatoRecurso';
import AplicacoesRecurso from './AplicacoesRecurso';
import ModalAnexos from './ModalAnexos';
import ModalRecurso from './ModalRecurso';
import { card, btn, btnPequeno, moeda, dataBR, resumoDoRecurso, TIPOS_APLICACAO, BUCKET_RP, ROTULO_TIPO_ANEXO, abrirArquivo, urlParaDataUrl } from './comum';
import { montarDadosPrestacao, gerarPrestacaoContasRecursosPDF } from '../../utils/gerarPrestacaoContasRecursosPDF';

export default function DetalheRecurso({ recurso, dados, podeEditar, onVoltar, onChange, showSuccess, showError }) {
  const { entes, saldos, nfs, equipamentos, aplicacoes, anexos } = dados;
  const [aba, setAba] = useState('comodato');
  const [editando, setEditando] = useState(false);
  const [anexando, setAnexando] = useState(false);
  const [gerando, setGerando] = useState(false);

  const ente = (entes || []).find(e => e.id === recurso.origem_id);
  const r = resumoDoRecurso(recurso, saldos);
  const nfsR = (nfs || []).filter(n => n.recurso_publico_id === recurso.id);
  const apsR = (aplicacoes || []).filter(a => a.recurso_id === recurso.id);
  const anexosR = (anexos || []).filter(a => a.recurso_id === recurso.id);
  const corSaldo = r.saldo < -0.005 ? '#ef4444' : (r.saldo > 0.005 ? '#f59e0b' : '#10b981');
  const pct = r.recebido > 0 ? Math.min(100, (r.aplicado / r.recebido) * 100) : 0;

  const contar = (t) => apsR.filter(a => a.tipo === t).length;
  const ABAS = [
    ['comodato', `🦽 Comodato (${nfsR.length})`],
    ['doacao', `${TIPOS_APLICACAO.doacao.icone} ${TIPOS_APLICACAO.doacao.rotulo} (${contar('doacao')})`],
    ['obra', `${TIPOS_APLICACAO.obra.icone} ${TIPOS_APLICACAO.obra.rotulo} (${contar('obra')})`],
    ['outro', `${TIPOS_APLICACAO.outro.icone} ${TIPOS_APLICACAO.outro.rotulo} (${contar('outro')})`],
    ['anexos', `📎 Anexos (${anexosR.length})`],
  ];

  const excluir = async () => {
    if (nfsR.length || apsR.length) { showError('Este recurso tem notas ou aplicações. Exclua-as antes de excluir o recurso.'); return; }
    if (!confirm(`Excluir o recurso "${recurso.titulo}"?`)) return;
    try {
      const paths = anexosR.map(a => a.arquivo_path);
      const { data, error } = await supabase.from('recursos_publicos').delete().eq('id', recurso.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão para excluir.');
      if (paths.length) await supabase.storage.from(BUCKET_RP).remove(paths);
      showSuccess('✅ Recurso excluído.');
      onChange(); onVoltar();
    } catch (err) { showError('Erro ao excluir: ' + err.message); }
  };

  const gerarPDF = async () => {
    setGerando(true);
    try {
      const { data: loja } = await supabase.from('dados_loja').select('*').limit(1).maybeSingle();
      let logo = null;
      if (loja?.logo_url) { try { logo = await urlParaDataUrl(loja.logo_url); } catch (e) { /* sem logo */ } }
      const lista = montarDadosPrestacao({ entes, recursos: [recurso], saldos, nfs, equipamentos, aplicacoes, anexos });
      gerarPrestacaoContasRecursosPDF({ dados: lista, dadosLoja: loja || {}, logo, filtro: `${ente?.nome || ''} — ${recurso.titulo}`, nomeArquivo: 'Prestacao_Contas_Recurso.pdf' });
    } catch (err) { showError('Erro ao gerar PDF: ' + err.message); }
    finally { setGerando(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div><button onClick={onVoltar} style={btnPequeno('100,116,139')}>← Voltar à lista</button></div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{recurso.titulo}</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              🏛️ {ente?.nome || '—'}{recurso.data_recebimento ? ` • recebido em ${dataBR(recurso.data_recebimento)}` : ''}
              {recurso.numero_processo ? ` • processo ${recurso.numero_processo}` : ''}{recurso.documento_ref ? ` • ${recurso.documento_ref}` : ''}
            </p>
            {recurso.finalidade && <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--color-text)' }}>Finalidade: {recurso.finalidade}</p>}
            <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', padding: '0.1rem 0.6rem', borderRadius: '999px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>{recurso.situacao === 'encerrado' ? 'Encerrado' : 'Aberto'}</span>
              {recurso.liberado_ente && <span style={{ fontSize: '0.72rem', padding: '0.1rem 0.6rem', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981', fontWeight: 700 }}>🏛️ Liberado ao ente</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button onClick={gerarPDF} disabled={gerando} style={btnPequeno('59,130,246')}>{gerando ? 'Gerando...' : '📄 Prestação de contas'}</button>
            {podeEditar && <button onClick={() => setEditando(true)} style={btnPequeno()}>✏️ Editar</button>}
            {podeEditar && <button onClick={excluir} style={btnPequeno('239,68,68')}>🗑️</button>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.7rem', marginTop: '1rem' }}>
          {[
            ['Recebido', r.recebido, 'var(--color-text)'],
            ['Em comodato (NFs)', r.comodato, '#3b82f6'],
            ['Outras aplicações', r.outras, '#8b5cf6'],
            ['Saldo a aplicar', r.saldo, corSaldo],
          ].map(([t, v, cor]) => (
            <div key={t} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', borderTop: `4px solid ${cor}`, padding: '0.6rem 0.9rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>{t}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: cor }}>{moeda(v)}</div>
            </div>
          ))}
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--color-surface-2)', overflow: 'hidden', marginTop: '0.8rem' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: r.saldo < -0.005 ? '#ef4444' : '#10b981' }} />
        </div>
        {r.saldo < -0.005 && <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>⚠️ O valor aplicado é maior que o valor recebido. Confira os lançamentos.</p>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {ABAS.map(([k, l]) => (
          <button key={k} onClick={() => setAba(k)} style={{ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
            border: `1px solid ${aba === k ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: aba === k ? 'var(--color-accent)' : 'var(--color-surface)', color: aba === k ? '#fff' : 'var(--color-accent)' }}>{l}</button>
        ))}
      </div>

      {aba === 'comodato' && (
        <ComodatoRecurso recurso={recurso} nfs={nfs} equipamentos={equipamentos} podeEditar={podeEditar} onChange={onChange} showSuccess={showSuccess} showError={showError} />
      )}
      {['doacao', 'obra', 'outro'].includes(aba) && (
        <AplicacoesRecurso key={aba} tipo={aba} recurso={recurso} aplicacoes={aplicacoes} anexos={anexos} podeEditar={podeEditar} onChange={onChange} showSuccess={showSuccess} showError={showError} />
      )}
      {aba === 'anexos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Todos os documentos deste recurso e de suas aplicações.</span>
            <button onClick={() => setAnexando(true)} style={btn('16,185,129')}>{podeEditar ? '📎 Anexar ao recurso' : '📎 Ver anexos do recurso'}</button>
          </div>
          {anexosR.length === 0 && <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>Nenhum anexo.</div>}
          {anexosR.map(a => {
            const ap = a.aplicacao_id ? apsR.find(x => x.id === a.aplicacao_id) : null;
            return (
              <div key={a.id} style={{ ...card, padding: '0.6rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text)' }}>{a.nome}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{ROTULO_TIPO_ANEXO[a.tipo] || 'Outro'} • {ap ? `Aplicação: ${ap.descricao}` : 'Recurso'} • {dataBR(a.created_at)}</div>
                </div>
                <button onClick={() => abrirArquivo(BUCKET_RP, a.arquivo_path, showError)} style={btnPequeno('59,130,246')}>Abrir</button>
              </div>
            );
          })}
        </div>
      )}

      {anexando && <ModalAnexos recurso={recurso} anexos={anexos} podeEditar={podeEditar} onClose={() => setAnexando(false)} onChange={onChange} showSuccess={showSuccess} showError={showError} />}
      {editando && (
        <ModalRecurso entes={entes} recurso={recurso} nfs={nfs} equipamentos={equipamentos}
          onClose={() => setEditando(false)} onSaved={() => { setEditando(false); onChange(); }} showSuccess={showSuccess} showError={showError} />
      )}
    </div>
  );
}
