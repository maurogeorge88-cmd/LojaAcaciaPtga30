import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarMoeda } from './utils/formatadores';
import {
  podeConferirFinanceiro, dataBR, buscarFechamentos, snapshotFinanceiro,
  compararComFechamento,
} from './utils/conferencia';

// ════════════════════════════════════════════════════════════════════════
// AUDITORIA FINANCEIRA — histórico de inclusões, alterações e exclusões de lançamentos
// (quem, quando, valor antes → depois) + alerta de mudança após a conferência.
// Acesso: Admin, Venerável e Tesoureiro.
// ════════════════════════════════════════════════════════════════════════

const OPERACOES = {
  INSERT: { rotulo: 'Inclusão', cor: '#10b981' },
  UPDATE: { rotulo: 'Alteração', cor: '#3b82f6' },
  DELETE: { rotulo: 'Exclusão', cor: '#ef4444' },
};

const CAMPOS = {
  valor: 'Valor', status: 'Status', descricao: 'Descrição', categoria_id: 'Categoria',
  data_pagamento: 'Data de pagamento', data_vencimento: 'Vencimento', data_lancamento: 'Data do lançamento',
  tipo_pagamento: 'Forma de pagamento', observacoes: 'Observações',
  eh_transferencia_interna: 'Transferência interna', eh_pagamento_parcial: 'Pagamento parcial',
  lancamento_principal_id: 'Lançamento principal', origem_tipo: 'Origem', origem_irmao_id: 'Irmão (origem)',
  parcela_numero: 'Parcela', parcela_total: 'Total de parcelas',
};
const CAMPOS_DATA = ['data_pagamento', 'data_vencimento', 'data_lancamento'];
const CAMPOS_IGNORADOS = ['id', 'created_at', 'updated_at'];
const CAMPOS_RESUMO = ['descricao', 'categoria_id', 'valor', 'data_pagamento', 'status', 'tipo_pagamento'];

const hoje = () => new Date().toISOString().substring(0, 10);
const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().substring(0, 10); };
const dataHora = (iso) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

