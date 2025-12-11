import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';

/**
 * LANÇAMENTOS EM LOTE
 * Permite criar múltiplos lançamentos para múltiplos irmãos de uma vez
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

export default function LancamentosLote({ showSuccess, showError }) {
  const [irmaos, setIrmaos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [etapa, setEtapa] = useState(1); // 1=Itens, 2=Irmãos, 3=Resumo

  // Estados dos itens
  const [itens, setItens] = useState([
    {
      id: Date.now(),
      tipo: 'receita',
      categoria_id: '',
      descricao: '',
      valor: '',
      data_vencimento: new Date().toISOString().split('T')[0],
      parcelas: 1,
      forma_pagamento: '',
      observacoes: ''
    }
  ]);

  // Estados dos irmãos selecionados
  const [irmaosSelecionados, setIrmaosSelecionados] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [buscarIrmao, setBuscarIrmao] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      // Carregar irmãos ativos
      const { data: irmaosData, error: irmaosError } = await supabase
        .from('irmaos')
        .select('id, nome, cim, status')
        .neq('status', 'Falecido')
        .order('nome');

      if (irmaosError) throw irmaosError;
      setIrmaos(irmaosData || []);

      // Carregar categorias
      const { data: categoriasData, error: categoriasError } = await supabase
        .from('categorias_financeiras')
        .select('*')
        .order('nome');

      if (categoriasError) throw categoriasError;
      setCategorias(categoriasData || []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showError('Erro ao carregar dados: ' + error.message);
    }
  };

  // Adicionar novo item
  const adicionarItem = () => {
    setItens([...itens, {
      id: Date.now(),
      tipo: 'receita',
      categoria_id: '',
      descricao: '',
      valor: '',
      data_vencimento: new Date().toISOString().split('T')[0],
      parcelas: 1,
      forma_pagamento: '',
      observacoes: ''
    }]);
  };

  // Remover item
  const removerItem = (id) => {
    if (itens.length === 1) {
      showError('É necessário ter pelo menos 1 item');
      return;
    }
    setItens(itens.filter(item => item.id !== id));
  };

  // Atualizar item
  const atualizarItem = (id, campo, valor) => {
    setItens(itens.map(item => 
      item.id === id ? { ...item, [campo]: valor } : item
    ));
  };

  // Toggle seleção de irmão
  const toggleIrmao = (irmaoId) => {
    if (irmaosSelecionados.includes(irmaoId)) {
      setIrmaosSelecionados(irmaosSelecionados.filter(id => id !== irmaoId));
      setSelectAll(false);
    } else {
      setIrmaosSelecionados([...irmaosSelecionados, irmaoId]);
    }
  };

  // Selecionar/Desselecionar todos
  const toggleSelectAll = () => {
    if (selectAll) {
      setIrmaosSelecionados([]);
      setSelectAll(false);
    } else {
      setIrmaosSelecionados(irmaosFiltrados.map(i => i.id));
      setSelectAll(true);
    }
  };

  // Filtrar irmãos
  const irmaosFiltrados = irmaos.filter(irmao =>
    irmao.nome.toLowerCase().includes(buscarIrmao.toLowerCase()) ||
    irmao.cim?.toString().includes(buscarIrmao)
  );

  // Validar etapa 1
  const validarItens = () => {
    for (const item of itens) {
      if (!item.categoria_id || !item.descricao || !item.valor || !item.data_vencimento) {
        showError('Preencha todos os campos obrigatórios dos itens');
        return false;
      }
      if (parseFloat(item.valor) <= 0) {
        showError('Valor deve ser maior que zero');
        return false;
      }
    }
    return true;
  };

  // Validar etapa 2
  const validarIrmaos = () => {
    if (irmaosSelecionados.length === 0) {
      showError('Selecione pelo menos 1 irmão');
      return false;
    }
    return true;
  };

  // Avançar para próxima etapa
  const proximaEtapa = () => {
    if (etapa === 1 && validarItens()) {
      setEtapa(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (etapa === 2 && validarIrmaos()) {
      setEtapa(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Voltar etapa
  const voltarEtapa = () => {
    setEtapa(etapa - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calcular totais
  const calcularTotais = () => {
    let totalItens = 0;
    let totalParcelasGeral = 0;

    itens.forEach(item => {
      const valor = parseFloat(item.valor || 0);
      const parcelas = parseInt(item.parcelas || 1);
      totalItens += valor;
      totalParcelasGeral += parcelas;
    });

    const totalLancamentos = totalItens * irmaosSelecionados.length;
    const quantidadeLancamentos = totalParcelasGeral * irmaosSelecionados.length;
    
    return { totalItens, totalLancamentos, quantidadeLancamentos };
  };

  // Salvar todos os lançamentos
  const salvarLancamentos = async () => {
    setLoading(true);

    try {
      const lancamentos = [];

      // Para cada irmão selecionado
      for (const irmaoId of irmaosSelecionados) {
        // Para cada item
        for (const item of itens) {
          const valorItem = parseFloat(item.valor);
          const numParcelas = parseInt(item.parcelas) || 1;
          
          // Se tem parcelas, criar múltiplos lançamentos
          if (numParcelas > 1) {
            const valorParcela = valorItem / numParcelas;
            
            for (let p = 1; p <= numParcelas; p++) {
              const dataVencimento = new Date(item.data_vencimento);
              dataVencimento.setMonth(dataVencimento.getMonth() + (p - 1));

              lancamentos.push({
                tipo: item.tipo,
                categoria_id: item.categoria_id,
                descricao: `${item.descricao} (${p}/${numParcelas})`,
                valor: valorParcela,
                data_vencimento: dataVencimento.toISOString().split('T')[0],
                status: 'pendente',
                origem_tipo: 'Irmao',
                origem_irmao_id: irmaoId,
                forma_pagamento: item.forma_pagamento || null,
                observacoes: item.observacoes || null,
                parcela_atual: p,
                total_parcelas: numParcelas
              });
            }
          } else {
            // Lançamento único
            lancamentos.push({
              tipo: item.tipo,
              categoria_id: item.categoria_id,
              descricao: item.descricao,
              valor: valorItem,
              data_vencimento: item.data_vencimento,
              status: 'pendente',
              origem_tipo: 'Irmao',
              origem_irmao_id: irmaoId,
              forma_pagamento: item.forma_pagamento || null,
              observacoes: item.observacoes || null
            });
          }
        }
      }

      // Inserir todos de uma vez
      const { error } = await supabase
        .from('lancamentos_loja')
        .insert(lancamentos);

      if (error) throw error;

      showSuccess(`✅ ${lancamentos.length} lançamentos criados com sucesso!`);
      
      // Resetar
      setItens([{
        id: Date.now(),
        tipo: 'receita',
        categoria_id: '',
        descricao: '',
        valor: '',
        data_vencimento: new Date().toISOString().split('T')[0],
        parcelas: 1,
        forma_pagamento: '',
        observacoes: ''
      }]);
      setIrmaosSelecionados([]);
      setSelectAll(false);
      setBuscarIrmao('');
      setEtapa(1);

    } catch (error) {
      console.error('Erro ao salvar:', error);
      showError('Erro ao criar lançamentos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor || 0);
  };

  const categoriasReceita = categorias.filter(c => c.tipo === 'receita');
  const categoriasDespesa = categorias.filter(c => c.tipo === 'despesa');

  const { totalItens, totalLancamentos, quantidadeLancamentos } = calcularTotais();

  return (
    <div className="space-y-6 p-6">
      {/* HEADER COM PROGRESSO */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            📦 Lançamentos em Lote
          </h2>
          <span className="text-sm text-gray-600">
            Crie múltiplos lançamentos para vários irmãos de uma vez
          </span>
        </div>
        
        {/* Stepper */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <div className={`flex items-center gap-2 ${etapa >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
              etapa >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              1
            </div>
            <span className="font-medium hidden sm:inline">Itens</span>
          </div>
          
          <div className={`w-20 h-1 ${etapa >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
          
          <div className={`flex items-center gap-2 ${etapa >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
              etapa >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              2
            </div>
            <span className="font-medium hidden sm:inline">Irmãos</span>
          </div>
          
          <div className={`w-20 h-1 ${etapa >= 3 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
          
          <div className={`flex items-center gap-2 ${etapa >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
              etapa >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              3
            </div>
            <span className="font-medium hidden sm:inline">Resumo</span>
          </div>
        </div>
      </div>

      {/* ETAPA 1: ITENS */}
      {etapa === 1 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-800">📝 Definir Itens</h3>
            <button
              onClick={adicionarItem}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              ➕ Adicionar Item
            </button>
          </div>

          <div className="space-y-6">
            {itens.map((item, index) => (
              <div key={item.id} className="border-2 border-gray-200 rounded-lg p-5 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-700 text-lg">📄 Item #{index + 1}</h4>
                  {itens.length > 1 && (
                    <button
                      onClick={() => removerItem(item.id)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      ❌ Remover
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Tipo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                    <select
                      value={item.tipo}
                      onChange={(e) => {
                        atualizarItem(item.id, 'tipo', e.target.value);
                        atualizarItem(item.id, 'categoria_id', '');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="receita">💰 Receita (Irmão deve)</option>
                      <option value="despesa">💸 Despesa (Crédito)</option>
                    </select>
                  </div>

                  {/* Categoria */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
                    <select
                      value={item.categoria_id}
                      onChange={(e) => atualizarItem(item.id, 'categoria_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    >
                      <option value="">Selecione...</option>
                      {(item.tipo === 'receita' ? categoriasReceita : categoriasDespesa).map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.nome}</option>
                      ))}
                    </select>
                  </div>

                  {/* Valor */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.valor}
                      onChange={(e) => atualizarItem(item.id, 'valor', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  {/* Descrição */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                    <input
                      type="text"
                      value={item.descricao}
                      onChange={(e) => atualizarItem(item.id, 'descricao', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ex: Ágape Dia das Mães"
                      required
                    />
                  </div>

                  {/* Data Vencimento */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento *</label>
                    <input
                      type="date"
                      value={item.data_vencimento}
                      onChange={(e) => atualizarItem(item.id, 'data_vencimento', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>

                  {/* Parcelas */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Parcelas
                      <span className="text-xs text-gray-500 ml-1">(opcional)</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={item.parcelas}
                      onChange={(e) => atualizarItem(item.id, 'parcelas', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {item.parcelas > 1 && (
                      <p className="text-xs text-gray-600 mt-1">
                        {item.parcelas}x de {formatarMoeda(parseFloat(item.valor || 0) / item.parcelas)}
                      </p>
                    )}
                  </div>

                  {/* Forma Pagamento */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Forma Pagamento
                      <span className="text-xs text-gray-500 ml-1">(opcional)</span>
                    </label>
                    <select
                      value={item.forma_pagamento}
                      onChange={(e) => atualizarItem(item.id, 'forma_pagamento', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Não definido</option>
                      <option value="dinheiro">💵 Dinheiro</option>
                      <option value="pix">📱 PIX</option>
                      <option value="cartao">💳 Cartão</option>
                      <option value="transferencia">🏦 Transferência</option>
                    </select>
                  </div>

                  {/* Observações */}
                  <div className="lg:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                    <textarea
                      value={item.observacoes}
                      onChange={(e) => atualizarItem(item.id, 'observacoes', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      rows="2"
                      placeholder="Observações adicionais..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Resumo Parcial */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <h4 className="font-bold text-blue-900 mb-2">📊 Resumo dos Itens</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-blue-700">Total de Itens</p>
                <p className="text-2xl font-bold text-blue-900">{itens.length}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700">Valor Total</p>
                <p className="text-2xl font-bold text-blue-900">{formatarMoeda(totalItens)}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={proximaEtapa}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Próximo: Selecionar Irmãos →
            </button>
          </div>
        </div>
      )}

      {/* ETAPA 2: IRMÃOS */}
      {etapa === 2 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">👥 Selecionar Irmãos</h3>

          {/* Buscar */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 Buscar por nome ou CIM..."
              value={buscarIrmao}
              onChange={(e) => setBuscarIrmao(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Selecionar Todos */}
          <div className="mb-4">
            <label className="flex items-center gap-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={toggleSelectAll}
                className="w-5 h-5 cursor-pointer"
              />
              <span className="font-bold text-blue-900">
                Selecionar Todos ({irmaosFiltrados.length} irmãos)
              </span>
            </label>
          </div>

          {/* Lista de Irmãos */}
          <div className="border-2 border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {irmaosFiltrados.map(irmao => (
                <label
                  key={irmao.id}
                  className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${
                    irmaosSelecionados.includes(irmao.id)
                      ? 'bg-blue-50 border-blue-400'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={irmaosSelecionados.includes(irmao.id)}
                    onChange={() => toggleIrmao(irmao.id)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{irmao.nome}</p>
                    <p className="text-xs text-gray-600">CIM: {irmao.cim}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Resumo */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <h4 className="font-bold text-blue-900 mb-3">📊 Resumo</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-blue-700">Irmãos Selecionados</p>
                <p className="text-2xl font-bold text-blue-900">{irmaosSelecionados.length}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700">Itens por Irmão</p>
                <p className="text-2xl font-bold text-blue-900">{itens.length}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700">Total de Lançamentos</p>
                <p className="text-2xl font-bold text-blue-900">{quantidadeLancamentos}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between gap-3 mt-6">
            <button
              onClick={voltarEtapa}
              className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              ← Voltar
            </button>
            <button
              onClick={proximaEtapa}
              disabled={irmaosSelecionados.length === 0}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Próximo: Ver Resumo →
            </button>
          </div>
        </div>
      )}

      {/* ETAPA 3: RESUMO */}
      {etapa === 3 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-6">📊 Resumo Final - Confirme os Dados</h3>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200 text-center">
              <p className="text-sm text-blue-700 mb-1">Irmãos</p>
              <p className="text-4xl font-bold text-blue-900">{irmaosSelecionados.length}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200 text-center">
              <p className="text-sm text-green-700 mb-1">Itens</p>
              <p className="text-4xl font-bold text-green-900">{itens.length}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200 text-center">
              <p className="text-sm text-purple-700 mb-1">Lançamentos</p>
              <p className="text-4xl font-bold text-purple-900">{quantidadeLancamentos}</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg border-2 border-yellow-200 text-center">
              <p className="text-sm text-yellow-700 mb-1">Valor Total</p>
              <p className="text-2xl font-bold text-yellow-900">{formatarMoeda(totalLancamentos)}</p>
            </div>
          </div>

          {/* Detalhes dos Itens */}
          <div className="mb-6 p-4 border-2 border-gray-200 rounded-lg">
            <h4 className="font-bold text-gray-800 mb-3 text-lg">📝 Itens que serão lançados:</h4>
            <div className="space-y-3">
              {itens.map((item, index) => {
                const categoria = categorias.find(c => c.id === item.categoria_id);
                return (
                  <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-800 mb-1">
                      {index + 1}. {item.descricao}
                    </p>
                    <div className="text-sm text-gray-600 flex flex-wrap gap-4">
                      <span>📂 {categoria?.nome}</span>
                      <span>💰 {formatarMoeda(item.valor)}</span>
                      <span>📅 Venc: {new Date(item.data_vencimento).toLocaleDateString('pt-BR')}</span>
                      {item.parcelas > 1 && (
                        <span className="font-medium text-blue-600">
                          🔢 {item.parcelas}x de {formatarMoeda(parseFloat(item.valor) / item.parcelas)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Irmãos Selecionados */}
          <div className="mb-6 p-4 border-2 border-gray-200 rounded-lg">
            <h4 className="font-bold text-gray-800 mb-3 text-lg">
              👥 Irmãos que receberão os lançamentos ({irmaosSelecionados.length}):
            </h4>
            <div className="flex flex-wrap gap-2">
              {irmaosSelecionados.slice(0, 20).map(id => {
                const irmao = irmaos.find(i => i.id === id);
                return (
                  <span key={id} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {irmao?.nome}
                  </span>
                );
              })}
              {irmaosSelecionados.length > 20 && (
                <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-medium">
                  +{irmaosSelecionados.length - 20} mais...
                </span>
              )}
            </div>
          </div>

          {/* Alerta Final */}
          <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg mb-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h4 className="font-bold text-yellow-900 mb-2">Atenção - Confirme antes de continuar!</h4>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• Serão criados <strong>{quantidadeLancamentos} lançamentos</strong> no sistema</li>
                  <li>• Cada irmão receberá <strong>{itens.length} {itens.length === 1 ? 'item' : 'itens'}</strong> no valor de <strong>{formatarMoeda(totalItens)}</strong></li>
                  <li>• O valor total movimentado será de <strong>{formatarMoeda(totalLancamentos)}</strong></li>
                  <li>• Esta ação <strong>NÃO PODE SER DESFEITA</strong> facilmente</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <button
              onClick={voltarEtapa}
              disabled={loading}
              className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium disabled:opacity-50"
            >
              ← Voltar
            </button>
            <button
              onClick={salvarLancamentos}
              disabled={loading}
              className="px-10 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Criando Lançamentos...' : '✅ Confirmar e Criar Todos'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
