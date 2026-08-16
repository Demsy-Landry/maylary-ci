/**
 * Coter une importation avant d'en connaître les tarifs fermes.
 *
 * CE QUE LE FONDATEUR DEMANDE, ET QUI N'EST PAS CONTRADICTOIRE
 *
 * « Les articles qui ne sont pas pris en compte par CJ pour l'expédition, avec
 * toutes les données, peuvent avoir une cotation SOUS RÉSERVE des vrais
 * tarifs. » Puis : « Il y a des actions qui nécessitent juste une vérification
 * avant validation de facture définitive, sinon tout peut être estimé. »
 *
 * Autrement dit : estimer est permis, et même attendu — ce qui est interdit,
 * c'est d'ENGAGER sur une estimation. La distinction ne tient pas au calcul,
 * elle tient au document qu'il produit. Une cotation peut vivre sous réserve ;
 * une facture définitive, non.
 *
 * D'où deux choses inséparables dans ce module :
 *
 *   1. un chiffrage complet, même quand tout n'est pas ferme ;
 *   2. des RÉSERVES NOMMÉES, et une porte fermée sur la facture définitive
 *      tant qu'elles n'ont pas été levées.
 *
 * POURQUOI LES RÉSERVES SONT NOMMÉES UNE À UNE
 *
 * « Prix indicatif » ne dit rien : ni ce qui peut bouger, ni de combien, ni qui
 * peut le confirmer. Une réserve utile désigne le poste, la raison et l'action.
 * C'est la différence entre un avertissement décoratif et une liste de choses à
 * faire avant d'engager la maison.
 *
 * L'ASSOCIATION OUVRE UN GROUPAGE
 *
 * Règle du fondateur, et elle est structurante : dès que plusieurs colis se
 * rejoignent, on n'est plus dans l'envoi isolé mais dans le groupage — sauf si
 * le volume atteint le conteneur complet, auquel cas c'est le conteneur qui
 * s'impose, et il coûte moins cher au mètre cube.
 */

import {
  chiffrerManutention,
  type LigneBareme,
  type SensManutention,
  type TailleConteneur,
} from './bareme-manutention';

export type Conditionnement = 'conteneur' | 'groupage';

export interface LigneCotation {
  produit_id: string;
  nom: string;
  quantite: number;
  poids_unitaire_kg: number;
  volume_unitaire_m3: number;
  prix_achat_unitaire_fcfa: number;
}

/**
 * Volume utile d'un conteneur, en mètres cubes. Ce n'est pas sa capacité
 * théorique : on ne remplit jamais un conteneur à ras bord, et le calage prend
 * de la place.
 */
export const VOLUME_UTILE: Record<TailleConteneur, number> = { 20: 28, 40: 58 };

/**
 * Le conditionnement qui s'impose.
 *
 * Un seul colis reste un envoi isolé. Dès qu'il y en a plusieurs, c'est un
 * groupage — c'est la règle du métier et celle du fondateur. Mais si le volume
 * atteint de quoi remplir un conteneur, le conteneur complet l'emporte : à ce
 * niveau il revient moins cher au mètre cube, et le groupeur ne ferait que
 * s'interposer.
 */
export function conditionnementRequis(lignes: LigneCotation[]): {
  conditionnement: Conditionnement;
  motif: string;
  volume_total_m3: number;
} {
  const volume = lignes.reduce((s, l) => s + l.volume_unitaire_m3 * l.quantite, 0);

  if (volume >= VOLUME_UTILE[20]) {
    return {
      conditionnement: 'conteneur',
      motif: `${volume.toFixed(2)} m³ : de quoi remplir un conteneur, qui revient moins cher au mètre cube que le groupage`,
      volume_total_m3: volume,
    };
  }
  if (lignes.length > 1) {
    return {
      conditionnement: 'groupage',
      motif: `${lignes.length} références associées : l'association ouvre un groupage`,
      volume_total_m3: volume,
    };
  }
  return {
    conditionnement: 'groupage',
    motif: 'envoi isolé, acheminé en groupage faute de volume pour un conteneur',
    volume_total_m3: volume,
  };
}

