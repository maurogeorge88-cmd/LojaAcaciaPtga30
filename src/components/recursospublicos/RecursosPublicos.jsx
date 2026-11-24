/**
 * CENTRAL DE RECURSOS PÚBLICOS
 * Entes → Recursos recebidos → Aplicações (comodato, doações, obras...) + anexos + saldo.
 * Não se liga ao Financeiro da Loja.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import PainelRecursos from './PainelRecursos';
import ListaRecursos from './ListaRecursos';
import DetalheRecurso from './DetalheRecurso';
import EntesRecursos from './EntesRecursos';
import RelatoriosRecursos from './RelatoriosRecursos';
import { card, buscarTudo } from './comum';

const ABAS = [['painel', '📊 Painel'], ['recursos', '💰 Recursos'], ['entes', '🏛️ Entes'], ['relatorios', '📄 Relatórios']];

export default function RecursosPublicos({ podeEditar, showSuccess, showError }) {
  const [aba, setAba] = useState('painel');
  const [abertoId, setAbertoId] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState({ entes: [], recursos: [], saldos: {}, nfs: [], equipamentos: [], aplicacoes: [], anexos: [] });

  const carregar = useCallback(async () => {
    try {
      const [entes, recursos, saldosLista, nfs, equipamentos, aplicacoes, anexos] = await Promise.all([
        buscarTudo(() => supabase.from('comodato_origens_recurso').select('*').order('nome').order('id')),
        buscarTudo(() => supabase.from('recursos_publicos').select('*').order('data_recebimento', { ascending: false }).order('id')),
        buscarTudo(() => supabase.from('v_recurso_saldo').select('*').order('recurso_id')),
        buscarTudo(() => supabase.from('comodato_recursos').select('*').order('id')),
        buscarTudo(() => supabase.from('equipamentos').select('id, numero_patrimonio, status, valor_aquisicao, recurso_id, tipos_equipamentos(nome)').not('recurso_id', 'is', null).order('id')),
        buscarTudo(() => supabase.from('recurso_aplicacoes').select('*').order('id')),
        buscarTudo(() => supabase.from('recurso_anexos').select('*').order('id')),
      ]);
      const saldos = {}; saldosLista.forEach(s => { saldos[s.recurso_id] = s; });
      setDados({ entes, recursos, saldos, nfs, equipamentos, aplicacoes, anexos });
      setErro('');
    } catch (e) {
      console.error(e);
      setErro(/relation|does not exist|schema cache|rp_nivel/i.test(e.message || '')
        ? 'As tabelas da Central de Recursos Públicos ainda não foram criadas no banco. Execute o arquivo recursos_publicos.sql no Supabase.'
        : 'Não foi possível carregar os dados: ' + (e.message || e));
    } finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirRecurso = (id) => { setAbertoId(id); setAba('recursos'); };
  const recursoAberto = abertoId ? dados.recursos.find(r => r.id === abertoId) : null;

  if (carregando) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--color-accent)' }}></div></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', padding: '0.5rem', overflowX: 'hidden' }}>
      <div style={{ ...card, padding: '1rem 1.25rem 0' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)' }}>🏛️ Recursos Públicos</h1>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Recursos recebidos de entes públicos e o controle de como foram aplicados.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.9rem', borderBottom: '1px solid var(--color-border)' }}>
          {ABAS.map(([k, l]) => {
            const ativa = aba === k;
            return (
              <button key={k} onClick={() => { setAba(k); if (k !== 'recursos') setAbertoId(null); }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.6rem 1.1rem', fontSize: '0.9rem', fontWeight: ativa ? 800 : 600,
                  color: ativa ? 'var(--color-accent)' : 'var(--color-text-muted)', borderBottom: `3px solid ${ativa ? 'var(--color-accent)' : 'transparent'}`, marginBottom: '-1px' }}>
                {l}
              </button>
            );
          })}
        </div>
      </div>

      {erro && <div style={{ ...card, color: '#ef4444', fontSize: '0.9rem', fontWeight: 600 }}>⚠️ {erro}</div>}

      {!erro && aba === 'painel' && <PainelRecursos dados={dados} onAbrir={abrirRecurso} />}
      {!erro && aba === 'recursos' && (recursoAberto
        ? <DetalheRecurso recurso={recursoAberto} dados={dados} podeEditar={podeEditar} onVoltar={() => setAbertoId(null)} onChange={carregar} showSuccess={showSuccess} showError={showError} />
        : <ListaRecursos dados={dados} podeEditar={podeEditar} onAbrir={setAbertoId} onChange={carregar} showSuccess={showSuccess} showError={showError} />)}
      {!erro && aba === 'entes' && <EntesRecursos entes={dados.entes} recursos={dados.recursos} podeEditar={podeEditar} showSuccess={showSuccess} showError={showError} onChange={carregar} />}
      {!erro && aba === 'relatorios' && <RelatoriosRecursos dados={dados} showError={showError} />}
    </div>
  );
}
