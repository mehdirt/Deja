import React from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/globals.css'
import { Popup } from './Popup'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
)
