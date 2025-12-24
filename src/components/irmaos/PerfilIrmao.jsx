import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import VidaMaconica from '../vida-maconica/VidaMaconica';

export default function PerfilIrmao({ irmaoId, onVoltar, showSuccess, showError, permissoes, userEmail, userData }) {
  const [irmao, setIrmao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [abaSelecionada, setAbaSelecionada] = useState('pessoal');
  const [irmaoForm, setIrmaoForm] = useState({});
  const [familiares, setFamiliares] = useState({
    conjuge: null,
    pais: { pai: null, mae: null },
    filhos: []
  });
  const [historicoCargos, setHistoricoCargos] = useState([]);

  useEffect(() => {
    if (irmaoId) {
      carregarIrmao();
      carregarFamiliares();
      carregarHistoricoCargos();
    }
  }, [irmaoId]);

  const carregarIrmao = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('irmaos')
      .select('*')
      .eq('id', irmaoId)
      .single();

    if (data) {
      setIrmao(data);
      setIrmaoForm(data);
    }
    setLoading(false);
  };

  const carregarFamiliares = async () => {
    // Carregar cônjuge
    const { data: conjugeData } = await supabase
      .from('esposas')
      .select('*')
      .eq('irmao_id', irmaoId)
      .single();

    // Carregar pais
    const { data: paisData } = await supabase
      .from('pais')
      .select('*')
      .eq('irmao_id', irmaoId);

    const pai = paisData?.find(p => p.tipo === 'pai');
    const mae = paisData?.find(p => p.tipo === 'mae');

    console.log('📊 DEBUG PAIS:', {
      paisData,
      pai,
      mae
    });

    // Carregar filhos
    const { data: filhosData } = await supabase
      .from('filhos')
      .select('*')
      .eq('irmao_id', irmaoId)
      .order('data_nascimento', { ascending: true });

    setFamiliares({
      conjuge: conjugeData || null,
      pais: { pai, mae },
      filhos: filhosData || []
    });
  };

  const carregarHistoricoCargos = async () => {
    try {
      console.log('🔍 Carregando cargos para irmão ID:', irmaoId);
      const { data: cargosData, error } = await supabase
        .from('historico_cargos')
        .select('*')
        .eq('irmao_id', irmaoId)
        .order('ano', { ascending: false });

      console.log('📊 Cargos retornados:', cargosData);
      console.log('❌ Erro (se houver):', error);

      setHistoricoCargos(cargosData || []);
    } catch (error) {
      console.log('ℹ️ Erro ao carregar cargos:', error.message);
      setHistoricoCargos([]);
    }
  };

  const handleSalvarEdicao = async () => {
    try {
      // Salvar dados do irmão
      const { error: erroIrmao } = await supabase
        .from('irmaos')
        .update(irmaoForm)
        .eq('id', irmaoId);

      if (erroIrmao) throw erroIrmao;

      // Deletar cargos antigos e inserir novos
      await supabase.from('historico_cargos').delete().eq('irmao_id', irmaoId);
      
      if (historicoCargos.length > 0) {
        const cargosParaSalvar = historicoCargos.map(c => ({
          irmao_id: irmaoId,
          ano: c.ano,
          cargo: c.cargo
        }));
        
        const { error: erroCargos } = await supabase
          .from('historico_cargos')
          .insert(cargosParaSalvar);
          
        if (erroCargos) throw erroCargos;
      }

      showSuccess('✅ Perfil atualizado com sucesso!');
      setModoEdicao(false);
      carregarIrmao();
      carregarHistoricoCargos();
    } catch (error) {
      showError('❌ Erro ao salvar: ' + error.message);
    }
  };

  const handleSalvar = async () => {
    const { error } = await supabase
      .from('irmaos')
      .update(irmaoForm)
      .eq('id', irmaoId);

    if (error) {
      showError('Erro ao salvar alterações');
    } else {
      showSuccess('Alterações salvas com sucesso!');
      setIrmao(irmaoForm);
      setModoEdicao(false);
      carregarIrmao();
    }
  };

  const calcularIdade = (dataNascimento) => {
    if (!dataNascimento) return '';
    const hoje = new Date();
    const nascimento = new Date(dataNascimento + 'T00:00:00');
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return `${idade} anos`;
  };

  const calcularTempoMaconaria = (dataIniciacao) => {
    if (!dataIniciacao) return '';
    const inicio = new Date(dataIniciacao + 'T00:00:00');
    const hoje = new Date();
    let anos = hoje.getFullYear() - inicio.getFullYear();
    let meses = hoje.getMonth() - inicio.getMonth();
    if (meses < 0) { anos--; meses = 12 + meses; }
    return `${anos} ano(s) e ${meses} mês(es)`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">Carregando perfil...</div>
      </div>
    );
  }

  if (!irmao) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Irmão não encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com foto e nome */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex gap-6 items-center">
              {irmao.foto_url ? (
                <img
                  src={irmao.foto_url}
                  alt={irmao.nome}
                  className="w-24 h-24 rounded-full border-4 border-white shadow-lg object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-white flex items-center justify-center">
                  <span className="text-4xl text-blue-600">👤</span>
                </div>
              )}
              
              <div>
                <h1 className="text-3xl font-bold mb-2">{irmao.nome}</h1>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">CIM:</span>
                    <span>{irmao.cim || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Grau:</span>
                    <span>
                      {irmao.data_exaltacao ? 'Mestre' : irmao.data_elevacao ? 'Companheiro' : 'Aprendiz'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Status:</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      irmao.status === 'ativo' ? 'bg-green-500' : 'bg-gray-500'
                    }`}>
                      {irmao.status?.toUpperCase() || 'ATIVO'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {/* Botão Editar - apenas se for o próprio irmão */}
              {userEmail === irmao.email && !modoEdicao && (
                <button
                  onClick={() => setModoEdicao(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  ✏️ Editar Meu Perfil
                </button>
              )}
              
              {/* Botões de salvar/cancelar quando em edição */}
              {modoEdicao && (
                <>
                  <button
                    onClick={handleSalvarEdicao}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    ✓ Salvar
                  </button>
                  <button
                    onClick={() => {
                      setModoEdicao(false);
                      carregarIrmao(); // Recarrega dados originais
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                  >
                    ✕ Cancelar
                  </button>
                </>
              )}
              
              <button
                onClick={onVoltar}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
              >
                ← Voltar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b overflow-x-auto">
          <button
            onClick={() => setAbaSelecionada('pessoal')}
            className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
              abaSelecionada === 'pessoal'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📋 Dados Pessoais
          </button>
          <button
            onClick={() => setAbaSelecionada('maconico')}
            className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
              abaSelecionada === 'maconico'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🔨 Dados Maçônicos
          </button>
          <button
            onClick={() => setAbaSelecionada('familiar')}
            className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
              abaSelecionada === 'familiar'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            👨‍👩‍👧 Dados Familiares
          </button>
          <button
            onClick={() => setAbaSelecionada('vida-maconica')}
            className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
              abaSelecionada === 'vida-maconica'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🔺 Vida Maçônica
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <div className="p-6">
          {/* ABA: Dados Pessoais */}
          {abaSelecionada === 'pessoal' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Nome Completo */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.nome || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, nome: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{irmao.nome}</p>
                  )}
                </div>

                {/* CPF */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.cpf || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, cpf: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{irmao.cpf || 'Não informado'}</p>
                  )}
                </div>

                {/* RG */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RG</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.rg || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, rg: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{irmao.rg || 'Não informado'}</p>
                  )}
                </div>

                {/* Data de Nascimento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                  {modoEdicao ? (
                    <input
                      type="date"
                      value={irmaoForm.data_nascimento || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, data_nascimento: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div>
                      <p className="text-gray-900">
                        {irmao.data_nascimento ? irmao.data_nascimento.split('-').reverse().join('/') : 'Não informado'}
                      </p>
                      {irmao.data_nascimento && (
                        <p className="text-xs text-gray-500">{calcularIdade(irmao.data_nascimento)}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  {modoEdicao ? (
                    <input
                      type="email"
                      value={irmaoForm.email || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{irmao.email || 'Não informado'}</p>
                  )}
                </div>

                {/* Telefone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.telefone || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, telefone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{irmao.telefone || 'Não informado'}</p>
                  )}
                </div>

                {/* Profissão */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Profissão</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.profissao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, profissao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{irmao.profissao || 'Não informado'}</p>
                  )}
                </div>

                {/* Estado Civil */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado Civil</label>
                  {modoEdicao ? (
                    <select
                      value={irmaoForm.estado_civil || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, estado_civil: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="solteiro">Solteiro</option>
                      <option value="casado">Casado</option>
                      <option value="divorciado">Divorciado</option>
                      <option value="viuvo">Viúvo</option>
                    </select>
                  ) : (
                    <p className="text-gray-900 capitalize">{irmao.estado_civil || 'Não informado'}</p>
                  )}
                </div>

                {/* Escolaridade */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Escolaridade</label>
                  {modoEdicao ? (
                    <select
                      value={irmaoForm.escolaridade || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, escolaridade: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="fundamental_incompleto">Fundamental Incompleto</option>
                      <option value="fundamental_completo">Fundamental Completo</option>
                      <option value="medio_incompleto">Médio Incompleto</option>
                      <option value="medio_completo">Médio Completo</option>
                      <option value="superior_incompleto">Superior Incompleto</option>
                      <option value="superior_completo">Superior Completo</option>
                      <option value="pos_graduacao">Pós-Graduação</option>
                      <option value="mestrado">Mestrado</option>
                      <option value="doutorado">Doutorado</option>
                    </select>
                  ) : (
                    <p className="text-gray-900">{irmao.escolaridade?.replace(/_/g, ' ') || 'Não informado'}</p>
                  )}
                </div>

                {/* Endereço Completo */}
                <div className="md:col-span-3">
                  <h4 className="font-semibold text-gray-700 mb-3 border-b pb-2">📍 Endereço</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.cep || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, cep: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-900">{irmao.cep || 'Não informado'}</p>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.endereco || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, endereco: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-900">{irmao.endereco || 'Não informado'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.numero || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, numero: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-900">{irmao.numero || 'S/N'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.complemento || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, complemento: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-900">{irmao.complemento || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.bairro || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, bairro: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-900">{irmao.bairro || 'Não informado'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.cidade || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, cidade: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-900">{irmao.cidade || 'Não informado'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.estado || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, estado: e.target.value })}
                          maxLength={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-900">{irmao.estado || 'Não informado'}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA: Dados Maçônicos */}
          {abaSelecionada === 'maconico' && (
            <div className="space-y-6">
              {/* LINHA 1: CIM e Situação */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CIM</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.cim || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, cim: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium text-lg">{irmao.cim || 'Não informado'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Situação</label>
                  {modoEdicao ? (
                    <select
                      value={irmaoForm.situacao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, situacao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="regular">Regular</option>
                      <option value="irregular">Irregular</option>
                      <option value="remido">Remido</option>
                      <option value="falecido">Falecido</option>
                    </select>
                  ) : (
                    <p className="text-gray-900 capitalize text-lg">{irmao.situacao || 'Regular'}</p>
                  )}
                </div>
              </div>

              {/* LINHA 2: Datas de Iniciação, Elevação e Exaltação */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">🔨 Data de Iniciação</label>
                  {modoEdicao ? (
                    <input
                      type="date"
                      value={irmaoForm.data_iniciacao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, data_iniciacao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div>
                      <p className="text-gray-900">
                        {irmao.data_iniciacao ? irmao.data_iniciacao.split('-').reverse().join('/') : 'Não informado'}
                      </p>
                      {irmao.data_iniciacao && (
                        <p className="text-xs text-gray-500">{calcularTempoMaconaria(irmao.data_iniciacao)}</p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">📐 Data de Elevação</label>
                  {modoEdicao ? (
                    <input
                      type="date"
                      value={irmaoForm.data_elevacao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, data_elevacao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">
                      {irmao.data_elevacao ? irmao.data_elevacao.split('-').reverse().join('/') : 'Não informado'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">🏛️ Data de Exaltação</label>
                  {modoEdicao ? (
                    <input
                      type="date"
                      value={irmaoForm.data_exaltacao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, data_exaltacao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">
                      {irmao.data_exaltacao ? irmao.data_exaltacao.split('-').reverse().join('/') : 'Não informado'}
                    </p>
                  )}
                </div>
              </div>

              {/* LINHA 3: Loja Origem, Oriente e Potência */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loja de Origem</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.loja_origem || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, loja_origem: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{irmao.loja_origem || 'Não informado'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Oriente</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.oriente || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, oriente: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{irmao.oriente || 'Não informado'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Potência</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.grande_oriente || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, grande_oriente: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{irmao.grande_oriente || 'Não informado'}</p>
                  )}
                </div>
              </div>

              {/* LINHA 4: Observações */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                {modoEdicao ? (
                  <textarea
                    value={irmaoForm.observacoes || ''}
                    onChange={(e) => setIrmaoForm({ ...irmaoForm, observacoes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{irmao.observacoes || 'Nenhuma observação'}</p>
                )}
              </div>

              {/* HISTÓRICO DE CARGOS */}
              <div className="border-t pt-6">
                <div className="bg-blue-100 p-3 rounded-lg mb-4">
                  <h4 className="text-md font-semibold text-gray-700 flex items-center gap-2">
                    <span>🏛️</span>
                    <span>Histórico de Cargos na Loja</span>
                  </h4>
                </div>

                {/* Formulário para adicionar cargo - apenas em modo edição */}
                {modoEdicao && (
                  <div className="bg-blue-50 p-4 rounded-lg mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
                        <input
                          type="number"
                          id="cargo-ano"
                          min="1900"
                          max="2100"
                          className="w-full px-3 py-2 border rounded"
                          placeholder="Ex: 2024"
                        />
                      </div>
                      <div className="md:col-span-7">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                        <input
                          type="text"
                          id="cargo-nome"
                          className="w-full px-3 py-2 border rounded"
                          placeholder="Ex: Tesoureiro"
                        />
                      </div>
                      <div className="md:col-span-2 flex items-end">
                        <button
                          type="button"
                          onClick={() => {
                            const ano = document.getElementById('cargo-ano').value;
                            const cargo = document.getElementById('cargo-nome').value;
                            if (!ano || !cargo) {
                              alert('Preencha ano e cargo!');
                              return;
                            }
                            setHistoricoCargos([...historicoCargos, { ano, cargo }]);
                            document.getElementById('cargo-ano').value = new Date().getFullYear();
                            document.getElementById('cargo-nome').value = '';
                          }}
                          className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          ➕ Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {historicoCargos.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ano</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cargo</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {historicoCargos.map((cargo, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                              {cargo.ano}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-900">
                              {cargo.cargo}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-sm">
                      Nenhum cargo registrado no histórico.
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
              {familiares.conjuge && (
                <div className="bg-gradient-to-r from-pink-50 to-purple-50 p-6 rounded-lg border-2 border-pink-200">
                  <h4 className="text-lg font-bold text-pink-900 mb-4 flex items-center gap-2">
                    💑 Cônjuge
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-gray-700">Nome:</span>
                      <span className="ml-2 text-gray-900">{familiares.conjuge.nome}</span>
                    </div>
                    {familiares.conjuge.data_nascimento && (
                      <div>
                        <span className="font-semibold text-gray-700">Data de Nascimento:</span>
                        <span className="ml-2 text-gray-900">
                          {familiares.conjuge.data_nascimento.split('-').reverse().join('/')}
                        </span>
                      </div>
                    )}
                    {familiares.conjuge.data_casamento && (
                      <div>
                        <span className="font-semibold text-gray-700">💑 Data de Casamento:</span>
                        <span className="ml-2 text-gray-900">
                          {familiares.conjuge.data_casamento.split('-').reverse().join('/')}
                        </span>
                      </div>
                    )}
                    {familiares.conjuge.cpf && (
                      <div>
                        <span className="font-semibold text-gray-700">CPF:</span>
                        <span className="ml-2 text-gray-900">{familiares.conjuge.cpf}</span>
                      </div>
                    )}
                    {familiares.conjuge.profissao && (
                      <div>
                        <span className="font-semibold text-gray-700">Profissão:</span>
                        <span className="ml-2 text-gray-900">{familiares.conjuge.profissao}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pais */}
              {(familiares.pais.pai || familiares.pais.mae) && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border-2 border-blue-200">
                  <h4 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                    👨‍👩‍👦 Pais
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pai */}
                    <div className="space-y-2">
                      <h5 className="font-semibold text-gray-700 border-b pb-1">Pai</h5>
                      {familiares.pais.pai ? (
                        <>
                          <div className="text-sm">
                            <span className="font-medium">Nome:</span>
                            <span className="ml-2">{familiares.pais.pai.nome}</span>
                          </div>
                          {familiares.pais.pai.data_nascimento && (
                            <div className="text-sm">
                              <span className="font-medium">Nascimento:</span>
                              <span className="ml-2">
                                {familiares.pais.pai.data_nascimento.split('-').reverse().join('/')}
                              </span>
                            </div>
                          )}
                          <div className="text-sm">
                            <span className={familiares.pais.pai.falecido ? 'text-gray-500' : 'text-green-600'}>
                              {familiares.pais.pai.falecido ? '⚰️ Falecido' : '✅ Vivo'}
                            </span>
                            {familiares.pais.pai.falecido && familiares.pais.pai.data_obito && (
                              <span className="ml-2 text-gray-600">
                                ({familiares.pais.pai.data_obito.split('-').reverse().join('/')})
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">Não informado</p>
                      )}
                    </div>

                    {/* Mãe */}
                    <div className="space-y-2">
                      <h5 className="font-semibold text-gray-700 border-b pb-1">Mãe</h5>
                      {familiares.pais.mae ? (
                        <>
                          <div className="text-sm">
                            <span className="font-medium">Nome:</span>
                            <span className="ml-2">{familiares.pais.mae.nome}</span>
                          </div>
                          {familiares.pais.mae.data_nascimento && (
                            <div className="text-sm">
                              <span className="font-medium">Nascimento:</span>
                              <span className="ml-2">
                                {familiares.pais.mae.data_nascimento.split('-').reverse().join('/')}
                              </span>
                            </div>
                          )}
                          <div className="text-sm">
                            <span className={familiares.pais.mae.falecido ? 'text-gray-500' : 'text-green-600'}>
                              {familiares.pais.mae.falecido ? '⚰️ Falecida' : '✅ Viva'}
                            </span>
                            {familiares.pais.mae.falecido && familiares.pais.mae.data_obito && (
                              <span className="ml-2 text-gray-600">
                                ({familiares.pais.mae.data_obito.split('-').reverse().join('/')})
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">Não informado</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Filhos */}
              {familiares.filhos.length > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-teal-50 p-6 rounded-lg border-2 border-green-200">
                  <h4 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
                    👶 Filhos ({familiares.filhos.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {familiares.filhos.map((filho, index) => {
                      const sexo = filho.sexo || (filho.tipo === 'Filho' ? 'M' : 'F');
                      return (
                        <div key={index} className="bg-white rounded-lg p-4 border border-green-200">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-3xl">{sexo === 'M' ? '👦' : '👧'}</span>
                            <div>
                              <h5 className="font-semibold text-gray-900">{filho.nome}</h5>
                              <p className="text-xs text-gray-600">
                                {sexo === 'M' ? 'Masculino' : 'Feminino'}
                              </p>
                            </div>
                          </div>
                          {filho.data_nascimento && (
                            <div className="text-sm text-gray-700">
                              <span className="font-medium">Nascimento:</span>
                              <span className="ml-2">
                                {filho.data_nascimento.split('-').reverse().join('/')}
                              </span>
                              <span className="ml-2 text-gray-500">
                                ({calcularIdade(filho.data_nascimento)})
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mensagem se não tiver familiares */}
              {!familiares.conjuge && !familiares.pais.pai && !familiares.pais.mae && familiares.filhos.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-6xl mb-4">👨‍👩‍👧‍👦</div>
                  <p className="text-gray-600 text-lg font-medium">Nenhum familiar cadastrado</p>
                </div>
              )}
            </div>
          )}

          {/* ABA: Vida Maçônica */}
          {abaSelecionada === 'vida-maconica' && (
            <VidaMaconica
              irmaoId={irmaoId}
              showSuccess={showSuccess}
              showError={showError}
            />
          )}
        </div>
      </div>

      {/* Botões de Ação */}
      {abaSelecionada !== 'vida-maconica' && (
        <div className="flex gap-4 justify-end bg-white p-4 rounded-lg shadow">
          {modoEdicao ? (
            <>
              <button
                onClick={() => {
                  setModoEdicao(false);
                  setIrmaoForm(irmao);
                }}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                ❌ Cancelar
              </button>
              <button
                onClick={handleSalvar}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                💾 Salvar Alterações
              </button>
            </>
          ) : (
            <>
              {/* Só pode editar se: é o próprio perfil OU tem permissão */}
              {(irmao?.email === userEmail || permissoes?.canEditMembers || permissoes?.canEdit) && (
                <button
                  onClick={() => setModoEdicao(true)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  ✏️ Editar
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
