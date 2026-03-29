import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarData } from '../../utils/formatters';

const Balaustres = ({ 
  balaustres, 
  tiposSessao, 
  session,
  onUpdate, 
  showSuccess, 
  showError,
  permissoes,
  grauUsuario
}) => {
  
  // Estados do formulário
  const [balaustreForm, setBalaustreForm] = useState({
    grau_sessao: 'Aprendiz',
    numero_balaustre: '',
    ano_balaustre: new Date().getFullYear(),
    data_sessao: '',
    dia_semana: '',
    tipo_sessao_id: '',
    ordem_dia: '',
    observacoes: ''
  });

  // Estados de controle
  const [modoEdicao, setModoEdicao] = useState(false);
  const [balaustreEditando, setBalaustreEditando] = useState(null);
  const [loading, setLoading] = useState(false);
  const [grauSelecionado, setGrauSelecionado] = useState('Aprendiz');
  const [anoSelecionado, setAnoSelecionado] = useState(null); // null = todos os anos
  const [balaustreVisualizando, setBalaustreVisualizando] = useState(null);
  const [modalVisualizar, setModalVisualizar] = useState(false);

  // Função para obter dia da semana
  const obterDiaSemana = (data) => {
    if (!data) return '';
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const date = new Date(data + 'T00:00:00');
    return dias[date.getDay()];
  };

  // Carregar próximo número de balaustre (por ano e grau)
  const carregarProximoNumero = async (grau, ano) => {
    try {
      const { data, error } = await supabase
        .from('balaustres')
        .select('numero_balaustre, ano_balaustre')
        .eq('grau_sessao', grau)
        .eq('ano_balaustre', ano)
        .order('numero_balaustre', { ascending: false })
        .limit(1);

      if (error) throw error;

      const proximoNumero = data && data.length > 0 ? parseInt(data[0].numero_balaustre) + 1 : 1;
      setBalaustreForm(prev => ({ ...prev, numero_balaustre: proximoNumero }));
    } catch (error) {
      console.error('Erro ao carregar próximo número:', error);
    }
  };

  // Atualizar dia da semana quando data mudar
  useEffect(() => {
    if (balaustreForm.data_sessao) {
      const diaSemana = obterDiaSemana(balaustreForm.data_sessao);
      setBalaustreForm(prev => ({ ...prev, dia_semana: diaSemana }));
    }
  }, [balaustreForm.data_sessao]);

  // Carregar próximo número quando grau ou ano mudar
  useEffect(() => {
    if (!modoEdicao) {
      carregarProximoNumero(balaustreForm.grau_sessao, balaustreForm.ano_balaustre);
    }
  }, [balaustreForm.grau_sessao, balaustreForm.ano_balaustre, modoEdicao]);

  // Carregar próximo número ao montar componente
  useEffect(() => {
    if (!modoEdicao) {
      carregarProximoNumero(grauSelecionado, new Date().getFullYear());
    }
  }, [grauSelecionado, modoEdicao]);

  // Limpar formulário
  const limparFormulario = () => {
    const anoAtual = new Date().getFullYear();
    setBalaustreForm({
      grau_sessao: grauSelecionado,
      numero_balaustre: '',
      ano_balaustre: anoAtual,
      data_sessao: '',
      dia_semana: '',
      tipo_sessao_id: '',
      ordem_dia: '',
      observacoes: ''
    });
    setModoEdicao(false);
    setBalaustreEditando(null);
    carregarProximoNumero(grauSelecionado, anoAtual);
  };

  // Cadastrar balaustre
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('balaustres')
        .insert([{
          ...balaustreForm,
          created_by: session.user.id
        }])
        .select()
        .single();

      if (error) throw error;

      showSuccess('Balaustre cadastrado com sucesso!');
      onUpdate();
      limparFormulario();

    } catch (error) {
      showError('Erro ao salvar balaustre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar balaustre
  const handleAtualizar = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('balaustres')
        .update(balaustreForm)
        .eq('id', balaustreEditando.id);

      if (error) throw error;

      showSuccess('Balaustre atualizado com sucesso!');
      onUpdate();
      limparFormulario();

    } catch (error) {
      showError('Erro ao atualizar balaustre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Editar balaustre
  const handleEditar = (balaustre) => {
    setModoEdicao(true);
    setBalaustreEditando(balaustre);
    setBalaustreForm({
      grau_sessao: balaustre.grau_sessao,
      numero_balaustre: balaustre.numero_balaustre,
      ano_balaustre: balaustre.ano_balaustre || new Date().getFullYear(),
      data_sessao: balaustre.data_sessao,
      dia_semana: balaustre.dia_semana,
      tipo_sessao_id: balaustre.tipo_sessao_id,
      ordem_dia: balaustre.ordem_dia || '',
      observacoes: balaustre.observacoes || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Visualizar balaustre completo
  const handleVisualizar = (balaustre) => {
    setBalaustreVisualizando(balaustre);
    setModalVisualizar(true);
  };

  // Excluir balaustre
  const handleExcluir = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Tem certeza que deseja excluir este balaustre?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('balaustres')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('Balaustre excluído com sucesso!');
      onUpdate();

    } catch (error) {
      showError('Erro ao excluir balaustre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Obter nome do tipo de sessão
  const obterNomeTipoSessao = (tipoId) => {
    const tipo = tiposSessao.find(t => t.id === tipoId);
    return tipo ? tipo.nome : 'N/A';
  };

  // Anos disponíveis para o grau selecionado
  const anosDisponiveis = [...new Set(
    balaustres
      .filter(b => (b.grau_sessao || '').trim().toLowerCase() === (grauSelecionado || '').trim().toLowerCase())
      .map(b => {
        if (b.ano_balaustre) return parseInt(b.ano_balaustre);
        if (b.data_sessao) return new Date(b.data_sessao + 'T00:00:00').getFullYear();
        return new Date().getFullYear();
      })
  )].sort((a, b) => b - a);

  // Filtrar balaustres por grau (ULTRA ROBUSTO)
  const balaustresFiltrados = balaustres.filter(b => {
    const grauBanco = (b.grau_sessao || '').trim().toLowerCase();
    const grauBusca = (grauSelecionado || '').trim().toLowerCase();
    const match = grauBanco === grauBusca;
    
    return match;
  });

  // CONTROLE DE ACESSO POR GRAU
  // Aprendiz: só vê Aprendiz
  // Companheiro: vê Companheiro e Aprendiz
  // Mestre: vê tudo
  const balaustresFiltradosPorAcesso = balaustresFiltrados.filter(b => {
    if (!grauUsuario) return true; // Se não tiver grau definido, mostra tudo (admin)
    
    const grauBalaustre = (b.grau_sessao || '').trim().toLowerCase();
    const grauUser = grauUsuario.toLowerCase();
    
    // Mestre e Mestre Instalado veem tudo
    if (grauUser === 'mestre' || grauUser === 'mestre instalado') return true;
    
    if (grauUser === 'companheiro') {
      return grauBalaustre === 'companheiro' || grauBalaustre === 'aprendiz';
    }
    
    if (grauUser === 'aprendiz') {
      return grauBalaustre === 'aprendiz';
    }
    
    return false;
  });

  return (
    <div style={{ padding: '2rem', background: 'var(--color-bg)', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* FORMULÁRIO - Só aparece para quem pode editar */}
      {permissoes?.pode_editar_balaustres && (
        <div className="card" style={{overflow:"hidden"}}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text)', marginBottom: '1rem' }}>
            {modoEdicao ? '✏️ Editar Balaustre' : '➕ Novo Balaustre'}
          </h3>

        <form onSubmit={modoEdicao ? handleAtualizar : handleSubmit} style={{width:"100%",maxWidth:"100%",boxSizing:"border-box",overflow:"hidden"}}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Grau da Sessão */}
            <div>
              <label className="form-label">Grau da Sessão *</label>
              <select
                value={balaustreForm.grau_sessao}
                onChange={(e) => setBalaustreForm({ ...balaustreForm, grau_sessao: e.target.value })}
                className="form-input"
                required
              >
                <option value="Aprendiz">Aprendiz</option>
                <option value="Companheiro">Companheiro</option>
                <option value="Mestre">Mestre</option>
              </select>
            </div>

            {/* Número do Balaustre com Ano */}
            <div>
              <label className="form-label">
                Número do Balaustre *
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>(Formato: N/ANO)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={balaustreForm.numero_balaustre}
                  onChange={(e) => setBalaustreForm({ ...balaustreForm, numero_balaustre: parseInt(e.target.value) || '' })}
                  className="form-input"
                  style={{ width: '6rem' }}
                  required
                  min="1"
                  placeholder="Nº"
                />
                <span style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)', fontSize: '1.125rem', fontWeight: 'bold' }}>/</span>
                <input
                  type="number"
                  value={balaustreForm.ano_balaustre}
                  onChange={(e) => setBalaustreForm({ ...balaustreForm, ano_balaustre: parseInt(e.target.value) || new Date().getFullYear() })}
                  className="form-input"
                  style={{ width: '7rem' }}
                  required
                  min="2020"
                  max="2099"
                  placeholder="Ano"
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                Ex: {balaustreForm.numero_balaustre || '1'}/{balaustreForm.ano_balaustre || new Date().getFullYear()}
              </p>
            </div>

            {/* Data da Sessão */}
            <div>
              <label className="form-label">Data da Sessão *</label>
              <input
                type="date"
                value={balaustreForm.data_sessao}
                onChange={(e) => setBalaustreForm({ ...balaustreForm, data_sessao: e.target.value })}
                className="form-input"
                required
              />
            </div>

            {/* Dia da Semana */}
            <div>
              <label className="form-label">Dia da Semana</label>
              <input
                type="text"
                value={balaustreForm.dia_semana}
                className="form-input"
                style={{ background: 'var(--color-surface-2)', cursor: 'not-allowed' }}
                readOnly
              />
            </div>

            {/* Tipo de Sessão */}
            <div>
              <label className="form-label">Tipo de Sessão *</label>
              <select
                value={balaustreForm.tipo_sessao_id}
                onChange={(e) => setBalaustreForm({ ...balaustreForm, tipo_sessao_id: e.target.value })}
                className="form-input"
                required
              >
                <option value="">Selecione...</option>
                {tiposSessao.map(tipo => (
                  <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Ordem do Dia e Observações */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="form-label">Ordem do Dia</label>
              <textarea
                value={balaustreForm.ordem_dia}
                onChange={(e) => setBalaustreForm({ ...balaustreForm, ordem_dia: e.target.value })}
                className="form-input"
                rows="4"
                style={{resize:"vertical"}}
                placeholder="Descreva a ordem do dia da sessão..."
              />
            </div>

            <div>
              <label className="form-label">Observações</label>
              <textarea
                value={balaustreForm.observacoes}
                onChange={(e) => setBalaustreForm({ ...balaustreForm, observacoes: e.target.value })}
                className="form-input"
                rows="4"
                style={{resize:"vertical"}}
                placeholder="Observações adicionais..."
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.5rem 1.5rem',
                background: loading ? 'var(--color-surface-3)' : 'var(--color-accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => { if (!loading) e.target.style.background = 'var(--color-accent-hover)'; }}
              onMouseLeave={(e) => { if (!loading) e.target.style.background = 'var(--color-accent)'; }}
            >
              {loading ? 'Salvando...' : (modoEdicao ? 'Atualizar Balaustre' : 'Cadastrar Balaustre')}
            </button>
            
            {modoEdicao && (
              <button
                type="button"
                onClick={limparFormulario}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: 'var(--color-surface-3)',
                  color: 'var(--color-text)',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.background = 'var(--color-surface-2)'}
                onMouseLeave={(e) => e.target.style.background = 'var(--color-surface-3)'}
              >
                Cancelar Edição
              </button>
            )}
          </div>
        </form>
      </div>
      )}

      {/* FILTRO POR GRAU */}
      <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <div className="flex gap-2">
          <button
            onClick={() => { setGrauSelecionado('Aprendiz'); setAnoSelecionado(null); }}
            style={{
              padding: '0.5rem 1rem',
              background: grauSelecionado === 'Aprendiz' ? 'var(--color-accent)' : 'var(--color-surface-2)',
              color: grauSelecionado === 'Aprendiz' ? 'white' : 'var(--color-text)',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (grauSelecionado !== 'Aprendiz') e.target.style.background = 'var(--color-surface-3)';
            }}
            onMouseLeave={(e) => {
              if (grauSelecionado !== 'Aprendiz') e.target.style.background = 'var(--color-surface-2)';
            }}
          >
            Aprendiz ({balaustres.filter(b => {
              const grau = (b.grau_sessao || '').trim().toLowerCase();
              return grau === 'aprendiz';
            }).length})
          </button>
          <button
            onClick={() => { setGrauSelecionado('Companheiro'); setAnoSelecionado(null); }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              grauSelecionado === 'Companheiro'
                ? 'bg-green-600 text-white'
                : '  '
            }`}
          >
            Companheiro ({balaustres.filter(b => {
              const grau = (b.grau_sessao || '').trim().toLowerCase();
              return grau === 'companheiro';
            }).length})
          </button>
          <button
            onClick={() => { setGrauSelecionado('Mestre'); setAnoSelecionado(null); }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              grauSelecionado === 'Mestre'
                ? 'bg-purple-600 text-white'
                : '  '
            }`}
          >
            Mestre ({balaustres.filter(b => {
              const grau = (b.grau_sessao || '').trim().toLowerCase();
              return grau === 'mestre';
            }).length})
          </button>
        </div>

        {/* Seletor de ano */}
        {anosDisponiveis.length >= 1 && (
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginTop:'0.75rem'}}>
            <span style={{fontSize:'0.75rem',fontWeight:'600',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em',flexShrink:0}}>Ano:</span>
            <select
              value={anoSelecionado ?? ''}
              onChange={e => setAnoSelecionado(e.target.value ? parseInt(e.target.value) : null)}
              style={{padding:'0.3rem 0.75rem',borderRadius:'var(--radius-lg)',border:'1px solid var(--color-border)',background:'var(--color-surface-2)',color:'var(--color-text)',fontSize:'0.85rem',cursor:'pointer',outline:'none'}}
            >
              <option value=''>Todos</option>
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* LISTAGEM */}
      {/* Verificar se usuário tem permissão para ver esta aba */}
      {(() => {
        const grauUser = grauUsuario?.toLowerCase() || '';
        const grauAba = grauSelecionado.toLowerCase();
        
        // Aprendiz tentando ver Companheiro
        if (grauUser === 'aprendiz' && grauAba === 'companheiro') {
          return (
            <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
              <div className="text-6xl mb-4">🔒</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text)', marginBottom: '0.5rem' }}>Acesso Restrito</h3>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Balaustres de <strong>Companheiro</strong> são restritos.</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Você precisa ser <strong>Companheiro</strong> ou superior para acessar.</p>
            </div>
          );
        }
        
        // Aprendiz tentando ver Mestre
        if (grauUser === 'aprendiz' && grauAba === 'mestre') {
          return (
            <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
              <div className="text-6xl mb-4">🔒</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text)', marginBottom: '0.5rem' }}>Acesso Restrito</h3>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Balaustres de <strong>Mestre</strong> são restritos.</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Você precisa ser <strong>Mestre ou Mestre Instalado</strong> para acessar.</p>
            </div>
          );
        }
        
        // Companheiro tentando ver Mestre
        if (grauUser === 'companheiro' && grauAba === 'mestre') {
          return (
            <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
              <div className="text-6xl mb-4">🔒</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text)', marginBottom: '0.5rem' }}>Acesso Restrito</h3>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Balaustres de <strong>Mestre</strong> são restritos.</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Você precisa ser <strong>Mestre ou Mestre Instalado</strong> para acessar.</p>
            </div>
          );
        }
        
        // Se passou nas verificações, mostrar a listagem normal
        return (
          <div className="card" style={{ overflow: "hidden", padding: 0 }}>
            <div style={{overflow:"hidden"}}>
                <div className="p-3 space-y-2" style={{width:"100%",boxSizing:"border-box",overflow:"hidden"}}>
                  {(() => {
                    const getAnoBal = b => b.ano_balaustre ? parseInt(b.ano_balaustre) : (b.data_sessao ? new Date(b.data_sessao+'T00:00:00').getFullYear() : new Date().getFullYear());
                    const lista = balaustresFiltradosPorAcesso
                      .filter(b => anoSelecionado ? getAnoBal(b) === anoSelecionado : true)
                      .sort((a, b) => {
                        const anoA = getAnoBal(a), anoB = getAnoBal(b);
                        if (anoB !== anoA) return anoB - anoA;
                        return b.numero_balaustre - a.numero_balaustre;
                      });
                    if (lista.length === 0) return (
                      <div className="text-center py-8" style={{color:'var(--color-text-faint)'}}>
                        Nenhum balaustre cadastrado
                      </div>
                    );
                    // Agrupar por ano
                    const grupos = lista.reduce((acc, b) => {
                      const ano = getAnoBal(b);
                      if (!acc[ano]) acc[ano] = [];
                      acc[ano].push(b);
                      return acc;
                    }, {});
                    const anosGrupo = Object.keys(grupos).map(Number).sort((a,b) => b-a);
                    return anosGrupo.map(ano => (
                      <div key={ano} style={{overflow:'hidden',maxWidth:'100%'}}>
                        {/* Cabeçalho do ano */}
                        <div style={{display:'flex',alignItems:'center',gap:'0.75rem',margin:'0.75rem 0 0.5rem',padding:'0.4rem 0.75rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',borderLeft:'3px solid var(--color-accent)'}}>
                          <span style={{fontWeight:'700',fontSize:'0.9rem',color:'var(--color-accent)'}}>📅 {ano}</span>
                          <span style={{fontSize:'0.75rem',color:'var(--color-text-muted)'}}>{grupos[ano].length} balaustre(s)</span>
                        </div>
                        {grupos[ano].map((balaustre, idx) => (
                        <div key={balaustre.id}
                          className="rounded-lg border-l-4 flex items-center gap-3 px-3 py-3 transition-opacity hover:opacity-90"
                          style={{
                            borderLeftColor: 'var(--color-accent)',
                            background: idx%2===0 ? 'var(--color-surface)' : 'var(--color-surface-2)',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            minWidth: 0
                          }}
                        >
                          {/* Número/Ano */}
                          <div style={{flexShrink:0,width:'68px',overflow:'hidden'}}>
                            <p className="font-bold text-sm" style={{color:'var(--color-accent)'}}>{balaustre.numero_balaustre}/{balaustre.ano_balaustre || new Date().getFullYear()}</p>
                            <p className="text-xs" style={{color:'var(--color-text-muted)'}}>{balaustre.dia_semana}</p>
                          </div>
                          {/* Data */}
                          <div style={{flexShrink:0,width:'85px'}}>
                            <p className="text-xs" style={{color:'var(--color-text-muted)'}}>📅 {formatarData(balaustre.data_sessao)}</p>
                          </div>
                          {/* Tipo */}
                          <div style={{flexShrink:0,maxWidth:'120px',overflow:'hidden'}}>
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800" style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>
                              {obterNomeTipoSessao(balaustre.tipo_sessao_id)}
                            </span>
                          </div>
                          {/* Ordem do dia */}
                          <div style={{flex:1,minWidth:0,overflow:'hidden',maxWidth:'100%'}}>
                            <p style={{color:'var(--color-text-muted)',fontSize:'0.875rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100%',display:'block'}} title={balaustre.ordem_dia}>
                              {balaustre.ordem_dia || '—'}
                            </p>
                          </div>
                          {/* Ações */}
                          <div className="flex gap-1.5" style={{flexShrink:0}}>
                            <button onClick={() => handleVisualizar(balaustre)}
                              style={{padding:'0.25rem 0.55rem',background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)',borderRadius:'var(--radius-md)',fontSize:'0.82rem',cursor:'pointer'}}
                              title="Visualizar">👁️</button>
                            {permissoes?.pode_editar_balaustres && (<>
                              <button onClick={() => handleEditar(balaustre)}
                                style={{padding:'0.25rem 0.55rem',background:'var(--color-accent-bg)',color:'var(--color-accent)',border:'1px solid var(--color-accent)',borderRadius:'var(--radius-md)',fontSize:'0.82rem',cursor:'pointer'}}>✏️</button>
                              <button onClick={() => handleExcluir(balaustre.id)}
                                style={{padding:'0.25rem 0.55rem',background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'var(--radius-md)',fontSize:'0.82rem',cursor:'pointer'}}>🗑️</button>
                            </>)}
                          </div>
                        </div>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
        </div>
      </div>
        );
      })()}

      {/* MODAL DE VISUALIZAÇÃO */}
      {modalVisualizar && balaustreVisualizando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="bg-blue-900 text-white p-6 rounded-t-xl">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>
                  📋 Balaustre Nº {balaustreVisualizando.numero_balaustre} - {balaustreVisualizando.grau_sessao}
                </h3>
                <button
                  onClick={() => setModalVisualizar(false)}
                  className="text-white hover:text-gray-200 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Informações da Sessão */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold mb-2" style={{color:"var(--color-text-muted)"}}>Grau da Sessão</label>
                  <p className="text-lg font-medium">{balaustreVisualizando.grau_sessao}</p>
                </div>

                <div className="p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold mb-2" style={{color:"var(--color-text-muted)"}}>Número do Balaustre</label>
                  <p className="text-lg font-medium">{balaustreVisualizando.numero_balaustre}</p>
                </div>

                <div className="p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold mb-2" style={{color:"var(--color-text-muted)"}}>Data da Sessão</label>
                  <p className="text-lg font-medium">{formatarData(balaustreVisualizando.data_sessao)}</p>
                </div>

                <div className="p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold mb-2" style={{color:"var(--color-text-muted)"}}>Dia da Semana</label>
                  <p className="text-lg font-medium">{balaustreVisualizando.dia_semana}</p>
                </div>

                <div className="p-4 rounded-lg md:col-span-2" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold mb-2" style={{color:"var(--color-text-muted)"}}>Tipo de Sessão</label>
                  <p className="text-lg font-medium">{obterNomeTipoSessao(balaustreVisualizando.tipo_sessao_id)}</p>
                </div>
              </div>

              {/* Ordem do Dia */}
              <div className="mb-6">
                <div className="bg-blue-50 p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold text-blue-900 mb-3" style={{color:"var(--color-text-muted)"}}>📝 Ordem do Dia</label>
                  <div className="whitespace-pre-wrap" style={{color:"var(--color-text)"}}>
                    {balaustreVisualizando.ordem_dia || <span className="italic">Não informada</span>}
                  </div>
                </div>
              </div>

              {/* Observações */}
              {balaustreVisualizando.observacoes && (
                <div className="mb-6">
                  <div className="bg-yellow-50 p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                    <label className="block text-sm font-semibold text-yellow-900 mb-3" style={{color:"var(--color-text-muted)"}}>💡 Observações</label>
                    <div className="whitespace-pre-wrap" style={{color:"var(--color-text)"}}>
                      {balaustreVisualizando.observacoes}
                    </div>
                  </div>
                </div>
              )}

              {/* Botão Fechar */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => setModalVisualizar(false)}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Balaustres;
