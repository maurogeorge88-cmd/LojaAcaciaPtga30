import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import {
  SITUACOES_ARCO_REAL, situacaoCor, situacaoLabel, fmtData, calcularIdade, tempoDeArcoReal, mesesEntre, iniciais, nomeCurto,
} from '../../utils/arcoRealMembros';

const campoLabel = { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', margin: 0 };
const campoValor = { fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)', margin: '0.15rem 0 0' };
const inputStyle = { width: '100%', padding: '0.5rem 0.9rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' };

const estiloBadge = (cor) => ({ display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, background: `${cor}26`, color: cor, border: `1px solid ${cor}55` });

function Campo({ label, valor }) {
  return <div><p style={campoLabel}>{label}</p><p style={campoValor}>{valor || '—'}</p></div>;
}

function Bloco({ titulo, children }) {
  return (
    <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
      <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-accent)', margin: '0 0 0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{titulo}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

export default function VisualizarMembrosArcoReal({ showError }) {
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('regular,licenciado');
  const [ordem, setOrdem] = useState('nome');
  const [selecionado, setSelecionado] = useState(null);
  const [maconico, setMaconico] = useState(null);
  const [carregandoMac, setCarregandoMac] = useState(false);

  useEffect(() => {
    (async () => {
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
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = async (m) => {
    setSelecionado(m);
    setMaconico(null);
    if (!m.irmao_vinculado_id) return;
    setCarregandoMac(true);
    try {
      const { data } = await supabase.from('irmaos')
        .select('data_iniciacao, data_elevacao, data_exaltacao, data_instalacao, mestre_instalado')
        .eq('id', m.irmao_vinculado_id).single();
      setMaconico(data || null);
    } catch (e) {
      console.error('Erro ao carregar dados maçônicos:', e);
    } finally {
      setCarregandoMac(false);
    }
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

  return (
    <div className="space-y-5" style={{ background: 'var(--color-bg)', minHeight: '100vh', padding: '1.5rem', overflowX: 'hidden' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' }}>👥 Membros do Arco Real</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Consulta dos membros do Capítulo</p>
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
                onClick={() => abrir(m)}
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de detalhes */}
      {selecionado && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', zIndex: 9000 }} onClick={() => setSelecionado(null)}>
          <div className="rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
            <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>Detalhes do Membro</h2>
              <button onClick={() => setSelecionado(null)} style={{ color: '#fff', background: 'transparent', border: 'none', fontSize: '1.8rem', lineHeight: 1, cursor: 'pointer' }}>×</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex gap-5 items-center flex-wrap">
                {selecionado.foto_url ? (
                  <img src={selecionado.foto_url} alt={selecionado.nome} style={{ width: '7rem', height: '7rem', borderRadius: 'var(--radius-lg)', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '7rem', height: '7rem', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '2.4rem', fontWeight: 800 }}>{iniciais(selecionado.nome)}</div>
                )}
                <div style={{ flex: 1, minWidth: '12rem' }}>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>{selecionado.nome}</h3>
                  <div className="flex gap-2 flex-wrap" style={{ marginTop: '0.5rem' }}>
                    <span style={estiloBadge(situacaoCor(selecionado.situacao))}>{situacaoLabel(selecionado.situacao)}</span>
                    {selecionado.cargo && <span style={estiloBadge('#f59e0b')}>{selecionado.cargo}</span>}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '0.6rem 0 0' }}>
                    🔺 {selecionado.data_exaltacao ? `${tempoDeArcoReal(selecionado.data_exaltacao)} de Arco Real` : 'Sem data de exaltação'}
                  </p>
                </div>
              </div>

              <Bloco titulo="Identificação">
                <Campo label="CPF" valor={selecionado.cpf} />
                <Campo label="RG" valor={selecionado.rg} />
                <Campo label="Nascimento" valor={selecionado.data_nascimento ? `${fmtData(selecionado.data_nascimento)} (${calcularIdade(selecionado.data_nascimento)} anos)` : ''} />
              </Bloco>

              <Bloco titulo="Contato">
                <Campo label="E-mail" valor={selecionado.email} />
                <Campo label="Telefone" valor={selecionado.telefone} />
              </Bloco>

              <Bloco titulo="Endereço">
                <Campo label="Logradouro" valor={selecionado.endereco ? `${selecionado.endereco}${selecionado.numero ? `, ${selecionado.numero}` : ''}${selecionado.complemento ? ` — ${selecionado.complemento}` : ''}` : ''} />
                <Campo label="Bairro" valor={selecionado.bairro} />
                <Campo label="Cidade/UF" valor={selecionado.cidade ? `${selecionado.cidade}${selecionado.estado ? `/${selecionado.estado}` : ''}` : ''} />
                <Campo label="CEP" valor={selecionado.cep} />
              </Bloco>

              <Bloco titulo="🔺 Arco Real">
                <Campo label="Exaltação no Arco Real" valor={selecionado.data_exaltacao ? fmtData(selecionado.data_exaltacao) : ''} />
                <Campo label="Tempo de Arco Real" valor={selecionado.data_exaltacao && mesesEntre(selecionado.data_exaltacao) !== null ? tempoDeArcoReal(selecionado.data_exaltacao) : ''} />
                <Campo label="Cargo" valor={selecionado.cargo} />
              </Bloco>

              {selecionado.irmao_vinculado_id && (
                <Bloco titulo={`🏛️ Loja Simbólica — ${selecionado.irmaos?.nome ? nomeCurto(selecionado.irmaos.nome) : 'Acácia'}`}>
                  {carregandoMac ? <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Carregando...</p> : (
                    <>
                      <Campo label="🔨 Iniciação" valor={fmtData(maconico?.data_iniciacao) === '—' ? '' : fmtData(maconico?.data_iniciacao)} />
                      <Campo label="📐 Elevação" valor={fmtData(maconico?.data_elevacao) === '—' ? '' : fmtData(maconico?.data_elevacao)} />
                      <Campo label="🏛️ Exaltação" valor={fmtData(maconico?.data_exaltacao) === '—' ? '' : fmtData(maconico?.data_exaltacao)} />
                      <Campo label="⭐ Mestre Instalado" valor={maconico?.mestre_instalado ? `Sim${maconico.data_instalacao ? ` — ${fmtData(maconico.data_instalacao)}` : ''}` : 'Não'} />
                    </>
                  )}
                </Bloco>
              )}

              {selecionado.observacoes && (
                <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-accent)', margin: '0 0 0.5rem', textTransform: 'uppercase' }}>Observações</p>
                  <p style={{ color: 'var(--color-text)', whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.88rem' }}>{selecionado.observacoes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
