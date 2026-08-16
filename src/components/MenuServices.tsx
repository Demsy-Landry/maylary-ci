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
  { to: '/vendre', titre: 'Vendre sur MayLary Group', icone: Store },
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
        onClick={() => setOuvert((o) => !o)}
      >
        <LayoutGrid className="mr-1.5 h-4 w-4" />
        Services
      </Button>

      {/* ANCRÉ AU BOUTON, ET NON À L'ÉCRAN.
          La version précédente posait le panneau en `fixed` avec un `top`
          mesuré UNE SEULE FOIS à l'ouverture. Dès qu'on défilait, il restait
          planté à sa coordonnée d'écran pendant que la page glissait dessous —
          et sur iPhone, où la barre du navigateur se replie en cours de
          défilement, il remontait carrément par-dessus l'en-tête, ses deux
          premières entrées coupées hors de l'écran.

          `absolute left-0 top-full` le raccroche au bouton : il descend avec
          lui, quel que soit le défilement, sans une ligne de calcul. Aligné à
          GAUCHE parce que le bouton est à gauche de la barre — un panneau
          aligné à droite partirait hors de l'écran vers la gauche, ce qui
          était le motif de la mesure d'origine.

          La largeur ne dépasse jamais l'écran, marges comprises. */}
      {ouvert && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-1 w-[min(15rem,calc(100vw-1.5rem))] overflow-hidden rounded-md border bg-card py-1 text-foreground shadow-lg"
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
