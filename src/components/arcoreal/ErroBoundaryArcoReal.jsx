import { Component } from 'react';

// Evita tela em branco: se uma tela do Arco Real quebrar, mostra o erro.
export default class ErroBoundaryArcoReal extends Component {
  constructor(props) { super(props); this.state = { erro: null }; }
  static getDerivedStateFromError(erro) { return { erro }; }
  componentDidCatch(erro, info) { console.error('Erro na tela do Arco Real:', erro, info?.componentStack); }
  componentDidUpdate(prev) { if (prev.chave !== this.props.chave && this.state.erro) this.setState({ erro: null }); }
  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="p-6" style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', color: 'var(--color-text)' }}>
          <p style={{ fontWeight: 800, color: '#ef4444', marginBottom: '0.4rem' }}>⚠️ Esta tela encontrou um erro</p>
          <p style={{ fontSize: '0.85rem', fontFamily: 'monospace', wordBreak: 'break-word' }}>{String(this.state.erro?.message || this.state.erro)}</p>
          <button onClick={() => this.setState({ erro: null })} style={{ marginTop: '0.75rem', padding: '0.45rem 1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 }}>Tentar de novo</button>
        </div>
      </div>
    );
  }
}
