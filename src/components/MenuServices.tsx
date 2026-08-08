import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  PackageSearch,
  Ship,
  ShoppingBag,
  Building2,
  Search,
  Store,
  Users,
  ShieldCheck,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';

const SERVICES: { to: string; titre: string; icone: LucideIcon }[] = [
  { to: '/import/nouvelle-demande', titre: 'Importer', icone: PackageSearch },
  { to: '/export/nouvelle-demande', titre: 'Exporter', icone: Ship },
  { to: '/boutique', titre: 'Boutique', icone: ShoppingBag },
  { to: '/catalogue', titre: 'Espace Pro', icone: Building2 },
  { to: '/boutique/sourcing', titre: 'Sourcing sur demande', icone: Search },
  { to: '/boutique/achats-groupes', titre: 'Achats groupés', icone: Users },
  { to: '/vendre', titre: 'Vendre sur Maylary', icone: Store },
  { to: '/declarant', titre: 'Le Déclarant — douane', icone: ShieldCheck },
];

/**
 * Accès à tous les métiers depuis n'importe quelle page.
 *
 * L'en-tête ne pouvait pas les porter tous : sur un téléphone il n'en affichait
 * que deux, et les quatre autres n'étaient joignables que par la page d'accueil.
 * Un visiteur arrivé sur une fiche produit n'avait aucun chemin vers l'export ou
 * le sourcing.
 *
 * Un panneau plutôt qu'une rangée de boutons, parce que six libellés ne tiennent
 * pas sur 393 px sans repousser le reste de l'en-tête hors de l'écran.
 */
export default function MenuServices() {
  const [ouvert, setOuvert] = useState(false);
  /**
   * Position du panneau sur mobile, mesurée à l'ouverture.
   *
   * Un ancrage purement CSS ne marche pas ici : le bouton se trouve à gauche de
   * la barre, et un panneau aligné sur son bord droit part hors de l'écran —
   * il s'affichait tronqué, illisible. On mesure donc le bas du bouton et on
   * étale le panneau sur toute la largeur, comme le fait n'importe quel menu
   * mobile.
   */
  const [hautPanneau, setHautPanneau] = useState(0);
  const conteneur = useRef<HTMLDivElement>(null);

  // Un panneau qui ne se referme qu'en recliquant le bouton passe pour bloqué.
  // On ferme donc au clic extérieur et à la touche Échap, comme partout ailleurs.
  useEffect(() => {
    if (!ouvert) return;
    const auClic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    };
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false);
    };
    document.addEventListener('mousedown', auClic);
    document.addEventListener('keydown', auClavier);
    return () => {
      document.removeEventListener('mousedown', auClic);
      document.removeEventListener('keydown', auClavier);
    };
  }, [ouvert]);

  return (
    <div className="relative" ref={conteneur}>
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={ouvert}
        aria-haspopup="menu"
        onClick={() => {
          // Mesuré sur le conteneur et non sur le bouton : `Button` ne transmet
          // pas de ref, et une ref silencieusement nulle laissait le panneau
          // collé en haut de l'écran, par-dessus l'en-tête.
          const rect = conteneur.current?.getBoundingClientRect();
          if (rect) setHautPanneau(Math.round(rect.bottom + 6));
          setOuvert((o) => !o);
        }}
      >
        <LayoutGrid className="mr-1.5 h-4 w-4" />
        Services
      </Button>

      {ouvert && (
        <div
          role="menu"
          style={{ top: hautPanneau }}
          className="fixed inset-x-2 z-30 overflow-hidden rounded-md border bg-card py-1 text-foreground shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 sm:w-60"
        >
          {SERVICES.map((s) => {
            const Icone = s.icone;
            return (
              <Link
                key={s.to}
                to={s.to}
                role="menuitem"
                onClick={() => setOuvert(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted"
              >
                <Icone className="h-4 w-4 shrink-0 text-primary" />
                {s.titre}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
