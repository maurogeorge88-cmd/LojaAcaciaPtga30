import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ModalComposicaoLoja from './ModalComposicaoLoja';

export default function ListaSessoes({ onEditarPresenca, onVisualizarPresenca }) {
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState([]);
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [sessaoComposicao, setSessaoComposicao] = useState(null);

  // Meses recolhidos: só o mês atual abre por padrão (se o usuário filtrou um mês, ele abre)
  const mesAtualKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [mesesAbertos, setMesesAbertos] = useState({});
  const isMesAberto = (mesKey) => (mesKey in mesesAbertos ? mesesAbertos[mesKey] : (mesKey === mesAtualKey || !!filtroMes));
  const toggleMes = (mesKey) => setMesesAbertos(prev => ({ ...prev, [mesKey]: !isMesAberto(mesKey) }));
  // ao trocar o filtro, volta ao padrão (atual aberto, demais recolhidos)
  useEffect(() => { setMesesAbertos({}); }, [filtroMes, filtroAno]);

  // Estados para visitas
  const [visitas, setVisitas] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [potencias, setPotencias] = useState([]);
  const [modalVisita, setModalVisita] = useState(false);
  // Cadastro único de Lojas Maçônicas (mesmo usado nas visitas recebidas)
  const [lojasCadastro, setLojasCadastro] = useState([]);
  const carregarLojasCadastro = async () => {
    const { data } = await supabase.from('lojas_visitantes').select('*').eq('ativa', true)
      .order('eh_potencia', { ascending: false }).order('nome');
    setLojasCadastro(data || []);
  };
  useEffect(() => { carregarLojasCadastro(); }, []);
  const nomeLojaVisita = (v) => {
    const l = lojasCadastro.find(x => String(x.id) === String(v.loja_id));
    return l ? `${l.eh_potencia ? '' : `${l.prefixo || 'ARLS'} `}${l.nome}` : (v.nome_loja || '');
  };
  const orienteVisita = (v) => {
    const l = lojasCadastro.find(x => String(x.id) === String(v.loja_id));
    return l ? l.oriente : (v.oriente || '');
  };
  const [visitaEditando, setVisitaEditando] = useState(null);
  const [visitaForm, setVisitaForm] = useState({
    irmao_id: '',
    data_visita: '',
    nome_loja: '',
    oriente: '',
    loja_id: '',
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

  // Cores do % de presença (tons translúcidos — funcionam em temas claros e escuros)
  const obterCorPorcentagem = (total, presentes) => {
    if (total === 0) return { fundo: 'var(--color-surface-2)', texto: 'var(--color-text-muted)', borda: 'var(--color-border)', barra: 'var(--color-border)' };
    const percentual = (presentes / total) * 100;
    if (percentual >= 75) return { fundo: 'rgba(16,185,129,0.15)', texto: '#10b981', borda: 'rgba(16,185,129,0.35)', barra: '#10b981' };
    if (percentual >= 50) return { fundo: 'rgba(245,158,11,0.15)', texto: '#f59e0b', borda: 'rgba(245,158,11,0.35)', barra: '#f59e0b' };
    return { fundo: 'rgba(239,68,68,0.15)', texto: '#ef4444', borda: 'rgba(239,68,68,0.35)', barra: '#ef4444' };
  };

  // Colunas compartilhadas entre o cabeçalho e as linhas
  const GRID_SESSAO = '110px minmax(0,1fr) 120px minmax(0,1.1fr) 64px 150px';

  // Estilo base dos botões de ação (ícones SVG)
  const estiloAcao = (cor, bg, borda) => ({
    width: '2rem', height: '2rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: bg, color: cor, border: `1px solid ${borda}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', padding: 0,
  });
  const svgProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

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
        .from('vw_resumo_sessoes')
        .select('*')
        .order('data_sessao', { ascending: false });

      if (filtroAno) {
        query = query
          .gte('data_sessao', `${filtroAno}-01-01`)
          .lte('data_sessao', `${filtroAno}-12-31`);
      }

      if (filtroMes && filtroAno) {
        const ultimoDia = new Date(parseInt(filtroAno), parseInt(filtroMes), 0).getDate();
        query = query
          .gte('data_sessao', `${filtroAno}-${filtroMes.padStart(2, '0')}-01`)
          .lte('data_sessao', `${filtroAno}-${filtroMes.padStart(2, '0')}-${ultimoDia}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const sessoesMapeadas = (data || []).map(s => ({
        ...s,
        graus_presentes: {
          aprendizes:             s.presentes_aprendizes,
          companheiros:           s.presentes_companheiros,
          mestres:                s.presentes_mestres,
          mestres_instalados:     s.presentes_mestres_instalados,
        },
      }));

      // Marca quais sessões tiveram visitante que é autoridade da Potência
      // (Grão-Mestre, corpo administrativo, etc.) — usado só pro destaque
      // visual do card, não vem da view.
      const idsSessoes = sessoesMapeadas.map(s => s.id);
      if (idsSessoes.length > 0) {
        const { data: visitasAutoridade } = await supabase
          .from('visitantes_sessao')
          .select('sessao_id')
          .eq('eh_autoridade', true)
          .in('sessao_id', idsSessoes);

        // Conta quantas autoridades (pessoas) houve em cada sessão
        const qtdPorSessao = {};
        (visitasAutoridade || []).forEach(v => {
          qtdPorSessao[v.sessao_id] = (qtdPorSessao[v.sessao_id] || 0) + 1;
        });
        sessoesMapeadas.forEach(s => {
          s.qtd_autoridades = qtdPorSessao[s.id] || 0;
          s.teve_visita_autoridade = s.qtd_autoridades > 0;
        });
      }

      setSessoes(sessoesMapeadas);

    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao carregar sessões.' });
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
      .in('status', ['ativa', 'vencida'])
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
        loja_id: visita.loja_id || '',
        potencia_id: visita.potencia_id != null ? String(visita.potencia_id) : '',
        observacoes: visita.observacoes || ''
      });
    } else {
      setVisitaEditando(null);
      setVisitaForm({
        irmao_id: '',
        data_visita: '',
        nome_loja: '',
        oriente: '',
        loja_id: '',
        potencia_id: '',
        observacoes: ''
      });
    }
    setModalVisita(true);
  };

  const salvarVisita = async (e) => {
    e.preventDefault();

    if (!visitaForm.irmao_id || !visitaForm.data_visita || !visitaForm.loja_id) {
      setMensagem({ tipo: 'erro', texto: 'Preencha o Irmão, a data e selecione a Loja (cadastre em Lojas Maçônicas se não existir)' });
      return;
    }

    // Monta o payload explicitamente — potencia_id vazio vira null (nunca
    // string vazia, que quebra update/insert em coluna de chave estrangeira).
    const payload = {
      ...visitaForm,
      loja_id: visitaForm.loja_id || null,
      potencia_id: visitaForm.potencia_id ? visitaForm.potencia_id : null,
    };

    try {
      if (visitaEditando) {
        const { data, error } = await supabase
          .from('visitas_outras_lojas')
          .update(payload)
          .eq('id', visitaEditando.id)
          .select();
        
        if (error) throw error;
        if (!data || data.length === 0) {
          setMensagem({ tipo: 'erro', texto: '❌ A edição não foi salva: nenhuma linha foi alterada no banco (provável falta de permissão/RLS na tabela visitas_outras_lojas para UPDATE).' });
          return;
        }
        setMensagem({ tipo: 'sucesso', texto: '✅ Visita atualizada com sucesso!' });
      } else {
        const { error } = await supabase
          .from('visitas_outras_lojas')
          .insert([payload]);
        
        if (error) throw error;
        setMensagem({ tipo: 'sucesso', texto: '✅ Visita cadastrada com sucesso!' });
      }

      setModalVisita(false);
      carregarVisitas();
    } catch (error) {
      console.error('Erro ao salvar visita:', error);
      setMensagem({ tipo: 'erro', texto: `❌ Erro ao salvar visita: ${error.message || error.details || 'erro desconhecido'}` });
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

  // ── Indicadores do período filtrado ──
  const indicadores = (() => {
    const comRegistro = sessoes.filter(x => (x.total_registros || 0) > 0);
    const pcts = comRegistro.map(x => ({ pct: ((x.total_presentes || 0) / x.total_registros) * 100, data: x.data_sessao }));
    const mediaPct = pcts.length > 0 ? Math.round(pcts.reduce((a, x) => a + x.pct, 0) / pcts.length) : null;
    const maior = pcts.length > 0 ? pcts.reduce((m, x) => (x.pct > m.pct ? x : m)) : null;
    const menor = pcts.length > 0 ? pcts.reduce((m, x) => (x.pct < m.pct ? x : m)) : null;
    return {
      qtdSessoes: sessoes.length,
      qtdComRegistro: comRegistro.length,
      mediaPct,
      somaPresentes: comRegistro.reduce((a, x) => a + (x.total_presentes || 0), 0),
      somaRegistros: comRegistro.reduce((a, x) => a + (x.total_registros || 0), 0),
      somaVisitantes: sessoes.reduce((a, x) => a + (x.total_visitantes || 0), 0),
      sessoesComAutoridade: sessoes.filter(x => x.teve_visita_autoridade).length,
      totalAutoridades: sessoes.reduce((a, x) => a + (x.qtd_autoridades || 0), 0),
      maior, menor,
    };
  })();
  const corMedia = indicadores.mediaPct === null ? 'var(--color-text-muted)'
    : indicadores.mediaPct >= 75 ? '#10b981' : indicadores.mediaPct >= 50 ? '#f59e0b' : '#ef4444';
  const cardKpi = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' };
  const rotuloKpi = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)' };
  const KpiGrande = ({ titulo, valor, sub, cor, children }) => (
    <div style={{ ...cardKpi, borderTop: `4px solid ${cor}`, padding: '1rem 1.25rem' }}>
      <div style={rotuloKpi}>{titulo}</div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '0.25rem', lineHeight: 1.1 }}>{valor}</div>
      {children}
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>{sub}</div>}
    </div>
  );
  const KpiMini = ({ icone, titulo, valor, sub }) => (
    <div style={{ ...cardKpi, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ fontSize: '1.5rem' }}>{icone}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...rotuloKpi, fontSize: '0.7rem' }}>{titulo}</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>{valor}</div>
        {sub && <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{sub}</div>}
      </div>
    </div>
  );
  const nomePeriodo = filtroMes
    ? `${meses[parseInt(filtroMes)]?.nome || ''} de ${filtroAno}`
    : (filtroAno ? `ano de ${filtroAno}` : 'todos os períodos');

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

      {/* Indicadores do período */}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
            <KpiGrande
              titulo="Sessões realizadas"
              valor={indicadores.qtdSessoes}
              cor="var(--color-accent)"
              sub={`${nomePeriodo} · ${indicadores.qtdComRegistro} com presença registrada`}
            />
            <KpiGrande
              titulo="Presença média"
              valor={indicadores.mediaPct !== null ? `${indicadores.mediaPct}%` : '—'}
              cor={corMedia}
              sub={indicadores.mediaPct !== null ? 'média dos % das sessões' : 'sem registros no período'}
            >
              <div style={{ height: 6, borderRadius: 999, background: 'var(--color-surface-2)', marginTop: '0.5rem', overflow: 'hidden' }}>
                <div style={{ width: `${indicadores.mediaPct || 0}%`, height: '100%', background: corMedia }} />
              </div>
            </KpiGrande>
            <KpiGrande
              titulo="Total de presenças"
              valor={indicadores.somaPresentes}
              cor="#10b981"
              sub={`de ${indicadores.somaRegistros} registros elegíveis`}
            />
            <KpiGrande
              titulo="Visitantes recebidos"
              valor={indicadores.somaVisitantes}
              cor="#3b82f6"
              sub="soma em todas as sessões"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
            <KpiMini icone="🎖️" titulo="Sessões com autoridade" valor={indicadores.sessoesComAutoridade} sub="visita de autoridade da Potência" />
            <KpiMini icone="👥" titulo="Autoridades presentes" valor={indicadores.totalAutoridades} sub="soma de pessoas no período" />
            <KpiMini icone="📍" titulo="Visitas a outras lojas" valor={visitas.length} sub="realizadas pelos irmãos" />
          </div>
        </div>
      )}

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
                {(() => {
                  const comRegistro = grupo.sessoes.filter(x => (x.total_registros || 0) > 0);
                  const mediaMes = comRegistro.length > 0
                    ? Math.round(comRegistro.reduce((acc, x) => acc + ((x.total_presentes || 0) / x.total_registros) * 100, 0) / comRegistro.length)
                    : null;
                  return (
                    <div
                      onClick={() => toggleMes(mesAno)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMes(mesAno); } }}
                      aria-expanded={isMesAberto(mesAno)}
                      title={isMesAberto(mesAno) ? 'Recolher mês' : 'Expandir mês'}
                      style={{ background: 'var(--color-accent)', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', cursor: 'pointer', userSelect: 'none' }}
                    >
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ display: 'inline-block', fontSize: '0.8rem', transition: 'transform 0.2s', transform: isMesAberto(mesAno) ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                        📅 {grupo.mesNome}
                      </h3>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ padding: '0.15rem 0.7rem', borderRadius: '999px', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>
                          {grupo.sessoes.length} sessão{grupo.sessoes.length === 1 ? '' : 'ões'}
                        </span>
                        {mediaMes !== null && (
                          <span style={{ padding: '0.15rem 0.7rem', borderRadius: '999px', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>
                            presença média {mediaMes}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {isMesAberto(mesAno) && (<>
                <div className="overflow-x-auto">
                  {/* Cabeçalho alinhado com os cards */}
                  <div style={{
                    display:'grid',
                    gridTemplateColumns: GRID_SESSAO,
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
                              gridTemplateColumns: GRID_SESSAO,
                              alignItems:'center',
                              gap:'0.75rem',
                              padding:'0.65rem 1rem',
                              borderRadius:'var(--radius-lg)',
                              border: sessao.teve_visita_autoridade ? '1px solid rgba(201,168,76,0.5)' : '1px solid var(--color-border)',
                              borderLeft: sessao.teve_visita_autoridade ? '4px solid #c9a84c' : '4px solid var(--color-accent)',
                              background: sessao.teve_visita_autoridade ? 'rgba(201,168,76,0.07)' : (idx%2===0 ? 'var(--color-surface-2)' : 'var(--color-surface)'),
                              transition:'opacity 0.15s',
                            }}
                          >
                            {/* Data */}
                            <div style={{fontSize:'0.85rem',fontWeight:'600',color:'var(--color-text)',whiteSpace:'nowrap'}}>
                              {formatarData(sessao.data_sessao)}
                            </div>
                            {/* Tipo de Sessão */}
                            <div style={{fontSize:'0.85rem',color:'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:'0.4rem'}}>
                              {sessao.grau_sessao}
                              {sessao.teve_visita_autoridade && (
                                <span
                                  title="Sessão com visita de autoridade da Potência"
                                  style={{padding:'0.1rem 0.5rem',background:'rgba(201,168,76,0.18)',color:'#c9a84c',border:'1px solid rgba(201,168,76,0.4)',borderRadius:'999px',fontSize:'0.68rem',fontWeight:'700',whiteSpace:'nowrap'}}
                                >
                                  🎖️ Visita de Autoridade
                                </span>
                              )}
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
                            {/* Presença — compacta */}
                            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0.3rem',textAlign:'center',minWidth:0}}>
                              <span style={{background:corPct.fundo,color:corPct.texto,border:`1px solid ${corPct.borda}`,padding:'0.12rem 0.7rem',borderRadius:'999px',fontSize:'0.8rem',fontWeight:'700',whiteSpace:'nowrap'}}>
                                {percentual}% <span style={{fontWeight:'600',opacity:0.85}}>({presentes}/{totalRegistros})</span>
                              </span>
                              {totalRegistros > 0 && (
                                <div style={{width:'100%',maxWidth:'150px',height:'4px',background:'var(--color-surface-3, var(--color-border))',borderRadius:'999px',overflow:'hidden'}} title={`${ausentes} ausente(s)`}>
                                  <div style={{height:'100%',width:`${percentual}%`,background:corPct.barra,borderRadius:'999px'}} />
                                </div>
                              )}
                              {graus && presentes > 0 && (
                                <div style={{display:'flex',gap:'0.25rem',flexWrap:'wrap',justifyContent:'center'}}>
                                  {graus.aprendizes > 0 && (
                                    <span title="Aprendizes presentes" style={{padding:'0.05rem 0.4rem',background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.3)',borderRadius:'var(--radius-sm)',fontSize:'0.68rem',fontWeight:'700',whiteSpace:'nowrap'}}>A:{graus.aprendizes}</span>
                                  )}
                                  {graus.companheiros > 0 && (
                                    <span title="Companheiros presentes" style={{padding:'0.05rem 0.4rem',background:'rgba(59,130,246,0.15)',color:'#3b82f6',border:'1px solid rgba(59,130,246,0.3)',borderRadius:'var(--radius-sm)',fontSize:'0.68rem',fontWeight:'700',whiteSpace:'nowrap'}}>C:{graus.companheiros}</span>
                                  )}
                                  {graus.mestres > 0 && (
                                    <span title="Mestres presentes" style={{padding:'0.05rem 0.4rem',background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)',borderRadius:'var(--radius-sm)',fontSize:'0.68rem',fontWeight:'700',whiteSpace:'nowrap'}}>M:{graus.mestres}</span>
                                  )}
                                  {graus.mestres_instalados > 0 && (
                                    <span title="Mestres Instalados presentes" style={{padding:'0.05rem 0.4rem',background:'rgba(139,92,246,0.15)',color:'#8b5cf6',border:'1px solid rgba(139,92,246,0.3)',borderRadius:'var(--radius-sm)',fontSize:'0.68rem',fontWeight:'700',whiteSpace:'nowrap'}}>M.I:{graus.mestres_instalados}</span>
                                  )}
                                </div>
                              )}
                              {/* Ausentes / licenciados / prerrogativa — uma linha discreta (não contam no %) */}
                              {totalRegistros > 0 && (
                                <span style={{fontSize:'0.68rem',color:'var(--color-text-muted)',whiteSpace:'nowrap'}}>
                                  {ausentes} ausente(s)
                                  {(sessao.total_licenciados || 0) > 0 && (
                                    <span title="Licenciados — não contam no % de presença"> · 📋 {sessao.total_licenciados}</span>
                                  )}
                                  {(sessao.total_prerrogativa || 0) > 0 && (
                                    <span title="Com prerrogativa de idade — não contam no % de presença"> · 🎖️ {sessao.total_prerrogativa}</span>
                                  )}
                                </span>
                              )}
                            </div>
                            {/* Visitantes */}
                            <div style={{textAlign:'center'}}>
                              <span style={{padding:'0.15rem 0.55rem',background:'rgba(59,130,246,0.15)',color:'#3b82f6',border:'1px solid rgba(59,130,246,0.3)',borderRadius:'999px',fontSize:'0.8rem',fontWeight:'600'}}>
                                {sessao.total_visitantes}
                              </span>
                            </div>
                            {/* Ações */}
                            <div style={{display:'flex',gap:'0.3rem',justifyContent:'flex-end',alignItems:'center'}}>
                              <button
                                onClick={() => onVisualizarPresenca(sessao.id)}
                                style={estiloAcao('#10b981','rgba(16,185,129,0.15)','rgba(16,185,129,0.3)')}
                                title="Visualizar presença"
                              >
                                <svg {...svgProps}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              </button>
                              <button
                                onClick={() => setSessaoComposicao(sessao)}
                                style={estiloAcao('#c9a84c','rgba(201,168,76,0.15)','rgba(201,168,76,0.4)')}
                                title="Composição da Loja (gerar imagem para o grupo)"
                              >
                                <svg {...svgProps}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 17v-5M12 17V8M16 17v-3"/></svg>
                              </button>
                              <button
                                onClick={() => onEditarPresenca(sessao.id)}
                                style={estiloAcao('var(--color-accent)','var(--color-accent-bg)','var(--color-accent)')}
                                title="Editar"
                              >
                                <svg {...svgProps}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                              </button>
                              <span style={{width:'1px',height:'1.2rem',background:'var(--color-border)',margin:'0 0.1rem'}} />
                              <button
                                onClick={() => handleExcluir(sessao.id)}
                                style={estiloAcao('#ef4444','transparent','rgba(239,68,68,0.3)')}
                                title="Excluir"
                              >
                                <svg {...svgProps}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
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
                                {nomeLojaVisita(visita)} - {visita.potencias_masonicas?.sigla || 'N/A'} - {orienteVisita(visita)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                </>)}
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
                  style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.5rem 0.75rem",outline:"none"}}
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
                  style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.5rem 0.75rem",outline:"none"}}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Loja visitada *</label>
                  <select
                    value={visitaForm.loja_id || ''}
                    onChange={(e) => {
                      const l = lojasCadastro.find(x => String(x.id) === e.target.value);
                      setVisitaForm({
                        ...visitaForm,
                        loja_id: l ? l.id : '',
                        nome_loja: l ? `${l.eh_potencia ? '' : `${l.prefixo || 'ARLS'} `}${l.nome}` : '',
                        oriente: l ? l.oriente : '',
                      });
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-purple-500"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-purple-500"
                    style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.5rem 0.75rem",outline:"none"}}
                    required
                  >
                    <option value="">Selecione a Loja (cadastre em Lojas Maçônicas se não existir)</option>
                    {lojasCadastro.some(l => l.eh_potencia) && (
                      <optgroup label="Potências">
                        {lojasCadastro.filter(l => l.eh_potencia).map(l => (
                          <option key={l.id} value={l.id}>{`${l.nome} – ${l.oriente}`}</option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Lojas">
                      {lojasCadastro.filter(l => !l.eh_potencia).map(l => (
                        <option key={l.id} value={l.id}>{`${l.prefixo || 'ARLS'} ${l.nome} – ${l.oriente}${l.potencia ? ` (${l.potencia})` : ''}`}</option>
                      ))}
                    </optgroup>
                  </select>
                  {visitaForm.oriente && (
                    <p style={{margin:"0.3rem 0 0",fontSize:"0.75rem",color:"var(--color-text-muted)"}}>Oriente: {visitaForm.oriente}</p>
                  )}
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
                  <div className="mb-3 p-3 rounded-lg space-y-2" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Sigla (ex: GLESP)"
                        value={novaPotencia.sigla}
                        onChange={(e) => setNovaPotencia({ ...novaPotencia, sigla: e.target.value.toUpperCase() })}
                        className="px-2 py-1 text-sm border rounded focus:ring-purple-500"
                        style={{background:"var(--color-surface)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",outline:"none"}}
                      />
                      <input
                        type="text"
                        placeholder="Nome completo"
                        value={novaPotencia.nome_completo}
                        onChange={(e) => setNovaPotencia({ ...novaPotencia, nome_completo: e.target.value })}
                        className="px-2 py-1 text-sm border rounded focus:ring-purple-500"
                        style={{background:"var(--color-surface)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",outline:"none"}}
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
                            style={{background:"var(--color-surface-2)",color:"var(--color-text)",outline:"none"}}
                          />
                          <input
                            type="text"
                            defaultValue={pot.nome_completo}
                            onBlur={(e) => atualizarPotencia(pot.id, { nome_completo: e.target.value })}
                            className="flex-1 px-2 py-1 text-sm border border-purple-300 rounded focus:ring-purple-500"
                            style={{background:"var(--color-surface-2)",color:"var(--color-text)",outline:"none"}}
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
                            checked={String(visitaForm.potencia_id) === String(pot.id)}
                            onChange={(e) => setVisitaForm({ ...visitaForm, potencia_id: e.target.value })}
                            className="w-4 h-4 text-purple-600"
                          />
                          <span className="flex-1 text-sm" style={{color:"var(--color-text)"}}>
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
                  style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.5rem 0.75rem",outline:"none"}}
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

      {/* Modal Composição da Loja */}
      {sessaoComposicao && (
        <ModalComposicaoLoja
          sessao={sessaoComposicao}
          onFechar={() => setSessaoComposicao(null)}
        />
      )}
    </div>
  );
}
