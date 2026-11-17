import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { gerarRelatorioMembrosArcoRealPDF } from '../../utils/gerarRelatorioMembrosArcoRealPDF';
import CadastroArcoRealMembros from './CadastroArcoRealMembros';
import PerfilPessoalArcoReal from './PerfilPessoalArcoReal';
import {
  SITUACOES_ARCO_REAL, situacaoCor, situacaoLabel, fmtData, calcularIdade, tempoDeArcoReal, iniciais, carregarLogoArcoRealBase64,
} from '../../utils/arcoRealMembros';

const campoLabel = { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', margin: 0 };
const campoValor = { fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)', margin: '0.15rem 0 0' };
const inputStyle = { width: '100%', padding: '0.5rem 0.9rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' };

const btnSec = { padding: '0.55rem 1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' };

const estiloBadge = (cor) => ({ display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, background: `${cor}26`, color: cor, border: `1px solid ${cor}55` });

export default function VisualizarMembrosArcoReal({ permissoes = {}, meuMembroId = null, showSuccess, showError }) {
  const podeEditar = !!permissoes?.canEditMembers;
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('regular,licenciado');
  const [ordem, setOrdem] = useState('nome');
  // 'lista' | { tipo: 'perfil' | 'form', id?, importar? }
  const [tela, setTela] = useState('lista');

  const carregar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('arco_real_membros').select('*, irmaos:irmao_vinculado_id(nome)').order('nome');
      if (error) throw error;
      setMembros(data || []);
    } catch (e) {
      showError && showError('Erro ao carregar membros: ' + e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const voltar = () => { setTela('lista'); carregar(); };

  const excluir = async (m) => {
    if (!window.confirm(`Excluir ${m.nome} do Arco Real? Essa ação não pode ser desfeita.`)) return;
    try {
      const { data, error } = await supabase.from('arco_real_membros').delete().eq('id', m.id).select();
      if (error) throw error;
      if (!data || data.length === 0) { showError && showError('❌ Nada foi excluído — provável falta de permissão (RLS).'); return; }
      showSuccess && showSuccess('✅ Membro excluído.');
      carregar();
    } catch (e) {
      showError && showError('Erro ao excluir: ' + e.message);
    }
  };

  const gerarRelatorio = async () => {
    if (filtrados.length === 0) { showError && showError('Nenhum membro para gerar relatório.'); return; }
    const logo = await carregarLogoArcoRealBase64();
    gerarRelatorioMembrosArcoRealPDF([...filtrados].sort((a, b) => a.nome.localeCompare(b.nome)), logo);
  };

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = membros.filter(m => {
      if (termo && !(m.nome || '').toLowerCase().includes(termo)) return false;
      const s = m.situacao || 'regular';
      if (filtroSituacao === 'todos') return true;
      if (filtroSituacao === 'regular,licenciado') return s === 'regular' || s === 'licenciado';
      return s === filtroSituacao;
    });
    const porNome = (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    if (ordem === 'antigo') {
      return [...lista].sort((a, b) => (a.data_exaltacao || '9999').localeCompare(b.data_exaltacao || '9999') || porNome(a, b));
    }
    if (ordem === 'recente') {
      return [...lista].sort((a, b) => (b.data_exaltacao || '').localeCompare(a.data_exaltacao || '') || porNome(a, b));
    }
    return [...lista].sort(porNome);
  }, [membros, busca, filtroSituacao, ordem]);

  if (tela !== 'lista' && tela.tipo === 'form') {
    return (
      <CadastroArcoRealMembros
        membroId={tela.id || null}
        abrirImportarAoIniciar={!!tela.importar}
        onVoltar={voltar}
        onSalvo={voltar}
        showSuccess={showSuccess}
        showError={showError}
        permissoes={permissoes}
      />
    );
  }
  if (tela !== 'lista' && tela.tipo === 'perfil') {
    return (
      <PerfilPessoalArcoReal
        meuMembroId={meuMembroId}
        membroId={tela.id}
        permissoes={permissoes}
        showSuccess={showSuccess}
        showError={showError}
        onVoltar={voltar}
        onEditar={(id) => setTela({ tipo: 'form', id })}
      />
    );
  }

  return (
    <div className="space-y-5" style={{ background: 'var(--color-bg)', minHeight: '100vh', padding: '1.5rem', overflowX: 'hidden' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' }}>👥 Membros do Arco Real</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{membros.length} membro(s) cadastrado(s)</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {meuMembroId && (
            <button onClick={() => setTela({ tipo: 'perfil', id: meuMembroId })} style={btnSec}>👤 Meus Dados</button>
          )}
          <button onClick={gerarRelatorio} title="Relatório de nomes e cargos para envio" style={btnSec}>📄 Relatório</button>
          {podeEditar && (
            <>
              <button onClick={() => setTela({ tipo: 'form', importar: true })} style={btnSec}>📥 Importar Irmão</button>
              <button onClick={() => setTela({ tipo: 'form' })} style={{ ...btnSec, background: '#4ade80', color: '#111827', border: 'none', fontWeight: 700 }}>➕ Novo Membro</button>
            </>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-lg shadow p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>🔍 Buscar</label>
            <input type="text" placeholder="Nome..." value={busca} onChange={e => setBusca(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>📊 Situação</label>
            <select value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)} style={inputStyle}>
              <option value="regular,licenciado">Regulares e Licenciados</option>
              <option value="todos">Todas as Situações</option>
              {Object.entries(SITUACOES_ARCO_REAL).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>↕️ Ordenar por</label>
            <select value={ordem} onChange={e => setOrdem(e.target.value)} style={inputStyle}>
              <option value="nome">Nome</option>
              <option value="antigo">Mais antigo no Arco Real</option>
              <option value="recente">Mais recente no Arco Real</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          Exibindo <strong>{filtrados.length}</strong> de <strong>{membros.length}</strong> membros
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <div className="rounded-lg shadow p-12 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Nenhum membro encontrado</h3>
          <p style={{ color: 'var(--color-text-muted)' }}>Tente ajustar os filtros de busca</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3" style={{ padding: '0.25rem' }}>
          {filtrados.map(m => {
            const cor = situacaoCor(m.situacao);
            const licenciado = m.situacao === 'licenciado';
            return (
              <div
                key={m.id}
                onClick={() => setTela({ tipo: 'perfil', id: m.id })}
                className="rounded-lg overflow-hidden transition-opacity hover:opacity-95"
                style={{
                  cursor: 'pointer', background: 'var(--color-surface)',
                  borderTop: licenciado ? `2px solid ${cor}` : '1px solid var(--color-border)',
                  borderRight: licenciado ? `2px solid ${cor}` : '1px solid var(--color-border)',
                  borderBottom: licenciado ? `2px solid ${cor}` : '1px solid var(--color-border)',
                  borderLeft: `${licenciado ? 8 : 4}px solid ${licenciado ? cor : 'var(--color-accent)'}`,
                  opacity: ['desligado', 'excluido', 'falecido'].includes(m.situacao) ? 0.8 : 1,
                }}
              >
                <div style={{ position: 'relative', background: 'var(--color-surface-2)', height: '6.5rem', overflow: 'hidden' }}>
                  {m.foto_url ? (
                    <img src={m.foto_url} alt={m.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 35%', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#fff' }}>{iniciais(m.nome)}</span>
                    </div>
                  )}
                  {m.cargo && (
                    <div style={{ position: 'absolute', top: '0.35rem', right: '0.35rem', background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '0.12rem 0.5rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700, maxWidth: '85%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.cargo}
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <h3 className="font-bold text-sm truncate" style={{ color: 'var(--color-accent)' }} title={m.nome}>{m.nome}</h3>
                  <p className="text-xs truncate mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {m.data_nascimento && <>{calcularIdade(m.data_nascimento)} anos</>}
                    {m.data_exaltacao && <>{m.data_nascimento ? ' · ' : ''}🔺 {fmtData(m.data_exaltacao)}</>}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                    {m.data_exaltacao ? tempoDeArcoReal(m.data_exaltacao) : 'Sem data de exaltação'}
                  </p>
                  <div className="mt-2 flex gap-1.5 flex-wrap">
                    <span style={estiloBadge(cor)}>{situacaoLabel(m.situacao)}</span>
                    {String(m.id) === String(meuMembroId) && <span style={estiloBadge('#f59e0b')}>Você</span>}
                  </div>
                  <div className="mt-2.5 flex gap-1.5" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setTela({ tipo: 'perfil', id: m.id })} title="Ver perfil" style={{ padding: '0.3rem 0.5rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', cursor: 'pointer' }}>👁️</button>
                    {podeEditar && (
                      <>
                        <button onClick={() => setTela({ tipo: 'form', id: m.id })} title="Editar" style={{ padding: '0.3rem 0.5rem', background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid #4ade80', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', cursor: 'pointer' }}>✏️</button>
                        <button onClick={() => excluir(m)} title="Excluir" style={{ padding: '0.3rem 0.5rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', cursor: 'pointer' }}>🗑️</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
