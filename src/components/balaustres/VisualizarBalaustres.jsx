import React, { useState } from 'react';

export default function VisualizarBalaustres({ balaustres }) {
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroGrau, setFiltroGrau] = useState('');
  const [busca, setBusca] = useState('');

  // Filtrar balaustres
  const balaustresFiltrados = balaustres.filter(balaustre => {
    const matchTipo = !filtroTipo || balaustre.tipo_sessao === filtroTipo;
    const matchGrau = !filtroGrau || balaustre.grau === filtroGrau;
    const matchBusca = !busca || 
      balaustre.numero?.toString().includes(busca) ||
      balaustre.observacoes?.toLowerCase().includes(busca.toLowerCase());
    
    return matchTipo && matchGrau && matchBusca;
  });

  // Formatação de data
  const formatarData = (data) => {
    if (!data) return '';
    const d = new Date(data + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  };

  // Cores por tipo de sessão
  const getCor = (tipo) => {
    const cores = {
      'ordinaria': 'bg-blue-100 text-blue-800',
      'extraordinaria': 'bg-purple-100 text-purple-800',
      'iniciacao': 'bg-green-100 text-green-800',
      'elevacao': 'bg-yellow-100 text-yellow-800',
      'exaltacao': 'bg-orange-100 text-orange-800',
      'magna': 'bg-red-100 text-red-800',
      'branca': 'bg-gray-100 text-gray-800',
      'funebre': 'bg-black text-white'
    };
    return cores[tipo] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-blue-900 mb-6">📋 Visualizar Balaustres</h2>

      {/* FILTROS */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Filtro Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Sessão
            </label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="ordinaria">Ordinária</option>
              <option value="extraordinaria">Extraordinária</option>
              <option value="iniciacao">Iniciação</option>
              <option value="elevacao">Elevação</option>
              <option value="exaltacao">Exaltação</option>
              <option value="magna">Magna</option>
              <option value="branca">Branca</option>
              <option value="funebre">Fúnebre</option>
            </select>
          </div>

          {/* Filtro Grau */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grau
            </label>
            <select
              value={filtroGrau}
              onChange={(e) => setFiltroGrau(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="aprendiz">Aprendiz</option>
              <option value="companheiro">Companheiro</option>
              <option value="mestre">Mestre</option>
            </select>
          </div>

          {/* Busca */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar por Número
            </label>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite o número..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Exibindo <strong>{balaustresFiltrados.length}</strong> de <strong>{balaustres.length}</strong> balaustres
        </div>
      </div>

      {/* TABELA */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-900 text-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Número</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Grau</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Observações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {balaustresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    Nenhum balaustre encontrado
                  </td>
                </tr>
              ) : (
                balaustresFiltrados.map((balaustre) => (
                  <tr key={balaustre.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-blue-900">
                      {balaustre.numero}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatarData(balaustre.data)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCor(balaustre.tipo_sessao)}`}>
                        {balaustre.tipo_sessao?.charAt(0).toUpperCase() + balaustre.tipo_sessao?.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm capitalize">{balaustre.grau}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {balaustre.observacoes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
