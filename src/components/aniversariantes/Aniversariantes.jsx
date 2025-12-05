import { useState, useEffect } from 'react';
import { supabase } from '../../App';

export default function Aniversariantes() {
  const [aniversariantes, setAniversariantes] = useState([]);
  const [filtro, setFiltro] = useState('hoje');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarAniversariantes();
  }, [filtro]);

  const carregarAniversariantes = async () => {
    setLoading(true);
    try {
      const hoje = new Date();
      const aniversariantesLista = [];

      console.log('🎂 Carregando irmãos...');

      // Buscar APENAS IRMÃOS
      const { data: irmaos, error } = await supabase
        .from('irmaos')
        .select('id, cim, nome, data_nascimento, cargo, foto_url');

      console.log('✅ Irmãos carregados:', irmaos?.length);
      console.log('❌ Erro?', error);

      if (irmaos) {
        irmaos.forEach(irmao => {
          if (!irmao.data_nascimento) return;

          const dataNasc = new Date(irmao.data_nascimento + 'T00:00:00');
          const proximoAniv = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) {
            proximoAniv.setFullYear(hoje.getFullYear() + 1);
          }

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                        proximoAniv.getMonth() === hoje.getMonth() &&
                        proximoAniv.getFullYear() === hoje.getFullYear();

          const deveMostrar = filtro === 'todos' || 
            (filtro === 'hoje' && ehHoje) ||
            (filtro === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtro === 'mes' && proximoAniv.getMonth() === hoje.getMonth());

          if (deveMostrar) {
            const idade = hoje.getFullYear() - dataNasc.getFullYear();
            aniversariantesLista.push({
              tipo: 'Irmão',
              nome: irmao.nome,
              cim: irmao.cim,
              proximo_aniversario: proximoAniv,
              idade,
              cargo: irmao.cargo,
              foto_url: irmao.foto_url
            });
          }
        });
      }

      // ESPOSAS
      console.log('🎂 Carregando esposas...');
      const { data: esposas } = await supabase
        .from('esposas')
        .select('nome, data_nascimento, irmaos(nome)');

      console.log('✅ Esposas:', esposas?.length);

      if (esposas) {
        esposas.forEach(esposa => {
          if (!esposa.data_nascimento) return;

          const dataNasc = new Date(esposa.data_nascimento + 'T00:00:00');
          const proximoAniv = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) {
            proximoAniv.setFullYear(hoje.getFullYear() + 1);
          }

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                        proximoAniv.getMonth() === hoje.getMonth() &&
                        proximoAniv.getFullYear() === hoje.getFullYear();

          const deveMostrar = filtro === 'todos' || 
            (filtro === 'hoje' && ehHoje) ||
            (filtro === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtro === 'mes' && proximoAniv.getMonth() === hoje.getMonth());

          if (deveMostrar) {
            const idade = hoje.getFullYear() - dataNasc.getFullYear();
            aniversariantesLista.push({
              tipo: 'Esposa',
              nome: esposa.nome,
              proximo_aniversario: proximoAniv,
              idade,
              irmao_responsavel: esposa.irmaos?.nome
            });
          }
        });
      }

      // FILHOS
      console.log('🎂 Carregando filhos...');
      const { data: filhos } = await supabase
        .from('filhos')
        .select('nome, data_nascimento, irmaos(nome)');

      console.log('✅ Filhos:', filhos?.length);

      if (filhos) {
        filhos.forEach(filho => {
          if (!filho.data_nascimento) return;

          const dataNasc = new Date(filho.data_nascimento + 'T00:00:00');
          const proximoAniv = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) {
            proximoAniv.setFullYear(hoje.getFullYear() + 1);
          }

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                        proximoAniv.getMonth() === hoje.getMonth() &&
                        proximoAniv.getFullYear() === hoje.getFullYear();

          const deveMostrar = filtro === 'todos' || 
            (filtro === 'hoje' && ehHoje) ||
            (filtro === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtro === 'mes' && proximoAniv.getMonth() === hoje.getMonth());

          if (deveMostrar) {
            const idade = hoje.getFullYear() - dataNasc.getFullYear();
            aniversariantesLista.push({
              tipo: 'Filho(a)',
              nome: filho.nome,
              proximo_aniversario: proximoAniv,
              idade,
              irmao_responsavel: filho.irmaos?.nome
            });
          }
        });
      }

      aniversariantesLista.sort((a, b) => a.proximo_aniversario - b.proximo_aniversario);
      console.log('🎂 Total:', aniversariantesLista.length);

      setAniversariantes(aniversariantesLista);
      setLoading(false);
    } catch (error) {
      console.error('❌ ERRO:', error);
      setAniversariantes([]);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">🎂 Aniversariantes</h2>
        
        <div className="flex gap-2 mb-6">
          <button onClick={() => setFiltro('hoje')} className={`px-4 py-2 rounded ${filtro === 'hoje' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Hoje</button>
          <button onClick={() => setFiltro('semana')} className={`px-4 py-2 rounded ${filtro === 'semana' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Próximos 7 Dias</button>
          <button onClick={() => setFiltro('mes')} className={`px-4 py-2 rounded ${filtro === 'mes' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Este Mês</button>
          <button onClick={() => setFiltro('todos')} className={`px-4 py-2 rounded ${filtro === 'todos' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Todos</button>
        </div>

        {aniversariantes.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎂</div>
            <p className="text-gray-600 text-lg">Nenhum aniversariante encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aniversariantes.map((aniv, index) => (
              <div key={index} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border-l-4 border-blue-500">
                <div className="flex items-center gap-3">
                  {aniv.foto_url ? (
                    <img src={aniv.foto_url} alt={aniv.nome} className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-200 flex items-center justify-center text-3xl">
                      {aniv.tipo === 'Irmão' ? '👤' : aniv.tipo === 'Esposa' ? '💑' : '👶'}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-gray-900">{aniv.nome}</h3>
                      {aniv.proximo_aniversario.toDateString() === new Date().toDateString() && (
                        <span className="text-2xl animate-bounce">🎉</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{aniv.tipo} - {aniv.idade} anos</p>
                    {aniv.cim && <p className="text-xs text-gray-500">CIM: {aniv.cim}</p>}
                    {aniv.cargo && <p className="text-xs text-blue-600 font-medium">{aniv.cargo}</p>}
                    {aniv.irmao_responsavel && <p className="text-xs text-gray-500">Irmão: {aniv.irmao_responsavel}</p>}
                    <p className="text-xs text-gray-500 mt-1">
                      📅 {aniv.proximo_aniversario.toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
