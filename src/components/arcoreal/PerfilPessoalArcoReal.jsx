import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const fmt  = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtD = (d) => { if (!d) return '—'; const [a, m, dia] = d.split('T')[0].split('-'); return `${dia}/${m}/${a}`; };
const MESES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const NOMES_MES_CURTO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const badgeStatus = (s) => {
  const map = {
    pago:      { bg: 'rgba(16,185,129,0.15)', cor: '#10b981', txt: '✅ Pago' },
    pendente:  { bg: 'rgba(245,158,11,0.15)', cor: '#f59e0b', txt: '⏳ Pendente' },
  };
  return map[s] || map.pendente;
};

const inp = {
  padding: '0.38rem 0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
  background: 'var(--color-surface-2)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', cursor: 'pointer', outline: 'none',
};

const sBtn = (ativo) => ({
  padding: '0.4rem 1rem', borderRadius: 'var(--radius-lg)', fontWeight: '600',
  fontSize: '0.82rem', cursor: 'pointer', border: 'none', transition: 'all 0.15s',
  background: ativo ? 'var(--color-accent)' : 'var(--color-surface-2)',
  color: ativo ? '#fff' : 'var(--color-text)',
});

const PERIODOS = [
  { id: 'mes-atual',     label: 'Mês Atual' },
  { id: 'trimestre',     label: 'Trimestre' },
  { id: 'semestre',      label: 'Semestre' },
  { id: 'ano-atual',     label: 'Ano Atual' },
  { id: 'personalizado', label: 'Personalizado' },
];

const taxaCor = (t) => t >= 90 ? '#10b981' : t >= 70 ? '#3b82f6' : t >= 50 ? '#f59e0b' : '#ef4444';

// ── Cartão de campo — mesmo visual do "Meus Dados" da Loja: rótulo
// pequeno em maiúsculas, valor em destaque ──────────────────────────────
const Campo = ({ label, valor }) => (
  <div>
    <p style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 0.2rem' }}>{label}</p>
    <p style={{ color: 'var(--color-text)', margin: 0, fontSize: '0.92rem' }}>{valor || 'Não informado'}</p>
  </div>
);

