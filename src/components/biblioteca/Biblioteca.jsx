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
      <div className="rounded-xl p-2 flex gap-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <button
          onClick={() => setAbaAtiva('livros')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
            abaAtiva === 'livros'
              ? 'bg-primary-600 text-white'
              : 'btn-tab-inactive'
          }`}
        >
          📚 Livros ({livros.length})
        </button>
        <button
          onClick={() => setAbaAtiva('emprestimos')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
            abaAtiva === 'emprestimos'
              ? 'bg-primary-600 text-white'
              : 'btn-tab-inactive'
          }`}
        >
          📖 Empréstimos Ativos ({emprestimosAtivos.length})
        </button>
        <button
          onClick={() => setAbaAtiva('devolvidos')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
            abaAtiva === 'devolvidos'
              ? 'bg-primary-600 text-white'
              : 'btn-tab-inactive'
          }`}
        >
          ✅ Devolvidos ({emprestimosDevolvidos.length})
        </button>
        <button
          onClick={() => setAbaAtiva('por-irmao')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
            abaAtiva === 'por-irmao'
              ? 'bg-primary-600 text-white'
              : 'btn-tab-inactive'
          }`}
        >
          👤 Por Irmão
        </button>
        <button
          onClick={() => setAbaAtiva('fila')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
            abaAtiva === 'fila'
              ? 'bg-primary-600 text-white'
              : 'btn-tab-inactive'
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
            <div className="rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-primary-600 to-blue-700 p-6 text-white">
                <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>
                  {modoEdicaoLivro ? '✏️ Editar Livro' : '➕ Cadastrar Novo Livro'}
                </h3>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Título *</label>
                    <input
                      type="text"
                      value={livroForm.titulo}
                      onChange={(e) => setLivroForm({ ...livroForm, titulo: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                      placeholder="Ex: Ritual do Aprendiz Maçom"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Autor</label>
                    <input
                      type="text"
                      value={livroForm.autor}
                      onChange={(e) => setLivroForm({ ...livroForm, autor: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                      placeholder="Ex: Rizzardo da Camino"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Categoria</label>
                    <select
                      value={livroForm.categoria}
                      onChange={(e) => setLivroForm({ ...livroForm, categoria: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    >
                      <option value="Ritualística">Ritualística</option>
                      <option value="Filosofia">Filosofia</option>
                      <option value="História">História</option>
                      <option value="Simbolismo">Simbolismo</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Grau</label>
                    <select
                      value={livroForm.grau}
                      onChange={(e) => setLivroForm({ ...livroForm, grau: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    >
                      <option value="Aprendiz">Aprendiz</option>
                      <option value="Companheiro">Companheiro</option>
                      <option value="Mestre">Mestre</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Localização</label>
                    <input
                      type="text"
                      value={livroForm.localizacao}
                      onChange={(e) => setLivroForm({ ...livroForm, localizacao: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                      placeholder="Ex: Estante 2 - Prateleira B"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Quantidade Total</label>
                    <input
                      type="number"
                      min="1"
                      value={livroForm.quantidade_total}
                      onChange={(e) => setLivroForm({ 
                        ...livroForm, 
                        quantidade_total: parseInt(e.target.value) || 1,
                        quantidade_disponivel: parseInt(e.target.value) || 1
                      })}
                      className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={salvarLivro}
                    disabled={loading}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : (modoEdicaoLivro ? '💾 Salvar Alterações' : '➕ Cadastrar Livro')}
                  </button>

                  {modoEdicaoLivro && (
                    <button
                      onClick={limparFormularioLivro}
                      className="px-6 py-2 rounded-lg font-semibold" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    >
                      ❌ Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* FILTROS */}
          <div className="rounded-xl p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>🔍 Pesquisar por nome</label>
                <input
                  type="text"
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                  placeholder="Digite o nome do livro..."
                  className="w-full px-4 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>📊 Filtrar por grau</label>
                <select
                  value={filtroGrau}
                  onChange={(e) => setFiltroGrau(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
              <div key={grau} className="rounded-xl overflow-hidden">
                <div className={`p-4 text-white font-bold text-lg ${
                  grau === 'Aprendiz' ? 'bg-gradient-to-r from-green-600 to-green-700' :
                  grau === 'Companheiro' ? 'bg-gradient-to-r from-primary-600 to-blue-700' :
                  'bg-gradient-to-r from-purple-600 to-purple-700'
                }`}>
                  {grau === 'Aprendiz' && '🟢'} {grau === 'Companheiro' && '🔵'} {grau === 'Mestre' && '🟣'} {grau} ({livrosDoGrau.length})
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead style={{background:"var(--color-surface-2)"}}>
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>TÍTULO</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>AUTOR</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>CATEGORIA</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>LOCALIZAÇÃO</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>DISPONIBILIDADE</th>
                        {permissoes?.pode_editar_biblioteca && (
                          <th className="px-4 py-3 text-center text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>AÇÕES</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {livrosDoGrau.map((livro, livroIdx) => {
                        const disponivel = obterQuantidadeDisponivel(livro.id);
                        
                        return (
                          <tr key={livro.id} style={{borderBottom:"1px solid var(--color-border)",background:livroIdx%2===0?"var(--color-surface)":"var(--color-surface-2)"}} className="hover:opacity-80 transition-opacity">
                            <td className="px-4 py-3 font-medium text-blue-900" style={{color:"var(--color-text)"}}>{livro.titulo}</td>
                            <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>{livro.autor || '-'}</td>
                            <td className="px-4 py-3" style={{color:"var(--color-text)"}}>
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                {livro.categoria}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>{livro.localizacao || '-'}</td>
                            <td className="px-4 py-3 text-center" style={{color:"var(--color-text)"}}>
                              <span className={`px-3 py-1 rounded text-sm font-semibold ${
                                disponivel > 0
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {disponivel}/{livro.quantidade_total}
                              </span>
                            </td>
                            {permissoes?.pode_editar_biblioteca && (
                              <td className="px-4 py-3 text-center" style={{color:"var(--color-text)"}}>
                                <div className="flex gap-2 justify-center">
                                  <button
                                    onClick={() => editarLivro(livro)}
                                    style={{padding:"0.3rem 0.75rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-md)",fontSize:"0.8rem",fontWeight:"600",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"0.3rem"}}
                                  >
                                    ✏️ Editar
                                  </button>
                                  <button
                                    onClick={() => excluirLivro(livro.id)}
                                    style={{padding:"0.3rem 0.75rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.8rem",fontWeight:"600",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"0.3rem"}}
                                  >
                                    🗑️ Excluir
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {livrosFiltrados.length === 0 && (
            <div className="rounded-xl p-12 text-center" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
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
            <div className="rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 text-white">
                <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>📖 Registrar Novo Empréstimo</h3>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Livro *</label>
                    <select
                      value={emprestimoForm.livro_id}
                      onChange={(e) => setEmprestimoForm({ ...emprestimoForm, livro_id: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-green-500"
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
                    <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Irmão *</label>
                    <select
                      value={emprestimoForm.irmao_id}
                      onChange={(e) => setEmprestimoForm({ ...emprestimoForm, irmao_id: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-green-500"
                    >
                      <option value="">Selecione um irmão</option>
                      {irmaos.map(irmao => (
                        <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Data Empréstimo</label>
                    <input
                      type="date"
                      value={emprestimoForm.data_emprestimo}
                      onChange={(e) => setEmprestimoForm({ ...emprestimoForm, data_emprestimo: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-green-500"
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
          <div className="rounded-xl overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-primary-600 to-blue-700 text-white">
              <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>📖 Empréstimos Ativos</h3>
              <p className="text-sm text-blue-100">{emprestimosAtivos.length} empréstimo(s) ativo(s)</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{background:"var(--color-surface-2)"}}>
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Livro</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Irmão</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Empréstimo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Devolução Prevista</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Status</th>
                    {permissoes?.pode_editar_biblioteca && (
                      <th className="px-4 py-3 text-center text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {emprestimosAtivos.length > 0 ? (
                    emprestimosAtivos.map(emprestimo => (
                      <tr key={emprestimo.id} style={{borderBottom:"1px solid var(--color-border)"}}>
                        <td className="px-4 py-3" style={{color:"var(--color-text)"}}>{obterTituloLivro(emprestimo.livro_id)}</td>
                        <td className="px-4 py-3" style={{color:"var(--color-text)"}}>{obterNomeIrmao(emprestimo.irmao_id)}</td>
                        <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>{formatarData(emprestimo.data_emprestimo)}</td>
                        <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>
                          {formatarData(emprestimo.data_devolucao_prevista)}
                        </td>
                        <td className="px-4 py-3 text-center" style={{color:"var(--color-text)"}}>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            estaAtrasado(emprestimo.data_devolucao_prevista)
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {estaAtrasado(emprestimo.data_devolucao_prevista) ? '⚠️ Atrasado' : '✅ No prazo'}
                          </span>
                        </td>
                        {permissoes?.pode_editar_biblioteca && (
                          <td className="px-4 py-3 text-center space-x-2" style={{color:"var(--color-text)"}}>
                            <button
                              onClick={() => devolverLivro(emprestimo.id, emprestimo.livro_id)}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                            >
                              Devolver
                            </button>
                            <button
                              onClick={() => abrirModalEditarPrazo(emprestimo)}
                              style={{padding:"0.25rem 0.65rem",background:"rgba(245,158,11,0.15)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.78rem",fontWeight:"600",cursor:"pointer"}}
                            >
                              Editar Prazo
                            </button>
                            <button
                              onClick={() => excluirEmprestimo(emprestimo.id, emprestimo.livro_id, emprestimo.status)}
                              style={{padding:"0.25rem 0.65rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.78rem",fontWeight:"600",cursor:"pointer"}}
                            >
                              Excluir
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={permissoes?.pode_editar_biblioteca ? "6" : "5"} className="px-4 py-8 text-center" style={{color:"var(--color-text)"}}>
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
          <div className="rounded-xl overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-green-600 to-green-700 text-white">
              <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>✅ Devoluções Realizadas</h3>
              <p className="text-sm text-green-100">{emprestimosDevolvidos.length} devolução(ões) registrada(s)</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{background:"var(--color-surface-2)"}}>
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Livro</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Irmão</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Empréstimo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Devolução Prevista</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Devolução Real</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Situação</th>
                    {permissoes?.pode_editar_biblioteca && (
                      <th className="px-4 py-3 text-center text-sm font-semibold" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Ações</th>
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
                          <tr key={emprestimo.id} style={{borderBottom:"1px solid var(--color-border)"}}>
                            <td className="px-4 py-3" style={{color:"var(--color-text)"}}>{obterTituloLivro(emprestimo.livro_id)}</td>
                            <td className="px-4 py-3" style={{color:"var(--color-text)"}}>{obterNomeIrmao(emprestimo.irmao_id)}</td>
                            <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>{formatarData(emprestimo.data_emprestimo)}</td>
                            <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>{formatarData(emprestimo.data_devolucao_prevista)}</td>
                            <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>{formatarData(emprestimo.data_devolucao_real)}</td>
                            <td className="px-4 py-3 text-center" style={{color:"var(--color-text)"}}>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                devolveuAtrasado
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {devolveuAtrasado ? 'Atrasado' : 'No prazo'}
                              </span>
                            </td>
                            {permissoes?.pode_editar_biblioteca && (
                              <td className="px-4 py-3 text-center" style={{color:"var(--color-text)"}}>
                                <button
                                  onClick={() => excluirEmprestimo(emprestimo.id, emprestimo.livro_id, emprestimo.status)}
                                  style={{padding:"0.25rem 0.65rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.78rem",fontWeight:"600",cursor:"pointer"}}
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
                      <td colSpan={permissoes?.pode_editar_biblioteca ? "7" : "6"} className="px-4 py-8 text-center" style={{color:"var(--color-text)"}}>
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
          <div className="rounded-xl overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white">
              <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>Empréstimos por Irmão</h3>
              <p className="text-sm text-purple-100">
                {emprestimosPorIrmao.length} irmão(s) com empréstimos registrados
              </p>
            </div>

            <div className="p-6 space-y-6">
              {emprestimosPorIrmao.length > 0 ? (
                emprestimosPorIrmao.map((item) => (
                  <div key={item.irmao.id} className="border rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-bold text-blue-900">{item.irmao.nome}</h4>
                      <div className="flex gap-4">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-semibold">
                          Ativos: {item.ativos}
                        </span>
                        <span className="px-3 py-1 rounded-lg text-sm font-semibold">
                          Total: {item.total}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead style={{background:"var(--color-surface-2)"}}>
                          <tr>
                            <th className="px-4 py-2 text-left text-sm" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Livro</th>
                            <th className="px-4 py-2 text-left text-sm" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Data Empréstimo</th>
                            <th className="px-4 py-2 text-left text-sm" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Devolução Prevista</th>
                            <th className="px-4 py-2 text-center text-sm" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Status</th>
                            <th className="px-4 py-2 text-center text-sm" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {item.emprestimos.map((emprestimo) => (
                            <tr key={emprestimo.id} style={{borderBottom:"1px solid var(--color-border)"}}>
                              <td className="px-4 py-2 text-sm" style={{color:"var(--color-text)"}}>{obterTituloLivro(emprestimo.livro_id)}</td>
                              <td className="px-4 py-2 text-sm" style={{color:"var(--color-text)"}}>{formatarData(emprestimo.data_emprestimo)}</td>
                              <td className="px-4 py-2 text-sm" style={{color:"var(--color-text)"}}>
                                {emprestimo.status === 'emprestado' ? formatarData(emprestimo.data_devolucao_prevista) : '-'}
                              </td>
                              <td className="px-4 py-2 text-center" style={{color:"var(--color-text)"}}>
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
                              <td className="px-4 py-2 text-center" style={{color:"var(--color-text)"}}>
                                {emprestimo.status === 'emprestado' ? (
                                  permissoes?.pode_editar_biblioteca ? (
                                    <button
                                      onClick={() => devolverLivro(emprestimo.id, emprestimo.livro_id)}
                                      style={{padding:"0.2rem 0.5rem",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.72rem",fontWeight:"600",cursor:"pointer"}}
                                    >
                                      Devolver
                                    </button>
                                  ) : (
                                    <span className="text-xs text-blue-600 font-medium">Em uso</span>
                                  )
                                ) : (
                                  <span className="text-xs">
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
                <div className="text-center py-12">
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
          <div className="rounded-lg max-w-md w-full">
            <div className="bg-yellow-600 text-white p-6 rounded-t-lg">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>📅 Editar Prazo de Devolução</h3>
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
                <p className="text-sm mb-2">
                  <strong>Livro:</strong> {obterTituloLivro(emprestimoEditando.livro_id)}
                </p>
                <p className="text-sm mb-2">
                  <strong>Irmão:</strong> {obterNomeIrmao(emprestimoEditando.irmao_id)}
                </p>
                <p className="text-sm mb-4">
                  <strong>Prazo Atual:</strong> {formatarData(emprestimoEditando.data_devolucao_prevista)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>
                  Nova Data de Devolução *
                </label>
                <input
                  type="date"
                  value={novoPrazo}
                  onChange={(e) => setNovoPrazo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-yellow-500"
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
