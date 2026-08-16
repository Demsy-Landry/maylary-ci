/**
 * La déclaration en détail : un seul modèle, pour un seul écran.
 *
 * Il y avait deux écrans qui faisaient chacun la moitié du travail. Le
 * simulateur calculait les droits mais ignorait les numéros de cases et le
 * carnet d'adresses ; la page de déclaration portait les cases mais ne
 * calculait rien. Un déclarant devait saisir deux fois pour obtenir un
 * document complet — et deux saisies, c'est deux occasions de divergence.
 *
 * Ce fichier réunit les deux modèles. Il porte :
 *   * les cases du modèle SYDAM World, avec leur NUMÉRO — c'est par lui qu'on
 *     ressaisit dans le système officiel, pas par le libellé ;
 *   * la liste dans laquelle chaque case se choisit, quand elle en a une ;
 *   * les unités, les modes de transport, les parités de droit ;
 *   * ce qui manque avant de pouvoir produire le document.
 *
 * Il ne porte AUCUN calcul de droits ou de taxes. Ceux-là viennent de
 * `app_e08c374bc4_liquider_declaration`, en base. Un moteur dupliqué côté
 * navigateur finit toujours par diverger de celui qui fait foi, et c'est le
 * client qui découvre l'écart sur sa facture.
 */

export type TypeChamp = 'texte' | 'nombre' | 'date' | 'long';

/**
 * La liste dans laquelle se choisit une case.
 *
 * `intervenant:*` n'est pas un référentiel figé mais le carnet d'adresses du
 * compte : ce qu'on a saisi une fois se propose à la fois suivante.
 */
export type SourceListe =
  | 'pays'
  | 'bureaux'
  | 'monnaies'
  | 'modesTransport'
  | 'naturesTransaction'
  | 'typesColis'
  | 'typesDeclaration'
  | 'regimes'
  | 'incoterms'
  | 'intervenant:exportateur'
  | 'intervenant:importateur'
  | 'intervenant:declarant';

export interface CaseDeclaration {
  /** Numéro du modèle. Il figure à l'écran ET sur le document. */
  numero: string;
  cle: string;
  libelle: string;
  type: TypeChamp;
  aide?: string;
  /** Rempli depuis la liquidation ou la classification, pas à la main. */
  auto?: boolean;
  liste?: SourceListe;
  /** La liste aide, mais n'interdit pas une valeur absente. */
  libre?: boolean;
  /** Boutons à icône plutôt que liste déroulante. */
  icones?: boolean;
}

export interface GroupeCases {
  numero: number;
  titre: string;
  description: string;
  cases: CaseDeclaration[];
}

/** Unités de la colonne « US » du Tarif Extérieur Commun. */
export const UNITES = [
  { code: 'U', libelle: 'Unité' },
  { code: 'KG', libelle: 'Kilogramme' },
  { code: 'L', libelle: 'Litre' },
  { code: 'M', libelle: 'Mètre' },
  { code: 'M2', libelle: 'Mètre carré' },
  { code: 'M3', libelle: 'Mètre cube' },
  { code: 'T', libelle: 'Tonne' },
  { code: 'BTE', libelle: 'Boîte' },
  { code: 'SAC', libelle: 'Sac' },
  { code: 'CTN', libelle: 'Carton' },
] as const;

/**
 * Les modes de transport, avec leur code du Document Administratif Unique.
 *
 * En boutons à icône plutôt qu'en liste : on remplit ce champ vingt fois par
 * jour, et l'œil va plus vite que la lecture.
 */
export const MODES_TRANSPORT = [
  { code: '1', libelle: 'Maritime', icone: 'ship' },
  { code: '4', libelle: 'Aérien', icone: 'plane' },
  { code: '3', libelle: 'Routier', icone: 'truck' },
  { code: '2', libelle: 'Ferroviaire', icone: 'train' },
] as const;

/** Le taux de conversion vers le franc CFA, quand il est de droit. */
export const PARITES_FIXES: Record<string, number> = {
  XOF: 1,
  // Ancrage légal, jamais une cotation du jour.
  EUR: 655.957,
  XAF: 1,
};

/**
 * Les cases, groupées par moment de la saisie.
 *
 * Le DAU complet compte 54 cases, dont une partie ne concerne que le transit
 * communautaire (50 à 53) ou l'entrepôt (49). Elles sont écartées : un
 * formulaire qui demande vingt champs sans objet fait abandonner la saisie, et
 * une case vide sur un document remis à un client fait douter du reste.
 */
