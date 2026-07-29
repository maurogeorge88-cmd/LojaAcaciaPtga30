import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { gerarRelatorioInstrucoesTrabalhosPDF } from '../../utils/gerarRelatorioInstrucoesTrabalhosPDF';

const GRAUS = ['Aprendiz', 'Companheiro', 'Mestre'];
const corGrau = { Aprendiz: '#3b82f6', Companheiro: '#8b5cf6', Mestre: '#f59e0b' };

export default function InstrucoesTrabalhos({ irmao, showSuccess, showError }) {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ grau: 'Aprendiz', data_instrucao: '', data_apresentacao: '', observacoes: '' });
  const [dadosLoja, setDadosLoja] = useState(null);
  const [nomeVeneravel, setNomeVeneravel] = useState('');
  const [nomeOrador, setNomeOrador] = useState('');
  const [nomeSecretario, setNomeSecretario] = useState('');

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
    if (!error) setRegistros(data || []);
    setLoading(false);
  };

  const carregarLojaEAssinantes = async () => {
    const { data: loja } = await supabase.from('dados_loja').select('*').single();
    if (loja) setDadosLoja(loja);

    const { data: corpo } = await supabase
      .from('corpo_administrativo')
      .select('cargo, ano_exercicio, irmaos(nome)')
      .eq('posse_realizada', true)
      .order('ano_exercicio', { ascending: false });

    if (corpo && corpo.length > 0) {
      const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const ven = corpo.find(c => norm(c.cargo).includes('veneravel'));
      const ora = corpo.find(c => norm(c.cargo).includes('orador'));
      const sec = corpo.find(c => norm(c.cargo).includes('secretario'));
      if (ven?.irmaos?.nome) setNomeVeneravel(ven.irmaos.nome);
      if (ora?.irmaos?.nome) setNomeOrador(ora.irmaos.nome);
      if (sec?.irmaos?.nome) setNomeSecretario(sec.irmaos.nome);
    }
  };

  const limparForm = () => {
    setForm({ grau: 'Aprendiz', data_instrucao: '', data_apresentacao: '', observacoes: '' });
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

  const handleGerarRelatorio = async () => {
    setGerandoPdf(true);
    try {
      gerarRelatorioInstrucoesTrabalhosPDF(irmao, registros, dadosLoja, {
        veneravelMestre: nomeVeneravel,
        orador: nomeOrador,
        secretario: nomeSecretario,
      });
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
        <button
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

      {/* Formulário — usa <div>, não <form>: esse componente fica dentro do
          formulário principal de cadastro do irmão, e HTML não permite
          formulário aninhado (o botão "type=submit" acabava disparando o
          formulário de fora inteiro, tirando da tela sem salvar certo). */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.5fr auto', gap: '0.6rem', alignItems: 'end', marginBottom: '1.25rem', padding: '0.9rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
        <div>
          <label style={sLabel}>Grau</label>
          <select value={form.grau} onChange={e => setForm({ ...form, grau: e.target.value })} style={sInput}>
            {GRAUS.map(g => <option key={g} value={g}>{g}</option>)}
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
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Data da Instrução</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Apresentação da Peça</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Observações</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {doGrau.map((r, idx) => (
                    <tr key={r.id} style={{ background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', borderTop: '1px solid var(--color-border)' }}>
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
                          <button onClick={() => editar(r)} style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.7rem', background: 'rgba(99,102,241,0.15)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer' }}>✏️</button>
                          <button onClick={() => excluir(r.id)} style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.7rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}>🗑️</button>
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
