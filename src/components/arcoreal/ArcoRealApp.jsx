import { useState } from 'react';
import CadastroArcoRealMembros from './CadastroArcoRealMembros';
import ArcoReal from '../financeiro/ArcoReal';

const ITENS_MENU = [
  { id: 'membros', label: 'Cadastro de Membros', icone: '👥', pronto: true },
  { id: 'presenca', label: 'Presença', icone: '📋', pronto: false },
  { id: 'financeiro', label: 'Finanças', icone: '💰', pronto: true },
  { id: 'corpo-admin', label: 'Corpo Administrativo', icone: '🏛️', pronto: false },
  { id: 'exaltacao', label: 'Processo de Exaltação', icone: '⭐', pronto: false },
  { id: 'relatorios', label: 'Relatórios', icone: '📄', pronto: false },
];

export default function ArcoRealApp({ userData, podeVoltarLoja, onTrocarSistema, onSair, showSuccess, showError }) {
  const [pagina, setPagina] = useState('membros');
  const [financasAberto, setFinancasAberto] = useState(false);

  const irParaFinancas = () => setFinancasAberto(true);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* SIDEBAR — 100% dedicada ao Arco Real, sem nenhum item da Loja */}
      <aside
        className="w-64 fixed h-screen shadow-2xl flex flex-col"
        style={{ background: 'linear-gradient(180deg, #111827 0%, #1f2937 100%)', borderRight: '2px solid #4ade80' }}
      >
        <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid rgba(201,168,76,0.3)' }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.6rem' }}>🔺</span>
            <div>
              <p style={{ color: '#4ade80', fontWeight: '800', fontSize: '1rem', lineHeight: 1 }}>Arco Real</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.68rem', marginTop: '0.15rem' }}>{userData?.nome}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {ITENS_MENU.map(item => (
            <button
              key={item.id}
              disabled={!item.pronto}
              onClick={() => {
                if (!item.pronto) return;
                if (item.id === 'financeiro') { irParaFinancas(); return; }
                setPagina(item.id);
              }}
              className="w-full px-4 py-2.5 flex items-center gap-2 text-sm transition"
              style={{
                background: pagina === item.id && item.pronto ? 'rgba(74,222,128,0.18)' : 'transparent',
                borderLeft: pagina === item.id && item.pronto ? '4px solid #4ade80' : '4px solid transparent',
                color: item.pronto ? '#fff' : 'rgba(255,255,255,0.35)',
                cursor: item.pronto ? 'pointer' : 'not-allowed',
              }}
            >
              <span>{item.icone}</span>
              <span className="font-semibold">{item.label}</span>
              {!item.pronto && <span style={{ marginLeft: 'auto', fontSize: '0.62rem', fontWeight: '700', background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>em breve</span>}
            </button>
          ))}
        </nav>

        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid rgba(201,168,76,0.3)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {podeVoltarLoja && (
            <button
              onClick={onTrocarSistema}
              className="w-full px-3 py-2 flex items-center gap-2 text-xs rounded transition"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}
            >
              🔁 Trocar para Loja Acácia
            </button>
          )}
          <button
            onClick={onSair}
            className="w-full px-3 py-2 flex items-center gap-2 text-xs rounded transition"
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
          >
            🚪 Sair
          </button>
        </div>
      </aside>

      {/* CONTEÚDO */}
      <main className="flex-1" style={{ marginLeft: '16rem' }}>
        {pagina === 'membros' && (
          <CadastroArcoRealMembros showSuccess={showSuccess} showError={showError} />
        )}
        {pagina !== 'membros' && (
          <div className="p-10 text-center" style={{ color: 'var(--color-text-muted)' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚧</p>
            <p>Essa etapa do módulo Arco Real ainda está sendo construída.</p>
          </div>
        )}
      </main>

      {/* Financeiro reaproveita o componente já existente, como modal */}
      <ArcoReal
        isOpen={financasAberto}
        onClose={() => setFinancasAberto(false)}
        showSuccess={showSuccess}
        showError={showError}
      />
    </div>
  );
}
