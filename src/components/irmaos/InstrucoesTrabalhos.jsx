import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { gerarRelatorioInstrucoesTrabalhosPDF } from '../../utils/gerarRelatorioInstrucoesTrabalhosPDF';

const GRAUS = ['Aprendiz', 'Companheiro', 'Mestre'];
const NUMEROS_INSTRUCAO = ['1ª Instrução', '2ª Instrução', '3ª Instrução', '4ª Instrução', '5ª Instrução', 'Trabalho Global'];
const corGrau = { Aprendiz: '#3b82f6', Companheiro: '#8b5cf6', Mestre: '#f59e0b' };

export default function InstrucoesTrabalhos({ irmao, showSuccess, showError }) {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ grau: 'Aprendiz', numero_instrucao: '1ª Instrução', data_instrucao: '', data_apresentacao: '', observacoes: '' });
  const [dadosLoja, setDadosLoja] = useState(null);
  const [nomeVeneravel, setNomeVeneravel] = useState('');
  const [nomeOrador, setNomeOrador] = useState('');
  const [nomeSecretario, setNomeSecretario] = useState('');
  const [incluirPresencas, setIncluirPresencas] = useState(false);

  useEffect(() => {
    if (irmao?.id) carregarRegistros();
    carregarLojaEAssinantes();
  }, [irmao?.id]);

  const carregarRegistros = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('instrucoes_trabalhos_irmao')
      .select('*')
      .eq('irmao_id', irmao.id)
      .order('data_instrucao', { ascending: false });
    if (error) console.error('Erro ao carregar instruções/trabalhos:', error);
    if (!error) setRegistros(data || []);
    setLoading(false);
  };

  const carregarLojaEAssinantes = async () => {
    const { data: loja } = await supabase.from('dados_loja').select('*').maybeSingle();
    if (loja) setDadosLoja(loja);

    // Consulta em duas etapas (sem junção automática irmaos(nome)) — evita
    // depender do PostgREST detectar a relação entre as tabelas sozinho,
    // que pode falhar (erro 400) dependendo de como as chaves estrangeiras
    // estão configuradas.
    const { data: corpo, error: errCorpo } = await supabase
      .from('corpo_administrativo')
      .select('cargo, ano_exercicio, irmao_id')
      .eq('posse_realizada', true)
      .order('ano_exercicio', { ascending: false });

    if (errCorpo) { console.error('Erro ao buscar corpo administrativo:', errCorpo); return; }

    if (corpo && corpo.length > 0) {
      const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const ven = corpo.find(c => norm(c.cargo).includes('veneravel'));
      const ora = corpo.find(c => norm(c.cargo).includes('orador'));
      const sec = corpo.find(c => norm(c.cargo).includes('secretario'));

      const idsNecessarios = [ven?.irmao_id, ora?.irmao_id, sec?.irmao_id].filter(Boolean);
      if (idsNecessarios.length > 0) {
        const { data: irmaosCorpo } = await supabase.from('irmaos').select('id, nome').in('id', idsNecessarios);
        const nomePorId = {};
        (irmaosCorpo || []).forEach(i => { nomePorId[i.id] = i.nome; });
        if (ven?.irmao_id && nomePorId[ven.irmao_id]) setNomeVeneravel(nomePorId[ven.irmao_id]);
        if (ora?.irmao_id && nomePorId[ora.irmao_id]) setNomeOrador(nomePorId[ora.irmao_id]);
        if (sec?.irmao_id && nomePorId[sec.irmao_id]) setNomeSecretario(nomePorId[sec.irmao_id]);
      }
    }
  };

  const limparForm = () => {
    setForm({ grau: 'Aprendiz', numero_instrucao: '1ª Instrução', data_instrucao: '', data_apresentacao: '', observacoes: '' });
    setEditandoId(null);
  };

  const salvar = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!form.grau || !form.data_instrucao) {
      showError('Preencha o grau e a data da instrução.');
      return;
    }
    const dados = {
      irmao_id: irmao.id,
      grau: form.grau,
      numero_instrucao: form.numero_instrucao,
      data_instrucao: form.data_instrucao,
      data_apresentacao: form.data_apresentacao || null,
      observacoes: form.observacoes || null,
    };

    if (editandoId) {
      const { error } = await supabase.from('instrucoes_trabalhos_irmao').update(dados).eq('id', editandoId);
      if (error) { showError('Erro ao salvar: ' + error.message); return; }
      showSuccess('Registro atualizado com sucesso!');
    } else {
      const { error } = await supabase.from('instrucoes_trabalhos_irmao').insert([dados]);
      if (error) { showError('Erro ao salvar: ' + error.message); return; }
      showSuccess('Instrução registrada com sucesso!');
    }
    limparForm();
    await carregarRegistros();
  };

  const editar = (registro) => {
    setForm({
      grau: registro.grau,
      numero_instrucao: registro.numero_instrucao || '1ª Instrução',
      data_instrucao: registro.data_instrucao,
      data_apresentacao: registro.data_apresentacao || '',
      observacoes: registro.observacoes || '',
    });
    setEditandoId(registro.id);
  };

  const excluir = async (id) => {
    if (!window.confirm('Deseja realmente excluir este registro?')) return;
    const { error } = await supabase.from('instrucoes_trabalhos_irmao').delete().eq('id', id);
    if (error) { showError('Erro ao excluir: ' + error.message); return; }
    showSuccess('Registro excluído com sucesso!');
    await carregarRegistros();
  };

  // Calcula a janela de meses a incluir no quadro de presenças, baseado na
  // data de hoje: antes de maio, completa com meses do ano anterior até
  // fechar 7 meses; de maio em diante, usa só o ano atual (janeiro até o
  // mês corrente).
  const calcularJanelaMeses = () => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1; // 1-12
    const anoAtual = hoje.getFullYear();
    const meses = [];
    if (mesAtual >= 5) {
      for (let m = 1; m <= mesAtual; m++) meses.push({ ano: anoAtual, mes: m });
    } else {
      const qtdAnoAnterior = 7 - mesAtual;
      for (let m = 13 - qtdAnoAnterior; m <= 12; m++) meses.push({ ano: anoAtual - 1, mes: m });
      for (let m = 1; m <= mesAtual; m++) meses.push({ ano: anoAtual, mes: m });
    }
    return meses;
  };

  // Elegibilidade sessão-a-sessão — mesma lógica já usada no relatório em
  // PDF, na Matrix de Presença, no Dashboard e no boletim por e-mail.
  const elegivelNaData = (irmaoDados, dataSessao, grauSessaoId, historicoSituacoes) => {
    const grauMin = grauSessaoId === 4 ? 1 : grauSessaoId;
    let grauNaData = 1;
    if (irmaoDados.data_exaltacao && dataSessao >= new Date(irmaoDados.data_exaltacao)) grauNaData = 3;
    else if (irmaoDados.data_elevacao && dataSessao >= new Date(irmaoDados.data_elevacao)) grauNaData = 2;
    if (grauMin > grauNaData) return false;

    const dataEntrada = irmaoDados.data_ingresso_loja ? new Date(irmaoDados.data_ingresso_loja) :
                         (irmaoDados.data_iniciacao ? new Date(irmaoDados.data_iniciacao) : null);
    if (!dataEntrada || dataSessao < dataEntrada) return false;

    if (irmaoDados.data_falecimento && dataSessao >= new Date(irmaoDados.data_falecimento)) return false;

    const unaccentLower = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const bloqueado = (historicoSituacoes || []).some(sit => {
      if (sit.membro_id !== irmaoDados.id) return false;
      const tipo = unaccentLower(sit.tipo_situacao);
      const tipos = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio', 'licenca'];
      const ehBloq = tipos.includes(tipo) || tipos.some(t => tipo.includes(t));
      if (!ehBloq) return false;
      const di = new Date(sit.data_inicio + 'T00:00:00');
      if (dataSessao < di) return false;
      if (sit.data_fim) { const df = new Date(sit.data_fim + 'T00:00:00'); return dataSessao <= df; }
      return true;
    });
    if (bloqueado) return false;

    if (irmaoDados.data_nascimento) {
      const nasc = new Date(irmaoDados.data_nascimento + 'T00:00:00');
      let idade = dataSessao.getFullYear() - nasc.getFullYear();
      if (dataSessao.getMonth() < nasc.getMonth() ||
         (dataSessao.getMonth() === nasc.getMonth() && dataSessao.getDate() < nasc.getDate())) idade--;
      if (idade >= 70) return false;
    }
    return true;
  };

  const buscarPresencaMensal = async () => {
    const janela = calcularJanelaMeses();
    const primeiroMes = janela[0];
    const ultimoMes = janela[janela.length - 1];
    const dataInicio = `${primeiroMes.ano}-${String(primeiroMes.mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(ultimoMes.ano, ultimoMes.mes, 0).getDate();
    const dataFim = `${ultimoMes.ano}-${String(ultimoMes.mes).padStart(2, '0')}-${ultimoDia}`;

    // Dados completos do irmão (campos necessários pra elegibilidade)
    const { data: irmaoCompleto } = await supabase
      .from('irmaos')
      .select('id, data_iniciacao, data_elevacao, data_exaltacao, data_nascimento, data_falecimento, data_ingresso_loja')
      .eq('id', irmao.id)
      .single();

    const { data: sessoes } = await supabase
      .from('sessoes_presenca')
      .select('id, data_sessao, grau_sessao_id')
      .gte('data_sessao', dataInicio)
      .lte('data_sessao', dataFim)
      .order('data_sessao');

    const sessoesIds = (sessoes || []).map(s => s.id);
    let registrosPresenca = [];
    if (sessoesIds.length > 0) {
      const { data } = await supabase
        .from('registros_presenca')
        .select('sessao_id, membro_id, presente')
        .eq('membro_id', irmao.id)
        .in('sessao_id', sessoesIds);
      registrosPresenca = data || [];
    }

    // Histórico de situações, paginado
    let historicoSituacoes = [];
    let inicio = 0;
    const tamanhoPagina = 1000;
    let continuar = true;
    while (continuar) {
      const { data: lote } = await supabase
        .from('historico_situacoes')
        .select('membro_id, tipo_situacao, data_inicio, data_fim, status')
        .eq('status', 'ativa')
        .eq('membro_id', irmao.id)
        .range(inicio, inicio + tamanhoPagina - 1);
      if (lote && lote.length > 0) {
        historicoSituacoes = [...historicoSituacoes, ...lote];
        inicio += tamanhoPagina;
        if (lote.length < tamanhoPagina) continuar = false;
      } else continuar = false;
    }

    const presMap = {};
    registrosPresenca.forEach(r => { presMap[r.sessao_id] = r.presente; });

    const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return janela.map(({ ano, mes }) => {
      const sessoesDoMes = (sessoes || []).filter(s => {
        const d = new Date(s.data_sessao + 'T00:00:00');
        return d.getFullYear() === ano && (d.getMonth() + 1) === mes;
      });
      let elegiveis = 0, presentes = 0;
      sessoesDoMes.forEach(s => {
        const dataSessao = new Date(s.data_sessao + 'T00:00:00');
        if (!elegivelNaData(irmaoCompleto || irmao, dataSessao, s.grau_sessao_id, historicoSituacoes)) return;
        elegiveis++;
        if (presMap[s.id]) presentes++;
      });
      return {
        label: `${NOMES_MESES[mes - 1]}/${ano}`,
        elegiveis,
        presentes,
        percentual: elegiveis > 0 ? Math.round((presentes / elegiveis) * 100) : null,
      };
    });
  };

  const handleGerarRelatorio = async () => {
    setGerandoPdf(true);
    try {
      const presencaMensal = incluirPresencas ? await buscarPresencaMensal() : null;
      gerarRelatorioInstrucoesTrabalhosPDF(irmao, registros, dadosLoja, {
        veneravelMestre: nomeVeneravel,
        orador: nomeOrador,
        secretario: nomeSecretario,
      }, presencaMensal);
    } catch (e) {
      console.error(e);
      showError('Erro ao gerar relatório: ' + e.message);
    } finally {
      setGerandoPdf(false);
    }
  };

  const sInput = { padding: '0.5rem 0.7rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', width: '100%' };
  const sLabel = { display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--color-text)', margin: 0 }}>
          📚 Instruções Recebidas e Trabalhos Apresentados
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={incluirPresencas} onChange={e => setIncluirPresencas(e.target.checked)} />
            Incluir presenças
          </label>
          <button
            type="button"
            onClick={handleGerarRelatorio}
            disabled={gerandoPdf || registros.length === 0}
            style={{
              padding: '0.5rem 1rem', borderRadius: 'var(--radius-lg)', border: 'none', fontWeight: '700', fontSize: '0.82rem',
              cursor: (gerandoPdf || registros.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (gerandoPdf || registros.length === 0) ? 0.5 : 1,
              background: 'var(--color-accent)', color: '#fff',
            }}
          >
            {gerandoPdf ? '⏳ Gerando...' : '📄 Gerar Relatório (PDF)'}
          </button>
        </div>
      </div>

      {/* Formulário — usa <div>, não <form>: esse componente fica dentro do
          formulário principal de cadastro do irmão, e HTML não permite
          formulário aninhado (o botão "type=submit" acabava disparando o
          formulário de fora inteiro, tirando da tela sem salvar certo). */}
      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr 1fr 1fr 1.3fr auto', gap: '0.6rem', alignItems: 'end', marginBottom: '1.25rem', padding: '0.9rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
        <div>
          <label style={sLabel}>Grau</label>
          <select value={form.grau} onChange={e => setForm({ ...form, grau: e.target.value })} style={sInput}>
            {GRAUS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label style={sLabel}>Instrução</label>
          <select value={form.numero_instrucao} onChange={e => setForm({ ...form, numero_instrucao: e.target.value })} style={sInput}>
            {NUMEROS_INSTRUCAO.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label style={sLabel}>Data da Instrução *</label>
          <input type="date" value={form.data_instrucao} onChange={e => setForm({ ...form, data_instrucao: e.target.value })} style={sInput} />
        </div>
        <div>
          <label style={sLabel}>Data da Apresentação</label>
          <input type="date" value={form.data_apresentacao} onChange={e => setForm({ ...form, data_apresentacao: e.target.value })} style={sInput} />
          <p style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', margin: '0.15rem 0 0' }}>Deixe em branco se ainda não apresentou</p>
        </div>
        <div>
          <label style={sLabel}>Observações</label>
          <input type="text" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} style={sInput} placeholder="Opcional" />
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button type="button" onClick={salvar} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: 'none', background: '#10b981', color: '#fff', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {editandoId ? 'Salvar' : '+ Adicionar'}
          </button>
          {editandoId && (
            <button type="button" onClick={limparForm} style={{ padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-muted)', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabela agrupada por grau */}
      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '1rem' }}>Carregando...</p>
      ) : registros.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
          Nenhuma instrução registrada ainda.
        </div>
      ) : (
        GRAUS.map(grau => {
          const doGrau = registros.filter(r => r.grau === grau);
          if (doGrau.length === 0) return null;
          return (
            <div key={grau} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.9rem', background: `${corGrau[grau]}15`, borderLeft: `4px solid ${corGrau[grau]}`, borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}>
                <span style={{ fontWeight: '800', fontSize: '0.85rem', color: corGrau[grau] }}>{grau}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>({doGrau.length})</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--color-border)', borderTop: 'none' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-2)' }}>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Instrução</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Data da Instrução</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Apresentação da Peça</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Observações</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {doGrau.map((r, idx) => (
                    <tr key={r.id} style={{ background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', borderTop: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: '600' }}>{r.numero_instrucao || '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: 'var(--color-text)' }}>
                        {new Date(r.data_instrucao + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem' }}>
                        {r.data_apresentacao ? (
                          <span style={{ color: '#10b981', fontWeight: '600' }}>
                            ✅ {new Date(r.data_apresentacao + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span style={{ color: '#f59e0b', fontWeight: '600' }}>⏳ Pendente</span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{r.observacoes || '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                          <button type="button" onClick={() => editar(r)} style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.7rem', background: 'rgba(99,102,241,0.15)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer' }}>✏️</button>
                          <button type="button" onClick={() => excluir(r.id)} style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.7rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}
