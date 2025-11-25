import { formatarData } from '../../utils/formatters';

const ProtocoloPranchas = ({ pranchas }) => {
  const pranchasOrdenadas = [...pranchas].sort((a, b) => 
    new Date(b.data) - new Date(a.data)
  );

  const gerarProtocolo = () => {
    let conteudo = '\n========================================================\n';
    conteudo += '           LIVRO DE PROTOCOLO\n';
    conteudo += '    ARLS Acacia de Paranatinga no 30\n';
    conteudo += '========================================================\n\n';
    conteudo += 'Gerado em: ' + new Date().toLocaleString('pt-BR') + '\n';
    conteudo += 'Total de Pranchas: ' + pranchas.length + '\n\n';

    conteudo += 'NUM'.padEnd(8) + ' | ' + 'DATA'.padEnd(12) + ' | ' + 'TIPO'.padEnd(10) + ' | ' + 'REMETENTE/DEST'.padEnd(30) + ' | ' + 'ASSUNTO'.padEnd(40) + '\n';
    conteudo += '-'.repeat(110) + '\n';

    pranchasOrdenadas.forEach(prancha => {
      const num = prancha.numero.toString().padEnd(8);
      const data = formatarData(prancha.data).padEnd(12);
      const tipo = prancha.tipo.padEnd(10);
      const pessoa = prancha.tipo === 'recebida' 
        ? (prancha.remetente || '-').substring(0, 30).padEnd(30)
        : (prancha.destinatario || '-').substring(0, 30).padEnd(30);
      const assunto = (prancha.assunto || '-').substring(0, 40).padEnd(40);

      conteudo += num + ' | ' + data + ' | ' + tipo + ' | ' + pessoa + ' | ' + assunto + '\n';
    });

    conteudo += '\n========================================================\n';

    const blob = new Blob([conteudo], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Protocolo_Pranchas_' + new Date().toISOString().split('T')[0] + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const estatisticas = {
    total: pranchas.length,
    recebidas: pranchas.filter(p => p.tipo === 'recebida').length,
    expedidas: pranchas.filter(p => p.tipo === 'expedida').length,
    pendentes: pranchas.filter(p => p.status === 'pendente').length,
    respondidas: pranchas.filter(p => p.status === 'respondida').length
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-blue-500 text-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold">{estatisticas.total}</div>
          <div className="text-sm mt-2">Total de Pranchas</div>
        </div>

        <div className="bg-green-500 text-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold">{estatisticas.recebidas}</div>
          <div className="text-sm mt-2">Recebidas</div>
        </div>

        <div className="bg-purple-500 text-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold">{estatisticas.expedidas}</div>
          <div className="text-sm mt-2">Expedidas</div>
        </div>

        <div className="bg-yellow-500 text-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold">{estatisticas.pendentes}</div>
          <div className="text-sm mt-2">Pendentes</div>
        </div>

        <div className="bg-indigo-500 text-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold">{estatisticas.respondidas}</div>
          <div className="text-sm mt-2">Respondidas</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Livro de Protocolo</h2>
          <button
            onClick={gerarProtocolo}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
          >
            Exportar Protocolo
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Numero</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Data</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Tipo</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Remetente/Destinatario</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Assunto</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pranchasOrdenadas.map(prancha => (
                <tr key={prancha.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono">{prancha.numero}</td>
                  <td className="px-4 py-3 text-sm">{formatarData(prancha.data)}</td>
                  <td className="px-4 py-3">
                    <span className={prancha.tipo === 'recebida' ? 'text-blue-600' : 'text-purple-600'}>
                      {prancha.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {prancha.tipo === 'recebida' ? prancha.remetente : prancha.destinatario}
                  </td>
                  <td className="px-4 py-3 text-sm">{prancha.assunto}</td>
                  <td className="px-4 py-3">
                    <span className={
                      prancha.status === 'pendente' ? 'text-yellow-600' :
                      prancha.status === 'respondida' ? 'text-green-600' :
                      'text-gray-600'
                    }>
                      {prancha.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProtocoloPranchas;
