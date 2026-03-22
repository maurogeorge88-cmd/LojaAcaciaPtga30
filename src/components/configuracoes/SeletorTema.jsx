import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const SeletorTema = () => {
  const [temaBase, setTemaBase] = useState('dark');
  const [paletaCor, setPaletaCor] = useState('azul-escuro');
  const [corAcento, setCorAcento] = useState('#fbbf24');
  const [salvando, setSalvando] = useState(false);

  // Paletas de cor base (para fundo e superfícies)
  const paletasCores = [
    { id: 'cinza-escuro', nome: 'Cinza Escuro', cor: '#18181b', emoji: '⬛' },
    { id: 'cinza-medio', nome: 'Cinza Médio', cor: '#3f3f46', emoji: '▪️' },
    { id: 'azul-escuro', nome: 'Azul Escuro', cor: '#1e40af', emoji: '🔵' },
    { id: 'azul-medio', nome: 'Azul Médio', cor: '#3b82f6', emoji: '🩵' },
    { id: 'verde-escuro', nome: 'Verde Escuro', cor: '#047857', emoji: '🟢' },
    { id: 'verde-medio', nome: 'Verde Médio', cor: '#10b981', emoji: '🍃' },
    { id: 'roxo', nome: 'Roxo Escuro', cor: '#7c3aed', emoji: '🟣' },
    { id: 'marrom', nome: 'Marrom Escuro', cor: '#92400e', emoji: '🟫' },
  ];

  // Cores de acento (para botões e bordas)
  const coresAcento = [
    { nome: 'Cinza Claro (Padrão)', cor: '#e0e0e6' },
    { nome: 'Cinza Suave', cor: '#c8c8d4' },
    { nome: 'Cinza Médio', cor: '#8a8a96' },
    { nome: 'Branco Puro', cor: '#ffffff' },
    { nome: 'Azul Celeste', cor: '#93c5fd' },
    { nome: 'Azul Médio', cor: '#60a5fa' },
    { nome: 'Azul Royal', cor: '#3b82f6' },
    { nome: 'Verde Menta', cor: '#6ee7b7' },
    { nome: 'Verde Claro', cor: '#86efac' },
    { nome: 'Verde', cor: '#4ade80' },
    { nome: 'Âmbar', cor: '#fbbf24' },
    { nome: 'Laranja', cor: '#fb923c' },
    { nome: 'Rosa', cor: '#f472b6' },
    { nome: 'Lilás', cor: '#c084fc' },
  ];

  useEffect(() => {
    carregarPreferencias();
  }, []);

  const carregarPreferencias = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('usuarios')
        .select('pref_tema_base, pref_cor_paleta, pref_cor_acento')
        .eq('email', user.email)
        .single();

      if (!error && data) {
        setTemaBase(data.pref_tema_base || 'dark');
        setPaletaCor(data.pref_cor_paleta || 'azul-escuro');
        setCorAcento(data.pref_cor_acento || '#fbbf24');
        
        aplicarTema(
          data.pref_tema_base || 'dark',
          data.pref_cor_paleta || 'azul-escuro',
          data.pref_cor_acento || '#fbbf24'
        );
      }
    } catch (error) {
      console.error('Erro ao carregar preferências:', error);
    }
  };

  const aplicarTema = (tema, paleta, acento) => {
    // Tema claro/escuro
    if (tema === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    
    // Paleta de cor (aplicar data-color)
    if (paleta && paleta !== 'azul-escuro') {
      document.documentElement.setAttribute('data-color', paleta);
    } else {
      document.documentElement.removeAttribute('data-color');
    }
    
    // Cor de acento (botões e bordas)
    document.documentElement.style.setProperty('--color-accent', acento);
    
    // Calcular cor hover (10% mais escura)
    const hoverColor = adjustColor(acento, -10);
    document.documentElement.style.setProperty('--color-accent-hover', hoverColor);
    
    console.log('🎨 Tema aplicado:', { tema, paleta, acento });
  };

  const adjustColor = (hex, percent) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1);
  };

  const salvarPreferencias = async (novoTema, novaPaleta, novoAcento) => {
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('usuarios')
        .update({
          pref_tema_base: novoTema,
          pref_cor_paleta: novaPaleta,
          pref_cor_acento: novoAcento
        })
        .eq('email', user.email);

      if (error) throw error;

      setTemaBase(novoTema);
      setPaletaCor(novaPaleta);
      setCorAcento(novoAcento);
      aplicarTema(novoTema, novaPaleta, novoAcento);
      
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
      alert('❌ Erro ao salvar: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  const alternarTema = () => {
    const novoTema = temaBase === 'dark' ? 'light' : 'dark';
    salvarPreferencias(novoTema, paletaCor, corAcento);
  };

  const selecionarPaleta = (idPaleta) => {
    salvarPreferencias(temaBase, idPaleta, corAcento);
  };

  const selecionarCorAcento = (cor) => {
    salvarPreferencias(temaBase, paletaCor, cor);
  };

  const estiloBotao = (cor, ativo = false) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.75rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'white',
    background: cor,
    border: ativo ? '3px solid #fbbf24' : 'none',
    borderRadius: '0.875rem',
    cursor: salvando ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    opacity: salvando ? 0.5 : 1,
  });

  return (
    <div style={{
      background: 'var(--color-surface)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
      padding: '1.75rem',
      border: '1px solid var(--color-border)'
    }}>
      
      {/* HEADER */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ 
          fontSize: '1.875rem', 
          fontWeight: '700', 
          color: 'var(--color-text)',
          marginBottom: '0.5rem'
        }}>
          🎨 Aparência do Sistema
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Personalize as cores e o tema do sistema
        </p>
      </div>

      {/* TEMA BASE */}
      <div style={{ 
        marginBottom: '2rem',
        padding: '1.5rem',
        background: 'var(--color-surface-2)',
        borderRadius: 'var(--radius-lg)'
      }}>
        <h3 style={{ 
          fontSize: '0.875rem', 
          fontWeight: '700', 
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '1rem'
        }}>
          TEMA BASE
        </h3>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={alternarTema}
            disabled={salvando}
            style={estiloBotao(temaBase === 'dark' ? '#1e293b' : '#ffffff', temaBase === 'dark')}
          >
            {temaBase === 'dark' ? '🌙 Escuro' : '☀️ Claro'}
          </button>
          <button
            onClick={alternarTema}
            disabled={salvando}
            style={estiloBotao(temaBase === 'light' ? '#1e293b' : '#ffffff', temaBase === 'light')}
          >
            {temaBase === 'light' ? '☀️ Claro' : '🌙 Escuro'}
          </button>
        </div>
      </div>

      {/* PALETA DE CORES */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ 
          fontSize: '0.875rem', 
          fontWeight: '700', 
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '1rem'
        }}>
          PALETA DE CORES
        </h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '0.75rem'
        }}>
          {paletasCores.map((p) => (
            <div
              key={p.id}
              onClick={() => !salvando && selecionarPaleta(p.id)}
              style={{
                padding: '1rem',
                background: 'var(--color-surface-2)',
                border: paletaCor === p.id ? '3px solid var(--color-accent)' : '2px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                cursor: salvando ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: salvando ? 0.5 : 1,
                textAlign: 'center'
              }}
              onMouseEnter={(e) => {
                if (!salvando) e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.5rem'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '0.5rem',
                  background: p.cor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem'
                }}>
                  {p.emoji}
                </div>
              </div>
              <p style={{ 
                fontSize: '0.75rem', 
                fontWeight: '600',
                color: 'var(--color-text)',
                marginBottom: '0.25rem'
              }}>
                {p.nome}
              </p>
              {paletaCor === p.id && (
                <span style={{ 
                  fontSize: '0.65rem',
                  color: 'var(--color-accent)',
                  fontWeight: '600'
                }}>
                  ✓ Ativo
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* COR DE ACENTO */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ 
          fontSize: '0.875rem', 
          fontWeight: '700', 
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '1rem'
        }}>
          COR DE ACENTO
        </h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
          gap: '0.75rem'
        }}>
          {coresAcento.map((c, i) => (
            <div
              key={i}
              onClick={() => !salvando && selecionarCorAcento(c.cor)}
              style={{
                position: 'relative',
                padding: '0.75rem',
                background: 'var(--color-surface-2)',
                border: corAcento === c.cor ? '3px solid var(--color-accent)' : '2px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: salvando ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: salvando ? 0.5 : 1,
                textAlign: 'center'
              }}
              onMouseEnter={(e) => {
                if (!salvando) e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <div style={{
                width: '100%',
                height: '32px',
                borderRadius: '0.375rem',
                background: c.cor,
                marginBottom: '0.5rem',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}></div>
              <p style={{ 
                fontSize: '0.65rem', 
                fontWeight: '600',
                color: 'var(--color-text)',
                lineHeight: '1.2'
              }}>
                {c.nome}
              </p>
              {corAcento === c.cor && (
                <div style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--color-success)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}>
                  ✓
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* COR PERSONALIZADA (HEX) */}
      <div style={{ 
        marginBottom: '2rem',
        padding: '1.5rem',
        background: 'var(--color-surface-2)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)'
      }}>
        <h3 style={{ 
          fontSize: '0.875rem', 
          fontWeight: '700', 
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.75rem'
        }}>
          COR PERSONALIZADA (HEX)
        </h3>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ 
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-md)',
            background: corAcento,
            border: '2px solid var(--color-border)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}></div>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              value={corAcento}
              onChange={(e) => setCorAcento(e.target.value)}
              disabled={salvando}
              placeholder="#fbbf24"
              style={{
                width: '180px',
                padding: '0.75rem 1rem',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                color: 'var(--color-text)',
                background: 'var(--color-surface)',
                border: '2px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                marginBottom: '0.5rem'
              }}
            />
            <button
              onClick={() => salvarPreferencias(temaBase, paletaCor, corAcento)}
              disabled={salvando}
              style={{
                ...estiloBotao('var(--color-accent)'),
                marginLeft: '0.5rem'
              }}
              onMouseEnter={(e) => {
                if (!salvando) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }}
            >
              🔄 Padrão
            </button>
          </div>
        </div>
      </div>

      {/* PRÉ-VISUALIZAÇÃO */}
      <div>
        <h3 style={{ 
          fontSize: '0.875rem', 
          fontWeight: '700', 
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '1rem'
        }}>
          PRÉ-VISUALIZAÇÃO
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Botões */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button style={estiloBotao('var(--color-accent)')}>Botão Principal</button>
            <button style={estiloBotao('var(--color-surface-2)')}>Secundário</button>
            <button style={estiloBotao('var(--color-success)')}>Concluído</button>
            <button style={estiloBotao('var(--color-warning)')}>Pendente</button>
            <button style={estiloBotao('var(--color-danger)')}>Vencido</button>
            <span style={{
              padding: '0.375rem 0.875rem',
              fontSize: '0.75rem',
              fontWeight: '600',
              background: corAcento,
              color: 'white',
              borderRadius: '0.5rem',
              display: 'inline-flex',
              alignItems: 'center'
            }}>456825</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeletorTema;
