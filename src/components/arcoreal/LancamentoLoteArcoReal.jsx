import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const TIPOS_PAGAMENTO = [
  { value: 'dinheiro', label: '💵 Dinheiro' },
  { value: 'pix', label: '📱 PIX' },
  { value: 'transferencia', label: '🏦 Transferência' },
  { value: 'deposito', label: '🏧 Depósito' },
  { value: 'debito', label: '💳 Débito' },
  { value: 'credito', label: '💳 Crédito' },
  { value: 'cheque', label: '📝 Cheque' },
  { value: 'compensacao', label: '🔄 Compensação' },
];

const hojeISO = () => { const h = new Date(); return h.getFullYear() + '-' + String(h.getMonth()+1).padStart(2,'0') + '-' + String(h.getDate()).padStart(2,'0'); };
const sInp = { background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.75rem',fontSize:'0.875rem',width:'100%' };
const sLabel = { display:'block',fontSize:'0.78rem',fontWeight:'700',color:'var(--color-text-muted)',marginBottom:'0.3rem' };

export default function LancamentoLoteArcoReal({ isOpen, onClose, showSuccess, showError }) {
  const [membros, setMembros] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    categoria_id: '',
    eh_mensalidade: false,
    valor: '',
    descricao: '',
    data_lancamento: hojeISO(),
    data_vencimento: hojeISO(),
    tipo_pagamento: 'pix',
    membros_selecionados: [],
  });

  useEffect(() => { if (isOpen) carregarDados(); }, [isOpen]);

  const carregarDados = async () => {
    try {
      const { data: membrosData } = await supabase
        .from('arco_real_membros')
        .select('id, nome, situacao, periodicidade_pagamento')
        .in('situacao', ['regular', 'licenciado'])
        .order('nome');
      setMembros(membrosData || []);

      const { data: pais } = await supabase
        .from('categorias_financeiras')
        .select('id')
        .ilike('nome', 'arco real')
        .is('categoria_pai_id', null);
      const idsPais = (pais || []).map(p => p.id);
      if (idsPais.length > 0) {
        const { data: catsData } = await supabase
          .from('categorias_financeiras')
          .select('id, nome, tipo')
          .in('categoria_pai_id', idsPais)
          .eq('tipo', 'receita')
          .order('nome');
        setCategorias(catsData || []);
      }
    } catch (e) {
      showError('Erro ao carregar dados: ' + e.message);
    }
  };

  const membrosDisponiveis = membros.filter(m =>
    form.eh_mensalidade ? (m.periodicidade_pagamento === 'Mensal' || !m.periodicidade_pagamento) : true
  );

  const selecionarTodos = () => {
    setForm(f => ({ ...f, membros_selecionados: membrosDisponiveis.map(m => m.id) }));
  };

  const limparSelecao = () => {
    setForm(f => ({ ...f, membros_selecionados: [] }));
  };

  const alternarMembro = (id) => {
    setForm(f => ({
      ...f,
      membros_selecionados: f.membros_selecionados.includes(id)
        ? f.membros_selecionados.filter(i => i !== id)
        : [...f.membros_selecionados, id],
    }));
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (form.membros_selecionados.length === 0) { showError('Selecione pelo menos um membro!'); return; }
    if (!form.categoria_id) { showError('Selecione a categoria.'); return; }
    if (!form.valor || !form.descricao) { showError('Preencha valor e descrição.'); return; }

    setSalvando(true);
    try {
      const lancamentos = form.membros_selecionados.map(membroId => {
        const membro = membros.find(m => m.id === membroId);
        return {
          tipo: 'receita',
          categoria_id: parseInt(form.categoria_id),
          descricao: `${form.descricao} - ${membro?.nome || ''}`,
          valor: parseFloat(form.valor),
          data_vencimento: form.data_vencimento,
          data_pagamento: null,
          tipo_pagamento: form.tipo_pagamento,
          status: 'pendente',
          origem: 'manual',
          lancamento_loja_id: null,
        };
      });

      const { error } = await supabase.from('arco_real_lancamentos').insert(lancamentos);
      if (error) throw error;

      showSuccess(`✅ ${lancamentos.length} lançamento(s) criado(s) com sucesso!`);
      setForm({
        categoria_id: '', eh_mensalidade: false, valor: '', descricao: '',
        data_lancamento: hojeISO(), data_vencimento: hojeISO(), tipo_pagamento: 'pix',
        membros_selecionados: [],
      });
      onClose(true); // true = avisa o componente pai pra recarregar
    } catch (err) {
      showError('Erro ao criar lançamentos: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{zIndex:10000}}>
      <div className="rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" style={{background:'var(--color-surface)',border:'1px solid var(--color-border)'}}>
        <div className="sticky top-0 border-b px-6 py-4" style={{background:'linear-gradient(135deg,#1e3a5f,#2d6a9f)',borderColor:'var(--color-border)'}}>
          <h3 className="text-xl font-bold" style={{color:'#fff'}}>🔺 Lançamento em Lote — Membros do Arco Real</h3>
        </div>

        <form onSubmit={salvar} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={sLabel}>Categoria (Receita) *</label>
              <select value={form.categoria_id} onChange={e=>setForm(f=>({...f,categoria_id:e.target.value}))} style={sInp} required>
                <option value="">Selecione...</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <div className="border rounded-lg p-4" style={{background:'var(--color-surface-2)',border:'1px solid var(--color-border)'}}>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.eh_mensalidade}
                    onChange={e => setForm(f => ({ ...f, eh_mensalidade: e.target.checked, membros_selecionados: [] }))}
                    style={{width:'1.1rem',height:'1.1rem',accentColor:'#2d6a9f'}}
                  />
                  <div className="ml-3">
                    <span style={{fontSize:'0.875rem',fontWeight:'600',color:'var(--color-text)'}}>📅 Este lançamento é uma MENSALIDADE?</span>
                    <p style={{fontSize:'0.72rem',color:'var(--color-text-muted)',marginTop:'0.25rem'}}>
                      {form.eh_mensalidade ? '✅ Mostrando apenas membros com pagamento MENSAL' : '📋 Mostrando TODOS os membros (para outras cobranças)'}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label style={sLabel}>Valor por Membro (R$) *</label>
              <input type="number" step="0.01" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} style={sInp} required />
            </div>

            <div className="md:col-span-2">
              <label style={sLabel}>Descrição Base *</label>
              <input type="text" value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))}
                placeholder="Ex: Mensalidade - Janeiro/2026" style={sInp} required />
              <p className="text-xs mt-1" style={{color:'var(--color-text-muted)'}}>O nome do membro será adicionado automaticamente no final</p>
            </div>

            <div>
              <label style={sLabel}>Data Lançamento *</label>
              <input type="date" value={form.data_lancamento} onChange={e=>setForm(f=>({...f,data_lancamento:e.target.value}))} style={sInp} required />
            </div>

            <div>
              <label style={sLabel}>Data Vencimento *</label>
              <input type="date" value={form.data_vencimento} onChange={e=>setForm(f=>({...f,data_vencimento:e.target.value}))} style={sInp} required />
            </div>

            <div>
              <label style={sLabel}>Tipo de Pagamento</label>
              <select value={form.tipo_pagamento} onChange={e=>setForm(f=>({...f,tipo_pagamento:e.target.value}))} style={sInp}>
                {TIPOS_PAGAMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Seleção de membros */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label style={{...sLabel,marginBottom:0}}>
                Selecione os Membros * ({form.membros_selecionados.length} selecionados
                {form.eh_mensalidade && (
                  <span style={{color:'#2d6a9f'}}> de {membrosDisponiveis.length} mensais</span>
                )})
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={selecionarTodos} style={{fontSize:'0.82rem',color:'#2d6a9f',background:'none',border:'none',cursor:'pointer',fontWeight:'600'}}>
                  ✅ Selecionar Todos
                </button>
                <button type="button" onClick={limparSelecao} style={{fontSize:'0.82rem',color:'#ef4444',background:'none',border:'none',cursor:'pointer',fontWeight:'600'}}>
                  ❌ Limpar Seleção
                </button>
              </div>
            </div>
            <div className="border rounded-lg p-4 max-h-60 overflow-y-auto" style={{background:'var(--color-surface-2)',border:'1px solid var(--color-border)'}}>
              {membrosDisponiveis.length === 0 ? (
                <p className="text-center py-8" style={{color:'var(--color-text-muted)'}}>Nenhum membro disponível.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {membrosDisponiveis.map(m => (
                    <label key={m.id} className="flex items-center gap-2 cursor-pointer" style={{padding:'0.35rem 0.5rem',borderRadius:'var(--radius-md)'}}>
                      <input
                        type="checkbox"
                        checked={form.membros_selecionados.includes(m.id)}
                        onChange={() => alternarMembro(m.id)}
                        style={{width:'1rem',height:'1rem',accentColor:'#2d6a9f'}}
                      />
                      <span style={{fontSize:'0.85rem',color:'var(--color-text)'}}>{m.nome}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => onClose(false)} style={{padding:'0.6rem 1.2rem',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',cursor:'pointer',fontWeight:'600'}}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando} style={{padding:'0.6rem 1.2rem',background:'#2d6a9f',color:'#fff',border:'none',borderRadius:'var(--radius-md)',cursor:salvando?'default':'pointer',fontWeight:'700',opacity:salvando?0.7:1}}>
              {salvando ? 'Salvando...' : `💾 Criar ${form.membros_selecionados.length} Lançamento(s)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
