import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return idade;
};

const GRAU_COR = {
  'Aprendiz':         { bg: 'rgba(139,92,246,0.15)', color: '#7c3aed', border: 'rgba(139,92,246,0.3)' },
  'Companheiro':      { bg: 'rgba(6,182,212,0.15)',  color: '#0891b2', border: 'rgba(6,182,212,0.3)'  },
  'Mestre':           { bg: 'rgba(245,158,11,0.15)', color: '#b45309', border: 'rgba(245,158,11,0.3)' },
  'Mestre Instalado': { bg: 'rgba(16,185,129,0.15)', color: '#065f46', border: 'rgba(16,185,129,0.3)' },
};

export default function ModalVisualizarPresenca({ sessaoId, onFechar, onEditar }) {
  const [loading, setLoading]       = useState(true);
  const [sessao, setSessao]         = useState(null);
  const [presencas, setPresencas]   = useState([]);
  const [visitantes, setVisitantes] = useState([]);
  const [visitanteForm, setVisitanteForm] = useState({ nome_visitante: '', nome_loja: '', cidade: '' });

  useEffect(() => { if (sessaoId) carregarDados(); }, [sessaoId]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const { data: sessaoData, error: sessaoError } = await supabase
        .from('sessoes_presenca')
        .select('*, graus_sessao:grau_sessao_id(nome,grau_minimo_requerido), classificacoes_sessao:classificacao_id(nome)')
        .eq('id', sessaoId).single();
      if (sessaoError) throw sessaoError;
      setSessao(sessaoData);

      const { data: historicoSituacoes } = await supabase
        .from('historico_situacoes').select('*').eq('status', 'ativa');

      const grauMinimo = sessaoData?.graus_sessao?.grau_minimo_requerido
        ? parseInt(sessaoData.graus_sessao.grau_minimo_requerido) : null;

      const { data: todosIrmaos } = await supabase
        .from('irmaos')
        .select('id,nome,foto_url,data_nascimento,situacao,data_iniciacao,data_ingresso_loja,data_elevacao,data_exaltacao,mestre_instalado,data_instalacao,data_falecimento')
        .eq('status', 'ativo').order('nome');

      const { data: registrosPresenca } = await supabase
        .from('registros_presenca').select('membro_id,presente,justificativa').eq('sessao_id', sessaoId);

      const { data: visitantesData } = await supabase
        .from('visitantes_sessao').select('*').eq('sessao_id', sessaoId).order('created_at', { ascending: false });
      setVisitantes(visitantesData || []);

      const registrosMap = new Map();
      registrosPresenca?.forEach(r => registrosMap.set(r.membro_id, r));

      const dataSessao = new Date(sessaoData.data_sessao + 'T00:00:00');

      const presencasComGrau = (todosIrmaos || []).filter(irmao => {
        if (!irmao) return false;
        const situacaoBloqueadora = historicoSituacoes?.find(sit => {
          if (sit.membro_id !== irmao.id) return false;
          const tipo = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (!['desligado','desligamento','irregular','suspenso','excluido','ex-oficio'].includes(tipo)) return false;
          const di = new Date(sit.data_inicio + 'T00:00:00');
          if (dataSessao < di) return false;
          if (sit.data_fim) { const df = new Date(sit.data_fim + 'T00:00:00'); return dataSessao >= di && dataSessao <= df; }
          return dataSessao >= di;
        });
        if (situacaoBloqueadora) return false;
        const dataIngresso = irmao.data_ingresso_loja
          ? new Date(irmao.data_ingresso_loja + 'T00:00:00')
          : irmao.data_iniciacao ? new Date(irmao.data_iniciacao + 'T00:00:00') : null;
        if (!dataIngresso || dataSessao < dataIngresso) return false;
        if (irmao.data_falecimento && dataSessao > new Date(irmao.data_falecimento + 'T00:00:00')) return false;
        if (grauMinimo === 2) { if (!irmao.data_elevacao) return false; return dataSessao >= new Date(irmao.data_elevacao + 'T00:00:00'); }
        if (grauMinimo === 3) { if (!irmao.data_exaltacao) return false; return dataSessao >= new Date(irmao.data_exaltacao + 'T00:00:00'); }
        return true;
      }).map(irmao => {
        let grau = 'Sem Grau';
        if (irmao.data_exaltacao && dataSessao >= new Date(irmao.data_exaltacao + 'T00:00:00')) {
          if (irmao.mestre_instalado) {
            grau = (irmao.data_instalacao && dataSessao >= new Date(irmao.data_instalacao + 'T00:00:00')) ? 'Mestre Instalado' : 'Mestre';
          } else { grau = 'Mestre'; }
        } else if (irmao.data_elevacao && dataSessao >= new Date(irmao.data_elevacao + 'T00:00:00')) {
          grau = 'Companheiro';
        } else if (irmao.data_iniciacao) { grau = 'Aprendiz'; }

        const idade = calcularIdade(irmao.data_nascimento);
        const registro = registrosMap.get(irmao.id) || { presente: false, justificativa: null };
        return { id: `presenca-${irmao.id}`, membro_id: irmao.id, irmaos: irmao, presente: registro.presente, justificativa: registro.justificativa, grau, tem_prerrogativa: idade >= 70 };
      });

      setPresencas(presencasComGrau);
    } catch (e) { console.error('Erro ao carregar presença:', e); }
    finally { setLoading(false); }
  };

  const fmtData = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-';

  const adicionarVisitante = async () => {
    if (!visitanteForm.nome_visitante || !visitanteForm.nome_loja || !visitanteForm.cidade) return;
    const { error } = await supabase.from('visitantes_sessao').insert([{ sessao_id: sessaoId, ...visitanteForm }]);
    if (!error) { carregarDados(); setVisitanteForm({ nome_visitante: '', nome_loja: '', cidade: '' }); }
  };

  const excluirVisitante = async (id) => {
    const { error } = await supabase.from('visitantes_sessao').delete().eq('id', id);
    if (!error) carregarDados();
  };

  const est = {
    total:    presencas.length,
    pres:     presencas.filter(p => p.presente).length,
    lic:      presencas.filter(p => !p.presente && p.irmaos?.situacao?.toLowerCase() === 'licenciado').length,
    just:     presencas.filter(p => !p.presente && p.justificativa && p.irmaos?.situacao?.toLowerCase() !== 'licenciado').length,
    injust:   presencas.filter(p => !p.presente && !p.justificativa && p.irmaos?.situacao?.toLowerCase() !== 'licenciado').length,
  };
  const pct = est.total > 0 ? Math.round((est.pres / est.total) * 100) : 0;

  const sInput = { background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.6rem', fontSize: '0.82rem', flex: 1 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '56rem', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)' }}>

        {/* ── Cabeçalho ── */}
        <div style={{ background: 'var(--color-accent)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff', margin: 0 }}>Visualizar Presença</h2>
            {sessao && (
              <div style={{ marginTop: '0.35rem' }}>
                <p style={{ color: 'rgba(255,255,255,0.9)', margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
                  {sessao.graus_sessao?.nome}{sessao.classificacoes_sessao ? ` - ${sessao.classificacoes_sessao.nome}` : ''}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.75)', margin: '0.1rem 0 0', fontSize: '0.8rem' }}>
                  Data: {fmtData(sessao.data_sessao)}
                </p>
              </div>
            )}
          </div>
          <button onClick={onFechar} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '50%', width: '2rem', height: '2rem', cursor: 'pointer', fontWeight: '700', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
        </div>

        {/* ── Estatísticas ── */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
            {[
              { label: 'Total',         val: est.total,  cor: 'var(--color-text)' },
              { label: 'Presentes',     val: est.pres,   cor: '#10b981' },
              { label: 'Licenciados',   val: est.lic,    cor: '#f59e0b' },
              { label: 'Justificados',  val: est.just,   cor: '#f59e0b' },
              { label: 'Injustificados',val: est.injust, cor: '#ef4444' },
            ].map((s, i) => (
              <div key={s.label} style={{ textAlign: 'center', padding: '0.9rem 0.5rem', borderRight: i < 4 ? '1px solid var(--color-border)' : 'none' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', margin: '0 0 0.2rem', textTransform: 'uppercase' }}>{s.label}</p>
                <p style={{ fontSize: '1.6rem', fontWeight: '800', color: s.cor, margin: 0 }}>{s.val}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabela de presenças ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.75rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 }}>Carregando presenças...</p>
            </div>
          ) : presencas.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '3rem' }}>Nenhuma presença registrada nesta sessão.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)' }}>
                  {['Irmão', 'Grau', 'Presença', 'Justificativa'].map((h, i) => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: i === 0 ? 'left' : 'center', fontSize: '0.65rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {presencas.map((reg, idx) => {
                  const ehLic  = reg.irmaos?.situacao?.toLowerCase() === 'licenciado';
                  const bgRow  = reg.presente
                    ? idx % 2 === 0 ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.1)'
                    : reg.justificativa
                      ? idx % 2 === 0 ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.1)'
                      : idx % 2 === 0 ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.08)';
                  const grauCor = GRAU_COR[reg.grau] || { bg: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: 'var(--color-border)' };
                  return (
                    <tr key={reg.id} style={{ background: bgRow, borderBottom: '1px solid var(--color-border)' }}>
                      {/* Irmão */}
                      <td style={{ padding: '0.55rem 0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          {reg.irmaos.foto_url && (
                            <img src={reg.irmaos.foto_url} alt={reg.irmaos.nome} style={{ width: '2rem', height: '2rem', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          )}
                          <div>
                            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: '600', color: 'var(--color-text)' }}>{reg.irmaos.nome}</p>
                            <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.15rem', flexWrap: 'wrap' }}>
                              {ehLic && (
                                <span style={{ fontSize: '0.62rem', fontWeight: '700', padding: '0.1rem 0.4rem', borderRadius: '999px', background: 'rgba(245,158,11,0.15)', color: '#b45309', border: '1px solid rgba(245,158,11,0.3)' }}>Licenciado</span>
                              )}
                              {reg.tem_prerrogativa && (
                                <span style={{ fontSize: '0.62rem', fontWeight: '700', padding: '0.1rem 0.4rem', borderRadius: '999px', background: 'rgba(139,92,246,0.15)', color: '#7c3aed', border: '1px solid rgba(139,92,246,0.3)' }}>Prerrogativa</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Grau */}
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '700', padding: '0.2rem 0.6rem', borderRadius: '999px', background: grauCor.bg, color: grauCor.color, border: `1px solid ${grauCor.border}` }}>
                          {reg.grau}
                        </span>
                      </td>
                      {/* Presença */}
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center' }}>
                        {reg.presente ? (
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.2rem 0.65rem', borderRadius: '999px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>✓ Presente</span>
                        ) : ehLic ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>—</span>
                        ) : reg.justificativa ? (
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.2rem 0.65rem', borderRadius: '999px', background: 'rgba(245,158,11,0.15)', color: '#b45309', border: '1px solid rgba(245,158,11,0.3)' }}>J Justificado</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.2rem 0.65rem', borderRadius: '999px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>✗ Ausente</span>
                        )}
                      </td>
                      {/* Justificativa */}
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center' }}>
                        {reg.justificativa ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text)', background: 'rgba(245,158,11,0.1)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-md)', display: 'inline-block' }}>{reg.justificativa}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Visitantes ── */}
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)', flexShrink: 0 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--color-text)', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            👥 Visitantes {visitantes.length > 0 && <span style={{ fontSize: '0.72rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', borderRadius: '999px', padding: '0.1rem 0.5rem', fontWeight: '700' }}>{visitantes.length}</span>}
          </h3>
          {visitantes.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: 0 }}>Nenhum visitante registrado.</p>
          ) : (
            <div style={{ maxHeight: '130px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-3)' }}>
                    {['Nome', 'Loja', 'Cidade'].map(h => (
                      <th key={h} style={{ padding: '0.35rem 0.6rem', textAlign: 'left', fontWeight: '700', color: 'var(--color-text-muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visitantes.map((v, i) => (
                    <tr key={v.id} style={{ background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', borderTop: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.35rem 0.6rem', color: 'var(--color-text)' }}>{v.nome_visitante}</td>
                      <td style={{ padding: '0.35rem 0.6rem', color: 'var(--color-text-muted)' }}>{v.nome_loja}</td>
                      <td style={{ padding: '0.35rem 0.6rem', color: 'var(--color-text-muted)' }}>{v.cidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Rodapé ── */}
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Taxa de Presença:</span>
            <span style={{ fontSize: '1.1rem', fontWeight: '800', color: pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444' }}>{pct}%</span>
            <div style={{ width: '80px', height: '6px', background: 'var(--color-surface-2)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444', borderRadius: '999px', transition: 'width 0.3s' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => { onFechar(); if (onEditar) onEditar(sessaoId); }}
              style={{ padding: '0.5rem 1.1rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              ✏️ Editar Presenças
            </button>
            <button
              onClick={onFechar}
              style={{ padding: '0.5rem 1.1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
