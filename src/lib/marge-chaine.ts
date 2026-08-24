/**
 * La marge sur toute la chaîne, sans faire flamber les prix.
 *
 * CE QUE LE FONDATEUR DEMANDE, ET POURQUOI C'EST TENABLE
 *
 * « Il faut que j'aie une marge sur toute la chaîne, mais faudrait qu'on trouve
 * un moyen d'équilibrer tout ça de sorte à ce que les prix ne flambent pas. Si
 * nous vendons la qualité et le service premium, les clients paieront. »
 *
 * Les deux moitiés de la phrase ne se contredisent pas, à une condition : que
 * la marge se prenne LÀ OÙ IL Y A DE LA PLACE, et pas uniformément.
 *
 * Jusqu'ici la marge de 40 % ne portait que sur l'article. Le fret traversait
 * la maison sans rien laisser — 7 710 F sur un ticket moyen de 17 847 F, soit
 * 43 % de ce que paie le client, pour zéro franc de marge.
 *
 * TROIS ENDROITS OÙ PRENDRE, ET DEUX OÙ NE JAMAIS PRENDRE
 *
 *   l'article        40 %. C'est la marge commerciale, elle ne bouge pas.
 *
 *   le fret          0 % quand CJ le porte : il pèse déjà la moitié du ticket,
 *                    y ajouter quoi que ce soit rendrait la boutique invendable
 *                    face aux importateurs chinois d'Adjamé.
 *                    Un taux en groupage, où le fret tombe de 7 710 à ~209 F
 *                    par article : là, il reste de la place.
 *
 *   le service       un montant FIXE par commande. C'est la vraie réponse à la
 *                    question. Un frais fixe de 2 000 F sur un panier de
 *                    31 000 F, c'est 6 % — invisible. Le même montant pris en
 *                    pourcentage du fret rapporterait 60 F. Et le client
 *                    accepte plus volontiers ce qu'il comprend : le traitement
 *                    de sa commande, la garantie payé-protégé, le suivi, le
 *                    service après-vente.
 *
 *   les droits       JAMAIS. C'est de l'argent dû à l'État. Le majorer est
 *   et taxes         indéfendable, et se voit à la première déclaration qu'un
 *                    client compare. On les refacture au franc près.
 *
 *   le débours       JAMAIS non plus. Un débours avancé pour le compte du
 *                    client se rembourse, il ne se vend pas.
 *
 * LE GARDE-FOU EST LA PARTIE IMPORTANTE
 *
 * « Que les prix ne flambent pas » n'est pas une intention, c'est une règle qui
 * doit pouvoir REFUSER. Le moteur calcule le prix rendu, le compare à un
 * plafond de compétitivité, et quand il le dépasse il le DIT au lieu de le
 * publier. Un article invendable affiché à un prix invendable coûte plus cher
 * qu'un article absent : il apprend au visiteur que la maison est chère.
 */

export type ModeAcheminement = 'cj_ddp' | 'groupage';

export interface ParametresMargeChaine {
  /** Marge commerciale sur la marchandise. Ne bouge pas. */
  marge_article: number;
  /**
   * Marge sur le fret, par mode. Nulle en porte-à-porte CJ, où le fret pèse
   * déjà la moitié du ticket.
   */
  marge_fret_cj: number;
  marge_fret_groupage: number;
  /** Frais de service, par COMMANDE et non par article : le lot le dilue. */
  frais_service_fcfa: number;
  /**
   * Plafond de compétitivité, en multiple du prix d'achat. Au-delà, le moteur
   * refuse plutôt que d'afficher un prix qui ferait fuir.
   */
  plafond_competitivite: number;
  /** Taux global de droits et taxes, quand c'est nous l'importateur. */
  taux_droits_et_taxes: number;
}

export interface LigneChaine {
  /** Ce que la marchandise coûte chez le fournisseur. */
  achat_fcfa: number;
  /** Le fret, pour cet article, dans son mode. */
  fret_fcfa: number;
  mode: ModeAcheminement;
  /**
   * Frais d'arrivée à notre charge : acconage, échange de connaissement,
   * magasinage, livraison locale. Nuls en porte-à-porte CJ, qui livre à
   * l'adresse sous son propre régime.
   */
  frais_destination_fcfa?: number;
}

export interface PosteChaine {
  libelle: string;
  cout_fcfa: number;
  marge_fcfa: number;
  facture_fcfa: number;
  /** Vrai pour les postes qu'on refacture au franc près, sans marge. */
  sans_marge: boolean;
}

export interface ChiffrageChaine {
  postes: PosteChaine[];
  cout_total_fcfa: number;
  marge_totale_fcfa: number;
  prix_rendu_fcfa: number;
  /** La marge rapportée à ce que paie le client — le chiffre qui compte. */
  taux_marge_sur_ticket: number;
  /** Vrai quand le prix rendu tient sous le plafond de compétitivité. */
  vendable: boolean;
  /** Nommé quand ce n'est pas vendable, pour qu'on sache quoi corriger. */
  motif_refus: string | null;
}

const arrondir = (v: number) => Math.round(v);

/**
 * Le chiffrage d'une ligne, poste par poste.
 *
 * `frais_service_fcfa` n'entre PAS ici : il se prend une fois par commande, pas
 * une fois par article. L'appeler à la ligne ferait payer trois fois le même
 * service à qui achète trois articles — et c'est exactement le genre de détail
 * qui fait qu'un panier paraît cher sans qu'on sache pourquoi.
 */
