import React from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/globals.css'
import { Library } from './Library'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Library />
  </React.StrictMode>,
)
