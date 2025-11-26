import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarData } from '../../utils/formatters';

const Comissoes = ({ comissoes, irmaos, onUpdate, showSuccess, showError }) => {
  // Estados do formulário
  const [comissaoForm, setComissaoForm] = useState({
    nome: '',
    data_criacao: '',
    origem: 'interna',
    status: 'em_andamento',
    data_inicio: '',
    data_fim: '',
    objetivo: ''
  });

  // Estados de controle
  const [modoEdicao, setModoEdicao] = useState(false);
  const [comissaoEditando, setComissaoEditando] = useState(null);
  const [loading, setLoading] = useState(false);
  const [integrantesTemp, setIntegrantesTemp] = useState([]);

  // Limpar formulário
  const limparFormulario = () => {
    setComissaoForm({
      nome: '',
      data_criacao: '',
      origem: 'interna',
      status: 'em_andamento',
      data_inicio: '',
      data_fim: '',
      objetivo: ''
    });
    setIntegrantesTemp([]);
    setModoEdicao(false);
    setComissaoEditando(null);
  };

  // Adicionar integrante temporário
  const adicionarIntegrante = () => {
    const selectIrmao = document.getElementById('select-irmao-comissao');
    const selectFuncao = document.getElementById('select-funcao-comissao');
    
    const irmaoId = selectIrmao.value;
    const funcao = selectFuncao.value;
    
    if (!irmaoId || !funcao) {
      showError('Selecione um irmão e uma função');
      return;
    }
    
    const irmao = irmaos.find(i => i.id === parseInt(irmaoId));
    if (!irmao) return;
    
    // Verificar se já existe
    if (integrantesTemp.some(i => i.irmao_id === irmao.id)) {
      showError('Este irmão já está na comissão');
      return;
    }
    
    setIntegrantesTemp([...integrantesTemp, {
      irmao_id: irmao.id,
      irmao_nome: irmao.nome,
      funcao: funcao
    }]);
    
    selectIrmao.value = '';
    selectFuncao.value = '';
  };

  // Remover integrante temporário
  const removerIntegrante = (irmaoId) => {
    setIntegrantesTemp(integrantesTemp.filter(i => i.irmao_id !== irmaoId));
  };

  // Cadastrar comissão
  const handleSubmit = async () => {
    if (!comissaoForm.nome || !comissaoForm.data_criacao || !comissaoForm.data_inicio || !comissaoForm.objetivo) {
      showError('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);

    try {
      // Inserir comissão
      const { data: comissaoData, error: comissaoError } = await supabase
        .from('comissoes')
        .insert([{
          nome: comissaoForm.nome,
          data_criacao: comissaoForm.data_criacao,
          origem: comissaoForm.origem,
          status: comissaoForm.status,
          data_inicio: comissaoForm.data_inicio,
          data_fim: comissaoForm.data_fim || null,
          objetivo: comissaoForm.objetivo
        }])
        .select()
        .single();

      if (comissaoError) throw comissaoError;

      // Inserir integrantes
      if (integrantesTemp.length > 0) {
        const integrantesData = integrantesTemp.map(i => ({
          comissao_id: comissaoData.id,
          irmao_id: i.irmao_id,
          funcao: i.funcao
        }));

        const { error: integrantesError } = await supabase
          .from('comissoes_integrantes')
          .insert(integrantesData);

        if (integrantesError) throw integrantesError;
      }

      showSuccess('Comissão cadastrada com sucesso!');
      limparFormulario();
      onUpdate();

    } catch (error) {
      showError('Erro ao salvar comissão: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar comissão
  const handleAtualizar = async () => {
    if (!comissaoForm.nome || !comissaoForm.data_criacao || !comissaoForm.data_inicio || !comissaoForm.objetivo) {
      showError('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('comissoes')
        .update({
          nome: comissaoForm.nome,
          data_criacao: comissaoForm.data_criacao,
          origem: comissaoForm.origem,
          status: comissaoForm.status,
          data_inicio: comissaoForm.data_inicio,
          data_fim: comissaoForm.data_fim || null,
          objetivo: comissaoForm.objetivo
        })
        .eq('id', comissaoEditando.id);

      if (error) throw error;

      showSuccess('Comissão atualizada com sucesso!');
      limparFormulario();
      onUpdate();

    } catch (error) {
      showError('Erro ao atualizar comissão: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Editar comissão
  const handleEditar = (comissao) => {
    setModoEdicao(true);
    setComissaoEditando(comissao);
    setComissaoForm({
      nome: comissao.nome,
      data_criacao: comissao.data_criacao,
      origem: comissao.origem,
      status: comissao.status,
      data_inicio: comissao.data_inicio,
      data_fim: comissao.data_fim || '',
      objetivo: comissao.objetivo
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Excluir comissão
  const handleExcluir = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta comissão?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('comissoes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('Comissão excluída com sucesso!');
      onUpdate();

    } catch (error) {
      showError('Erro ao excluir comissão: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* FORMULÁRIO */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="text-xl font-bold text-blue-900 mb-4">
          {modoEdicao ? '✏️ Editar Comissão' : '➕ Nova Comissão'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Comissão *</label>
            <input
              type="text"
              value={comissaoForm.nome}
              onChange={(e) => setComissaoForm({ ...comissaoForm, nome: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data de Criação *</label>
            <input
              type="date"
              value={comissaoForm.data_criacao}
              onChange={(e) => setComissaoForm({ ...comissaoForm, data_criacao: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Origem *</label>
            <select
              value={comissaoForm.origem}
              onChange={(e) => setComissaoForm({ ...comissaoForm, origem: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="interna">Interna</option>
              <option value="externa">Externa</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
            <select
              value={comissaoForm.status}
              onChange={(e) => setComissaoForm({ ...comissaoForm, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="em_andamento">Em Andamento</option>
              <option value="encerrada">Encerrada</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Início *</label>
            <input
              type="date"
              value={comissaoForm.data_inicio}
              onChange={(e) => setComissaoForm({ ...comissaoForm, data_inicio: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Fim</label>
            <input
              type="date"
              value={comissaoForm.data_fim}
              onChange={(e) => setComissaoForm({ ...comissaoForm, data_fim: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Objetivo *</label>
            <textarea
              value={comissaoForm.objetivo}
              onChange={(e) => setComissaoForm({ ...comissaoForm, objetivo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows="2"
              required
            />
          </div>
        </div>

        {/* INTEGRANTES */}
        {!modoEdicao && (
          <div className="border-t pt-4 mt-4">
            <h4 className="font-bold text-gray-800 mb-3">👥 Integrantes</h4>
            
            <div className="flex gap-2 mb-3">
              <select
                id="select-irmao-comissao"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione um irmão</option>
                {irmaos.map(irmao => (
                  <option key={irmao.id} value={irmao.id}>
                    {irmao.nome} - CIM {irmao.cim}
                  </option>
                ))}
              </select>

              <select
                id="select-funcao-comissao"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Função</option>
                <option value="Presidente">Presidente</option>
                <option value="Vice-Presidente">Vice-Presidente</option>
                <option value="Secretário">Secretário</option>
                <option value="Membro">Membro</option>
                <option value="Relator">Relator</option>
              </select>

              <button
                type="button"
                onClick={adicionarIntegrante}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Adicionar
              </button>
            </div>

            {integrantesTemp.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                {integrantesTemp.map((integrante, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                    <span className="font-medium">{integrante.irmao_nome}</span>
                    <span className="text-sm text-gray-600">{integrante.funcao}</span>
                    <button
                      type="button"
                      onClick={() => removerIntegrante(integrante.irmao_id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ❌
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BOTÕES */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={modoEdicao ? handleAtualizar : handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            {loading ? 'Salvando...' : (modoEdicao ? 'Atualizar Comissão' : 'Cadastrar Comissão')}
          </button>
          
          {modoEdicao && (
            <button
              type="button"
              onClick={limparFormulario}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancelar Edição
            </button>
          )}
        </div>
      </div>

      {/* LISTAGEM */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <h3 className="text-xl font-bold">Comissões Cadastradas</h3>
          <p className="text-sm text-blue-100">Total: {comissoes.length} comissão(ões)</p>
        </div>

        <div className="divide-y divide-gray-200">
          {comissoes.length > 0 ? (
            comissoes.map((comissao) => (
              <div key={comissao.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-bold text-lg text-gray-900">{comissao.nome}</h4>
                    <p className="text-sm text-gray-600 mt-1">{comissao.objetivo}</p>
                    <div className="flex gap-4 mt-2 text-sm">
                      <span className={`px-2 py-1 rounded ${
                        comissao.status === 'em_andamento' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {comissao.status === 'em_andamento' ? 'Em Andamento' : 'Encerrada'}
                      </span>
                      <span className="text-gray-600">
                        📅 {formatarData(comissao.data_inicio)} 
                        {comissao.data_fim && ` - ${formatarData(comissao.data_fim)}`}
                      </span>
                      <span className={`px-2 py-1 rounded ${
                        comissao.origem === 'interna' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {comissao.origem === 'interna' ? 'Interna' : 'Externa'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEditar(comissao)}
                      className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleExcluir(comissao.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              Nenhuma comissão cadastrada
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Comissoes;
