/**
 * Chaîne de coût d'un article importé — source de vérité côté serveur.
 *
 * Partagée par l'import CJ et la retarification du catalogue, pour qu'un
 * produit importé hier et un produit retarifé aujourd'hui suivent exactement
 * la même règle.
 *
 * ⚠️ `src/lib/cout-import.ts` en reproduit la formule pour l'aperçu admin dans
 * le navigateur : toute évolution doit être reportée là-bas aussi.
 */

export interface ParametresCout {
  taux_change_usd_fcfa: number | string;
  taux_marge_defaut: number | string;
  fret_base_article_fcfa: number | string;
  prix_plancher_fcfa: number | string;
  taux_assurance: number | string;
  taux_couverture_assurance: number | string;
  frais_police_assurance_fcfa: number | string;
  taux_taxe_assurance: number | string;
  quantite_minimum_defaut: number | string;
  seuil_petit_article_fcfa: number | string;
  paliers_quantite?: number[] | null;
  /**
   * Vrai quand le devis du transporteur est un porte-à-porte droits acquittés :
   * sa couverture rend inutile une police facultés locale.
   */
  fret_transporteur_couvre_assurance?: boolean | null;
  /**
   * Faux quand le transport ne fait plus partie du prix affiché : il est alors
   * coté sur le panier réel et facturé au client en ligne séparée.
   */
  fret_inclus_dans_prix?: boolean | null;
}

export interface RepartitionIncoterm {
  part_fret: number | string;
  assurance_a_charge: boolean;
}

export interface FretReel {
  prix_usd: number;
  transporteur: string;
  delai: string | null;
}

export interface DetailCout {
  prix_achat_fcfa: number;
  cout_fret_fcfa: number;
  valeur_cif_fcfa: number;
  valeur_assuree_fcfa: number;
  cout_assurance_fcfa: number;
  cout_revient_fcfa: number;
  prix_avant_plancher_fcfa: number;
  prix_unitaire_fcfa: number;
  plancher_applique: boolean;
  quantite_minimum: number;
  petit_article: boolean;
  fret_source: 'cj_reel' | 'forfait';
  fret_transporteur: string | null;
  fret_delai: string | null;
  prime_nette_lot_fcfa: number;
  prime_lot_fcfa: number;
  /** Vrai quand aucune prime n'est ajoutée parce que le transporteur couvre. */
  assurance_incluse_dans_le_fret: boolean;
  taux_marge_applique: number;
  /**
   * Vrai quand `cout_fret_fcfa` entre dans le prix de vente. Faux, le fret
   * reste calculé et consigné — il sert à juger la viabilité d'un article —
   * mais il est facturé au panier, pas dans le prix affiché.
   */
  fret_inclus_dans_prix: boolean;
}

/**
 * Quantité minimum de vente : la part fixe du fret (un forfait par colis) et
 * les frais de police de l'assurance (une fois par expédition) ne se diluent
 * qu'en vendant par lot. Cela n'a de sens que sur les articles bon marché ; sur
 * un article cher, un lot imposerait au client une commande minimum absurde.
 */
export function quantiteMinimumPour(
  prixAchatFcfa: number,
  parametres: ParametresCout,
  force?: number | null,
): number {
  if (force != null) return Math.max(1, Math.round(force));
  const estPetit = prixAchatFcfa < Number(parametres.seuil_petit_article_fcfa);
  return estPetit ? Math.max(1, Math.round(Number(parametres.quantite_minimum_defaut))) : 1;
}

/**
 * achat → fret → valeur CIF → assurance facultés → coût de revient → marge → plancher.
 *
 * Le fret CJ et la prime d'assurance sont calculés sur le lot entier puis
 * ramenés à l'unité : c'est ainsi que le lot dilue les parts fixes.
 */
