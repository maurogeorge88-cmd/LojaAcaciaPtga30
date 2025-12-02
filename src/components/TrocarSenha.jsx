/**
 * TROCAR SENHA SIMPLES
 * Componente direto para usuário trocar senha temporária
 */

import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const LOGO_URL = 'https://ypnvzjctyfdrkkrhskzs.supabase.co/storage/v1/object/public/LogoAcacia/LogoAcaciaPtga30.png';

export default function TrocarSenha({ onVoltar }) {
  const [email, setEmail] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [mostrarSenhas, setMostrarSenhas] = useState(false);

  const handleTrocarSenha = async (e) => {
    e.preventDefault();
    setMensagem('');
    setErro('');

    // Validações
    if (senhaNova.length < 6) {
      setErro('❌ Nova senha deve ter no mínimo 6 caracteres!');
      return;
    }

    if (senhaNova !== confirmarSenha) {
      setErro('❌ As senhas não conferem!');
      return;
    }

    setLoading(true);

    try {
      // 1. Fazer login com senha atual
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: email,
        password: senhaAtual
      });

      if (loginError) {
        throw new Error('Email ou senha atual incorretos!');
      }

      // 2. Atualizar para nova senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: senhaNova
      });

      if (updateError) {
        throw new Error('Erro ao atualizar senha: ' + updateError.message);
      }

      // 3. Limpar senha temporária da tabela
      await supabase
        .from('usuarios')
        .update({ senha_temporaria: null })
        .eq('email', email);

      setMensagem('✅ Senha trocada com sucesso! Redirecionando...');
      
      // Fazer logout e redirecionar
      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
      }, 2000);

    } catch (error) {
      console.error('Erro:', error);
      setErro('❌ ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <img 
            src={LOGO_URL} 
            alt="Logo" 
            className="w-24 h-24 mx-auto mb-4 rounded-full border-4 border-blue-600 object-cover" 
          />
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🔑</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Trocar Senha</h1>
          <p className="text-sm text-gray-600">
            Defina sua senha permanente
          </p>
        </div>

        {/* Mensagens */}
        {erro && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded">
            <p className="text-sm text-red-800 font-medium">{erro}</p>
          </div>
        )}

        {mensagem && (
          <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded">
            <p className="text-sm text-green-800 font-medium">{mensagem}</p>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleTrocarSenha} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📧 Seu Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="seu@email.com"
              required
              disabled={loading}
            />
          </div>

          {/* Senha Atual */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔐 Senha Temporária
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Fornecida pelo administrador
            </p>
            <input
              type={mostrarSenhas ? 'text' : 'password'}
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          {/* Nova Senha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🆕 Nova Senha
            </label>
            <input
              type={mostrarSenhas ? 'text' : 'password'}
              value={senhaNova}
              onChange={(e) => setSenhaNova(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="Mínimo 6 caracteres"
              required
              disabled={loading}
            />
          </div>

          {/* Confirmar Senha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ✅ Confirmar Nova Senha
            </label>
            <input
              type={mostrarSenhas ? 'text' : 'password'}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
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
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="mostrar" className="ml-2 text-sm text-gray-700">
              👁️ Mostrar senhas
            </label>
          </div>

          {/* Botão */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Trocando senha...
              </span>
            ) : (
              '🔒 Trocar Senha'
            )}
          </button>
        </form>

        {/* Voltar */}
        <div className="mt-6 text-center">
          {onVoltar ? (
            <button
              onClick={onVoltar}
              className="text-sm text-blue-600 hover:text-blue-800 underline font-medium"
            >
              ← Voltar para Login
            </button>
          ) : (
            <a
              href="/"
              className="text-sm text-blue-600 hover:text-blue-800 underline font-medium"
            >
              ← Voltar para Login
            </a>
          )}
        </div>

        {/* Instruções */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <span className="mr-2">📋</span>
            Como usar:
          </h3>
          <ol className="text-xs text-gray-600 space-y-2">
            <li className="flex items-start">
              <span className="font-bold mr-2">1.</span>
              <span>Digite seu email cadastrado</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">2.</span>
              <span>Digite a senha temporária que o administrador te passou</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">3.</span>
              <span>Crie sua nova senha (mínimo 6 caracteres)</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">4.</span>
              <span>Confirme a nova senha</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">5.</span>
              <span>Clique em "Trocar Senha"</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">6.</span>
              <span>Pronto! Faça login com sua nova senha</span>
            </li>
          </ol>
        </div>

        {/* Ajuda */}
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">
            <strong>💡 Dica:</strong> Se der erro, verifique se digitou o email e a senha temporária corretamente.
          </p>
        </div>
      </div>
    </div>
  );
}
