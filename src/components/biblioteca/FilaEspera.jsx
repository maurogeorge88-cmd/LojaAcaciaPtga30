/**
 * FILA DE ESPERA - BIBLIOTECA
 * Controle de Reservas e Espera por Livros
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function FilaEspera({ permissoes, showSuccess, showError }) {
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState([]);
  const [livros, setLivros] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  
  // Modal adicionar
  const [modalAdicionar, setModalAdicionar] = useState(false);
  const [filaForm, setFilaForm] = useState({
    livro_id: '',
    irmao_id: '',
    observacoes: ''
  });

  // Filtros
  const [filtroLivro, setFiltroLivro] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('aguardando');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    await Promise.all([
      carregarFilas(),
      carregarLivros(),
      carregarIrmaos()
    ]);
    setLoading(false);
  };

  const carregarFilas = async () => {
    try {
      const { data, error } = await supabase
        .from('vw_fila_espera_completa')
        .select('*')
        .order('livro_id')
        .order('posicao');

      if (error) throw error;
      setFilas(data || []);
    } catch (error) {
      console.error('Erro ao carregar filas:', error);
      showError('Erro ao carregar fila de espera');
    }
  };

  const carregarLivros = async () => {
    try {
      const { data, error } = await supabase
        .from('livros')
        .select('id, titulo, autor')
        .order('titulo');

      if (error) throw error;
      setLivros(data || []);
    } catch (error) {
      console.error('Erro ao carregar livros:', error);
    }
  };

  const carregarIrmaos = async () => {
    try {
      const { data, error } = await supabase
        .from('irmaos')
        .select('id, nome, cim')
        .order('nome');

      if (error) throw error;
      setIrmaos(data || []);
    } catch (error) {
      console.error('Erro ao carregar irmãos:', error);
    }
  };

  const handleAdicionar = async (e) => {
    e.preventDefault();

    if (!filaForm.livro_id || !filaForm.irmao_id) {
      showError('Selecione o livro e o irmão');
      return;
    }

    try {
      // Verificar se já está na fila
      const { data: jaExiste } = await supabase
        .from('fila_espera_livros')
        .select('id')
        .eq('livro_id', filaForm.livro_id)
        .eq('irmao_id', filaForm.irmao_id)
        .eq('status', 'aguardando')
        .single();

      if (jaExiste) {
        showError('Este irmão já está na fila de espera deste livro');
        return;
      }

      // Calcular próxima posição
      const { data: maxPosicao } = await supabase
        .from('fila_espera_livros')
        .select('posicao')
        .eq('livro_id', filaForm.livro_id)
        .eq('status', 'aguardando')
        .order('posicao', { ascending: false })
        .limit(1)
        .single();

      const proximaPosicao = maxPosicao ? maxPosicao.posicao + 1 : 1;

      // Inserir
      const { error } = await supabase
        .from('fila_espera_livros')
        .insert([{
          ...filaForm,
          posicao: proximaPosicao,
          status: 'aguardando'
        }]);

      if (error) throw error;

      showSuccess('Irmão adicionado à fila de espera!');
      setModalAdicionar(false);
      limparForm();
      carregarFilas();
    } catch (error) {
      console.error('Erro ao adicionar:', error);
      showError('Erro ao adicionar à fila');
    }
  };

  const handleAtender = async (filaId, irmaoNome) => {
    if (!confirm(`Marcar como atendido: ${irmaoNome}?`)) return;

    try {
      const { error } = await supabase
        .from('fila_espera_livros')
        .update({
          status: 'atendido',
          data_atendimento: new Date().toISOString(),
          atendido_por: 'Sistema' // Pode pegar do usuário logado
        })
        .eq('id', filaId);

      if (error) throw error;

      showSuccess('Solicitação atendida! Irmão saiu da fila.');
      carregarFilas();
    } catch (error) {
      console.error('Erro ao atender:', error);
      showError('Erro ao atender solicitação');
    }
  };

  const handleCancelar = async (filaId, irmaoNome) => {
    if (!confirm(`Cancelar solicitação de: ${irmaoNome}?`)) return;

    try {
      const { error } = await supabase
        .from('fila_espera_livros')
        .update({ status: 'cancelado' })
        .eq('id', filaId);

      if (error) throw error;

      showSuccess('Solicitação cancelada');
      carregarFilas();
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      showError('Erro ao cancelar solicitação');
    }
  };

  const handleExcluir = async (filaId) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;

    try {
      const { error } = await supabase
        .from('fila_espera_livros')
        .delete()
        .eq('id', filaId);

      if (error) throw error;

      showSuccess('Registro excluído');
      carregarFilas();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      showError('Erro ao excluir registro');
    }
  };

  const limparForm = () => {
    setFilaForm({
      livro_id: '',
      irmao_id: '',
      observacoes: ''
    });
  };

  // Filtrar filas
  const filasFiltradas = filas.filter(f => {
    const matchLivro = filtroLivro === 'todos' || f.livro_id.toString() === filtroLivro;
    const matchStatus = filtroStatus === 'todos' || f.status === filtroStatus;
    return matchLivro && matchStatus;
  });

  // Agrupar por livro
  const filasAgrupadas = filasFiltradas.reduce((acc, fila) => {
    const livroId = fila.livro_id;
    if (!acc[livroId]) {
      acc[livroId] = {
        livro: {
          id: fila.livro_id,
          titulo: fila.livro_titulo,
          autor: fila.livro_autor
        },
        filas: []
      };
    }
    acc[livroId].filas.push(fila);
    return acc;
  }, {});

  // Estatísticas
  const totalAguardando = filas.filter(f => f.status === 'aguardando').length;
  const totalAtendidos = filas.filter(f => f.status === 'atendido').length;
  const livrosComFila = Object.keys(filasAgrupadas).length;

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
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">⏳ Fila de Espera</h2>
            <p className="text-orange-100">Controle de Reservas e Solicitações</p>
          </div>
          {(permissoes?.canEdit || permissoes?.canEditMembers) && (
            <button
              onClick={() => setModalAdicionar(true)}
              className="px-6 py-3 bg-white text-orange-600 rounded-lg hover:bg-orange-50 transition-colors font-semibold"
            >
              ➕ Adicionar à Fila
            </button>
          )}
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Aguardando</p>
              <p className="text-3xl font-bold text-orange-600">{totalAguardando}</p>
            </div>
            <div className="text-4xl">⏳</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Atendidos</p>
              <p className="text-3xl font-bold text-green-600">{totalAtendidos}</p>
            </div>
            <div className="text-4xl">✅</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Livros com Fila</p>
              <p className="text-3xl font-bold text-blue-600">{livrosComFila}</p>
            </div>
            <div className="text-4xl">📚</div>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Livro</label>
            <select
              value={filtroLivro}
              onChange={(e) => setFiltroLivro(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="todos">Todos os livros</option>
              {livros.map(livro => (
                <option key={livro.id} value={livro.id}>
                  {livro.titulo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="aguardando">Aguardando</option>
              <option value="atendido">Atendidos</option>
              <option value="cancelado">Cancelados</option>
              <option value="todos">Todos</option>
            </select>
          </div>
        </div>
      </div>

      {/* LISTA DE FILAS AGRUPADAS POR LIVRO */}
      {Object.keys(filasAgrupadas).length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-4">📚</div>
          <p className="text-gray-600">Nenhuma solicitação encontrada</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(filasAgrupadas).map(({ livro, filas }) => (
            <div key={livro.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* Header do Livro */}
              <div className="bg-orange-600 text-white p-4">
                <h3 className="text-xl font-bold">{livro.titulo}</h3>
                <p className="text-orange-100 text-sm">{livro.autor}</p>
                <p className="text-orange-200 text-xs mt-1">
                  {filas.filter(f => f.status === 'aguardando').length} {filas.filter(f => f.status === 'aguardando').length === 1 ? 'pessoa aguardando' : 'pessoas aguardando'}
                </p>
              </div>

              {/* Lista de Irmãos na Fila */}
              <div className="divide-y">
                {filas.map((fila) => (
                  <div
                    key={fila.id}
                    className={`p-4 ${
                      fila.status === 'aguardando' ? 'bg-white' :
                      fila.status === 'atendido' ? 'bg-green-50' :
                      'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Posição e Status */}
                        <div className="flex items-center gap-3 mb-2">
                          {fila.status === 'aguardando' && (
                            <span className="flex items-center justify-center w-8 h-8 bg-orange-600 text-white rounded-full font-bold text-sm">
                              {fila.posicao}
                            </span>
                          )}
                          
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            fila.status === 'aguardando' ? 'bg-yellow-100 text-yellow-800' :
                            fila.status === 'atendido' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {fila.status === 'aguardando' ? '⏳ Aguardando' :
                             fila.status === 'atendido' ? '✅ Atendido' :
                             '❌ Cancelado'}
                          </span>
                        </div>

                        {/* Nome do Irmão */}
                        <div className="mb-2">
                          <p className="font-semibold text-gray-900">{fila.irmao_nome}</p>
                          <p className="text-sm text-gray-600">CIM: {fila.irmao_cim}</p>
                          {fila.irmao_telefone && (
                            <p className="text-sm text-gray-600">📱 {fila.irmao_telefone}</p>
                          )}
                        </div>

                        {/* Data de Solicitação */}
                        <p className="text-xs text-gray-500">
                          📅 Solicitado em: {new Date(fila.data_solicitacao).toLocaleString('pt-BR')}
                        </p>

                        {/* Data de Atendimento */}
                        {fila.data_atendimento && (
                          <p className="text-xs text-gray-500">
                            ✅ Atendido em: {new Date(fila.data_atendimento).toLocaleString('pt-BR')}
                            {fila.atendido_por && ` por ${fila.atendido_por}`}
                          </p>
                        )}

                        {/* Observações */}
                        {fila.observacoes && (
                          <p className="text-sm text-gray-600 mt-2 italic">
                            💬 {fila.observacoes}
                          </p>
                        )}
                      </div>

                      {/* Botões de Ação */}
                      {(permissoes?.canEdit || permissoes?.canEditMembers) && (
                        <div className="flex gap-2 ml-4">
                          {fila.status === 'aguardando' && (
                            <>
                              <button
                                onClick={() => handleAtender(fila.id, fila.irmao_nome)}
                                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm whitespace-nowrap"
                                title="Marcar como atendido"
                              >
                                ✅ Atender
                              </button>
                              <button
                                onClick={() => handleCancelar(fila.id, fila.irmao_nome)}
                                className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                                title="Cancelar"
                              >
                                ❌
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleExcluir(fila.id)}
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                            title="Excluir registro"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL ADICIONAR À FILA */}
      {modalAdicionar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="bg-orange-600 text-white p-6 rounded-t-lg">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">➕ Adicionar à Fila de Espera</h3>
                <button
                  onClick={() => {
                    setModalAdicionar(false);
                    limparForm();
                  }}
                  className="text-white hover:bg-orange-700 rounded-full p-2"
                >
                  ✖️
                </button>
              </div>
            </div>

            <form onSubmit={handleAdicionar} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Livro *</label>
                <select
                  value={filaForm.livro_id}
                  onChange={(e) => setFilaForm({ ...filaForm, livro_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="">Selecione o livro</option>
                  {livros.map(livro => (
                    <option key={livro.id} value={livro.id}>
                      {livro.titulo} - {livro.autor}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Irmão *</label>
                <select
                  value={filaForm.irmao_id}
                  onChange={(e) => setFilaForm({ ...filaForm, irmao_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="">Selecione o irmão</option>
                  {irmaos.map(irmao => (
                    <option key={irmao.id} value={irmao.id}>
                      {irmao.nome} - CIM: {irmao.cim}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                <textarea
                  value={filaForm.observacoes}
                  onChange={(e) => setFilaForm({ ...filaForm, observacoes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  rows="3"
                  placeholder="Ex: Preciso urgente para estudo"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold"
                >
                  ➕ Adicionar à Fila
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModalAdicionar(false);
                    limparForm();
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
