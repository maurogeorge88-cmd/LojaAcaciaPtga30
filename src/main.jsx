import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { TestComponents } from './TestComponents.jsx'  // ← ADICIONAR
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TestComponents />  {/* ← TROCAR App por TestComponents */}
  </React.StrictMode>,
)
