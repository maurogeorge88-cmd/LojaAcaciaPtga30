import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';
import SeletorTema from '../configuracoes/SeletorTema';

export default function DadosLoja({ showSuccess, showError }) {
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  
  const [dadosLoja, setDadosLoja] = useState({
    nome_loja: '',
    numero_loja: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    telefone: '',
    email: '',
    data_fundacao: '',
    potencia: '',
    grande_loja: '',
    oriente: '',
    vale: '',
    logo_url: ''
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const { data, error } = await supabase
        .from('dados_loja')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setDadosLoja(data);
        if (data.logo_url) {
          setLogoPreview(data.logo_url);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDadosLoja(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      showError('Por favor, selecione uma imagem válida');
      return;
    }

    // Validar tamanho (máx 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showError('A imagem deve ter no máximo 2MB');
      return;
    }

    try {
      // Converter para base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setLogoPreview(base64String);
        setDadosLoja(prev => ({
          ...prev,
          logo_url: base64String
        }));
      };
      reader.readAsDataURL(file);
    } catch (error) {
      showError('Erro ao processar imagem');
      console.error(error);
    }
  };

  const salvar = async () => {
    try {
      const { data: existing } = await supabase
        .from('dados_loja')
        .select('id')
        .single();

      let error;

      if (existing) {
        // Atualizar
        const result = await supabase
          .from('dados_loja')
          .update(dadosLoja)
          .eq('id', existing.id);
        error = result.error;
      } else {
        // Inserir
        const result = await supabase
          .from('dados_loja')
          .insert([dadosLoja]);
        error = result.error;
      }

      if (error) throw error;

      showSuccess('Dados da loja salvos com sucesso!');
      setEditando(false);
      carregarDados();
    } catch (error) {
      showError('Erro ao salvar: ' + error.message);
      console.error(error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6 px-8 py-6 min-h-screen" style={{ backgroundColor: '#f3f4f6' }}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-gray-600">Cadastrar Dados da Loja</p>
        {!editando ? (
          <button
            onClick={() => setEditando(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ✏️ Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditando(false);
                carregarDados();
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              💾 Salvar
            </button>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Logo */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              🖼️ Logo da Loja
            </label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                <div className="w-32 h-32 border-2 border-gray-300 rounded-lg overflow-hidden flex items-center justify-center bg-gray-50">
                  <img 
                    src={logoPreview} 
                    alt="Logo" 
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}
              {editando && (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG ou GIF (máx. 2MB)</p>
                </div>
              )}
            </div>
          </div>

          {/* Nome da Loja */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nome da Loja *
            </label>
            <input
              type="text"
              name="nome_loja"
              value={dadosLoja.nome_loja}
              onChange={handleChange}
              disabled={!editando}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="Ex: Acácia de Paranatinga"
            />
          </div>

          {/* Número */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Número *
            </label>
            <input
              type="text"
              name="numero_loja"
              value={dadosLoja.numero_loja}
              onChange={handleChange}
              disabled={!editando}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="Ex: 30"
            />
          </div>

          {/* Data de Fundação */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Data de Fundação
            </label>
            <input
              type="date"
              name="data_fundacao"
              value={dadosLoja.data_fundacao}
              onChange={handleChange}
              disabled={!editando}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          {/* Potência */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Potência Maçônica
            </label>
            <input
              type="text"
              name="potencia"
              value={dadosLoja.potencia}
              onChange={handleChange}
              disabled={!editando}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="Ex: Grande Oriente do Brasil"
            />
          </div>

          {/* Grande Loja */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Grande Loja
            </label>
            <input
              type="text"
              name="grande_loja"
              value={dadosLoja.grande_loja}
              onChange={handleChange}
              disabled={!editando}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="Ex: Grande Loja Maçônica de Mato Grosso"
            />
          </div>

          {/* Oriente */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Oriente
            </label>
            <input
              type="text"
              name="oriente"
              value={dadosLoja.oriente}
              onChange={handleChange}
              disabled={!editando}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="Ex: Paranatinga"
            />
          </div>

          {/* Vale */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Vale
            </label>
            <input
              type="text"
              name="vale"
              value={dadosLoja.vale}
              onChange={handleChange}
              disabled={!editando}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="Ex: Cuiabá"
            />
          </div>

          {/* Endereço */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Endereço
            </label>
            <input
              type="text"
              name="endereco"
              value={dadosLoja.endereco}
              onChange={handleChange}
              disabled={!editando}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="Rua, número"
            />
          </div>

          {/* Cidade */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Cidade
            </label>
            <input
              type="text"
              name="cidade"
              value={dadosLoja.cidade}
              onChange={handleChange}
              disabled={!editando}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="Ex: Paranatinga"
            />
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Estado
            </label>
            <input
              type="text"
              name="estado"
              value={dadosLoja.estado}
              onChange={handleChange}
              disabled={!editando}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="Ex: MT"
              maxLength={2}
            />
          </div>

          {/* CEP */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              CEP
            </label>
            <input
              type="text"
              name="cep"
              value={dadosLoja.cep}
              onChange={handleChange}
              disabled={!editando}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="00000-000"
            />
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Telefone
            </label>
            <input
              type="text"
              name="telefone"
              value={dadosLoja.telefone}
              onChange={handleChange}
              disabled={!editando}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="(00) 00000-0000"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              E-mail
            </label>
            <input
              type="email"
              name="email"
              value={dadosLoja.email}
              onChange={handleChange}
              disabled={!editando}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="contato@loja.com.br"
            />
          </div>

        </div>
      </div>

      {/* SELETOR DE TEMA */}
      <div className="mt-8">
        <SeletorTema />
      </div>
    </div>
  );
}
