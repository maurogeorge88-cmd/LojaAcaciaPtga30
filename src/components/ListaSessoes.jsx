import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ListaSessoes({ onEditarPresenca, onVisualizarPresenca, onNovaSessao }) {
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState([]);
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);

  // Estados para visitas
  const [visitas, setVisitas] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [potencias, setPotencias] = useState([]);
  const [modalVisita, setModalVisita] = useState(false);
  const [visitaEditando, setVisitaEditando] = useState(null);
  const [visitaForm, setVisitaForm] = useState({
    irmao_id: '',
    data_visita: '',
    nome_loja: '',
    oriente: '',
    potencia_id: '',
    observacoes: ''
  });
  const [editandoPotencia, setEditandoPotencia] = useState(null);
  const [novaPotencia, setNovaPotencia] = useState({ sigla: '', nome_completo: '' });
  const [mostrarFormPotencia, setMostrarFormPotencia] = useState(false);

  const meses = [
    { valor: '', nome: 'Todos os meses' },
    { valor: '1', nome: 'Janeiro' },
    { valor: '2', nome: 'Fevereiro' },
    { valor: '3', nome: 'Março' },
    { valor: '4', nome: 'Abril' },
    { valor: '5', nome: 'Maio' },
    { valor: '6', nome: 'Junho' },
    { valor: '7', nome: 'Julho' },
    { valor: '8', nome: 'Agosto' },
    { valor: '9', nome: 'Setembro' },
    { valor: '10', nome: 'Outubro' },
    { valor: '11', nome: 'Novembro' },
    { valor: '12', nome: 'Dezembro' }
  ];

  const anoAtual = new Date().getFullYear();

  const formatarData = (data) => {
    if (!data) return '';
    const date = new Date(data + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const obterCorPorcentagem = (total, presentes) => {
    if (total === 0) return { background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' };
    const percentual = (presentes / total) * 100;
    if (percentual >= 75) return { background: '#dcfce7', color: '#166534' }; // verde
    if (percentual >= 50) return { background: '#fef9c3', color: '#854d0e' }; // amarelo
    return { background: '#fee2e2', color: '#991b1b' }; // vermelho
  };

  // Buscar anos disponíveis
  useEffect(() => {
    const buscarAnos = async () => {
      const { data } = await supabase
        .from('sessoes_presenca')
        .select('data_sessao')
        .order('data_sessao', { ascending: true });
      
      if (data && data.length > 0) {
        const anos = [...new Set(data.map(s => new Date(s.data_sessao).getFullYear()))];
        const anosSorted = anos.sort((a, b) => b - a);
        setAnosDisponiveis(anosSorted);
        setFiltroAno(anosSorted[0].toString());
      }
    };
    buscarAnos();
  }, []);

  useEffect(() => {
    carregarSessoes();
    carregarVisitas();
  }, [filtroMes, filtroAno]);

  useEffect(() => {
    carregarIrmaos();
    carregarPotencias();
  }, []);

  const carregarSessoes = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('sessoes_presenca')
        .select('*, graus_sessao:grau_sessao_id(nome, grau_minimo_requerido), classificacoes_sessao:classificacao_id(nome)')
        .order('data_sessao', { ascending: false });

      if (filtroAno) {
        const anoInicio = `${filtroAno}-01-01`;
        const anoFim = `${filtroAno}-12-31`;
        query = query.gte('data_sessao', anoInicio).lte('data_sessao', anoFim);
      }

      if (filtroMes && filtroAno) {
        const mesInicio = `${filtroAno}-${filtroMes.padStart(2, '0')}-01`;
        const ultimoDia = new Date(parseInt(filtroAno), parseInt(filtroMes), 0).getDate();
        const mesFim = `${filtroAno}-${filtroMes.padStart(2, '0')}-${ultimoDia}`;
        query = query.gte('data_sessao', mesInicio).lte('data_sessao', mesFim);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Buscar histórico de situações
      const { data: historicoSituacoes } = await supabase
        .from('historico_situacoes')
        .select('*')
        .eq('status', 'ativa');

      const sessoesComPresenca = await Promise.all((data || []).map(async (sessao) => {
        const grauMinimoRaw = sessao?.graus_sessao?.grau_minimo_requerido;
        const grauMinimo = grauMinimoRaw ? parseInt(grauMinimoRaw) : null;
        
        const { data: todosIrmaos } = await supabase
          .from('irmaos')
          .select('id, data_iniciacao, data_ingresso_loja, data_elevacao, data_exaltacao, mestre_instalado, data_instalacao, data_falecimento, situacao');
        
        const { data: registrosPresenca } = await supabase
          .from('registros_presenca')
          .select('membro_id, presente')
          .eq('sessao_id', sessao.id);
        
        const presencaMap = new Map();
        registrosPresenca?.forEach(r => presencaMap.set(r.membro_id, r.presente));
        
        const { count: totalVisitantes } = await supabase
          .from('visitantes_sessao')
          .select('*', { count: 'exact', head: true })
          .eq('sessao_id', sessao.id);
        
        const dataSessao = new Date(sessao.data_sessao + 'T00:00:00');
        const irmaosValidos = todosIrmaos?.filter(irmao => {
          if (!irmao) return false;
          
          const situacaoBloqueadora = historicoSituacoes?.find(sit => {
            if (sit.membro_id !== irmao.id) return false;
            
            const tipoSituacao = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const situacoesQueExcluem = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio'];
            
            if (!situacoesQueExcluem.includes(tipoSituacao)) return false;
            
            const dataInicio = new Date(sit.data_inicio + 'T00:00:00');
            if (dataSessao < dataInicio) return false;
            
            if (sit.data_fim) {
              const dataFim = new Date(sit.data_fim + 'T00:00:00');
              return dataSessao >= dataInicio && dataSessao <= dataFim;
            }
            
            return dataSessao >= dataInicio;
          });
          
          if (situacaoBloqueadora) return false;
          
          const dataIngresso = irmao.data_ingresso_loja 
            ? new Date(irmao.data_ingresso_loja + 'T00:00:00')
            : irmao.data_iniciacao 
            ? new Date(irmao.data_iniciacao + 'T00:00:00')
            : null;
          
          if (!dataIngresso || dataSessao < dataIngresso) return false;
          
          if (irmao.data_falecimento) {
            const dataFalec = new Date(irmao.data_falecimento + 'T00:00:00');
            if (dataSessao > dataFalec) return false;
          }
          
          if (grauMinimo === 2) {
            if (!irmao.data_elevacao) return false;
            const dataElevacao = new Date(irmao.data_elevacao + 'T00:00:00');
            if (dataSessao < dataElevacao) return false;
          } else if (grauMinimo === 3) {
            if (!irmao.data_exaltacao) return false;
            const dataExaltacao = new Date(irmao.data_exaltacao + 'T00:00:00');
            if (dataSessao < dataExaltacao) return false;
          }
          
          return true;
        });

        const total_registros = irmaosValidos?.length || 0;
        const total_presentes = irmaosValidos?.filter(i => presencaMap.get(i.id) === true).length || 0;
        const total_ausentes = total_registros - total_presentes;

        const aprendizes = irmaosValidos?.filter(i => {
          if (!presencaMap.get(i.id)) return false;
          return !i.data_elevacao;
        }).length || 0;

        const companheiros = irmaosValidos?.filter(i => {
          if (!presencaMap.get(i.id)) return false;
          return i.data_elevacao && !i.data_exaltacao;
        }).length || 0;

        // Mestre: exaltado E não instalado (mestre_instalado é false/null)
        const mestres = irmaosValidos?.filter(i => {
          if (!presencaMap.get(i.id)) return false;
          return i.data_exaltacao && !i.mestre_instalado;
        }).length || 0;

        // Mestre Instalado: mestre_instalado = true (independente de ter data_instalacao)
        const mestresInstalados = irmaosValidos?.filter(i => {
          if (!presencaMap.get(i.id)) return false;
          return i.mestre_instalado === true;
        }).length || 0;

        return {
          ...sessao,
          grau_sessao: sessao.graus_sessao?.nome || 'Aprendiz',
          classificacao: sessao.classificacoes_sessao?.nome || null,
          total_registros,
          total_presentes,
          total_ausentes,
          total_visitantes: totalVisitantes || 0,
          graus_presentes: {
            aprendizes,
            companheiros,
            mestres,
            mestres_instalados: mestresInstalados
          }
        };
      }));
      
      setSessoes(sessoesComPresenca);

    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
      setMensagem({
        tipo: 'erro',
        texto: 'Erro ao carregar sessões.'
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarVisitas = async () => {
    try {
      let query = supabase
        .from('visitas_outras_lojas')
        .select(`
          *,
          irmaos(nome),
          potencias_masonicas(sigla, nome_completo)
        `)
        .order('data_visita', { ascending: false });

      if (filtroAno) {
        const anoInicio = `${filtroAno}-01-01`;
        const anoFim = `${filtroAno}-12-31`;
        query = query.gte('data_visita', anoInicio).lte('data_visita', anoFim);
      }

      if (filtroMes && filtroAno) {
        const mesInicio = `${filtroAno}-${filtroMes.padStart(2, '0')}-01`;
        const ultimoDia = new Date(parseInt(filtroAno), parseInt(filtroMes), 0).getDate();
        const mesFim = `${filtroAno}-${filtroMes.padStart(2, '0')}-${ultimoDia}`;
        query = query.gte('data_visita', mesInicio).lte('data_visita', mesFim);
      }

      const { data, error } = await query;
      if (error) throw error;
      setVisitas(data || []);
    } catch (error) {
      console.error('Erro ao carregar visitas:', error);
    }
  };

  const carregarIrmaos = async () => {
    // Buscar irmãos ativos
    const { data: todosIrmaos } = await supabase
      .from('irmaos')
      .select('id, nome, situacao')
      .eq('status', 'ativo')
      .order('nome');

    // Buscar situações ativas mais recentes (sem data_fim)
    const { data: situacoes } = await supabase
      .from('historico_situacoes')
      .select('*')
      .eq('status', 'ativa')
      .is('data_fim', null);

    // Filtrar apenas Regular e Licenciado
    const irmaosValidos = todosIrmaos?.filter(irmao => {
      // Primeiro tenta pelo histórico
      const situacaoHistorico = situacoes?.find(s => s.membro_id === irmao.id);
      
      if (situacaoHistorico) {
        const tipoSituacao = situacaoHistorico.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return tipoSituacao === 'regular' || tipoSituacao === 'licenciado';
      }
      
      // Fallback: se não tem histórico, verifica o campo situacao da tabela irmaos
      if (irmao.situacao) {
        const situacaoIrmao = irmao.situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return situacaoIrmao === 'regular' || situacaoIrmao === 'licenciado';
      }
      
      // Se não tem nenhuma informação de situação, inclui (assume regular)
      return true;
    }) || [];

    setIrmaos(irmaosValidos);
  };

  const carregarPotencias = async () => {
    const { data } = await supabase
      .from('potencias_masonicas')
      .select('*')
      .eq('ativa', true)
      .order('sigla');
    setPotencias(data || []);
  };

  const salvarNovaPotencia = async () => {
    if (!novaPotencia.sigla || !novaPotencia.nome_completo) {
      setMensagem({ tipo: 'erro', texto: 'Preencha sigla e nome completo da potência' });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('potencias_masonicas')
        .insert([{ ...novaPotencia, ativa: true }])
        .select();

      if (error) throw error;

      setMensagem({ tipo: 'sucesso', texto: '✅ Potência cadastrada com sucesso!' });
      setNovaPotencia({ sigla: '', nome_completo: '' });
      setMostrarFormPotencia(false);
      carregarPotencias();
    } catch (error) {
      console.error('Erro ao salvar potência:', error);
      setMensagem({ tipo: 'erro', texto: '❌ Erro ao salvar potência' });
    }
  };

  const atualizarPotencia = async (id, dados) => {
    try {
      const { error } = await supabase
        .from('potencias_masonicas')
        .update(dados)
        .eq('id', id);

      if (error) throw error;

      setMensagem({ tipo: 'sucesso', texto: '✅ Potência atualizada com sucesso!' });
      setEditandoPotencia(null);
      carregarPotencias();
    } catch (error) {
      console.error('Erro ao atualizar potência:', error);
      setMensagem({ tipo: 'erro', texto: '❌ Erro ao atualizar potência' });
    }
  };

  const abrirModalVisita = (visita = null) => {
    if (visita) {
      setVisitaEditando(visita);
      setVisitaForm({
        irmao_id: visita.irmao_id,
        data_visita: visita.data_visita,
        nome_loja: visita.nome_loja,
        oriente: visita.oriente,
        potencia_id: visita.potencia_id,
        observacoes: visita.observacoes || ''
      });
    } else {
      setVisitaEditando(null);
      setVisitaForm({
        irmao_id: '',
        data_visita: '',
        nome_loja: '',
        oriente: '',
        potencia_id: '',
        observacoes: ''
      });
    }
    setModalVisita(true);
  };

  const salvarVisita = async (e) => {
    e.preventDefault();

    if (!visitaForm.irmao_id || !visitaForm.data_visita || !visitaForm.nome_loja || !visitaForm.oriente) {
      setMensagem({ tipo: 'erro', texto: 'Preencha todos os campos obrigatórios' });
      return;
    }

    try {
      if (visitaEditando) {
        const { error } = await supabase
          .from('visitas_outras_lojas')
          .update(visitaForm)
          .eq('id', visitaEditando.id);
        
        if (error) throw error;
        setMensagem({ tipo: 'sucesso', texto: '✅ Visita atualizada com sucesso!' });
      } else {
        const { error } = await supabase
          .from('visitas_outras_lojas')
          .insert([visitaForm]);
        
        if (error) throw error;
        setMensagem({ tipo: 'sucesso', texto: '✅ Visita cadastrada com sucesso!' });
      }

      setModalVisita(false);
      carregarVisitas();
    } catch (error) {
      console.error('Erro ao salvar visita:', error);
      setMensagem({ tipo: 'erro', texto: '❌ Erro ao salvar visita' });
    }
  };

  const excluirVisita = async (id) => {
    if (!confirm('Deseja realmente excluir esta visita?')) return;

    try {
      const { error } = await supabase
        .from('visitas_outras_lojas')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setMensagem({ tipo: 'sucesso', texto: '✅ Visita excluída com sucesso!' });
      carregarVisitas();
    } catch (error) {
      console.error('Erro ao excluir visita:', error);
      setMensagem({ tipo: 'erro', texto: '❌ Erro ao excluir visita' });
    }
  };

  const handleExcluir = async (sessaoId) => {
    if (!confirm('Tem certeza que deseja excluir esta sessão?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sessoes_presenca')
        .delete()
        .eq('id', sessaoId);

      if (error) throw error;

      setMensagem({
        tipo: 'sucesso',
        texto: '✅ Sessão excluída com sucesso!'
      });

      carregarSessoes();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      setMensagem({
        tipo: 'erro',
        texto: '❌ Erro ao excluir sessão'
      });
    }
  };

  const formatarNomeCurto = (nomeCompleto) => {
    if (!nomeCompleto) return '';
    
    const partes = nomeCompleto.trim().split(' ');
    
    // Se tem 2 nomes ou menos, retorna tudo
    if (partes.length <= 2) return nomeCompleto;
    
    // Se tem "de" ou "da", pega primeiro nome + último
    const conectores = ['de', 'da', 'do', 'dos', 'das'];
    const temConector = partes.some(p => conectores.includes(p.toLowerCase()));
    
    if (temConector) {
      return `${partes[0]} ${partes[partes.length - 1]}`;
    }
    
    // Caso contrário, retorna os dois primeiros nomes
    return `${partes[0]} ${partes[1]}`;
  };

  return (
    <div style={{ padding: '2rem', background: 'var(--color-bg)', minHeight: '100vh' }}>
      {/* Cabeçalho */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text)' }}>
              Sessões Realizadas
            </h2>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
              Visualize e gerencie as sessões cadastradas
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => abrirModalVisita()}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'var(--color-warning)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.opacity = '0.9'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              📍 Nova Visita
            </button>
            <button
              onClick={onNovaSessao}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'var(--color-accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--color-accent-hover)'}
              onMouseLeave={(e) => e.target.style.background = 'var(--color-accent)'}
            >
              ➕ Nova Sessão
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="flex-1">
            <label className="form-label">
              Mês
            </label>
            <select
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="form-input"
            >
              {meses.map(mes => (
                <option key={mes.valor} value={mes.valor}>
                  {mes.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="form-label">
              Ano
            </label>
            <select
              value={filtroAno}
              onChange={(e) => setFiltroAno(e.target.value)}
              className="form-input"
            >
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mensagens */}
      {mensagem.texto && (
        <div style={{
          marginBottom: '1rem',
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          background: mensagem.tipo === 'sucesso' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
          color: mensagem.tipo === 'sucesso' ? 'var(--color-success)' : 'var(--color-danger)',
          border: `1px solid ${mensagem.tipo === 'sucesso' ? 'var(--color-success)' : 'var(--color-danger)'}`
        }}>
          {mensagem.texto}
          <button
            onClick={() => setMensagem({ tipo: '', texto: '' })}
            style={{ marginLeft: '1rem', fontSize: '0.875rem', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            Fechar
          </button>
        </div>
      )}

      {/* Lista de Sessões */}
      {loading ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '16rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: 'var(--color-accent)' }}></div>
            <p style={{ marginTop: '1rem', color: 'var(--color-text-muted)' }}>Carregando sessões...</p>
          </div>
        </div>
      ) : sessoes.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <svg className="mx-auto h-12 w-12" style={{ color: 'var(--color-text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 style={{ marginTop: '0.5rem', fontSize: '1.125rem', fontWeight: '500', color: 'var(--color-text)' }}>Nenhuma sessão encontrada</h3>
          <p style={{ marginTop: '0.25rem', color: 'var(--color-text-muted)' }}>
            {filtroMes || filtroAno !== anoAtual.toString() 
              ? 'Tente ajustar os filtros ou cadastre uma nova sessão.'
              : 'Comece cadastrando sua primeira sessão.'
            }
          </p>
          <div className="mt-6">
            <button
              onClick={onNovaSessao}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'var(--color-accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--color-accent-hover)'}
              onMouseLeave={(e) => e.target.style.background = 'var(--color-accent)'}
            >
              Cadastrar Primeira Sessão
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {(() => {
            const sessoesPorMes = {};
            
            sessoes.forEach((sessao) => {
              const data = new Date(sessao.data_sessao + 'T00:00:00');
              const mes = data.getMonth();
              const ano = data.getFullYear();
              const mesAno = `${ano}-${String(mes + 1).padStart(2, '0')}`;
              
              if (!sessoesPorMes[mesAno]) {
                sessoesPorMes[mesAno] = {
                  mesNome: `${meses[mes + 1].nome} de ${ano}`,
                  mes,
                  ano,
                  sessoes: []
                };
              }
              
              sessoesPorMes[mesAno].sessoes.push(sessao);
            });

            return Object.entries(sessoesPorMes).map(([mesAno, grupo]) => (
              <div key={mesAno} className="card" style={{ overflow: 'hidden', padding: 0 }}>
                <div style={{ background: 'var(--color-accent)', padding: '0.75rem 1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'white' }}>
                    📅 {grupo.mesNome}
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  {/* Cabeçalho alinhado com os cards */}
                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'120px 1fr 130px 1fr 70px 120px',
                    gap:'0.75rem',
                    padding:'0.5rem 1rem',
                    background:'var(--color-surface-2)',
                    borderBottom:'2px solid var(--color-accent)',
                    fontSize:'0.7rem',
                    fontWeight:'700',
                    color:'var(--color-text-muted)',
                    textTransform:'uppercase',
                    letterSpacing:'0.05em',
                  }}>
                    <div>Data</div>
                    <div>Tipo de Sessão</div>
                    <div>Classificação</div>
                    <div style={{textAlign:'center'}}>Presença</div>
                    <div style={{textAlign:'center'}}>Visit.</div>
                    <div style={{textAlign:'center'}}>Ações</div>
                  </div>
                  {/* Cards de sessões */}
                  <div style={{display:'flex',flexDirection:'column',gap:'0.4rem',padding:'0.5rem'}}>
                      {grupo.sessoes.map((sessao, idx) => {
                        const totalRegistros = sessao.total_registros || 0;
                        const presentes = sessao.total_presentes || 0;
                        const ausentes = sessao.total_ausentes || 0;
                        const percentual = totalRegistros > 0 ? Math.round((presentes / totalRegistros) * 100) : 0;
                        const corPct = obterCorPorcentagem(totalRegistros, presentes);
                        const graus = sessao.graus_presentes;

                        return (
                          <div
                            key={sessao.id}
                            style={{
                              display:'grid',
                              gridTemplateColumns:'120px 1fr 130px 1fr 70px 120px',
                              alignItems:'center',
                              gap:'0.75rem',
                              padding:'0.65rem 1rem',
                              borderRadius:'var(--radius-lg)',
                              border:'1px solid var(--color-border)',
                              borderLeft:'4px solid var(--color-accent)',
                              background: idx%2===0 ? 'var(--color-surface-2)' : 'var(--color-surface)',
                              transition:'opacity 0.15s',
                            }}
                          >
                            {/* Data */}
                            <div style={{fontSize:'0.85rem',fontWeight:'600',color:'var(--color-text)',whiteSpace:'nowrap'}}>
                              {formatarData(sessao.data_sessao)}
                            </div>
                            {/* Tipo de Sessão */}
                            <div style={{fontSize:'0.85rem',color:'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                              {sessao.grau_sessao}
                            </div>
                            {/* Classificação */}
                            <div>
                              <span style={{
                                padding:'0.15rem 0.55rem',
                                fontSize:'0.72rem',
                                fontWeight:'700',
                                borderRadius:'999px',
                                background: sessao.classificacao ? 'rgba(245,158,11,0.15)' : 'var(--color-surface-2)',
                                color: sessao.classificacao ? '#f59e0b' : 'var(--color-text-muted)',
                                border: sessao.classificacao ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--color-border)',
                                whiteSpace:'nowrap',
                              }}>
                                {sessao.classificacao || '—'}
                              </span>
                            </div>
                            {/* Presença — 3 linhas centralizadas */}
                            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0.2rem',textAlign:'center'}}>
                              {/* Linha 1: percentual */}
                              <span style={{...corPct,padding:'0.15rem 0.7rem',borderRadius:'999px',fontSize:'0.82rem',fontWeight:'700',whiteSpace:'nowrap'}}>
                                {percentual}% ({presentes}/{totalRegistros})
                              </span>
                              {/* Linha 2: ausentes */}
                              {totalRegistros > 0 && (
                                <span style={{fontSize:'0.72rem',color:'var(--color-text-muted)',whiteSpace:'nowrap'}}>
                                  {ausentes} ausente(s)
                                </span>
                              )}
                              {/* Linha 3: badges de grau */}
                              {graus && presentes > 0 && (
                                <div style={{display:'flex',gap:'0.25rem',flexWrap:'nowrap',justifyContent:'center'}}>
                                  {graus.aprendizes > 0 && (
                                    <span style={{padding:'0.1rem 0.4rem',background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.3)',borderRadius:'var(--radius-sm)',fontSize:'0.7rem',fontWeight:'700',whiteSpace:'nowrap'}}>
                                      A:{graus.aprendizes}
                                    </span>
                                  )}
                                  {graus.companheiros > 0 && (
                                    <span style={{padding:'0.1rem 0.4rem',background:'rgba(59,130,246,0.15)',color:'#3b82f6',border:'1px solid rgba(59,130,246,0.3)',borderRadius:'var(--radius-sm)',fontSize:'0.7rem',fontWeight:'700',whiteSpace:'nowrap'}}>
                                      C:{graus.companheiros}
                                    </span>
                                  )}
                                  {graus.mestres > 0 && (
                                    <span style={{padding:'0.1rem 0.4rem',background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)',borderRadius:'var(--radius-sm)',fontSize:'0.7rem',fontWeight:'700',whiteSpace:'nowrap'}}>
                                      M:{graus.mestres}
                                    </span>
                                  )}
                                  {graus.mestres_instalados > 0 && (
                                    <span style={{padding:'0.1rem 0.4rem',background:'rgba(139,92,246,0.15)',color:'#8b5cf6',border:'1px solid rgba(139,92,246,0.3)',borderRadius:'var(--radius-sm)',fontSize:'0.7rem',fontWeight:'700',whiteSpace:'nowrap'}}>
                                      M.I:{graus.mestres_instalados}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Visitantes */}
                            <div style={{textAlign:'center'}}>
                              <span style={{padding:'0.15rem 0.55rem',background:'rgba(59,130,246,0.15)',color:'#3b82f6',border:'1px solid rgba(59,130,246,0.3)',borderRadius:'999px',fontSize:'0.8rem',fontWeight:'600'}}>
                                {sessao.total_visitantes}
                              </span>
                            </div>
                            {/* Ações */}
                            <div style={{display:'flex',gap:'0.3rem',justifyContent:'flex-end'}}>
                              <button
                                onClick={() => onVisualizarPresenca(sessao.id)}
                                style={{padding:'0.35rem 0.7rem',background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)',borderRadius:'var(--radius-md)',fontSize:'0.78rem',fontWeight:'700',cursor:'pointer',whiteSpace:'nowrap'}}
                                title="Visualizar"
                              >
                                👁️
                              </button>
                              <button
                                onClick={() => onEditarPresenca(sessao.id)}
                                style={{padding:'0.35rem 0.7rem',background:'var(--color-accent-bg)',color:'var(--color-accent)',border:'1px solid var(--color-accent)',borderRadius:'var(--radius-md)',fontSize:'0.78rem',fontWeight:'700',cursor:'pointer',whiteSpace:'nowrap'}}
                                title="Editar"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleExcluir(sessao.id)}
                                style={{padding:'0.35rem 0.7rem',background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'var(--radius-md)',fontSize:'0.78rem',fontWeight:'700',cursor:'pointer',whiteSpace:'nowrap'}}
                                title="Excluir"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* VISITAS DO MÊS */}
                {(() => {
                  const visitasDoMes = visitas.filter(v => {
                    const dataVisita = new Date(v.data_visita + 'T00:00:00');
                    return dataVisita.getMonth() === grupo.mes && dataVisita.getFullYear() === grupo.ano;
                  });

                  if (visitasDoMes.length === 0) return null;

                  return (
                    <div style={{ borderTop: '4px dashed var(--color-warning)', marginTop: '1rem' }}>
                      <div style={{ background: 'var(--color-warning-bg)', padding: '0.75rem 1.5rem' }}>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--color-warning)' }}>
                          📍 Visitas dos Irmãos a Outras Lojas
                        </h4>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-3 gap-3">
                          {visitasDoMes.map(visita => (
                            <div 
                              key={visita.id} 
                              className="card" 
                              style={{ 
                                padding: '0.75rem',
                                border: '1px solid var(--color-warning)',
                                transition: 'box-shadow 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}
                              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                            >
                              {/* Linha 1: Data, Nome e Botões */}
                              <div className="flex justify-between items-center mb-1">
                                <div className="text-sm">
                                  <span style={{ color: 'var(--color-text-muted)' }}>{new Date(visita.data_visita + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                  <span style={{ color: 'var(--color-text-muted)' }}> - </span>
                                  <span style={{ fontWeight: '600', color: 'var(--color-text)' }}>{formatarNomeCurto(visita.irmaos?.nome)}</span>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => abrirModalVisita(visita)}
                                    className="p-1 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors text-xs"
                                    title="Editar"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => excluirVisita(visita.id)}
                                    className="p-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs"
                                    title="Excluir"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                              
                              {/* Linha 2: Loja - Potência - Oriente */}
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                {visita.nome_loja} - {visita.potencias_masonicas?.sigla || 'N/A'} - {visita.oriente}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ));
          })()}
        </div>
      )}

      {/* Resumo */}
      {sessoes.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <p className="text-sm text-blue-800">
            <strong>Total:</strong> {sessoes.length} sessão(ões) encontrada(s)
            {filtroMes && ` em ${meses.find(m => m.valor === filtroMes)?.nome}`}
            {filtroAno && ` de ${filtroAno}`}
          </p>
        </div>
      )}

      {/* MODAL */}
      {modalVisita && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="bg-purple-600 text-white p-6">
              <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>
                {visitaEditando ? '✏️ Editar Visita' : '➕ Nova Visita'}
              </h3>
            </div>

            <form onSubmit={salvarVisita} className="p-6 space-y-4">
              <div>
                <label className="form-label">Irmão Visitante *</label>
                <select
                  value={visitaForm.irmao_id}
                  onChange={(e) => setVisitaForm({ ...visitaForm, irmao_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-purple-500"
                  required
                >
                  <option value="">Selecione...</option>
                  {irmaos.map(irmao => (
                    <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Data da Visita *</label>
                <input
                  type="date"
                  value={visitaForm.data_visita}
                  onChange={(e) => setVisitaForm({ ...visitaForm, data_visita: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-purple-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Nome da Loja *</label>
                  <input
                    type="text"
                    value={visitaForm.nome_loja}
                    onChange={(e) => setVisitaForm({ ...visitaForm, nome_loja: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-purple-500"
                    placeholder="Ex: Acácia do Cerrado"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Oriente (Município) *</label>
                  <input
                    type="text"
                    value={visitaForm.oriente}
                    onChange={(e) => setVisitaForm({ ...visitaForm, oriente: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-purple-500"
                    placeholder="Ex: Cuiabá"
                    required
                  />
                </div>
              </div>

              {/* Potência com gerenciador */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium" style={{color:"var(--color-text-muted)"}}>Potência Maçônica</label>
                  <button
                    type="button"
                    onClick={() => setMostrarFormPotencia(!mostrarFormPotencia)}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                  >
                    {mostrarFormPotencia ? '✖ Cancelar' : '➕ Nova Potência'}
                  </button>
                </div>

                {/* Formulário para nova potência */}
                {mostrarFormPotencia && (
                  <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Sigla (ex: GLESP)"
                        value={novaPotencia.sigla}
                        onChange={(e) => setNovaPotencia({ ...novaPotencia, sigla: e.target.value.toUpperCase() })}
                        className="px-2 py-1 text-sm border rounded focus:ring-purple-500"
                      />
                      <input
                        type="text"
                        placeholder="Nome completo"
                        value={novaPotencia.nome_completo}
                        onChange={(e) => setNovaPotencia({ ...novaPotencia, nome_completo: e.target.value })}
                        className="px-2 py-1 text-sm border rounded focus:ring-purple-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={salvarNovaPotencia}
                      className="w-full px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
                    >
                      💾 Salvar Potência
                    </button>
                  </div>
                )}

                {/* Lista de potências existentes */}
                <div className="space-y-2">
                  {potencias.map(pot => (
                    <div key={pot.id} className="flex items-center gap-2">
                      {editandoPotencia === pot.id ? (
                        <>
                          <input
                            type="text"
                            defaultValue={pot.sigla}
                            onBlur={(e) => atualizarPotencia(pot.id, { sigla: e.target.value })}
                            className="flex-1 px-2 py-1 text-sm border border-purple-300 rounded focus:ring-purple-500"
                          />
                          <input
                            type="text"
                            defaultValue={pot.nome_completo}
                            onBlur={(e) => atualizarPotencia(pot.id, { nome_completo: e.target.value })}
                            className="flex-1 px-2 py-1 text-sm border border-purple-300 rounded focus:ring-purple-500"
                          />
                          <button
                            type="button"
                            onClick={() => setEditandoPotencia(null)}
                            className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-primary-700"
                          >
                            ✓
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            type="radio"
                            name="potencia"
                            value={pot.id}
                            checked={visitaForm.potencia_id === pot.id.toString()}
                            onChange={(e) => setVisitaForm({ ...visitaForm, potencia_id: e.target.value })}
                            className="w-4 h-4 text-purple-600"
                          />
                          <span className="flex-1 text-sm">
                            <span className="font-medium">{pot.sigla}</span> - {pot.nome_completo}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditandoPotencia(pot.id)}
                            className="px-2 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700"
                            title="Editar potência"
                          >
                            ✏️
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label">Observações</label>
                <textarea
                  value={visitaForm.observacoes}
                  onChange={(e) => setVisitaForm({ ...visitaForm, observacoes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-purple-500"
                  rows="3"
                  placeholder="Informações adicionais..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalVisita(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  ❌ Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  💾 Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
