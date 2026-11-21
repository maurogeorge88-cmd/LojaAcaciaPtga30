import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const fmtD = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '');

// Quadro do Dashboard: nomes e CIM do Livro Negro (visível a todos os irmãos).
// Ao clicar num nome abre o modal com Loja, Oriente e demais informações.
export default function CardLivroNegroDashboard() {
  const [lista, setLista] = useState([]);
  const [detalhe, setDetalhe] = useState(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    supabase.from('livro_negro').select('*').order('nome').then(({ data, error }) => {
      if (error) { setErro(true); return; }
      setLista(data || []);
    });
  }, []);

  const Linha = ({ rotulo, valor }) => (valor ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.88rem' }}>
      <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>{rotulo}</span>
      <span style={{ color: 'var(--color-text)', textAlign: 'right', whiteSpace: 'pre-wrap' }}>{valor}</span>
    </div>
  ) : null);

  return (
    <>
      <div style={{ background: 'linear-gradient(135deg, #e5e7eb 0%, #b6bcc6 100%)', border: '1px solid #9ca3af', borderRadius: 'var(--radius-xl)', padding: '1.25rem', color: '#111827', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(17,24,39,0.7)', margin: '0 0 0.25rem' }}>⬛ Livro Negro</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1 }}>{lista.length}</span>
            <span style={{ fontSize: '0.82rem', opacity: 0.8 }}>{lista.length === 1 ? 'registro' : 'registros'}</span>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(17,24,39,0.2)', paddingTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '150px', overflowY: 'auto' }}>
          {erro && <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>Não foi possível carregar.</span>}
          {!erro && lista.length === 0 && <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>Nenhum registro.</span>}
          {lista.map(it => (
            <button key={it.id} onClick={() => setDetalhe(it)}
              style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', textAlign: 'left', background: 'rgba(255,255,255,0.55)', border: 'none', color: '#111827', padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.8rem' }}>
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.nome}</span>
              <span style={{ opacity: 0.75, flexShrink: 0 }}>{it.cim ? `CIM ${it.cim}` : ''}</span>
            </button>
          ))}
        </div>
      </div>

      {detalhe && (
        <div onClick={() => setDetalhe(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', width: '100%', maxWidth: '460px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>⬛ Livro Negro</h3>
              <button onClick={() => setDetalhe(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>{detalhe.nome}</p>
            <Linha rotulo="CIM" valor={detalhe.cim} />
            <Linha rotulo="Loja" valor={detalhe.loja} />
            <Linha rotulo="Oriente" valor={detalhe.oriente} />
            <Linha rotulo="Data do registro" valor={fmtD(detalhe.data_registro)} />
            <Linha rotulo="Observações" valor={detalhe.observacoes} />
          </div>
        </div>
      )}
    </>
  );
}
