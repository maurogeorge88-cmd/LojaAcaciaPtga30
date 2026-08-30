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
const boxCard = { background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' };
const boxTitle = { fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.85rem' };

const situacaoCor = (s) => ({
  regular:    { bg: 'rgba(16,185,129,0.15)', cor: '#10b981' },
  licenciado: { bg: 'rgba(74,222,128,0.15)', cor: '#4ade80' },
  desligado:  { bg: 'rgba(100,116,139,0.15)', cor: '#64748b' },
  excluido:   { bg: 'rgba(239,68,68,0.15)', cor: '#ef4444' },
  falecido:   { bg: 'rgba(139,92,246,0.15)', cor: '#8b5cf6' },
}[s] || { bg: 'rgba(100,116,139,0.15)', cor: '#64748b' });

const calcularIdade = (dataNasc) => {
  if (!dataNasc) return null;
  const hoje = new Date();
  const [ano, mes, dia] = dataNasc.split('-').map(Number);
  let idade = hoje.getFullYear() - ano;
  if (hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)) idade--;
  return `${idade} anos`;
};

const fmtData = (d) => d ? d.split('-').reverse().join('/') : '—';

export default function CadastroArcoRealMembros({ showSuccess, showError }) {
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');

  // 'lista' | 'form' | 'ver'
  const [pagina, setPagina] = useState('lista');
  const [membroAtual, setMembroAtual] = useState(null); // registro completo (modo ver/editar)
  const [form, setForm] = useState(VAZIO);
  const [abaVer, setAbaVer] = useState('pessoal'); // 'pessoal' | 'maconico'
  const [dadosMaconicos, setDadosMaconicos] = useState(null);
  const [carregandoMaconico, setCarregandoMaconico] = useState(false);

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
    setMembroAtual(null);
    setForm(VAZIO);
    setPagina('form');
  };

  const preencherFormComMembro = (m) => ({
    irmao_vinculado_id: m.irmao_vinculado_id || null,
    nome: m.nome || '', cpf: m.cpf || '', rg: m.rg || '',
    data_nascimento: m.data_nascimento || '', email: m.email || '', telefone: m.telefone || '',
    cep: m.cep || '', endereco: m.endereco || '', numero: m.numero || '', complemento: m.complemento || '',
    bairro: m.bairro || '', cidade: m.cidade || '', estado: m.estado || '',
    cargo: m.cargo || '', situacao: m.situacao || 'regular',
    data_exaltacao: m.data_exaltacao || '', observacoes: m.observacoes || '', ativo: m.ativo,
    foto_url: m.foto_url || '',
  });

  const abrirEditar = (m) => {
    setMembroAtual(m);
    setForm(preencherFormComMembro(m));
    setPagina('form');
  };

  const abrirVisualizar = (m) => {
    setMembroAtual(m);
    setAbaVer('pessoal');
    setDadosMaconicos(null);
    setPagina('ver');
    if (m.irmao_vinculado_id) carregarDadosMaconicos(m.irmao_vinculado_id);
  };

  const carregarDadosMaconicos = async (irmaoId) => {
    setCarregandoMaconico(true);
    try {
      const { data, error } = await supabase
        .from('irmaos')
        .select('data_iniciacao, data_elevacao, data_exaltacao, data_instalacao, mestre_instalado')
        .eq('id', irmaoId)
        .maybeSingle();
      if (error) throw error;
      setDadosMaconicos(data || null);
    } catch (e) {
      showError('Erro ao carregar dados maçônicos: ' + e.message);
    } finally {
      setCarregandoMaconico(false);
    }
  };

  // Pra membros importados antes de existir o campo de foto — busca de novo
  // a foto atual do irmão vinculado na Loja e atualiza o cadastro do Arco Real.
  const atualizarFotoDoIrmao = async (m) => {
    if (!m.irmao_vinculado_id) return;
    try {
      const { data: irmao, error: e1 } = await supabase
        .from('irmaos')
        .select('foto_url')
        .eq('id', m.irmao_vinculado_id)
        .maybeSingle();
      if (e1) throw e1;
      if (!irmao?.foto_url) { showError('Esse irmão não tem foto cadastrada na Acácia.'); return; }

      const { data, error } = await supabase
        .from('arco_real_membros')
        .update({ foto_url: irmao.foto_url })
        .eq('id', m.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) { showError('❌ Nada foi atualizado — provável falta de permissão (RLS).'); return; }

      showSuccess('✅ Foto atualizada a partir do cadastro da Loja!');
      setMembroAtual(data[0]);
      carregar();
    } catch (e) {
      showError('Erro ao atualizar foto: ' + e.message);
    }
  };

  const voltarLista = () => {
    setPagina('lista');
    setMembroAtual(null);
  };

  const abrirImportar = () => {
    carregarIrmaosDisponiveis();
    setBuscaIrmao('');
    setModalImportar(true);
  };

  const importarIrmao = (irmao) => {
    setMembroAtual(null);
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
    setPagina('form');
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

      if (membroAtual) {
        const { data, error } = await supabase.from('arco_real_membros').update(payload).eq('id', membroAtual.id).select();
        if (error) throw error;
        if (!data || data.length === 0) { showError('❌ Nada foi alterado — provável falta de permissão (RLS).'); return; }
        showSuccess('✅ Membro atualizado!');
      } else {
        const { error } = await supabase.from('arco_real_membros').insert([payload]);
        if (error) throw error;
        showSuccess('✅ Membro cadastrado!');
      }
      voltarLista();
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
      if (pagina !== 'lista') voltarLista();
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

  // ── MODAL: Importar de Irmão (usado tanto na lista quanto no form) ───────
  const ModalImportar = () => (
    !modalImportar ? null : (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setModalImportar(false)}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '520px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ fontWeight: '800', color: 'var(--color-text)' }}>📥 Importar Dados de um Irmão</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>Os dados pessoais são copiados uma vez — depois disso, o cadastro no Arco Real é independente.</p>
          </div>
          <div style={{ padding: '0.85rem 1.25rem' }}>
            <input autoFocus value={buscaIrmao} onChange={e => setBuscaIrmao(e.target.value)} placeholder="🔎 Buscar irmão pelo nome..." style={inputStyle} />
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
    )
  );

  const ModalConfirmExcluir = () => (
    !confirmExcluir ? null : (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 210 }} onClick={() => setConfirmExcluir(null)}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', maxWidth: '360px' }} onClick={e => e.stopPropagation()}>
          <p style={{ color: 'var(--color-text)', fontWeight: '600', marginBottom: '1rem' }}>Excluir este membro do Arco Real? Essa ação não pode ser desfeita.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
            <button onClick={() => setConfirmExcluir(null)} style={{ padding: '0.5rem 1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={() => excluir(confirmExcluir)} style={{ padding: '0.5rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '700' }}>Excluir</button>
          </div>
        </div>
      </div>
    )
  );

  // ══════════════════════════════════════════════════════════════════════
  // PÁGINA: LISTA
  // ══════════════════════════════════════════════════════════════════════
  if (pagina === 'lista') {
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
            <button onClick={abrirNovo} style={{ padding: '0.55rem 1rem', background: '#4ade80', color: '#111827', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
              ➕ Novo Membro
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔎 Buscar por nome ou CPF..." style={{ ...inputStyle, maxWidth: '320px' }} />
          <select value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)} style={{ ...inputStyle, maxWidth: '200px' }}>
            <option value="">Todas as situações</option>
            <option value="regular">Regular</option>
            <option value="licenciado">Licenciado</option>
            <option value="desligado">Desligado</option>
            <option value="excluido">Excluído</option>
            <option value="falecido">Falecido</option>
          </select>
        </div>

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
                  className="rounded-lg transition-opacity hover:opacity-95 overflow-hidden cursor-pointer"
                  onClick={() => abrirVisualizar(m)}
                  style={licenciado
                    ? { borderTop: '2px solid #4ade80', borderRight: '2px solid #4ade80', borderBottom: '2px solid #4ade80', borderLeft: '8px solid #4ade80', background: 'var(--color-surface)', boxShadow: '0 0 0 1px rgba(74,222,128,0.35)' }
                    : { borderLeft: '4px solid #4ade80', borderTop: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                >
                  <div className="relative" style={{ background: 'var(--color-surface-2)', overflow: 'hidden', height: '6.5rem' }}>
                    {m.foto_url ? (
                      <img src={m.foto_url} alt={m.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 35%', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="text-3xl text-white">🔺</span>
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: '0.35rem', right: '0.35rem', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: '800', background: m.irmao_vinculado_id ? 'rgba(37,99,235,0.9)' : 'rgba(100,116,139,0.9)' }}>
                      {m.irmao_vinculado_id ? 'LOJA' : 'EXTERNO'}
                    </div>
                  </div>

                  <div className="p-2.5">
                    <h3 className="font-bold text-sm truncate" style={{ color: '#4ade80' }} title={m.nome}>{m.nome}</h3>
                    <p className="text-xs truncate mt-1" style={{ color: 'var(--color-text-muted)' }} title={m.cargo || ''}>{m.cargo || 'Sem cargo definido'}</p>

                    <div className="mt-2 flex gap-1.5 flex-wrap">
                      <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: '700', background: cor.bg, color: cor.cor }}>
                        {m.situacao}
                      </span>
                    </div>

                    <div className="mt-2.5 flex gap-1.5" onClick={e => e.stopPropagation()}>
                      <button onClick={() => abrirVisualizar(m)} style={{ padding: '0.3rem 0.4rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', cursor: 'pointer' }} title="Visualizar">👁️</button>
                      <button onClick={() => abrirEditar(m)} style={{ padding: '0.3rem 0.4rem', background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid #4ade80', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', cursor: 'pointer' }} title="Editar">✏️</button>
                      <button onClick={() => setConfirmExcluir(m.id)} style={{ padding: '0.3rem 0.4rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', cursor: 'pointer' }} title="Excluir">🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <ModalImportar />
        <ModalConfirmExcluir />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // PÁGINA: VISUALIZAR (somente leitura, no padrão do PerfilIrmao)
  // ══════════════════════════════════════════════════════════════════════
  if (pagina === 'ver' && membroAtual) {
    const m = membroAtual;
    const cor = situacaoCor(m.situacao);
    return (
      <div className="p-6" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <button onClick={voltarLista} style={{ padding: '0.5rem 1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600' }}>
            ← Voltar
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => abrirEditar(m)} style={{ padding: '0.55rem 1rem', background: '#4ade80', color: '#111827', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>✏️ Editar</button>
            <button onClick={() => setConfirmExcluir(m.id)} style={{ padding: '0.55rem 1rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>🗑️ Excluir</button>
          </div>
        </div>

        {/* Cabeçalho com foto */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: '5.5rem', height: '5.5rem', borderRadius: '50%', overflow: 'hidden', border: '3px solid #4ade80' }}>
              {m.foto_url ? (
                <img src={m.foto_url} alt={m.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="text-3xl text-white">🔺</span>
                </div>
              )}
            </div>
            {m.irmao_vinculado_id && (
              <button
                onClick={() => atualizarFotoDoIrmao(m)}
                title="Buscar foto atual do cadastro na Acácia"
                style={{ position: 'absolute', bottom: '-0.2rem', right: '-0.2rem', width: '1.9rem', height: '1.9rem', borderRadius: '50%', background: '#2d6a9f', border: '2px solid var(--color-surface)', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                🔄
              </button>
            )}
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--color-text)' }}>{m.nome}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>{m.cargo || 'Sem cargo definido'}</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700', background: cor.bg, color: cor.cor }}>{m.situacao}</span>
              <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700', background: m.irmao_vinculado_id ? 'rgba(37,99,235,0.15)' : 'rgba(100,116,139,0.15)', color: m.irmao_vinculado_id ? '#2563eb' : '#64748b' }}>
                {m.irmao_vinculado_id ? `🏛️ Irmão da Loja (${m.irmaos?.nome || '—'})` : '🔺 Membro Externo'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Abas */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', marginBottom: '0.25rem' }}>
            <button
              onClick={() => setAbaVer('pessoal')}
              style={{
                padding: '0.6rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer',
                fontWeight: '700', fontSize: '0.85rem',
                color: abaVer === 'pessoal' ? '#4ade80' : 'var(--color-text-muted)',
                borderBottom: abaVer === 'pessoal' ? '2px solid #4ade80' : '2px solid transparent',
              }}
            >
              👤 Dados Pessoais
            </button>
            <button
              onClick={() => setAbaVer('maconico')}
              style={{
                padding: '0.6rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer',
                fontWeight: '700', fontSize: '0.85rem',
                color: abaVer === 'maconico' ? '#4ade80' : 'var(--color-text-muted)',
                borderBottom: abaVer === 'maconico' ? '2px solid #4ade80' : '2px solid transparent',
              }}
            >
              🏛️ Dados Maçônicos
            </button>
          </div>

          {abaVer === 'pessoal' && (
            <>
              {/* Identificação */}
              <div style={boxCard}>
                <p style={boxTitle}>Identificação</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label style={labelStyle}>CPF</label><p style={{ color: 'var(--color-text)' }}>{m.cpf || 'Não informado'}</p></div>
                  <div><label style={labelStyle}>RG</label><p style={{ color: 'var(--color-text)' }}>{m.rg || 'Não informado'}</p></div>
                  <div>
                    <label style={labelStyle}>Data de Nascimento</label>
                    <p style={{ color: 'var(--color-text)' }}>{fmtData(m.data_nascimento)}</p>
                    {m.data_nascimento && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{calcularIdade(m.data_nascimento)}</p>}
                  </div>
                </div>
              </div>

              {/* Contato */}
              <div style={boxCard}>
                <p style={boxTitle}>Contato</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label style={labelStyle}>Email</label><p style={{ color: 'var(--color-text)' }}>{m.email || 'Não informado'}</p></div>
                  <div><label style={labelStyle}>Telefone</label><p style={{ color: 'var(--color-text)' }}>{m.telefone || 'Não informado'}</p></div>
                </div>
              </div>

              {/* Endereço */}
              <div style={boxCard}>
                <p style={boxTitle}>Endereço</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div><label style={labelStyle}>CEP</label><p style={{ color: 'var(--color-text)' }}>{m.cep || 'Não informado'}</p></div>
                  <div className="md:col-span-2"><label style={labelStyle}>Logradouro</label><p style={{ color: 'var(--color-text)' }}>{m.endereco || 'Não informado'}{m.numero ? `, ${m.numero}` : ''}</p></div>
                  <div><label style={labelStyle}>Complemento</label><p style={{ color: 'var(--color-text)' }}>{m.complemento || '-'}</p></div>
                  <div><label style={labelStyle}>Bairro</label><p style={{ color: 'var(--color-text)' }}>{m.bairro || 'Não informado'}</p></div>
                  <div><label style={labelStyle}>Cidade</label><p style={{ color: 'var(--color-text)' }}>{m.cidade || 'Não informado'}</p></div>
                  <div><label style={labelStyle}>Estado</label><p style={{ color: 'var(--color-text)' }}>{m.estado || 'Não informado'}</p></div>
                </div>
              </div>

              {/* Dados do Arco Real */}
              <div style={{ ...boxCard, border: '1px solid rgba(74,222,128,0.35)' }}>
                <p style={{ ...boxTitle, color: '#4ade80' }}>🔺 Dados do Arco Real</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label style={labelStyle}>Cargo</label><p style={{ color: 'var(--color-text)' }}>{m.cargo || 'Não informado'}</p></div>
                  <div><label style={labelStyle}>Situação</label><p className="capitalize" style={{ color: 'var(--color-text)' }}>{m.situacao}</p></div>
                  <div><label style={labelStyle}>Data de Exaltação</label><p style={{ color: 'var(--color-text)' }}>{fmtData(m.data_exaltacao)}</p></div>
                </div>
              </div>

              {/* Observações */}
              {m.observacoes && (
                <div style={boxCard}>
                  <p style={boxTitle}>Observações</p>
                  <p style={{ color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>{m.observacoes}</p>
                </div>
              )}
            </>
          )}

          {abaVer === 'maconico' && (
            <>
              {!m.irmao_vinculado_id ? (
                <div style={boxCard}>
                  <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '1.5rem' }}>
                    Este membro não está vinculado a um irmão da Loja Acácia — não há dados maçônicos simbólicos pra exibir.
                  </p>
                </div>
              ) : carregandoMaconico ? (
                <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '1.5rem' }}>Carregando...</p>
              ) : (
                <div style={boxCard}>
                  <p style={boxTitle}>🏛️ Datas Maçônicas (Loja Simbólica — {m.irmaos?.nome || 'Acácia'})</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label style={labelStyle}>🔨 Iniciação</label><p style={{ color: 'var(--color-text)' }}>{fmtData(dadosMaconicos?.data_iniciacao)}</p></div>
                    <div><label style={labelStyle}>📐 Elevação</label><p style={{ color: 'var(--color-text)' }}>{fmtData(dadosMaconicos?.data_elevacao)}</p></div>
                    <div><label style={labelStyle}>🏛️ Exaltação</label><p style={{ color: 'var(--color-text)' }}>{fmtData(dadosMaconicos?.data_exaltacao)}</p></div>
                    <div><label style={labelStyle}>⭐ Mestre Instalado?</label><p style={{ color: 'var(--color-text)' }}>{dadosMaconicos?.mestre_instalado ? 'Sim' : 'Não'}</p></div>
                    {dadosMaconicos?.mestre_instalado && (
                      <div><label style={labelStyle}>📅 Instalação</label><p style={{ color: 'var(--color-text)' }}>{fmtData(dadosMaconicos?.data_instalacao)}</p></div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <ModalConfirmExcluir />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // PÁGINA: FORMULÁRIO (criar/editar) — tela cheia, no padrão do CadastrarIrmao
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={voltarLista} style={{ padding: '0.5rem 1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600' }}>
            ← Voltar
          </button>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)' }}>
            {membroAtual ? '✏️ Editar Membro' : '➕ Novo Membro do Arco Real'}
          </h2>
        </div>
        {!membroAtual && (
          <button onClick={abrirImportar} style={{ padding: '0.5rem 1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer' }}>
            📥 Importar Irmão Existente
          </button>
        )}
      </div>

      {form.irmao_vinculado_id && (
        <div style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.35)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.85rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#2563eb', fontWeight: '600' }}>
          🏛️ Vinculado a um irmão da Loja Acácia
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Identificação */}
        <div style={boxCard}>
          <p style={boxTitle}>Identificação</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label style={labelStyle}>Nome Completo *</label>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} style={inputStyle} />
            </div>
            <div className="md:col-span-2">
              <label style={labelStyle}>URL da Foto</label>
              <input value={form.foto_url} onChange={e => setForm(f => ({ ...f, foto_url: e.target.value }))} placeholder="https://..." style={inputStyle} />
            </div>
            <div><label style={labelStyle}>CPF</label><input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>RG</label><input value={form.rg} onChange={e => setForm(f => ({ ...f, rg: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Data de Nascimento</label><input type="date" value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} style={inputStyle} /></div>
          </div>
        </div>

        {/* Contato */}
        <div style={boxCard}>
          <p style={boxTitle}>Contato</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label style={labelStyle}>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Telefone</label><input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} style={inputStyle} /></div>
          </div>
        </div>

        {/* Endereço */}
        <div style={boxCard}>
          <p style={boxTitle}>Endereço</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div><label style={labelStyle}>CEP</label><input value={form.cep} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))} style={inputStyle} /></div>
            <div className="md:col-span-2"><label style={labelStyle}>Logradouro</label><input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Número</label><input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} style={inputStyle} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><label style={labelStyle}>Complemento</label><input value={form.complemento} onChange={e => setForm(f => ({ ...f, complemento: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Bairro</label><input value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Cidade</label><input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>UF</label><input value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} maxLength={2} style={inputStyle} /></div>
          </div>
        </div>

        {/* Dados do Arco Real */}
        <div style={{ ...boxCard, border: '1px solid rgba(74,222,128,0.35)' }}>
          <p style={{ ...boxTitle, color: '#4ade80' }}>🔺 Dados do Arco Real</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="md:col-span-3">
              <label style={labelStyle}>Observações</label>
              <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} style={inputStyle} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.5rem', paddingBottom: '2rem' }}>
        <button onClick={voltarLista} style={{ padding: '0.6rem 1.3rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
        <button onClick={salvar} style={{ padding: '0.6rem 1.3rem', background: '#4ade80', color: '#111827', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '700' }}>💾 Salvar</button>
      </div>

      <ModalImportar />
      <ModalConfirmExcluir />
    </div>
  );
}
