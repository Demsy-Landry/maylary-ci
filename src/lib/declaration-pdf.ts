import { jsPDF } from 'jspdf';
import { ENCRE, GRIS, GRIS_CLAIR, chiffre } from '@/lib/facture-pdf';
import type { Liquidation } from '@/lib/supabase';
import {
  GROUPES_DECLARATION,
  taxesOrdonnees,
  type ValeursDeclaration,
  type LigneDeclaration,
} from '@/lib/declaration';

/**
 * Le document de déclaration — un seul, pour un seul écran.
 *
 * Il remplace les deux documents d'avant : le « brouillon » qui portait les
 * cases sans les chiffres, et la « simulation » qui portait les chiffres sans
 * les numéros. Un déclarant n'a pas besoin de deux papiers dont chacun dit la
 * moitié de la vérité.
 *
 * LES TROIS RÈGLES DE LISIBILITÉ DU FONDATEUR, APPLIQUÉES À LA LETTRE
 *   * tous les chiffres en GRAS ;
 *   * chaque case dans un CADRE, jamais de texte flottant ;
 *   * le TOTAL À PAYER est la valeur la plus visible du document.
 *
 * SUR L'EN-TÊTE
 *
 * J'avais d'abord écarté toute mention de la République et de la Direction
 * Générale des Douanes : un document privé sous ces marques se fait prendre
 * pour un acte officiel. Le fondateur, transitaire de métier, les demande et a
 * lui-même posé les garde-fous — sous-titre générique, aucune mention du
 * système officiel dans le titre, mention légale en pied de CHAQUE page. Sa
 * décision est appliquée telle quelle.
 *
 * Ce que le document ne porte pas et ne portera pas : ni armoiries, ni timbre,
 * ni numéro de déclaration officiel. Le texte situe le cadre réglementaire ; il
 * n'imite aucun sceau.
 *
 * LA PAGINATION
 *
 * Chaque bloc mesure sa hauteur avant d'être dessiné et saute à la page
 * suivante s'il n'entre pas : jamais de ligne coupée en deux.
 */

const MARGE = 12;
const LARGEUR = 210;
const HAUTEUR = 297;
const UTILE = LARGEUR - 2 * MARGE;

/**
 * Le séparateur de milliers de la facture, pas celui du navigateur.
 *
 * `toLocaleString('fr-FR')` sépare avec une espace fine insécable (U+202F) que
 * l'encodage WinAnsi des polices PDF standard ne connaît pas : elle s'imprime
 * en « / ». Le document affichait donc « 106/400/000 » là où le douanier
 * attend un montant. `chiffre()` sépare avec une espace ASCII.
 */
const montant = chiffre;

/**
 * Un taux du moteur de liquidation, en pourcentage lisible.
 *
 * Attention au piège : `taux_dd` ne porte pas la même unité selon d'où il
 * vient. La liquidation le renvoie en FRACTION (0,20), la classification
 * assistée le stocke en POURCENTAGE (20). Ici on est toujours du côté de la
 * liquidation. Sans cette conversion, le document affichait « Taux DD 0.2 % »
 * juste au-dessus d'une case 47 qui annonçait « DD … 20 % » sur la même ligne.
 */
const pourcent = (fraction: number) =>
  `${(fraction * 100).toFixed(2).replace(/\.00$/, '').replace('.', ',')} %`;

