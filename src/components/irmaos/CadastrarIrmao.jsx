// ===================================================================
// VERSÃO FINAL - USA TABELAS ANTIGAS: esposas, pais, filhos
// Data: 27/11/2025 - CONFIRME QUE ESTE COMENTÁRIO ESTÁ NO ARQUIVO!
// ===================================================================
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import VidaMaconica from '../vida-maconica/VidaMaconica';
import GestaoSituacoes from './GestaoSituacoes';
import {
  formatarCPF,
  formatarTelefone,
  limparCPF,
  limparTelefone,
  validarEmail,
  calcularIdade
} from '../../utils/formatters';
import {
  ESTADOS_CIVIS,
  NIVEIS_ESCOLARIDADE,
  STATUS_IRMAOS
} from '../../utils/constants';

const CadastrarIrmao = ({ irmaos, irmaoParaEditar, onUpdate, showSuccess, showError, onCancelarEdicao, userData }) => {
  // Estado do formulário principal
  const [irmaoForm, setIrmaoForm] = useState({
    cim: '',
    nome: '',
    cpf: '',
    rg: '',
    data_nascimento: '',
    email: '',
    telefone: '',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    profissao: '',
    estado_civil: 'solteiro',
    escolaridade: 'fundamental_incompleto',
    foto_url: '',
    data_iniciacao: '',
    data_elevacao: '',
    data_exaltacao: '',
    mestre_instalado: false,
    data_instalacao: '',
    data_ingresso_loja: '',           // NOVO: Data que veio transferido
    data_transferencia_saida: '',     // NOVO: Data que saiu transferido
    loja_origem: '',
    oriente: '',
    grande_oriente: '',
    situacao: 'regular',
    periodicidade_pagamento: 'Mensal',  // ← NOVO CAMPO ADICIONADO
    data_licenca: '',                    // Data início da licença
    data_desligamento: '',               // Data do desligamento (usado para Desligado e Ex-Ofício)
    data_falecimento: '',                // Data do falecimento
    observacoes: '',
    status: 'ativo'
  });

  // Estado dos familiares
  const [conjuge, setConjuge] = useState({
    nome: '',
    cpf: '',
    data_nascimento: '',
    data_casamento: '',
    profissao: ''
  });

  const [pais, setPais] = useState({
    nome_pai: '',
    pai_vivo: true,
    data_nascimento_pai: '',
    data_obito_pai: '',
    nome_mae: '',
    mae_viva: true,
    data_nascimento_mae: '',
    data_obito_mae: ''
  });

  const [filhos, setFilhos] = useState([]);
  const [filhoEditandoIndex, setFilhoEditandoIndex] = useState(null);
  const [filhoForm, setFilhoForm] = useState({
    nome: '',
    data_nascimento: '',
    sexo: 'M',
    tipo_vinculo: 'filho',
    vivo: true,
    data_obito: ''
  });

  // Estados de controle
  const [modoEdicao, setModoEdicao] = useState(false);
  const [irmaoEditando, setIrmaoEditando] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mostrarConjuge, setMostrarConjuge] = useState(false);
  const [abaSelecionada, setAbaSelecionada] = useState('pessoal'); // pessoal, maconico, familiar
  
  // Estados para histórico de cargos
  const [historicoCargos, setHistoricoCargos] = useState([]);
  const [cargoEditandoIndex, setCargoEditandoIndex] = useState(null);
  const [cargoForm, setCargoForm] = useState({
    ano: new Date().getFullYear(),
    cargo: ''
  });

  // Estados para documentos
  const [documentos, setDocumentos] = useState([]);

  // Função para carregar documentos
  const carregarDocumentos = async (irmaoId) => {
    if (!irmaoId) return;
    const { data } = await supabase
      .from('documentos_irmaos')
      .select('*')
      .eq('irmao_id', irmaoId)
      .order('created_at', { ascending: false });
    
    setDocumentos(data || []);
  };

  // Função para upload de foto
  const handleUploadFoto = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('❌ Apenas imagens são permitidas');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('❌ Imagem muito grande. Máximo 5MB');
      return;
    }

    try {
      const irmaoId = irmaoEditando?.id;
      if (!irmaoId) {
        showError('❌ Salve o cadastro antes de enviar a foto');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${irmaoId}_${Date.now()}.${fileExt}`;
      const filePath = `fotos_irmaos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('loja-acacia')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('loja-acacia')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('irmaos')
        .update({ foto_url: publicUrl })
        .eq('id', irmaoId);

      if (updateError) throw updateError;

      setIrmaoForm(prev => ({ ...prev, foto_url: publicUrl }));
      showSuccess('✅ Foto atualizada com sucesso!');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      showError('❌ Erro ao fazer upload: ' + error.message);
    }
  };

  // Função para upload de PDF
  const handleUploadPDF = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      showError('❌ Apenas arquivos PDF são permitidos');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError('❌ Arquivo muito grande. Máximo 10MB');
      return;
    }

    try {
      const irmaoId = irmaoEditando?.id;
      if (!irmaoId) {
        showError('❌ Salve o cadastro antes de enviar documentos');
        return;
      }

      const fileName = `${irmaoId}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `documentos_irmaos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('loja-acacia')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('loja-acacia')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from('documentos_irmaos')
        .insert({
          irmao_id: irmaoId,
          nome_arquivo: file.name,
          url_arquivo: publicUrl,
          tipo: 'pdf'
        });

      if (insertError) throw insertError;

      showSuccess('✅ Documento enviado com sucesso!');
      carregarDocumentos(irmaoId);
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      showError('❌ Erro ao fazer upload: ' + error.message);
    }
  };

  // Função para excluir documento
  const handleExcluirDocumento = async (docId, urlArquivo) => {
    if (!confirm('Deseja realmente excluir este documento?')) return;

    try {
      const filePath = urlArquivo.split('/').slice(-2).join('/');
      
      await supabase.storage
        .from('loja-acacia')
        .remove([filePath]);

      const { error } = await supabase
        .from('documentos_irmaos')
        .delete()
        .eq('id', docId);

      if (error) throw error;

      showSuccess('✅ Documento excluído com sucesso!');
      carregarDocumentos(irmaoEditando?.id);
    } catch (error) {
      showError('❌ Erro ao excluir documento: ' + error.message);
    }
  };

  // Carregar documentos quando mudar para aba documentos
  useEffect(() => {
    if (abaSelecionada === 'documentos' && irmaoEditando?.id) {
      carregarDocumentos(irmaoEditando.id);
    }
  }, [abaSelecionada, irmaoEditando]);

  // Função para carregar dados do irmão para edição
  const carregarParaEdicao = useCallback(async (irmao) => {
    console.log('📝 Iniciando carregamento para edição:', irmao);
    setModoEdicao(true);
    setIrmaoEditando(irmao);
    setAbaSelecionada('pessoal');

    // Carregar dados do irmão
    console.log('📋 Carregando dados do formulário...');
    setIrmaoForm({
      cim: irmao.cim || '',
      nome: irmao.nome || '',
      cpf: irmao.cpf || '',
      rg: irmao.rg || '',
      data_nascimento: irmao.data_nascimento || '',
      email: irmao.email || '',
      telefone: irmao.telefone || '',
      cep: irmao.cep || '',
      endereco: irmao.endereco || '',
      numero: irmao.numero || '',
      complemento: irmao.complemento || '',
      bairro: irmao.bairro || '',
      cidade: irmao.cidade || '',
      estado: irmao.estado || '',
      profissao: irmao.profissao || '',
      estado_civil: irmao.estado_civil || 'solteiro',
      escolaridade: irmao.escolaridade || 'fundamental_incompleto',
      foto_url: irmao.foto_url || '',
      data_iniciacao: irmao.data_iniciacao || '',
      data_elevacao: irmao.data_elevacao || '',
      data_exaltacao: irmao.data_exaltacao || '',
      data_ingresso_loja: irmao.data_ingresso_loja || '',
      data_transferencia_saida: irmao.data_transferencia_saida || '',
      loja_origem: irmao.loja_origem || '',
      oriente: irmao.oriente || '',
      grande_oriente: irmao.grande_oriente || '',
      situacao: irmao.situacao || 'regular',
      periodicidade_pagamento: irmao.periodicidade_pagamento || 'Mensal',
      data_licenca: irmao.data_licenca || '',
      data_desligamento: irmao.data_desligamento || '',
      data_falecimento: irmao.data_falecimento || '',
      observacoes: irmao.observacoes || '',
      status: irmao.status || 'ativo'
    });
    console.log('✅ Formulário carregado!');

    // Carregar esposa
    try {
      const { data: esposaData } = await supabase
        .from('esposas')
        .select('*')
        .eq('irmao_id', irmao.id)
        .single();

      if (esposaData) {
        setMostrarConjuge(true);
        setConjuge({
          nome: esposaData.nome || '',
          cpf: esposaData.cpf || '',
          data_nascimento: esposaData.data_nascimento || '',
          data_casamento: esposaData.data_casamento || '',
          profissao: esposaData.profissao || ''
        });
      } else {
        setMostrarConjuge(false);
      }
    } catch (error) {
      setMostrarConjuge(false);
    }

    // Carregar pais (2 registros: tipo="pai" e tipo="mae")
    try {
      const { data: paisData } = await supabase
        .from('pais')
        .select('*')
        .eq('irmao_id', irmao.id);

      if (paisData && paisData.length > 0) {
        const pai = paisData.find(p => p.tipo === 'pai');
        const mae = paisData.find(p => p.tipo === 'mae');
        
        setPais({
          nome_pai: pai?.nome || '',
          pai_vivo: pai ? !pai.falecido : true,
          data_nascimento_pai: pai?.data_nascimento || '',
          data_obito_pai: pai?.data_obito || '',
          nome_mae: mae?.nome || '',
          mae_viva: mae ? !mae.falecido : true,
          data_nascimento_mae: mae?.data_nascimento || '',
          data_obito_mae: mae?.data_obito || ''
        });
      }
    } catch (error) {
      setPais({ 
        nome_pai: '', 
        pai_vivo: true, 
        data_nascimento_pai: '', 
        data_obito_pai: '', 
        nome_mae: '', 
        mae_viva: true, 
        data_nascimento_mae: '', 
        data_obito_mae: '' 
      });
    }

    // Carregar filhos
    try {
      const { data: filhosData } = await supabase
        .from('filhos')
        .select('*')
        .eq('irmao_id', irmao.id)
        .order('data_nascimento', { ascending: true });

      if (filhosData && filhosData.length > 0) {
        setFilhos(filhosData.map(f => ({
          nome: f.nome,
          data_nascimento: f.data_nascimento,
          sexo: f.sexo || (f.tipo === 'Filho' ? 'M' : 'F'),
          tipo_vinculo: f.tipo_vinculo || (f.sexo === 'M' ? 'filho' : 'filha'),
          vivo: f.vivo !== undefined ? f.vivo : true,
          data_obito: f.data_obito || ''
        })));
      } else {
        setFilhos([]);
      }
    } catch (error) {
      setFilhos([]);
    }

    // Carregar histórico de cargos
    try {
      const { data: cargosData } = await supabase
        .from('historico_cargos')
        .select('*')
        .eq('irmao_id', irmao.id)
        .order('ano', { ascending: false });

      if (cargosData && cargosData.length > 0) {
        setHistoricoCargos(cargosData.map(c => ({
          ano: c.ano,
          cargo: c.cargo
        })));
      } else {
        setHistoricoCargos([]);
      }
    } catch (error) {
      console.log('ℹ️ Tabela historico_cargos não existe ainda ou sem cargos');
      setHistoricoCargos([]);
    }

    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []); // Sem dependências pois usa apenas props e setters

  // useEffect para carregar dados quando irmaoParaEditar mudar
  useEffect(() => {
    console.log('🔍 useEffect - irmaoParaEditar mudou:', irmaoParaEditar);
    if (irmaoParaEditar) {
      console.log('📝 Carregando irmão para edição:', irmaoParaEditar);
      carregarParaEdicao(irmaoParaEditar);
    }
  }, [irmaoParaEditar, carregarParaEdicao]);

  // Validar CIM único
  const validarCIM = (cim, idAtual = null) => {
    return !irmaos.some(i => i.cim === cim && i.id !== idAtual);
  };

  // Adicionar filho à lista
  const adicionarFilho = () => {
    if (!filhoForm.nome.trim()) {
      showError('Preencha o nome do filho');
      return;
    }

    if (filhoEditandoIndex !== null) {
      const novosFilhos = [...filhos];
      novosFilhos[filhoEditandoIndex] = { ...filhoForm };
      setFilhos(novosFilhos);
      setFilhoEditandoIndex(null);
      showSuccess('Filho atualizado');
    } else {
      setFilhos([...filhos, { ...filhoForm }]);
      showSuccess('Filho adicionado à lista');
    }
    
    setFilhoForm({ nome: '', data_nascimento: '', sexo: 'M', tipo_vinculo: 'filho', vivo: true, data_obito: '' });
  };

  const editarFilho = (index) => {
    setFilhoForm({ ...filhos[index] });
    setFilhoEditandoIndex(index);
  };

  const cancelarEdicaoFilho = () => {
    setFilhoForm({ nome: '', data_nascimento: '', sexo: 'M', tipo_vinculo: 'filho', vivo: true, data_obito: '' });
    setFilhoEditandoIndex(null);
  };

  // Remover filho da lista
  const removerFilho = (index) => {
    setFilhos(filhos.filter((_, i) => i !== index));
    setFilhoEditandoIndex(null);
    setFilhoForm({ nome: '', data_nascimento: '', sexo: 'M', tipo_vinculo: 'filho', vivo: true, data_obito: '' });
    showSuccess('Filho removido da lista');
  };

  // Salvar irmão e familiares
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validações
      if (!irmaoForm.cim.trim()) {
        throw new Error('CIM é obrigatório');
      }
      if (!irmaoForm.nome.trim()) {
        throw new Error('Nome é obrigatório');
      }
      if (!validarCIM(irmaoForm.cim, irmaoEditando?.id)) {
        throw new Error('CIM já cadastrado para outro irmão');
      }
      if (irmaoForm.email && !validarEmail(irmaoForm.email)) {
        throw new Error('Email inválido');
      }

      // Preparar dados do irmão (TODOS os campos)
      const dadosIrmao = {
        cim: irmaoForm.cim.trim(),
        nome: irmaoForm.nome.trim(),
        cpf: limparCPF(irmaoForm.cpf),
        rg: irmaoForm.rg || null,
        data_nascimento: irmaoForm.data_nascimento || null,
        email: irmaoForm.email || null,
        telefone: limparTelefone(irmaoForm.telefone),
        cep: irmaoForm.cep || null,
        endereco: irmaoForm.endereco || null,
        numero: irmaoForm.numero || null,
        complemento: irmaoForm.complemento || null,
        bairro: irmaoForm.bairro || null,
        cidade: irmaoForm.cidade || null,
        estado: irmaoForm.estado || null,
        profissao: irmaoForm.profissao || null,
        estado_civil: irmaoForm.estado_civil || 'solteiro',
        escolaridade: irmaoForm.escolaridade || 'fundamental_incompleto',
        foto_url: irmaoForm.foto_url || null,
        data_iniciacao: irmaoForm.data_iniciacao || null,
        data_elevacao: irmaoForm.data_elevacao || null,
        data_exaltacao: irmaoForm.data_exaltacao || null,
        data_ingresso_loja: irmaoForm.data_ingresso_loja || null,
        data_transferencia_saida: irmaoForm.data_transferencia_saida || null,
        loja_origem: irmaoForm.loja_origem || null,
        oriente: irmaoForm.oriente || null,
        grande_oriente: irmaoForm.grande_oriente || null,
        situacao: irmaoForm.situacao || 'regular',
        periodicidade_pagamento: irmaoForm.periodicidade_pagamento || 'Mensal',
        data_licenca: irmaoForm.data_licenca || null,
        data_desligamento: irmaoForm.data_desligamento || null,
        data_falecimento: irmaoForm.data_falecimento || null,
        observacoes: irmaoForm.observacoes || null,
        status: irmaoForm.status || 'ativo'
      };

      let irmaoId;

      if (modoEdicao && irmaoEditando) {
        // Atualizar irmão existente
        const { error: errorIrmao } = await supabase
          .from('irmaos')
          .update(dadosIrmao)
          .eq('id', irmaoEditando.id);

        if (errorIrmao) throw errorIrmao;
        irmaoId = irmaoEditando.id;

        // Atualizar ou inserir cônjuge
        if (mostrarConjuge && conjuge.nome.trim()) {
          const dadosConjuge = {
            irmao_id: irmaoId,
            nome: conjuge.nome.trim(),
            cpf: limparCPF(conjuge.cpf),
            data_nascimento: conjuge.data_nascimento || null,
            data_casamento: conjuge.data_casamento || null,
            profissao: conjuge.profissao || null
          };

          console.log('💾 SALVANDO ESPOSA:', dadosConjuge);

          // Verificar se já existe cônjuge
          const { data: conjugeExistente } = await supabase
            .from('esposas')
            .select('id')
            .eq('irmao_id', irmaoId)
            .single();

          if (conjugeExistente) {
            console.log('♻️ Atualizando esposa existente ID:', conjugeExistente.id);
            const result = await supabase
              .from('esposas')
              .update(dadosConjuge)
              .eq('id', conjugeExistente.id);
            console.log('✅ Resultado update esposa:', result);
          } else {
            console.log('➕ Inserindo nova esposa');
            const result = await supabase
              .from('esposas')
              .insert([dadosConjuge]);
            console.log('✅ Resultado insert esposa:', result);
          }
        } else if (!mostrarConjuge) {
          // Remover cônjuge se desmarcou
          await supabase
            .from('esposas')
            .delete()
            .eq('irmao_id', irmaoId);
        }

        // Atualizar ou inserir pais (deletar e reinserir)
        await supabase.from('pais').delete().eq('irmao_id', irmaoId);
        
        if (pais.nome_pai.trim()) {
          await supabase.from('pais').insert([{
            irmao_id: irmaoId,
            tipo: 'pai',
            nome: pais.nome_pai.trim(),
            falecido: !pais.pai_vivo,
            data_nascimento: pais.data_nascimento_pai || null,
            data_obito: pais.data_obito_pai || null
          }]);
        }
        if (pais.nome_mae.trim()) {
          await supabase.from('pais').insert([{
            irmao_id: irmaoId,
            tipo: 'mae',
            nome: pais.nome_mae.trim(),
            falecido: !pais.mae_viva,
            data_nascimento: pais.data_nascimento_mae || null,
            data_obito: pais.data_obito_mae || null
          }]);
        }

        // Atualizar filhos (remover todos e reinserir)
        await supabase
          .from('filhos')
          .delete()
          .eq('irmao_id', irmaoId);

        if (filhos.length > 0) {
          const dadosFilhos = filhos.map(filho => ({
            irmao_id: irmaoId,
            nome: filho.nome.trim(),
            data_nascimento: filho.data_nascimento || null,
            sexo: filho.sexo,
            tipo_vinculo: filho.tipo_vinculo || (filho.sexo === 'M' ? 'filho' : 'filha'),
            vivo: filho.vivo !== undefined ? filho.vivo : true,
            data_obito: filho.data_obito || null
          }));

          await supabase
            .from('filhos')
            .insert(dadosFilhos);
        }

        // Atualizar histórico de cargos (remover todos e reinserir)
        await supabase
          .from('historico_cargos')
          .delete()
          .eq('irmao_id', irmaoId);

        if (historicoCargos.length > 0) {
          const dadosCargos = historicoCargos.map(cargo => ({
            irmao_id: irmaoId,
            ano: parseInt(cargo.ano),
            cargo: cargo.cargo.trim()
          }));

          await supabase
            .from('historico_cargos')
            .insert(dadosCargos);
        }

        showSuccess('Irmão atualizado com sucesso!');
        
        // Registrar log de edição
        if (userData?.id) {
          try {
            await supabase.from('logs_acesso').insert([{
              usuario_id: userData.id,
              acao: 'editar',
              detalhes: `Editou irmão: ${irmaoForm.nome} - CIM ${irmaoForm.cim}`,
              ip: 'Browser',
              user_agent: navigator.userAgent
            }]);
          } catch (logError) {
            console.error('Erro ao registrar log:', logError);
          }
        }
      } else {
        // Inserir novo irmão
        const { data: novoIrmao, error: errorIrmao } = await supabase
          .from('irmaos')
          .insert([dadosIrmao])
          .select()
          .single();

        if (errorIrmao) throw errorIrmao;
        irmaoId = novoIrmao.id;

        // Inserir cônjuge se preenchido
        if (mostrarConjuge && conjuge.nome.trim()) {
          const dadosConjuge = {
            irmao_id: irmaoId,
            nome: conjuge.nome.trim(),
            cpf: limparCPF(conjuge.cpf),
            data_nascimento: conjuge.data_nascimento || null,
            profissao: conjuge.profissao || null
          };

          await supabase
            .from('esposas')
            .insert([dadosConjuge]);
        }

        // Inserir pai e mãe separadamente (estrutura: tipo="pai"/"mae")
        if (pais.nome_pai.trim()) {
          await supabase.from('pais').insert([{
            irmao_id: irmaoId,
            tipo: 'pai',
            nome: pais.nome_pai.trim(),
            falecido: !pais.pai_vivo,
            data_nascimento: pais.data_nascimento_pai || null,
            data_obito: pais.data_obito_pai || null
          }]);
        }
        if (pais.nome_mae.trim()) {
          await supabase.from('pais').insert([{
            irmao_id: irmaoId,
            tipo: 'mae',
            nome: pais.nome_mae.trim(),
            falecido: !pais.mae_viva,
            data_nascimento: pais.data_nascimento_mae || null,
            data_obito: pais.data_obito_mae || null
          }]);
        }

        // Inserir filhos se houver
        if (filhos.length > 0) {
          const dadosFilhos = filhos.map(filho => ({
            irmao_id: irmaoId,
            nome: filho.nome.trim(),
            data_nascimento: filho.data_nascimento || null,
            sexo: filho.sexo,
            tipo_vinculo: filho.tipo_vinculo || (filho.sexo === 'M' ? 'filho' : 'filha'),
            vivo: filho.vivo !== undefined ? filho.vivo : true,
            data_obito: filho.data_obito || null
          }));

          await supabase
            .from('filhos')
            .insert(dadosFilhos);
        }

        // Salvar histórico de cargos
        if (historicoCargos.length > 0) {
          const dadosCargos = historicoCargos.map(cargo => ({
            irmao_id: irmaoId,
            ano: parseInt(cargo.ano),
            cargo: cargo.cargo.trim()
          }));

          await supabase
            .from('historico_cargos')
            .insert(dadosCargos);
        }

        showSuccess('Irmão cadastrado com sucesso!');
        
        // Registrar log de criação
        if (userData?.id) {
          try {
            await supabase.from('logs_acesso').insert([{
              usuario_id: userData.id,
              acao: 'criar',
              detalhes: `Cadastrou irmão: ${irmaoForm.nome} - CIM ${irmaoForm.cim}`,
              ip: 'Browser',
              user_agent: navigator.userAgent
            }]);
          } catch (logError) {
            console.error('Erro ao registrar log:', logError);
          }
        }
      }

      // Limpar formulário e recarregar dados
      limparFormulario();
      onUpdate();
    } catch (error) {
      console.error('Erro ao salvar irmão:', error);
      showError(error.message || 'Erro ao salvar irmão');
    } finally {
      setLoading(false);
    }
  };

  // Limpar formulário
  const limparFormulario = () => {
    setIrmaoForm({
      cim: '',
      nome: '',
      cpf: '',
      rg: '',
      data_nascimento: '',
      email: '',
      telefone: '',
      cep: '',
      endereco: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      profissao: '',
      estado_civil: 'solteiro',
      escolaridade: 'fundamental_incompleto',
      foto_url: '',
      data_iniciacao: '',
      data_elevacao: '',
      data_exaltacao: '',
      mestre_instalado: false,
      data_instalacao: '',
      loja_origem: '',
      oriente: '',
      grande_oriente: '',
      situacao: 'regular',
      periodicidade_pagamento: 'Mensal',  // ← ADICIONAR AO LIMPAR
      observacoes: '',
      status: 'ativo'
    });
    setConjuge({ nome: '', cpf: '', data_nascimento: '', data_casamento: '', profissao: '' });
    setPais({ nome_pai: '', pai_vivo: true, data_nascimento_pai: '', data_obito_pai: '', nome_mae: '', mae_viva: true, data_nascimento_mae: '', data_obito_mae: '' });
    setFilhos([]);
    setFilhoForm({ nome: '', data_nascimento: '', sexo: 'M' });
    setHistoricoCargos([]);
    setCargoForm({ ano: new Date().getFullYear(), cargo: '' });
    setCargoEditandoIndex(null);
    setMostrarConjuge(false);
    setModoEdicao(false);
    setIrmaoEditando(null);
    setAbaSelecionada('pessoal');
    if (onCancelarEdicao) onCancelarEdicao(); // Limpa o estado no App.jsx
  };

  // Cancelar edição
  const cancelarEdicao = () => {
    limparFormulario();
    showSuccess('Edição cancelada');
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>
          {modoEdicao ? 'Editar Irmão' : 'Cadastrar Novo Irmão'}
        </h2>
        {modoEdicao && (
          <button
            onClick={cancelarEdicao}
            className="px-4 py-2 bg-gray-500 text-white rounded transition-colors" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
          >
            Cancelar Edição
          </button>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setAbaSelecionada('pessoal')}
          className={`px-6 py-3 font-medium transition-colors ${
            abaSelecionada === 'pessoal'
              ? 'border-b-2 font-semibold'
              : ' hover:'
          }`}
        >
          Dados Pessoais
        </button>
        <button
          onClick={() => setAbaSelecionada('maconico')}
          className={`px-6 py-3 font-medium transition-colors ${
            abaSelecionada === 'maconico'
              ? 'border-b-2 font-semibold'
              : ' hover:'
          }`}
        >
          Dados Maçônicos
        </button>
        <button
          onClick={() => setAbaSelecionada('familiar')}
          className={`px-6 py-3 font-medium transition-colors ${
            abaSelecionada === 'familiar'
              ? 'border-b-2 font-semibold'
              : ' hover:'
          }`}
        >
          Dados Familiares
        </button>

        <button
          type="button"
          onClick={() => setAbaSelecionada('vida-maconica')}
          className={`px-4 py-2 font-medium transition-colors ${
            abaSelecionada === 'vida-maconica'
              ? 'border-b-2 font-semibold'
              : ' hover:'
          }`}
        >
          🔺 Vida Maçônica
        </button>

        {irmaoEditando?.id && (
          <button
            type="button"
            onClick={() => setAbaSelecionada('situacoes')}
            className={`px-4 py-2 font-medium transition-colors ${
              abaSelecionada === 'situacoes'
                ? 'border-b-2 font-semibold'
                : ' hover:'
            }`}
          >
            📋 Situações
          </button>
        )}

        {irmaoEditando?.id && (
          <button
            type="button"
            onClick={() => setAbaSelecionada('documentos')}
            className={`px-4 py-2 font-medium transition-colors ${
              abaSelecionada === 'documentos'
                ? 'border-b-2 font-semibold'
                : ' hover:'
            }`}
          >
            📄 Documentos
          </button>
        )}
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ABA: Dados Pessoais */}
        {abaSelecionada === 'pessoal' && (
          <div className="p-6 rounded-lg shadow space-y-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <h3 className="text-lg font-semibold border-b pb-2" style={{color:"var(--color-text)"}}>
              Informações Pessoais
            </h3>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={irmaoForm.nome}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, nome: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  CPF
                </label>
                <input
                  type="text"
                  value={formatarCPF(irmaoForm.cpf)}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  RG
                </label>
                <input
                  type="text"
                  value={irmaoForm.rg}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, rg: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  value={irmaoForm.data_nascimento}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, data_nascimento: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
                {irmaoForm.data_nascimento && (
                  <span className="text-xs mt-1">
                    Idade: {calcularIdade(irmaoForm.data_nascimento)} anos
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Email
                </label>
                <input
                  type="email"
                  value={irmaoForm.email}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Telefone
                </label>
                <input
                  type="text"
                  value={formatarTelefone(irmaoForm.telefone)}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  CEP
                </label>
                <input
                  type="text"
                  value={irmaoForm.cep}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, cep: e.target.value })}
                  placeholder="00000-000"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Endereço
                </label>
                <input
                  type="text"
                  value={irmaoForm.endereco}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, endereco: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Número
                </label>
                <input
                  type="text"
                  value={irmaoForm.numero}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, numero: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Complemento
                </label>
                <input
                  type="text"
                  value={irmaoForm.complemento}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, complemento: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Cidade
                </label>
                <input
                  type="text"
                  value={irmaoForm.cidade}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, cidade: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Estado
                </label>
                <input
                  type="text"
                  value={irmaoForm.estado}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, estado: e.target.value })}
                  placeholder="UF"
                  maxLength="2"
                  className="w-full px-3 py-2 border rounded uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Profissão
                </label>
                <input
                  type="text"
                  value={irmaoForm.profissao}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, profissao: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Estado Civil
                </label>
                <select
                  value={irmaoForm.estado_civil}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, estado_civil: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  {ESTADOS_CIVIS.map(ec => (
                    <option key={ec.value} value={ec.value}>{ec.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Escolaridade
                </label>
                <select
                  value={irmaoForm.escolaridade}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, escolaridade: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  {NIVEIS_ESCOLARIDADE.map(ne => (
                    <option key={ne.value} value={ne.value}>{ne.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>
                Foto do Irmão
              </label>
              <div className="flex items-center gap-4">
                {/* Preview da foto */}
                {irmaoForm.foto_url ? (
                  <img
                    src={irmaoForm.foto_url}
                    alt="Foto"
                    className="w-20 h-20 rounded-full object-cover border-2"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{background:"var(--color-surface-2)"}}>
                    <span className="text-3xl">👤</span>
                  </div>
                )}
                
                {/* Botão upload */}
                {modoEdicao && irmaoEditando?.id && (
                  <label className="cursor-pointer bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
                    📷 {irmaoForm.foto_url ? 'Alterar Foto' : 'Enviar Foto'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadFoto}
                      className="hidden"
                    />
                  </label>
                )}
                
                {!modoEdicao && (
                  <p className="text-sm">Salve o cadastro primeiro para enviar a foto</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ABA: Dados Maçônicos */}
        {abaSelecionada === 'maconico' && (
          <div className="p-6 rounded-lg shadow space-y-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <h3 className="text-lg font-semibold border-b pb-2" style={{color:"var(--color-text)"}}>
              Informações Maçônicas
            </h3>

            {/* LINHA 1: CIM e Situação */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  CIM * <span className="text-xs">(número único)</span>
                </label>
                <input
                  type="text"
                  value={irmaoForm.cim}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, cim: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Ex: 123456"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Situação *
                </label>
                <select
                  value={irmaoForm.situacao}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, situacao: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  {STATUS_IRMAOS.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* LINHA 2: DATAS ESPECÍFICAS DA SITUAÇÃO */}
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
              <h4 className="text-sm font-semibold text-yellow-800 mb-3 flex items-center gap-2" style={{color:"var(--color-text)"}}>
                <span>📅</span> Datas Específicas da Situação
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CAMPOS DESATIVADOS - Agora usam histórico de situações
                Data de Licença e Desligamento movidos para aba "Situações"
                
                {/* Data de Licença - aparece se situação for "licenciado" */}
                {/* {irmaoForm.situacao === 'licenciado' && (
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                      Data de Início da Licença *
                      <span className="block text-xs font-normal mt-0.5">
                        A partir desta data, será considerado licenciado
                      </span>
                    </label>
                    <input
                      type="date"
                      value={irmaoForm.data_licenca}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, data_licenca: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                )} */}

                {/* Data de Desligamento - aparece se situação for "desligado" ou "ex_oficio" */}
                {/* {(irmaoForm.situacao === 'desligado' || irmaoForm.situacao === 'ex_oficio') && (
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                      Data do Desligamento *
                      <span className="block text-xs font-normal mt-0.5">
                        {irmaoForm.situacao === 'ex_oficio' 
                          ? 'Data do desligamento forçado (Ex-Ofício)'
                          : 'A partir desta data, será considerado desligado'}
                      </span>
                    </label>
                    <input
                      type="date"
                      value={irmaoForm.data_desligamento}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, data_desligamento: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                )} */}

                {/* Data de Falecimento - aparece se situação for "falecido" */}
                {irmaoForm.situacao === 'falecido' && (
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                      Data do Falecimento *
                      <span className="block text-xs font-normal mt-0.5">
                        Após esta data, não aparecerá nas listas de presença
                      </span>
                    </label>
                    <input
                      type="date"
                      value={irmaoForm.data_falecimento}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, data_falecimento: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                )}
              </div>

              {!['falecido'].includes(irmaoForm.situacao) && (
                <p className="text-sm italic">
                  ℹ️ Para registrar licenças e desligamentos, use a aba "Situações" após salvar o irmão
                </p>
              )}
              
              {/* Informação sobre prerrogativa por idade */}
              {irmaoForm.data_nascimento && (() => {
                const idade = calcularIdade(irmaoForm.data_nascimento);
                if (idade >= 70) {
                  return (
                    <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="text-sm text-blue-800">
                        💡 <strong>Com Prerrogativa por Idade</strong> - Este irmão tem {idade} anos.
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* LINHA 3: DATA DE INGRESSO NA LOJA */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Data de Ingresso na Loja
                  <span className="block text-xs font-normal mt-0.5">
                    Quando veio transferido de outra loja
                  </span>
                </label>
                <input
                  type="date"
                  value={irmaoForm.data_ingresso_loja}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, data_ingresso_loja: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
                <p className="text-xs mt-1">
                  ℹ️ Deixe vazio se foi iniciado nesta loja. Para registrar transferências de saída, use a aba "Situações"
                </p>
              </div>
            </div>

            {/* LINHA 4: Datas de Iniciação, Elevação e Exaltação */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Data de Iniciação
                </label>
                <input
                  type="date"
                  value={irmaoForm.data_iniciacao}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, data_iniciacao: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Data de Elevação
                </label>
                <input
                  type="date"
                  value={irmaoForm.data_elevacao}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, data_elevacao: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Data de Exaltação
                </label>
                <input
                  type="date"
                  value={irmaoForm.data_exaltacao}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, data_exaltacao: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>

            {/* LINHA 4.5: Mestre Instalado */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>
                  Mestre Instalado?
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="mestre_instalado"
                      checked={irmaoForm.mestre_instalado === true}
                      onChange={() => setIrmaoForm({ ...irmaoForm, mestre_instalado: true })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm">Sim</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="mestre_instalado"
                      checked={irmaoForm.mestre_instalado === false}
                      onChange={() => setIrmaoForm({ ...irmaoForm, mestre_instalado: false, data_instalacao: '' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm">Não</span>
                  </label>
                </div>
              </div>

              {irmaoForm.mestre_instalado && (
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Data de Instalação
                  </label>
                  <input
                    type="date"
                    value={irmaoForm.data_instalacao || ''}
                    onChange={(e) => setIrmaoForm({ ...irmaoForm, data_instalacao: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              )}
            </div>

            {/* LINHA 5: Loja Origem, Oriente e Potência */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Loja de Origem
                </label>
                <input
                  type="text"
                  value={irmaoForm.loja_origem}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, loja_origem: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Ex: Acácia de Paranatinga nº 30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Oriente
                </label>
                <input
                  type="text"
                  value={irmaoForm.oriente}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, oriente: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Ex: Paranatinga"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Potência
                </label>
                <input
                  type="text"
                  value={irmaoForm.grande_oriente}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, grande_oriente: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Ex: Grande Loja do Estado de Mato Grosso"
                />
              </div>
            </div>

            {/* LINHA 4: Periodicidade de Pagamento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  💰 Periodicidade de Pagamento
                </label>
                <select
                  value={irmaoForm.periodicidade_pagamento}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, periodicidade_pagamento: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="Mensal">📅 Mensal - Paga todo mês</option>
                  <option value="Semestral">📆 Semestral - Paga a cada 6 meses</option>
                  <option value="Anual">📊 Anual - Paga uma vez por ano</option>
                </select>
                <p className="text-xs mt-1">
                  Define a frequência de cobrança de mensalidades para este irmão
                </p>
              </div>
            </div>

            {/* LINHA 5: Observações */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                Observações
              </label>
              <textarea
                value={irmaoForm.observacoes}
                onChange={(e) => setIrmaoForm({ ...irmaoForm, observacoes: e.target.value })}
                rows="3"
                className="w-full px-3 py-2 border rounded"
                placeholder="Observações adicionais sobre o irmão..."
              />
            </div>

            {/* HISTÓRICO DE CARGOS */}
            <div className="border-t pt-6">
              <h4 className="text-md font-semibold mb-4 flex items-center gap-2" style={{color:"var(--color-text)"}}>
                <span>🏛️</span>
                <span>Histórico de Cargos na Loja</span>
              </h4>

              {/* Formulário para adicionar/editar cargo */}
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                      Ano
                    </label>
                    <input
                      type="number"
                      min="1900"
                      max="2100"
                      value={cargoForm.ano}
                      onChange={(e) => setCargoForm({ ...cargoForm, ano: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="Ex: 2024"
                    />
                  </div>

                  <div className="md:col-span-7">
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                      Cargo
                    </label>
                    <input
                      type="text"
                      value={cargoForm.cargo}
                      onChange={(e) => setCargoForm({ ...cargoForm, cargo: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="Ex: Venerável Mestre, 1º Vigilante, Orador..."
                    />
                  </div>

                  <div className="md:col-span-2 flex items-end">
                    {cargoEditandoIndex !== null ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const novosCargas = [...historicoCargos];
                            novosCargas[cargoEditandoIndex] = cargoForm;
                            setHistoricoCargos(novosCargas);
                            setCargoForm({ ano: new Date().getFullYear(), cargo: '' });
                            setCargoEditandoIndex(null);
                          }}
                          className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm mr-1"
                        >
                          ✓ Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCargoForm({ ano: new Date().getFullYear(), cargo: '' });
                            setCargoEditandoIndex(null);
                          }}
                          className="px-3 py-2 bg-gray-500 text-white rounded-lg font-medium text-sm"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!cargoForm.ano || !cargoForm.cargo.trim()) {
                            alert('Preencha o ano e o cargo!');
                            return;
                          }
                          setHistoricoCargos([...historicoCargos, { ...cargoForm }]);
                          setCargoForm({ ano: new Date().getFullYear(), cargo: '' });
                        }}
                        className="w-full px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm"
                      >
                        ➕ Adicionar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Lista de cargos cadastrados */}
              {historicoCargos.length > 0 ? (
                <div className="border rounded-lg overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  <table className="min-w-full divide-y">
                    <thead style={{background:"var(--color-surface-2)"}}>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Ano</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Cargo</th>
                        <th className="px-4 py-3 text-center text-xs font-medium uppercase w-32" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {historicoCargos
                        .sort((a, b) => b.ano - a.ano) // Ordenar por ano decrescente
                        .map((cargo, index) => {
                          const indexOriginal = historicoCargos.findIndex(c => c === cargo);
                          return (
                            <tr key={index} className="hover:">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium" style={{color:"var(--color-text)"}}>
                                {cargo.ano}
                              </td>
                              <td className="px-4 py-3 text-sm" style={{color:"var(--color-text)"}}>
                                {cargo.cargo}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center text-sm" style={{color:"var(--color-text)"}}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCargoForm(cargo);
                                    setCargoEditandoIndex(indexOriginal);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 font-medium mr-3"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm('Deseja realmente excluir este cargo?')) {
                                      setHistoricoCargos(historicoCargos.filter((_, i) => i !== indexOriginal));
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-800 font-medium"
                                >
                                  🗑️ Excluir
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 rounded-lg">
                  <p className="text-sm">
                    Nenhum cargo cadastrado ainda. Use o formulário acima para adicionar.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA: Dados Familiares */}
        {abaSelecionada === 'familiar' && (
          <div className="space-y-6">
            {/* Cônjuge */}
            <div className="p-6 rounded-lg shadow space-y-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-lg font-semibold" style={{color:"var(--color-text)"}}>Cônjuge</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mostrarConjuge}
                    onChange={(e) => setMostrarConjuge(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">Possui cônjuge</span>
                </label>
              </div>

              {mostrarConjuge && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        value={conjuge.nome}
                        onChange={(e) => setConjuge({ ...conjuge, nome: e.target.value })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                        CPF
                      </label>
                      <input
                        type="text"
                        value={formatarCPF(conjuge.cpf)}
                        onChange={(e) => setConjuge({ ...conjuge, cpf: e.target.value })}
                        placeholder="000.000.000-00"
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                        Data de Nascimento
                      </label>
                      <input
                        type="date"
                        value={conjuge.data_nascimento}
                        onChange={(e) => setConjuge({ ...conjuge, data_nascimento: e.target.value })}
                        className="w-full px-3 py-2 border rounded"
                      />
                      {conjuge.data_nascimento && (
                        <span className="text-xs mt-1">
                          Idade: {calcularIdade(conjuge.data_nascimento)} anos
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                        💑 Data de Casamento
                      </label>
                      <input
                        type="date"
                        value={conjuge.data_casamento}
                        onChange={(e) => setConjuge({ ...conjuge, data_casamento: e.target.value })}
                        className="w-full px-3 py-2 border rounded"
                      />
                      {conjuge.data_casamento && (
                        <span className="text-xs mt-1">
                          Anos de união: {calcularIdade(conjuge.data_casamento)} anos
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                        Profissão
                      </label>
                      <input
                        type="text"
                        value={conjuge.profissao}
                        onChange={(e) => setConjuge({ ...conjuge, profissao: e.target.value })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Pais */}
            <div className="p-6 rounded-lg shadow space-y-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <h3 className="text-lg font-semibold border-b pb-2" style={{color:"var(--color-text)"}}>Pais</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Nome do Pai
                  </label>
                  <input
                    type="text"
                    value={pais.nome_pai}
                    onChange={(e) => setPais({ ...pais, nome_pai: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                  
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                      Data de Nascimento
                    </label>
                    <input
                      type="date"
                      value={pais.data_nascimento_pai}
                      onChange={(e) => setPais({ ...pais, data_nascimento_pai: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pais.pai_vivo}
                      onChange={(e) => setPais({ ...pais, pai_vivo: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">Pai vivo</span>
                  </label>

                  {!pais.pai_vivo && (
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                        Data de Óbito
                      </label>
                      <input
                        type="date"
                        value={pais.data_obito_pai}
                        onChange={(e) => setPais({ ...pais, data_obito_pai: e.target.value })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Nome da Mãe
                  </label>
                  <input
                    type="text"
                    value={pais.nome_mae}
                    onChange={(e) => setPais({ ...pais, nome_mae: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                  
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                      Data de Nascimento
                    </label>
                    <input
                      type="date"
                      value={pais.data_nascimento_mae}
                      onChange={(e) => setPais({ ...pais, data_nascimento_mae: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pais.mae_viva}
                      onChange={(e) => setPais({ ...pais, mae_viva: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">Mãe viva</span>
                  </label>

                  {!pais.mae_viva && (
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                        Data de Óbito
                      </label>
                      <input
                        type="date"
                        value={pais.data_obito_mae}
                        onChange={(e) => setPais({ ...pais, data_obito_mae: e.target.value })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Filhos */}
            <div className="p-6 rounded-lg shadow space-y-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <h3 className="text-lg font-semibold border-b pb-2" style={{color:"var(--color-text)"}}>Filhos</h3>

              {/* Formulário para adicionar filho */}
              <div className="p-4 rounded space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                      Nome *
                    </label>
                    <input
                      type="text"
                      value={filhoForm.nome}
                      onChange={(e) => setFilhoForm({ ...filhoForm, nome: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                      Data Nascimento
                    </label>
                    <input
                      type="date"
                      value={filhoForm.data_nascimento}
                      onChange={(e) => setFilhoForm({ ...filhoForm, data_nascimento: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                      Sexo
                    </label>
                    <select
                      value={filhoForm.sexo}
                      onChange={(e) => setFilhoForm({ ...filhoForm, sexo: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                      Tipo de Vínculo
                    </label>
                    <select
                      value={filhoForm.tipo_vinculo}
                      onChange={(e) => setFilhoForm({ ...filhoForm, tipo_vinculo: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="filho">Filho</option>
                      <option value="filha">Filha</option>
                      <option value="enteado">Enteado</option>
                      <option value="enteada">Enteada</option>
                      <option value="neto">Neto</option>
                      <option value="neta">Neta</option>
                      <option value="bisneto">Bisneto</option>
                      <option value="bisneta">Bisneta</option>
                    </select>
                  </div>
                </div>

                {/* Segunda linha - Vivo/Falecido */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filhoForm.vivo}
                        onChange={(e) => setFilhoForm({ ...filhoForm, vivo: e.target.checked, data_obito: e.target.checked ? '' : filhoForm.data_obito })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm font-medium">Vivo</span>
                    </label>
                  </div>

                  {!filhoForm.vivo && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                        Data de Óbito
                      </label>
                      <input
                        type="date"
                        value={filhoForm.data_obito}
                        onChange={(e) => setFilhoForm({ ...filhoForm, data_obito: e.target.value })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={adicionarFilho}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    {filhoEditandoIndex !== null ? '💾 Salvar Alterações' : '➕ Adicionar Filho'}
                  </button>
                  {filhoEditandoIndex !== null && (
                    <button
                      type="button"
                      onClick={cancelarEdicaoFilho}
                      className="px-4 py-2 bg-gray-500 text-white rounded transition-colors" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    >
                      ❌ Cancelar
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de filhos adicionados */}
              {filhos.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">
                    Filhos cadastrados ({filhos.length}):
                  </h4>
                  {filhos.map((filho, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-blue-50 p-3 rounded"
                    >
                      <div className="flex-1">
                        <p className="font-medium flex items-center gap-2">
                          {filho.nome}
                          {!filho.vivo && <span title="Falecido">🕊️</span>}
                        </p>
                        <p className="text-sm">
                          {filho.sexo === 'M' ? '👦' : '👧'} 
                          <span className="font-semibold capitalize ml-1">
                            ({filho.tipo_vinculo || (filho.sexo === 'M' ? 'filho' : 'filha')})
                          </span>
                          {filho.data_nascimento && (
                            <>
                              {' • '}Nascimento:{' '}
                              {new Date(filho.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                              {filho.vivo && ` - ${calcularIdade(filho.data_nascimento)} anos`}
                            </>
                          )}
                          {!filho.vivo && filho.data_obito && (
                            <>
                              {' • '}Óbito:{' '}
                              {new Date(filho.data_obito + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => editarFilho(index)}
                          className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-primary-600 transition-colors"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => removerFilho(index)}
                          className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                        >
                          🗑️ Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA: Vida Maçônica */}
        {abaSelecionada === 'vida-maconica' && (
          <div className="p-6 rounded-lg shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            {irmaoEditando?.id ? (
              <VidaMaconica
                irmaoId={irmaoEditando.id}
                showSuccess={showSuccess}
                showError={showError}
              />
            ) : (
              <div className="text-center py-12 rounded-lg border-2 border-dashed" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <div className="text-6xl mb-4">🔺</div>
                <p className="text-lg font-medium">
                  Salve o irmão primeiro para adicionar graus
                </p>
                <p className="text-sm mt-2">
                  A vida maçônica só pode ser cadastrada após criar o registro do irmão
                </p>
              </div>
            )}
          </div>
        )}

        {/* ABA: Situações */}
        {abaSelecionada === 'situacoes' && (
          <div className="p-6 rounded-lg shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            {irmaoEditando?.id ? (
              <GestaoSituacoes irmaId={irmaoEditando.id} />
            ) : (
              <div className="text-center py-12 rounded-lg border-2 border-dashed" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <div className="text-6xl mb-4">📋</div>
                <p className="text-lg font-medium">
                  Salve o irmão primeiro para gerenciar situações
                </p>
                <p className="text-sm mt-2">
                  Licenças, desligamentos e outras situações só podem ser cadastradas após criar o registro do irmão
                </p>
              </div>
            )}
          </div>
        )}

        {/* ABA: Documentos */}
        {abaSelecionada === 'documentos' && (
          <div className="p-6 rounded-lg shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            {irmaoEditando?.id ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>📄 Documentos</h3>
                  
                  <label className="cursor-pointer bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium" style={{color:"var(--color-text-muted)"}}>
                    📤 Enviar PDF
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleUploadPDF}
                      className="hidden"
                    />
                  </label>
                </div>

                {documentos.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-lg">Nenhum documento cadastrado</p>
                    <p className="text-sm mt-2">Use o botão acima para enviar arquivos PDF</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {documentos.map(doc => (
                      <div key={doc.id} className="border rounded-lg p-4 flex items-center justify-between hover: transition-shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">📄</span>
                          <div>
                            <p className="font-medium">{doc.nome_arquivo}</p>
                            <p className="text-sm">
                              Enviado em {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={doc.url_arquivo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors text-sm"
                          >
                            👁️ Ver
                          </a>
                          <button
                            type="button"
                            onClick={() => handleExcluirDocumento(doc.id, doc.url_arquivo)}
                            className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                          >
                            🗑️ Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 rounded-lg border-2 border-dashed" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <div className="text-6xl mb-4">📄</div>
                <p className="text-lg font-medium">
                  Salve o irmão primeiro para enviar documentos
                </p>
                <p className="text-sm mt-2">
                  Documentos só podem ser enviados após criar o registro do irmão
                </p>
              </div>
            )}
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={limparFormulario}
            className="px-6 py-2 bg-gray-500 text-white rounded transition-colors" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
          >
            Limpar Formulário
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Salvando...' : modoEdicao ? 'Atualizar Irmão' : 'Cadastrar Irmão'}
          </button>
        </div>
      </form>

      {/* Informação sobre campos obrigatórios */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <p className="text-sm text-yellow-800">
          <strong>Campos obrigatórios:</strong> CIM e Nome Completo
        </p>
        <p className="text-xs text-yellow-700 mt-1">
          Os demais campos são opcionais e podem ser preenchidos posteriormente.
        </p>
      </div>
    </div>
  );
};

export default CadastrarIrmao;
