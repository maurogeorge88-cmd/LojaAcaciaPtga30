/**
 * COMPONENTE DE LOGIN COM DESIGN MAÇÔNICO
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Alert } from './shared/Alert';
import TrocarSenha from './TrocarSenha';

const LOGO_URL = 'https://ypnvzjctyfdrkkrhskzs.supabase.co/storage/v1/object/public/LogoAcacia/LogoAcaciaPtga30.png';
const NOME_LOJA = 'A∴R∴L∴S∴ Acácia de Paranatinga nº 30';

export const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mostrarRecuperacao, setMostrarRecuperacao] = useState(false);
  const [mostrarTrocarSenha, setMostrarTrocarSenha] = useState(false);
  const [portalSelecionado, setPortalSelecionado] = useState(null); // null, 'irmaos', 'cunhadas'

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // FAZER LOGIN PRIMEIRO (sempre)
      await onLogin(email, password, portalSelecionado);
      
      // VALIDAÇÃO APENAS PARA PORTAL CUNHADAS (depois do login)
      if (portalSelecionado === 'cunhadas') {
        const { data: usuario } = await supabase
          .from('usuarios')
          .select('cargo')
          .eq('email', email)
          .single();

        const { data: perms } = await supabase
          .from('permissoes')
          .select('pode_acessar_portal_cunhadas')
          .eq('cargo', usuario?.cargo)
          .single();

        // Se não tiver permissão, fazer logout e mostrar erro
        if (!perms?.pode_acessar_portal_cunhadas) {
          // IMPORTANTE: Fazer logout ANTES de lançar o erro
          await supabase.auth.signOut();
          
          // Agora sim, mostrar o erro (depois do logout)
          setLoading(false);
          setError('❌ Você não tem permissão para acessar o Portal das Cunhadas.\n\nEste portal é exclusivo para Presidente e Tesoureira das Cunhadas.');
          return; // Parar execução aqui
        }
      }
      
      setLoading(false);
      
    } catch (err) {
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
      setLoading(false);
    }
  };

  const handleRecuperarSenha = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError('Digite seu email primeiro!');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) throw error;

      setSuccess(`✅ Email de recuperação enviado para ${email}! Verifique sua caixa de entrada.`);
      setMostrarRecuperacao(false);

    } catch (err) {
      setError('❌ Erro ao enviar email: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (mostrarTrocarSenha) {
    return <TrocarSenha onVoltar={() => setMostrarTrocarSenha(false)} />;
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    }}>
      {/* Padrão geométrico */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,.03) 35px, rgba(255,255,255,.03) 70px),
          repeating-linear-gradient(-45deg, transparent, transparent 35px, rgba(255,255,255,.02) 35px, rgba(255,255,255,.02) 70px)
        `,
        opacity: 0.5
      }} />

      {/* Estrelas */}
      {[
        { top: '15%', left: '20%', delay: 0 },
        { top: '25%', left: '75%', delay: 1 },
        { top: '65%', left: '15%', delay: 2 },
        { top: '70%', left: '85%', delay: 0.5 },
        { top: '40%', left: '90%', delay: 1.5 },
        { top: '80%', left: '25%', delay: 2.5 }
      ].map((star, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: star.top,
            left: star.left,
            width: '2px',
            height: '2px',
            background: '#d4af37',
            borderRadius: '50%',
            boxShadow: '0 0 4px rgba(212, 175, 55, 0.8)',
            animation: `twinkle 3s infinite ${star.delay}s`
          }}
        />
      ))}

      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Coluna B - Esquerda */}
        <Coluna letra="B" lado="left" />

        {/* Coluna J - Direita */}
        <Coluna letra="J" lado="right" />

        {/* Símbolo Central */}
        <Simbolo />

        {/* Modal de Login */}
        <div style={{
          position: 'relative',
          zIndex: 100,
          background: 'rgba(30, 41, 59, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: '3rem',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 1px rgba(212, 175, 55, 0.3)',
          border: '1px solid rgba(212, 175, 55, 0.2)'
        }}>
          {/* Logo e Cabeçalho */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <img 
              src={LOGO_URL} 
              alt="Logo Acácia" 
              style={{
                width: '120px',
                height: '120px',
                margin: '0 auto 1.5rem',
                borderRadius: '50%',
                border: '4px solid rgba(212, 175, 55, 0.5)',
                objectFit: 'cover',
                boxShadow: '0 8px 24px rgba(212, 175, 55, 0.3)',
                display: 'block'
              }}
            />
            <h1 style={{
              fontSize: '28px',
              color: '#f1f5f9',
              marginBottom: '0.5rem',
              fontWeight: '600'
            }}>Bem-vindo</h1>
            <p style={{
              fontSize: '14px',
              color: '#94a3b8'
            }}>{NOME_LOJA}</p>
          </div>

          {/* Alerts */}
          {error && (
            <div style={{ marginBottom: '1rem' }}>
              <Alert type="error" message={error} onClose={() => setError('')} />
            </div>
          )}

          {success && (
            <div style={{ marginBottom: '1rem' }}>
              <Alert type="success" message={success} onClose={() => setSuccess('')} />
            </div>
          )}

          {/* ESCOLHA DE PORTAL */}
          {!portalSelecionado ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '2rem' }}>
              <p style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '15px', fontWeight: '500' }}>
                Escolha o portal de acesso:
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Botão Portal dos Irmãos */}
                <button
                  type="button"
                  onClick={() => setPortalSelecionado('irmaos')}
                  style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    border: '2px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '16px',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <span style={{ fontSize: '24px' }}>🔷</span>
                  Portal dos Irmãos
                </button>

                {/* Botão Portal das Cunhadas */}
                <button
                  type="button"
                  onClick={() => setPortalSelecionado('cunhadas')}
                  style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                    border: '2px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '16px',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 8px 20px rgba(168, 85, 247, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <span style={{ fontSize: '24px' }}>💜</span>
                  Portal das Cunhadas
                </button>
              </div>
            </div>
          ) : (
            <>
              {!mostrarRecuperacao ? (
                // FORMULÁRIO DE LOGIN
                <>
                  {/* Indicador de portal selecionado */}
                  <div style={{
                padding: '1rem',
                background: portalSelecionado === 'irmaos' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                border: `2px solid ${portalSelecionado === 'irmaos' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '20px' }}>{portalSelecionado === 'irmaos' ? '🔷' : '💜'}</span>
                  <span style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: '500' }}>
                    {portalSelecionado === 'irmaos' ? 'Portal dos Irmãos' : 'Portal das Cunhadas'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPortalSelecionado(null)}
                  style={{
                    padding: '0.25rem 0.75rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#cbd5e1',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Trocar
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  color: '#f1f5f9'
                }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="seu@email.com"
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    background: 'rgba(51, 65, 85, 0.5)',
                    border: '2px solid rgba(212, 175, 55, 0.2)',
                    borderRadius: '12px',
                    color: '#f1f5f9',
                    fontSize: '15px',
                    outline: 'none',
                    transition: 'all 0.3s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(212, 175, 55, 0.6)';
                    e.target.style.background = 'rgba(51, 65, 85, 0.7)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(212, 175, 55, 0.2)';
                    e.target.style.background = 'rgba(51, 65, 85, 0.5)';
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  color: '#f1f5f9'
                }}>Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    background: 'rgba(51, 65, 85, 0.5)',
                    border: '2px solid rgba(212, 175, 55, 0.2)',
                    borderRadius: '12px',
                    color: '#f1f5f9',
                    fontSize: '15px',
                    outline: 'none',
                    transition: 'all 0.3s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(212, 175, 55, 0.6)';
                    e.target.style.background = 'rgba(51, 65, 85, 0.7)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(212, 175, 55, 0.2)';
                    e.target.style.background = 'rgba(51, 65, 85, 0.5)';
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, #d4af37, #b8941f)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#0f172a',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)',
                  opacity: loading ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 25px rgba(212, 175, 55, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 15px rgba(212, 175, 55, 0.3)';
                  }
                }}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
                </>
              ) : (
            // FORMULÁRIO DE RECUPERAÇÃO
            <form onSubmit={handleRecuperarSenha} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f5f9', marginBottom: '0.5rem' }}>
                  🔑 Recuperar Senha
                </h3>
                <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                  Digite seu email para receber instruções de recuperação.
                </p>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  color: '#f1f5f9'
                }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="seu@email.com"
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    background: 'rgba(51, 65, 85, 0.5)',
                    border: '2px solid rgba(212, 175, 55, 0.2)',
                    borderRadius: '12px',
                    color: '#f1f5f9',
                    fontSize: '15px',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, #d4af37, #b8941f)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#0f172a',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? 'Enviando...' : '📧 Enviar Email de Recuperação'}
              </button>

              <button
                type="button"
                onClick={() => setMostrarRecuperacao(false)}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'rgba(71, 85, 105, 0.5)',
                  border: '2px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: '12px',
                  color: '#f1f5f9',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ← Voltar para Login
              </button>
            </form>
              )}
            </>
          )}

          <div style={{
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid rgba(148, 163, 184, 0.2)',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '12px', color: '#64748b' }}>
              💡 <strong>Problema para entrar?</strong><br/>
              Entre em contato com o administrador da loja.
            </p>
          </div>
        </div>

        {/* Nome da Loja */}
        <div style={{
          position: 'absolute',
          bottom: '3%',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(212, 175, 55, 0.4)',
          fontSize: '18px',
          fontStyle: 'italic',
          textShadow: '0 0 10px rgba(212, 175, 55, 0.3)'
        }}>
          ∴ Acácia de Paranatinga nº 30 ∴
        </div>
      </div>

      {/* Animação */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// Componente Coluna
const Coluna = ({ letra, lado }) => {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        [lado]: '5%',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        opacity: hover ? 0.3 : 0.15,
        transition: 'opacity 0.3s ease'
      }}
    >
      {/* Capitel */}
      <div style={{
        width: '80px',
        height: '40px',
        background: 'linear-gradient(to bottom, #d4af37, #b8941f)',
        borderRadius: '8px 8px 0 0',
        boxShadow: '0 4px 20px rgba(212, 175, 55, 0.3)',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          top: '-10px',
          left: '-10px',
          right: '-10px',
          height: '10px',
          background: 'linear-gradient(to bottom, #f4d03f, #d4af37)',
          borderRadius: '4px 4px 0 0'
        }} />
      </div>

      {/* Corpo */}
      <div style={{
        width: '60px',
        height: '350px',
        background: 'linear-gradient(to right, #9ca3af, #d1d5db, #9ca3af)',
        boxShadow: `
          inset 2px 0 10px rgba(0,0,0,0.3),
          inset -2px 0 10px rgba(0,0,0,0.3),
          0 0 30px rgba(255,255,255,0.1)
        `,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `repeating-linear-gradient(
            to right,
            transparent,
            transparent 8px,
            rgba(0,0,0,0.1) 8px,
            rgba(0,0,0,0.1) 10px
          )`
        }} />
        <div style={{
          fontSize: '64px',
          fontWeight: 'bold',
          color: '#d4af37',
          textShadow: '0 0 20px rgba(212, 175, 55, 0.8)',
          fontFamily: 'Times New Roman, serif',
          zIndex: 1
        }}>{letra}</div>
      </div>

      {/* Base */}
      <div style={{
        width: '80px',
        height: '30px',
        background: 'linear-gradient(to bottom, #9ca3af, #6b7280)',
        boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
      }} />
    </div>
  );
};

// Componente Símbolo
const Simbolo = () => {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        top: '8%',
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: hover ? 0.25 : 0.12,
        transition: 'opacity 0.3s ease'
      }}
    >
      <svg width="280" height="280" viewBox="0 0 280 280">
        <line x1="140" y1="40" x2="80" y2="180" stroke="#d4af37" strokeWidth="8" strokeLinecap="round" />
        <line x1="140" y1="40" x2="200" y2="180" stroke="#d4af37" strokeWidth="8" strokeLinecap="round" />
        <circle cx="140" cy="40" r="8" fill="#f4d03f" filter="url(#glow)" />
        <path d="M 80 220 L 80 140 L 200 140" stroke="#d4af37" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="80" cy="140" r="10" fill="#f4d03f" filter="url(#glow)" />
        <text x="140" y="155" fontFamily="Times New Roman, serif" fontSize="100" fontWeight="bold" fill="#d4af37" textAnchor="middle" filter="url(#glow)">G</text>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
      </svg>
    </div>
  );
};

export default Login;
