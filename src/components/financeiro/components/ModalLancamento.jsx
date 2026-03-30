import React from 'react';
import ModalBase from './ModalBase';

/**
 * Modal ÚNICO para lançamento de RECEITAS e DESPESAS
 * Botões separados abrem o mesmo modal com tipo pré-definido
 */
export default function ModalLancamento({ 
  aberto, 
  onFechar, 
  onSalvar,
  tipo, // 'receita' ou 'despesa' - vem dos botões
  formData,
  setFormData,
  categorias,
  irmaos,
  editando = false
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSalvar(formData);
  };

  // Filtrar categorias pelo tipo
  const categoriasFiltradas = categorias.filter(cat => cat.tipo === tipo);

  // Renderizar opções de categoria com hierarquia
  const renderizarOpcoesCategoria = () => {
    const principais = categoriasFiltradas.filter(c => c.nivel === 1);
    const opcoes = [];

    principais.forEach(principal => {
      opcoes.push(
        <option key={principal.id} value={principal.id}>
          {principal.nome}
        </option>
      );

      const subcategorias = categoriasFiltradas.filter(
        c => c.nivel === 2 && c.categoria_pai_id === principal.id
      );

      subcategorias.forEach(sub => {
        opcoes.push(
          <option key={sub.id} value={sub.id}>
            &nbsp;&nbsp;↳ {sub.nome}
          </option>
        );
      });
    });

    return opcoes;
  };

  // Configuração visual por tipo
  const config = {
    receita: {
      titulo: editando ? '✏️ Editar Receita' : '💰 Nova Receita',
      corHeader: 'bg-primary-600',
      corFoco: 'focus:ring-green-500',
      corBotao: 'bg-green-600 hover:bg-green-700',
      textoBotao: editando ? '💾 Salvar Receita' : '✅ Criar Receita'
    },
    despesa: {
      titulo: editando ? '✏️ Editar Despesa' : '💳 Nova Despesa',
      corHeader: 'bg-red-500',
      corFoco: 'focus:ring-red-500',
      corBotao: 'bg-red-600 hover:bg-red-700',
      textoBotao: editando ? '💾 Salvar Despesa' : '✅ Criar Despesa'
    }
  };

  const cfg = config[tipo];

  return (
    <ModalBase
      aberto={aberto}
      onFechar={onFechar}
      titulo={cfg.titulo}
      corHeader={cfg.corHeader}
      tamanho="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Linha 1: Categoria e Descrição */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
              Categoria *
            </label>
            <select
              value={formData.categoria_id}
              onChange={(e) => setFormData({ ...formData, categoria_id: e.target.value })}
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`}
              required
            >
              <option value="">Selecione...</option>
              {renderizarOpcoesCategoria()}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
              Descrição *
            </label>
            <input
              type="text"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`}
              placeholder={tipo === 'receita' ? 'Ex: Mensalidade Dezembro' : 'Ex: Conta de Luz'}
              required
            />
          </div>
        </div>

        {/* Linha 2: Origem e Irmão */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
              Origem *
            </label>
            <select
              value={formData.origem_tipo}
              onChange={(e) => {
                setFormData({ 
                  ...formData, 
                  origem_tipo: e.target.value,
                  origem_irmao_id: ''
                });
              }}
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`}
              required
            >
              <option value="Loja">🏛️ Loja</option>
              <option value="Irmao">👤 Irmão</option>
            </select>
          </div>

          {formData.origem_tipo === 'Irmao' && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                Irmão *
              </label>
              <select
                value={formData.origem_irmao_id}
                onChange={(e) => setFormData({ ...formData, origem_irmao_id: e.target.value })}
                className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`}
                required
              >
                <option value="">Selecione...</option>
                {irmaos.map(irmao => (
                  <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Linha 3: Valor e Datas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
              Valor (R$) *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.valor}
              onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`}
              placeholder="0,00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
              Data Lançamento *
            </label>
            <input
              type="date"
              value={formData.data_lancamento}
              onChange={(e) => setFormData({ ...formData, data_lancamento: e.target.value })}
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
              Data Vencimento *
            </label>
            <input
              type="date"
              value={formData.data_vencimento}
              onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`}
              required
            />
          </div>
        </div>

        {/* Linha 4: Status e Tipo Pagamento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
              Status *
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`}
              required
            >
              <option value="pendente">⏳ Pendente</option>
              <option value="pago">✅ Pago</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
              Tipo de Pagamento *
            </label>
            <select
              value={formData.tipo_pagamento}
              onChange={(e) => setFormData({ ...formData, tipo_pagamento: e.target.value })}
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`}
              required
            >
              <option value="dinheiro">💵 Dinheiro</option>
              <option value="pix">📱 PIX</option>
              <option value="transferencia">🏦 Transferência</option>
              <option value="debito">💳 Débito</option>
              <option value="credito">💳 Crédito</option>
              <option value="cheque">📝 Cheque</option>
            </select>
          </div>
        </div>

        {/* Linha 5: Data Pagamento (se status = pago) */}
        {formData.status === 'pago' && (
          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
              Data Pagamento *
            </label>
            <input
              type="date"
              value={formData.data_pagamento}
              onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })}
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`}
              required
            />
          </div>
        )}

        {/* Observações */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
            Observações
          </label>
          <textarea
            value={formData.observacoes || ''}
            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
            className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`}
            rows="3"
            placeholder="Observações adicionais..."
          />
        </div>

        {/* Botões */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className={`px-6 py-2 ${cfg.corBotao} text-white rounded-lg font-medium transition-colors`}
          >
            {cfg.textoBotao}
          </button>
          <button
            type="button"
            onClick={onFechar}
            className="px-6 py-2 bg-gray-300 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </ModalBase>
  );
}
