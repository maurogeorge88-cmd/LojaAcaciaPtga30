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
  const [principais, setPrincipais] = useState({ p1: null, p2: null, p3: null });
  const anoAtual = new Date().getFullYear();

  useEffect(() => { carregar(); carregarPrincipais(); }, []);

  const formatarNome = (nomeCompleto) => {
    if (!nomeCompleto) return '';
    const partes = nomeCompleto.trim().split(' ').filter(Boolean);
    if (partes.length <= 2) return nomeCompleto;
    const preposicoes = ['de', 'da', 'do', 'das', 'dos'];
    if (preposicoes.includes(partes[1].toLowerCase())) return `${partes[0]} ${partes[partes.length - 1]}`;
    return partes.slice(0, 2).join(' ');
  };

  const carregarPrincipais = async () => {
    try {
      const { data } = await supabase
        .from('arco_real_corpo_administrativo')
        .select('cargo, arco_real_membros(nome, foto_url)')
        .eq('ano_exercicio', String(anoAtual))
        .in('cargo', ['1º Principal', '2º Principal', '3º Principal']);
      const mapa = {};
      (data || []).forEach(l => { mapa[l.cargo] = l.arco_real_membros; });
      setPrincipais({ p1: mapa['1º Principal'] || null, p2: mapa['2º Principal'] || null, p3: mapa['3º Principal'] || null });
    } catch (e) {
      console.error('Erro ao carregar 3 Principais:', e.message);
    }
  };

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

  if (loading) {
    return <div className="p-6" style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Carregando...</div>;
  }

  return (
    <div className="p-6" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div className="mb-6">
        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-text)' }}>📊 Dashboard — Arco Real</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Visão geral dos membros do Capítulo</p>
      </div>

      {/* Os 3 Principais — mesmo padrão da "Direção da Loja" */}
      {(principais.p1 || principais.p2 || principais.p3) && (
        <div style={{ position: 'relative', border: '2px solid #f59e0b', borderRadius: 'var(--radius-xl)', padding: '1.75rem 1.25rem 1.25rem', marginBottom: '1.5rem' }}>
          <span style={{ position: 'absolute', top: '-0.7rem', left: '50%', transform: 'translateX(-50%)', background: 'var(--color-bg)', padding: '0.1rem 1rem', fontSize: '0.78rem', fontWeight: '700', letterSpacing: '0.05em', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            Exercício - {anoAtual}
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ alignItems: 'stretch' }}>
            {[
              { cargo: '1º Principal', irmao: principais.p1, gradiente: 'linear-gradient(135deg, #c9a84c 0%, #a3792f 100%)' },
              { cargo: '2º Principal', irmao: principais.p2, gradiente: 'linear-gradient(135deg, var(--color-accent) 0%, #4338ca 100%)' },
              { cargo: '3º Principal', irmao: principais.p3, gradiente: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' },
            ].map(d => (
              <div key={d.cargo} style={{ background: d.gradiente, borderRadius: 'var(--radius-xl)', padding: '0.9rem 1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                {d.irmao?.foto_url ? (
                  <img src={d.irmao.foto_url} alt={d.irmao.nome} style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.6)', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0 }}>
                    {d.irmao ? '👤' : '❔'}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '0.62rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', margin: '0 0 0.3rem' }}>{d.cargo}</p>
                  <p style={{ fontSize: '1.02rem', fontWeight: '800', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.irmao ? formatarNome(d.irmao.nome) : 'Vago'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total geral */}
      <div className="mb-4">
        <div style={{ ...boxCard, background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', border: 'none', maxWidth: '320px' }}>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase' }}>Total de Membros</p>
          <p style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginTop: '0.25rem' }}>{total}</p>
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
