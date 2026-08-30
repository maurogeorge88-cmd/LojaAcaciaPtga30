export default function EscolhaArea({ nomeUsuario, onEscolher, onSair }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: '1.5rem' }}>
      <div style={{ maxWidth: '640px', width: '100%', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
          Olá, {nomeUsuario || 'Irmão'} — seu acesso cobre dois sistemas.
        </p>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--color-text)', marginBottom: '2rem' }}>
          Qual área você quer acessar?
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <button
            onClick={() => onEscolher('loja')}
            style={{
              background: 'var(--color-surface)', border: '2px solid var(--color-accent)', borderRadius: 'var(--radius-xl)',
              padding: '2rem 1.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
              transition: 'transform 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <span style={{ fontSize: '2.5rem' }}>🏛️</span>
            <span style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--color-text)' }}>Loja Acácia</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Sistema completo da ARLS Acácia de Paranatinga</span>
          </button>

          <button
            onClick={() => onEscolher('arco_real')}
            style={{
              background: 'var(--color-surface)', border: '2px solid #c9a84c', borderRadius: 'var(--radius-xl)',
              padding: '2rem 1.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
              transition: 'transform 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <span style={{ fontSize: '2.5rem' }}>🔺</span>
            <span style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--color-text)' }}>Arco Real</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Cadastro, presença e finanças do Arco Real</span>
          </button>
        </div>

        <button
          onClick={onSair}
          style={{ marginTop: '2rem', background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Sair
        </button>
      </div>
    </div>
  );
}
