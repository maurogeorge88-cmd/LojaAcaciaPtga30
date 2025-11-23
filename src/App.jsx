import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// ========================================
// CONFIGURAÇÃO SUPABASE
// ========================================
const supabaseUrl = 'https://ypnvzjctyfdrkkrhskzs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwbnZ6amN0eWZkcmtrcmhza3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTgxMzcsImV4cCI6MjA3OTMzNDEzN30.J5Jj7wudOhIAxy35DDBIWtr9yr9Lq3ABBRI9ZJ5z2pc';
const supabase = createClient(supabaseUrl, supabaseKey);

const LOGO_URL = 'https://via.placeholder.com/150x150/1e3a8a/ffffff?text=LOJA';

// ========================================
// FUNÇÕES AUXILIARES
// ========================================
const calcularTempoMaconaria = (dataIniciacao) => {
  if (!dataIniciacao) return '';
  const inicio = new Date(dataIniciacao + 'T00:00:00');
  const hoje = new Date();
  let anos = hoje.getFullYear() - inicio.getFullYear();
  let meses = hoje.getMonth() - inicio.getMonth();
  if (meses < 0) { anos--; meses = 12 + meses; }
  return `${anos} ano(s) e ${meses} mês(es)`;
};

const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return '';
  const nascimento = new Date(dataNascimento + 'T00:00:00');
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return `${idade} anos`;
};

