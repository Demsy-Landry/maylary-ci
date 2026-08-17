/**
 * Les frais de la compagnie et du terminal, tels qu'ils se facturent vraiment.
 *
 * CE QUE LA BASE TARIFAIRE A MONTRÉ
 *
 * Le premier modèle posait un montant par poste. Il supposait un tarif fixe, et
 * le fondateur l'a corrigé. Le second, tiré du barème FEDERMAR, ajoutait la
 * catégorie de marchandise. Il manquait encore quatre dimensions, que la base
 * des compagnies rend évidentes :
 *
 *   LA COMPAGNIE   un « échange de connaissement » vaut 40 000 F chez l'une,
 *                  50 000 chez l'autre, 61 EUR chez une troisième. Ce n'est
 *                  pas un poste, c'est un poste PAR TRANSPORTEUR.
 *   LA DEVISE      un tiers des lignes sont en euros ou en dollars.
 *   LA TVA         18 % sur certains postes, pas sur d'autres. Le timbre non,
 *                  le bon à délivrer oui.
 *   LE STATUT      deux frais de TERRA sont DÉNONCÉS par les transitaires
 *                  depuis décembre 2025. Les chiffrer sans le dire, c'est
 *                  facturer un client sur un frais contesté.
 *
 * L'EURO NE PASSE PAS PAR UNE API
 *
 * Le franc CFA est arrimé à l'euro par une parité fixe de droit :
 * 1 EUR = 655,957 XOF. Ce n'est pas un cours, c'est un ancrage. Aller le
 * chercher sur un service de change introduirait une variation là où il n'y en
 * a pas, et ferait dépendre une facture d'un réseau.
 *
 * Le dollar, lui, flotte : son taux vient des paramètres, où il se règle.
 *
 * CE QUI RESTE SANS MONTANT
 *
 * Six lignes n'ont pas de tarif : magasinage des terminaux, plug-in reefer,
 * manutention de San Pedro et du TC2. Elles ne sont pas omises pour autant —
 * elles remontent en RÉSERVE, avec leur nom. Un poste qu'on sait dû mais qu'on
 * ne sait pas chiffrer doit se voir ; c'est un poste oublié qui coûte cher.
 */

/**
 * Les cautions de conteneur — jusqu'à 750 000 F chez certaines compagnies — sont
 * REMBOURSABLES au retour de la boîte. Elles n'entrent donc pas dans le coût de
 * revient : les y mettre gonflerait le prix de vente d'une somme récupérée. Mais
 * elles doivent se voir, parce que c'est de la trésorerie à sortir le jour de
 * l'enlèvement, et un dossier se bloque faute de l'avoir prévue.
 */
export const CODES_CAUTION = ['DEPOSIT', 'DEPOSIT_ABJ', 'DEPOSIT_OUT'];

export const estCaution = (code: string): boolean => CODES_CAUTION.includes(code);

/** Parité fixe de droit entre l'euro et le franc CFA. Jamais un cours du jour. */
export const EUR_XOF = 655.957;

export type TypeFrais =
  | 'local_charge'
  | 'surcharge'
  | 'terminal_fee'
  | 'detention'
  | 'additional_fee';

export type SensFrais = 'IMP' | 'EXP' | 'BOTH';

export type UniteFrais =
  | 'PER_BL'
  | 'PER_CNTR'
  | 'PER_TEU'
  | 'PER_DAY'
  | 'PER_TONNE'
  | 'PERCENT_FREIGHT'
  | 'PER_UNIT';

export interface FraisLogistique {
  id: string;
  type: TypeFrais;
  compagnie_code: string | null;
  compagnie_nom: string | null;
  terminal_code: string | null;
  code_frais: string;
  libelle: string;
  sens: SensFrais;
  unite: UniteFrais;
  devise: 'XOF' | 'EUR' | 'USD';
  montant_20: number | null;
  montant_40: number | null;
  montant_45: number | null;
  pourcentage: number | null;
  montant_min: number | null;
  montant_max: number | null;
  tva_applicable: boolean;
  entree_en_vigueur: string | null;
  /** 'contested_2026' : dénoncé par les transitaires, à confirmer. */
  statut: string | null;
  note: string | null;
  source: string | null;
  franchise_jours: number | null;
  jour_min: number | null;
  jour_max: number | null;
  actif: boolean;
}

export interface ContexteExpedition {
  sens: 'IMP' | 'EXP';
  compagnie_code: string | null;
  terminal_code: string | null;
  taille_conteneur: 20 | 40;
  nombre_conteneurs: number;
  /** Nombre de connaissements : un par expédition, sauf groupage éclaté. */
  nombre_bl: number;
  poids_tonnes?: number;
  fret_fcfa?: number;
  /** Jours écoulés depuis la mise à disposition, franchise comprise. */
  jours_immobilisation?: number;
  taux_change_usd_fcfa: number;
  taux_tva: number;
}

