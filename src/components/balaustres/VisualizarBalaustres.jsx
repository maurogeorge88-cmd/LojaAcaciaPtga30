import { useState } from 'react';
import { formatarData } from '../../utils/formatters';

const VisualizarBalaustres = ({ balaustres }) => {
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroGrau, setFiltroGrau] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const balastresFiltrados = balaustres.filter(b => {
    const matchSearch = b.numero?.toString().includes(searchTerm) || 
                       b.observacoes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTipo = filtroTipo === 'todos' || b.tipo_sessao === filtroTipo;
    const matchGrau = filtroGrau === 'todos' || b.grau === filtroGrau;
    return matchSearch && matchTipo && matchGrau;
  });

  const obterCorTipo = (tipo) => {
    const cores = {
      'ordinaria': 'bg-blue-100 text-blue-800',
      'extraordinaria': 'bg-purple-100 text-purple-800',
      'iniciacao': 'bg-green-100 text-green-800',
      'elevacao': 'bg-yellow-100 text-yellow-800',
      'exaltacao': 'bg-red-100 text-red-800',
      'magna': 'bg-indigo-100 text-indigo-800',
      'branca': 'bg-gray-100 text-gray-800',
      'funebre': 'bg-black text-white'
    };
    return cores[tipo] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Buscar por numero..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos os Tipos</option>
            <option value="ordinaria">Ordinaria</option>
            <option value="extraordinaria">Extraordinaria</option>
            <option value="iniciacao">Iniciacao</option>
            <option value="elevacao">Elevacao</option>
            <option value="exaltacao">Exaltacao</option>
          </select>

          <select
            value={filtroGrau}
            onChange={(e) => setFiltroGrau(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos os Graus</option>
            <option value="aprendiz">Aprendiz</option>
            <option value="companheiro">Companheiro</option>
            <option value="mestre">Mestre</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="px-6 py-3 text-left">Numero</th>
              <th className="px-6 py-3 text-left">Data</th>
              <th className="px-6 py-3 text-left">Tipo</th>
              <th className="px-6 py-3 text-left">Grau</th>
              <th className="px-6 py-3 text-left">Observacoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {balastresFiltrados.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                  Nenhum balaustre encontrado
                </td>
              </tr>
            ) : (
              balastresFiltrados.map(balaustre => (
                <tr key={balaustre.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-semibold">{balaustre.numero}</td>
                  <td className="px-6 py-4">{formatarData(balaustre.data)}</td>
                  <td className="px-6 py-4">
                    <span className={'px-3 py-1 rounded-full text-xs font-semibold ' + obterCorTipo(balaustre.tipo_sessao)}>
                      {balaustre.tipo_sessao}
                    </span>
                  </td>
                  <td className="px-6 py-4 capitalize">{balaustre.grau}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {balaustre.observacoes || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-gray-600">
        Exibindo {balastresFiltrados.length} de {balaustres.length} balaustres
      </div>
    </div>
  );
};

export default VisualizarBalaustres;
