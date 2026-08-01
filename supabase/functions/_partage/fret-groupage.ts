/**
 * Fret de groupage et coût de revient débarqué.
 *
 * Ce module applique les règles de tarification en usage chez les groupeurs,
 * pas une méthode maison. Elles se résument à quatre principes :
 *
 *  1. L'UNITÉ PAYANTE, dite règle « au plus fort » (Weight or Measurement).
 *     Le transporteur facture le plus grand des deux entre le volume et le
 *     poids, chacun ramené à une unité commune par un rapport d'équivalence
 *     propre au mode de transport. Un carton de plumes paie son encombrement,
 *     une caisse de boulons paie son poids.
 *
 *  2. LE MINIMUM DE TAXATION. Une expédition en dessous d'un certain seuil est
 *     facturée à ce seuil. En groupage maritime, c'est classiquement 1 m³.
 *
 *  3. LA RÉPARTITION AU PRORATA DE L'UNITÉ PAYANTE. Le coût total de
 *     l'expédition — fret de base et surcharges comprises — se répartit sur
 *     chaque article selon sa part d'unité payante. C'est ce qui rend le
 *     groupage équitable entre chargeurs.
 *
 *  4. LE FRET DE BASE N'EST PAS LE COÛT TOTAL. S'y ajoutent les surcharges
 *     armateur (soutage, change), les manutentions terminal au départ et à
 *     l'arrivée, les frais de groupage et de dégroupage, la documentation.
 *     Puis, à destination, les droits et taxes d'importation.
 *
 * Aucune valeur n'est figée dans ce fichier : les taux viennent de la campagne
 * et des paramètres, pour être remplacés par le devis réel du transitaire.
 */

/** Rapports d'équivalence entre volume et poids, par mode de transport. */
export const EQUIVALENCE_KG_PAR_M3 = {
  /** Usage maritime : l'unité payante est le plus grand entre le m³ et la tonne. */
  maritime: 1000,
  /** Diviseur volumétrique IATA de 6 000 cm³/kg, soit 1 m³ pour 166,67 kg. */
  aerien: 1000000 / 6000,
  /** Usage du groupage routier. */
  routier: 333,
} as const;

export type ModeTransport = keyof typeof EQUIVALENCE_KG_PAR_M3;

export interface ArticleExpedie {
  reference: string;
  quantite: number;
  /** Volume emballé d'une pièce, en cm³. */
  volume_unitaire_cm3: number;
  /** Poids emballé d'une pièce, en grammes. */
  poids_unitaire_g: number;
  /** Valeur marchandise départ usine d'une pièce, en FCFA. */
  valeur_unitaire_fcfa: number;
}

export interface TarifGroupage {
  mode: ModeTransport;
  /** Prix de l'unité payante. En maritime, c'est le prix du m³ ou de la tonne. */
  tarif_unite_payante_fcfa: number;
  /** Unités payantes facturées au minimum pour une expédition. */
  minimum_taxation_up: number;
  /** Surcharges proportionnelles au fret de base : soutage, ajustement de change. */
  taux_surcharges: number;
  /** Manutentions terminal, groupage et dégroupage, documentation : par expédition. */
  frais_fixes_expedition_fcfa: number;
}

export interface RegimeDouanier {
  /** Tarif extérieur commun, appliqué à la valeur CAF. */
  taux_droit_douane: number;
  /** Redevances et prélèvements communautaires, appliqués à la valeur CAF. */
  taux_redevances: number;
  /** Taxe sur la valeur ajoutée, appliquée à la valeur CAF augmentée des droits. */
  taux_tva: number;
  /** Honoraires de transit, magasinage et livraison finale, par expédition. */
  frais_dedouanement_fcfa: number;
}

export interface UnitePayanteArticle {
  reference: string;
  volume_m3: number;
  poids_t: number;
  /** Unité payante de la ligne : le plus fort du volume et du poids équivalent. */
  unite_payante: number;
  /** Vrai si c'est l'encombrement qui commande, et non le poids. */
  paye_au_volume: boolean;
}

/**
 * Unité payante d'une ligne : on ramène le poids à un volume équivalent par le
 * rapport du mode de transport, et on retient le plus grand des deux.
 */
export function unitePayante(article: ArticleExpedie, mode: ModeTransport): UnitePayanteArticle {
  const volume_m3 = (article.volume_unitaire_cm3 * article.quantite) / 1_000_000;
  const poids_kg = (article.poids_unitaire_g * article.quantite) / 1000;
  const poids_t = poids_kg / 1000;

  // Le poids exprimé dans l'unité de volume, selon le rapport du mode.
  const volume_equivalent_du_poids = poids_kg / EQUIVALENCE_KG_PAR_M3[mode];
  const unite_payante = Math.max(volume_m3, volume_equivalent_du_poids);

  return {
    reference: article.reference,
    volume_m3,
    poids_t,
    unite_payante,
    paye_au_volume: volume_m3 >= volume_equivalent_du_poids,
  };
}

export interface CoutExpedition {
  unites_payantes_reelles: number;
  /** Unités effectivement facturées, minimum de taxation appliqué. */
  unites_payantes_facturees: number;
  minimum_applique: boolean;
  fret_base_fcfa: number;
  surcharges_fcfa: number;
  frais_fixes_fcfa: number;
  fret_total_fcfa: number;
  lignes: UnitePayanteArticle[];
}