export function chiffrerLigne(
  ligne: LigneChaine,
  p: ParametresMargeChaine,
): ChiffrageChaine {
  const postes: PosteChaine[] = [];

  // ---- La marchandise -----------------------------------------------------
  const margeArticle = arrondir(ligne.achat_fcfa * p.marge_article);
  postes.push({
    libelle: 'Marchandise',
    cout_fcfa: ligne.achat_fcfa,
    marge_fcfa: margeArticle,
    facture_fcfa: ligne.achat_fcfa + margeArticle,
    sans_marge: false,
  });

  // ---- Le fret ------------------------------------------------------------
  const tauxFret = ligne.mode === 'groupage' ? p.marge_fret_groupage : p.marge_fret_cj;
  const margeFret = arrondir(ligne.fret_fcfa * tauxFret);
  postes.push({
    libelle: ligne.mode === 'groupage' ? 'Fret groupage maritime' : 'Fret express CJ',
    cout_fcfa: ligne.fret_fcfa,
    marge_fcfa: margeFret,
    facture_fcfa: ligne.fret_fcfa + margeFret,
    sans_marge: tauxFret === 0,
  });

  // ---- Ce qui n'existe qu'en groupage, parce que c'est nous l'importateur --
  if (ligne.mode === 'groupage') {
    // Les droits portent sur la valeur CAF : marchandise + fret + assurance.
    const caf = ligne.achat_fcfa + ligne.fret_fcfa;
    const droits = arrondir(caf * p.taux_droits_et_taxes);
    postes.push({
      libelle: 'Droits et taxes',
      cout_fcfa: droits,
      marge_fcfa: 0,
      facture_fcfa: droits,
      sans_marge: true,
    });

    const destination = ligne.frais_destination_fcfa ?? 0;
    if (destination > 0) {
      postes.push({
        libelle: 'Frais d’arrivée et livraison',
        cout_fcfa: destination,
        marge_fcfa: 0,
        facture_fcfa: destination,
        sans_marge: true,
      });
    }
  }

  const cout_total_fcfa = postes.reduce((s, x) => s + x.cout_fcfa, 0);
  const marge_totale_fcfa = postes.reduce((s, x) => s + x.marge_fcfa, 0);
  const prix_rendu_fcfa = cout_total_fcfa + marge_totale_fcfa;

  // ---- Le garde-fou -------------------------------------------------------
  const plafond = arrondir(ligne.achat_fcfa * p.plafond_competitivite);
  const vendable = prix_rendu_fcfa <= plafond;

  return {
    postes,
    cout_total_fcfa,
    marge_totale_fcfa,
    prix_rendu_fcfa,
    taux_marge_sur_ticket:
      prix_rendu_fcfa > 0 ? marge_totale_fcfa / prix_rendu_fcfa : 0,
    vendable,
    motif_refus: vendable
      ? null
      : `Prix rendu ${prix_rendu_fcfa.toLocaleString('fr-FR')} F pour un achat de ` +
        `${ligne.achat_fcfa.toLocaleString('fr-FR')} F, soit ` +
        `${(prix_rendu_fcfa / ligne.achat_fcfa).toFixed(1)} fois le prix d’achat. ` +
        `Le plafond est à ${p.plafond_competitivite} fois. ` +
        (ligne.mode === 'cj_ddp'
          ? 'Cet article coûte trop cher en express : il relève du groupage.'
          : 'Même en groupage il ne passe pas : il faut un volume plus important.'),
  };
}

export interface ChiffragePanier {
  lignes: ChiffrageChaine[];
  frais_service_fcfa: number;
  cout_total_fcfa: number;
  marge_totale_fcfa: number;
  total_client_fcfa: number;
  taux_marge_sur_ticket: number;
  /** Les lignes que le garde-fou refuse, s'il y en a. */
  lignes_refusees: number;
}

/**
 * Le panier entier, frais de service compris.
 *
 * C'est ici seulement que le frais de service apparaît, et une seule fois. Il
 * est intégralement de la marge : il ne couvre aucun débours, il rémunère le
 * travail de la maison — le traitement de la commande, la garantie, le suivi.
 * L'appeler « frais » plutôt que « marge » n'est pas un habillage : c'est ce
 * que le client achète, et il faut qu'il puisse le lire ainsi.
 */
export function chiffrerPanier(
  lignes: LigneChaine[],
  p: ParametresMargeChaine,
): ChiffragePanier {
  const chiffrees = lignes.map((l) => chiffrerLigne(l, p));

  const cout_total_fcfa = chiffrees.reduce((s, c) => s + c.cout_total_fcfa, 0);
  const marge_lignes = chiffrees.reduce((s, c) => s + c.marge_totale_fcfa, 0);

  // Un panier vide ne porte pas de frais de service : il n'y a pas de commande
  // à traiter, et facturer un service sur rien serait incompréhensible.
  const frais_service_fcfa = lignes.length > 0 ? p.frais_service_fcfa : 0;

  const marge_totale_fcfa = marge_lignes + frais_service_fcfa;
  const total_client_fcfa = cout_total_fcfa + marge_totale_fcfa;

  return {
    lignes: chiffrees,
    frais_service_fcfa,
    cout_total_fcfa,
    marge_totale_fcfa,
    total_client_fcfa,
    taux_marge_sur_ticket:
      total_client_fcfa > 0 ? marge_totale_fcfa / total_client_fcfa : 0,
    lignes_refusees: chiffrees.filter((c) => !c.vendable).length,
  };
}