const Secao = ({ icone, titulo, children }) => (
  <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', overflow: 'hidden' }}>
    <div style={{ padding: '0.7rem 1.1rem', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '0.85rem' }}>{icone} {titulo}</span>
    </div>
    <div style={{ padding: '1.1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
      {children}
    </div>
  </div>
);

export default function PerfilPessoalArcoReal({ meuMembroId, showError }) {
  const [aba, setAba] = useState('dados');
  const [loading, setLoading] = useState(true);
  const [membro, setMembro] = useState(null);
  const [lancamentos, setLancamentos] = useState([]);
  const [sessoes, setSessoes] = useState([]);
  const [presencas, setPresencas] = useState({});

  // Filtros — Meu Financeiro
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [filtroAno, setFiltroAno] = useState('');
  const [filtroMes, setFiltroMes] = useState('');

  // Filtro de período — Minha Presença
  const [periodo, setPeriodo] = useState('ano-atual');
  const anoAtual = new Date().getFullYear();
  const [dataInicio, setDataInicio] = useState(`${anoAtual}-01-01`);
  const [dataFim, setDataFim] = useState(`${anoAtual}-12-31`);

  useEffect(() => { if (meuMembroId) carregar(); else setLoading(false); }, [meuMembroId]);
  useEffect(() => { if (meuMembroId && periodo !== 'personalizado') carregarPresencas(); }, [periodo, meuMembroId]);

  const carregar = async () => {
    setLoading(true);
    try {
      const [{ data: m }, { data: lancs }] = await Promise.all([
        supabase.from('arco_real_membros').select('*').eq('id', meuMembroId).single(),
        supabase.from('arco_real_lancamentos').select('*, categoria_manual:categoria_id(nome)').eq('origem_membro_id', meuMembroId).order('data_vencimento', { ascending: false }),
      ]);
      setMembro(m || null);
      setLancamentos(lancs || []);
      await carregarPresencas();
    } catch (e) {
      showError?.('Erro ao carregar seus dados: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const calcularPeriodo = () => {
    const hoje = new Date();
    let inicio, fim;
    switch (periodo) {
      case 'mes-atual':
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        break;
      case 'trimestre': {
        const t = Math.floor(hoje.getMonth() / 3) * 3;
        inicio = new Date(hoje.getFullYear(), t, 1);
        fim = new Date(hoje.getFullYear(), t + 3, 0);
        break;
      }
      case 'semestre': {
        const s = hoje.getMonth() < 6 ? 0 : 6;
        inicio = new Date(hoje.getFullYear(), s, 1);
        fim = new Date(hoje.getFullYear(), s + 6, 0);
        break;
      }
      case 'personalizado':
        if (!dataInicio || !dataFim) return null;
        inicio = new Date(dataInicio); fim = new Date(dataFim);
        break;
      default:
        inicio = new Date(hoje.getFullYear(), 0, 1);
        fim = new Date(hoje.getFullYear(), 11, 31);
    }
    if (fim > hoje) fim = hoje;
    return { inicio: inicio.toISOString().split('T')[0], fim: fim.toISOString().split('T')[0] };
  };

  const carregarPresencas = async () => {
    if (!meuMembroId) return;
    const p = calcularPeriodo();
    if (!p) return;
    const hoje = new Date().toISOString().split('T')[0];
    const { data: sessoesData } = await supabase.from('arco_real_sessoes')
      .select('id, data_sessao, classificacao')
      .gte('data_sessao', p.inicio).lte('data_sessao', p.fim).lte('data_sessao', hoje)
      .order('data_sessao', { ascending: false });

    const sessaoIds = (sessoesData || []).map(s => s.id);
    let registros = [];
    if (sessaoIds.length > 0) {
      const { data } = await supabase.from('arco_real_registros_presenca')
        .select('sessao_id, presente, justificativa')
        .eq('membro_id', meuMembroId)
        .in('sessao_id', sessaoIds);
      registros = data || [];
    }
    const mapaPresencas = {};
    registros.forEach(r => { mapaPresencas[r.sessao_id] = r; });

    setSessoes(sessoesData || []);
    setPresencas(mapaPresencas);
  };

  if (!meuMembroId) {
    return (
      <div className="p-6" style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</p>
        <p style={{ color: 'var(--color-text)', fontWeight: '700' }}>Seu acesso ainda não está vinculado a um cadastro de membro.</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Peça para o administrador do sistema vincular seu login ao seu cadastro no Arco Real.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>;
  }

  if (!membro) {
    return <div className="p-6" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Cadastro não encontrado.</div>;
  }

  // ── Cálculos: Meu Financeiro ──────────────────────────────────────────
  const anosDisp = [...new Set(lancamentos.map(l => l.data_vencimento?.substring(0, 4)).filter(Boolean))].sort((a, b) => b - a);
  const mesesDisp = [...new Set(
    lancamentos.filter(l => !filtroAno || l.data_vencimento?.startsWith(filtroAno)).map(l => l.data_vencimento?.substring(5, 7)).filter(Boolean)
  )].sort((a, b) => b.localeCompare(a));

  const lancsFiltrados = lancamentos.filter(l => {
    const statusOk = filtroStatus === 'todos' || l.status === filtroStatus;
    const anoOk = !filtroAno || l.data_vencimento?.startsWith(filtroAno);
    const mesOk = !filtroMes || l.data_vencimento?.substring(5, 7) === filtroMes;
    return statusOk && anoOk && mesOk;
  });

  const pendentes = lancamentos.filter(l => l.status === 'pendente');
  const totalDevo = pendentes.filter(l => l.tipo === 'receita').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const totalCredito = pendentes.filter(l => l.tipo === 'despesa').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const totalPago = lancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const saldo = totalDevo - totalCredito;

  const porMes = {};
  lancsFiltrados.forEach(l => {
    const dvenc = l.data_vencimento?.split('T')[0] || '';
    const mesKey = dvenc.substring(0, 7);
    const diaKey = dvenc;
    if (!porMes[mesKey]) porMes[mesKey] = {};
    if (!porMes[mesKey][diaKey]) porMes[mesKey][diaKey] = [];
    porMes[mesKey][diaKey].push(l);
  });
  const mesesOrdenadosFin = Object.keys(porMes).sort((a, b) => b.localeCompare(a));
  const labelMesFin = (key) => { const [a, m] = key.split('-'); return `${MESES_NOME[parseInt(m) - 1]} / ${a}`; };

  // ── Cálculos: Minha Presença ──────────────────────────────────────────
  const totalSessoes = sessoes.length;
  const totalPresentes = sessoes.filter(s => presencas[s.id]?.presente).length;
  const totalJustificadas = sessoes.filter(s => presencas[s.id] && !presencas[s.id].presente && presencas[s.id].justificativa).length;
  const totalAusentes = sessoes.filter(s => !presencas[s.id] || (!presencas[s.id].presente && !presencas[s.id].justificativa)).length;
  const taxaPresenca = totalSessoes > 0 ? Math.round((totalPresentes / totalSessoes) * 100) : 0;

  const porMesPresenca = {};
  sessoes.forEach(s => {
    const key = s.data_sessao.substring(0, 7);
    if (!porMesPresenca[key]) porMesPresenca[key] = [];
    porMesPresenca[key].push(s);
  });
  const mesesOrdenadosPres = Object.keys(porMesPresenca).sort((a, b) => b.localeCompare(a));

  const statusInfo = (sessaoId) => {
    const r = presencas[sessaoId];
    if (!r) return { cor: '#94a3b8', bg: 'rgba(148,163,184,0.15)', borda: 'rgba(148,163,184,0.3)', txt: '— Sem registro' };
    if (r.presente) return { cor: '#10b981', bg: 'rgba(16,185,129,0.15)', borda: 'rgba(16,185,129,0.3)', txt: '✓ Presente' };
    if (r.justificativa) return { cor: '#f59e0b', bg: 'rgba(245,158,11,0.15)', borda: 'rgba(245,158,11,0.3)', txt: 'J Justificado' };
    return { cor: '#ef4444', bg: 'rgba(239,68,68,0.15)', borda: 'rgba(239,68,68,0.3)', txt: '✗ Ausente' };
  };

  return (
    <div className="p-6" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {membro.foto_url && <img src={membro.foto_url} alt={membro.nome} style={{ width: '4rem', height: '4rem', borderRadius: '50%', objectFit: 'cover' }} />}
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>{membro.nome}</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0 }}>{membro.cargo || 'Sem cargo definido'} · {membro.situacao}</p>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)' }}>
        {[['dados', '👤 Meus Dados'], ['financeiro', '💰 Meu Financeiro'], ['presenca', '📋 Minha Presença']].map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)}
            style={{ padding: '0.6rem 1rem', border: 'none', borderBottom: aba === id ? '3px solid var(--color-accent)' : '3px solid transparent', background: 'transparent', color: aba === id ? 'var(--color-accent)' : 'var(--color-text-muted)', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════ MEUS DADOS ══════════════════ */}
      {aba === 'dados' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Secao icone="🪪" titulo="Identificação">
            <Campo label="Nome Completo" valor={membro.nome} />
            <Campo label="CPF" valor={membro.cpf} />
            <Campo label="RG" valor={membro.rg} />
            <Campo label="Data de Nascimento" valor={fmtD(membro.data_nascimento)} />
          </Secao>

          <Secao icone="📞" titulo="Contato">
            <Campo label="E-mail" valor={membro.email} />
            <Campo label="Telefone" valor={membro.telefone} />
          </Secao>

          <Secao icone="🏠" titulo="Endereço">
            <Campo label="Endereço" valor={[membro.endereco, membro.numero, membro.complemento].filter(Boolean).join(', ')} />
            <Campo label="Bairro" valor={membro.bairro} />
            <Campo label="Cidade/UF" valor={[membro.cidade, membro.estado].filter(Boolean).join('/')} />
            <Campo label="CEP" valor={membro.cep} />
          </Secao>

          <Secao icone="🔺" titulo="Arco Real">
            <Campo label="Cargo" valor={membro.cargo} />
            <Campo label="Situação" valor={membro.situacao} />
            <Campo label="Data de Exaltação" valor={fmtD(membro.data_exaltacao)} />
          </Secao>

          {membro.observacoes && (
            <Secao icone="📝" titulo="Observações">
              <div style={{ gridColumn: '1 / -1' }}>
                <p style={{ color: 'var(--color-text)', margin: 0, fontSize: '0.9rem' }}>{membro.observacoes}</p>
              </div>
            </Secao>
          )}
        </div>
      )}

      {/* ══════════════════ MEU FINANCEIRO ══════════════════ */}
      {aba === 'financeiro' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
            {[
              { label: 'Você Deve', valor: totalDevo, cor: '#ef4444', sub: `${pendentes.filter(l => l.tipo === 'receita').length} pendente(s)` },
              { label: 'Arco Real Deve', valor: totalCredito, cor: '#3b82f6', sub: `${pendentes.filter(l => l.tipo === 'despesa').length} pendente(s)` },
              { label: 'Total Pago', valor: totalPago, cor: '#10b981', sub: 'histórico geral' },
              { label: saldo > 0 ? 'Saldo Devedor' : saldo < 0 ? 'Saldo a Favor' : 'Quitado', valor: Math.abs(saldo), cor: saldo > 0 ? '#ef4444' : saldo < 0 ? '#3b82f6' : '#10b981', sub: 'posição atual' },
            ].map((item, i) => (
              <div key={i} style={{ borderRadius: 'var(--radius-lg)', padding: '0.85rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: `3px solid ${item.cor}` }}>
                <p style={{ fontSize: '1.25rem', fontWeight: '800', color: item.cor, margin: 0, lineHeight: 1 }}>{fmt(item.valor)}</p>
                <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-text)', margin: '0.3rem 0 0.1rem' }}>{item.label}</p>
                <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', margin: 0 }}>{item.sub}</p>
              </div>
            ))}
          </div>

          <div style={{ borderRadius: 'var(--radius-lg)', padding: '0.65rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Status:</span>
              {[
                { id: 'pendente', label: '⏳ Pendentes' },
                { id: 'todos', label: 'Todos' },
                { id: 'pago', label: '✅ Pagos' },
              ].map(f => (
                <button key={f.id} onClick={() => setFiltroStatus(f.id)} style={sBtn(filtroStatus === f.id)}>{f.label}</button>
              ))}
            </div>
            <div style={{ width: '1px', height: '24px', background: 'var(--color-border)' }} />
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Ano:</span>
              <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} style={inp}>
                <option value="">Todos</option>
                {anosDisp.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Mês:</span>
              <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={inp}>
                <option value="">Todos</option>
                {mesesDisp.map(m => <option key={m} value={m}>{MESES_NOME[parseInt(m) - 1]}</option>)}
              </select>
            </div>
          </div>

          {mesesOrdenadosFin.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
              ℹ️ Nenhum lançamento encontrado para o filtro selecionado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {mesesOrdenadosFin.map(mesKey => {
                const diasOrdenados = Object.keys(porMes[mesKey]).sort((a, b) => b.localeCompare(a));
                const todosLanc = diasOrdenados.flatMap(d => porMes[mesKey][d]);
                const totalMes = todosLanc.reduce((s, l) => s + parseFloat(l.valor || 0), 0);
                const pendMes = todosLanc.filter(l => l.status === 'pendente').length;

                return (
                  <div key={mesKey} style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                    <div style={{ padding: '0.6rem 1rem', background: 'var(--color-surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ fontWeight: '800', color: 'var(--color-accent)', fontSize: '1rem' }}>📅 {labelMesFin(mesKey)}</span>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        {pendMes > 0 && <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: '700' }}>{pendMes} pendente(s)</span>}
                        <span style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '0.9rem' }}>{fmt(totalMes)}</span>
                      </div>
                    </div>

                    {diasOrdenados.map(diaKey => {
                      const lancsDia = porMes[mesKey][diaKey];
                      const totalDia = lancsDia.reduce((s, l) => s + parseFloat(l.valor || 0), 0);
                      return (
                        <div key={diaKey}>
                          <div style={{ padding: '0.4rem 1rem 0.4rem 1.5rem', background: 'rgba(0,0,0,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
                            <span style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '0.82rem' }}>
                              📆 {fmtD(diaKey)}
                              <span style={{ fontWeight: '400', color: 'var(--color-text-muted)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                                · {lancsDia.length} lançamento{lancsDia.length > 1 ? 's' : ''}
                              </span>
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-text-muted)' }}>{fmt(totalDia)}</span>
                          </div>
                          {lancsDia.map((lanc, idx) => {
                            const corValor = lanc.tipo === 'receita' ? '#ef4444' : '#3b82f6';
                            const bs = badgeStatus(lanc.status);
                            return (
                              <div key={lanc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 1rem 0.5rem 2rem', borderBottom: idx < lancsDia.length - 1 ? '1px solid var(--color-border)' : 'none', background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.05)' }}>
                                {lanc.categoria_manual?.nome && (
                                  <span style={{ flexShrink: 0, fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', minWidth: '80px' }}>
                                    {lanc.categoria_manual.nome}
                                  </span>
                                )}
                                <span style={{ flexShrink: 0, color: 'var(--color-border)', fontSize: '0.8rem' }}>·</span>
                                <span style={{ flex: 1, fontWeight: '600', color: 'var(--color-text)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {lanc.descricao}
                                </span>
                                <span style={{ flexShrink: 0, padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: '700', background: bs.bg, color: bs.cor, border: `1px solid ${bs.cor}40`, whiteSpace: 'nowrap' }}>
                                  {bs.txt}
                                </span>
                                <span style={{ flexShrink: 0, fontWeight: '800', fontSize: '0.9rem', color: corValor, textAlign: 'right', minWidth: '90px' }}>
                                  {fmt(parseFloat(lanc.valor))}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ padding: '0.85rem 1rem', borderRadius: 'var(--radius-lg)', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <p style={{ fontWeight: '700', color: 'var(--color-text)', margin: '0 0 0.3rem', fontSize: '0.82rem' }}>💡 Informações Importantes</p>
            <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.77rem', color: 'var(--color-text-muted)', lineHeight: '1.65' }}>
              <li>Para efetuar pagamentos, entre em contato com o Tesoureiro do Arco Real</li>
              <li>Mantenha suas mensalidades em dia para regularidade</li>
            </ul>
          </div>
        </div>
      )}

      {/* ══════════════════ MINHA PRESENÇA ══════════════════ */}
      {aba === 'presenca' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.6rem' }}>
            {[
              { label: 'Sessões', valor: totalSessoes, cor: 'var(--color-accent)' },
              { label: 'Presente', valor: totalPresentes, cor: '#10b981' },
              { label: 'Justificado', valor: totalJustificadas, cor: '#f59e0b' },
              { label: 'Ausente', valor: totalAusentes, cor: '#ef4444' },
              { label: 'Taxa', valor: `${taxaPresenca}%`, cor: taxaCor(taxaPresenca) },
            ].map((item, i) => (
              <div key={i} style={{ borderRadius: 'var(--radius-lg)', padding: '0.85rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: `4px solid ${item.cor}`, textAlign: 'center' }}>
                <p style={{ fontSize: '1.5rem', fontWeight: '800', color: item.cor, margin: 0 }}>{item.valor}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '0.15rem 0 0' }}>{item.label}</p>
              </div>
            ))}
          </div>

          <div style={{ borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
            {PERIODOS.map(p => (
              <button key={p.id} onClick={() => setPeriodo(p.id)} style={sBtn(periodo === p.id)}>{p.label}</button>
            ))}
          </div>

          {periodo === 'personalizado' && (
            <div style={{ borderRadius: 'var(--radius-lg)', padding: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
              {[{ label: 'Início', val: dataInicio, set: setDataInicio }, { label: 'Fim', val: dataFim, set: setDataFim }].map(({ label, val, set }) => (
                <div key={label}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>{label}</label>
                  <input type="date" value={val} onChange={e => set(e.target.value)}
                    style={{ padding: '0.4rem 0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }} />
                </div>
              ))}
              <button onClick={carregarPresencas}
                style={{ padding: '0.4rem 1.2rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem' }}>
                🔍 Aplicar
              </button>
            </div>
          )}

          {mesesOrdenadosPres.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
              Nenhuma sessão encontrada no período selecionado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {mesesOrdenadosPres.map(mesAno => {
                const sessMes = porMesPresenca[mesAno];
                const [a, m] = mesAno.split('-');
                const pres = sessMes.filter(s => presencas[s.id]?.presente).length;
                const ause = sessMes.filter(s => !presencas[s.id] || (!presencas[s.id].presente && !presencas[s.id].justificativa)).length;
                const just = sessMes.filter(s => presencas[s.id] && !presencas[s.id].presente && presencas[s.id].justificativa).length;
                const taxa = sessMes.length > 0 ? Math.round((pres / sessMes.length) * 100) : 0;
                return (
                  <div key={mesAno} style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                    <div style={{ padding: '0.7rem 1rem', background: 'var(--color-surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontWeight: '700', color: 'var(--color-accent)', fontSize: '0.95rem' }}>📅 {NOMES_MES_CURTO[parseInt(m) - 1]} {a}</span>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', fontWeight: '700' }}>
                        <span style={{ color: '#10b981' }}>✓ {pres}</span>
                        <span style={{ color: '#f59e0b' }}>J {just}</span>
                        <span style={{ color: '#ef4444' }}>✗ {ause}</span>
                        <span style={{ color: taxaCor(taxa) }}>{taxa}%</span>
                      </div>
                    </div>
                    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {sessMes.map((sessao, idx) => {
                        const si = statusInfo(sessao.id);
                        const reg = presencas[sessao.id];
                        return (
                          <div key={sessao.id} style={{ borderRadius: 'var(--radius-lg)', background: idx % 2 === 0 ? 'var(--color-surface-2)' : 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: `4px solid ${si.cor}`, padding: '0.55rem 0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: '600', color: 'var(--color-text)', margin: '0 0 0.15rem', fontSize: '0.85rem' }}>{sessao.classificacao || 'Sessão'}</p>
                              <p style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', margin: 0 }}>
                                {fmtD(sessao.data_sessao)}
                                {reg?.justificativa && <> · <span style={{ fontStyle: 'italic' }}>{reg.justificativa}</span></>}
                              </p>
                            </div>
                            <span style={{ padding: '0.2rem 0.7rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700', background: si.bg, color: si.cor, border: `1px solid ${si.borda}`, flexShrink: 0 }}>
                              {si.txt}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p style={{ fontWeight: '700', color: 'var(--color-text)', margin: '0 0 0.4rem', fontSize: '0.85rem' }}>ℹ️ Legenda</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {[['#10b981', '✓ Presente'], ['#f59e0b', 'J Justificado'], ['#ef4444', '✗ Ausente'], ['#94a3b8', '— Sem registro']].map(([cor, txt]) => (
                <span key={txt}><span style={{ color: cor, fontWeight: '700' }}>{txt.split(' ')[0]}</span> {txt.split(' ').slice(1).join(' ')}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
