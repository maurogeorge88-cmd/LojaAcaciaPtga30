import { useState } from 'react';
import { supabase } from '../../supabaseClient';

const CadastrarPrancha = ({ onUpdate, showSuccess, showError }) => {
  const [form, setForm] = useState({
    numero: '',
    data: '',
    tipo: 'recebida',
    remetente: '',
    destinatario: '',
    assunto: '',
    status: 'pendente',
    observacoes: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.numero || !form.data || !form.assunto) {
      showError('Preencha os campos obrigatorios');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('pranchas_expedidas')
        .insert([form]);

      if (error) throw error;

      showSuccess('Prancha cadastrada com sucesso!');
      setForm({
        numero: '',
        data: '',
        tipo: 'recebida',
        remetente: '',
        destinatario: '',
        assunto: '',
        status: 'pendente',
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
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Cadastrar Prancha</h2>

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
              Tipo
            </label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({...form, tipo: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="recebida">Recebida</option>
              <option value="expedida">Expedida</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm({...form, status: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="pendente">Pendente</option>
              <option value="respondida">Respondida</option>
              <option value="arquivada">Arquivada</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remetente
            </label>
            <input
              type="text"
              value={form.remetente}
              onChange={(e) => setForm({...form, remetente: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Destinatario
            </label>
            <input
              type="text"
              value={form.destinatario}
              onChange={(e) => setForm({...form, destinatario: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Assunto *
          </label>
          <input
            type="text"
            value={form.assunto}
            onChange={(e) => setForm({...form, assunto: e.target.value})}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observacoes
          </label>
          <textarea
            value={form.observacoes}
            onChange={(e) => setForm({...form, observacoes: e.target.value})}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Cadastrando...' : 'Cadastrar Prancha'}
        </button>
      </form>
    </div>
  );
};

export default CadastrarPrancha;
