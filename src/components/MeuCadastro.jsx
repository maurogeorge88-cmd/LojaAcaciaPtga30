/**
 * MEU CADASTRO
 * Permite irmão comum visualizar e editar apenas seu próprio cadastro
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function MeuCadastro({ userEmail, showSuccess, showError }) {
  const [meuCadastro, setMeuCadastro] = useState(null);
  const [altosGraus, setAltosGraus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  
  // Dados editáveis
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [cep, setCep] = useState('');
  
  // Dados da família (editáveis)
  const [estadoCivil, setEstadoCivil] = useState('');
  const [nomeConjuge, setNomeConjuge] = useState('');
  const [dataMatrimonio, setDataMatrimonio] = useState('');
  const [filhos, setFilhos] = useState('');

  useEffect(() => {
    carregarMeuCadastro();
  }, [userEmail]);

  const carregarMeuCadastro = async () => {
    try {
      const { data, error } = await supabase
        .from('irmaos')
        .select('*')
        .eq('email', userEmail)
        .single();

      if (error) throw error;

      if (data) {
        setMeuCadastro(data);
        
        // Buscar altos graus do irmão
        const { data: graus, error: grausError } = await supabase
          .from('irmaos_altos_graus')
          .select(`
            *,
            altos_graus (nome, sigla, numero)
          `)
          .eq('irmao_id', data.id)
          .order('data_recebimento', { ascending: false });

        if (!grausError && graus) {
          setAltosGraus(graus);
        }

        // Preencher campos editáveis
        setTelefone(data.telefone || '');
        setEndereco(data.endereco || '');
        setCidade(data.cidade || '');
        setEstado(data.estado || '');
        setCep(data.cep || '');
        setEstadoCivil(data.estado_civil || '');
        setNomeConjuge(data.nome_conjuge || '');
        setDataMatrimonio(data.data_matrimonio || '');
        setFilhos(data.filhos || '');
      }
    } catch (error) {
      console.error('Erro ao carregar cadastro:', error);
      showError('Erro ao carregar seu cadastro');
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    try {
      const { error } = await supabase
        .from('irmaos')
        .update({
          telefone,
          endereco,
          cidade,
          estado,
          cep,
          estado_civil: estadoCivil,
          nome_conjuge: nomeConjuge,
          data_matrimonio: dataMatrimonio || null,
          filhos
        })
        .eq('email', userEmail);

      if (error) throw error;

      showSuccess('✅ Cadastro atualizado com sucesso!');
      setEditando(false);
      carregarMeuCadastro();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showError('Erro ao salvar alterações');
    }
  };

  const calcularIdade = (dataNascimento) => {
    if (!dataNascimento) return '-';
    const nascimento = new Date(dataNascimento + 'T00:00:00');
    const hoje = new Date();
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return `${idade} anos`;
  };

  const calcularTempoMaconaria = (dataIniciacao) => {
    if (!dataIniciacao) return '-';
    const inicio = new Date(dataIniciacao + 'T00:00:00');
    const hoje = new Date();
    let anos = hoje.getFullYear() - inicio.getFullYear();
    let meses = hoje.getMonth() - inicio.getMonth();
    if (meses < 0) { anos--; meses = 12 + meses; }
    return `${anos} ano(s) e ${meses} mês(es)`;
  };

  const formatarData = (data) => {
    if (!data) return '-';
    const date = new Date(data + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  if (!meuCadastro) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <p className="text-yellow-800">
          Seu cadastro não foi encontrado. Entre em contato com o administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>👤 Meu Cadastro</h2>
        {!editando ? (
          <button
            onClick={() => setEditando(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            ✏️ Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSalvar}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              💾 Salvar
            </button>
            <button
              onClick={() => {
                setEditando(false);
                carregarMeuCadastro();
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg transition"
            >
              ❌ Cancelar
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}} style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        {/* Cabeçalho com foto */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-6 text-white">
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl" style={{background:"var(--color-surface-2)"}}>
              👤
            </div>
            <div>
              <h3 className="text-3xl font-bold" style={{color:"var(--color-text)"}}>{meuCadastro.nome}</h3>
              <p className="text-xl opacity-90">{meuCadastro.cim || 'N/A'}</p>
              <div className="flex gap-4 mt-2">
                <span className="px-3 py-1 /20 rounded-full text-sm">
                  {meuCadastro.grau || 'Grau não informado'}
                </span>
                <span className="px-3 py-1 /20 rounded-full text-sm">
                  {meuCadastro.situacao || 'Situação não informada'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dados pessoais - SOMENTE LEITURA */}
        <div className="p-6 border-b">
          <h4 className="text-lg font-semibold mb-4" style={{color:"var(--color-text)"}}>📋 Dados Pessoais (Somente Leitura)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>CPF</label>
              <p>{meuCadastro.cpf || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>RG</label>
              <p>{meuCadastro.rg || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data de Nascimento</label>
              <p>{formatarData(meuCadastro.data_nascimento)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Idade</label>
              <p>{calcularIdade(meuCadastro.data_nascimento)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Email</label>
              <p>{meuCadastro.email || '-'}</p>
            </div>
          </div>
        </div>

        {/* Dados de contato - EDITÁVEL */}
        <div className="p-6 border-b bg-blue-50">
          <h4 className="text-lg font-semibold mb-4" style={{color:"var(--color-text)"}}>📞 Contato e Endereço (Editável)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Telefone</label>
              {editando ? (
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  placeholder="(00) 00000-0000"
                />
              ) : (
                <p>{telefone || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>CEP</label>
              {editando ? (
                <input
                  type="text"
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  placeholder="00000-000"
                />
              ) : (
                <p>{cep || '-'}</p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Endereço</label>
              {editando ? (
                <input
                  type="text"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  placeholder="Rua, número, complemento"
                />
              ) : (
                <p>{endereco || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Cidade</label>
              {editando ? (
                <input
                  type="text"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                />
              ) : (
                <p>{cidade || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Estado</label>
              {editando ? (
                <input
                  type="text"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  placeholder="MT"
                  maxLength={2}
                />
              ) : (
                <p>{estado || '-'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Dados familiares - EDITÁVEL */}
        <div className="p-6 border-b bg-green-50">
          <h4 className="text-lg font-semibold mb-4" style={{color:"var(--color-text)"}}>👨‍👩‍👧‍👦 Dados Familiares (Editável)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Estado Civil</label>
              {editando ? (
                <select
                  value={estadoCivil}
                  onChange={(e) => setEstadoCivil(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                >
                  <option value="">Selecione</option>
                  <option value="solteiro">Solteiro</option>
                  <option value="casado">Casado</option>
                  <option value="divorciado">Divorciado</option>
                  <option value="viuvo">Viúvo</option>
                </select>
              ) : (
                <p className="capitalize">{estadoCivil || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Nome do Cônjuge</label>
              {editando ? (
                <input
                  type="text"
                  value={nomeConjuge}
                  onChange={(e) => setNomeConjuge(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                />
              ) : (
                <p>{nomeConjuge || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data de Matrimônio</label>
              {editando ? (
                <input
                  type="date"
                  value={dataMatrimonio}
                  onChange={(e) => setDataMatrimonio(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                />
              ) : (
                <p>{formatarData(dataMatrimonio)}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Filhos</label>
              {editando ? (
                <input
                  type="text"
                  value={filhos}
                  onChange={(e) => setFilhos(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  placeholder="Nomes e idades"
                />
              ) : (
                <p>{filhos || '-'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Dados maçônicos - SOMENTE LEITURA */}
        <div className="p-6">
          <h4 className="text-lg font-semibold mb-4" style={{color:"var(--color-text)"}}>🔷 Vida Maçônica (Somente Leitura)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data de Iniciação</label>
              <p>{formatarData(meuCadastro.data_iniciacao)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Tempo na Maçonaria</label>
              <p>{calcularTempoMaconaria(meuCadastro.data_iniciacao)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data de Elevação</label>
              <p>{formatarData(meuCadastro.data_elevacao)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data de Exaltação</label>
              <p>{formatarData(meuCadastro.data_exaltacao)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Loja de Origem</label>
              <p>{meuCadastro.loja_origem || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Oriente de Origem</label>
              <p>{meuCadastro.oriente_origem || '-'}</p>
            </div>
          </div>
        </div>

        {/* Altos Graus - SOMENTE LEITURA */}
        {altosGraus.length > 0 && (
          <div className="p-6 border-t bg-purple-50">
            <h4 className="text-lg font-semibold mb-4" style={{color:"var(--color-text)"}}>🔺 Altos Graus (Somente Leitura)</h4>
            <div className="space-y-3">
              {altosGraus.map((grau) => (
                <div key={grau.id} className="rounded-lg p-4 border-l-4 border-purple-500" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">
                        {grau.altos_graus?.nome || 'Grau não especificado'}
                      </p>
                      <p className="text-sm">
                        {grau.altos_graus?.sigla && `${grau.altos_graus.sigla} - `}
                        Grau {grau.altos_graus?.numero || grau.grau_numero}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">Recebido em</p>
                      <p className="font-semibold text-purple-700">
                        {formatarData(grau.data_recebimento)}
                      </p>
                    </div>
                  </div>
                  {grau.local && (
                    <p className="text-sm mt-2">
                      📍 {grau.local}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
