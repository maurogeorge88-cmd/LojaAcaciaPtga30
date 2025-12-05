import { useState, useEffect } from 'react';
import { supabase } from '../App';

export function CardAniversariantesDashboard({ onVerTodos }) {
  const [aniversariantesHoje, setAniversariantesHoje] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarAniversariantesHoje();
  }, []);

  const carregarAniversariantesHoje = async () => {
    setLoading(true);
    try {
      const hoje = new Date();
      const aniversariantesLista = [];

      console.log('🎂 DEBUG: Data de hoje:', hoje.toLocaleDateString('pt-BR'));
      console.log('🎂 DEBUG: Mês:', hoje.getMonth(), 'Dia:', hoje.getDate());

      // Buscar IRMÃOS
      const { data: irmaos, error: erroIrmaos } = await supabase
        .from('irmaos')
        .select('id, cim, nome, data_nascimento, cargo, foto_url');

      console.log('🎂 DEBUG: Total irmãos:', irmaos?.length);
      console.log('🎂 DEBUG: Erro?', erroIrmaos);

      if (irmaos) {
        irmaos.forEach(irmao => {
          if (!irmao.data_nascimento) return; // Pular sem data
          const dataNasc = new Date(irmao.data_nascimento + 'T00:00:00');
          const mesNasc = dataNasc.getMonth();
          const diaNasc = dataNasc.getDate();
          
          console.log(`🎂 ${irmao.nome}: ${diaNasc}/${mesNasc + 1} - Hoje: ${hoje.getDate()}/${hoje.getMonth() + 1}`);
          
          if (mesNasc === hoje.getMonth() && diaNasc === hoje.getDate()) {
            console.log('✅ ANIVERSARIANTE HOJE:', irmao.nome);
            aniversariantesLista.push({
              tipo: 'Irmão',
              nome: irmao.nome,
              cim: irmao.cim,
              data_nascimento: irmao.data_nascimento,
              idade: calcularIdade(dataNasc),
              cargo: irmao.cargo,
              foto_url: irmao.foto_url
            });
          }
        });
      }

      console.log('🎂 DEBUG: Aniversariantes encontrados:', aniversariantesLista.length);

      // Buscar ESPOSAS
      const { data: esposas } = await supabase
        .from('esposas')
        .select('*, irmaos(nome)')
        ;

      if (esposas) {
        esposas.forEach(esposa => {
          if (!esposa.data_nascimento) return;
          const dataNasc = new Date(esposa.data_nascimento + 'T00:00:00');
          if (dataNasc.getMonth() === hoje.getMonth() && dataNasc.getDate() === hoje.getDate()) {
            aniversariantesLista.push({
              tipo: 'Esposa',
              nome: esposa.nome,
              idade: calcularIdade(dataNasc),
              irmao_responsavel: esposa.irmaos?.nome
            });
          }
        });
      }

      // Buscar FILHOS
      const { data: filhos } = await supabase
        .from('filhos')
        .select('*, irmaos(nome)')
        ;

      if (filhos) {
        filhos.forEach(filho => {
          if (!filho.data_nascimento) return;
          const dataNasc = new Date(filho.data_nascimento + 'T00:00:00');
          if (dataNasc.getMonth() === hoje.getMonth() && dataNasc.getDate() === hoje.getDate()) {
            aniversariantesLista.push({
              tipo: 'Filho(a)',
              nome: filho.nome,
              idade: calcularIdade(dataNasc),
              irmao_responsavel: filho.irmaos?.nome
            });
          }
        });
      }

      // Buscar PAIS
      const { data: pais } = await supabase
        .from('pais')
        .select('*, irmaos(nome)')
        ;

      if (pais) {
        pais.forEach(pai => {
          if (!pai.data_nascimento) return;
          const dataNasc = new Date(pai.data_nascimento + 'T00:00:00');
          if (dataNasc.getMonth() === hoje.getMonth() && dataNasc.getDate() === hoje.getDate()) {
            aniversariantesLista.push({
              tipo: 'Pai',
              nome: pai.nome,
              idade: calcularIdade(dataNasc),
              irmao_responsavel: pai.irmaos?.nome
            });
          }
        });
      }

      // Buscar MÃES
      const { data: maes } = await supabase
        .from('maes')
        .select('*, irmaos(nome)')
        ;

      if (maes) {
        maes.forEach(mae => {
          if (!mae.data_nascimento) return;
          const dataNasc = new Date(mae.data_nascimento + 'T00:00:00');
          if (dataNasc.getMonth() === hoje.getMonth() && dataNasc.getDate() === hoje.getDate()) {
            aniversariantesLista.push({
              tipo: 'Mãe',
              nome: mae.nome,
              idade: calcularIdade(dataNasc),
              irmao_responsavel: mae.irmaos?.nome
            });
          }
        });
      }

      setAniversariantesHoje(aniversariantesLista);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar aniversariantes:', error);
      setLoading(false);
    }
  };

  const calcularIdade = (dataNasc) => {
    const hoje = new Date();
    let idade = hoje.getFullYear() - dataNasc.getFullYear();
    const m = hoje.getMonth() - dataNasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < dataNasc.getDate())) {
      idade--;
    }
    return idade;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          🎂 Aniversariantes Hoje
        </h3>
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-md p-6 border-2 border-yellow-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          🎂 Aniversariantes Hoje
        </h3>
        <button
          onClick={onVerTodos}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Ver todos →
        </button>
      </div>

      {aniversariantesHoje.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-5xl mb-3">🎂</div>
          <p className="text-gray-600 font-medium">Nenhum aniversariante hoje</p>
          <p className="text-sm text-gray-500 mt-1">Aproveite o dia!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {aniversariantesHoje.map((aniv, index) => (
            <div
              key={index}
              className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-yellow-400 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                {aniv.foto_url ? (
                  <img
                    src={aniv.foto_url}
                    alt={aniv.nome}
                    className="w-12 h-12 rounded-full object-cover border-2 border-yellow-400"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-2xl border-2 border-yellow-400">
                    {aniv.tipo === 'Irmão' ? '👤' :
                     aniv.tipo === 'Esposa' ? '💑' :
                     aniv.tipo === 'Filho(a)' ? '👶' :
                     aniv.tipo === 'Pai' ? '👨' : '👩'}
                  </div>
                )}
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900">{aniv.nome}</p>
                    <span className="text-2xl animate-bounce">🎉</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {aniv.tipo} - {aniv.idade} anos
                  </p>
                  {aniv.cim && (
                    <p className="text-xs text-gray-500">CIM: {aniv.cim}</p>
                  )}
                  {aniv.grau && (
                    <p className="text-xs text-gray-500">Grau: {aniv.grau}</p>
                  )}
                  {aniv.cargo && (
                    <p className="text-xs text-blue-600 font-medium">{aniv.cargo}</p>
                  )}
                  {aniv.irmao_responsavel && (
                    <p className="text-xs text-gray-500">Irmão: {aniv.irmao_responsavel}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {aniversariantesHoje.length > 3 && (
            <button
              onClick={onVerTodos}
              className="w-full py-2 text-center text-blue-600 hover:text-blue-800 font-medium text-sm"
            >
              Ver todos os {aniversariantesHoje.length} aniversariantes →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
