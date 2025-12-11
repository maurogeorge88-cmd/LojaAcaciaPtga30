/**
 * MÓDULO DE CARIDADE
 * Controle de Famílias Carentes e Ajudas
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function Caridade({ permissoes, showSuccess, showError }) {
  // Estados
  const [familias, setFamilias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [familiaEditando, setFamiliaEditando] = useState(null);
  
  // Modal de visualização
  const [modalFamilia, setModalFamilia] = useState(null);
  const [ajudasFamilia, setAjudasFamilia] = useState([]);
  
  // Modal de nova ajuda
  const [modalNovaAjuda, setModalNovaAjuda] = useState(false);
  const [familiaParaAjuda, setFamiliaParaAjuda] = useState(null);
  const [modoEdicaoAjuda, setModoEdicaoAjuda] = useState(false);
  const [ajudaEditando, setAjudaEditando] = useState(null);

  // Formulário família
  const [familiaForm, setFamiliaForm] = useState({
    nome_marido: '',
    nome_esposa: '',
    tem_filhos: false,
    quantidade_filhos: 0,
    endereco: '',
    cidade: '',
    estado: 'MT',
    cep: '',
    telefone: '',
    marido_empregado: false,
    esposa_empregada: false,
    profissao_marido: '',
    profissao_esposa: '',
    descricao_situacao: '',
    observacoes: '',
    ativa: true
  });

  // Formulário ajuda
  const [ajudaForm, setAjudaForm] = useState({
    data_ajuda: new Date().toISOString().split('T')[0],
    tipo_ajuda: 'Cesta Básica',
    descricao: '',
    valor_estimado: '',
    quantidade: '',
    responsavel_nome: ''
  });

  // Busca
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('ativas');

  useEffect(() => {
    carregarFamilias();
  }, []);

  const carregarFamilias = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('familias_carentes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFamilias(data || []);
    } catch (error) {
      console.error('Erro ao carregar famílias:', error);
      showError('Erro ao carregar famílias');
    } finally {
      setLoading(false);
    }
  };

  const carregarAjudas = async (familiaId) => {
    try {
      const { data, error } = await supabase
        .from('ajudas_caridade')
        .select('*')
        .eq('familia_id', familiaId)
        .order('data_ajuda', { ascending: false });

      if (error) throw error;
      setAjudasFamilia(data || []);
    } catch (error) {
      console.error('Erro ao carregar ajudas:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (modoEdicao) {
        const { error } = await supabase
          .from('familias_carentes')
          .update(familiaForm)
          .eq('id', familiaEditando.id);

        if (error) throw error;
        showSuccess('Família atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('familias_carentes')
          .insert([familiaForm]);

        if (error) throw error;
        showSuccess('Família cadastrada com sucesso!');
      }

      limparFormulario();
      carregarFamilias();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showError('Erro ao salvar família');
    }
  };

  const handleSubmitAjuda = async (e) => {
    e.preventDefault();
    
    try {
      if (modoEdicaoAjuda) {
        // EDITAR ajuda existente
        const { error } = await supabase
          .from('ajudas_caridade')
          .update(ajudaForm)
          .eq('id', ajudaEditando.id);

        if (error) throw error;
        showSuccess('Ajuda atualizada com sucesso!');
      } else {
        // CRIAR nova ajuda
        const { error } = await supabase
          .from('ajudas_caridade')
          .insert([{
            ...ajudaForm,
            familia_id: familiaParaAjuda.id
          }]);

        if (error) throw error;
        showSuccess('Ajuda registrada com sucesso!');
      }
      
      setModalNovaAjuda(false);
      limparFormularioAjuda();
      
      // Recarregar ajudas se modal estiver aberto
      if (modalFamilia) {
        carregarAjudas(familiaParaAjuda.id);
      }
    } catch (error) {
      console.error('Erro ao salvar ajuda:', error);
      showError('Erro ao salvar ajuda');
    }
  };

  const handleEditar = (familia) => {
    setFamiliaForm(familia);
    setFamiliaEditando(familia);
    setModoEdicao(true);
    setMostrarForm(true);
  };

  const handleExcluir = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta família?')) return;

    try {
      const { error } = await supabase
        .from('familias_carentes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      showSuccess('Família excluída com sucesso!');
      carregarFamilias();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      showError('Erro ao excluir família');
    }
  };

  const handleExcluirAjuda = async (ajudaId) => {
    if (!confirm('Tem certeza que deseja excluir esta ajuda?')) return;

    try {
      const { error } = await supabase
        .from('ajudas_caridade')
        .delete()
        .eq('id', ajudaId);

      if (error) throw error;
      
      showSuccess('Ajuda excluída com sucesso!');
      carregarAjudas(modalFamilia.id);
    } catch (error) {
      console.error('Erro ao excluir ajuda:', error);
      showError('Erro ao excluir ajuda');
    }
  };

  const handleEditarAjuda = (ajuda) => {
    setAjudaForm({
      data_ajuda: ajuda.data_ajuda,
      tipo_ajuda: ajuda.tipo_ajuda,
      descricao: ajuda.descricao || '',
      valor_estimado: ajuda.valor_estimado || '',
      quantidade: ajuda.quantidade || '',
      responsavel_nome: ajuda.responsavel_nome || ''
    });
    setAjudaEditando(ajuda);
    setModoEdicaoAjuda(true);
    setFamiliaParaAjuda(modalFamilia);
    setModalNovaAjuda(true);
  };

  const handleVisualizarFamilia = async (familia) => {
    setModalFamilia(familia);
    await carregarAjudas(familia.id);
  };

  const limparFormulario = () => {
    setFamiliaForm({
      nome_marido: '',
      nome_esposa: '',
      tem_filhos: false,
      quantidade_filhos: 0,
      endereco: '',
      cidade: '',
      estado: 'MT',
      cep: '',
      telefone: '',
      marido_empregado: false,
      esposa_empregada: false,
      profissao_marido: '',
      profissao_esposa: '',
      descricao_situacao: '',
      observacoes: '',
      ativa: true
    });
    setModoEdicao(false);
    setFamiliaEditando(null);
    setMostrarForm(false);
  };

  const limparFormularioAjuda = () => {
    setAjudaForm({
      data_ajuda: new Date().toISOString().split('T')[0],
      tipo_ajuda: 'Cesta Básica',
      descricao: '',
      valor_estimado: '',
      quantidade: '',
      responsavel_nome: ''
    });
    setModoEdicaoAjuda(false);
    setAjudaEditando(null);
  };

  const abrirModalAjuda = (familia) => {
    setFamiliaParaAjuda(familia);
    limparFormularioAjuda();
    setModalNovaAjuda(true);
  };

  // Filtrar famílias
  const familiasFiltradas = familias.filter(f => {
    const matchSearch = 
      f.nome_marido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.nome_esposa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.endereco?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchStatus = 
      filtroStatus === 'todas' ? true :
      filtroStatus === 'ativas' ? f.ativa :
      !f.ativa;

    return matchSearch && matchStatus;
  });

  // Calcular totais
  const totalFamilias = familias.length;
  const familiasAtivas = familias.filter(f => f.ativa).length;
  const totalPessoas = familias.reduce((acc, f) => {
    let total = 0;
    if (f.nome_marido) total++;
    if (f.nome_esposa) total++;
    if (f.tem_filhos) total += f.quantidade_filhos || 0;
    return acc + total;
  }, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">❤️ Caridade</h2>
            <p className="text-purple-100">Controle de Famílias Carentes</p>
          </div>
          {permissoes?.pode_editar_caridade && (
            <button
              onClick={() => {
                limparFormulario();
                setMostrarForm(!mostrarForm);
              }}
              className="px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-semibold"
            >
              {mostrarForm ? '✖️ Fechar' : '➕ Nova Família'}
            </button>
          )}
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total de Famílias</p>
              <p className="text-3xl font-bold text-purple-600">{totalFamilias}</p>
            </div>
            <div className="text-4xl">👨‍👩‍👧‍👦</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Famílias Ativas</p>
              <p className="text-3xl font-bold text-green-600">{familiasAtivas}</p>
            </div>
            <div className="text-4xl">✅</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total de Pessoas</p>
              <p className="text-3xl font-bold text-blue-600">{totalPessoas}</p>
            </div>
            <div className="text-4xl">👥</div>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO */}
      {(mostrarForm && permissoes?.pode_editar_caridade) && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {modoEdicao ? '✏️ Editar Família' : '➕ Cadastrar Nova Família'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados do Casal */}
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-3">👫 Dados do Casal</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Marido</label>
                  <input
                    type="text"
                    value={familiaForm.nome_marido}
                    onChange={(e) => setFamiliaForm({ ...familiaForm, nome_marido: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Esposa</label>
                  <input
                    type="text"
                    value={familiaForm.nome_esposa}
                    onChange={(e) => setFamiliaForm({ ...familiaForm, nome_esposa: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Filhos */}
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-3">👶 Filhos</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={familiaForm.tem_filhos}
                    onChange={(e) => setFamiliaForm({ ...familiaForm, tem_filhos: e.target.checked })}
                    className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <label className="text-sm font-medium text-gray-700">Tem filhos?</label>
                </div>

                {familiaForm.tem_filhos && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade de Filhos</label>
                    <input
                      type="number"
                      min="0"
                      value={familiaForm.quantidade_filhos}
                      onChange={(e) => setFamiliaForm({ ...familiaForm, quantidade_filhos: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Endereço */}
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-3">📍 Endereço</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Endereço Completo *</label>
                  <input
                    type="text"
                    value={familiaForm.endereco}
                    onChange={(e) => setFamiliaForm({ ...familiaForm, endereco: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={familiaForm.cidade}
                    onChange={(e) => setFamiliaForm({ ...familiaForm, cidade: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <input
                    type="text"
                    value={familiaForm.estado}
                    onChange={(e) => setFamiliaForm({ ...familiaForm, estado: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    maxLength="2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                  <input
                    type="text"
                    value={familiaForm.cep}
                    onChange={(e) => setFamiliaForm({ ...familiaForm, cep: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={familiaForm.telefone}
                    onChange={(e) => setFamiliaForm({ ...familiaForm, telefone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Situação de Emprego */}
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-3">💼 Situação de Emprego</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={familiaForm.marido_empregado}
                      onChange={(e) => setFamiliaForm({ ...familiaForm, marido_empregado: e.target.checked })}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <label className="text-sm font-medium text-gray-700">Marido empregado?</label>
                  </div>
                  {familiaForm.marido_empregado && (
                    <input
                      type="text"
                      placeholder="Profissão do marido"
                      value={familiaForm.profissao_marido}
                      onChange={(e) => setFamiliaForm({ ...familiaForm, profissao_marido: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={familiaForm.esposa_empregada}
                      onChange={(e) => setFamiliaForm({ ...familiaForm, esposa_empregada: e.target.checked })}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <label className="text-sm font-medium text-gray-700">Esposa empregada?</label>
                  </div>
                  {familiaForm.esposa_empregada && (
                    <input
                      type="text"
                      placeholder="Profissão da esposa"
                      value={familiaForm.profissao_esposa}
                      onChange={(e) => setFamiliaForm({ ...familiaForm, profissao_esposa: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Descrição da Situação */}
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-3">📝 Situação Familiar</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição da Situação *</label>
                  <textarea
                    value={familiaForm.descricao_situacao}
                    onChange={(e) => setFamiliaForm({ ...familiaForm, descricao_situacao: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows="4"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea
                    value={familiaForm.observacoes}
                    onChange={(e) => setFamiliaForm({ ...familiaForm, observacoes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows="3"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={familiaForm.ativa}
                    onChange={(e) => setFamiliaForm({ ...familiaForm, ativa: e.target.checked })}
                    className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <label className="text-sm font-medium text-gray-700">Família ativa (recebendo ajuda atualmente)</label>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
              >
                {modoEdicao ? '💾 Atualizar' : '💾 Cadastrar'}
              </button>

              <button
                type="button"
                onClick={limparFormulario}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                ❌ Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTROS E BUSCA */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="🔍 Buscar por nome ou endereço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          />

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="todas">Todas</option>
            <option value="ativas">Ativas</option>
            <option value="inativas">Inativas</option>
          </select>
        </div>
      </div>

      {/* LISTA DE FAMÍLIAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {familiasFiltradas.map((familia) => (
          <div
            key={familia.id}
            className={`bg-white rounded-lg shadow-lg overflow-hidden border-l-4 ${
              familia.ativa ? 'border-green-500' : 'border-gray-400'
            }`}
          >
            <div className="p-6">
              {/* Status */}
              <div className="flex items-center justify-between mb-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  familia.ativa ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {familia.ativa ? '✅ Ativa' : '⏸️ Inativa'}
                </span>
              </div>

              {/* Nomes */}
              <div className="space-y-2 mb-4">
                {familia.nome_marido && (
                  <div className="flex items-center gap-2 text-gray-800">
                    <span className="text-lg">👨</span>
                    <span className="font-semibold">{familia.nome_marido}</span>
                  </div>
                )}
                {familia.nome_esposa && (
                  <div className="flex items-center gap-2 text-gray-800">
                    <span className="text-lg">👩</span>
                    <span className="font-semibold">{familia.nome_esposa}</span>
                  </div>
                )}
              </div>

              {/* Filhos */}
              {familia.tem_filhos && (
                <div className="flex items-center gap-2 text-gray-600 mb-3">
                  <span>👶</span>
                  <span className="text-sm">{familia.quantidade_filhos} {familia.quantidade_filhos === 1 ? 'filho' : 'filhos'}</span>
                </div>
              )}

              {/* Endereço */}
              <div className="text-gray-600 text-sm mb-3">
                📍 {familia.endereco}
                {familia.cidade && `, ${familia.cidade}`}
                {familia.estado && `-${familia.estado}`}
              </div>

              {/* Situação de emprego */}
              <div className="flex gap-2 mb-4">
                {!familia.marido_empregado && !familia.esposa_empregada && (
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                    ⚠️ Ambos desempregados
                  </span>
                )}
                {familia.marido_empregado && familia.esposa_empregada && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                    ✅ Ambos empregados
                  </span>
                )}
                {(familia.marido_empregado || familia.esposa_empregada) && 
                 !(familia.marido_empregado && familia.esposa_empregada) && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                    ⚠️ Emprego parcial
                  </span>
                )}
              </div>

              {/* Situação */}
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {familia.descricao_situacao}
              </p>

              {/* Botões */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleVisualizarFamilia(familia)}
                  className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                  👁️ Ver Detalhes
                </button>

                {permissoes?.pode_editar_caridade && (
                  <>
                    <button
                      onClick={() => abrirModalAjuda(familia)}
                      className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                      title="Registrar Ajuda"
                    >
                      ➕
                    </button>

                    <button
                      onClick={() => handleEditar(familia)}
                      className="px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                      title="Editar"
                    >
                      ✏️
                    </button>

                    <button
                      onClick={() => handleExcluir(familia.id)}
                      className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      title="Excluir"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mensagem quando não há resultados */}
      {familiasFiltradas.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-4">❤️</div>
          <p className="text-gray-600">Nenhuma família encontrada</p>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO COMPLETA */}
      {modalFamilia && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-purple-600 text-white p-6 rounded-t-lg">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold">Detalhes da Família</h3>
                <button
                  onClick={() => setModalFamilia(null)}
                  className="text-white hover:bg-purple-700 rounded-full p-2"
                >
                  ✖️
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Dados da Família */}
              <div>
                <h4 className="text-lg font-bold text-gray-800 mb-3">👫 Família</h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  {modalFamilia.nome_marido && (
                    <p><strong>Marido:</strong> {modalFamilia.nome_marido}</p>
                  )}
                  {modalFamilia.nome_esposa && (
                    <p><strong>Esposa:</strong> {modalFamilia.nome_esposa}</p>
                  )}
                  {modalFamilia.tem_filhos && (
                    <p><strong>Filhos:</strong> {modalFamilia.quantidade_filhos}</p>
                  )}
                  <p><strong>Endereço:</strong> {modalFamilia.endereco}, {modalFamilia.cidade}-{modalFamilia.estado}</p>
                  {modalFamilia.telefone && (
                    <p><strong>Telefone:</strong> {modalFamilia.telefone}</p>
                  )}
                </div>
              </div>

              {/* Situação de Emprego */}
              <div>
                <h4 className="text-lg font-bold text-gray-800 mb-3">💼 Situação de Emprego</h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p>
                    <strong>Marido:</strong> {modalFamilia.marido_empregado ? `✅ Empregado (${modalFamilia.profissao_marido || 'N/I'})` : '❌ Desempregado'}
                  </p>
                  <p>
                    <strong>Esposa:</strong> {modalFamilia.esposa_empregada ? `✅ Empregada (${modalFamilia.profissao_esposa || 'N/I'})` : '❌ Desempregada'}
                  </p>
                </div>
              </div>

              {/* Situação Familiar */}
              <div>
                <h4 className="text-lg font-bold text-gray-800 mb-3">📝 Situação Familiar</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700">{modalFamilia.descricao_situacao}</p>
                  {modalFamilia.observacoes && (
                    <>
                      <hr className="my-3" />
                      <p className="text-gray-600 text-sm"><strong>Observações:</strong> {modalFamilia.observacoes}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Histórico de Ajudas */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-lg font-bold text-gray-800">🎁 Histórico de Ajudas</h4>
                  {permissoes?.pode_editar_caridade && (
                    <button
                      onClick={() => {
                        setFamiliaParaAjuda(modalFamilia);
                        setModalNovaAjuda(true);
                      }}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                    >
                      ➕ Nova Ajuda
                    </button>
                  )}
                </div>

                {ajudasFamilia.length === 0 ? (
                  <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-600">
                    Nenhuma ajuda registrada ainda
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ajudasFamilia.map((ajuda) => (
                      <div key={ajuda.id} className="bg-gray-50 p-4 rounded-lg border-l-4 border-green-500">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-gray-800">{ajuda.tipo_ajuda}</span>
                              {ajuda.quantidade && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                  {ajuda.quantidade}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              📅 {new Date(ajuda.data_ajuda + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </p>
                            {ajuda.descricao && (
                              <p className="text-sm text-gray-700 mb-2">{ajuda.descricao}</p>
                            )}
                            {ajuda.valor_estimado && (
                              <p className="text-sm text-gray-600">
                                💰 Valor estimado: R$ {parseFloat(ajuda.valor_estimado).toFixed(2)}
                              </p>
                            )}
                            {ajuda.responsavel_nome && (
                              <p className="text-xs text-gray-500 mt-1">
                                👤 Responsável: {ajuda.responsavel_nome}
                              </p>
                            )}
                          </div>
                          {permissoes?.pode_editar_caridade && (
                            <div className="flex gap-2 ml-2">
                              <button
                                onClick={() => handleEditarAjuda(ajuda)}
                                className="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-xs"
                                title="Editar ajuda"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleExcluirAjuda(ajuda.id)}
                                className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                                title="Excluir ajuda"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE NOVA AJUDA */}
      {modalNovaAjuda && familiaParaAjuda && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className={`${modoEdicaoAjuda ? 'bg-yellow-600' : 'bg-green-600'} text-white p-6 rounded-t-lg`}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">
                  {modoEdicaoAjuda ? '✏️ Editar Ajuda' : '➕ Registrar Nova Ajuda'}
                </h3>
                <button
                  onClick={() => {
                    setModalNovaAjuda(false);
                    limparFormularioAjuda();
                  }}
                  className={`text-white ${modoEdicaoAjuda ? 'hover:bg-yellow-700' : 'hover:bg-green-700'} rounded-full p-2`}
                >
                  ✖️
                </button>
              </div>
              <p className={`${modoEdicaoAjuda ? 'text-yellow-100' : 'text-green-100'} text-sm mt-2`}>
                Para: {familiaParaAjuda.nome_marido || familiaParaAjuda.nome_esposa}
              </p>
            </div>

            <form onSubmit={handleSubmitAjuda} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data da Ajuda *</label>
                  <input
                    type="date"
                    value={ajudaForm.data_ajuda}
                    onChange={(e) => setAjudaForm({ ...ajudaForm, data_ajuda: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Ajuda *</label>
                  <select
                    value={ajudaForm.tipo_ajuda}
                    onChange={(e) => setAjudaForm({ ...ajudaForm, tipo_ajuda: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="Cesta Básica">Cesta Básica</option>
                    <option value="Alimentos">Alimentos</option>
                    <option value="Roupas">Roupas</option>
                    <option value="Medicamentos">Medicamentos</option>
                    <option value="Material Escolar">Material Escolar</option>
                    <option value="Material de Construção">Material de Construção</option>
                    <option value="Móveis">Móveis</option>
                    <option value="Eletrodomésticos">Eletrodomésticos</option>
                    <option value="Auxílio Financeiro">Auxílio Financeiro</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                  <input
                    type="text"
                    placeholder="Ex: 1 cesta, 5kg arroz..."
                    value={ajudaForm.quantidade}
                    onChange={(e) => setAjudaForm({ ...ajudaForm, quantidade: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Estimado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={ajudaForm.valor_estimado}
                    onChange={(e) => setAjudaForm({ ...ajudaForm, valor_estimado: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <textarea
                    value={ajudaForm.descricao}
                    onChange={(e) => setAjudaForm({ ...ajudaForm, descricao: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    rows="3"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsável pela Entrega</label>
                  <input
                    type="text"
                    placeholder="Nome de quem entregou/organizou"
                    value={ajudaForm.responsavel_nome}
                    onChange={(e) => setAjudaForm({ ...ajudaForm, responsavel_nome: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className={`flex-1 px-6 py-2 ${modoEdicaoAjuda ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-lg font-semibold`}
                >
                  {modoEdicaoAjuda ? '💾 Atualizar Ajuda' : '💾 Registrar Ajuda'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModalNovaAjuda(false);
                    limparFormularioAjuda();
                  }}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
