import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function GestaoBeneficiarios({ showSuccess, showError, permissoes }) {
  const [beneficiarios, setBeneficiarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalResponsavel, setModalResponsavel] = useState(false);
  const [editando, setEditando] = useState(null);
  const [editandoResponsavel, setEditandoResponsavel] = useState(null);
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
      
      const { data: benData, error: benError } = await supabase
        .from('beneficiarios')
        .select('*')
        .order('nome');

      if (benError) throw benError;

      const { data: respData } = await supabase
        .from('responsaveis')
        .select('*');

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
        const { error } = await supabase
          .from('responsaveis')
          .update(formResponsavel)
          .eq('id', editandoResponsavel.id);

        if (error) throw error;
        showSuccess('Responsável atualizado!');
      } else {
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--color-accent)' }}></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            👥 Beneficiários
          </h2>
          {permissoes?.pode_editar_comodatos && (
            <button
              onClick={() => abrirModal()}
              style={{
                background: 'var(--color-accent)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.625rem 1.25rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ➕ Novo Beneficiário
            </button>
          )}
        </div>

        <input
          type="text"
          placeholder="🔍 Buscar por nome ou CPF..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="form-input"
        />
      </div>

      {/* LISTA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {beneficiariosFiltrados.map(beneficiario => (
          <div key={beneficiario.id} className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                  {beneficiario.nome}
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-accent)' }}>
                  CPF: {beneficiario.cpf}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              {beneficiario.data_nascimento && (
                <div>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Nascimento:</span>
                  <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                    {new Date(beneficiario.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
              {beneficiario.celular && (
                <div>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Celular:</span>
                  <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{beneficiario.celular}</p>
                </div>
              )}
              {beneficiario.cidade && (
                <div>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Cidade:</span>
                  <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                    {beneficiario.cidade}/{beneficiario.estado}
                  </p>
                </div>
              )}
            </div>

            {/* Responsáveis */}
            {beneficiario.responsaveis && beneficiario.responsaveis.length > 0 && (
              <div className="rounded p-3 mb-3" style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                  👤 Responsáveis:
                </p>
                {beneficiario.responsaveis.map((resp, idx) => (
                  <div key={idx} className="rounded p-2 mb-2 flex justify-between items-center" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{resp.nome}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{resp.parentesco} • {resp.telefone || resp.celular}</p>
                    </div>
                    {permissoes?.pode_editar_comodatos && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => abrirModalResponsavel(beneficiario, resp)}
                          title="Editar responsável"
                          style={{
                            background: 'var(--color-accent)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.25rem',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => excluirResponsavel(resp.id)}
                          title="Excluir responsável"
                          style={{
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.25rem',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Botões de ação */}
            {permissoes?.pode_editar_comodatos && (
              <div className="flex gap-2">
                <button
                  onClick={() => abrirModal(beneficiario)}
                  style={{
                    flex: 1,
                    background: 'var(--color-accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={() => abrirModalResponsavel(beneficiario)}
                  style={{
                    background: 'var(--color-surface-3)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  👤
                </button>
                <button
                  onClick={() => excluir(beneficiario.id)}
                  style={{
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  ❌
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {beneficiariosFiltrados.length === 0 && (
        <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
          <p className="text-xl">Nenhum beneficiário encontrado</p>
        </div>
      )}

      {/* MODAL BENEFICIÁRIO — já tematizado, mantido intacto */}
      {modalAberto && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="card" style={{
            maxWidth: '64rem',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            margin: 0
          }}>
            <div className="card-header">
              <h3 className="text-2xl font-bold">
                {editando ? '✏️ Editar Beneficiário' : '➕ Novo Beneficiário'}
              </h3>
            </div>

            <form onSubmit={salvarBeneficiario} style={{
              padding: '2rem',
              flex: 1,
              overflowY: 'auto'
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="form-label">Nome Completo *</label>
                  <input type="text" className="form-input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">CPF</label>
                  <input type="text" className="form-input" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">RG</label>
                  <input type="text" className="form-input" value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Data de Nascimento</label>
                  <input type="date" className="form-input" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Telefone</label>
                  <input type="text" className="form-input" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Celular</label>
                  <input type="text" className="form-input" value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">CEP</label>
                  <input type="text" className="form-input" value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Endereço</label>
                  <input type="text" className="form-input" value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Número</label>
                  <input type="text" className="form-input" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Complemento</label>
                  <input type="text" className="form-input" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Bairro</label>
                  <input type="text" className="form-input" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Cidade</label>
                  <input type="text" className="form-input" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Estado</label>
                  <input type="text" className="form-input" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} maxLength="2" />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Observações</label>
                  <textarea className="form-input" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows="3" />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  type="submit"
                  className="flex-1"
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--color-accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  💾 Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--color-surface-3)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
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
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="card" style={{
            maxWidth: '42rem',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            margin: 0
          }}>
            <div className="card-header">
              <h3 className="text-2xl font-bold">
                👤 {editandoResponsavel ? 'Editar Responsável' : 'Adicionar Responsável'}
              </h3>
              <p className="text-sm mt-1" style={{ opacity: 0.8 }}>
                Beneficiário: {beneficiarioSelecionado?.nome}
              </p>
            </div>

            <form onSubmit={salvarResponsavel} style={{
              padding: '1.5rem',
              flex: 1,
              overflowY: 'auto'
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="form-label">Nome Completo *</label>
                  <input
                    type="text"
                    value={formResponsavel.nome}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, nome: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">CPF</label>
                  <input
                    type="text"
                    value={formResponsavel.cpf}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, cpf: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Parentesco</label>
                  <input
                    type="text"
                    value={formResponsavel.parentesco}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, parentesco: e.target.value })}
                    className="form-input"
                    placeholder="Ex: Filho, Esposa, Mãe"
                  />
                </div>
                <div>
                  <label className="form-label">Telefone</label>
                  <input
                    type="text"
                    value={formResponsavel.telefone}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, telefone: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Celular</label>
                  <input
                    type="text"
                    value={formResponsavel.celular}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, celular: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">RG</label>
                  <input
                    type="text"
                    value={formResponsavel.rg}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, rg: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Endereço</label>
                  <input
                    type="text"
                    value={formResponsavel.endereco}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, endereco: e.target.value })}
                    className="form-input"
                    placeholder="Rua, número, complemento"
                  />
                </div>
                <div>
                  <label className="form-label">Cidade</label>
                  <input
                    type="text"
                    value={formResponsavel.cidade}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, cidade: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Estado</label>
                  <input
                    type="text"
                    value={formResponsavel.estado}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, estado: e.target.value })}
                    className="form-input"
                    maxLength="2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    value={formResponsavel.email}
                    onChange={(e) => setFormResponsavel({ ...formResponsavel, email: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)', marginTop: '1rem' }}>
                <button
                  type="submit"
                  className="flex-1"
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--color-accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  💾 Salvar Responsável
                </button>
                <button
                  type="button"
                  onClick={() => setModalResponsavel(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--color-surface-3)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.5rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
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
