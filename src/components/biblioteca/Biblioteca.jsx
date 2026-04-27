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
  const [modalLivroAberto, setModalLivroAberto] = useState(false);

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
      setModalLivroAberto(false);
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
    setModalLivroAberto(true);
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
    <div className="space-y-6" style={{background:"var(--color-bg)",minHeight:"100vh",padding:"0.5rem",overflowX:"hidden"}}>
      {/* ABAS */}
      <div className="rounded-xl p-2 flex gap-2" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <button
          onClick={() => setAbaAtiva('livros')}
          style={{flex:1,padding:'0.75rem 1rem',borderRadius:'var(--radius-lg)',fontWeight:'600',cursor:'pointer',border:'none',transition:'all 0.15s',background:abaAtiva==='livros'?'var(--color-accent)':'var(--color-surface-2)',color:abaAtiva==='livros'?'#fff':'var(--color-text)'}}
        >
          📚 Livros ({livros.length})
        </button>
        <button
          onClick={() => setAbaAtiva('emprestimos')}
          style={{flex:1,padding:'0.75rem 1rem',borderRadius:'var(--radius-lg)',fontWeight:'600',cursor:'pointer',border:'none',transition:'all 0.15s',background:abaAtiva==='emprestimos'?'var(--color-accent)':'var(--color-surface-2)',color:abaAtiva==='emprestimos'?'#fff':'var(--color-text)'}}
        >
          📖 Empréstimos Ativos ({emprestimosAtivos.length})
        </button>
        <button
          onClick={() => setAbaAtiva('devolvidos')}
          style={{flex:1,padding:'0.75rem 1rem',borderRadius:'var(--radius-lg)',fontWeight:'600',cursor:'pointer',border:'none',transition:'all 0.15s',background:abaAtiva==='devolvidos'?'var(--color-accent)':'var(--color-surface-2)',color:abaAtiva==='devolvidos'?'#fff':'var(--color-text)'}}
        >
          ✅ Devolvidos ({emprestimosDevolvidos.length})
        </button>
        <button
          onClick={() => setAbaAtiva('por-irmao')}
          style={{flex:1,padding:'0.75rem 1rem',borderRadius:'var(--radius-lg)',fontWeight:'600',cursor:'pointer',border:'none',transition:'all 0.15s',background:abaAtiva==='por-irmao'?'var(--color-accent)':'var(--color-surface-2)',color:abaAtiva==='por-irmao'?'#fff':'var(--color-text)'}}
        >
          👤 Por Irmão
        </button>
        <button
          onClick={() => setAbaAtiva('fila')}
          style={{flex:1,padding:'0.75rem 1rem',borderRadius:'var(--radius-lg)',fontWeight:'600',cursor:'pointer',border:'none',transition:'all 0.15s',background:abaAtiva==='fila'?'var(--color-accent)':'var(--color-surface-2)',color:abaAtiva==='fila'?'#fff':'var(--color-text)'}}
        >
          ⏳ Fila de Espera
        </button>
      </div>

      {/* ABA LIVROS */}
      {abaAtiva === 'livros' && (
        <div className="space-y-6">
          {/* BOTÃO CADASTRAR */}
          {permissoes?.pode_editar_biblioteca && (
            <div style={{display:'flex',justifyContent:'flex-end'}}>
              <button
                onClick={() => { limparFormularioLivro(); setModalLivroAberto(true); }}
                style={{padding:'0.55rem 1.25rem',background:'var(--color-accent)',color:'#fff',border:'none',borderRadius:'var(--radius-lg)',fontWeight:'700',cursor:'pointer',fontSize:'0.875rem'}}
              >
                ➕ Cadastrar Novo Livro
              </button>
            </div>
          )}          )}

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
                <div style={{padding:'1rem',fontWeight:'700',fontSize:'1.05rem',color:'#fff',background:grau==='Aprendiz'?'#10b981':grau==='Companheiro'?'var(--color-accent)':'#8b5cf6'}}>
                  {grau === 'Aprendiz' && '🟢'} {grau === 'Companheiro' && '🔵'} {grau === 'Mestre' && '🟣'} {grau} ({livrosDoGrau.length})
                </div>

                <div className="p-3 space-y-2">
                      {livrosDoGrau.map((livro, livroIdx) => {
                        const disponivel = obterQuantidadeDisponivel(livro.id);
                        return (
                          <div key={livro.id}
                            className="rounded-lg border-l-4 flex items-center gap-3 px-4 py-3 transition-opacity hover:opacity-90"
                            style={{
                              borderLeftColor: disponivel > 0 ? '#10b981' : '#ef4444',
                              background: livroIdx%2===0 ? 'var(--color-surface)' : 'var(--color-surface-2)'
                            }}
                          >
                            <div style={{flex:3,minWidth:0}}>
                              <p className="font-semibold text-sm leading-snug" style={{color:'var(--color-text)'}}>{livro.titulo}</p>
                              <p className="text-xs mt-0.5" style={{color:'var(--color-text-muted)'}}>{livro.autor || '—'}</p>
                            </div>
                            <div style={{flex:'0 0 90px'}}>
                              <span style={{padding:"0.1rem 0.5rem",borderRadius:"var(--radius-sm)",fontSize:"0.7rem",fontWeight:"600",background:"var(--color-accent-bg)",color:"var(--color-accent)",border:"1px solid var(--color-accent)"}}>{livro.categoria}</span>
                            </div>
                            <div style={{flex:'0 0 120px'}}>
                              <p className="text-xs" style={{color:'var(--color-text-muted)'}}>{livro.localizacao || '—'}</p>
                            </div>
                            <div style={{flex:'0 0 50px',textAlign:'center'}}>
                              <span style={{padding:'0.1rem 0.5rem',borderRadius:'var(--radius-sm)',fontSize:'0.7rem',fontWeight:'700',background:disponivel>0?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.15)',color:disponivel>0?'#10b981':'#ef4444',border:`1px solid ${disponivel>0?'rgba(16,185,129,0.3)':'rgba(239,68,68,0.3)'}`}}>
                                {disponivel}/{livro.quantidade_total}
                              </span>
                            </div>
                            {permissoes?.pode_editar_biblioteca && (
                              <div className="flex gap-1.5" style={{flexShrink:0}}>
                                <button onClick={() => editarLivro(livro)}
                                  style={{padding:"0.25rem 0.55rem",background:"var(--color-accent-bg)",color:"var(--color-accent)",border:"1px solid var(--color-accent)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}>
                                  ✏️
                                </button>
                                <button onClick={() => excluirLivro(livro.id)}
                                  style={{padding:"0.25rem 0.55rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}>
                                  🗑️
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
              <div style={{background:"#10b981",padding:"1rem 1.5rem"}}>
                <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>📖 Registrar Novo Empréstimo</h3>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>Livro *</label>
                    <select
                      value={emprestimoForm.livro_id}
                      onChange={(e) => setEmprestimoForm({ ...emprestimoForm, livro_id: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-green-500" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
                      className="w-full px-3 py-2 border rounded-lg focus:ring-green-500" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
                      className="w-full px-3 py-2 border rounded-lg focus:ring-green-500" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
            <div style={{padding:"1rem",background:"var(--color-accent)",borderRadius:"0.5rem 0.5rem 0 0"}}>
              <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>📖 Empréstimos Ativos</h3>
              <p style={{color:"rgba(255,255,255,0.85)",fontSize:"0.82rem",margin:"0.2rem 0 0"}}>{emprestimosAtivos.length} empréstimo(s) ativo(s)</p>
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
              </table>
                <div className="p-3 space-y-2">
                  {emprestimosAtivos.length > 0 ? (
                    emprestimosAtivos.map((emprestimo, idx) => (
                      <div key={emprestimo.id}
                        className="rounded-lg border-l-4 flex items-center gap-3 px-4 py-3 transition-opacity hover:opacity-90"
                        style={{
                          borderLeftColor: estaAtrasado(emprestimo.data_devolucao_prevista) ? '#ef4444' : '#10b981',
                          background: idx%2===0 ? 'var(--color-surface)' : 'var(--color-surface-2)'
                        }}
                      >
                        <div style={{flex:2,minWidth:0}}>
                          <p className="font-semibold text-sm" style={{color:'var(--color-text)'}}>{obterTituloLivro(emprestimo.livro_id)}</p>
                          <p className="text-xs mt-0.5" style={{color:'var(--color-text-muted)'}}>{obterNomeIrmao(emprestimo.irmao_id)}</p>
                        </div>
                        <div style={{flex:'0 0 90px'}}>
                          <p className="text-xs" style={{color:'var(--color-text-muted)'}}>📅 {formatarData(emprestimo.data_emprestimo)}</p>
                          <p className="text-xs mt-0.5" style={{color:'var(--color-text-muted)'}}>↩ {formatarData(emprestimo.data_devolucao_prevista)}</p>
                        </div>
                        <div style={{flex:'0 0 90px',textAlign:'center'}}>
                          <span style={{padding:'0.1rem 0.5rem',borderRadius:'var(--radius-sm)',fontSize:'0.7rem',fontWeight:'700',background:estaAtrasado(emprestimo.data_devolucao_prevista)?'rgba(239,68,68,0.15)':'rgba(16,185,129,0.15)',color:estaAtrasado(emprestimo.data_devolucao_prevista)?'#ef4444':'#10b981',border:`1px solid ${estaAtrasado(emprestimo.data_devolucao_prevista)?'rgba(239,68,68,0.3)':'rgba(16,185,129,0.3)'}`}}>
                            {estaAtrasado(emprestimo.data_devolucao_prevista) ? '⚠️ Atrasado' : '✅ No prazo'}
                          </span>
                        </div>
                        {permissoes?.pode_editar_biblioteca && (
                          <div className="flex gap-1.5" style={{flexShrink:0}}>
                            <button onClick={() => devolverLivro(emprestimo.id, emprestimo.livro_id)}
                              style={{padding:"0.25rem 0.55rem",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.78rem",fontWeight:"600",cursor:"pointer"}}>
                              ✅ Devolver
                            </button>
                            <button onClick={() => abrirModalEditarPrazo(emprestimo)}
                              style={{padding:"0.25rem 0.55rem",background:"rgba(245,158,11,0.15)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.78rem",fontWeight:"600",cursor:"pointer"}}>
                              📅
                            </button>
                            <button onClick={() => excluirEmprestimo(emprestimo.id, emprestimo.livro_id, emprestimo.status)}
                              style={{padding:"0.25rem 0.55rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.78rem",fontWeight:"600",cursor:"pointer"}}>
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8" style={{color:'var(--color-text-faint)'}}>
                      Nenhum empréstimo ativo no momento
                    </div>
                  )}
                </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA DEVOLVIDOS */}
      {abaAtiva === 'devolvidos' && (
        <div>
          <div className="rounded-xl overflow-hidden">
            <div style={{padding:"1rem",background:"var(--color-accent)",borderRadius:"0.5rem 0.5rem 0 0"}}>
              <h3 className="text-xl font-bold" style={{color:"#fff"}}>✅ Devoluções Realizadas</h3>
              <p className="text-sm" style={{color:"rgba(255,255,255,0.8)"}}>{emprestimosDevolvidos.length} devolução(ões) registrada(s)</p>
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
              </table>
                <div className="p-3 space-y-2">
                  {emprestimosDevolvidos.length > 0 ? (
                    emprestimosDevolvidos
                      .sort((a, b) => new Date(b.data_devolucao_real) - new Date(a.data_devolucao_real))
                      .map((emprestimo, idx) => {
                        const devolveuAtrasado = new Date(emprestimo.data_devolucao_real) > new Date(emprestimo.data_devolucao_prevista);
                        return (
                          <div key={emprestimo.id}
                            className="rounded-lg border-l-4 flex items-center gap-3 px-4 py-3 transition-opacity hover:opacity-90"
                            style={{
                              borderLeftColor: devolveuAtrasado ? '#f97316' : '#10b981',
                              background: idx%2===0 ? 'var(--color-surface)' : 'var(--color-surface-2)'
                            }}
                          >
                            <div style={{flex:2,minWidth:0}}>
                              <p className="font-semibold text-sm" style={{color:'var(--color-text)'}}>{obterTituloLivro(emprestimo.livro_id)}</p>
                              <p className="text-xs mt-0.5" style={{color:'var(--color-text-muted)'}}>{obterNomeIrmao(emprestimo.irmao_id)}</p>
                            </div>
                            <div style={{flex:'0 0 100px'}}>
                              <p className="text-xs" style={{color:'var(--color-text-muted)'}}>📅 {formatarData(emprestimo.data_emprestimo)}</p>
                              <p className="text-xs mt-0.5" style={{color:'var(--color-text-muted)'}}>↩ {formatarData(emprestimo.data_devolucao_real)}</p>
                            </div>
                            <div style={{flex:'0 0 80px',textAlign:'center'}}>
                              <span style={{padding:'0.1rem 0.5rem',borderRadius:'var(--radius-sm)',fontSize:'0.7rem',fontWeight:'700',background:devolveuAtrasado?'rgba(245,158,11,0.15)':'rgba(16,185,129,0.15)',color:devolveuAtrasado?'#f59e0b':'#10b981',border:`1px solid ${devolveuAtrasado?'rgba(245,158,11,0.3)':'rgba(16,185,129,0.3)'}`}}>
                                {devolveuAtrasado ? 'Atrasado' : 'No prazo'}
                              </span>
                            </div>
                            {permissoes?.pode_editar_biblioteca && (
                              <div style={{flexShrink:0}}>
                                <button onClick={() => excluirEmprestimo(emprestimo.id, emprestimo.livro_id, emprestimo.status)}
                                  style={{padding:"0.25rem 0.55rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.78rem",cursor:"pointer"}}>
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center py-8" style={{color:'var(--color-text-faint)'}}>
                      Nenhuma devolução registrada
                    </div>
                  )}
                </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA POR IRMÃO */}
      {abaAtiva === 'por-irmao' && (
        <div>
          <div className="rounded-xl overflow-hidden">
            <div style={{background:"#8b5cf6",padding:"1rem 1.5rem"}}>
              <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>Empréstimos por Irmão</h3>
              <p style={{color:"rgba(255,255,255,0.85)",fontSize:"0.82rem",margin:"0.2rem 0 0"}}>
                {emprestimosPorIrmao.length} irmão(s) com empréstimos registrados
              </p>
            </div>

            <div className="p-6 space-y-6">
              {emprestimosPorIrmao.length > 0 ? (
                emprestimosPorIrmao.map((item) => (
                  <div key={item.irmao.id} className="border rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                    <div className="flex justify-between items-center mb-4">
                      <h4 style={{fontSize:"1rem",fontWeight:"700",color:"var(--color-text)",margin:0}}>{item.irmao.nome}</h4>
                      <div className="flex gap-4">
                        <span style={{padding:"0.2rem 0.75rem",borderRadius:"var(--radius-md)",fontSize:"0.78rem",fontWeight:"700",background:"var(--color-accent-bg)",color:"var(--color-accent)",border:"1px solid var(--color-accent)"}}>
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
                      </table>
                        <div className="p-2 space-y-1.5">
                          {item.emprestimos.map((emprestimo, eIdx) => (
                            <div key={emprestimo.id}
                              className="rounded-lg border-l-4 flex items-center gap-3 px-3 py-2"
                              style={{
                                borderLeftColor: emprestimo.status === 'devolvido' ? '#10b981' : estaAtrasado(emprestimo.data_devolucao_prevista) ? '#ef4444' : 'var(--color-accent)',
                                background: eIdx%2===0 ? 'var(--color-surface)' : 'var(--color-surface-2)'
                              }}
                            >
                              <p className="text-sm flex-1" style={{color:'var(--color-text)'}}>{obterTituloLivro(emprestimo.livro_id)}</p>
                              <p className="text-xs" style={{color:'var(--color-text-muted)'}}>📅 {formatarData(emprestimo.data_emprestimo)}</p>
                              <span style={{padding:'0.1rem 0.5rem',borderRadius:'var(--radius-sm)',fontSize:'0.7rem',fontWeight:'700',background:emprestimo.status==='emprestado'?(estaAtrasado(emprestimo.data_devolucao_prevista)?'rgba(239,68,68,0.15)':'rgba(59,130,246,0.15)'):'rgba(16,185,129,0.15)',color:emprestimo.status==='emprestado'?(estaAtrasado(emprestimo.data_devolucao_prevista)?'#ef4444':'#3b82f6'):'#10b981',border:'1px solid transparent'}}>
                                {emprestimo.status === 'emprestado' ? (estaAtrasado(emprestimo.data_devolucao_prevista) ? 'Atrasado' : 'Ativo') : 'Devolvido'}
                              </span>
                              {emprestimo.status === 'emprestado' && permissoes?.pode_editar_biblioteca && (
                                <button onClick={() => devolverLivro(emprestimo.id, emprestimo.livro_id)}
                                  style={{padding:"0.2rem 0.5rem",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.72rem",cursor:"pointer"}}>
                                  ✅ Devolver
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12" style={{color:"var(--color-text-muted)"}}>
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
                  style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:"50%",padding:"0.4rem",cursor:"pointer"}}
                >
                  ✖️
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p style={{fontSize:"0.85rem",color:"var(--color-text)",marginBottom:"0.5rem"}}>
                  <strong>Livro:</strong> {obterTituloLivro(emprestimoEditando.livro_id)}
                </p>
                <p style={{fontSize:"0.85rem",color:"var(--color-text)",marginBottom:"0.5rem"}}>
                  <strong>Irmão:</strong> {obterNomeIrmao(emprestimoEditando.irmao_id)}
                </p>
                <p style={{fontSize:"0.85rem",color:"var(--color-text)",marginBottom:"1rem"}}>
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-yellow-500" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
                  style={{padding:"0.5rem 1.5rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}
                >
                  ❌ Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
{/* MODAL CADASTRO/EDIÇÃO DE LIVRO */}
      {modalLivroAberto && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:'1rem'}}>
          <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',width:'100%',maxWidth:'560px',maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 24px 64px rgba(0,0,0,0.3)'}}>
            {/* Header */}
            <div style={{background:'var(--color-accent)',padding:'1rem 1.5rem',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
              <h3 style={{color:'#fff',fontWeight:'800',margin:0,fontSize:'1.05rem'}}>
                {modoEdicaoLivro ? '✏️ Editar Livro' : '➕ Cadastrar Novo Livro'}
              </h3>
              <button onClick={() => { limparFormularioLivro(); setModalLivroAberto(false); }}
                style={{background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',borderRadius:'50%',width:'2rem',height:'2rem',cursor:'pointer',fontWeight:'700',fontSize:'1.1rem'}}>×</button>
            </div>
            {/* Body */}
            <div style={{overflowY:'auto',padding:'1.25rem',display:'flex',flexDirection:'column',gap:'0.75rem'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                <div style={{gridColumn:'1 / -1'}}>
                  <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.3rem'}}>Título *</label>
                  <input type="text" value={livroForm.titulo} onChange={(e) => setLivroForm({...livroForm,titulo:e.target.value})} placeholder="Ex: Ritual do Aprendiz Maçom" style={{background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem',width:'100%'}} />
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.3rem'}}>Autor</label>
                  <input type="text" value={livroForm.autor} onChange={(e) => setLivroForm({...livroForm,autor:e.target.value})} placeholder="Ex: Rizzardo da Camino" style={{background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem',width:'100%'}} />
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.3rem'}}>Categoria</label>
                  <select value={livroForm.categoria} onChange={(e) => setLivroForm({...livroForm,categoria:e.target.value})} style={{background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem',width:'100%'}}>
                    <option value="Ritualística">Ritualística</option>
                    <option value="Filosofia">Filosofia</option>
                    <option value="História">História</option>
                    <option value="Simbolismo">Simbolismo</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.3rem'}}>Grau</label>
                  <select value={livroForm.grau} onChange={(e) => setLivroForm({...livroForm,grau:e.target.value})} style={{background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem',width:'100%'}}>
                    <option value="Aprendiz">Aprendiz</option>
                    <option value="Companheiro">Companheiro</option>
                    <option value="Mestre">Mestre</option>
                  </select>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.3rem'}}>Localização</label>
                  <input type="text" value={livroForm.localizacao} onChange={(e) => setLivroForm({...livroForm,localizacao:e.target.value})} placeholder="Ex: Estante 2 - Prateleira B" style={{background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem',width:'100%'}} />
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.3rem'}}>Quantidade Total</label>
                  <input type="number" min="1" value={livroForm.quantidade_total} onChange={(e) => setLivroForm({...livroForm,quantidade_total:parseInt(e.target.value)||1,quantidade_disponivel:parseInt(e.target.value)||1})} style={{background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem',width:'100%'}} />
                </div>
              </div>
            </div>
            {/* Footer */}
            <div style={{padding:'1rem 1.25rem',borderTop:'1px solid var(--color-border)',display:'flex',gap:'0.5rem',flexShrink:0}}>
              <button onClick={() => { limparFormularioLivro(); setModalLivroAberto(false); }}
                style={{flex:1,padding:'0.6rem',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',fontWeight:'600',cursor:'pointer'}}>
                Cancelar
              </button>
              <button onClick={salvarLivro} disabled={loading}
                style={{flex:2,padding:'0.6rem',background:loading?'var(--color-surface-3)':'var(--color-accent)',color:'#fff',border:'none',borderRadius:'var(--radius-lg)',fontWeight:'700',cursor:loading?'not-allowed':'pointer'}}>
                {loading ? 'Salvando...' : (modoEdicaoLivro ? '💾 Salvar Alterações' : '➕ Cadastrar Livro')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Biblioteca;
