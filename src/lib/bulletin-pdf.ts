import { jsPDF } from 'jspdf';
import {
  ORANGE,
  ORANGE_SOMBRE,
  ENCRE,
  GRIS,
  GRIS_CLAIR,
  dessinerLogo,
  chiffre,
  nombreEnLettres,
} from '@/lib/facture-pdf';
import type { Liquidation, LigneLiquidee } from '@/lib/supabase';

/*
 * Bulletin de liquidation — le document imprimable du Déclarant (§ 6.2).
 *
 * Il reprend la grammaire visuelle d'une déclaration en douane : cases
 * numérotées, chiffres en gras, détail ligne à ligne, zone de signature. Ce
 * qu'il ne reprend pas, délibérément, c'est l'en-tête de l'administration.
 * Un document émis par une société privée sous les armoiries de la République
 * et le timbre de la Direction Générale des Douanes se ferait prendre pour un
 * acte officiel, quelle que soit la mention qu'on y ajoute. L'émetteur affiché
 * est donc MayLary Group, et la mention du § 6.2 barre le haut de chaque page.
 *
 * Format paysage : une ligne porte huit taxes ; en portrait elles ne tiennent
 * pas sur un rang, et un déclarant qui rapproche ce document de son bulletin
 * réel a besoin de lire une ligne d'un seul regard.
 */

const MARGE = 12;
const LARGEUR_PAGE = 297;
const HAUTEUR_PAGE = 210;
const BORD_DROIT = LARGEUR_PAGE - MARGE;
const LARGEUR_UTILE = BORD_DROIT - MARGE;

/** Renseignements d'en-tête. Aucun n'est nécessaire au calcul : ils habillent
 *  le document pour qu'il soit remettable à un client ou classable au dossier. */
export interface EnTeteBulletin {
  reference: string;
  bureau: string;
  importateur: string;
  code_importateur: string;
  rccm_ncc: string;
  fournisseur: string;
  pays_origine: string;
  mode_transport: string;
  connaissement: string;
  facture: string;
}

export const enTeteVide = (): EnTeteBulletin => ({
  reference: '',
  bureau: '',
  importateur: '',
  code_importateur: '',
  rccm_ncc: '',
  fournisseur: '',
  pays_origine: '',
  mode_transport: '',
  connaissement: '',
  facture: '',
});

/** Référence de simulation : datée, pour qu'un dossier ressorti six mois plus
 *  tard dise de quand vient le tarif appliqué. */
export function referenceSimulation(le = new Date()): string {
  const j = `${le.getFullYear()}${String(le.getMonth() + 1).padStart(2, '0')}${String(
    le.getDate(),
  ).padStart(2, '0')}`;
  const suffixe = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `SIM-${j}-${suffixe}`;
}

const jour = (d: Date) =>
  d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Une case numérotée : cadre fin, numéro en pastille, libellé, valeur en gras. */
