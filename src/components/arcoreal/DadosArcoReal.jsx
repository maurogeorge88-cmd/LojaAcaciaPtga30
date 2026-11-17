import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { fmtData, mesesEntre, tempoTexto } from '../../utils/arcoRealMembros';

// Dados do Capítulo (Arco Real) — equivalente ao "Dados da Loja" da Loja Acácia.
// Registro único na tabela arco_real_dados.
const VAZIO = {
  nome: '', numero: '', data_fundacao: '', cnpj: '', potencia: '', oriente: '',
  endereco: '', cidade: '', estado: '', cep: '', telefone: '', email: '',
};

const CAMPOS = [
  ['nome', 'Nome do Capítulo', 'text', 'Ex: Guardiões da Aliança'],
  ['numero', 'Número', 'text', 'Ex: 04'],
  ['data_fundacao', 'Data de Fundação', 'date', ''],
  ['cnpj', 'CNPJ', 'text', '00.000.000/0000-00'],
  ['potencia', 'Potência / Grande Capítulo', 'text', ''],
  ['oriente', 'Oriente', 'text', 'Ex: Paranatinga'],
  ['endereco', 'Endereço', 'text', ''],
  ['cidade', 'Cidade', 'text', ''],
  ['estado', 'Estado', 'text', 'MT'],
  ['cep', 'CEP', 'text', ''],
  ['telefone', 'Telefone', 'text', ''],
  ['email', 'E-mail', 'email', ''],
];

const tabelaAusente = (e) => /does not exist|schema cache|42P01|PGRST205/i.test(`${e?.code || ''} ${e?.message || ''}`);

export default function DadosArcoReal({ podeEditar = false, showSuccess, showError }) {
  const [dados, setDados] = useState(VAZIO);
  const [id, setId] = useState(null);
  const [editando, setEditando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [semTabela, setSemTabela] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('arco_real_dados').select('*').limit(1).maybeSingle();
      if (error) { if (tabelaAusente(error)) { setSemTabela(true); return; } throw error; }
      setSemTabela(false);
      if (data) { setId(data.id); setDados({ ...VAZIO, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ''])) }); }
    } catch (e) {
      showError && showError('Erro ao carregar dados do Arco Real: ' + e.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async () => {
    try {
      const payload = {};
      CAMPOS.forEach(([k]) => { payload[k] = dados[k] === '' ? null : dados[k]; });
      payload.updated_at = new Date().toISOString();
      const { error } = id
        ? await supabase.from('arco_real_dados').update(payload).eq('id', id)
        : await supabase.from('arco_real_dados').insert([payload]);
      if (error) throw error;
      showSuccess && showSuccess('Dados do Arco Real salvos!');
      setEditando(false);
      carregar();
    } catch (e) {
      showError && showError('Erro ao salvar: ' + e.message);
    }
  };

  const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem' };
  const input = { width: '100%', padding: '0.55rem 0.8rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', opacity: editando ? 1 : 0.75 };
  const label = { display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.3rem' };

  if (loading) return <div className="p-6" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>;

  if (semTabela) {
    return (
      <div className="p-6">
        <div style={{ ...card, borderLeft: '4px solid #f59e0b' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>🔺 Dados do Arco Real</h2>
          <p style={{ color: 'var(--color-text-muted)', margin: '0.6rem 0 0', fontSize: '0.9rem' }}>
            A tabela <strong>arco_real_dados</strong> ainda não existe. Execute o arquivo <strong>arco_real_dados.sql</strong> no SQL Editor do Supabase e recarregue.
          </p>
        </div>
      </div>
    );
  }

  const tempo = dados.data_fundacao ? tempoTexto(mesesEntre(dados.data_fundacao)) : null;

  return (
    <div className="p-6" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>🔺 Dados do Arco Real</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>Informações cadastrais do Capítulo</p>
        </div>
        {podeEditar && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {editando ? (
              <>
                <button onClick={() => { setEditando(false); carregar(); }} style={{ padding: '0.55rem 1.1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={salvar} style={{ padding: '0.55rem 1.1rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer' }}>💾 Salvar</button>
              </>
            ) : (
              <button onClick={() => setEditando(true)} style={{ padding: '0.55rem 1.1rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer' }}>✏️ Editar</button>
            )}
          </div>
        )}
      </div>

      {tempo && (
        <div style={{ ...card, borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.8rem' }}>🔺</span>
          <div>
            <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>{tempo} de fundação</p>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Fundado em {fmtData(dados.data_fundacao)}</p>
          </div>
        </div>
      )}

      <div style={card}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CAMPOS.map(([k, rotulo, tipo, ph]) => (
            <div key={k}>
              <label style={label}>{rotulo}</label>
              <input type={tipo} value={dados[k]} placeholder={ph} disabled={!editando}
                onChange={e => setDados(d => ({ ...d, [k]: e.target.value }))} style={input} />
            </div>
          ))}
        </div>
        {!podeEditar && <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '1rem' }}>Somente quem tem permissão de edição de membros pode alterar estes dados.</p>}
      </div>
    </div>
  );
}
