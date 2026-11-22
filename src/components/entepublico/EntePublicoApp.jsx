import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { gerarRelatorioRecursosComodatoPDF } from '../../utils/gerarRelatorioRecursosComodatoPDF';
import { gerarRelatorioEmprestimosPDF } from '../../utils/gerarRelatorioEmprestimosPDF';

// ═══════════════════════════════════════════════════════════════════════
// ÁREA DO ENTE PÚBLICO — somente leitura, apenas Comodato.
// O que aparece é limitado no BANCO (RLS) ao que foi liberado no cadastro de
// recursos/equipamentos; aqui só organizamos a exibição.
// ═══════════════════════════════════════════════════════════════════════

const VERDE = '16,185,129';
const moeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '—');

const ABAS = [
  { id: 'dashboard', rotulo: '📊 Dashboard' },
  { id: 'equipamentos', rotulo: '♿ Equipamentos' },
  { id: 'emprestimos', rotulo: '📤 Empréstimos' },
  { id: 'relatorios', rotulo: '📄 Relatórios' },
];

const STATUS_EQ = {
  disponivel: ['Disponível', '#10b981'],
  emprestado: ['Emprestado', '#3b82f6'],
  manutencao: ['Manutenção', '#f59e0b'],
  descartado: ['Descartado', '#94a3b8'],
};

const Kpi = ({ rotulo, valor, sub, cor = '#10b981' }) => (
  <div style={{ background: 'var(--color-surface)', border: `1px solid ${cor}66`, borderLeft: `4px solid ${cor}`, borderRadius: 'var(--radius-lg)', padding: '0.8rem 1rem' }}>
    <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{rotulo}</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: cor, lineHeight: 1.15 }}>{valor}</div>
    {sub && <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>{sub}</div>}
  </div>
);

const Caixa = ({ titulo, extra, children }) => (
  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.6rem 1rem', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>{titulo}</h3>
      {extra}
    </div>
    <div style={{ padding: '0.8rem 1rem' }}>{children}</div>
  </div>
);

