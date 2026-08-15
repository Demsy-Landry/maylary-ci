/**
 * La déclaration en détail, au modèle SYDAM World.
 *
 * SYDAM World est le système de dédouanement de la Direction Générale des
 * Douanes de Côte d'Ivoire. Sa déclaration en détail reprend la structure du
 * Document Administratif Unique, avec ses cases numérotées — la même grammaire
 * que SYDONIA/ASYCUDA dont il dérive.
 *
 * POURQUOI CE FICHIER EXISTE SÉPARÉMENT
 *
 * Les cases, leurs numéros et leur regroupement sont de la CONNAISSANCE MÉTIER,
 * pas de la mise en page. Les garder ici plutôt que dans le JSX permet de les
 * corriger sans toucher à l'écran, et de les réutiliser pour le PDF — qui doit
 * porter exactement les mêmes numéros, faute de quoi le document imprimé et
 * l'écran divergeraient.
 *
 * CE QUE CE FORMULAIRE N'EST PAS
 *
 * Ce n'est pas une déclaration déposable. Le dépôt se fait dans SYDAM World,
 * sous la signature d'un commissionnaire en douane agréé. Ce que la maison
 * produit ici est un BROUILLON DE DÉCLARATION : le document qu'on prépare, qu'on
 * fait relire au client, qu'on joint au dossier, et qui sert de bordereau de
 * saisie pour celui qui déposera. C'est écrit sur le document lui-même — un
 * papier qui ressemble à une déclaration officielle sans en être une est un
 * risque, pas un service.
 */

export type TypeChamp = 'texte' | 'nombre' | 'date' | 'long';

export interface CaseDeclaration {
  /** Le numéro de case du modèle. Il figure à l'écran ET sur le PDF. */
  numero: string;
  cle: string;
  libelle: string;
  type: TypeChamp;
  /** Ce que le déclarant doit y mettre, quand ce n'est pas évident. */
  aide?: string;
  /** Rempli automatiquement depuis la liquidation ou la classification. */
  auto?: boolean;
}

export interface GroupeCases {
  titre: string;
  description: string;
  cases: CaseDeclaration[];
}

/**
 * Les cases retenues, groupées par moment de la saisie.
 *
 * Le DAU complet compte 54 cases, dont une partie ne concerne que le transit
 * communautaire (cases 50 à 53) ou l'entrepôt (case 49). Elles sont écartées :
 * un formulaire qui demande vingt champs sans objet fait abandonner la saisie,
 * et une case vide sur un document remis à un client fait douter du reste.
 */
