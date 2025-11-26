/**
 * COMPONENTE GERENCIAR USUÁRIOS
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';

// Permissões disponíveis por cargo
const PERMISSOES_DISPONIVEIS = [
  {
    cargo: 'irmao',
    pode_editar_cadastros: false,
    pode_visualizar_financeiro: false,
    pode_editar_financeiro: false,
    pode_gerenciar_usuarios: false
  },
  {
    cargo: 'secretario',
    pode_editar_cadastros: true,
    pode_visualizar_financeiro: true,
    pode_editar_financeiro: false,
    pode_gerenciar_usuarios: false
  },
  {
    cargo: 'tesoureiro',
    pode_editar_cadastros: false,
    pode_visualizar_financeiro: true,
    pode_editar_financeiro: true,
    pode_gerenciar_usuarios: false
  },
  {
    cargo: 'chanceler',
    pode_editar_cadastros: true,
    pode_visualizar_financeiro: true,
    pode_editar_financeiro: false,
    pode_gerenciar_usuarios: false
  },
  {
    cargo: 'veneravel',
    pode_editar_cadastros: true,
    pode_visualizar_financeiro: true,
    pode_editar_financeiro: true,
    pode_gerenciar_usuarios: true
  },
  {
    cargo: 'administrador',
    pode_editar_cadastros: true,
    pode_visualizar_financeiro: true,
    pode_editar_financeiro: true,
    pode_gerenciar_usuarios: true
  }
];

export const Usuarios = ({ usuarios, userData, onUpdate, showSuccess, showError }) => {
  const [usuarioForm, setUsuarioForm] = useState({
    nome: '',
    email: '',
    senha: '',
    cargo: 'irmao',
    ativo: true
  });

  const [modoEdicaoUsuario, setModoEdicaoUsuario] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [loading, setLoading] = useState(false);

  const getPermissoesUsuario = (cargo) => {
    return PERMISSOES_DISPONIVEIS.find(p => p.cargo === cargo);
  };

  const limparFormularioUsuario = () => {
    setUsuarioForm({
      nome: '',
      email: '',
      senha: '',
      cargo: 'irmao',
      ativo: true
    });
    setModoEdicaoUsuario(false);
    setUsuarioEditando(null);
  };

  const handleSubmitUsuario = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('💾 Criando novo usuário:', usuarioForm.email);

      // Criar usuário no Auth usando signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: usuarioForm.email,
        password: usuarioForm.senha,
        options: {
          data: {
            nome: usuarioForm.nome
          }
        }
      });

      if (authError) throw authError;

      // Inserir dados complementares na tabela usuarios
      const { error: dbError } = await supabase
        .from('usuarios')
        .insert([{
          email: usuarioForm.email,
          nome: usuarioForm.nome,
          cargo: usuarioForm.cargo,
          ativo: usuarioForm.ativo
        }]);

      if (dbError) throw dbError;

      showSuccess('✅ Usuário criado com sucesso! Um email de confirmação foi enviado.');
      onUpdate();
      limparFormularioUsuario();

    } catch (error) {
      console.error('❌ Erro ao criar usuário:', error);
      showError('Erro ao criar usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAtualizarUsuario = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('💾 Atualizando usuário:', usuarioEditando.email);

      const { error } = await supabase
        .from('usuarios')
        .update({
          nome: usuarioForm.nome,
          cargo: usuarioForm.cargo,
          ativo: usuarioForm.ativo
        })
        .eq('id', usuarioEditando.id);

      if (error) throw error;

      // Se tem nova senha, atualizar no Auth
      if (usuarioForm.senha && usuarioEditando.auth_user_id) {
        const { error: authError } = await supabase.auth.admin.updateUserById(
          usuarioEditando.auth_user_id,
          { password: usuarioForm.senha }
        );
        
        if (authError) {
          console.error('⚠️ Erro ao atualizar senha no Auth:', authError);
          // Não lançar erro aqui, pois o usuário já foi atualizado na tabela
          showError('Usuário atualizado, mas houve erro ao atualizar a senha: ' + authError.message);
          return;
        }
      }

      showSuccess('✅ Usuário atualizado com sucesso!');
      onUpdate();
      limparFormularioUsuario();

    } catch (error) {
      console.error('❌ Erro ao atualizar usuário:', error);
      showError('Erro ao atualizar usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarUsuario = (usuario) => {
    setModoEdicaoUsuario(true);
    setUsuarioEditando(usuario);
    setUsuarioForm({
      nome: usuario.nome,
      email: usuario.email,
      senha: '', // Não carregar senha
      cargo: usuario.cargo,
      ativo: usuario.ativo
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExcluirUsuario = async (usuario) => {
    if (!window.confirm(`Tem certeza que deseja excluir o usuário ${usuario.nome}?`)) return;

    setLoading(true);
    try {
      console.log('🗑️ Excluindo usuário:', usuario.email);

      // Excluir do banco
      const { error: dbError } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', usuario.id);

      if (dbError) throw dbError;

      showSuccess('✅ Usuário excluído com sucesso!');
      onUpdate();

    } catch (error) {
      console.error('❌ Erro ao excluir usuário:', error);
      showError('Erro ao excluir usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* FORMULÁRIO DE USUÁRIO */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="text-xl font-bold text-blue-900 mb-4">
          {modoEdicaoUsuario ? '✏️ Editar Usuário' : '➕ Novo Usuário'}
        </h3>

        <form onSubmit={modoEdicaoUsuario ? handleAtualizarUsuario : handleSubmitUsuario}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo *</label>
              <input
                type="text"
                value={usuarioForm.nome}
                onChange={(e) => setUsuarioForm({ ...usuarioForm, nome: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
              <input
                type="email"
                value={usuarioForm.email}
                onChange={(e) => setUsuarioForm({ ...usuarioForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
                disabled={modoEdicaoUsuario}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha {modoEdicaoUsuario ? '(deixe vazio para não alterar)' : '*'}
              </label>
              <input
                type="password"
                value={usuarioForm.senha}
                onChange={(e) => setUsuarioForm({ ...usuarioForm, senha: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required={!modoEdicaoUsuario}
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cargo *</label>
              <select
                value={usuarioForm.cargo}
                onChange={(e) => setUsuarioForm({ ...usuarioForm, cargo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              >
                <option value="irmao">Irmão</option>
                <option value="secretario">Secretário</option>
                <option value="tesoureiro">Tesoureiro</option>
                <option value="chanceler">Chanceler</option>
                <option value="veneravel">Venerável</option>
                <option value="administrador">Administrador</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center cursor-pointer mt-6">
                <input
                  type="checkbox"
                  checked={usuarioForm.ativo}
                  onChange={(e) => setUsuarioForm({ ...usuarioForm, ativo: e.target.checked })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">Usuário Ativo</span>
              </label>
            </div>
          </div>

          {/* Mostrar permissões do cargo selecionado */}
          {getPermissoesUsuario(usuarioForm.cargo) && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2">Permissões do cargo "{usuarioForm.cargo}":</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div className="flex items-center">
                  <span className={getPermissoesUsuario(usuarioForm.cargo).pode_editar_cadastros ? 'text-green-600' : 'text-red-600'}>
                    {getPermissoesUsuario(usuarioForm.cargo).pode_editar_cadastros ? '✅' : '❌'}
                  </span>
                  <span className="ml-2">Editar Cadastros</span>
                </div>
                <div className="flex items-center">
                  <span className={getPermissoesUsuario(usuarioForm.cargo).pode_visualizar_financeiro ? 'text-green-600' : 'text-red-600'}>
                    {getPermissoesUsuario(usuarioForm.cargo).pode_visualizar_financeiro ? '✅' : '❌'}
                  </span>
                  <span className="ml-2">Ver Financeiro</span>
                </div>
                <div className="flex items-center">
                  <span className={getPermissoesUsuario(usuarioForm.cargo).pode_editar_financeiro ? 'text-green-600' : 'text-red-600'}>
                    {getPermissoesUsuario(usuarioForm.cargo).pode_editar_financeiro ? '✅' : '❌'}
                  </span>
                  <span className="ml-2">Editar Financeiro</span>
                </div>
                <div className="flex items-center">
                  <span className={getPermissoesUsuario(usuarioForm.cargo).pode_gerenciar_usuarios ? 'text-green-600' : 'text-red-600'}>
                    {getPermissoesUsuario(usuarioForm.cargo).pode_gerenciar_usuarios ? '✅' : '❌'}
                  </span>
                  <span className="ml-2">Gerenciar Usuários</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-4 mt-6">
            {modoEdicaoUsuario && (
              <button
                type="button"
                onClick={limparFormularioUsuario}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:bg-gray-400"
            >
              {loading ? 'Salvando...' : modoEdicaoUsuario ? '💾 Atualizar' : '💾 Criar Usuário'}
            </button>
          </div>
        </form>
      </div>

      {/* LISTA DE USUÁRIOS */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <h3 className="text-xl font-bold">Usuários Cadastrados</h3>
          <p className="text-sm text-blue-100">Total: {usuarios.length} usuários</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cargo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    Nenhum usuário cadastrado
                  </td>
                </tr>
              ) : (
                usuarios.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{usuario.nome}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{usuario.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 capitalize">
                        {usuario.cargo}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        usuario.ativo 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {usuario.ativo ? '✅ Ativo' : '❌ Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEditarUsuario(usuario)}
                          className="text-blue-600 hover:text-blue-800 font-semibold"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        {usuario.email !== userData?.email && (
                          <button
                            onClick={() => handleExcluirUsuario(usuario)}
                            className="text-red-600 hover:text-red-800 font-semibold"
                            title="Excluir"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
