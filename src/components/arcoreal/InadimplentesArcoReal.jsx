import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { gerarRelatorioPendenciasArcoRealPDF } from '../../utils/gerarRelatorioPendenciasArcoRealPDF';

const fmtR = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const fmtD = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

// Tela de relatórios de inadimplência do Arco Real — mesmo papel do
// RelatorioIrmaosPendencias.jsx da Loja: lista quem deve, com geração de
// PDF individual e em lote. Só quem tem acesso completo (canViewFinancial)
// consegue ver esta tela — vem gateado no ArcoRealApp.
export default function InadimplentesArcoReal({ podeGerenciar, showSuccess, showError }) {
  const [loading, setLoading] = useState(true);
  const [inadimplentes, setInadimplentes] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [gerando, setGerando] = useState(false);
  const [busca, setBusca] = useState('');

  const LOGO_ARCO_REAL = supabase.storage.from('arcoreal').getPublicUrl('logo.png').data.publicUrl;

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('arco_real_lancamentos')
        .select('id, descricao, valor, data_vencimento, tipo, origem_membro_id, arco_real_membros(id, nome, cpf)')
        .eq('status', 'pendente')
        .not('origem_membro_id', 'is', null)
        .order('data_vencimento');
      if (error) throw error;

      const hoje = new Date().toISOString().split('T')[0];
      const porMembro = {};
      (data || []).forEach(l => {
        const m = l.arco_real_membros;
        if (!m) return;
        if (!porMembro[m.id]) porMembro[m.id] = { membro: m, itens: [], totalDevido: 0, totalVencido: 0, totalCredito: 0 };
        if (l.tipo === 'receita') {
          porMembro[m.id].itens.push(l);
          porMembro[m.id].totalDevido += Number(l.valor);
          if (l.data_vencimento < hoje) porMembro[m.id].totalVencido += Number(l.valor);
        } else {
          porMembro[m.id].totalCredito += Number(l.valor);
        }
      });

      const lista = Object.values(porMembro)
        .filter(x => x.totalDevido > 0)
        .sort((a, b) => b.totalDevido - a.totalDevido);
      setInadimplentes(lista);
    } catch (e) {
      showError?.('Erro ao carregar inadimplentes: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const gerarIndividual = async (item) => {
    try {
      const pendencias = await buscarPendenciasCompletas(item.membro.id);
      gerarRelatorioPendenciasArcoRealPDF(item.membro, pendencias, LOGO_ARCO_REAL);
    } catch (e) {
      showError?.('Erro ao gerar relatório: ' + e.message);
    }
  };

  const buscarPendenciasCompletas = async (membroId) => {
    const { data } = await supabase
      .from('arco_real_lancamentos')
      .select('tipo, descricao, valor, data_vencimento')
      .eq('origem_membro_id', membroId).eq('status', 'pendente').order('data_vencimento');
    return data || [];
  };

  const toggleSelecionado = (membroId) => {
    setSelecionados(prev => prev.includes(membroId) ? prev.filter(id => id !== membroId) : [...prev, membroId]);
  };

  const gerarEmLote = async () => {
    if (selecionados.length === 0) { showError?.('Selecione pelo menos um membro.'); return; }
    setGerando(true);
    try {
      for (const membroId of selecionados) {
        const item = inadimplentes.find(x => x.membro.id === membroId);
        if (!item) continue;
        const pendencias = await buscarPendenciasCompletas(membroId);
        gerarRelatorioPendenciasArcoRealPDF(item.membro, pendencias, LOGO_ARCO_REAL);
        await new Promise(r => setTimeout(r, 400));
      }
      showSuccess?.(`✅ ${selecionados.length} relatório(s) gerado(s)!`);
      setSelecionados([]);
    } catch (e) {
      showError?.('Erro ao gerar em lote: ' + e.message);
    } finally {
      setGerando(false);
    }
  };

  const filtrados = inadimplentes.filter(x => !busca || x.membro.nome.toLowerCase().includes(busca.toLowerCase()));
  const totalGeralDevido = filtrados.reduce((s, x) => s + x.totalDevido, 0);
  const totalGeralVencido = filtrados.reduce((s, x) => s + x.totalVencido, 0);

  if (!podeGerenciar) {
    return (
      <div className="p-10 text-center" style={{ color: 'var(--color-text-muted)' }}>
        <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</p>
        <p>Você não tem permissão para acessar esta tela.</p>
      </div>
    );
  }

  return (
    <div className="p-6" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>⚠️ Irmãos Inadimplentes</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0 }}>{filtrados.length} membro(s) com pendência</p>
        </div>
        <button onClick={gerarEmLote} disabled={gerando || selecionados.length === 0}
          style={{ padding: '0.55rem 1.1rem', background: selecionados.length === 0 ? 'var(--color-surface-2)' : '#1e3a5f', color: selecionados.length === 0 ? 'var(--color-text-muted)' : '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: (gerando || selecionados.length === 0) ? 'not-allowed' : 'pointer' }}>
          {gerando ? '⏳ Gerando...' : `📄 Gerar Selecionados (${selecionados.length})`}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.75rem', borderTop: '3px solid #ea580c' }}>
          <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Total a Receber</p>
          <p style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ea580c', margin: 0 }}>{fmtR(totalGeralDevido)}</p>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.75rem', borderTop: '3px solid #dc2626' }}>
          <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Vencido</p>
          <p style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dc2626', margin: 0 }}>{fmtR(totalGeralVencido)}</p>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.75rem', borderTop: '3px solid #64748b' }}>
          <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Inadimplentes</p>
          <p style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>{filtrados.length}</p>
        </div>
      </div>

      <input type="text" placeholder="🔍 Buscar membro..." value={busca} onChange={e => setBusca(e.target.value)}
        style={{ width: '100%', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', outline: 'none', fontSize: '0.85rem', marginBottom: '1rem' }} />

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>Nenhum inadimplente encontrado. 🎉</p>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
          {filtrados.map((item, idx) => (
            <div key={item.membro.id} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.75rem 1.1rem', borderBottom: idx < filtrados.length - 1 ? '1px solid var(--color-border)' : 'none', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
              <input type="checkbox" checked={selecionados.includes(item.membro.id)} onChange={() => toggleSelecionado(item.membro.id)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>{item.membro.nome}</p>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{item.itens.length} pendência(s){item.totalVencido > 0 ? ` · vencido: ${fmtR(item.totalVencido)}` : ''}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, color: item.totalVencido > 0 ? '#dc2626' : '#ea580c', fontSize: '0.95rem' }}>{fmtR(item.totalDevido)}</p>
              </div>
              <button onClick={() => gerarIndividual(item)}
                style={{ padding: '0.35rem 0.7rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                📄 Gerar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
