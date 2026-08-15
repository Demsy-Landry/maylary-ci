import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import FrontiereErreur from './components/FrontiereErreur'
import { installerOndeAuClic } from './lib/onde-clic'

// Le navigateur restaure le défilement lors d'un retour arrière. Dans une
// application à navigation interne, cette restauration arrive après notre
// propre remise en haut de page et la contredit : on la reprend à la main.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual'
}

installerOndeAuClic()

createRoot(document.getElementById('root')!).render(
  // La frontière enveloppe TOUT, y compris les fournisseurs de contexte : une
  // erreur dans l'un d'eux se produit au-dessus des routes, et une frontière
  // posée plus bas ne la verrait jamais passer.
  <StrictMode>
    <FrontiereErreur>
      <App />
    </FrontiereErreur>
  </StrictMode>,
)
