import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'

import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Per-route <title> and meta live in each page via <PageMeta>. */}
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>
)
