/**
 * CALENDÁRIO ANUAL MAÇÔNICO
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import React, { useState } from 'react';

export default function CalendarioAnual({ eventos = [], ano = new Date().getFullYear() }) {
  const [semestre, setSemestre] = useState(1); // 1 = Jan-Jun, 2 = Jul-Dez

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const diasSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  // Cores por tipo de evento
  const coresEvento = {
    'sessao_ordinaria': 'bg-blue-500',
    'sessao_magna': 'bg-purple-600',
    'evento_especial': 'bg-yellow-500',
    'aniversario': 'bg-red-500',
    'feriado': 'bg-green-500',
    'default': 'bg-gray-400'
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
          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl">⚒️</span>
            <h3 className="text-xl font-bold tracking-wide">{meses[mesIndex].toUpperCase()}</h3>
            <span className="text-2xl">📐</span>
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
                  !dia ? 'bg-gray-50' : 'bg-white hover:bg-blue-50 cursor-pointer transition'
                }`}
                title={temEvento ? eventosHoje.map(e => e.titulo).join(', ') : ''}
              >
                {dia && (
                  <>
                    <div className="text-sm font-semibold text-gray-700">{dia}</div>
                    
                    {/* Indicadores de Eventos */}
                    {temEvento && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {eventosHoje.map((evento, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              coresEvento[evento.tipo] || coresEvento.default
                            }`}
                            title={evento.titulo}
                          />
                        ))}
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
    <div className="calendario-anual">
      {/* Cabeçalho Principal */}
      <div className="bg-gradient-to-r from-yellow-800 via-yellow-700 to-yellow-800 text-white py-6 px-8 rounded-t-xl shadow-lg mb-6">
        <div className="flex items-center justify-center gap-4">
          <span className="text-4xl">📅</span>
          <div className="text-center">
            <h1 className="text-3xl font-bold">CALENDÁRIO ANUAL {ano}</h1>
            <p className="text-sm opacity-90 mt-1">A∴R∴L∴S∴ Acácia de Paranatinga nº 30</p>
          </div>
          <span className="text-4xl">⚜️</span>
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span className="text-sm text-gray-700">Sessão Ordinária</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-purple-600"></div>
            <span className="text-sm text-gray-700">Sessão Magna</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
            <span className="text-sm text-gray-700">Evento Especial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-sm text-gray-700">Aniversário</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-700">Feriado</span>
          </div>
        </div>
      </div>

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
