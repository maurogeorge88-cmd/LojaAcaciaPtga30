import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const VAZIO = {
  irmao_vinculado_id: null,
  nome: '', cpf: '', rg: '', data_nascimento: '', email: '', telefone: '',
  cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  cargo: '', situacao: 'regular', data_exaltacao: '', observacoes: '', ativo: true, foto_url: '',
};

const inputStyle = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' };
const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.03em' };

const situacaoCor = (s) => ({
  regular:    { bg: 'rgba(16,185,129,0.15)', cor: '#10b981' },
  licenciado: { bg: 'rgba(201,168,76,0.15)', cor: '#c9a84c' },
  desligado:  { bg: 'rgba(100,116,139,0.15)', cor: '#64748b' },
  excluido:   { bg: 'rgba(239,68,68,0.15)', cor: '#ef4444' },
  falecido:   { bg: 'rgba(139,92,246,0.15)', cor: '#8b5cf6' },
}[s] || { bg: 'rgba(100,116,139,0.15)', cor: '#64748b' });

export default function CadastroArcoRealMembros({ showSuccess, showError }) {
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(VAZIO);

  const [modalImportar, setModalImportar] = useState(false);
  const [irmaosDisponiveis, setIrmaosDisponiveis] = useState([]);
  const [buscaIrmao, setBuscaIrmao] = useState('');

  const [confirmExcluir, setConfirmExcluir] = useState(null);

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('arco_real_membros')
        .select('*, irmaos:irmao_vinculado_id(nome)')
        .order('nome');
      if (error) throw error;
      setMembros(data || []);
    } catch (e) {
      showError('Erro ao carregar membros: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const carregarIrmaosDisponiveis = async () => {
    try {
      // Já vinculados não aparecem de novo na lista de importação
      const idsJaVinculados = membros.filter(m => m.irmao_vinculado_id).map(m => m.irmao_vinculado_id);
      let q = supabase
        .from('irmaos')
        .select('id, nome, cpf, rg, data_nascimento, email, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, foto_url')
        .order('nome');
      if (idsJaVinculados.length > 0) {
        q = q.not('id', 'in', `(${idsJaVinculados.join(',')})`);
      }
      const { data, error } = await q;
      if (error) throw error;
      setIrmaosDisponiveis(data || []);
    } catch (e) {
      showError('Erro ao carregar irmãos: ' + e.message);
    }
  };

  const abrirNovo = () => {
    setEditandoId(null);
    setForm(VAZIO);
    setModalAberto(true);
  };

  const abrirEditar = (m) => {
    setEditandoId(m.id);
    setForm({
      irmao_vinculado_id: m.irmao_vinculado_id || null,
      nome: m.nome || '', cpf: m.cpf || '', rg: m.rg || '',
      data_nascimento: m.data_nascimento || '', email: m.email || '', telefone: m.telefone || '',
      cep: m.cep || '', endereco: m.endereco || '', numero: m.numero || '', complemento: m.complemento || '',
      bairro: m.bairro || '', cidade: m.cidade || '', estado: m.estado || '',
      cargo: m.cargo || '', situacao: m.situacao || 'regular',
      data_exaltacao: m.data_exaltacao || '', observacoes: m.observacoes || '', ativo: m.ativo,
      foto_url: m.foto_url || '',
    });
    setModalAberto(true);
  };

  const abrirImportar = () => {
    carregarIrmaosDisponiveis();
    setBuscaIrmao('');
    setModalImportar(true);
  };

  const importarIrmao = (irmao) => {
    setForm({
      ...VAZIO,
      irmao_vinculado_id: irmao.id,
      nome: irmao.nome || '', cpf: irmao.cpf || '', rg: irmao.rg || '',
      data_nascimento: irmao.data_nascimento || '', email: irmao.email || '', telefone: irmao.telefone || '',
      cep: irmao.cep || '', endereco: irmao.endereco || '', numero: irmao.numero || '',
      complemento: irmao.complemento || '', bairro: irmao.bairro || '', cidade: irmao.cidade || '', estado: irmao.estado || '',
      foto_url: irmao.foto_url || '',
    });
    setModalImportar(false);
    setEditandoId(null);
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.nome.trim()) { showError('Nome é obrigatório.'); return; }
    try {
      const payload = {
        irmao_vinculado_id: form.irmao_vinculado_id || null,
        nome: form.nome.trim(), cpf: form.cpf || null, rg: form.rg || null,
        data_nascimento: form.data_nascimento || null, email: form.email || null, telefone: form.telefone || null,
        cep: form.cep || null, endereco: form.endereco || null, numero: form.numero || null,
        complemento: form.complemento || null, bairro: form.bairro || null, cidade: form.cidade || null, estado: form.estado || null,
        cargo: form.cargo || null, situacao: form.situacao, data_exaltacao: form.data_exaltacao || null,
        observacoes: form.observacoes || null, ativo: form.ativo, foto_url: form.foto_url || null,
      };

      if (editandoId) {
        const { data, error } = await supabase.from('arco_real_membros').update(payload).eq('id', editandoId).select();
        if (error) throw error;
        if (!data || data.length === 0) { showError('❌ Nada foi alterado — provável falta de permissão (RLS).'); return; }
        showSuccess('✅ Membro atualizado!');
      } else {
        const { error } = await supabase.from('arco_real_membros').insert([payload]);
        if (error) throw error;
        showSuccess('✅ Membro cadastrado!');
      }
      setModalAberto(false);
      carregar();
    } catch (e) {
      showError('Erro ao salvar: ' + e.message);
    }
  };

  const excluir = async (id) => {
    try {
      const { data, error } = await supabase.from('arco_real_membros').delete().eq('id', id).select();
      if (error) throw error;
      if (!data || data.length === 0) { showError('❌ Nada foi excluído — provável falta de permissão (RLS).'); return; }
      showSuccess('✅ Membro excluído.');
      setConfirmExcluir(null);
      carregar();
    } catch (e) {
      showError('Erro ao excluir: ' + e.message);
    }
  };

  const membrosFiltrados = membros.filter(m => {
    const passaBusca = !busca || m.nome.toLowerCase().includes(busca.toLowerCase()) || (m.cpf || '').includes(busca);
    const passaSituacao = !filtroSituacao || m.situacao === filtroSituacao;
    return passaBusca && passaSituacao;
  });

  const irmaosFiltradosBusca = irmaosDisponiveis.filter(i =>
    !buscaIrmao || i.nome.toLowerCase().includes(buscaIrmao.toLowerCase())
  );

  return (
    <div className="p-6" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-text)' }}>🔺 Cadastro de Membros — Arco Real</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{membros.length} membro(s) cadastrado(s)</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={abrirImportar} style={{ padding: '0.55rem 1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}>
            📥 Importar Irmão Existente
          </button>
          <button onClick={abrirNovo} style={{ padding: '0.55rem 1rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
            ➕ Novo Membro
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="🔎 Buscar por nome ou CPF..."
          style={{ ...inputStyle, maxWidth: '320px' }}
        />
        <select value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)} style={{ ...inputStyle, maxWidth: '200px' }}>
          <option value="">Todas as situações</option>
          <option value="regular">Regular</option>
          <option value="licenciado">Licenciado</option>
          <option value="desligado">Desligado</option>
          <option value="excluido">Excluído</option>
          <option value="falecido">Falecido</option>
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem' }}>Carregando...</p>
      ) : membrosFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔺</p>
          <p>Nenhum membro cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3" style={{ padding: '0.25rem' }}>
          {membrosFiltrados.map(m => {
            const cor = situacaoCor(m.situacao);
            const licenciado = m.situacao === 'licenciado';
            return (
              <div
                key={m.id}
                className="rounded-lg transition-opacity hover:opacity-95 overflow-hidden"
                style={licenciado
                  ? { borderTop: '2px solid #c9a84c', borderRight: '2px solid #c9a84c', borderBottom: '2px solid #c9a84c', borderLeft: '8px solid #c9a84c', background: 'var(--color-surface)', boxShadow: '0 0 0 1px rgba(201,168,76,0.35)' }
                  : { borderLeft: '4px solid #c9a84c', borderTop: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
              >
                {/* Foto + Origem */}
                <div className="relative" style={{ background: 'var(--color-surface-2)', overflow: 'hidden', height: '6.5rem' }}>
                  {m.foto_url ? (
                    <img src={m.foto_url} alt={m.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 35%', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: '#c9a84c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="text-3xl text-white">🔺</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: '0.35rem', right: '0.35rem', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: '800', background: m.irmao_vinculado_id ? 'rgba(37,99,235,0.9)' : 'rgba(100,116,139,0.9)' }}>
                    {m.irmao_vinculado_id ? 'LOJA' : 'EXTERNO'}
                  </div>
                </div>

                {/* Informações */}
                <div className="p-2.5">
                  <h3 className="font-bold text-sm truncate" style={{ color: '#c9a84c' }} title={m.nome}>
                    {m.nome}
                  </h3>

                  <p className="text-xs truncate mt-1" style={{ color: 'var(--color-text-muted)' }} title={m.cargo || ''}>
                    {m.cargo || 'Sem cargo definido'}
                  </p>

                  <div className="mt-2 flex gap-1.5 flex-wrap">
                    <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: '700', background: cor.bg, color: cor.cor }}>
                      {m.situacao}
                    </span>
                  </div>

                  <div className="mt-2.5 flex gap-1.5">
                    <button onClick={() => abrirEditar(m)} style={{ padding: '0.3rem 0.4rem', background: 'rgba(201,168,76,0.12)', color: '#c9a84c', border: '1px solid #c9a84c', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', cursor: 'pointer' }} title="Editar">✏️</button>
                    <button onClick={() => setConfirmExcluir(m.id)} style={{ padding: '0.3rem 0.4rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', cursor: 'pointer' }} title="Excluir">🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Importar irmão existente */}
      {modalImportar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setModalImportar(false)}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '520px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ fontWeight: '800', color: 'var(--color-text)' }}>📥 Importar Dados de um Irmão</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>Os dados pessoais são copiados uma vez — depois disso, o cadastro no Arco Real é independente.</p>
            </div>
            <div style={{ padding: '0.85rem 1.25rem' }}>
              <input
                autoFocus value={buscaIrmao} onChange={e => setBuscaIrmao(e.target.value)}
                placeholder="🔎 Buscar irmão pelo nome..." style={inputStyle}
              />
            </div>
            <div style={{ overflowY: 'auto', padding: '0 0.75rem 1rem' }}>
              {irmaosFiltradosBusca.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '1.5rem', fontSize: '0.85rem' }}>
                  Nenhum irmão disponível (ou todos já foram importados).
                </p>
              ) : irmaosFiltradosBusca.map(irmao => (
                <button
                  key={irmao.id} onClick={() => importarIrmao(irmao)}
                  style={{ width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', background: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--color-text)', fontSize: '0.88rem', fontWeight: '600' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {irmao.nome}
                </button>
              ))}
            </div>
            <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--color-border)', textAlign: 'right' }}>
              <button onClick={() => setModalImportar(false)} style={{ padding: '0.5rem 1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Criar/Editar membro */}
      {modalAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }} onClick={() => setModalAberto(false)}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontWeight: '800', color: 'var(--color-text)' }}>
                {editandoId ? '✏️ Editar Membro' : '➕ Novo Membro do Arco Real'}
                {form.irmao_vinculado_id && <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-accent)' }}>🏛️ Vinculado a irmão da Loja</span>}
              </h3>
              <button onClick={() => setModalAberto(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.3rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Identificação */}
              <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Identificação</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Nome Completo *</label>
                    <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>URL da Foto</label>
                    <input value={form.foto_url} onChange={e => setForm(f => ({ ...f, foto_url: e.target.value }))} placeholder="https://..." style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>CPF</label>
                    <input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>RG</label>
                    <input value={form.rg} onChange={e => setForm(f => ({ ...f, rg: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Data de Nascimento</label>
                    <input type="date" value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* Contato */}
              <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Contato</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Telefone</label>
                    <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Endereço</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div><label style={labelStyle}>CEP</label><input value={form.cep} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Logradouro</label><input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Número</label><input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 0.6fr', gap: '0.75rem' }}>
                  <div><label style={labelStyle}>Complemento</label><input value={form.complemento} onChange={e => setForm(f => ({ ...f, complemento: e.target.value }))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Bairro</label><input value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Cidade</label><input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>UF</label><input value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} maxLength={2} style={inputStyle} /></div>
                </div>
              </div>

              {/* Dados do Arco Real */}
              <div style={{ background: 'var(--color-surface-2)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: '700', color: '#c9a84c', textTransform: 'uppercase', marginBottom: '0.75rem' }}>🔺 Dados do Arco Real</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Cargo</label>
                    <input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Excelentíssimo..." style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Situação</label>
                    <select value={form.situacao} onChange={e => setForm(f => ({ ...f, situacao: e.target.value }))} style={inputStyle}>
                      <option value="regular">Regular</option>
                      <option value="licenciado">Licenciado</option>
                      <option value="desligado">Desligado</option>
                      <option value="excluido">Excluído</option>
                      <option value="falecido">Falecido</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Data de Exaltação</label>
                    <input type="date" value={form.data_exaltacao} onChange={e => setForm(f => ({ ...f, data_exaltacao: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Observações</label>
                    <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} style={inputStyle} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button onClick={() => setModalAberto(false)} style={{ padding: '0.55rem 1.1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
              <button onClick={salvar} style={{ padding: '0.55rem 1.1rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '700' }}>💾 Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão */}
      {confirmExcluir && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 210 }} onClick={() => setConfirmExcluir(null)}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', maxWidth: '360px' }} onClick={e => e.stopPropagation()}>
            <p style={{ color: 'var(--color-text)', fontWeight: '600', marginBottom: '1rem' }}>Excluir este membro do Arco Real? Essa ação não pode ser desfeita.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button onClick={() => setConfirmExcluir(null)} style={{ padding: '0.5rem 1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => excluir(confirmExcluir)} style={{ padding: '0.5rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '700' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
