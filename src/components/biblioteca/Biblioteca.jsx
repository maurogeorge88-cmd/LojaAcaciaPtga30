import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarData } from '../../utils/formatters';
import FilaEspera from './FilaEspera';

const Biblioteca = ({ livros, emprestimos, irmaos, onUpdate, showSuccess, showError, permissoes }) => {
  // Estados de controle
  const [abaAtiva, setAbaAtiva] = useState('livros');
  const [loading, setLoading] = useState(false);

  // NOVOS ESTADOS DE FILTRO
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroGrau, setFiltroGrau] = useState('todos');

  // Estados de livros
  const [livroForm, setLivroForm] = useState({
    titulo: '',
    autor: '',
    categoria: 'Ritualística',
    grau: 'Aprendiz',
    localizacao: '',
    quantidade_total: 1,
    quantidade_disponivel: 1
  });
  const [modoEdicaoLivro, setModoEdicaoLivro] = useState(false);
  const [livroEditando, setLivroEditando] = useState(null);

  // Estados de empréstimos
  const [emprestimoForm, setEmprestimoForm] = useState({
    livro_id: '',
    irmao_id: '',
    data_emprestimo: new Date().toISOString().split('T')[0],
    data_devolucao_prevista: ''
  });
  const [modalEditarPrazo, setModalEditarPrazo] = useState(false);
  const [emprestimoEditando, setEmprestimoEditando] = useState(null);
  const [novoPrazo, setNovoPrazo] = useState('');

  // Limpar formulário de livro
  const limparFormularioLivro = () => {
    setLivroForm({
      titulo: '',
      autor: '',
      categoria: 'Ritualística',
      grau: 'Aprendiz',
      localizacao: '',
      quantidade_total: 1,
      quantidade_disponivel: 1
    });
    setModoEdicaoLivro(false);
    setLivroEditando(null);
  };

  // Salvar livro
  const salvarLivro = async () => {
    if (!livroForm.titulo) {
      showError('O título é obrigatório');
      return;
    }

    setLoading(true);

    try {
      if (modoEdicaoLivro) {
        const { error } = await supabase
          .from('biblioteca_livros')
          .update(livroForm)
          .eq('id', livroEditando.id);

        if (error) throw error;
        showSuccess('Livro atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('biblioteca_livros')
          .insert([livroForm]);

        if (error) throw error;
        showSuccess('Livro cadastrado com sucesso!');
      }

      limparFormularioLivro();
      onUpdate();

    } catch (error) {
      showError('Erro ao salvar livro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Editar livro
  const editarLivro = (livro) => {
    setModoEdicaoLivro(true);
    setLivroEditando(livro);
    setLivroForm({
      titulo: livro.titulo,
      autor: livro.autor || '',
      categoria: livro.categoria,
      grau: livro.grau || 'Aprendiz',
      localizacao: livro.localizacao || '',
      quantidade_total: livro.quantidade_total,
      quantidade_disponivel: livro.quantidade_disponivel
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Excluir livro
  const excluirLivro = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Tem certeza que deseja excluir este livro? Esta ação é irreversível!')) return;

    setLoading(true);
    try {
      // Verificar se há empréstimos ativos deste livro
      const emprestimosAtivosDoLivro = emprestimos.filter(e => e.livro_id === id && e.status === 'emprestado');
      
      if (emprestimosAtivosDoLivro.length > 0) {
        showError('Não é possível excluir este livro pois há empréstimos ativos!');
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('biblioteca_livros')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('Livro excluído com sucesso!');
      onUpdate();

    } catch (error) {
      showError('Erro ao excluir livro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Registrar empréstimo
  const registrarEmprestimo = async () => {
    if (!emprestimoForm.livro_id || !emprestimoForm.irmao_id) {
      showError('Selecione um livro e um irmão');
      return;
    }

    // Validar compatibilidade de grau
    const livro = livros.find(l => l.id === parseInt(emprestimoForm.livro_id));
    const irmao = irmaos.find(i => i.id === parseInt(emprestimoForm.irmao_id));

    if (livro && irmao) {
      // Definir hierarquia de graus
      const hierarquiaGraus = {
        'Aprendiz': 1,
        'Companheiro': 2,
        'Mestre': 3
      };

      // Tentar pegar o grau do irmão (pode estar em grau_maconico ou grau)
      const grauIrmaoTexto = irmao.grau_maconico || irmao.grau || 'Mestre';
      const grauLivro = hierarquiaGraus[livro.grau] || 1;
      const grauIrmao = hierarquiaGraus[grauIrmaoTexto] || 3; // Default: Mestre

      // Irmão precisa ter grau igual ou superior ao do livro
      if (grauIrmao < grauLivro) {
        showError(`❌ Este livro é para o grau "${livro.grau}" e o irmão ${irmao.nome} é "${grauIrmaoTexto}". O grau do livro não é compatível com o grau do irmão.`);
        return;
      }
    }

    setLoading(true);

    try {
      // Calcular data de devolução (15 dias)
      const dataEmprestimo = new Date(emprestimoForm.data_emprestimo);
      const dataDevolucao = new Date(dataEmprestimo);
      dataDevolucao.setDate(dataDevolucao.getDate() + 15);

      const { error } = await supabase
        .from('biblioteca_emprestimos')
        .insert([{
          livro_id: emprestimoForm.livro_id,
          irmao_id: emprestimoForm.irmao_id,
          data_emprestimo: emprestimoForm.data_emprestimo,
          data_devolucao_prevista: dataDevolucao.toISOString().split('T')[0],
          status: 'emprestado'
        }]);

      if (error) throw error;

      // Atualizar quantidade disponível
      if (livro) {
        await supabase
          .from('biblioteca_livros')
          .update({ quantidade_disponivel: livro.quantidade_disponivel - 1 })
          .eq('id', livro.id);
      }

      showSuccess('✅ Empréstimo registrado com sucesso!');
      setEmprestimoForm({
        livro_id: '',
        irmao_id: '',
        data_emprestimo: new Date().toISOString().split('T')[0],
        data_devolucao_prevista: ''
      });
      onUpdate();

    } catch (error) {
      showError('Erro ao registrar empréstimo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Devolver livro
  const devolverLivro = async (emprestimoId, livroId) => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from('biblioteca_emprestimos')
        .update({
          status: 'devolvido',
          data_devolucao_real: new Date().toISOString().split('T')[0]
        })
        .eq('id', emprestimoId);

      if (error) throw error;

      // Atualizar quantidade disponível
      const livro = livros.find(l => l.id === livroId);
      if (livro) {
        await supabase
          .from('biblioteca_livros')
          .update({ quantidade_disponivel: livro.quantidade_disponivel + 1 })
          .eq('id', livroId);
      }

      showSuccess('✅ Devolução registrada com sucesso!');
      onUpdate();

    } catch (error) {
      showError('Erro ao devolver livro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Editar prazo de devolução
  const abrirModalEditarPrazo = (emprestimo) => {
    setEmprestimoEditando(emprestimo);
    setNovoPrazo(emprestimo.data_devolucao_prevista);
    setModalEditarPrazo(true);
  };

  const salvarNovoPrazo = async () => {
    if (!novoPrazo) {
      showError('Informe a nova data de devolução');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('biblioteca_emprestimos')
        .update({ data_devolucao_prevista: novoPrazo })
        .eq('id', emprestimoEditando.id);

      if (error) throw error;

      showSuccess('Prazo atualizado com sucesso!');
      setModalEditarPrazo(false);
      setEmprestimoEditando(null);
      setNovoPrazo('');
      onUpdate();

    } catch (error) {
      showError('Erro ao atualizar prazo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Excluir empréstimo
  const excluirEmprestimo = async (emprestimoId, livroId, status) => {
    if (typeof window !== 'undefined' && !window.confirm('Tem certeza que deseja excluir este empréstimo?')) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('biblioteca_emprestimos')
        .delete()
        .eq('id', emprestimoId);

      if (error) throw error;

      // Se o empréstimo estava ativo, devolver o livro ao estoque
      if (status === 'emprestado') {
        const livro = livros.find(l => l.id === livroId);
        if (livro) {
          await supabase
            .from('biblioteca_livros')
            .update({ quantidade_disponivel: livro.quantidade_disponivel + 1 })
            .eq('id', livroId);
        }
      }

      showSuccess('Empréstimo excluído com sucesso!');
      onUpdate();

    } catch (error) {
      showError('Erro ao excluir empréstimo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Funções auxiliares
  const obterNomeIrmao = (irmaoId) => {
    const irmao = irmaos.find(i => i.id === irmaoId);
    return irmao ? irmao.nome : 'Desconhecido';
  };

  const obterTituloLivro = (livroId) => {
    const livro = livros.find(l => l.id === livroId);
    return livro ? livro.titulo : 'Desconhecido';
  };

  const estaAtrasado = (dataPrevista) => {
    if (!dataPrevista) return false;
    const hoje = new Date();
    const prevista = new Date(dataPrevista);
    return prevista < hoje;
  };

  // ============ FUNÇÃO CORRIGIDA DE DISPONIBILIDADE ============
  const obterQuantidadeDisponivel = (livroId) => {
    const qtdEmprestada = emprestimos.filter(e => e.livro_id === livroId && e.status === 'emprestado').length;
    const livro = livros.find(l => l.id === livroId);
    return livro ? livro.quantidade_total - qtdEmprestada : 0;
  };

  // ============ FILTROS ============
  const aplicarFiltros = (livro) => {
    // Filtro por nome
    if (filtroNome && !livro.titulo.toLowerCase().includes(filtroNome.toLowerCase())) {
      return false;
    }
    // Filtro por grau
    if (filtroGrau !== 'todos' && livro.grau !== filtroGrau) {
      return false;
    }
    return true;
  };

  // ============ AGRUPAR LIVROS POR GRAU ============
  const livrosFiltrados = livros.filter(aplicarFiltros);
  
  const livrosPorGrau = {
    'Aprendiz': livrosFiltrados.filter(l => l.grau === 'Aprendiz'),
    'Companheiro': livrosFiltrados.filter(l => l.grau === 'Companheiro'),
    'Mestre': livrosFiltrados.filter(l => l.grau === 'Mestre')
  };

  // Empréstimos ativos e devolvidos
  const emprestimosAtivos = emprestimos.filter(e => e.status === 'emprestado');
  const emprestimosDevolvidos = emprestimos.filter(e => e.status === 'devolvido');

  // Empréstimos por irmão
  const emprestimosPorIrmao = irmaos
    .map(irmao => {
      const emprestimosDoIrmao = emprestimos.filter(e => e.irmao_id === irmao.id);
      const ativos = emprestimosDoIrmao.filter(e => e.status === 'emprestado').length;
      return {
        irmao,
        emprestimos: emprestimosDoIrmao,
        ativos,
        total: emprestimosDoIrmao.length
      };
    })
    .filter(item => item.total > 0)
    .sort((a, b) => b.ativos - a.ativos);

  // Livros disponíveis para empréstimo
  const livrosDisponiveis = livros.filter(l => obterQuantidadeDisponivel(l.id) > 0);

  return (
    <div className="space-y-6">
      {/* ABAS */}
      <div className="bg-white rounded-xl shadow-md p-2 flex gap-2">
        <button
          onClick={() => setAbaAtiva('livros')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
            abaAtiva === 'livros'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📚 Livros ({livros.length})
        </button>
        <button
          onClick={() => setAbaAtiva('emprestimos')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
            abaAtiva === 'emprestimos'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📖 Empréstimos Ativos ({emprestimosAtivos.length})
        </button>
        <button
          onClick={() => setAbaAtiva('devolvidos')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
            abaAtiva === 'devolvidos'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          ✅ Devolvidos ({emprestimosDevolvidos.length})
        </button>
        <button
          onClick={() => setAbaAtiva('por-irmao')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
            abaAtiva === 'por-irmao'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          👤 Por Irmão
        </button>
        <button
          onClick={() => setAbaAtiva('fila')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
            abaAtiva === 'fila'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          ⏳ Fila de Espera
        </button>
      </div>

      {/* ABA LIVROS */}
      {abaAtiva === 'livros' && (
        <div className="space-y-6">
          {/* FORMULÁRIO CADASTRO/EDIÇÃO */}
          {permissoes?.pode_editar_biblioteca && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
                <h3 className="text-xl font-bold">
                  {modoEdicaoLivro ? '✏️ Editar Livro' : '➕ Cadastrar Novo Livro'}
                </h3>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Título *</label>
                    <input
                      type="text"
                      value={livroForm.titulo}
                      onChange={(e) => setLivroForm({ ...livroForm, titulo: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: Ritual do Aprendiz Maçom"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Autor</label>
                    <input
                      type="text"
                      value={livroForm.autor}
                      onChange={(e) => setLivroForm({ ...livroForm, autor: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: Rizzardo da Camino"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                    <select
                      value={livroForm.categoria}
                      onChange={(e) => setLivroForm({ ...livroForm, categoria: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Ritualística">Ritualística</option>
                      <option value="Filosofia">Filosofia</option>
                      <option value="História">História</option>
                      <option value="Simbolismo">Simbolismo</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Grau</label>
                    <select
                      value={livroForm.grau}
                      onChange={(e) => setLivroForm({ ...livroForm, grau: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Aprendiz">Aprendiz</option>
                      <option value="Companheiro">Companheiro</option>
                      <option value="Mestre">Mestre</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Localização</label>
                    <input
                      type="text"
                      value={livroForm.localizacao}
                      onChange={(e) => setLivroForm({ ...livroForm, localizacao: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: Estante 2 - Prateleira B"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quantidade Total</label>
                    <input
                      type="number"
                      min="1"
                      value={livroForm.quantidade_total}
                      onChange={(e) => setLivroForm({ 
                        ...livroForm, 
                        quantidade_total: parseInt(e.target.value) || 1,
                        quantidade_disponivel: parseInt(e.target.value) || 1
                      })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={salvarLivro}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : (modoEdicaoLivro ? '💾 Salvar Alterações' : '➕ Cadastrar Livro')}
                  </button>

                  {modoEdicaoLivro && (
                    <button
                      onClick={limparFormularioLivro}
                      className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                      ❌ Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* FILTROS */}
          <div className="bg-white rounded-xl shadow-md p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">🔍 Pesquisar por nome</label>
                <input
                  type="text"
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                  placeholder="Digite o nome do livro..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">📊 Filtrar por grau</label>
                <select
                  value={filtroGrau}
                  onChange={(e) => setFiltroGrau(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todos">Todos os graus</option>
                  <option value="Aprendiz">Aprendiz</option>
                  <option value="Companheiro">Companheiro</option>
                  <option value="Mestre">Mestre</option>
                </select>
              </div>
            </div>
          </div>

          {/* LISTA DE LIVROS POR GRAU */}
          {['Aprendiz', 'Companheiro', 'Mestre'].map(grau => {
            const livrosDoGrau = livrosPorGrau[grau];
            if (livrosDoGrau.length === 0) return null;

            return (
              <div key={grau} className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className={`p-4 text-white font-bold text-lg ${
                  grau === 'Aprendiz' ? 'bg-gradient-to-r from-green-600 to-green-700' :
                  grau === 'Companheiro' ? 'bg-gradient-to-r from-blue-600 to-blue-700' :
                  'bg-gradient-to-r from-purple-600 to-purple-700'
                }`}>
                  {grau === 'Aprendiz' && '🟢'} {grau === 'Companheiro' && '🔵'} {grau === 'Mestre' && '🟣'} {grau} ({livrosDoGrau.length})
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                  {livrosDoGrau.map(livro => {
                    const disponivel = obterQuantidadeDisponivel(livro.id);
                    
                    return (
                      <div key={livro.id} className="border rounded-lg p-4 hover:shadow-lg transition">
                        <h4 className="font-bold text-lg text-blue-900 mb-2">{livro.titulo}</h4>
                        {livro.autor && <p className="text-sm text-gray-600 mb-2">✍️ {livro.autor}</p>}
                        
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                            {livro.categoria}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            disponivel > 0
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {disponivel}/{livro.quantidade_total}
                          </span>
                        </div>

                        {livro.localizacao && (
                          <p className="text-xs text-gray-500 mb-3">📍 {livro.localizacao}</p>
                        )}

                        {permissoes?.pode_editar_biblioteca && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => editarLivro(livro)}
                              className="flex-1 px-3 py-2 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => excluirLivro(livro.id)}
                              className="flex-1 px-3 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                            >
                              Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {livrosFiltrados.length === 0 && (
            <div className="bg-white rounded-xl shadow-md p-12 text-center text-gray-500">
              Nenhum livro encontrado com os filtros aplicados
            </div>
          )}
        </div>
      )}

      {/* ABA EMPRÉSTIMOS ATIVOS */}
      {abaAtiva === 'emprestimos' && (
        <div className="space-y-6">
          {/* FORMULÁRIO EMPRÉSTIMO */}
          {permissoes?.pode_editar_biblioteca && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 text-white">
                <h3 className="text-xl font-bold">📖 Registrar Novo Empréstimo</h3>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Livro *</label>
                    <select
                      value={emprestimoForm.livro_id}
                      onChange={(e) => setEmprestimoForm({ ...emprestimoForm, livro_id: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Selecione um livro</option>
                      {livrosDisponiveis.map(livro => (
                        <option key={livro.id} value={livro.id}>
                          {livro.titulo} ({obterQuantidadeDisponivel(livro.id)} disponível)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Irmão *</label>
                    <select
                      value={emprestimoForm.irmao_id}
                      onChange={(e) => setEmprestimoForm({ ...emprestimoForm, irmao_id: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Selecione um irmão</option>
                      {irmaos.map(irmao => (
                        <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data Empréstimo</label>
                    <input
                      type="date"
                      value={emprestimoForm.data_emprestimo}
                      onChange={(e) => setEmprestimoForm({ ...emprestimoForm, data_emprestimo: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <button
                  onClick={registrarEmprestimo}
                  disabled={loading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50"
                >
                  {loading ? 'Registrando...' : '📖 Registrar Empréstimo'}
                </button>
              </div>
            </div>
          )}

          {/* LISTA EMPRÉSTIMOS ATIVOS */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <h3 className="text-xl font-bold">📖 Empréstimos Ativos</h3>
              <p className="text-sm text-blue-100">{emprestimosAtivos.length} empréstimo(s) ativo(s)</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Livro</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Irmão</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Empréstimo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Devolução Prevista</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Status</th>
                    {permissoes?.pode_editar_biblioteca && (
                      <th className="px-4 py-3 text-center text-sm font-semibold">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {emprestimosAtivos.length > 0 ? (
                    emprestimosAtivos.map(emprestimo => (
                      <tr key={emprestimo.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{obterTituloLivro(emprestimo.livro_id)}</td>
                        <td className="px-4 py-3">{obterNomeIrmao(emprestimo.irmao_id)}</td>
                        <td className="px-4 py-3 text-sm">{formatarData(emprestimo.data_emprestimo)}</td>
                        <td className="px-4 py-3 text-sm">
                          {formatarData(emprestimo.data_devolucao_prevista)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            estaAtrasado(emprestimo.data_devolucao_prevista)
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {estaAtrasado(emprestimo.data_devolucao_prevista) ? '⚠️ Atrasado' : '✅ No prazo'}
                          </span>
                        </td>
                        {permissoes?.pode_editar_biblioteca && (
                          <td className="px-4 py-3 text-center space-x-2">
                            <button
                              onClick={() => devolverLivro(emprestimo.id, emprestimo.livro_id)}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                            >
                              Devolver
                            </button>
                            <button
                              onClick={() => abrirModalEditarPrazo(emprestimo)}
                              className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                            >
                              Editar Prazo
                            </button>
                            <button
                              onClick={() => excluirEmprestimo(emprestimo.id, emprestimo.livro_id, emprestimo.status)}
                              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                            >
                              Excluir
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={permissoes?.pode_editar_biblioteca ? "6" : "5"} className="px-4 py-8 text-center text-gray-500">
                        Nenhum empréstimo ativo no momento
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA DEVOLVIDOS */}
      {abaAtiva === 'devolvidos' && (
        <div>
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-green-600 to-green-700 text-white">
              <h3 className="text-xl font-bold">✅ Devoluções Realizadas</h3>
              <p className="text-sm text-green-100">{emprestimosDevolvidos.length} devolução(ões) registrada(s)</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Livro</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Irmão</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Empréstimo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Devolução Prevista</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Devolução Real</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Situação</th>
                    {permissoes?.pode_editar_biblioteca && (
                      <th className="px-4 py-3 text-center text-sm font-semibold">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {emprestimosDevolvidos.length > 0 ? (
                    emprestimosDevolvidos
                      .sort((a, b) => new Date(b.data_devolucao_real) - new Date(a.data_devolucao_real))
                      .map(emprestimo => {
                        const devolveuAtrasado = new Date(emprestimo.data_devolucao_real) > new Date(emprestimo.data_devolucao_prevista);
                        
                        return (
                          <tr key={emprestimo.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">{obterTituloLivro(emprestimo.livro_id)}</td>
                            <td className="px-4 py-3">{obterNomeIrmao(emprestimo.irmao_id)}</td>
                            <td className="px-4 py-3 text-sm">{formatarData(emprestimo.data_emprestimo)}</td>
                            <td className="px-4 py-3 text-sm">{formatarData(emprestimo.data_devolucao_prevista)}</td>
                            <td className="px-4 py-3 text-sm">{formatarData(emprestimo.data_devolucao_real)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                devolveuAtrasado
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {devolveuAtrasado ? 'Atrasado' : 'No prazo'}
                              </span>
                            </td>
                            {permissoes?.pode_editar_biblioteca && (
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => excluirEmprestimo(emprestimo.id, emprestimo.livro_id, emprestimo.status)}
                                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                                >
                                  Excluir
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={permissoes?.pode_editar_biblioteca ? "7" : "6"} className="px-4 py-8 text-center text-gray-500">
                        Nenhuma devolução registrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA POR IRMÃO */}
      {abaAtiva === 'por-irmao' && (
        <div>
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white">
              <h3 className="text-xl font-bold">Empréstimos por Irmão</h3>
              <p className="text-sm text-purple-100">
                {emprestimosPorIrmao.length} irmão(s) com empréstimos registrados
              </p>
            </div>

            <div className="p-6 space-y-6">
              {emprestimosPorIrmao.length > 0 ? (
                emprestimosPorIrmao.map((item) => (
                  <div key={item.irmao.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-bold text-blue-900">{item.irmao.nome}</h4>
                      <div className="flex gap-4">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-semibold">
                          Ativos: {item.ativos}
                        </span>
                        <span className="px-3 py-1 bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold">
                          Total: {item.total}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-200">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm">Livro</th>
                            <th className="px-4 py-2 text-left text-sm">Data Empréstimo</th>
                            <th className="px-4 py-2 text-left text-sm">Devolução Prevista</th>
                            <th className="px-4 py-2 text-center text-sm">Status</th>
                            <th className="px-4 py-2 text-center text-sm">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y bg-white">
                          {item.emprestimos.map((emprestimo) => (
                            <tr key={emprestimo.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm">{obterTituloLivro(emprestimo.livro_id)}</td>
                              <td className="px-4 py-2 text-sm">{formatarData(emprestimo.data_emprestimo)}</td>
                              <td className="px-4 py-2 text-sm">
                                {emprestimo.status === 'emprestado' ? formatarData(emprestimo.data_devolucao_prevista) : '-'}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  emprestimo.status === 'emprestado'
                                    ? estaAtrasado(emprestimo.data_devolucao_prevista)
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-blue-100 text-blue-800'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {emprestimo.status === 'emprestado' 
                                    ? (estaAtrasado(emprestimo.data_devolucao_prevista) ? 'Atrasado' : 'Ativo')
                                    : 'Devolvido'
                                  }
                                </span>
                              </td>
                              <td className="px-4 py-2 text-center">
                                {emprestimo.status === 'emprestado' ? (
                                  permissoes?.pode_editar_biblioteca ? (
                                    <button
                                      onClick={() => devolverLivro(emprestimo.id, emprestimo.livro_id)}
                                      className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                                    >
                                      Devolver
                                    </button>
                                  ) : (
                                    <span className="text-xs text-blue-600 font-medium">Em uso</span>
                                  )
                                ) : (
                                  <span className="text-xs text-gray-500">
                                    {formatarData(emprestimo.data_devolucao_real)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Nenhum irmão com empréstimos registrados
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA FILA DE ESPERA */}
      {abaAtiva === 'fila' && (
        <FilaEspera
          permissoes={permissoes}
          showSuccess={showSuccess}
          showError={showError}
          livros={livros}
          irmaos={irmaos}
        />
      )}

      {/* MODAL EDITAR PRAZO */}
      {modalEditarPrazo && emprestimoEditando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="bg-yellow-600 text-white p-6 rounded-t-lg">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">📅 Editar Prazo de Devolução</h3>
                <button
                  onClick={() => {
                    setModalEditarPrazo(false);
                    setEmprestimoEditando(null);
                    setNovoPrazo('');
                  }}
                  className="text-white hover:bg-yellow-700 rounded-full p-2"
                >
                  ✖️
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Livro:</strong> {obterTituloLivro(emprestimoEditando.livro_id)}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Irmão:</strong> {obterNomeIrmao(emprestimoEditando.irmao_id)}
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  <strong>Prazo Atual:</strong> {formatarData(emprestimoEditando.data_devolucao_prevista)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nova Data de Devolução *
                </label>
                <input
                  type="date"
                  value={novoPrazo}
                  onChange={(e) => setNovoPrazo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={salvarNovoPrazo}
                  disabled={loading}
                  className="flex-1 px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : '💾 Salvar Novo Prazo'}
                </button>

                <button
                  onClick={() => {
                    setModalEditarPrazo(false);
                    setEmprestimoEditando(null);
                    setNovoPrazo('');
                  }}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  ❌ Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Biblioteca;
