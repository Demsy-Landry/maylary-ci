/**
 * Combien de temps une session reste ouverte.
 *
 * LE DÉFAUT QUE ÇA CORRIGE
 *
 * La session était rafraîchie automatiquement, sans fin. Un compte connecté une
 * fois le restait indéfiniment : il suffisait de rouvrir le navigateur des mois
 * plus tard pour retrouver l'espace d'administration ouvert, avec les
 * commandes, la comptabilité et les données des clients.
 *
 * DEUX RÉGIMES, PARCE QUE LES DEUX ESPACES N'EXPOSENT PAS LA MÊME CHOSE
 *
 * Un client voit ses propres commandes. Le déconnecter souvent est une gêne
 * sans contrepartie : il abandonnera son panier plus souvent qu'il ne sera
 * protégé.
 *
 * Un administrateur voit TOUTES les commandes, la comptabilité, les
 * coordonnées des clients, et peut changer les prix. Un écran laissé ouvert
 * dans un bureau partagé, un téléphone posé sur une table, un ordinateur
 * emprunté : c'est là qu'est le risque réel, et il se compte en minutes, pas en
 * semaines.
 *
 * DEUX BORNES, ET ELLES NE FONT PAS LE MÊME TRAVAIL
 *
 *   La DURÉE ABSOLUE part de la connexion et ne se renouvelle jamais. Elle
 *   garantit qu'une session finit, même utilisée tous les jours.
 *
 *   L'INACTIVITÉ part du dernier geste. Elle ferme l'écran oublié, celui que
 *   personne ne surveille — le cas le plus fréquent, et de loin.
 *
 * ⚠️ CE N'EST PAS UNE BARRIÈRE DE SÉCURITÉ
 *
 * Tout ceci vit dans le navigateur : c'est de l'hygiène, pas de la protection.
 * Quelqu'un qui détient un jeton volé ne passe pas par cet écran et n'est donc
 * pas arrêté par lui.
 *
 * La vraie borne est la durée de vie du jeton, réglée CÔTÉ SERVEUR dans les
 * paramètres d'authentification du projet. Tant qu'elle est longue, un jeton
 * dérobé reste valable longtemps, quoi que fasse ce fichier. Les deux se
 * complètent : le serveur borne ce qu'un voleur peut faire, ce fichier borne ce
 * qu'un écran oublié peut montrer.
 */

/** Les durées, en millisecondes. Un seul endroit à changer. */
const HEURE = 60 * 60 * 1000;
const JOUR = 24 * HEURE;

export const DUREES = {
  client: {
    /** Trente jours depuis la connexion, puis il faut se reconnecter. */
    absolue: 30 * JOUR,
    /** Sept jours sans revenir : la session se ferme. */
    inactivite: 7 * JOUR,
  },
  admin: {
    /** Une journée de travail. Une session d'administration ne dure pas la nuit. */
    absolue: 12 * HEURE,
    /** Quarante-cinq minutes sans un geste : l'écran oublié se ferme. */
    inactivite: 45 * 60 * 1000,
  },
} as const;

const CLE_DEBUT = 'maylary.session.debut';
const CLE_ACTIVITE = 'maylary.session.activite';

function lireHorodatage(cle: string): number | null {
  try {
    const brut = localStorage.getItem(cle);
    if (!brut) return null;
    const n = Number(brut);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function ecrireHorodatage(cle: string, valeur: number): void {
  try {
    localStorage.setItem(cle, String(valeur));
  } catch {
    /* stockage refusé : la session ne sera pas bornée, mais rien ne casse */
  }
}

/**
 * Marque le début d'une session, et seulement s'il n'est pas déjà marqué.
 *
 * Le point délicat : le jeton se renouvelle tout seul, plusieurs fois par
 * session. Réécrire le début à chaque renouvellement rendrait la durée absolue
 * sans effet — elle repartirait de zéro indéfiniment, ce qui est exactement le
 * défaut qu'on corrige. On n'écrit donc que si rien n'est encore écrit.
 */
export function ouvrirSession(): void {
  // Rien à faire si la session est déjà marquée. Cette fonction est appelée à
  // chaque événement d'authentification, renouvellement de jeton compris.
  if (lireHorodatage(CLE_DEBUT) !== null) return;

  // ET SURTOUT : ON NE TOUCHE PAS AU DERNIER SIGNE DE VIE D'UNE SESSION DÉJÀ
  // OUVERTE.
  //
  // La première version écrivait l'activité ici aussi. Conséquence, mesurée :
  // un administrateur absent depuis cinquante minutes rouvrait l'application et
  // restait connecté — le simple chargement de la page remettait le compteur à
  // zéro avant que le contrôle ne passe. La borne d'inactivité ne servait donc
  // qu'à l'onglet resté ouvert, et pas au cas le plus courant : revenir sur un
  // écran qu'on a quitté.
  const maintenant = Date.now();
  ecrireHorodatage(CLE_DEBUT, maintenant);
  ecrireHorodatage(CLE_ACTIVITE, maintenant);
}

/** Efface les marques : à appeler à la déconnexion, sinon la suivante hérite. */
export function fermerSession(): void {
  try {
    localStorage.removeItem(CLE_DEBUT);
    localStorage.removeItem(CLE_ACTIVITE);
  } catch {
    /* sans conséquence */
  }
}

/** Le dernier geste de l'utilisateur. */
export function noterActivite(): void {
  ecrireHorodatage(CLE_ACTIVITE, Date.now());
}

export type MotifFermeture = 'inactivite' | 'duree';

/**
 * La session doit-elle se fermer, et pourquoi.
 *
 * @returns `null` si elle reste ouverte, sinon le motif — qui sert à écrire au
 *          client ce qui s'est passé. « Vous avez été déconnecté » sans raison
 *          donne l'impression d'une panne.
 */
export function motifDeFermeture(estAdmin: boolean): MotifFermeture | null {
  const regime = estAdmin ? DUREES.admin : DUREES.client;
  const maintenant = Date.now();

  const debut = lireHorodatage(CLE_DEBUT);
  // Session déjà ouverte avant l'arrivée de ce contrôle : on démarre le compte
  // maintenant plutôt que de déconnecter tout le monde d'un coup.
  if (debut === null) {
    ouvrirSession();
    return null;
  }
  if (maintenant - debut > regime.absolue) return 'duree';

  const activite = lireHorodatage(CLE_ACTIVITE) ?? debut;
  if (maintenant - activite > regime.inactivite) return 'inactivite';

  return null;
}

/** Ce qu'on écrit au client, selon la raison. */
export function messageDeFermeture(motif: MotifFermeture, estAdmin: boolean): string {
  if (motif === 'inactivite') {
    return estAdmin
      ? 'Session fermée après quarante-cinq minutes sans activité. Reconnectez-vous.'
      : 'Session fermée après plusieurs jours sans activité. Reconnectez-vous.';
  }
  return estAdmin
    ? 'Une session d’administration dure douze heures. Reconnectez-vous.'
    : 'Votre session a atteint sa durée maximale. Reconnectez-vous.';
}
