/**
 * Révélation des éléments à l'entrée dans l'écran.
 *
 * L'application animait déjà ses listes, mais au montage : tout ce qui se
 * trouvait sous la ligne de flottaison avait fini de s'animer avant d'être vu.
 * Le mouvement était donc perdu là où il sert le plus — pendant le défilement.
 *
 * Un seul observateur pour toute l'application, plutôt qu'un par composant :
 * une page de catalogue porte des dizaines de vignettes, et autant
 * d'observateurs coûtent en mémoire et en travail de rendu pour un résultat
 * identique.
 *
 * Le point délicat est ailleurs. Masquer par CSS ce qu'un script doit révéler,
 * c'est parier que le script s'exécutera. Si le paquet échoue à charger, ou si
 * l'`IntersectionObserver` n'existe pas, la page reste vide — panne totale pour
 * un effet décoratif. D'où le drapeau posé sur `<html>` : le masquage n'existe
 * dans la feuille de style que si ce drapeau est là, et le drapeau n'est posé
 * que lorsque l'observateur est réellement en marche. Sans script, rien ne se
 * cache.
 */

const MARQUEUR = 'revelation-active';

let observateur: IntersectionObserver | null = null;

function observerLesNouveaux() {
  if (!observateur) return;
  document.querySelectorAll<HTMLElement>('[data-revele]:not([data-vu])').forEach((el) => {
    observateur!.observe(el);
  });
}

export function demarrerRevelation(): () => void {
  // Sans support, ou si le visiteur a demandé moins d'animation, on ne pose
  // pas le drapeau : tout reste visible, immédiatement.
  const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (typeof IntersectionObserver === 'undefined' || reduit) return () => {};

  document.documentElement.classList.add(MARQUEUR);

  observateur = new IntersectionObserver(
    (entrees) => {
      for (const entree of entrees) {
        // Intersecter n'est pas la seule raison de révéler. Un élément que le
        // défilement a dépassé — ancre cliquée, molette rapide, retour sur une
        // page déjà parcourue — se retrouve au-dessus de l'écran sans l'avoir
        // jamais croisé, et resterait invisible pour toujours. On le révèle
        // aussi : ce qui est derrière nous a été vu, par définition.
        const depasse = entree.boundingClientRect.bottom < 0;
        if (!entree.isIntersecting && !depasse) continue;
        const el = entree.target as HTMLElement;
        el.dataset.vu = '';
        // Une fois révélé, l'élément ne redevient jamais invisible : réanimer
        // au défilement inverse donne le tournis et fait clignoter les pages
        // longues.
        observateur?.unobserve(el);
      }
    },
    // La marge négative en bas déclenche un peu avant l'entrée réelle : le
    // mouvement doit être terminé quand l'œil arrive, pas commencer sous lui.
    { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
  );

  observerLesNouveaux();

  /*
   * Le balayage, et pourquoi il est nécessaire.
   *
   * L'`IntersectionObserver` ne rappelle que lorsque le taux d'intersection
   * CHANGE. Un élément qui passe de « sous l'écran » à « au-dessus » en une
   * seule image — ancre cliquée, molette lancée, retour à une position
   * mémorisée — reste à zéro d'un bout à l'autre : aucun rappel n'est émis, et
   * l'élément demeure invisible pour toujours.
   *
   * Mesuré : un saut direct en bas de l'accueil laissait cinq sections sur six
   * masquées. Le défaut est donc bien réel et pas théorique.
   *
   * Le balayage rattrape ce cas, et lui seul. Il ne tourne que tant qu'il reste
   * quelque chose à révéler, une fois par image au plus.
   */
  let planifie = false;
  const balayer = () => {
    planifie = false;
    const restants = document.querySelectorAll<HTMLElement>('[data-revele]:not([data-vu])');
    if (restants.length === 0) {
      window.removeEventListener('scroll', auDefilement);
      return;
    }
    restants.forEach((el) => {
      if (el.getBoundingClientRect().bottom < 0) {
        el.dataset.vu = '';
        observateur?.unobserve(el);
      }
    });
  };
  const auDefilement = () => {
    if (planifie) return;
    planifie = true;
    requestAnimationFrame(balayer);
  };
  window.addEventListener('scroll', auDefilement, { passive: true });

  // React monte et démonte au fil de la navigation : un observateur posé une
  // fois ne verrait jamais les écrans suivants.
  const mutations = new MutationObserver(() => {
    observerLesNouveaux();
    // Un nouvel écran remet du contenu à révéler : le balayage doit reprendre
    // même s'il s'était arrêté faute de travail.
    window.addEventListener('scroll', auDefilement, { passive: true });
  });
  mutations.observe(document.body, { childList: true, subtree: true });

  return () => {
    window.removeEventListener('scroll', auDefilement);
    mutations.disconnect();
    observateur?.disconnect();
    observateur = null;
    document.documentElement.classList.remove(MARQUEUR);
  };
}
