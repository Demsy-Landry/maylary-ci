import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { informationLue, marquerInformationLue } from '@/lib/stockage-local';
import { Cookie, X } from 'lucide-react';

/**
 * Le bandeau d'information — et ce qu'il ne fait pas.
 *
 * Il ne demande pas de consentement, parce qu'il n'y a rien à consentir : le
 * site ne pose aucun cookie et ne charge aucun traceur. Les trois entrées de
 * stockage sont celles sans lesquelles le panier se vide et la session tombe.
 *
 * Poser une barrière « Accepter / Refuser » là-dessus serait un faux choix —
 * refuser casserait le service, donc le bouton « Refuser » serait un piège.
 * Le bandeau informe et disparaît.
 *
 * DEUX DÉTAILS QUI FONT LA DIFFÉRENCE À L'USAGE
 *
 * **Il ne s'affiche pas immédiatement.** Un bandeau qui saute au visage
 * pendant que la page se peint donne l'impression d'un site qui réclame avant
 * de servir. Une seconde d'attente, et il monte doucement.
 *
 * **Il ne couvre pas le bas de l'écran sur téléphone.** Sur un écran de
 * 390 px, un bandeau pleine largeur en bas mange la zone des boutons d'appel
 * à l'action. Il est ancré en bas mais laissé étroit et refermable d'un geste.
 */
export default function BandeauStockage() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (informationLue()) return;
    const minuteur = setTimeout(() => setVisible(true), 1100);
    return () => clearTimeout(minuteur);
  }, []);

  if (!visible) return null;

  const fermer = () => {
    marquerInformationLue();
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Information sur le stockage local"
      className="fixed inset-x-0 bottom-0 z-50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-3 rounded-xl border bg-card p-4 shadow-lg motion-safe:animate-[ouverture-montee_420ms_cubic-bezier(0.16,1,0.3,1)_both] sm:flex-row sm:items-center">
        <Cookie className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />

        <p className="flex-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          <strong className="text-foreground">Ce site n’utilise aucun cookie</strong> et aucun
          traceur publicitaire. Il garde seulement, sur votre appareil, votre session et votre
          panier — sans quoi ils se videraient à chaque page.{' '}
          <Link to="/cookies" className="font-medium text-primary hover:underline">
            Le détail
          </Link>
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" onClick={fermer} className="bouton-anime">
            J’ai compris
          </Button>
          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