export const GROUPES_DECLARATION: GroupeCases[] = [
  {
    numero: 1,
    titre: 'En-tête de la déclaration',
    description: 'Qui déclare, pour qui, sous quel régime et à quel bureau.',
    cases: [
      { numero: '1', cle: 'type_declaration', libelle: 'Type de déclaration', type: 'texte', liste: 'typesDeclaration' },
      { numero: '7', cle: 'reference', libelle: 'Référence déclaration', type: 'texte', aide: 'Votre référence interne de dossier.' },
      { numero: '37', cle: 'regime', libelle: 'Régime douanier', type: 'texte', liste: 'regimes' },
      { numero: '29', cle: 'bureau', libelle: 'Bureau de douane', type: 'texte', liste: 'bureaux', libre: true },
      { numero: '—', cle: 'date', libelle: 'Date', type: 'date' },
      { numero: '8', cle: 'importateur', libelle: 'Importateur / Destinataire', type: 'long', liste: 'intervenant:importateur', libre: true, aide: 'Nom, adresse et code importateur. Mémorisé pour la prochaine fois.' },
      { numero: '—', cle: 'rccm_cc', libelle: 'N° RCCM / CC de l’importateur', type: 'texte' },
      { numero: '2', cle: 'exportateur', libelle: 'Fournisseur / Exportateur', type: 'long', liste: 'intervenant:exportateur', libre: true, aide: 'Nom et adresse complets du fournisseur étranger.' },
      { numero: '14', cle: 'declarant', libelle: 'Déclarant / Représentant', type: 'long', liste: 'intervenant:declarant', libre: true, aide: 'Le commissionnaire en douane agréé qui signera.' },
    ],
  },
  {
    numero: 2,
    titre: 'Origine, transport et valeurs',
    description: 'D’où vient la marchandise, par quel moyen, et ce qui a été payé.',
    cases: [
      { numero: '15', cle: 'pays_expedition', libelle: 'Pays d’expédition', type: 'texte', liste: 'pays' },
      { numero: '16', cle: 'pays_origine', libelle: 'Pays d’origine', type: 'texte', liste: 'pays', aide: 'Origine réelle de fabrication — elle décide du régime préférentiel.' },
      { numero: '17', cle: 'pays_destination', libelle: 'Pays de destination', type: 'texte', liste: 'pays' },
      { numero: '25', cle: 'mode_transport', libelle: 'Mode de transport à la frontière', type: 'texte', icones: true },
      { numero: '21', cle: 'moyen_transport', libelle: 'Identité du moyen de transport', type: 'texte', aide: 'Nom du navire, numéro de vol, immatriculation.' },
      { numero: '19', cle: 'conteneur', libelle: 'Conteneur', type: 'texte', aide: 'Numéro(s) de conteneur, ou « néant ».' },
      { numero: '27', cle: 'lieu_chargement', libelle: 'Lieu de chargement', type: 'texte' },
      { numero: '30', cle: 'localisation', libelle: 'Localisation des marchandises', type: 'texte', aide: 'Terminal, magasin sous douane, aire de dédouanement.' },
      { numero: '40', cle: 'document_precedent', libelle: 'Document précédent', type: 'texte', aide: 'Manifeste, connaissement, LTA.' },
      { numero: '—', cle: 'numero_facture', libelle: 'N° Facture', type: 'texte' },
      { numero: '—', cle: 'numero_connaissement', libelle: 'N° Connaissement (BL / LTA)', type: 'texte' },
      { numero: '20', cle: 'incoterm', libelle: 'Conditions de livraison (Incoterm)', type: 'texte', liste: 'incoterms' },
      { numero: '24', cle: 'nature_transaction', libelle: 'Nature de la transaction', type: 'texte', liste: 'naturesTransaction' },
      { numero: '44', cle: 'documents_joints', libelle: 'Documents produits, certificats et autorisations', type: 'long', aide: 'FDI, RFCV, certificat d’origine, BSC, BURIDA…' },
    ],
  },
];

/**
 * L'ordre dans lequel un récapitulatif de liquidation se lit.
 *
 * Le moteur renvoie ses totaux dans un objet JSON, dont l'ordre des clés est
 * celui de Postgres et n'a aucun sens fiscal : le timbre tombait en deuxième
 * position, entre le droit de douane et le prélèvement communautaire. On
 * rétablit l'ordre du calcul — assiettes d'abord, TVA ensuite, redevances par
 * déclaration à la fin. Un code inconnu passe après, plutôt que d'être perdu.
 */
const ORDRE_TAXES = ['DD', 'RST', 'PCS', 'PUA', 'PCC', 'TVA', 'RPI', 'TS'];

