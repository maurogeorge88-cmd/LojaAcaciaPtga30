import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const SeletorTema = () => {
  const [temaAtual, setTemaAtual] = useState('azul');
  const [salvando, setSalvando] = useState(false);

  const temas = [
    {
      id: 'azul',
      nome: 'Azul Profissional',
      descricao: 'Confiança e profissionalismo',
      cor: 'bg-blue-600',
      preview: 'from-blue-600 to-blue-700',
      emoji: '💼'
    },
    {
      id: 'verde',
      nome: 'Verde Prosperidade',
      descricao: 'Crescimento e harmonia',
      cor: 'bg-green-600',
      preview: 'from-green-600 to-green-700',
      emoji: '🌱'
    },
    {
      id: 'roxo',
      nome: 'Roxo Realeza',
      descricao: 'Nobreza e sabedoria maçônica',
      cor: 'bg-purple-600',
      preview: 'from-purple-600 to-purple-700',
      emoji: '👑'
    },
    {
      id: 'indigo',
      nome: 'Índigo Profundidade',
      descricao: 'Sabedoria e conhecimento',
      cor: 'bg-indigo-600',
      preview: 'from-indigo-600 to-indigo-700',
      emoji: '📘'
    },
    {
      id: 'teal',
      nome: 'Teal Equilíbrio',
      descricao: 'Harmonia e serenidade',
      cor: 'bg-teal-600',
      preview: 'from-teal-600 to-teal-700',
      emoji: '⚖️'
    },
    {
      id: 'laranja',
      nome: 'Laranja Energia',
      descricao: 'Criatividade e entusiasmo',
      cor: 'bg-orange-600',
      preview: 'from-orange-600 to-orange-700',
      emoji: '🔥'
    }
  ];

  useEffect(() => {
    carregarTema();
  }, []);

  const carregarTema = async () => {
    try {
      const { data, error } = await supabase
        .from('dados_loja')
        .select('tema_cor')
        .single();

      if (!error && data?.tema_cor) {
        setTemaAtual(data.tema_cor);
        aplicarTema(data.tema_cor);
      }
    } catch (error) {
      console.error('Erro ao carregar tema:', error);
    }
  };

  const aplicarTema = (tema) => {
    // Remove tema anterior
    document.documentElement.removeAttribute('data-theme');
    
    // Aplica novo tema (se não for azul, que é o padrão)
    if (tema !== 'azul') {
      document.documentElement.setAttribute('data-theme', tema);
    }
  };

  const salvarTema = async (novoTema) => {
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('dados_loja')
        .update({ tema_cor: novoTema })
        .eq('id', 1); // Assumindo que há apenas 1 registro

      if (error) throw error;

      setTemaAtual(novoTema);
      aplicarTema(novoTema);
      
      // Debug: verificar se aplicou
      const temaAplicado = document.documentElement.getAttribute('data-theme');
      
      alert(`✅ Tema alterado!\n\nTema escolhido: ${novoTema}\nTema aplicado no HTML: ${temaAplicado || 'azul (padrão)'}\n\nSe não mudou, recarregue a página (F5)`);
    } catch (error) {
      console.error('Erro ao salvar tema:', error);
      alert('❌ Erro ao salvar tema: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-2">🎨 Tema de Cores</h3>
        <p className="text-gray-600">
          Escolha a cor principal do sistema. Essa cor será aplicada em cabeçalhos, botões e destaques.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {temas.map((tema) => (
          <div
            key={tema.id}
            onClick={() => !salvando && salvarTema(tema.id)}
            className={`
              relative cursor-pointer rounded-lg border-4 transition-all
              ${temaAtual === tema.id 
                ? 'border-gray-800 shadow-xl scale-105' 
                : 'border-gray-200 hover:border-gray-400 hover:shadow-lg'
              }
              ${salvando ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {/* Preview do gradiente */}
            <div className={`h-24 rounded-t-md bg-gradient-to-r ${tema.preview} flex items-center justify-center`}>
              <span className="text-5xl">{tema.emoji}</span>
            </div>

            {/* Informações */}
            <div className="p-4 bg-white rounded-b-md">
              <h4 className="font-bold text-gray-800 mb-1 flex items-center justify-between">
                {tema.nome}
                {temaAtual === tema.id && (
                  <span className="text-green-600 text-sm">✓ Ativo</span>
                )}
              </h4>
              <p className="text-sm text-gray-600">{tema.descricao}</p>
            </div>

            {/* Indicador de seleção */}
            {temaAtual === tema.id && (
              <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-lg">
                ✓
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Aviso */}
      <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
        <p className="text-sm text-gray-700">
          <strong>💡 Dica:</strong> O tema escolhido será aplicado imediatamente em todo o sistema. 
          Cores de gráficos (verde/vermelho para receitas/despesas) permanecem as mesmas para facilitar visualização.
        </p>
      </div>

      {/* Preview ao vivo */}
      <div className="mt-6">
        <h4 className="font-bold text-gray-800 mb-3">📱 Preview do Tema Atual:</h4>
        <div className="space-y-3">
          {/* Cabeçalho exemplo */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4 rounded-lg shadow-lg">
            <h5 className="font-bold text-lg">Exemplo de Cabeçalho</h5>
            <p className="text-sm opacity-90">Assim ficará o cabeçalho do sistema</p>
          </div>

          {/* Botões exemplo */}
          <div className="flex gap-3 flex-wrap">
            <button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-semibold transition-all">
              Botão Principal
            </button>
            <button className="bg-primary-100 text-primary-700 px-4 py-2 rounded-lg font-semibold hover:bg-primary-200 transition-all">
              Botão Secundário
            </button>
            <button className="border-2 border-primary-600 text-primary-600 px-4 py-2 rounded-lg font-semibold hover:bg-primary-50 transition-all">
              Botão Outline
            </button>
          </div>

          {/* Card exemplo */}
          <div className="border-2 border-primary-200 rounded-lg p-4 bg-primary-50">
            <h6 className="font-bold text-primary-700 mb-2">Card de Exemplo</h6>
            <p className="text-gray-600 text-sm">
              Este é um exemplo de como os cards e destaques ficarão com o tema selecionado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeletorTema;
