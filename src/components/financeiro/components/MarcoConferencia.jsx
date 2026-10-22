import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import ModalBase from './ModalBase';
import { formatarMoeda } from '../utils/formatadores';
import {
  podeConferirFinanceiro, dataBR, buscarUltimoFechamento, snapshotFinanceiro,
  compararComFechamento, buscarAlteracoesAposConferencia,
} from '../utils/conferencia';

// Marco de conferência no card "Saldo Anterior":  ✔ - 30/09/2026   [Atenção!]   [Conferir até…]
//  • mostra só a data da última conferência
//  • "Atenção!" aparece se os valores daquela data mudaram depois de conferidos (detalhes na Auditoria)
//  • avisa o pai (onAlterados) quais lançamentos foram alterados após a conferência (ícone na lista)
export default function MarcoConferencia({
  userData, filtros, refreshKey, onAlterados, onIrAuditoria, onConferido, modo = 'completo', showSuccess, showError,
}) {
  const [fechamento, setFechamento] = useState(null);
  const [divergencia, setDivergencia] = useState({ mudou: false, itens: [] });
  const [modalAberto, setModalAberto] = useState(false);
  const [dataCorte, setDataCorte] = useState('');
  const [previa, setPrevia] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const seq = useRef(0);

  const podeConferir = podeConferirFinanceiro(userData);

  const carregarFechamento = async () => {
    try { setFechamento(await buscarUltimoFechamento()); }
    catch (e) { console.warn('Conferência indisponível:', e.message); setFechamento(null); }
  };
  useEffect(() => { carregarFechamento(); }, []);

  // Reconfere sempre que a lista de lançamentos recarrega (baixa, edição, exclusão…)
  useEffect(() => {
    if (modo === 'botao') return; // na Auditoria a conferência é só o botão
    const minha = ++seq.current;
    (async () => {
      if (!fechamento) { setDivergencia({ mudou: false, itens: [] }); onAlterados?.(new Set()); return; }
      try {
        const [atual, alteracoes] = await Promise.all([
          snapshotFinanceiro(fechamento.data_corte),
          buscarAlteracoesAposConferencia(fechamento),
        ]);
        if (minha !== seq.current) return;
        setDivergencia(compararComFechamento(fechamento, atual));
        onAlterados?.(new Set(alteracoes.map(a => String(a.lancamento_id))));
      } catch (e) {
        console.warn('Falha ao reconferir:', e.message);
      }
    })();
  }, [fechamento?.id, refreshKey]);

  // Data sugerida: último dia do mês anterior ao filtro (ou 31/12 do ano anterior)
  const dataSugerida = () => {
    const hojeD = new Date();
    const mes = filtros?.mes > 0 ? filtros.mes : (filtros ? 1 : hojeD.getMonth() + 1);
    const ano = filtros?.ano > 0 ? filtros.ano : hojeD.getFullYear();
    const ultimo = new Date(ano, mes - 1, 0); // dia 0 do mês do filtro = último dia do mês anterior
    return `${ultimo.getFullYear()}-${String(ultimo.getMonth() + 1).padStart(2, '0')}-${String(ultimo.getDate()).padStart(2, '0')}`;
  };

  const abrirModal = () => {
    setDataCorte(dataSugerida());
    setPrevia(null);
    setModalAberto(true);
  };

  useEffect(() => {
    if (!modalAberto || !dataCorte) return;
    let vivo = true;
    setCalculando(true);
    snapshotFinanceiro(dataCorte)
      .then(r => { if (vivo) setPrevia(r); })
      .catch(e => { if (vivo) { setPrevia(null); showError?.('Erro ao calcular: ' + e.message); } })
      .finally(() => { if (vivo) setCalculando(false); });
    return () => { vivo = false; };
  }, [modalAberto, dataCorte]);

  const jaConferido = fechamento && dataCorte && dataCorte <= fechamento.data_corte;

  const confirmar = async () => {
    if (!previa || !dataCorte || jaConferido) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from('fechamentos_financeiros').insert([{
        data_corte: dataCorte,
        conferido_por_nome: userData?.nome || userData?.email || null,
        saldo_bancario: previa.bancario,
        caixa_fisico: previa.caixa,
        tronco_banco: previa.tronco_banco,
        tronco_especie: previa.tronco_especie,
        ultimo_lancamento_id: previa.ultimo_lancamento_id ?? null,
        qtd_lancamentos: previa.qtd ?? null,
      }]);
      if (error) throw error;
      showSuccess?.(`✔ Conferido até ${dataBR(dataCorte)}`);
      setModalAberto(false);
      await carregarFechamento();
      onConferido?.();
    } catch (e) {
      showError?.('Erro ao registrar a conferência: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const linha = (rotulo, valor) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.85rem' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{rotulo}</span>
      <strong style={{ color: 'var(--color-text)' }}>{valor == null ? '—' : formatarMoeda(valor)}</strong>
    </div>
  );

  return (
    <>
      <div style={{ marginTop: modo === 'botao' ? 0 : '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        {modo !== 'botao' && (fechamento ? (
          <span title={`Conferido até ${dataBR(fechamento.data_corte)}`} style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>
            ✔ - {dataBR(fechamento.data_corte)}
          </span>
        ) : (
          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>Sem conferência</span>
        ))}
        {modo !== 'botao' && divergencia.mudou && (
          <button type="button" onClick={onIrAuditoria}
            title="O saldo da data conferida mudou depois da conferência. Clique para ver na Auditoria."
            style={{ fontSize: '0.68rem', fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '999px', padding: '0 0.5rem', cursor: onIrAuditoria ? 'pointer' : 'default' }}>
            ⚠ Atenção!
          </button>
        )}
        {podeConferir && (
          <button type="button" onClick={abrirModal}
            style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-accent)', background: 'transparent', border: '1px solid var(--color-accent)', borderRadius: '999px', padding: '0 0.5rem', cursor: 'pointer' }}>
            Conferir até…
          </button>
        )}
      </div>

      <ModalBase aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="✔ Conferir até a data" tamanho="md">
        <div style={{ padding: '1rem 1.25rem' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Conferido até</label>
          <input type="date" value={dataCorte} onChange={e => setDataCorte(e.target.value)}
            style={{ display: 'block', width: '100%', margin: '0.35rem 0 0.75rem', padding: '0.55rem 0.8rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} />

          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 0.4rem' }}>
            Valores do sistema nesta data — compare com o extrato antes de confirmar:
          </p>
          {calculando ? <p style={{ fontSize: '0.8rem' }}>Calculando…</p> : (<>
            {linha('Saldo bancário da Loja', previa?.bancario)}
            {linha('Caixa físico da Loja', previa?.caixa)}
            {linha('Tronco (banco)', previa?.tronco_banco)}
            {linha('Tronco (espécie)', previa?.tronco_especie)}
          </>)}
          <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', margin: '0.5rem 0 0' }}>
            Arco Real não entra nesta conferência.
          </p>
          {jaConferido && (
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', margin: '0.6rem 0 0' }}>
              Já existe conferência até {dataBR(fechamento.data_corte)}. Escolha uma data posterior.
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
            <button type="button" onClick={() => setModalAberto(false)}
              style={{ flex: 1, height: '38px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontWeight: 700, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="button" onClick={confirmar} disabled={salvando || calculando || !previa || jaConferido}
              style={{ flex: 2, height: '38px', borderRadius: 'var(--radius-lg)', border: 'none', background: (salvando || calculando || !previa || jaConferido) ? 'var(--color-surface-3)' : '#10b981', color: '#fff', fontWeight: 700, cursor: (salvando || calculando || !previa || jaConferido) ? 'not-allowed' : 'pointer' }}>
              {salvando ? 'Registrando…' : '✔ Confirmar conferência'}
            </button>
          </div>
        </div>
      </ModalBase>
    </>
  );
}
