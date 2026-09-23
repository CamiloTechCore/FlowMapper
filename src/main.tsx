import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/claude-design.css'
import './styles/gallery.css'
import './index.css'
import './styles/integration.css'
import App from './AppShell.jsx'
import './styles/white-theme.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