/**
 * Coût de transport d'une expédition groupée, avant droits et taxes.
 * Le minimum de taxation s'applique à l'expédition entière, jamais à la ligne.
 */
export function coutExpedition(
  articles: ArticleExpedie[],
  tarif: TarifGroupage,
): CoutExpedition {
  const lignes = articles.map((a) => unitePayante(a, tarif.mode));
  const unites_payantes_reelles = lignes.reduce((s, l) => s + l.unite_payante, 0);
  const unites_payantes_facturees = Math.max(unites_payantes_reelles, tarif.minimum_taxation_up);

  const fret_base_fcfa = Math.round(unites_payantes_facturees * tarif.tarif_unite_payante_fcfa);
  const surcharges_fcfa = Math.round(fret_base_fcfa * tarif.taux_surcharges);
  const frais_fixes_fcfa = Math.round(tarif.frais_fixes_expedition_fcfa);

  return {
    unites_payantes_reelles,
    unites_payantes_facturees,
    minimum_applique: unites_payantes_reelles < tarif.minimum_taxation_up,
    fret_base_fcfa,
    surcharges_fcfa,
    frais_fixes_fcfa,
    fret_total_fcfa: fret_base_fcfa + surcharges_fcfa + frais_fixes_fcfa,
    lignes,
  };
}

export interface CoutDebarqueArticle {
  reference: string;
  quantite: number;
  unite_payante: number;
  part_expedition: number;
  valeur_marchandise_fcfa: number;
  fret_reparti_fcfa: number;
  assurance_repartie_fcfa: number;
  valeur_caf_fcfa: number;
  droits_douane_fcfa: number;
  redevances_fcfa: number;
  tva_fcfa: number;
  frais_dedouanement_repartis_fcfa: number;
  cout_revient_total_fcfa: number;
  cout_revient_unitaire_fcfa: number;
}

/**
 * Coût de revient débarqué, article par article.
 *
 * Le fret et les frais de destination se répartissent au prorata de l'unité
 * payante — la règle des groupeurs. Les droits et taxes, eux, se calculent sur
 * la valeur CAF de chaque ligne, puisque c'est cette valeur que la douane
 * retient.
 *
 * L'assurance est passée en argument : elle suit le barème de l'assureur, qui
 * a sa propre logique et son propre module.
 */
export function coutDebarque(params: {
  articles: ArticleExpedie[];
  tarif: TarifGroupage;
  regime: RegimeDouanier;
  /** Prime d'assurance de l'expédition entière, déjà calculée au barème. */
  prime_assurance_expedition_fcfa: number;
}): { expedition: CoutExpedition; articles: CoutDebarqueArticle[] } {
  const expedition = coutExpedition(params.articles, params.tarif);
  const totalUp = expedition.unites_payantes_reelles;

  const articles = params.articles.map((article, i) => {
    const ligne = expedition.lignes[i];

    // Une expédition d'unité payante nulle n'existe pas ; la garde évite une
    // division par zéro sur des données incomplètes.
    const part_expedition = totalUp > 0 ? ligne.unite_payante / totalUp : 0;

    const valeur_marchandise_fcfa = article.valeur_unitaire_fcfa * article.quantite;
    const fret_reparti_fcfa = Math.round(expedition.fret_total_fcfa * part_expedition);
    const assurance_repartie_fcfa = Math.round(
      params.prime_assurance_expedition_fcfa * part_expedition,
    );

    // Valeur CAF : marchandise, fret et assurance jusqu'au port de destination.
    // C'est l'assiette des droits et taxes.
    const valeur_caf_fcfa = valeur_marchandise_fcfa + fret_reparti_fcfa + assurance_repartie_fcfa;

    const droits_douane_fcfa = Math.round(valeur_caf_fcfa * params.regime.taux_droit_douane);
    const redevances_fcfa = Math.round(valeur_caf_fcfa * params.regime.taux_redevances);
    // La TVA porte sur la valeur en douane augmentée des droits et redevances.
    const tva_fcfa = Math.round(
      (valeur_caf_fcfa + droits_douane_fcfa + redevances_fcfa) * params.regime.taux_tva,
    );

    const frais_dedouanement_repartis_fcfa = Math.round(
      params.regime.frais_dedouanement_fcfa * part_expedition,
    );

    const cout_revient_total_fcfa =
      valeur_caf_fcfa +
      droits_douane_fcfa +
      redevances_fcfa +
      tva_fcfa +
      frais_dedouanement_repartis_fcfa;

    return {
      reference: article.reference,
      quantite: article.quantite,
      unite_payante: ligne.unite_payante,
      part_expedition,
      valeur_marchandise_fcfa,
      fret_reparti_fcfa,
      assurance_repartie_fcfa,
      valeur_caf_fcfa,
      droits_douane_fcfa,
      redevances_fcfa,
      tva_fcfa,
      frais_dedouanement_repartis_fcfa,
      cout_revient_total_fcfa,
      cout_revient_unitaire_fcfa: Math.round(cout_revient_total_fcfa / article.quantite),
    };
  });

  return { expedition, articles };
}
