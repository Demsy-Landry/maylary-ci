/**
 * Ce qui se paie à l'arrivée, en plus des droits et taxes.
 *
 * LE POSTE QUI MANQUAIT
 *
 * Payer la marchandise, payer le fret, assurer, liquider les droits — et la
 * marchandise est toujours au port. Entre le Bon À Enlever et le camion, il
 * reste une facture, émise par la compagnie et par le terminal :
 *
 *   maritime   acconage, échange du connaissement, magasinage
 *   aérien     retrait documentaire, magasinage
 *
 * Un devis qui les oublie n'est pas approximatif, il est incomplet du même
 * montant à chaque dossier.
 *
 * DEUX AXES, PAS UN
 *
 * Ces frais ne suivent pas la marchandise mais le MODE et le CONDITIONNEMENT.
 * L'acconage d'un conteneur complet se compte au conteneur ; celui d'un
 * groupage se compte à la tonne débarquée, puisque le conteneur n'est pas le
 * nôtre. Le magasinage se compte au jour, après franchise. Le retrait
 * documentaire est un forfait par titre de transport.
 *
 * LE REFUS PLUTÔT QUE LE CHIFFRE PLAUSIBLE
 *
 * Aucun montant n'est semé en base. Tant qu'un poste applicable n'a pas son
 * montant réel, `chiffrerFraisDestination` REFUSE de conclure et nomme ce qui
 * lui manque — même règle que pour un code absent du Tarif Extérieur Commun.
 *
 * Un acconage inventé ne se découvre pas au devis : il se découvre à la caisse
 * du terminal, marchandise déjà à quai, et c'est alors une perte sèche ou un
 * client à qui l'on doit expliquer que le prix a changé. Le refus, lui, se
 * découvre pendant la cotation, quand il est encore gratuit.
 *
 * CE QUI ÉCHAPPE À TOUT CELA
 *
 * Voir `fraisDestinationApplicables` : le porte-à-porte droits acquittés n'a ni
 * connaissement à échanger, ni acconier, ni magasin sous douane.
 */

export type ModeAcheminement = 'maritime' | 'aerien';
export type Conditionnement = 'conteneur' | 'groupage';

export type BaseCalcul =
  | 'forfait_expedition'
  | 'par_conteneur'
  | 'par_tonne'
  | 'par_m3'
  | 'par_kg'
  | 'par_jour'
  | 'pourcentage_caf';

export interface FraisDestination {
  code: string;
  libelle: string;
  sens: 'import' | 'export';
  mode: ModeAcheminement | 'tous';
  conditionnement: Conditionnement | 'tous';
  compagnie: string | null;
  percepteur: string;
  base_calcul: BaseCalcul;
  /** Nul tant que le montant réel n'est pas connu. */
  montant_fcfa: number | null;
  taux: number | null;
  franchise_jours: number | null;
  evitable: boolean;
  obligation: 'obligatoire' | 'conditionnel';
  source: string | null;
  verifie: boolean;
  ordre: number;
  actif: boolean;
  note: string | null;
}

/**
 * L'expédition telle qu'elle se présente à l'arrivée. Tout est facultatif :
 * une quantité absente rend simplement le poste qui en dépend inapplicable,
 * elle ne le rend pas gratuit.
 */
export interface Expedition {
  mode: ModeAcheminement;
  conditionnement: Conditionnement;
  /** Nombre de conteneurs, pour un conteneur complet. */
  conteneurs?: number;
  poids_kg?: number;
  volume_m3?: number;
  /** Jours passés sous douane, franchise comprise : c'est elle qu'on retranche. */
  jours_sous_douane?: number;
  valeur_caf_fcfa?: number;
}

export interface LigneFraisDestination {
  code: string;
  libelle: string;
  percepteur: string;
  base_calcul: BaseCalcul;
  /** Ce sur quoi le tarif est multiplié : conteneurs, tonnes, jours facturés… */
  quantite: number;
  unite: string;
  montant_unitaire_fcfa: number;
  montant_fcfa: number;
  /** Vrai pour le magasinage : un dossier mené vite le fait tomber à zéro. */
  evitable: boolean;
}

export interface PosteManquant {
  code: string;
  libelle: string;
  percepteur: string;
  base_calcul: BaseCalcul;
  /**
   * Deux empêchements différents, qui ne se corrigent pas au même endroit :
   * `tarif` se règle dans les réglages, `mesure` se règle sur la demande.
   */
  raison: 'tarif' | 'mesure';
}

export type ChiffrageDestination =
  | {
      possible: true;
      lignes: LigneFraisDestination[];
      total_fcfa: number;
      /** Part du total qu'un dédouanement rapide évite. */
      total_evitable_fcfa: number;
    }
  | {
      possible: false;
      manquants: PosteManquant[];
      /** Ce qui a pu être chiffré malgré tout, pour ne pas perdre le travail fait. */
      lignes_connues: LigneFraisDestination[];
    };

/** Les filières de la maison, et leur rapport à ces frais. */
export type Filiere = 'import' | 'sourcing' | 'export' | 'boutique_cj';