const formatarData = (data) => {
  if (!data) return '-';
  const date = new Date(data + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
};

const formatarDataInput = (data) => {
  if (!data) return '';
  const date = new Date(data + 'T00:00:00');
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const obterDiaSemana = (data) => {
  if (!data) return '';
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const date = new Date(data + 'T00:00:00');
  return dias[date.getDay()];
};

// ========================================
// COMPONENTE PRINCIPAL
// ========================================
function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [permissoes, setPermissoes] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Estados de login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Estados de dados
  const [irmaos, setIrmaos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [balaustres, setBalaustres] = useState([]);
  const [tiposSessao, setTiposSessao] = useState([]);
  const [cargosLoja, setCargosLoja] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ativo');
  const [irmaoSelecionado, setIrmaoSelecionado] = useState(null);
  const [familiaresSelecionado, setFamiliaresSelecionado] = useState(null);

  // Estados de edição
  const [modoEdicao, setModoEdicao] = useState(false);
  const [irmaoEditando, setIrmaoEditando] = useState(null);

  // Formulário de irmão
  const [irmaoForm, setIrmaoForm] = useState({
    cim: '', nome: '', cpf: '', rg: '', data_nascimento: '',
    estado_civil: '', profissao: '', formacao: '', status: 'ativo',
    naturalidade: '', endereco: '', cidade: '', celular: '',
    email: '', local_trabalho: '', cargo: '',
    data_iniciacao: '', data_elevacao: '', data_exaltacao: ''
  });

  const [esposa, setEsposa] = useState({ nome: '', data_nascimento: '' });
  const [pai, setPai] = useState({ nome: '', data_nascimento: '', falecido: false, data_obito: '' });
  const [mae, setMae] = useState({ nome: '', data_nascimento: '', falecido: false, data_obito: '' });
  const [filhos, setFilhos] = useState([{ nome: '', data_nascimento: '', falecido: false, data_obito: '' }]);

  // Estados para Balaustre
  const [grauSelecionado, setGrauSelecionado] = useState('Aprendiz');
  const [balaustreForm, setBalaustreForm] = useState({
    grau_sessao: 'Aprendiz',
    numero_balaustre: '',
    data_sessao: '',
    dia_semana: '',
    tipo_sessao_id: '',
    ordem_dia: '',
    observacoes: ''
  });
  const [modoEdicaoBalaustre, setModoEdicaoBalaustre] = useState(false);
  const [balaustreEditando, setBalaustreEditando] = useState(null);

  // ========================================
  // EFEITOS E CARREGAMENTOS
  // ========================================
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUserData(session.user.email);
        loadIrmaos();
        loadTiposSessao();
        loadCargosLoja();
        loadBalaustres();
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Atualizar dia da semana quando data mudar
  useEffect(() => {
    if (balaustreForm.data_sessao) {
      const diaSemana = obterDiaSemana(balaustreForm.data_sessao);
      setBalaustreForm(prev => ({ ...prev, dia_semana: diaSemana }));
    }
  }, [balaustreForm.data_sessao]);

  // Carregar próximo número quando grau mudar
  useEffect(() => {
    if (currentPage === 'balaustres' && !modoEdicaoBalaustre) {
      carregarProximoNumero(balaustreForm.grau_sessao);
    }
  }, [balaustreForm.grau_sessao, currentPage, modoEdicaoBalaustre]);

  // Filtrar balaustres por grau
  useEffect(() => {
    if (currentPage === 'balaustres') {
      loadBalaustres(grauSelecionado);
    }
  }, [grauSelecionado, currentPage]);

  // ========================================
  // FUNÇÕES DE CARREGAMENTO
  // ========================================
  const loadUserData = async (userEmail) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (data) {
      setUserData(data);
      setPermissoes({
        canEdit: ['administrador', 'secretario'].includes(data.cargo),
        canDelete: data.cargo === 'administrador',
        canManageUsers: data.cargo === 'administrador'
      });
    }
  };

  const loadIrmaos = async () => {
    const { data, error } = await supabase
      .from('irmaos')
      .select('*')
      .order('nome');
    
    if (data) setIrmaos(data);
    if (error) console.error('Erro ao carregar irmãos:', error);
  };

  const loadTiposSessao = async () => {
    try {
      console.log('🔍 Carregando tipos de sessão...');
      
      const { data, error } = await supabase
        .from('tipos_sessao')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      console.log('📊 Tipos de sessão:', { data, error });
      
      if (error) {
        console.error('❌ Erro ao carregar tipos de sessão:', error);
        return;
      }
      
      if (data) {
        console.log('✅ Tipos de sessão carregados:', data.length, 'tipos');
        setTiposSessao(data);
      }
    } catch (err) {
      console.error('❌ Exceção ao carregar tipos de sessão:', err);
    }
  };

  const loadCargosLoja = async () => {
    const { data, error } = await supabase
      .from('cargos_loja')
      .select('*')
      .eq('ativo', true)
      .order('ordem');
    
    if (data) setCargosLoja(data);
    if (error) console.error('Erro ao carregar cargos:', error);
  };

  const loadBalaustres = async (grau = null) => {
    try {
      console.log('🔍 Carregando balaustres para o grau:', grau || 'todos');
      
      // Buscar balaustres SEM o JOIN
      let query = supabase
        .from('balaustres')
        .select('*')
        .order('numero_balaustre', { ascending: false });

      if (grau) {
        query = query.eq('grau_sessao', grau);
      }

      const { data: balaustreData, error: balaustreError } = await query;
      
      if (balaustreError) {
        console.error('❌ Erro ao carregar balaustres:', balaustreError);
        setError('Erro ao carregar balaustres: ' + balaustreError.message);
        return;
      }
      
      console.log('📊 Balaustres encontrados:', balaustreData?.length || 0);
      
      if (!balaustreData || balaustreData.length === 0) {
        console.log('⚠️ Nenhum balaustre encontrado');
        setBalaustres([]);
        return;
      }

      // Buscar tipos de sessão separadamente
      const { data: tiposData, error: tiposError } = await supabase
        .from('tipos_sessao')
        .select('*');
      
      if (tiposError) {
        console.error('⚠️ Erro ao carregar tipos de sessão:', tiposError);
      }

      // Fazer o "join" manualmente
      const balaustreComTipos = balaustreData.map(bal => {
        const tipo = tiposData?.find(t => t.id === bal.tipo_sessao_id);
        return {
          ...bal,
          tipos_sessao: tipo ? { id: tipo.id, nome: tipo.nome } : null
        };
      });

      console.log('✅ Balaustres processados:', balaustreComTipos.length);
      setBalaustres(balaustreComTipos);
      
    } catch (err) {
      console.error('❌ Exceção ao carregar balaustres:', err);
      setError('Erro inesperado ao carregar balaustres');
      setBalaustres([]);
    }
  };

  const carregarProximoNumero = async (grau) => {
    try {
      console.log('🔢 Carregando próximo número para grau:', grau);
      
      const { data, error } = await supabase
        .rpc('get_proximo_numero_balaustre', { grau });
      
      console.log('📊 Próximo número:', { data, error });
      
      if (data !== null && data !== undefined) {
        console.log('✅ Próximo número definido:', data);
        setBalaustreForm(prev => ({ ...prev, numero_balaustre: data }));
      } else {
        console.log('⚠️ Próximo número não retornado, usando 1');
        setBalaustreForm(prev => ({ ...prev, numero_balaustre: 1 }));
      }
      
      if (error) {
        console.error('❌ Erro ao carregar próximo número:', error);
      }
    } catch (err) {
      console.error('❌ Exceção ao carregar próximo número:', err);
      setBalaustreForm(prev => ({ ...prev, numero_balaustre: 1 }));
    }
  };

  // ========================================
  // FUNÇÕES DE AUTENTICAÇÃO
  // ========================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const { data: userData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .single();

      if (!userData?.ativo) {
        await supabase.auth.signOut();
        throw new Error('Usuário inativo. Entre em contato com o administrador.');
      }

      setSession(data.session);
      loadUserData(email);
      loadIrmaos();
      loadTiposSessao();
      loadCargosLoja();
      loadBalaustres();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserData(null);
    setPermissoes(null);
    setCurrentPage('dashboard');
  };

  // ========================================
  // FUNÇÕES PARA IRMÃOS
  // ========================================
  const handleSubmitIrmao = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const { data: irmaoData, error: irmaoError } = await supabase
        .from('irmaos')
        .insert([irmaoForm])
        .select()
        .single();

      if (irmaoError) throw irmaoError;

      if (esposa.nome) {
        await supabase.from('familiares').insert([{
          irmao_id: irmaoData.id,
          tipo: 'esposa',
          nome: esposa.nome,
          data_nascimento: esposa.data_nascimento
        }]);
      }

      if (pai.nome) {
        await supabase.from('familiares').insert([{
          irmao_id: irmaoData.id,
          tipo: 'pai',
          nome: pai.nome,
          data_nascimento: pai.data_nascimento,
          falecido: pai.falecido,
          data_obito: pai.data_obito
        }]);
      }

      if (mae.nome) {
        await supabase.from('familiares').insert([{
          irmao_id: irmaoData.id,
          tipo: 'mae',
          nome: mae.nome,
          data_nascimento: mae.data_nascimento,
          falecido: mae.falecido,
          data_obito: mae.data_obito
        }]);
      }

      for (const filho of filhos) {
        if (filho.nome) {
          await supabase.from('familiares').insert([{
            irmao_id: irmaoData.id,
            tipo: 'filho',
            nome: filho.nome,
            data_nascimento: filho.data_nascimento,
            falecido: filho.falecido,
            data_obito: filho.data_obito
          }]);
        }
      }

      setSuccessMessage('Irmão cadastrado com sucesso!');
      loadIrmaos();
      limparFormulario();
      
      setTimeout(() => {
        setSuccessMessage('');
        setCurrentPage('visualizar');
      }, 2000);

    } catch (error) {
      setError('Erro ao salvar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAtualizarIrmao = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const { error: irmaoError } = await supabase
        .from('irmaos')
        .update(irmaoForm)
        .eq('id', irmaoEditando.id);

      if (irmaoError) throw irmaoError;

      await supabase.from('familiares').delete().eq('irmao_id', irmaoEditando.id);

      if (esposa.nome) {
        await supabase.from('familiares').insert([{
          irmao_id: irmaoEditando.id,
          tipo: 'esposa',
          nome: esposa.nome,
          data_nascimento: esposa.data_nascimento
        }]);
      }

      if (pai.nome) {
        await supabase.from('familiares').insert([{
          irmao_id: irmaoEditando.id,
          tipo: 'pai',
          nome: pai.nome,
          data_nascimento: pai.data_nascimento,
          falecido: pai.falecido,
          data_obito: pai.data_obito
        }]);
      }

      if (mae.nome) {
        await supabase.from('familiares').insert([{
          irmao_id: irmaoEditando.id,
          tipo: 'mae',
          nome: mae.nome,
          data_nascimento: mae.data_nascimento,
          falecido: mae.falecido,
          data_obito: mae.data_obito
        }]);
      }

      for (const filho of filhos) {
        if (filho.nome) {
          await supabase.from('familiares').insert([{
            irmao_id: irmaoEditando.id,
            tipo: 'filho',
            nome: filho.nome,
            data_nascimento: filho.data_nascimento,
            falecido: filho.falecido,
            data_obito: filho.data_obito
          }]);
        }
      }

      setSuccessMessage('Cadastro atualizado com sucesso!');
      loadIrmaos();
      limparFormulario();
      
      setTimeout(() => {
        setSuccessMessage('');
        setCurrentPage('visualizar');
      }, 2000);

    } catch (error) {
      setError('Erro ao atualizar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarIrmao = async (irmao) => {
    setModoEdicao(true);
    setIrmaoEditando(irmao);
    setIrmaoForm(irmao);

    const { data: familiares } = await supabase
      .from('familiares')
      .select('*')
      .eq('irmao_id', irmao.id);

    if (familiares) {
      const esposaData = familiares.find(f => f.tipo === 'esposa');
      const paiData = familiares.find(f => f.tipo === 'pai');
      const maeData = familiares.find(f => f.tipo === 'mae');
      const filhosData = familiares.filter(f => f.tipo === 'filho');

      if (esposaData) setEsposa(esposaData);
      if (paiData) setPai(paiData);
      if (maeData) setMae(maeData);
      if (filhosData.length > 0) setFilhos(filhosData);
    }

    setCurrentPage('cadastro');
  };

  const limparFormulario = () => {
    setIrmaoForm({
      cim: '', nome: '', cpf: '', rg: '', data_nascimento: '',
      estado_civil: '', profissao: '', formacao: '', status: 'ativo',
      naturalidade: '', endereco: '', cidade: '', celular: '',
      email: '', local_trabalho: '', cargo: '',
      data_iniciacao: '', data_elevacao: '', data_exaltacao: ''
    });
    setEsposa({ nome: '', data_nascimento: '' });
    setPai({ nome: '', data_nascimento: '', falecido: false, data_obito: '' });
    setMae({ nome: '', data_nascimento: '', falecido: false, data_obito: '' });
    setFilhos([{ nome: '', data_nascimento: '', falecido: false, data_obito: '' }]);
    setModoEdicao(false);
    setIrmaoEditando(null);
  };

  const adicionarFilho = () => {
    setFilhos([...filhos, { nome: '', data_nascimento: '', falecido: false, data_obito: '' }]);
  };

  const removerFilho = (index) => {
    setFilhos(filhos.filter((_, i) => i !== index));
  };

  const atualizarFilho = (index, field, value) => {
    const novosFilhos = [...filhos];
    novosFilhos[index][field] = value;
    setFilhos(novosFilhos);
  };

  // ========================================
  // FUNÇÕES PARA BALAUSTRE
  // ========================================
  const handleSubmitBalaustre = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

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

      setSuccessMessage('Balaustre cadastrado com sucesso!');
      loadBalaustres(grauSelecionado);
      limparFormularioBalaustre();
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);

    } catch (error) {
      setError('Erro ao salvar balaustre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAtualizarBalaustre = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const { error } = await supabase
        .from('balaustres')
        .update(balaustreForm)
        .eq('id', balaustreEditando.id);

      if (error) throw error;

      setSuccessMessage('Balaustre atualizado com sucesso!');
      loadBalaustres(grauSelecionado);
      limparFormularioBalaustre();
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);

    } catch (error) {
      setError('Erro ao atualizar balaustre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarBalaustre = (balaustre) => {
    setModoEdicaoBalaustre(true);
    setBalaustreEditando(balaustre);
    setBalaustreForm({
      grau_sessao: balaustre.grau_sessao,
      numero_balaustre: balaustre.numero_balaustre,
      data_sessao: balaustre.data_sessao,
      dia_semana: balaustre.dia_semana,
      tipo_sessao_id: balaustre.tipo_sessao_id,
      ordem_dia: balaustre.ordem_dia || '',
      observacoes: balaustre.observacoes || ''
    });
  };

  const handleExcluirBalaustre = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este balaustre?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('balaustres')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccessMessage('Balaustre excluído com sucesso!');
      loadBalaustres(grauSelecionado);
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);

    } catch (error) {
      setError('Erro ao excluir balaustre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const limparFormularioBalaustre = () => {
    setBalaustreForm({
      grau_sessao: grauSelecionado,
      numero_balaustre: '',
      data_sessao: '',
      dia_semana: '',
      tipo_sessao_id: '',
      ordem_dia: '',
      observacoes: ''
    });
    setModoEdicaoBalaustre(false);
    setBalaustreEditando(null);
    carregarProximoNumero(grauSelecionado);
  };

  // ========================================
  // RENDERIZAÇÃO
  // ========================================
  if (loading && !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-2xl">Carregando...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <img src={LOGO_URL} alt="Logo" className="w-32 h-32 mx-auto mb-4 rounded-full border-4 border-blue-600" />
            <h1 className="text-3xl font-bold text-blue-900 mb-2">Sistema da Loja</h1>
            <p className="text-gray-600">Gestão Maçônica</p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:bg-gray-400"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const irmaosAtivos = irmaos.filter(i => i.status === 'ativo');
  const totalIrmaos = irmaos.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <img src={LOGO_URL} alt="Logo" className="w-12 h-12 rounded-full border-2 border-white" />
              <div>
                <h1 className="text-2xl font-bold">Sistema da Loja Maçônica</h1>
                <p className="text-sm text-blue-200">Gestão e Controle</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-semibold">{userData?.nome}</p>
                <p className="text-sm text-blue-200 capitalize">{userData?.cargo}</p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold transition"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* NAVEGAÇÃO */}
      <nav className="bg-white shadow-md border-b-2 border-blue-200">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto py-2">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
                currentPage === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => setCurrentPage('cadastro')}
              className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
                currentPage === 'cadastro'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              ➕ Cadastro de Irmãos
            </button>
            <button
              onClick={() => setCurrentPage('visualizar')}
              className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
                currentPage === 'visualizar'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              👥 Visualizar Irmãos
            </button>
            <button
              onClick={() => setCurrentPage('balaustres')}
              className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
                currentPage === 'balaustres'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              📜 Controle de Balaustres
            </button>
          </div>
        </div>
      </nav>

      {/* MENSAGENS */}
      {error && (
        <div className="container mx-auto px-4 mt-4">
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg">
            {error}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="container mx-auto px-4 mt-4">
          <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-lg">
            {successMessage}
          </div>
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL */}
      <main className="container mx-auto px-4 py-8">
        {/* DASHBOARD */}
        {currentPage === 'dashboard' && (
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">📊 Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold mb-2">Total de Irmãos</h3>
                <p className="text-4xl font-bold">{totalIrmaos}</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold mb-2">Irmãos Ativos</h3>
                <p className="text-4xl font-bold">{irmaosAtivos.length}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold mb-2">Balaustres Registrados</h3>
                <p className="text-4xl font-bold">{balaustres.length}</p>
              </div>
            </div>

            <div className="mt-8 bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Bem-vindo ao Sistema</h3>
              <p className="text-gray-600">
                Utilize o menu de navegação acima para acessar as diferentes funcionalidades do sistema.
              </p>
            </div>
          </div>
        )}

        {/* CONTROLE DE BALAUSTRES */}
        {currentPage === 'balaustres' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800">📜 Controle de Balaustres</h2>
            </div>

            {/* FORMULÁRIO DE BALAUSTRE */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4">
                {modoEdicaoBalaustre ? '✏️ Editar Balaustre' : '➕ Novo Balaustre'}
              </h3>

              <form onSubmit={modoEdicaoBalaustre ? handleAtualizarBalaustre : handleSubmitBalaustre}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Grau da Sessão */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Grau da Sessão *</label>
                    <select
                      value={balaustreForm.grau_sessao}
                      onChange={(e) => setBalaustreForm({ ...balaustreForm, grau_sessao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    >
                      <option value="Aprendiz">Aprendiz</option>
                      <option value="Companheiro">Companheiro</option>
                      <option value="Mestre">Mestre</option>
                    </select>
                  </div>

                  {/* Número do Balaustre */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Número do Balaustre *</label>
                    <input
                      type="number"
                      value={balaustreForm.numero_balaustre}
                      onChange={(e) => setBalaustreForm({ ...balaustreForm, numero_balaustre: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                      required
                      readOnly={!modoEdicaoBalaustre}
                    />
                  </div>

                  {/* Data da Sessão */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data da Sessão *</label>
                    <input
                      type="date"
                      value={balaustreForm.data_sessao}
                      onChange={(e) => setBalaustreForm({ ...balaustreForm, data_sessao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>

                  {/* Dia da Semana */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dia da Semana</label>
                    <input
                      type="text"
                      value={balaustreForm.dia_semana}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 outline-none"
                      readOnly
                    />
                  </div>

                  {/* Tipo de Sessão */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Sessão *</label>
                    <select
                      value={balaustreForm.tipo_sessao_id}
                      onChange={(e) => setBalaustreForm({ ...balaustreForm, tipo_sessao_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    >
                      <option value="">Selecione...</option>
                      {tiposSessao.map(tipo => (
                        <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Ordem do Dia */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ordem do Dia</label>
                  <textarea
                    value={balaustreForm.ordem_dia}
                    onChange={(e) => setBalaustreForm({ ...balaustreForm, ordem_dia: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    rows="4"
                    placeholder="Descreva a ordem do dia da sessão..."
                  />
                </div>

                {/* Observações */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                  <textarea
                    value={balaustreForm.observacoes}
                    onChange={(e) => setBalaustreForm({ ...balaustreForm, observacoes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    rows="3"
                    placeholder="Observações adicionais..."
                  />
                </div>

                {/* Botões */}
                <div className="flex justify-end gap-4 mt-6">
                  {modoEdicaoBalaustre && (
                    <button
                      type="button"
                      onClick={limparFormularioBalaustre}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:bg-gray-400"
                  >
                    {loading ? 'Salvando...' : modoEdicaoBalaustre ? '💾 Atualizar' : '💾 Salvar Balaustre'}
                  </button>
                </div>
              </form>
            </div>

            {/* FILTRO POR GRAU */}
            <div className="bg-white rounded-xl shadow-md p-4 mb-6">
              <div className="flex gap-2 items-center">
                <span className="font-semibold text-gray-700">Filtrar por Grau:</span>
                <button
                  onClick={() => setGrauSelecionado('Aprendiz')}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    grauSelecionado === 'Aprendiz'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Aprendiz
                </button>
                <button
                  onClick={() => setGrauSelecionado('Companheiro')}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    grauSelecionado === 'Companheiro'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Companheiro
                </button>
                <button
                  onClick={() => setGrauSelecionado('Mestre')}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    grauSelecionado === 'Mestre'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Mestre
                </button>
              </div>
            </div>

            {/* TABELA DE BALAUSTRES */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <h3 className="text-xl font-bold">
                  Balaustres - Grau: {grauSelecionado}
                </h3>
                <p className="text-sm text-blue-100">Total: {balaustres.length} registros</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nº Balaustre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data da Sessão
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dia da Semana
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo de Sessão
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ordem do Dia
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {balaustres.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                          Nenhum balaustre cadastrado para o grau {grauSelecionado}
                        </td>
                      </tr>
                    ) : (
                      balaustres.map((balaustre) => (
                        <tr key={balaustre.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-semibold text-blue-600">
                              {balaustre.numero_balaustre}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {formatarData(balaustre.data_sessao)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {balaustre.dia_semana}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                              {balaustre.tipos_sessao?.nome || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-600 max-w-md truncate">
                              {balaustre.ordem_dia || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex justify-center gap-2">
                              {permissoes?.canEdit && (
                                <button
                                  onClick={() => handleEditarBalaustre(balaustre)}
                                  className="text-blue-600 hover:text-blue-800 font-semibold"
                                  title="Editar"
                                >
                                  ✏️
                                </button>
                              )}
                              {permissoes?.canDelete && (
                                <button
                                  onClick={() => handleExcluirBalaustre(balaustre.id)}
                                  className="text-red-600 hover:text-red-800 font-semibold"
                                  title="Excluir"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VISUALIZAR IRMÃOS */}
        {currentPage === 'visualizar' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800">👥 Irmãos Cadastrados</h2>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-xl shadow-md p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="🔍 Buscar por nome ou CIM..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Todos os Status</option>
                  <option value="ativo">Ativos</option>
                  <option value="inativo">Inativos</option>
                  <option value="afastado">Afastados</option>
                </select>
              </div>
            </div>

            {/* Lista de Irmãos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {irmaos
                .filter(irmao => {
                  const matchSearch = irmao.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    irmao.cim.toString().includes(searchTerm);
                  const matchStatus = !statusFilter || irmao.status === statusFilter;
                  return matchSearch && matchStatus;
                })
                .map(irmao => (
                  <div key={irmao.id} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">{irmao.nome}</h3>
                        <p className="text-sm text-gray-600">CIM: {irmao.cim}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        irmao.status === 'ativo' ? 'bg-green-100 text-green-800' :
                        irmao.status === 'inativo' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {irmao.status}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600 mb-4">
                      <p>📧 {irmao.email || '-'}</p>
                      <p>📱 {irmao.celular || '-'}</p>
                      <p>🎂 {formatarData(irmao.data_nascimento)}</p>
                      {irmao.data_iniciacao && (
                        <p>⏱️ {calcularTempoMaconaria(irmao.data_iniciacao)}</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {permissoes?.canEdit && (
                        <button
                          onClick={() => handleEditarIrmao(irmao)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition"
                        >
                          ✏️ Editar
                        </button>
                      )}
                      <button
                        onClick={() => setIrmaoSelecionado(irmao)}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold transition"
                      >
                        👁️ Detalhes
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {irmaos.filter(irmao => {
              const matchSearch = irmao.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                irmao.cim.toString().includes(searchTerm);
              const matchStatus = !statusFilter || irmao.status === statusFilter;
              return matchSearch && matchStatus;
            }).length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Nenhum irmão encontrado com os filtros aplicados
              </div>
            )}
          </div>
        )}

        {/* CADASTRO DE IRMÃOS */}
        {currentPage === 'cadastro' && (
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">
              {modoEdicao ? '✏️ Editar Cadastro de Irmão' : '➕ Cadastro de Novo Irmão'}
            </h2>

            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="space-y-8">
                {/* Dados Pessoais */}
                <div>
                  <h3 className="text-xl font-bold text-blue-900 mb-4 pb-2 border-b-2 border-blue-200">
                    👤 Dados Pessoais
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">CIM *</label>
                      <input
                        type="text"
                        value={irmaoForm.cim}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, cim: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo *</label>
                      <input
                        type="text"
                        value={irmaoForm.nome}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, nome: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">CPF</label>
                      <input
                        type="text"
                        value={irmaoForm.cpf}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, cpf: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">RG</label>
                      <input
                        type="text"
                        value={irmaoForm.rg}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, rg: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                      <input
                        type="date"
                        value={irmaoForm.data_nascimento}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, data_nascimento: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    {irmaoForm.data_nascimento && (
                      <div className="md:col-span-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900">
                          🎂 Idade: {calcularIdade(irmaoForm.data_nascimento)}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Estado Civil</label>
                      <select
                        value={irmaoForm.estado_civil}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, estado_civil: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Selecione...</option>
                        <option value="solteiro">Solteiro</option>
                        <option value="casado">Casado</option>
                        <option value="divorciado">Divorciado</option>
                        <option value="viuvo">Viúvo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Profissão</label>
                      <input
                        type="text"
                        value={irmaoForm.profissao}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, profissao: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Formação</label>
                      <input
                        type="text"
                        value={irmaoForm.formacao}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, formacao: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Dados de Contato */}
                <div>
                  <h3 className="text-xl font-bold text-green-900 mb-4 pb-2 border-b-2 border-green-200">
                    📞 Dados de Contato
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={irmaoForm.email}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Celular</label>
                      <input
                        type="text"
                        value={irmaoForm.celular}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, celular: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Naturalidade</label>
                      <input
                        type="text"
                        value={irmaoForm.naturalidade}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, naturalidade: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Endereço</label>
                      <input
                        type="text"
                        value={irmaoForm.endereco}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, endereco: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
                      <input
                        type="text"
                        value={irmaoForm.cidade}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, cidade: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Dados Profissionais */}
                <div>
                  <h3 className="text-xl font-bold text-orange-900 mb-4 pb-2 border-b-2 border-orange-200">
                    💼 Dados Profissionais
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Local de Trabalho</label>
                      <input
                        type="text"
                        value={irmaoForm.local_trabalho}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, local_trabalho: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cargo</label>
                      <input
                        type="text"
                        value={irmaoForm.cargo}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, cargo: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Dados Maçônicos */}
                <div>
                  <h3 className="text-xl font-bold text-purple-900 mb-4 pb-2 border-b-2 border-purple-200">
                    🔺 Dados Maçônicos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Iniciação</label>
                      <input
                        type="date"
                        value={irmaoForm.data_iniciacao}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, data_iniciacao: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Elevação</label>
                      <input
                        type="date"
                        value={irmaoForm.data_elevacao}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, data_elevacao: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Exaltação</label>
                      <input
                        type="date"
                        value={irmaoForm.data_exaltacao}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, data_exaltacao: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    {irmaoForm.data_iniciacao && (
                      <div className="md:col-span-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900">
                          ⏱️ Tempo de Maçonaria: {calcularTempoMaconaria(irmaoForm.data_iniciacao)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dados da Esposa */}
                <div>
                  <h3 className="text-xl font-bold text-pink-900 mb-4 pb-2 border-b-2 border-pink-200">
                    💑 Dados da Esposa (Opcional)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                      <input
                        type="text"
                        value={esposa.nome}
                        onChange={(e) => setEsposa({ ...esposa, nome: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                      <input
                        type="date"
                        value={esposa.data_nascimento}
                        onChange={(e) => setEsposa({ ...esposa, data_nascimento: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Dados dos Pais */}
                <div>
                  <h3 className="text-xl font-bold text-green-900 mb-4 pb-2 border-b-2 border-green-200">
                    👨‍👩‍👦 Dados dos Pais (Opcional)
                  </h3>
                  
                  <div className="mb-6">
                    <p className="font-semibold text-gray-700 mb-3">Pai:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                        <input
                          type="text"
                          value={pai.nome}
                          onChange={(e) => setPai({ ...pai, nome: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                        <input
                          type="date"
                          value={pai.data_nascimento}
                          onChange={(e) => setPai({ ...pai, data_nascimento: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="flex items-center">
                        <label className="flex items-center cursor-pointer mt-6">
                          <input
                            type="checkbox"
                            checked={pai.falecido}
                            onChange={(e) => setPai({ ...pai, falecido: e.target.checked })}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="ml-2 text-sm font-medium text-gray-700">Falecido</span>
                        </label>
                      </div>
                      {pai.falecido && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Data do Óbito</label>
                          <input
                            type="date"
                            value={pai.data_obito}
                            onChange={(e) => setPai({ ...pai, data_obito: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-gray-700 mb-3">Mãe:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                        <input
                          type="text"
                          value={mae.nome}
                          onChange={(e) => setMae({ ...mae, nome: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                        <input
                          type="date"
                          value={mae.data_nascimento}
                          onChange={(e) => setMae({ ...mae, data_nascimento: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="flex items-center">
                        <label className="flex items-center cursor-pointer mt-6">
                          <input
                            type="checkbox"
                            checked={mae.falecido}
                            onChange={(e) => setMae({ ...mae, falecido: e.target.checked })}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="ml-2 text-sm font-medium text-gray-700">Falecida</span>
                        </label>
                      </div>
                      {mae.falecido && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Data do Óbito</label>
                          <input
                            type="date"
                            value={mae.data_obito}
                            onChange={(e) => setMae({ ...mae, data_obito: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dados dos Filhos */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-purple-900 pb-2 border-b-2 border-purple-200">
                      👶 Dados dos Filhos (Opcional)
                    </h3>
                    <button
                      type="button"
                      onClick={adicionarFilho}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                    >
                      + Adicionar Filho
                    </button>
                  </div>
                  
                  {filhos.map((filho, index) => (
                    <div key={index} className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex justify-between items-center mb-3">
                        <p className="font-semibold text-gray-700">Filho {index + 1}:</p>
                        {filhos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removerFilho(index)}
                            className="text-red-600 hover:text-red-800 text-sm font-semibold"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                          <input
                            type="text"
                            value={filho.nome}
                            onChange={(e) => atualizarFilho(index, 'nome', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                          <input
                            type="date"
                            value={filho.data_nascimento}
                            onChange={(e) => atualizarFilho(index, 'data_nascimento', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="flex items-center">
                          <label className="flex items-center cursor-pointer mt-6">
                            <input
                              type="checkbox"
                              checked={filho.falecido}
                              onChange={(e) => atualizarFilho(index, 'falecido', e.target.checked)}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700">Falecido</span>
                          </label>
                        </div>
                        {filho.falecido && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Data do Óbito</label>
                            <input
                              type="date"
                              value={filho.data_obito}
                              onChange={(e) => atualizarFilho(index, 'data_obito', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Botões de ação */}
                <div className="flex justify-end gap-4 pt-6 border-t">
                  <button
                    type="button"
                    onClick={limparFormulario}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
                  >
                    {modoEdicao ? 'Cancelar' : 'Limpar Formulário'}
                  </button>
                  <button
                    onClick={modoEdicao ? handleAtualizarIrmao : handleSubmitIrmao}
                    disabled={loading || !irmaoForm.cim || !irmaoForm.nome}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Salvando...' : modoEdicao ? '💾 Atualizar Cadastro' : '💾 Salvar Cadastro'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
