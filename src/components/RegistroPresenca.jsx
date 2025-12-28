import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function RegistroPresenca({ sessaoId, onVoltar }) {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sessao, setSessao] = useState(null);
  const [irmaos, setIrmaos] = useState([]);
  const [presencas, setPresencas] = useState({});
  const [justificativas, setJustificativas] = useState({});
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (sessaoId) carregarDados();
  }, [sessaoId]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setMensagem({ tipo: '', texto: '' });

      // 1. Buscar sessão
      const { data: sessaoData, error: e1 } = await supabase
        .from('sessoes_presenca')
        .select('*, graus_sessao:grau_sessao_id(nome, grau_minimo_requerido)')
        .eq('id', sessaoId)
        .single();

      if (e1) throw e1;
      setSessao(sessaoData);

      // 2. Buscar irmãos elegíveis (status ativo, regular ou licenciado, grau suficiente)
      const grauMin = sessaoData.graus_sessao?.grau_minimo_requerido || 1;
      
      let query = supabase
        .from('irmaos')
        .select('id, nome, cim, foto_url, situacao, data_iniciacao, data_elevacao, data_exaltacao')
        .eq('status', 'ativo')
        .in('situacao', ['regular', 'licenciado']);

      // Filtrar por grau (sem filtrar por data)
      if (grauMin === 2) {
        query = query.not('data_elevacao', 'is', null);
      } else if (grauMin === 3) {
        query = query.not('data_exaltacao', 'is', null);
      }

      const { data: irmaosData, error: e2 } = await query.order('nome');
      if (e2) throw e2;

      // Adicionar grau
      const irmaosComGrau = irmaosData.map(i => ({
        ...i,
        grau: i.data_exaltacao ? 'Mestre' : 
              i.data_elevacao ? 'Companheiro' : 
              i.data_iniciacao ? 'Aprendiz' : 'Sem Grau'
      }));

      setIrmaos(irmaosComGrau);

      // 3. Buscar presenças já registradas
      const { data: presencasData } = await supabase
        .from('registros_presenca')
        .select('*')
        .eq('sessao_id', sessaoId);

      const presObj = {};
      const justObj = {};
      presencasData?.forEach(p => {
        presObj[p.membro_id] = p.presente;
        if (p.justificativa) justObj[p.membro_id] = p.justificativa;
      });

      setPresencas(presObj);
      setJustificativas(justObj);

    } catch (error) {
      console.error('Erro ao carregar:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao carregar dados da sessão' });
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    try {
      setSalvando(true);
      setMensagem({ tipo: '', texto: '' });

      const registros = irmaos.map(i => ({
        sessao_id: sessaoId,
        membro_id: i.id,
        presente: presencas[i.id] || false,
        justificativa: (!presencas[i.id] && justificativas[i.id]) ? justificativas[i.id] : null
      }));

      // Deletar registros antigos e inserir novos
      await supabase
        .from('registros_presenca')
        .delete()
        .eq('sessao_id', sessaoId);

      const { error } = await supabase
        .from('registros_presenca')
        .insert(registros);

      if (error) throw error;

      setMensagem({ tipo: 'sucesso', texto: 'Presenças salvas com sucesso!' });
      setTimeout(() => carregarDados(), 1500);

    } catch (error) {
      console.error('Erro ao salvar:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar presenças' });
    } finally {
      setSalvando(false);
    }
  };

  const marcarTodos = (valor) => {
    const novasPresencas = {};
    irmaos.forEach(i => novasPresencas[i.id] = valor);
    setPresencas(novasPresencas);
    if (valor) setJustificativas({});
  };

  const irmaosFiltrados = irmaos.filter(i =>
    i.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const totalPresentes = Object.values(presencas).filter(p => p).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!sessao) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-6 text-center">
        <p className="text-red-800">Sessão não encontrada</p>
        <button onClick={onVoltar} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Registro de Presença</h2>
            <p className="text-gray-600 mt-1">{sessao.graus_sessao?.nome}</p>
            <p className="text-sm text-gray-500">
              {new Date(sessao.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
          </div>
          <button onClick={onVoltar} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
            ← Voltar
          </button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded p-4 text-center">
            <p className="text-sm text-blue-600 font-medium">Total</p>
            <p className="text-3xl font-bold text-blue-800">{irmaos.length}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded p-4 text-center">
            <p className="text-sm text-green-600 font-medium">Presentes</p>
            <p className="text-3xl font-bold text-green-800">{totalPresentes}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded p-4 text-center">
            <p className="text-sm text-red-600 font-medium">Ausentes</p>
            <p className="text-3xl font-bold text-red-800">{irmaos.length - totalPresentes}</p>
          </div>
        </div>
      </div>

      {/* Mensagens */}
      {mensagem.texto && (
        <div className={`mb-4 p-4 rounded ${
          mensagem.tipo === 'sucesso' ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'
        }`}>
          {mensagem.texto}
        </div>
      )}

      {/* Ferramentas */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4 items-center">
          <input
            type="text"
            placeholder="🔍 Buscar irmão..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="flex-1 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => marcarTodos(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            ✓ Marcar Todos
          </button>
          <button
            onClick={() => marcarTodos(false)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            ✗ Desmarcar Todos
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Irmão</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grau</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Presença</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Justificativa</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {irmaosFiltrados.map(irmao => (
              <tr key={irmao.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{irmao.nome}</div>
                  {irmao.situacao === 'licenciado' && (
                    <span className="mt-1 inline-block px-2 py-0.5 text-xs font-semibold rounded bg-orange-100 text-orange-800">
                      Licenciado
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800">
                    {irmao.grau}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={presencas[irmao.id] || false}
                      onChange={(e) => {
                        setPresencas({...presencas, [irmao.id]: e.target.checked});
                        if (e.target.checked) {
                          const novas = {...justificativas};
                          delete novas[irmao.id];
                          setJustificativas(novas);
                        }
                      }}
                      className="w-6 h-6 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">
                      {presencas[irmao.id] ? 'Presente' : 'Ausente'}
                    </span>
                  </label>
                </td>
                <td className="px-6 py-4">
                  {!presencas[irmao.id] && (
                    <input
                      type="text"
                      placeholder="Motivo da ausência..."
                      value={justificativas[irmao.id] || ''}
                      onChange={(e) => setJustificativas({...justificativas, [irmao.id]: e.target.value})}
                      className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {irmaosFiltrados.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum irmão encontrado
          </div>
        )}
      </div>

      {/* Botões */}
      <div className="mt-6 flex justify-end gap-4">
        <button
          onClick={onVoltar}
          className="px-6 py-3 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleSalvar}
          disabled={salvando}
          className={`px-6 py-3 rounded text-white font-medium ${
            salvando ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {salvando ? 'Salvando...' : 'Salvar Presenças'}
        </button>
      </div>
    </div>
  );
}
