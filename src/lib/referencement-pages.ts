/**
 * Le titre et la description de chaque page, à un seul endroit.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI CETTE TABLE EXISTE
 *
 * Ces textes sont lus par DEUX chemins qui n'ont rien à voir l'un avec l'autre.
 *
 *  1. Le navigateur, et donc Google, qui exécute le JavaScript : `useReferencement`
 *     pose les balises après le rendu.
 *  2. Les robots d'aperçu — WhatsApp, Facebook, LinkedIn — qui n'exécutent RIEN.
 *     Une fonction serveur (`api/apercu.ts`) leur fabrique une page toute faite.
 *
 * Si chacun des deux avait sa propre copie des textes, ils divergeraient — et
 * personne ne le verrait, puisqu'on ne regarde jamais les deux en même temps.
 * Un titre corrigé d'un côté resterait faux de l'autre pendant des mois.
 *
 * D'où cette table : une seule source, deux lecteurs.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * COMMENT ÉCRIRE UN TITRE ICI
 *
 * Les mots distinctifs D'ABORD, le nom de la maison à la fin — il est ajouté
 * automatiquement. Un onglet, comme un résultat de recherche, se lit tronqué :
 * « MayLary Group — … » répété trente fois n'apprend rien à personne.
 *
 * Et jamais de montant ni de délai dans une description : ce qui est écrit ici
 * s'affiche dans Google et dans WhatsApp, hors de tout contexte, et y reste
 * longtemps après qu'un prix a changé.
 */

/** Ce qu'une page fixe déclare. Volontairement sans dépendance : cette table
 *  est aussi lue par une fonction serveur, qui ne connaît pas React. */
export interface MetaPage {
  titre: string;
  description: string;
  /** Vrai pour les écrans privés : panier, compte, suivi de dossier. */
  horsIndex?: boolean;
}

