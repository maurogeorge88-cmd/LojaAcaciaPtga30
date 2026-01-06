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

  useEffect(() => {
    carregarSimbolo();
  }, []);

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

  // Renderizar um mês
  const renderMes = (mesIndex) => {
    const dias = getDiasMes(mesIndex, ano);
    
    return (
      <div key={mesIndex} className="calendario-mes bg-white rounded-xl shadow-lg overflow-hidden border-4 border-masonico">
        {/* Cabeçalho do Mês com Símbolos Maçônicos */}
        <div className="bg-gradient-to-r from-yellow-700 via-yellow-600 to-yellow-700 text-white py-4 px-6 text-center relative">
          <div className="flex items-center justify-between px-2">
            <span className="text-2xl">⚒️</span>
            <h3 className="text-xl font-bold tracking-wide flex-1">{meses[mesIndex].toUpperCase()}</h3>
            {simboloMasonico ? (
              <img 
                src={simboloMasonico} 
                alt="Símbolo" 
                className="w-8 h-8 object-contain"
              />
            ) : (
              <span className="text-2xl">📐</span>
            )}
          </div>
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-xs opacity-70">
            {ano}
          </div>
        </div>

        {/* Dias da Semana */}
        <div className="grid grid-cols-7 bg-gray-100 border-b-2 border-yellow-600">
          {diasSemana.map((dia, i) => (
            <div key={i} className="text-center py-2 text-sm font-bold text-gray-700">
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
                className={`min-h-[60px] border border-gray-200 p-1 relative ${
                  !dia ? 'bg-gray-50' : temEvento ? 'bg-white hover:bg-blue-100 cursor-pointer transition' : 'bg-white hover:bg-blue-50 transition'
                }`}
                onClick={() => {
                  if (temEvento) {
                    setDiaSelecionado(`${dia}/${mesIndex + 1}/${ano}`);
                    setEventosSelecionados(eventosHoje);
                  }
                }}
                title={temEvento ? eventosHoje.map(e => e.titulo).join(', ') : ''}
              >
                {dia && (
                  <>
                    <div className={`text-sm font-semibold ${temEvento ? 'text-blue-700' : 'text-gray-700'}`}>
                      {dia}
                    </div>
                    
                    {/* Indicadores de Eventos */}
                    {temEvento && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {eventosHoje.map((evento, i) => {
                          const tipoEvento = getTipoEvento(evento);
                          return (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full ${coresEvento[tipoEvento]}`}
                              title={evento.titulo}
                            />
                          );
                        })}
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
      {/* Cabeçalho Principal */}
      <div className="bg-gradient-to-r from-yellow-800 via-yellow-700 to-yellow-800 text-white py-6 px-8 rounded-t-xl shadow-lg mb-6">
        <div className="flex items-center justify-between px-4">
          <span className="text-4xl">📅</span>
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold">CALENDÁRIO ANUAL {ano}</h1>
            <p className="text-sm opacity-90 mt-1">A∴R∴L∴S∴ Acácia de Paranatinga nº 30</p>
          </div>
          {simboloMasonico ? (
            <img 
              src={simboloMasonico} 
              alt="Símbolo Maçônico" 
              className="w-16 h-16 object-contain"
            />
          ) : (
            <span className="text-4xl">⚜️</span>
          )}
        </div>
      </div>

      {/* Navegação de Semestres */}
      <div className="flex justify-center items-center gap-4 mb-6">
        <button
          onClick={() => setSemestre(1)}
          disabled={semestre === 1}
          className={`px-6 py-3 rounded-lg font-semibold transition ${
            semestre === 1
              ? 'bg-yellow-700 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📆 1º Semestre (Jan-Jun)
        </button>
        <button
          onClick={() => setSemestre(2)}
          disabled={semestre === 2}
          className={`px-6 py-3 rounded-lg font-semibold transition ${
            semestre === 2
              ? 'bg-yellow-700 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📆 2º Semestre (Jul-Dez)
        </button>
      </div>

      {/* Grade de Meses - 3 Colunas x 2 Linhas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mesesSemestre.map(mesIndex => renderMes(mesIndex))}
      </div>

      {/* Legenda de Cores */}
      <div className="mt-8 bg-white rounded-xl shadow-lg p-6 border-2 border-yellow-600">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>🎨</span> Legenda de Eventos
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span className="text-sm text-gray-700">Sessão</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-sm text-gray-700">Sessão Magna</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-700">Instalação/Posse</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-purple-600"></div>
            <span className="text-sm text-gray-700">Trabalho/Instrução</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
            <span className="text-sm text-gray-700">Evento Externo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gray-400"></div>
            <span className="text-sm text-gray-700">Outro</span>
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
            <div className="bg-gradient-to-r from-yellow-700 via-yellow-600 to-yellow-700 text-white p-6 rounded-t-xl sticky top-0">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">📅</span>
                  <div>
                    <h3 className="text-2xl font-bold">Eventos do Dia</h3>
                    <p className="text-sm text-yellow-100">{diaSelecionado}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEventosSelecionados([]);
                    setDiaSelecionado(null);
                  }}
                  className="text-white hover:text-yellow-200 text-4xl leading-none transition"
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
                        {evento.descricao && (
                          <p className="text-sm text-gray-700 mb-2">{evento.descricao}</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                          {evento.local && (
                            <span className="flex items-center gap-1">
                              📍 {evento.local}
                            </span>
                          )}
                          {evento.hora_inicio && (
                            <span className="flex items-center gap-1">
                              🕐 {evento.hora_inicio}
                            </span>
                          )}
                        </div>
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
