import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import CadastroArcoRealMembros from './CadastroArcoRealMembros';
import DashboardArcoReal from './DashboardArcoReal';
import ArcoReal from '../financeiro/ArcoReal';
import DashboardPresencaArcoReal from './DashboardPresencaArcoReal';
import RegistroPresencaArcoReal from './RegistroPresencaArcoReal';

// Logo do Arco Real — bucket público "arcoreal" no Supabase Storage
const LOGO_ARCO_REAL = supabase.storage.from('arcoreal').getPublicUrl('logo.png').data.publicUrl;

const ITENS_MENU = [
  { id: 'dashboard', label: 'Dashboard', icone: '📊', pronto: true },
  { id: 'membros', label: 'Cadastro de Membros', icone: '👥', pronto: true },
  { id: 'presenca', label: 'Presença', icone: '📋', pronto: true },
  { id: 'financeiro', label: 'Finanças', icone: '💰', pronto: true },
  { id: 'corpo-admin', label: 'Corpo Administrativo', icone: '🏛️', pronto: false },
  { id: 'exaltacao', label: 'Processo de Exaltação', icone: '⭐', pronto: false },
  { id: 'relatorios', label: 'Relatórios', icone: '📄', pronto: false },
];

export default function ArcoRealApp({ userData, podeVoltarLoja, onTrocarSistema, onSair, showSuccess, showError }) {
  const [pagina, setPagina] = useState('dashboard');
  const [sessaoPresencaId, setSessaoPresencaId] = useState(null); // sessão aberta na tela de Registro de Presença
  const [menuAberto, setMenuAberto] = useState(true); // sidebar aberta/recolhida (desktop) ou dentro/fora (mobile)

  // No celular o menu some da tela (off-canvas) ao navegar, pra liberar
  // espaço pro conteúdo — no desktop ele continua aberto normalmente.
  const selecionarPagina = (id) => {
    setPagina(id);
    setSessaoPresencaId(null);
    if (window.innerWidth < 768) setMenuAberto(false);
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Barra superior — visível só no celular, com botão para abrir o menu */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4"
        style={{ height: '3.25rem', background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)' }}
      >
        <button
          onClick={() => setMenuAberto(true)}
          aria-label="Abrir menu"
          style={{ color: '#fff', fontSize: '1.4rem', background: 'transparent', border: 'none', cursor: 'pointer', lineHeight: 1 }}
        >
          ☰
        </button>
        <span style={{ color: '#fff', fontWeight: '800', fontSize: '0.85rem' }}>Arco Real</span>
      </div>

      {/* Fundo escuro atrás do menu — só aparece no celular quando o menu está aberto */}
      {menuAberto && (
        <div
          onClick={() => setMenuAberto(false)}
          className="md:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        />
      )}

      {/* Botão para reabrir o menu no desktop, quando ele está recolhido */}
      {!menuAberto && (
        <button
          onClick={() => setMenuAberto(true)}
          aria-label="Abrir menu"
          title="Abrir menu"
          className="hidden md:flex"
          style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 30, width: '2.4rem', height: '2.4rem', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', border: 'none', borderRadius: '50%', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.35)' }}
        >
          ☰
        </button>
      )}

      {/* SIDEBAR — 100% dedicada ao Arco Real, sem nenhum item da Loja */}
      <aside
        className={`w-64 fixed h-screen shadow-2xl flex flex-col z-50 transform transition-transform duration-300 ${menuAberto ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'linear-gradient(180deg, #111827 0%, #1f2937 100%)', borderRight: '2px solid #2d6a9f' }}
      >
        <div style={{ padding: '1.25rem 1rem', background: 'linear-gradient(135deg,#1e3a5f,#2d6a9f)', textAlign: 'center', position: 'relative' }}>
          {/* Botão X — recolhe o menu (funciona no celular e no desktop) */}
          <button
            onClick={() => setMenuAberto(false)}
            aria-label="Fechar menu"
            title="Fechar menu"
            style={{ position: 'absolute', top: '0.6rem', right: '0.6rem', width: '1.9rem', height: '1.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', color: '#fff', fontSize: '1rem', cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
          <img src={LOGO_ARCO_REAL} alt="Arco Real" style={{ width: '4rem', height: '4rem', objectFit: 'contain', margin: '0 auto 0.6rem' }} />
          <p style={{ color: '#fff', fontWeight: '800', fontSize: '0.9rem', lineHeight: 1.2 }}>Capítulo Guardiões da Aliança nº 04</p>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.68rem', marginTop: '0.3rem' }}>{userData?.nome}</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {ITENS_MENU.map(item => (
            <button
              key={item.id}
              disabled={!item.pronto}
              onClick={() => { if (item.pronto) selecionarPagina(item.id); }}
              className="w-full px-4 py-2.5 flex items-center gap-2 text-sm transition"
              style={{
                background: pagina === item.id && item.pronto ? 'rgba(45,106,159,0.25)' : 'transparent',
                borderLeft: pagina === item.id && item.pronto ? '4px solid #2d6a9f' : '4px solid transparent',
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

        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid rgba(45,106,159,0.4)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
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
      <main
        className={`flex-1 transition-all duration-300 pt-14 md:pt-0 ${menuAberto ? 'md:ml-64' : 'md:ml-0'}`}
      >
        {pagina === 'dashboard' && <DashboardArcoReal />}
        {pagina === 'membros' && (
          <CadastroArcoRealMembros showSuccess={showSuccess} showError={showError} />
        )}
        {pagina === 'financeiro' && (
          <ArcoReal
            isOpen={true}
            modoPagina={true}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}
        {pagina === 'presenca' && sessaoPresencaId === null && (
          <DashboardPresencaArcoReal
            onAbrirPresenca={(id) => setSessaoPresencaId(id)}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}
        {pagina === 'presenca' && sessaoPresencaId !== null && (
          <RegistroPresencaArcoReal
            sessaoId={sessaoPresencaId}
            onVoltar={() => setSessaoPresencaId(null)}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}
        {pagina !== 'dashboard' && pagina !== 'membros' && pagina !== 'financeiro' && pagina !== 'presenca' && (
          <div className="p-10 text-center" style={{ color: 'var(--color-text-muted)' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚧</p>
            <p>Essa etapa do módulo Arco Real ainda está sendo construída.</p>
          </div>
        )}
      </main>
    </div>
  );
}
