import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import {
  fmtR,
  fmtData,
  hojeISO,
  montarResumoOperacao,
  gerarRelatorioOperacoesPDF,
  SITUACAO_PARCELA_LABEL
} from '../../utils/gerarRelatorioOperacoesPDF';

const COR_CREDITO = '#10b981';
const COR_DEBITO = '#ef4444';

const COR_SITUACAO = {
  paga:      { fg: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  a_vencer:  { fg: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  atrasada:  { fg: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  cancelada: { fg: 'var(--color-text-muted)', bg: 'var(--color-surface-2)' }
};

const STATUS_LABEL = { ativo: '✓ Ativo', quitado: '✓ Quitado', cancelado: '✗ Cancelado' };
const FORMA_LABEL = { unico: 'Pagamento Único', parcelado: 'Parcelado', compensacao: 'Compensação' };

// Busca todas as parcelas (o Supabase devolve no máximo 1000 linhas por consulta)
const buscarTodasParcelas = async () => {
  const passo = 1000;
  let inicio = 0;
  let todas = [];
  for (;;) {
    const { data, error } = await supabase
      .from('parcelas_operacoes')
      .select('*')
      .order('id')
      .range(inicio, inicio + passo - 1);
    if (error) throw error;
    todas = todas.concat(data || []);
    if (!data || data.length < passo) break;
    inicio += passo;
  }
  return todas;
};

function Campo({ label, valor, cor, sub }) {
  return (
    <div>
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>{label}</p>
      <p style={{ fontSize: '1.05rem', fontWeight: 700, color: cor || 'var(--color-text)', margin: '0.15rem 0 0' }}>{valor}</p>
      {sub ? <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '0.1rem 0 0' }}>{sub}</p> : null}
    </div>
  );
}

function Chip({ cor, bg, children }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.3rem 0.7rem',
      borderRadius: '999px',
      fontSize: '0.78rem',
      fontWeight: 600,
      color: cor,
      background: bg,
      border: '1px solid ' + cor
    }}>
      {children}
    </span>
  );
}

function BlocoTotais({ titulo, cor, t }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderTop: '4px solid ' + cor,
      borderRadius: 'var(--radius-xl)',
      padding: '1rem 1.25rem'
    }}>
      <h4 style={{ margin: '0 0 0.75rem', color: 'var(--color-text)', fontWeight: 700 }}>
        {titulo} <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>({t.qtd} operação(ões))</span>
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
        <Campo label="Valor buscado" valor={fmtR(t.principal)} />
        <Campo label="Juros" valor={fmtR(t.juros)} cor="#f59e0b" />
        <Campo label="Valor final" valor={fmtR(t.final)} />
        <Campo label="Pago" valor={fmtR(t.pago)} cor={COR_CREDITO} />
        <Campo label="Restante" valor={fmtR(t.saldo)} cor="#f59e0b" />
      </div>
    </div>
  );
}

