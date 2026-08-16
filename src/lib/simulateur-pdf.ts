import { jsPDF } from 'jspdf';
import { ENCRE, GRIS, GRIS_CLAIR } from '@/lib/facture-pdf';
import type { Liquidation } from '@/lib/supabase';
import type {
  EnTeteSimulateur,
  ValeursGlobales,
  LigneSimulateur,
} from '@/lib/simulateur-declaration';

/**
 * Le document de simulation, mis en page comme une déclaration.
 *
 * Cahier du fondateur, transitaire de métier, sur la lisibilité — et ce sont
 * ses mots : « tous les chiffres en GRAS », « chaque case dans un CADRE
 * distinct », « le TOTAL À PAYER doit être la valeur la plus visible du
 * document entier ». Ce fichier applique ces trois règles à la lettre.
 *
 * SUR L'EN-TÊTE, ET UNE RÉSERVE QUE J'AVAIS ÉMISE
 *
 * J'avais évité, sur le brouillon de déclaration, toute mention de la
 * République et de la Direction Générale des Douanes : un document privé sous
 * ces marques se fait prendre pour un acte officiel.
 *
 * Le fondateur demande explicitement ces deux lignes, et il a lui-même posé
 * les deux garde-fous qui répondent à ma réserve : PAS de mention « SYDAM
 * WORLD+ », un sous-titre générique « Document de simulation de calcul
 * douanier », et la mention légale en pied de page. C'est sa décision, elle
 * est raisonnée, et elle est appliquée telle quelle.
 *
 * Ce que le document ne porte toujours pas, et ne portera pas : ni armoiries,
 * ni timbre, ni numéro de déclaration officiel. Le texte situe le cadre
 * réglementaire ; il n'imite aucun sceau.
 *
 * LA PAGINATION
 *
 * « Pas de ligne coupée en deux entre deux pages » : chaque bloc mesure sa
 * hauteur avant d'être dessiné et saute à la page suivante s'il n'entre pas.
 */

const MARGE = 12;
const LARGEUR = 210;
const HAUTEUR = 297;
const UTILE = LARGEUR - 2 * MARGE;

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')}`;

/** Une case encadrée : intitulé en petit, valeur en GRAS dessous. */
function caseEncadree(
  doc: jsPDF,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  intitule: string,
  valeur: string,
) {
  doc.setDrawColor(120, 113, 108);
  doc.setLineWidth(0.25);
  doc.rect(x, y, largeur, hauteur);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...GRIS);
  doc.text(doc.splitTextToSize(intitule, largeur - 3)[0] ?? '', x + 1.5, y + 3.4);

  // Toutes les valeurs en gras : exigence explicite du fondateur, et c'est ce
  // qui rend le document lisible d'un coup d'œil sur un bureau encombré.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(...ENCRE);
  const lignes = doc.splitTextToSize(valeur || '—', largeur - 3) as string[];
  const max = Math.max(1, Math.floor((hauteur - 4.5) / 3.4));
  lignes.slice(0, max).forEach((l, i) => doc.text(l, x + 1.5, y + 7.6 + i * 3.4));
}

function enTeteDocument(doc: jsPDF, page: number, reference: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...ENCRE);
  doc.text("RÉPUBLIQUE DE CÔTE D'IVOIRE", LARGEUR / 2, 14, { align: 'center' });
  doc.setFontSize(9.5);
  doc.text('DIRECTION GÉNÉRALE DES DOUANES', LARGEUR / 2, 19, { align: 'center' });

  // Le sous-titre générique demandé par le fondateur : il dit ce que le
  // document EST, et écarte toute confusion avec une déclaration déposée.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.text('Document de simulation de calcul douanier', LARGEUR / 2, 24.5, { align: 'center' });

  doc.setDrawColor(...ENCRE);
  doc.setLineWidth(0.5);
  doc.line(MARGE, 27.5, LARGEUR - MARGE, 27.5);

  doc.setFontSize(6.5);
  doc.setTextColor(...GRIS);
  doc.text(`Réf. ${reference || '—'}`, MARGE, 31.5);
  doc.text(`Page ${page}`, LARGEUR - MARGE, 31.5, { align: 'right' });

  return 35;
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
  entete: EnTeteSimulateur;
  valeurs: ValeursGlobales;
  lignes: LigneSimulateur[];
  liquidation: Liquidation;
  /** code → libellé, pour n'imprimer jamais un code nu. */
  libelles: Record<string, string>;
}

