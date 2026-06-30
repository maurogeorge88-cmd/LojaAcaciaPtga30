import React, { useState } from 'react';
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
  todosIrmaos = [],
  editando = false,
  eventosComemorativos = [],
  projetos = []
}) {
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSalvar(formData);
  };

  // Lista de irmãos exibida no select — ativos ou todos (com inativos)
  const SITUACOES_ATIVAS = ['regular', 'licenciado'];
  const irmaosAtivos   = irmaos; // já filtrados pelo FinancasLoja
  const irmaosInativos = todosIrmaos.filter(
    i => !SITUACOES_ATIVAS.includes((i.situacao || '').toLowerCase())
  ).sort((a, b) => a.nome.localeCompare(b.nome));

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
      corHeader: '#10b981',
      corFoco: 'focus:ring-green-500',
      corBotao: 'bg-green-600 hover:bg-green-700',
      textoBotao: editando ? '💾 Salvar Receita' : '✅ Criar Receita'
    },
    despesa: {
      titulo: editando ? '✏️ Editar Despesa' : '💳 Nova Despesa',
      corHeader: '#ef4444',
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
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`} style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`} style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`} style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
              required
            >
              <option value="Loja">🏛️ Loja</option>
              <option value="Irmao">👤 Irmão</option>
            </select>
          </div>

          {formData.origem_tipo === 'Irmao' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label className="block text-sm font-medium" style={{color:"var(--color-text-muted)"}}>
                  Irmão *
                </label>
                {/* Toggle incluir inativos */}
                <button
                  type="button"
                  onClick={() => { setMostrarInativos(v => !v); setFormData({ ...formData, origem_irmao_id: '' }); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '700',
                    cursor: 'pointer', border: '1px solid',
                    background: mostrarInativos ? 'rgba(239,68,68,0.12)' : 'var(--color-surface-2)',
                    color: mostrarInativos ? '#ef4444' : 'var(--color-text-muted)',
                    borderColor: mostrarInativos ? 'rgba(239,68,68,0.4)' : 'var(--color-border)',
                    transition: 'all 0.15s'
                  }}
                >
                  {mostrarInativos ? '🔴 Inativos' : '⚪ Só Ativos'}
                </button>
              </div>
              <select
                value={formData.origem_irmao_id}
                onChange={(e) => setFormData({ ...formData, origem_irmao_id: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg ${cfg.corFoco}`}
                style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                required
              >
                <option value="">Selecione...</option>
                {!mostrarInativos ? (
                  irmaosAtivos.map(irmao => (
                    <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>
                  ))
                ) : (
                  <>
                    <optgroup label="── Inativos ──">
                      {irmaosInativos.map(irmao => (
                        <option key={irmao.id} value={irmao.id}>
                          {irmao.nome} ({irmao.situacao})
                        </option>
                      ))}
                    </optgroup>
                    {irmaosAtivos.length > 0 && (
                      <optgroup label="── Ativos / Licenciados ──">
                        {irmaosAtivos.map(irmao => (
                          <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>
                        ))}
                      </optgroup>
                    )}
                  </>
                )}
              </select>
              {mostrarInativos && (
                <p style={{ fontSize: '0.7rem', color: '#f59e0b', marginTop: '0.3rem', fontWeight: '600' }}>
                  ⚠️ Modo inativos ativo — lançamento será registrado para irmão fora da situação regular
                </p>
              )}
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
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`} style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`} style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`} style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`} style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`} style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
              className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`} style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
              required
            />
          </div>
        )}

        {/* Evento Comemorativo */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
            🎉 Evento Comemorativo <span style={{fontSize:"0.75rem",fontWeight:400,color:"var(--color-text-muted)"}}>(opcional)</span>
          </label>
          <select
            value={formData.evento_comemorativo_id || ''}
            onChange={(e) => setFormData({ ...formData, evento_comemorativo_id: e.target.value || null })}
            className={`w-full px-3 py-2 border rounded-lg ${cfg.corFoco}`}
            style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
          >
            <option value="">— Nenhum —</option>
            {eventosComemorativos.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.nome} ({ev.ano}){ev.status === 'encerrado' ? ' ✅' : ''}
              </option>
            ))}
          </select>
          {formData.evento_comemorativo_id && (
            <p style={{fontSize:"0.72rem",color:"var(--color-text-muted)",marginTop:"0.25rem"}}>
              ✓ Lançamento vinculado ao evento selecionado
            </p>
          )}
        </div>

        {/* Projeto */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
            🏗️ Projeto <span style={{fontSize:"0.75rem",fontWeight:400,color:"var(--color-text-muted)"}}>(opcional)</span>
          </label>
          <select
            value={formData.projeto_id || ''}
            onChange={(e) => setFormData({ ...formData, projeto_id: e.target.value || null })}
            className={`w-full px-3 py-2 border rounded-lg ${cfg.corFoco}`}
            style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
          >
            <option value="">— Nenhum —</option>
            {projetos.filter(p => p.status === 'em_andamento').map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
          {formData.projeto_id && (
            <p style={{fontSize:"0.72rem",color:"var(--color-text-muted)",marginTop:"0.25rem"}}>
              ✓ Lançamento vinculado ao projeto selecionado
            </p>
          )}
        </div>

        {/* Observações */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
            Observações
          </label>
          <textarea
            value={formData.observacoes || ''}
            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
            className={`w-full px-3 py-2 border  rounded-lg  ${cfg.corFoco}`} style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
            style={{padding:"0.5rem 1.5rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}
          >
            Cancelar
          </button>
        </div>
      </form>
    </ModalBase>
  );
}
