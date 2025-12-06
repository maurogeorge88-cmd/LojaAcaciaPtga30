import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';

export default function Comodatos({ permissoes, showSuccess, showError }) {
  const [view, setView] = useState('dashboard'); // dashboard, equipamentos, beneficiarios, comodatos
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarEstatisticas();
  }, []);

  const carregarEstatisticas = async () => {
    try {
      const { data, error } = await supabase
        .from('estatisticas_comodatos')
        .select('*')
        .single();

      if (error) throw error;
      setStats(data);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      showError('Erro ao carregar estatísticas');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-xl shadow-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">♿ Controle de Comodatos</h1>
            <p className="text-emerald-100 text-lg">
              Gestão de Empréstimos de Equipamentos de Assistência
            </p>
          </div>
          <div className="text-7xl opacity-20">
            🦽
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO */}
      <div className="bg-white rounded-lg shadow-md p-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setView('dashboard')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              view === 'dashboard'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => setView('equipamentos')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              view === 'equipamentos'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🛠️ Equipamentos
          </button>
          <button
            onClick={() => setView('beneficiarios')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              view === 'beneficiarios'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            👥 Beneficiários
          </button>
          <button
            onClick={() => setView('comodatos')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              view === 'comodatos'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📋 Empréstimos
          </button>
          <button
            onClick={() => setView('relatorios')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              view === 'relatorios'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📄 Relatórios
          </button>
        </div>
      </div>

      {/* DASHBOARD */}
      {view === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card: Equipamentos Disponíveis */}
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className="text-5xl opacity-80">✅</div>
              <div className="bg-white bg-opacity-20 rounded-full px-3 py-1 text-sm font-semibold">
                Disponíveis
              </div>
            </div>
            <div className="text-4xl font-bold mb-2">
              {stats?.equipamentos_disponiveis || 0}
            </div>
            <div className="text-green-100 text-sm">
              Equipamentos prontos para empréstimo
            </div>
          </div>

          {/* Card: Equipamentos Emprestados */}
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className="text-5xl opacity-80">🔄</div>
              <div className="bg-white bg-opacity-20 rounded-full px-3 py-1 text-sm font-semibold">
                Em Uso
              </div>
            </div>
            <div className="text-4xl font-bold mb-2">
              {stats?.equipamentos_emprestados || 0}
            </div>
            <div className="text-blue-100 text-sm">
              Equipamentos atualmente emprestados
            </div>
          </div>

          {/* Card: Total de Beneficiários */}
          <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className="text-5xl opacity-80">👥</div>
              <div className="bg-white bg-opacity-20 rounded-full px-3 py-1 text-sm font-semibold">
                Beneficiados
              </div>
            </div>
            <div className="text-4xl font-bold mb-2">
              {stats?.total_beneficiarios || 0}
            </div>
            <div className="text-purple-100 text-sm">
              Pessoas já atendidas (total histórico)
            </div>
          </div>

          {/* Card: Empréstimos Vencidos */}
          <div className="bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className="text-5xl opacity-80">⚠️</div>
              <div className="bg-white bg-opacity-20 rounded-full px-3 py-1 text-sm font-semibold">
                Vencidos
              </div>
            </div>
            <div className="text-4xl font-bold mb-2">
              {stats?.comodatos_vencidos || 0}
            </div>
            <div className="text-red-100 text-sm">
              Empréstimos com prazo vencido
            </div>
          </div>

          {/* Card: Em Manutenção */}
          <div className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl shadow-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="text-5xl opacity-80">🔧</div>
              <div className="bg-white bg-opacity-20 rounded-full px-3 py-1 text-sm font-semibold">
                Manutenção
              </div>
            </div>
            <div className="text-4xl font-bold mb-2">
              {stats?.equipamentos_manutencao || 0}
            </div>
            <div className="text-yellow-100 text-sm">
              Equipamentos em reparo
            </div>
          </div>

          {/* Card: Empréstimos Ativos */}
          <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="text-5xl opacity-80">📋</div>
              <div className="bg-white bg-opacity-20 rounded-full px-3 py-1 text-sm font-semibold">
                Ativos
              </div>
            </div>
            <div className="text-4xl font-bold mb-2">
              {stats?.comodatos_ativos || 0}
            </div>
            <div className="text-cyan-100 text-sm">
              Contratos ativos no momento
            </div>
          </div>

          {/* Card: Devoluções */}
          <div className="bg-gradient-to-br from-teal-500 to-green-600 rounded-xl shadow-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="text-5xl opacity-80">✔️</div>
              <div className="bg-white bg-opacity-20 rounded-full px-3 py-1 text-sm font-semibold">
                Devolvidos
              </div>
            </div>
            <div className="text-4xl font-bold mb-2">
              {stats?.comodatos_devolvidos || 0}
            </div>
            <div className="text-teal-100 text-sm">
              Total de devoluções realizadas
            </div>
          </div>

          {/* Card: Descartados */}
          <div className="bg-gradient-to-br from-gray-500 to-slate-600 rounded-xl shadow-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="text-5xl opacity-80">🗑️</div>
              <div className="bg-white bg-opacity-20 rounded-full px-3 py-1 text-sm font-semibold">
                Descartados
              </div>
            </div>
            <div className="text-4xl font-bold mb-2">
              {stats?.equipamentos_descartados || 0}
            </div>
            <div className="text-gray-100 text-sm">
              Equipamentos descartados
            </div>
          </div>
        </div>
      )}

      {/* OUTRAS VIEWS */}
      {view === 'equipamentos' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            🛠️ Gestão de Equipamentos
          </h2>
          <p className="text-gray-600">
            Componente de gerenciamento de equipamentos será implementado aqui.
          </p>
        </div>
      )}

      {view === 'beneficiarios' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            👥 Gestão de Beneficiários
          </h2>
          <p className="text-gray-600">
            Componente de gerenciamento de beneficiários será implementado aqui.
          </p>
        </div>
      )}

      {view === 'comodatos' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            📋 Gestão de Empréstimos
          </h2>
          <p className="text-gray-600">
            Componente de gerenciamento de comodatos será implementado aqui.
          </p>
        </div>
      )}

      {view === 'relatorios' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            📄 Relatórios
          </h2>
          <p className="text-gray-600">
            Geração de relatórios e termos de comodato será implementado aqui.
          </p>
        </div>
      )}
    </div>
  );
}
