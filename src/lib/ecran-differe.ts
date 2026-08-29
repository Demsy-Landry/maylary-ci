/**
 * Charger un écran différé sans casser l'onglet resté ouvert.
 *
 * LE DÉFAUT, RELEVÉ EN PRODUCTION
 *
 * Quatre fois dans le journal des erreurs, dont une le 29 août à 23 h 26 sur
 * `/vendre` :
 *
 *     'text/html' is not a valid JavaScript MIME type.
 *     Failed to fetch dynamically imported module: .../CatalogueSecteurPro-Dw_yhSsf.js
 *
 * L'application découpe ses écrans en fichiers séparés, chargés au moment où
 * l'on y va. Chaque fichier porte une empreinte dans son nom, et cette
 * empreinte CHANGE à chaque déploiement.
 *
 * Un visiteur dont l'onglet est resté ouvert garde donc en mémoire les noms de
 * l'ANCIENNE version. Qu'il navigue vers un écran qu'il n'avait pas encore
 * ouvert, et le navigateur réclame un fichier qui n'existe plus. L'hébergeur,
 * qui renvoie la page d'accueil pour toute adresse inconnue — c'est ce qui fait
 * marcher les liens profonds — répond du HTML. Le chargeur de modules attend du
 * JavaScript, reçoit du HTML, et lève l'erreur ci-dessus.
 *
 * Le client, lui, voit « Cette page s'est arrêtée en chemin ». Rien n'est cassé
 * chez lui : sa version est simplement périmée.
 *
 * CE QUE FAIT CE CORRECTIF
 *
 * Il recharge la page une fois. Le rechargement va chercher le nouvel
 * `index.html`, donc les nouveaux noms de fichiers, et la navigation reprend
 * là où elle allait.
 *
 * POURQUOI UNE SEULE FOIS, ET POURQUOI DANS LA SESSION
 *
 * Si l'écran est réellement introuvable — un fichier absent du déploiement, une
 * panne de réseau — recharger en boucle enfermerait le visiteur dans un
 * clignotement sans fin. Le drapeau est donc posé AVANT le rechargement et
 * retiré au premier succès : une seule tentative, puis l'erreur remonte
 * normalement et l'écran d'erreur s'affiche, avec son code.
 *
 * Le drapeau vit dans le stockage de session : il disparaît à la fermeture de
 * l'onglet, ce qui est exactement la durée de vie du problème qu'il traite.
 */

const CLE = 'maylary.rechargement-ecran';

/** Vrai quand l'échec ressemble à un morceau de code devenu introuvable. */
function moduleIntrouvable(erreur: unknown): boolean {
  const texte = String(
    (erreur as { message?: unknown })?.message ?? erreur ?? '',
  ).toLowerCase();
  return (
    texte.includes('dynamically imported module') ||
    texte.includes('mime type') ||
    texte.includes('importing a module script failed') ||
    texte.includes('error loading dynamically imported module')
  );
}

function lire(): string | null {
  try {
    return sessionStorage.getItem(CLE);
  } catch {
    // Stockage refusé : on renvoie « déjà tenté » pour ne surtout pas boucler.
    return '1';
  }
}

function ecrire(valeur: string | null): void {
  try {
    if (valeur === null) sessionStorage.removeItem(CLE);
    else sessionStorage.setItem(CLE, valeur);
  } catch {
    /* stockage indisponible — sans conséquence */
  }
}

/**
 * Enveloppe un import différé pour qu'un déploiement en cours de visite ne
 * casse pas la navigation.
 *
 * À utiliser partout où l'on écrivait `lazy(() => import('…'))` :
 *
 *     const MonEcran = lazy(ecranDiffere(() => import('@/pages/MonEcran')));
 */
export function ecranDiffere<T>(charger: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      const module = await charger();
      // Un succès efface la trace : le prochain incident aura droit, lui aussi,
      // à sa tentative de rechargement.
      if (lire()) ecrire(null);
      return module;
    } catch (erreur) {
      if (!moduleIntrouvable(erreur) || lire()) throw erreur;

      ecrire('1');
      window.location.reload();

      // La page s'en va. On rend une promesse qui ne se résout jamais plutôt
      // que de laisser React afficher un écran d'erreur pendant le quart de
      // seconde qui précède le rechargement.
      return new Promise<T>(() => {});
    }
  };
}
