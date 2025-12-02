/**
 * COMPONENTE DE PRIMEIRO ACESSO
 * Permite usuário definir sua própria senha na primeira vez
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function PrimeiroAcesso() {
  const [email, setEmail] = useState('');
  const [senhaTemporaria, setSenhaTemporaria] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mostrarSenhas, setMostrarSenhas] = useState(false);

  const handlePrimeiroAcesso = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validações
    if (novaSenha.length < 6) {
      setError('Nova senha deve ter no mínimo 6 caracteres!');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setError('As senhas não conferem!');
      return;
    }

    setLoading(true);

    try {
      // 1. Fazer login com senha temporária
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: email,
        password: senhaTemporaria
      });

      if (loginError) {
        throw new Error('Email ou senha temporária inválidos!');
      }

      // 2. Atualizar para nova senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: novaSenha
      });

      if (updateError) throw updateError;

      // 3. Limpar senha temporária da tabela
      await supabase
        .from('usuarios')
        .update({ senha_temporaria: null })
        .eq('email', email);

      setSuccess('✅ Senha atualizada com sucesso! Redirecionando...');
      
      // Redirecionar após 2 segundos
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Erro:', error);
      setError(error.message || 'Erro ao definir senha. Contate o administrador.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🔑</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Primeiro Acesso</h1>
          <p className="text-sm text-gray-600">
            Defina sua senha permanente
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <form onSubmit={handlePrimeiroAcesso} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Seu Email
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

          {/* Senha Temporária */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha Temporária
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Fornecida pelo administrador
            </p>
            <input
              type={mostrarSenhas ? 'text' : 'password'}
              value={senhaTemporaria}
              onChange={(e) => setSenhaTemporaria(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          {/* Nova Senha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nova Senha
            </label>
            <input
              type={mostrarSenhas ? 'text' : 'password'}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Mínimo 6 caracteres"
              required
              disabled={loading}
            />
          </div>

          {/* Confirmar Senha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar Nova Senha
            </label>
            <input
              type={mostrarSenhas ? 'text' : 'password'}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Digite novamente"
              required
              disabled={loading}
            />
          </div>

          {/* Mostrar Senhas */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="mostrar"
              checked={mostrarSenhas}
              onChange={(e) => setMostrarSenhas(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="mostrar" className="ml-2 text-sm text-gray-700">
              Mostrar senhas
            </label>
          </div>

          {/* Botão */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Definindo senha...' : '🔒 Definir Senha Permanente'}
          </button>
        </form>

        {/* Link para Login */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            ← Voltar para Login
          </a>
        </div>

        {/* Instruções */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            📋 Instruções:
          </h3>
          <ol className="text-xs text-gray-600 space-y-1">
            <li>1. Digite seu email cadastrado</li>
            <li>2. Digite a senha temporária (fornecida pelo admin)</li>
            <li>3. Crie sua nova senha (mínimo 6 caracteres)</li>
            <li>4. Confirme a nova senha</li>
            <li>5. Clique em "Definir Senha Permanente"</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
