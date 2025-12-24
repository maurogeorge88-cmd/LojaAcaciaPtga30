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
  const [filhoEditandoIndex, setFilhoEditandoIndex] = useState(null);

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
      // Salvar dados básicos do irmão
      const { error: erroIrmao } = await supabase
        .from('irmaos')
        .update(irmaoForm)
        .eq('id', irmaoId);

      if (erroIrmao) throw erroIrmao;

      // Salvar cônjuge
      if (familiares.conjuge?.nome) {
        const { data: conjExiste } = await supabase.from('esposas').select('id').eq('irmao_id', irmaoId).single();
        if (conjExiste) {
          await supabase.from('esposas').update({
            nome: familiares.conjuge.nome,
            data_nascimento: familiares.conjuge.data_nascimento,
            data_casamento: familiares.conjuge.data_casamento,
            profissao: familiares.conjuge.profissao
          }).eq('irmao_id', irmaoId);
        } else {
          await supabase.from('esposas').insert({
            irmao_id: irmaoId, nome: familiares.conjuge.nome,
            data_nascimento: familiares.conjuge.data_nascimento,
            data_casamento: familiares.conjuge.data_casamento,
            profissao: familiares.conjuge.profissao
          });
        }
      }

      // Salvar pais (um registro por pai/mãe)
      if (familiares.pais.pai?.nome) {
        const { data: paiExiste } = await supabase.from('pais').select('id').eq('irmao_id', irmaoId).eq('tipo', 'pai').single();
        if (paiExiste) {
          await supabase.from('pais').update({
            nome: familiares.pais.pai.nome,
            data_nascimento: familiares.pais.pai.data_nascimento
          }).eq('id', paiExiste.id);
        } else {
          await supabase.from('pais').insert({
            irmao_id: irmaoId,
            tipo: 'pai',
            nome: familiares.pais.pai.nome,
            data_nascimento: familiares.pais.pai.data_nascimento
          });
        }
      }
      
      if (familiares.pais.mae?.nome) {
        const { data: maeExiste } = await supabase.from('pais').select('id').eq('irmao_id', irmaoId).eq('tipo', 'mae').single();
        if (maeExiste) {
          await supabase.from('pais').update({
            nome: familiares.pais.mae.nome,
            data_nascimento: familiares.pais.mae.data_nascimento
          }).eq('id', maeExiste.id);
        } else {
          await supabase.from('pais').insert({
            irmao_id: irmaoId,
            tipo: 'mae',
            nome: familiares.pais.mae.nome,
            data_nascimento: familiares.pais.mae.data_nascimento
          });
        }
      }

      // Salvar cargos
      await supabase.from('historico_cargos').delete().eq('irmao_id', irmaoId);
      if (historicoCargos.length > 0) {
        await supabase.from('historico_cargos').insert(
          historicoCargos.map(c => ({ irmao_id: irmaoId, ano: c.ano, cargo: c.cargo }))
        );
      }

      // Salvar filhos
      await supabase.from('filhos').delete().eq('irmao_id', irmaoId);
      if (familiares.filhos.length > 0) {
        await supabase.from('filhos').insert(
          familiares.filhos.map(f => ({
            irmao_id: irmaoId,
            nome: f.nome,
            data_nascimento: f.data_nascimento,
            sexo: f.sexo,
            tipo_vinculo: f.tipo_vinculo || 'filho'
          }))
        );
      }

      showSuccess('✅ Perfil atualizado!');
      setModoEdicao(false);
      carregarIrmao();
      carregarFamiliares();
      carregarHistoricoCargos();
    } catch (error) {
      console.error('Erro:', error);
      showError('❌ Erro: ' + error.message);
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
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 p-6 rounded-lg border-2 border-pink-200">
                <h4 className="text-lg font-bold text-pink-900 mb-4 flex items-center gap-2">
                  💑 Cônjuge
                </h4>
                {modoEdicao ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Nome</label>
                      <input
                        type="text"
                        value={familiares.conjuge?.nome || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          conjuge: { ...familiares.conjuge, nome: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Data Nascimento</label>
                      <input
                        type="date"
                        value={familiares.conjuge?.data_nascimento || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          conjuge: { ...familiares.conjuge, data_nascimento: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Data Casamento</label>
                      <input
                        type="date"
                        value={familiares.conjuge?.data_casamento || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          conjuge: { ...familiares.conjuge, data_casamento: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Profissão</label>
                      <input
                        type="text"
                        value={familiares.conjuge?.profissao || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          conjuge: { ...familiares.conjuge, profissao: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                  </div>
                ) : (
                  familiares.conjuge && (
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
                      {familiares.conjuge.profissao && (
                        <div>
                          <span className="font-semibold text-gray-700">Profissão:</span>
                          <span className="ml-2 text-gray-900">{familiares.conjuge.profissao}</span>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Pais */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border-2 border-blue-200">
                <h4 className="text-lg font-bold text-blue-900 mb-4">👨‍👩‍👦 Pais</h4>
                {modoEdicao ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h5 className="font-semibold border-b pb-1">Pai</h5>
                      <input
                        type="text"
                        placeholder="Nome do Pai"
                        value={familiares.pais.pai?.nome || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          pais: { ...familiares.pais, pai: { ...familiares.pais.pai, nome: e.target.value }}
                        })}
                        className="w-full px-3 py-2 border rounded"
                      />
                      <input
                        type="date"
                        placeholder="Data Nascimento"
                        value={familiares.pais.pai?.data_nascimento || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          pais: { ...familiares.pais, pai: { ...familiares.pais.pai, data_nascimento: e.target.value }}
                        })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                    <div className="space-y-3">
                      <h5 className="font-semibold border-b pb-1">Mãe</h5>
                      <input
                        type="text"
                        placeholder="Nome da Mãe"
                        value={familiares.pais.mae?.nome || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          pais: { ...familiares.pais, mae: { ...familiares.pais.mae, nome: e.target.value }}
                        })}
                        className="w-full px-3 py-2 border rounded"
                      />
                      <input
                        type="date"
                        placeholder="Data Nascimento"
                        value={familiares.pais.mae?.data_nascimento || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          pais: { ...familiares.pais, mae: { ...familiares.pais.mae, data_nascimento: e.target.value }}
                        })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                  </div>
                ) : (
                  (familiares.pais.pai || familiares.pais.mae) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Visualização Pai */}
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
                          </>
                        ) : (
                          <p className="text-sm text-gray-500">Não informado</p>
                        )}
                      </div>
                      {/* Visualização Mãe */}
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
                          </>
                        ) : (
                          <p className="text-sm text-gray-500">Não informado</p>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Filhos */}
              {(familiares.filhos.length > 0 || modoEdicao) && (
                <div className="bg-gradient-to-r from-green-50 to-teal-50 p-6 rounded-lg border-2 border-green-200">
                  <h4 className="text-lg font-bold text-green-900 mb-4">👶 Filhos ({familiares.filhos.length})</h4>
                  
                  {modoEdicao && (
                    <div className="bg-green-100 p-4 rounded mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <div className="md:col-span-2">
                          <input 
                            type="text" 
                            id="filho-nome" 
                            placeholder="Nome" 
                            className="w-full px-3 py-2 border rounded" 
                          />
                        </div>
                        <div>
                          <input type="date" id="filho-data" className="w-full px-3 py-2 border rounded" />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <select id="filho-sexo" className="px-3 py-2 border rounded">
                          <option value="M">Masculino</option>
                          <option value="F">Feminino</option>
                        </select>
                        <select id="filho-tipo" className="px-3 py-2 border rounded">
                          <option value="filho">Filho</option>
                          <option value="filha">Filha</option>
                          <option value="enteado">Enteado</option>
                          <option value="enteada">Enteada</option>
                          <option value="neto">Neto</option>
                          <option value="neta">Neta</option>
                          <option value="bisneto">Bisneto</option>
                          <option value="bisneta">Bisneta</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const nome = document.getElementById('filho-nome').value;
                            const data = document.getElementById('filho-data').value;
                            const sexo = document.getElementById('filho-sexo').value;
                            const tipo = document.getElementById('filho-tipo').value;
                            if (!nome) { alert('Digite o nome!'); return; }
                            
                            if (filhoEditandoIndex !== null) {
                              // Editar
                              const novosFilhos = [...familiares.filhos];
                              novosFilhos[filhoEditandoIndex] = { nome, data_nascimento: data, sexo, tipo_vinculo: tipo };
                              setFamiliares({ ...familiares, filhos: novosFilhos });
                              setFilhoEditandoIndex(null);
                            } else {
                              // Adicionar
                              setFamiliares({
                                ...familiares,
                                filhos: [...familiares.filhos, { nome, data_nascimento: data, sexo, tipo_vinculo: tipo }]
                              });
                            }
                            document.getElementById('filho-nome').value = '';
                            document.getElementById('filho-data').value = '';
                            document.getElementById('filho-sexo').value = 'M';
                            document.getElementById('filho-tipo').value = 'filho';
                          }}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          {filhoEditandoIndex !== null ? '💾 Salvar' : '➕ Adicionar'}
                        </button>
                        {filhoEditandoIndex !== null && (
                          <button
                            type="button"
                            onClick={() => {
                              setFilhoEditandoIndex(null);
                              document.getElementById('filho-nome').value = '';
                              document.getElementById('filho-data').value = '';
                              document.getElementById('filho-sexo').value = 'M';
                              document.getElementById('filho-tipo').value = 'filho';
                            }}
                            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                          >
                            ✕ Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {familiares.filhos.map((filho, index) => {
                      const sexo = filho.sexo || (filho.tipo === 'Filho' ? 'M' : 'F');
                      return (
                        <div key={index} className="bg-white rounded-lg p-4 border border-green-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-3xl">{sexo === 'M' ? '👦' : '👧'}</span>
                              <div>
                                <h5 className="font-semibold text-gray-900">{filho.nome}</h5>
                                <p className="text-xs text-gray-600">
                                  {sexo === 'M' ? 'Masculino' : 'Feminino'}
                                  {filho.tipo_vinculo && (
                                    <span className="ml-1 capitalize">({filho.tipo_vinculo})</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {modoEdicao && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    document.getElementById('filho-nome').value = filho.nome;
                                    document.getElementById('filho-data').value = filho.data_nascimento || '';
                                    document.getElementById('filho-sexo').value = filho.sexo;
                                    document.getElementById('filho-tipo').value = filho.tipo_vinculo || 'filho';
                                    setFilhoEditandoIndex(index);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => {
                                    const novosFilhos = familiares.filhos.filter((_, i) => i !== index);
                                    setFamiliares({ ...familiares, filhos: novosFilhos });
                                    if (filhoEditandoIndex === index) setFilhoEditandoIndex(null);
                                  }}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>
                          {filho.data_nascimento && (
                            <div className="text-sm text-gray-700">
                              <span className="font-medium">Nascimento:</span>
                              <span className="ml-2">{filho.data_nascimento.split('-').reverse().join('/')}</span>
                              <span className="ml-2 text-gray-500">({calcularIdade(filho.data_nascimento)})</span>
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
