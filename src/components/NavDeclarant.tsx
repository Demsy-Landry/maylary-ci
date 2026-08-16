import { NavLink } from 'react-router-dom';
import { Compass, LayoutDashboard, History, CreditCard, Wrench, Sparkles, FileText, FileSpreadsheet } from 'lucide-react';

/**
 * La barre du service.
 *
 * Le Déclarant n'est plus un écran : c'est un espace, avec sa vitrine, son
 * atelier, son tableau de bord, son historique et son abonnement. Une barre
 * propre le dit mieux qu'un titre — le visiteur comprend qu'il est entré
 * quelque part, pas qu'il a ouvert une page.
 *
 * Elle défile horizontalement sur téléphone plutôt que de passer à la ligne :
 * cinq entrées sur deux lignes mangent le haut d'un petit écran, et l'atelier
 * a besoin de cette place.
 */
const ENTREES = [
  { to: '/declarant', fin: true, libelle: 'Le service', icone: Compass },
  { to: '/declarant/atelier', fin: false, libelle: 'Atelier', icone: Wrench },
  { to: '/declarant/classer', fin: false, libelle: 'Classer', icone: Sparkles },
  { to: '/declarant/simulateur', fin: false, libelle: 'Simulateur', icone: FileSpreadsheet },
  { to: '/declarant/declaration', fin: false, libelle: 'Déclaration', icone: FileText },
  { to: '/declarant/tableau-de-bord', fin: false, libelle: 'Tableau de bord', icone: LayoutDashboard },
  { to: '/declarant/historique', fin: false, libelle: 'Historique', icone: History },
  { to: '/declarant/abonnement', fin: false, libelle: 'Abonnement', icone: CreditCard },
];

export default function NavDeclarant() {
  return (
    <div className="border-b bg-card">
      <nav
        className="mx-auto flex max-w-screen-xl gap-1 overflow-x-auto px-2 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Le Déclarant"
      >
        {ENTREES.map((e) => {
          const Icone = e.icone;
          return (
            <NavLink
              key={e.to}
              to={e.to}
              end={e.fin}
              className={({ isActive }) =>
                'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition ' +
                (isActive
                  ? 'border-primary text-primary-emphasis'
                  : 'border-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground')
              }
            >
              <Icone className="h-4 w-4" />
              {e.libelle}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
