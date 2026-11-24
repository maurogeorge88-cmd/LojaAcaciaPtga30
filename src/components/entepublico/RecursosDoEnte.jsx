/**
 * Aba "Recursos" do acesso do ente público (somente leitura).
 * O banco (RLS + view v_recurso_saldo) já entrega só os recursos liberados ao ente.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { buscarTudo, moeda, dataBR, num, abrirArquivo, urlParaDataUrl, BUCKET_RP, BUCKET_NF, ROTULO_TIPO_ANEXO, TIPOS_APLICACAO } from '../recursospublicos/comum';
import { montarDadosPrestacao, gerarPrestacaoContasRecursosPDF } from '../../utils/gerarPrestacaoContasRecursosPDF';

const caixa = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '0.9rem 1.1rem' };
const btnP = { padding: '0.3rem 0.7rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' };

export default function RecursosDoEnte({ entidade, dadosLoja, registrarAcao }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [d, setD] = useState({ recursos: [], saldos: {}, nfs: [], equipamentos: [], aplicacoes: [], anexos: [] });
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [recursos, saldosLista, nfs, equipamentos, aplicacoes, anexos] = await Promise.all([
          buscarTudo(() => supabase.from('recursos_publicos').select('*').order('data_recebimento', { ascending: false }).order('id')),
          buscarTudo(() => supabase.from('v_recurso_saldo').select('*').order('recurso_id')),
          buscarTudo(() => supabase.from('comodato_recursos').select('*').not('recurso_publico_id', 'is', null).order('id')),
          buscarTudo(() => supabase.from('equipamentos').select('id, numero_patrimonio, status, valor_aquisicao, recurso_id, tipos_equipamentos(nome)').not('recurso_id', 'is', null).order('id')),
          buscarTudo(() => supabase.from('recurso_aplicacoes').select('*').order('id')),
          buscarTudo(() => supabase.from('recurso_anexos').select('*').order('id')),
        ]);
        const saldos = {}; saldosLista.forEach(s => { saldos[s.recurso_id] = s; });
        setD({ recursos, saldos, nfs, equipamentos, aplicacoes, anexos });
      } catch (e) {
        console.error(e);
        setErro('Não foi possível carregar os recursos. Verifique se o acesso foi liberado pela Loja.');
      } finally { setCarregando(false); }
    })();
  }, []);

  const resumo = useMemo(() => {
    const t = { recebido: 0, comodato: 0, outras: 0, saldo: 0 };
    d.recursos.forEach(r => {
      const s = d.saldos[r.id] || {};
      t.recebido += num(s.valor_recebido ?? r.valor_recebido); t.comodato += num(s.comodato_nf); t.outras += num(s.outras_aplicacoes);
      t.saldo += num(s.saldo ?? r.valor_recebido);
    });
    return t;
  }, [d]);

  const entesFake = useMemo(() => {
    const m = {}; d.recursos.forEach(r => { m[r.origem_id] = { id: r.origem_id, nome: entidade || 'Ente' }; });
    return Object.values(m);
  }, [d.recursos, entidade]);

  const gerarPDF = async () => {
    setGerando(true);
    try {
      let logo = null;
      if (dadosLoja?.logo_url) { try { logo = await urlParaDataUrl(dadosLoja.logo_url); } catch (e) { /* sem logo */ } }
      const lista = montarDadosPrestacao({ entes: entesFake, recursos: d.recursos, saldos: d.saldos, nfs: d.nfs, equipamentos: d.equipamentos, aplicacoes: d.aplicacoes, anexos: d.anexos });
      gerarPrestacaoContasRecursosPDF({ dados: lista, dadosLoja: dadosLoja || {}, logo, filtro: entidade || '' });
      registrarAcao && registrarAcao('Prestação de contas dos recursos');
    } catch (e) { alert('Erro ao gerar PDF: ' + e.message); }
    finally { setGerando(false); }
  };

  if (carregando) return <p style={{ color: 'var(--color-text-muted)' }}>Carregando...</p>;
  if (erro) return <div style={{ ...caixa, color: '#ef4444', fontWeight: 600 }}>⚠️ {erro}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        {[['Recebido', resumo.recebido, '#64748b'], ['Em equipamentos de comodato', resumo.comodato, '#3b82f6'], ['Outras aplicações', resumo.outras, '#8b5cf6'], ['Saldo a aplicar', resumo.saldo, resumo.saldo < -0.005 ? '#ef4444' : '#10b981']].map(([t, v, c]) => (
          <div key={t} style={{ background: 'var(--color-surface)', border: `1px solid ${c}66`, borderLeft: `4px solid ${c}`, borderRadius: 'var(--radius-lg)', padding: '0.7rem 1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{t}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: c }}>{moeda(v)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={gerarPDF} disabled={gerando || d.recursos.length === 0} style={{ ...btnP, padding: '0.5rem 1rem', fontSize: '0.85rem' }}>{gerando ? 'Gerando...' : '📄 Prestação de contas (PDF)'}</button>
      </div>

      {d.recursos.length === 0 && <div style={{ ...caixa, textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhum recurso liberado até o momento.</div>}

      {d.recursos.map(r => {
        const s = d.saldos[r.id] || {};
        const nfsR = d.nfs.filter(n => n.recurso_publico_id === r.id);
        const apsR = d.aplicacoes.filter(a => a.recurso_id === r.id);
        const anexosR = d.anexos.filter(a => a.recurso_id === r.id);
        const saldo = num(s.saldo ?? r.valor_recebido);
        return (
          <div key={r.id} style={{ ...caixa, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <strong style={{ color: 'var(--color-text)', fontSize: '1rem' }}>{r.titulo}</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  {r.data_recebimento ? `Recebido em ${dataBR(r.data_recebimento)}` : ''}{r.numero_processo ? ` • processo ${r.numero_processo}` : ''}{r.documento_ref ? ` • ${r.documento_ref}` : ''}
                </div>
                {r.finalidade && <div style={{ fontSize: '0.8rem', color: 'var(--color-text)', marginTop: '0.2rem' }}>Finalidade: {r.finalidade}</div>}
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                <div>Recebido: <strong style={{ color: 'var(--color-text)' }}>{moeda(s.valor_recebido ?? r.valor_recebido)}</strong></div>
                <div>Saldo: <strong style={{ color: saldo < -0.005 ? '#ef4444' : '#10b981' }}>{moeda(saldo)}</strong></div>
              </div>
            </div>

            {nfsR.length > 0 && (
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>🦽 Equipamentos de comodato</div>
                {nfsR.map(n => {
                  const eqs = d.equipamentos.filter(e => e.recurso_id === n.id);
                  return (
                    <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.84rem', padding: '0.3rem 0', borderTop: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                      <span>NF {n.numero_nf}{n.data_nf ? ` • ${dataBR(n.data_nf)}` : ''}{n.fornecedor ? ` • ${n.fornecedor}` : ''} — {eqs.length} equipamento(s)</span>
                      <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <strong>{moeda(n.valor_total)}</strong>
                        {n.arquivo_path && <button onClick={() => abrirArquivo(BUCKET_NF, n.arquivo_path)} style={btnP}>📎 Nota</button>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {apsR.length > 0 && (
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>🎁 Outras aplicações</div>
                {apsR.map(a => {
                  const ax = anexosR.filter(x => x.aplicacao_id === a.id);
                  return (
                    <div key={a.id} style={{ fontSize: '0.84rem', padding: '0.3rem 0', borderTop: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span>{TIPOS_APLICACAO[a.tipo]?.icone} <strong>{a.descricao}</strong>{a.situacao === 'prevista' ? ' (prevista)' : ''}{a.destinatario ? ` — ${a.destinatario}` : ''}{a.data_aplicacao ? ` • ${dataBR(a.data_aplicacao)}` : ''}</span>
                        <strong>{moeda(a.valor)}</strong>
                      </div>
                      {ax.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                          {ax.map(x => <button key={x.id} onClick={() => abrirArquivo(BUCKET_RP, x.arquivo_path)} style={btnP}>📎 {ROTULO_TIPO_ANEXO[x.tipo] || 'Anexo'}: {x.nome}</button>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {anexosR.filter(x => !x.aplicacao_id).length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {anexosR.filter(x => !x.aplicacao_id).map(x => <button key={x.id} onClick={() => abrirArquivo(BUCKET_RP, x.arquivo_path)} style={btnP}>📎 {ROTULO_TIPO_ANEXO[x.tipo] || 'Anexo'}: {x.nome}</button>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
