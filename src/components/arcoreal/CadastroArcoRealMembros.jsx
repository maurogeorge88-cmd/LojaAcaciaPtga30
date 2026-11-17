import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { CARGOS_ARCO_REAL } from '../../utils/cargosArcoReal';
import FamiliaresArcoReal from './FamiliaresArcoReal';
import { FAMILIA_VAZIA, carregarFamiliaresArcoReal, carregarFamiliaresDaLoja, salvarFamiliaresArcoReal } from '../../utils/arcoRealFamiliares';

const VAZIO = {
  irmao_vinculado_id: null,
  nome: '', cpf: '', rg: '', data_nascimento: '', email: '', telefone: '',
  cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  cargo: '', situacao: 'regular', data_exaltacao: '', observacoes: '', ativo: true, foto_url: '',
  loja_nome: '', loja_oriente: '', loja_data_iniciacao: '', loja_data_elevacao: '', loja_data_exaltacao: '',
};

const inputStyle = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' };
const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.03em' };
const boxCard = { background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', overflow: 'hidden' };

// Faixa colorida de título de seção (mesmo azul do cabeçalho do Financeiro
// do Arco Real) — usada no topo de cada quadro de cadastro/visualização.
const Faixa = ({ children }) => (
  <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', margin: '-1.25rem -1.25rem 0.85rem -1.25rem', padding: '0.55rem 1.25rem' }}>
    <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</span>
  </div>
);


export default function CadastroArcoRealMembros({ membroId = null, abrirImportarAoIniciar = false, onVoltar, onSalvo, showSuccess, showError, permissoes = {} }) {
  const [loading, setLoading] = useState(!!membroId);
  const [membroAtual, setMembroAtual] = useState(null); // null = novo cadastro
  const [form, setForm] = useState(VAZIO);
  const [cargoModoOutro, setCargoModoOutro] = useState(false);
  const [aba, setAba] = useState('dados');
  const [familia, setFamilia] = useState(FAMILIA_VAZIA());
  const [familiaSemTabela, setFamiliaSemTabela] = useState(false);

  const [modalImportar, setModalImportar] = useState(false);
  const [irmaosDisponiveis, setIrmaosDisponiveis] = useState([]);
  const [buscaIrmao, setBuscaIrmao] = useState('');

  const voltarLista = () => { if (onVoltar) onVoltar(); };

  useEffect(() => {
    if (membroId) {
      (async () => {
        try {
          const { data, error } = await supabase.from('arco_real_membros').select('*, irmaos:irmao_vinculado_id(nome)').eq('id', membroId).single();
          if (error) throw error;
          setMembroAtual(data);
          setForm(preencherFormComMembro(data));
          setCargoModoOutro(!!data.cargo && !CARGOS_ARCO_REAL.includes(data.cargo));
          const r = await carregarFamiliaresArcoReal(membroId);
          setFamilia(r.familia); setFamiliaSemTabela(r.semTabela);
        } catch (e) {
          showError('Erro ao carregar membro: ' + e.message);
        } finally {
          setLoading(false);
        }
      })();
    } else if (abrirImportarAoIniciar) {
      abrirImportar();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const carregarIrmaosDisponiveis = async () => {
    try {
      const { data: vinc } = await supabase.from('arco_real_membros').select('irmao_vinculado_id').not('irmao_vinculado_id', 'is', null);
      const idsJaVinculados = (vinc || []).map(m => m.irmao_vinculado_id);
      let q = supabase
        .from('irmaos')
        .select('id, nome, cpf, rg, data_nascimento, email, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, foto_url')
        .order('nome');
      if (idsJaVinculados.length > 0) q = q.not('id', 'in', `(${idsJaVinculados.join(',')})`);
      const { data, error } = await q;
      if (error) throw error;
      setIrmaosDisponiveis(data || []);
    } catch (e) {
      showError('Erro ao carregar irmãos: ' + e.message);
    }
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
    loja_nome: m.loja_nome || '', loja_oriente: m.loja_oriente || '',
    loja_data_iniciacao: m.loja_data_iniciacao || '', loja_data_elevacao: m.loja_data_elevacao || '',
    loja_data_exaltacao: m.loja_data_exaltacao || '',
  });

  const abrirImportar = () => {
    carregarIrmaosDisponiveis();
    setBuscaIrmao('');
    setModalImportar(true);
  };

  // Upload direto do dispositivo — mesma lógica do cadastro de irmãos da
  // Loja: sobe pro Storage, pega a URL pública e já salva no cadastro.
  // Só funciona com o membro já salvo (precisa do ID pro nome do arquivo).
  const handleUploadFoto = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) { showError('❌ Apenas imagens são permitidas'); return; }
    if (file.size > 5 * 1024 * 1024) { showError('❌ Imagem muito grande. Máximo 5MB'); return; }

    const membroId = membroAtual?.id;
    if (!membroId) { showError('❌ Salve o cadastro antes de enviar a foto'); return; }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${membroId}_${Date.now()}.${fileExt}`;
      const filePath = `fotos_membros/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('arcoreal').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('arcoreal').getPublicUrl(filePath);

      const { error: updateError } = await supabase.from('arco_real_membros').update({ foto_url: publicUrl }).eq('id', membroId);
      if (updateError) throw updateError;

      setForm(f => ({ ...f, foto_url: publicUrl }));
      showSuccess('✅ Foto atualizada com sucesso!');
    } catch (e) {
      showError('❌ Erro ao fazer upload: ' + e.message);
    }
  };

  const importarIrmao = async (irmao) => {
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
    setFamilia(await carregarFamiliaresDaLoja(irmao.id));
  };

  // Se o cargo escolhido é um dos oficiais, reflete automaticamente no
  // Corpo Administrativo do ano atual — sem precisar ir lá selecionar de novo.
  const sincronizarCorpoAdministrativo = async (membroId, cargo) => {
    if (!cargo || !CARGOS_ARCO_REAL.includes(cargo)) return;
    try {
      const anoAtual = String(new Date().getFullYear());
      await supabase.from('arco_real_corpo_administrativo')
        .upsert({ cargo, ano_exercicio: anoAtual, membro_id: membroId }, { onConflict: 'cargo,ano_exercicio' });
    } catch (e) {
      console.error('Erro ao sincronizar Corpo Administrativo:', e);
    }
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
        // Loja de origem: só vale para irmão de outra loja (sem vínculo com a Acácia)
        loja_nome: form.irmao_vinculado_id ? null : (form.loja_nome || null),
        loja_oriente: form.irmao_vinculado_id ? null : (form.loja_oriente || null),
        loja_data_iniciacao: form.irmao_vinculado_id ? null : (form.loja_data_iniciacao || null),
        loja_data_elevacao: form.irmao_vinculado_id ? null : (form.loja_data_elevacao || null),
        loja_data_exaltacao: form.irmao_vinculado_id ? null : (form.loja_data_exaltacao || null),
      };
      let idSalvo = membroAtual?.id;

      if (membroAtual) {
        const { data, error } = await supabase.from('arco_real_membros').update(payload).eq('id', membroAtual.id).select();
        if (error) throw error;
        if (!data || data.length === 0) { showError('❌ Nada foi alterado — provável falta de permissão (RLS).'); return; }
        showSuccess('✅ Membro atualizado!');
        await sincronizarCorpoAdministrativo(membroAtual.id, form.cargo);
      } else {
        const { data, error } = await supabase.from('arco_real_membros').insert([payload]).select();
        if (error) throw error;
        idSalvo = data?.[0]?.id;
        showSuccess('✅ Membro cadastrado!');
        if (data?.[0]?.id) await sincronizarCorpoAdministrativo(data[0].id, form.cargo);
      }
      if (idSalvo && !familiaSemTabela) {
        try { await salvarFamiliaresArcoReal(idSalvo, familia); }
        catch (e) { showError('Membro salvo, mas erro nos familiares: ' + e.message); return; }
      }
      if (onSalvo) onSalvo(); else voltarLista();
    } catch (e) {
      showError('Erro ao salvar: ' + e.message);
    }
  };

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


  if (loading) return <div className="p-6" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>;

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

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
        {[['dados', '📋 Dados'], ['familiares', '👨‍👩‍👧 Familiares']].map(([k, l]) => (
          <button key={k} onClick={() => setAba(k)} style={{ padding: '0.55rem 1.1rem', background: 'transparent', border: 'none', borderBottom: aba === k ? '3px solid var(--color-accent)' : '3px solid transparent', color: aba === k ? 'var(--color-accent)' : 'var(--color-text-muted)', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      {aba === 'familiares' && (
        <>
          {familiaSemTabela && (
            <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.85rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#b45309' }}>
              ⚠️ Tabelas de familiares ainda não criadas. Rode o SQL <strong>arco_real_familiares.sql</strong> no Supabase.
            </div>
          )}
          <FamiliaresArcoReal value={familia} onChange={setFamilia} showError={showError} />
        </>
      )}

      <div style={{ display: aba === 'dados' ? 'flex' : 'none', flexDirection: 'column', gap: '1rem' }}>
        {/* Identificação */}
        <div style={boxCard}>
          <Faixa>Identificação</Faixa>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label style={labelStyle}>Nome Completo *</label>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} style={inputStyle} />
            </div>
            <div className="md:col-span-2">
              <label style={labelStyle}>Foto do Membro</label>
              <div className="flex items-center gap-4">
                {form.foto_url ? (
                  <img src={form.foto_url} alt="Foto" className="w-20 h-20 rounded-full object-cover border-2" style={{ borderColor: 'var(--color-border)' }} />
                ) : (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'var(--color-surface-2)' }}>
                    <span className="text-3xl">👤</span>
                  </div>
                )}
                {membroAtual?.id ? (
                  <label style={{ cursor: 'pointer', background: 'var(--color-accent)', color: '#fff', padding: '0.5rem 1rem', borderRadius: 'var(--radius-lg)', fontWeight: '600', fontSize: '0.875rem', display: 'inline-block' }}>
                    📷 {form.foto_url ? 'Alterar Foto' : 'Enviar Foto'}
                    <input type="file" accept="image/*" onChange={handleUploadFoto} className="hidden" />
                  </label>
                ) : (
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Salve o cadastro primeiro para enviar a foto</p>
                )}
              </div>
            </div>
            <div><label style={labelStyle}>CPF</label><input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>RG</label><input value={form.rg} onChange={e => setForm(f => ({ ...f, rg: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Data de Nascimento</label><input type="date" value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} style={inputStyle} /></div>
          </div>
        </div>

        {/* Contato */}
        <div style={boxCard}>
          <Faixa>Contato</Faixa>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label style={labelStyle}>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Telefone</label><input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} style={inputStyle} /></div>
          </div>
        </div>

        {/* Endereço */}
        <div style={boxCard}>
          <Faixa>Endereço</Faixa>
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

        {/* Loja Simbólica de origem — só para irmão de outra loja */}
        {!form.irmao_vinculado_id && (
          <div style={boxCard}>
            <Faixa>🏛️ Loja Simbólica de Origem (irmão de outra loja)</Faixa>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label style={labelStyle}>Nome da Loja</label><input value={form.loja_nome} onChange={e => setForm(f => ({ ...f, loja_nome: e.target.value }))} placeholder="Ex.: A∴R∴L∴S∴ Nome nº 00" style={inputStyle} /></div>
              <div><label style={labelStyle}>Oriente</label><input value={form.loja_oriente} onChange={e => setForm(f => ({ ...f, loja_oriente: e.target.value }))} style={inputStyle} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ marginTop: '1rem' }}>
              <div><label style={labelStyle}>Data de Iniciação</label><input type="date" value={form.loja_data_iniciacao} onChange={e => setForm(f => ({ ...f, loja_data_iniciacao: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Data de Elevação</label><input type="date" value={form.loja_data_elevacao} onChange={e => setForm(f => ({ ...f, loja_data_elevacao: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Data de Exaltação</label><input type="date" value={form.loja_data_exaltacao} onChange={e => setForm(f => ({ ...f, loja_data_exaltacao: e.target.value }))} style={inputStyle} /></div>
            </div>
          </div>
        )}

        {/* Dados do Arco Real */}
        <div style={{ ...boxCard, border: '1px solid rgba(74,222,128,0.35)' }}>
          <Faixa>🔺 Dados do Arco Real</Faixa>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label style={labelStyle}>Cargo</label>
              <select
                value={cargoModoOutro ? 'outro' : (CARGOS_ARCO_REAL.includes(form.cargo) ? form.cargo : '')}
                onChange={e => {
                  if (e.target.value === 'outro') { setCargoModoOutro(true); setForm(f => ({ ...f, cargo: '' })); }
                  else { setCargoModoOutro(false); setForm(f => ({ ...f, cargo: e.target.value })); }
                }}
                style={inputStyle}
              >
                <option value="">— Sem cargo —</option>
                {CARGOS_ARCO_REAL.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="outro">Outro (digitar)...</option>
              </select>
              {(cargoModoOutro || (form.cargo !== '' && !CARGOS_ARCO_REAL.includes(form.cargo))) && (
                <input
                  value={form.cargo}
                  onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
                  placeholder="Digite o cargo..."
                  style={{ ...inputStyle, marginTop: '0.4rem' }}
                />
              )}
              <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', margin: '0.3rem 0 0' }}>
                Cargos da lista aparecem automaticamente no Corpo Administrativo do ano atual.
              </p>
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
    </div>
  );
}
