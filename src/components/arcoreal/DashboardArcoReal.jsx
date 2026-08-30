import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const boxCard = { background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' };

const CARDS_SITUACAO = [
  { chave: 'regular',    label: 'Regulares',   icone: '✅', cor: '#10b981' },
  { chave: 'licenciado', label: 'Licenciados', icone: '📋', cor: '#4ade80' },
  { chave: 'desligado',  label: 'Desligados',  icone: '🚪', cor: '#64748b' },
  { chave: 'excluido',   label: 'Excluídos',   icone: '❌', cor: '#ef4444' },
  { chave: 'falecido',   label: 'Falecidos',   icone: '🕊️', cor: '#8b5cf6' },
];

export default function DashboardArcoReal() {
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('arco_real_membros').select('situacao, irmao_vinculado_id');
      if (error) throw error;
      setMembros(data || []);
    } catch (e) {
      console.error('Erro ao carregar dashboard do Arco Real:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const total = membros.length;
  const daLoja = membros.filter(m => m.irmao_vinculado_id).length;
  const externos = total - daLoja;

  if (loading) {
    return <div className="p-6" style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Carregando...</div>;
  }

  return (
    <div className="p-6" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div className="mb-6">
        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-text)' }}>📊 Dashboard — Arco Real</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Visão geral dos membros do Capítulo</p>
      </div>

      {/* Total geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div style={{ ...boxCard, background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', border: 'none' }}>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase' }}>Total de Membros</p>
          <p style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginTop: '0.25rem' }}>{total}</p>
        </div>
        <div style={boxCard}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase' }}>🏛️ Irmãos da Loja</p>
          <p style={{ color: 'var(--color-text)', fontSize: '2rem', fontWeight: '800', marginTop: '0.25rem' }}>{daLoja}</p>
        </div>
        <div style={boxCard}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase' }}>🔺 Membros Externos</p>
          <p style={{ color: 'var(--color-text)', fontSize: '2rem', fontWeight: '800', marginTop: '0.25rem' }}>{externos}</p>
        </div>
      </div>

      {/* Por situação */}
      <div style={boxCard}>
        <p style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.85rem' }}>Situação dos Membros</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {CARDS_SITUACAO.map(c => {
            const qtd = membros.filter(m => m.situacao === c.chave).length;
            return (
              <div key={c.chave} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.85rem', textAlign: 'center' }}>
                <p style={{ fontSize: '1.3rem' }}>{c.icone}</p>
                <p style={{ fontSize: '1.4rem', fontWeight: '800', color: c.cor }}>{qtd}</p>
                <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: '600' }}>{c.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {total === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
          <p>Nenhum membro cadastrado ainda — comece pelo "Cadastro de Membros" no menu.</p>
        </div>
      )}
    </div>
  );
}