export interface LigneFacturee {
  code_frais: string;
  libelle: string;
  percepteur: string;
  unite: UniteFrais;
  quantite: number;
  /** Tarif unitaire déjà converti en francs. */
  unitaire_fcfa: number;
  devise_origine: 'XOF' | 'EUR' | 'USD';
  hors_taxe_fcfa: number;
  tva_fcfa: number;
  total_fcfa: number;
  /** Vrai quand le tarif est une fourchette : on retient le haut. */
  fourchette: boolean;
  conteste: boolean;
}

export interface PosteSansTarif {
  code_frais: string;
  libelle: string;
  percepteur: string;
  raison: string;
}

export interface ChiffrageFrais {
  lignes: LigneFacturee[];
  total_ht_fcfa: number;
  total_tva_fcfa: number;
  total_fcfa: number;
  /** Postes dus mais non chiffrables : ils remontent en réserve, pas au silence. */
  sans_tarif: PosteSansTarif[];
  /** Postes dénoncés par les transitaires, à confirmer avant facturation. */
  contestes: LigneFacturee[];
  /**
   * Cautions : sorties de trésorerie à prévoir, mais REMBOURSABLES. Elles sont
   * hors du total, sinon on gonflerait le prix de vente d'une somme récupérée.
   */
  cautions: LigneFacturee[];
  caution_totale_fcfa: number;
}

/** L'avertissement que la source impose, et qu'aucun écran ne doit séparer des montants. */
export const AVERTISSEMENT_TARIFAIRE =
  'Tarifs indicatifs, issus de grilles publiques et d’informations de marché. Ils peuvent évoluer sans préavis, et certains sont contestés. Vérifiez la facture estimative sur la plateforme Abidjan Terminal et confirmez auprès de l’agence de la compagnie ou du terminal.';

const enFrancs = (montant: number, devise: 'XOF' | 'EUR' | 'USD', usd: number): number => {
  if (devise === 'XOF') return montant;
  if (devise === 'EUR') return montant * EUR_XOF;
  return montant * usd;
};

const percepteurDe = (f: FraisLogistique): string =>
  f.compagnie_nom ?? f.terminal_code ?? 'Réglementation';

/**
 * Le tarif retenu pour cette taille de conteneur.
 *
 * Quand le barème donne une fourchette plutôt qu'un montant, on retient le
 * HAUT. Sous-estimer un frais de terminal se découvre à la caisse ; le
 * surestimer se découvre au devis, quand c'est encore rattrapable.
 */
function tarifRetenu(
  f: FraisLogistique,
  taille: 20 | 40,
): { montant: number; fourchette: boolean } | null {
  const parTaille = taille === 40 ? (f.montant_40 ?? f.montant_20) : f.montant_20;
  if (parTaille != null) return { montant: Number(parTaille), fourchette: false };
  if (f.montant_max != null) return { montant: Number(f.montant_max), fourchette: true };
  if (f.montant_min != null) return { montant: Number(f.montant_min), fourchette: true };
  return null;
}

/** Combien de fois ce tarif s'applique, selon son unité. */
function quantitePour(f: FraisLogistique, c: ContexteExpedition): number | null {
  switch (f.unite) {
    case 'PER_BL':
      return c.nombre_bl;
    case 'PER_CNTR':
    case 'PER_UNIT':
      return c.nombre_conteneurs;
    case 'PER_TEU':
      // Un 40 pieds vaut deux EVP : c'est la définition de l'unité.
      return c.nombre_conteneurs * (c.taille_conteneur === 40 ? 2 : 1);
    case 'PER_TONNE':
      return c.poids_tonnes ?? null;
    case 'PER_DAY': {
      if (c.jours_immobilisation == null) return null;
      const debut = f.jour_min ?? (f.franchise_jours ?? 0) + 1;
      const fin = f.jour_max ?? c.jours_immobilisation;
      return Math.max(0, Math.min(c.jours_immobilisation, fin) - debut + 1);
    }
    case 'PERCENT_FREIGHT':
      return c.fret_fcfa ?? null;
  }
}

/**
 * Ce qu'il faut prévoir pour cette expédition.
 *
 * On ne retient que les frais de la compagnie choisie, du terminal concerné, et
 * ceux qui ne dépendent de personne. Les frais d'une autre compagnie n'ont rien
 * à faire dans le total, et les charger « au cas où » gonflerait le devis d'une
 * somme que le client ne paiera jamais.
 */
