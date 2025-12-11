import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';
import GestaoEquipamentos from './GestaoEquipamentos';
import GestaoBeneficiarios from './GestaoBeneficiarios';
import GestaoEmprestimos from './GestaoEmprestimos';

export default function Comodatos({ permissoes, showSuccess, showError }) {
  const [view, setView] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarEstatisticas();
  }, []);

  // Recarregar ao voltar pro dashboard
  useEffect(() => {
    if (view === 'dashboard') {
      carregarEstatisticas();
    }
  }, [view]);

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
      console.error('Erro:', error);
      setStats({
        equipamentos_disponiveis: 0,
        equipamentos_emprestados: 0,
        total_beneficiarios: 0,
        emprestimos_vencidos: 0,
        equipamentos_manutencao: 0,
        emprestimos_ativos: 0,
        emprestimos_devolvidos: 0,
        equipamentos_descartados: 0
      });
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
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
            onClick={() => setView('emprestimos')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              view === 'emprestimos'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📋 Empréstimos
          </button>
        </div>
      </div>

      {/* CONTEÚDO */}
      {view === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className="text-5xl">✅</div>
              <div className="text-right">
                <p className="text-green-100 text-sm font-medium">Disponíveis</p>
                <p className="text-4xl font-bold">{stats?.equipamentos_disponiveis || 0}</p>
              </div>
            </div>
            <p className="text-green-100 text-sm">Equipamentos prontos</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className="text-5xl">🔄</div>
              <div className="text-right">
                <p className="text-blue-100 text-sm font-medium">Emprestados</p>
                <p className="text-4xl font-bold">{stats?.equipamentos_emprestados || 0}</p>
              </div>
            </div>
            <p className="text-blue-100 text-sm">Em uso atualmente</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className="text-5xl">👥</div>
              <div className="text-right">
                <p className="text-purple-100 text-sm font-medium">Beneficiários</p>
                <p className="text-4xl font-bold">{stats?.total_beneficiarios || 0}</p>
              </div>
            </div>
            <p className="text-purple-100 text-sm">Total cadastrado</p>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className="text-5xl">⚠️</div>
              <div className="text-right">
                <p className="text-red-100 text-sm font-medium">Vencidos</p>
                <p className="text-4xl font-bold">{stats?.emprestimos_vencidos || 0}</p>
              </div>
            </div>
            <p className="text-red-100 text-sm">Precisa atenção</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className="text-5xl">🔧</div>
              <div className="text-right">
                <p className="text-yellow-100 text-sm font-medium">Manutenção</p>
                <p className="text-4xl font-bold">{stats?.equipamentos_manutencao || 0}</p>
              </div>
            </div>
            <p className="text-yellow-100 text-sm">Em reparo</p>
          </div>

          <div className="bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className="text-5xl">📋</div>
              <div className="text-right">
                <p className="text-cyan-100 text-sm font-medium">Ativos</p>
                <p className="text-4xl font-bold">{stats?.emprestimos_ativos || 0}</p>
              </div>
            </div>
            <p className="text-cyan-100 text-sm">Empréstimos em andamento</p>
          </div>

          <div className="bg-gradient-to-br from-teal-500 to-green-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className="text-5xl">✔️</div>
              <div className="text-right">
                <p className="text-teal-100 text-sm font-medium">Devolvidos</p>
                <p className="text-4xl font-bold">{stats?.emprestimos_devolvidos || 0}</p>
              </div>
            </div>
            <p className="text-teal-100 text-sm">Total histórico</p>
          </div>

          <div className="bg-gradient-to-br from-gray-500 to-slate-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className="text-5xl">🗑️</div>
              <div className="text-right">
                <p className="text-gray-100 text-sm font-medium">Descartados</p>
                <p className="text-4xl font-bold">{stats?.equipamentos_descartados || 0}</p>
              </div>
            </div>
            <p className="text-gray-100 text-sm">Fora de uso</p>
          </div>
        </div>
      )}

      {view === 'equipamentos' && (
        <GestaoEquipamentos 
          showSuccess={showSuccess}
          showError={showError}
          permissoes={permissoes}
        />
      )}

      {view === 'beneficiarios' && (
        <GestaoBeneficiarios 
          showSuccess={showSuccess}
          showError={showError}
          permissoes={permissoes}
        />
      )}

      {view === 'emprestimos' && (
        <GestaoEmprestimos 
          showSuccess={showSuccess}
          showError={showError}
          permissoes={permissoes}
        />
      )}
    </div>
  );
}