export default function RelatorioCreditosDebitos({ showError }) {
  const [loading, setLoading] = useState(true);
  const [operacoes, setOperacoes] = useState([]);
  const [parcelasPorOp, setParcelasPorOp] = useState({});
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('ativo');
  const [expandidos, setExpandidos] = useState({});
  const [dadosLoja, setDadosLoja] = useState(null);

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data: ops, error } = await supabase
        .from('operacoes_credito_debito')
        .select('*')
        .order('data_lancamento', { ascending: false });
      if (error) throw error;

      const parcelas = await buscarTodasParcelas();
      const mapa = {};
      parcelas.forEach((p) => {
        if (!mapa[p.operacao_id]) mapa[p.operacao_id] = [];
        mapa[p.operacao_id].push(p);
      });

      setOperacoes(ops || []);
      setParcelasPorOp(mapa);

      // Cabeçalho do PDF (logo, nome e endereço da Loja). Se falhar, o PDF usa o cabeçalho padrão sem logo.
      const { data: loja } = await supabase.from('dados_loja').select('*').single();
      if (loja) setDadosLoja(loja);
    } catch (e) {
      console.error('Erro ao carregar relatório:', e);
      if (showError) showError('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  const resumos = useMemo(() => {
    const hoje = hojeISO();
    const termo = busca.trim().toLowerCase();
    return operacoes
      .filter((op) => {
        if (filtroTipo !== 'todos' && op.tipo_operacao !== filtroTipo) return false;
        if (filtroStatus !== 'todos' && op.status !== filtroStatus) return false;
        if (termo) {
          const alvo = ((op.entidade_nome || '') + ' ' + (op.descricao || '')).toLowerCase();
          if (!alvo.includes(termo)) return false;
        }
        return true;
      })
      .map((op) => montarResumoOperacao(op, parcelasPorOp[op.id] || [], hoje));
  }, [operacoes, parcelasPorOp, busca, filtroTipo, filtroStatus]);

  // Totais (operações canceladas não entram)
  const totais = useMemo(() => {
    const novo = () => ({ qtd: 0, principal: 0, juros: 0, final: 0, pago: 0, saldo: 0 });
    const t = { credito: novo(), debito: novo() };
    resumos.forEach((r) => {
      if (r.op.status === 'cancelado') return;
      const alvo = t[r.op.tipo_operacao];
      if (!alvo) return;
      alvo.qtd += 1;
      alvo.principal += r.principal;
      alvo.juros += r.juros;
      alvo.final += r.final;
      alvo.pago += r.pago;
      alvo.saldo += r.saldo;
    });
    return t;
  }, [resumos]);

  const posicaoLiquida = totais.credito.saldo - totais.debito.saldo;

  const alternarExpandido = (id) => {
    setExpandidos((atual) => ({ ...atual, [id]: !atual[id] }));
  };

  const gerarPDF = async (lista, titulo) => {
    try {
      await gerarRelatorioOperacoesPDF(lista, titulo, dadosLoja);
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      if (showError) showError('Erro ao gerar PDF');
    }
  };

  const estiloCampo = {
    padding: '0.6rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    width: '100%'
  };
  const estiloLabel = { fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
        Carregando relatório...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* CABEÇALHO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--color-text)', fontWeight: 700, fontSize: '1.4rem' }}>📋 Relatório por Operação</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)' }}>
            Valor buscado, juros e situação de cada operação
          </p>
        </div>
        <button
          onClick={() => gerarPDF(resumos, 'Relatório de Créditos e Débitos')}
          disabled={resumos.length === 0}
          style={{
            padding: '0.6rem 1.1rem',
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            fontWeight: 600,
            cursor: resumos.length === 0 ? 'not-allowed' : 'pointer',
            opacity: resumos.length === 0 ? 0.5 : 1,
            background: 'var(--color-accent)',
            color: '#fff'
          }}
        >
          📄 Relatório geral (PDF)
        </button>
      </div>

      {/* FILTROS */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding: '1rem 1.25rem'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={estiloLabel}>🔍 Buscar</label>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Entidade ou descrição..."
              style={estiloCampo}
            />
          </div>
          <div>
            <label style={estiloLabel}>Tipo</label>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={estiloCampo}>
              <option value="todos">Todos</option>
              <option value="credito">Créditos (a receber)</option>
              <option value="debito">Débitos (a pagar)</option>
            </select>
          </div>
          <div>
            <label style={estiloLabel}>Status</label>
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={estiloCampo}>
              <option value="ativo">Ativos</option>
              <option value="quitado">Quitados</option>
              <option value="cancelado">Cancelados</option>
              <option value="todos">Todos</option>
            </select>
          </div>
        </div>
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          Mostrando <strong>{resumos.length}</strong> de <strong>{operacoes.length}</strong> operações
        </p>
      </div>

      {/* TOTAIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        <BlocoTotais titulo="💵 Créditos (a receber)" cor={COR_CREDITO} t={totais.credito} />
        <BlocoTotais titulo="💳 Débitos (a pagar)" cor={COR_DEBITO} t={totais.debito} />
      </div>
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding: '0.9rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>⚖️ Posição líquida (restante a receber − restante a pagar)</span>
        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: posicaoLiquida >= 0 ? COR_CREDITO : COR_DEBITO }}>
          {posicaoLiquida >= 0 ? '' : '− '}{fmtR(Math.abs(posicaoLiquida))}
          <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
            {posicaoLiquida >= 0 ? 'saldo credor' : 'saldo devedor'}
          </span>
        </span>
      </div>

      {/* OPERAÇÕES */}
      {resumos.length === 0 ? (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '2.5rem',
          textAlign: 'center',
          color: 'var(--color-text-muted)'
        }}>
          Nenhuma operação encontrada com os filtros atuais.
        </div>
      ) : (
        resumos.map((r) => {
          const op = r.op;
          const corTipo = op.tipo_operacao === 'credito' ? COR_CREDITO : COR_DEBITO;
          const aberto = !!expandidos[op.id];
          const temParcelas = r.parcelas.length > 0;
          const rotuloRestante = op.tipo_operacao === 'credito' ? 'Restante a receber' : 'Restante a pagar';

          return (
            <div
              key={op.id}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderLeft: '4px solid ' + corTipo,
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-md)',
                padding: '1.25rem'
              }}
            >
              {/* Título */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {op.entidade_nome || 'Entidade'}
                    </h3>
                    <Chip cor={corTipo} bg="transparent">
                      {op.tipo_operacao === 'credito' ? 'Crédito' : 'Débito'}
                    </Chip>
                    <Chip cor="var(--color-text-muted)" bg="var(--color-surface-2)">
                      {STATUS_LABEL[op.status] || op.status}
                    </Chip>
                    {op.forma_pagamento === 'parcelado' && op.numero_parcelas ? (
                      <Chip cor="#8b5cf6" bg="rgba(139,92,246,0.15)">{op.numero_parcelas}x</Chip>
                    ) : null}
                  </div>
                  {op.descricao ? (
                    <p style={{ margin: '0.4rem 0 0', color: 'var(--color-text)' }}>{op.descricao}</p>
                  ) : null}
                </div>
                <button
                  onClick={() => gerarPDF([r], 'Extrato da Operação')}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-text)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  📄 Extrato PDF
                </button>
              </div>

              {/* Valores */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <Campo label="Valor buscado" valor={fmtR(r.principal)} />
                <Campo
                  label={r.juros < 0 ? 'Desconto' : 'Juros'}
                  valor={fmtR(Math.abs(r.juros))}
                  cor={r.juros === 0 ? 'var(--color-text-muted)' : (r.juros > 0 ? '#f59e0b' : COR_CREDITO)}
                  sub={r.juros !== 0 && r.principal > 0 ? Math.abs(r.jurosPct).toFixed(2) + '% sobre o valor buscado' : null}
                />
                <Campo
                  label="Valor final"
                  valor={fmtR(r.final)}
                  sub={op.forma_pagamento === 'parcelado' && op.numero_parcelas ? op.numero_parcelas + 'x de ' + fmtR(op.valor_parcela) : null}
                />
                <Campo label="Valor pago" valor={fmtR(r.pago)} cor={COR_CREDITO} />
                <Campo label={rotuloRestante} valor={fmtR(r.saldo)} cor={r.saldo > 0 ? '#f59e0b' : COR_CREDITO} />
              </div>

              {/* Progresso */}
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                  <span>Progresso</span>
                  <span>{r.progresso.toFixed(1)}%</span>
                </div>
                <div style={{ height: '8px', borderRadius: '999px', background: 'var(--color-surface-3)', overflow: 'hidden' }}>
                  <div style={{ width: r.progresso + '%', height: '100%', background: COR_CREDITO }} />
                </div>
              </div>

              {/* Situação das parcelas */}
              {temParcelas ? (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Chip cor={COR_SITUACAO.paga.fg} bg={COR_SITUACAO.paga.bg}>
                      ✅ Pagas: {r.pagas.qtd} de {r.totalParcelas} — {fmtR(r.pagas.valor)}
                    </Chip>
                    <Chip cor={COR_SITUACAO.a_vencer.fg} bg={COR_SITUACAO.a_vencer.bg}>
                      ⏳ A vencer: {r.aVencer.qtd} — {fmtR(r.aVencer.valor)}
                    </Chip>
                    <Chip cor={COR_SITUACAO.atrasada.fg} bg={COR_SITUACAO.atrasada.bg}>
                      🚨 Atrasadas: {r.atrasadas.qtd} — {fmtR(r.atrasadas.valor)}
                    </Chip>
                  </div>
                  {r.proxima ? (
                    <p style={{ margin: '0.6rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      Próxima parcela: nº {r.proxima.numero_parcela} — vence em {fmtData(r.proxima.data_vencimento)} — {fmtR(r.proxima.valor)}
                    </p>
                  ) : null}
                  {r.arredondamento ? (
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      Diferença de centavos entre a soma das parcelas e o restante: arredondamento das parcelas.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p style={{ margin: '1rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Sem parcelas cadastradas ({FORMA_LABEL[op.forma_pagamento] || 'operação'}).
                </p>
              )}

              {/* Rodapé informativo */}
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                <span>📅 Lançamento: {fmtData(op.data_lancamento)}</span>
                <span>💳 Forma: {FORMA_LABEL[op.forma_pagamento] || op.forma_pagamento || '—'}</span>
                <span>💰 Meio: {op.meio_pagamento || '—'}</span>
              </div>

              {op.observacoes ? (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.6rem 0.8rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.82rem',
                  color: 'var(--color-text)'
                }}>
                  💡 Obs: {op.observacoes}
                </div>
              ) : null}

              {/* Cronograma */}
              {temParcelas ? (
                <div style={{ marginTop: '1rem' }}>
                  <button
                    onClick={() => alternarExpandido(op.id)}
                    style={{
                      padding: '0.45rem 0.9rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface-2)',
                      color: 'var(--color-text)',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {aberto ? '▲ Ocultar parcelas' : '▼ Ver parcelas (' + r.parcelas.length + ')'}
                  </button>

                  {aberto ? (
                    <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                            <th style={{ padding: '0.4rem 0.5rem' }}>Nº</th>
                            <th style={{ padding: '0.4rem 0.5rem' }}>Vencimento</th>
                            <th style={{ padding: '0.4rem 0.5rem' }}>Valor</th>
                            <th style={{ padding: '0.4rem 0.5rem' }}>Situação</th>
                            <th style={{ padding: '0.4rem 0.5rem' }}>Pago em</th>
                            <th style={{ padding: '0.4rem 0.5rem' }}>Valor pago</th>
                            <th style={{ padding: '0.4rem 0.5rem' }}>Atraso</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.parcelas.map((p) => (
                            <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                              <td style={{ padding: '0.4rem 0.5rem' }}>{p.numero_parcela}</td>
                              <td style={{ padding: '0.4rem 0.5rem' }}>{fmtData(p.data_vencimento)}</td>
                              <td style={{ padding: '0.4rem 0.5rem' }}>{fmtR(p.valor)}</td>
                              <td style={{ padding: '0.4rem 0.5rem' }}>
                                <span style={{
                                  padding: '0.15rem 0.55rem',
                                  borderRadius: '999px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  color: COR_SITUACAO[p.situacao].fg,
                                  background: COR_SITUACAO[p.situacao].bg
                                }}>
                                  {SITUACAO_PARCELA_LABEL[p.situacao]}
                                </span>
                              </td>
                              <td style={{ padding: '0.4rem 0.5rem' }}>{p.data_pagamento ? fmtData(p.data_pagamento) : '—'}</td>
                              <td style={{ padding: '0.4rem 0.5rem' }}>{p.situacao === 'paga' ? fmtR(p.valor_pago) : '—'}</td>
                              <td style={{ padding: '0.4rem 0.5rem' }}>{p.dias > 0 ? p.dias + ' dias' : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
