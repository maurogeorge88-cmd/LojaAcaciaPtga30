/**
 * COMPONENTE DE LOGIN COM PRIMEIRO ACESSO INTEGRADO
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Alert } from './shared/Alert';
import PrimeiroAcesso from './PrimeiroAcesso';

const LOGO_URL = 'https://ypnvzjctyfdrkkrhskzs.supabase.co/storage/v1/object/public/LogoAcacia/LogoAcaciaPtga30.png';
const NOME_LOJA = 'A∴R∴L∴S∴ Acácia de Paranatinga nº 30';

export const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mostrarRecuperacao, setMostrarRecuperacao] = useState(false);
  const [mostrarPrimeiroAcesso, setMostrarPrimeiroAcesso] = useState(false);

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

  // Se está mostrando primeiro acesso, renderiza esse componente
  if (mostrarPrimeiroAcesso) {
    return <PrimeiroAcesso onVoltar={() => setMostrarPrimeiroAcesso(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img 
            src={LOGO_URL} 
            alt="Logo" 
            className="w-32 h-32 mx-auto mb-4 rounded-full border-4 border-blue-600 object-cover" 
          />
          <h1 className="text-2xl font-bold text-blue-900 mb-2">{NOME_LOJA}</h1>
          <p className="text-gray-600">Gestão Maçônica</p>
        </div>

        {error && (
          <div className="mb-4">
            <Alert type="error" message={error} onClose={() => setError('')} />
          </div>
        )}

        {success && (
          <div className="mb-4">
            <Alert type="success" message={success} onClose={() => setSuccess('')} />
          </div>
        )}

        {!mostrarRecuperacao ? (
          // FORMULÁRIO DE LOGIN
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="seu@email.com"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setMostrarRecuperacao(true)}
                className="w-full text-sm text-blue-600 hover:text-blue-800 underline"
              >
                🔑 Esqueci minha senha
              </button>
              
              <button
                type="button"
                onClick={() => setMostrarPrimeiroAcesso(true)}
                className="w-full text-sm text-green-600 hover:text-green-800 underline font-medium"
              >
                🆕 Primeiro Acesso? Defina sua senha aqui
              </button>
            </div>
          </form>
        ) : (
          // FORMULÁRIO DE RECUPERAÇÃO
          <form onSubmit={handleRecuperarSenha} className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                🔑 Recuperar Senha
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Digite seu email para receber instruções de recuperação.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="seu@email.com"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Enviando...' : '📧 Enviar Email de Recuperação'}
              </button>

              <button
                type="button"
                onClick={() => setMostrarRecuperacao(false)}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-lg transition"
              >
                ← Voltar para Login
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-center text-gray-500">
            💡 <strong>Problema para entrar?</strong><br/>
            Entre em contato com o administrador da loja.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
