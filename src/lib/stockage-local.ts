/**
 * Ce que l'application dépose sur votre appareil — l'inventaire, en un endroit.
 *
 * LE CONSTAT, VÉRIFIÉ AVANT D'ÉCRIRE CE FICHIER
 *
 * L'application ne pose AUCUN cookie. Recherche de `document.cookie` dans tout
 * le code source : zéro occurrence. Pas de Google Analytics, pas de pixel
 * publicitaire, pas de traceur tiers, aucune balise chargée depuis un autre
 * domaine — la politique de sécurité de contenu du site l'interdit d'ailleurs
 * techniquement (`connect-src` et `script-src` sont limités à nous-mêmes et à
 * Supabase).
 *
 * Trois entrées seulement, toutes en `localStorage`, toutes sur l'appareil, et
 * toutes strictement nécessaires au service que le visiteur demande.
 *
 * POURQUOI IL N'Y A PAS DE BANDEAU DE CONSENTEMENT BLOQUANT
 *
 * Le consentement préalable s'impose aux traceurs de mesure d'audience et de
 * publicité. Le stockage strictement nécessaire à un service expressément
 * demandé par l'utilisateur — garder une session ouverte, garder un panier —
 * en est exempt, en droit ivoirien (loi n° 2013-450 du 19 juin 2013, ARTCI)
 * comme dans les régimes comparables.
 *
 * Poser une barrière « Accepter / Refuser » sur du stockage qu'on ne peut pas
 * refuser sans casser le panier serait un faux choix. On informe, on ne
 * simule pas.
 *
 * SI UNE MESURE D'AUDIENCE ARRIVE UN JOUR
 *
 * `consentementMesure()` existe pour ça, et rend `false` tant que rien n'a été
 * accepté. Un traceur qui serait ajouté sans passer par cette porte serait un
 * défaut, pas un oubli : la porte est là, elle est fermée, il faut une
 * décision de l'utilisateur pour l'ouvrir.
 */

export interface EntreeStockage {
  cle: string;
  libelle: string;
  role: string;
  duree: string;
  /** Nécessaire au service demandé : ne peut pas être refusé sans le casser. */
  necessaire: boolean;
}

/**
 * L'inventaire tel qu'il est réellement.
 *
 * Les clés de session et de panier sont écrites ici telles que le code les
 * pose — si l'une d'elles change sans que cette liste change, la page
 * d'information ment. C'est le seul endroit à tenir à jour.
 */
export const INVENTAIRE_STOCKAGE: EntreeStockage[] = [
  {
    cle: 'sb-<projet>-auth-token',
    libelle: 'Votre session',
    role: "Vous garder connecté d'une page à l'autre et d'une visite à l'autre. Contient le jeton d'accès délivré par notre hébergeur de comptes, jamais votre mot de passe.",
    duree: "Jusqu'à la déconnexion, ou l'expiration du jeton",
    necessaire: true,
  },
  {
    cle: 'maylary_panier_achat_gp',
    libelle: 'Votre panier boutique',
    role: 'Retenir les articles ajoutés au panier. Sans lui, le panier se vide au moindre rafraîchissement de page.',
    duree: "Jusqu'à la validation de la commande, ou le vidage du panier",
    necessaire: true,
  },
  {
    cle: 'maylary_panier_devis',
    libelle: 'Votre panier de devis professionnel',
    role: "Retenir les références retenues pour une demande de devis dans l'Espace Pro.",
    duree: "Jusqu'à l'envoi de la demande, ou le vidage du panier",
    necessaire: true,
  },
];

/** La décision du visiteur sur le bandeau d'information. */
const CLE_INFORMATION = 'maylary_information_stockage';
/** La porte, fermée, pour une mesure d'audience éventuelle. */
const CLE_MESURE = 'maylary_consentement_mesure';

/**
 * `localStorage` peut lever : navigation privée sur certains navigateurs,
 * quota atteint, stockage désactivé par une politique d'entreprise. Une
 * lecture qui lève au montage ferait tomber toute l'application pour un
 * bandeau d'information — ce serait absurde.
 */
const lire = (cle: string): string | null => {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
};

const ecrire = (cle: string, valeur: string): void => {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    /* Rien à faire : l'information aura été lue, elle sera simplement
       réaffichée à la prochaine visite. Mieux vaut la répéter que planter. */
  }
};

/** Vrai si le visiteur a déjà pris connaissance de l'information. */
export const informationLue = (): boolean => lire(CLE_INFORMATION) === 'lu';

export const marquerInformationLue = (): void => ecrire(CLE_INFORMATION, 'lu');

/**
 * Le consentement à une mesure d'audience.
 *
 * Rend `false` aujourd'hui dans tous les cas, puisque aucune mesure n'est en
 * place. Tout code qui voudrait déposer un traceur DOIT passer par ici.
 */
export const consentementMesure = (): boolean => lire(CLE_MESURE) === 'accepte';

export const deciderMesure = (accepte: boolean): void =>
  ecrire(CLE_MESURE, accepte ? 'accepte' : 'refuse');

/**
 * Une liste relue depuis le stockage, dont on a VÉRIFIÉ la forme.
 *
 * CE QUI EST ARRIVÉ SANS ELLE
 *
 * Les deux paniers se relisaient ainsi :
 *
 *     const brut = localStorage.getItem(CLE);
 *     return brut ? JSON.parse(brut) : [];
 *
 * Le `try` autour ne protège que de l'analyse. Or `JSON.parse` RÉUSSIT sur
 * « null » et sur « {"a":1} » : il rend alors un non-tableau, que le panier
 * range dans son état, et le premier `items.reduce(...)` lève. Comme les deux
 * paniers enveloppent toute l'application, ce n'est pas la boutique qui tombe,
 * c'est TOUT — sur chaque page, y compris celles qui n'ont pas de panier.
 *
 * Reproduit : un panier valant « null » ou un objet suffit à afficher l'écran
 * « Cette page s'est arrêtée en chemin » partout. Le défaut ne vit que sur
 * l'appareil du visiteur, donc il ne se voit sur aucun journal serveur — et il
 * survit au rechargement, puisque la valeur fautive reste écrite.
 *
 * On vérifie donc chaque élément, et on jette ce qui ne tient pas plutôt que
 * de tout perdre : un panier de trois articles dont un est corrompu doit
 * rendre deux articles, pas un écran d'erreur.
 */
export function lireListeStockee<T>(cle: string, valide: (e: unknown) => e is T): T[] {
  const brut = lire(cle);
  if (!brut) return [];
  try {
    const analyse: unknown = JSON.parse(brut);
    if (!Array.isArray(analyse)) return [];
    return analyse.filter(valide);
  } catch {
    return [];
  }
}

/**
 * Écrit une liste. L'échec est sans conséquence : le panier reste en mémoire
 * pour la session en cours, il ne survivra simplement pas à la fermeture. Un
 * stockage refusé — navigation privée, quota atteint — ne doit jamais faire
 * tomber l'écran du client.
 */
export const ecrireListeStockee = (cle: string, valeur: unknown): void =>
  ecrire(cle, JSON.stringify(valeur));

/** Efface ce que l'application a déposé, hors session en cours. */
export const effacerStockageNonEssentiel = (): void => {
  try {
    localStorage.removeItem(CLE_MESURE);
    localStorage.removeItem(CLE_INFORMATION);
  } catch {
    /* voir `ecrire` */
  }
};
