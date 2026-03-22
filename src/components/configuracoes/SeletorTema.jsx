import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const SeletorTema = () => {
  const [corAtual, setCorAtual] = useState('azul');
  const [temaAtual, setTemaAtual] = useState('dark');
  const [salvando, setSalvando] = useState(false);

  const paletas = [
    {
      id: 'azul',
      nome: 'Azul Maçônico',
      descricao: 'Confiança e profissionalismo',
      cor: '#3b82f6',
      emoji: '💼'
    },
    {
      id: 'verde',
      nome: 'Verde Esperança',
      descricao: 'Crescimento e harmonia',
      cor: '#10b981',
      emoji: '🌱'
    },
    {
      id: 'roxo',
      nome: 'Roxo Místico',
      descricao: 'Nobreza e sabedoria',
      cor: '#8b5cf6',
      emoji: '👑'
    },
    {
      id: 'dourado',
      nome: 'Dourado Sabedoria',
      descricao: 'Conhecimento e luz',
      cor: '#f59e0b',
      emoji: '☀️'
    },
    {
      id: 'marrom',
      nome: 'Marrom Terra',
      descricao: 'Estabilidade e força',
      cor: '#d97706',
      emoji: '🏔️'
    },
    {
      id: 'cinza',
      nome: 'Cinza Neutro',
      descricao: 'Elegância e neutralidade',
      cor: '#a1a1aa',
      emoji: '⚫'
    }
  ];

  useEffect(() => {
    carregarPreferencias();
  }, []);

  const carregarPreferencias = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('usuarios')
        .select('pref_tema_base, pref_cor_paleta')
        .eq('email', user.email)
        .single();

      if (!error && data) {
        const tema = data.pref_tema_base || 'dark';
        const cor = data.pref_cor_paleta || 'azul';
        
        setTemaAtual(tema);
        setCorAtual(cor);
        
        aplicarTema(tema, cor);
      }
    } catch (error) {
      console.error('Erro ao carregar preferências:', error);
    }
  };

  const aplicarTema = (tema, cor) => {
    console.log('🎨 Aplicando tema:', tema, '| cor:', cor);
    
    // Aplicar tema (dark/light)
    if (tema === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    
    // Aplicar paleta de cor
    if (cor === 'azul') {
      document.documentElement.removeAttribute('data-color');
    } else {
      document.documentElement.setAttribute('data-color', cor);
    }
    
    console.log('✅ Tema aplicado!');
  };

  const salvarPaleta = async (novaCor) => {
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('usuarios')
        .update({ pref_cor_paleta: novaCor })
        .eq('email', user.email);

      if (error) throw error;

      setCorAtual(novaCor);
      aplicarTema(temaAtual, novaCor);
      
    } catch (error) {
      console.error('Erro ao salvar paleta:', error);
      alert('❌ Erro ao salvar paleta: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  const alternarTema = async () => {
    const novoTema = temaAtual === 'dark' ? 'light' : 'dark';
    setSalvando(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('usuarios')
        .update({ pref_tema_base: novoTema })
        .eq('email', user.email);

      if (error) throw error;

      setTemaAtual(novoTema);
      aplicarTema(novoTema, corAtual);
      
    } catch (error) {
      console.error('Erro ao alternar tema:', error);
      alert('❌ Erro ao alternar tema: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="card">
      <div className="mb-6">
        <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          🎨 Tema de Cores
        </h3>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Escolha a cor principal do sistema. Essa cor será aplicada em cabeçalhos, botões e destaques.
        </p>
      </div>

      {/* Toggle Dark/Light */}
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface-2)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold mb-1" style={{ color: 'var(--color-text)' }}>
              {temaAtual === 'dark' ? '🌙 Tema Escuro' : '☀️ Tema Claro'}
            </h4>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Alterar entre tema escuro e claro
            </p>
          </div>
          <button
            onClick={alternarTema}
            disabled={salvando}
            className="btn-primary"
          >
            {temaAtual === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
          </button>
        </div>
      </div>

      {/* Paletas de Cores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paletas.map((paleta) => (
          <div
            key={paleta.id}
            onClick={() => !salvando && salvarPaleta(paleta.id)}
            className="relative cursor-pointer rounded-lg transition-all"
            style={{
              border: corAtual === paleta.id ? `3px solid ${paleta.cor}` : '3px solid var(--color-border)',
              opacity: salvando ? 0.5 : 1,
              transform: corAtual === paleta.id ? 'scale(1.02)' : 'scale(1)',
              backgroundColor: 'var(--color-surface-2)'
            }}
          >
            {/* Preview da cor */}
            <div 
              className="h-24 rounded-t-md flex items-center justify-center"
              style={{ backgroundColor: paleta.cor }}
            >
              <span className="text-5xl">{paleta.emoji}</span>
            </div>

            {/* Informações */}
            <div className="p-4">
              <h4 className="font-bold mb-1 flex items-center justify-between" style={{ color: 'var(--color-text)' }}>
                {paleta.nome}
                {corAtual === paleta.id && (
                  <span className="text-sm" style={{ color: paleta.cor }}>✓ Ativo</span>
                )}
              </h4>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {paleta.descricao}
              </p>
            </div>

            {/* Indicador de seleção */}
            {corAtual === paleta.id && (
              <div 
                className="absolute -top-2 -right-2 rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-lg text-white"
                style={{ backgroundColor: paleta.cor }}
              >
                ✓
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Aviso */}
      <div className="mt-6 p-4 rounded border-l-4" style={{ 
        backgroundColor: 'var(--color-info-bg)', 
        borderColor: 'var(--color-info)' 
      }}>
        <p className="text-sm" style={{ color: 'var(--color-text)' }}>
          <strong>💡 Dica:</strong> O tema escolhido será aplicado imediatamente em todo o sistema. 
          As preferências são salvas automaticamente.
        </p>
      </div>

      {/* Preview ao vivo */}
      <div className="mt-6">
        <h4 className="font-bold mb-3" style={{ color: 'var(--color-text)' }}>
          📱 Preview do Tema Atual:
        </h4>
        <div className="space-y-3">
          {/* Cabeçalho exemplo */}
          <div className="p-4 text-white" style={{ 
            background: 'var(--color-accent)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}>
            <h5 className="font-bold text-lg">Exemplo de Cabeçalho</h5>
            <p className="text-sm opacity-90">Assim ficará o cabeçalho do sistema</p>
          </div>

          {/* Botões exemplo */}
          <div className="flex gap-3 flex-wrap">
            <button className="btn-primary">Botão Principal</button>
            <button className="btn-secondary">Botão Secundário</button>
            <button className="btn-success">Botão Sucesso</button>
            <button className="btn-danger">Botão Perigo</button>
          </div>

          {/* Badges exemplo */}
          <div className="flex gap-2 flex-wrap">
            <span className="badge-primary">Primary</span>
            <span className="badge-success">Sucesso</span>
            <span className="badge-warning">Aviso</span>
            <span className="badge-danger">Perigo</span>
            <span className="badge-info">Info</span>
          </div>

          {/* Card exemplo */}
          <div className="card">
            <h6 className="font-bold mb-2" style={{ color: 'var(--color-accent)' }}>
              Card de Exemplo
            </h6>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Este é um exemplo de como os cards e destaques ficarão com o tema selecionado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeletorTema;
