import React, { useState, useEffect, useMemo } from 'react';
import { semVinculoNoPeriodo, estaFalecido } from '../utils/vinculoNoPeriodo';
import { supabase } from '../supabaseClient';
import ModalGradePresenca from './ModalGradePresenca';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';

// ── Apresentação: indicadores e gráficos ────────────────────────────────────
const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmtDataBR = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const corPorPct = (v) => (v >= 75 ? '#10b981' : v >= 50 ? '#f59e0b' : '#ef4444');

// Cores dos graus (mesmo padrão da Matriz de Presença) e das classificações (cadastro de sessões)
const COR_GRAU = { 1: '#eab308', 2: '#10b981', 3: '#3b82f6', 4: '#8b5cf6' };
const NOME_GRAU = { 1: 'Aprendiz', 2: 'Companheiro', 3: 'Mestre', 4: 'Administrativa' };
const COR_CLASSIFICACAO = { 'Econômica': '#10b981', 'Especial': '#8b5cf6', 'Magna': '#f59e0b', 'Extraordinária': '#ef4444' };

const tooltipEstilo = {
  contentStyle: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', fontSize: 12 },
  labelStyle: { color: 'var(--color-text)', fontWeight: 700 },
  itemStyle: { color: 'var(--color-text)' },
};

const KpiCard = ({ cor, rotulo, valor, sub, barra, chips = [] }) => (
  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: `3px solid ${cor}`, borderRadius: 'var(--radius-xl)', padding: '1rem 1.1rem', minWidth: 0 }}>
    <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{rotulo}</p>
    <p style={{ margin: '0.25rem 0 0', fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>{valor}</p>
    {sub && <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{sub}</p>}
    {barra != null && (
      <div style={{ height: 6, borderRadius: 999, background: 'var(--color-border)', marginTop: '0.6rem', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, barra)}%`, height: '100%', background: corPorPct(barra) }} />
      </div>
    )}
    {chips.length > 0 && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.6rem' }}>
        {chips.map(c => (
          <span key={c.rotulo} style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: 999, background: 'var(--color-surface-2)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)' }}>
            {c.rotulo}: <strong style={{ color: 'var(--color-text)' }}>{c.valor}</strong>
          </span>
        ))}
      </div>
    )}
  </div>
);

const cartaoGrafico = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1rem 1.1rem', minWidth: 0 };
const tituloGrafico = { margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };

const GraficoPizza = ({ titulo, dados }) => {
  const total = dados.reduce((acc, d) => acc + d.valor, 0);
  return (
    <div style={cartaoGrafico}>
      <p style={tituloGrafico}>{titulo}</p>
      {total === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0', margin: 0 }}>Sem sessões no período</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 170, height: 170, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dados} dataKey="valor" nameKey="nome" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
                  {dados.map(d => <Cell key={d.nome} fill={d.cor} />)}
                </Pie>
                <Tooltip {...tooltipEstilo} formatter={(v, n) => [`${v} sessão(ões)`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>{total}</span>
              <span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>sessões</span>
            </div>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: 120 }}>
            {dados.map(d => (
              <li key={d.nome} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--color-text)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: d.cor, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{d.nome}</span>
                <strong>{d.valor}</strong>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', minWidth: '2.4rem', textAlign: 'right' }}>{Math.round((d.valor / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const GraficoPresencaMensal = ({ dados }) => (
  <div style={cartaoGrafico}>
    <p style={tituloGrafico}>Presença por mês (%)</p>
    {dados.length === 0 ? (
      <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0', margin: 0 }}>Sem registros no período</p>
    ) : (
      <div style={{ width: '100%', height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 18, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipEstilo} cursor={{ fill: 'rgba(148,163,184,0.12)' }} formatter={(v, n, item) => [`${v}% (${item.payload.presentes}/${item.payload.total})`, 'Presença']} />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
              {dados.map(d => <Cell key={d.chave} fill={corPorPct(d.pct)} />)}
              <LabelList dataKey="pct" position="top" formatter={(v) => `${v}%`} style={{ fill: 'var(--color-text)', fontSize: 10, fontWeight: 700 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

export default function DashboardPresenca() {
  const [dados, setDados] = useState({ sessoes: 0, irmaos: 0, registros: 0 });

  const calcularIdade = (dataNascimento) => {
    const nasc = new Date(dataNascimento);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    if (hoje.getMonth() < nasc.getMonth() || 
       (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) {
      idade--;
    }
    return idade;
  };

  const formatarNome = (nomeCompleto) => {
    const partes = nomeCompleto.split(' ');
    if (partes.length <= 2) return nomeCompleto;
    
    const segundoNome = partes[1]?.toLowerCase();
    if (['de', 'da', 'do', 'dos', 'das'].includes(segundoNome)) {
      return partes.slice(0, 3).join(' ');
    }
    
    return `${partes[0]} ${partes[partes.length - 1]}`;
  };
  const [resumo, setResumo] = useState([]);
  const [resumoAno, setResumoAno] = useState([]);
  const [mostrarGrade, setMostrarGrade] = useState(false);
  const [periodo, setPeriodo] = useState('ano');
  const [percentualAlerta, setPercentualAlerta] = useState(30);
  const anoAtual = new Date().getFullYear();
  const [anoPresenca100, setAnoPresenca100] = useState(anoAtual);
  const [resumoPrerrogativa, setResumoPrerrogativa] = useState([]);
  const [resumoLicenciados, setResumoLicenciados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [anoAusencias, setAnoAusencias] = useState(anoAtual);
  const [mesAusencias, setMesAusencias] = useState(0);
  const [anoPrerrogativa, setAnoPrerrogativa] = useState(anoAtual);
  const [anoLicenciados, setAnoLicenciados] = useState(anoAtual);
  const [qtdSessoesRecentes, setQtdSessoesRecentes] = useState(4);
  const [sessoesRecentes, setSessoesRecentes] = useState([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [anoSelecionado, setAnoSelecionado] = useState(null); // Inicia null, define depois de buscar
  const [sessoesPeriodo, setSessoesPeriodo] = useState([]);   // sessões do período (gráficos por grau/classificação)
  const [presencaMensal, setPresencaMensal] = useState([]);   // presença por mês (gráfico de barras)

  // Buscar anos disponíveis na base
  useEffect(() => {
    const buscarAnos = async () => {
      console.log('🔍 Buscando anos disponíveis...');
      const { data } = await supabase
        .from('sessoes_presenca')
        .select('data_sessao')
        .order('data_sessao', { ascending: true });
      
      if (data && data.length > 0) {
        const anos = [...new Set(data.map(s => new Date(s.data_sessao).getFullYear()))];
        const anosSorted = anos.sort((a, b) => b - a); // Mais recente primeiro
        console.log('📅 Anos encontrados:', anosSorted);
        setAnosDisponiveis(anosSorted);
        
        // Definir ano mais recente como padrão
        const anoMaisRecente = anosSorted[0];
        console.log('✅ Definindo ano mais recente:', anoMaisRecente);
        setAnoSelecionado(anoMaisRecente);
        setAnoPresenca100(anoMaisRecente);
        setAnoAusencias(anoMaisRecente);
        setAnoPrerrogativa(anoMaisRecente);
        setAnoLicenciados(anoMaisRecente);
        setPeriodo('ano'); // Definir período como 'ano'
      }
    };
    buscarAnos();
  }, []);

  useEffect(() => {
    // Quando ano selecionado mudar, atualizar datas
    if (anoSelecionado) {
      console.log('📆 Atualizando datas para ano:', anoSelecionado);
      setDataInicio(`${anoSelecionado}-01-01`);
      setDataFim(`${anoSelecionado}-12-31`);
    }
  }, [anoSelecionado]);

  useEffect(() => {
    if (dataInicio && dataFim) {
      console.log('🔄 Carregando dados:', dataInicio, 'até', dataFim);
      carregar();
    }
  }, [dataInicio, dataFim]);

  useEffect(() => {
    carregarResumoAno();
  }, [anoPresenca100]);

  useEffect(() => {
    carregarPrerrogativa();
  }, [anoPrerrogativa]);

  useEffect(() => {
    carregarLicenciados();
  }, [anoLicenciados]);

  useEffect(() => {
    carregarSessoesRecentes();
  }, [qtdSessoesRecentes]);

  const carregarPrerrogativa = async () => {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataHoje = hoje.toISOString().split('T')[0];
      const inicioAno = `${anoPrerrogativa}-01-01`;

      console.log('🔍 Buscando sessões para prerrogativa:');
      console.log('  Ano:', anoPrerrogativa);
      console.log('  Período:', inicioAno, 'até', dataHoje);

      const { data: sessoes, error: erroSessoes } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id')
        .gte('data_sessao', inicioAno)
        .lte('data_sessao', dataHoje);

      console.log('  Sessões encontradas:', sessoes?.length || 0);
      console.log('  Erro:', erroSessoes);
      console.log('  Dados:', sessoes);

      // Buscar TODOS os registros com paginação
      let todosRegistros = [];
      let pagina = 0;
      const tamanhoPagina = 1000;
      let continuar = true;

      while (continuar) {
        const { data: lote, error: erroRegistros } = await supabase
          .from('registros_presenca')
          .select('membro_id, presente, sessao_id')
          .in('sessao_id', sessoes?.map(s => s.id) || [])
          .range(pagina * tamanhoPagina, (pagina + 1) * tamanhoPagina - 1);

        if (erroRegistros) {
          console.error('Erro ao buscar registros:', erroRegistros);
          break;
        }

        if (lote && lote.length > 0) {
          todosRegistros = [...todosRegistros, ...lote];
          pagina++;
          
          if (lote.length < tamanhoPagina) {
            continuar = false;
          }
        } else {
          continuar = false;
        }
      }

      const registros = todosRegistros;
      console.log('  Registros encontrados (após paginação):', registros?.length || 0);

      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, nome, data_nascimento, data_iniciacao, data_elevacao, data_exaltacao, mestre_instalado, data_falecimento, data_ingresso_loja, situacao, status');

      // Paginado (blocos de 1000) — evita truncamento silencioso do
      // histórico de situações quando a tabela já passou do limite padrão
      // do Supabase (acumula anos de licenças/desligamentos de todos os irmãos).
      let historicoSituacoes = [];
      {
        let inicioHistLoop = 0;
        const tamanhoPaginaHistLoop = 1000;
        let continuarHistLoop = true;
        while (continuarHistLoop) {
          const { data: loteHistLoop } = await supabase
            .from('historico_situacoes')
            .select('*')
            .eq('status', 'ativa')
            .range(inicioHistLoop, inicioHistLoop + tamanhoPaginaHistLoop - 1);
          if (loteHistLoop && loteHistLoop.length > 0) {
            historicoSituacoes = [...historicoSituacoes, ...loteHistLoop];
            inicioHistLoop += tamanhoPaginaHistLoop;
            if (loteHistLoop.length < tamanhoPaginaHistLoop) continuarHistLoop = false;
          } else {
            continuarHistLoop = false;
          }
        }
      }

      const sessoesMap = {};
      sessoes?.forEach(s => { sessoesMap[s.id] = s; });

      const comPrerrogativa = [];

      console.log('🔍 DEBUG PRERROGATIVA:');
      console.log('  Total de sessões no ano:', sessoes?.length);
      console.log('  Total de registros:', registros?.length);

      irmaos?.forEach(irmao => {
        // Falecido sai de todos os quadros; irregular/desligado/etc. sem retorno e sem
        // nenhuma sessão do ano antes da situação (ex.: irregular desde 2005) também sai.
        if (estaFalecido(irmao)) return;
        if (semVinculoNoPeriodo(irmao.id, historicoSituacoes, sessoes)) return;
        
        const idade = irmao.data_nascimento ? calcularIdade(irmao.data_nascimento) : null;
        if (idade < 70) return;

        console.log(`\n👤 ${irmao.nome}:`);

        let grauTexto = 'Não iniciado';
        let grauIrmao = 0;
        if (irmao.data_exaltacao) { grauTexto = irmao.mestre_instalado ? 'Mestre Instalado' : 'Mestre'; grauIrmao = 3; }
        else if (irmao.data_elevacao) { grauTexto = 'Companheiro'; grauIrmao = 2; }
        else if (irmao.data_iniciacao) { grauTexto = 'Aprendiz'; grauIrmao = 1; }

        const dataIngresso = irmao.data_ingresso_loja ? new Date(irmao.data_ingresso_loja + 'T00:00:00') : null;
        const dataIniciacao = irmao.data_iniciacao ? new Date(irmao.data_iniciacao + 'T00:00:00') : null;
        const dataInicio = dataIngresso || dataIniciacao;

        let totalRegistros = 0;
        let presentes = 0;

        // Para prerrogativa 70+: percorre TODAS as sessões do ano
        sessoes?.forEach(sessao => {
          const dataSessao = new Date(sessao.data_sessao + 'T00:00:00');
          
          // Só conta se sessão é após ingresso
          if (dataInicio && dataSessao < dataInicio) return;
          
          // Só conta se não estava em situação especial
          const situacaoNaData = historicoSituacoes?.find(sit => 
            sit.membro_id === irmao.id &&
            dataSessao >= new Date(sit.data_inicio + 'T00:00:00') &&
            (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'))
          );
          if (situacaoNaData) return;
          
          // Sessão válida para este irmão
          totalRegistros++;
          
          // Verificar se tem registro de presença
          const reg = registros?.find(r => r.membro_id === irmao.id && r.sessao_id === sessao.id);
          if (reg && reg.presente) {
            presentes++;
          }
        });

        console.log(`  ✅ Sessões elegíveis: ${totalRegistros}`);
        console.log(`  ✅ Presenças: ${presentes}`);

        const percentual = totalRegistros > 0 ? Math.round((presentes / totalRegistros) * 100) : 0;

        comPrerrogativa.push({
          id: irmao.id,
          nome: irmao.nome,
          grau: grauTexto,
          presencas: presentes,
          total: totalRegistros,
          percentual
        });
      });

      setResumoPrerrogativa(comPrerrogativa);
    } catch (error) {
      console.error('Erro ao carregar prerrogativa:', error);
    }
  };

  const carregarLicenciados = async () => {
    try {
      const inicioAno = `${anoLicenciados}-01-01`;
      const fimAno = `${anoLicenciados}-12-31`;

      const { data: sessoes } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id')
        .gte('data_sessao', inicioAno)
        .lte('data_sessao', fimAno);

      const { data: registros } = await supabase
        .from('registros_presenca')
        .select('membro_id, presente, sessao_id')
        .in('sessao_id', sessoes?.map(s => s.id) || []);

      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, nome, data_iniciacao, data_elevacao, data_exaltacao, mestre_instalado, data_ingresso_loja, data_falecimento, situacao, status')
        ;

      // Paginado (blocos de 1000) — evita truncamento silencioso do
      // histórico de situações quando a tabela já passou do limite padrão
      // do Supabase (acumula anos de licenças/desligamentos de todos os irmãos).
      let historicoSituacoes = [];
      {
        let inicioHistLoop = 0;
        const tamanhoPaginaHistLoop = 1000;
        let continuarHistLoop = true;
        while (continuarHistLoop) {
          const { data: loteHistLoop } = await supabase
            .from('historico_situacoes')
            .select('*')
            .eq('status', 'ativa')
            .range(inicioHistLoop, inicioHistLoop + tamanhoPaginaHistLoop - 1);
          if (loteHistLoop && loteHistLoop.length > 0) {
            historicoSituacoes = [...historicoSituacoes, ...loteHistLoop];
            inicioHistLoop += tamanhoPaginaHistLoop;
            if (loteHistLoop.length < tamanhoPaginaHistLoop) continuarHistLoop = false;
          } else {
            continuarHistLoop = false;
          }
        }
      }

      const hoje = new Date();
      const sessoesMap = {};
      sessoes?.forEach(s => { sessoesMap[s.id] = s; });

      const licenciados = [];

      irmaos?.forEach(irmao => {
        // Falecido e afastado sem retorno (irregular/desligado/etc.) não entram no quadro
        if (estaFalecido(irmao)) return;
        if (semVinculoNoPeriodo(irmao.id, historicoSituacoes, sessoes)) return;

        const estaLicenciado = historicoSituacoes?.some(sit => {
          const tipoNormalizado = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return sit.membro_id === irmao.id &&
            tipoNormalizado === 'licenca' &&
            (sit.data_fim === null || new Date(sit.data_fim) >= hoje);
        }) || false;

        if (!estaLicenciado) return;


        let grauTexto = 'Não iniciado';
        let grauIrmao = 0;
        if (irmao.data_exaltacao) { grauTexto = irmao.mestre_instalado ? 'Mestre Instalado' : 'Mestre'; grauIrmao = 3; }
        else if (irmao.data_elevacao) { grauTexto = 'Companheiro'; grauIrmao = 2; }
        else if (irmao.data_iniciacao) { grauTexto = 'Aprendiz'; grauIrmao = 1; }

        const dataIngresso = irmao.data_ingresso_loja ? new Date(irmao.data_ingresso_loja) : null;
        const dataIniciacao = irmao.data_iniciacao ? new Date(irmao.data_iniciacao) : null;
        const dataInicio = dataIngresso || dataIniciacao;

        let totalRegistros = 0;
        let presentes = 0;


        registros?.forEach(reg => {
          if (reg.membro_id === irmao.id) {
            const sessao = sessoesMap[reg.sessao_id];
            if (!sessao) {
              console.log('  ❌ Sessão não encontrada:', reg.sessao_id);
              return;
            }

            const dataSessao = new Date(sessao.data_sessao);
            let grauSessao = sessao.grau_sessao_id || 1;
            
            // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
            if (grauSessao === 4) grauSessao = 1;


            if (dataInicio && dataSessao < dataInicio) {
              return;
            }
            if (grauSessao > grauIrmao) {
              return;
            }

            // Para licenciados, só conta sessões quando NÃO estava em licença
            const situacaoNaData = historicoSituacoes?.find(sit => {
              const tipoNormalizado = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              return sit.membro_id === irmao.id &&
                tipoNormalizado === 'licenca' &&
                dataSessao >= new Date(sit.data_inicio + 'T00:00:00') &&
                (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'));
            });
            
            // Se estava em licença na data da sessão, não conta
            if (situacaoNaData) {
              return;
            }

            totalRegistros++;
            if (reg.presente) presentes++;
          }
        });


        const percentual = totalRegistros > 0 ? Math.round((presentes / totalRegistros) * 100) : 0;

        licenciados.push({
          id: irmao.id,
          nome: irmao.nome,
          grau: grauTexto,
          presencas: presentes,
          total: totalRegistros,
          percentual
        });
      });

      setResumoLicenciados(licenciados);
    } catch (error) {
      console.error('Erro ao carregar licenciados:', error);
    }
  };

  const carregarSessoesRecentes = async () => {
    try {
      const { data: sessoes } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id')
        .lte('data_sessao', new Date().toISOString().split('T')[0]) // Não incluir sessões futuras
        .order('data_sessao', { ascending: false })
        .limit(qtdSessoesRecentes);

      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, data_iniciacao, data_elevacao, data_exaltacao, mestre_instalado, data_ingresso_loja, data_nascimento, data_falecimento, data_desligamento');

      // Paginado (blocos de 1000) — evita truncamento silencioso do
      // histórico de situações quando a tabela já passou do limite padrão
      // do Supabase (acumula anos de licenças/desligamentos de todos os irmãos).
      let historicoSituacoes = [];
      {
        let inicioHistLoop = 0;
        const tamanhoPaginaHistLoop = 1000;
        let continuarHistLoop = true;
        while (continuarHistLoop) {
          const { data: loteHistLoop } = await supabase
            .from('historico_situacoes')
            .select('*')
            .eq('status', 'ativa')
            .range(inicioHistLoop, inicioHistLoop + tamanhoPaginaHistLoop - 1);
          if (loteHistLoop && loteHistLoop.length > 0) {
            historicoSituacoes = [...historicoSituacoes, ...loteHistLoop];
            inicioHistLoop += tamanhoPaginaHistLoop;
            if (loteHistLoop.length < tamanhoPaginaHistLoop) continuarHistLoop = false;
          } else {
            continuarHistLoop = false;
          }
        }
      }

      const sessoesComDados = await Promise.all(sessoes.map(async (sessao) => {
        const { data: registros } = await supabase
          .from('registros_presenca')
          .select('membro_id, presente')
          .eq('sessao_id', sessao.id);

        // Buscar visitantes da sessão
        const { data: visitantes, count: totalVisitantes } = await supabase
          .from('visitantes_sessao')
          .select('*', { count: 'exact', head: true })
          .eq('sessao_id', sessao.id);

        let grauSessao = sessao.grau_sessao_id || 1;
        const grauOriginal = sessao.grau_sessao_id || 1; // Salvar original para exibição
        
        // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
        if (grauSessao === 4) grauSessao = 1;
        
        const dataSessao = new Date(sessao.data_sessao + 'T00:00:00'); // Adicionar hora para evitar problema de timezone

        const elegiveis = [];
        let licenciadosCount = 0;
        let prerrogativaCount = 0;

        irmaos.forEach(i => {
          // 1. Verificar grau
          let grauIrmao = 0;
          if (i.data_exaltacao) grauIrmao = 3;
          else if (i.data_elevacao) grauIrmao = 2;
          else if (i.data_iniciacao) grauIrmao = 1;

          // Sessão de grau superior - não pode
          if (grauSessao > grauIrmao) return;

          // 2. Verificar data de ingresso
          const dataInicio = i.data_ingresso_loja ? new Date(i.data_ingresso_loja + 'T00:00:00') : 
                            i.data_iniciacao ? new Date(i.data_iniciacao + 'T00:00:00') : null;
          if (dataInicio && dataSessao < dataInicio) return;

          // 3. Verificar SITUAÇÕES BLOQUEADORAS na data da sessão - EXCLUI (não conta nem como licenciado/prerrogativa)
          const temSituacaoBloqueadora = historicoSituacoes?.find(sit => {
            const tipoNormalizado = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const situacoesExcluidas = ['desligado', 'irregular', 'suspenso', 'ex-oficio', 'excluido'];
            
            return sit.membro_id === i.id &&
              situacoesExcluidas.includes(tipoNormalizado) &&
              dataSessao >= new Date(sit.data_inicio + 'T00:00:00') &&
              (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'));
          });
          if (temSituacaoBloqueadora) return;

          // 4. Verificar falecimento - SE faleceu ANTES da sessão, NÃO é elegível
          if (i.data_falecimento) {
            const dataFalec = new Date(i.data_falecimento + 'T00:00:00');
            if (dataSessao >= dataFalec) return;
          }

          // 5. Licença vigente na data da sessão — REVERTIDO a pedido: volta
          // a contar como elegível normal. Continua sendo contabilizado à
          // parte (badge informativo), só não exclui mais da lista.
          const temLicenca = historicoSituacoes?.find(sit => {
            const tipoNormalizado = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return sit.membro_id === i.id &&
              tipoNormalizado.includes('licen') &&
              dataSessao >= new Date(sit.data_inicio + 'T00:00:00') &&
              (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'));
          });
          if (temLicenca) { licenciadosCount++; }

          // 6. Prerrogativa de idade (70+) na data da sessão — REVERTIDO a
          // pedido: volta a contar como elegível normal, mesma lógica.
          if (i.data_nascimento) {
            const nasc = new Date(i.data_nascimento + 'T00:00:00');
            let idade = dataSessao.getFullYear() - nasc.getFullYear();
            if (dataSessao.getMonth() < nasc.getMonth() ||
               (dataSessao.getMonth() === nasc.getMonth() && dataSessao.getDate() < nasc.getDate())) {
              idade--;
            }
            if (idade >= 70) { prerrogativaCount++; }
          }

          elegiveis.push(i);
        });

        const presencas = registros?.filter(r => r.presente).length || 0;
        const totalElegiveis = elegiveis.length;
        const ausencias = totalElegiveis - presencas;
        const percentual = totalElegiveis > 0 ? Math.round((presencas / totalElegiveis) * 100) : 0;

        return {
          id: sessao.id,
          data_sessao: sessao.data_sessao,
          grau: grauOriginal, // Usar grau original para exibição
          elegiveis: totalElegiveis,
          presencas,
          ausencias,
          percentual,
          visitantes: totalVisitantes || 0,
          licenciados: licenciadosCount,
          prerrogativa: prerrogativaCount
        };
      }));

      setSessoesRecentes(sessoesComDados);
    } catch (error) {
      console.error('Erro ao carregar sessões recentes:', error);
    }
  };

  // Filtrar ausências por ano/mês selecionado
  const ausenciasFiltradas = useMemo(() => {
    // TODO: Implementar filtro real por ano/mês quando necessário
    // Por enquanto, mantém o filtro básico por percentual
    return resumo.filter(i => {
      const temPrerrogativa = resumoPrerrogativa.some(p => p.id === i.id);
      if (temPrerrogativa) return false;
      
      const percAusencias = i.total_registros > 0 ? (i.ausentes / i.total_registros) * 100 : 0;
      return percAusencias >= percentualAlerta;
    });
  }, [resumo, resumoPrerrogativa, percentualAlerta]);

  const definirPeriodo = (p) => {
    setPeriodo(p);
    const hoje = new Date();
    const inicio = new Date();
    const fim = new Date();

    switch (p) {
      case 'mes':
        // Primeiro dia do mês atual
        inicio.setDate(1);
        inicio.setHours(0, 0, 0, 0);
        // Último dia do mês atual
        fim.setMonth(hoje.getMonth() + 1, 0);
        fim.setHours(23, 59, 59, 999);
        break;
      case 'trimestre':
        inicio.setMonth(hoje.getMonth() - 3);
        break;
      case 'semestre':
        inicio.setMonth(hoje.getMonth() - 6);
        break;
      case 'ano':
        // Primeiro dia do ano atual
        inicio.setMonth(0, 1);
        inicio.setHours(0, 0, 0, 0);
        // Último dia do ano atual
        fim.setMonth(11, 31);
        fim.setHours(23, 59, 59, 999);
        break;
    }

    setDataInicio(inicio.toISOString().split('T')[0]);
    setDataFim(fim.toISOString().split('T')[0]);
  };

  const carregarResumoAno = async () => {
    try {
      const inicioAno = `${anoPresenca100}-01-01`;
      const fimAno = `${anoPresenca100}-12-31`;

      // 1. Buscar todas as sessões do ano
      const { data: sessoesAno } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id')
        .gte('data_sessao', inicioAno)
        .lte('data_sessao', fimAno);

      const sessaoIds = sessoesAno?.map(s => s.id) || [];
      if (sessaoIds.length === 0) {
        setResumoAno([]);
        return;
      }

      // 2. Buscar histórico de situações
      // Paginado (blocos de 1000) — evita truncamento silencioso do
      // histórico de situações quando a tabela já passou do limite padrão
      // do Supabase (acumula anos de licenças/desligamentos de todos os irmãos).
      let historicoSituacoes = [];
      {
        let inicioHistLoop = 0;
        const tamanhoPaginaHistLoop = 1000;
        let continuarHistLoop = true;
        while (continuarHistLoop) {
          const { data: loteHistLoop } = await supabase
            .from('historico_situacoes')
            .select('*')
            .eq('status', 'ativa')
            .range(inicioHistLoop, inicioHistLoop + tamanhoPaginaHistLoop - 1);
          if (loteHistLoop && loteHistLoop.length > 0) {
            historicoSituacoes = [...historicoSituacoes, ...loteHistLoop];
            inicioHistLoop += tamanhoPaginaHistLoop;
            if (loteHistLoop.length < tamanhoPaginaHistLoop) continuarHistLoop = false;
          } else {
            continuarHistLoop = false;
          }
        }
      }

      // 3. Buscar irmãos com grau
      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, nome, data_iniciacao, data_elevacao, data_exaltacao, mestre_instalado, data_ingresso_loja, data_falecimento, situacao, status')
        ;

      // 4. Buscar registros com paginação
      let registros = [];
      let inicio = 0;
      const tamanhoPagina = 1000;
      let continuar = true;

      while (continuar) {
        const { data: lote } = await supabase
          .from('registros_presenca')
          .select('membro_id, presente, sessao_id')
          .in('sessao_id', sessaoIds)
          .range(inicio, inicio + tamanhoPagina - 1);

        if (lote && lote.length > 0) {
          registros = [...registros, ...lote];
          inicio += tamanhoPagina;
          
          if (lote.length < tamanhoPagina) {
            continuar = false;
          }
        } else {
          continuar = false;
        }
      }

      // Mapear sessões por ID
      const sessoesMap = {};
      sessoesAno?.forEach(s => {
        sessoesMap[s.id] = s;
      });

      // Processar cada irmão
      const com100 = [];
      
      irmaos?.forEach(irmao => {
        // Falecido e afastado sem retorno (irregular/desligado/etc.) não entram no quadro
        if (estaFalecido(irmao)) return;
        if (semVinculoNoPeriodo(irmao.id, historicoSituacoes, sessoesAno)) return;

        // Calcular grau do irmão
        let grauIrmao = 0;
        if (irmao.data_exaltacao) grauIrmao = 3;
        else if (irmao.data_elevacao) grauIrmao = 2;
        else if (irmao.data_iniciacao) grauIrmao = 1;

        if (grauIrmao === 0) return;

        // Contar APENAS registros VÁLIDOS (após iniciação e do grau permitido)
        let totalRegistros = 0;
        let presentes = 0;
        let aprendiz = 0, companheiro = 0, mestre = 0, administrativa = 0;

        // Prioridade: data_ingresso_loja > data_iniciacao
        const dataIngresso = irmao.data_ingresso_loja ? new Date(irmao.data_ingresso_loja) : null;
        const dataIniciacao = irmao.data_iniciacao ? new Date(irmao.data_iniciacao) : null;
        const dataInicio = dataIngresso || dataIniciacao;

        registros.forEach(reg => {
          if (reg.membro_id === irmao.id) {
            const sessao = sessoesMap[reg.sessao_id];
            if (!sessao) return;

            const dataSessao = new Date(sessao.data_sessao);
            let grauSessao = sessao.grau_sessao_id || 1;
            const grauOriginalSessao = sessao.grau_sessao_id || 1; // Guardar original
            
            // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
            if (grauSessao === 4) grauSessao = 1;

            // Ignorar se sessão é ANTES do ingresso na loja
            if (dataInicio && dataSessao < dataInicio) return;

            // Ignorar se sessão é de grau SUPERIOR ao do irmão
            if (grauSessao > grauIrmao) return;

            // Verificar se tem situação ativa na data da sessão
            const situacaoNaData = historicoSituacoes?.find(sit => 
              sit.membro_id === irmao.id &&
              dataSessao >= new Date(sit.data_inicio + 'T00:00:00') &&
              (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'))
            );
            
            // Se tem situação ativa, ignora
            if (situacaoNaData) return;

            // Registro válido
            totalRegistros++;
            
            if (reg.presente) {
              presentes++;
              
              // Contar por grau ORIGINAL da sessão
              if (grauOriginalSessao === 4) administrativa++;
              else if (grauSessao === 1) aprendiz++;
              else if (grauSessao === 2) companheiro++;
              else if (grauSessao === 3) mestre++;
            }
          }
        });

        // 100% = presentes em TODAS as sessões que tem registro
        if (totalRegistros > 0 && presentes === totalRegistros) {
          com100.push({
            id: irmao.id,
            nome: irmao.nome,
            total_sessoes: totalRegistros,
            aprendiz,
            companheiro,
            mestre,
            administrativa
          });
        }
      });

      setResumoAno(com100);

    } catch (error) {
      console.error('❌ Erro ao carregar resumo do ano:', error);
    }
  };

  const carregar = async () => {
    try {
      console.log('🟢 DEBUG MÉDIA PRESENÇA — carregar() rodando, versão com fix de prerrogativa/grau dinâmico/falecimento');
      const hoje = new Date().toISOString().split('T')[0];
      
      // 1. Buscar sessões do período ATÉ HOJE
      const { data: sessoesPerio, count: totalSessoes } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id, classificacoes_sessao:classificacao_id(nome)', { count: 'exact' })
        .gte('data_sessao', dataInicio)
        .lte('data_sessao', dataFim < hoje ? dataFim : hoje); // Não incluir futuras

      const sessaoIds = sessoesPerio?.map(s => s.id) || [];
      setSessoesPeriodo(sessoesPerio || []);

      // 2. Buscar histórico de situações (licenças, desligamentos, etc)
      // Paginado (blocos de 1000) — a tabela já acumula anos de histórico de
      // TODOS os irmãos, então facilmente passa do limite padrão do Supabase.
      // Sem isso, licenças mais antigas somem silenciosamente da consulta e
      // as ausências desse período voltam a contar erradamente contra o irmão.
      let historicoSituacoes = [];
      {
        let inicioHist = 0;
        const tamanhoPaginaHist = 1000;
        let continuarHist = true;
        while (continuarHist) {
          const { data: loteHist } = await supabase
            .from('historico_situacoes')
            .select('*')
            .eq('status', 'ativa')
            .range(inicioHist, inicioHist + tamanhoPaginaHist - 1);
          if (loteHist && loteHist.length > 0) {
            historicoSituacoes = [...historicoSituacoes, ...loteHist];
            inicioHist += tamanhoPaginaHist;
            if (loteHist.length < tamanhoPaginaHist) continuarHist = false;
          } else {
            continuarHist = false;
          }
        }
      }

      // 3. Buscar TODOS os irmãos (ativos e inativos) para estatísticas
      const { data: todosIrmaos } = await supabase
        .from('irmaos')
        .select('id, situacao, status');

      // Calcular estatísticas por situação
      const stats = {
        total: todosIrmaos?.length || 0,
        regulares: todosIrmaos?.filter(i => i.situacao?.toLowerCase() === 'regular').length || 0,
        licenciados: todosIrmaos?.filter(i => i.situacao?.toLowerCase() === 'licenciado').length || 0,
        irregulares: todosIrmaos?.filter(i => i.situacao?.toLowerCase() === 'irregular').length || 0,
        suspensos: todosIrmaos?.filter(i => i.situacao?.toLowerCase() === 'suspenso').length || 0,
        falecidos: todosIrmaos?.filter(i => 
          i.status === 'falecido' || i.situacao?.toLowerCase() === 'falecido'
        ).length || 0,
        desligados: todosIrmaos?.filter(i => 
          i.status === 'desligado' || i.situacao?.toLowerCase() === 'desligado'
        ).length || 0
      };
      stats.ativos = stats.regulares + stats.licenciados;

      // 4. Buscar irmãos ativos para cálculos de presença
      // .eq('status','ativo') — mesmo filtro usado na consulta que alimenta o
      // relatório em PDF (ModalGradePresenca.jsx). Sem isso, irmãos com status
      // diferente de "ativo" (desligado, inativo, etc.) entravam na conta.
      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, nome, data_iniciacao, data_elevacao, data_exaltacao, mestre_instalado, data_nascimento, data_ingresso_loja, data_falecimento, situacao, status')
        .eq('status', 'ativo')
        ;

      // 5. Buscar registros com paginação
      let registros = [];
      let inicio = 0;
      const tamanhoPagina = 1000;
      let continuar = true;

      while (continuar) {
        const { data: lote } = await supabase
          .from('registros_presenca')
          .select('membro_id, presente, sessao_id')
          .in('sessao_id', sessaoIds)
          .range(inicio, inicio + tamanhoPagina - 1);

        if (lote && lote.length > 0) {
          registros = [...registros, ...lote];
          inicio += tamanhoPagina;
          
          if (lote.length < tamanhoPagina) {
            continuar = false;
          }
        } else {
          continuar = false;
        }
      }

      // Mapear sessões
      const sessoesMap = {};
      sessoesPerio?.forEach(s => {
        sessoesMap[s.id] = s;
      });

      // Processar cada irmão
      const resumoCompleto = [];
      const porMes = {}; // { 'AAAA-MM': { total, presentes } } para o gráfico mensal

      // Desligado/Irregular/Suspenso/Excluído/Ex-ofício SEM data de retorno:
      // se TODAS as sessões deste período (sessoesPerio) já são depois do
      // início da situação, o irmão não tem mais vínculo relevante aqui e
      // sai da conta por completo (igual a um desligado/falecido de anos
      // atrás) — mesma regra usada no relatório em PDF e na Matrix. Se parte
      // do período for antes da situação, ele continua entrando
      // normalmente, com a checagem sessão-a-sessão (mais abaixo) cuidando
      // do resto. 100% automático, baseado na data cadastrada.
      const semVinculoNoPeriodo = (irmaoId) => {
        return historicoSituacoes?.some(sit => {
          if (sit.membro_id !== irmaoId) return false;
          const tipo = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const situacoesQueEncerram = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio'];
          const ehEncerramento = situacoesQueEncerram.includes(tipo) || situacoesQueEncerram.some(s => tipo.includes(s));
          if (!ehEncerramento) return false;
          if (sit.data_fim) return false; // já foi regularizado, deve entrar na conta

          const dataInicioSit = new Date(sit.data_inicio + 'T00:00:00');
          return sessoesPerio?.every(s => new Date(s.data_sessao + 'T00:00:00') >= dataInicioSit);
        });
      };

      irmaos?.forEach(irmao => {
        // Descartar quem não tem mais nenhum vínculo relevante neste período
        if (semVinculoNoPeriodo(irmao.id)) return;

        // Calcular grau MÁXIMO já atingido (usado só pra descartar quem nunca
        // foi iniciado — o grau efetivo em cada sessão é calculado abaixo,
        // sessão por sessão, igual ao relatório em PDF).
        let grauIrmao = 0;
        if (irmao.data_exaltacao) grauIrmao = 3;
        else if (irmao.data_elevacao) grauIrmao = 2;
        else if (irmao.data_iniciacao) grauIrmao = 1;

        if (grauIrmao === 0) return;

        const dataExaltacao = irmao.data_exaltacao ? new Date(irmao.data_exaltacao) : null;
        const dataElevacao  = irmao.data_elevacao ? new Date(irmao.data_elevacao) : null;

        // Calcular idade e prerrogativa
        let temPrerrogativa = false;
        let dataPrerrogativa = null;
        if (irmao.data_nascimento) {
          const nasc = new Date(irmao.data_nascimento);
          const hoje = new Date();
          let idade = hoje.getFullYear() - nasc.getFullYear();
          if (hoje.getMonth() < nasc.getMonth() || 
             (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) {
            idade--;
          }
          
          if (idade >= 70) {
            temPrerrogativa = true;
            dataPrerrogativa = new Date(nasc);
            dataPrerrogativa.setFullYear(nasc.getFullYear() + 70);
          }
        }

        // Prioridade: data_ingresso_loja > data_iniciacao
        const dataIngresso = irmao.data_ingresso_loja ? new Date(irmao.data_ingresso_loja) : null;
        const dataIniciacao = irmao.data_iniciacao ? new Date(irmao.data_iniciacao) : null;
        const dataInicio = dataIngresso || dataIniciacao;

        const dataFalecimento = irmao.data_falecimento ? new Date(irmao.data_falecimento) : null;

        // Contar apenas registros VÁLIDOS
        let totalRegistros = 0;
        let presentes = 0;

        registros.forEach(reg => {
          if (reg.membro_id === irmao.id) {
            const sessao = sessoesMap[reg.sessao_id];
            if (!sessao) return;

            const dataSessao = new Date(sessao.data_sessao);
            let grauSessao = sessao.grau_sessao_id || 1;
            
            // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
            if (grauSessao === 4) grauSessao = 1;

            // Ignorar sessão ANTES do ingresso na loja
            if (dataInicio && dataSessao < dataInicio) return;

            // Ignorar sessão APÓS o falecimento (campo era buscado mas nunca
            // checado — irmão falecido não pode contar falta depois de morto)
            if (dataFalecimento && dataSessao >= dataFalecimento) return;

            // Grau EFETIVO do irmão NA DATA da sessão (não o grau atual) —
            // mesma lógica usada no relatório em PDF, pra não considerar
            // "falta" numa sessão de grau que o irmão ainda nem tinha alcançado
            let grauNaSessao = 1;
            if (dataExaltacao && dataSessao >= dataExaltacao) grauNaSessao = 3;
            else if (dataElevacao && dataSessao >= dataElevacao) grauNaSessao = 2;

            // Ignorar sessão de grau SUPERIOR ao grau que o irmão tinha NA DATA
            if (grauSessao > grauNaSessao) return;

            // REVERTIDO a pedido: prerrogativa de idade não exclui mais da
            // conta (volta a contar como elegível normal).

            // Verificar se tem situação ativa na data da sessão — desligado,
            // irregular, suspenso, excluído, ex-ofício continuam bloqueando;
            // LICENÇA foi removida da lista a pedido (revertido, volta a
            // contar como elegível normal, igual à prerrogativa).
            const situacaoNaData = historicoSituacoes?.find(sit => {
              if (sit.membro_id !== irmao.id) return false;
              const tipoNorm = (sit.tipo_situacao || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              if (tipoNorm.includes('licen')) return false; // não bloqueia mais
              return dataSessao >= new Date(sit.data_inicio + 'T00:00:00') &&
                (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'));
            });
            
            // Se tem situação ativa (desligamento/irregular/etc), ignora
            if (situacaoNaData) return;

            // Registro válido
            totalRegistros++;
            if (reg.presente) presentes++;

            // Acumula por mês (gráfico de presença mensal)
            const chaveMes = String(sessao.data_sessao).slice(0, 7);
            if (!porMes[chaveMes]) porMes[chaveMes] = { total: 0, presentes: 0 };
            porMes[chaveMes].total++;
            if (reg.presente) porMes[chaveMes].presentes++;
          }
        });

        const ausentes = totalRegistros - presentes;
        const taxa = totalRegistros > 0 ? Math.round((presentes / totalRegistros) * 100) : 0;

        resumoCompleto.push({
          id: irmao.id,
          nome: irmao.nome,
          total_registros: totalRegistros,
          presentes,
          ausentes,
          taxa
        });
      });

      // Média de presença
      const somaPresencas = resumoCompleto.reduce((sum, r) => sum + r.taxa, 0);
      const totalComRegistros = resumoCompleto.filter(r => r.total_registros > 0).length;
      const mediaPresenca = totalComRegistros > 0 ? Math.round(somaPresencas / totalComRegistros) : 0;

      console.log('🟢 DEBUG MÉDIA PRESENÇA — resultado final do carregar():');
      console.log('  Qtd. irmãos com registros:', totalComRegistros);
      console.log('  Soma das taxas individuais:', somaPresencas);
      console.log('  Média Presença calculada:', mediaPresenca, '%');
      console.log('  ── TODOS os irmãos considerados (nome | registros | presentes | taxa) ──');
      resumoCompleto
        .filter(r => r.total_registros > 0)
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .forEach(r => {
          console.log(`    ${r.nome} | registros: ${r.total_registros} | presentes: ${r.presentes} | taxa: ${r.taxa}%`);
        });
      console.log('  ── Irmãos com registros = 0 (excluídos do cálculo) ──');
      resumoCompleto
        .filter(r => r.total_registros === 0)
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .forEach(r => {
          console.log(`    ${r.nome} | 0 registros`);
        });
      console.log('  Detalhe de quem tem prerrogativa/nascimento cadastrado:');
      irmaos?.forEach(irmao => {
        if (!irmao.data_nascimento) return;
        const nasc = new Date(irmao.data_nascimento);
        const hj = new Date();
        let idadeDebug = hj.getFullYear() - nasc.getFullYear();
        if (hj.getMonth() < nasc.getMonth() || (hj.getMonth() === nasc.getMonth() && hj.getDate() < nasc.getDate())) idadeDebug--;
        if (idadeDebug >= 70) {
          const r = resumoCompleto.find(x => x.id === irmao.id);
          console.log(`    👤 ${irmao.nome} (${idadeDebug} anos, prerrogativa) → registros considerados: ${r ? r.total_registros : 'não entrou em resumoCompleto'}, taxa: ${r ? r.taxa : '-'}%`);
        }
      });

      // Contar irmãos ativos baseado em situações reais
      const irmaosAtivosCount = stats.ativos; // Já calculado: regulares + licenciados

      setDados({
        sessoes: totalSessoes || 0,
        irmaos: stats.total,
        irmaosAtivos: irmaosAtivosCount,
        stats, // Incluir estatísticas completas
        mediaPresenca
      });

      setPresencaMensal(
        Object.keys(porMes).sort().map(chave => ({
          chave,
          mes: MESES_ABREV[parseInt(chave.split('-')[1], 10) - 1],
          pct: porMes[chave].total > 0 ? Math.round((porMes[chave].presentes / porMes[chave].total) * 100) : 0,
          presentes: porMes[chave].presentes,
          total: porMes[chave].total,
        }))
      );

      // Falecido sai de todos os quadros (a média geral acima segue calculada como antes)
      const idsFalecidos = new Set((irmaos || []).filter(estaFalecido).map(i => i.id));
      setResumo(resumoCompleto.filter(r => !idsFalecidos.has(r.id)));

    } catch (error) {
      console.error('Erro:', error);
    }
  };

  return (
    <div style={{ 
      padding: '2rem', 
      background: 'var(--color-bg)', 
      minHeight: '100vh' 
    }}>
      
      {/* Cabeçalho: título, período e ações */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Dashboard de Presença</h1>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              📅 <strong style={{ color: 'var(--color-text)' }}>{fmtDataBR(dataInicio)}</strong> até <strong style={{ color: 'var(--color-text)' }}>{fmtDataBR(dataFim)}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-lg)' }}>
              {['mes', 'trimestre', 'semestre'].map(p => (
                <button
                  key={p}
                  onClick={() => definirPeriodo(p)}
                  style={{ padding: '0.45rem 1rem', borderRadius: 'var(--radius-md)', border: 'none', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', background: periodo === p ? 'var(--color-accent)' : 'transparent', color: periodo === p ? '#fff' : 'var(--color-text-muted)' }}
                >
                  {p === 'mes' ? 'Mês' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
              <select
                value={anoSelecionado || ''}
                onChange={(e) => {
                  const ano = Number(e.target.value);
                  setAnoSelecionado(ano);
                  setPeriodo('ano');
                  setDataInicio(`${ano}-01-01`);
                  setDataFim(`${ano}-12-31`);
                }}
                disabled={!anoSelecionado}
                style={{ padding: '0.45rem 0.9rem', borderRadius: 'var(--radius-md)', border: 'none', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', background: periodo === 'ano' ? 'var(--color-accent)' : 'transparent', color: periodo === 'ano' ? '#fff' : 'var(--color-text-muted)' }}
              >
                {anosDisponiveis.map(ano => (
                  <option key={ano} value={ano} style={{ color: '#111' }}>{ano}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setMostrarGrade(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-accent)', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}
            >
              <span>📊</span> Matrix Presença
            </button>
          </div>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <KpiCard cor="var(--color-accent)" rotulo="Sessões" valor={dados.sessoes} sub="no período" />
        <KpiCard cor="#f59e0b" rotulo="Média de presença" valor={`${dados.mediaPresenca || 0}%`} barra={dados.mediaPresenca || 0} />
        <KpiCard
          cor="#6366f1" rotulo="Irmãos ativos" valor={dados.irmaosAtivos || 0}
          chips={dados.stats ? [
            { rotulo: 'Regulares', valor: dados.stats.regulares },
            { rotulo: 'Licenciados', valor: dados.stats.licenciados },
          ] : []}
        />
        <KpiCard
          cor="#10b981" rotulo="Quadro de irmãos" valor={dados.irmaos}
          chips={dados.stats ? [
            { rotulo: 'Ativos', valor: dados.stats.ativos },
            ...(dados.stats.falecidos > 0 ? [{ rotulo: 'Falecidos', valor: dados.stats.falecidos }] : []),
            ...(dados.stats.irregulares > 0 ? [{ rotulo: 'Irregulares', valor: dados.stats.irregulares }] : []),
            ...(dados.stats.suspensos > 0 ? [{ rotulo: 'Suspensos', valor: dados.stats.suspensos }] : []),
            ...(dados.stats.desligados > 0 ? [{ rotulo: 'Quite Placet', valor: dados.stats.desligados }] : []),
          ] : []}
        />
      </div>

      {/* Gráficos do período */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
        <GraficoPizza
          titulo="Sessões por grau"
          dados={[1, 2, 3, 4].map(g => ({ nome: NOME_GRAU[g], cor: COR_GRAU[g], valor: sessoesPeriodo.filter(x => (x.grau_sessao_id || 1) === g).length }))}
        />
        <GraficoPizza
          titulo="Sessões por classificação"
          dados={(() => {
            const cont = {};
            sessoesPeriodo.forEach(x => {
              const rel = Array.isArray(x.classificacoes_sessao) ? x.classificacoes_sessao[0] : x.classificacoes_sessao;
              const nome = rel?.nome || 'Sem classificação';
              cont[nome] = (cont[nome] || 0) + 1;
            });
            return Object.entries(cont).map(([nome, valor]) => ({ nome, valor, cor: COR_CLASSIFICACAO[nome] || '#64748b' }));
          })()}
        />
        <GraficoPresencaMensal dados={presencaMensal} />
      </div>

      {/* Quadro: Sessões Recentes - largura total */}
      <div className="card" style={{ overflow: "hidden", marginBottom: "1.5rem", padding: 0 }}>
        <div style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', borderTop: '3px solid #3b82f6', borderBottom: '1px solid var(--color-border)', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📅</span>
            Sessões Recentes
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem' }}>Quantidade:</span>
            <select
              value={qtdSessoesRecentes}
              onChange={(e) => setQtdSessoesRecentes(Number(e.target.value))}
              style={{
                padding: '0.25rem 0.75rem',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                borderRadius: 'var(--radius-md)',
                fontWeight: '600',
                border: '1px solid var(--color-border-light)',
                cursor: 'pointer'
              }}
            >
              <option value={4}>4</option>
              <option value={6}>6</option>
              <option value={8}>8</option>
              <option value={10}>10</option>
            </select>
          </div>
        </div>
        <div className="p-4">
          {sessoesRecentes.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0' }}>Carregando sessões...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ background: 'var(--color-surface-2)' }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Data</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Grau</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Elegíveis</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Presenças</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Ausências</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Visitantes</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>%</th>
                  </tr>
                </thead>
                <tbody style={{ borderTop: '1px solid var(--color-border)' }}>
                  {sessoesRecentes.map((sessao, idx) => (
                    <tr 
                      key={sessao.id} 
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--color-text)' }}>
                        {new Date(sessao.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-center text-sm" style={{color:"var(--color-text)"}}>
                        <span style={{...({1:{background:'rgba(59,130,246,0.15)',color:'#3b82f6',border:'1px solid rgba(59,130,246,0.3)'},2:{background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)'},4:{background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.3)'},3:{background:'rgba(139,92,246,0.15)',color:'#8b5cf6',border:'1px solid rgba(139,92,246,0.3)'}}[sessao.grau]||{}),padding:'0.15rem 0.5rem',borderRadius:'999px',fontSize:'0.7rem',fontWeight:'700'}}>
                          {sessao.grau === 1 ? 'Aprendiz' : 
                           sessao.grau === 2 ? 'Companheiro' : 
                           sessao.grau === 4 ? 'Administrativa' :
                           'Mestre'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-semibold" style={{color:"var(--color-text)"}}>{sessao.elegiveis}</td>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-green-600" style={{color:"var(--color-text)"}}>{sessao.presencas}</td>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-red-600" style={{color:"var(--color-text)"}}>{sessao.ausencias}</td>
                      <td className="px-4 py-3 text-center text-sm" style={{color:"var(--color-text)"}}>
                        <span style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",background:"rgba(99,102,241,0.15)",color:"#6366f1",fontWeight:"700"}}>
                          {sessao.visitantes}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm" style={{color:"var(--color-text)"}}>
                        <span style={{background:sessao.percentual>=80?'rgba(16,185,129,0.15)':sessao.percentual>=60?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.15)',color:sessao.percentual>=80?'#10b981':sessao.percentual>=60?'#f59e0b':'#ef4444',border:'1px solid currentColor',padding:'0.15rem 0.5rem',borderRadius:'999px',fontSize:'0.7rem',fontWeight:'700'}}>
                          {sessao.percentual}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Quadros lado a lado */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Quadro: Presença 100% */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', borderTop: '3px solid #10b981', borderBottom: '1px solid var(--color-border)', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🏆</span>
              Presença 100% - {resumoAno.length} {resumoAno.length === 1 ? 'Irmão' : 'Irmãos'}
            </h3>
            <select
              value={anoPresenca100}
              onChange={(e) => setAnoPresenca100(Number(e.target.value))}
              style={{
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontWeight: '600',
                border: '1px solid var(--color-border-light)',
                cursor: 'pointer'
              }}
            >
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {resumoAno.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0' }}>Nenhum irmão com 100% em {anoPresenca100}</p>
            ) : (
              <div className="space-y-2">
                {resumoAno
                  .sort((a, b) => b.total_sessoes - a.total_sessoes)
                  .map(irmao => (
                  <div key={irmao.id} style={{ 
                    padding: '0.75rem', 
                    background: 'var(--color-success-bg)', 
                    borderRadius: 'var(--radius-md)',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-accent-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-success-bg)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '500', color: 'var(--color-text)' }}>
                        {formatarNome(irmao.nome)}
                      </span>
                      <span style={{ background: 'var(--color-success)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: '600' }}>
                        {irmao.total_sessoes}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {irmao.aprendiz > 0 && (
                        <span style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",background:"rgba(59,130,246,0.15)",color:"#3b82f6"}}>
                          Apr: {irmao.aprendiz}
                        </span>
                      )}
                      {irmao.companheiro > 0 && (
                        <span style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",background:"rgba(245,158,11,0.15)",color:"#f59e0b"}}>
                          Comp: {irmao.companheiro}
                        </span>
                      )}
                      {irmao.mestre > 0 && (
                        <span style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",background:"rgba(139,92,246,0.15)",color:"#8b5cf6"}}>
                          Mest: {irmao.mestre}
                        </span>
                      )}
                      {irmao.administrativa > 0 && (
                        <span style={{padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",background:"rgba(245,158,11,0.15)",color:"#f59e0b"}}>
                          Adm: {irmao.administrativa}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quadro: Irmãos com Prerrogativa (70+) */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', borderTop: '3px solid #f59e0b', borderBottom: '1px solid var(--color-border)', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>👴</span>
              Irmãos com Prerrogativa (70+) - {resumoPrerrogativa.length} {resumoPrerrogativa.length === 1 ? 'Irmão' : 'Irmãos'}
            </h3>
            <select
              value={anoPrerrogativa}
              onChange={(e) => setAnoPrerrogativa(Number(e.target.value))}
              style={{
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontWeight: '600',
                border: '1px solid var(--color-border-light)',
                cursor: 'pointer'
              }}
            >
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
          <div className="p-4">
            {resumoPrerrogativa.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0' }}>Nenhum irmão com prerrogativa no período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead style={{ background: 'var(--color-surface-2)' }}>
                    <tr>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Nome</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Grau</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Presenças</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>%</th>
                    </tr>
                  </thead>
                  <tbody style={{ borderTop: '1px solid var(--color-border)' }}>
                    {resumoPrerrogativa
                      .sort((a, b) => b.percentual - a.percentual)
                      .map(irmao => (
                      <tr 
                        key={irmao.id} 
                        style={{ borderBottom: '1px solid var(--color-border)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--color-text)' }}>
                          {formatarNome(irmao.nome)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                          {irmao.grau}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text)' }}>
                          {irmao.presencas}/{irmao.total}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <span style={{background:irmao.percentual>=75?'rgba(16,185,129,0.15)':irmao.percentual>=50?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.15)',color:irmao.percentual>=75?'#10b981':irmao.percentual>=50?'#f59e0b':'#ef4444',border:'1px solid currentColor',padding:'0.15rem 0.5rem',borderRadius:'999px',fontSize:'0.7rem',fontWeight:'700'}}>
                            {irmao.percentual}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Quadro: Irmãos Licenciados */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', borderTop: '3px solid #6366f1', borderBottom: '1px solid var(--color-border)', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📋</span>
              Irmãos Licenciados - {resumoLicenciados.length} {resumoLicenciados.length === 1 ? 'Irmão' : 'Irmãos'}
            </h3>
            <select
              value={anoLicenciados}
              onChange={(e) => setAnoLicenciados(Number(e.target.value))}
              style={{
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontWeight: '600',
                border: '1px solid var(--color-border-light)',
                cursor: 'pointer'
              }}
            >
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
          <div className="p-4">
            {resumoLicenciados.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0' }}>Nenhum irmão licenciado no período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead style={{ background: 'var(--color-surface-2)' }}>
                    <tr>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Nome</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Grau</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Presenças</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>%</th>
                    </tr>
                  </thead>
                  <tbody style={{ borderTop: '1px solid var(--color-border)' }}>
                    {resumoLicenciados
                      .sort((a, b) => b.percentual - a.percentual)
                      .map(irmao => (
                      <tr 
                        key={irmao.id} 
                        style={{ borderBottom: '1px solid var(--color-border)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--color-text)' }}>
                          {formatarNome(irmao.nome)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                          {irmao.grau}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text)' }}>
                          {irmao.presencas}/{irmao.total}
                        </td>
                        <td className="px-4 py-3 text-center" style={{color:"var(--color-text)"}}>
                          <span style={{background:irmao.percentual>=75?'rgba(16,185,129,0.15)':irmao.percentual>=50?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.15)',color:irmao.percentual>=75?'#10b981':irmao.percentual>=50?'#f59e0b':'#ef4444',border:'1px solid currentColor',padding:'0.15rem 0.5rem',borderRadius:'999px',fontSize:'0.7rem',fontWeight:'700'}}>
                            {irmao.percentual}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Quadro: Ausências acima do percentual configurado */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', borderTop: '3px solid #ef4444', borderBottom: '1px solid var(--color-border)', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>⚠️</span>
                  Ausências
                </h3>
                <select
                  value={anoAusencias}
                  onChange={(e) => {
                    setAnoAusencias(Number(e.target.value));
                    const ano = Number(e.target.value);
                    const mes = mesAusencias;
                    
                    // Definir período baseado no ano/mês
                    if (mes === 0) {
                      setDataInicio(`${ano}-01-01`);
                      setDataFim(`${ano}-12-31`);
                    } else {
                      const ultimoDia = new Date(ano, mes, 0).getDate();
                      setDataInicio(`${ano}-${String(mes).padStart(2, '0')}-01`);
                      setDataFim(`${ano}-${String(mes).padStart(2, '0')}-${ultimoDia}`);
                    }
                  }}
                  style={{
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    padding: '0.25rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: '600',
                    border: '1px solid var(--color-border-light)',
                    cursor: 'pointer'
                  }}
                >
                  {anosDisponiveis.map(ano => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem' }}>≥</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={percentualAlerta}
                  onChange={(e) => setPercentualAlerta(Number(e.target.value))}
                  style={{
                    width: '4rem',
                    padding: '0.25rem 0.5rem',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: '600',
                    textAlign: 'center',
                    border: '1px solid var(--color-border-light)'
                  }}
                />
                <span style={{ fontSize: '0.875rem' }}>%</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Mês:</label>
              <select
                value={mesAusencias}
                onChange={(e) => {
                  setMesAusencias(Number(e.target.value));
                  const ano = anoAusencias;
                  const mes = Number(e.target.value);
                  
                  // Definir período baseado no ano/mês
                  if (mes === 0) {
                    setDataInicio(`${ano}-01-01`);
                    setDataFim(`${ano}-12-31`);
                  } else {
                    const ultimoDia = new Date(ano, mes, 0).getDate();
                    setDataInicio(`${ano}-${String(mes).padStart(2, '0')}-01`);
                    setDataFim(`${ano}-${String(mes).padStart(2, '0')}-${ultimoDia}`);
                  }
                }}
                style={{padding:"0.35rem 0.75rem",background:"var(--color-bg)",color:"var(--color-text)",border:"1px solid var(--color-border-light)",borderRadius:"var(--radius-md)",fontWeight:"600",cursor:"pointer"}}
              >
                <option value={0}>Ano todo</option>
                {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((mes, idx) => (
                  <option key={idx + 1} value={idx + 1}>{mes}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {ausenciasFiltradas.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0' }}>Nenhum irmão com ≥{percentualAlerta}% ausências no período</p>
            ) : (
              <div className="space-y-2">
                {ausenciasFiltradas
                  .sort((a, b) => {
                    const percA = (a.ausentes / a.total_registros) * 100;
                    const percB = (b.ausentes / b.total_registros) * 100;
                    return percB - percA;
                  })
                  .map(irmao => {
                    const percAusencias = Math.round((irmao.ausentes / irmao.total_registros) * 100);
                    return (
                      <div 
                        key={irmao.id} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '0.75rem', 
                          background: 'var(--color-warning-bg)', 
                          borderRadius: 'var(--radius-md)',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-accent-bg)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-warning-bg)'}
                      >
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: '500', color: 'var(--color-text)' }}>
                            {formatarNome(irmao.nome)}
                          </p>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                            {irmao.ausentes}/{irmao.total_registros}
                          </p>
                        </div>
                        <span style={{ background: 'var(--color-warning)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: '600' }}>
                          {percAusencias}%
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabela - COMENTADA para adicionar quadros
      <div className="rounded-lg overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div style={{background:"var(--color-accent)",color:"#fff",padding:"1rem"}}>
          <h2 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>Resumo por Irmão</h2>
        </div>
        
        <table className="min-w-full">
          <thead style={{background:"var(--color-surface-2)"}}>
            <tr>
              <th className="px-6 py-4 text-left text-sm font-bold uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Irmão</th>
              <th className="px-6 py-4 text-center text-sm font-bold uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Registros</th>
              <th className="px-6 py-4 text-center text-sm font-bold uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Presentes</th>
              <th className="px-6 py-4 text-center text-sm font-bold uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Ausentes</th>
              <th className="px-6 py-4 text-center text-sm font-bold uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Taxa</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {resumo.map(irmao => (
              <tr key={irmao.id} style={{borderBottom:"1px solid var(--color-border)",transition:"background 0.1s"}}>
                <td className="px-6 py-4" style={{color:"var(--color-text)"}}>
                  <span className="font-semibold">{formatarNome(irmao.nome)}</span>
                </td>
                <td className="px-6 py-4 text-center" style={{color:"var(--color-text)"}}>
                  <span style={{fontSize:"1.1rem",fontWeight:"800",color:"var(--color-accent)"}}>{irmao.total_registros}</span>
                </td>
                <td className="px-6 py-4 text-center" style={{color:"var(--color-text)"}}>
                  <span style={{fontSize:"1.1rem",fontWeight:"800",color:"#10b981"}}>{irmao.presentes}</span>
                </td>
                <td className="px-6 py-4 text-center" style={{color:"var(--color-text)"}}>
                  <span className="text-lg font-bold text-red-600">{irmao.ausentes}</span>
                </td>
                <td className="px-6 py-4 text-center" style={{color:"var(--color-text)"}}>
                  <span style={{background:irmao.taxa>=90?'rgba(16,185,129,0.15)':irmao.taxa>=70?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.15)',color:irmao.taxa>=90?'#10b981':irmao.taxa>=70?'#f59e0b':'#ef4444',border:'1px solid currentColor',padding:'0.2rem 0.6rem',borderRadius:'999px',fontSize:'0.75rem',fontWeight:'700'}}>
                    {irmao.taxa}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      */}

      {/* Info */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 <strong>Mostrando dados BRUTOS do banco:</strong> Total geral de sessões, irmãos e registros sem nenhum filtro por período ou grau.
        </p>
      </div>

      {/* Modal Grade */}
      {mostrarGrade && (
        <ModalGradePresenca onFechar={() => setMostrarGrade(false)} />
      )}
    </div>
  );
}
