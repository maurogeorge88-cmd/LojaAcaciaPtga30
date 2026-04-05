import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  formatarData,
  formatarCPF,
  formatarTelefone,
  calcularIdade
} from '../../utils/formatters';
import { STATUS_IRMAOS } from '../../utils/constants';

const VisualizarIrmaos = ({ irmaos, onEdit, onViewProfile, onViewPerfilCompleto, onUpdate, showSuccess, showError, permissoes, userData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [situacaoFilter, setSituacaoFilter] = useState('regular,licenciado');
  const [grauFilter, setGrauFilter] = useState('todos');
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);
  const [irmaoSelecionado, setIrmaoSelecionado] = useState(null);
  const [familiaresSelecionado, setFamiliaresSelecionado] = useState({
    conjuge: null,
    pais: null,
    filhos: []
  });
  const [loading, setLoading] = useState(false);

  // Função para determinar o grau baseado nas datas
  const obterGrau = (irmao) => {
    if (irmao.data_exaltacao) {
      return irmao.mestre_instalado ? 'Mestre Instalado' : 'Mestre';
    }
    if (irmao.data_elevacao) return 'Companheiro';
    if (irmao.data_iniciacao) return 'Aprendiz';
    return 'Não iniciado';
  };

  // Função para calcular tempo de maçonaria
  const calcularTempoMaconaria = (dataIniciacao) => {
    if (!dataIniciacao) return '';
    const inicio = new Date(dataIniciacao + 'T00:00:00');
    const hoje = new Date();
    let anos = hoje.getFullYear() - inicio.getFullYear();
    let meses = hoje.getMonth() - inicio.getMonth();
    if (meses < 0) {
      anos--;
      meses = 12 + meses;
    }
    return `${anos} ano(s) e ${meses} mês(es)`;
  };

  // Função para obter cor da situação
  const obterStyleSituacao = (situacao) => {
    const cores = {
      regular:    {background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)'},
      irregular:  {background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.3)'},
      licenciado: {background:'rgba(59,130,246,0.15)',color:'#3b82f6',border:'1px solid rgba(59,130,246,0.3)'},
      suspenso: 'bg-orange-100 text-orange-800 border-orange-300',
      desligado: '  ',
      excluido: 'bg-red-100 text-red-800 border-red-300',
      falecido: 'bg-purple-100 text-purple-800 border-purple-300',
      ex_oficio: 'bg-indigo-100 text-indigo-800 border-indigo-300'
    };
    return cores[situacao] || '  ';
  };

  // Função para obter cor do grau
  const obterStyleGrau = (grau) => {
    const cores = {
      'Aprendiz':        {background:'#3b82f6'},
      'Companheiro':     {background:'#10b981'},
      'Mestre':          {background:'#8b5cf6'},
      'Mestre Instalado':{background:'#f59e0b'},
      'Não iniciado':    {background:'#64748b'},
    };
    return cores[grau] || {background:'#64748b'};
  };
  const obterCorGrau = (grau) => '';

  // Carregar detalhes do irmão e familiares
  const carregarDetalhes = async (irmao) => {
    setLoading(true);
    try {
      // Carregar cônjuge
      const { data: conjugeData } = await supabase
        .from('familiares_conjuge')
        .select('*')
        .eq('irmao_id', irmao.id)
        .single();

      // Carregar pais
      const { data: paisData } = await supabase
        .from('familiares_pais')
        .select('*')
        .eq('irmao_id', irmao.id)
        .single();

      // Carregar filhos
      const { data: filhosData } = await supabase
        .from('familiares_filhos')
        .select('*')
        .eq('irmao_id', irmao.id)
        .order('data_nascimento', { ascending: true });

      setFamiliaresSelecionado({
        conjuge: conjugeData || null,
        pais: paisData || null,
        filhos: filhosData || []
      });

      setIrmaoSelecionado(irmao);
      setMostrarDetalhes(true);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      showError('Erro ao carregar detalhes do irmão');
    } finally {
      setLoading(false);
    }
  };

  // Fechar modal de detalhes
  const fecharDetalhes = () => {
    setMostrarDetalhes(false);
    setIrmaoSelecionado(null);
    setFamiliaresSelecionado({ conjuge: null, pais: null, filhos: [] });
  };

  // Deletar irmão
  const deletarIrmao = async (irmaoId) => {
    if (typeof window !== 'undefined' && !window.confirm('Tem certeza que deseja excluir este irmão? Esta ação não pode ser desfeita e irá remover também todos os dados de familiares.')) {
      return;
    }

    setLoading(true);
    try {
      // Deletar familiares (cascade não está configurado, então fazemos manualmente)
      await supabase.from('familiares_conjuge').delete().eq('irmao_id', irmaoId);
      await supabase.from('familiares_pais').delete().eq('irmao_id', irmaoId);
      await supabase.from('familiares_filhos').delete().eq('irmao_id', irmaoId);

      // Deletar irmão
      const { error } = await supabase
        .from('irmaos')
        .delete()
        .eq('id', irmaoId);

      if (error) throw error;

      // Registrar log de exclusão
      if (userData?.id) {
        try {
          const irmaoNome = irmaos.find(i => i.id === irmaoId)?.nome || 'Irmão';
          await supabase.from('logs_acesso').insert([{
            usuario_id: userData.id,
            acao: 'excluir',
            detalhes: `Excluiu irmão: ${irmaoNome}`,
            ip: 'Browser',
            user_agent: navigator.userAgent
          }]);
        } catch (logError) {
          console.error('Erro ao registrar log:', logError);
        }
      }

      showSuccess('Irmão excluído com sucesso!');
      onUpdate();
    } catch (error) {
      console.error('Erro ao excluir irmão:', error);
      showError('Erro ao excluir irmão: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Gerar PDF do irmão
  const gerarPDF = async (irmao) => {
    setLoading(true);
    try {
      // Carregar familiares
      const { data: conjugeData } = await supabase
        .from('familiares_conjuge')
        .select('*')
        .eq('irmao_id', irmao.id)
        .single();

      const { data: paisData } = await supabase
        .from('familiares_pais')
        .select('*')
        .eq('irmao_id', irmao.id)
        .single();

      const { data: filhosData } = await supabase
        .from('familiares_filhos')
        .select('*')
        .eq('irmao_id', irmao.id)
        .order('data_nascimento', { ascending: true });

      // Criar conteúdo do PDF
      const grau = obterGrau(irmao);
      let conteudoPDF = `
        FICHA CADASTRAL DO IRMÃO
        A∴R∴L∴S∴ Acácia de Paranatinga nº 30
        ================================================

        DADOS PESSOAIS
        ------------------------------------------------
        CIM: ${irmao.cim}
        Nome: ${irmao.nome}
        CPF: ${irmao.cpf ? formatarCPF(irmao.cpf) : 'Não informado'}
        RG: ${irmao.rg || 'Não informado'}
        Data de Nascimento: ${irmao.data_nascimento ? formatarData(irmao.data_nascimento) : 'Não informado'}
        Idade: ${irmao.data_nascimento ? calcularIdade(irmao.data_nascimento) : 'Não informado'}
        Estado Civil: ${irmao.estado_civil || 'Não informado'}
        Profissão: ${irmao.profissao || 'Não informado'}
        Escolaridade: ${irmao.escolaridade || 'Não informado'}

        CONTATO
        ------------------------------------------------
        Email: ${irmao.email || 'Não informado'}
        Telefone: ${irmao.telefone ? formatarTelefone(irmao.telefone) : 'Não informado'}
        Endereço: ${irmao.endereco || 'Não informado'}
        Número: ${irmao.numero || ''}
        Complemento: ${irmao.complemento || ''}
        Bairro: ${irmao.bairro || 'Não informado'}
        Cidade: ${irmao.cidade || 'Não informado'}
        Estado: ${irmao.estado || 'Não informado'}
        CEP: ${irmao.cep || 'Não informado'}

        DADOS MAÇÔNICOS
        ------------------------------------------------
        Grau Atual: ${grau}
        Situação: ${irmao.situacao || 'Regular'}
        Data de Iniciação: ${irmao.data_iniciacao ? formatarData(irmao.data_iniciacao) : 'Não informado'}
        Data de Elevação: ${irmao.data_elevacao ? formatarData(irmao.data_elevacao) : 'Não informado'}
        Data de Exaltação: ${irmao.data_exaltacao ? formatarData(irmao.data_exaltacao) : 'Não informado'}
        Tempo de Maçonaria: ${irmao.data_iniciacao ? calcularTempoMaconaria(irmao.data_iniciacao) : 'Não informado'}
        Loja de Origem: ${irmao.loja_origem || 'Não informado'}
        Oriente: ${irmao.oriente || 'Não informado'}
        Grande Oriente: ${irmao.grande_oriente || 'Não informado'}
        Observações: ${irmao.observacoes || 'Nenhuma'}
      `;

      // Adicionar dados do cônjuge
      if (conjugeData) {
        conteudoPDF += `

        CÔNJUGE
        ------------------------------------------------
        Nome: ${conjugeData.nome}
        CPF: ${conjugeData.cpf ? formatarCPF(conjugeData.cpf) : 'Não informado'}
        Data de Nascimento: ${conjugeData.data_nascimento ? formatarData(conjugeData.data_nascimento) : 'Não informado'}
        Idade: ${conjugeData.data_nascimento ? calcularIdade(conjugeData.data_nascimento) : 'Não informado'}
        Profissão: ${conjugeData.profissao || 'Não informado'}
        `;
      }

      // Adicionar dados dos pais
      if (paisData) {
        conteudoPDF += `

        PAIS
        ------------------------------------------------
        Pai: ${paisData.nome_pai || 'Não informado'} ${paisData.pai_vivo ? '(Vivo)' : '(Falecido)'}
        Mãe: ${paisData.nome_mae || 'Não informado'} ${paisData.mae_viva ? '(Viva)' : '(Falecida)'}
        `;
      }

      // Adicionar dados dos filhos
      if (filhosData && filhosData.length > 0) {
        conteudoPDF += `

        FILHOS (${filhosData.length})
        ------------------------------------------------
        `;
        filhosData.forEach((filho, index) => {
          conteudoPDF += `
        ${index + 1}. ${filho.nome}
           Sexo: ${filho.sexo === 'M' ? 'Masculino' : 'Feminino'}
           Data de Nascimento: ${filho.data_nascimento ? formatarData(filho.data_nascimento) : 'Não informado'}
           Idade: ${filho.data_nascimento ? calcularIdade(filho.data_nascimento) : 'Não informado'}
          `;
        });
      }

      conteudoPDF += `

        ================================================
        Documento gerado em ${new Date().toLocaleString('pt-BR')}
      `;

      // Criar blob e download
      const blob = new Blob([conteudoPDF], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ficha_${irmao.nome.replace(/\s+/g, '_')}_${irmao.cim}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showSuccess('Ficha gerada com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      showError('Erro ao gerar ficha');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar irmãos
  const irmaosFiltrados = irmaos.filter(irmao => {
    // Filtro de busca (nome ou CIM)
    const matchSearch = irmao.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        irmao.cim?.toString().includes(searchTerm);

    // Filtro de situação
    const situacaoAtual = (irmao.situacao || 'regular').toLowerCase();
    let matchSituacao = false;
    
    if (situacaoFilter === 'todos') {
      matchSituacao = true;
    } else if (situacaoFilter === 'regular,licenciado') {
      matchSituacao = situacaoAtual === 'regular' || situacaoAtual === 'licenciado';
    } else {
      matchSituacao = situacaoAtual === situacaoFilter;
    }

    // Filtro de grau
    const grauAtual = obterGrau(irmao);
    const matchGrau = grauFilter === 'todos' || grauAtual === grauFilter;

    return matchSearch && matchSituacao && matchGrau;
  });

  return (
    <div className="space-y-6" style={{background:"var(--color-bg)",minHeight:"100vh",padding:"1rem",overflowX:"hidden"}}>
      {/* Filtros */}
      <div className="rounded-lg shadow p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Busca */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>
              🔍 Buscar
            </label>
            <input
              type="text"
              placeholder="Nome ou CIM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
            />
          </div>

          {/* Filtro de Situação */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>
              📊 Situação
            </label>
            <select
              value={situacaoFilter}
              onChange={(e) => setSituacaoFilter(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
            >
              <option value="regular,licenciado">Regulares e Licenciados</option>
              <option value="todos">Todas as Situações</option>
              {STATUS_IRMAOS.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Grau */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>
              🔺 Grau
            </label>
            <select
              value={grauFilter}
              onChange={(e) => setGrauFilter(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
            >
              <option value="todos">Todos os Graus</option>
              <option value="Aprendiz">Aprendiz</option>
              <option value="Companheiro">Companheiro</option>
              <option value="Mestre">Mestre</option>
              <option value="Não iniciado">Não iniciado</option>
            </select>
          </div>
        </div>

        {/* Contador */}
        <div style={{marginTop:"1rem",fontSize:"0.85rem",color:"var(--color-text-muted)"}}>
          Exibindo <strong>{irmaosFiltrados.length}</strong> de <strong>{irmaos.length}</strong> irmãos
        </div>
      </div>

      {/* Cards de Irmãos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" style={{padding:"0.25rem"}}>
        {irmaosFiltrados.map(irmao => {
          const grau = obterGrau(irmao);
          const situacao = (irmao.situacao || 'regular').toLowerCase();
          
          return (
            <div
              key={irmao.id}
              className="rounded-lg border-l-4 transition-opacity hover:opacity-95 overflow-hidden"
              style={{borderLeftColor:"var(--color-accent)",background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              {/* Foto e Grau */}
              <div className="relative" style={{background:"var(--color-surface-2)",overflow:"hidden",height:"10rem"}}>
                {irmao.foto_url ? (
                  <img
                    src={irmao.foto_url}
                    alt={irmao.nome}
                    style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}
                  />
                ) : (
                  <div style={{width:"100%",height:"100%",background:"var(--color-accent)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span className="text-6xl text-white">👤</span>
                  </div>
                )}
                
                {/* Badge do Grau */}
                <div style={{position:"absolute",top:"0.5rem",right:"0.5rem",color:"#fff",padding:"0.2rem 0.65rem",borderRadius:"999px",fontSize:"0.7rem",fontWeight:"800",...obterStyleGrau(grau)}}>
                  {grau}
                </div>
              </div>

              {/* Informações */}
              <div className="p-4">
                <h3 className="font-bold text-lg truncate" style={{color:"var(--color-accent)"}} title={irmao.nome}>
                  {irmao.nome}
                </h3>
                
                <div className="mt-2 space-y-1">
                  <p className="text-sm" style={{color:"var(--color-text-muted)",marginTop:"0.25rem"}}>
                    <span className="font-semibold" style={{color:"var(--color-accent)",fontSize:"0.8rem",letterSpacing:"0.03em"}}>CIM</span> <span style={{color:"var(--color-text)",fontWeight:"600"}}>{irmao.cim}</span>
                  </p>
                  
                  {irmao.data_nascimento && (
                    <p className="text-sm" style={{color:"var(--color-text-muted)"}}>
                      <span className="font-semibold" style={{color:"var(--color-text)"}}>Idade:</span> {calcularIdade(irmao.data_nascimento)}
                    </p>
                  )}
                  
                  {irmao.data_iniciacao && (
                    <p style={{fontSize:"0.85rem",color:"var(--color-text-muted)"}}>
                      <span style={{fontWeight:"600",color:"var(--color-text)"}}>Iniciação:</span> {formatarData(irmao.data_iniciacao)}
                    </p>
                  )}
                </div>

                {/* Badge de Situação */}
                <div className="mt-3 flex gap-2 flex-wrap">
                  <span style={{display:"inline-block",padding:"0.2rem 0.65rem",borderRadius:"999px",fontSize:"0.72rem",fontWeight:"700",...obterStyleSituacao(situacao)}}>
                    {irmao.situacao || 'Regular'}
                  </span>
                  
                  {/* ← NOVO: Periodicidade de Pagamento Editável */}
                  <select
                    value={irmao.periodicidade_pagamento || 'Mensal'}
                    onChange={async (e) => {
                      e.stopPropagation();
                      try {
                        const { error } = await supabase
                          .from('irmaos')
                          .update({ periodicidade_pagamento: e.target.value })
                          .eq('id', irmao.id);
                        
                        if (error) throw error;
                        showSuccess('Periodicidade atualizada!');
                        onUpdate();
                      } catch (error) {
                        showError('Erro ao atualizar: ' + error.message);
                      }
                    }}
                    className="inline-block px-2 py-1 rounded-lg text-xs font-medium"
                    style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    title="Periodicidade de Pagamento"
                  >
                    <option value="Mensal">📅 Mensal</option>
                    <option value="Semestral">📆 Semestral</option>
                    <option value="Anual">📊 Anual</option>
                  </select>
                </div>

                {/* Botões de Ação */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => onViewProfile(irmao.id)}
                    style={{padding:"0.45rem 0.6rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-md)",fontSize:"1rem",cursor:"pointer"}}
                    title="Ver Perfil"
                  >
                    👁️
                  </button>
                  
                  <button
                    onClick={() => onViewPerfilCompleto && onViewPerfilCompleto(irmao.id)}
                    style={{padding:"0.45rem 0.75rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-md)",fontSize:"0.85rem",fontWeight:"600",cursor:"pointer"}}
                    title="Perfil Completo"
                  >
                    📋
                  </button>
                  
                       
                  {permissoes?.canEdit && (
                    <button
                      onClick={() => onEdit(irmao)}
                      style={{padding:"0.45rem 0.6rem",background:"var(--color-accent-bg)",color:"var(--color-accent)",border:"1px solid var(--color-accent)",borderRadius:"var(--radius-md)",fontSize:"1rem",cursor:"pointer"}}
                      title="Editar"
                    >
                      ✏️
                    </button>
                  )}
                  
                  <button
                    onClick={() => gerarPDF(irmao)}
                    style={{padding:"0.45rem 0.75rem",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.85rem",fontWeight:"600",cursor:"pointer"}}
                    title="Gerar Ficha"
                  >
                    📄
                  </button>
                  
                  {permissoes?.canEdit && (
                    <button
                      onClick={() => deletarIrmao(irmao.id)}
                      style={{padding:"0.45rem 0.75rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.85rem",fontWeight:"600",cursor:"pointer"}}
                      title="Excluir"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mensagem quando não há resultados */}
      {irmaosFiltrados.length === 0 && (
        <div className="rounded-lg shadow p-12 text-center" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold mb-2" style={{color:"var(--color-text)"}}>
            Nenhum irmão encontrado
          </h3>
          <p>
            Tente ajustar os filtros de busca
          </p>
        </div>
      )}

      {/* Modal de Detalhes */}
      {mostrarDetalhes && irmaoSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            {/* Header do Modal */}
            <div style={{position:"sticky",top:0,background:"var(--color-accent)",padding:"1.5rem",borderRadius:"var(--radius-xl) var(--radius-xl) 0 0"}}>
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>Detalhes do Irmão</h2>
                <button
                  onClick={fecharDetalhes}
                  className="text-white hover:text-gray-200 text-3xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 space-y-6">
              {/* Foto e Informações Básicas */}
              <div className="flex gap-6">
                {irmaoSelecionado.foto_url ? (
                  <img
                    src={irmaoSelecionado.foto_url}
                    alt={irmaoSelecionado.nome}
                    className="w-32 h-32 rounded-lg object-cover"
                  />
                ) : (
                  <div style={{width:"8rem",height:"8rem",background:"var(--color-accent)",borderRadius:"var(--radius-lg)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span className="text-5xl text-white">👤</span>
                  </div>
                )}

                <div className="flex-1">
                  <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>{irmaoSelecionado.nome}</h3>
                  <p className="mt-1">CIM: {irmaoSelecionado.cim}</p>
                  <div className="mt-3 flex gap-2">
                    <span style={{...obterStyleGrau(obterGrau(irmaoSelecionado)),padding:"0.2rem 0.75rem",borderRadius:"999px",fontSize:"0.82rem",fontWeight:"700",color:"#fff"}}>
                      {obterGrau(irmaoSelecionado)}
                    </span>
                    <span style={{...obterStyleSituacao((irmaoSelecionado.situacao||'regular').toLowerCase()),padding:"0.2rem 0.75rem",borderRadius:"999px",fontSize:"0.82rem",fontWeight:"700"}}>
                      {irmaoSelecionado.situacao || 'Regular'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dados Pessoais */}
              <div className="rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <h4 className="font-bold text-lg text-blue-900 mb-3 border-b pb-2" style={{color:"var(--color-text)"}}>👤 Dados Pessoais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-semibold">CPF:</span>
                    <span className="ml-2">{irmaoSelecionado.cpf ? formatarCPF(irmaoSelecionado.cpf) : 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">RG:</span>
                    <span className="ml-2">{irmaoSelecionado.rg || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Data Nascimento:</span>
                    <span className="ml-2">{irmaoSelecionado.data_nascimento ? formatarData(irmaoSelecionado.data_nascimento) : 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Idade:</span>
                    <span className="ml-2">{irmaoSelecionado.data_nascimento ? calcularIdade(irmaoSelecionado.data_nascimento) : 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Estado Civil:</span>
                    <span className="ml-2">{irmaoSelecionado.estado_civil || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Profissão:</span>
                    <span className="ml-2">{irmaoSelecionado.profissao || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Escolaridade:</span>
                    <span className="ml-2">{irmaoSelecionado.escolaridade || 'Não informado'}</span>
                  </div>
                </div>
              </div>

              {/* Contato */}
              <div className="rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <h4 className="font-bold text-lg text-green-900 mb-3 border-b pb-2" style={{color:"var(--color-text)"}}>📞 Contato</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-semibold">Email:</span>
                    <span className="ml-2">{irmaoSelecionado.email || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Telefone:</span>
                    <span className="ml-2">{irmaoSelecionado.telefone ? formatarTelefone(irmaoSelecionado.telefone) : 'Não informado'}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-semibold">Endereço:</span>
                    <span className="ml-2">
                      {irmaoSelecionado.endereco || 'Não informado'}
                      {irmaoSelecionado.numero && `, ${irmaoSelecionado.numero}`}
                      {irmaoSelecionado.complemento && ` - ${irmaoSelecionado.complemento}`}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">Bairro:</span>
                    <span className="ml-2">{irmaoSelecionado.bairro || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Cidade/Estado:</span>
                    <span className="ml-2">
                      {irmaoSelecionado.cidade || 'Não informado'}
                      {irmaoSelecionado.estado && `/${irmaoSelecionado.estado}`}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">CEP:</span>
                    <span className="ml-2">{irmaoSelecionado.cep || 'Não informado'}</span>
                  </div>
                </div>
              </div>

              {/* Dados Maçônicos */}
              <div className="rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <h4 className="font-bold text-lg text-purple-900 mb-3 border-b pb-2" style={{color:"var(--color-text)"}}>🔺 Dados Maçônicos</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-semibold">Data Iniciação:</span>
                    <span className="ml-2">{irmaoSelecionado.data_iniciacao ? formatarData(irmaoSelecionado.data_iniciacao) : 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Data Elevação:</span>
                    <span className="ml-2">{irmaoSelecionado.data_elevacao ? formatarData(irmaoSelecionado.data_elevacao) : 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Data Exaltação:</span>
                    <span className="ml-2">{irmaoSelecionado.data_exaltacao ? formatarData(irmaoSelecionado.data_exaltacao) : 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Tempo Maçonaria:</span>
                    <span className="ml-2">{irmaoSelecionado.data_iniciacao ? calcularTempoMaconaria(irmaoSelecionado.data_iniciacao) : 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Loja Origem:</span>
                    <span className="ml-2">{irmaoSelecionado.loja_origem || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Oriente:</span>
                    <span className="ml-2">{irmaoSelecionado.oriente || 'Não informado'}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-semibold">Grande Oriente:</span>
                    <span className="ml-2">{irmaoSelecionado.grande_oriente || 'Não informado'}</span>
                  </div>
                  {irmaoSelecionado.observacoes && (
                    <div className="md:col-span-2">
                      <span className="font-semibold">Observações:</span>
                      <p className="ml-2 mt-1">{irmaoSelecionado.observacoes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Cônjuge */}
              {familiaresSelecionado.conjuge && (
                <div className="rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  <h4 className="font-bold text-lg text-pink-900 mb-3 border-b pb-2" style={{color:"var(--color-text)"}}>💑 Cônjuge</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-semibold">Nome:</span>
                      <span className="ml-2">{familiaresSelecionado.conjuge.nome}</span>
                    </div>
                    <div>
                      <span className="font-semibold">CPF:</span>
                      <span className="ml-2">{familiaresSelecionado.conjuge.cpf ? formatarCPF(familiaresSelecionado.conjuge.cpf) : 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Data Nascimento:</span>
                      <span className="ml-2">{familiaresSelecionado.conjuge.data_nascimento ? formatarData(familiaresSelecionado.conjuge.data_nascimento) : 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Idade:</span>
                      <span className="ml-2">{familiaresSelecionado.conjuge.data_nascimento ? calcularIdade(familiaresSelecionado.conjuge.data_nascimento) : 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Profissão:</span>
                      <span className="ml-2">{familiaresSelecionado.conjuge.profissao || 'Não informado'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Pais */}
              {familiaresSelecionado.pais && (
                <div className="rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  <h4 className="font-bold text-lg text-indigo-900 mb-3 border-b pb-2" style={{color:"var(--color-text)"}}>👨‍👩‍👦 Pais</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-semibold">Pai:</span>
                      <span className="ml-2">
                        {familiaresSelecionado.pais.nome_pai || 'Não informado'}
                        {familiaresSelecionado.pais.nome_pai && (
                          <span style={{marginLeft:'0.5rem',color:familiaresSelecionado.pais.pai_vivo?'#10b981':'var(--color-text-muted)'}}>
                            {familiaresSelecionado.pais.pai_vivo ? '(Vivo)' : '(Falecido)'}
                          </span>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold">Mãe:</span>
                      <span className="ml-2">
                        {familiaresSelecionado.pais.nome_mae || 'Não informado'}
                        {familiaresSelecionado.pais.nome_mae && (
                          <span style={{marginLeft:'0.5rem',color:familiaresSelecionado.pais.mae_viva?'#10b981':'var(--color-text-muted)'}}>
                            {familiaresSelecionado.pais.mae_viva ? '(Viva)' : '(Falecida)'}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Filhos */}
              {familiaresSelecionado.filhos.length > 0 && (
                <div className="rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  <h4 className="font-bold text-lg text-blue-900 mb-3 border-b pb-2" style={{color:"var(--color-text)"}}>
                    👶 Filhos ({familiaresSelecionado.filhos.length})
                  </h4>
                  <div className="space-y-3">
                    {familiaresSelecionado.filhos.map((filho, index) => (
                      <div key={index} className="rounded p-3 border">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{filho.sexo === 'M' ? '👦' : '👧'}</span>
                          <span className="font-semibold">{filho.nome}</span>
                        </div>
                        <div className="text-sm space-y-1">
                          <div>
                            <span className="font-semibold">Sexo:</span> {filho.sexo === 'M' ? 'Masculino' : 'Feminino'}
                          </div>
                          <div>
                            <span className="font-semibold">Data Nascimento:</span> {filho.data_nascimento ? formatarData(filho.data_nascimento) : 'Não informado'}
                          </div>
                          {filho.data_nascimento && (
                            <div>
                              <span className="font-semibold">Idade:</span> {calcularIdade(filho.data_nascimento)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="sticky bottom-0 p-4 rounded-b-lg flex justify-end gap-3">
              <button
                onClick={() => gerarPDF(irmaoSelecionado)}
                style={{padding:"0.5rem 1.5rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}
              >
                📄 Gerar Ficha
              </button>
              {permissoes?.canEdit && (
                <button
                  onClick={() => {
                    fecharDetalhes();
                    onEdit(irmaoSelecionado);
                  }}
                  style={{padding:"0.5rem 1.5rem",background:"#f59e0b",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}
                >
                  ✏️ Editar
                </button>
              )}
              <button
                onClick={fecharDetalhes}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg transition-colors" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualizarIrmaos;
