/**
 * WRAPPER - Meu Cadastro
 * Busca ID do irmão pelo email e renderiza PerfilIrmao
 */

import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import PerfilIrmao from './irmaos/PerfilIrmao';

export default function MeuCadastroWrapper({ userEmail, showSuccess, showError }) {
  const [irmaoId, setIrmaoId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarIrmaoId();
  }, [userEmail]);

  const carregarIrmaoId = async () => {
    try {
      const { data, error } = await supabase
        .from('irmaos')
        .select('id')
        .eq('email', userEmail)
        .single();

      if (error) throw error;

      if (data) {
        setIrmaoId(data.id);
      }
    } catch (error) {
      console.error('Erro ao buscar irmão:', error);
      showError('Não foi possível carregar seu cadastro');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Carregando seu cadastro...</div>
      </div>
    );
  }

  if (!irmaoId) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
        <div className="flex items-center">
          <span className="text-4xl mr-4">⚠️</span>
          <div>
            <p className="font-semibold text-yellow-800">Cadastro não encontrado</p>
            <p className="text-sm text-yellow-600 mt-1">
              Seu email não está vinculado a um cadastro de irmão.
              Entre em contato com o administrador.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PerfilIrmao
      irmaoId={irmaoId}
      onVoltar={() => {}} // Não precisa voltar
      showSuccess={showSuccess}
      showError={showError}
    />
  );
}
