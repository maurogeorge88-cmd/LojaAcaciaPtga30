import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { gerarRelatorioComendasPDF } from '../../utils/gerarRelatorioComendasPDF';

// Mesma lista/normalização já usada no resto do sistema pra identificar
// licença, desligamento etc. no histórico de situações.
const normalizar = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const TIPOS_BLOQUEIO = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio', 'licenca'];

const TIPOS_CRITERIO = [
  { value: 'tempo_maconaria', label: 'Tempo de Maçonaria (anos desde a iniciação)' },
  { value: 'origem_demolay_lowton', label: 'Origem DeMolay/Lowtons + tempo de Maçonaria' },
  { value: 'macom_100_acumulado', label: 'Acúmulo de anos com "Maçom 100%"' },
  { value: 'manual', label: 'Manual (sem cálculo automático)' },
];

const anosDesde = (data) => {
  if (!data) return 0;
  const inicio = new Date(data + 'T00:00:00');
  const hoje = new Date();
  let anos = hoje.getFullYear() - inicio.getFullYear();
  const m = hoje.getMonth() - inicio.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < inicio.getDate())) anos--;
  return anos;
};

export default function Comendas({ permissoes, showSuccess, showError }) {
  const podeEditar = !!permissoes?.canEdit;

  const [aba, setAba] = useState('elegiveis');
  const [loading, setLoading] = useState(true);

  const [comendas, setComendas] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [historicoSituacoes, setHistoricoSituacoes] = useState([]);
  const [sessoes, setSessoes] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [irmaosComendas, setIrmaosComendas] = useState([]);
  const [dadosLoja, setDadosLoja] = useState(null);

  const [modalEntrega, setModalEntrega] = useState(null); // { irmao, comenda }
  const [entregaForm, setEntregaForm] = useState({ data_entrega: new Date().toISOString().split('T')[0], observacoes: '' });

  const [comendaForm, setComendaForm] = useState({
    nome: '', descricao_criterio: '', tipo_criterio: 'tempo_maconaria',
    anos_necessarios: '', requer_mestre_instalado: '', qtd_necessaria: '',
  });
  const [editandoComendaId, setEditandoComendaId] = useState(null);

  useEffect(() => {
    carregarTudo();
    supabase.from('dados_loja').select('*').single().then(({ data }) => { if (data) setDadosLoja(data); });
  }, []);

  const carregarTudo = async () => {
    setLoading(true);
    try {
      const [
        { data: comendasData },
        { data: irmaosData },
        { data: historicoData },
        { data: sessoesData },
        { data: irmaosComendasData },
      ] = await Promise.all([
        supabase.from('comendas').select('*').order('nome'),
        supabase.from('irmaos').select('id, nome, cim, data_iniciacao, data_elevacao, data_exaltacao, data_ingresso_loja, mestre_instalado, oriundo_demolay_lowton, status').eq('status', 'ativo'),
        supabase.from('historico_situacoes').select('*'),
        supabase.from('sessoes_presenca').select('id, data_sessao, grau_sessao_id'),
        supabase.from('irmaos_comendas').select('*, irmaos(nome, cim), comendas(nome)').order('data_entrega', { ascending: false }),
      ]);

      setComendas(comendasData || []);
      setIrmaos(irmaosData || []);
      setHistoricoSituacoes(historicoData || []);
      setSessoes(sessoesData || []);
      setIrmaosComendas(irmaosComendasData || []);

      // Registros de presença — paginado, pode ser um histórico grande
      const sessaoIds = (sessoesData || []).map(s => s.id);
      let todos = [], inicio = 0;
      const pagina = 1000;
      while (sessaoIds.length > 0) {
        const { data: lote } = await supabase
          .from('registros_presenca')
          .select('membro_id, presente, sessao_id')
          .in('sessao_id', sessaoIds)
          .range(inicio, inicio + pagina - 1);
        if (!lote || lote.length === 0) break;
        todos = todos.concat(lote);
        if (lote.length < pagina) break;
        inicio += pagina;
      }
      setRegistros(todos);
    } catch (e) {
      showError?.('Erro ao carregar dados de comendas: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Teve licença/desligamento/etc. alguma vez? Desqualifica de vez (regra
  // confirmada: não é descontar tempo, é perder o direito por completo). ──
  const temInterrupcao = (irmaoId) => {
    return historicoSituacoes.some(s => {
      if (s.membro_id !== irmaoId) return false;
      const tipo = normalizar(s.tipo_situacao);
      return TIPOS_BLOQUEIO.some(b => tipo.includes(b));
    });
  };

  // ── Quantos anos esse irmão já bateu 100% de presença — mesma lógica do
  // card "Presença 100%" do Dashboard, só que rodada ano a ano (não só o
  // ano corrente) e contando quantos anos bateram. ──────────────────────
  const anos100PorIrmao = useMemo(() => {
    const porIrmao = {};
    if (sessoes.length === 0) return porIrmao;

    const anoMin = Math.min(...sessoes.map(s => new Date(s.data_sessao).getFullYear()));
    const anoAtual = new Date().getFullYear();
    const sessoesPorId = Object.fromEntries(sessoes.map(s => [s.id, s]));

    irmaos.forEach(irmao => {
      let grauIrmao = 0;
      if (irmao.data_exaltacao) grauIrmao = 3;
      else if (irmao.data_elevacao) grauIrmao = 2;
      else if (irmao.data_iniciacao) grauIrmao = 1;
      if (grauIrmao === 0) return;

      const dataInicio = irmao.data_ingresso_loja ? new Date(irmao.data_ingresso_loja) : (irmao.data_iniciacao ? new Date(irmao.data_iniciacao) : null);
      let anosCem = 0;

      for (let ano = anoMin; ano <= anoAtual; ano++) {
        const fimAno = ano === anoAtual ? new Date() : new Date(ano, 11, 31);
        let totalRegistros = 0, presentes = 0;

        registros.forEach(reg => {
          if (reg.membro_id !== irmao.id) return;
          const sessao = sessoesPorId[reg.sessao_id];
          if (!sessao) return;
          const dataSessao = new Date(sessao.data_sessao);
          if (dataSessao.getFullYear() !== ano || dataSessao > fimAno) return;

          let grauSessao = sessao.grau_sessao_id === 4 ? 1 : (sessao.grau_sessao_id || 1);
          if (dataInicio && dataSessao < dataInicio) return;
          if (grauSessao > grauIrmao) return;

          const situacaoNaData = historicoSituacoes.find(sit =>
            sit.membro_id === irmao.id &&
            dataSessao >= new Date(sit.data_inicio + 'T00:00:00') &&
            (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'))
          );
          if (situacaoNaData) return;

          totalRegistros++;
          if (reg.presente) presentes++;
        });

        if (totalRegistros > 0 && presentes === totalRegistros) anosCem++;
      }
      porIrmao[irmao.id] = anosCem;
    });

    return porIrmao;
  }, [irmaos, sessoes, registros, historicoSituacoes]);

  // ── Elegibilidade por comenda ────────────────────────────────────────────
  const jaRecebeu = (irmaoId, comendaId) => irmaosComendas.some(ic => ic.irmao_id === irmaoId && ic.comenda_id === comendaId);

  const ehElegivel = (irmao, comenda) => {
    switch (comenda.tipo_criterio) {
      case 'tempo_maconaria': {
        if (!irmao.data_iniciacao || temInterrupcao(irmao.id)) return false;
        if (anosDesde(irmao.data_iniciacao) < (comenda.anos_necessarios || 0)) return false;
        if (comenda.requer_mestre_instalado !== null && comenda.requer_mestre_instalado !== undefined) {
          if (!!irmao.mestre_instalado !== comenda.requer_mestre_instalado) return false;
        }
        return true;
      }
      case 'origem_demolay_lowton': {
        if (!irmao.oriundo_demolay_lowton) return false;
        if (!irmao.data_iniciacao || temInterrupcao(irmao.id)) return false;
        return anosDesde(irmao.data_iniciacao) >= (comenda.anos_necessarios || 0);
      }
      case 'macom_100_acumulado':
        return (anos100PorIrmao[irmao.id] || 0) >= (comenda.qtd_necessaria || 0);
      case 'manual':
      default:
        return false;
    }
  };

  const elegiveisPorComenda = useMemo(() => {
    const mapa = {};
    comendas.filter(c => c.ativo).forEach(comenda => {
      mapa[comenda.id] = irmaos.filter(i => !jaRecebeu(i.id, comenda.id) && ehElegivel(i, comenda));
    });
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comendas, irmaos, irmaosComendas, anos100PorIrmao, historicoSituacoes]);

  // ── Relatório em PDF: um quadro por comenda ativa, igual à aba Elegíveis ──
  const gerarPdf = () => {
    try {
      const dados = comendas.filter(c => c.ativo).map(c => ({
        nome: c.nome,
        descricao_criterio: c.descricao_criterio,
        tipo_criterio: c.tipo_criterio,
        elegiveis: (elegiveisPorComenda[c.id] || []).map(i => ({ nome: i.nome, cim: i.cim })),
      }));
      if (dados.length === 0) { showError?.('Nenhuma comenda ativa pra gerar o relatório.'); return; }
      gerarRelatorioComendasPDF(dados, dadosLoja);
    } catch (e) {
      showError?.('Erro ao gerar PDF: ' + e.message);
    }
  };

  // ── Entregar comenda ─────────────────────────────────────────────────────
  const abrirEntrega = (irmao, comenda) => {
    setModalEntrega({ irmao, comenda });
    setEntregaForm({ data_entrega: new Date().toISOString().split('T')[0], observacoes: '' });
  };

  const confirmarEntrega = async () => {
    try {
      const { error } = await supabase.from('irmaos_comendas').insert({
        irmao_id: modalEntrega.irmao.id,
        comenda_id: modalEntrega.comenda.id,
        data_entrega: entregaForm.data_entrega,
        observacoes: entregaForm.observacoes || null,
      });
      if (error) throw error;
      showSuccess?.(`✅ ${modalEntrega.comenda.nome} entregue a ${modalEntrega.irmao.nome}!`);
      setModalEntrega(null);
      carregarTudo();
    } catch (e) {
      showError?.('Erro ao registrar entrega: ' + e.message);
    }
  };

  const excluirEntrega = async (id) => {
    if (!window.confirm('Remover este registro de entrega? O irmão volta a aparecer como elegível.')) return;
    try {
      const { error } = await supabase.from('irmaos_comendas').delete().eq('id', id);
      if (error) throw error;
      showSuccess?.('✅ Registro removido.');
      carregarTudo();
    } catch (e) {
      showError?.('Erro ao remover: ' + e.message);
    }
  };

  // ── CRUD de comendas (cadastro extensível) ──────────────────────────────
  const iniciarEdicaoComenda = (c) => {
    setEditandoComendaId(c.id);
    setComendaForm({
      nome: c.nome, descricao_criterio: c.descricao_criterio || '', tipo_criterio: c.tipo_criterio,
      anos_necessarios: c.anos_necessarios ?? '', requer_mestre_instalado: c.requer_mestre_instalado === null || c.requer_mestre_instalado === undefined ? '' : String(c.requer_mestre_instalado),
      qtd_necessaria: c.qtd_necessaria ?? '',
    });
  };

  const cancelarEdicaoComenda = () => {
    setEditandoComendaId(null);
    setComendaForm({ nome: '', descricao_criterio: '', tipo_criterio: 'tempo_maconaria', anos_necessarios: '', requer_mestre_instalado: '', qtd_necessaria: '' });
  };

  const salvarComenda = async (e) => {
    e.preventDefault();
    if (!comendaForm.nome.trim()) { showError?.('Informe o nome da comenda.'); return; }
    try {
      const payload = {
        nome: comendaForm.nome.trim(),
        descricao_criterio: comendaForm.descricao_criterio || null,
        tipo_criterio: comendaForm.tipo_criterio,
        anos_necessarios: comendaForm.anos_necessarios !== '' ? parseInt(comendaForm.anos_necessarios) : null,
        requer_mestre_instalado: comendaForm.requer_mestre_instalado === '' ? null : comendaForm.requer_mestre_instalado === 'true',
        qtd_necessaria: comendaForm.qtd_necessaria !== '' ? parseInt(comendaForm.qtd_necessaria) : null,
      };
      if (editandoComendaId) {
        const { error } = await supabase.from('comendas').update(payload).eq('id', editandoComendaId);
        if (error) throw error;
        showSuccess?.('✅ Comenda atualizada!');
      } else {
        const { error } = await supabase.from('comendas').insert(payload);
        if (error) throw error;
        showSuccess?.('✅ Comenda cadastrada!');
      }
      cancelarEdicaoComenda();
      carregarTudo();
    } catch (e2) {
      showError?.('Erro ao salvar comenda: ' + e2.message);
    }
  };

  const alternarAtivoComenda = async (c) => {
    try {
      const { error } = await supabase.from('comendas').update({ ativo: !c.ativo }).eq('id', c.id);
      if (error) throw error;
      carregarTudo();
    } catch (e) {
      showError?.('Erro ao alterar comenda: ' + e.message);
    }
  };

  const excluirComenda = async (id) => {
    if (!window.confirm('Excluir esta comenda? O histórico de quem já recebeu também será apagado.')) return;
    try {
      const { error } = await supabase.from('comendas').delete().eq('id', id);
      if (error) throw error;
      showSuccess?.('✅ Comenda excluída.');
      carregarTudo();
    } catch (e) {
      showError?.('Erro ao excluir: ' + e.message);
    }
  };

  const sInp = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' };
  const sLabel = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' };

  if (loading) return <div className="p-10 text-center" style={{ color: 'var(--color-text-muted)' }}>Carregando comendas...</div>;

  return (
    <div className="p-6" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>🎖️ Comendas</h2>
        <button onClick={gerarPdf}
          style={{ padding: '0.5rem 1.2rem', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
          📄 Gerar PDF
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem' }}>
        {[['elegiveis', '✅ Elegíveis'], ['comendados', '📜 Comendados'], ['cadastrar', '⚙️ Cadastrar Comenda']].map(([v, l]) => (
          <button key={v} onClick={() => setAba(v)}
            style={{ padding: '0.45rem 1rem', borderRadius: 'var(--radius-lg)', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', background: aba === v ? 'var(--color-accent)' : 'var(--color-surface-2)', color: aba === v ? '#fff' : 'var(--color-text)' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── ELEGÍVEIS ──────────────────────────────────────────────────── */}
      {aba === 'elegiveis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {comendas.filter(c => c.ativo).length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>Nenhuma comenda cadastrada ainda.</p>
          )}
          {comendas.filter(c => c.ativo).map(comenda => {
            const lista = elegiveisPorComenda[comenda.id] || [];
            return (
              <div key={comenda.id} style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <div style={{ padding: '0.85rem 1.25rem', background: 'var(--color-accent)' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{comenda.nome}</span>
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)' }}>{lista.length} elegível(is)</span>
                </div>
                {comenda.descricao_criterio && (
                  <p style={{ margin: 0, padding: '0.6rem 1.25rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                    {comenda.descricao_criterio}
                  </p>
                )}
                {comenda.tipo_criterio === 'manual' ? (
                  <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1rem', margin: 0, background: 'var(--color-surface)' }}>
                    Critério manual — use a aba "Comendados" pra registrar entregas diretamente.
                  </p>
                ) : lista.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1rem', margin: 0, background: 'var(--color-surface)' }}>Nenhum irmão elegível no momento.</p>
                ) : (
                  <div style={{ background: 'var(--color-surface)' }}>
                    {lista.map((irmao, idx) => (
                      <div key={irmao.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1.25rem', borderBottom: idx < lista.length - 1 ? '1px solid var(--color-border)' : 'none', borderLeft: '4px solid #f59e0b', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 800, color: '#f59e0b', fontSize: '0.95rem' }}>{irmao.nome}</p>
                          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>CIM: {irmao.cim || '—'}</p>
                        </div>
                        {podeEditar && (
                          <button onClick={() => abrirEntrega(irmao, comenda)}
                            style={{ padding: '0.4rem 0.9rem', background: '#c9a84c', color: '#1a1a1a', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0 }}>
                            🎖️ Entregar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── COMENDADOS ─────────────────────────────────────────────────── */}
      {aba === 'comendados' && (
        <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
          {irmaosComendas.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem', margin: 0 }}>Nenhuma comenda entregue ainda.</p>
          ) : irmaosComendas.map((ic, idx) => (
            <div key={ic.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1.1rem', borderBottom: idx < irmaosComendas.length - 1 ? '1px solid var(--color-border)' : 'none', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
              <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🎖️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: '0.88rem' }}>{ic.irmaos?.nome || '—'}</p>
                <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                  {ic.comendas?.nome || '—'} — {new Date(ic.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR')}
                  {ic.observacoes ? ` · ${ic.observacoes}` : ''}
                </p>
              </div>
              {podeEditar && (
                <button onClick={() => excluirEntrega(ic.id)}
                  style={{ padding: '0.25rem 0.55rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0 }}>
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── CADASTRAR COMENDA ──────────────────────────────────────────── */}
      {aba === 'cadastrar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {podeEditar && (
            <form onSubmit={salvarComenda} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 1rem' }}>
                {editandoComendaId ? '✏️ Editar Comenda' : '➕ Nova Comenda'}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={sLabel}>Nome da Comenda *</label>
                  <input value={comendaForm.nome} onChange={e => setComendaForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Comenda Ir∴ Fulano de Tal" style={sInp} />
                </div>
                <div>
                  <label style={sLabel}>Descrição do Critério</label>
                  <textarea value={comendaForm.descricao_criterio} onChange={e => setComendaForm(f => ({ ...f, descricao_criterio: e.target.value }))} rows={2} placeholder="Texto explicando o critério, exibido na aba Elegíveis" style={{ ...sInp, resize: 'vertical' }} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: '0.85rem' }}>
                <div>
                  <label style={sLabel}>Tipo de Critério *</label>
                  <select value={comendaForm.tipo_criterio} onChange={e => setComendaForm(f => ({ ...f, tipo_criterio: e.target.value }))} style={sInp}>
                    {TIPOS_CRITERIO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                {(comendaForm.tipo_criterio === 'tempo_maconaria' || comendaForm.tipo_criterio === 'origem_demolay_lowton') && (
                  <div>
                    <label style={sLabel}>Anos Necessários *</label>
                    <input type="number" min="1" value={comendaForm.anos_necessarios} onChange={e => setComendaForm(f => ({ ...f, anos_necessarios: e.target.value }))} style={sInp} />
                  </div>
                )}

                {comendaForm.tipo_criterio === 'tempo_maconaria' && (
                  <div>
                    <label style={sLabel}>Exige Mestre Instalado?</label>
                    <select value={comendaForm.requer_mestre_instalado} onChange={e => setComendaForm(f => ({ ...f, requer_mestre_instalado: e.target.value }))} style={sInp}>
                      <option value="">Não importa</option>
                      <option value="true">Sim, precisa ser instalado</option>
                      <option value="false">Não pode ser instalado</option>
                    </select>
                  </div>
                )}

                {comendaForm.tipo_criterio === 'macom_100_acumulado' && (
                  <div>
                    <label style={sLabel}>Quantidade de Anos com 100% *</label>
                    <input type="number" min="1" value={comendaForm.qtd_necessaria} onChange={e => setComendaForm(f => ({ ...f, qtd_necessaria: e.target.value }))} style={sInp} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                {editandoComendaId && (
                  <button type="button" onClick={cancelarEdicaoComenda}
                    style={{ padding: '0.55rem 1.1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                )}
                <button type="submit"
                  style={{ padding: '0.55rem 1.4rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer' }}>
                  {editandoComendaId ? '💾 Atualizar' : '💾 Cadastrar'}
                </button>
              </div>
            </form>
          )}

          <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            {comendas.map((c, idx) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1.1rem', borderBottom: idx < comendas.length - 1 ? '1px solid var(--color-border)' : 'none', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', opacity: c.ativo ? 1 : 0.55 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: '0.88rem' }}>{c.nome} {!c.ativo && '(inativa)'}</p>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{TIPOS_CRITERIO.find(t => t.value === c.tipo_criterio)?.label}</p>
                </div>
                {podeEditar && (
                  <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                    <button onClick={() => iniciarEdicaoComenda(c)} title="Editar"
                      style={{ padding: '0.25rem 0.55rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', cursor: 'pointer' }}>✏️</button>
                    <button onClick={() => alternarAtivoComenda(c)} title={c.ativo ? 'Desativar' : 'Ativar'}
                      style={{ padding: '0.25rem 0.55rem', background: 'rgba(148,163,184,0.15)', color: '#64748b', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', cursor: 'pointer' }}>{c.ativo ? '⏸️' : '▶️'}</button>
                    <button onClick={() => excluirComenda(c.id)} title="Excluir"
                      style={{ padding: '0.25rem 0.55rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', cursor: 'pointer' }}>🗑️</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal de entrega ───────────────────────────────────────────── */}
      {modalEntrega && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setModalEntrega(null)}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', maxWidth: '420px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.3rem' }}>🎖️ Entregar Comenda</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>{modalEntrega.comenda.nome} → <strong style={{ color: 'var(--color-text)' }}>{modalEntrega.irmao.nome}</strong></p>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={sLabel}>Data da Entrega *</label>
              <input type="date" value={entregaForm.data_entrega} onChange={e => setEntregaForm(f => ({ ...f, data_entrega: e.target.value }))} style={sInp} />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={sLabel}>Observações</label>
              <input value={entregaForm.observacoes} onChange={e => setEntregaForm(f => ({ ...f, observacoes: e.target.value }))} style={sInp} />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setModalEntrega(null)}
                style={{ flex: 1, padding: '0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={confirmarEntrega}
                style={{ flex: 2, padding: '0.6rem', background: '#c9a84c', color: '#1a1a1a', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer' }}>
                🎖️ Confirmar Entrega
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