export const PAGES: Record<string, MetaPage> = {
  "/": {
    titre: "MayLary Group — Transit, import et export en Côte d'Ivoire",
    description:
      "Importez et exportez vos marchandises depuis Abidjan : recherche de fournisseur, fret aérien et maritime, assurance facultés, dédouanement et livraison. Devis détaillé et suivi de dossier en ligne.",
  },
  "/services": {
    titre: "Nos services : transit, import, export et sourcing",
    description:
      "Huit métiers pour faire venir ou partir une marchandise : import clé en main, export, sourcing fournisseur, groupage, boutique en ligne, espace professionnel, achats groupés et outils douaniers.",
  },
  "/import": {
    titre: "Importer une marchandise à Abidjan",
    description:
      "Décrivez ce que vous voulez acheter à l'étranger : nous chiffrons la marchandise, le fret, l'assurance, les droits et la livraison, puis nous exécutons. Vous suivez le dossier étape par étape.",
  },
  "/export": {
    titre: "Exporter depuis la Côte d'Ivoire",
    description:
      "Collecte, formalités d'export, expédition et suivi jusqu'à votre acheteur. Vous décrivez la marchandise et la destination, nous vous remettons un devis détaillé.",
  },
  "/boutique": {
    titre: "Boutique en ligne — livraison en Côte d'Ivoire",
    description:
      "Articles sélectionnés un par un et importés par MayLary Group : électronique, maison, beauté, mode. Prix affiché tout compris, transport coté sur votre panier réel.",
  },
  "/catalogue": {
    titre: "Espace Pro — achat en gros pour entreprises",
    description:
      "Catalogue professionnel par secteur d'activité, avec prix dégressifs selon la quantité et devis sur demande. Destiné aux entreprises, revendeurs et artisans.",
  },
  "/boutique/sourcing": {
    titre: "Sourcing sur demande — nous cherchons le produit pour vous",
    description:
      "L'article n'est pas au catalogue ? Décrivez-le : nous interrogeons nos fournisseurs et revenons vers vous avec un prix rendu Abidjan, tout compris.",
  },
  "/boutique/achats-groupes": {
    titre: "Achats groupés — le prix de gros à plusieurs",
    description:
      "Réunissez-vous sur une même référence pour atteindre la quantité qui déclenche le prix de gros. Chacun paie sa part et reçoit sa commande.",
  },
  "/vendre": {
    titre: "Vendre sur MayLary Group",
    description:
      "Ouvrez votre enseigne sur l'espace professionnel et présentez vos produits aux acheteurs de la plateforme. Inscription, conditions et fonctionnement du reversement.",
  },
  "/declarant": {
    titre: "Le Déclarant — position tarifaire et calcul des droits de douane",
    description:
      "Trouvez la position tarifaire d'une marchandise dans le Tarif Extérieur Commun UEMOA et calculez les droits et taxes exigibles. Un outil de préparation : la déclaration en détail reste signée par un commissionnaire agréé.",
  },
  "/declarant/atelier": {
    titre: "Atelier de liquidation — droits et taxes d'une importation",
    description:
      "Saisissez vos lignes tarifaires, le fret et l'assurance : l'atelier calcule la liquidation poste par poste à partir du tarif officiel, et vous rend un bulletin imprimable.",
  },
  "/declarant/classer": {
    titre: "Classer une marchandise au Système Harmonisé",
    description:
      "Décrivez une marchandise et obtenez sa position tarifaire, le raisonnement des Règles Générales Interprétatives qui l'a tranchée, et la vérification du code dans le corpus TEC officiel.",
  },
  "/declarant/declaration": {
    titre: "Déclaration en douane — préparation et simulation",
    description:
      "Préparez votre déclaration au modèle SYDAM World : en-tête, valeurs globales, lignes tarifaires et récapitulatif de liquidation, à partir des référentiels officiels.",
  },
  "/declarant/abonnement": {
    titre: "Formules d'abonnement au Déclarant",
    description:
      "Les formules d'accès aux outils douaniers de MayLary Group et ce que chacune permet : nombre de classements, de liquidations et de questions à l'assistant.",
  },
  "/poids-taxable": {
    titre: "Poids taxable : calculer le poids volumétrique",
    description:
      "Un transporteur facture le plus fort du poids réel et du poids volumétrique. Calculez l'unité payante de votre colis en aérien, en maritime et en routier, et comprenez ce qui la commande.",
  },
  "/a-propos": {
    titre: "À propos de MayLary Group",
    description:
      "Qui nous sommes, ce que nous prenons en charge dans une opération d'import ou d'export, et où s'arrête notre rôle. MayLary Group est une marque de Dems'Inc, à Abidjan.",
  },
  "/mentions-legales": {
    titre: "Mentions légales",
    description:
      "Éditeur du site, hébergement, propriété intellectuelle et coordonnées de MayLary Group, marque de Dems'Inc.",
  },
  "/conditions-generales": {
    titre: "Conditions générales de vente et de service",
    description:
      "Commande, paiement, garantie « payé, protégé », délais, réclamations et rétractation : les règles qui encadrent nos prestations et nos ventes.",
  },
  "/confidentialite": {
    titre: "Protection des données personnelles",
    description:
      "Quelles données nous conservons, pourquoi, combien de temps, et comment obtenir leur export ou leur suppression.",
  },
  "/cookies": {
    titre: "Cookies et stockage local",
    description:
      "Ce que ce site dépose sur votre appareil, à quoi cela sert, et comment l'effacer.",
  },
  "/boutique/panier": {
    titre: "Votre panier",
    description:
      "Votre panier d'achat.",
    horsIndex: true,
  },
  "/boutique/commande": {
    titre: "Finaliser la commande",
    description:
      "Coordonnées de livraison et règlement.",
    horsIndex: true,
  },
  "/boutique/compte": {
    titre: "Votre compte",
    description:
      "Votre compte boutique.",
    horsIndex: true,
  },
  "/boutique/mes-commandes": {
    titre: "Vos commandes",
    description:
      "Le suivi de vos commandes.",
    horsIndex: true,
  },
  "/mon-compte": {
    titre: "Votre compte",
    description:
      "Profil, documents et historique.",
    horsIndex: true,
  },
  "/import/mes-demandes": {
    titre: "Vos demandes d'import",
    description:
      "Le suivi de vos dossiers d'import.",
    horsIndex: true,
  },
  "/export/mes-demandes": {
    titre: "Vos demandes d'export",
    description:
      "Le suivi de vos dossiers d'export.",
    horsIndex: true,
  },
  "/catalogue/mes-devis": {
    titre: "Vos devis",
    description:
      "Vos demandes de devis professionnelles.",
    horsIndex: true,
  },
  "/mes-expeditions": {
    titre: "Vos expéditions",
    description:
      "Le suivi de vos expéditions.",
    horsIndex: true,
  },
  "/catalogue/devis": {
    titre: "Votre demande de devis",
    description:
      "Les articles retenus pour votre devis.",
    horsIndex: true,
  },
  "/declarant/tableau-de-bord": {
    titre: "Tableau de bord du Déclarant",
    description:
      "Votre activité sur les outils douaniers.",
    horsIndex: true,
  },
  "/declarant/historique": {
    titre: "Historique des liquidations",
    description:
      "Vos liquidations enregistrées.",
    horsIndex: true,
  },
  "/mot-de-passe-oublie": {
    titre: "Réinitialiser votre mot de passe",
    description:
      "Recevez un lien de réinitialisation.",
    horsIndex: true,
  },
};

/**
 * Plusieurs adresses mènent parfois au même écran — `/import` et
 * `/import/nouvelle-demande` affichent le même formulaire. On les rabat sur
 * une entrée unique plutôt que de dupliquer le texte.
 */
export const ALIAS: Record<string, string> = {
  "/import/nouvelle-demande": "/import",
  "/export/nouvelle-demande": "/export",
  "/vendre/espace": "/vendre",
  "/declarant/simulateur": "/declarant/declaration",
};

/** Retire la barre finale, sauf sur l'accueil. */
export function normaliser(chemin: string): string {
  const propre = chemin.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return propre || '/';
}

/** La fiche d'une adresse fixe, ou `null` si l'adresse n'en est pas une. */
export function metaDeLaPage(chemin: string): MetaPage | null {
  const propre = normaliser(chemin);
  return PAGES[ALIAS[propre] ?? propre] ?? null;
}

