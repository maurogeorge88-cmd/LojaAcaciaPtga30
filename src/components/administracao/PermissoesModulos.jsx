import { MODULOS } from '../../config/permissoes';

// Grade de permissões por módulo: Nenhum / Ver / Editar (conforme o módulo)
const ROTULO = { nenhum: '🚫 Nenhum', ver: '👁️ Ver', editar: '✏️ Editar' };
const COR = { nenhum: '#94a3b8', ver: '#60a5fa', editar: '#10b981' };

export default function PermissoesModulos({ valor = {}, onChange, acessoTotal = false, tesoureiro = false, onAplicarModelo }) {
  const grupos = [...new Set(MODULOS.map(m => m.grupo))];

  if (acessoTotal) {
    return (
      <div style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent)', color: 'var(--color-accent)', fontWeight: 700, fontSize: '0.88rem' }}>
        👑 Venerável / Administrador: acesso total a todos os módulos.
      </div>
    );
  }

  const nivelAtual = (m) => {
    if (m.id === 'financeiro' && tesoureiro) return 'editar';
    return valor[m.id] || m.base;
  };

  const definir = (m, nivel) => {
    const novo = { ...valor };
    if (nivel === 'nenhum' || nivel === m.base) delete novo[m.id]; else novo[m.id] = nivel;
    onChange(novo);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text)', margin: 0 }}>🔐 Permissões por Módulo</h4>
        {onAplicarModelo && (
          <button type="button" onClick={onAplicarModelo}
            style={{ padding: '0.35rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-accent)', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
            ↺ Aplicar modelo do cargo
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {grupos.map(g => (
          <div key={g}>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>{g}</p>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              {MODULOS.filter(m => m.grupo === g).map((m, idx, arr) => {
                const atual = nivelAtual(m);
                const travado = m.id === 'financeiro' && tesoureiro;
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.85rem', flexWrap: 'wrap',
                    background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', borderBottom: idx < arr.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <div style={{ flex: 1, minWidth: '170px' }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)' }}>{m.icone} {m.label}</p>
                      {(m.ajuda || travado) && (
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                          {travado ? 'Automático pelo cargo de Tesoureiro' : m.ajuda}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      {m.niveis.map(n => {
                        const sel = atual === n;
                        return (
                          <button key={n} type="button" disabled={travado} onClick={() => definir(m, n)}
                            style={{ padding: '0.3rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, cursor: travado ? 'not-allowed' : 'pointer',
                              border: `1px solid ${sel ? COR[n] : 'var(--color-border)'}`, background: sel ? COR[n] : 'transparent', color: sel ? '#fff' : 'var(--color-text-muted)', opacity: travado && !sel ? 0.4 : 1 }}>
                            {ROTULO[n]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="form-hint" style={{ marginTop: '0.6rem' }}>
        Módulos sem a opção "Nenhum" são visíveis a todos os irmãos; a escolha define quem pode editar. Estatísticas, Festividades, Visualizar Irmãos e Altos Graus são livres.
      </p>
    </div>
  );
}
