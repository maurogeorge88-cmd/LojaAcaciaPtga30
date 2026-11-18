import { TELAS_ARCO_REAL, derivarAcessoArcoReal, limparMapaArcoReal, MODELOS_ARCO_REAL } from '../../config/permissoesArcoReal';

// Grade "Permissões no Arco Real" — por tela: Nenhum / Ver / Editar.
//  valor = null  -> "herdando": mostra o que a pessoa tem hoje (derivado das permissões atuais)
//  valor = {..}  -> grade personalizada (vale só no Arco Real; a Loja não é afetada)
const ROTULO = { nenhum: '🚫 Nenhum', ver: '👁️ Ver', editar: '✏️ Editar' };
const COR = { nenhum: '#94a3b8', ver: '#60a5fa', editar: '#10b981' };
const ORDEM = { nenhum: 0, ver: 1, editar: 2 };

export default function PermissoesArcoReal({ valor, onChange, legado, acessoTotal = false, temAcessoModulo = null, somenteLeitura = false }) {
  if (acessoTotal) {
    return (
      <div style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent)', color: 'var(--color-accent)', fontWeight: 700, fontSize: '0.85rem' }}>
        🔺 Arco Real: Venerável / Administrador tem acesso total a todas as telas.
      </div>
    );
  }

  const herdado = derivarAcessoArcoReal(legado || {});
  const personalizado = valor && typeof valor === 'object';
  const atual = personalizado ? limparMapaArcoReal(valor) : herdado;
  const nivel = (id) => atual[id] || 'nenhum';

  const definir = (id, n) => {
    const novo = { ...atual };
    if (n === 'nenhum') delete novo[id]; else novo[id] = n;
    onChange(novo);
  };

  const contagem = { ver: 0, editar: 0, nenhum: 0 };
  TELAS_ARCO_REAL.forEach(t => { contagem[nivel(t.id)] += 1; });

  // Diferenças em relação ao acesso atual (só quando personalizado)
  const mudancas = personalizado ? TELAS_ARCO_REAL.filter(t => nivel(t.id) !== (herdado[t.id] || 'nenhum')) : [];
  const grupos = [...new Set(TELAS_ARCO_REAL.map(t => t.grupo))];

  return (
    <div style={{ border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-lg)', padding: '0.9rem', background: 'var(--color-accent-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text)', margin: 0 }}>🔺 Permissões no Arco Real (por tela)</h4>
        {!somenteLeitura && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {!personalizado ? (
              <button type="button" onClick={() => onChange({ ...herdado })} style={btn('var(--color-accent)')}>✏️ Personalizar por tela</button>
            ) : (
              <>
                {Object.entries(MODELOS_ARCO_REAL).map(([k, m]) => (
                  <button key={k} type="button" onClick={() => onChange({ ...m.mapa })} style={btn('var(--color-border)', 'var(--color-text)')}>{m.label}</button>
                ))}
                <button type="button" onClick={() => onChange(null)} style={btn('#f59e0b')}>↺ Voltar a herdar</button>
              </>
            )}
          </div>
        )}
      </div>

      {temAcessoModulo === false && (
        <div style={{ padding: '0.55rem 0.75rem', marginBottom: '0.6rem', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', fontSize: '0.78rem', color: 'var(--color-text)' }}>
          ⚠️ Este irmão <strong>não tem acesso ao Arco Real</strong> (módulo "Arco Real" está em Nenhum na lista acima). A grade só passa a valer quando esse módulo for liberado.
        </div>
      )}

      <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
        {personalizado
          ? 'Grade personalizada: vale somente no Arco Real. As permissões da Loja Acácia não são alteradas.'
          : 'Herdando: o acesso abaixo é o que a pessoa já tem hoje, derivado das permissões atuais. Nada foi alterado.'}
      </p>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
        <span style={chip(COR.editar)}>✏️ {contagem.editar} editam</span>
        <span style={chip(COR.ver)}>👁️ {contagem.ver} só visualizam</span>
        <span style={chip(COR.nenhum)}>🚫 {contagem.nenhum} bloqueadas</span>
        <span style={chip(personalizado ? '#a855f7' : '#64748b')}>{personalizado ? '🎛️ Personalizado' : '🔗 Herdando'}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        {grupos.map(g => (
          <div key={g}>
            <p style={{ margin: '0 0 0.3rem', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>{g}</p>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              {TELAS_ARCO_REAL.filter(t => t.grupo === g).map((t, idx, arr) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.8rem', flexWrap: 'wrap', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', borderBottom: idx < arr.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 170 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.84rem', color: 'var(--color-text)' }}>{t.icone} {t.label}</p>
                    {t.ajuda && <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{t.ajuda}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {t.niveis.map(n => {
                      const ativo = nivel(t.id) === n;
                      return (
                        <button key={n} type="button" disabled={!personalizado || somenteLeitura}
                          onClick={() => definir(t.id, n)}
                          style={{ padding: '0.3rem 0.65rem', borderRadius: 'var(--radius-md)', fontSize: '0.74rem', fontWeight: 700, cursor: (!personalizado || somenteLeitura) ? 'default' : 'pointer',
                            border: `1px solid ${ativo ? COR[n] : 'var(--color-border)'}`, background: ativo ? `${COR[n]}26` : 'transparent', color: ativo ? COR[n] : 'var(--color-text-muted)', opacity: (!personalizado && !ativo) ? 0.45 : 1 }}>
                          {ROTULO[n]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {personalizado && (
        <div style={{ marginTop: '0.8rem', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)', background: mudancas.length ? 'rgba(245,158,11,0.12)' : 'var(--color-surface)', border: `1px solid ${mudancas.length ? 'rgba(245,158,11,0.4)' : 'var(--color-border)'}`, fontSize: '0.78rem', color: 'var(--color-text)' }}>
          {mudancas.length === 0 ? '✅ Esta grade é igual ao acesso que a pessoa já tem hoje.' : (
            <>
              <strong>⚠️ Isto altera o acesso atual no Arco Real:</strong>
              <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem' }}>
                {mudancas.map(t => {
                  const de = herdado[t.id] || 'nenhum', para = nivel(t.id);
                  return <li key={t.id}>{t.icone} {t.label}: {ROTULO[de]} → <strong>{ROTULO[para]}</strong> {ORDEM[para] < ORDEM[de] ? '(perde acesso)' : '(ganha acesso)'}</li>;
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const btn = (borda, cor = '#fff') => ({ padding: '0.35rem 0.8rem', borderRadius: 'var(--radius-md)', border: `1px solid ${borda}`, background: borda === 'var(--color-border)' ? 'var(--color-surface)' : borda, color: cor, fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' });
const chip = (cor) => ({ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 999, background: `${cor}22`, color: cor, border: `1px solid ${cor}55` });
