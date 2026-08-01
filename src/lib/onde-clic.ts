/**
 * Onde au point de contact, sur tous les boutons de l'application.
 *
 * Posée une fois au démarrage plutôt que composant par composant : un bouton
 * ajouté demain répondra sans qu'on ait à y penser, et un bouton oublié ne peut
 * pas exister.
 *
 * L'écoute est passive et en phase de capture, donc insensible à un
 * `stopPropagation` d'un gestionnaire applicatif.
 */

/** Durée de l'animation dans la feuille de style ; sert à retirer la classe. */
const DUREE_ONDE_MS = 480;

export function installerOndeAuClic() {
  // Certaines personnes règlent leur système pour éviter les animations.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.addEventListener(
    'pointerdown',
    (evenement) => {
      const cible = (evenement.target as Element | null)?.closest?.('.bouton-anime');
      if (!(cible instanceof HTMLElement) || cible.hasAttribute('disabled')) return;

      const boite = cible.getBoundingClientRect();
      cible.style.setProperty('--onde-x', `${evenement.clientX - boite.left}px`);
      cible.style.setProperty('--onde-y', `${evenement.clientY - boite.top}px`);

      // Retirer puis remettre la classe redémarre l'animation quand on clique
      // deux fois de suite ; sans cela, le second clic resterait sans effet.
      cible.classList.remove('onde');
      void cible.offsetWidth;
      cible.classList.add('onde');

      window.setTimeout(() => cible.classList.remove('onde'), DUREE_ONDE_MS);
    },
    { capture: true, passive: true },
  );
}
