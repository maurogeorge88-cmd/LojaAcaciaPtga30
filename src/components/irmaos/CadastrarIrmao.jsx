// ===================================================================
// VERSÃO FINAL - USA TABELAS ANTIGAS: esposas, pais, filhos
// Data: 27/11/2025 - CONFIRME QUE ESTE COMENTÁRIO ESTÁ NO ARQUIVO!
// ===================================================================
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
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

const CadastrarIrmao = ({ irmaos, irmaoParaEditar, onUpdate, showSuccess, showError, onCancelarEdicao }) => {
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
    loja_origem: '',
    oriente: '',
    grande_oriente: '',
    situacao: 'regular',
    observacoes: '',
    status: 'ativo'
  });

  // Estado dos familiares
  const [conjuge, setConjuge] = useState({
    nome: '',
    cpf: '',
    data_nascimento: '',
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
  const [filhoForm, setFilhoForm] = useState({
    nome: '',
    data_nascimento: '',
    sexo: 'M'
  });

  // Estados de controle
  const [modoEdicao, setModoEdicao] = useState(false);
  const [irmaoEditando, setIrmaoEditando] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mostrarConjuge, setMostrarConjuge] = useState(false);
  const [abaSelecionada, setAbaSelecionada] = useState('pessoal'); // pessoal, maconico, familiar

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
      loja_origem: irmao.loja_origem || '',
      oriente: irmao.oriente || '',
      grande_oriente: irmao.grande_oriente || '',
      situacao: irmao.situacao || 'regular',
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
      setPais({ nome_pai: '', pai_vivo: true, data_nascimento_pai: '', data_obito_pai: '', nome_mae: '', mae_viva: true, data_nascimento_mae: '', data_obito_mae: '' });
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
          sexo: f.sexo
        })));
      } else {
        setFilhos([]);
      }
    } catch (error) {
      setFilhos([]);
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
    if (!filhoForm.data_nascimento) {
      showError('Preencha a data de nascimento do filho');
      return;
    }

    setFilhos([...filhos, { ...filhoForm }]);
    setFilhoForm({ nome: '', data_nascimento: '', sexo: 'M' });
    showSuccess('Filho adicionado à lista');
  };

  // Remover filho da lista
  const removerFilho = (index) => {
    setFilhos(filhos.filter((_, i) => i !== index));
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
        loja_origem: irmaoForm.loja_origem || null,
        oriente: irmaoForm.oriente || null,
        grande_oriente: irmaoForm.grande_oriente || null,
        situacao: irmaoForm.situacao || 'regular',
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
            sexo: filho.sexo
          }));

          await supabase
            .from('filhos')
            .insert(dadosFilhos);
        }

        showSuccess('Irmão atualizado com sucesso!');
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
            sexo: filho.sexo
          }));

          await supabase
            .from('filhos')
            .insert(dadosFilhos);
        }

        showSuccess('Irmão cadastrado com sucesso!');
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
      loja_origem: '',
      oriente: '',
      grande_oriente: '',
      situacao: 'regular',
      observacoes: '',
      status: 'ativo'
    });
    setConjuge({ nome: '', cpf: '', data_nascimento: '', profissao: '' });
    setPais({ nome_pai: '', pai_vivo: true, data_nascimento_pai: '', data_obito_pai: '', nome_mae: '', mae_viva: true, data_nascimento_mae: '', data_obito_mae: '' });
    setFilhos([]);
    setFilhoForm({ nome: '', data_nascimento: '', sexo: 'M' });
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
        <h2 className="text-2xl font-bold text-gray-800">
          {modoEdicao ? 'Editar Irmão' : 'Cadastrar Novo Irmão'}
        </h2>
        {modoEdicao && (
          <button
            onClick={cancelarEdicao}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Cancelar Edição
          </button>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setAbaSelecionada('pessoal')}
          className={`px-6 py-3 font-medium transition-colors ${
            abaSelecionada === 'pessoal'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Dados Pessoais
        </button>
        <button
          onClick={() => setAbaSelecionada('maconico')}
          className={`px-6 py-3 font-medium transition-colors ${
            abaSelecionada === 'maconico'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Dados Maçônicos
        </button>
        <button
          onClick={() => setAbaSelecionada('familiar')}
          className={`px-6 py-3 font-medium transition-colors ${
            abaSelecionada === 'familiar'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Dados Familiares
        </button>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ABA: Dados Pessoais */}
        {abaSelecionada === 'pessoal' && (
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">
              Informações Pessoais
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CIM * <span className="text-xs text-gray-500">(número único)</span>
                </label>
                <input
                  type="text"
                  value={irmaoForm.cim}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, cim: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={irmaoForm.nome}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CPF
                </label>
                <input
                  type="text"
                  value={formatarCPF(irmaoForm.cpf)}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RG
                </label>
                <input
                  type="text"
                  value={irmaoForm.rg}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, rg: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  value={irmaoForm.data_nascimento}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, data_nascimento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {irmaoForm.data_nascimento && (
                  <span className="text-xs text-gray-500 mt-1">
                    Idade: {calcularIdade(irmaoForm.data_nascimento)} anos
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={irmaoForm.email}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <input
                  type="text"
                  value={formatarTelefone(irmaoForm.telefone)}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CEP
                </label>
                <input
                  type="text"
                  value={irmaoForm.cep}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, cep: e.target.value })}
                  placeholder="00000-000"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Endereço
                </label>
                <input
                  type="text"
                  value={irmaoForm.endereco}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, endereco: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número
                </label>
                <input
                  type="text"
                  value={irmaoForm.numero}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, numero: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Complemento
                </label>
                <input
                  type="text"
                  value={irmaoForm.complemento}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, complemento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={irmaoForm.cidade}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, cidade: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <input
                  type="text"
                  value={irmaoForm.estado}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, estado: e.target.value })}
                  placeholder="UF"
                  maxLength="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Profissão
                </label>
                <input
                  type="text"
                  value={irmaoForm.profissao}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, profissao: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado Civil
                </label>
                <select
                  value={irmaoForm.estado_civil}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, estado_civil: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {ESTADOS_CIVIS.map(ec => (
                    <option key={ec.value} value={ec.value}>{ec.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Escolaridade
                </label>
                <select
                  value={irmaoForm.escolaridade}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, escolaridade: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {NIVEIS_ESCOLARIDADE.map(ne => (
                    <option key={ne.value} value={ne.value}>{ne.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL da Foto <span className="text-xs text-gray-500">(opcional)</span>
              </label>
              <input
                type="url"
                value={irmaoForm.foto_url}
                onChange={(e) => setIrmaoForm({ ...irmaoForm, foto_url: e.target.value })}
                placeholder="https://exemplo.com/foto.jpg"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* ABA: Dados Maçônicos */}
        {abaSelecionada === 'maconico' && (
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">
              Informações Maçônicas
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Iniciação
                </label>
                <input
                  type="date"
                  value={irmaoForm.data_iniciacao}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, data_iniciacao: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Elevação
                </label>
                <input
                  type="date"
                  value={irmaoForm.data_elevacao}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, data_elevacao: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Exaltação
                </label>
                <input
                  type="date"
                  value={irmaoForm.data_exaltacao}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, data_exaltacao: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loja de Origem
                </label>
                <input
                  type="text"
                  value={irmaoForm.loja_origem}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, loja_origem: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Oriente
                </label>
                <input
                  type="text"
                  value={irmaoForm.oriente}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, oriente: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grande Oriente
                </label>
                <input
                  type="text"
                  value={irmaoForm.grande_oriente}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, grande_oriente: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Situação
                </label>
                <select
                  value={irmaoForm.situacao}
                  onChange={(e) => setIrmaoForm({ ...irmaoForm, situacao: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {STATUS_IRMAOS.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                value={irmaoForm.observacoes}
                onChange={(e) => setIrmaoForm({ ...irmaoForm, observacoes: e.target.value })}
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Observações adicionais sobre o irmão..."
              />
            </div>
          </div>
        )}

        {/* ABA: Dados Familiares */}
        {abaSelecionada === 'familiar' && (
          <div className="space-y-6">
            {/* Cônjuge */}
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-lg font-semibold text-gray-700">Cônjuge</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mostrarConjuge}
                    onChange={(e) => setMostrarConjuge(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Possui cônjuge</span>
                </label>
              </div>

              {mostrarConjuge && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        value={conjuge.nome}
                        onChange={(e) => setConjuge({ ...conjuge, nome: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CPF
                      </label>
                      <input
                        type="text"
                        value={formatarCPF(conjuge.cpf)}
                        onChange={(e) => setConjuge({ ...conjuge, cpf: e.target.value })}
                        placeholder="000.000.000-00"
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data de Nascimento
                      </label>
                      <input
                        type="date"
                        value={conjuge.data_nascimento}
                        onChange={(e) => setConjuge({ ...conjuge, data_nascimento: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {conjuge.data_nascimento && (
                        <span className="text-xs text-gray-500 mt-1">
                          Idade: {calcularIdade(conjuge.data_nascimento)} anos
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Profissão
                      </label>
                      <input
                        type="text"
                        value={conjuge.profissao}
                        onChange={(e) => setConjuge({ ...conjuge, profissao: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Pais */}
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Pais</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Pai
                  </label>
                  <input
                    type="text"
                    value={pais.nome_pai}
                    onChange={(e) => setPais({ ...pais, nome_pai: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de Nascimento
                    </label>
                    <input
                      type="date"
                      value={pais.data_nascimento_pai}
                      onChange={(e) => setPais({ ...pais, data_nascimento_pai: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pais.pai_vivo}
                      onChange={(e) => setPais({ ...pais, pai_vivo: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Pai vivo</span>
                  </label>

                  {!pais.pai_vivo && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data de Óbito
                      </label>
                      <input
                        type="date"
                        value={pais.data_obito_pai}
                        onChange={(e) => setPais({ ...pais, data_obito_pai: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da Mãe
                  </label>
                  <input
                    type="text"
                    value={pais.nome_mae}
                    onChange={(e) => setPais({ ...pais, nome_mae: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de Nascimento
                    </label>
                    <input
                      type="date"
                      value={pais.data_nascimento_mae}
                      onChange={(e) => setPais({ ...pais, data_nascimento_mae: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pais.mae_viva}
                      onChange={(e) => setPais({ ...pais, mae_viva: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Mãe viva</span>
                  </label>

                  {!pais.mae_viva && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data de Óbito
                      </label>
                      <input
                        type="date"
                        value={pais.data_obito_mae}
                        onChange={(e) => setPais({ ...pais, data_obito_mae: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Filhos */}
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Filhos</h3>

              {/* Formulário para adicionar filho */}
              <div className="bg-gray-50 p-4 rounded space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Filho
                    </label>
                    <input
                      type="text"
                      value={filhoForm.nome}
                      onChange={(e) => setFilhoForm({ ...filhoForm, nome: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Nascimento
                    </label>
                    <input
                      type="date"
                      value={filhoForm.data_nascimento}
                      onChange={(e) => setFilhoForm({ ...filhoForm, data_nascimento: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sexo
                    </label>
                    <select
                      value={filhoForm.sexo}
                      onChange={(e) => setFilhoForm({ ...filhoForm, sexo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={adicionarFilho}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  ➕ Adicionar Filho
                </button>
              </div>

              {/* Lista de filhos adicionados */}
              {filhos.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">
                    Filhos cadastrados ({filhos.length}):
                  </h4>
                  {filhos.map((filho, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-blue-50 p-3 rounded"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{filho.nome}</p>
                        <p className="text-sm text-gray-600">
                          {filho.sexo === 'M' ? '👦' : '👧'} Nascimento:{' '}
                          {filho.data_nascimento ? new Date(filho.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não informado'} 
                          {filho.data_nascimento && ` - ${calcularIdade(filho.data_nascimento)} anos`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removerFilho(index)}
                        className="ml-4 px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={limparFormulario}
            className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Limpar Formulário
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