function dessinerCase(
  doc: jsPDF,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  numero: number,
  libelle: string,
  valeur: string,
  options: { fort?: boolean } = {},
) {
  doc.setDrawColor(...GRIS);
  doc.setLineWidth(0.25);
  doc.rect(x, y, largeur, hauteur);

  // Pastille du numéro, dans l'angle : c'est ce qui fait lire le document
  // comme un formulaire et non comme un tableau de calcul.
  doc.setFillColor(...(options.fort ? ORANGE : GRIS_CLAIR));
  doc.rect(x, y, 5.5, 4.6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(...ENCRE);
  doc.text(String(numero), x + 2.75, y + 3.3, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.6);
  doc.setTextColor(...GRIS);
  doc.text(libelle.toUpperCase(), x + 6.8, y + 3.3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(options.fort ? 10 : 8);
  doc.setTextColor(...(options.fort ? ORANGE_SOMBRE : ENCRE));
  const texte = doc.splitTextToSize(valeur || '—', largeur - 4) as string[];
  doc.text(texte.slice(0, 2), x + 2, y + 8.4);
}

/** Bandeau de statut, répété en haut de chaque page. Il n'est pas décoratif :
 *  c'est lui qui empêche le document de passer pour une déclaration. */
function dessinerMention(doc: jsPDF, y: number) {
  doc.setFillColor(255, 244, 224);
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.5);
  doc.rect(MARGE, y, LARGEUR_UTILE, 7, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...ORANGE_SOMBRE);
  doc.text(
    "DOCUMENT D'AIDE AU CALCUL — NE REMPLACE PAS LA DÉCLARATION OFFICIELLE SYDAM",
    LARGEUR_PAGE / 2,
    y + 4.7,
    { align: 'center' },
  );
}

function dessinerEnTete(doc: jsPDF, reference: string, date: Date) {
  dessinerLogo(doc, MARGE, MARGE, 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...ENCRE);
  doc.text('MayLary Group', MARGE + 17, MARGE + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...GRIS);
  doc.text('LE DÉCLARANT  ·  SIMULATION DE LIQUIDATION', MARGE + 17, MARGE + 10.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...ENCRE);
  doc.text('BULLETIN DE LIQUIDATION', LARGEUR_PAGE / 2, MARGE + 6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...GRIS);
  doc.text('DROITS ET TAXES À L\'IMPORTATION — CÔTE D\'IVOIRE', LARGEUR_PAGE / 2, MARGE + 10.5, {
    align: 'center',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...ENCRE);
  doc.text(reference, BORD_DROIT, MARGE + 5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GRIS);
  doc.text(`Établi le ${jour(date)}`, BORD_DROIT, MARGE + 9.5, { align: 'right' });
}

/** Colonnes du tableau des lignes. Les largeurs somment à la largeur utile. */
const COLONNES: { cle: string; titre: string; largeur: number; droite?: boolean }[] = [
  { cle: 'numero', titre: 'N°', largeur: 11 },
  { cle: 'position', titre: 'CODE HS', largeur: 25 },
  { cle: 'designation', titre: 'DÉSIGNATION', largeur: 52 },
  { cle: 'poids', titre: 'P. BRUT', largeur: 14, droite: true },
  { cle: 'fob', titre: 'FOB', largeur: 24, droite: true },
  { cle: 'caf', titre: 'CAF', largeur: 26, droite: true },
  { cle: 'tauxdd', titre: 'DD %', largeur: 11, droite: true },
  { cle: 'DD', titre: 'DD', largeur: 22, droite: true },
  { cle: 'RST', titre: 'RST', largeur: 17, droite: true },
  { cle: 'PCS', titre: 'PCS', largeur: 17, droite: true },
  { cle: 'PUA', titre: 'PUA', largeur: 16, droite: true },
  { cle: 'PCC', titre: 'PCC', largeur: 16, droite: true },
  { cle: 'TVA', titre: 'TVA', largeur: 22, droite: true },
];

/** Abscisse de départ de chaque colonne, calculée une fois. */
const DEPARTS = COLONNES.reduce<number[]>((acc, c, i) => {
  acc.push(i === 0 ? MARGE : acc[i - 1] + COLONNES[i - 1].largeur);
  return acc;
}, []);

function dessinerEnTeteTableau(doc: jsPDF, y: number): number {
  doc.setFillColor(...ENCRE);
  doc.rect(MARGE, y, LARGEUR_UTILE, 6.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(255, 255, 255);
  COLONNES.forEach((c, i) => {
    const x = c.droite ? DEPARTS[i] + c.largeur - 2 : DEPARTS[i] + 2;
    doc.text(c.titre, x, y + 4.3, { align: c.droite ? 'right' : 'left' });
  });

  return y + 6.5;
}

/**
 * Compose le bulletin au format PDF A4 paysage. Rendu vectoriel : le document
 * reste net à l'impression et son texte est sélectionnable.
 *
 * Séparé du téléchargement pour rester exécutable hors navigateur.
 */
export function construireBulletinPdf(
  liquidation: Liquidation,
  entete: EnTeteBulletin,
  date = new Date(),
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const reference = entete.reference || referenceSimulation(date);
  const verifiees = liquidation.lignes.filter((l) => l.verifie_en_base).length;

  dessinerEnTete(doc, reference, date);
  dessinerMention(doc, MARGE + 14);

  // --- Cases d'identification -------------------------------------------
  let y = MARGE + 24;
  const H = 12;

  const rangee = (
    cases: [number, string, string, number, boolean?][],
  ) => {
    let x = MARGE;
    for (const [numero, libelle, valeur, largeur, fort] of cases) {
      dessinerCase(doc, x, y, largeur, H, numero, libelle, valeur, { fort });
      x += largeur;
    }
    y += H;
  };

  rangee([
    [1, 'Référence', reference, 48],
    [2, 'Régime douanier', `${liquidation.regime.code} — ${liquidation.regime.libelle}`, 82],
    [3, 'Bureau de douane', entete.bureau, 50],
    [4, 'Date', jour(date), 33],
    [5, 'Devise', 'FCFA (XOF)', 60],
  ]);

  rangee([
    [6, 'Importateur / Déclarant', entete.importateur, 80],
    [7, 'Code importateur', entete.code_importateur, 43],
    [8, 'RCCM / NCC', entete.rccm_ncc, 45],
    [9, 'Fournisseur', entete.fournisseur, 60],
    [10, "Pays d'origine", entete.pays_origine, 45],
  ]);

  rangee([
    [11, 'Mode de transport', entete.mode_transport, 45],
    [12, 'N° connaissement / LTA', entete.connaissement, 55],
    [13, 'N° facture', entete.facture, 45],
    [14, 'FOB total', chiffre(liquidation.globaux.fob_total_fcfa), 43],
    [15, 'Fret total', chiffre(liquidation.globaux.fret_total_fcfa), 43],
    [16, 'Assurance totale', chiffre(liquidation.globaux.assurance_total_fcfa), 42],
  ]);

  rangee([
    [17, 'Poids brut total (kg)', chiffre(liquidation.globaux.poids_brut_total_kg ?? 0), 55],
    [18, 'Valeur en douane (CAF)', chiffre(liquidation.globaux.caf_total_fcfa), 78, true],
    [19, 'Nombre de lignes', String(liquidation.lignes.length), 45],
    [20, 'Codes vérifiés au TEC', `${verifiees} / ${liquidation.lignes.length}`, 95],
  ]);

  // --- Tableau des lignes ------------------------------------------------
  y += 4;
  y = dessinerEnTeteTableau(doc, y);

  const HAUTEUR_LIGNE = 9;
  const montantTaxe = (l: LigneLiquidee, code: string) =>
    l.taxes.find((t) => t.code === code)?.montant_fcfa ?? 0;

  /** Coupe à la largeur de la colonne. `splitTextToSize` coupe déjà sur un
   *  blanc : il suffit de garder le premier morceau et de marquer la coupe. */
  const designationTenue = (texte: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const morceaux = doc.splitTextToSize(texte, COLONNES[2].largeur - 4) as string[];
    if (morceaux.length <= 1) return morceaux[0] ?? texte;
    return `${morceaux[0]}…`;
  };

  liquidation.lignes.forEach((l, index) => {
    if (y + HAUTEUR_LIGNE > HAUTEUR_PAGE - 20) {
      doc.addPage();
      dessinerEnTete(doc, reference, date);
      dessinerMention(doc, MARGE + 14);
      y = dessinerEnTeteTableau(doc, MARGE + 24);
    }

    if (index % 2 === 1) {
      doc.setFillColor(250, 249, 247);
      doc.rect(MARGE, y, LARGEUR_UTILE, HAUTEUR_LIGNE, 'F');
    }

    const valeurs: Record<string, string> = {
      numero: l.numero ?? String(index + 1),
      position: l.position ?? '—',
      designation: designationTenue(l.designation || l.designation_tec || '—'),
      poids: chiffre(l.poids_brut_kg),
      fob: chiffre(l.fob_fcfa),
      caf: chiffre(l.caf_fcfa),
      tauxdd: `${(l.taux_dd * 100).toFixed(l.taux_dd * 100 % 1 === 0 ? 0 : 1)}`,
      DD: chiffre(montantTaxe(l, 'DD')),
      RST: chiffre(montantTaxe(l, 'RST')),
      PCS: chiffre(montantTaxe(l, 'PCS')),
      PUA: chiffre(montantTaxe(l, 'PUA')),
      PCC: chiffre(montantTaxe(l, 'PCC')),
      TVA: chiffre(montantTaxe(l, 'TVA')),
    };

    doc.setFontSize(7);
    doc.setTextColor(...ENCRE);
    COLONNES.forEach((c, i) => {
      // Les chiffres en gras : c'est ce qu'on lit sur un document imprimé.
      doc.setFont('helvetica', c.droite || c.cle === 'position' ? 'bold' : 'normal');
      const x = c.droite ? DEPARTS[i] + c.largeur - 2 : DEPARTS[i] + 2;
      doc.text(valeurs[c.cle], x, y + 4.6, { align: c.droite ? 'right' : 'left' });
    });

    // Sous-ligne : la répartition appliquée, et l'origine du taux. Un
    // déclarant qui conteste un chiffre veut savoir d'où vient le prorata.
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...GRIS);
    doc.text(
      `Fret ${chiffre(l.fret_fcfa)} · Assur. ${chiffre(l.assurance_fcfa)} · ` +
        `${(l.part_fret * 100).toFixed(1)} % du poids · ${(l.part_valeur * 100).toFixed(1)} % de la valeur · ` +
        `base TVA ${chiffre(l.base_tva_fcfa)}`,
      DEPARTS[2] + 2,
      y + 7.7,
    );
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(l.verifie_en_base ? ORANGE_SOMBRE : [190, 40, 40] as [number, number, number]));
    doc.text(
      l.verifie_en_base ? 'Taux vérifié au TEC' : 'Taux saisi — non vérifié',
      DEPARTS[0] + 2,
      y + 7.7,
    );

    y += HAUTEUR_LIGNE;
    doc.setDrawColor(225, 221, 216);
    doc.setLineWidth(0.2);
    doc.line(MARGE, y, BORD_DROIT, y);
  });

  // --- Récapitulatif et total -------------------------------------------
  // Hauteur du bloc de clôture : récapitulatif, total, mentions, signatures.
  // Elle décide si tout tient sous le tableau ou part en page suivante ; la
  // sous-estimer ferait chevaucher la zone de signature et le pied de page.
  const HAUTEUR_BLOC = 63;
  if (y + HAUTEUR_BLOC > HAUTEUR_PAGE - 12) {
    doc.addPage();
    dessinerEnTete(doc, reference, date);
    dessinerMention(doc, MARGE + 14);
    y = MARGE + 26;
  } else {
    y += 5;
  }

  const codes = Object.keys(liquidation.totaux_taxes);
  const largeurRecap = LARGEUR_UTILE * 0.55;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...GRIS);
  doc.text('RÉCAPITULATIF DES DROITS ET TAXES', MARGE, y);

  // Trois colonnes : les huit taxes tiennent alors en trois rangs, et la zone
  // de signature remonte d'autant.
  const COLONNES_RECAP = 3;
  let yRecap = y + 4;
  const colonneLargeur = largeurRecap / COLONNES_RECAP;
  codes.forEach((code, i) => {
    const x = MARGE + (i % COLONNES_RECAP) * colonneLargeur;
    const ligneY = yRecap + Math.floor(i / COLONNES_RECAP) * 5.4;
    doc.setDrawColor(...GRIS_CLAIR);
    doc.setLineWidth(0.2);
    doc.line(x, ligneY + 1.6, x + colonneLargeur - 6, ligneY + 1.6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text(code, x, ligneY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...ENCRE);
    doc.text(chiffre(liquidation.totaux_taxes[code]), x + colonneLargeur - 6, ligneY, {
      align: 'right',
    });
  });
  yRecap += Math.ceil(codes.length / COLONNES_RECAP) * 5.4 + 2;

  // Le total à payer : élément le plus important de l'écran comme du papier.
  const xTotal = MARGE + largeurRecap + 4;
  const largeurTotal = BORD_DROIT - xTotal;
  doc.setFillColor(...ORANGE);
  doc.rect(xTotal, y - 3, largeurTotal, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...ENCRE);
  doc.text('TOTAL À PAYER', xTotal + 4, y + 4.5);
  doc.setFontSize(15);
  doc.text(`${chiffre(liquidation.total_a_payer_fcfa)} FCFA`, xTotal + largeurTotal - 4, y + 5.5, {
    align: 'right',
  });

  // Le bas de la colonne de droite se suit au fur et à mesure : sans mention
  // de régime, la signature remonte au lieu de laisser un vide.
  let basTotal = y + 15;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...ENCRE);
  const enLettres = doc.splitTextToSize(
    `Soit ${nombreEnLettres(liquidation.total_a_payer_fcfa)} francs CFA.`,
    largeurTotal,
  ) as string[];
  doc.text(enLettres, xTotal, basTotal + 3);
  basTotal += 3 + enLettres.length * 3.4;

  const mentionsRegime: [string, [number, number, number]][] = [];
  if (liquidation.regime.caution_requise) {
    mentionsRegime.push([
      "Régime sous caution : aucun droit n'est acquitté à ce stade, une caution ou un acquit-à-caution est exigé.",
      ORANGE_SOMBRE,
    ]);
  }
  if (liquidation.regime.depend_autorisation) {
    mentionsRegime.push([
      "Montants indicatifs : l'exonération réelle dépend de l'autorisation détenue.",
      [190, 40, 40],
    ]);
  }
  for (const [texte, couleur] of mentionsRegime) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...couleur);
    const lignesMention = doc.splitTextToSize(texte, largeurTotal) as string[];
    doc.text(lignesMention, xTotal, basTotal + 3.5);
    basTotal += 3.5 + lignesMention.length * 3.4;
  }

  // --- Zone de signature -------------------------------------------------
  const ySignature = Math.max(yRecap, basTotal) + 4;
  const largeurSignature = LARGEUR_UTILE / 3 - 3;
  ['Le Déclarant', 'Le Receveur des Douanes', 'Cachet'].forEach((libelle, i) => {
    const x = MARGE + i * (largeurSignature + 4.5);
    doc.setDrawColor(...GRIS);
    doc.setLineWidth(0.25);
    doc.rect(x, ySignature, largeurSignature, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...GRIS);
    doc.text(libelle.toUpperCase(), x + 2, ySignature + 4);
  });

  // --- Pied de page ------------------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...GRIS_CLAIR);
    doc.setLineWidth(0.4);
    doc.line(MARGE, HAUTEUR_PAGE - 10, BORD_DROIT, HAUTEUR_PAGE - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...GRIS);
    doc.text(
      `${liquidation.tarif.libelle} — version du ${new Date(
        liquidation.tarif.date_version,
      ).toLocaleDateString('fr-FR')}. Établi par MayLary Group (Dems'Inc), Abidjan. ` +
        `La déclaration officielle doit être saisie dans le système douanier.`,
      MARGE,
      HAUTEUR_PAGE - 6,
    );
    doc.text(`Page ${page} / ${pages}`, BORD_DROIT, HAUTEUR_PAGE - 6, { align: 'right' });
  }

  return doc;
}

export function nomFichierBulletin(reference: string): string {
  return `Bulletin_liquidation_${reference}_Maylary.pdf`;
}

/** Compose puis télécharge le bulletin depuis le navigateur. */
export function telechargerBulletinPdf(
  liquidation: Liquidation,
  entete: EnTeteBulletin,
  date = new Date(),
) {
  const reference = entete.reference || referenceSimulation(date);
  construireBulletinPdf(liquidation, { ...entete, reference }, date).save(
    nomFichierBulletin(reference),
  );
}
