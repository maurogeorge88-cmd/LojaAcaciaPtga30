/**
 * COMPONENTE CORPO ADMINISTRATIVO
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { CARGOS_ADMINISTRATIVOS } from '../../utils/constants';

export const CorpoAdmin = ({ 
  corpoAdmin, 
  irmaos, 
  permissoes, 
  onUpdate,
  showSuccess,
  showError 
}) => {
  const [corpoAdminForm, setCorpoAdminForm] = useState({
    irmao_id: '',
    cargo: '',
    ano_exercicio: new Date().getFullYear().toString()
  });
  
  const [modoEdicaoCorpoAdmin, setModoEdicaoCorpoAdmin] = useState(false);
  const [corpoAdminEditando, setCorpoAdminEditando] = useState(null);
  const [anoFiltroAdmin, setAnoFiltroAdmin] = useState('');
  const [loading, setLoading] = useState(false);

  const cargosAdministrativos = CARGOS_ADMINISTRATIVOS;

  const limparFormularioCorpoAdmin = () => {
    setCorpoAdminForm({
      irmao_id: '',
      cargo: '',
      ano_exercicio: new Date().getFullYear().toString()
    });
    setModoEdicaoCorpoAdmin(false);
    setCorpoAdminEditando(null);
  };

  const handleSubmitCorpoAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('corpo_administrativo')
        .insert([corpoAdminForm]);

      if (error) throw error;

      showSuccess('✅ Cargo administrativo registrado com sucesso!');
      limparFormularioCorpoAdmin();
      onUpdate();
    } catch (err) {
      showError('Erro ao registrar cargo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarCorpoAdmin = (item) => {
    setCorpoAdminForm({
      irmao_id: item.irmao_id,
      cargo: item.cargo,
      ano_exercicio: item.ano_exercicio
    });
    setModoEdicaoCorpoAdmin(true);
    setCorpoAdminEditando(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAtualizarCorpoAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('corpo_administrativo')
        .update(corpoAdminForm)
        .eq('id', corpoAdminEditando.id);

      if (error) throw error;

      showSuccess('✅ Cargo administrativo atualizado com sucesso!');
      limparFormularioCorpoAdmin();
      onUpdate();
    } catch (err) {
      showError('Erro ao atualizar cargo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirCorpoAdmin = async (id) => {
    if (!confirm('Tem certeza que deseja remover este cargo?')) return;

    try {
      const { error } = await supabase
        .from('corpo_administrativo')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('✅ Cargo administrativo removido com sucesso!');
      onUpdate();
    } catch (err) {
      showError('Erro ao remover cargo: ' + err.message);
    }
  };

  return (
    <div style={{ 
      padding: '2rem', 
      background: 'var(--color-bg)', 
      minHeight: '100vh' 
    }}>
      {/* FORMULÁRIO DE CADASTRO - SÓ PARA ADMIN */}
      {permissoes?.pode_editar_corpo_admin && (
        <div className="card">
          <h3 style={{ 
            fontSize: '1.25rem', 
            fontWeight: 'bold', 
            color: 'var(--color-text)', 
            marginBottom: '1rem' 
          }}>
            {modoEdicaoCorpoAdmin ? '✏️ Editar Cargo Administrativo' : '➕ Registrar Cargo Administrativo'}
          </h3>

          <form onSubmit={modoEdicaoCorpoAdmin ? handleAtualizarCorpoAdmin : handleSubmitCorpoAdmin}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Irmão *</label>
                <select
                  value={corpoAdminForm.irmao_id}
                  onChange={(e) => setCorpoAdminForm({ ...corpoAdminForm, irmao_id: e.target.value })}
                  className="form-input"
                  required
                >
                  <option value="">Selecione um irmão</option>
                  {irmaos
                    .filter(i => i.status === 'ativo')
                    .map(irmao => (
                      <option key={irmao.id} value={irmao.id}>
                        {irmao.nome} - CIM {irmao.cim}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="form-label">Cargo *</label>
                <select
                  value={corpoAdminForm.cargo}
                  onChange={(e) => setCorpoAdminForm({ ...corpoAdminForm, cargo: e.target.value })}
                  className="form-input"
                  required
                >
                  <option value="">Selecione um cargo</option>
                  {cargosAdministrativos.map((cargo) => (
                    <option key={cargo} value={cargo}>
                      {cargo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Ano de Exercício *</label>
                <input
                  type="text"
                  value={corpoAdminForm.ano_exercicio}
                  onChange={(e) => setCorpoAdminForm({ ...corpoAdminForm, ano_exercicio: e.target.value })}
                  className="form-input"
                  placeholder="Ex: 2024"
                  required
                  pattern="[0-9]{4}"
                  title="Digite um ano válido (4 dígitos)"
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-6">
              {modoEdicaoCorpoAdmin && (
                <button
                  type="button"
                  onClick={limparFormularioCorpoAdmin}
                  style={{ padding: "0.5rem 1.5rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", color: "var(--color-text)", fontWeight: "600", background: "transparent", cursor: "pointer", transition: "all 0.2s ease" }} onMouseEnter={(e) => e.target.style.background = "var(--color-surface-2)"} onMouseLeave={(e) => e.target.style.background = "transparent"}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.5rem 2rem',
                  background: 'var(--color-accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontWeight: 'bold',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: loading ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.target.style.background = 'var(--color-accent-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.target.style.background = 'var(--color-accent)';
                }}
              >
                {loading ? 'Salvando...' : modoEdicaoCorpoAdmin ? '💾 Atualizar Cargo' : '💾 Registrar Cargo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTRO POR ANO */}
      <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <div className="flex gap-4 items-center">
          <label style={{ fontWeight: '600', color: 'var(--color-text)' }}>Filtrar por Ano:</label>
          <input
            type="text"
            placeholder="Digite o ano (ex: 2024)"
            value={anoFiltroAdmin}
            onChange={(e) => setAnoFiltroAdmin(e.target.value)}
            className="form-input"
            style={{ flex: 1 }}
            pattern="[0-9]*"
          />
          {anoFiltroAdmin && (
            <button
              onClick={() => setAnoFiltroAdmin('')}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--color-surface-2)',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontWeight: '600',
                color: 'var(--color-text)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--color-surface-3)'}
              onMouseLeave={(e) => e.target.style.background = 'var(--color-surface-2)'}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* LISTA POR ANO */}
      <div className="space-y-6">
        {[...new Set(corpoAdmin
          .filter(ca => !anoFiltroAdmin || ca.ano_exercicio?.includes(anoFiltroAdmin))
          .map(ca => ca.ano_exercicio))]
          .sort((a, b) => b - a)
          .map(ano => (
            <div key={ano} className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ 
                padding: '1rem', 
                background: 'var(--color-accent)', 
                color: 'white' 
              }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Administração {ano}</h3>
                <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                  {corpoAdmin.filter(ca => ca.ano_exercicio === ano).length} cargos
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead style={{ 
                    background: 'var(--color-surface-2)', 
                    borderBottom: '2px solid var(--color-border)' 
                  }}>
                    <tr>
                      <th style={{ 
                        padding: '0.75rem 1.5rem', 
                        textAlign: 'left', 
                        fontSize: '0.75rem', 
                        fontWeight: '600', 
                        color: 'var(--color-text-muted)', 
                        textTransform: 'uppercase' 
                      }}>Cargo</th>
                      <th style={{ 
                        padding: '0.75rem 1.5rem', 
                        textAlign: 'left', 
                        fontSize: '0.75rem', 
                        fontWeight: '600', 
                        color: 'var(--color-text-muted)', 
                        textTransform: 'uppercase' 
                      }}>Irmão</th>
                      <th style={{ 
                        padding: '0.75rem 1.5rem', 
                        textAlign: 'left', 
                        fontSize: '0.75rem', 
                        fontWeight: '600', 
                        color: 'var(--color-text-muted)', 
                        textTransform: 'uppercase' 
                      }}>CIM</th>
                      <th style={{ 
                        padding: '0.75rem 1.5rem', 
                        textAlign: 'center', 
                        fontSize: '0.75rem', 
                        fontWeight: '600', 
                        color: 'var(--color-text-muted)', 
                        textTransform: 'uppercase' 
                      }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody style={{ borderTop: '1px solid var(--color-border)' }}>
                    {corpoAdmin
                      .filter(ca => ca.ano_exercicio === ano)
                      .sort((a, b) => {
                        // Normalizar e mapear cargos para hierarquia
                        const normalizarCargo = (cargo) => {
                          if (!cargo) return '';
                          const c = cargo.toLowerCase().trim();
                          
                          // Mapear variações para padrão
                          if (c.includes('veneravel') || c.includes('venerável')) return 'veneravel mestre';
                          if (c.includes('1') && c.includes('vigilante')) return 'primeiro vigilante';
                          if (c.includes('primeiro') && c.includes('vigilante')) return 'primeiro vigilante';
                          if (c.includes('2') && c.includes('vigilante')) return 'segundo vigilante';
                          if (c.includes('segundo') && c.includes('vigilante')) return 'segundo vigilante';
                          if (c.includes('orador')) return 'orador';
                          if (c.includes('secretario') || c.includes('secretário')) return 'secretario';
                          if (c.includes('tesoureiro')) return 'tesoureiro';
                          if (c.includes('chanceler')) return 'chanceler';
                          if (c.includes('hospitaleiro')) return 'hospitaleiro';
                          if (c.includes('mestre') && c.includes('cerimonia')) return 'mestre de cerimonia';
                          if (c.includes('mestre') && c.includes('harmonia')) return 'mestre de harmonia';
                          if (c.includes('mestre') && c.includes('banquete')) return 'mestre de banquetes';
                          if (c.includes('porta') && c.includes('espada')) return 'porta espada';
                          if (c.includes('porta') && c.includes('estandarte')) return 'porta estandarte';
                          if (c.includes('diacono') || c.includes('diácono')) return 'diacono';
                          if (c.includes('cobridor') && c.includes('externo')) return 'cobridor externo';
                          if (c.includes('cobridor') && c.includes('interno')) return 'cobridor interno';
                          if (c.includes('bibliotecario') || c.includes('bibliotecário')) return 'bibliotecario';
                          
                          return c;
                        };
                        
                        // Ordem hierárquica normalizada
                        const ordemHierarquica = [
                          'veneravel mestre',
                          'primeiro vigilante',
                          'segundo vigilante',
                          'orador',
                          'secretario',
                          'tesoureiro',
                          'chanceler',
                          'hospitaleiro',
                          'mestre de cerimonia',
                          'mestre de harmonia',
                          'mestre de banquetes',
                          'porta espada',
                          'porta estandarte',
                          'diacono',
                          'cobridor externo',
                          'cobridor interno',
                          'bibliotecario'
                        ];
                        
                        const cargoA = normalizarCargo(a.cargo);
                        const cargoB = normalizarCargo(b.cargo);
                        
                        const indexA = ordemHierarquica.indexOf(cargoA);
                        const indexB = ordemHierarquica.indexOf(cargoB);
                        
                        // Se ambos não estão na lista, ordena alfabeticamente
                        if (indexA === -1 && indexB === -1) return cargoA.localeCompare(cargoB);
                        // Se só A não está na lista, coloca no final
                        if (indexA === -1) return 1;
                        // Se só B não está na lista, coloca no final
                        if (indexB === -1) return -1;
                        // Ambos estão na lista, ordena por índice
                        return indexA - indexB;
                      })
                      .map((item) => (
                        <tr 
                          key={item.id} 
                          style={{ 
                            borderBottom: '1px solid var(--color-border)', 
                            transition: 'background 0.2s ease' 
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ 
                            padding: '1rem 1.5rem', 
                            whiteSpace: 'nowrap', 
                            fontWeight: '600', 
                            color: 'var(--color-text)' 
                          }}>
                            {item.cargo || 'Cargo não informado'}
                          </td>
                          <td style={{ 
                            padding: '1rem 1.5rem', 
                            whiteSpace: 'nowrap', 
                            fontSize: '0.875rem', 
                            color: 'var(--color-text-muted)' 
                          }}>
                            {item.irmao?.nome || 'Irmão não encontrado'}
                          </td>
                          <td style={{ 
                            padding: '1rem 1.5rem', 
                            whiteSpace: 'nowrap', 
                            fontSize: '0.875rem', 
                            color: 'var(--color-text-muted)' 
                          }}>
                            {item.irmao?.cim || '-'}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                            {permissoes?.canEdit && (
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => handleEditarCorpoAdmin(item)}
                                  style={{
                                    background: 'transparent',
                                    color: 'var(--color-accent)',
                                    border: 'none',
                                    padding: '0.25rem',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = 'var(--color-accent-bg)';
                                    e.target.style.transform = 'scale(1.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'transparent';
                                    e.target.style.transform = 'scale(1)';
                                  }}
                                  title="Editar"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleExcluirCorpoAdmin(item.id)}
                                  style={{
                                    background: 'transparent',
                                    color: 'var(--color-danger)',
                                    border: 'none',
                                    padding: '0.25rem',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = 'var(--color-danger-bg)';
                                    e.target.style.transform = 'scale(1.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'transparent';
                                    e.target.style.transform = 'scale(1)';
                                  }}
                                  title="Remover"
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

        {[...new Set(corpoAdmin
          .filter(ca => !anoFiltroAdmin || ca.ano_exercicio?.includes(anoFiltroAdmin))
          .map(ca => ca.ano_exercicio))].length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
            {anoFiltroAdmin 
              ? `Nenhum registro encontrado para o ano "${anoFiltroAdmin}"`
              : 'Nenhum cargo administrativo registrado'}
          </div>
        )}
      </div>
    </div>
  );
};
