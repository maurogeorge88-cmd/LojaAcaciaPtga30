import React, { useState, useEffect } from 'react';

const tiposPagamento = [
  { value: 'dinheiro', label: '💵 Dinheiro' },
  { value: 'pix', label: '📱 PIX' },
  { value: 'transferencia', label: '🏦 Transferência' },
  { value: 'debito', label: '💳 Débito' },
  { value: 'credito', label: '💳 Crédito' },
  { value: 'cheque', label: '📝 Cheque' },
  { value: 'compensacao', label: '🔄 Compensação' }
];

export default function ModalLancamento({ 
  aberto, 
  fechar, 
  lancamento, 
  categorias = [], 
  irmaos = [], 
  onSubmit 
}) {
  const [form, setForm] = useState({
    tipo: 'receita',
    categoria_id: '',
    descricao: '',
    valor: '',
    data_lancamento: new Date().toISOString().split('T')[0],
    data_vencimento: new Date().toISOString().split('T')[0],
    tipo_pagamento: 'dinheiro',
    data_pagamento: '',
    status: 'pendente',
    comprovante_url: '',
    observacoes: '',
    origem_tipo: 'Loja',
    origem_irmao_id: ''
  });

  useEffect(() => {
    if (lancamento) {
      setForm({
        tipo: lancamento.categorias_financeiras?.tipo || 'receita',
        categoria_id: lancamento.categoria_id || '',
        descricao: lancamento.descricao || '',
        valor: lancamento.valor || '',
        data_lancamento: lancamento.data_lancamento || new Date().toISOString().split('T')[0],
        data_vencimento: lancamento.data_vencimento || new Date().toISOString().split('T')[0],
        tipo_pagamento: lancamento.tipo_pagamento || 'dinheiro',
        data_pagamento: lancamento.data_pagamento || '',
        status: lancamento.status || 'pendente',
        comprovante_url: lancamento.comprovante_url || '',
        observacoes: lancamento.observacoes || '',
        origem_tipo: lancamento.origem_tipo || 'Loja',
        origem_irmao_id: lancamento.origem_irmao_id || ''
      });
    } else {
      setForm({
        tipo: 'receita',
        categoria_id: '',
        descricao: '',
        valor: '',
        data_lancamento: new Date().toISOString().split('T')[0],
        data_vencimento: new Date().toISOString().split('T')[0],
        tipo_pagamento: 'dinheiro',
        data_pagamento: '',
        status: 'pendente',
        comprovante_url: '',
        observacoes: '',
        origem_tipo: 'Loja',
        origem_irmao_id: ''
      });
    }
  }, [lancamento, aberto]);

  const renderizarOpcoesCategoria = (tipo) => {
    const categoriasFiltradas = categorias.filter(c => c.tipo === tipo);
    const principais = categoriasFiltradas.filter(c => c.nivel === 1 || !c.categoria_pai_id);
    
    const opcoes = [];
    principais.forEach(principal => {
      opcoes.push(
        <option key={principal.id} value={principal.id}>{principal.nome}</option>
      );
      const subcategorias = categoriasFiltradas.filter(c => c.categoria_pai_id === principal.id);
      subcategorias.forEach(sub => {
        opcoes.push(
          <option key={sub.id} value={sub.id}>&nbsp;&nbsp;&nbsp;&nbsp;└─ {sub.nome}</option>
        );
      });
    });
    return opcoes;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e, form, lancamento?.id);
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {lancamento ? '✏️ Editar Lançamento' : '➕ Novo Lançamento'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value, categoria_id: '' })} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                  <option value="receita">📈 Receita</option>
                  <option value="despesa">📉 Despesa</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
                <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                  <option value="">Selecione...</option>
                  {renderizarOpcoesCategoria(form.tipo)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                <input type="text" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required/>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Origem *</label>
                <select value={form.origem_tipo} onChange={(e) => setForm({ ...form, origem_tipo: e.target.value, origem_irmao_id: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                  <option value="Loja">🏛️ Loja</option>
                  <option value="Irmao">👤 Irmão</option>
                </select>
              </div>

              {form.origem_tipo === 'Irmao' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Irmão *</label>
                  <select value={form.origem_irmao_id} onChange={(e) => setForm({ ...form, origem_irmao_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                    <option value="">Selecione...</option>
                    {irmaos.map(irmao => (
                      <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
                <input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required/>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Lançamento *</label>
                <input type="date" value={form.data_lancamento} onChange={(e) => setForm({ ...form, data_lancamento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required/>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Vencimento *</label>
                <input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required/>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Pagamento</label>
                <select value={form.tipo_pagamento} onChange={(e) => setForm({ ...form, tipo_pagamento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  {tiposPagamento.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={(e) => {
                    const novoStatus = e.target.value;
                    setForm({ ...form, status: novoStatus, data_pagamento: novoStatus === 'pago' ? new Date().toISOString().split('T')[0] : '' });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="pendente">⏳ Pendente</option>
                  <option value="pago">✅ Pago</option>
                  <option value="vencido">⚠️ Vencido</option>
                  <option value="cancelado">❌ Cancelado</option>
                </select>
              </div>
            </div>

            {form.status === 'pago' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Pagamento</label>
                  <input type="date" value={form.data_pagamento} onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"/>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" rows="2"/>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                {lancamento ? '💾 Salvar Alterações' : '✅ Criar Lançamento'}
              </button>
              <button type="button" onClick={fechar} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
                ✖️ Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
