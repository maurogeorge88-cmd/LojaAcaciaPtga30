import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarData } from '../../utils/formatters';

const CadastrarBalaustre = ({ onUpdate, showSuccess, showError }) => {
  const [form, setForm] = useState({
    numero: '',
    data: '',
    tipo_sessao: 'ordinaria',
    grau: 'aprendiz',
    observacoes: ''
  });
  const [loading, setLoading] = useState(false);

  const tiposSessao = [
    { value: 'ordinaria', label: 'Sessao Ordinaria' },
    { value: 'extraordinaria', label: 'Sessao Extraordinaria' },
    { value: 'iniciacao', label: 'Iniciacao' },
    { value: 'elevacao', label: 'Elevacao' },
    { value: 'exaltacao', label: 'Exaltacao' },
    { value: 'magna', label: 'Sessao Magna' },
    { value: 'branca', label: 'Sessao Branca' },
    { value: 'funebre', label: 'Sessao Funebre' }
  ];

  const graus = [
    { value: 'aprendiz', label: 'Aprendiz' },
    { value: 'companheiro', label: 'Companheiro' },
    { value: 'mestre', label: 'Mestre' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.numero || !form.data) {
      showError('Preencha numero e data');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('balaustres')
        .insert([form]);

      if (error) throw error;

      showSuccess('Balaustre cadastrado com sucesso!');
      setForm({
        numero: '',
        data: '',
        tipo_sessao: 'ordinaria',
        grau: 'aprendiz',
        observacoes: ''
      });
      onUpdate();
    } catch (error) {
      showError('Erro ao cadastrar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Cadastrar Balaustre</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Numero *
            </label>
            <input
              type="text"
              value={form.numero}
              onChange={(e) => setForm({...form, numero: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data *
            </label>
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm({...form, data: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Sessao
            </label>
            <select
              value={form.tipo_sessao}
              onChange={(e) => setForm({...form, tipo_sessao: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {tiposSessao.map(tipo => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grau
            </label>
            <select
              value={form.grau}
              onChange={(e) => setForm({...form, grau: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {graus.map(grau => (
                <option key={grau.value} value={grau.value}>{grau.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observacoes
          </label>
          <textarea
            value={form.observacoes}
            onChange={(e) => setForm({...form, observacoes: e.target.value})}
            rows="4"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Cadastrando...' : 'Cadastrar Balaustre'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CadastrarBalaustre;
