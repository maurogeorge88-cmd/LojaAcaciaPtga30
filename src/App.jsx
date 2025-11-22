import { useState } from 'react';

function App() {
  const [teste, setTeste] = useState('Sistema funcionando!');

  return (
    <div className="min-h-screen bg-blue-900 flex items-center justify-center">
      <div className="bg-white p-10 rounded-xl shadow-2xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          🔷 Loja Maçônica - TESTE
        </h1>
        <p className="text-gray-600 mb-4">{teste}</p>
        <button 
          onClick={() => setTeste('Botão clicado! ✅')}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
        >
          Testar
        </button>
      </div>
    </div>
  );
}

export default App;