export function chiffrerFraisLogistiques(
  bareme: FraisLogistique[],
  c: ContexteExpedition,
): ChiffrageFrais {
  const lignes: LigneFacturee[] = [];
  const sans_tarif: PosteSansTarif[] = [];

  const concernes = bareme
    .filter((f) => f.actif)
    .filter((f) => f.sens === 'BOTH' || f.sens === c.sens)
    .filter(
      (f) =>
        // Les frais de compagnie ne valent que pour la compagnie retenue,
        // ceux de terminal que pour le terminal d'escale, et les frais
        // réglementaires pour tout le monde.
        (f.compagnie_code == null && f.terminal_code == null) ||
        (f.compagnie_code != null && f.compagnie_code === c.compagnie_code) ||
        (f.terminal_code != null && f.terminal_code === c.terminal_code),
    )
    // Les surestaries ne se chiffrent que si l'immobilisation est renseignée.
    .filter((f) => f.type !== 'detention' || c.jours_immobilisation != null);

  for (const f of concernes) {
    const quantite = quantitePour(f, c);
    const tarif = tarifRetenu(f, c.taille_conteneur);

    if (f.unite === 'PERCENT_FREIGHT') {
      if (f.pourcentage == null || c.fret_fcfa == null) {
        if (f.pourcentage != null) {
          sans_tarif.push({
            code_frais: f.code_frais,
            libelle: f.libelle,
            percepteur: percepteurDe(f),
            raison: 'assis sur le fret, qui n’est pas renseigné',
          });
        }
        continue;
      }
      const ht = Math.round((c.fret_fcfa * Number(f.pourcentage)) / 100);
      const tva = f.tva_applicable ? Math.round(ht * c.taux_tva) : 0;
      lignes.push({
        code_frais: f.code_frais,
        libelle: f.libelle,
        percepteur: percepteurDe(f),
        unite: f.unite,
        quantite: 1,
        unitaire_fcfa: ht,
        devise_origine: f.devise,
        hors_taxe_fcfa: ht,
        tva_fcfa: tva,
        total_fcfa: ht + tva,
        fourchette: false,
        conteste: f.statut === 'contested_2026',
      });
      continue;
    }

    if (tarif == null) {
      sans_tarif.push({
        code_frais: f.code_frais,
        libelle: f.libelle,
        percepteur: percepteurDe(f),
        raison: 'aucun tarif publié',
      });
      continue;
    }
    if (quantite == null) {
      sans_tarif.push({
        code_frais: f.code_frais,
        libelle: f.libelle,
        percepteur: percepteurDe(f),
        raison: `la mesure nécessaire manque (${f.unite})`,
      });
      continue;
    }
    if (quantite === 0) continue;

    const unitaire = Math.round(enFrancs(tarif.montant, f.devise, c.taux_change_usd_fcfa));
    const ht = unitaire * quantite;
    const tva = f.tva_applicable ? Math.round(ht * c.taux_tva) : 0;

    lignes.push({
      code_frais: f.code_frais,
      libelle: f.libelle,
      percepteur: percepteurDe(f),
      unite: f.unite,
      quantite,
      unitaire_fcfa: unitaire,
      devise_origine: f.devise,
      hors_taxe_fcfa: ht,
      tva_fcfa: tva,
      total_fcfa: ht + tva,
      fourchette: tarif.fourchette,
      conteste: f.statut === 'contested_2026',
    });
  }

  /* La caution revient : elle immobilise de la trésorerie, elle ne coûte rien.
     La laisser dans le total ferait porter au client, dans son prix, une somme
     que nous récupérons au retour du conteneur. */
  const cautions = lignes.filter((l) => estCaution(l.code_frais));
  const factures = lignes.filter((l) => !estCaution(l.code_frais));

  const total_ht_fcfa = factures.reduce((s, l) => s + l.hors_taxe_fcfa, 0);
  const total_tva_fcfa = factures.reduce((s, l) => s + l.tva_fcfa, 0);

  return {
    lignes: factures.sort((a, b) => b.total_fcfa - a.total_fcfa),
    total_ht_fcfa,
    total_tva_fcfa,
    total_fcfa: total_ht_fcfa + total_tva_fcfa,
    sans_tarif,
    contestes: factures.filter((l) => l.conteste),
    cautions,
    caution_totale_fcfa: cautions.reduce((s, l) => s + l.total_fcfa, 0),
  };
}

/**
 * Les frais qu'on ne facture pas mais qu'on immobilise.
 *
 * La caution d'un conteneur — jusqu'à 750 000 F chez certaines compagnies — est
 * remboursable au retour de la boîte. Elle ne doit donc PAS entrer dans le coût
 * de revient, sinon on gonfle le prix de vente d'une somme qu'on récupère. Mais
 * elle doit être connue : c'est de la trésorerie à sortir le jour de
 * l'enlèvement, et un dossier peut être bloqué faute de l'avoir prévue.
 */