export function telechargerSimulationPdf(d: DonneesDocument) {
  const { entete, valeurs, lignes, liquidation, libelles } = d;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let page = 1;
  let y = enTeteDocument(doc, page, entete.reference);

  const place = (hauteur: number) => {
    if (y + hauteur <= HAUTEUR - 18) return;
    piedDePage(doc);
    doc.addPage();
    page += 1;
    y = enTeteDocument(doc, page, entete.reference);
  };

  const titre = (texte: string) => {
    place(10);
    doc.setFillColor(...GRIS_CLAIR);
    doc.rect(MARGE, y, UTILE, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...ENCRE);
    doc.text(texte.toUpperCase(), MARGE + 2, y + 3.9);
    y += 7.5;
  };

  /** Une rangée de cases de largeurs égales. */
  const rangee = (cases: [string, string][], hauteur = 12) => {
    place(hauteur + 2);
    const largeur = (UTILE - (cases.length - 1) * 2) / cases.length;
    cases.forEach(([intitule, valeur], i) => {
      caseEncadree(doc, MARGE + i * (largeur + 2), y, largeur, hauteur, intitule, valeur);
    });
    y += hauteur + 2;
  };

  const nomme = (v: string) => (v ? (libelles[v] ? `${v} — ${libelles[v]}` : v) : '');

  // ---------- Identification ----------
  titre('Identification');
  rangee([
    ['Référence déclaration', entete.reference],
    ['Régime douanier', nomme(entete.regime)],
  ]);
  rangee([
    ['Bureau de douane', nomme(entete.bureau)],
    ['Date', entete.date ? new Date(entete.date).toLocaleDateString('fr-FR') : ''],
  ]);

  // ---------- Parties ----------
  titre('Parties');
  rangee([
    ['Importateur / Déclarant', entete.importateur],
    ['N° RCCM / CC', entete.rccm_cc],
  ]);
  rangee([
    ['Fournisseur / Expéditeur', entete.fournisseur],
    ['Pays d’origine', nomme(entete.pays_origine)],
  ]);

  // ---------- Transport et valeurs ----------
  titre('Transport et valeurs');
  rangee([
    ['Mode de transport', nomme(entete.mode_transport)],
    ['N° Facture', entete.numero_facture],
    ['N° Connaissement (BL/LTA)', entete.numero_connaissement],
  ]);
  rangee([
    ['Devise', nomme(valeurs.devise)],
    ['Taux de change', valeurs.taux_change],
    ['Poids brut total (kg)', valeurs.poids_brut_total],
    ['Poids net total (kg)', valeurs.poids_net_total],
  ]);
  rangee([
    ['FOB total (XOF)', fcfa(liquidation.globaux.fob_total_fcfa)],
    ['Fret total (XOF)', fcfa(liquidation.globaux.fret_total_fcfa)],
    ['Assurance totale (XOF)', fcfa(liquidation.globaux.assurance_total_fcfa)],
    ['VALEUR EN DOUANE — CAF (XOF)', fcfa(liquidation.globaux.caf_total_fcfa)],
  ]);

  // ---------- Articles ----------
  titre('Articles et positions tarifaires');
  for (const l of liquidation.lignes) {
    const saisie = lignes.find((x) => x.numero === l.numero);
    place(38);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...ENCRE);
    doc.text(`ARTICLE ${l.numero ?? ''}`, MARGE, y + 3);
    y += 5;

    rangee(
      [
        ['Désignation', l.designation ?? saisie?.designation ?? ''],
        ['Code HS', l.position ?? ''],
      ],
      13,
    );
    rangee(
      [
        ['Désignation tarifaire officielle', l.designation_tec ?? '—'],
        ['Taux DD', l.verifie_en_base ? `${l.taux_dd} %` : 'non confirmé'],
      ],
      13,
    );
    rangee([
      ['Quantité', saisie ? `${saisie.quantite || '—'} ${saisie.unite}` : '—'],
      ['Poids brut (kg)', String(l.poids_brut_kg ?? '')],
      ['Poids net (kg)', saisie?.poids_net ?? '—'],
      ['FOB ligne (XOF)', fcfa(l.fob_fcfa)],
    ]);

    // La traçabilité exigée : ce qui a été proratisé sur CETTE ligne.
    rangee([
      ['Fret proratisé (XOF)', fcfa(l.fret_fcfa)],
      ['Assurance proratisée (XOF)', fcfa(l.assurance_fcfa)],
      ['CAF ligne (XOF)', fcfa(l.caf_fcfa)],
    ]);

    // Les taxes de la ligne, en tableau encadré.
    place(8 + l.taxes.length * 5);
    const hauteurTableau = 5 + l.taxes.length * 4.6;
    doc.setDrawColor(120, 113, 108);
    doc.setLineWidth(0.25);
    doc.rect(MARGE, y, UTILE, hauteurTableau);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...GRIS);
    doc.text('Droits et taxes de la ligne', MARGE + 1.5, y + 3.4);

    let yt = y + 7.5;
    for (const t of l.taxes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.4);
      doc.setTextColor(...ENCRE);
      doc.text(t.code, MARGE + 2, yt);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(...GRIS);
      doc.text(doc.splitTextToSize(t.libelle, 70)[0] ?? '', MARGE + 14, yt);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.4);
      doc.setTextColor(...ENCRE);
      doc.text(`base ${fcfa(t.base_fcfa)}`, MARGE + 95, yt);
      doc.text(fcfa(t.montant_fcfa), LARGEUR - MARGE - 2, yt, { align: 'right' });
      yt += 4.6;
    }
    y += hauteurTableau + 4;
  }

  // ---------- Récapitulatif ----------
  titre('Calcul des droits et taxes — récapitulatif');
  const taxes = Object.entries(liquidation.totaux_taxes);
  place(10 + taxes.length * 5);
  const hauteurRecap = 6 + taxes.length * 5;
  doc.setDrawColor(...ENCRE);
  doc.setLineWidth(0.4);
  doc.rect(MARGE, y, UTILE, hauteurRecap);
  let yr = y + 6;
  for (const [code, montant] of taxes) {
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
    doc.text(`${fcfa(montant)} XOF`, LARGEUR - MARGE - 3, yr, { align: 'right' });
    yr += 5;
  }
  y += hauteurRecap + 4;

  // ---------- Le total, valeur la plus visible du document ----------
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
  doc.text(`${fcfa(liquidation.total_a_payer_fcfa)} XOF`, LARGEUR - MARGE - 4, y + 12.5, {
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
  y += 30;

  piedDePage(doc);
  doc.save(`simulation-${(entete.reference || 'declaration').replace(/[^\w-]/g, '-')}.pdf`);
}
