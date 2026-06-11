import { useState } from 'react';
import { supabase } from '../../supabaseClient';


export default function ModalParcelamento({ categorias, irmaos, lancamentoExistente, onClose, onSuccess, showSuccess, showError }) {
  const [formParcelamento, setFormParcelamento] = useState({
    tipo: lancamentoExistente?.tipo || 'despesa',
    categoria_id: lancamentoExistente?.categoria_id || '',
    descricao: lancamentoExistente?.descricao || '',
    valor_total: lancamentoExistente?.valor || '',
    num_parcelas: 2,
    data_primeira_parcela: new Date().toISOString().split('T')[0],
    tipo_pagamento: lancamentoExistente?.tipo_pagamento || 'dinheiro',
    origem_tipo: lancamentoExistente?.origem_tipo || 'Loja',
    origem_irmao_id: lancamentoExistente?.origem_irmao_id || '',
    observacoes: lancamentoExistente?.observacoes || ''
  });

  const tiposPagamento = [
    { value: 'dinheiro', label: '💵 Dinheiro' },
    { value: 'pix', label: '📱 PIX' },
    { value: 'transferencia', label: '🏦 Transferência' },
    { value: 'deposito', label: '🏧 Depósito' },
    { value: 'cartao_credito', label: '💳 Cartão Crédito' },
    { value: 'cartao_debito', label: '💳 Cartão Débito' },
    { value: 'boleto', label: '📄 Boleto' },
    { value: 'cheque', label: '📝 Cheque' }
  ];

  // Função para renderizar categorias hierárquicas
  const renderizarOpcoesCategoria = (tipo) => {
    const categoriasFiltradas = categorias.filter(c => c.tipo === tipo);
    const principais = categoriasFiltradas.filter(c => c.nivel === 1 || !c.categoria_pai_id);
    
    const opcoes = [];
    
    principais.forEach(principal => {
      opcoes.push(
        <option key={principal.id} value={principal.id}>
          {principal.nome}
        </option>
      );
      
      const subcategorias = categoriasFiltradas.filter(c => c.categoria_pai_id === principal.id);
      subcategorias.forEach(sub => {
        opcoes.push(
          <option key={sub.id} value={sub.id}>
            &nbsp;&nbsp;&nbsp;&nbsp;└─ {sub.nome}
          </option>
        );
        
        const subSub = categoriasFiltradas.filter(c => c.categoria_pai_id === sub.id);
        subSub.forEach(ss => {
          opcoes.push(
            <option key={ss.id} value={ss.id}>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ {ss.nome}
            </option>
          );
        });
      });
    });
    
    return opcoes;
  };

  const gerarUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const valorTotal = parseFloat(formParcelamento.valor_total);
      const numParcelas = parseInt(formParcelamento.num_parcelas);
      
      if (valorTotal <= 0 || numParcelas < 2) {
        showError('Valor deve ser positivo e mínimo 2 parcelas');
        return;
      }

      const grupoParcelamento = gerarUUID();
      const valorParcela = valorTotal / numParcelas;
      
      // Se estiver parcelando um lançamento existente
      if (lancamentoExistente) {
        // Verificar se é lançamento principal com pagamentos parciais
        const { data: pagamentos, error: checkError } = await supabase
          .from('lancamentos_loja')
          .select('id')
          .eq('lancamento_principal_id', lancamentoExistente.id)
          .eq('eh_pagamento_parcial', true);

        if (checkError) throw checkError;

        if (pagamentos && pagamentos.length > 0) {
          showError('Este lançamento tem pagamentos parciais. Parcele o remanescente!');
          return;
        }

        // Transformar o lançamento existente na PRIMEIRA parcela
        const dataPrimeiraParcela = new Date(formParcelamento.data_primeira_parcela);
        
        const { error: updateError } = await supabase
          .from('lancamentos_loja')
          .update({
            descricao: `${formParcelamento.descricao} (1/${numParcelas})`,
            valor: valorParcela,
            data_vencimento: dataPrimeiraParcela.toISOString().split('T')[0],
            status: 'pendente',
            eh_parcelado: true,
            parcela_numero: 1,
            parcela_total: numParcelas,
            grupo_parcelamento: grupoParcelamento,
            observacoes: 'Parcelado'
          })
          .eq('id', lancamentoExistente.id);
        
        if (updateError) throw updateError;

        const parcelasRestantes = [];
        for (let i = 1; i < numParcelas; i++) {
          const dataParcela = new Date(formParcelamento.data_primeira_parcela);
          dataParcela.setMonth(dataParcela.getMonth() + i);
          
          parcelasRestantes.push({
            tipo: formParcelamento.tipo,
            categoria_id: parseInt(formParcelamento.categoria_id),
            descricao: `${formParcelamento.descricao} (${i + 1}/${numParcelas})`,
            valor: valorParcela,
            data_lancamento: new Date().toISOString().split('T')[0],
            data_vencimento: dataParcela.toISOString().split('T')[0],
            tipo_pagamento: formParcelamento.tipo_pagamento,
            status: 'pendente',
            origem_tipo: formParcelamento.origem_tipo,
            origem_irmao_id: formParcelamento.origem_irmao_id || null,
            observacoes: formParcelamento.observacoes,
            eh_parcelado: true,
            parcela_numero: i + 1,
            parcela_total: numParcelas,
            grupo_parcelamento: grupoParcelamento
          });
        }

        if (parcelasRestantes.length > 0) {
          const { error } = await supabase.from('lancamentos_loja').insert(parcelasRestantes);
          if (error) throw error;
        }

        showSuccess(`✅ Lançamento parcelado em ${numParcelas}x!`);
      } else {
        // Parcelamento NOVO (sem lançamento existente) - cria todas
        const parcelas = [];
        for (let i = 0; i < numParcelas; i++) {
          const dataParcela = new Date(formParcelamento.data_primeira_parcela);
          dataParcela.setMonth(dataParcela.getMonth() + i);
          
          parcelas.push({
            tipo: formParcelamento.tipo,
            categoria_id: parseInt(formParcelamento.categoria_id),
            descricao: `${formParcelamento.descricao} (${i + 1}/${numParcelas})`,
            valor: valorParcela,
            data_lancamento: new Date().toISOString().split('T')[0],
            data_vencimento: dataParcela.toISOString().split('T')[0],
            tipo_pagamento: formParcelamento.tipo_pagamento,
            status: 'pendente',
            origem_tipo: formParcelamento.origem_tipo,
            origem_irmao_id: formParcelamento.origem_irmao_id || null,
            observacoes: formParcelamento.observacoes,
            eh_parcelado: true,
            parcela_numero: i + 1,
            parcela_total: numParcelas,
            grupo_parcelamento: grupoParcelamento
          });
        }

        const { error } = await supabase.from('lancamentos_loja').insert(parcelas);
        if (error) throw error;
        showSuccess(`✅ ${numParcelas} parcelas criadas com sucesso!`);
      }
      
      onClose();
      onSuccess();
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao parcelar: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div 
          className="text-white px-6 py-4 rounded-t-lg"
          style={{ background:'var(--color-accent)' }}
        >
          <h3 className="text-xl font-bold" style={{color:"var(--color-text)"}}>
            {lancamentoExistente ? '🔀 Parcelar Lançamento Existente' : '🔢 Parcelar Despesa/Receita'}
          </h3>
          <p className="text-sm text-indigo-100">
            {lancamentoExistente 
              ? 'Dividir este lançamento em parcelas (o original será excluído)' 
              : 'Dividir um valor em parcelas mensais'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Tipo *</label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input type="radio" value="despesa" checked={formParcelamento.tipo === 'despesa'}
                  onChange={(e) => setFormParcelamento({ ...formParcelamento, tipo: e.target.value, categoria_id: '' })}
                  className="mr-2" />
                <span>💸 Despesa</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input type="radio" value="receita" checked={formParcelamento.tipo === 'receita'}
                  onChange={(e) => setFormParcelamento({ ...formParcelamento, tipo: e.target.value, categoria_id: '' })}
                  className="mr-2" />
                <span>💰 Receita</span>
              </label>
            </div>
          </div>

          {/* Linha 1: Categoria e Descrição */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Categoria *</label>
              <select required value={formParcelamento.categoria_id}
                onChange={(e) => setFormParcelamento({ ...formParcelamento, categoria_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}>
                <option value="">Selecione...</option>
                {renderizarOpcoesCategoria(formParcelamento.tipo)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Descrição *</label>
              <input type="text" required value={formParcelamento.descricao}
                onChange={(e) => setFormParcelamento({ ...formParcelamento, descricao: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}} placeholder="Ex: Reforma do templo" />
            </div>
          </div>
          <p className="text-xs -mt-2">Será adicionado (1/5), (2/5), etc.</p>

          {/* Linha 2: Origem */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Origem</label>
              <select value={formParcelamento.origem_tipo}
                onChange={(e) => setFormParcelamento({ ...formParcelamento, origem_tipo: e.target.value, origem_irmao_id: '' })}
                className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}>
                <option value="Loja">🏛️ Loja</option>
                <option value="Irmao">👤 Irmão</option>
              </select>
            </div>
            {formParcelamento.origem_tipo === 'Irmao' && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Irmão</label>
                <select value={formParcelamento.origem_irmao_id}
                  onChange={(e) => setFormParcelamento({ ...formParcelamento, origem_irmao_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}>
                  <option value="">Selecione...</option>
                  {irmaos.map(irmao => (
                    <option key={irmao.id} value={irmao.id}>{irmao.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Linha 3: Valor Total, Nº Parcelas e Data Vencimento */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Valor Total *</label>
              <input type="number" required step="0.01" min="0.01" value={formParcelamento.valor_total}
                onChange={(e) => setFormParcelamento({ ...formParcelamento, valor_total: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Nº Parcelas *</label>
              <input type="number" required min="2" max="24" value={formParcelamento.num_parcelas}
                onChange={(e) => setFormParcelamento({ ...formParcelamento, num_parcelas: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Vencimento 1ª Parcela *</label>
              <input type="date" required value={formParcelamento.data_primeira_parcela}
                onChange={(e) => setFormParcelamento({ ...formParcelamento, data_primeira_parcela: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}} />
            </div>
          </div>
          <p className="text-xs -mt-2">As demais vencerão mensalmente</p>

          {formParcelamento.valor_total && formParcelamento.num_parcelas && (
            <div className="border border-indigo-200 rounded p-3">
              <p className="text-sm font-medium">
                💡 Cada parcela: R$ {((parseFloat(formParcelamento.valor_total) || 0) / (parseInt(formParcelamento.num_parcelas) || 1)).toFixed(2)}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Forma de Pagamento</label>
            <select value={formParcelamento.tipo_pagamento}
              onChange={(e) => setFormParcelamento({ ...formParcelamento, tipo_pagamento: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}>
              {tiposPagamento.map(tp => (
                <option key={tp.value} value={tp.value}>{tp.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Observações</label>
            <textarea value={formParcelamento.observacoes}
              onChange={(e) => setFormParcelamento({ ...formParcelamento, observacoes: e.target.value })}
              rows="2" className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}} />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button type="submit" 
              className="flex-1 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
              🔢 Criar Parcelamento
            </button>
            <button type="button" onClick={onClose}
              className="px-6 py-2 bg-gray-300 rounded-lg font-medium">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
