import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

// ─────────────────────────────────────────────
//  Estilos base
// ─────────────────────────────────────────────
const inp = (extra = {}) => ({
  background: 'var(--color-surface-2)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
  padding: '0.5rem 1rem', width: '100%', outline: 'none', boxSizing: 'border-box',
  ...extra,
});
const lbl = {
  display: 'block', fontSize: '0.875rem', fontWeight: '600',
  color: 'var(--color-text-muted)', marginBottom: '0.5rem',
};
const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  zIndex: 50, padding: '1rem', overflowY: 'auto',
};
const modalBox = (maxW = '42rem') => ({
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: maxW,
  marginTop: '0.5rem',
});
const modalHead = (bg = 'var(--color-surface-2)') => ({
  background: bg, color: bg === 'var(--color-surface-2)' ? 'var(--color-text)' : '#fff',
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
});

// ─────────────────────────────────────────────
//  Modal Histórico de Patrimônio
// ─────────────────────────────────────────────
const ModalHistoricoPatrimonio = ({ equipamento, onFechar }) => {
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      const { data } = await supabase
        .from('equipamento_patrimonio_historico')
        .select('*')
        .eq('equipamento_id', equipamento.id)
        .order('data_inicio', { ascending: false });
      setHistorico(data || []);
      setCarregando(false);
    };
    carregar();
  }, [equipamento.id]);

  return (
    <div style={modalOverlay} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={modalBox('560px')}>
        <div style={modalHead()}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
              📋 Histórico de Patrimônios
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0.15rem 0 0' }}>
              {equipamento.tipos_equipamentos?.nome} — {equipamento.descricao || ''}
            </p>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '1.25rem' }}>
          {carregando ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>Carregando...</p>
          ) : historico.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>Nenhum registro encontrado.</p>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Linha vertical da timeline */}
              <div style={{ position: 'absolute', left: '11px', top: 0, bottom: 0, width: '2px', background: 'var(--color-border)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {historico.map((h, i) => {
                  const ativo = h.status === 'ativo';
                  return (
                    <div key={h.id} style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                      {/* Bolinha */}
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 700, zIndex: 1,
                        background: ativo ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)',
                        border: `2px solid ${ativo ? '#10b981' : '#ef4444'}`,
                        color: ativo ? '#10b981' : '#ef4444',
                      }}>
                        {ativo ? '✓' : '✕'}
                      </div>
                      {/* Card */}
                      <div style={{
                        flex: 1, background: 'var(--color-surface-2)',
                        border: `1px solid ${ativo ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
                        borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'monospace' }}>
                            {h.numero}
                          </span>
                          <span style={{
                            padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600,
                            background: ativo ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            color: ativo ? '#10b981' : '#ef4444',
                            border: `1px solid ${ativo ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                          }}>
                            {ativo ? '✅ Ativo' : '⛔ Inutilizado'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.3rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span>📅 Início: {new Date(h.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                          {h.data_fim && <span>🔚 Fim: {new Date(h.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                        </div>
                        {h.motivo && (
                          <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                            ⚠️ {h.motivo}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
            <button onClick={onFechar} style={{ ...inp(), width: 'auto', padding: '0.55rem 1.25rem', cursor: 'pointer', fontWeight: 600 }}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  Modal Inutilizar Patrimônio
// ─────────────────────────────────────────────
const ModalInutilizar = ({ equipamento, onFechar, onSalvar }) => {
  const [motivo, setMotivo] = useState('');
  const [novoNumero, setNovoNumero] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const handleSalvar = async () => {
    if (!motivo.trim()) { setErro('Informe o motivo da inutilização.'); return; }
    if (!novoNumero.trim()) { setErro('Informe o novo número de patrimônio.'); return; }
    if (novoNumero.trim() === equipamento.numero_patrimonio) {
      setErro('O novo número deve ser diferente do atual.'); return;
    }
    setSalvando(true); setErro('');
    try {
      await onSalvar({ motivo: motivo.trim(), novoNumero: novoNumero.trim() });
    } catch (e) {
      setErro(e.message || 'Erro ao salvar.');
      setSalvando(false);
    }
  };

  return (
    <div style={modalOverlay} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={modalBox('500px')}>
        <div style={modalHead()}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
            ⚠️ Inutilizar Número de Patrimônio
          </h3>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Aviso */}
          <div style={{ padding: '0.85rem 1rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: '#f59e0b' }}>
            ⚠️ O número <strong style={{ fontFamily: 'monospace' }}>{equipamento.numero_patrimonio}</strong> será marcado como inutilizado e ficará registrado no histórico. O equipamento continuará ativo com o novo número.
          </div>

          {/* Motivo */}
          <div>
            <label style={lbl}>Motivo da Inutilização *</label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              style={{ ...inp(), resize: 'vertical' }}
              rows={3}
              placeholder="Ex: Plaquinha perdida durante empréstimo, número danificado..."
              autoFocus
            />
          </div>

          {/* Novo número */}
          <div>
            <label style={lbl}>Novo Número de Patrimônio *</label>
            <input
              value={novoNumero}
              onChange={e => setNovoNumero(e.target.value)}
              style={inp()}
              placeholder="Digite o novo número..."
            />
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
              Este número substituirá o atual no equipamento.
            </p>
          </div>

          {erro && (
            <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: '#ef4444' }}>
              {erro}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
            <button onClick={onFechar} style={{ ...inp(), width: 'auto', padding: '0.6rem 1.1rem', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={salvando}
              style={{
                padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)', fontWeight: 600,
                background: salvando ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.15)',
                border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b',
                cursor: salvando ? 'wait' : 'pointer', opacity: salvando ? 0.7 : 1,
              }}
            >
              {salvando ? 'Salvando...' : '⚠️ Confirmar Inutilização'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  Componente Principal
// ─────────────────────────────────────────────
export default function GestaoEquipamentos({ showSuccess, showError, permissoes }) {
  const [equipamentos, setEquipamentos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalLote, setModalLote] = useState(false);
  const [modalTipo, setModalTipo] = useState(false);
  const [modalInutilizar, setModalInutilizar] = useState(null);
  const [modalHistorico, setModalHistorico] = useState(null);
  const [editando, setEditando] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('disponivel');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busca, setBusca] = useState('');

  const [form, setForm] = useState({
    tipo_id: '', numero_patrimonio: '', descricao: '',
    estado_conservacao: 'Novo', data_aquisicao: '',
    valor_aquisicao: '', status: 'disponivel', observacoes: ''
  });

  const [formLote, setFormLote] = useState({
    tipo_id: '', prefixo_patrimonio: '', quantidade: 1,
    numero_inicial: 1, descricao: '', estado_conservacao: 'Novo',
    data_aquisicao: '', valor_aquisicao: '', observacoes: ''
  });

  const [formTipo, setFormTipo] = useState({ nome: '', descricao: '', ativo: true });

  useEffect(() => { carregarDados(); }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const { data: tiposData, error: tiposError } = await supabase
        .from('tipos_equipamentos').select('*').eq('ativo', true).order('nome');
      if (tiposError) throw tiposError;
      setTipos(tiposData || []);

      const { data: equipData, error: equipError } = await supabase
        .from('equipamentos')
        .select('*, tipos_equipamentos(id, nome)')
        .order('created_at', { ascending: false });
      if (equipError) throw equipError;
      setEquipamentos(equipData || []);
      setLoading(false);
    } catch (error) {
      showError('Erro ao carregar dados');
      setLoading(false);
    }
  };

  const abrirModal = (equipamento = null) => {
    if (equipamento) {
      setEditando(equipamento);
      setForm({
        tipo_id: equipamento.tipo_id,
        numero_patrimonio: equipamento.numero_patrimonio,
        descricao: equipamento.descricao || '',
        estado_conservacao: equipamento.estado_conservacao,
        data_aquisicao: equipamento.data_aquisicao || '',
        valor_aquisicao: equipamento.valor_aquisicao || '',
        status: equipamento.status,
        observacoes: equipamento.observacoes || ''
      });
    } else {
      setEditando(null);
      setForm({ tipo_id: '', numero_patrimonio: '', descricao: '', estado_conservacao: 'Novo', data_aquisicao: '', valor_aquisicao: '', status: 'disponivel', observacoes: '' });
    }
    setModalAberto(true);
  };

  const salvarEquipamento = async (e) => {
    e.preventDefault();
    if (!form.tipo_id || !form.numero_patrimonio) { showError('Preencha os campos obrigatórios!'); return; }
    try {
      const dados = {
        tipo_id: parseInt(form.tipo_id),
        numero_patrimonio: form.numero_patrimonio,
        descricao: form.descricao,
        estado_conservacao: form.estado_conservacao,
        data_aquisicao: form.data_aquisicao || null,
        valor_aquisicao: form.valor_aquisicao ? parseFloat(form.valor_aquisicao) : null,
        status: form.status,
        observacoes: form.observacoes
      };

      if (editando) {
        const numeroAnterior = editando.numero_patrimonio;
        const { error } = await supabase.from('equipamentos').update(dados).eq('id', editando.id);
        if (error) throw error;

        // Se mudou o número, registrar no histórico
        if (form.numero_patrimonio !== numeroAnterior) {
          // Fechar registro anterior
          await supabase
            .from('equipamento_patrimonio_historico')
            .update({ data_fim: new Date().toISOString().split('T')[0], status: 'inutilizado', motivo: 'Número alterado via edição' })
            .eq('equipamento_id', editando.id)
            .eq('numero', numeroAnterior)
            .is('data_fim', null);
          // Inserir novo
          await supabase.from('equipamento_patrimonio_historico').insert({
            equipamento_id: editando.id,
            numero: form.numero_patrimonio,
            status: 'ativo',
            data_inicio: new Date().toISOString().split('T')[0],
          });
        }
        showSuccess('Equipamento atualizado com sucesso!');
      } else {
        const { data: novo, error } = await supabase.from('equipamentos').insert([dados]).select().single();
        if (error) throw error;
        // Registrar no histórico
        await supabase.from('equipamento_patrimonio_historico').insert({
          equipamento_id: novo.id,
          numero: form.numero_patrimonio,
          status: 'ativo',
          data_inicio: form.data_aquisicao || new Date().toISOString().split('T')[0],
        });
        showSuccess('Equipamento cadastrado com sucesso!');
      }

      setModalAberto(false);
      carregarDados();
    } catch (error) {
      showError(error.message || 'Erro ao salvar equipamento');
    }
  };

  // ── Inutilizar patrimônio ──────────────────────────────────────
  const handleInutilizar = async ({ motivo, novoNumero }) => {
    const eq = modalInutilizar;
    const hoje = new Date().toISOString().split('T')[0];

    // 1. Marcar número atual como inutilizado no histórico
    await supabase
      .from('equipamento_patrimonio_historico')
      .update({ status: 'inutilizado', motivo, data_fim: hoje })
      .eq('equipamento_id', eq.id)
      .eq('numero', eq.numero_patrimonio)
      .is('data_fim', null);

    // 2. Inserir novo número no histórico
    const { error: errHist } = await supabase
      .from('equipamento_patrimonio_historico')
      .insert({ equipamento_id: eq.id, numero: novoNumero, status: 'ativo', data_inicio: hoje });
    if (errHist) throw errHist;

    // 3. Atualizar equipamento com novo número
    const { error: errEq } = await supabase
      .from('equipamentos')
      .update({ numero_patrimonio: novoNumero })
      .eq('id', eq.id);
    if (errEq) throw errEq;

    setModalInutilizar(null);
    showSuccess(`✅ Patrimônio ${eq.numero_patrimonio} inutilizado. Novo número: ${novoNumero}`);
    carregarDados();
  };

  const salvarLote = async (e) => {
    e.preventDefault();
    if (!formLote.tipo_id || !formLote.prefixo_patrimonio || formLote.quantidade < 1) {
      showError('Preencha os campos obrigatórios!'); return;
    }
    try {
      const lote = [];
      for (let i = 0; i < formLote.quantidade; i++) {
        lote.push({
          tipo_id: parseInt(formLote.tipo_id),
          numero_patrimonio: `${formLote.prefixo_patrimonio}-${String(formLote.numero_inicial + i).padStart(3, '0')}`,
          descricao: formLote.descricao,
          estado_conservacao: formLote.estado_conservacao,
          data_aquisicao: formLote.data_aquisicao || null,
          valor_aquisicao: formLote.valor_aquisicao ? parseFloat(formLote.valor_aquisicao) : null,
          status: 'disponivel',
          observacoes: formLote.observacoes
        });
      }
      const { data: inseridos, error } = await supabase.from('equipamentos').insert(lote).select();
      if (error) throw error;

      // Histórico para cada um
      const hoje = formLote.data_aquisicao || new Date().toISOString().split('T')[0];
      const histLote = inseridos.map(eq => ({
        equipamento_id: eq.id, numero: eq.numero_patrimonio,
        status: 'ativo', data_inicio: hoje,
      }));
      await supabase.from('equipamento_patrimonio_historico').insert(histLote);

      showSuccess(`✅ ${formLote.quantidade} equipamento(s) cadastrado(s)!`);
      setModalLote(false);
      setFormLote({ tipo_id: '', prefixo_patrimonio: '', quantidade: 1, numero_inicial: 1, descricao: '', estado_conservacao: 'Novo', data_aquisicao: '', valor_aquisicao: '', observacoes: '' });
      carregarDados();
    } catch (error) {
      showError(error.message || 'Erro ao cadastrar em lote');
    }
  };

  const excluirEquipamento = async (id) => {
    if (!window.confirm('⚠️ Esta ação NÃO pode ser desfeita.\n\nDeseja excluir permanentemente este equipamento?')) return;
    try {
      const { error } = await supabase.from('equipamentos').delete().eq('id', id);
      if (error) throw error;
      showSuccess('Equipamento excluído!');
      carregarDados();
    } catch (error) {
      showError('Erro ao excluir: ' + error.message);
    }
  };

  const descartar = async (id) => {
    const motivo = prompt('Motivo do descarte:');
    if (!motivo) return;
    try {
      const { error } = await supabase.from('equipamentos').update({
        status: 'descartado', motivo_descarte: motivo,
        data_descarte: new Date().toISOString().split('T')[0]
      }).eq('id', id);
      if (error) throw error;
      showSuccess('Equipamento descartado!');
      carregarDados();
    } catch (error) {
      showError('Erro ao descartar equipamento');
    }
  };

  const salvarTipo = async (e) => {
    e.preventDefault();
    if (!formTipo.nome) { showError('Nome do tipo é obrigatório!'); return; }
    try {
      const { data: existe } = await supabase.from('tipos_equipamentos').select('id').ilike('nome', formTipo.nome).single();
      if (existe) { showError('Já existe um tipo com este nome!'); return; }
      const { error } = await supabase.from('tipos_equipamentos').insert([formTipo]);
      if (error) throw error;
      showSuccess('Tipo cadastrado!');
      setModalTipo(false);
      setFormTipo({ nome: '', descricao: '', ativo: true });
      carregarDados();
    } catch (error) {
      showError(error.message || 'Erro ao salvar tipo');
    }
  };

  const equipamentosFiltrados = equipamentos.filter(eq => {
    const st = (eq.status || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const ft = filtroStatus.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return (filtroStatus === 'todos' || st === ft)
      && (filtroTipo === 'todos' || eq.tipo_id === parseInt(filtroTipo))
      && (eq.numero_patrimonio.toLowerCase().includes(busca.toLowerCase())
        || eq.tipos_equipamentos?.nome.toLowerCase().includes(busca.toLowerCase()));
  });

  const getStatusStyle = (status) => {
    const m = {
      disponivel: { bg: 'rgba(16,185,129,0.15)', cor: '#10b981', label: '✅ Disponível' },
      emprestado: { bg: 'rgba(59,130,246,0.15)', cor: '#3b82f6', label: '🔄 Emprestado' },
      manutencao: { bg: 'rgba(245,158,11,0.15)', cor: '#f59e0b', label: '🔧 Manutenção' },
      descartado: { bg: 'rgba(107,114,128,0.15)', cor: '#6b7280', label: '🗑️ Descartado' },
    };
    return m[status] || m.disponivel;
  };

  const getEstadoStyle = (estado) => {
    const m = {
      'Novo': { bg: 'rgba(16,185,129,0.15)', cor: '#10b981' },
      'Bom': { bg: 'rgba(59,130,246,0.15)', cor: '#3b82f6' },
      'Regular': { bg: 'rgba(245,158,11,0.15)', cor: '#f59e0b' },
      'Ruim': { bg: 'rgba(239,68,68,0.15)', cor: '#ef4444' },
    };
    return m[estado] || m['Bom'];
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '16rem' }}>
        <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-text)' }}>🛠️ Gestão de Equipamentos</h2>
          {permissoes?.pode_editar_comodatos && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => setModalTipo(true)} style={{ ...inp(), width: 'auto', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600 }}>
                ➕ Novo Tipo
              </button>
              <button onClick={() => setModalLote(true)} style={{ padding: '0.5rem 1rem', background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontWeight: 600 }}>
                📦 Cadastro em Lote
              </button>
              <button onClick={() => abrirModal()} style={{ padding: '0.5rem 1rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontWeight: 600 }}>
                ➕ Novo Equipamento
              </button>
            </div>
          )}
        </div>

        {/* Filtros */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'center' }}>
          <input type="text" placeholder="🔍 Buscar..." value={busca} onChange={e => setBusca(e.target.value)} style={inp()} />
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={inp()}>
            <option value="todos">Todos os Tipos</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={inp()}>
            <option value="todos">Todos os Status</option>
            <option value="disponivel">✅ Disponível</option>
            <option value="emprestado">🔄 Emprestado</option>
            <option value="manutencao">🔧 Manutenção</option>
            <option value="descartado">🗑️ Descartado</option>
          </select>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
            <strong style={{ color: 'var(--color-text)' }}>{equipamentosFiltrados.length}</strong> equipamento(s)
          </div>
        </div>
      </div>

      {/* ── Tabela ─────────────────────────────────────────────── */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <colgroup>
              <col style={{width:'140px'}} />
              <col style={{width:'140px'}} />
              <col style={{width:'120px'}} />
              <col style={{width:'110px'}} />
              <col style={{width:'110px'}} />
              <col style={{width:'280px'}} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                {[['Patrimônio','left'],['Tipo','left'],['Status','left'],['Conservação','left'],['Dt Aquisição','left'],['Ações','center']].map(([h,align]) => (
                  <th key={h} style={{ padding: '0.65rem 0.75rem', textAlign: align, fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equipamentosFiltrados.map(eq => {
                const st = getStatusStyle(eq.status);
                const es = getEstadoStyle(eq.estado_conservacao);
                return (
                  <tr key={eq.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '0.65rem 0.75rem', maxWidth: '140px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-text)', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {eq.numero_patrimonio}
                      </div>
                      {eq.descricao && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={eq.descricao}>
                          {eq.descricao}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                      {eq.tipos_equipamentos?.nome}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <span style={{ padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, background: st.bg, color: st.cor, border: `1px solid ${st.cor}44`, whiteSpace: 'nowrap' }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <span style={{ padding: '0.2rem 0.55rem', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', fontWeight: 600, background: es.bg, color: es.cor, whiteSpace: 'nowrap' }}>
                        {eq.estado_conservacao}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {eq.data_aquisicao ? new Date(eq.data_aquisicao + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end', flexWrap: 'nowrap', alignItems: 'center' }}>
                        <button onClick={() => setModalHistorico(eq)}
                          style={{ padding: '0.22rem 0.45rem', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}
                          title="Histórico de patrimônios">
                          📋
                        </button>
                        {permissoes?.pode_editar_comodatos && eq.status !== 'descartado' && (
                          <>
                            <button onClick={() => abrirModal(eq)}
                              style={{ padding: '0.22rem 0.45rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}
                              title="Editar">
                              ✏️
                            </button>
                            <button onClick={() => setModalInutilizar(eq)}
                              style={{ padding: '0.22rem 0.45rem', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}
                              title="Inutilizar número de patrimônio">
                              ⚠️ Nº
                            </button>
                            {eq.status !== 'emprestado' && (
                              <>
                                <button onClick={() => descartar(eq.id)}
                                  style={{ padding: '0.22rem 0.45rem', background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.35)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}
                                  title="Descartar">
                                  🗑️
                                </button>
                                <button onClick={() => excluirEquipamento(eq.id)}
                                  style={{ padding: '0.22rem 0.45rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}
                                  title="Excluir permanentemente">
                                  ❌
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {equipamentosFiltrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
            <p style={{ fontSize: '1.1rem' }}>Nenhum equipamento encontrado</p>
          </div>
        )}
      </div>

      {/* ── Modal Equipamento ──────────────────────────────────── */}
      {modalAberto && (
        <div style={modalOverlay}>
          <div style={modalBox()}>
            <div style={modalHead('var(--color-surface-2)')}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
                {editando ? '✏️ Editar Equipamento' : '➕ Novo Equipamento'}
              </h3>
              <button onClick={() => setModalAberto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={salvarEquipamento} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={lbl}>Tipo de Equipamento *</label>
                  <select value={form.tipo_id} onChange={e => setForm({ ...form, tipo_id: e.target.value })} style={inp()} required>
                    <option value="">Selecione...</option>
                    {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Número do Patrimônio *</label>
                  <input type="text" value={form.numero_patrimonio} onChange={e => setForm({ ...form, numero_patrimonio: e.target.value })} style={inp()} required />
                  {editando && form.numero_patrimonio !== editando.numero_patrimonio && (
                    <p style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '0.25rem' }}>
                      ⚠️ Alterar aqui registra no histórico. Para inutilizar use o botão "⚠️ Inutilizar Nº".
                    </p>
                  )}
                </div>
                <div>
                  <label style={lbl}>Estado de Conservação</label>
                  <select value={form.estado_conservacao} onChange={e => setForm({ ...form, estado_conservacao: e.target.value })} style={inp()}>
                    {['Novo', 'Bom', 'Regular', 'Ruim'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inp()}>
                    <option value="disponivel">Disponível</option>
                    <option value="manutencao">Manutenção</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Data de Aquisição</label>
                  <input type="date" value={form.data_aquisicao} onChange={e => setForm({ ...form, data_aquisicao: e.target.value })} style={{ ...inp(), colorScheme: 'dark' }} />
                </div>
                <div>
                  <label style={lbl}>Valor de Aquisição (R$)</label>
                  <input type="number" step="0.01" value={form.valor_aquisicao} onChange={e => setForm({ ...form, valor_aquisicao: e.target.value })} style={inp()} />
                </div>
              </div>
              <div>
                <label style={lbl}>Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} style={{ ...inp(), resize: 'vertical' }} rows={3} />
              </div>
              <div>
                <label style={lbl}>Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} style={{ ...inp(), resize: 'vertical' }} rows={2} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
                <button type="submit" style={{ flex: 1, padding: '0.65rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                  💾 Salvar
                </button>
                <button type="button" onClick={() => setModalAberto(false)} style={{ ...inp(), width: 'auto', padding: '0.65rem 1.25rem', cursor: 'pointer', fontWeight: 600 }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Cadastro em Lote ─────────────────────────────── */}
      {modalLote && (
        <div style={modalOverlay}>
          <div style={modalBox()}>
            <div style={modalHead()}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>📦 Cadastro em Lote</h3>
              <button onClick={() => setModalLote(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={salvarLote} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={lbl}>Tipo de Equipamento *</label>
                  <select value={formLote.tipo_id} onChange={e => setFormLote({ ...formLote, tipo_id: e.target.value })} style={inp()} required>
                    <option value="">Selecione...</option>
                    {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Quantidade *</label>
                  <input type="number" min="1" max="1000" value={formLote.quantidade} onChange={e => setFormLote({ ...formLote, quantidade: parseInt(e.target.value) })} style={inp()} required />
                </div>
                <div>
                  <label style={lbl}>Prefixo do Patrimônio *</label>
                  <input type="text" value={formLote.prefixo_patrimonio} onChange={e => setFormLote({ ...formLote, prefixo_patrimonio: e.target.value })} style={inp()} placeholder="Ex: CR" required />
                </div>
                <div>
                  <label style={lbl}>Número Inicial *</label>
                  <input type="number" min="1" value={formLote.numero_inicial} onChange={e => setFormLote({ ...formLote, numero_inicial: parseInt(e.target.value) })} style={inp()} required />
                </div>
                <div>
                  <label style={lbl}>Estado de Conservação</label>
                  <select value={formLote.estado_conservacao} onChange={e => setFormLote({ ...formLote, estado_conservacao: e.target.value })} style={inp()}>
                    {['Novo', 'Bom', 'Regular', 'Ruim'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Data de Aquisição</label>
                  <input type="date" value={formLote.data_aquisicao} onChange={e => setFormLote({ ...formLote, data_aquisicao: e.target.value })} style={{ ...inp(), colorScheme: 'dark' }} />
                </div>
                <div>
                  <label style={lbl}>Valor Unitário (R$)</label>
                  <input type="number" step="0.01" value={formLote.valor_aquisicao} onChange={e => setFormLote({ ...formLote, valor_aquisicao: e.target.value })} style={inp()} />
                </div>
              </div>
              <div>
                <label style={lbl}>Descrição (aplicada a todos)</label>
                <textarea value={formLote.descricao} onChange={e => setFormLote({ ...formLote, descricao: e.target.value })} style={{ ...inp(), resize: 'vertical' }} rows={2} />
              </div>
              <div style={{ padding: '0.85rem 1rem', background: 'var(--color-accent-bg)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: 'var(--color-text)' }}>
                📋 Serão criados <strong>{formLote.quantidade}</strong> equipamento(s): de{' '}
                <strong style={{ fontFamily: 'monospace' }}>{formLote.prefixo_patrimonio}-{String(formLote.numero_inicial).padStart(3, '0')}</strong> até{' '}
                <strong style={{ fontFamily: 'monospace' }}>{formLote.prefixo_patrimonio}-{String(formLote.numero_inicial + formLote.quantidade - 1).padStart(3, '0')}</strong>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
                <button type="submit" style={{ flex: 1, padding: '0.65rem', background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontWeight: 700 }}>
                  💾 Cadastrar {formLote.quantidade} Equipamento(s)
                </button>
                <button type="button" onClick={() => setModalLote(false)} style={{ ...inp(), width: 'auto', padding: '0.65rem 1.25rem', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Novo Tipo ────────────────────────────────────── */}
      {modalTipo && (
        <div style={modalOverlay}>
          <div style={modalBox('28rem')}>
            <div style={modalHead()}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>➕ Novo Tipo de Equipamento</h3>
              <button onClick={() => setModalTipo(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={salvarTipo} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={lbl}>Nome do Tipo *</label>
                <input type="text" value={formTipo.nome} onChange={e => setFormTipo({ ...formTipo, nome: e.target.value })} style={inp()} placeholder="Ex: Cadeira de Rodas Motorizada" required />
              </div>
              <div>
                <label style={lbl}>Descrição</label>
                <textarea value={formTipo.descricao} onChange={e => setFormTipo({ ...formTipo, descricao: e.target.value })} style={{ ...inp(), resize: 'vertical' }} rows={3} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
                <button type="submit" style={{ flex: 1, padding: '0.65rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontWeight: 700 }}>
                  💾 Salvar Tipo
                </button>
                <button type="button" onClick={() => setModalTipo(false)} style={{ ...inp(), width: 'auto', padding: '0.65rem 1.25rem', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Inutilizar Patrimônio ────────────────────────── */}
      {modalInutilizar && (
        <ModalInutilizar
          equipamento={modalInutilizar}
          onFechar={() => setModalInutilizar(null)}
          onSalvar={handleInutilizar}
        />
      )}

      {/* ── Modal Histórico de Patrimônio ──────────────────────── */}
      {modalHistorico && (
        <ModalHistoricoPatrimonio
          equipamento={modalHistorico}
          onFechar={() => setModalHistorico(null)}
        />
      )}
    </div>
  );
}
