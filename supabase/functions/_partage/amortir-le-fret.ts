/**
 * La quantité qui amortit le fret — et la limite au-delà de laquelle rien ne l'amortit.
 *
 * LA NUANCE DU FONDATEUR
 *
 * « Les articles à petit prix qui ont un fret énorme doivent avoir un nombre de
 * commande pour compenser, car l'envoi est généralement sur la commande et non
 * sur un article. C'est là qu'il faut faire la nuance. »
 *
 * Il a raison, et le reste du code lui donnait tort. Le transporteur cote UN
 * ENVOI, pas un article : `calculerCout` divise d'ailleurs déjà le devis par la
 * quantité. Mais la quantité, elle, était choisie en ne regardant que le prix
 * de la marchandise :
 *
 *     const estPetit = prixAchat < 5 000 ;
 *     return estPetit ? 5 : 1 ;
 *
 * Le fret n'entrait pas dans la décision. Un article à 5 001 FCFA avec 30 000
 * FCFA de port repartait donc par 1, se faisait marquer « fret disproportionné »,
 * et finissait éteint ou basculé au groupage — alors qu'il suffisait d'en
 * commander cinq.
 *
 * CE QUI SE DILUE, ET CE QUI NE SE DILUE PAS
 *
 * Un devis de transport se lit en deux morceaux :
 *
 *     devis(N)  =  part fixe  +  part au poids × N
 *
 * La part fixe — prise en charge, documents, manutention — se partage entre les
 * pièces : c'est elle que la quantité dilue. La part au poids ne se dilue
 * jamais, puisqu'elle croît avec le nombre de pièces.
 *
 *     fret unitaire(N)  =  part fixe / N  +  part au poids
 *
 * Quand N grandit, le fret unitaire descend vers la part au poids et s'y
 * arrête. Il y a donc un PLANCHER.
 *
 * D'OÙ LA SEULE QUESTION QUI COMPTE
 *
 * Ce plancher passe-t-il sous le plafond qu'on s'est fixé ?
 *
 *   — S'il y passe, l'article est bon : il existe une quantité qui le rend
 *     vendable, et c'est celle-là qu'il faut inscrire en commande minimum.
 *     Le refuser serait perdre une vente pour une erreur d'arithmétique.
 *
 *   — S'il n'y passe pas, aucune quantité ne le sauvera. Multiplier les pièces
 *     ne ferait qu'enfler la commande minimum sans jamais améliorer le rapport.
 *     Là, et là seulement, l'article ne relève pas de ce transporteur.
 *
 * C'est cette distinction que le code ne faisait pas : il traitait les deux cas
 * de la même façon — un refus.
 *
 * ON MESURE, ON NE MODÉLISE PAS
 *
 * Cette fonction ne suppose aucune formule de tarif. Elle prend les devis
 * RÉELLEMENT obtenus du transporteur à chaque quantité essayée et elle les
 * compare. Un transporteur qui facturerait autrement — au palier, au volume,
 * avec un minimum de perception — reste correctement traité, parce qu'on lit
 * ses chiffres au lieu de les deviner.
 */

export interface DevisParQuantite {
  /** Le nombre de pièces demandées au transporteur. */
  quantite: number;
  /** Ce qu'il facture pour L'ENVOI COMPLET de ces pièces, en FCFA. */
  fret_lot_fcfa: number;
}

export interface Amortissement {
  /** La commande minimum à inscrire. */
  quantite: number;
  /** Ce que le fret coûte alors, ramené à la pièce. */
  fret_unitaire_fcfa: number;
  /** Le fret unitaire rapporté au prix d'achat de la pièce. */
  ratio: number;
  /**
   * Vrai quand la quantité retenue tient sous le plafond. Faux quand aucune
   * quantité essayée n'y parvient : l'article ne relève pas de ce transporteur,
   * et c'est un fait sur le transporteur, pas sur l'article.
   */
  amorti: boolean;
  /** De quoi expliquer la décision à l'écran, sans avoir à la recalculer. */
  essais: { quantite: number; fret_unitaire_fcfa: number; ratio: number }[];
}

/**
 * Retient la plus PETITE quantité qui fait passer le fret sous le plafond.
 *
 * La plus petite, et non la meilleure : une commande minimum est une barrière à
 * l'achat. Descendre le fret de 4,9× à 0,8× en imposant cinquante pièces
 * n'aide personne si cinq pièces suffisaient à passer sous le plafond.
 */
export function amortirLeFret(params: {
  prixAchatFcfa: number;
  /** Les devis obtenus du transporteur, une ligne par quantité essayée. */
  devis: DevisParQuantite[];
  /** Fret unitaire maximum toléré, en multiple du prix d'achat de la pièce. */
  ratioFretMaximum: number;
}): Amortissement | null {
  const { prixAchatFcfa, ratioFretMaximum } = params;

  const essais = params.devis
    .filter((d) => d.quantite > 0 && Number.isFinite(d.fret_lot_fcfa))
    .map((d) => {
      const fret_unitaire_fcfa = d.fret_lot_fcfa / d.quantite;
      return {
        quantite: Math.round(d.quantite),
        fret_unitaire_fcfa: Math.round(fret_unitaire_fcfa),
        // Un article gratuit rendrait tout rapport infini : on l'exclut plutôt
        // que de renvoyer un nombre qui ne veut rien dire.
        ratio: prixAchatFcfa > 0 ? fret_unitaire_fcfa / prixAchatFcfa : Number.POSITIVE_INFINITY,
      };
    })
    .sort((a, b) => a.quantite - b.quantite);

  if (essais.length === 0) return null;

  const premierQuiPasse = essais.find((e) => e.ratio <= ratioFretMaximum);
  if (premierQuiPasse) {
    return { ...premierQuiPasse, amorti: true, essais };
  }

  // Aucune quantité ne passe. On renvoie tout de même la meilleure tentative :
  // elle dit de combien on a manqué, ce qui permet de juger s'il faut relever
  // le plafond ou renoncer à l'article.
  const meilleur = essais.reduce((a, b) => (b.ratio < a.ratio ? b : a));
  return { ...meilleur, amorti: false, essais };
}
