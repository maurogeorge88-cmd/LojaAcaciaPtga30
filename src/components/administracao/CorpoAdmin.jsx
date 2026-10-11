/**
 * COMPONENTE CORPO ADMINISTRATIVO
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { CARGOS_ADMINISTRATIVOS } from '../../utils/constants';

const STATUS_ELEICAO = {
  rascunho:            { label: 'Em Processo de Eleição', emoji: '📝', cor: '#f59e0b' },
  eleicao_realizada:   { label: 'Eleita — Aguardando Posse', emoji: '✅', cor: '#3b82f6' },
  posse_realizada:     { label: 'Empossada', emoji: '🎖️', cor: '#10b981' },
  registrado_cartorio: { label: 'Registrada em Cartório', emoji: '🏛️', cor: '#d97706' },
};

const formatarData = (d) => {
  if (!d) return '';
  const [ano, mes, dia] = d.split('-');
  return `${dia}/${mes}/${ano}`;
};

// Ordem hierárquica maçônica — mesma lista oficial usada no cadastro (CARGOS_ADMINISTRATIVOS),
// garantindo que a ordem de exibição sempre bata com os valores realmente salvos no banco.
const ORDEM_CARGOS_ADM = CARGOS_ADMINISTRATIVOS;

export const CorpoAdmin = ({ 
  corpoAdmin, 
  irmaos, 
  permissoes, 
  onUpdate,
  showSuccess,
  showError 
}) => {
  const [eleicaoAtiva, setEleicaoAtiva] = React.useState(null);
  const [chapasEleicao, setChapasEleicao] = React.useState([]);

  React.useEffect(() => {
    carregarEleicaoAtiva();
  }, []);

  const carregarEleicaoAtiva = async () => {
    try {
      const { data } = await supabase
        .from('eleicoes')
        .select('*')
        .in('status', ['rascunho','eleicao_realizada','posse_realizada','registrado_cartorio'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setEleicaoAtiva(data);
        const { data: chapas } = await supabase
          .from('eleicao_chapas')
          .select('*')
          .eq('eleicao_id', data.id)
          .eq('eleita', true)
          .order('ordem');
        setChapasEleicao(chapas || []);
      }
    } catch (e) {
      console.error('Erro ao carregar eleição ativa:', e);
    }
  };
  const [corpoAdminForm, setCorpoAdminForm] = useState({
    irmao_id: '',
    cargo: '',
    ano_exercicio: new Date().getFullYear().toString()
  });
  
  const [modoEdicaoCorpoAdmin, setModoEdicaoCorpoAdmin] = useState(false);
  const [corpoAdminEditando, setCorpoAdminEditando] = useState(null);
  const [anoFiltroAdmin, setAnoFiltroAdmin] = useState('');
  const [loading, setLoading] = useState(false);

  const cargosAdministrativos = CARGOS_ADMINISTRATIVOS;
  const podeEditarCorpo = !!permissoes?.pode_editar_corpo_admin;

  // ── Modal: cadastrar/editar todos os cargos de um ano de uma vez ──
  const [modalCorpo, setModalCorpo] = useState(false);
  const [anoModal, setAnoModal] = useState(new Date().getFullYear().toString());
  const [cargosModal, setCargosModal] = useState({}); // { cargo: irmao_id }
  const [salvandoModal, setSalvandoModal] = useState(false);
  const irmaosAtivosOrdenados = (irmaos || []).filter(i => i.status === 'ativo').sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  const carregarAnoNoModal = (ano) => {
    const mapa = {};
    corpoAdmin.filter(ca => String(ca.ano_exercicio) === String(ano)).forEach(ca => { mapa[ca.cargo] = String(ca.irmao_id ?? ''); });
    setCargosModal(mapa);
  };
  const abrirModalCorpo = (ano = new Date().getFullYear().toString()) => {
    setAnoModal(String(ano));
    carregarAnoNoModal(ano);
    setModalCorpo(true);
  };
  const copiarAnoAnterior = () => {
    const anos = [...new Set(corpoAdmin.map(ca => String(ca.ano_exercicio)))].filter(a => a < String(anoModal)).sort().reverse();
    if (!anos.length) { showError('Não há ano anterior cadastrado para copiar.'); return; }
    carregarAnoNoModal(anos[0]);
    showSuccess(`Cargos copiados de ${anos[0]} — revise e salve.`);
  };
  const salvarModalCorpo = async () => {
    if (!anoModal) { showError('Informe o ano de exercício.'); return; }
    setSalvandoModal(true);
    try {
      const existentes = corpoAdmin.filter(ca => String(ca.ano_exercicio) === String(anoModal));
      const inserir = [], atualizar = [], excluir = [];
      cargosAdministrativos.forEach(cargo => {
        const val = cargosModal[cargo] || '';
        const ex = existentes.find(ca => ca.cargo === cargo);
        if (val && !ex) inserir.push({ cargo, irmao_id: val, ano_exercicio: String(anoModal) });
        else if (val && ex && String(ex.irmao_id) !== String(val)) atualizar.push({ id: ex.id, irmao_id: val });
        else if (!val && ex) excluir.push(ex.id);
      });
      if (inserir.length) {
        const { error } = await supabase.from('corpo_administrativo').insert(inserir);
        if (error) throw error;
      }
      for (const u of atualizar) {
        const { data, error } = await supabase.from('corpo_administrativo').update({ irmao_id: u.irmao_id }).eq('id', u.id).select();
        if (error) throw error;
        if (!data?.length) throw new Error('o banco não permitiu a alteração (sem permissão).');
      }
      if (excluir.length) {
        const { data, error } = await supabase.from('corpo_administrativo').delete().in('id', excluir).select();
        if (error) throw error;
        if ((data || []).length < excluir.length) throw new Error('o banco não permitiu remover todos os cargos (sem permissão).');
      }
      showSuccess(`✅ Corpo Administrativo ${anoModal} salvo (${inserir.length} novo(s), ${atualizar.length} alterado(s), ${excluir.length} removido(s)).`);
      setModalCorpo(false);
      onUpdate();
    } catch (err) {
      showError('Erro ao salvar: ' + err.message);
    } finally {
      setSalvandoModal(false);
    }
  };

  // Faixas por ano recolhidas; clique expande
  const [anosAbertos, setAnosAbertos] = useState({});
  const alternarAno = (ano) => setAnosAbertos(a => ({ ...a, [ano]: !a[ano] }));

  const limparFormularioCorpoAdmin = () => {
    setCorpoAdminForm({
      irmao_id: '',
      cargo: '',
      ano_exercicio: new Date().getFullYear().toString()
    });
    setModoEdicaoCorpoAdmin(false);
    setCorpoAdminEditando(null);
  };

  const handleSubmitCorpoAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('corpo_administrativo')
        .insert([corpoAdminForm]);

      if (error) throw error;

      showSuccess('✅ Cargo administrativo registrado com sucesso!');
      limparFormularioCorpoAdmin();
      onUpdate();
    } catch (err) {
      showError('Erro ao registrar cargo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarCorpoAdmin = (item) => {
    setCorpoAdminForm({
      irmao_id: item.irmao_id,
      cargo: item.cargo,
      ano_exercicio: item.ano_exercicio
    });
    setModoEdicaoCorpoAdmin(true);
    setCorpoAdminEditando(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAtualizarCorpoAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('corpo_administrativo')
        .update(corpoAdminForm)
        .eq('id', corpoAdminEditando.id);

      if (error) throw error;

      showSuccess('✅ Cargo administrativo atualizado com sucesso!');
      limparFormularioCorpoAdmin();
      onUpdate();
    } catch (err) {
      showError('Erro ao atualizar cargo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirCorpoAdmin = async (id) => {
    if (!confirm('Tem certeza que deseja remover este cargo?')) return;

    try {
      const { error } = await supabase
        .from('corpo_administrativo')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('✅ Cargo administrativo removido com sucesso!');
      onUpdate();
    } catch (err) {
      showError('Erro ao remover cargo: ' + err.message);
    }
  };

  return (
    <div style={{ 
      padding: '2rem', 
      background: 'var(--color-bg)', 
      minHeight: '100vh' 
    }}>

      {/* ── BANNER: DIRETORIA ELEITA / EM PROCESSO ── */}
      {eleicaoAtiva && (
        <div style={{
          marginBottom: '1.5rem',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          {/* Cabeçalho do banner */}
          <div style={{
            padding: '1rem 1.5rem',
            background: 'var(--color-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <span style={{ fontWeight: '700', fontSize: '1rem', color: 'white' }}>
                {STATUS_ELEICAO[eleicaoAtiva.status]?.emoji} Gestão {eleicaoAtiva.gestao}
              </span>
              {eleicaoAtiva.data_posse && (
                <span style={{ marginLeft: '1rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>
                  Posse: {formatarData(eleicaoAtiva.data_posse)}
                </span>
              )}
            </div>
            <span style={{
              background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '0.75rem',
              fontWeight: '700', padding: '0.25rem 0.75rem', borderRadius: '999px',
            }}>
              {STATUS_ELEICAO[eleicaoAtiva.status]?.label}
            </span>
          </div>

          {/* Grade de cargos eleitos */}
          {chapasEleicao.length > 0 && (
            <div style={{ padding: '1rem 1.5rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '0.5rem',
              }}>
                {chapasEleicao
                  .sort((a, b) => {
                    const indexA = ORDEM_CARGOS_ADM.indexOf(a.cargo);
                    const indexB = ORDEM_CARGOS_ADM.indexOf(b.cargo);
                    if (indexA === -1 && indexB === -1) return (a.cargo || '').localeCompare(b.cargo || '');
                    if (indexA === -1) return 1;  // cargo não reconhecido vai para o fim
                    if (indexB === -1) return -1;
                    return indexA - indexB;
                  })
                  .map(c => {
                    const irmao = irmaos?.find(i => i.id === c.irmao_id);
                    return (
                      <div key={c.id} style={{
                        display: 'flex', gap: '0.6rem', alignItems: 'center',
                        padding: '0.4rem 0.75rem',
                        background: 'var(--color-surface-2)',
                        borderRadius: 'var(--radius-md)',
                      }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-accent)', minWidth: '140px' }}>
                          {c.cargo}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>
                          {irmao?.nome || '—'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CADASTRO EM LOTE (modal) */}
      {podeEditarCorpo && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button onClick={() => abrirModalCorpo()}
            style={{ padding: '0.6rem 1.2rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer' }}>
            ➕ Cadastrar / Editar Corpo Administrativo
          </button>
        </div>
      )}

      {modalCorpo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setModalCorpo(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '900px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, flex: 1, fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>👔 Corpo Administrativo</h3>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Ano de exercício</label>
              <input className="form-input" style={{ width: '110px' }} value={anoModal}
                onChange={e => { setAnoModal(e.target.value); if (/^\d{4}$/.test(e.target.value)) carregarAnoNoModal(e.target.value); }} />
              <button type="button" onClick={copiarAnoAnterior}
                style={{ padding: '0.45rem 0.85rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                ↺ Copiar do ano anterior
              </button>
            </div>
            <div style={{ padding: '1rem 1.25rem', overflowY: 'auto' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                {cargosAdministrativos.map(cargo => {
                  const repetido = cargosModal[cargo] && Object.entries(cargosModal).some(([c, v]) => c !== cargo && v && v === cargosModal[cargo]);
                  return (
                    <div key={cargo} style={{ display: 'grid', gridTemplateColumns: '170px minmax(0,1fr)', gap: '0.5rem', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: repetido ? '#ef4444' : 'var(--color-text-muted)' }}>{cargo}</label>
                      <select className="form-input" value={cargosModal[cargo] || ''}
                        onChange={e => setCargosModal(m => ({ ...m, [cargo]: e.target.value }))}
                        style={repetido ? { border: '2px solid #ef4444' } : undefined}>
                        <option value="">— vago —</option>
                        {irmaosAtivosOrdenados.map(i => <option key={i.id} value={String(i.id)}>{i.nome}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '0.75rem 0 0' }}>
                Campo "— vago —" remove o cargo do ano. Em vermelho: irmão escolhido em mais de um cargo.
              </p>
            </div>
            <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setModalCorpo(false)}
                style={{ padding: '0.6rem 1.2rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarModalCorpo} disabled={salvandoModal}
                style={{ padding: '0.6rem 1.2rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer', opacity: salvandoModal ? 0.6 : 1 }}>
                {salvandoModal ? 'Salvando...' : '💾 Salvar todos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FILTRO POR ANO */}
      <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <div className="flex gap-4 items-center">
          <label style={{ fontWeight: '600', color: 'var(--color-text)' }}>Filtrar por Ano:</label>
          <input
            type="text"
            placeholder="Digite o ano (ex: 2024)"
            value={anoFiltroAdmin}
            onChange={(e) => setAnoFiltroAdmin(e.target.value)}
            className="form-input"
            style={{ flex: 1 }}
            pattern="[0-9]*"
          />
          {anoFiltroAdmin && (
            <button
              onClick={() => setAnoFiltroAdmin('')}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--color-surface-2)',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontWeight: '600',
                color: 'var(--color-text)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--color-surface-3)'}
              onMouseLeave={(e) => e.target.style.background = 'var(--color-surface-2)'}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* LISTA POR ANO */}
      <div className="space-y-6">
        {[...new Set(corpoAdmin
          .filter(ca => !anoFiltroAdmin || ca.ano_exercicio?.includes(anoFiltroAdmin))
          .map(ca => ca.ano_exercicio))]
          .sort((a, b) => b - a)
          .map(ano => (
            <div key={ano} className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div onClick={() => alternarAno(ano)} style={{ 
                padding: '0.85rem 1rem', 
                background: 'var(--color-accent)', 
                color: 'white',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem'
              }}>
                <span style={{ fontSize: '0.9rem', transition: 'transform 0.2s', transform: anosAbertos[ano] ? 'rotate(90deg)' : 'none' }}>▶</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>Administração {ano}</h3>
                  <p style={{ fontSize: '0.8rem', opacity: 0.9, margin: 0 }}>
                    {corpoAdmin.filter(ca => ca.ano_exercicio === ano).length} cargos
                  </p>
                </div>
                {podeEditarCorpo && (
                  <button onClick={e => { e.stopPropagation(); abrirModalCorpo(ano); }}
                    style={{ padding: '0.35rem 0.8rem', background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                    ✏️ Editar ano
                  </button>
                )}
              </div>

              {anosAbertos[ano] && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{padding:'1rem', gap:'0.75rem'}}>

                    {corpoAdmin
                      .filter(ca => ca.ano_exercicio === ano)
                      .sort((a, b) => {
                        // Normalizar e mapear cargos para hierarquia
                        const normalizarCargo = (cargo) => {
                          if (!cargo) return '';
                          const c = cargo.toLowerCase().trim();
                          
                          // Mapear variações para padrão
                          if (c.includes('veneravel') || c.includes('venerável')) return 'veneravel mestre';
                          if (c.includes('1') && c.includes('vigilante')) return 'primeiro vigilante';
                          if (c.includes('primeiro') && c.includes('vigilante')) return 'primeiro vigilante';
                          if (c.includes('2') && c.includes('vigilante')) return 'segundo vigilante';
                          if (c.includes('segundo') && c.includes('vigilante')) return 'segundo vigilante';
                          if (c.includes('orador')) return 'orador';
                          if (c.includes('secretario') || c.includes('secretário')) return 'secretario';
                          if (c.includes('tesoureiro')) return 'tesoureiro';
                          if (c.includes('chanceler')) return 'chanceler';
                          if (c.includes('hospitaleiro')) return 'hospitaleiro';
                          if (c.includes('mestre') && c.includes('cerimonia')) return 'mestre de cerimonia';
                          if (c.includes('mestre') && c.includes('harmonia')) return 'mestre de harmonia';
                          if (c.includes('mestre') && c.includes('banquete')) return 'mestre de banquetes';
                          if (c.includes('porta') && c.includes('espada')) return 'porta espada';
                          if (c.includes('porta') && c.includes('estandarte')) return 'porta estandarte';
                          if (c.includes('1') && (c.includes('diacono') || c.includes('diácono'))) return '1º diacono';
                          if (c.includes('2') && (c.includes('diacono') || c.includes('diácono'))) return '2º diacono';
                          if (c.includes('diacono') || c.includes('diácono')) return '1º diacono';
                          if (c.includes('cobridor') && c.includes('externo')) return 'cobridor externo';
                          if (c.includes('guarda') && c.includes('templo')) return 'guarda do templo';
                          if (c.includes('cobridor') && c.includes('interno')) return 'guarda do templo';
                          if (c.includes('bibliotecario') || c.includes('bibliotecário')) return 'bibliotecario';
                          
                          return c;
                        };
                        
                        // Ordem hierárquica normalizada
                        const ordemHierarquica = [
                          'veneravel mestre',
                          'primeiro vigilante',
                          'segundo vigilante',
                          'orador',
                          'secretario',
                          'tesoureiro',
                          'chanceler',
                          'hospitaleiro',
                          'mestre de cerimonia',
                          'mestre de harmonia',
                          'mestre de banquetes',
                          'porta espada',
                          'porta estandarte',
                          '1º diacono',
                          '2º diacono',
                          'cobridor externo',
                          'guarda do templo',
                          'bibliotecario'
                        ];
                        
                        const cargoA = normalizarCargo(a.cargo);
                        const cargoB = normalizarCargo(b.cargo);
                        
                        const indexA = ordemHierarquica.indexOf(cargoA);
                        const indexB = ordemHierarquica.indexOf(cargoB);
                        
                        // Se ambos não estão na lista, ordena alfabeticamente
                        if (indexA === -1 && indexB === -1) return cargoA.localeCompare(cargoB);
                        // Se só A não está na lista, coloca no final
                        if (indexA === -1) return 1;
                        // Se só B não está na lista, coloca no final
                        if (indexB === -1) return -1;
                        // Ambos estão na lista, ordena por índice
                        return indexA - indexB;
                      })
                                            .map((item) => {
                        const irmao = item.irmao;
                        return (
                          <div
                            key={item.id}
                            style={{
                              background:'var(--color-surface-2)',
                              border:'1px solid var(--color-border)',
                              borderRadius:'var(--radius-lg)',
                              padding:'0.75rem 1rem',
                              display:'flex',
                              flexDirection:'column',
                              gap:'0.25rem',
                              position:'relative'
                            }}
                          >
                            {/* Cargo */}
                            <p style={{
                              fontSize:'0.72rem',
                              fontWeight:'700',
                              color:'var(--color-accent)',
                              textTransform:'uppercase',
                              letterSpacing:'0.04em',
                              margin:0
                            }}>
                              {item.cargo || 'Cargo não informado'}
                            </p>

                            {/* Avatar + Nome */}
                            <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginTop:'0.15rem'}}>
                              {irmao?.foto_url ? (
                                <img
                                  src={irmao.foto_url}
                                  alt={irmao.nome}
                                  style={{width:'32px',height:'32px',borderRadius:'50%',objectFit:'cover',border:'2px solid var(--color-border)',flexShrink:0}}
                                />
                              ) : (
                                <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'var(--color-surface-3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',flexShrink:0}}>
                                  👤
                                </div>
                              )}
                              <p style={{
                                fontSize:'0.82rem',
                                fontWeight:'600',
                                color:'var(--color-text)',
                                margin:0,
                                lineHeight:'1.2',
                                wordBreak:'break-word'
                              }}>
                                {irmao?.nome || 'Irmão não encontrado'}
                              </p>
                            </div>

                            {/* CIM + Ações */}
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'0.25rem'}}>
                              <span style={{
                                fontSize:'0.72rem',
                                color:'var(--color-text-muted)',
                                background:'var(--color-surface)',
                                border:'1px solid var(--color-border)',
                                borderRadius:'var(--radius-sm)',
                                padding:'0.1rem 0.4rem',
                                fontWeight:'600'
                              }}>
                                CIM {irmao?.cim || '-'}
                              </span>

                              {podeEditarCorpo && (
                                <div style={{display:'flex', gap:'0.25rem'}}>
                                  <button
                                    onClick={() => abrirModalCorpo(item.ano_exercicio)}
                                    title="Editar"
                                    style={{background:'var(--color-accent-bg)',color:'var(--color-accent)',border:'1px solid var(--color-accent)',borderRadius:'var(--radius-sm)',padding:'0.2rem 0.4rem',cursor:'pointer',fontSize:'0.75rem',lineHeight:1}}
                                  >✏️</button>
                                  <button
                                    onClick={() => handleExcluirCorpoAdmin(item.id)}
                                    title="Remover"
                                    style={{background:'rgba(239,68,68,0.1)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'var(--radius-sm)',padding:'0.2rem 0.4rem',cursor:'pointer',fontSize:'0.75rem',lineHeight:1}}
                                  >🗑️</button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
              </div>
              )}
            </div>
          ))}

        {[...new Set(corpoAdmin
          .filter(ca => !anoFiltroAdmin || ca.ano_exercicio?.includes(anoFiltroAdmin))
          .map(ca => ca.ano_exercicio))].length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
            {anoFiltroAdmin 
              ? `Nenhum registro encontrado para o ano "${anoFiltroAdmin}"`
              : 'Nenhum cargo administrativo registrado'}
          </div>
        )}
      </div>
    </div>
  );
};