/** Une case encadrée : numéro et intitulé en petit, valeur en GRAS dessous. */
function dessinerCase(
  doc: jsPDF,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  numero: string,
  intitule: string,
  valeur: string,
) {
  doc.setDrawColor(120, 113, 108);
  doc.setLineWidth(0.25);
  doc.rect(x, y, largeur, hauteur);

  let decalage = 1.5;
  if (numero && numero !== '—') {
    doc.setFillColor(...GRIS_CLAIR);
    doc.rect(x, y, 6.5, 4.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.6);
    doc.setTextColor(...ENCRE);
    doc.text(numero, x + 3.25, y + 3, { align: 'center' });
    decalage = 7.5;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(...GRIS);
  doc.text(doc.splitTextToSize(intitule, largeur - decalage - 1)[0] ?? '', x + decalage, y + 3);

  // Toutes les valeurs en gras : exigence explicite du fondateur, et c'est ce
  // qui rend le document lisible d'un coup d'œil sur un bureau encombré.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...ENCRE);
  const lignes = doc.splitTextToSize(valeur || '—', largeur - 3) as string[];
  const max = Math.max(1, Math.floor((hauteur - 5) / 3.4));
  lignes.slice(0, max).forEach((l, i) => doc.text(l, x + 1.5, y + 7.6 + i * 3.4));
}

function enTete(doc: jsPDF, page: number, reference: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...ENCRE);
  doc.text("RÉPUBLIQUE DE CÔTE D'IVOIRE", LARGEUR / 2, 13, { align: 'center' });
  doc.setFontSize(9.5);
  doc.text('DIRECTION GÉNÉRALE DES DOUANES', LARGEUR / 2, 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.text('Document de simulation de calcul douanier', LARGEUR / 2, 23.5, { align: 'center' });

  doc.setDrawColor(...ENCRE);
  doc.setLineWidth(0.5);
  doc.line(MARGE, 26, LARGEUR - MARGE, 26);

  doc.setFontSize(6.5);
  doc.setTextColor(...GRIS);
  doc.text(`Réf. ${reference || '—'}`, MARGE, 30);
  doc.text(`Page ${page}`, LARGEUR - MARGE, 30, { align: 'right' });

  return 33.5;
}

function piedDePage(doc: jsPDF) {
  doc.setDrawColor(...GRIS);
  doc.setLineWidth(0.2);
  doc.line(MARGE, HAUTEUR - 14, LARGEUR - MARGE, HAUTEUR - 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(...ENCRE);
  doc.text(
    "Document d'aide au calcul — La déclaration officielle doit être saisie dans le système douanier officiel (SYDAM).",
    LARGEUR / 2,
    HAUTEUR - 10,
    { align: 'center' },
  );
  doc.setFontSize(6);
  doc.setTextColor(...GRIS);
  doc.text(
    `Établi par MayLary Group le ${new Date().toLocaleDateString('fr-FR')}`,
    LARGEUR / 2,
    HAUTEUR - 6.5,
    { align: 'center' },
  );
}

export interface DonneesDocument {
  valeurs: ValeursDeclaration;
  lignes: LigneDeclaration[];
  liquidation: Liquidation;
  /**
   * référentiel → code → libellé : le document n'imprime jamais un code nu.
   *
   * Le niveau « référentiel » n'est pas décoratif. Les codes se répètent d'une
   * liste à l'autre : le mode de transport 1 est le maritime, la nature de
   * transaction 1 est l'achat ferme. Une table à plat les confondait, et le
   * document imprimait « Nature de la transaction : 1 — Maritime ».
   */
  libelles: Record<string, Record<string, string>>;
}

/**
 * Le document, construit mais pas encore remis.
 *
 * Il sert deux usages qui ne veulent pas la même chose : le déclarant le
 * TÉLÉCHARGE, l'atelier de cotation le JOINT au devis du client. Un module qui
 * n'aurait su que déclencher un téléchargement aurait obligé l'atelier à
 * recopier le dessin, et deux dessins finissent toujours par diverger.
 */
export function construireDeclarationPdf(d: DonneesDocument): jsPDF {
  const { valeurs, lignes, liquidation, libelles } = d;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let page = 1;
  let y = enTete(doc, page, valeurs.reference ?? '');

  const place = (hauteur: number) => {
    if (y + hauteur <= HAUTEUR - 18) return;
    piedDePage(doc);
    doc.addPage();
    page += 1;
    y = enTete(doc, page, valeurs.reference ?? '');
  };

  /**
   * Un intitulé de section, qui emmène avec lui ce qu'il annonce.
   *
   * `suite` est la hauteur du premier bloc qui suit. Sans elle, l'intitulé
   * tenait seul au bas d'une page et son tableau ouvrait la suivante : le
   * document montrait « RÉCAPITULATIF DES DROITS ET TAXES » sur un tiers de
   * page vide. Un titre orphelin n'annonce plus rien.
   */
  const titre = (texte: string, suite = 0) => {
    place(10 + suite);
    doc.setFillColor(...GRIS_CLAIR);
    doc.rect(MARGE, y, UTILE, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...ENCRE);
    doc.text(texte.toUpperCase(), MARGE + 2, y + 3.9);
    y += 7.5;
  };

  /** Une rangée de cases de largeurs égales. */
  const rangee = (cases: [string, string, string][], hauteur = 12) => {
    place(hauteur + 2);
    const largeur = (UTILE - (cases.length - 1) * 2) / cases.length;
    cases.forEach(([numero, intitule, valeur], i) => {
      dessinerCase(doc, MARGE + i * (largeur + 2), y, largeur, hauteur, numero, intitule, valeur);
    });
    y += hauteur + 2;
  };

  /** Un code seul ne dit rien au client à qui on remet le document. */
  const nomme = (source: string, v: string) => {
    if (!v) return '';
    const libelle = libelles[source]?.[v];
    return libelle ? `${v} — ${libelle}` : v;
  };

  // ---------- Les blocs de saisie, case par case ----------
  for (const groupe of GROUPES_DECLARATION) {
    titre(groupe.titre, 17);

    let tampon: [string, string, string][] = [];
    const vider = (hauteur = 12) => {
      if (tampon.length === 0) return;
      rangee(tampon, hauteur);
      tampon = [];
    };

    for (const c of groupe.cases) {
      const brut = valeurs[c.cle] ?? '';
      const affiche = c.liste && !c.liste.startsWith('intervenant:') ? nomme(c.liste, brut) : brut;
      const large = c.type === 'long';

      if (large) {
        vider();
        rangee([[c.numero, c.libelle, affiche]], 15);
      } else {
        tampon.push([c.numero, c.libelle, c.icones ? nomme('modesTransport', brut) : affiche]);
        if (tampon.length === 3) vider();
      }
    }
    vider();

    // Les valeurs monétaires closent le bloc 2, comme à l'écran.
    if (groupe.numero === 2) {
      rangee([
        ['22', 'Devise de la facture', nomme('monnaies', valeurs.devise ?? '')],
        ['23', 'Taux de change', valeurs.taux_change ?? ''],
        ['6', 'Total des colis', valeurs.total_colis ?? ''],
      ]);
      rangee([
        ['35', 'Masse brute totale (kg)', valeurs.masse_brute ?? ''],
        ['38', 'Masse nette totale (kg)', valeurs.masse_nette ?? ''],
        ['5', 'Nombre d’articles', String(liquidation.lignes.length)],
      ]);
      rangee([
        ['—', 'FOB total (XOF)', montant(liquidation.globaux.fob_total_fcfa)],
        ['12', 'Fret total (XOF)', montant(liquidation.globaux.fret_total_fcfa)],
        ['12', 'Assurance totale (XOF)', montant(liquidation.globaux.assurance_total_fcfa)],
        ['46', 'VALEUR EN DOUANE — CAF (XOF)', montant(liquidation.globaux.caf_total_fcfa)],
      ]);
    }
  }

  // ---------- Les articles ----------
  titre('Articles et positions tarifaires', 40);
  for (const l of liquidation.lignes) {
    const saisie = lignes.find((x) => x.numero === l.numero);
    place(40);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...ENCRE);
    doc.text(`ARTICLE ${l.numero ?? ''}`, MARGE, y + 3);
    y += 5;

    rangee([['31', 'Désignation des marchandises', l.designation ?? saisie?.designation ?? '']], 14);
    rangee([
      ['33', 'Code des marchandises', l.position ?? ''],
      ['34', 'Pays d’origine', nomme('pays', saisie?.origine ?? '')],
      ['36', 'Préférence', saisie?.preference ?? ''],
    ]);
    rangee([['—', 'Désignation tarifaire officielle', l.designation_tec ?? '—']], 13);
    rangee([
      ['—', 'Taux DD', l.verifie_en_base ? pourcent(l.taux_dd) : 'non confirmé'],
      // Sans quantité, l'unité seule ne dit rien : « — u » se lit comme une
      // coquille. On n'imprime l'unité que lorsqu'elle compte quelque chose.
      ['41', 'Unités supplémentaires', saisie?.quantite ? `${saisie.quantite} ${saisie.unite}` : '—'],
      ['35', 'Masse brute (kg)', String(l.poids_brut_kg ?? '')],
      ['38', 'Masse nette (kg)', saisie?.poids_net || '—'],
    ]);

    // La traçabilité : ce qui a été proratisé sur CETTE ligne. Sans elle, le
    // document ne se vérifie pas.
    rangee([
      ['42', 'FOB ligne (XOF)', montant(l.fob_fcfa)],
      ['—', 'Fret proratisé (XOF)', montant(l.fret_fcfa)],
      ['—', 'Assurance proratisée (XOF)', montant(l.assurance_fcfa)],
      ['—', 'CAF ligne (XOF)', montant(l.caf_fcfa)],
    ]);

    // Les taxes de la ligne.
    const hauteurTaxes = 5.5 + l.taxes.length * 4.6;
    place(hauteurTaxes + 4);
    doc.setDrawColor(120, 113, 108);
    doc.setLineWidth(0.25);
    doc.rect(MARGE, y, UTILE, hauteurTaxes);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...GRIS);
    doc.text('Case 47 — Calcul des impositions', MARGE + 1.5, y + 3.2);

    let yt = y + 7.8;
    for (const t of l.taxes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.4);
      doc.setTextColor(...ENCRE);
      doc.text(t.code, MARGE + 2, yt);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.4);
      doc.setTextColor(...GRIS);
      doc.text(doc.splitTextToSize(t.libelle, 62)[0] ?? '', MARGE + 14, yt);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(...ENCRE);
      doc.text(`base ${montant(t.base_fcfa)}`, MARGE + 82, yt);
      if (t.taux > 0) {
        doc.text(pourcent(t.taux), MARGE + 118, yt);
      }
      doc.text(montant(t.montant_fcfa), LARGEUR - MARGE - 2, yt, { align: 'right' });
      yt += 4.6;
    }
    y += hauteurTaxes + 4;
  }

  // ---------- Récapitulatif ----------
  const taxes = taxesOrdonnees(liquidation.totaux_taxes);
  const hauteurRecap = 6 + taxes.length * 5;
  titre('Récapitulatif des droits et taxes', hauteurRecap + 4);
  place(hauteurRecap + 4);
  doc.setDrawColor(...ENCRE);
  doc.setLineWidth(0.4);
  doc.rect(MARGE, y, UTILE, hauteurRecap);
  let yr = y + 6;
  for (const [code, m] of taxes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.4);
    doc.setTextColor(...ENCRE);
    doc.text(code, MARGE + 3, yr);
    if (code === 'TS') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.4);
      doc.setTextColor(...GRIS);
      doc.text('par déclaration', MARGE + 16, yr);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.4);
    doc.setTextColor(...ENCRE);
    doc.text(`${montant(m)} XOF`, LARGEUR - MARGE - 3, yr, { align: 'right' });
    yr += 5;
  }
  y += hauteurRecap + 4;

  // ---------- Le total, valeur la plus visible ----------
  place(22);
  doc.setDrawColor(...ENCRE);
  doc.setLineWidth(1.1);
  doc.setFillColor(255, 244, 224);
  doc.rect(MARGE, y, UTILE, 18, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...ENCRE);
  doc.text('TOTAL À PAYER', MARGE + 4, y + 7.5);
  doc.setFontSize(18);
  doc.text(`${montant(liquidation.total_a_payer_fcfa)} XOF`, LARGEUR - MARGE - 4, y + 12.5, {
    align: 'right',
  });
  y += 22;

  // ---------- Signatures ----------
  place(30);
  const largeurSignature = (UTILE - 8) / 3;
  ['Déclarant', 'Receveur des Douanes', 'Cachet du Bureau'].forEach((intitule, i) => {
    const x = MARGE + i * (largeurSignature + 4);
    doc.setDrawColor(120, 113, 108);
    doc.setLineWidth(0.25);
    doc.rect(x, y, largeurSignature, 26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...ENCRE);
    doc.text(intitule, x + largeurSignature / 2, y + 4.5, { align: 'center' });
  });

  piedDePage(doc);
  return doc;
}

/** Le nom sous lequel le document se range, dans un dossier comme sur un disque. */
export function nomDeclarationPdf(reference: string | undefined): string {
  return `declaration-${(reference || 'simulation').replace(/[^\w-]/g, '-')}.pdf`;
}

/** Remise directe au déclarant : le navigateur enregistre le fichier. */
export function telechargerDeclarationPdf(d: DonneesDocument) {
  construireDeclarationPdf(d).save(nomDeclarationPdf(d.valeurs.reference));
}

/** Remise indirecte : le document part au stockage, joint au devis du client. */
export function declarationPdfBlob(d: DonneesDocument): Blob {
  return construireDeclarationPdf(d).output('blob');
}
