/**
 * Coût de revient d'un article importé et prix de vente qui en découle.
 *
 * ⚠️ Cette formule est dupliquée dans l'edge function
 * `app_e08c374bc4_cj_dropshipping_import` (Deno, qui ne partage pas ce module).
 * C'est le serveur qui fait foi : ce fichier ne sert qu'à afficher un aperçu
 * en admin. Toute évolution doit être reportée aux deux endroits.
 */

export interface ParametresCoutImport {
  taux_change_usd_fcfa: number;
  taux_marge_defaut: number;
  fret_base_article_fcfa: number;
  prix_plancher_fcfa: number;
  taux_assurance: number;
  taux_couverture_assurance: number;
  /** Frais de police, facturés une fois par expédition. */
  frais_police_assurance_fcfa: number;
  /** Taxe sur les contrats d'assurance, appliquée à la prime frais compris. */
  taux_taxe_assurance: number;
}

export interface RepartitionIncoterm {
  /** Fraction du fret restant à la charge de Maylary (0 = tout est payé par le fournisseur). */
  part_fret: number;
  /** Faux sous CIF/CIP : le fournisseur assure déjà, inutile de doubler la prime. */
  assurance_a_charge: boolean;
}

export interface DetailCoutImport {
  prix_achat_fcfa: number;
  cout_fret_fcfa: number;
  valeur_cif_fcfa: number;
  valeur_assuree_fcfa: number;
  cout_assurance_fcfa: number;
  cout_revient_fcfa: number;
  prix_avant_plancher_fcfa: number;
  prix_unitaire_fcfa: number;
  /** Vrai si le prix plancher a relevé le prix de vente calculé. */
  plancher_applique: boolean;
  taux_marge_applique: number;
}

/**
 * Chaîne de calcul :
 *   achat → fret (part selon incoterm) → valeur CIF
 *   → assurance facultés sur la valeur CIF majorée (règle des 110 %)
 *   → coût de revient → marge → prix plancher.
 *
 * L'assurance des marchandises importées doit être souscrite localement en
 * Côte d'Ivoire. La prime porte sur la valeur assurée, jamais sur le seul prix
 * d'achat, et s'augmente des frais de police puis de la taxe.
 */
export function calculerCoutImport(params: {
  prixFournisseurUsd: number;
  parametres: ParametresCoutImport;
  incoterm: RepartitionIncoterm;
  /** Remplace ponctuellement le taux de marge par défaut. */
  tauxMarge?: number;
}): DetailCoutImport {
  const { prixFournisseurUsd, parametres, incoterm } = params;

  const tauxMarge = params.tauxMarge ?? Number(parametres.taux_marge_defaut);

  const prix_achat_fcfa = Math.round(prixFournisseurUsd * Number(parametres.taux_change_usd_fcfa));

  const cout_fret_fcfa = Math.round(
    Number(parametres.fret_base_article_fcfa) * Number(incoterm.part_fret),
  );

  const valeur_cif_fcfa = prix_achat_fcfa + cout_fret_fcfa;

  const valeur_assuree_fcfa = incoterm.assurance_a_charge
    ? Math.round(valeur_cif_fcfa * Number(parametres.taux_couverture_assurance))
    : 0;

  // Barème de l'assureur : prime nette, puis frais de police, puis taxe.
  const cout_assurance_fcfa = incoterm.assurance_a_charge
    ? Math.round(
        (Math.round(valeur_assuree_fcfa * Number(parametres.taux_assurance)) +
          Number(parametres.frais_police_assurance_fcfa)) *
          (1 + Number(parametres.taux_taxe_assurance)),
      )
    : 0;

  const cout_revient_fcfa = prix_achat_fcfa + cout_fret_fcfa + cout_assurance_fcfa;
  const prix_avant_plancher_fcfa = Math.round(cout_revient_fcfa * (1 + tauxMarge));
  const plancher = Number(parametres.prix_plancher_fcfa);
  const prix_unitaire_fcfa = Math.max(prix_avant_plancher_fcfa, plancher);

  return {
    prix_achat_fcfa,
    cout_fret_fcfa,
    valeur_cif_fcfa,
    valeur_assuree_fcfa,
    cout_assurance_fcfa,
    cout_revient_fcfa,
    prix_avant_plancher_fcfa,
    prix_unitaire_fcfa,
    plancher_applique: prix_unitaire_fcfa > prix_avant_plancher_fcfa,
    taux_marge_applique: tauxMarge,
  };
}

/**
 * Prime d'assurance facultés, selon le barème de l'assureur local :
 *
 *   (FOB + fret) × taux de couverture × taux de prime
 *   + frais de police
 *   puis + taxe sur les contrats d'assurance
 *
 * Réutilisée par les ateliers de cotation import/export, où la valeur de la
 * marchandise est saisie à la main.
 */
export function calculerPrimeAssurance(params: {
  valeurMarchandiseFcfa: number;
  coutFretFcfa?: number;
  tauxAssurance: number;
  tauxCouverture: number;
  fraisPoliceFcfa: number;
  tauxTaxe: number;
}): {
  valeur_assuree_fcfa: number;
  prime_nette_fcfa: number;
  frais_police_fcfa: number;
  taxe_fcfa: number;
  prime_fcfa: number;
} {
  const valeurCif = params.valeurMarchandiseFcfa + (params.coutFretFcfa ?? 0);
  const valeur_assuree_fcfa = Math.round(valeurCif * params.tauxCouverture);
  const prime_nette_fcfa = Math.round(valeur_assuree_fcfa * params.tauxAssurance);
  const avantTaxe = prime_nette_fcfa + params.fraisPoliceFcfa;
  const prime_fcfa = Math.round(avantTaxe * (1 + params.tauxTaxe));

  return {
    valeur_assuree_fcfa,
    prime_nette_fcfa,
    frais_police_fcfa: params.fraisPoliceFcfa,
    taxe_fcfa: prime_fcfa - avantTaxe,
    prime_fcfa,
  };
}
