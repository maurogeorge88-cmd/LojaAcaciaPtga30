import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function GestaoBeneficiarios({ showSuccess, showError, permissoes }) {
  const [beneficiarios, setBeneficiarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalResponsavel, setModalResponsavel] = useState(false);
  const [editando, setEditando] = useState(null);
  const [editandoResponsavel, setEditandoResponsavel] = useState(null); // NOVO
  const [beneficiarioSelecionado, setBeneficiarioSelecionado] = useState(null);
  const [busca, setBusca] = useState('');

  const [form, setForm] = useState({
    nome: '',
    cpf: '',
    rg: '',
    data_nascimento: '',
    telefone: '',
    celular: '',
    email: '',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: 'MT',
    observacoes: ''
  });

  const [formResponsavel, setFormResponsavel] = useState({
    nome: '',
    cpf: '',
    rg: '',
    parentesco: '',
    telefone: '',
    celular: '',
    email: '',
    endereco: '',
    cidade: '',
    estado: 'MT'
  });

  useEffect(() => {
    carregarBeneficiarios();
  }, []);

  const carregarBeneficiarios = async () => {
    try {
      setLoading(true);
      
      // Carregar beneficiários
      const { data: benData, error: benError } = await supabase
        .from('beneficiarios')
        .select('*')
        .order('nome');

      if (benError) throw benError;

      // Carregar todos os responsáveis de uma vez
      const { data: respData } = await supabase
        .from('responsaveis')
        .select('*');

      // Mapear responsáveis para cada beneficiário
      const beneficiariosComResponsaveis = (benData || []).map(ben => ({
        ...ben,
        responsaveis: (respData || []).filter(resp => resp.beneficiario_id === ben.id)
      }));

      setBeneficiarios(beneficiariosComResponsaveis);
      setLoading(false);
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao carregar beneficiários');
      setLoading(false);
    }
  };

  const abrirModal = (beneficiario = null) => {
    if (beneficiario) {
      setEditando(beneficiario);
      // Extrair apenas os campos válidos da tabela beneficiarios
      setForm({
        nome: beneficiario.nome || '',
        cpf: beneficiario.cpf || '',
        rg: beneficiario.rg || '',
        data_nascimento: beneficiario.data_nascimento || '',
        telefone: beneficiario.telefone || '',
        celular: beneficiario.celular || '',
        email: beneficiario.email || '',
        cep: beneficiario.cep || '',
        endereco: beneficiario.endereco || '',
        numero: beneficiario.numero || '',
        complemento: beneficiario.complemento || '',
        bairro: beneficiario.bairro || '',
        cidade: beneficiario.cidade || '',
        estado: beneficiario.estado || 'MT',
        observacoes: beneficiario.observacoes || ''
      });
    } else {
      setEditando(null);
      setForm({
        nome: '',
        cpf: '',
        rg: '',
        data_nascimento: '',
        telefone: '',
        celular: '',
        email: '',
        cep: '',
        endereco: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: 'MT',
        observacoes: ''
      });
    }
    setModalAberto(true);
  };

  const salvarBeneficiario = async (e) => {
    e.preventDefault();

    if (!form.nome) {
      showError('Nome é obrigatório!');
      return;
    }

    try {
      if (editando) {
        const { error } = await supabase
          .from('beneficiarios')
          .update(form)
          .eq('id', editando.id);

        if (error) throw error;
        showSuccess('Beneficiário atualizado!');
      } else {
        const { error } = await supabase
          .from('beneficiarios')
          .insert([form]);

        if (error) throw error;
        showSuccess('Beneficiário cadastrado!');
      }

      setModalAberto(false);
      carregarBeneficiarios();
    } catch (error) {
      console.error('Erro:', error);
      showError(error.message || 'Erro ao salvar beneficiário');
    }
  };

  const abrirModalResponsavel = (beneficiario, responsavel = null) => {
    setBeneficiarioSelecionado(beneficiario);
    
    if (responsavel) {
      // Editando responsável existente
      setEditandoResponsavel(responsavel);
      setFormResponsavel({
        nome: responsavel.nome || '',
        cpf: responsavel.cpf || '',
        rg: responsavel.rg || '',
        parentesco: responsavel.parentesco || '',
        telefone: responsavel.telefone || '',
        celular: responsavel.celular || '',
        email: responsavel.email || '',
        endereco: responsavel.endereco || '',
        cidade: responsavel.cidade || '',
        estado: responsavel.estado || 'MT'
      });
    } else {
      // Novo responsável
      setEditandoResponsavel(null);
      setFormResponsavel({
        nome: '',
        cpf: '',
        rg: '',
        parentesco: '',
        telefone: '',
        celular: '',
        email: '',
        endereco: '',
        cidade: '',
        estado: 'MT'
      });
    }
    
    setModalResponsavel(true);
  };

  const salvarResponsavel = async (e) => {
    e.preventDefault();

    if (!formResponsavel.nome) {
      showError('Nome do responsável é obrigatório!');
      return;
    }

    try {
      if (editandoResponsavel) {
        // ATUALIZAR responsável existente
        const { error } = await supabase
          .from('responsaveis')
          .update(formResponsavel)
          .eq('id', editandoResponsavel.id);

        if (error) throw error;
        showSuccess('Responsável atualizado!');
      } else {
        // INSERIR novo responsável
        const { error } = await supabase
          .from('responsaveis')
          .insert([{
            beneficiario_id: beneficiarioSelecionado.id,
            ...formResponsavel
          }]);

        if (error) throw error;
        showSuccess('Responsável cadastrado!');
      }
      
      setModalResponsavel(false);
      setEditandoResponsavel(null);
      carregarBeneficiarios();
    } catch (error) {
      console.error('Erro:', error);
      showError(error.message || 'Erro ao salvar responsável');
    }
  };

  const excluirResponsavel = async (responsavelId) => {
    if (typeof window !== 'undefined' && !window.confirm('Tem certeza que deseja excluir este responsável?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('responsaveis')
        .delete()
        .eq('id', responsavelId);

      if (error) throw error;
      
      showSuccess('Responsável excluído com sucesso!');
      carregarBeneficiarios();
    } catch (error) {
      console.error('Erro:', error);
      showError(error.message || 'Erro ao excluir responsável');
    }
  };

  const excluir = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Tem certeza que deseja excluir este beneficiário?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('beneficiarios')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showSuccess('Beneficiário excluído!');
      carregarBeneficiarios();
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao excluir beneficiário');
    }
  };

  const beneficiariosFiltrados = beneficiarios.filter(b =>
    b.nome.toLowerCase().includes(busca.toLowerCase()) ||
    b.cpf.includes(busca)
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            👥 Beneficiários
          </h2>
          {permissoes?.pode_editar_comodatos && (
            <button
              onClick={() => abrirModal()}
              className="btn-primary"
            >
              ➕ Novo Beneficiário
            </button>
          )}
        </div>

        <input
          type="text" className="form-input"
          placeholder="🔍 Buscar por nome ou CPF..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {/* LISTA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {beneficiariosFiltrados.map(beneficiario => (
          <div
            key={beneficiario.id}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-xl)'}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {beneficiario.nome}
                </h3>
                <p className="text-teal-600 text-sm">
                  CPF: {beneficiario.cpf}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              {beneficiario.data_nascimento && (
                <div>
                  <span className="text-gray-500">Nascimento:</span>
                  <p className="font-semibold">
                    {new Date(beneficiario.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
              {beneficiario.celular && (
                <div>
                  <span className="text-gray-500">Celular:</span>
                  <p className="font-semibold">{beneficiario.celular}</p>
                </div>
              )}
              {beneficiario.cidade && (
                <div>
                  <span className="text-gray-500">Cidade:</span>
                  <p className="font-semibold">
                    {beneficiario.cidade}/{beneficiario.estado}
                  </p>
                </div>
              )}
            </div>

            {beneficiario.responsaveis && beneficiario.responsaveis.length > 0 && (
              <div className="bg-blue-50 rounded p-3 mb-3">
                <p className="text-sm font-semibold text-blue-900 mb-2">
                  👤 Responsáveis:
                </p>
                {beneficiario.responsaveis.map((resp, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white rounded p-2 mb-2">
                    <div>
                      <p className="text-sm text-blue-800 font-medium">{resp.nome}</p>
                      <p className="text-xs text-blue-600">{resp.parentesco} • {resp.telefone || resp.celular}</p>
                    </div>
                    {permissoes?.pode_editar_comodatos && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => abrirModalResponsavel(beneficiario, resp)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                          title="Editar responsável"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => excluirResponsavel(resp.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                          title="Excluir responsável"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {permissoes?.pode_editar_comodatos && (
              <div className="flex gap-2">
                <button
                  onClick={() => abrirModal(beneficiario)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={() => abrirModalResponsavel(beneficiario)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  👤 Responsável
                </button>
                <button
                  onClick={() => excluir(beneficiario.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  ❌
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {beneficiariosFiltrados.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-xl">Nenhum beneficiário encontrado</p>
        </div>
      )}

      {/* MODAL BENEFICIÁRIO */}
      {modalAberto && (
            {/* Header */}
            <div className="card-header">
              <h3 className="text-2xl font-bold">
                {editando ? '✏️ Editar Beneficiário' : '➕ Novo Beneficiário'}
              </h3>
            </div>

            {/* Formulário com scroll */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="form-label">
                    Nome Completo *
                  </label>
                  <input
                    type="text" className="form-input"
                    className="form-input"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">
                    CPF
                  </label>
                  <input
                    type="text" className="form-input"
                    className="form-input"
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">
                    RG
                  </label>
                  <input
                    type="text" className="form-input"
                    className="form-input"
                    value={form.rg}
                    onChange={(e) => setForm({ ...form, rg: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">
                    Data de Nascimento
                  </label>
                  <input
                    type="date" className="form-input"
                    className="form-input"
                    value={form.data_nascimento}
                    onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">
                    Telefone
                  </label>
                  <input
                    type="text" className="form-input"
                    className="form-input"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">
                    Celular
                  </label>
                  <input
                    type="text" className="form-input"
                    className="form-input"
                    value={form.celular}
                    onChange={(e) => setForm({ ...form, celular: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="form-label">
                    Email
                  </label>
                  <input
                    type="email" className="form-input"
                    className="form-input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">
                    CEP
                  </label>
                  <input
                    type="text" className="form-input"
                    value={form.cep}
                    onChange={(e) => setForm({ ...form, cep: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">
                    Endereço
                  </label>
                  <input
                    type="text" className="form-input"
                    value={form.endereco}
                    onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">
                    Número
                  </label>
                  <input
                    type="text" className="form-input"
                    value={form.numero}
                    onChange={(e) => setForm({ ...form, numero: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">
                    Complemento
                  </label>
                  <input
                    type="text" className="form-input"
                    value={form.complemento}
                    onChange={(e) => setForm({ ...form, complemento: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">
                    Bairro
                  </label>
                  <input
                    type="text" className="form-input"
                    value={form.bairro}
                    onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">
                    Cidade
                  </label>
                  <input
                    type="text" className="form-input"
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">
                    Estado
                  </label>
                  <input
                    type="text" className="form-input"
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value })}
                    maxLength="2"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="form-label">
                    Observações
                  </label>
                  <textarea
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                    rows="3"
                  />
                </div>
              </div>

              <div style={{ 
                borderTop: '1px solid var(--border-color)', 
                marginTop: '1.5rem', 
                paddingTop: '1.5rem',
                display: 'flex',
                gap: '0.75rem'
              }}>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1 }}
                >
                  💾 Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="btn-secondary"
                >
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RESPONSÁVEL */}
      {modalResponsavel && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="bg-green-600 text-white p-6 rounded-t-xl">
              <h3 className="text-2xl font-bold">
                👤 {editandoResponsavel ? 'Editar Responsável' : 'Adicionar Responsável'}
              </h3>
              <p className="text-green-100 text-sm mt-1">
                Beneficiário: {beneficiarioSelecionado?.nome}
              </p>
            </div>

            <form onSubmit={salvarResponsavel} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome Completo *
                  </label>
                  <input
                    type="text" className="form-input"
                    value={formResponsavel.nome}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, nome: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    CPF
                  </label>
                  <input
                    type="text" className="form-input"
                    value={formResponsavel.cpf}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, cpf: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Parentesco
                  </label>
                  <input
                    type="text" className="form-input"
                    value={formResponsavel.parentesco}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, parentesco: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="Ex: Filho, Esposa, Mãe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Telefone
                  </label>
                  <input
                    type="text" className="form-input"
                    value={formResponsavel.telefone}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, telefone: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Celular
                  </label>
                  <input
                    type="text" className="form-input"
                    value={formResponsavel.celular}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, celular: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    RG
                  </label>
                  <input
                    type="text" className="form-input"
                    value={formResponsavel.rg}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, rg: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Endereço
                  </label>
                  <input
                    type="text" className="form-input"
                    value={formResponsavel.endereco}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, endereco: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="Rua, número, complemento"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cidade
                  </label>
                  <input
                    type="text" className="form-input"
                    value={formResponsavel.cidade}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, cidade: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estado
                  </label>
                  <input
                    type="text" className="form-input"
                    value={formResponsavel.estado}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, estado: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    maxLength="2"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email" className="form-input"
                    value={formResponsavel.email}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, email: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold"
                >
                  💾 Salvar Responsável
                </button>
                <button
                  type="button"
                  onClick={() => setModalResponsavel(false)}
                  className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-semibold"
                >
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