const inp = { padding: '0.4rem 0.7rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: '0.82rem', outline: 'none' };
const lab = { fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' };

export default function AuditoriaFinanceira({ userData, showSuccess, showError }) {
  const [de, setDe] = useState(diasAtras(30));
  const [ate, setAte] = useState(hoje());
  const [usuario, setUsuario] = useState('');
  const [operacao, setOperacao] = useState('');
  const [soAposConferencia, setSoAposConferencia] = useState(false);
  const [registros, setRegistros] = useState([]);
  const [categorias, setCategorias] = useState({});
  const [fechamentos, setFechamentos] = useState([]);
  const [divergencia, setDivergencia] = useState({ mudou: false, itens: [] });
  const [loading, setLoading] = useState(false);

  const podeVer = podeConferirFinanceiro(userData);
  const ultimo = fechamentos[0] || null;

  const carregarFechamentos = async () => {
    try {
      const lista = await buscarFechamentos(12);
      setFechamentos(lista);
      if (lista[0]) {
        const atual = await snapshotFinanceiro(lista[0].data_corte);
        setDivergencia(compararComFechamento(lista[0], atual));
      } else {
        setDivergencia({ mudou: false, itens: [] });
      }
    } catch (e) {
      showError?.('Erro ao carregar conferências: ' + e.message);
    }
  };

  const carregarRegistros = async () => {
    // Campo de data vazio/incompleto (limpou ou está digitando): não consulta
    if (!de || !ate || de.length !== 10 || ate.length !== 10) return;
    setLoading(true);
    try {
      let q = supabase.from('auditoria_lancamentos').select('*')
        .gte('em', `${de}T00:00:00`).lte('em', `${ate}T23:59:59`)
        .order('em', { ascending: false }).limit(500);
      if (operacao) q = q.eq('operacao', operacao);
      const { data, error } = await q;
      if (error) throw error;
      setRegistros(data || []);
    } catch (e) {
      showError?.('Erro ao carregar a auditoria: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!podeVer) return;
    carregarFechamentos();
    supabase.from('categorias_financeiras').select('id, nome').then(({ data }) => {
      setCategorias(Object.fromEntries((data || []).map(c => [String(c.id), c.nome])));
    });
  }, []);
  useEffect(() => { if (podeVer) carregarRegistros(); }, [de, ate, operacao]);

  const aposConferencia = (r) =>
    !!ultimo && new Date(r.em) > new Date(ultimo.conferido_em) && !!r.data_pagamento_min && r.data_pagamento_min <= ultimo.data_corte;

  const usuarios = useMemo(
    () => [...new Set(registros.map(r => r.usuario_nome || r.usuario_email).filter(Boolean))].sort(),
    [registros]
  );

  const visiveis = registros.filter(r => {
    if (usuario && (r.usuario_nome || r.usuario_email) !== usuario) return false;
    if (soAposConferencia && !aposConferencia(r)) return false;
    return true;
  });

  const fmtValor = (campo, v) => {
    if (v === null || v === undefined || v === '') return '—';
    if (campo === 'valor') return formatarMoeda(v);
    if (CAMPOS_DATA.includes(campo)) return dataBR(v);
    if (campo === 'categoria_id') return categorias[String(v)] || `#${v}`;
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
    return String(v);
  };

  const mudancas = (r) => {
    const antes = r.antes || {}; const depois = r.depois || {};
    if (r.operacao === 'UPDATE') {
      return Object.keys({ ...antes, ...depois })
        .filter(k => !CAMPOS_IGNORADOS.includes(k) && JSON.stringify(antes[k]) !== JSON.stringify(depois[k]))
        .map(k => ({ campo: k, antes: antes[k], depois: depois[k] }));
    }
    return [];
  };

  const desfazerUltima = async () => {
    if (!ultimo || !podeVer) return;
    if (!window.confirm(`Desfazer a conferência até ${dataBR(ultimo.data_corte)}?`)) return;
    try {
      const { data, error } = await supabase.from('fechamentos_financeiros').delete().eq('id', ultimo.id).select();
      if (error) throw error;
      if (!data?.length) throw new Error('o banco não permitiu a exclusão (sem permissão).');
      showSuccess?.('Conferência desfeita.');
      carregarFechamentos();
    } catch (e) {
      showError?.('Erro ao desfazer: ' + e.message);
    }
  };

  if (!podeVer) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center rounded-lg p-8 max-w-md" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>Acesso Restrito</h2>
          <p className="text-sm">A Auditoria Financeira é exclusiva de Admin, Venerável e Tesoureiro.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {/* ATENÇÃO — saldo conferido mudou */}
      {divergencia.mudou && ultimo && (
        <div style={{ border: '1px solid rgba(239,68,68,0.45)', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem' }}>
          <p style={{ margin: 0, fontWeight: 800, color: '#ef4444' }}>⚠ Atenção!</p>
          <p style={{ margin: '0.2rem 0 0.4rem', fontSize: '0.82rem', color: 'var(--color-text)' }}>
            O que foi conferido até {dataBR(ultimo.data_corte)} mudou depois da conferência:
          </p>
          {divergencia.itens.map(i => (
            <p key={i.campo} style={{ margin: '0.1rem 0', fontSize: '0.82rem', color: 'var(--color-text)' }}>
              <strong>{i.rotulo}:</strong> {formatarMoeda(i.antes)} → {formatarMoeda(i.agora)}{' '}
              <span style={{ color: '#ef4444', fontWeight: 700 }}>({i.diferenca > 0 ? '+' : '−'}{formatarMoeda(Math.abs(i.diferenca))})</span>
            </p>
          ))}
          <button type="button" onClick={() => setSoAposConferencia(true)}
            style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', background: 'transparent', border: '1px solid rgba(239,68,68,0.45)', borderRadius: '999px', padding: '0.15rem 0.7rem', cursor: 'pointer' }}>
            Ver só as alterações após a conferência
          </button>
        </div>
      )}

      {/* CONFERÊNCIAS */}
      <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem' }}>
        <p style={{ margin: '0 0 0.4rem', fontWeight: 800, fontSize: '0.85rem', color: 'var(--color-text)' }}>✔ Conferências</p>
        {fechamentos.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Nenhuma conferência registrada. Marque em Finanças – Loja, no card Saldo Anterior (“Conferir até…”).
          </p>
        ) : fechamentos.map((f, idx) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.3rem 0', borderTop: idx ? '1px solid var(--color-border)' : 'none', fontSize: '0.8rem' }}>
            <strong style={{ color: '#10b981', minWidth: '110px' }}>✔ - {dataBR(f.data_corte)}</strong>
            <span style={{ color: 'var(--color-text-muted)', flex: 1 }}>
              {f.conferido_por_nome || f.conferido_por_email || '—'} · {dataHora(f.conferido_em)}
            </span>
            {idx === 0 && (
              <button type="button" onClick={desfazerUltima}
                style={{ fontSize: '0.7rem', color: '#ef4444', background: 'transparent', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '999px', padding: '0 0.6rem', cursor: 'pointer' }}>
                Desfazer
              </button>
            )}
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><label style={lab}>De</label><input type="date" value={de} onChange={e => setDe(e.target.value)} style={inp} /></div>
        <div><label style={lab}>Até</label><input type="date" value={ate} onChange={e => setAte(e.target.value)} style={inp} /></div>
        <div>
          <label style={lab}>Usuário</label>
          <select value={usuario} onChange={e => setUsuario(e.target.value)} style={inp}>
            <option value="">Todos</option>
            {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label style={lab}>Operação</label>
          <select value={operacao} onChange={e => setOperacao(e.target.value)} style={inp}>
            <option value="">Todas</option>
            {Object.entries(OPERACOES).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--color-text)', paddingBottom: '0.3rem', opacity: ultimo ? 1 : 0.5 }}>
          <input type="checkbox" checked={soAposConferencia} disabled={!ultimo} onChange={e => setSoAposConferencia(e.target.checked)} />
          Só alterações após a conferência{ultimo ? ` de ${dataBR(ultimo.data_corte)}` : ''}
        </label>
        <button type="button" onClick={() => { carregarRegistros(); carregarFechamentos(); }}
          style={{ ...inp, cursor: 'pointer', fontWeight: 700, color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}>
          ↻ Atualizar
        </button>
      </div>

      {/* LISTA */}
      <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '0.6rem 1rem', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
          {loading ? 'Carregando…' : `${visiveis.length} registro(s)${registros.length >= 500 ? ' (limite de 500 — refine o período)' : ''}`}
        </div>
        {!loading && visiveis.length === 0 && (
          <p style={{ padding: '1rem', margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            Nenhum registro no filtro. A auditoria grava a partir da data em que foi ativada.
          </p>
        )}
        {visiveis.map(r => {
          const op = OPERACOES[r.operacao] || { rotulo: r.operacao, cor: '#94a3b8' };
          const base = r.depois || r.antes || {};
          const flag = aposConferencia(r);
          const lista = r.operacao === 'UPDATE' ? mudancas(r) : CAMPOS_RESUMO.map(k => ({ campo: k, valor: base[k] }));
          return (
            <div key={r.id} style={{ padding: '0.6rem 1rem', borderTop: '1px solid var(--color-border)', borderLeft: `4px solid ${op.cor}`, background: flag ? 'rgba(245,158,11,0.08)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                <strong style={{ color: 'var(--color-text)' }}>{dataHora(r.em)}</strong>
                <span style={{ color: 'var(--color-text-muted)' }}>{r.usuario_nome || r.usuario_email || '—'}</span>
                <span style={{ fontWeight: 700, color: op.cor, border: `1px solid ${op.cor}`, borderRadius: '999px', padding: '0 0.5rem', fontSize: '0.68rem' }}>{op.rotulo}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>Lançamento #{r.lancamento_id}{base.descricao ? ` — ${base.descricao}` : ''}</span>
                {flag && (
                  <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.7rem' }}>
                    ⚠ após a conferência de {dataBR(ultimo.data_corte)}
                  </span>
                )}
              </div>
              <div style={{ marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', fontSize: '0.8rem' }}>
                {lista.length === 0 && <span style={{ color: 'var(--color-text-muted)' }}>Sem diferença de campos.</span>}
                {r.operacao === 'UPDATE'
                  ? lista.map(m => (
                    <span key={m.campo} style={{ color: 'var(--color-text)' }}>
                      <strong>{CAMPOS[m.campo] || m.campo}:</strong>{' '}
                      <span style={{ color: '#ef4444' }}>{fmtValor(m.campo, m.antes)}</span> → <span style={{ color: '#10b981' }}>{fmtValor(m.campo, m.depois)}</span>
                    </span>
                  ))
                  : lista.map(m => (
                    <span key={m.campo} style={{ color: 'var(--color-text)' }}>
                      <strong>{CAMPOS[m.campo] || m.campo}:</strong> {fmtValor(m.campo, m.valor)}
                    </span>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
