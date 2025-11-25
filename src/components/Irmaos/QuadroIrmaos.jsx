import { useState } from 'react';
import { formatarData, calcularIdade } from '../../utils/formatters';

const QuadroIrmaos = ({ irmaos }) => {
  const [grauSelecionado, setGrauSelecionado] = useState('todos');
  const [ordenacao, setOrdenacao] = useState('nome'); // nome, cim, idade, tempo

  // Função para determinar o grau baseado nas datas
  const obterGrau = (irmao) => {
    if (irmao.data_exaltacao) return 'Mestre';
    if (irmao.data_elevacao) return 'Companheiro';
    if (irmao.data_iniciacao) return 'Aprendiz';
    return 'Não iniciado';
  };

  // Função para calcular tempo de maçonaria em meses
  const calcularTempoMaconariaMeses = (dataIniciacao) => {
    if (!dataIniciacao) return 0;
    const inicio = new Date(dataIniciacao + 'T00:00:00');
    const hoje = new Date();
    const anos = hoje.getFullYear() - inicio.getFullYear();
    const meses = hoje.getMonth() - inicio.getMonth();
    return (anos * 12) + meses;
  };

  // Função para formatar tempo de maçonaria
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
    return `${anos}a ${meses}m`;
  };

  // Filtrar apenas irmãos regulares e licenciados
  const irmaosAtivos = irmaos.filter(irmao => {
    const situacao = (irmao.situacao || 'regular').toLowerCase();
    return situacao === 'regular' || situacao === 'licenciado';
  });

  // Agrupar irmãos por grau
  const irmaosPorGrau = {
    'Mestre': irmaosAtivos.filter(i => obterGrau(i) === 'Mestre'),
    'Companheiro': irmaosAtivos.filter(i => obterGrau(i) === 'Companheiro'),
    'Aprendiz': irmaosAtivos.filter(i => obterGrau(i) === 'Aprendiz'),
    'Não iniciado': irmaosAtivos.filter(i => obterGrau(i) === 'Não iniciado')
  };

  // Função de ordenação
  const ordenarIrmaos = (irmaos) => {
    const copia = [...irmaos];
    
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
          return tempoB - tempoA; // Maior tempo primeiro
        });
      default:
        return copia;
    }
  };

  // Gerar PDF/TXT do quadro
  const gerarQuadro = () => {
    let conteudo = `
========================================================
           QUADRO GERAL DE IRMÃOS
    A∴R∴L∴S∴ Acácia de Paranatinga nº 30
========================================================

Gerado em: ${new Date().toLocaleString('pt-BR')}
Total de Irmãos Ativos: ${irmaosAtivos.length}

`;

    // Para cada grau
    const graus = grauSelecionado === 'todos' 
      ? ['Mestre', 'Companheiro', 'Aprendiz', 'Não iniciado']
      : [grauSelecionado];

    graus.forEach(grau => {
      const irmaosGrau = ordenarIrmaos(irmaosPorGrau[grau]);
      
      if (irmaosGrau.length > 0) {
        conteudo += `
========================================================
${grau.toUpperCase()} (${irmaosGrau.length})
========================================================

`;
        
        conteudo += `${'CIM'.padEnd(8)} | ${'NOME'.padEnd(35)} | ${'IDADE'.padEnd(10)} | ${'INICIAÇÃO'.padEnd(12)} | ${'TEMPO'.padEnd(10)}\n`;
        conteudo += '-'.repeat(90) + '\n';

        irmaosGrau.forEach(irmao => {
          const cim = (irmao.cim || '-').toString().padEnd(8);
          const nome = (irmao.nome || '-').substring(0, 35).padEnd(35);
          const idade = irmao.data_nascimento ? calcularIdade(irmao.data_nascimento).padEnd(10) : '-'.padEnd(10);
          const iniciacao = irmao.data_iniciacao ? formatarData(irmao.data_iniciacao).padEnd(12) : '-'.padEnd(12);
          const tempo = formatarTempoMaconaria(irmao.data_iniciacao).padEnd(10);

          conteudo += `${cim} | ${nome} | ${idade} | ${iniciacao} | ${tempo}\n`;
        });

        conteudo += '\n';
      }
    });

    conteudo += `
========================================================
LEGENDA:
- Tempo: Xxa Xxm = X anos e X meses na Maçonaria
- Idade: Calculada com base na data de nascimento
========================================================
`;

    // Criar blob e download
    const blob = new Blob([conteudo], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Quadro_Irmaos_${grauSelecionado}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Obter irmãos para exibição
  const irmaosExibir = grauSelecionado === 'todos' 
    ? irmaosAtivos 
    : irmaosPorGrau[grauSelecionado];

  const irmaosOrdenados = ordenarIrmaos(irmaosExibir);

  // Estatísticas
  const totalMestres = irmaosPorGrau['Mestre'].length;
  const totalCompanheiros = irmaosPorGrau['Companheiro'].length;
  const totalAprendizes = irmaosPorGrau['Aprendiz'].length;
  const totalNaoIniciados = irmaosPorGrau['Não iniciado'].length;

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-4xl font-bold">{totalMestres}</div>
          <div className="text-purple-100 mt-2">Mestres</div>
          <div className="text-sm text-purple-200 mt-1">
            {totalMestres > 0 ? `${((totalMestres / irmaosAtivos.length) * 100).toFixed(0)}%` : '0%'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-4xl font-bold">{totalCompanheiros}</div>
          <div className="text-green-100 mt-2">Companheiros</div>
          <div className="text-sm text-green-200 mt-1">
            {totalCompanheiros > 0 ? `${((totalCompanheiros / irmaosAtivos.length) * 100).toFixed(0)}%` : '0%'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-4xl font-bold">{totalAprendizes}</div>
          <div className="text-blue-100 mt-2">Aprendizes</div>
          <div className="text-sm text-blue-200 mt-1">
            {totalAprendizes > 0 ? `${((totalAprendizes / irmaosAtivos.length) * 100).toFixed(0)}%` : '0%'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-500 to-gray-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-4xl font-bold">{irmaosAtivos.length}</div>
          <div className="text-gray-100 mt-2">Total Ativos</div>
          <div className="text-sm text-gray-200 mt-1">Regular + Licenciado</div>
        </div>
      </div>

      {/* Controles */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Filtro de Grau */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔺 Filtrar por Grau
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
              {totalNaoIniciados > 0 && (
                <option value="Não iniciado">Não Iniciados ({totalNaoIniciados})</option>
              )}
            </select>
          </div>

          {/* Ordenação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔄 Ordenar por
            </label>
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="nome">Nome (A-Z)</option>
              <option value="cim">CIM</option>
              <option value="idade">Idade (Crescente)</option>
              <option value="tempo">Tempo na Maçonaria</option>
            </select>
          </div>

          {/* Botão Exportar */}
          <div className="flex items-end">
            <button
              onClick={gerarQuadro}
              className="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
            >
              📄 Exportar Quadro
            </button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold">CIM</th>
                <th className="px-6 py-4 text-left text-sm font-bold">NOME</th>
                <th className="px-6 py-4 text-center text-sm font-bold">GRAU</th>
                <th className="px-6 py-4 text-center text-sm font-bold">IDADE</th>
                <th className="px-6 py-4 text-center text-sm font-bold">DATA INICIAÇÃO</th>
                <th className="px-6 py-4 text-center text-sm font-bold">TEMPO MAÇONARIA</th>
                <th className="px-6 py-4 text-center text-sm font-bold">SITUAÇÃO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {irmaosOrdenados.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <div className="text-6xl mb-4">📋</div>
                    <div className="text-xl font-semibold">Nenhum irmão encontrado</div>
                    <div className="text-sm mt-2">Ajuste os filtros ou adicione novos irmãos</div>
                  </td>
                </tr>
              ) : (
                irmaosOrdenados.map((irmao, index) => {
                  const grau = obterGrau(irmao);
                  const corGrau = {
                    'Aprendiz': 'bg-blue-100 text-blue-800',
                    'Companheiro': 'bg-green-100 text-green-800',
                    'Mestre': 'bg-purple-100 text-purple-800',
                    'Não iniciado': 'bg-gray-100 text-gray-800'
                  };

                  const corSituacao = (irmao.situacao || 'regular').toLowerCase() === 'regular'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800';

                  return (
                    <tr key={irmao.id} className={`hover:bg-gray-50 transition ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
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
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${corGrau[grau]}`}>
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
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${corSituacao}`}>
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

        {/* Rodapé da Tabela */}
        {irmaosOrdenados.length > 0 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <div>
                Exibindo <strong>{irmaosOrdenados.length}</strong> irmão(ãos)
                {grauSelecionado !== 'todos' && ` de grau ${grauSelecionado}`}
              </div>
              <div>
                Ordenado por: <strong>{
                  ordenacao === 'nome' ? 'Nome' :
                  ordenacao === 'cim' ? 'CIM' :
                  ordenacao === 'idade' ? 'Idade' :
                  'Tempo na Maçonaria'
                }</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <h4 className="font-bold text-blue-900 mb-2">📌 Legenda</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <div>• <strong>Tempo Maçonaria:</strong> Formato "Xa Xm" = X anos e X meses desde a iniciação</div>
          <div>• <strong>Idade:</strong> Calculada com base na data de nascimento</div>
          <div>• <strong>Grau:</strong> Determinado automaticamente pelas datas de iniciação, elevação e exaltação</div>
          <div>• <strong>Situação:</strong> Apenas irmãos Regulares e Licenciados são exibidos no quadro</div>
        </div>
      </div>

      {/* Informações Adicionais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-gray-600 text-sm mb-2">Irmão mais antigo</div>
          {(() => {
            const maisAntigo = irmaosAtivos.reduce((anterior, atual) => {
              if (!anterior.data_iniciacao) return atual;
              if (!atual.data_iniciacao) return anterior;
              return new Date(atual.data_iniciacao) < new Date(anterior.data_iniciacao) ? atual : anterior;
            }, irmaosAtivos[0]);

            return maisAntigo && maisAntigo.data_iniciacao ? (
              <div>
                <div className="font-semibold text-gray-900">{maisAntigo.nome}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {formatarTempoMaconaria(maisAntigo.data_iniciacao)} na Maçonaria
                </div>
              </div>
            ) : (
              <div className="text-gray-500">-</div>
            );
          })()}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-gray-600 text-sm mb-2">Irmão mais jovem</div>
          {(() => {
            const maisJovem = irmaosAtivos.reduce((anterior, atual) => {
              if (!anterior.data_nascimento) return atual;
              if (!atual.data_nascimento) return anterior;
              return new Date(atual.data_nascimento) > new Date(anterior.data_nascimento) ? atual : anterior;
            }, irmaosAtivos[0]);

            return maisJovem && maisJovem.data_nascimento ? (
              <div>
                <div className="font-semibold text-gray-900">{maisJovem.nome}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {calcularIdade(maisJovem.data_nascimento)}
                </div>
              </div>
            ) : (
              <div className="text-gray-500">-</div>
            );
          })()}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-gray-600 text-sm mb-2">Média de idade</div>
          {(() => {
            const irmaosComIdade = irmaosAtivos.filter(i => i.data_nascimento);
            if (irmaosComIdade.length === 0) {
              return <div className="text-gray-500">-</div>;
            }

            const somaIdades = irmaosComIdade.reduce((soma, irmao) => {
              const idade = parseInt(calcularIdade(irmao.data_nascimento));
              return soma + idade;
            }, 0);

            const mediaIdade = Math.round(somaIdades / irmaosComIdade.length);

            return (
              <div>
                <div className="font-bold text-3xl text-gray-900">{mediaIdade}</div>
                <div className="text-sm text-gray-600 mt-1">anos</div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default QuadroIrmaos;
