import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installerOndeAuClic } from './lib/onde-clic'

// Le navigateur restaure le défilement lors d'un retour arrière. Dans une
// application à navigation interne, cette restauration arrive après notre
// propre remise en haut de page et la contredit : on la reprend à la main.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual'
}

installerOndeAuClic()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