export function taxesOrdonnees(totaux: Record<string, number>): [string, number][] {
  const rang = (code: string) => {
    const i = ORDRE_TAXES.indexOf(code);
    return i === -1 ? ORDRE_TAXES.length : i;
  };
  return Object.entries(totaux).sort(
    ([a], [b]) => rang(a) - rang(b) || a.localeCompare(b),
  );
}

/** Les cases du détail d'un article, répétées pour chaque ligne. */
export const CASES_ARTICLE: CaseDeclaration[] = [
  { numero: '31', cle: 'designation', libelle: 'Désignation des marchandises', type: 'long' },
  { numero: '33', cle: 'code_hs', libelle: 'Code des marchandises (HS)', type: 'texte' },
  { numero: '34', cle: 'origine', libelle: 'Pays d’origine', type: 'texte', liste: 'pays' },
  { numero: '36', cle: 'preference', libelle: 'Préférence', type: 'texte', aide: 'Code du régime préférentiel invoqué.' },
  { numero: '42', cle: 'fob', libelle: 'Prix de l’article (FOB)', type: 'nombre' },
  { numero: '35', cle: 'poids_brut', libelle: 'Masse brute (kg)', type: 'nombre' },
  { numero: '38', cle: 'poids_net', libelle: 'Masse nette (kg)', type: 'nombre' },
  { numero: '41', cle: 'quantite', libelle: 'Unités supplémentaires', type: 'nombre' },
  { numero: '41', cle: 'unite', libelle: 'Unité', type: 'texte' },
];

export interface ValeursDeclaration {
  [cle: string]: string;
}

export interface LigneDeclaration {
  cle: number;
  numero: string;
  designation: string;
  code_hs: string;
  origine: string;
  preference: string;
  fob: string;
  poids_brut: string;
  poids_net: string;
  quantite: string;
  unite: string;
  /** Renseignés par la classification assistée, jamais saisis à la main. */
  designation_tec: string | null;
  taux_dd: number | null;
  verifie: boolean;
}

export const valeursInitiales = (): ValeursDeclaration => ({
  type_declaration: 'IM',
  regime: '4000',
  pays_destination: 'CI',
  devise: 'XOF',
  taux_change: '1',
  // Pré-remplie, modifiable : on déclare presque toujours le jour même.
  date: new Date().toISOString().slice(0, 10),
  mode_transport: '1',
});

export const ligneVide = (numero: string, cle: number): LigneDeclaration => ({
  cle,
  numero,
  designation: '',
  code_hs: '',
  origine: '',
  preference: '',
  fob: '',
  poids_brut: '',
  poids_net: '',
  quantite: '',
  unite: 'U',
  designation_tec: null,
  taux_dd: null,
  verifie: false,
});

/**
 * Le sous-numéro d'une ligne éclatée : 1 devient 1.1, puis 1.2.
 *
 * L'éclatement sert quand un même colis porte deux positions tarifaires — cas
 * courant d'un lot mélangé. Les sous-lignes gardent le rang de leur parente
 * pour que la déclaration se relise dans l'ordre.
 */
export const prochainSousNumero = (lignes: LigneDeclaration[], parent: string): string => {
  const racine = parent.split('.')[0];
  const rang = lignes.filter((l) => l.numero.startsWith(`${racine}.`)).length + 1;
  return `${racine}.${rang}`;
};

/**
 * Ce qui manque avant de pouvoir produire le document.
 *
 * On ne bloque pas la SAISIE là-dessus — personne ne remplit une déclaration
 * dans l'ordre : on note ce qu'on sait, on appelle, on complète. On bloque la
 * GÉNÉRATION : un document remis à un client avec le bureau de douane vide
 * n'est pas un document.
 */
export function manquesAvantDocument(
  valeurs: ValeursDeclaration,
  lignes: LigneDeclaration[],
): string[] {
  const manques: string[] = [];
  const vide = (c: string) => !(valeurs[c] ?? '').trim();
  if (vide('reference')) manques.push('la référence');
  if (vide('bureau')) manques.push('le bureau de douane');
  if (vide('importateur')) manques.push('l’importateur');
  if (vide('pays_origine')) manques.push('le pays d’origine');
  if (vide('devise')) manques.push('la devise');
  if (!Number(valeurs.taux_change)) manques.push('le taux de change');
  const utiles = lignes.filter((l) => Number(l.fob) > 0);
  if (utiles.length === 0) manques.push('au moins une ligne avec une valeur FOB');
  else if (utiles.some((l) => !l.code_hs.trim())) manques.push('le code HS de chaque ligne');
  return manques;
}
