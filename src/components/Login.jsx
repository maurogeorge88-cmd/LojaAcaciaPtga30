/**
 * COMPONENTE DE LOGIN COM DESIGN MAÇÔNICO
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 * 
 * DESIGN:
 * - Colunas B (Boaz) e J (Jachin)
 * - Símbolo Esquadro e Compasso com G
 * - Background com gradiente e estrelas
 * - Modal de login centralizado
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
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

  // Se está mostrando trocar senha, renderiza esse componente
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
      {/* Padrão geométrico de fundo */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,.03) 35px, rgba(255,255,255,.03) 70px),
          repeating-linear-gradient(-45deg, transparent, transparent 35px, rgba(255,255,255,.02) 35px, rgba(255,255,255,.02) 70px)
        `,
        opacity: 0.5
      }} />

      {/* Estrelas decorativas */}
      {[
        { top: '15%', left: '20%', delay: '0s' },
        { top: '25%', left: '75%', delay: '1s' },
        { top: '65%', left: '15%', delay: '2s' },
        { top: '70%', left: '85%', delay: '0.5s' },
        { top: '40%', left: '90%', delay: '1.5s' },
        { top: '80%', left: '25%', delay: '2.5s' }
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
            animation: `twinkle 3s infinite ${star.delay}`
          }}
        />
      ))}

      {/* Container principal */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Coluna Esquerda - BOAZ */}
        <ColumnaMaconica letra="B" lado="left" />

        {/* Coluna Direita - JACHIN */}
        <ColumnaMaconica letra="J" lado="right" />

        {/* Símbolo Central - Esquadro e Compasso */}
        <SimboloMaconico />

        {/* Modal de Login */}
        <ModalLogin
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          loading={loading}
          error={error}
          setError={setError}
          success={success}
          setSuccess={setSuccess}
          mostrarRecuperacao={mostrarRecuperacao}
          setMostrarRecuperacao={setMostrarRecuperacao}
          setMostrarTrocarSenha={setMostrarTrocarSenha}
          handleSubmit={handleSubmit}
          handleRecuperarSenha={handleRecuperarSenha}
        />

        {/* Nome da Loja no rodapé */}
        <div style={{
          position: 'absolute',
          bottom: '3%',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(212, 175, 55, 0.4)',
          fontSize: '18px',
          fontStyle: 'italic',
          textAlign: 'center',
          textShadow: '0 0 10px rgba(212, 175, 55, 0.3)'
        }}>
          ∴ Acácia de Paranatinga nº 30 ∴
        </div>
      </div>

      {/* Animação de estrelas */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// Componente Coluna Maçônica
const ColumnaMaconica = ({ letra, lado }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        position: 'absolute',
        [lado]: '5%',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        opacity: hovered ? 0.3 : 0.15,
        transition: 'opacity 0.3s ease'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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

      {/* Corpo com letra */}
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
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Estrias */}
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
        {/* Letra */}
        <div style={{
          fontSize: '64px',
          fontWeight: 'bold',
          color: '#d4af37',
          textShadow: '0 0 20px rgba(212, 175, 55, 0.8), 0 0 40px rgba(212, 175, 55, 0.5)',
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

// Componente Símbolo Maçônico
const SimboloMaconico = () => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        position: 'absolute',
        top: '8%',
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: hovered ? 0.25 : 0.12,
        transition: 'opacity 0.3s ease'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg width="280" height="280" viewBox="0 0 280 280">
        {/* Compasso */}
        <g>
          <line x1="140" y1="40" x2="80" y2="180" stroke="#d4af37" strokeWidth="8" strokeLinecap="round" />
          <line x1="140" y1="40" x2="200" y2="180" stroke="#d4af37" strokeWidth="8" strokeLinecap="round" />
          <circle cx="140" cy="40" r="8" fill="#f4d03f" filter="url(#glow)" />
        </g>

        {/* Esquadro */}
        <g>
          <path d="M 80 220 L 80 140 L 200 140" stroke="#d4af37" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="80" cy="140" r="10" fill="#f4d03f" filter="url(#glow)" />
        </g>

        {/* Letra G */}
        <text x="140" y="155" fontFamily="Times New Roman, serif" fontSize="100" fontWeight="bold" fill="#d4af37" textAnchor="middle" filter="url(#glow)">G</text>

        {/* Filtro de brilho */}
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

// Componente Modal de Login
const ModalLogin = ({
  email, setEmail, password, setPassword, loading, error, setError,
  success, setSuccess, mostrarRecuperacao, setMostrarRecuperacao,
  setMostrarTrocarSenha, handleSubmit, handleRecuperarSenha
}) => {
  return (
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
      {/* Logo e Título */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <img 
          src={LOGO_URL} 
          alt="Logo" 
          style={{
            width: '120px',
            height: '120px',
            margin: '0 auto 1.5rem',
            borderRadius: '50%',
            border: '4px solid rgba(212, 175, 55, 0.5)',
            objectFit: 'cover',
            boxShadow: '0 8px 24px rgba(212, 175, 55, 0.3)'
          }}
        />
        <h1 style={{
          fontSize: '24px',
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

      {!mostrarRecuperacao ? (
        <FormularioLogin
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          loading={loading}
          handleSubmit={handleSubmit}
          setMostrarRecuperacao={setMostrarRecuperacao}
          setMostrarTrocarSenha={setMostrarTrocarSenha}
        />
      ) : (
        <FormularioRecuperacao
          email={email}
          setEmail={setEmail}
          loading={loading}
          handleRecuperarSenha={handleRecuperarSenha}
          setMostrarRecuperacao={setMostrarRecuperacao}
        />
      )}

      <div style={{
        marginTop: '1.5rem',
        paddingTop: '1.5rem',
        borderTop: '1px solid rgba(148, 163, 184, 0.2)'
      }}>
        <p style={{
          fontSize: '12px',
          textAlign: 'center',
          color: '#64748b'
        }}>
          💡 <strong>Problema para entrar?</strong><br/>
          Entre em contato com o administrador da loja.
        </p>
      </div>
    </div>
  );
};

// Formulário de Login
const FormularioLogin = ({
  email, setEmail, password, setPassword, loading,
  handleSubmit, setMostrarRecuperacao, setMostrarTrocarSenha
}) => {
  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <InputField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu@email.com"
        disabled={loading}
      />

      <InputField
        label="Senha"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        disabled={loading}
      />

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setMostrarRecuperacao(true)}
          style={{
            width: '100%',
            fontSize: '14px',
            color: '#d4af37',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: '0.5rem'
          }}
        >
          🔑 Esqueci minha senha
        </button>
        
        <button
          type="button"
          onClick={() => setMostrarTrocarSenha(true)}
          style={{
            width: '100%',
            fontSize: '14px',
            color: '#10b981',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
            fontWeight: '600',
            padding: '0.5rem'
          }}
        >
          🆕 Primeiro Acesso? Trocar Senha Temporária
        </button>
      </div>
    </form>
  );
};

// Formulário de Recuperação
const FormularioRecuperacao = ({
  email, setEmail, loading, handleRecuperarSenha, setMostrarRecuperacao
}) => {
  return (
    <form onSubmit={handleRecuperarSenha} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f5f9', marginBottom: '0.5rem' }}>
          🔑 Recuperar Senha
        </h3>
        <p style={{ fontSize: '14px', color: '#94a3b8' }}>
          Digite seu email para receber instruções de recuperação.
        </p>
      </div>

      <InputField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu@email.com"
        disabled={loading}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          ← Voltar para Login
        </button>
      </div>
    </form>
  );
};

// Componente de Input reutilizável
const InputField = ({ label, type, value, onChange, placeholder, disabled }) => {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: '14px',
        fontWeight: '600',
        marginBottom: '0.5rem',
        color: '#f1f5f9'
      }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
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
        placeholder={placeholder}
        required
        disabled={disabled}
      />
    </div>
  );
};

export default Login;
