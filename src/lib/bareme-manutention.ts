/**
 * L'acconage n'est pas un forfait : il se lit dans une grille.
 *
 * LE REPROCHE DU FONDATEUR, ET IL EST JUSTE
 *
 * « Te fournir ces montants serait une très grosse erreur ou du mensonge, car
 * ils ne sont pas fixes : tout dépend de la marchandise, du poids et d'autres
 * paramètres internes à chaque compagnie. »
 *
 * Exact, et c'était le défaut de forme du premier modèle : un montant unique
 * par poste supposait un tarif fixe. Le barème FEDERMAR montre la vraie
 * structure — le tarif de manutention terre dépend de QUATRE choses :
 *
 *   1. le SENS            import, export, transit
 *   2. la CATÉGORIE       de C1 à C5, selon la nature de la marchandise
 *   3. la TAILLE          20 ou 40 pieds
 *   4. le POIDS           au-delà d'un seuil, une surcharge colis lourd
 *
 * Un décapsuleur et un sac de riz ne paient donc pas le même acconage, dans le
 * même conteneur, sur le même navire. Le riz est en C1 « première nécessité »,
 * le décapsuleur en C4 « marchandises diverses » — 67 600 contre 140 400 francs
 * pour un 20 pieds, soit plus du double.
 *
 * CE QUI EST DEUX POSTES ET NON UN
 *
 * Acconage et relevage se facturent ensemble mais se lisent séparément dans le
 * barème, et ne suivent pas le même rapport entre catégories. On les garde
 * distincts : une facture de terminal les distingue, un rapprochement doit
 * pouvoir se faire ligne à ligne.
 *
 * POURQUOI LE DÉFAUT EST LA CATÉGORIE LA PLUS CHÈRE
 *
 * « Marchandises diverses » est la catégorie fourre-tout, et c'est aussi la
 * plus chère. Classer par défaut vers elle ne peut donc que SURESTIMER le coût,
 * jamais le sous-estimer. Une erreur de classement coûte alors une opération
 * qu'on aurait pu faire ; l'erreur inverse coûte de l'argent réellement décaissé
 * sur une marchandise déjà à quai. Entre les deux, le choix est fait.
 *
 * CE QUE CE BARÈME NE COUVRE PAS
 *
 * Il porte sur les marchandises CONTENEURISÉES, et se compte AU CONTENEUR. En
 * groupage, ce n'est pas nous qui le payons : le groupeur l'acquitte pour le
 * conteneur entier et le refacture dans son tarif au mètre cube. Ne pas
 * l'ajouter dans ce cas — ce serait le compter deux fois.
 *
 * Il ne dit rien non plus de l'échange de connaissement, du magasinage ni du
 * retrait documentaire : ceux-là varient d'une compagnie à l'autre et restent
 * dans `frais-destination`, sans montant tant qu'une facture ne l'a pas donné.
 */

export type SensManutention = 'import' | 'export' | 'transit_import' | 'transit_export';
export type TailleConteneur = 20 | 40;

export interface LigneBareme {
  sens: SensManutention;
  categorie: string;
  libelle_categorie: string;
  taille_conteneur: TailleConteneur;
  acconage_fcfa: number;
  relevage_fcfa: number;
  surcharge_colis_lourd: boolean;
  seuil_colis_lourd_tonnes: number | null;
  categorie_par_defaut: boolean;
  mots_cles: string[];
  source: string;
  date_application: string;
  actif: boolean;
  note: string | null;
}

/** Sans accents ni casse : « Céréales » et « cereales » doivent se rencontrer. */
const aplatir = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * La catégorie qui correspond à une désignation de marchandise.
 *
 * Rend aussi le mot-clé qui a décidé, pour que l'administrateur puisse
 * contester le classement plutôt que de subir un chiffre sans explication.
 */
export function classerMarchandise(
  bareme: LigneBareme[],
  sens: SensManutention,
  designation: string,
): { categorie: string; libelle: string; motif: string } | null {
  const lignes = bareme.filter((l) => l.actif && l.sens === sens);
  if (lignes.length === 0) return null;

  const texte = aplatir(designation);

  /* Le mot-clé le plus long l'emporte : « tomates pelees » doit battre
     « tomates » si les deux figurent, sans quoi le classement dépendrait de
     l'ordre des lignes en base. */
  let meilleur: { ligne: LigneBareme; mot: string } | null = null;
  for (const ligne of lignes) {
    if (ligne.categorie_par_defaut) continue;
    for (const mot of ligne.mots_cles) {
      if (!texte.includes(aplatir(mot))) continue;
      if (!meilleur || mot.length > meilleur.mot.length) meilleur = { ligne, mot };
    }
  }

  if (meilleur) {
    return {
      categorie: meilleur.ligne.categorie,
      libelle: meilleur.ligne.libelle_categorie,
      motif: `« ${meilleur.mot} » reconnu dans la désignation`,
    };
  }

  const defaut = lignes.find((l) => l.categorie_par_defaut);
  if (!defaut) return null;
  return {
    categorie: defaut.categorie,
    libelle: defaut.libelle_categorie,
    motif: 'aucun mot-clé reconnu — catégorie par défaut, la plus chère du barème',
  };
}