export const GROUPES_DECLARATION: GroupeCases[] = [
  {
    titre: 'Identification',
    description: 'Qui déclare, pour qui, et sous quel régime.',
    cases: [
      { numero: '1', cle: 'type_declaration', libelle: 'Type de déclaration', type: 'texte', aide: 'IM pour une importation, EX pour une exportation.' },
      { numero: '7', cle: 'numero_reference', libelle: 'Numéro de référence', type: 'texte', aide: 'Votre référence interne de dossier.' },
      { numero: '2', cle: 'exportateur', libelle: 'Exportateur / Expéditeur', type: 'long', aide: 'Nom et adresse complets du fournisseur étranger.' },
      { numero: '8', cle: 'destinataire', libelle: 'Destinataire / Importateur', type: 'long', aide: 'Nom, adresse et code importateur.' },
      { numero: '14', cle: 'declarant', libelle: 'Déclarant / Représentant', type: 'long', aide: 'Le commissionnaire en douane agréé qui signera.' },
      { numero: '37', cle: 'regime', libelle: 'Régime douanier', type: 'texte', auto: true, aide: 'Code à quatre chiffres — 4000 pour une mise à la consommation.' },
      { numero: '29', cle: 'bureau', libelle: 'Bureau de douane', type: 'texte', aide: 'Bureau d’entrée ou de sortie.' },
    ],
  },
  {
    titre: 'Origine et transport',
    description: 'D’où vient la marchandise, par quel moyen, et où elle se trouve.',
    cases: [
      { numero: '15', cle: 'pays_expedition', libelle: 'Pays d’expédition', type: 'texte' },
      { numero: '16', cle: 'pays_origine', libelle: 'Pays d’origine', type: 'texte', aide: 'Origine réelle de fabrication — elle décide du régime préférentiel.' },
      { numero: '17', cle: 'pays_destination', libelle: 'Pays de destination', type: 'texte' },
      { numero: '25', cle: 'mode_transport', libelle: 'Mode de transport à la frontière', type: 'texte', aide: 'Maritime, aérien, routier.' },
      { numero: '21', cle: 'moyen_transport', libelle: 'Identité du moyen de transport', type: 'texte', aide: 'Nom du navire, numéro de vol, immatriculation.' },
      { numero: '19', cle: 'conteneur', libelle: 'Conteneur', type: 'texte', aide: 'Numéro(s) de conteneur, ou « néant ».' },
      { numero: '27', cle: 'lieu_chargement', libelle: 'Lieu de chargement', type: 'texte' },
      { numero: '30', cle: 'localisation', libelle: 'Localisation des marchandises', type: 'texte', aide: 'Terminal, magasin sous douane, aire de dédouanement.' },
      { numero: '40', cle: 'document_precedent', libelle: 'Document précédent', type: 'texte', aide: 'Manifeste, connaissement, LTA.' },
    ],
  },
  {
    titre: 'Valeur et conditions',
    description: 'Ce qui a été payé, dans quelle monnaie, à quelles conditions.',
    cases: [
      { numero: '20', cle: 'incoterm', libelle: 'Conditions de livraison (Incoterm)', type: 'texte', aide: 'FOB, CFR, CIF, EXW…' },
      { numero: '22', cle: 'monnaie_facture', libelle: 'Monnaie et montant total facturé', type: 'texte' },
      { numero: '23', cle: 'taux_change', libelle: 'Taux de change', type: 'texte', aide: 'Euro : 655,957, taux légal fixe.' },
      { numero: '24', cle: 'nature_transaction', libelle: 'Nature de la transaction', type: 'texte', aide: 'Achat ferme, échantillon, retour…' },
      { numero: '12', cle: 'elements_valeur', libelle: 'Éléments de valeur (fret, assurance)', type: 'texte', auto: true },
      { numero: '46', cle: 'valeur_statistique', libelle: 'Valeur statistique (CAF)', type: 'nombre', auto: true },
    ],
  },
  {
    titre: 'Marchandises',
    description: 'Le détail des colis et des articles. C’est le cœur du document.',
    cases: [
      { numero: '5', cle: 'nombre_articles', libelle: 'Nombre d’articles', type: 'nombre', auto: true },
      { numero: '6', cle: 'total_colis', libelle: 'Total des colis', type: 'nombre' },
      { numero: '31', cle: 'marques_numeros', libelle: 'Marques, numéros et nature des colis', type: 'long' },
      { numero: '35', cle: 'masse_brute', libelle: 'Masse brute totale (kg)', type: 'nombre', auto: true },
      { numero: '38', cle: 'masse_nette', libelle: 'Masse nette totale (kg)', type: 'nombre' },
      { numero: '44', cle: 'documents_joints', libelle: 'Documents produits, certificats et autorisations', type: 'long', aide: 'FDI, RFCV, certificat d’origine, BSC, BURIDA…' },
    ],
  },
];

/** Les cases du détail d'un article, répétées pour chaque ligne. */
export const CASES_ARTICLE: CaseDeclaration[] = [
  { numero: '32', cle: 'numero', libelle: 'Article n°', type: 'texte', auto: true },
  { numero: '31', cle: 'designation', libelle: 'Désignation des marchandises', type: 'long' },
  { numero: '33', cle: 'position', libelle: 'Code des marchandises', type: 'texte', auto: true },
  { numero: '34', cle: 'origine', libelle: 'Pays d’origine', type: 'texte' },
  { numero: '35', cle: 'masse_brute', libelle: 'Masse brute (kg)', type: 'nombre' },
  { numero: '38', cle: 'masse_nette', libelle: 'Masse nette (kg)', type: 'nombre' },
  { numero: '36', cle: 'preference', libelle: 'Préférence', type: 'texte', aide: 'Code du régime préférentiel invoqué, ou vide.' },
  { numero: '41', cle: 'unites_sup', libelle: 'Unités supplémentaires', type: 'texte' },
  { numero: '42', cle: 'prix_article', libelle: 'Prix de l’article', type: 'nombre' },
];

/** L'état d'une déclaration en cours de saisie. */
export type ValeursDeclaration = Record<string, string>;

export interface ArticleDeclaration {
  numero: string;
  designation: string;
  position: string;
  origine: string;
  masse_brute: string;
  masse_nette: string;
  preference: string;
  unites_sup: string;
  prix_article: string;
}

export const articleVide = (n: number): ArticleDeclaration => ({
  numero: String(n),
  designation: '',
  position: '',
  origine: '',
  masse_brute: '',
  masse_nette: '',
  preference: '',
  unites_sup: '',
  prix_article: '',
});

/**
 * Ce qui manque pour que le brouillon soit remettable.
 *
 * On ne bloque pas la saisie sur ces manques — un déclarant remplit rarement
 * dans l'ordre, et un formulaire qui refuse d'avancer fait abandonner. On les
 * COMPTE, et on le dit avant l'impression : c'est le moment où l'oubli coûte.
 */
export const CASES_INDISPENSABLES = [
  'type_declaration',
  'destinataire',
  'regime',
  'bureau',
  'pays_origine',
  'incoterm',
  'valeur_statistique',
] as const;
