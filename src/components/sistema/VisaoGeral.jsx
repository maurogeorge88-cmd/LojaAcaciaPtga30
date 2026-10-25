import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { ehAjusteInternoTronco } from '../financeiro/utils/ajusteTronco';
import { gerarVisaoGeralPDF } from '../../utils/gerarVisaoGeralPDF';
import { LOGO_LOJA_B64 } from '../../utils/logoLoja';

// ════════════════════════════════════════════════════════════════════════
// VISÃO GERAL — o ano da Loja em uma tela (somente leitura).
// Lê dos módulos existentes: balaústres, financeiro, ágapes, eventos,
// projetos, caridade, comodatos e presença. Nada aqui altera dados.
// ════════════════════════════════════════════════════════════════════════

const moeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '—');
const anoDe = (d) => (d ? Number(String(d).substring(0, 4)) : null);

const CORES = { azul: '#3b82f6', verde: '#10b981', roxo: '#8b5cf6', ambar: '#f59e0b', vermelho: '#ef4444', cinza: '#94a3b8' };

const Secao = ({ titulo, icone, children, acao }) => (
  <section style={{ marginBottom: '1.5rem' }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.6rem' }}>
      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>{icone} {titulo}</h3>
      {acao}
    </div>
    {children}
  </section>
);

const Cartao = ({ rotulo, valor, detalhe, cor = CORES.azul }) => (
  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: `4px solid ${cor}`, borderRadius: 'var(--radius-lg)', padding: '0.85rem 1rem', minWidth: 0, height: '100%', boxSizing: 'border-box' }}>
    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{rotulo}</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.25, overflowWrap: 'anywhere' }}>{valor}</div>
    {detalhe && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>{detalhe}</div>}
  </div>
);

// Flex: os cartões crescem para preencher a linha e os que sobram ficam centralizados,
// mantendo a mesma largura dos de cima
const Grade = ({ children, min = '190px' }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'center' }}>
    {Array.isArray(children)
      ? children.flat().filter(Boolean).map((c, i) => (
          <div key={i} style={{ flex: `1 1 ${min}`, minWidth: min, maxWidth: '280px' }}>{c}</div>
        ))
      : children}
  </div>
);

