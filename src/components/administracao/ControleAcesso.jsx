/**
 * COMPONENTE CONTROLE DE ACESSO E LOGS
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 * 
 * FUNCIONALIDADES:
 * - Visualizar histórico de acesso ao sistema
 * - Filtrar por usuário, ação, data
 * - Excluir logs individuais ou em massa
 * - Exportar relatórios
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function ControleAcesso({ userData, showSuccess, showError }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    usuario: '',
    acao: '',
    dataInicio: '',
    dataFim: '',
    busca: ''
  });
  const [logsSelecionados, setLogsSelecionados] = useState([]);
  const [todosLogs, setTodosLogs] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [estatisticas, setEstatisticas] = useState({
    totalAcessos: 0,
    usuariosAtivos: 0,
    acoesHoje: 0
  });

  // Carregar logs e usuários
  useEffect(() => {
    carregarDados();
  }, [filtros]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Carregar usuários para o filtro
      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('id, nome, email')
        .order('nome');
      
      if (usuariosData) {
        setUsuarios(usuariosData);
      }

      // Construir query de logs (SEM JOIN para evitar erros)
      let query = supabase
        .from('logs_acesso')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      // Aplicar filtros
      if (filtros.usuario) {
        query = query.eq('usuario_id', filtros.usuario);
      }
      if (filtros.acao) {
        query = query.eq('acao', filtros.acao);
      }
      if (filtros.dataInicio) {
        query = query.gte('created_at', `${filtros.dataInicio}T00:00:00`);
      }
      if (filtros.dataFim) {
        query = query.lte('created_at', `${filtros.dataFim}T23:59:59`);
      }
      if (filtros.busca) {
        query = query.or(`detalhes.ilike.%${filtros.busca}%,ip.ilike.%${filtros.busca}%`);
      }

      const { data: logsData, error } = await query;

      if (error) throw error;

      // Buscar nomes dos usuários separadamente
      let logsComNomes = logsData || [];
      
      if (logsComNomes.length > 0) {
        const usuarioIds = [...new Set(logsComNomes.map(log => log.usuario_id).filter(Boolean))];
        
        if (usuarioIds.length > 0) {
          try {
            const { data: usuariosData, error: usuariosError } = await supabase
              .from('usuarios')
              .select('id, nome, email')
              .in('id', usuarioIds);
            
            if (usuariosError) {
              console.error('Erro ao buscar usuários:', usuariosError);
            }
            
            // Mapear nomes aos logs
            logsComNomes = logsComNomes.map(log => ({
              ...log,
              usuario: usuariosData?.find(u => u.id === log.usuario_id) || { 
                nome: 'Usuário não encontrado',
                email: log.usuario_id 
              }
            }));
          } catch (err) {
            console.error('Erro ao mapear usuários:', err);
            // Continua com logs sem nomes de usuários
            logsComNomes = logsComNomes.map(log => ({
              ...log,
              usuario: { 
                nome: 'Erro ao carregar',
                email: log.usuario_id 
              }
            }));
          }
        }
      }

      setLogs(logsComNomes);

      // Calcular estatísticas
      calcularEstatisticas(logsComNomes);

    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      showError?.('Erro ao carregar logs de acesso');
    } finally {
      setLoading(false);
    }
  };

  const calcularEstatisticas = (logsData) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const acoesHoje = logsData.filter(log => {
      const dataLog = new Date(log.created_at);
      dataLog.setHours(0, 0, 0, 0);
      return dataLog.getTime() === hoje.getTime();
    }).length;

    const usuariosUnicos = new Set(logsData.map(log => log.usuario_id)).size;

    setEstatisticas({
      totalAcessos: logsData.length,
      usuariosAtivos: usuariosUnicos,
      acoesHoje
    });
  };

  // Selecionar/desselecionar log
  const toggleSelecionarLog = (logId) => {
    setLogsSelecionados(prev => {
      if (prev.includes(logId)) {
        return prev.filter(id => id !== logId);
      } else {
        return [...prev, logId];
      }
    });
  };

  // Selecionar todos os logs
  const toggleSelecionarTodos = () => {
    if (todosLogs) {
      setLogsSelecionados([]);
      setTodosLogs(false);
    } else {
      setLogsSelecionados(logs.map(log => log.id));
      setTodosLogs(true);
    }
  };

  // Excluir log individual
  const excluirLog = async (logId) => {
    if (!confirm('Tem certeza que deseja excluir este log?')) return;

    try {
      const { error } = await supabase
        .from('logs_acesso')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      showSuccess?.('Log excluído com sucesso');
      carregarDados();
      setLogsSelecionados(prev => prev.filter(id => id !== logId));
    } catch (error) {
      console.error('Erro ao excluir log:', error);
      showError?.('Erro ao excluir log');
    }
  };

  // Excluir logs selecionados
  const excluirSelecionados = async () => {
    if (logsSelecionados.length === 0) {
      showError?.('Nenhum log selecionado');
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir ${logsSelecionados.length} log(s)?`)) return;

    try {
      const { error } = await supabase
        .from('logs_acesso')
        .delete()
        .in('id', logsSelecionados);

      if (error) throw error;

      showSuccess?.(`${logsSelecionados.length} log(s) excluído(s) com sucesso`);
      setLogsSelecionados([]);
      setTodosLogs(false);
      carregarDados();
    } catch (error) {
      console.error('Erro ao excluir logs:', error);
      showError?.('Erro ao excluir logs selecionados');
    }
  };

  // Limpar todos os logs
  const limparTodosLogs = async () => {
    if (!confirm('⚠️ ATENÇÃO: Isso excluirá TODOS os logs do sistema. Esta ação não pode ser desfeita. Continuar?')) return;
    if (!confirm('Confirmação final: Você tem certeza absoluta que deseja excluir TODOS os logs?')) return;

    try {
      const { error } = await supabase
        .from('logs_acesso')
        .delete()
        .neq('id', 0); // Truque para deletar tudo

      if (error) throw error;

      showSuccess?.('Todos os logs foram excluídos');
      setLogsSelecionados([]);
      setTodosLogs(false);
      carregarDados();
    } catch (error) {
      console.error('Erro ao limpar logs:', error);
      showError?.('Erro ao limpar todos os logs');
    }
  };

  // Formatar data/hora
  const formatarDataHora = (dataISO) => {
    if (!dataISO) return '-';
    const data = new Date(dataISO);
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Obter cor da ação
  const getCorAcao = (acao) => {
    const cores = {
      'login': 'bg-green-100 text-green-800 border-green-300',
      'logout': 'bg-gray-100 text-gray-800 border-gray-300',
      'criar': 'bg-blue-100 text-blue-800 border-blue-300',
      'editar': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'excluir': 'bg-red-100 text-red-800 border-red-300',
      'visualizar': 'bg-purple-100 text-purple-800 border-purple-300',
      'exportar': 'bg-indigo-100 text-indigo-800 border-indigo-300'
    };
    return cores[acao] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  // Obter ícone da ação
  const getIconeAcao = (acao) => {
    const icones = {
      'login': '🔓',
      'logout': '🔒',
      'criar': '➕',
      'editar': '✏️',
      'excluir': '🗑️',
      'visualizar': '👁️',
      'exportar': '📥'
    };
    return icones[acao] || '📋';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="spinner" style={{ margin: '0 auto', marginBottom: '1rem' }}></div>
          <p style={{ color: 'var(--color-text-muted)' }}>Carregando logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto" style={{ background: 'transparent' }}>
      {/* Cabeçalho */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>🔐 Controle de Acesso</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>Visualize e gerencie o histórico de acesso ao sistema</p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div style={{
          background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ opacity: 0.9 }}>Total de Acessos</p>
              <p className="text-3xl font-bold">{estatisticas.totalAcessos}</p>
            </div>
            <div className="text-4xl" style={{ opacity: 0.8 }}>📊</div>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, var(--color-success), var(--color-success-hover))',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ opacity: 0.9 }}>Usuários Ativos</p>
              <p className="text-3xl font-bold">{estatisticas.usuariosAtivos}</p>
            </div>
            <div className="text-4xl" style={{ opacity: 0.8 }}>👥</div>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, var(--color-warning), var(--color-warning-hover))',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ opacity: 0.9 }}>Ações Hoje</p>
              <p className="text-3xl font-bold">{estatisticas.acoesHoje}</p>
            </div>
            <div className="text-4xl" style={{ opacity: 0.8 }}>⚡</div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>🔍 Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="form-label">Usuário</label>
            <select
              value={filtros.usuario}
              onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })}
              className="form-input"
              style={{ cursor: 'pointer' }}
            >
              <option value="">Todos os usuários</option>
              {usuarios.map(user => (
                <option key={user.id} value={user.id}>{user.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Ação</label>
            <select
              value={filtros.acao}
              onChange={(e) => setFiltros({ ...filtros, acao: e.target.value })}
              className="form-input"
              style={{ cursor: 'pointer' }}
            >
              <option value="">Todas as ações</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="criar">Criar</option>
              <option value="editar">Editar</option>
              <option value="excluir">Excluir</option>
              <option value="visualizar">Visualizar</option>
              <option value="exportar">Exportar</option>
            </select>
          </div>

          <div>
            <label className="form-label">Data Início</label>
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Data Fim</label>
            <input
              type="date"
              value={filtros.dataFim}
              onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Buscar</label>
            <input
              type="text"
              value={filtros.busca}
              onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
              placeholder="IP, detalhes..."
              className="form-input"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setFiltros({
              usuario: '',
              acao: '',
              dataInicio: '',
              dataFim: '',
              busca: ''
            })}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition"
          >
            🔄 Limpar Filtros
          </button>
        </div>
      </div>

      {/* Ações em massa */}
      {logsSelecionados.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <p className="text-blue-800 font-medium">
              {logsSelecionados.length} log(s) selecionado(s)
            </p>
            <div className="flex gap-2">
              <button
                onClick={excluirSelecionados}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition flex items-center gap-2"
              >
                <span>🗑️</span>
                <span>Excluir Selecionados</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabela de Logs */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={todosLogs}
              onChange={toggleSelecionarTodos}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <h3 className="text-lg font-semibold text-gray-700">
              Histórico de Acesso ({logs.length} registros)
            </h3>
          </div>
          <button
            onClick={limparTodosLogs}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center gap-2 text-sm"
          >
            <span>⚠️</span>
            <span>Limpar Todos os Logs</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={todosLogs}
                    onChange={toggleSelecionarTodos}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data/Hora
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ação
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Detalhes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Navegador
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <span className="text-4xl mb-2">📋</span>
                      <p>Nenhum log encontrado</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={logsSelecionados.includes(log.id)}
                        onChange={() => toggleSelecionarLog(log.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-900">
                      {formatarDataHora(log.created_at)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="text-xs font-medium text-gray-900">
                        {log.usuario?.nome || 'Usuário Desconhecido'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {log.usuario?.email || '-'}
                      </div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getCorAcao(log.acao)}`}>
                        <span className="text-xs">{getIconeAcao(log.acao)}</span>
                        <span className="text-xs">{log.acao?.toUpperCase()}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-900 max-w-md">
                      <div className="break-words line-clamp-2">
                        {log.detalhes || '-'}
                      </div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-500 font-mono">
                      {log.ip || '-'}
                    </td>
                    <td className="px-2 py-3 text-xs text-gray-500 max-w-xs">
                      <div className="truncate" title={log.user_agent || '-'}>
                        {log.user_agent?.substring(0, 30) || '-'}...
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm">
                      <button
                        onClick={() => excluirLog(log.id)}
                        className="text-red-600 hover:text-red-800 font-medium"
                        title="Excluir log"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Informações adicionais */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">ℹ️ Informações</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Os logs são registrados automaticamente para todas as ações no sistema</li>
          <li>• Use os filtros para encontrar logs específicos</li>
          <li>• Selecione múltiplos logs para excluí-los em massa</li>
          <li>• A exclusão de logs é permanente e não pode ser desfeita</li>
          <li>• Logs mais antigos são exibidos primeiro (limite de 1000 registros)</li>
        </ul>
      </div>
    </div>
  );
}
