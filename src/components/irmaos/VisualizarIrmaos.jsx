import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  formatarData,
  formatarCPF,
  formatarTelefone,
  calcularIdade
} from '../../utils/formatters';
import { STATUS_IRMAOS } from '../../utils/constants';

const VisualizarIrmaos = ({ irmaos, onEdit, onUpdate, showSuccess, showError, permissoes }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [situacaoFilter, setSituacaoFilter] = useState('regular,licenciado');
  const [grauFilter, setGrauFilter] = useState('todos');
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);
  const [irmaoSelecionado, setIrmaoSelecionado] = useState(null);
  const [familiaresSelecionado, setFamiliaresSelecionado] = useState({
    conjuge: null,
    pais: null,
    filhos: []
  });
  const [loading, setLoading] = useState(false);

  // Função para determinar o grau baseado nas datas
  const obterGrau = (irmao) => {
    if (irmao.data_exaltacao) return 'Mestre';
    if (irmao.data_elevacao) return 'Companheiro';
    if (irmao.data_iniciacao) return 'Aprendiz';
    return 'Não iniciado';
  };

  // Função para calcular tempo de maçonaria
  const calcularTempoMaconaria = (dataIniciacao) => {
    if (!dataIniciacao) return '';
    const inicio = new Date(dataIniciacao + 'T00:00:00');
    const hoje = new Date();
    let anos = hoje.getFullYear() - inicio.getFullYear();
    let meses = hoje.getMonth() - inicio.getMonth();
    if (meses < 0) {
      anos--;
      meses = 12 + meses;
    }
    return `${anos} ano(s) e ${meses} mês(es)`;
  };

  // Função para obter cor da situação
  const obterCorSituacao = (situacao) => {
    const cores = {
      regular: 'bg-green-100 text-green-800 border-green-300',
      irregular: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      licenciado: 'bg-blue-100 text-blue-800 border-blue-300',
      suspenso: 'bg-orange-100 text-orange-800 border-orange-300',
      desligado: 'bg-gray-100 text-gray-800 border-gray-300',
      excluido: 'bg-red-100 text-red-800 border-red-300',
      falecido: 'bg-purple-100 text-purple-800 border-purple-300',
      ex_oficio: 'bg-indigo-100 text-indigo-800 border-indigo-300'
    };
    return cores[situacao] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  // Função para obter cor do grau
  const obterCorGrau = (grau) => {
    const cores = {
      'Aprendiz': 'bg-blue-500',
      'Companheiro': 'bg-green-500',
      'Mestre': 'bg-purple-500',
      'Não iniciado': 'bg-gray-400'
    };
    return cores[grau] || 'bg-gray-400';
  };

  // Carregar detalhes do irmão e familiares
  const carregarDetalhes = async (irmao) => {
    setLoading(true);
    try {
      // Carregar cônjuge
      const { data: conjugeData } = await supabase
        .from('esposas')
        .select('*')
        .eq('irmao_id', irmao.id)
        .single();

      // Carregar pais
      const { data: paisData } = await supabase
        .from('pais')
        .select('*')
        .eq('irmao_id', irmao.id)
        .single();

      // Carregar filhos
      const { data: filhosData } = await supabase
        .from('filhos')
        .select('*')
        .eq('irmao_id', irmao.id)
        .order('data_nascimento', { ascending: true });

      setFamiliaresSelecionado({
        conjuge: conjugeData || null,
        pais: paisData || null,
        filhos: filhosData || []
      });

      setIrmaoSelecionado(irmao);
      setMostrarDetalhes(true);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      showError('Erro ao carregar detalhes do irmão');
    } finally {
      setLoading(false);
    }
  };

  // Fechar modal de detalhes
  const fecharDetalhes = () => {
    setMostrarDetalhes(false);
    setIrmaoSelecionado(null);
    setFamiliaresSelecionado({ conjuge: null, pais: null, filhos: [] });
  };

  // Deletar irmão
  const deletarIrmao = async (irmaoId) => {
    if (!window.confirm('Tem certeza que deseja excluir este irmão? Esta ação não pode ser desfeita e irá remover também todos os dados de familiares.')) {
      return;
    }

    setLoading(true);
    try {
      // Deletar familiares (cascade não está configurado, então fazemos manualmente)
      await supabase.from('esposas').delete().eq('irmao_id', irmaoId);
      await supabase.from('pais').delete().eq('irmao_id', irmaoId);
      await supabase.from('filhos').delete().eq('irmao_id', irmaoId);

      // Deletar irmão
      const { error } = await supabase
        .from('irmaos')
        .delete()
        .eq('id', irmaoId);

      if (error) throw error;

      showSuccess('Irmão excluído com sucesso!');
      onUpdate();
    } catch (error) {
      console.error('Erro ao excluir irmão:', error);
      showError('Erro ao excluir irmão: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Gerar PDF do irmão
  const gerarPDF = async (irmao) => {
    setLoading(true);
    try {
      // Carregar familiares
      const { data: conjugeData } = await supabase
        .from('esposas')
        .select('*')
        .eq('irmao_id', irmao.id)
        .single();

      const { data: paisData } = await supabase
        .from('pais')
        .select('*')
        .eq('irmao_id', irmao.id)
        .single();

      const { data: filhosData } = await supabase
        .from('filhos')
        .select('*')
        .eq('irmao_id', irmao.id)
        .order('data_nascimento', { ascending: true });

      // Criar conteúdo do PDF
      const grau = obterGrau(irmao);
      let conteudoPDF = `
        FICHA CADASTRAL DO IRMÃO
        A∴R∴L∴S∴ Acácia de Paranatinga nº 30
        ================================================

        DADOS PESSOAIS
        ------------------------------------------------
        CIM: ${irmao.cim}
        Nome: ${irmao.nome}
        CPF: ${irmao.cpf ? formatarCPF(irmao.cpf) : 'Não informado'}
        RG: ${irmao.rg || 'Não informado'}
        Data de Nascimento: ${irmao.data_nascimento ? formatarData(irmao.data_nascimento) : 'Não informado'}
        Idade: ${irmao.data_nascimento ? calcularIdade(irmao.data_nascimento) : 'Não informado'}
        Estado Civil: ${irmao.estado_civil || 'Não informado'}
        Profissão: ${irmao.profissao || 'Não informado'}
        Escolaridade: ${irmao.escolaridade || 'Não informado'}

        CONTATO
        ------------------------------------------------
        Email: ${irmao.email || 'Não informado'}
        Telefone: ${irmao.telefone ? formatarTelefone(irmao.telefone) : 'Não informado'}
        Endereço: ${irmao.endereco || 'Não informado'}
        Número: ${irmao.numero || ''}
        Complemento: ${irmao.complemento || ''}
        Bairro: ${irmao.bairro || 'Não informado'}
        Cidade: ${irmao.cidade || 'Não informado'}
        Estado: ${irmao.estado || 'Não informado'}
        CEP: ${irmao.cep || 'Não informado'}

        DADOS MAÇÔNICOS
        ------------------------------------------------
        Grau Atual: ${grau}
        Situação: ${irmao.situacao || 'Regular'}
        Data de Iniciação: ${irmao.data_iniciacao ? formatarData(irmao.data_iniciacao) : 'Não informado'}
        Data de Elevação: ${irmao.data_elevacao ? formatarData(irmao.data_elevacao) : 'Não informado'}
        Data de Exaltação: ${irmao.data_exaltacao ? formatarData(irmao.data_exaltacao) : 'Não informado'}
        Tempo de Maçonaria: ${irmao.data_iniciacao ? calcularTempoMaconaria(irmao.data_iniciacao) : 'Não informado'}
        Loja de Origem: ${irmao.loja_origem || 'Não informado'}
        Oriente: ${irmao.oriente || 'Não informado'}
        Grande Oriente: ${irmao.grande_oriente || 'Não informado'}
        Observações: ${irmao.observacoes || 'Nenhuma'}
      `;

      // Adicionar dados do cônjuge
      if (conjugeData) {
        conteudoPDF += `

        CÔNJUGE
        ------------------------------------------------
        Nome: ${conjugeData.nome}
        CPF: ${conjugeData.cpf ? formatarCPF(conjugeData.cpf) : 'Não informado'}
        Data de Nascimento: ${conjugeData.data_nascimento ? formatarData(conjugeData.data_nascimento) : 'Não informado'}
        Idade: ${conjugeData.data_nascimento ? calcularIdade(conjugeData.data_nascimento) : 'Não informado'}
        Profissão: ${conjugeData.profissao || 'Não informado'}
        `;
      }

      // Adicionar dados dos pais
      if (paisData) {
        conteudoPDF += `

        PAIS
        ------------------------------------------------
        Pai: ${paisData.nome_pai || 'Não informado'} ${paisData.pai_vivo ? '(Vivo)' : '(Falecido)'}
        Mãe: ${paisData.nome_mae || 'Não informado'} ${paisData.mae_viva ? '(Viva)' : '(Falecida)'}
        `;
      }

      // Adicionar dados dos filhos
      if (filhosData && filhosData.length > 0) {
        conteudoPDF += `

        FILHOS (${filhosData.length})
        ------------------------------------------------
        `;
        filhosData.forEach((filho, index) => {
          conteudoPDF += `
        ${index + 1}. ${filho.nome}
           Sexo: ${filho.sexo === 'M' ? 'Masculino' : 'Feminino'}
           Data de Nascimento: ${filho.data_nascimento ? formatarData(filho.data_nascimento) : 'Não informado'}
           Idade: ${filho.data_nascimento ? calcularIdade(filho.data_nascimento) : 'Não informado'}
          `;
        });
      }

      conteudoPDF += `

        ================================================
        Documento gerado em ${new Date().toLocaleString('pt-BR')}
      `;

      // Criar blob e download
      const blob = new Blob([conteudoPDF], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ficha_${irmao.nome.replace(/\s+/g, '_')}_${irmao.cim}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showSuccess('Ficha gerada com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      showError('Erro ao gerar ficha');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar irmãos
  const irmaosFiltrados = irmaos.filter(irmao => {
    // Filtro de busca (nome ou CIM)
    const matchSearch = irmao.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        irmao.cim?.toString().includes(searchTerm);

    // Filtro de situação
    const situacaoAtual = (irmao.situacao || 'regular').toLowerCase();
    let matchSituacao = false;
    
    if (situacaoFilter === 'todos') {
      matchSituacao = true;
    } else if (situacaoFilter === 'regular,licenciado') {
      matchSituacao = situacaoAtual === 'regular' || situacaoAtual === 'licenciado';
    } else {
      matchSituacao = situacaoAtual === situacaoFilter;
    }

    // Filtro de grau
    const grauAtual = obterGrau(irmao);
    const matchGrau = grauFilter === 'todos' || grauAtual === grauFilter;

    return matchSearch && matchSituacao && matchGrau;
  });

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Busca */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔍 Buscar
            </label>
            <input
              type="text"
              placeholder="Nome ou CIM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filtro de Situação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📊 Situação
            </label>
            <select
              value={situacaoFilter}
              onChange={(e) => setSituacaoFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="regular,licenciado">Regulares e Licenciados</option>
              <option value="todos">Todas as Situações</option>
              {STATUS_IRMAOS.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Grau */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔺 Grau
            </label>
            <select
              value={grauFilter}
              onChange={(e) => setGrauFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todos os Graus</option>
              <option value="Aprendiz">Aprendiz</option>
              <option value="Companheiro">Companheiro</option>
              <option value="Mestre">Mestre</option>
              <option value="Não iniciado">Não iniciado</option>
            </select>
          </div>
        </div>

        {/* Contador */}
        <div className="mt-4 text-sm text-gray-600">
          Exibindo <strong>{irmaosFiltrados.length}</strong> de <strong>{irmaos.length}</strong> irmãos
        </div>
      </div>

      {/* Cards de Irmãos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {irmaosFiltrados.map(irmao => {
          const grau = obterGrau(irmao);
          const situacao = (irmao.situacao || 'regular').toLowerCase();
          
          return (
            <div
              key={irmao.id}
              className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow overflow-hidden"
            >
              {/* Foto e Grau */}
              <div className="relative">
                {irmao.foto_url ? (
                  <img
                    src={irmao.foto_url}
                    alt={irmao.nome}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                    <span className="text-6xl text-white">👤</span>
                  </div>
                )}
                
                {/* Badge do Grau */}
                <div className={`absolute top-2 right-2 ${obterCorGrau(grau)} text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg`}>
                  {grau}
                </div>
              </div>

              {/* Informações */}
              <div className="p-4">
                <h3 className="font-bold text-lg text-gray-800 truncate" title={irmao.nome}>
                  {irmao.nome}
                </h3>
                
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">CIM:</span> {irmao.cim}
                  </p>
                  
                  {irmao.data_nascimento && (
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Idade:</span> {calcularIdade(irmao.data_nascimento)}
                    </p>
                  )}
                  
                  {irmao.data_iniciacao && (
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Iniciação:</span> {formatarData(irmao.data_iniciacao)}
                    </p>
                  )}
                </div>

                {/* Badge de Situação */}
                <div className="mt-3">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${obterCorSituacao(situacao)}`}>
                    {irmao.situacao || 'Regular'}
                  </span>
                </div>

                {/* Botões de Ação */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => carregarDetalhes(irmao)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    title="Ver Detalhes"
                  >
                    👁️ Ver
                  </button>
                  
                  {permissoes?.canEdit && (
                    <button
                      onClick={() => onEdit(irmao)}
                      className="flex-1 px-3 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
                      title="Editar"
                    >
                      ✏️ Editar
                    </button>
                  )}
                  
                  <button
                    onClick={() => gerarPDF(irmao)}
                    className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                    title="Gerar Ficha"
                  >
                    📄
                  </button>
                  
                  {permissoes?.canEdit && (
                    <button
                      onClick={() => deletarIrmao(irmao.id)}
                      className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                      title="Excluir"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mensagem quando não há resultados */}
      {irmaosFiltrados.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            Nenhum irmão encontrado
          </h3>
          <p className="text-gray-500">
            Tente ajustar os filtros de busca
          </p>
        </div>
      )}

      {/* Modal de Detalhes */}
      {mostrarDetalhes && irmaoSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Detalhes do Irmão</h2>
                <button
                  onClick={fecharDetalhes}
                  className="text-white hover:text-gray-200 text-3xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 space-y-6">
              {/* Foto e Informações Básicas */}
              <div className="flex gap-6">
                {irmaoSelecionado.foto_url ? (
                  <img
                    src={irmaoSelecionado.foto_url}
                    alt={irmaoSelecionado.nome}
                    className="w-32 h-32 rounded-lg object-cover shadow-md"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                    <span className="text-5xl text-white">👤</span>
                  </div>
                )}

                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-800">{irmaoSelecionado.nome}</h3>
                  <p className="text-gray-600 mt-1">CIM: {irmaoSelecionado.cim}</p>
                  <div className="mt-3 flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${obterCorGrau(obterGrau(irmaoSelecionado))} text-white`}>
                      {obterGrau(irmaoSelecionado)}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${obterCorSituacao((irmaoSelecionado.situacao || 'regular').toLowerCase())}`}>
                      {irmaoSelecionado.situacao || 'Regular'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dados Pessoais */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-bold text-lg text-blue-900 mb-3 border-b pb-2">👤 Dados Pessoais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-semibold text-gray-700">CPF:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.cpf ? formatarCPF(irmaoSelecionado.cpf) : 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">RG:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.rg || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Data Nascimento:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.data_nascimento ? formatarData(irmaoSelecionado.data_nascimento) : 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Idade:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.data_nascimento ? calcularIdade(irmaoSelecionado.data_nascimento) : 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Estado Civil:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.estado_civil || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Profissão:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.profissao || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Escolaridade:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.escolaridade || 'Não informado'}</span>
                  </div>
                </div>
              </div>

              {/* Contato */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-bold text-lg text-green-900 mb-3 border-b pb-2">📞 Contato</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-semibold text-gray-700">Email:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.email || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Telefone:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.telefone ? formatarTelefone(irmaoSelecionado.telefone) : 'Não informado'}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-semibold text-gray-700">Endereço:</span>
                    <span className="ml-2 text-gray-600">
                      {irmaoSelecionado.endereco || 'Não informado'}
                      {irmaoSelecionado.numero && `, ${irmaoSelecionado.numero}`}
                      {irmaoSelecionado.complemento && ` - ${irmaoSelecionado.complemento}`}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Bairro:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.bairro || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Cidade/Estado:</span>
                    <span className="ml-2 text-gray-600">
                      {irmaoSelecionado.cidade || 'Não informado'}
                      {irmaoSelecionado.estado && `/${irmaoSelecionado.estado}`}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">CEP:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.cep || 'Não informado'}</span>
                  </div>
                </div>
              </div>

              {/* Dados Maçônicos */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-bold text-lg text-purple-900 mb-3 border-b pb-2">🔺 Dados Maçônicos</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-semibold text-gray-700">Data Iniciação:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.data_iniciacao ? formatarData(irmaoSelecionado.data_iniciacao) : 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Data Elevação:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.data_elevacao ? formatarData(irmaoSelecionado.data_elevacao) : 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Data Exaltação:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.data_exaltacao ? formatarData(irmaoSelecionado.data_exaltacao) : 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Tempo Maçonaria:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.data_iniciacao ? calcularTempoMaconaria(irmaoSelecionado.data_iniciacao) : 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Loja Origem:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.loja_origem || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Oriente:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.oriente || 'Não informado'}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-semibold text-gray-700">Grande Oriente:</span>
                    <span className="ml-2 text-gray-600">{irmaoSelecionado.grande_oriente || 'Não informado'}</span>
                  </div>
                  {irmaoSelecionado.observacoes && (
                    <div className="md:col-span-2">
                      <span className="font-semibold text-gray-700">Observações:</span>
                      <p className="ml-2 text-gray-600 mt-1">{irmaoSelecionado.observacoes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Cônjuge */}
              {familiaresSelecionado.conjuge && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-bold text-lg text-pink-900 mb-3 border-b pb-2">💑 Cônjuge</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-semibold text-gray-700">Nome:</span>
                      <span className="ml-2 text-gray-600">{familiaresSelecionado.conjuge.nome}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">CPF:</span>
                      <span className="ml-2 text-gray-600">{familiaresSelecionado.conjuge.cpf ? formatarCPF(familiaresSelecionado.conjuge.cpf) : 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Data Nascimento:</span>
                      <span className="ml-2 text-gray-600">{familiaresSelecionado.conjuge.data_nascimento ? formatarData(familiaresSelecionado.conjuge.data_nascimento) : 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Idade:</span>
                      <span className="ml-2 text-gray-600">{familiaresSelecionado.conjuge.data_nascimento ? calcularIdade(familiaresSelecionado.conjuge.data_nascimento) : 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Profissão:</span>
                      <span className="ml-2 text-gray-600">{familiaresSelecionado.conjuge.profissao || 'Não informado'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Pais */}
              {familiaresSelecionado.pais && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-bold text-lg text-indigo-900 mb-3 border-b pb-2">👨‍👩‍👦 Pais</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-semibold text-gray-700">Pai:</span>
                      <span className="ml-2 text-gray-600">
                        {familiaresSelecionado.pais.nome_pai || 'Não informado'}
                        {familiaresSelecionado.pais.nome_pai && (
                          <span className={`ml-2 ${familiaresSelecionado.pais.pai_vivo ? 'text-green-600' : 'text-gray-500'}`}>
                            {familiaresSelecionado.pais.pai_vivo ? '(Vivo)' : '(Falecido)'}
                          </span>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Mãe:</span>
                      <span className="ml-2 text-gray-600">
                        {familiaresSelecionado.pais.nome_mae || 'Não informado'}
                        {familiaresSelecionado.pais.nome_mae && (
                          <span className={`ml-2 ${familiaresSelecionado.pais.mae_viva ? 'text-green-600' : 'text-gray-500'}`}>
                            {familiaresSelecionado.pais.mae_viva ? '(Viva)' : '(Falecida)'}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Filhos */}
              {familiaresSelecionado.filhos.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-bold text-lg text-blue-900 mb-3 border-b pb-2">
                    👶 Filhos ({familiaresSelecionado.filhos.length})
                  </h4>
                  <div className="space-y-3">
                    {familiaresSelecionado.filhos.map((filho, index) => (
                      <div key={index} className="bg-white rounded p-3 border border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{filho.sexo === 'M' ? '👦' : '👧'}</span>
                          <span className="font-semibold text-gray-800">{filho.nome}</span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>
                            <span className="font-semibold">Sexo:</span> {filho.sexo === 'M' ? 'Masculino' : 'Feminino'}
                          </div>
                          <div>
                            <span className="font-semibold">Data Nascimento:</span> {filho.data_nascimento ? formatarData(filho.data_nascimento) : 'Não informado'}
                          </div>
                          {filho.data_nascimento && (
                            <div>
                              <span className="font-semibold">Idade:</span> {calcularIdade(filho.data_nascimento)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="sticky bottom-0 bg-gray-100 p-4 rounded-b-lg flex justify-end gap-3">
              <button
                onClick={() => gerarPDF(irmaoSelecionado)}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                📄 Gerar Ficha
              </button>
              {permissoes?.canEdit && (
                <button
                  onClick={() => {
                    fecharDetalhes();
                    onEdit(irmaoSelecionado);
                  }}
                  className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  ✏️ Editar
                </button>
              )}
              <button
                onClick={fecharDetalhes}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualizarIrmaos;
