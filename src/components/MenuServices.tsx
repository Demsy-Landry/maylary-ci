import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  X,
  type LucideIcon,
} from 'lucide-react';

const SERVICES: { to: string; titre: string; sous: string; icone: LucideIcon }[] = [
  { to: '/import/nouvelle-demande', titre: 'Importer', sous: 'Faire venir une marchandise', icone: PackageSearch },
  { to: '/export/nouvelle-demande', titre: 'Exporter', sous: 'Expédier depuis la Côte d’Ivoire', icone: Ship },
  { to: '/boutique', titre: 'Boutique', sous: 'Acheter au détail', icone: ShoppingBag },
  { to: '/catalogue', titre: 'Espace Pro', sous: 'Acheter en gros', icone: Building2 },
  { to: '/boutique/sourcing', titre: 'Sourcing sur demande', sous: 'Nous cherchons pour vous', icone: Search },
  { to: '/boutique/achats-groupes', titre: 'Achats groupés', sous: 'À plusieurs, au prix de gros', icone: Users },
  { to: '/vendre', titre: 'Vendre sur MayLary Group', sous: 'Ouvrir votre boutique', icone: Store },
  { to: '/declarant', titre: 'Le Déclarant', sous: 'Calcul et déclaration en douane', icone: ShieldCheck },
];

/**
 * Accès à tous les métiers depuis n'importe quelle page.
 *
 * POURQUOI UN PANNEAU LATÉRAL, ET NON PLUS UNE LISTE DÉROULANTE
 *
 * La liste pendait sous le bouton, dans le flux de la page. Elle héritait donc
 * de tous les défauts d'un menu ancré : largeur bornée par l'écran, hauteur
 * bornée par ce qui restait dessous, et une bataille permanente avec la barre
 * du navigateur mobile qui se replie au défilement.
 *
 * Un panneau latéral ne dépend de rien de tout cela. Il occupe sa propre
 * couche, toute la hauteur, et se ferme d'un geste. C'est aussi la forme que
 * tout le monde connaît : sur un téléphone, un menu qui vient du côté se lit
 * sans qu'on ait à l'apprendre.
 *
 * Le gain n'est pas que de place. Chaque entrée peut enfin porter une ligne
 * d'explication — « Sourcing sur demande » ne dit rien à qui ne connaît pas le
 * mot, « Nous cherchons pour vous » le dit.
 *
 * TROIS CHOSES QU'UN PANNEAU DOIT FAIRE, ET QU'ON OUBLIE SOUVENT
 *
 * Se fermer de trois façons — le voile, la croix, la touche Échap. Un panneau
 * qui ne se ferme que par un bouton précis passe pour bloqué.
 *
 * Bloquer le défilement de la page dessous. Sans cela, le doigt qui veut faire
 * défiler le menu fait défiler la page derrière, et le panneau paraît cassé.
 *
 * Rendre la barre système au système. `pt-[env(safe-area-inset-top)]` garde le
 * titre sous l'encoche, `pb-[env(safe-area-inset-bottom)]` garde la dernière
 * entrée au-dessus de la barre de geste — sinon elle est là, mais intouchable.
 */
interface Props {
  /**
   * Habillage du bouton d'ouverture.
   *
   * La page de couverture pose son en-tête PAR-DESSUS la photographie : le gris
   * du bouton fantôme y était illisible, et un menu qu'on ne voit pas n'existe
   * pas. `sombre` bascule le texte en blanc et le survol en voile clair — la
   * même règle que les autres liens de ce bandeau.
   */
  surFondSombre?: boolean;
}

export default function MenuServices({ surFondSombre = false }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const fermeture = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!ouvert) return;

    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false);
    };
    document.addEventListener('keydown', auClavier);

    // La page ne doit pas glisser derrière le panneau. On restitue la valeur
    // d'origine plutôt que de forcer `auto` : une autre couche a pu la poser.
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Le focus part sur la croix : au clavier comme au lecteur d'écran, on
    // entre dans le panneau au lieu de rester sur le bouton qui l'a ouvert.
    fermeture.current?.focus();

    return () => {
      document.removeEventListener('keydown', auClavier);
      document.body.style.overflow = avant;
    };
  }, [ouvert]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={ouvert}
        aria-haspopup="dialog"
        onClick={() => setOuvert(true)}
        className={
          surFondSombre
            ? 'text-white/85 hover:bg-white/10 hover:text-white focus-visible:ring-white/40'
            : undefined
        }
      >
        {/* LE MOT S'EFFACE SOUS 640 px, PAS L'ACCESSIBILITÉ.
            Sur la couverture, ce bouton voisine le nom de la marque — qui ne
            peut pas se couper — et le bouton de connexion. À 360 px les trois
            ne tenaient plus : la page débordait de 24 px vers la droite, et il
            fallait la pousser du doigt pour lire une ligne. Mesuré sur le
            paquet construit, pas supposé.
            `sr-only` garde le mot pour les lecteurs d'écran : le bouton
            s'annonce toujours « Services », il ne l'écrit simplement plus. */}
        <LayoutGrid className="h-4 w-4 sm:mr-1.5" />
        <span className="sr-only sm:not-sr-only">Services</span>
      </Button>

      {/* PORTÉ SUR LE CORPS DU DOCUMENT, ET C'EST INDISPENSABLE.
          Le panneau est en `fixed`, donc censé se caler sur l'écran. Mais il
          vit dans l'en-tête, lui-même dans un conteneur `.animate-page` qui
          porte une transform d'animation — et une transform, même identité,
          fait de l'élément le repère de tous les `fixed` qu'il contient.
          Mesuré : le panneau faisait 2 768 px de haut, la hauteur de la PAGE,
          au lieu des 844 px de l'écran.

          Le sortir par un portail le raccroche à l'écran une fois pour toutes,
          et l'immunise contre la prochaine animation qu'on posera au-dessus. */}
      {ouvert && createPortal(
        <>
          {/* Le voile assombrit la page et reçoit le clic de fermeture. Il est
              `aria-hidden` : ce n'est pas un bouton, c'est une surface. La
              croix et la touche Échap portent la fermeture accessible. */}
          <div
            aria-hidden="true"
            onClick={() => setOuvert(false)}
            className="fixed inset-0 z-40 bg-foreground/60 motion-safe:animate-[voile_180ms_ease-out]"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nos services"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,86vw)] flex-col border-r bg-card shadow-2xl motion-safe:animate-[tiroir_220ms_cubic-bezier(0.22,1,0.36,1)]"
          >
            <div className="flex items-center justify-between border-b px-4 pb-3 pt-[calc(0.875rem+env(safe-area-inset-top))]">
              <p className="font-display text-base font-semibold text-foreground">Nos services</p>
              <button
                ref={fermeture}
                type="button"
                onClick={() => setOuvert(false)}
                aria-label="Fermer le menu"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* `overflow-y-auto` sur la liste seule : le titre reste en place
                pendant qu'on parcourt les entrées. */}
            <nav className="flex-1 overflow-y-auto py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
              {SERVICES.map((s) => {
                const Icone = s.icone;
                return (
                  <Link
                    key={s.to}
                    to={s.to}
                    onClick={() => setOuvert(false)}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icone className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{s.titre}</span>
                      <span className="block text-xs text-muted-foreground">{s.sous}</span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