const campo = { background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', padding: '0.35rem 0.6rem', fontSize: '0.85rem' };
const rotulo = { display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.15rem' };

export default function EntePublicoApp({ userData, onSair }) {
  const [aba, setAba] = useState('dashboard');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [recursos, setRecursos] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [emprestimos, setEmprestimos] = useState([]);
  const [benef, setBenef] = useState({});
  const [entidade, setEntidade] = useState('');
  const [dadosLoja, setDadosLoja] = useState({});
  const [gestao, setGestao] = useState([]);
  const [totalGeral, setTotalGeral] = useState(null);
  const [filtroNF, setFiltroNF] = useState('todas');
  const estendido = !!userData?.ente_acesso_estendido;
  const telasVistas = useRef(new Set());

  // ── Registro de acesso (aparece no Controle de Acesso da Loja) ──
  useEffect(() => {
    if (!userData?.id || telasVistas.current.has(aba)) return;
    telasVistas.current.add(aba);
    const nome = ABAS.find(a => a.id === aba)?.rotulo || aba;
    supabase.from('logs_acesso').insert({
      usuario_id: userData.id,
      acao: 'acessar_tela',
      detalhes: `Acessou: 🏛️ Ente Público — ${nome.replace(/^\S+\s/, '')}`,
      created_at: new Date().toISOString(),
    }).then(({ error }) => { if (error) console.error('log ente:', error); });
  }, [aba, userData?.id]);

  const registrarAcao = (detalhes) => {
    if (!userData?.id) return;
    supabase.from('logs_acesso').insert({ usuario_id: userData.id, acao: 'gerar_relatorio', detalhes: `Ente Público — ${detalhes}`, created_at: new Date().toISOString() })
      .then(({ error }) => { if (error) console.error('log ente:', error); });
  };

  // ── Carregamento (o banco já devolve só o que foi liberado) ──
  useEffect(() => {
    (async () => {
      try {
        const [rec, eq, emp, ben, org, loja, ges, tot] = await Promise.all([
          supabase.from('comodato_recursos').select('*, origem:comodato_origens_recurso(id, nome)').order('data_nf', { ascending: false }),
          supabase.from('equipamentos').select('*, tipos_equipamentos(id, nome)').order('numero_patrimonio'),
          supabase.from('comodatos')
            .select('id, status, data_emprestimo, data_devolucao_prevista, data_devolucao_real, beneficiario_id, itens:comodato_itens(id, status, equipamento_id, equipamentos(id, numero_patrimonio, recurso_id, liberado_ente, tipos_equipamentos(nome)))')
            .order('data_emprestimo', { ascending: false }),
          supabase.from('v_ente_beneficiarios').select('id, nome, cpf_mascarado'),
          userData?.ente_origem_id ? supabase.from('comodato_origens_recurso').select('nome').eq('id', userData.ente_origem_id).maybeSingle() : Promise.resolve({ data: null }),
          supabase.from('dados_loja').select('*').limit(1).maybeSingle(),
          supabase.from('v_ente_gestao').select('*'),
          supabase.rpc('ente_total_equipamentos'),
        ]);
        setGestao(ges.data || []);
        setTotalGeral(typeof tot.data === 'number' ? tot.data : null);
        if (rec.error) throw rec.error;
        if (eq.error) throw eq.error;
        if (emp.error) throw emp.error;
        setRecursos(rec.data || []);
        setEquipamentos(eq.data || []);
        setEmprestimos(emp.data || []);
        const mapa = {}; (ben.data || []).forEach(b => { mapa[b.id] = b; }); setBenef(mapa);
        setEntidade(org.data?.nome || '');
        setDadosLoja(loja.data || {});
      } catch (e) {
        console.error(e);
        setErro('Não foi possível carregar os dados. Verifique se o acesso foi liberado pela Loja.');
      } finally { setCarregando(false); }
    })();
  }, [userData?.ente_origem_id]);

  // ── Derivados ──
  const idsRecursos = useMemo(() => new Set(recursos.map(r => r.id)), [recursos]);
  const ehMeu = (eq) => !!eq && eq.liberado_ente && idsRecursos.has(eq.recurso_id);
  const meusEquip = useMemo(() => equipamentos.filter(ehMeu), [equipamentos, idsRecursos]);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const atrasado = (e) => e.status === 'ativo' && e.data_devolucao_prevista && new Date(e.data_devolucao_prevista + 'T00:00:00') < hoje;

  const emp = useMemo(() => emprestimos.map(e => ({
    ...e,
    beneficiarios: benef[e.beneficiario_id] ? { nome: benef[e.beneficiario_id].nome, cpf: benef[e.beneficiario_id].cpf_mascarado } : { nome: '—', cpf: '' },
    temMeu: (e.itens || []).some(i => ehMeu(i.equipamentos)),
  })), [emprestimos, benef, idsRecursos]);

  const contEq = (st) => meusEquip.filter(e => e.status === st).length;
  const empAtivos = emp.filter(e => e.status === 'ativo');
  const empDev = emp.filter(e => e.status === 'devolvido');
  const empAtrasados = empAtivos.filter(atrasado);
  const valorRecursos = recursos.reduce((t, r) => t + (Number(r.valor_total) || 0), 0);

  // ── PDFs ──
  const urlParaDataUrl = async (url) => {
    const r = await fetch(url); const b = await r.blob();
    return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); });
  };
  const logoLoja = async () => { try { return dadosLoja?.logo_url ? await urlParaDataUrl(dadosLoja.logo_url) : null; } catch (e) { return null; } };

  const [rel, setRel] = useState({ recurso: 'todos', de: '', ate: '', ano: new Date().getFullYear(), gerando: false });

  const pdfRecursos = async () => {
    setRel(r => ({ ...r, gerando: true }));
    try {
      let sel = recursos.map(r => ({ ...r, itens: meusEquip.filter(e => e.recurso_id === r.id) }));
      if (rel.recurso !== 'todos') sel = sel.filter(r => String(r.id) === String(rel.recurso));
      if (rel.de) sel = sel.filter(r => r.data_nf && r.data_nf >= rel.de);
      if (rel.ate) sel = sel.filter(r => r.data_nf && r.data_nf <= rel.ate);
      const filtro = [entidade && `Entidade: ${entidade}`, rel.recurso !== 'todos' && `NF nº ${recursos.find(r => String(r.id) === String(rel.recurso))?.numero_nf}`, rel.de && `A partir de ${dataBR(rel.de)}`, rel.ate && `Até ${dataBR(rel.ate)}`].filter(Boolean).join(' • ');
      gerarRelatorioRecursosComodatoPDF({ recursos: sel, dadosLoja, logo: await logoLoja(), filtro });
      registrarAcao('Relatório de recursos aplicados (PDF)');
    } catch (e) { setErro('Erro ao gerar relatório: ' + e.message); } finally { setRel(r => ({ ...r, gerando: false })); }
  };

  const pdfEmprestimos = async () => {
    setRel(r => ({ ...r, gerando: true }));
    try {
      const ano = Number(rel.ano);
      // só os itens do recurso do ente (mesmo com autorização estendida)
      const doRecurso = emp
        .map(e => ({ ...e, itens: (e.itens || []).filter(i => ehMeu(i.equipamentos)) }))
        .filter(e => e.itens.length > 0);
      const noAno = doRecurso.filter(e => String(e.data_emprestimo || '').startsWith(String(ano)) && ['ativo', 'devolvido'].includes(e.status));
      const outros = doRecurso.filter(e => e.status === 'ativo' && String(e.data_emprestimo || '').substring(0, 4) < String(ano));
      gerarRelatorioEmprestimosPDF({
        ativos: noAno.filter(e => e.status === 'ativo'),
        devolvidos: noAno.filter(e => e.status === 'devolvido'),
        outrosAnos: outros,
        labelPeriodo: `Ano ${ano} — ${entidade || 'Recurso do ente público'}`,
        ano, dadosLoja, logo: await logoLoja(),
        nomeArquivo: `Relatorio_Emprestimos_${(entidade || 'Ente').replace(/[^A-Za-z0-9]+/g, '_')}_${ano}.pdf`,
      });
      registrarAcao(`Relatório de empréstimos ${ano} (PDF)`);
    } catch (e) { setErro('Erro ao gerar relatório: ' + e.message); } finally { setRel(r => ({ ...r, gerando: false })); }
  };

  const [buscaEq, setBuscaEq] = useState('');
  const [filtroEmp, setFiltroEmp] = useState('todos');
  const [visaoEmp, setVisaoEmp] = useState('todos');

  const baixarNota = async (r) => {
    try {
      const { data, error } = await supabase.storage.from('comodato-notas').createSignedUrl(r.arquivo_path, 120);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
      registrarAcao(`Abriu nota fiscal nº ${r.numero_nf}`);
    } catch (e) { setErro('Não foi possível abrir o arquivo da nota.'); }
  };

  // ═════════ Render ═════════
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Barra superior */}
      <div style={{ background: 'var(--color-accent)', color: '#fff', padding: '0.55rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.92rem', fontWeight: 800 }}>♿ Controle de Comodatos — Acesso Institucional</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right', fontSize: '0.78rem' }}>
            <div style={{ fontWeight: 700 }}>{userData?.nome}</div>
            <div style={{ opacity: 0.9 }}>🏛️ {entidade || 'Ente público'}{estendido ? ' • 🔓 acesso estendido' : ''}</div>
          </div>
          <button onClick={onSair} style={{ padding: '0.35rem 0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Sair</button>
        </div>
      </div>

      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Apresentação da Loja */}
        <div style={{ textAlign: 'center', padding: aba === 'dashboard' ? '1.6rem 1rem 1.2rem' : '0.4rem 1rem', background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-bg) 100%)', border: '1px solid var(--color-border)', borderBottom: '3px double #c9a84c', borderRadius: 'var(--radius-xl)' }}>
          {dadosLoja?.logo_url && <img src={dadosLoja.logo_url} alt="Logo da Loja" style={{ width: aba === 'dashboard' ? 128 : 44, height: aba === 'dashboard' ? 128 : 44, objectFit: 'contain', margin: '0 auto', display: 'block', filter: 'drop-shadow(0 4px 14px rgba(201,168,76,0.35))' }} />}
          <div style={{ marginTop: aba === 'dashboard' ? '0.8rem' : '0.2rem', fontSize: aba === 'dashboard' ? '1.55rem' : '1rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '0.02em' }}>
            AUG∴ E RESP∴ LOJA SIMB∴ ACÁCIA DE PARANATINGA Nº {dadosLoja?.numero_loja || '30'}
          </div>
          {aba === 'dashboard' && (
            <>
              <div style={{ marginTop: '0.35rem', fontSize: '0.9rem', color: '#c9a84c', fontWeight: 700 }}>
                Jurisdicionada à Sereníssima Grande Loja Maçônica do Estado de Mato Grosso
              </div>
              <div style={{ marginTop: '0.15rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {[dadosLoja?.cidade || 'Paranatinga', dadosLoja?.estado || 'MT'].join('/')} • Fundada em {dadosLoja?.data_fundacao ? dataBR(dadosLoja.data_fundacao) : '20/12/1997'}
              </div>
            </>
          )}
        </div>

        {/* Administração da gestão atual */}
        {aba === 'dashboard' && gestao.length > 0 && (() => {
          const norm = (c) => String(c || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const acha = (fn) => gestao.find(g => fn(norm(g.cargo)));
          const trio = [
            ['Venerável Mestre', acha(c => c.includes('veneravel'))],
            ['1º Vigilante', acha(c => c.includes('vigilante') && (c.includes('primeiro') || c.includes('1')))],
            ['2º Vigilante', acha(c => c.includes('vigilante') && (c.includes('segundo') || c.includes('2')))],
          ].filter(([, g]) => g);
          if (trio.length === 0) return null;
          return (
            <div>
              <div style={{ textAlign: 'center', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                Administração — Gestão {gestao[0]?.ano_exercicio}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '0.75rem' }}>
                {trio.map(([rot, g]) => (
                  <div key={rot} style={{ textAlign: 'center', background: 'var(--color-surface)', border: '1px solid rgba(201,168,76,0.5)', borderTop: '3px solid #c9a84c', borderRadius: 'var(--radius-lg)', padding: '0.8rem 0.6rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#c9a84c', letterSpacing: '0.05em' }}>{rot}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginTop: '0.25rem' }}>{g.nome}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Abas */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
          {ABAS.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', background: aba === a.id ? 'var(--color-accent)' : 'var(--color-surface-2)', color: aba === a.id ? '#fff' : 'var(--color-text)' }}>
              {a.rotulo}
            </button>
          ))}
        </div>

        {erro && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.9rem', fontSize: '0.85rem' }}>{erro}</div>}

        {carregando ? (
          <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Carregando...</p>
        ) : (
          <>
            {/* ───────── DASHBOARD ───────── */}
            {aba === 'dashboard' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '0.75rem' }}>
                  <Kpi rotulo="Total de equipamentos" valor={totalGeral ?? equipamentos.length} sub="geral da Loja" cor="#c9a84c" />
                  <Kpi rotulo="Provenientes do ente" valor={meusEquip.length} sub="liberados para esta entidade" cor="#10b981" />
                  <Kpi rotulo="Disponíveis" valor={contEq('disponivel')} sub="do recurso do ente" cor="#3b82f6" />
                  <Kpi rotulo="Emprestados" valor={contEq('emprestado')} sub="do recurso do ente" cor="#8b5cf6" />
                  <Kpi rotulo="Beneficiados" valor={new Set(emp.filter(e => e.temMeu).map(e => e.beneficiario_id)).size} sub="com equipamento do ente" cor="#f59e0b" />
                  <Kpi rotulo="Recursos (NF)" valor={recursos.length} sub={moeda(valorRecursos)} cor="#14b8a6" />
                </div>

                <Caixa titulo="🧾 Notas fiscais do recurso">
                  {recursos.length === 0 ? <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>Nenhum recurso liberado para esta entidade.</p> : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '0.6rem' }}>
                      {recursos.map(r => (
                        <div key={r.id} style={{ border: `1px solid rgba(${VERDE},0.45)`, borderLeft: `4px solid rgb(${VERDE})`, borderRadius: 'var(--radius-md)', padding: '0.6rem 0.8rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>NF nº {r.numero_nf}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{dataBR(r.data_nf)} • {r.fornecedor || '—'}</div>
                          <div style={{ fontWeight: 800, color: 'var(--color-text)' }}>{moeda(r.valor_total)}</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>{meusEquip.filter(e => e.recurso_id === r.id).length} equipamento(s)</div>
                          {r.arquivo_path && <button onClick={() => baixarNota(r)} style={{ marginTop: '0.3rem', fontSize: '0.74rem', background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', padding: 0, fontWeight: 600 }}>📎 Ver nota fiscal</button>}
                        </div>
                      ))}
                    </div>
                  )}
                </Caixa>

                <Caixa titulo={`📤 Empréstimos ativos${estendido ? ' (todos)' : ''}`}>
                  {empAtivos.length === 0 ? <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>Nenhum empréstimo ativo.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {empAtivos.slice(0, 10).map(e => (
                        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.7rem', fontSize: '0.83rem' }}>
                          <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{e.beneficiarios.nome}</span>
                          <span style={{ color: 'var(--color-text-muted)' }}>{(e.itens || []).map(i => i.equipamentos?.tipos_equipamentos?.nome).filter(Boolean).join(', ') || '—'}</span>
                          <span style={{ color: atrasado(e) ? '#ef4444' : 'var(--color-text-muted)', fontWeight: atrasado(e) ? 700 : 400 }}>desde {dataBR(e.data_emprestimo)}{e.data_devolucao_prevista ? ` • prev. ${dataBR(e.data_devolucao_prevista)}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Caixa>
              </>
            )}

            {/* ───────── EQUIPAMENTOS ───────── */}
            {aba === 'equipamentos' && (() => {
              const q = buscaEq.trim().toLowerCase();
              const passa = (e) => !q || `${e.numero_patrimonio} ${e.tipos_equipamentos?.nome || ''} ${e.descricao || ''}`.toLowerCase().includes(q);
              const grupos = recursos
                .filter(r => filtroNF === 'todas' || String(r.id) === String(filtroNF))
                .map(r => ({ r, itens: meusEquip.filter(e => e.recurso_id === r.id && passa(e)) }))
                .filter(g => g.itens.length > 0);
              return (
                <>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.6rem 0.9rem' }}>
                    <div>
                      <label style={rotulo}>Nota fiscal</label>
                      <select value={filtroNF} onChange={e => setFiltroNF(e.target.value)} style={campo}>
                        <option value="todas">Todas as NF</option>
                        {recursos.map(r => <option key={r.id} value={r.id}>NF {r.numero_nf} — {dataBR(r.data_nf)}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: '14rem' }}>
                      <label style={rotulo}>Pesquisar</label>
                      <input value={buscaEq} onChange={e => setBuscaEq(e.target.value)} placeholder="🔎 Patrimônio, tipo ou descrição..." style={{ ...campo, width: '100%' }} />
                    </div>
                  </div>
                  {grupos.length === 0 ? <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>Nenhum equipamento encontrado.</p> : grupos.map(({ r, itens }) => (
                    <Caixa key={r.id} titulo={`🧾 NF nº ${r.numero_nf} — ${dataBR(r.data_nf)}${r.fornecedor ? ` • ${r.fornecedor}` : ''}`}
                      extra={<span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{itens.length} equipamento(s) • {moeda(r.valor_total)}</span>}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                          <thead><tr style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                            {['Patrimônio', 'Tipo', 'Descrição', 'Aquisição', 'Situação'].map(h => <th key={h} style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {itens.map(e => {
                              const [txt, cor] = STATUS_EQ[e.status] || [e.status, '#94a3b8'];
                              return (
                                <tr key={e.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                  <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700, color: 'var(--color-text)' }}>{e.numero_patrimonio}</td>
                                  <td style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text)' }}>{e.tipos_equipamentos?.nome || '—'}</td>
                                  <td style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-muted)' }}>{e.descricao || '—'}</td>
                                  <td style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-muted)' }}>{dataBR(e.data_aquisicao)}</td>
                                  <td style={{ padding: '0.4rem 0.6rem' }}><span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.55rem', borderRadius: 999, color: cor, background: `${cor}22`, border: `1px solid ${cor}55` }}>{txt}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Caixa>
                  ))}
                </>
              );
            })()}

            {/* ───────── EMPRÉSTIMOS ───────── */}
            {aba === 'emprestimos' && (() => {
              const passaStatus = (e) => filtroEmp === 'todos' || (filtroEmp === 'atrasado' ? atrasado(e) : e.status === filtroEmp);
              const verTudo = estendido && visaoEmp === 'todos';
              const meus = emp.filter(e => e.temMeu && passaStatus(e));
              const demais = verTudo ? emp.filter(e => !e.temMeu && passaStatus(e)) : [];

              const Cartao = ({ e, marcar }) => (
                <div style={{ border: '1px solid rgba(16,185,129,0.45)', borderLeft: '4px solid #10b981', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{e.beneficiarios.nome}{e.beneficiarios.cpf ? <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.78rem' }}> • CPF {e.beneficiarios.cpf}</span> : null}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Emprestado em {dataBR(e.data_emprestimo)}{e.data_devolucao_prevista ? ` • previsão ${dataBR(e.data_devolucao_prevista)}` : ''}{e.data_devolucao_real ? ` • devolvido em ${dataBR(e.data_devolucao_real)}` : ''}</div>
                    </div>
                    <span style={{ alignSelf: 'flex-start', fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.55rem', borderRadius: 999, color: atrasado(e) ? '#ef4444' : e.status === 'ativo' ? '#3b82f6' : '#10b981', background: atrasado(e) ? 'rgba(239,68,68,0.14)' : e.status === 'ativo' ? 'rgba(59,130,246,0.14)' : 'rgba(16,185,129,0.14)' }}>
                      {atrasado(e) ? 'Em atraso' : e.status === 'ativo' ? 'Ativo' : 'Devolvido'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                    {(e.itens || []).map(i => (
                      <span key={i.id} style={{ fontSize: '0.74rem', padding: '0.1rem 0.5rem', borderRadius: 'var(--radius-sm)', background: marcar && ehMeu(i.equipamentos) ? 'rgba(16,185,129,0.14)' : 'var(--color-surface-2)', color: marcar && ehMeu(i.equipamentos) ? '#10b981' : 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                        {i.equipamentos?.tipos_equipamentos?.nome || 'Equipamento'} {i.equipamentos?.numero_patrimonio ? `nº ${i.equipamentos.numero_patrimonio}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              );

              return (
                <>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.6rem 0.9rem' }}>
                    {estendido && (
                      <div>
                        <label style={rotulo}>Visualizar</label>
                        <select value={visaoEmp} onChange={e => setVisaoEmp(e.target.value)} style={campo}>
                          <option value="todos">Todos os empréstimos</option>
                          <option value="meu">Somente NF do meu recurso</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <label style={rotulo}>Situação</label>
                      <select value={filtroEmp} onChange={e => setFiltroEmp(e.target.value)} style={campo}>
                        <option value="todos">Todas</option>
                        <option value="ativo">Ativos</option>
                        <option value="devolvido">Devolvidos</option>
                        <option value="atrasado">Em atraso</option>
                      </select>
                    </div>
                  </div>

                  <Caixa titulo={`📤 Empréstimos do meu recurso (${meus.length})`}>
                    {meus.length === 0 ? <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: 0 }}>Nenhum empréstimo encontrado.</p> : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {meus.map(e => <Cartao key={e.id} e={e} marcar />)}
                      </div>
                    )}
                  </Caixa>

                  {verTudo && (
                    <Caixa titulo={`📋 Demais empréstimos (${demais.length})`}>
                      {demais.length === 0 ? <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: 0 }}>Nenhum empréstimo encontrado.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {demais.map(e => <Cartao key={e.id} e={e} />)}
                        </div>
                      )}
                    </Caixa>
                  )}
                </>
              );
            })()}

            {/* ───────── RELATÓRIOS ───────── */}
            {aba === 'relatorios' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '1rem' }}>
                <Caixa titulo="🧾 Recursos aplicados em equipamentos">
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 0 }}>Notas fiscais e equipamentos adquiridos com o recurso da sua entidade.</p>
                  <div style={{ display: 'grid', gap: '0.6rem' }}>
                    <div><label style={rotulo}>Nota fiscal</label>
                      <select value={rel.recurso} onChange={e => setRel(r => ({ ...r, recurso: e.target.value }))} style={{ ...campo, width: '100%' }}>
                        <option value="todos">Todas</option>
                        {recursos.map(r => <option key={r.id} value={r.id}>NF {r.numero_nf} — {dataBR(r.data_nf)}</option>)}
                      </select></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div><label style={rotulo}>NF de</label><input type="date" value={rel.de} onChange={e => setRel(r => ({ ...r, de: e.target.value }))} style={{ ...campo, width: '100%' }} /></div>
                      <div><label style={rotulo}>NF até</label><input type="date" value={rel.ate} onChange={e => setRel(r => ({ ...r, ate: e.target.value }))} style={{ ...campo, width: '100%' }} /></div>
                    </div>
                    <button onClick={pdfRecursos} disabled={rel.gerando || recursos.length === 0} style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-accent)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>📄 Gerar PDF</button>
                  </div>
                </Caixa>
                <Caixa titulo="📤 Empréstimos do recurso">
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 0 }}>Somente os equipamentos do seu recurso{estendido ? ' (mesmo com a autorização estendida)' : ''}; CPF mascarado.</p>
                  <div style={{ display: 'grid', gap: '0.6rem' }}>
                    <div><label style={rotulo}>Ano</label>
                      <input type="number" value={rel.ano} onChange={e => setRel(r => ({ ...r, ano: e.target.value }))} style={{ ...campo, width: '100%' }} /></div>
                    <button onClick={pdfEmprestimos} disabled={rel.gerando || meusEquip.length === 0} style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-accent)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>📄 Gerar PDF</button>
                  </div>
                </Caixa>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
