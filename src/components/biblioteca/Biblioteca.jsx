import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarData } from '../../utils/formatters';
import FilaEspera from './FilaEspera';

const Biblioteca = ({ livros, emprestimos, irmaos, onUpdate, showSuccess, showError, permissoes }) => {
  // Estados de controle
  const [abaAtiva, setAbaAtiva] = useState('livros');
  const [loading, setLoading] = useState(false);

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
    if (!window.confirm('Tem certeza que deseja excluir este livro? Esta ação é irreversível!')) return;

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
      // Atualizar empréstimo
      const { error: emprestimoError } = await supabase
        .from('biblioteca_emprestimos')
        .update({
          status: 'devolvido',
          data_devolucao_real: new Date().toISOString().split('T')[0]
        })
        .eq('id', emprestimoId);

      if (emprestimoError) throw emprestimoError;

      // Atualizar quantidade disponível
      const livro = livros.find(l => l.id === livroId);
      if (livro) {
        await supabase
          .from('biblioteca_livros')
          .update({ quantidade_disponivel: livro.quantidade_disponivel + 1 })
          .eq('id', livro.id);
      }

      showSuccess('Devolução registrada com sucesso!');
      onUpdate();

    } catch (error) {
      showError('Erro ao registrar devolução: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Excluir empréstimo
  const excluirEmprestimo = async (emprestimoId, livroId, status) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro de empréstimo?')) return;

    setLoading(true);
    try {
      // Se o empréstimo estava ativo, devolver a quantidade ao livro
      if (status === 'emprestado') {
        const livro = livros.find(l => l.id === livroId);
        if (livro) {
          await supabase
            .from('biblioteca_livros')
            .update({ quantidade_disponivel: livro.quantidade_disponivel + 1 })
            .eq('id', livro.id);
        }
      }

      // Excluir o empréstimo
      const { error } = await supabase
        .from('biblioteca_emprestimos')
        .delete()
        .eq('id', emprestimoId);

      if (error) throw error;

      showSuccess('Empréstimo excluído com sucesso!');
      onUpdate();

    } catch (error) {
      showError('Erro ao excluir empréstimo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal de editar prazo
  const abrirModalEditarPrazo = (emprestimo) => {
    setEmprestimoEditando(emprestimo);
    setNovoPrazo(emprestimo.data_devolucao_prevista);
    setModalEditarPrazo(true);
  };

  // Salvar novo prazo
  const salvarNovoPrazo = async () => {
    if (!novoPrazo) {
      showError('Selecione uma nova data de devolução');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('biblioteca_emprestimos')
        .update({ data_devolucao_prevista: novoPrazo })
        .eq('id', emprestimoEditando.id);

      if (error) throw error;

      showSuccess('✅ Prazo de devolução atualizado!');
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

  // Obter nome do irmão
  const obterNomeIrmao = (irmaoId) => {
    const irmao = irmaos.find(i => i.id === irmaoId);
    return irmao ? irmao.nome : 'Desconhecido';
  };

  // Obter título do livro
  const obterTituloLivro = (livroId) => {
    const livro = livros.find(l => l.id === livroId);
    return livro ? livro.titulo : 'Desconhecido';
  };

  // Verificar se está atrasado
  const estaAtrasado = (dataPrevista) => {
    const hoje = new Date();
    const prevista = new Date(dataPrevista + 'T00:00:00');
    return hoje > prevista;
  };

  // Filtrar empréstimos ativos e devolvidos
  const emprestimosAtivos = emprestimos.filter(e => e.status === 'emprestado');
  const emprestimosDevolvidos = emprestimos.filter(e => e.status === 'devolvido');

  // Filtrar livros disponíveis
  const livrosDisponiveis = livros.filter(l => l.quantidade_disponivel > 0);

  // Obter empréstimos por irmão
  const emprestimosPorIrmao = irmaos.map(irmao => {
    const emprestimosDoIrmao = emprestimos.filter(e => e.irmao_id === irmao.id);
    return {
      irmao,
      emprestimos: emprestimosDoIrmao,
      ativos: emprestimosDoIrmao.filter(e => e.status === 'emprestado').length,
      total: emprestimosDoIrmao.length
    };
  }).filter(item => item.total > 0);

  return (
    <div>
      {/* ABAS */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setAbaAtiva('livros')}
          className={`px-6 py-2 rounded-lg font-semibold transition ${
            abaAtiva === 'livros' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📚 Livros ({livros.length})
        </button>
        <button
          onClick={() => setAbaAtiva('emprestimos')}
          className={`px-6 py-2 rounded-lg font-semibold transition ${
            abaAtiva === 'emprestimos' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📖 Empréstimos Ativos ({emprestimosAtivos.length})
        </button>
        <button
          onClick={() => setAbaAtiva('devolucoes')}
          className={`px-6 py-2 rounded-lg font-semibold transition ${
            abaAtiva === 'devolucoes' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          ✅ Devoluções ({emprestimosDevolvidos.length})
        </button>
        <button
          onClick={() => setAbaAtiva('por-irmao')}
          className={`px-6 py-2 rounded-lg font-semibold transition ${
            abaAtiva === 'por-irmao' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          👤 Por Irmão ({emprestimosPorIrmao.length})
        </button>
        <button
          onClick={() => setAbaAtiva('fila')}
          className={`px-6 py-2 rounded-lg font-semibold transition ${
            abaAtiva === 'fila' ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          ⏳ Fila de Espera
        </button>
      </div>

      {/* ABA LIVROS */}
      {abaAtiva === 'livros' && (
        <div>
          {/* FORMULÁRIO LIVROS */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h3 className="text-xl font-bold text-blue-900 mb-4">
              {modoEdicaoLivro ? '✏️ Editar Livro' : '➕ Cadastrar Novo Livro'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Título *</label>
                <input
                  type="text"
                  value={livroForm.titulo}
                  onChange={(e) => setLivroForm({ ...livroForm, titulo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Autor</label>
                <input
                  type="text"
                  value={livroForm.autor}
                  onChange={(e) => setLivroForm({ ...livroForm, autor: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoria *</label>
                <select
                  value={livroForm.categoria}
                  onChange={(e) => setLivroForm({ ...livroForm, categoria: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option>Ritualística</option>
                  <option>Filosofia</option>
                  <option>História</option>
                  <option>Simbologia</option>
                  <option>Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grau Maçônico * 
                  <span className="text-xs text-gray-500 ml-2">(Grau mínimo para emprestar)</span>
                </label>
                <select
                  value={livroForm.grau}
                  onChange={(e) => setLivroForm({ ...livroForm, grau: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="Aprendiz">Aprendiz</option>
                  <option value="Companheiro">Companheiro</option>
                  <option value="Mestre">Mestre</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  💡 Irmãos de graus superiores podem emprestar livros de graus inferiores
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Localização</label>
                <input
                  type="text"
                  value={livroForm.localizacao}
                  onChange={(e) => setLivroForm({ ...livroForm, localizacao: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Ex: Estante A, Prateleira 2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantidade Total *</label>
                <input
                  type="number"
                  value={livroForm.quantidade_total}
                  onChange={(e) => setLivroForm({
                    ...livroForm,
                    quantidade_total: parseInt(e.target.value) || 1,
                    quantidade_disponivel: modoEdicaoLivro ? livroForm.quantidade_disponivel : parseInt(e.target.value) || 1
                  })}
                  min="1"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={salvarLivro}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Salvando...' : (modoEdicaoLivro ? 'Atualizar Livro' : 'Cadastrar Livro')}
              </button>
              
              {modoEdicaoLivro && (
                <button
                  type="button"
                  onClick={limparFormularioLivro}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>

          {/* LISTAGEM DE LIVROS */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <h3 className="text-xl font-bold">Acervo da Biblioteca</h3>
              <p className="text-sm text-blue-100">Total: {livros.length} livro(s)</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Título</th>
                    <th className="px-4 py-3 text-left">Autor</th>
                    <th className="px-4 py-3 text-left">Categoria</th>
                    <th className="px-4 py-3 text-center">Grau</th>
                    <th className="px-4 py-3 text-center">Disponível</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {livros.length > 0 ? (
                    livros.map((livro) => (
                      <tr key={livro.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold">{livro.titulo}</td>
                        <td className="px-4 py-3">{livro.autor || '-'}</td>
                        <td className="px-4 py-3">{livro.categoria}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            livro.grau === 'Aprendiz' 
                              ? 'bg-blue-100 text-blue-800' 
                              : livro.grau === 'Companheiro'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {livro.grau || 'Aprendiz'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded ${
                            livro.quantidade_disponivel > 0 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {livro.quantidade_disponivel}/{livro.quantidade_total}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => editarLivro(livro)}
                              className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => excluirLivro(livro.id)}
                              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                        Nenhum livro cadastrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA EMPRÉSTIMOS ATIVOS */}
      {abaAtiva === 'emprestimos' && (
        <div>
          {/* FORMULÁRIO EMPRÉSTIMO */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h3 className="text-xl font-bold text-blue-900 mb-4">➕ Novo Empréstimo</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Livro *</label>
                <select
                  value={emprestimoForm.livro_id}
                  onChange={(e) => setEmprestimoForm({ ...emprestimoForm, livro_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Selecione...</option>
                  {livrosDisponiveis.map(livro => (
                    <option key={livro.id} value={livro.id}>
                      {livro.titulo} ({livro.quantidade_disponivel} disp.)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Irmão *</label>
                <select
                  value={emprestimoForm.irmao_id}
                  onChange={(e) => setEmprestimoForm({ ...emprestimoForm, irmao_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Selecione...</option>
                  {irmaos.map(irmao => (
                    <option key={irmao.id} value={irmao.id}>
                      {irmao.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Empréstimo *</label>
                <input
                  type="date"
                  value={emprestimoForm.data_emprestimo}
                  onChange={(e) => setEmprestimoForm({ ...emprestimoForm, data_emprestimo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={registrarEmprestimo}
              disabled={loading}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Registrando...' : 'Registrar Empréstimo'}
            </button>
          </div>

          {/* LISTAGEM DE EMPRÉSTIMOS ATIVOS */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <h3 className="text-xl font-bold">Empréstimos Ativos</h3>
              <p className="text-sm text-blue-100">Total: {emprestimosAtivos.length} empréstimo(s)</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Livro</th>
                    <th className="px-4 py-3 text-left">Irmão</th>
                    <th className="px-4 py-3 text-left">Empréstimo</th>
                    <th className="px-4 py-3 text-left">Devolução Prevista</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {emprestimosAtivos.length > 0 ? (
                    emprestimosAtivos.map((emprestimo) => (
                      <tr key={emprestimo.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold">{obterTituloLivro(emprestimo.livro_id)}</td>
                        <td className="px-4 py-3">{obterNomeIrmao(emprestimo.irmao_id)}</td>
                        <td className="px-4 py-3">{formatarData(emprestimo.data_emprestimo)}</td>
                        <td className="px-4 py-3">{formatarData(emprestimo.data_devolucao_prevista)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-sm ${
                            estaAtrasado(emprestimo.data_devolucao_prevista)
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {estaAtrasado(emprestimo.data_devolucao_prevista) ? 'Atrasado' : 'No prazo'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => abrirModalEditarPrazo(emprestimo)}
                              className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                              title="Editar prazo"
                            >
                              📅 Prazo
                            </button>
                            <button
                              onClick={() => devolverLivro(emprestimo.id, emprestimo.livro_id)}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                            >
                              Devolver
                            </button>
                            <button
                              onClick={() => excluirEmprestimo(emprestimo.id, emprestimo.livro_id, emprestimo.status)}
                              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                        Nenhum empréstimo ativo
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA DEVOLUÇÕES */}
      {abaAtiva === 'devolucoes' && (
        <div>
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-green-600 to-green-700 text-white">
              <h3 className="text-xl font-bold">Histórico de Devoluções</h3>
              <p className="text-sm text-green-100">Total: {emprestimosDevolvidos.length} devolução(ões)</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Livro</th>
                    <th className="px-4 py-3 text-left">Irmão</th>
                    <th className="px-4 py-3 text-left">Empréstimo</th>
                    <th className="px-4 py-3 text-left">Devolução Prevista</th>
                    <th className="px-4 py-3 text-left">Devolução Real</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {emprestimosDevolvidos.length > 0 ? (
                    emprestimosDevolvidos
                      .sort((a, b) => new Date(b.data_devolucao_real) - new Date(a.data_devolucao_real))
                      .map((emprestimo) => {
                        const foiDevolvido = emprestimo.data_devolucao_real;
                        const devolveuAtrasado = foiDevolvido && new Date(emprestimo.data_devolucao_real) > new Date(emprestimo.data_devolucao_prevista);
                        
                        return (
                          <tr key={emprestimo.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-semibold">{obterTituloLivro(emprestimo.livro_id)}</td>
                            <td className="px-4 py-3">{obterNomeIrmao(emprestimo.irmao_id)}</td>
                            <td className="px-4 py-3">{formatarData(emprestimo.data_emprestimo)}</td>
                            <td className="px-4 py-3">{formatarData(emprestimo.data_devolucao_prevista)}</td>
                            <td className="px-4 py-3">{formatarData(emprestimo.data_devolucao_real)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 rounded text-sm ${
                                devolveuAtrasado
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {devolveuAtrasado ? 'Atrasado' : 'No prazo'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => excluirEmprestimo(emprestimo.id, emprestimo.livro_id, emprestimo.status)}
                                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                              >
                                Excluir
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
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
                                  <button
                                    onClick={() => devolverLivro(emprestimo.id, emprestimo.livro_id)}
                                    className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                                  >
                                    Devolver
                                  </button>
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
