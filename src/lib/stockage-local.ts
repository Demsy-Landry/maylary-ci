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

/** Efface ce que l'application a déposé, hors session en cours. */
export const effacerStockageNonEssentiel = (): void => {
  try {
    localStorage.removeItem(CLE_MESURE);
    localStorage.removeItem(CLE_INFORMATION);
  } catch {
    /* voir `ecrire` */
  }
};
