import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ordenarComendas } from '../../utils/ordemComendas';

// Quadros de comendas do irmão: Grande Loja e Loja, cada um em tabela dupla.
// Usado em: PerfilIrmao (Dados Maçônicos), PerfilCompletoIrmao e modal de VisualizarIrmaos.
const QUADROS = [
  { chave: 'grande_loja', titulo: '🏛️ Comendas da Grande Loja', cor: '#60a5fa' },
  { chave: 'loja', titulo: '🔺 Comendas da Loja', cor: '#10b981' },
];

export default function QuadrosComendas({ irmaoId }) {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!irmaoId) return;
    let ativo = true;
    (async () => {
      setCarregando(true);
      try {
        const { data, error } = await supabase
          .from('irmaos_comendas')
          .select('id, data_entrega, ano_referencia, concedida_por, comendas(nome, origem)')
          .eq('irmao_id', irmaoId);
        if (error) throw error;
        if (ativo) setLista((data || []).filter(ic => ic.concedida_por !== 'nao_entregue' && ic.comendas));
      } catch (e) {
        console.error('Erro ao carregar comendas do irmão:', e);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [irmaoId]);

  const th = { textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' };
  const td = { padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {QUADROS.map(({ chave, titulo, cor }) => {
        const itens = lista
          .filter(ic => (ic.concedida_por || ic.comendas?.origem || 'grande_loja') === chave)
          .sort((a, b) => ordenarComendas(a.comendas, b.comendas)
            || (a.ano_referencia || 0) - (b.ano_referencia || 0)
            || String(a.data_entrega || '').localeCompare(String(b.data_entrega || '')));
        const meio = Math.ceil(itens.length / 2);
        const colunas = [itens.slice(0, meio), itens.slice(meio)];

        return (
          <div key={chave} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderLeft: `4px solid ${cor}`, borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: cor, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.85rem' }}>
              {titulo} ({itens.length})
            </p>
            {carregando ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>Carregando...</p>
            ) : itens.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>Nenhuma comenda recebida.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {colunas.map((col, ci) => col.length > 0 && (
                  <div key={ci} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: 'var(--color-surface-3)' }}>
                        <tr>
                          <th style={th}>Comenda</th>
                          <th style={{ ...th, textAlign: 'right', width: '6.5rem' }}>Entrega</th>
                        </tr>
                      </thead>
                      <tbody>
                        {col.map((ic, i) => (
                          <tr key={ic.id} style={{ background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                            <td style={td}>🎖️ {ic.comendas.nome}{ic.ano_referencia ? ` (${ic.ano_referencia})` : ''}</td>
                            <td style={{ ...td, textAlign: 'right', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                              {ic.data_entrega ? ic.data_entrega.split('-').reverse().join('/') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
