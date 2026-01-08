/**
 * CALENDÁRIO ANUAL MAÇÔNICO
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function CalendarioAnual({ eventos = [], ano = new Date().getFullYear() }) {
  const [semestre, setSemestre] = useState(1); // 1 = Jan-Jun, 2 = Jul-Dez
  const [eventosSelecionados, setEventosSelecionados] = useState([]);
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [simboloMasonico, setSimboloMasonico] = useState(null);
  const [tema, setTema] = useState({
    cor_primaria: '#92400e',
    cor_secundaria: '#b45309',
    cor_destaque: '#fbbf24'
  });

  useEffect(() => {
    carregarSimbolo();
    carregarTema();
  }, []);

  const carregarTema = async () => {
    try {
      const { data, error } = await supabase
        .from('dados_loja')
        .select('cor_primaria, cor_secundaria, cor_destaque')
        .single();
      
      if (error) {
        console.log('Usando tema padrão (sem dados_loja configurado)');
        return;
      }
      
      if (data) {
        setTema({
          cor_primaria: data.cor_primaria || '#92400e',
          cor_secundaria: data.cor_secundaria || '#b45309',
          cor_destaque: data.cor_destaque || '#fbbf24'
        });
      }
    } catch (error) {
      console.log('Erro ao carregar tema, usando padrão:', error.message);
    }
  };

  const carregarSimbolo = async () => {
    try {
      const { data } = await supabase
        .from('dados_loja')
        .select('simbolo_masonico_url')
        .single();
      
      if (data?.simbolo_masonico_url) {
        setSimboloMasonico(data.simbolo_masonico_url);
      }
    } catch (error) {
      console.log('Símbolo não encontrado');
    }
  };

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const diasSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  // Mapear tipo de evento para cor (baseado nos tipos do Cronograma.jsx)
  const getTipoEvento = (evento) => {
    const tipo = evento.tipo?.toLowerCase() || '';
    
    // Mapeamento exato dos tipos do banco
    switch(tipo) {
      case 'sessao':
        return 'sessao_ordinaria';
      case 'sessao_magna':
        return 'sessao_magna';
      case 'sessao_instalacao':
      case 'sessao_posse':
        return 'sessao_especial';
      case 'trabalho_irmao':
      case 'instrucao':
        return 'trabalho';
      case 'evento_externo':
        return 'evento_especial';
      case 'outro':
      default:
        return 'default';
    }
  };

  // Cores por tipo de evento (alinhadas com o Cronograma)
  const coresEvento = {
    'sessao_ordinaria': 'bg-blue-500',      // Sessão comum
    'sessao_magna': 'bg-red-500',           // Sessão Magna
    'sessao_especial': 'bg-green-500',      // Instalação/Posse
    'trabalho': 'bg-purple-600',            // Trabalho/Instrução
    'evento_especial': 'bg-yellow-500',     // Evento Externo
    'default': 'bg-gray-400'                // Outro
  };

  // Função para obter dias do mês
  const getDiasMes = (mes, ano) => {
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const diasNoMes = ultimoDia.getDate();
    const diaSemanaInicio = primeiroDia.getDay();

    const dias = [];
    
    // Adicionar espaços vazios antes do primeiro dia
    for (let i = 0; i < diaSemanaInicio; i++) {
      dias.push(null);
    }
    
    // Adicionar dias do mês
    for (let dia = 1; dia <= diasNoMes; dia++) {
      dias.push(dia);
    }

    return dias;
  };

  // Verificar se dia tem evento
  const getEventosDia = (dia, mesIndex) => {
    if (!dia) return [];
    
    const dataStr = `${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    return eventos.filter(e => e.data === dataStr);
  };

  // Buscar detalhes completos dos eventos
  const buscarDetalhesEventos = async (dia, mesIndex) => {
    const dataStr = `${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    
    const { data } = await supabase
      .from('cronograma')
      .select('*')
      .eq('data_evento', dataStr);
    
    return data || [];
  };

  // Renderizar um mês
  const renderMes = (mesIndex) => {
    const dias = getDiasMes(mesIndex, ano);
    
    return (
      <div key={mesIndex} className="calendario-mes bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        {/* Cabeçalho do Mês - COR #008080 */}
        <div 
          className="text-white py-2 px-4 flex items-center justify-between"
          style={{ backgroundColor: '#008080' }}
        >
          <span className="text-xs opacity-70">{ano}</span>
          <h3 className="text-base font-bold tracking-wide">{meses[mesIndex].toUpperCase()}</h3>
          {simboloMasonico && (
            <img 
              src={simboloMasonico} 
              alt="" 
              className="w-5 h-5 object-contain opacity-80"
            />
          )}
        </div>

        {/* Dias da Semana - SIMPLIFICADO */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-300">
          {diasSemana.map((dia, i) => (
            <div key={i} className="text-center py-1.5 text-xs font-semibold text-gray-600">
              {dia}
            </div>
          ))}
        </div>

        {/* Grade de Dias */}
        <div className="grid grid-cols-7 gap-0">
          {dias.map((dia, index) => {
            const eventosHoje = dia ? getEventosDia(dia, mesIndex) : [];
            const temEvento = eventosHoje.length > 0;

            return (
              <div
                key={index}
                className={`min-h-[50px] border border-gray-200 p-1.5 relative ${
                  !dia ? 'bg-gray-50' : temEvento ? 'bg-blue-50 hover:bg-blue-100 cursor-pointer transition' : 'bg-white hover:bg-gray-50 transition'
                }`}
                onClick={async () => {
                  if (temEvento) {
                    const detalhes = await buscarDetalhesEventos(dia, mesIndex);
                    setDiaSelecionado(`${dia}/${mesIndex + 1}/${ano}`);
                    setEventosSelecionados(detalhes);
                  }
                }}
                title={temEvento ? eventosHoje.map(e => e.titulo).join(', ') : ''}
              >
                {dia && (
                  <>
                    <div className={`text-sm ${temEvento ? 'font-bold text-blue-700' : 'font-medium text-gray-700'}`}>
                      {dia}
                    </div>
                    
                    {/* Indicadores de Eventos - MENORES */}
                    {temEvento && (
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {eventosHoje.slice(0, 3).map((evento, i) => {
                          const tipoEvento = getTipoEvento(evento);
                          return (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full ${coresEvento[tipoEvento]}`}
                              title={evento.titulo}
                            />
                          );
                        })}
                        {eventosHoje.length > 3 && (
                          <span className="text-[8px] text-blue-600 ml-0.5">+{eventosHoje.length - 3}</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const mesesSemestre = semestre === 1 ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11];

  return (
    <div className="calendario-anual px-6 py-4">
      {/* Cabeçalho Principal - COR #008080 */}
      <div 
        className="text-white py-4 px-6 rounded-xl shadow-md mb-6"
        style={{ 
          background: 'linear-gradient(135deg, #008080, #00a0a0)'
        }}
      >
        <div className="flex items-center justify-center gap-4">
          <span className="text-3xl">📅</span>
          <h1 className="text-2xl font-bold">CALENDÁRIO ANUAL {ano}</h1>
          {simboloMasonico && (
            <img 
              src={simboloMasonico} 
              alt="Símbolo" 
              className="w-10 h-10 object-contain"
            />
          )}
        </div>
      </div>

      {/* Navegação de Semestres - COR #808080 */}
      <div className="flex justify-center items-center gap-3 mb-6">
        <button
          onClick={() => setSemestre(1)}
          disabled={semestre === 1}
          className={`px-5 py-2 rounded-lg font-medium text-sm transition ${
            semestre === 1
              ? 'text-white shadow-md'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
          style={semestre === 1 ? { backgroundColor: '#808080' } : {}}
        >
          📆 1º Semestre (Jan-Jun)
        </button>
        <button
          onClick={() => setSemestre(2)}
          disabled={semestre === 2}
          className={`px-5 py-2 rounded-lg font-medium text-sm transition ${
            semestre === 2
              ? 'text-white shadow-md'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
          style={semestre === 2 ? { backgroundColor: '#808080' } : {}}
        >
          📆 2º Semestre (Jul-Dez)
        </button>
      </div>

      {/* Grade de Meses - 3 Colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mesesSemestre.map(mesIndex => renderMes(mesIndex))}
      </div>

      {/* Legenda de Cores - SIMPLIFICADA */}
      <div className="mt-6 bg-white rounded-lg shadow-md p-4 border border-gray-200">
        <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span>🎨</span> Legenda de Eventos
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs text-gray-700">Sessão</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs text-gray-700">Sessão Magna</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs text-gray-700">Instalação/Posse</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-purple-600"></div>
            <span className="text-xs text-gray-700">Trabalho/Instrução</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-xs text-gray-700">Evento Externo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            <span className="text-xs text-gray-700">Outro</span>
          </div>
        </div>
      </div>

      {/* Modal Suspenso de Eventos do Dia */}
      {eventosSelecionados.length > 0 && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setEventosSelecionados([]);
            setDiaSelecionado(null);
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div 
              className="text-white p-6 rounded-t-xl sticky top-0"
              style={{ 
                background: `linear-gradient(to right, ${tema.cor_primaria}, ${tema.cor_secundaria}, ${tema.cor_primaria})` 
              }}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">📅</span>
                  <div>
                    <h3 className="text-2xl font-bold">Eventos do Dia</h3>
                    <p className="text-sm opacity-90">{diaSelecionado}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEventosSelecionados([]);
                    setDiaSelecionado(null);
                  }}
                  className="text-white hover:opacity-80 text-4xl leading-none transition"
                  title="Fechar"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Corpo do Modal */}
            <div className="p-6 space-y-4">
              {eventosSelecionados.map((evento, i) => {
                const tipoEvento = getTipoEvento(evento);
                const corClass = coresEvento[tipoEvento] || coresEvento.default;
                
                return (
                  <div
                    key={i}
                    className="bg-gray-50 rounded-lg p-5 border-l-4 shadow-md hover:shadow-lg transition"
                    style={{ 
                      borderColor: corClass.includes('blue') ? '#3b82f6' :
                                   corClass.includes('red') ? '#ef4444' :
                                   corClass.includes('green') ? '#22c55e' :
                                   corClass.includes('purple') ? '#9333ea' :
                                   corClass.includes('yellow') ? '#eab308' : '#9ca3af'
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-4 h-4 rounded-full mt-1 flex-shrink-0 ${corClass}`}></div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 text-lg mb-2">{evento.titulo}</h4>
                        
                        {/* Tipo e Grau */}
                        <div className="mb-3 flex flex-wrap gap-2">
                          <span 
                            className="inline-block px-3 py-1 rounded-full text-sm font-medium text-white"
                            style={{ 
                              backgroundColor: corClass.includes('blue') ? '#3b82f6' :
                                               corClass.includes('red') ? '#ef4444' :
                                               corClass.includes('green') ? '#22c55e' :
                                               corClass.includes('purple') ? '#9333ea' :
                                               corClass.includes('yellow') ? '#eab308' : '#9ca3af'
                            }}
                          >
                            {evento.tipo}
                          </span>
                          {evento.grau_sessao_id && (
                            <span className="inline-block px-3 py-1 rounded-full text-sm font-bold bg-indigo-100 text-indigo-800">
                              {evento.grau_sessao_id === 1 && '⬜ Aprendiz'}
                              {evento.grau_sessao_id === 2 && '🔷 Companheiro'}
                              {evento.grau_sessao_id === 3 && '🔺 Mestre'}
                              {evento.grau_sessao_id === 4 && '🏛️ Evento Loja'}
                            </span>
                          )}
                        </div>

                        {/* Descrição */}
                        {evento.descricao && (
                          <div className="bg-gray-100 rounded p-3 mb-3">
                            <p className="text-sm text-gray-800 leading-relaxed">{evento.descricao}</p>
                          </div>
                        )}

                        {/* Informações em grid */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {evento.hora_inicio && (
                            <div>
                              <p className="text-gray-600 mb-1">🕐 Início</p>
                              <p className="font-semibold">{evento.hora_inicio}</p>
                            </div>
                          )}
                          {evento.hora_fim && (
                            <div>
                              <p className="text-gray-600 mb-1">🕐 Término</p>
                              <p className="font-semibold">{evento.hora_fim}</p>
                            </div>
                          )}
                          {evento.local && (
                            <div className="col-span-2">
                              <p className="text-gray-600 mb-1">📍 Local</p>
                              <p className="font-semibold">{evento.local}</p>
                            </div>
                          )}
                          {evento.responsavel && (
                            <div className="col-span-2">
                              <p className="text-gray-600 mb-1">👤 Responsável</p>
                              <p className="font-semibold">{evento.responsavel}</p>
                            </div>
                          )}
                        </div>

                        {/* Observações */}
                        {evento.observacoes && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-gray-600 mb-1">📝 Observações</p>
                            <p className="text-sm text-gray-700">{evento.observacoes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CSS customizado para borda maçônica */}
      <style jsx>{`
        .border-masonico {
          border-image: repeating-linear-gradient(
            45deg,
            #d4af37,
            #d4af37 10px,
            #8b7355 10px,
            #8b7355 20px
          ) 1;
          box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);
        }

        @media print {
          .calendario-mes {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