/**
 * LA DISSOCIATION, EN UN ENDROIT
 *
 * Le dropshipping CJ est un porte-à-porte droits acquittés : la compagnie
 * dédouane sous son propre régime et livre à l'adresse. Il n'y a ni
 * connaissement à échanger, ni acconier à payer, ni magasin sous douane où la
 * marchandise séjourne à nos frais. Lui appliquer ces postes les compterait une
 * seconde fois, puisqu'ils sont déjà dans le prix du transporteur.
 *
 * L'import et le sourcing, eux, sont des opérations où NOUS sommes
 * l'importateur : la chaîne complète nous incombe.
 */
export function fraisDestinationApplicables(filiere: Filiere): boolean {
  return filiere !== 'boutique_cj';
}

const UNITES: Record<BaseCalcul, string> = {
  forfait_expedition: 'expédition',
  par_conteneur: 'conteneur',
  par_tonne: 'tonne',
  par_m3: 'm³',
  par_kg: 'kg',
  par_jour: 'jour',
  pourcentage_caf: 'valeur CAF',
};

/** Retient les postes qui concernent cette expédition, dans l'ordre d'affichage. */
function postesApplicables(bareme: FraisDestination[], e: Expedition): FraisDestination[] {
  return bareme
    .filter((f) => f.actif && f.sens === 'import')
    .filter((f) => f.mode === 'tous' || f.mode === e.mode)
    .filter((f) => f.conditionnement === 'tous' || f.conditionnement === e.conditionnement)
    .sort((a, b) => a.ordre - b.ordre || a.code.localeCompare(b.code));
}

/**
 * La quantité sur laquelle porte le tarif.
 *
 * Rend `null` quand l'expédition ne fournit pas la mesure nécessaire : un
 * acconage à la tonne sans poids ne vaut pas zéro, il ne se calcule pas. On
 * distingue ce cas de la quantité nulle légitime — zéro jour de magasinage,
 * qui vaut bien zéro franc.
 */
function quantitePour(f: FraisDestination, e: Expedition): number | null {
  switch (f.base_calcul) {
    case 'forfait_expedition':
      return 1;
    case 'par_conteneur':
      return e.conteneurs ?? null;
    case 'par_tonne':
      return e.poids_kg != null ? e.poids_kg / 1000 : null;
    case 'par_m3':
      return e.volume_m3 ?? null;
    case 'par_kg':
      return e.poids_kg ?? null;
    case 'par_jour': {
      if (e.jours_sous_douane == null) return null;
      // La franchise se retranche, et un séjour plus court qu'elle ne coûte rien.
      return Math.max(0, e.jours_sous_douane - (f.franchise_jours ?? 0));
    }
    case 'pourcentage_caf':
      return e.valeur_caf_fcfa ?? null;
  }
}

/** Le tarif unitaire, quelle que soit la façon dont il est exprimé. */
function tarifUnitaire(f: FraisDestination): number | null {
  if (f.base_calcul === 'pourcentage_caf') return f.taux;
  return f.montant_fcfa;
}

export function chiffrerFraisDestination(
  bareme: FraisDestination[],
  e: Expedition,
): ChiffrageDestination {
  const lignes: LigneFraisDestination[] = [];
  const manquants: PosteManquant[] = [];

  for (const f of postesApplicables(bareme, e)) {
    const quantite = quantitePour(f, e);
    const tarif = tarifUnitaire(f);

    // Poste hors sujet pour cette expédition : ni ligne, ni reproche. Un
    // magasinage de zéro jour facturé se range ici, pas dans les manquants.
    if (quantite === null || quantite === 0) {
      if (quantite === null && f.obligation === 'obligatoire') {
        manquants.push({
          code: f.code,
          libelle: f.libelle,
          percepteur: f.percepteur,
          base_calcul: f.base_calcul,
          raison: 'mesure',
        });
      }
      continue;
    }

    if (tarif == null) {
      manquants.push({
        code: f.code,
        libelle: f.libelle,
        percepteur: f.percepteur,
        base_calcul: f.base_calcul,
        raison: 'tarif',
      });
      continue;
    }

    lignes.push({
      code: f.code,
      libelle: f.libelle,
      percepteur: f.percepteur,
      base_calcul: f.base_calcul,
      quantite,
      unite: UNITES[f.base_calcul],
      montant_unitaire_fcfa: tarif,
      montant_fcfa: Math.round(quantite * tarif),
      evitable: f.evitable,
    });
  }

  if (manquants.length > 0) {
    return { possible: false, manquants, lignes_connues: lignes };
  }

  return {
    possible: true,
    lignes,
    total_fcfa: lignes.reduce((s, l) => s + l.montant_fcfa, 0),
    total_evitable_fcfa: lignes
      .filter((l) => l.evitable)
      .reduce((s, l) => s + l.montant_fcfa, 0),
  };
}

/**
 * Ces frais se paient une fois par EXPÉDITION, jamais par article. Répartis sur
 * le lot, ils se diluent comme le plancher de RPI et le timbre — c'est ce qui
 * fait qu'un import de gros revient moins cher à l'unité qu'un import d'une
 * pièce, et c'est l'argument central auprès d'un commerçant qui revend.
 */
export function fraisParUnite(total_fcfa: number, quantite: number): number {
  if (quantite <= 0) return total_fcfa;
  return Math.round(total_fcfa / quantite);
}