export interface Reserve {
  /** Le poste concerné, pour qu'on sache où le chiffre bougera. */
  poste: string;
  /** Pourquoi il n'est pas ferme. */
  raison: string;
  /** Ce qu'il faut faire, et auprès de qui. */
  action: string;
}

export interface DetailCotation {
  marchandise_fcfa: number;
  fret_fcfa: number;
  assurance_fcfa: number;
  droits_et_taxes_fcfa: number;
  manutention_fcfa: number;
  frais_destination_fcfa: number;
}

export interface CotationProvisoire {
  conditionnement: Conditionnement;
  motif_conditionnement: string;
  volume_total_m3: number;
  poids_total_kg: number;
  detail: DetailCotation;
  total_fcfa: number;
  /** Le total réparti sur les pièces : c'est ce que le revendeur compare. */
  cout_unitaire_fcfa: number;
  quantite_totale: number;
  reserves: Reserve[];
  /** Vrai dès qu'une réserve subsiste. */
  sous_reserve: boolean;
}

export interface ParametresCotation {
  /** Tarif de groupage retenu, en USD par unité payante. */
  fret_usd_par_up: number;
  taux_change_usd_fcfa: number;
  /** Tarif du conteneur complet, en USD, quand c'est le conditionnement retenu. */
  fret_conteneur_usd?: number;
  taille_conteneur: TailleConteneur;
  taux_assurance: number;
  taux_couverture_assurance: number;
  frais_police_assurance_fcfa: number;
  taux_taxe_assurance: number;
  /** Taux global de droits et taxes, à défaut d'une classification tarifaire. */
  taux_droits_et_taxes: number;
  /** Frais de destination chiffrés à part, 0 si aucun montant n'est connu. */
  frais_destination_fcfa: number;
  /** Vrai quand au moins un poste de destination reste sans montant. */
  frais_destination_incomplets: boolean;
}

/**
 * Le chiffrage, réserves comprises.
 *
 * Aucun poste n'est omis parce qu'on ignore son tarif : il est estimé au
 * meilleur repère disponible, et la réserve dit sur quoi. Un poste absent du
 * total serait bien pire qu'un poste estimé — il ne se verrait pas.
 */
