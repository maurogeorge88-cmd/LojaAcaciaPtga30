/**
 * ARQUIVO DE TESTE DOS COMPONENTES
 * src/TestComponents.jsx
 * 
 * Use este arquivo para testar os componentes criados
 */

import React from 'react';
import { Alert } from './components/shared/Alert';
import { LoadingSpinner, LoadingOverlay } from './components/shared/LoadingSpinner';
import { Modal } from './components/shared/Modal';
import { formatarData, formatarCPF, formatarMoeda } from './utils/formatters';
import { CARGOS_LOJA, GRAUS_MACONICOS } from './utils/constants';

export const TestComponents = () => {
  const [showModal, setShowModal] = React.useState(false);
  const [showOverlay, setShowOverlay] = React.useState(false);

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">
        🧪 Teste dos Componentes
      </h1>

      {/* TESTE: ALERTS */}
      <section className="bg-white rounded-lg p-6 shadow">
        <h2 className="text-xl font-bold text-gray-800 mb-4">📢 Alertas</h2>
        <div className="space-y-3">
          <Alert type="success" message="✅ Operação realizada com sucesso!" />
          <Alert type="error" message="❌ Erro ao processar solicitação" />
          <Alert type="warning" message="⚠️ Atenção: verifique os dados" />
          <Alert type="info" message="ℹ️ Informação importante aqui" />
        </div>
      </section>

      {/* TESTE: LOADING SPINNER */}
      <section className="bg-white rounded-lg p-6 shadow">
        <h2 className="text-xl font-bold text-gray-800 mb-4">⏳ Loading</h2>
        <div className="flex gap-8 items-center">
          <div>
            <p className="text-sm text-gray-600 mb-2">Small:</p>
            <LoadingSpinner size="sm" />
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Medium:</p>
            <LoadingSpinner size="md" />
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Large:</p>
            <LoadingSpinner size="lg" />
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">With text:</p>
            <LoadingSpinner size="md" text="Carregando..." />
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={() => {
              setShowOverlay(true);
              setTimeout(() => setShowOverlay(false), 2000);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Testar Loading Overlay
          </button>
        </div>
      </section>

      {/* TESTE: MODAL */}
      <section className="bg-white rounded-lg p-6 shadow">
        <h2 className="text-xl font-bold text-gray-800 mb-4">🪟 Modal</h2>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Abrir Modal
        </button>
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Exemplo de Modal"
          size="md"
        >
          <div className="space-y-4">
            <p>Este é um exemplo de modal funcionando!</p>
            <p className="text-gray-600">
              Você pode usar modals para exibir informações detalhadas,
              formulários, confirmações, etc.
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Fechar
            </button>
          </div>
        </Modal>
      </section>

      {/* TESTE: FORMATADORES */}
      <section className="bg-white rounded-lg p-6 shadow">
        <h2 className="text-xl font-bold text-gray-800 mb-4">🔧 Formatadores</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-600">formatarData:</p>
            <p className="text-lg">{formatarData('2024-11-24')}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">formatarCPF:</p>
            <p className="text-lg">{formatarCPF('12345678900')}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">formatarMoeda:</p>
            <p className="text-lg">{formatarMoeda(1500.50)}</p>
          </div>
        </div>
      </section>

      {/* TESTE: CONSTANTES */}
      <section className="bg-white rounded-lg p-6 shadow">
        <h2 className="text-xl font-bold text-gray-800 mb-4">📋 Constantes</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">Cargos da Loja:</p>
            <ul className="text-sm space-y-1">
              {CARGOS_LOJA.slice(0, 5).map((cargo, i) => (
                <li key={i}>• {cargo}</li>
              ))}
              <li className="text-gray-500">... e mais {CARGOS_LOJA.length - 5}</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">Graus Maçônicos:</p>
            <ul className="text-sm space-y-1">
              {GRAUS_MACONICOS.map((grau, i) => (
                <li key={i}>• {grau.label}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* OVERLAY */}
      {showOverlay && <LoadingOverlay text="Processando..." />}
    </div>
  );
};
