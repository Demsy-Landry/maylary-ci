import { useCallback, useEffect, useRef, useState } from 'react';
import { lireStockage, ecrireStockage } from '@/lib/stockage-local';

/**
 * Un bouton flottant que l'utilisateur déplace où il veut.
 *
 * POURQUOI CE N'EST PAS QU'UN CONFORT
 *
 * Un bouton posé en bas à droite finit toujours par recouvrir quelque chose :
 * le total d'un panier, le bouton « Chercher » d'un formulaire, la dernière
 * ligne d'un tableau. Sur un téléphone il n'y a nulle part où se pousser. Le
 * laisser déplacer, c'est laisser le client régler lui-même un conflit qu'on
 * ne peut pas anticiper pour tous les écrans.
 *
 * DÉPLACER N'EST PAS CLIQUER
 *
 * Tout l'enjeu tient là. Un bouton qu'on traîne de trois pixels et qui s'ouvre
 * quand même est un bouton qui s'ouvre par accident ; un bouton qu'il faut
 * traîner pour qu'il réagisse ne s'ouvre jamais. On distingue les deux par la
 * DISTANCE parcourue : en deçà du seuil c'est un appui, au-delà c'est un
 * déplacement, et le clic est alors supprimé.
 *
 * `pointerdown` plutôt que `mousedown`/`touchstart` : un seul jeu d'événements
 * pour le doigt, la souris et le stylet, et la capture du pointeur garantit
 * qu'un doigt sorti du bouton continue de le tirer.
 *
 * CE QU'IL NE FAUT PAS PERDRE
 *
 * La position est bornée à l'écran à chaque rendu ET à chaque redimensionnement.
 * Sans ça, un bouton posé en bas d'un grand écran devient introuvable après un
 * passage en paysage ou sur un téléphone plus petit — déplaçable, oui, mais
 * plus jamais récupérable.
 */

/** Clé d'inventaire : elle figure aussi dans `INVENTAIRE_STOCKAGE`. */
export const CLE_POSITION_DECLARANT = 'maylary_position_declarant';

/** Au-delà, c'est un déplacement et non un appui. */
const SEUIL_DEPLACEMENT = 6;

/** Marge minimale au bord, pour que le bouton reste attrapable. */
const MARGE = 8;

export interface Position {
  x: number;
  y: number;
}

const borner = (p: Position, largeur: number, hauteur: number): Position => ({
  x: Math.min(Math.max(p.x, MARGE), Math.max(MARGE, window.innerWidth - largeur - MARGE)),
  y: Math.min(Math.max(p.y, MARGE), Math.max(MARGE, window.innerHeight - hauteur - MARGE)),
});

const lirePosition = (): Position | null => {
  const brut = lireStockage(CLE_POSITION_DECLARANT);
  if (!brut) return null;
  try {
    const p: unknown = JSON.parse(brut);
    if (typeof p !== 'object' || p === null) return null;
    const { x, y } = p as Position;
    /* Même prudence que pour le panier : `JSON.parse` réussit sur bien des
     * formes qui ne sont pas la nôtre. On vérifie avant de s'en servir. */
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  } catch {
    return null;
  }
};

export function useBoutonDeplacable() {
  const element = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState<Position | null>(lirePosition);
  const [enDeplacement, setEnDeplacement] = useState(false);

  /* L'écart entre le point saisi et le coin du bouton : sans lui, le bouton
   * saute pour centrer son coin sous le doigt au premier mouvement. */
  const ecart = useRef({ x: 0, y: 0 });
  const depart = useRef({ x: 0, y: 0 });
  const aBouge = useRef(false);

  /** Après rotation ou changement d'écran, on ramène le bouton dans le cadre. */
  useEffect(() => {
    const auRedimensionnement = () => {
      const boite = element.current?.getBoundingClientRect();
      if (!boite) return;
      setPosition((p) => (p ? borner(p, boite.width, boite.height) : p));
    };
    window.addEventListener('resize', auRedimensionnement);
    window.addEventListener('orientationchange', auRedimensionnement);
    return () => {
      window.removeEventListener('resize', auRedimensionnement);
      window.removeEventListener('orientationchange', auRedimensionnement);
    };
  }, []);

  const auPointeur = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const boite = e.currentTarget.getBoundingClientRect();
    ecart.current = { x: e.clientX - boite.left, y: e.clientY - boite.top };
    depart.current = { x: e.clientX, y: e.clientY };
    aBouge.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    setEnDeplacement(true);
  }, []);

  const auMouvement = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!enDeplacement) return;
    const parcouru = Math.hypot(e.clientX - depart.current.x, e.clientY - depart.current.y);
    if (!aBouge.current && parcouru < SEUIL_DEPLACEMENT) return;
    aBouge.current = true;
    const boite = e.currentTarget.getBoundingClientRect();
    setPosition(
      borner(
        { x: e.clientX - ecart.current.x, y: e.clientY - ecart.current.y },
        boite.width,
        boite.height,
      ),
    );
  }, [enDeplacement]);

  const auRelachement = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!enDeplacement) return;
    setEnDeplacement(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (aBouge.current) {
      setPosition((p) => {
        if (p) ecrireStockage(CLE_POSITION_DECLARANT, JSON.stringify(p));
        return p;
      });
    }
  }, [enDeplacement]);

  /** Un déplacement ne doit pas ouvrir le panneau. */
  const clicAnnule = useCallback(() => aBouge.current, []);

  /** Rendre au bouton sa place d'origine, en bas à droite. */
  const reinitialiser = useCallback(() => {
    setPosition(null);
    ecrireStockage(CLE_POSITION_DECLARANT, '');
  }, []);

  return {
    element,
    position,
    enDeplacement,
    clicAnnule,
    reinitialiser,
    gestes: {
      onPointerDown: auPointeur,
      onPointerMove: auMouvement,
      onPointerUp: auRelachement,
      onPointerCancel: auRelachement,
    },
  };
}
