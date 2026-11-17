import React, { useRef, useState } from 'react';
import { toBlob } from 'html-to-image';

/**
 * Modal "Composição da Loja" — mostra um cartão compacto com os números da
 * sessão (presença, graus, licenciados, prerrogativa, visitantes) e permite
 * copiar a imagem (para colar no WhatsApp) ou baixar como PNG.
 *
 * Usa SOMENTE os campos que já vêm de vw_resumo_sessoes (via ListaSessoes):
 * data_sessao, grau_sessao, classificacao, total_registros, total_presentes,
 * total_ausentes, graus_presentes{aprendizes,companheiros,mestres,mestres_instalados},
 * total_licenciados, total_prerrogativa, total_visitantes.
 *
 * O cartão usa cores fixas (sem variáveis de tema) para que a imagem gerada
 * seja idêntica em qualquer tema do sistema.
 */

const NOME_LOJA = 'A∴R∴L∴S∴ Acácia de Paranatinga nº 30';

const OURO = '#c9a84c';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function Anel({ pct }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const cor = pct >= 75 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171';
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" style={{ display: 'block' }}>
      <circle cx="66" cy="66" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
      <circle
        cx="66" cy="66" r={r} fill="none" stroke={cor} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(pct, 100) / 100)}
        transform="rotate(-90 66 66)"
      />
      <text x="66" y="64" textAnchor="middle" fill="#fff" fontSize="32" fontWeight="800" fontFamily="system-ui, sans-serif">
        {pct}%
      </text>
      <text x="66" y="84" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="11" fontWeight="600" fontFamily="system-ui, sans-serif" letterSpacing="1">
        PRESENÇA
      </text>
    </svg>
  );
}