export function coterImport(params: {
  lignes: LigneCotation[];
  parametres: ParametresCotation;
  bareme_manutention: LigneBareme[];
  sens?: SensManutention;
  designation_douaniere?: string;
}): CotationProvisoire {
  const { lignes, parametres: p } = params;
  const sens = params.sens ?? 'import';

  const { conditionnement, motif, volume_total_m3 } = conditionnementRequis(lignes);
  const poids_total_kg = lignes.reduce((s, l) => s + l.poids_unitaire_kg * l.quantite, 0);
  const quantite_totale = lignes.reduce((s, l) => s + l.quantite, 0);

  const reserves: Reserve[] = [];

  const marchandise_fcfa = Math.round(
    lignes.reduce((s, l) => s + l.prix_achat_unitaire_fcfa * l.quantite, 0),
  );

  // ---- Fret. L'unité payante suit la règle poids/volume. -------------------
  let fret_fcfa: number;
  if (conditionnement === 'conteneur' && p.fret_conteneur_usd) {
    const conteneurs = Math.max(1, Math.ceil(volume_total_m3 / VOLUME_UTILE[p.taille_conteneur]));
    fret_fcfa = Math.round(conteneurs * p.fret_conteneur_usd * p.taux_change_usd_fcfa);
  } else {
    const up = Math.max(volume_total_m3, poids_total_kg / 1000);
    fret_fcfa = Math.round(up * p.fret_usd_par_up * p.taux_change_usd_fcfa);
  }
  reserves.push({
    poste: 'Fret maritime',
    raison: 'chiffré sur la fourchette de marché, pas sur une cotation ferme',
    action: 'demander un prix ferme à un consolidateur pour la ligne et la période',
  });

  // ---- Assurance facultés, barème de l'assureur local. ---------------------
  const valeur_assuree = Math.round((marchandise_fcfa + fret_fcfa) * p.taux_couverture_assurance);
  const assurance_fcfa = Math.round(
    (Math.round(valeur_assuree * p.taux_assurance) + p.frais_police_assurance_fcfa) *
      (1 + p.taux_taxe_assurance),
  );

  // ---- Droits et taxes. ----------------------------------------------------
  const droits_et_taxes_fcfa = Math.round((marchandise_fcfa + fret_fcfa + assurance_fcfa) * p.taux_droits_et_taxes);
  reserves.push({
    poste: 'Droits et taxes',
    raison: 'appliqués à un taux global, faute de classification tarifaire ligne à ligne',
    action: 'classer chaque référence au Tarif Extérieur Commun avec Le Déclarant',
  });

  // ---- Manutention terre : seulement si le conteneur est le nôtre. ---------
  let manutention_fcfa = 0;
  if (conditionnement === 'conteneur') {
    const conteneurs = Math.max(1, Math.ceil(volume_total_m3 / VOLUME_UTILE[p.taille_conteneur]));
    const m = chiffrerManutention(params.bareme_manutention, {
      sens,
      designation: params.designation_douaniere ?? lignes.map((l) => l.nom).join(' '),
      taille: p.taille_conteneur,
      poids_tonnes: poids_total_kg / 1000 / conteneurs,
    });
    if (m.possible) {
      manutention_fcfa = m.ligne.total_fcfa * conteneurs;
      reserves.push({
        poste: 'Acconage et relevage',
        raison: `barème FEDERMAR du ${m.ligne.date_application}, catégorie ${m.ligne.categorie} — ${m.ligne.motif_classement}`,
        action: 'confirmer la catégorie et vérifier qu’aucun barème plus récent ne s’applique',
      });
      if (m.ligne.colis_lourd) {
        reserves.push({
          poste: 'Surcharge colis lourd',
          raison: `le poids dépasse ${m.ligne.seuil_colis_lourd_tonnes} tonnes ; son montant ne figure pas au barème`,
          action: 'demander le montant de la surcharge à l’acconier',
        });
      }
    } else {
      reserves.push({
        poste: 'Acconage et relevage',
        raison: m.motif,
        action: 'compléter le barème de manutention',
      });
    }
  }

  // ---- Le reste des frais d'arrivée. ---------------------------------------
  const frais_destination_fcfa = p.frais_destination_fcfa;
  if (p.frais_destination_incomplets) {
    reserves.push({
      poste: 'Échange de connaissement, magasinage, retrait documentaire',
      raison: 'aucun montant connu : ces frais varient d’une compagnie à l’autre',
      action: 'relever les montants sur une facture de compagnie, puis les saisir dans « Frais de destination »',
    });
  }

  const detail: DetailCotation = {
    marchandise_fcfa,
    fret_fcfa,
    assurance_fcfa,
    droits_et_taxes_fcfa,
    manutention_fcfa,
    frais_destination_fcfa,
  };
  const total_fcfa = Object.values(detail).reduce((s, v) => s + v, 0);

  return {
    conditionnement,
    motif_conditionnement: motif,
    volume_total_m3,
    poids_total_kg,
    detail,
    total_fcfa,
    quantite_totale,
    cout_unitaire_fcfa: quantite_totale > 0 ? Math.round(total_fcfa / quantite_totale) : total_fcfa,
    reserves,
    sous_reserve: reserves.length > 0,
  };
}

/**
 * LA PORTE DEVANT LA FACTURE DÉFINITIVE
 *
 * « Il y a des actions qui nécessitent juste une vérification avant validation
 * de facture définitive. » C'est ici que cette phrase devient exécutable.
 *
 * Estimer, coter, envoyer un devis : permis sous réserve. Émettre une facture
 * définitive : seulement après vérification, parce qu'une facture définitive
 * engage un prix qu'on ne changera plus une fois le client payé.
 */
export function peutFacturerDefinitivement(devis: {
  sous_reserve: boolean;
  verifiee_le: string | null;
}): { autorise: true } | { autorise: false; motif: string } {
  if (!devis.sous_reserve) return { autorise: true };
  if (devis.verifiee_le) return { autorise: true };
  return {
    autorise: false,
    motif:
      'Cette cotation repose encore sur des repères de marché. Levez les réserves et marquez-la vérifiée avant d’émettre une facture définitive : un prix facturé ne se corrige plus après paiement.',
  };
}
