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

  // Função para formatar cargo para exibição
  const formatarCargo = (cargo) => {
    if (!cargo) return '';
    return cargo
      .replace(/_/g, ' ')
      .split(' ')
      .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
      .join(' ');
  };

  // Sugestões de permissões por cargo (não fixas!)
  const SUGESTOES_PERMISSOES = {
    'irmao': {
      pode_editar_cadastros: false,
      pode_visualizar_financeiro: false,
      pode_editar_financeiro: false,
      pode_gerenciar_usuarios: false,
      pode_editar_biblioteca: false,
      pode_editar_comodatos: false,
      pode_editar_caridade: false,
      pode_editar_balaustres: false,
      pode_editar_pranchas: false,
      pode_editar_comissoes: false,
      pode_editar_corpo_admin: false,
      pode_editar_presenca: false,
      pode_editar_projetos: false
    },
    'secretario': {
      pode_editar_cadastros: true,
      pode_visualizar_financeiro: true,
      pode_editar_financeiro: false,
      pode_gerenciar_usuarios: false,
      pode_editar_biblioteca: true,
      pode_editar_comodatos: false,
      pode_editar_caridade: false,
      pode_editar_balaustres: true,
      pode_editar_pranchas: true,
      pode_editar_comissoes: true,
      pode_editar_corpo_admin: true,
      pode_editar_presenca: true,
      pode_editar_projetos: true
    },
    'tesoureiro': {
      pode_editar_cadastros: false,
      pode_visualizar_financeiro: true,
      pode_editar_financeiro: true,
      pode_gerenciar_usuarios: false,
      pode_editar_biblioteca: false,
      pode_editar_comodatos: false,
      pode_editar_caridade: true,
      pode_editar_balaustres: false,
      pode_editar_pranchas: false,
      pode_editar_comissoes: false,
      pode_editar_corpo_admin: false,
      pode_editar_presenca: false,
      pode_editar_projetos: true
    },
    'chanceler': {
      pode_editar_cadastros: true,
      pode_visualizar_financeiro: true,
      pode_editar_financeiro: false,
      pode_gerenciar_usuarios: false,
      pode_editar_biblioteca: false,
      pode_editar_comodatos: false,
      pode_editar_caridade: false,
      pode_editar_balaustres: true,
      pode_editar_pranchas: true,
      pode_editar_comissoes: false,
      pode_editar_corpo_admin: false,
      pode_editar_presenca: false,
      pode_editar_projetos: false
    },
    'primeiro_vigilante': {
      pode_editar_cadastros: true,
      pode_visualizar_financeiro: true,
      pode_editar_financeiro: false,
      pode_gerenciar_usuarios: false,
      pode_editar_biblioteca: false,
      pode_editar_comodatos: false,
      pode_editar_caridade: false,
      pode_editar_balaustres: true,
      pode_editar_pranchas: false,
      pode_editar_comissoes: true,
      pode_editar_corpo_admin: false,
      pode_editar_presenca: false,
      pode_editar_projetos: false
    },
    'segundo_vigilante': {
      pode_editar_cadastros: true,
      pode_visualizar_financeiro: true,
      pode_editar_financeiro: false,
      pode_gerenciar_usuarios: false,
      pode_editar_biblioteca: false,
      pode_editar_comodatos: false,
      pode_editar_caridade: false,
      pode_editar_balaustres: true,
      pode_editar_pranchas: false,
      pode_editar_comissoes: true,
      pode_editar_corpo_admin: false,
      pode_editar_presenca: false,
      pode_editar_projetos: false
    },
    'orador': {
      pode_editar_cadastros: false,
      pode_visualizar_financeiro: true,
      pode_editar_financeiro: false,
      pode_gerenciar_usuarios: false,
      pode_editar_biblioteca: false,
      pode_editar_comodatos: false,
      pode_editar_caridade: false,
      pode_editar_balaustres: false,
      pode_editar_pranchas: true,
      pode_editar_comissoes: false,
      pode_editar_corpo_admin: false,
      pode_editar_presenca: false,
      pode_editar_projetos: false
    },
    'veneravel': {
      pode_editar_cadastros: true,
      pode_visualizar_financeiro: true,
      pode_editar_financeiro: true,
      pode_gerenciar_usuarios: true,
      pode_editar_biblioteca: true,
      pode_editar_comodatos: true,
      pode_editar_caridade: true,
      pode_editar_balaustres: true,
      pode_editar_pranchas: true,
      pode_editar_comissoes: true,
      pode_editar_corpo_admin: true,
      pode_editar_presenca: true,
      pode_editar_projetos: true
    },
    'administrador': {
      pode_editar_cadastros: true,
      pode_visualizar_financeiro: true,
      pode_editar_financeiro: true,
      pode_gerenciar_usuarios: true,
      pode_editar_biblioteca: true,
      pode_editar_comodatos: true,
      pode_editar_caridade: true,
      pode_editar_balaustres: true,
      pode_editar_pranchas: true,
      pode_editar_comissoes: true,
      pode_editar_corpo_admin: true,
      pode_editar_presenca: true,
      pode_editar_projetos: true
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
      pode_gerenciar_usuarios: false,
      pode_editar_biblioteca: false,
      pode_editar_comodatos: false,
      pode_editar_caridade: false,
      pode_editar_balaustres: false,
      pode_editar_pranchas: false,
      pode_editar_comissoes: false,
      pode_editar_corpo_admin: false,
      pode_editar_presenca: false,
      pode_editar_projetos: false
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
      // 1. Criar usuário no Auth usando signUp (não precisa de admin)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: usuarioForm.email,
        password: usuarioForm.senha,
        options: {
          data: {
            nome: usuarioForm.nome
          },
          emailRedirectTo: window.location.origin + '/primeiro-acesso'
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
          senha_temporaria: usuarioForm.senha, // Salvar para referência
          nivel_acesso: usuarioForm.cargo === 'irmao' ? 'irmao' : 
                       (usuarioForm.cargo === 'veneravel' || usuarioForm.cargo === 'administrador') ? 'admin' : 'cargo',
          pode_editar_cadastros: usuarioForm.pode_editar_cadastros,
          pode_visualizar_financeiro: usuarioForm.pode_visualizar_financeiro,
          pode_editar_financeiro: usuarioForm.pode_editar_financeiro,
          pode_gerenciar_usuarios: usuarioForm.pode_gerenciar_usuarios,
          pode_editar_biblioteca: usuarioForm.pode_editar_biblioteca,
          pode_editar_comodatos: usuarioForm.pode_editar_comodatos,
          pode_editar_caridade: usuarioForm.pode_editar_caridade,
          pode_editar_balaustres: usuarioForm.pode_editar_balaustres,
          pode_editar_pranchas: usuarioForm.pode_editar_pranchas,
          pode_editar_comissoes: usuarioForm.pode_editar_comissoes,
          pode_editar_corpo_admin: usuarioForm.pode_editar_corpo_admin,
          pode_editar_presenca: usuarioForm.pode_editar_presenca
        }]);

      if (dbError) throw dbError;

      // Mostrar credenciais para o admin passar ao usuário
      const mensagem = `
✅ Usuário criado com sucesso!

PASSE ESTAS INFORMAÇÕES PARA ${usuarioForm.nome}:

📧 Email: ${usuarioForm.email}
🔑 Senha temporária: ${usuarioForm.senha}
🔗 Link: ${window.location.origin}/primeiro-acesso

O usuário deve:
1. Acessar o link acima
2. Fazer login com email e senha temporária
3. Será redirecionado para definir nova senha

IMPORTANTE: Copie estas informações agora!
      `;

      alert(mensagem);
      showSuccess('✅ Usuário criado! Copie as credenciais acima.');
      onUpdate();
      limparFormulario();

    } catch (error) {
      console.error('❌ Erro:', error);
      showError('❌ Erro ao criar usuário: ' + error.message);
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
          pode_gerenciar_usuarios: usuarioForm.pode_gerenciar_usuarios,
          pode_editar_biblioteca: usuarioForm.pode_editar_biblioteca,
          pode_editar_comodatos: usuarioForm.pode_editar_comodatos,
          pode_editar_caridade: usuarioForm.pode_editar_caridade,
          pode_editar_balaustres: usuarioForm.pode_editar_balaustres,
          pode_editar_pranchas: usuarioForm.pode_editar_pranchas,
          pode_editar_comissoes: usuarioForm.pode_editar_comissoes,
          pode_editar_corpo_admin: usuarioForm.pode_editar_corpo_admin,
          pode_editar_presenca: usuarioForm.pode_editar_presenca
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
      // Salvar senha temporária na tabela para o usuário ver
      const { error } = await supabase
        .from('usuarios')
        .update({ senha_temporaria: novaSenha })
        .eq('id', usuario.id);

      if (error) throw error;

      alert(`✅ Instruções para resetar senha de ${usuario.nome}:\n\n` +
            `1. Vá no Supabase Dashboard\n` +
            `2. Authentication → Users\n` +
            `3. Encontre: ${usuario.email}\n` +
            `4. Clique nos 3 pontos → Reset Password\n` +
            `5. Digite a senha: ${novaSenha}\n\n` +
            `OU peça para o usuário:\n` +
            `1. Fazer logout\n` +
            `2. Clicar em "Esqueci minha senha"\n` +
            `3. Seguir instruções do email\n\n` +
            `Senha salva no sistema para referência.`);
      
      showSuccess('💡 Senha temporária salva! Siga as instruções.');
      onUpdate();

    } catch (error) {
      console.error('❌ Erro:', error);
      showError('❌ Erro ao salvar: ' + error.message);
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
      pode_gerenciar_usuarios: usuario.pode_gerenciar_usuarios || false,
      pode_editar_biblioteca: usuario.pode_editar_biblioteca || false,
      pode_editar_comodatos: usuario.pode_editar_comodatos || false,
      pode_editar_caridade: usuario.pode_editar_caridade || false,
      pode_editar_balaustres: usuario.pode_editar_balaustres || false,
      pode_editar_pranchas: usuario.pode_editar_pranchas || false,
      pode_editar_comissoes: usuario.pode_editar_comissoes || false,
      pode_editar_corpo_admin: usuario.pode_editar_corpo_admin || false,
      pode_editar_presenca: usuario.pode_editar_presenca || false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExcluirUsuario = async (usuario) => {
    if (!confirm(`❗ Tem certeza que deseja excluir o usuário ${usuario.nome}?`)) return;

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
    <div className="space-y-6" style={{ 
      background: 'var(--color-bg)',
      minHeight: '100vh',
      padding: '2rem'
    }}>
      {/* FORMULÁRIO */}
      <div className="card">
        <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
          {modoEdicao ? '✏️ Editar Usuário' : '➕ Novo Usuário'}
        </h3>

        <form onSubmit={modoEdicao ? handleAtualizarUsuario : handleCriarUsuario} className="space-y-4">
          {/* Nome e Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                value={usuarioForm.nome}
                onChange={(e) => setUsuarioForm({ ...usuarioForm, nome: e.target.value })}
                className="form-input"
                placeholder="João da Silva"
              />
            </div>

            <div>
              <label className="form-label">
                Email *
              </label>
              <input
                type="email"
                required
                disabled={modoEdicao}
                value={usuarioForm.email}
                onChange={(e) => setUsuarioForm({ ...usuarioForm, email: e.target.value })}
                className="form-input"
                placeholder="joao@email.com"
              />
            </div>
          </div>

          {/* Senha (apenas criação) */}
          {!modoEdicao && (
            <div>
              <label className="form-label">
                Senha * (mínimo 6 caracteres)
              </label>
              <div className="flex gap-2">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  required
                  value={usuarioForm.senha}
                  onChange={(e) => setUsuarioForm({ ...usuarioForm, senha: e.target.value })}
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder="Digite uma senha"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-text)',
                    border: '2px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontSize: '1.25rem'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--color-surface-3)'}
                  onMouseLeave={(e) => e.target.style.background = 'var(--color-surface-2)'}
                >
                  {mostrarSenha ? '🙈' : '👁️'}
                </button>
                <button
                  type="button"
                  onClick={gerarSenhaAleatoria}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--color-accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontWeight: '600',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'var(--color-accent-hover)';
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'var(--color-accent)';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                  }}
                >
                  🎲 Gerar
                </button>
              </div>
              <p className="form-hint">
                💡 Copie a senha antes de criar o usuário!
              </p>
            </div>
          )}

          {/* Cargo e Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
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
                className="form-input"
                style={{ cursor: 'pointer' }}
              >
                <option value="irmao">Irmão</option>
                <option value="secretario">Secretário</option>
                <option value="tesoureiro">Tesoureiro</option>
                <option value="chanceler">Chanceler</option>
                <option value="primeiro_vigilante">Primeiro Vigilante</option>
                <option value="segundo_vigilante">Segundo Vigilante</option>
                <option value="orador">Orador</option>
                <option value="veneravel">Venerável</option>
                <option value="administrador">Administrador</option>
              </select>
              {!modoEdicao && (
                <p className="form-hint" style={{ color: 'var(--color-accent)' }}>
                  💡 Permissões são aplicadas automaticamente
                </p>
              )}
            </div>

            <div>
              <label className="form-label">
                Status
              </label>
              <select
                value={usuarioForm.ativo}
                onChange={(e) => setUsuarioForm({ ...usuarioForm, ativo: e.target.value === 'true' })}
                className="form-input"
                style={{ cursor: 'pointer' }}
              >
                <option value="true">✅ Ativo</option>
                <option value="false">🚫 Inativo</option>
              </select>
            </div>
          </div>

          {/* PERMISSÕES CUSTOMIZÁVEIS */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              🔐 Permissões (customize conforme necessário)
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 p-3 cursor-pointer" style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
              >
                <input
                  type="checkbox"
                  checked={usuarioForm.pode_editar_cadastros}
                  onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_editar_cadastros: e.target.checked })}
                  className="w-4 h-4"
                />
                <div>
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>✏️ Editar Cadastros</span>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Cadastrar e editar irmãos</p>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 cursor-pointer" style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
              >
                <input
                  type="checkbox"
                  checked={usuarioForm.pode_visualizar_financeiro}
                  onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_visualizar_financeiro: e.target.checked })}
                  className="w-4 h-4"
                />
                <div>
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>👁️ Ver Finanças</span>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Visualizar lançamentos</p>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 cursor-pointer" style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
              >
                <input
                  type="checkbox"
                  checked={usuarioForm.pode_editar_financeiro}
                  onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_editar_financeiro: e.target.checked })}
                  className="w-4 h-4"
                />
                <div>
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>💰 Editar Finanças</span>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Criar/editar lançamentos</p>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 cursor-pointer" style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
              >
                <input
                  type="checkbox"
                  checked={usuarioForm.pode_gerenciar_usuarios}
                  onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_gerenciar_usuarios: e.target.checked })}
                  className="w-4 h-4"
                />
                <div>
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>👥 Gerenciar Usuários</span>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Criar/editar usuários</p>
                </div>
              </label>
            </div>

            {/* PERMISSÕES POR MÓDULO */}
            <div className="mt-6 p-4" style={{
              background: 'var(--color-accent-bg)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-accent)'
            }}>
              <h4 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-accent)' }}>
                <span>📋</span>
                Permissões por Módulo
              </h4>
              <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
                Defina quais módulos específicos este usuário pode editar
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-3 cursor-pointer" style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface)'}>
                  <input
                    type="checkbox"
                    checked={usuarioForm.pode_editar_biblioteca}
                    onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_editar_biblioteca: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="font-medium" style={{ color: 'var(--color-text)' }}>📚 Biblioteca</span>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Gerenciar livros e empréstimos</p>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 cursor-pointer" style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface)'}>
                  <input
                    type="checkbox"
                    checked={usuarioForm.pode_editar_comodatos}
                    onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_editar_comodatos: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="font-medium" style={{ color: 'var(--color-text)' }}>♿ Comodatos</span>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Gerenciar equipamentos</p>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 cursor-pointer" style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface)'}>
                  <input
                    type="checkbox"
                    checked={usuarioForm.pode_editar_caridade}
                    onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_editar_caridade: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="font-medium" style={{ color: 'var(--color-text)' }}>❤️ Caridade</span>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Gerenciar famílias e ajudas</p>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 cursor-pointer" style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface)'}>
                  <input
                    type="checkbox"
                    checked={usuarioForm.pode_editar_balaustres}
                    onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_editar_balaustres: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="font-medium" style={{ color: 'var(--color-text)' }}>📜 Balaustres</span>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Criar/editar balaustres</p>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 cursor-pointer" style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface)'}>
                  <input
                    type="checkbox"
                    checked={usuarioForm.pode_editar_pranchas}
                    onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_editar_pranchas: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="font-medium" style={{ color: 'var(--color-text)' }}>📄 Pranchas</span>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Criar/editar pranchas</p>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 cursor-pointer" style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface)'}>
                  <input
                    type="checkbox"
                    checked={usuarioForm.pode_editar_comissoes}
                    onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_editar_comissoes: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="font-medium" style={{ color: 'var(--color-text)' }}>📋 Comissões</span>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Gerenciar comissões</p>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 cursor-pointer" style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface)'}>
                  <input
                    type="checkbox"
                    checked={usuarioForm.pode_editar_corpo_admin}
                    onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_editar_corpo_admin: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="font-medium" style={{ color: 'var(--color-text)' }}>👔 Corpo Administrativo</span>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Gerenciar cargos admin</p>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 cursor-pointer" style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface)'}>
                  <input
                    type="checkbox"
                    checked={usuarioForm.pode_editar_presenca}
                    onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_editar_presenca: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="font-medium" style={{ color: 'var(--color-text)' }}>✅ Presença</span>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Gerenciar presença nas sessões</p>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 cursor-pointer" style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface)'}>
                  <input
                    type="checkbox"
                    checked={usuarioForm.pode_editar_projetos}
                    onChange={(e) => setUsuarioForm({ ...usuarioForm, pode_editar_projetos: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="font-medium" style={{ color: 'var(--color-text)' }}>📊 Projetos</span>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Gerenciar projetos da loja</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-2 justify-end pt-4">
            {modoEdicao && (
              <button
                type="button"
                onClick={limparFormulario}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-text)',
                  border: '2px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontWeight: '600',
                }}
                onMouseEnter={(e) => e.target.style.background = 'var(--color-surface-3)'}
                onMouseLeave={(e) => e.target.style.background = 'var(--color-surface-2)'}
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading ? 'var(--color-surface-3)' : 'var(--color-accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                opacity: loading ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.background = 'var(--color-accent-hover)';
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.background = 'var(--color-accent)';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                }
              }}
            >
              {loading ? 'Salvando...' : (modoEdicao ? '💾 Atualizar' : '➕ Criar Usuário')}
            </button>
          </div>
        </form>
      </div>

      {/* LISTA DE USUÁRIOS */}
      <div className="card">
        <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
          👥 Usuários Cadastrados ({usuarios?.length || 0})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ background: 'var(--color-surface-2)' }}>
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Nome</th>
                <th className="px-4 py-2 text-left text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Email</th>
                <th className="px-4 py-2 text-left text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Cargo</th>
                <th className="px-4 py-2 text-center text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Permissões</th>
                <th className="px-4 py-2 text-left text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Senha Temp</th>
                <th className="px-4 py-2 text-center text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Status</th>
                <th className="px-4 py-2 text-center text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios?.map((usuario) => (
                <tr key={usuario.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td className="px-4 py-3">
                    <span className="font-medium" style={{ color: 'var(--color-text)' }}>{usuario.nome}</span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {usuario.email}
                  </td>
                  <td className="px-4 py-3">
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      background: 'var(--color-accent-bg)',
                      color: 'var(--color-accent)',
                      fontSize: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: '600'
                    }}>
                      {formatarCargo(usuario.cargo)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {usuario.pode_editar_cadastros && (
                        <span style={{
                          fontSize: '0.75rem',
                          background: 'var(--color-success-bg)',
                          color: 'var(--color-success)',
                          padding: '0.25rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: '600'
                        }}>✏️</span>
                      )}
                      {usuario.pode_visualizar_financeiro && (
                        <span style={{
                          fontSize: '0.75rem',
                          background: 'var(--color-warning-bg)',
                          color: 'var(--color-warning)',
                          padding: '0.25rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: '600'
                        }}>👁️</span>
                      )}
                      {usuario.pode_editar_financeiro && (
                        <span style={{
                          fontSize: '0.75rem',
                          background: 'var(--color-accent-bg)',
                          color: 'var(--color-accent)',
                          padding: '0.25rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: '600'
                        }}>💰</span>
                      )}
                      {usuario.pode_gerenciar_usuarios && (
                        <span style={{
                          fontSize: '0.75rem',
                          background: 'var(--color-danger-bg)',
                          color: 'var(--color-danger)',
                          padding: '0.25rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: '600'
                        }}>👥</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {usuario.senha_temporaria ? (
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        background: 'var(--color-warning-bg)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)'
                      }}>
                        🔑 {usuario.senha_temporaria}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
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
                        title="Editar"
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: 'var(--color-accent-bg)',
                          color: 'var(--color-accent)',
                          fontSize: '0.875rem',
                          borderRadius: 'var(--radius-md)',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          fontWeight: '600'
                        }}
                        onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                        onMouseLeave={(e) => e.target.style.opacity = '1'}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleResetarSenha(usuario)}
                        disabled={resetandoSenha === usuario.id}
                        title="Resetar Senha"
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: 'var(--color-warning-bg)',
                          color: 'var(--color-warning)',
                          fontSize: '0.875rem',
                          borderRadius: 'var(--radius-md)',
                          border: 'none',
                          cursor: resetandoSenha === usuario.id ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          fontWeight: '600',
                          opacity: resetandoSenha === usuario.id ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => { if (resetandoSenha !== usuario.id) e.target.style.opacity = '0.8'; }}
                        onMouseLeave={(e) => { if (resetandoSenha !== usuario.id) e.target.style.opacity = '1'; }}
                      >
                        🔑
                      </button>
                      <button
                        onClick={() => handleExcluirUsuario(usuario)}
                        title="Excluir"
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: 'var(--color-danger-bg)',
                          color: 'var(--color-danger)',
                          fontSize: '0.875rem',
                          borderRadius: 'var(--radius-md)',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          fontWeight: '600'
                        }}
                        onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                        onMouseLeave={(e) => e.target.style.opacity = '1'}
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
          <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
            Nenhum usuário cadastrado ainda.
          </div>
        )}
      </div>

      {/* LEGENDA */}
      <div style={{
        background: 'var(--color-accent-bg)',
        border: '1px solid var(--color-accent)',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem'
      }}>
        <h4 className="font-semibold mb-2" style={{ color: 'var(--color-accent)' }}>💡 Sobre Permissões</h4>
        <ul className="text-sm space-y-1" style={{ color: 'var(--color-text)' }}>
          <li>• <strong>Sugestões automáticas:</strong> Ao selecionar um cargo, permissões são sugeridas</li>
          <li>• <strong>Totalmente customizável:</strong> Você pode marcar/desmarcar qualquer permissão</li>
          <li>• <strong>Flexível:</strong> Um Irmão pode ter permissão de editar finanças se necessário</li>
          <li>• <strong>Senha:</strong> Definida pelo admin na criação, pode ser resetada depois</li>
        </ul>
      </div>
    </div>
  );
}
