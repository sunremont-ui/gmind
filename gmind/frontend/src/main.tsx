import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/lumen.css'
import { App } from './App'
import { offlineStorage } from './utils/offline'
import type { Workbook } from './types'

declare global {
  interface Window {
    __gmindCacheWorkbook?: (wb: Workbook) => void
  }
}

window.__gmindCacheWorkbook = (wb: Workbook) => {
  offlineStorage.saveWorkbook(wb).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
