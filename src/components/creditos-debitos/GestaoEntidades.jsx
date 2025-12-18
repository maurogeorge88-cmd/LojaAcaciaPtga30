import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';

export default function GestaoEntidades({ showSuccess, showError }) {
  const [entidades, setEntidades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  // Formulário
  const [formData, setFormData] = useState({
    tipo: 'loja',
    nome: '',
    cpf_cnpj: '',
    telefone: '',
    email: '',
    endereco: '',
    observacoes: ''
  });

  useEffect(() => {
    carregarEntidades();
  }, []);

  const carregarEntidades = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('entidades_financeiras')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setEntidades(data || []);
    } catch (error) {
      console.error('Erro ao carregar entidades:', error);
      showError('Erro ao carregar entidades');
    } finally {
      setLoading(false);
    }
  };

  const abrirModalNovo = () => {
    setFormData({
      tipo: 'loja',
      nome: '',
      cpf_cnpj: '',
      telefone: '',
      email: '',
      endereco: '',
      observacoes: ''
    });
    setModoEdicao(false);
    setModalAberto(true);
  };

  const abrirModalEdicao = (entidade) => {
    setFormData({
      id: entidade.id,
      tipo: entidade.tipo,
      nome: entidade.nome,
      cpf_cnpj: entidade.cpf_cnpj || '',
      telefone: entidade.telefone || '',
      email: entidade.email || '',
      endereco: entidade.endereco || '',
      observacoes: entidade.observacoes || ''
    });
    setModoEdicao(true);
    setModalAberto(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.nome.trim()) {
        showError('Nome é obrigatório');
        setLoading(false);
        return;
      }

      if (modoEdicao) {
        // Atualizar
        const { error } = await supabase
          .from('entidades_financeiras')
          .update({
            tipo: formData.tipo,
            nome: formData.nome.trim(),
            cpf_cnpj: formData.cpf_cnpj.trim() || null,
            telefone: formData.telefone.trim() || null,
            email: formData.email.trim() || null,
            endereco: formData.endereco.trim() || null,
            observacoes: formData.observacoes.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', formData.id);

        if (error) throw error;
        showSuccess('Entidade atualizada com sucesso!');
      } else {
        // Criar
        const { error } = await supabase
          .from('entidades_financeiras')
          .insert([{
            tipo: formData.tipo,
            nome: formData.nome.trim(),
            cpf_cnpj: formData.cpf_cnpj.trim() || null,
            telefone: formData.telefone.trim() || null,
            email: formData.email.trim() || null,
            endereco: formData.endereco.trim() || null,
            observacoes: formData.observacoes.trim() || null
          }]);

        if (error) throw error;
        showSuccess('Entidade cadastrada com sucesso!');
      }

      setModalAberto(false);
      carregarEntidades();
    } catch (error) {
      console.error('Erro ao salvar entidade:', error);
      showError('Erro ao salvar entidade');
    } finally {
      setLoading(false);
    }
  };

  const desativarEntidade = async (id, nome) => {
    if (!window.confirm(`Deseja realmente desativar "${nome}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('entidades_financeiras')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      showSuccess('Entidade desativada com sucesso!');
      carregarEntidades();
    } catch (error) {
      console.error('Erro ao desativar entidade:', error);
      showError('Erro ao desativar entidade');
    }
  };

  // Filtrar entidades
  const entidadesFiltradas = entidades.filter(e => {
    const matchBusca = e.nome.toLowerCase().includes(busca.toLowerCase()) ||
                       e.cpf_cnpj?.toLowerCase().includes(busca.toLowerCase());
    const matchTipo = filtroTipo === 'todos' || e.tipo === filtroTipo;
    return matchBusca && matchTipo;
  });

  const getTipoLabel = (tipo) => {
    const tipos = {
      'loja': '🏛️ Loja',
      'fornecedor': '📦 Fornecedor',
      'pessoa_fisica': '👤 Pessoa Física',
      'outro': '📋 Outro'
    };
    return tipos[tipo] || tipo;
  };

  const getTipoBadgeColor = (tipo) => {
    const cores = {
      'loja': 'bg-blue-100 text-blue-800',
      'fornecedor': 'bg-green-100 text-green-800',
      'pessoa_fisica': 'bg-purple-100 text-purple-800',
      'outro': 'bg-gray-100 text-gray-800'
    };
    return cores[tipo] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">🏢 Gestão de Entidades</h2>
          <p className="text-gray-600 mt-1">Cadastro de lojas, fornecedores e terceiros</p>
        </div>
        <button
          onClick={abrirModalNovo}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition-all flex items-center gap-2"
        >
          ➕ Nova Entidade
        </button>
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Busca */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              🔍 Buscar
            </label>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome ou CPF/CNPJ..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filtro por Tipo */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              📂 Tipo
            </label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todos</option>
              <option value="loja">🏛️ Lojas</option>
              <option value="fornecedor">📦 Fornecedores</option>
              <option value="pessoa_fisica">👤 Pessoas Físicas</option>
              <option value="outro">📋 Outros</option>
            </select>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Mostrando <strong>{entidadesFiltradas.length}</strong> de <strong>{entidades.length}</strong> entidades
        </div>
      </div>

      {/* LISTA DE ENTIDADES */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando...</p>
          </div>
        </div>
      ) : entidadesFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <div className="text-6xl mb-4">🏢</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Nenhuma entidade encontrada</h3>
          <p className="text-gray-600 mb-6">
            {entidades.length === 0 
              ? 'Comece cadastrando sua primeira entidade'
              : 'Tente ajustar os filtros de busca'}
          </p>
          {entidades.length === 0 && (
            <button
              onClick={abrirModalNovo}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
            >
              ➕ Cadastrar Primeira Entidade
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {entidadesFiltradas.map(entidade => (
            <div key={entidade.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  {/* Informações */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-800">{entidade.nome}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTipoBadgeColor(entidade.tipo)}`}>
                        {getTipoLabel(entidade.tipo)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                      {entidade.cpf_cnpj && (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">📋 CPF/CNPJ:</span>
                          {entidade.cpf_cnpj}
                        </div>
                      )}
                      {entidade.telefone && (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">📞 Telefone:</span>
                          {entidade.telefone}
                        </div>
                      )}
                      {entidade.email && (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">✉️ Email:</span>
                          {entidade.email}
                        </div>
                      )}
                      {entidade.endereco && (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">📍 Endereço:</span>
                          {entidade.endereco}
                        </div>
                      )}
                    </div>

                    {entidade.observacoes && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                        <span className="font-semibold text-yellow-800">💡 Obs:</span>
                        <span className="text-yellow-700 ml-2">{entidade.observacoes}</span>
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => abrirModalEdicao(entidade)}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg font-semibold transition-all"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => desativarEntidade(entidade.id, entidade.nome)}
                      className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold transition-all"
                    >
                      🗑️ Desativar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE CADASTRO/EDIÇÃO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
              <h3 className="text-2xl font-bold">
                {modoEdicao ? '✏️ Editar Entidade' : '➕ Nova Entidade'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="loja">🏛️ Loja Maçônica</option>
                  <option value="fornecedor">📦 Fornecedor</option>
                  <option value="pessoa_fisica">👤 Pessoa Física</option>
                  <option value="outro">📋 Outro</option>
                </select>
              </div>

              {/* Nome */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome da entidade"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* CPF/CNPJ */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  CPF/CNPJ
                </label>
                <input
                  type="text"
                  value={formData.cpf_cnpj}
                  onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Telefone e Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Endereço */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Endereço
                </label>
                <input
                  type="text"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  placeholder="Rua, número, cidade, estado"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Informações adicionais..."
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-all"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Salvando...' : (modoEdicao ? 'Atualizar' : 'Cadastrar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