export interface ManutentionConteneur {
  categorie: string;
  libelle_categorie: string;
  motif_classement: string;
  taille_conteneur: TailleConteneur;
  acconage_fcfa: number;
  relevage_fcfa: number;
  /** Acconage + relevage, hors surcharge. */
  total_fcfa: number;
  /** Vrai quand le poids dépasse le seuil : une surcharge s'ajoutera. */
  colis_lourd: boolean;
  seuil_colis_lourd_tonnes: number | null;
  source: string;
  date_application: string;
}

export type ChiffrageManutention =
  | { possible: true; ligne: ManutentionConteneur }
  | { possible: false; motif: string };

/**
 * Le coût de manutention terre d'UN conteneur.
 *
 * La surcharge colis lourd est SIGNALÉE, jamais chiffrée : le barème dit à
 * partir de quel poids elle s'applique, il ne dit pas combien elle coûte. La
 * deviner reviendrait à refaire l'erreur que le fondateur a corrigée.
 */
export function chiffrerManutention(
  bareme: LigneBareme[],
  params: {
    sens: SensManutention;
    designation: string;
    taille: TailleConteneur;
    poids_tonnes?: number;
  },
): ChiffrageManutention {
  const classement = classerMarchandise(bareme, params.sens, params.designation);
  if (!classement) {
    return { possible: false, motif: `Aucun barème chargé pour le sens « ${params.sens} ».` };
  }

  const ligne = bareme.find(
    (l) =>
      l.actif &&
      l.sens === params.sens &&
      l.categorie === classement.categorie &&
      l.taille_conteneur === params.taille,
  );
  if (!ligne) {
    return {
      possible: false,
      motif: `Le barème ne porte pas de tarif ${params.sens} ${classement.categorie} en ${params.taille} pieds.`,
    };
  }

  const colis_lourd =
    ligne.surcharge_colis_lourd &&
    ligne.seuil_colis_lourd_tonnes != null &&
    params.poids_tonnes != null &&
    params.poids_tonnes > Number(ligne.seuil_colis_lourd_tonnes);

  return {
    possible: true,
    ligne: {
      categorie: ligne.categorie,
      libelle_categorie: ligne.libelle_categorie,
      motif_classement: classement.motif,
      taille_conteneur: ligne.taille_conteneur,
      acconage_fcfa: Number(ligne.acconage_fcfa),
      relevage_fcfa: Number(ligne.relevage_fcfa),
      total_fcfa: Number(ligne.acconage_fcfa) + Number(ligne.relevage_fcfa),
      colis_lourd,
      seuil_colis_lourd_tonnes:
        ligne.seuil_colis_lourd_tonnes == null ? null : Number(ligne.seuil_colis_lourd_tonnes),
      source: ligne.source,
      date_application: ligne.date_application,
    },
  };
}

/**
 * LA DISSOCIATION QUE LE FONDATEUR DEMANDE
 *
 * « Cette partie s'applique sur certains de nos services et non sur la totalité
 * des services. » Voici lesquels, et pourquoi.
 */
export const APPLICATION_PAR_SERVICE = {
  /** Conteneur complet à notre nom : nous payons le terminal directement. */
  import_conteneur_complet: true,
  export_conteneur_complet: true,
  /** Le groupeur paie le conteneur entier et le refacture au mètre cube. */
  import_groupage: false,
  export_groupage: false,
  /** Porte-à-porte droits acquittés : ni connaissement, ni acconier, ni magasin. */
  boutique_dropshipping: false,
  /** L'aérien ne passe pas par un acconier : voir le retrait documentaire. */
  aerien: false,
} as const;

export type ServiceMayLary = keyof typeof APPLICATION_PAR_SERVICE;

export const manutentionApplicable = (service: ServiceMayLary): boolean =>
  APPLICATION_PAR_SERVICE[service];
