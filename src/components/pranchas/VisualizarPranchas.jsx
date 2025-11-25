import { useState } from 'react';
import { formatarData } from '../../utils/formatters';

const VisualizarPranchas = ({ pranchas }) => {
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const pranchasFiltradas = pranchas.filter(p => {
    const matchSearch = p.numero?.toString().includes(searchTerm) ||
                       p.assunto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       p.remetente?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTipo = filtroTipo === 'todos' || p.tipo === filtroTipo;
    const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus;
    return matchSearch && matchTipo && matchStatus;
  });

  const obterCorStatus = (status) => {
    const cores = {
      'pendente': 'bg-yellow-100 text-yellow-800',
      'respondida': 'bg-green-100 text-green-800',
      'arquivada': 'bg-gray-100 text-gray-800'
    };
    return cores[status] || 'bg-gray-100 text-gray-800';
  };

  const obterCorTipo = (tipo) => {
    return tipo === 'recebida' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Buscar..."
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
            <option value="recebida">Recebida</option>
            <option value="expedida">Expedida</option>
          </select>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos os Status</option>
            <option value="pendente">Pendente</option>
            <option value="respondida">Respondida</option>
            <option value="arquivada">Arquivada</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pranchasFiltradas.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📄</div>
            <div className="text-xl font-semibold text-gray-700">Nenhuma prancha encontrada</div>
          </div>
        ) : (
          pranchasFiltradas.map(prancha => (
            <div key={prancha.id} className="bg-white rounded-lg shadow hover:shadow-lg transition p-6">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-bold text-gray-800">
                  Prancha {prancha.numero}
                </h3>
                <span className={'px-3 py-1 rounded-full text-xs font-semibold ' + obterCorTipo(prancha.tipo)}>
                  {prancha.tipo}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold text-gray-700">Data:</span>
                  <span className="ml-2 text-gray-600">{formatarData(prancha.data)}</span>
                </div>

                {prancha.remetente && (
                  <div>
                    <span className="font-semibold text-gray-700">Remetente:</span>
                    <span className="ml-2 text-gray-600">{prancha.remetente}</span>
                  </div>
                )}

                {prancha.destinatario && (
                  <div>
                    <span className="font-semibold text-gray-700">Destinatario:</span>
                    <span className="ml-2 text-gray-600">{prancha.destinatario}</span>
                  </div>
                )}

                <div>
                  <span className="font-semibold text-gray-700">Assunto:</span>
                  <p className="mt-1 text-gray-600">{prancha.assunto}</p>
                </div>

                {prancha.observacoes && (
                  <div>
                    <span className="font-semibold text-gray-700">Obs:</span>
                    <p className="mt-1 text-gray-600 text-xs">{prancha.observacoes}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t">
                <span className={'inline-block px-3 py-1 rounded-full text-xs font-semibold ' + obterCorStatus(prancha.status)}>
                  {prancha.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="text-sm text-gray-600">
        Exibindo {pranchasFiltradas.length} de {pranchas.length} pranchas
      </div>
    </div>
  );
};

export default VisualizarPranchas;
