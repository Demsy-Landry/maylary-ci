/**
 * Transition à chaque changement de page.
 *
 * Une application qui bascule d'un écran à l'autre sans transition donne
 * l'impression de sauter. On rejoue une entrée courte à chaque navigation, en
 * se servant du chemin comme clé de remontage.
 *
 * La remise à zéro du défilement est traitée ici aussi : sans elle, on arrive
 * en bas d'une nouvelle page après avoir fait défiler la précédente.
 */
import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

export default function TransitionDePage({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  useEffect(() => {
    // 'instant' plutôt qu'un défilement animé : sur un changement de page,
    // faire remonter l'écran lentement donne une impression de latence.
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return (
    <div key={pathname} className="animate-page">
      {children}
    </div>
  );
}
