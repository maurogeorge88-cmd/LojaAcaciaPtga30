/**
 * COMPONENTE DASHBOARD
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import React, { useMemo } from 'react';

export const Dashboard = ({ irmaos, balaustres }) => {
  // Função para determinar o grau do irmão
  const obterGrau = (irmao) => {
    if (irmao.data_exaltacao) return 'Mestre';
    if (irmao.data_elevacao) return 'Companheiro';
    if (irmao.data_iniciacao) return 'Aprendiz';
    return 'Não Iniciado';
  };

  // Contagens por situação (case-insensitive)
  const irmaosRegulares = irmaos.filter(i => i.situacao?.toLowerCase() === 'regular');
  const irmaosIrregulares = irmaos.filter(i => i.situacao?.toLowerCase() === 'irregular');
  const irmaosLicenciados = irmaos.filter(i => i.situacao?.toLowerCase() === 'licenciado');
  const irmaosSuspensos = irmaos.filter(i => i.situacao?.toLowerCase() === 'suspenso');
  const irmaosDesligados = irmaos.filter(i => i.situacao?.toLowerCase() === 'desligado');
  const irmaosExcluidos = irmaos.filter(i => i.situacao?.toLowerCase() === 'excluído');
  const irmaosFalecidos = irmaos.filter(i => i.situacao?.toLowerCase() === 'falecido');
  const irmaosExOficio = irmaos.filter(i => i.situacao?.toLowerCase() === 'ex-ofício');
  const totalIrmaos = irmaos.length;

  // Contagem por grau (apenas regulares)
  const irmaosAprendiz = irmaosRegulares.filter(i => obterGrau(i) === 'Aprendiz').length;
  const irmaosCompanheiro = irmaosRegulares.filter(i => obterGrau(i) === 'Companheiro').length;
  const irmaosMestre = irmaosRegulares.filter(i => obterGrau(i) === 'Mestre').length;

  // ========================================
  // ANIVERSARIANTES
  // ========================================
  const aniversariantes = useMemo(() => {
    const hoje = new Date();
    const diaHoje = hoje.getDate();
    const mesHoje = hoje.getMonth() + 1;

    const aniversariantesHoje = [];
    const proximos7Dias = [];

    irmaos.forEach(irmao => {
      if (!irmao.data_nascimento) return;

      const dataNasc = new Date(irmao.data_nascimento + 'T00:00:00');
      const diaNasc = dataNasc.getDate();
      const mesNasc = dataNasc.getMonth() + 1;

      // Aniversariante de hoje
      if (diaNasc === diaHoje && mesNasc === mesHoje) {
        const idade = hoje.getFullYear() - dataNasc.getFullYear();
        aniversariantesHoje.push({
          ...irmao,
          idade
        });
      }

      // Próximos 7 dias
      const dataAnivEstano = new Date(hoje.getFullYear(), mesNasc - 1, diaNasc);
      
      // Se o aniversário já passou este ano, considera o próximo ano
      if (dataAnivEstano < hoje) {
        dataAnivEstano.setFullYear(hoje.getFullYear() + 1);
      }

      const diffDias = Math.ceil((dataAnivEstano - hoje) / (1000 * 60 * 60 * 24));

      if (diffDias > 0 && diffDias <= 7) {
        const idade = dataAnivEstano.getFullYear() - dataNasc.getFullYear();
        proximos7Dias.push({
          ...irmao,
          idade,
          diasRestantes: diffDias,
          dataAniversario: dataAnivEstano
        });
      }
    });

    // Ordenar próximos 7 dias por data
    proximos7Dias.sort((a, b) => a.diasRestantes - b.diasRestantes);

    return { aniversariantesHoje, proximos7Dias };
  }, [irmaos]);

  return (
    <div>
      {/* Cards de Graus */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold mb-3">Irmãos Regulares</h3>
          <p className="text-5xl font-bold mb-4">{irmaosRegulares.length}</p>
          <div className="border-t border-blue-400 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span>⬜ Aprendizes:</span>
              <span className="font-bold">{irmaosAprendiz}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>🔷 Companheiros:</span>
              <span className="font-bold">{irmaosCompanheiro}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>🔺 Mestres:</span>
              <span className="font-bold">{irmaosMestre}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold mb-2">Total Geral</h3>
          <p className="text-4xl font-bold mb-2">{totalIrmaos}</p>
          <p className="text-sm opacity-90">Todas as situações</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold mb-3">Balaustres</h3>
          <p className="text-5xl font-bold mb-4">{balaustres.length}</p>
          <div className="border-t border-purple-400 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span>⬜ Grau 1 (Aprendiz):</span>
              <span className="font-bold">{balaustres.filter(b => b.grau_sessao === 'Aprendiz').length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>🔷 Grau 2 (Companheiro):</span>
              <span className="font-bold">{balaustres.filter(b => b.grau_sessao === 'Companheiro').length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>🔺 Grau 3 (Mestre):</span>
              <span className="font-bold">{balaustres.filter(b => b.grau_sessao === 'Mestre').length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ANIVERSARIANTES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* ANIVERSARIANTES DO DIA */}
        <div className="bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">🎂 Aniversariantes do Dia</h3>
            <div className="text-4xl">🎉</div>
          </div>
          
          {aniversariantes.aniversariantesHoje.length > 0 ? (
            <div className="space-y-3">
              {aniversariantes.aniversariantesHoje.map(irmao => (
                <div 
                  key={irmao.id}
                  className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30"
                >
                  <div className="font-bold text-lg">{irmao.nome}</div>
                  <div className="text-sm opacity-90">
                    🎂 {irmao.idade} anos hoje!
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-white/10 rounded-lg">
              <div className="text-4xl mb-2">📅</div>
              <p className="text-white/80">Nenhum aniversariante hoje</p>
            </div>
          )}
        </div>

        {/* PRÓXIMOS 7 DIAS */}
        <div className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">📅 Próximos 7 Dias</h3>
            <div className="text-4xl">🎁</div>
          </div>
          
          {aniversariantes.proximos7Dias.length > 0 ? (
            <div className="space-y-3 max-h-[280px] overflow-y-auto">
              {aniversariantes.proximos7Dias.map(irmao => (
                <div 
                  key={irmao.id}
                  className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-bold text-lg">{irmao.nome}</div>
                      <div className="text-sm opacity-90">
                        🎂 Fará {irmao.idade} anos
                      </div>
                      <div className="text-sm opacity-90">
                        📆 {irmao.dataAniversario.toLocaleDateString('pt-BR', { 
                          day: '2-digit', 
                          month: 'long' 
                        })}
                      </div>
                    </div>
                    <div className="bg-white/30 rounded-full px-3 py-1 text-sm font-bold">
                      {irmao.diasRestantes} {irmao.diasRestantes === 1 ? 'dia' : 'dias'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-white/10 rounded-lg">
              <div className="text-4xl mb-2">📅</div>
              <p className="text-white/80">Nenhum aniversário nos próximos 7 dias</p>
            </div>
          )}
        </div>
      </div>

      {/* Cards de Situações */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">📋 Situação dos Irmãos</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-green-50 border-2 border-green-200 p-4 rounded-lg">
            <div className="text-green-600 text-sm font-semibold mb-1">✅ Regulares</div>
            <div className="text-3xl font-bold text-green-700">{irmaosRegulares.length}</div>
          </div>
          <div className="bg-yellow-50 border-2 border-yellow-200 p-4 rounded-lg">
            <div className="text-yellow-600 text-sm font-semibold mb-1">⚠️ Irregulares</div>
            <div className="text-3xl font-bold text-yellow-700">{irmaosIrregulares.length}</div>
          </div>
          <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg">
            <div className="text-blue-600 text-sm font-semibold mb-1">🎫 Licenciados</div>
            <div className="text-3xl font-bold text-blue-700">{irmaosLicenciados.length}</div>
          </div>
          <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-lg">
            <div className="text-orange-600 text-sm font-semibold mb-1">🚫 Suspensos</div>
            <div className="text-3xl font-bold text-orange-700">{irmaosSuspensos.length}</div>
          </div>
          <div className="bg-gray-50 border-2 border-gray-200 p-4 rounded-lg">
            <div className="text-gray-600 text-sm font-semibold mb-1">↩️ Desligados</div>
            <div className="text-3xl font-bold text-gray-700">{irmaosDesligados.length}</div>
          </div>
          <div className="bg-red-50 border-2 border-red-200 p-4 rounded-lg">
            <div className="text-red-600 text-sm font-semibold mb-1">❌ Excluídos</div>
            <div className="text-3xl font-bold text-red-700">{irmaosExcluidos.length}</div>
          </div>
          <div className="bg-purple-50 border-2 border-purple-200 p-4 rounded-lg">
            <div className="text-purple-600 text-sm font-semibold mb-1">🕊️ Falecidos</div>
            <div className="text-3xl font-bold text-purple-700">{irmaosFalecidos.length}</div>
          </div>
          <div className="bg-indigo-50 border-2 border-indigo-200 p-4 rounded-lg">
            <div className="text-indigo-600 text-sm font-semibold mb-1">👔 Ex-Ofício</div>
            <div className="text-3xl font-bold text-indigo-700">{irmaosExOficio.length}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Bem-vindo ao Sistema</h3>
        <p className="text-gray-600">
          Utilize o menu de navegação para acessar as diferentes funcionalidades do sistema.
        </p>
      </div>
    </div>
  );
};