export default function ModalComposicaoLoja({ sessao, onFechar }) {
  const cartaoRef = useRef(null);
  const [status, setStatus] = useState({ tipo: '', texto: '' });
  const [processando, setProcessando] = useState(false);

  if (!sessao) return null;

  const total = sessao.total_registros || 0;
  const presentes = sessao.total_presentes || 0;
  const ausentes = sessao.total_ausentes || 0;
  const pct = total > 0 ? Math.round((presentes / total) * 100) : 0;
  const graus = sessao.graus_presentes || {};
  const lic = sessao.total_licenciados || 0;
  const prer = sessao.total_prerrogativa || 0;
  const visit = sessao.total_visitantes || 0;

  const dataObj = new Date(sessao.data_sessao + 'T00:00:00');
  const dataExtenso = dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const diaSemana = cap(dataObj.toLocaleDateString('pt-BR', { weekday: 'long' }));
  const tituloSessao = [sessao.grau_sessao, sessao.classificacao].filter(Boolean).join(' · ');
  const nomeArquivo = `composicao-loja-${sessao.data_sessao}.png`;

  const tiles = [
    { sigla: 'A', nome: 'Aprendizes', val: graus.aprendizes || 0, cor: '#fbbf24' },
    { sigla: 'C', nome: 'Companheiros', val: graus.companheiros || 0, cor: '#60a5fa' },
    { sigla: 'M', nome: 'Mestres', val: graus.mestres || 0, cor: '#34d399' },
    { sigla: 'M.I', nome: 'Mestres Instalados', val: graus.mestres_instalados || 0, cor: '#a78bfa' },
  ];

  const gerarBlob = () =>
    toBlob(cartaoRef.current, { pixelRatio: 2, cacheBust: true });

  const copiar = async () => {
    setProcessando(true);
    setStatus({ tipo: '', texto: '' });
    try {
      if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
        throw new Error('sem-clipboard');
      }
      // Promise direto no ClipboardItem: mantém o "gesto do usuário" (exigido pelo Safari)
      await navigator.clipboard.write([
        new window.ClipboardItem({ 'image/png': gerarBlob() }),
      ]);
      setStatus({ tipo: 'ok', texto: '✅ Imagem copiada! Cole no grupo (Ctrl+V).' });
    } catch (e) {
      console.error('Erro ao copiar imagem:', e);
      setStatus({ tipo: 'erro', texto: 'Seu navegador não permitiu copiar. Use "Baixar PNG".' });
    } finally {
      setProcessando(false);
    }
  };

  const baixar = async () => {
    setProcessando(true);
    setStatus({ tipo: '', texto: '' });
    try {
      const blob = await gerarBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ tipo: 'ok', texto: '✅ Imagem baixada.' });
    } catch (e) {
      console.error('Erro ao gerar imagem:', e);
      setStatus({ tipo: 'erro', texto: '❌ Não foi possível gerar a imagem.' });
    } finally {
      setProcessando(false);
    }
  };

  const F = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  return (
    <div
      onClick={onFechar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem', overflowY: 'auto' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '25rem', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}
      >
        {/* Barra do modal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>Composição da Loja</span>
          <button
            onClick={onFechar}
            title="Fechar"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: '50%', width: '1.75rem', height: '1.75rem', cursor: 'pointer', fontWeight: 700, lineHeight: 1 }}
          >×</button>
        </div>

        {/* Área de pré-visualização */}
        <div style={{ padding: '1rem', background: 'var(--color-surface-2)', display: 'flex', justifyContent: 'center' }}>
          {/* ====== CARTÃO (é isto que vira imagem) ====== */}
          <div
            ref={cartaoRef}
            style={{
              width: '340px', boxSizing: 'border-box', padding: '20px 18px 16px', fontFamily: F,
              background: 'linear-gradient(160deg, #0f1e3d 0%, #162a52 55%, #1b2f5c 100%)',
              border: `1px solid ${OURO}`, borderRadius: '16px', color: '#fff',
            }}
          >
            {/* Cabeçalho */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1.2px', color: OURO, textTransform: 'uppercase' }}>
                {NOME_LOJA}
              </div>
              <div style={{ width: '40px', height: '2px', background: OURO, margin: '8px auto 10px', opacity: 0.7 }} />
              <div style={{ fontSize: '17px', fontWeight: 800 }}>Composição da Loja</div>
              <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>
                {diaSemana}, {dataExtenso}
              </div>
              {tituloSessao && (
                <div style={{ display: 'inline-block', marginTop: '8px', padding: '3px 12px', borderRadius: '999px', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.45)', color: OURO, fontSize: '11.5px', fontWeight: 700 }}>
                  {tituloSessao}
                </div>
              )}
            </div>

            {/* Anel + resumo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', margin: '16px 0 14px' }}>
              <Anel pct={pct} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '30px', fontWeight: 800, lineHeight: 1 }}>
                  {presentes}<span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}> / {total}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '3px' }}>irmãos presentes</div>
                <div style={{ marginTop: '8px', display: 'inline-block', padding: '3px 10px', borderRadius: '999px', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#fca5a5', fontSize: '11.5px', fontWeight: 700 }}>
                  {ausentes} ausente{ausentes === 1 ? '' : 's'}
                </div>
              </div>
            </div>

            {/* Presentes por grau */}
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Presentes por grau
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {tiles.map((t) => (
                <div key={t.sigla} style={{ textAlign: 'center', padding: '8px 2px 7px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${t.cor}55` }}>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: t.cor, lineHeight: 1 }}>{t.val}</div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>{t.sigla}</div>
                  <div style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.55)', marginTop: '1px', lineHeight: 1.15 }}>{t.nome}</div>
                </div>
              ))}
            </div>

            {/* Faixa complementar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '10px' }}>
              {[
                { rot: 'Licenciados', val: lic, cor: '#93c5fd' },
                { rot: 'C/ prerrogativa', val: prer, cor: '#c4b5fd' },
                { rot: 'Visitantes', val: visit, cor: OURO },
              ].map((x) => (
                <div key={x.rot} style={{ textAlign: 'center', padding: '7px 2px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: x.cor, lineHeight: 1 }}>{x.val}</div>
                  <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.65)', marginTop: '3px' }}>{x.rot}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '9px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.3 }}>
              Licenciados e irmãos com prerrogativa não entram no cálculo da presença.
            </div>
          </div>
          {/* ====== FIM DO CARTÃO ====== */}
        </div>

        {/* Ações */}
        <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={copiar}
              disabled={processando}
              style={{ flex: 1, padding: '0.6rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: '0.85rem', cursor: processando ? 'wait' : 'pointer', opacity: processando ? 0.7 : 1 }}
            >
              📋 Copiar imagem
            </button>
            <button
              onClick={baixar}
              disabled={processando}
              style={{ flex: 1, padding: '0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: '0.85rem', cursor: processando ? 'wait' : 'pointer', opacity: processando ? 0.7 : 1 }}
            >
              ⬇️ Baixar PNG
            </button>
          </div>
          {status.texto && (
            <div style={{ fontSize: '0.78rem', textAlign: 'center', color: status.tipo === 'ok' ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {status.texto}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