const Tabela = ({ colunas, linhas, vazio = 'Nada registrado neste ano.' }) => (
  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflowX: 'auto' }}>
    {linhas.length === 0 ? (
      <p style={{ margin: 0, padding: '0.9rem 1rem', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{vazio}</p>
    ) : (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '520px' }}>
        <thead>
          <tr style={{ background: 'var(--color-surface-2)' }}>
            {colunas.map((c, i) => (
              <th key={i} style={{ textAlign: c.align || 'left', padding: '0.5rem 0.8rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
              {l.map((cel, j) => (
                <td key={j} style={{ padding: '0.45rem 0.8rem', textAlign: colunas[j].align || 'left', color: 'var(--color-text)' }}>{cel}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

export default function VisaoGeral({ showError }) {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [carregando, setCarregando] = useState(true);
  const [d, setD] = useState(null);

  useEffect(() => {
    let vivo = true;
    const de = `${ano}-01-01`;
    const ate = `${ano}-12-31`;

    (async () => {
      setCarregando(true);
      try {
        const q = (p) => p.then(r => r.data || []);
        const [
          balaustres, lancAteInicio, lancAno, agapes, despesasAgape, rateioAgape, pranchas, editais, loja, eventos, projetos, custosProj, receitasProj,
          ajudas, familias, comodatos, sessoesPres,
        ] = await Promise.all([
          q(supabase.from('balaustres').select('id, grau_sessao, data_sessao, numero_balaustre').gte('data_sessao', de).lte('data_sessao', ate)),
          q(supabase.from('lancamentos_loja').select('valor, tipo_pagamento, eh_transferencia_interna, categorias_financeiras(tipo, nome)').eq('status', 'pago').lt('data_pagamento', de)),
          q(supabase.from('lancamentos_loja').select('valor, data_pagamento, tipo_pagamento, eh_transferencia_interna, categorias_financeiras(tipo, nome)').eq('status', 'pago').gte('data_pagamento', de).lte('data_pagamento', ate)),
          q(supabase.from('eventos_comemorativos_fin').select('*').eq('ano', ano)),
          // Custo do ágape = despesas vinculadas; parte dos Irmãos = rateio das cotas
          q(supabase.from('lancamentos_loja').select('valor, tipo, evento_comemorativo_id, origem_tipo').not('evento_comemorativo_id', 'is', null)),
          q(supabase.from('evento_rateio_participantes').select('evento_id, cotas, irmao_id')),
          q(supabase.from('pranchas_expedidas').select('id, data_prancha, numero_prancha')),
          q(supabase.from('editais').select('id, ano').eq('ano', ano)),
          q(supabase.from('dados_loja').select('*').limit(1)),
          q(supabase.from('eventos_loja').select('id, nome_evento, tipo_evento, status, data_prevista')),
          q(supabase.from('projetos').select('id, nome, status, data_inicio, created_at')),
          q(supabase.from('custos_projeto').select('projeto_id, valor')),
          q(supabase.from('receitas_projeto').select('projeto_id, valor')),
          q(supabase.from('ajudas_caridade').select('id, data_ajuda, valor_estimado, familia_id').gte('data_ajuda', de).lte('data_ajuda', ate)),
          q(supabase.from('familias_carentes').select('id, ativa')),
          q(supabase.from('comodatos').select('id, status, data_emprestimo, data_devolucao_real, beneficiario_id')),
          q(supabase.from('sessoes_presenca').select('id, data_sessao').gte('data_sessao', de).lte('data_sessao', ate)),
        ]);
        if (!vivo) return;
        setD({ balaustres, lancAteInicio, lancAno, agapes, despesasAgape, rateioAgape, pranchas, editais, loja, eventos, projetos, custosProj, receitasProj, ajudas, familias, comodatos, sessoesPres });
      } catch (e) {
        showError?.('Erro ao carregar a visão geral: ' + e.message);
        if (vivo) setD(null);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [ano]);

  // ── Cálculos ────────────────────────────────────────────────────────────
  const r = useMemo(() => {
    if (!d) return null;
    const n = (v) => Number(v) || 0;

    // Financeiro: mesma regra das telas (banco = sem dinheiro/compensação; caixa = dinheiro)
    const saldos = (lancs) => {
      let banco = 0, caixa = 0, receitas = 0, despesas = 0;
      lancs.forEach((l) => {
        const tipo = l.categorias_financeiras?.tipo;
        const nome = (l.categorias_financeiras?.nome || '').toLowerCase();
        const interna = !!l.eh_transferencia_interna;
        const dinheiro = l.tipo_pagamento === 'dinheiro';
        const comp = l.tipo_pagamento === 'compensacao';
        const v = n(l.valor);
        if (tipo === 'receita') {
          if (!interna && !comp) receitas += v;
          if (interna) banco += v;
          else if (!comp && !dinheiro) banco += v;
          else if (!comp && dinheiro && !nome.includes('tronco')) caixa += v;
        } else if (tipo === 'despesa') {
          if (ehAjusteInternoTronco(l)) return; // só abate o Tronco
          if (!interna && !comp) despesas += v;
          if (!interna && !comp && !dinheiro) banco -= v;
          else if (interna && !nome.includes('tronco')) caixa -= v;
          else if (!interna && dinheiro && !comp && !nome.includes('tronco')) caixa -= v;
        }
      });
      return { banco, caixa, receitas, despesas, total: banco + caixa };
    };
    const inicio = saldos(d.lancAteInicio);
    const fim = saldos([...d.lancAteInicio, ...d.lancAno]);
    const movimento = saldos(d.lancAno);

    // Top categorias do ano
    const porCategoria = (tipo) => {
      const m = {};
      d.lancAno.forEach((l) => {
        if (l.categorias_financeiras?.tipo !== tipo) return;
        if (l.eh_transferencia_interna || l.tipo_pagamento === 'compensacao') return;
        const nome = l.categorias_financeiras?.nome || 'Sem categoria';
        m[nome] = (m[nome] || 0) + n(l.valor);
      });
      return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
    };

    // Balaústres por grau (só o grau, sem separar por tipo de sessão)
    const graus = {};
    d.balaustres.forEach((b) => {
      const g = (b.grau_sessao || 'Não informado').trim();
      graus[g] = (graus[g] || 0) + 1;
    });
    const ORDEM = ['Aprendiz', 'Companheiro', 'Mestre'];
    const balaustresGrau = Object.entries(graus).sort((a, b) => {
      const ia = ORDEM.indexOf(a[0]), ib = ORDEM.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    // Ágapes: o que a Loja custeou, o que os Irmãos pagaram e o total
    // Mesmas contas da tela Ágape & Festas:
    //   custo = soma das despesas vinculadas · Loja = contribuição · Irmãos = rateio das cotas
    const despPorEvento = {};
    (d.despesasAgape || []).forEach((l) => {
      if (l.tipo !== 'despesa') return;
      despPorEvento[l.evento_comemorativo_id] = (despPorEvento[l.evento_comemorativo_id] || 0) + n(l.valor);
    });
    // Cotas separadas: Irmãos pagam a sua parte; a dos convidados externos é custo da Loja
    const cotas = {};
    (d.rateioAgape || []).forEach((p) => {
      const g = cotas[p.evento_id] || (cotas[p.evento_id] = { irmaos: 0, convidados: 0 });
      if (p.irmao_id) g.irmaos += n(p.cotas); else g.convidados += n(p.cotas);
    });
    const agapes = d.agapes.map((a) => {
      const total = despPorEvento[a.id] || 0;              // valor total do ágape (despesas vinculadas)
      const contrib = n(a.contribuicao_loja);              // contribuição fixa da Loja, se houver
      const c = cotas[a.id] || { irmaos: 0, convidados: 0 };
      const todas = c.irmaos + c.convidados;
      const valorCota = a.valor_ajustado ? n(a.valor_ajustado) : (todas > 0 ? Math.max(0, total - contrib) / todas : 0);
      const irmaos = c.irmaos * valorCota;                 // o que os Irmãos pagaram
      const convidados = c.convidados * valorCota + contrib; // parte dos convidados (já dentro do total)
      // Saldo = o que os Irmãos pagaram menos o custo total.
      // Negativo: a Loja bancou a diferença (despesa). Positivo: sobrou para a Loja.
      const saldo = irmaos - total;
      const loja = Math.max(0, -saldo);                    // quanto a Loja bancou
      return { nome: a.nome || a.descricao || 'Ágape', data: a.data_evento, status: a.status, total, loja, irmaos, convidados, saldo };
    }).sort((x, y) => String(x.data || '').localeCompare(String(y.data || '')));
    const agTotal = agapes.reduce((t, a) => t + a.total, 0);
    const agLoja = agapes.reduce((t, a) => t + a.loja, 0);
    const agConvidados = agapes.reduce((t, a) => t + a.convidados, 0);
    const agIrmaos = agapes.reduce((t, a) => t + a.irmaos, 0);
    const agSaldo = agapes.reduce((t, a) => t + a.saldo, 0);

    // Projetos do ano, com custo e receita
    const somaPor = (lista, campo) => lista.reduce((m, x) => { m[x.projeto_id] = (m[x.projeto_id] || 0) + n(x.valor); return m; }, {});
    const custoP = somaPor(d.custosProj);
    const receitaP = somaPor(d.receitasProj);
    const projetos = d.projetos
      .filter(p => anoDe(p.data_inicio || p.created_at) === ano)
      .map(p => ({ nome: p.nome, status: p.status, data: p.data_inicio || p.created_at, custo: custoP[p.id] || 0, receita: receitaP[p.id] || 0 }));

    const eventos = d.eventos.filter(e => anoDe(e.data_prevista) === ano);
    const comodatosAno = d.comodatos.filter(c => anoDe(c.data_emprestimo) === ano);
    const comodatosAtivos = d.comodatos.filter(c => !c.data_devolucao_real && String(c.status || '').toLowerCase() !== 'devolvido');
    const familiasAtendidas = new Set(d.ajudas.map(a => a.familia_id).filter(Boolean)).size;
    const totalAjudas = d.ajudas.reduce((t, a) => t + n(a.valor_estimado), 0);

    return {
      inicio, fim, movimento, topReceitas: porCategoria('receita'), topDespesas: porCategoria('despesa'),
      balaustresGrau, totalBalaustres: d.balaustres.length, sessoes: d.sessoesPres.length,
      agapes, agTotal, agLoja, agIrmaos, agSaldo, agConvidados,
      pranchas: d.pranchas.filter(p => {
        const anoData = anoDe(p.data_prancha);
        if (anoData) return anoData === ano;
        const m = String(p.numero_prancha || '').match(/(\d{4})\s*$/); // ex.: 034/2026
        return m ? Number(m[1]) === ano : false;
      }).length,
      editais: d.editais.length,
      eventos, projetos, comodatosAno, comodatosAtivos, familiasAtendidas, totalAjudas,
      ajudas: d.ajudas.length, familiasCadastradas: d.familias.length,
    };
  }, [d, ano]);

  const anos = Array.from({ length: 6 }, (_, i) => anoAtual - i);
  const variacao = r ? r.fim.total - r.inicio.total : 0;

  return (
    <div style={{ padding: '0.5rem', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Ano + aviso de somente leitura */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Ano</label>
        <select value={ano} onChange={e => setAno(Number(e.target.value))}
          style={{ padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: '0.9rem', fontWeight: 700, outline: 'none' }}>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Somente leitura — nada aqui altera dados.</span>
        <button type="button" disabled={carregando || !r}
          onClick={() => gerarVisaoGeralPDF({ ano, r, dadosLoja: (d?.loja && d.loja[0]) || {}, logoB64: LOGO_LOJA_B64 })}
          style={{ marginLeft: 'auto', padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-md)', border: 'none', background: carregando || !r ? 'var(--color-surface-3)' : 'var(--color-accent)', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: carregando || !r ? 'not-allowed' : 'pointer' }}>
          📄 Gerar PDF
        </button>
      </div>

      {carregando && <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Carregando o ano de {ano}…</p>}

      {!carregando && r && (<>
        <Secao titulo={`O ano de ${ano} em números`} icone="📌">
          <Grade>
            <Cartao rotulo="Sessões realizadas" valor={r.sessoes} cor={CORES.azul} />
            <Cartao rotulo="Balaústres" valor={r.totalBalaustres} cor={CORES.roxo} />
            <Cartao rotulo="Ágapes e festas" valor={r.agapes.length} detalhe={moeda(r.agTotal)} cor={CORES.ambar} />
            <Cartao rotulo="Eventos" valor={r.eventos.length} cor={CORES.verde} />
            <Cartao rotulo="Famílias atendidas" valor={r.familiasAtendidas} detalhe={`${r.ajudas} ajuda(s)`} cor={CORES.verde} />
            <Cartao rotulo="Comodatos ativos" valor={r.comodatosAtivos.length} detalhe={`${r.comodatosAno.length} no ano`} cor={CORES.azul} />
            <Cartao rotulo="Pranchas" valor={r.pranchas} cor={CORES.cinza} />
            <Cartao rotulo="Editais" valor={r.editais} cor={CORES.cinza} />
          </Grade>
        </Secao>

        <Secao titulo="Balaústres por grau" icone="📕">
          <Grade min="160px">
            {r.balaustresGrau.map(([g, qtd]) => <Cartao key={g} rotulo={g} valor={qtd} cor={CORES.roxo} />)}
            <Cartao rotulo="Total" valor={r.totalBalaustres} cor={CORES.cinza} />
          </Grade>
        </Secao>

        <Secao titulo="Financeiro — como começou e como está" icone="💰">
          <Grade>
            <Cartao rotulo={`Saldo em 01/01/${ano}`} valor={moeda(r.inicio.total)} detalhe={`Banco ${moeda(r.inicio.banco)} · Caixa ${moeda(r.inicio.caixa)}`} cor={CORES.cinza} />
            <Cartao rotulo="Saldo hoje" valor={moeda(r.fim.total)} detalhe={`Banco ${moeda(r.fim.banco)} · Caixa ${moeda(r.fim.caixa)}`} cor={CORES.azul} />
            <Cartao rotulo="Variação no ano" valor={`${variacao >= 0 ? '+' : '−'} ${moeda(Math.abs(variacao))}`} cor={variacao >= 0 ? CORES.verde : CORES.vermelho} />
            <Cartao rotulo="Receitas do ano" valor={moeda(r.movimento.receitas)} cor={CORES.verde} />
            <Cartao rotulo="Despesas do ano" valor={moeda(r.movimento.despesas)} cor={CORES.vermelho} />
          </Grade>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.6rem', marginTop: '0.6rem' }}>
            <Tabela colunas={[{ titulo: 'Maiores receitas' }, { titulo: 'Valor', align: 'right' }]}
              linhas={r.topReceitas.map(([nome, v]) => [nome, moeda(v)])} />
            <Tabela colunas={[{ titulo: 'Maiores despesas' }, { titulo: 'Valor', align: 'right' }]}
              linhas={r.topDespesas.map(([nome, v]) => [nome, moeda(v)])} />
          </div>
        </Secao>

        <Secao titulo="Ágapes e festas" icone="🍽️">
          <Grade>
            <Cartao rotulo="Quantidade" valor={r.agapes.length} cor={CORES.ambar} />
            <Cartao rotulo="Valor total dos ágapes" valor={moeda(r.agTotal)} cor={CORES.azul} />
            <Cartao rotulo="Pago pelos Irmãos" valor={moeda(r.agIrmaos)} cor={CORES.verde} />
            <Cartao rotulo="Custo da Loja" valor={moeda(r.agLoja)} detalhe={`Convidados: ${moeda(r.agConvidados)}`} cor={CORES.roxo} />
            <Cartao rotulo="Saldo final" valor={moeda(r.agSaldo)} detalhe={r.agSaldo < 0 ? 'Pago pela Loja' : 'Sobrou para a Loja'} cor={r.agSaldo < 0 ? CORES.vermelho : CORES.verde} />
            <Cartao rotulo="Custo médio" valor={moeda(r.agapes.length ? r.agTotal / r.agapes.length : 0)} cor={CORES.cinza} />
          </Grade>
          <div style={{ marginTop: '0.6rem' }}>
            <Tabela
              colunas={[{ titulo: 'Ágape / Festa' }, { titulo: 'Data' }, { titulo: 'Valor total', align: 'right' }, { titulo: 'Pago pelos Irmãos', align: 'right' }, { titulo: 'Convidados', align: 'right' }, { titulo: 'Custo Loja', align: 'right' }, { titulo: 'Saldo', align: 'right' }]}
              linhas={r.agapes.map(a => [a.nome, dataBR(a.data), moeda(a.total), moeda(a.irmaos), moeda(a.convidados), moeda(a.loja),
                <span style={{ color: a.saldo < -0.005 ? CORES.vermelho : CORES.verde, fontWeight: 700 }}>{moeda(a.saldo)}</span>])}
              vazio="Nenhum ágape registrado neste ano." />
          </div>
        </Secao>

        <Secao titulo="Eventos e projetos" icone="🎪">
          <Tabela
            colunas={[{ titulo: 'Evento' }, { titulo: 'Tipo' }, { titulo: 'Data' }, { titulo: 'Situação' }]}
            linhas={r.eventos.map(e => [e.nome_evento, e.tipo_evento === 'externo' ? 'Externo' : 'Interno', dataBR(e.data_prevista), e.status || '—'])}
            vazio="Nenhum evento neste ano." />
          <div style={{ marginTop: '0.6rem' }}>
            <Tabela
              colunas={[{ titulo: 'Projeto' }, { titulo: 'Início' }, { titulo: 'Custo', align: 'right' }, { titulo: 'Receita', align: 'right' }, { titulo: 'Resultado', align: 'right' }]}
              linhas={r.projetos.map(p => [p.nome, dataBR(p.data), moeda(p.custo), moeda(p.receita), moeda(p.receita - p.custo)])}
              vazio="Nenhum projeto iniciado neste ano." />
          </div>
        </Secao>

        <Secao titulo="Filantropia e comodatos" icone="🤝">
          <Grade>
            <Cartao rotulo="Famílias atendidas" valor={r.familiasAtendidas} detalhe={`${r.familiasCadastradas} cadastradas`} cor={CORES.verde} />
            <Cartao rotulo="Ajudas concedidas" valor={r.ajudas} cor={CORES.verde} />
            <Cartao rotulo="Valor aplicado" valor={moeda(r.totalAjudas)} detalhe="Soma dos valores estimados" cor={CORES.azul} />
            <Cartao rotulo="Comodatos no ano" valor={r.comodatosAno.length} cor={CORES.roxo} />
            <Cartao rotulo="Comodatos ativos" valor={r.comodatosAtivos.length} detalhe="Ainda não devolvidos" cor={CORES.ambar} />
          </Grade>
        </Secao>
      </>)}
    </div>
  );
}
