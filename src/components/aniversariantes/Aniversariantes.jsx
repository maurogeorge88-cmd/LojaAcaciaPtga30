import { useState, useEffect } from 'react';
import { supabase } from '../../App';

export default function Aniversariantes() {
  const [aniversariantes, setAniversariantes] = useState([]);
  const [filtro, setFiltro] = useState('hoje'); // hoje, semana, mes, todos
  const [loading, setLoading] = useState(true);
  const [notificacoes, setNotificacoes] = useState([]);
  const [mostrarNotificacoes, setMostrarNotificacoes] = useState(false);

  // Estados para usuário logado
  const [usuarioLogado, setUsuarioLogado] = useState(null);

  useEffect(() => {
    carregarUsuario();
    carregarAniversariantes();
    carregarNotificacoes();
  }, [filtro]);

  const carregarUsuario = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.log('⚠️ Erro auth:', authError);
        setUsuarioLogado(null);
        return;
      }

      if (user) {
        const { data: perfil, error: perfilError } = await supabase
          .from('usuarios')
          .select('*, irmaos(cargo)')
          .eq('email', user.email)
          .single();
        
        if (perfilError) {
          console.log('⚠️ Erro perfil:', perfilError);
          setUsuarioLogado(null);
        } else {
          setUsuarioLogado(perfil);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
      setUsuarioLogado(null);
    }
  };

  const carregarNotificacoes = async () => {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('notificacoes_aniversarios')
        .select('*, irmaos(nome, cargo)')
        .eq('data_notificacao', hoje)
        .eq('notificado', false)
        .order('nome_pessoa');

      if (error) throw error;

      setNotificacoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    }
  };

  const carregarAniversariantes = async () => {
    setLoading(true);
    try {
      const hoje = new Date();
      const aniversariantesLista = [];

      console.log('🎂 ANIVERSARIANTES: Data de hoje:', hoje.toLocaleDateString('pt-BR'));
      console.log('🎂 ANIVERSARIANTES: Filtro:', filtro);

      // Calcular datas de filtro
      let dataInicio, dataFim;
      
      if (filtro === 'hoje') {
        dataInicio = dataFim = hoje;
      } else if (filtro === 'semana') {
        dataInicio = hoje;
        dataFim = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (filtro === 'mes') {
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      }

      // 1. Buscar IRMÃOS
      try {
        const { data: irmaos, error: erroIrmaos } = await supabase
          .from('irmaos')
          .select('*, irmaos(nome)');

        console.log('🎂 ANIVERSARIANTES: Total irmãos:', irmaos?.length);
        console.log('🎂 ANIVERSARIANTES: Erro irmãos?', erroIrmaos);

        if (erroIrmaos) {
          console.error('❌ ERRO na busca de irmãos:', erroIrmaos);
        }

        if (irmaos) {
          irmaos.forEach(irmao => {
            // Pular se não tem data de nascimento
            if (!irmao.data_nascimento) return;
            
            const dataNasc = new Date(irmao.data_nascimento + 'T00:00:00');
            const proximoAniversario = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
            
            // Comparar apenas data sem horário
            const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
            if (proximoAniversario < hojeZerado) {
              proximoAniversario.setFullYear(hoje.getFullYear() + 1);
            }

            const deveMostrar = filtro === 'todos' || 
              (filtro === 'hoje' && ehHoje(proximoAniversario)) ||
              (filtro === 'semana' && proximoAniversario <= dataFim) ||
              (filtro === 'mes' && proximoAniversario.getMonth() === hoje.getMonth());

            console.log(`🎂 ${irmao.nome}: Próximo aniv: ${proximoAniversario.toLocaleDateString('pt-BR')}, Deve mostrar: ${deveMostrar}`);

            if (deveMostrar) {
              console.log('✅ ADICIONANDO:', irmao.nome);
              aniversariantesLista.push({
                tipo: 'Irmão',
                nome: irmao.nome,
                cim: irmao.cim,
                data_nascimento: irmao.data_nascimento,
                data_falecimento: irmao.data_falecimento,
                proximo_aniversario: proximoAniversario,
                idade: calcularIdade(dataNasc, irmao.data_falecimento),
                cargo: irmao.cargo,
                foto_url: irmao.foto_url,
                irmao_responsavel: irmao.nome,
                eh_falecido: !!irmao.data_falecimento
              });
            }
          });
        }
      } catch (erroIrmaos) {
        console.error('❌ EXCEÇÃO ao buscar irmãos:', erroIrmaos);
      }

      // 2. Buscar ESPOSAS
      const { data: esposas } = await supabase
        .from('esposas')
        .select('*, irmaos(nome)');

      if (esposas) {
        esposas.forEach(esposa => {
          if (!esposa.data_nascimento) return;
          const dataNasc = new Date(esposa.data_nascimento + 'T00:00:00');
          const proximoAniversario = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          // Comparar apenas data sem horário
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniversario < hojeZerado) {
            proximoAniversario.setFullYear(hoje.getFullYear() + 1);
          }

          const deveMostrar = filtro === 'todos' || 
            (filtro === 'hoje' && ehHoje(proximoAniversario)) ||
            (filtro === 'semana' && proximoAniversario <= dataFim) ||
            (filtro === 'mes' && proximoAniversario.getMonth() === hoje.getMonth());

          if (deveMostrar) {
            aniversariantesLista.push({
              tipo: 'Esposa',
              nome: esposa.nome,
              data_nascimento: esposa.data_nascimento,
              data_falecimento: esposa.data_falecimento,
              proximo_aniversario: proximoAniversario,
              idade: calcularIdade(dataNasc, esposa.data_falecimento),
              irmao_responsavel: esposa.irmaos?.nome,
              eh_falecido: !!esposa.data_falecimento
            });
          }
        });
      }

      // 3. Buscar FILHOS
      const { data: filhos } = await supabase
        .from('filhos')
        .select('*, irmaos(nome)');
        ;

      if (filhos) {
        filhos.forEach(filho => {
          if (!filho.data_nascimento) return;
          const dataNasc = new Date(filho.data_nascimento + 'T00:00:00');
          const proximoAniversario = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          // Comparar apenas data sem horário
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniversario < hojeZerado) {
            proximoAniversario.setFullYear(hoje.getFullYear() + 1);
          }

          const deveMostrar = filtro === 'todos' || 
            (filtro === 'hoje' && ehHoje(proximoAniversario)) ||
            (filtro === 'semana' && proximoAniversario <= dataFim) ||
            (filtro === 'mes' && proximoAniversario.getMonth() === hoje.getMonth());

          if (deveMostrar) {
            aniversariantesLista.push({
              tipo: 'Filho(a)',
              nome: filho.nome,
              data_nascimento: filho.data_nascimento,
              data_falecimento: filho.data_falecimento,
              proximo_aniversario: proximoAniversario,
              idade: calcularIdade(dataNasc, filho.data_falecimento),
              irmao_responsavel: filho.irmaos?.nome,
              eh_falecido: !!filho.data_falecimento
            });
          }
        });
      }

      // 4. Buscar PAIS
      const { data: pais } = await supabase
        .from('pais')
        .select('*, irmaos(nome)');
        ;

      if (pais) {
        pais.forEach(pai => {
          if (!pai.data_nascimento) return;
          const dataNasc = new Date(pai.data_nascimento + 'T00:00:00');
          const proximoAniversario = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          // Comparar apenas data sem horário
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniversario < hojeZerado) {
            proximoAniversario.setFullYear(hoje.getFullYear() + 1);
          }

          const deveMostrar = filtro === 'todos' || 
            (filtro === 'hoje' && ehHoje(proximoAniversario)) ||
            (filtro === 'semana' && proximoAniversario <= dataFim) ||
            (filtro === 'mes' && proximoAniversario.getMonth() === hoje.getMonth());

          if (deveMostrar) {
            aniversariantesLista.push({
              tipo: 'Pai',
              nome: pai.nome,
              data_nascimento: pai.data_nascimento,
              data_falecimento: pai.data_falecimento,
              proximo_aniversario: proximoAniversario,
              idade: calcularIdade(dataNasc, pai.data_falecimento),
              irmao_responsavel: pai.irmaos?.nome,
              eh_falecido: !!pai.data_falecimento
            });
          }
        });
      }

      // 5. Buscar MÃES
      const { data: maes } = await supabase
        .from('maes')
        .select('*, irmaos(nome)');
        ;

      if (maes) {
        maes.forEach(mae => {
          if (!mae.data_nascimento) return;
          const dataNasc = new Date(mae.data_nascimento + 'T00:00:00');
          const proximoAniversario = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          // Comparar apenas data sem horário
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniversario < hojeZerado) {
            proximoAniversario.setFullYear(hoje.getFullYear() + 1);
          }

          const deveMostrar = filtro === 'todos' || 
            (filtro === 'hoje' && ehHoje(proximoAniversario)) ||
            (filtro === 'semana' && proximoAniversario <= dataFim) ||
            (filtro === 'mes' && proximoAniversario.getMonth() === hoje.getMonth());

          if (deveMostrar) {
            aniversariantesLista.push({
              tipo: 'Mãe',
              nome: mae.nome,
              data_nascimento: mae.data_nascimento,
              data_falecimento: mae.data_falecimento,
              proximo_aniversario: proximoAniversario,
              idade: calcularIdade(dataNasc, mae.data_falecimento),
              irmao_responsavel: mae.irmaos?.nome,
              eh_falecido: !!mae.data_falecimento
            });
          }
        });
      }

      // Ordenar por próximo aniversário
      aniversariantesLista.sort((a, b) => a.proximo_aniversario - b.proximo_aniversario);

      console.log('🎂 ANIVERSARIANTES: Total na lista final:', aniversariantesLista.length);
      console.log('🎂 ANIVERSARIANTES: Lista:', aniversariantesLista.map(a => a.nome));

      setAniversariantes(aniversariantesLista);
      setLoading(false);
    } catch (error) {
      console.error('❌ ERRO ao carregar aniversariantes:', error);
      console.error('❌ Detalhes:', error.message, error.stack);
      setAniversariantes([]);
      setLoading(false);
    }
  };

  const ehHoje = (data) => {
    const hoje = new Date();
    return data.getDate() === hoje.getDate() && 
           data.getMonth() === hoje.getMonth() &&
           data.getFullYear() === hoje.getFullYear();
  };

  const calcularIdade = (dataNasc, dataFalecimento) => {
    const referencia = dataFalecimento ? new Date(dataFalecimento + 'T00:00:00') : new Date();
    let idade = referencia.getFullYear() - dataNasc.getFullYear();
    const mes = referencia.getMonth() - dataNasc.getMonth();
    if (mes < 0 || (mes === 0 && referencia.getDate() < dataNasc.getDate())) {
      idade--;
    }
    return idade;
  };

  const formatarData = (dataStr) => {
    const data = new Date(dataStr + 'T00:00:00');
    return data.toLocaleDateString('pt-BR');
  };

  const marcarNotificacaoLida = async (id) => {
    try {
      await supabase
        .from('notificacoes_aniversarios')
        .update({ notificado: true })
        .eq('id', id);
      
      carregarNotificacoes();
    } catch (error) {
      console.error('Erro ao marcar notificação:', error);
    }
  };

  const marcarTodasLidas = async () => {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      await supabase
        .from('notificacoes_aniversarios')
        .update({ notificado: true })
        .eq('data_notificacao', hoje)
        .eq('notificado', false);
      
      carregarNotificacoes();
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const gerarPDFSemanal = () => {
    window.print();
  };

  const gerarPDFMensal = () => {
    setFiltro('mes');
    setTimeout(() => window.print(), 500);
  };

  // Verificar se usuário deve ver notificações
  const podeVerNotificacoes = () => {
    if (!usuarioLogado) return false;
    const cargo = usuarioLogado.irmaos?.cargo;
    return usuarioLogado.tipo === 'administrador' || 
           cargo === 'Venerável' || 
           cargo === 'Chanceler' || 
           cargo === 'Secretário';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🎂 Aniversariantes</h1>
              <p className="text-gray-600 mt-1">Controle de aniversários de irmãos e familiares</p>
            </div>
            
            {/* Notificações */}
            {podeVerNotificacoes() && (
              <div className="relative">
                <button
                  onClick={() => setMostrarNotificacoes(!mostrarNotificacoes)}
                  className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full"
                >
                  🔔
                  {notificacoes.length > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {notificacoes.length}
                    </span>
                  )}
                </button>

                {/* Dropdown de Notificações */}
                {mostrarNotificacoes && (
                  <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                    <div className="p-4 border-b flex justify-between items-center">
                      <h3 className="font-bold">🎂 Aniversários Hoje</h3>
                      {notificacoes.length > 0 && (
                        <button
                          onClick={marcarTodasLidas}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Marcar todas como lidas
                        </button>
                      )}
                    </div>
                    {notificacoes.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        Nenhum aniversário hoje! 🎉
                      </div>
                    ) : (
                      notificacoes.map(not => (
                        <div key={not.id} className="p-4 border-b hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">
                                {not.eh_falecido && '💀 '}
                                {not.nome_pessoa}
                              </p>
                              <p className="text-sm text-gray-600">
                                {not.tipo === 'irmao' ? '👤 Irmão' : 
                                 not.tipo === 'esposa' ? '💑 Esposa' :
                                 not.tipo === 'filho' ? '👶 Filho(a)' :
                                 not.tipo === 'pai' ? '👨 Pai' : '👩 Mãe'}
                                {not.irmaos && ` - ${not.irmaos.nome}`}
                              </p>
                              {not.data_falecimento && (
                                <p className="text-xs text-red-600 mt-1">
                                  † {formatarData(not.data_falecimento)}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => marcarNotificacaoLida(not.id)}
                              className="text-blue-600 text-xs hover:underline"
                            >
                              ✓ Lida
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Filtros */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setFiltro('hoje')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filtro === 'hoje'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📅 Hoje
            </button>
            <button
              onClick={() => setFiltro('semana')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filtro === 'semana'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📆 Próximos 7 Dias
            </button>
            <button
              onClick={() => setFiltro('mes')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filtro === 'mes'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📊 Este Mês
            </button>
            <button
              onClick={() => setFiltro('todos')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filtro === 'todos'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📋 Todos
            </button>

            {/* Botões de PDF */}
            <div className="ml-auto flex gap-2">
              <button
                onClick={gerarPDFSemanal}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                📄 PDF Semanal
              </button>
              <button
                onClick={gerarPDFMensal}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
              >
                📄 PDF Mensal
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Aniversariantes */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando aniversariantes...</p>
          </div>
        ) : aniversariantes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">🎂</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum aniversariante</h3>
            <p className="text-gray-600">
              {filtro === 'hoje' && 'Não há aniversários hoje.'}
              {filtro === 'semana' && 'Não há aniversários nos próximos 7 dias.'}
              {filtro === 'mes' && 'Não há aniversários este mês.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {aniversariantes.map((aniv, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                {/* Header */}
                <div className={`p-4 ${
                  ehHoje(aniv.proximo_aniversario)
                    ? 'bg-gradient-to-r from-yellow-400 to-orange-500'
                    : 'bg-gradient-to-r from-blue-500 to-purple-600'
                }`}>
                  <div className="flex items-center gap-3">
                    {aniv.foto_url ? (
                      <img
                        src={aniv.foto_url}
                        alt={aniv.nome}
                        className="w-16 h-16 rounded-full border-4 border-white object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full border-4 border-white bg-white flex items-center justify-center text-3xl">
                        {aniv.tipo === 'Irmão' ? '👤' :
                         aniv.tipo === 'Esposa' ? '💑' :
                         aniv.tipo === 'Filho(a)' ? '👶' :
                         aniv.tipo === 'Pai' ? '👨' : '👩'}
                      </div>
                    )}
                    <div className="text-white flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{aniv.nome}</h3>
                        {aniv.eh_falecido && <span title="Falecido">💀</span>}
                      </div>
                      <p className="text-sm opacity-90">{aniv.tipo}</p>
                    </div>
                    {ehHoje(aniv.proximo_aniversario) && (
                      <div className="text-4xl animate-bounce">🎉</div>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-700">📅 Data:</span>
                    <span className="text-gray-900">{formatarData(aniv.data_nascimento)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-700">
                      {aniv.eh_falecido ? '💀 Idade ao falecer:' : '🎂 Idade:'}
                    </span>
                    <span className="text-gray-900">
                      {aniv.idade} {aniv.idade === 1 ? 'ano' : 'anos'}
                    </span>
                  </div>

                  {aniv.eh_falecido && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-red-700">† Falecimento:</span>
                      <span className="text-red-600">{formatarData(aniv.data_falecimento)}</span>
                    </div>
                  )}

                  {aniv.cim && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-700">🆔 CIM:</span>
                      <span className="text-gray-900">{aniv.cim}</span>
                    </div>
                  )}

                  {aniv.grau && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-700">⭐ Grau:</span>
                      <span className="text-gray-900">{aniv.grau}</span>
                    </div>
                  )}

                  {aniv.cargo && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-700">👔 Cargo:</span>
                      <span className="text-gray-900">{aniv.cargo}</span>
                    </div>
                  )}

                  {aniv.tipo !== 'Irmão' && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-700">👤 Irmão:</span>
                      <span className="text-gray-900">{aniv.irmao_responsavel}</span>
                    </div>
                  )}

                  {!aniv.eh_falecido && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-blue-700">🗓️ Próximo:</span>
                        <span className={`font-bold ${
                          ehHoje(aniv.proximo_aniversario)
                            ? 'text-orange-600'
                            : 'text-blue-600'
                        }`}>
                          {ehHoje(aniv.proximo_aniversario)
                            ? 'HOJE! 🎉'
                            : aniv.proximo_aniversario.toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
