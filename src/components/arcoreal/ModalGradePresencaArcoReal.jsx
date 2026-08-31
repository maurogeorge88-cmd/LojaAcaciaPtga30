import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function ModalGradePresencaArcoReal({ onFechar }) {
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState([]);
  const [membros, setMembros] = useState([]);
  const [grade, setGrade] = useState({});
  const [busca, setBusca] = useState('');
  const [anosDisponiveis, setAnosDisponiveis] = useState([new Date().getFullYear()]);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  useEffect(() => { buscarAnos(); }, []);
  useEffect(() => { if (anosDisponiveis.length > 0) carregar(); }, [anoSelecionado, anosDisponiveis]);

  const buscarAnos = async () => {
    const { data } = await supabase.from('arco_real_sessoes').select('data_sessao');
    const anosEncontrados = (data || []).map(s => new Date(s.data_sessao + 'T00:00:00').getFullYear());
    const anosFinal = [...new Set([...anosEncontrados, new Date().getFullYear()])].sort((a, b) => b - a);
    setAnosDisponiveis(anosFinal);
    if (!anosFinal.includes(anoSelecionado)) setAnoSelecionado(anosFinal[0]);
  };

  const carregar = async () => {
    setLoading(true);
    try {
      const { data: sessoesData } = await supabase
        .from('arco_real_sessoes')
        .select('id, data_sessao, classificacao')
        .gte('data_sessao', `${anoSelecionado}-01-01`)
        .lte('data_sessao', `${anoSelecionado}-12-31`)
        .order('data_sessao');

      const { data: membrosData } = await supabase
        .from('arco_real_membros')
        .select('id, nome, situacao, foto_url')
        .eq('ativo', true)
        .in('situacao', ['regular', 'licenciado'])
        .order('nome');

      const sessaoIds = (sessoesData || []).map(s => s.id);
      let todosRegistros = [];
      if (sessaoIds.length > 0) {
        const TAMANHO = 1000;
        let pagina = 0;
        while (true) {
          const { data: lote } = await supabase
            .from('arco_real_registros_presenca')
            .select('membro_id, sessao_id, presente, justificativa')
            .in('sessao_id', sessaoIds)
            .range(pagina * TAMANHO, pagina * TAMANHO + TAMANHO - 1);
          todosRegistros = todosRegistros.concat(lote || []);
          if (!lote || lote.length < TAMANHO) break;
          pagina++;
        }
      }

      const gradeCompleta = {};
      todosRegistros.forEach(reg => {
        if (!gradeCompleta[reg.membro_id]) gradeCompleta[reg.membro_id] = {};
        gradeCompleta[reg.membro_id][reg.sessao_id] = { presente: reg.presente, justificativa: reg.justificativa };
      });

      setSessoes(sessoesData || []);
      setMembros(membrosData || []);
      setGrade(gradeCompleta);
    } catch (e) {
      console.error('Erro ao carregar grade de presença:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (d) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const renderizarCelula = (membroId, sessaoId) => {
    const reg = grade[membroId]?.[sessaoId];
    if (!reg) {
      return <td key={sessaoId} style={{ border: '1px solid var(--color-border)', textAlign: 'center', padding: '0.35rem', color: 'var(--color-text-muted)' }}>—</td>;
    }
    if (reg.presente) {
      return <td key={sessaoId} style={{ border: '1px solid var(--color-border)', textAlign: 'center', padding: '0.35rem', background: 'rgba(16,185,129,0.12)', color: '#10b981', fontWeight: '800' }}>✓</td>;
    }
    if (reg.justificativa) {
      return <td key={sessaoId} title={reg.justificativa} style={{ border: '1px solid var(--color-border)', textAlign: 'center', padding: '0.35rem', background: 'rgba(245,158,11,0.12)', color: '#b45309', fontWeight: '800' }}>J</td>;
    }
    return <td key={sessaoId} style={{ border: '1px solid var(--color-border)', textAlign: 'center', padding: '0.35rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: '800' }}>✗</td>;
  };

  const membrosFiltrados = membros.filter(m => busca === '' || m.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '78rem', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)' }}>

        {/* Cabeçalho */}
        <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', padding: '1.1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#fff', margin: 0 }}>🔲 Grade de Presença — Arco Real</h2>
          <button onClick={onFechar} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '50%', width: '2rem', height: '2rem', cursor: 'pointer', fontWeight: '700', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem 1.25rem', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', flexShrink: 0, flexWrap: 'wrap' }}>
          <select value={anoSelecionado} onChange={e => setAnoSelecionado(Number(e.target.value))} style={{ padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer', outline: 'none' }}>
            {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <input
            type="text"
            placeholder="🔍 Buscar membro..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ flex: 1, minWidth: '180px', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.75rem', outline: 'none', fontSize: '0.82rem' }}
          />
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
            <span><span style={{ color: '#10b981', fontWeight: '800' }}>✓</span> Presente</span>
            <span><span style={{ color: '#b45309', fontWeight: '800' }}>J</span> Justificado</span>
            <span><span style={{ color: '#ef4444', fontWeight: '800' }}>✗</span> Ausente</span>
          </div>
        </div>

        {/* Tabela */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.75rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', border: '3px solid var(--color-border)', borderTopColor: '#2d6a9f', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 }}>Carregando grade...</p>
            </div>
          ) : sessoes.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '3rem' }}>Nenhuma sessão cadastrada em {anoSelecionado}.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead style={{ background: 'var(--color-surface-2)', position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ border: '1px solid var(--color-border)', padding: '0.6rem 0.85rem', textAlign: 'left', fontWeight: '700', background: 'var(--color-surface-2)', position: 'sticky', left: 0, zIndex: 20, color: 'var(--color-text)' }}>
                    Membro
                  </th>
                  {sessoes.map(s => (
                    <th key={s.id} style={{ border: '1px solid var(--color-border)', padding: '0.4rem', textAlign: 'center', whiteSpace: 'nowrap', color: 'var(--color-text)', fontWeight: '600' }}>
                      {formatarData(s.data_sessao)}
                    </th>
                  ))}
                  <th style={{ border: '1px solid var(--color-border)', padding: '0.4rem', textAlign: 'center', fontWeight: '700', background: 'var(--color-surface-2)', color: 'var(--color-text)' }}>Total</th>
                  <th style={{ border: '1px solid var(--color-border)', padding: '0.4rem', textAlign: 'center', fontWeight: '700', background: 'var(--color-surface-2)', color: 'var(--color-text)' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {membrosFiltrados.map(membro => {
                  const presencasMembro = sessoes.filter(s => grade[membro.id]?.[s.id]?.presente).length;
                  const percentual = sessoes.length > 0 ? Math.round((presencasMembro / sessoes.length) * 100) : 0;
                  return (
                    <tr key={membro.id}>
                      <td style={{ border: '1px solid var(--color-border)', padding: '0.4rem 0.85rem', background: 'var(--color-surface)', position: 'sticky', left: 0, zIndex: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {membro.foto_url && <img src={membro.foto_url} alt={membro.nome} style={{ width: '1.6rem', height: '1.6rem', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />}
                          <span style={{ color: 'var(--color-text)', fontWeight: '600', whiteSpace: 'nowrap' }}>{membro.nome}</span>
                          {membro.situacao === 'licenciado' && (
                            <span style={{ fontSize: '0.6rem', fontWeight: '700', padding: '0.05rem 0.35rem', borderRadius: '999px', background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>Lic.</span>
                          )}
                        </div>
                      </td>
                      {sessoes.map(s => renderizarCelula(membro.id, s.id))}
                      <td style={{ border: '1px solid var(--color-border)', padding: '0.4rem', textAlign: 'center', fontWeight: '700', color: 'var(--color-text)' }}>{presencasMembro}/{sessoes.length}</td>
                      <td style={{ border: '1px solid var(--color-border)', padding: '0.4rem', textAlign: 'center', fontWeight: '800', color: percentual >= 70 ? '#10b981' : percentual >= 50 ? '#f59e0b' : '#ef4444' }}>{percentual}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Rodapé */}
        <div style={{ padding: '0.65rem 1.25rem', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onFechar} style={{ padding: '0.5rem 1.25rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem' }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
