/**
 * COMPONENTE GERENCIAR USUÁRIOS - VERSÃO MELHORADA
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 * 
 * MELHORIAS:
 * - Senha definida pelo admin (sem email)
 * - Permissões customizáveis por usuário
 * - Reset de senha simples
 */

import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';

export default function Usuarios({ usuarios, userData, onUpdate, showSuccess, showError }) {
  const [usuarioForm, setUsuarioForm] = useState({
    nome: '',
    email: '',
    senha: '',
    cargo: 'irmao',
    ativo: true,
    // Permissões customizáveis
    pode_editar_cadastros: false,
    pode_visualizar_financeiro: false,
    pode_editar_financeiro: false,
    pode_gerenciar_usuarios: false
  });

  const [modoEdicao, setModoEdicao] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [resetandoSenha, setResetandoSenha] = useState(null);

  // Sugestões de permissões por cargo (não fixas!)
  const SUGESTOES_PERMISSOES = {
    'irmao': {
      pode_editar_cadastros: false,
      pode_visualizar_financeiro: false,
      pode_editar_financeiro: false,
      pode_gerenciar_usuarios: false
    },
    'secretario': {
      pode_editar_cadastros: true,
      pode_visualizar_financeiro: true,
      pode_editar_financeiro: false,
      pode_gerenciar_usuarios: false
    },
    'tesoureiro': {
      pode_editar_cadastros: false,
      pode_visualizar_financeiro: true,
      pode_editar_financeiro: true,
      pode_gerenciar_usuarios: false
    },
    'chanceler': {
      pode_editar_cadastros: true,
      pode_visualizar_financeiro: true,
      pode_editar_financeiro: false,
      pode_gerenciar_usuarios: false
    },
    'veneravel': {
      pode_editar_cadastros: true,
      pode_visualizar_financeiro: true,
      pode_editar_financeiro: true,
      pode_gerenciar_usuarios: true
    },
    'administrador': {
      pode_editar_cadastros: true,
      pode_visualizar_financeiro: true,
      pode_editar_financeiro: true,
      pode_gerenciar_usuarios: true
    }
  };

  const aplicarSugestaoPermissoes = (cargo) => {
    const sugestao = SUGESTOES_PERMISSOES[cargo] || SUGESTOES_PERMISSOES['irmao'];
    setUsuarioForm(prev => ({
      ...prev,
      ...sugestao
    }));
  };

  const limparFormulario = () => {
    setUsuarioForm({
      nome: '',
      email: '',
      senha: '',
      cargo: 'irmao',
      ativo: true,
      pode_editar_cadastros: false,
      pode_visualizar_financeiro: false,
      pode_editar_financeiro: false,
      pode_gerenciar_usuarios: false
    });
    setModoEdicao(false);
    setUsuarioEditando(null);
  };

  const gerarSenhaAleatoria = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let senha = '';
    for (let i = 0; i < 12; i++) {
      senha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setUsuarioForm(prev => ({ ...prev, senha }));
    setMostrarSenha(true);
  };

  const handleCriarUsuario = async (e) => {
    e.preventDefault();
    
    if (!usuarioForm.senha || usuarioForm.senha.length < 6) {
      showError('❌ Senha deve ter no mínimo 6 caracteres!');
      return;
    }

    setLoading(true);

    try {
      // 1. Criar usuário no Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: usuarioForm.email,
        password: usuarioForm.senha,
        email_confirm: true, // Confirma email automaticamente
        user_metadata: {
          nome: usuarioForm.nome
        }
      });

      if (authError) throw authError;

      // 2. Inserir na tabela usuarios com permissões
      const { error: dbError } = await supabase
        .from('usuarios')
        .insert([{
          email: usuarioForm.email,
          nome: usuarioForm.nome,
          cargo: usuarioForm.cargo,
          ativo: usuarioForm.ativo,
          pode_editar_cadastros: usuarioForm.pode_editar_cadastros,
          pode_visualizar_financeiro: usuarioForm.pode_visualizar_financeiro,
          pode_editar_financeiro: usuarioForm.pode_editar_financeiro,
          pode_gerenciar_usuarios: usuarioForm.pode_gerenciar_usuarios
        }]);

      if (dbError) throw dbError;

      showSuccess(`✅ Usuário criado! Email: ${usuarioForm.email} | Senha: ${usuarioForm.senha}`);
      onUpdate();
      limparFormulario();

    } catch (error) {
      console.error('❌ Erro:', error);
      if (error.message.includes('admin')) {
        showError('❌ Erro: Você precisa de privilégios de administrador no Supabase. Use o método alternativo.');
      } else {
        showError('❌ Erro: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAtualizarUsuario = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Atualizar dados na tabela usuarios
      const { error } = await supabase
        .from('usuarios')
        .update({
          nome: usuarioForm.nome,
          cargo: usuarioForm.cargo,
          ativo: usuarioForm.ativo,
          pode_editar_cadastros: usuarioForm.pode_editar_cadastros,
          pode_visualizar_financeiro: usuarioForm.pode_visualizar_financeiro,
          pode_editar_financeiro: usuarioForm.pode_editar_financeiro,
          pode_gerenciar_usuarios: usuarioForm.pode_gerenciar_usuarios
        })
        .eq('id', usuarioEditando.id);

      if (error) throw error;

      showSuccess('✅ Usuário atualizado com sucesso!');
      onUpdate();
      limparFormulario();

    } catch (error) {
      console.error('❌ Erro:', error);
      showError('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetarSenha = async (usuario) => {
    const novaSenha = prompt(`Digite a nova senha para ${usuario.nome}:\n(Mínimo 6 caracteres)`);
    
    if (!novaSenha) return;
    if (novaSenha.length < 6) {
      showError('❌ Senha deve ter no mínimo 6 caracteres!');
      return;
    }

    setResetandoSenha(usuario.id);

    try {
      // Tentar resetar senha via admin API
      const { error } = await supabase.auth.admin.updateUserById(
        usuario.auth_user_id,
        { password: novaSenha }
      );

      if (error) throw error;

      showSuccess(`✅ Senha resetada! Nova senha: ${novaSenha}`);

    } catch (error) {
      console.error('❌ Erro:', error);
      showError('❌ Não foi possível resetar a senha. Use o método manual.');
    } finally {
      setResetandoSenha(null);
    }
  };

  const handleEditarUsuario = (usuario) => {
    setModoEdicao(true);
    setUsuarioEditando(usuario);
    setUsuarioForm({
      nome: usuario.nome,
      email: usuario.email,
      senha: '',
      cargo: usuario.cargo,
      ativo: usuario.ativo,
      pode_editar_cadastros: usuario.pode_editar_cadastros || false,
      pode_visualizar_financeiro: usuario.pode_visualizar_financeiro || false,
      pode_editar_financeiro: usuario.pode_editar_financeiro || false,
      pode_gerenciar_usuarios: usuario.pode_gerenciar_usuarios || false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExcluirUsuario = async (usuario) => {
    if (!window.confirm(`❗ Tem certeza que deseja excluir o usuário ${usuario.nome}?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', usuario.id);

      if (error) throw error;

      showSuccess('✅ Usuário excluído!');
      onUpdate();

    } catch (error) {
      console.error('❌ Erro:', error);
      showError('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* FORMULÁRIO */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          {modoEdicao ? '✏️ Editar Usuário' : '➕ Novo Usuário'}
        </h3>

        <form onSubmit={modoEdicao ? handleAtualizarUsuario : handleCriarUsuario} className="space-y-4">
          {/* Nome e Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                value={usuarioForm.nome}
                onChange={(e) => setUsuarioForm({ ...usuarioForm, nome: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="João da Silva"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                disabled={modoEdicao}
                value={usuarioForm.email}
                onChange={(e) => setUsuarioForm({ ...usuarioForm, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                placeholder="joao@email.com"
              />
            </div>
          </div>

          {/* Senha (apenas criação) */}
          {!modoEdicao && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha * (mínimo 6 caracteres)
              </label>
              <div className="flex gap-2">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  required
                  value={usuarioForm.senha}
                  onChange={(e) => setUsuarioForm({ ...usuarioForm, senha: e.target.value })}
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Digite uma senha"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
                >
                  {mostrarSenha ? '🙈' : '👁️'}
                </button>
                <button
                  type="button"
                  onClick={gerarSenhaAleatoria}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition"
                >
                  🎲 Gerar
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                💡 Copie a senha antes de criar o usuário!
              </p>
            </div>
          )}

          {/* Cargo e Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cargo *
              </label>
              <select
                value={usuarioForm.cargo}
                onChange={(e) => {
                  setUsuarioForm({ ...usuarioForm, cargo: e.target.value });
                  if (!modoEdicao) {
                    aplicarSugestaoPermissoes(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="irmao">Irmão</option>
                <option value="secretario">Secretário</option>
                <option value="tesoureiro">Tesoureiro</option>
                <option value="chanceler">Chanceler</option>
                <option value="veneravel">Venerável</option>
                <option value="administrador">Administrador</option>
              </select>
              {!modoEdicao && (
                <p className="text-xs text-blue-600 mt-1">
                  💡 Permissões são aplicadas automaticamente
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={usuarioForm.ativo}
                onChange={(e) => setUsuarioForm({ ...usuarioForm, ativo: e.target.value === 'true' })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="true">✅ Ativo</option>
                <option value="false">🚫 Inativo</option>
              </select>
            </div>
          </div>

          {/* PERMISSÕES CUSTOMIZÁVEIS */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              🔐 Permissões (customize conforme necessário)
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={usuarioForm.pode_editar_cadastros}
                  onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_editar_cadastros: e.target.checked })}
                  className="w-4 h-4"
                />
                <div>
                  <span className="font-medium text-gray-900">✏️ Editar Cadastros</span>
                  <p className="text-xs text-gray-600">Cadastrar e editar irmãos</p>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={usuarioForm.pode_visualizar_financeiro}
                  onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_visualizar_financeiro: e.target.checked })}
                  className="w-4 h-4"
                />
                <div>
                  <span className="font-medium text-gray-900">👁️ Ver Finanças</span>
                  <p className="text-xs text-gray-600">Visualizar lançamentos</p>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={usuarioForm.pode_editar_financeiro}
                  onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_editar_financeiro: e.target.checked })}
                  className="w-4 h-4"
                />
                <div>
                  <span className="font-medium text-gray-900">💰 Editar Finanças</span>
                  <p className="text-xs text-gray-600">Criar/editar lançamentos</p>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={usuarioForm.pode_gerenciar_usuarios}
                  onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_gerenciar_usuarios: e.target.checked })}
                  className="w-4 h-4"
                />
                <div>
                  <span className="font-medium text-gray-900">👥 Gerenciar Usuários</span>
                  <p className="text-xs text-gray-600">Criar/editar usuários</p>
                </div>
              </label>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-2 justify-end pt-4">
            {modoEdicao && (
              <button
                type="button"
                onClick={limparFormulario}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Salvando...' : (modoEdicao ? '💾 Atualizar' : '➕ Criar Usuário')}
            </button>
          </div>
        </form>
      </div>

      {/* LISTA DE USUÁRIOS */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          👥 Usuários Cadastrados ({usuarios?.length || 0})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold">Nome</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Email</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Cargo</th>
                <th className="px-4 py-2 text-center text-sm font-semibold">Permissões</th>
                <th className="px-4 py-2 text-center text-sm font-semibold">Status</th>
                <th className="px-4 py-2 text-center text-sm font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios?.map((usuario) => (
                <tr key={usuario.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{usuario.nome}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {usuario.email}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {usuario.cargo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {usuario.pode_editar_cadastros && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">✏️</span>
                      )}
                      {usuario.pode_visualizar_financeiro && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">👁️</span>
                      )}
                      {usuario.pode_editar_financeiro && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">💰</span>
                      )}
                      {usuario.pode_gerenciar_usuarios && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">👥</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {usuario.ativo ? (
                      <span className="text-green-600">✅</span>
                    ) : (
                      <span className="text-red-600">🚫</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleEditarUsuario(usuario)}
                        className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm rounded transition"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleResetarSenha(usuario)}
                        disabled={resetandoSenha === usuario.id}
                        className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-sm rounded transition disabled:opacity-50"
                        title="Resetar Senha"
                      >
                        🔑
                      </button>
                      <button
                        onClick={() => handleExcluirUsuario(usuario)}
                        className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-sm rounded transition"
                        title="Excluir"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {usuarios?.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum usuário cadastrado ainda.
          </div>
        )}
      </div>

      {/* LEGENDA */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Sobre Permissões</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Sugestões automáticas:</strong> Ao selecionar um cargo, permissões são sugeridas</li>
          <li>• <strong>Totalmente customizável:</strong> Você pode marcar/desmarcar qualquer permissão</li>
          <li>• <strong>Flexível:</strong> Um Irmão pode ter permissão de editar finanças se necessário</li>
          <li>• <strong>Senha:</strong> Definida pelo admin na criação, pode ser resetada depois</li>
        </ul>
      </div>
    </div>
  );
}
