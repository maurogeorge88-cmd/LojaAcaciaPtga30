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
    <div>
      {/* FORMULÁRIO DE CADASTRO */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="text-xl font-bold text-blue-900 mb-4">
          {modoEdicaoCorpoAdmin ? '✏️ Editar Cargo Administrativo' : '➕ Registrar Cargo Administrativo'}
        </h3>

        <form onSubmit={modoEdicaoCorpoAdmin ? handleAtualizarCorpoAdmin : handleSubmitCorpoAdmin}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Irmão *</label>
              <select
                value={corpoAdminForm.irmao_id}
                onChange={(e) => setCorpoAdminForm({ ...corpoAdminForm, irmao_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Cargo *</label>
              <select
                value={corpoAdminForm.cargo}
                onChange={(e) => setCorpoAdminForm({ ...corpoAdminForm, cargo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Ano de Exercício *</label>
              <input
                type="text"
                value={corpoAdminForm.ano_exercicio}
                onChange={(e) => setCorpoAdminForm({ ...corpoAdminForm, ano_exercicio: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
              {loading ? 'Salvando...' : modoEdicaoCorpoAdmin ? '💾 Atualizar Cargo' : '💾 Registrar Cargo'}
            </button>
          </div>
        </form>
      </div>

      {/* FILTRO POR ANO */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex gap-4 items-center">
          <label className="font-medium text-gray-700">Filtrar por Ano:</label>
          <input
            type="text"
            placeholder="Digite o ano (ex: 2024)"
            value={anoFiltroAdmin}
            onChange={(e) => setAnoFiltroAdmin(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            pattern="[0-9]*"
          />
          {anoFiltroAdmin && (
            <button
              onClick={() => setAnoFiltroAdmin('')}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold transition"
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
            <div key={ano} className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <h3 className="text-xl font-bold">Administração {ano}</h3>
                <p className="text-sm text-blue-100">
                  {corpoAdmin.filter(ca => ca.ano_exercicio === ano).length} cargos
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cargo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Irmão</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CIM</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {corpoAdmin
                      .filter(ca => ca.ano_exercicio === ano)
                      .sort((a, b) => {
                        // Ordem por hierarquia maçônica
                        const ordemHierarquica = CARGOS_ADMINISTRATIVOS;
                        const indexA = ordemHierarquica.indexOf(a.cargo || '');
                        const indexB = ordemHierarquica.indexOf(b.cargo || '');
                        if (indexA === -1 && indexB === -1) return (a.cargo || '').localeCompare(b.cargo || '');
                        if (indexA === -1) return 1;
                        if (indexB === -1) return -1;
                        return indexA - indexB;
                      })
                      .map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                            {item.cargo || 'Cargo não informado'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {item.irmao?.nome || 'Irmão não encontrado'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {item.irmao?.cim || '-'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {permissoes?.canEdit && (
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => handleEditarCorpoAdmin(item)}
                                  className="text-blue-600 hover:text-blue-800 font-semibold"
                                  title="Editar"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleExcluirCorpoAdmin(item.id)}
                                  className="text-red-600 hover:text-red-800 font-semibold"
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
