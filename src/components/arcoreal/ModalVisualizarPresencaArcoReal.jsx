import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const SITUACAO_COR = {
  regular:    { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.3)' },
  licenciado: { bg: 'rgba(74,222,128,0.15)', color: '#4ade80', border: 'rgba(74,222,128,0.3)' },
};

export default function ModalVisualizarPresencaArcoReal({ sessaoId, onFechar, onEditar }) {
  const [loading, setLoading] = useState(true);
  const [sessao, setSessao] = useState(null);
  const [presencas, setPresencas] = useState([]);

  useEffect(() => { if (sessaoId) carregarDados(); }, [sessaoId]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const { data: sessaoData, error: sessaoError } = await supabase
        .from('arco_real_sessoes').select('*').eq('id', sessaoId).single();
      if (sessaoError) throw sessaoError;
      setSessao(sessaoData);

      const { data: membrosData } = await supabase
        .from('arco_real_membros')
        .select('id, nome, cargo, situacao, foto_url')
        .eq('ativo', true)
        .in('situacao', ['regular', 'licenciado'])
        .order('nome');

      const { data: registrosData } = await supabase
        .from('arco_real_registros_presenca')
        .select('membro_id, presente, justificativa')
        .eq('sessao_id', sessaoId);

      const registrosMap = new Map();
      (registrosData || []).forEach(r => registrosMap.set(r.membro_id, r));

      const lista = (membrosData || []).map(m => {
        const reg = registrosMap.get(m.id) || { presente: false, justificativa: null };
        return { membro: m, presente: reg.presente, justificativa: reg.justificativa };
      });
      setPresencas(lista);
    } catch (e) {
      console.error('Erro ao carregar presença:', e);
    } finally {
      setLoading(false);
    }
  };

  const fmtData = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-';

  const est = {
    total:  presencas.length,
    pres:   presencas.filter(p => p.presente).length,
    lic:    presencas.filter(p => !p.presente && p.membro.situacao === 'licenciado').length,
    just:   presencas.filter(p => !p.presente && p.justificativa && p.membro.situacao !== 'licenciado').length,
    injust: presencas.filter(p => !p.presente && !p.justificativa && p.membro.situacao !== 'licenciado').length,
  };
  const pct = est.total > 0 ? Math.round((est.pres / est.total) * 100) : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '56rem', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)' }}>

        {/* Cabeçalho */}
        <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff', margin: 0 }}>Visualizar Presença — Arco Real</h2>
            {sessao && (
              <div style={{ marginTop: '0.35rem' }}>
                <p style={{ color: 'rgba(255,255,255,0.9)', margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
                  {sessao.classificacao || 'Sessão'}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.75)', margin: '0.1rem 0 0', fontSize: '0.8rem' }}>
                  Data: {fmtData(sessao.data_sessao)}
                </p>
              </div>
            )}
          </div>
          <button onClick={onFechar} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '50%', width: '2rem', height: '2rem', cursor: 'pointer', fontWeight: '700', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
        </div>

        {/* Estatísticas */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
            {[
              { label: 'Total',          val: est.total,  cor: 'var(--color-text)' },
              { label: 'Presentes',      val: est.pres,   cor: '#10b981' },
              { label: 'Licenciados',    val: est.lic,    cor: '#f59e0b' },
              { label: 'Justificados',   val: est.just,   cor: '#f59e0b' },
              { label: 'Injustificados', val: est.injust, cor: '#ef4444' },
            ].map((s, i) => (
              <div key={s.label} style={{ textAlign: 'center', padding: '0.9rem 0.5rem', borderRight: i < 4 ? '1px solid var(--color-border)' : 'none' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', margin: '0 0 0.2rem', textTransform: 'uppercase' }}>{s.label}</p>
                <p style={{ fontSize: '1.6rem', fontWeight: '800', color: s.cor, margin: 0 }}>{s.val}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabela de presenças */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.75rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', border: '3px solid var(--color-border)', borderTopColor: '#2d6a9f', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 }}>Carregando presenças...</p>
            </div>
          ) : presencas.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '3rem' }}>Nenhum membro elegível para esta sessão.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)' }}>
                  {['Membro', 'Situação', 'Presença', 'Justificativa'].map((h, i) => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: i === 0 ? 'left' : 'center', fontSize: '0.65rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {presencas.map((reg, idx) => {
                  const ehLic = reg.membro.situacao === 'licenciado';
                  const bgRow = reg.presente
                    ? idx % 2 === 0 ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.1)'
                    : reg.justificativa
                      ? idx % 2 === 0 ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.1)'
                      : idx % 2 === 0 ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.08)';
                  const sitCor = SITUACAO_COR[reg.membro.situacao] || { bg: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: 'var(--color-border)' };
                  return (
                    <tr key={reg.membro.id} style={{ background: bgRow, borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.55rem 0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          {reg.membro.foto_url && (
                            <img src={reg.membro.foto_url} alt={reg.membro.nome} style={{ width: '2rem', height: '2rem', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          )}
                          <div>
                            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: '600', color: 'var(--color-text)' }}>{reg.membro.nome}</p>
                            {reg.membro.cargo && (
                              <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{reg.membro.cargo}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '700', padding: '0.2rem 0.6rem', borderRadius: '999px', background: sitCor.bg, color: sitCor.color, border: `1px solid ${sitCor.border}` }}>
                          {ehLic ? 'Licenciado' : 'Regular'}
                        </span>
                      </td>
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

        {/* Rodapé */}
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
              onClick={() => { onFechar(); onEditar?.(sessaoId); }}
              style={{ padding: '0.5rem 1.1rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              ✏️ Editar Presenças
            </button>
            <button onClick={onFechar} style={{ padding: '0.5rem 1.1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem' }}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
