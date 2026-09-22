import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const fmtR = (v) => 'R$ ' + Math.abs(Number(v || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const fmtD = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const Campo = ({ label, valor }) => (
  <div>
    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.15rem' }}>{label}</label>
    <p style={{ color: 'var(--color-text)', margin: 0 }}>{valor || 'Não informado'}</p>
  </div>
);

export default function PerfilPessoalArcoReal({ meuMembroId, showError }) {
  const [aba, setAba] = useState('dados');
  const [membro, setMembro] = useState(null);
  const [lancamentos, setLancamentos] = useState([]);
  const [presencas, setPresencas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meuMembroId) { setLoading(false); return; }
    carregar();
  }, [meuMembroId]);

  const carregar = async () => {
    setLoading(true);
    try {
      const [{ data: m }, { data: lancs }, { data: pres }] = await Promise.all([
        supabase.from('arco_real_membros').select('*').eq('id', meuMembroId).single(),
        supabase.from('arco_real_lancamentos').select('*, categoria_manual:categoria_id(nome)').eq('origem_membro_id', meuMembroId).order('data_vencimento', { ascending: false }),
        supabase.from('arco_real_registros_presenca').select('presente, justificativa, sessao_id, arco_real_sessoes(data_sessao, classificacao)').eq('membro_id', meuMembroId),
      ]);
      setMembro(m || null);
      setLancamentos(lancs || []);
      const presOrdenadas = (pres || []).slice().sort((a, b) =>
        (b.arco_real_sessoes?.data_sessao || '').localeCompare(a.arco_real_sessoes?.data_sessao || '')
      );
      setPresencas(presOrdenadas);
    } catch (e) {
      showError?.('Erro ao carregar seus dados: ' + e.message);
    } finally {
      setLoading(false);
    }
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

  const totalRec = lancamentos.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor || 0), 0);
  const totalPend = lancamentos.filter(l => l.status === 'pendente').reduce((s, l) => s + Number(l.valor || 0), 0);
  const totalPresencas = presencas.filter(p => p.presente).length;
  const pctPresenca = presencas.length > 0 ? Math.round((totalPresencas / presencas.length) * 100) : 0;

  return (
    <div className="p-6" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {membro.foto_url && <img src={membro.foto_url} alt={membro.nome} style={{ width: '4rem', height: '4rem', borderRadius: '50%', objectFit: 'cover' }} />}
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>{membro.nome}</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0 }}>{membro.cargo || 'Sem cargo definido'} · {membro.situacao}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)' }}>
        {[['dados', '👤 Meus Dados'], ['financeiro', '💰 Meu Financeiro'], ['presenca', '📋 Minha Presença']].map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)}
            style={{ padding: '0.6rem 1rem', border: 'none', borderBottom: aba === id ? '3px solid var(--color-accent)' : '3px solid transparent', background: 'transparent', color: aba === id ? 'var(--color-accent)' : 'var(--color-text-muted)', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {aba === 'dados' && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Campo label="Nome" valor={membro.nome} />
          <Campo label="Cargo" valor={membro.cargo} />
          <Campo label="Situação" valor={membro.situacao} />
          <Campo label="Data de Exaltação" valor={fmtD(membro.data_exaltacao)} />
          <Campo label="CPF" valor={membro.cpf} />
          <Campo label="RG" valor={membro.rg} />
          <Campo label="Data de Nascimento" valor={fmtD(membro.data_nascimento)} />
          <Campo label="E-mail" valor={membro.email} />
          <Campo label="Telefone" valor={membro.telefone} />
          <Campo label="Endereço" valor={[membro.endereco, membro.numero, membro.complemento].filter(Boolean).join(', ')} />
          <Campo label="Bairro" valor={membro.bairro} />
          <Campo label="Cidade/UF" valor={[membro.cidade, membro.estado].filter(Boolean).join('/')} />
          <Campo label="CEP" valor={membro.cep} />
          <div style={{ gridColumn: '1 / -1' }}>
            <Campo label="Observações" valor={membro.observacoes} />
          </div>
        </div>
      )}

      {aba === 'financeiro' && (
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '160px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.85rem' }}>
              <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Total Pago</p>
              <p style={{ fontSize: '1.3rem', fontWeight: 800, color: '#10b981', margin: 0 }}>{fmtR(totalRec)}</p>
            </div>
            <div style={{ flex: 1, minWidth: '160px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.85rem' }}>
              <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Pendente</p>
              <p style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f59e0b', margin: 0 }}>{fmtR(totalPend)}</p>
            </div>
          </div>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
            {lancamentos.length === 0 ? (
              <p style={{ padding: '1rem', color: 'var(--color-text-muted)', textAlign: 'center', margin: 0 }}>Nenhum lançamento encontrado.</p>
            ) : lancamentos.map((l, i) => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1rem', borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                <div>
                  <p style={{ margin: 0, color: 'var(--color-text)', fontWeight: 600, fontSize: '0.85rem' }}>{l.descricao}</p>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>{l.categoria_manual?.nome || 'Sem categoria'} · {fmtD(l.data_pagamento || l.data_vencimento)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: l.tipo === 'receita' ? '#10b981' : '#ef4444' }}>{fmtR(l.valor)}</p>
                  <p style={{ margin: 0, fontSize: '0.68rem', color: l.status === 'pago' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{l.status === 'pago' ? '✓ Pago' : '⏳ Pendente'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {aba === 'presenca' && (
        <div>
          <div style={{ marginBottom: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.85rem', maxWidth: '220px' }}>
            <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Taxa de Presença</p>
            <p style={{ fontSize: '1.3rem', fontWeight: 800, color: pctPresenca >= 70 ? '#10b981' : pctPresenca >= 50 ? '#f59e0b' : '#ef4444', margin: 0 }}>{pctPresenca}%</p>
          </div>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
            {presencas.length === 0 ? (
              <p style={{ padding: '1rem', color: 'var(--color-text-muted)', textAlign: 'center', margin: 0 }}>Nenhuma sessão registrada ainda.</p>
            ) : presencas.map((p, i) => (
              <div key={p.sessao_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1rem', borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                <div>
                  <p style={{ margin: 0, color: 'var(--color-text)', fontWeight: 600, fontSize: '0.85rem' }}>{fmtD(p.arco_real_sessoes?.data_sessao)}</p>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>{p.arco_real_sessoes?.classificacao || ''}</p>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: p.presente ? '#10b981' : p.justificativa ? '#f59e0b' : '#ef4444' }}>
                  {p.presente ? '✓ Presente' : p.justificativa ? 'J Justificado' : '✗ Ausente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