export function calculerCout(params: {
  prixAchatFcfa: number;
  quantiteMinimum: number;
  fretReel: FretReel | null;
  parametres: ParametresCout;
  incoterm: RepartitionIncoterm;
  tauxMarge?: number | null;
}): DetailCout {
  const { prixAchatFcfa, quantiteMinimum, fretReel, parametres, incoterm } = params;

  const tauxMarge = params.tauxMarge ?? Number(parametres.taux_marge_defaut);
  const tauxChange = Number(parametres.taux_change_usd_fcfa);

  // Le devis CJ est un coût porte-à-porte complet portant sur le lot entier :
  // la part de l'incoterm ne s'y applique pas, seul le forfait la subit.
  const cout_fret_fcfa = fretReel
    ? Math.round((fretReel.prix_usd * tauxChange) / quantiteMinimum)
    : Math.round(Number(parametres.fret_base_article_fcfa) * Number(incoterm.part_fret));

  const valeur_cif_fcfa = prixAchatFcfa + cout_fret_fcfa;

  // Une police facultés ne se justifie que si personne d'autre ne couvre la
  // marchandise. Deux cas l'excluent : l'incoterm d'achat met déjà l'assurance
  // à la charge du fournisseur, ou le transporteur cote un porte-à-porte droits
  // acquittés, auquel cas sa responsabilité et les droits sont dans son prix.
  //
  // La distinction pèse : les frais de police sont dus par expédition, donc
  // identiques pour un colis de 126 FCFA et pour une palette. Les ajouter à un
  // colis postal renchérissait l'article de 40 %.
  const transporteurCouvre =
    fretReel != null && parametres.fret_transporteur_couvre_assurance !== false;
  const assuranceANotreCharge = incoterm.assurance_a_charge && !transporteurCouvre;

  // Barème de l'assureur local, appliqué au colis complet puis réparti :
  //   (FOB + fret) x couverture x taux de prime
  //   + frais de police (une fois par expédition)
  //   puis + taxe sur les contrats d'assurance.
  const valeur_assuree_lot_fcfa = assuranceANotreCharge
    ? Math.round(valeur_cif_fcfa * quantiteMinimum * Number(parametres.taux_couverture_assurance))
    : 0;
  const prime_nette_lot_fcfa = assuranceANotreCharge
    ? Math.round(valeur_assuree_lot_fcfa * Number(parametres.taux_assurance))
    : 0;
  const prime_lot_fcfa = assuranceANotreCharge
    ? Math.round(
        (prime_nette_lot_fcfa + Number(parametres.frais_police_assurance_fcfa)) *
          (1 + Number(parametres.taux_taxe_assurance)),
      )
    : 0;

  const valeur_assuree_fcfa = Math.round(valeur_assuree_lot_fcfa / quantiteMinimum);
  const cout_assurance_fcfa = Math.round(prime_lot_fcfa / quantiteMinimum);

  // Le transport ne fait plus partie du prix affiché : il est coté sur le
  // panier réel et facturé en ligne séparée. Il reste calculé et consigné, car
  // c'est lui qui dit si un article est vendable depuis ce fournisseur.
  //
  // L'assurance, elle, reste dans le prix : elle porte sur la marchandise, que
  // le client la voie ou non, et vaut zéro dès que le transporteur couvre.
  const fretInclus = parametres.fret_inclus_dans_prix !== false;
  const cout_revient_fcfa =
    prixAchatFcfa + (fretInclus ? cout_fret_fcfa : 0) + cout_assurance_fcfa;
  const prix_avant_plancher_fcfa = Math.round(cout_revient_fcfa * (1 + tauxMarge));

  // Le plancher protège la valeur d'une commande, pas celle d'une pièce : sur
  // un lot il se répartit, sinon un minimum par unité annulerait l'intérêt du lot.
  const prix_plancher_fcfa = Math.round(Number(parametres.prix_plancher_fcfa) / quantiteMinimum);
  const prix_unitaire_fcfa = Math.max(prix_avant_plancher_fcfa, prix_plancher_fcfa);

  return {
    prix_achat_fcfa: prixAchatFcfa,
    cout_fret_fcfa,
    valeur_cif_fcfa,
    valeur_assuree_fcfa,
    cout_assurance_fcfa,
    cout_revient_fcfa,
    prix_avant_plancher_fcfa,
    prix_unitaire_fcfa,
    plancher_applique: prix_unitaire_fcfa > prix_avant_plancher_fcfa,
    quantite_minimum: quantiteMinimum,
    petit_article: prixAchatFcfa < Number(parametres.seuil_petit_article_fcfa),
    fret_source: fretReel ? 'cj_reel' : 'forfait',
    fret_transporteur: fretReel?.transporteur ?? null,
    fret_delai: fretReel?.delai ?? null,
    prime_nette_lot_fcfa,
    prime_lot_fcfa,
    assurance_incluse_dans_le_fret: transporteurCouvre,
    taux_marge_applique: tauxMarge,
    fret_inclus_dans_prix: fretInclus,
  };
}

export interface PalierMesure {
  quantite_min: number;
  cout_fret_unitaire_fcfa: number;
  cout_assurance_unitaire_fcfa: number;
  cout_revient_unitaire_fcfa: number;
  prix_unitaire_fcfa: number;
  fret_transporteur: string | null;
  fret_delai: string | null;
}

/**
 * Construit la grille de prix dégressive à partir de devis de transport
 * réellement obtenus, un par quantité.
 *
 * Deux règles, toutes deux imposées par la réalité du transport :
 *
 *  - une quantité sans devis est écartée. On ne publie pas un prix qu'on ne
 *    sait pas tenir ;
 *  - un palier n'est retenu que si son prix unitaire est *strictement
 *    inférieur* à tous les paliers plus petits. Au-delà d'un certain poids le
 *    transporteur économique ne prend plus la marchandise, l'expédition bascule
 *    sur un service express et le prix par pièce remonte. Annoncer « plus vous
 *    en prenez, moins c'est cher » impose de le vérifier à chaque palier.
 */
export function construirePaliers(params: {
  prixAchatFcfa: number;
  devis: { quantite: number; fret: FretReel | null }[];
  parametres: ParametresCout;
  incoterm: RepartitionIncoterm;
  tauxMarge?: number | null;
}): PalierMesure[] {
  const retenus: PalierMesure[] = [];
  let meilleurPrix = Number.POSITIVE_INFINITY;

  const parQuantiteCroissante = [...params.devis].sort((a, b) => a.quantite - b.quantite);

  for (const { quantite, fret } of parQuantiteCroissante) {
    if (!fret) continue;

    const cout = calculerCout({
      prixAchatFcfa: params.prixAchatFcfa,
      quantiteMinimum: quantite,
      fretReel: fret,
      parametres: params.parametres,
      incoterm: params.incoterm,
      tauxMarge: params.tauxMarge ?? null,
    });

    if (cout.prix_unitaire_fcfa >= meilleurPrix) continue;
    meilleurPrix = cout.prix_unitaire_fcfa;

    retenus.push({
      quantite_min: quantite,
      cout_fret_unitaire_fcfa: cout.cout_fret_fcfa,
      cout_assurance_unitaire_fcfa: cout.cout_assurance_fcfa,
      cout_revient_unitaire_fcfa: cout.cout_revient_fcfa,
      prix_unitaire_fcfa: cout.prix_unitaire_fcfa,
      fret_transporteur: cout.fret_transporteur,
      fret_delai: cout.fret_delai,
    });
  }

  return retenus;
}
