import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ypnvzjctyfdrkkrhskzs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwbnZ6amN0eWZkcmtrcmhza3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTgxMzcsImV4cCI6MjA3OTMzNDEzN30.J5Jj7wudOhIAxy35DDBIWtr9yr9Lq3ABBRI9ZJ5z2pc';
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [userData, setUserData] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [successMessage, setSuccessMessage] = useState('');

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadUserData(session.user.email);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadUserData(session.user.email);
      else setUserData(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userEmail) => {
    try {
      const { data, error } = await supabase.from('usuarios').select('*').eq('email', userEmail).single();
      if (error) throw error;
      setUserData(data);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: userData, error: userError } = await supabase.from('usuarios').select('*').eq('email', email).single();
      if (userError) throw new Error('Usuário não encontrado no sistema');
      if (!userData.ativo) {
        await supabase.auth.signOut();
        throw new Error('Usuário inativo. Contate o administrador.');
      }
    } catch (err) {
      setError(err.message || 'Erro ao fazer login');
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserData(null);
    setEmail('');
    setPassword('');
    setCurrentPage('dashboard');
  };

  const calcularTempoMaconaria = (dataIniciacao) => {
    if (!dataIniciacao) return '';
    const inicio = new Date(dataIniciacao);
    const hoje = new Date();
    let anos = hoje.getFullYear() - inicio.getFullYear();
    let meses = hoje.getMonth() - inicio.getMonth();
    if (meses < 0) { anos--; meses = 12 + meses; }
    return `${anos} ano(s) e ${meses} mês(es)`;
  };

  const adicionarFilho = () => {
    setFilhos([...filhos, { nome: '', data_nascimento: '', falecido: false, data_obito: '' }]);
  };

  const removerFilho = (index) => {
    setFilhos(filhos.filter((_, i) => i !== index));
  };

  const atualizarFilho = (index, campo, valor) => {
    const novosFilhos = [...filhos];
    novosFilhos[index][campo] = valor;
    setFilhos(novosFilhos);
  };

  const handleSubmitIrmao = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const { data: irmaoData, error: irmaoError } = await supabase.from('irmaos').insert([irmaoForm]).select().single();
      if (irmaoError) throw irmaoError;

      const irmaoId = irmaoData.id;

      if (esposa.nome) {
        await supabase.from('esposas').insert([{ irmao_id: irmaoId, ...esposa }]);
      }

      if (pai.nome) {
        await supabase.from('pais').insert([{ irmao_id: irmaoId, tipo: 'pai', ...pai }]);
      }

      if (mae.nome) {
        await supabase.from('pais').insert([{ irmao_id: irmaoId, tipo: 'mae', ...mae }]);
      }

      const filhosValidos = filhos.filter(f => f.nome);
      if (filhosValidos.length > 0) {
        await supabase.from('filhos').insert(filhosValidos.map(f => ({ irmao_id: irmaoId, ...f })));
      }

      setSuccessMessage('Irmão cadastrado com sucesso!');
      
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

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Erro ao cadastrar irmão');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  if (session && userData) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Sistema Loja Maçônica</h1>
              <p className="text-blue-200 mt-1">Bem-vindo, {userData.nome}</p>
            </div>
            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold transition">
              Sair
            </button>
          </div>
        </header>

        <nav className="bg-white shadow-md">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex space-x-8">
              <button
                onClick={() => setCurrentPage('dashboard')}
                className={`py-4 px-2 border-b-2 font-medium ${currentPage === 'dashboard' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-blue-600'}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentPage('cadastro')}
                className={`py-4 px-2 border-b-2 font-medium ${currentPage === 'cadastro' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-blue-600'}`}
              >
                Cadastrar Irmão
              </button>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {currentPage === 'dashboard' && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl shadow-md p-8 border border-green-200">
              <div className="flex items-start gap-4">
                <div className="text-5xl">🎉</div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-3">Sistema Operacional!</h2>
                  <p className="text-gray-700 mb-4">
                    ✅ Fase 1: Autenticação completa<br />
                    ✅ Fase 2: Cadastro de Irmãos pronto
                  </p>
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <p className="text-gray-800 font-semibold mb-2">📋 Funcionalidades disponíveis:</p>
                    <ul className="text-gray-600 space-y-1">
                      <li>• Cadastro completo de irmãos com todos os campos</li>
                      <li>• Cadastro de esposa</li>
                      <li>• Cadastro de pais (pai e mãe)</li>
                      <li>• Cadastro de múltiplos filhos</li>
                      <li>• Cálculo automático do tempo de maçonaria</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentPage === 'cadastro' && (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Cadastro de Irmão</h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                  ⚠️ {error}
                </div>
              )}

              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
                  ✅ {successMessage}
                </div>
              )}

              <div className="space-y-8">
                {/* Dados do Irmão */}
                <div>
                  <h3 className="text-xl font-bold text-blue-900 mb-4 pb-2 border-b-2 border-blue-200">📋 Dados do Irmão</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">CIM *</label>
                      <input type="text" value={irmaoForm.cim} onChange={(e) => setIrmaoForm({ ...irmaoForm, cim: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo *</label>
                      <input type="text" value={irmaoForm.nome} onChange={(e) => setIrmaoForm({ ...irmaoForm, nome: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">CPF</label>
                      <input type="text" value={irmaoForm.cpf} onChange={(e) => setIrmaoForm({ ...irmaoForm, cpf: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">RG</label>
                      <input type="text" value={irmaoForm.rg} onChange={(e) => setIrmaoForm({ ...irmaoForm, rg: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                      <input type="date" value={irmaoForm.data_nascimento} onChange={(e) => setIrmaoForm({ ...irmaoForm, data_nascimento: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Estado Civil</label>
                      <select value={irmaoForm.estado_civil} onChange={(e) => setIrmaoForm({ ...irmaoForm, estado_civil: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="">Selecione</option>
                        <option value="solteiro">Solteiro</option>
                        <option value="casado">Casado</option>
                        <option value="divorciado">Divorciado</option>
                        <option value="viuvo">Viúvo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Profissão</label>
                      <input type="text" value={irmaoForm.profissao} onChange={(e) => setIrmaoForm({ ...irmaoForm, profissao: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Formação</label>
                      <input type="text" value={irmaoForm.formacao} onChange={(e) => setIrmaoForm({ ...irmaoForm, formacao: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                      <select value={irmaoForm.status} onChange={(e) => setIrmaoForm({ ...irmaoForm, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Naturalidade</label>
                      <input type="text" value={irmaoForm.naturalidade} onChange={(e) => setIrmaoForm({ ...irmaoForm, naturalidade: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Endereço</label>
                      <input type="text" value={irmaoForm.endereco} onChange={(e) => setIrmaoForm({ ...irmaoForm, endereco: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
                      <input type="text" value={irmaoForm.cidade} onChange={(e) => setIrmaoForm({ ...irmaoForm, cidade: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Celular</label>
                      <input type="text" value={irmaoForm.celular} onChange={(e) => setIrmaoForm({ ...irmaoForm, celular: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">E-mail</label>
                      <input type="email" value={irmaoForm.email} onChange={(e) => setIrmaoForm({ ...irmaoForm, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Local de Trabalho</label>
                      <input type="text" value={irmaoForm.local_trabalho} onChange={(e) => setIrmaoForm({ ...irmaoForm, local_trabalho: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cargo na Loja</label>
                      <input type="text" value={irmaoForm.cargo} onChange={(e) => setIrmaoForm({ ...irmaoForm, cargo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Venerável Mestre, Orador..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Iniciação</label>
                      <input type="date" value={irmaoForm.data_iniciacao} onChange={(e) => setIrmaoForm({ ...irmaoForm, data_iniciacao: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Elevação</label>
                      <input type="date" value={irmaoForm.data_elevacao} onChange={(e) => setIrmaoForm({ ...irmaoForm, data_elevacao: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Exaltação</label>
                      <input type="date" value={irmaoForm.data_exaltacao} onChange={(e) => setIrmaoForm({ ...irmaoForm, data_exaltacao: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    {irmaoForm.data_iniciacao && (
                      <div className="md:col-span-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900">⏱️ Tempo de Maçonaria: {calcularTempoMaconaria(irmaoForm.data_iniciacao)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Esposa */}
                <div>
                  <h3 className="text-xl font-bold text-pink-900 mb-4 pb-2 border-b-2 border-pink-200">💑 Dados da Esposa (Opcional)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                      <input type="text" value={esposa.nome} onChange={(e) => setEsposa({ ...esposa, nome: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                      <input type="date" value={esposa.data_nascimento} onChange={(e) => setEsposa({ ...esposa, data_nascimento: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  </div>
                </div>

                {/* Pais */}
                <div>
                  <h3 className="text-xl font-bold text-green-900 mb-4 pb-2 border-b-2 border-green-200">👨‍👩‍👦 Dados dos Pais (Opcional)</h3>
                  
                  <div className="mb-6">
                    <p className="font-semibold text-gray-700 mb-3">Pai:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                        <input type="text" value={pai.nome} onChange={(e) => setPai({ ...pai, nome: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                        <input type="date" value={pai.data_nascimento} onChange={(e) => setPai({ ...pai, data_nascimento: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div className="flex items-center">
                        <label className="flex items-center cursor-pointer mt-6">
                          <input type="checkbox" checked={pai.falecido} onChange={(e) => setPai({ ...pai, falecido: e.target.checked })} className="w-4 h-4 text-blue-600" />
                          <span className="ml-2 text-sm font-medium text-gray-700">Falecido</span>
                        </label>
                      </div>
                      {pai.falecido && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Data do Óbito</label>
                          <input type="date" value={pai.data_obito} onChange={(e) => setPai({ ...pai, data_obito: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-gray-700 mb-3">Mãe:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                        <input type="text" value={mae.nome} onChange={(e) => setMae({ ...mae, nome: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                        <input type="date" value={mae.data_nascimento} onChange={(e) => setMae({ ...mae, data_nascimento: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div className="flex items-center">
                        <label className="flex items-center cursor-pointer mt-6">
                          <input type="checkbox" checked={mae.falecido} onChange={(e) => setMae({ ...mae, falecido: e.target.checked })} className="w-4 h-4 text-blue-600" />
                          <span className="ml-2 text-sm font-medium text-gray-700">Falecida</span>
                        </label>
                      </div>
                      {mae.falecido && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Data do Óbito</label>
                          <input type="date" value={mae.data_obito} onChange={(e) => setMae({ ...mae, data_obito: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Filhos */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-purple-900 pb-2 border-b-2 border-purple-200">👶 Dados dos Filhos (Opcional)</h3>
                    <button type="button" onClick={adicionarFilho} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
                      + Adicionar Filho
                    </button>
                  </div>
                  
                  {filhos.map((filho, index) => (
                    <div key={index} className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex justify-between items-center mb-3">
                        <p className="font-semibold text-gray-700">Filho {index + 1}:</p>
                        {filhos.length > 1 && (
                          <button type="button" onClick={() => removerFilho(index)} className="text-red-600 hover:text-red-800 text-sm font-semibold">Remover</button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                          <input type="text" value={filho.nome} onChange={(e) => atualizarFilho(index, 'nome', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                          <input type="date" value={filho.data_nascimento} onChange={(e) => atualizarFilho(index, 'data_nascimento', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="flex items-center">
                          <label className="flex items-center cursor-pointer mt-6">
                            <input type="checkbox" checked={filho.falecido} onChange={(e) => atualizarFilho(index, 'falecido', e.target.checked)} className="w-4 h-4 text-blue-600" />
                            <span className="ml-2 text-sm font-medium text-gray-700">Falecido</span>
                          </label>
                        </div>
                        {filho.falecido && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Data do Óbito</label>
                            <input type="date" value={filho.data_obito} onChange={(e) => atualizarFilho(index, 'data_obito', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Botão Salvar */}
                <div className="flex justify-end gap-4 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => {
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
                    }}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
                  >
                    Limpar Formulário
                  </button>
                  <button
                    onClick={handleSubmitIrmao}
                    disabled={loading || !irmaoForm.cim || !irmaoForm.nome}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Salvando...' : '💾 Salvar Cadastro'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Tela de Login
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔷</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Loja Maçônica</h1>
          <p className="text-gray-600">Sistema de Gestão</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="seu@email.com"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> Entrando...
              </span>
            ) : (
              '🔐 Entrar'
            )}
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">Fase 2: Cadastro Completo ✅</p>
        </div>
      </div>
    </div>
  );
}

export default App;
