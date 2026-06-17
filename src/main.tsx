import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import './shared/i18n'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
