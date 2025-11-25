import { useState } from 'react';
import { formatarData, calcularIdade } from '../../utils/formatters';

const QuadroIrmaos = ({ irmaos }) => {
  const [grauSelecionado, setGrauSelecionado] = useState('todos');
  const [ordenacao, setOrdenacao] = useState('nome');

  const obterGrau = (irmao) => {
    if (irmao.data_exaltacao) return 'Mestre';
    if (irmao.data_elevacao) return 'Companheiro';
    if (irmao.data_iniciacao) return 'Aprendiz';
    return 'Nao iniciado';
  };

  const calcularTempoMaconariaMeses = (dataIniciacao) => {
    if (!dataIniciacao) return 0;
    const inicio = new Date(dataIniciacao + 'T00:00:00');
    const hoje = new Date();
    const anos = hoje.getFullYear() - inicio.getFullYear();
    const meses = hoje.getMonth() - inicio.getMonth();
    return (anos * 12) + meses;
  };

  const formatarTempoMaconaria = (dataIniciacao) => {
    if (!dataIniciacao) return '-';
    const inicio = new Date(dataIniciacao + 'T00:00:00');
    const hoje = new Date();
    let anos = hoje.getFullYear() - inicio.getFullYear();
    let meses = hoje.getMonth() - inicio.getMonth();
    if (meses < 0) {
      anos--;
      meses = 12 + meses;
    }
    return anos + 'a ' + meses + 'm';
  };

  const irmaosAtivos = irmaos.filter(irmao => {
    const situacao = (irmao.situacao || 'regular').toLowerCase();
    return situacao === 'regular' || situacao === 'licenciado';
  });

  const irmaosPorGrau = {
    'Mestre': irmaosAtivos.filter(i => obterGrau(i) === 'Mestre'),
    'Companheiro': irmaosAtivos.filter(i => obterGrau(i) === 'Companheiro'),
    'Aprendiz': irmaosAtivos.filter(i => obterGrau(i) === 'Aprendiz'),
    'Nao iniciado': irmaosAtivos.filter(i => obterGrau(i) === 'Nao iniciado')
  };

  const ordenarIrmaos = (lista) => {
    const copia = [...lista];
    
    switch (ordenacao) {
      case 'nome':
        return copia.sort((a, b) => a.nome.localeCompare(b.nome));
      case 'cim':
        return copia.sort((a, b) => (a.cim || '').toString().localeCompare((b.cim || '').toString()));
      case 'idade':
        return copia.sort((a, b) => {
          if (!a.data_nascimento) return 1;
          if (!b.data_nascimento) return -1;
          return new Date(a.data_nascimento) - new Date(b.data_nascimento);
        });
      case 'tempo':
        return copia.sort((a, b) => {
          const tempoA = calcularTempoMaconariaMeses(a.data_iniciacao);
          const tempoB = calcularTempoMaconariaMeses(b.data_iniciacao);
          return tempoB - tempoA;
        });
      default:
        return copia;
    }
  };

  const gerarQuadro = () => {
    let conteudo = '\n========================================================\n';
    conteudo += '           QUADRO GERAL DE IRMAOS\n';
    conteudo += '    ARLS Acacia de Paranatinga no 30\n';
    conteudo += '========================================================\n\n';
    conteudo += 'Gerado em: ' + new Date().toLocaleString('pt-BR') + '\n';
    conteudo += 'Total de Irmaos Ativos: ' + irmaosAtivos.length + '\n\n';

    const graus = grauSelecionado === 'todos' 
      ? ['Mestre', 'Companheiro', 'Aprendiz', 'Nao iniciado']
      : [grauSelecionado];

    graus.forEach(grau => {
      const irmaosGrau = ordenarIrmaos(irmaosPorGrau[grau]);
      
      if (irmaosGrau.length > 0) {
        conteudo += '\n========================================================\n';
        conteudo += grau.toUpperCase() + ' (' + irmaosGrau.length + ')\n';
        conteudo += '========================================================\n\n';
        
        conteudo += 'CIM'.padEnd(8) + ' | ' + 'NOME'.padEnd(35) + ' | ' + 'IDADE'.padEnd(10) + ' | ' + 'INICIACAO'.padEnd(12) + ' | ' + 'TEMPO'.padEnd(10) + '\n';
        conteudo += '-'.repeat(90) + '\n';

        irmaosGrau.forEach(irmao => {
          const cim = (irmao.cim || '-').toString().padEnd(8);
          const nome = (irmao.nome || '-').substring(0, 35).padEnd(35);
          const idade = irmao.data_nascimento ? calcularIdade(irmao.data_nascimento).padEnd(10) : '-'.padEnd(10);
          const iniciacao = irmao.data_iniciacao ? formatarData(irmao.data_iniciacao).padEnd(12) : '-'.padEnd(12);
          const tempo = formatarTempoMaconaria(irmao.data_iniciacao).padEnd(10);

          conteudo += cim + ' | ' + nome + ' | ' + idade + ' | ' + iniciacao + ' | ' + tempo + '\n';
        });

        conteudo += '\n';
      }
    });

    conteudo += '\n========================================================\n';
    conteudo += 'LEGENDA:\n';
    conteudo += '- Tempo: Xxa Xxm = X anos e X meses na Maconaria\n';
    conteudo += '- Idade: Calculada com base na data de nascimento\n';
    conteudo += '========================================================\n';

    const blob = new Blob([conteudo], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Quadro_Irmaos_' + grauSelecionado + '_' + new Date().toISOString().split('T')[0] + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const irmaosExibir = grauSelecionado === 'todos' 
    ? irmaosAtivos 
    : irmaosPorGrau[grauSelecionado];

  const irmaosOrdenados = ordenarIrmaos(irmaosExibir);

  const totalMestres = irmaosPorGrau['Mestre'].length;
  const totalCompanheiros = irmaosPorGrau['Companheiro'].length;
  const totalAprendizes = irmaosPorGrau['Aprendiz'].length;

  const obterCorGrau = (grau) => {
    const cores = {
      'Aprendiz': 'bg-blue-100 text-blue-800',
      'Companheiro': 'bg-green-100 text-green-800',
      'Mestre': 'bg-purple-100 text-purple-800',
      'Nao iniciado': 'bg-gray-100 text-gray-800'
    };
    return cores[grau] || 'bg-gray-100 text-gray-800';
  };

  const obterCorSituacao = (situacao) => {
    const sit = (situacao || 'regular').toLowerCase();
    if (sit === 'regular') return 'bg-green-100 text-green-800';
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-4xl font-bold">{totalMestres}</div>
          <div className="text-purple-100 mt-2">Mestres</div>
          <div className="text-sm text-purple-200 mt-1">
            {totalMestres > 0 ? ((totalMestres / irmaosAtivos.length) * 100).toFixed(0) + '%' : '0%'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-4xl font-bold">{totalCompanheiros}</div>
          <div className="text-green-100 mt-2">Companheiros</div>
          <div className="text-sm text-green-200 mt-1">
            {totalCompanheiros > 0 ? ((totalCompanheiros / irmaosAtivos.length) * 100).toFixed(0) + '%' : '0%'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-4xl font-bold">{totalAprendizes}</div>
          <div className="text-blue-100 mt-2">Aprendizes</div>
          <div className="text-sm text-blue-200 mt-1">
            {totalAprendizes > 0 ? ((totalAprendizes / irmaosAtivos.length) * 100).toFixed(0) + '%' : '0%'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-500 to-gray-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-4xl font-bold">{irmaosAtivos.length}</div>
          <div className="text-gray-100 mt-2">Total Ativos</div>
          <div className="text-sm text-gray-200 mt-1">Regular + Licenciado</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Grau
            </label>
            <select
              value={grauSelecionado}
              onChange={(e) => setGrauSelecionado(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todos os Graus ({irmaosAtivos.length})</option>
              <option value="Mestre">Mestres ({totalMestres})</option>
              <option value="Companheiro">Companheiros ({totalCompanheiros})</option>
              <option value="Aprendiz">Aprendizes ({totalAprendizes})</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ordenar por
            </label>
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="nome">Nome (A-Z)</option>
              <option value="cim">CIM</option>
              <option value="idade">Idade (Crescente)</option>
              <option value="tempo">Tempo na Maconaria</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={gerarQuadro}
              className="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
            >
              Exportar Quadro
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold">CIM</th>
                <th className="px-6 py-4 text-left text-sm font-bold">NOME</th>
                <th className="px-6 py-4 text-center text-sm font-bold">GRAU</th>
                <th className="px-6 py-4 text-center text-sm font-bold">IDADE</th>
                <th className="px-6 py-4 text-center text-sm font-bold">DATA INICIACAO</th>
                <th className="px-6 py-4 text-center text-sm font-bold">TEMPO MACONARIA</th>
                <th className="px-6 py-4 text-center text-sm font-bold">SITUACAO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {irmaosOrdenados.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <div className="text-6xl mb-4">📋</div>
                    <div className="text-xl font-semibold">Nenhum irmao encontrado</div>
                    <div className="text-sm mt-2">Ajuste os filtros ou adicione novos irmaos</div>
                  </td>
                </tr>
              ) : (
                irmaosOrdenados.map((irmao, index) => {
                  const grau = obterGrau(irmao);
                  const corGrau = obterCorGrau(grau);
                  const corSituacao = obterCorSituacao(irmao.situacao);

                  return (
                    <tr key={irmao.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono font-semibold text-blue-600">{irmao.cim}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{irmao.nome}</div>
                        {irmao.profissao && (
                          <div className="text-xs text-gray-500 mt-1">{irmao.profissao}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={'inline-block px-3 py-1 rounded-full text-xs font-bold ' + corGrau}>
                          {grau}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600">
                        {irmao.data_nascimento ? calcularIdade(irmao.data_nascimento) : '-'}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600">
                        {irmao.data_iniciacao ? formatarData(irmao.data_iniciacao) : '-'}
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-medium text-gray-700">
                        {formatarTempoMaconaria(irmao.data_iniciacao)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={'inline-block px-3 py-1 rounded-full text-xs font-bold ' + corSituacao}>
                          {irmao.situacao || 'Regular'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {irmaosOrdenados.length > 0 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <div>
                Exibindo <strong>{irmaosOrdenados.length}</strong> irmao(s)
                {grauSelecionado !== 'todos' && ' de grau ' + grauSelecionado}
              </div>
              <div>
                Ordenado por: <strong>{
                  ordenacao === 'nome' ? 'Nome' :
                  ordenacao === 'cim' ? 'CIM' :
                  ordenacao === 'idade' ? 'Idade' :
                  'Tempo na Maconaria'
                }</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <h4 className="font-bold text-blue-900 mb-2">Legenda</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <div>Tempo Maconaria: Formato Xa Xm = X anos e X meses desde a iniciacao</div>
          <div>Idade: Calculada com base na data de nascimento</div>
          <div>Grau: Determinado automaticamente pelas datas de iniciacao, elevacao e exaltacao</div>
          <div>Situacao: Apenas irmaos Regulares e Licenciados sao exibidos no quadro</div>
        </div>
      </div>
    </div>
  );
};

export default QuadroIrmaos;
