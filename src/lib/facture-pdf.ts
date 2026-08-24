import { jsPDF } from 'jspdf';
import type { Facture, LigneFacture } from '@/lib/supabase';
import { LOGO_MAYLARY_JPEG } from '@/lib/logo-document';

/**
 * Couleurs de marque, alignées sur les variables CSS du site. Exportées : le
 * bulletin de liquidation du Déclarant s'imprime avec la même identité, et deux
 * palettes recopiées finiraient par diverger.
 */
export const ORANGE: [number, number, number] = [242, 166, 24];
export const ORANGE_SOMBRE: [number, number, number] = [177, 63, 0];
export const ENCRE: [number, number, number] = [28, 26, 23];
export const GRIS: [number, number, number] = [120, 113, 108];
export const GRIS_CLAIR: [number, number, number] = [245, 243, 240];

const MARGE = 15;
const LARGEUR_PAGE = 210;
const HAUTEUR_PAGE = 297;
const BORD_DROIT = LARGEUR_PAGE - MARGE;

const UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept',
  'dix-huit', 'dix-neuf',
];
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

function moinsDeCent(n: number): string {
  if (n < 20) return UNITES[n];
  const dizaine = Math.floor(n / 10);
  const unite = n % 10;
  if (dizaine === 7 || dizaine === 9) {
    if (dizaine === 7 && unite === 1) return 'soixante et onze';
    return `${dizaine === 7 ? 'soixante' : 'quatre-vingt'}-${UNITES[10 + unite]}`;
  }
  if (unite === 0) return dizaine === 8 ? 'quatre-vingts' : DIZAINES[dizaine];
  if (unite === 1 && dizaine !== 8) return `${DIZAINES[dizaine]} et un`;
  return `${DIZAINES[dizaine]}-${UNITES[unite]}`;
}

function moinsDeMille(n: number): string {
  const centaine = Math.floor(n / 100);
  const reste = n % 100;
  if (centaine === 0) return moinsDeCent(reste);
  if (reste === 0) return centaine === 1 ? 'cent' : `${UNITES[centaine]} cents`;
  return `${centaine === 1 ? 'cent' : `${UNITES[centaine]} cent`} ${moinsDeCent(reste)}`;
}

/**
 * Montant en toutes lettres — mention usuelle sur les factures en zone OHADA
 * (« Arrêtée la présente facture à la somme de… »).
 */
export function nombreEnLettres(valeur: number): string {
  const n = Math.round(Math.abs(valeur));
  if (n === 0) return 'zéro';

  const milliards = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milliers = Math.floor((n % 1_000_000) / 1000);
  const reste = n % 1000;

  const morceaux: string[] = [];
  if (milliards) morceaux.push(`${moinsDeMille(milliards)} milliard${milliards > 1 ? 's' : ''}`);
  if (millions) morceaux.push(`${moinsDeMille(millions)} million${millions > 1 ? 's' : ''}`);
  if (milliers) morceaux.push(milliers === 1 ? 'mille' : `${moinsDeMille(milliers)} mille`);
  if (reste) morceaux.push(moinsDeMille(reste));

  return morceaux.join(' ');
}

/**
 * Sépare les milliers par une espace ASCII. `toLocaleString('fr-FR')` utilise
 * une espace fine insécable (U+202F) absente de l'encodage WinAnsi des polices
 * PDF standard, qui la rendrait par un « / » sur la facture imprimée.
 */
export const montant = (v: number) =>
  `${Math.round(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;

/** Le même séparateur de milliers, sans l'unité — pour les colonnes chiffrées. */
export const chiffre = (v: number) =>
  Math.round(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

/**
 * La marque de la maison, en haut de chaque document.
 *
 * Il y avait ici un carré orange surmonté de trois colis blancs, dessiné en
 * vectoriel faute d'avoir le vrai logo. C'était un provisoire, et il est
 * remplacé par le logo réel — la pile de conteneurs qui compose un M, avec la
 * femme et la fillette dans son creux.
 *
 * L'image est encastrée dans le code plutôt que chargée par son adresse : un
 * PDF se fabrique dans le navigateur du client, parfois hors ligne, et
 * s'envoie ensuite par courriel. Un document qui irait chercher son logo sur
 * le réseau s'imprimerait sans marque chez qui le rouvre six mois plus tard.
 *
 * Le cadre blanc arrondi qui l'entoure n'est pas décoratif : le dessin est
 * bleu nuit, et une facture s'imprime parfois sur un fond teinté ou se lit
 * dans une visionneuse en thème sombre.
 */
export function dessinerLogo(doc: jsPDF, x: number, y: number, taille: number) {
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, taille, taille, taille * 0.16, taille * 0.16, 'F');
  doc.addImage(LOGO_MAYLARY_JPEG, 'JPEG', x, y, taille, taille);
}

/** Papier à en-tête : identité de l'émetteur, répété en haut de chaque page. */
function dessinerEnTete(doc: jsPDF, facture: Facture) {
  const e = facture.emetteur ?? {};

  dessinerLogo(doc, MARGE, 13, 15);

  doc.setTextColor(...ENCRE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(e.nom_commercial || 'MayLary Group', MARGE + 19, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS);
  doc.text('IMPORT  ·  EXPORT  ·  SOURCING  ·  TRANSIT', MARGE + 19, 26);

  const colonne: string[] = [];
  if (e.raison_sociale) colonne.push(e.raison_sociale);
  if (e.adresse) colonne.push(e.adresse);
  colonne.push([e.ville, e.pays].filter(Boolean).join(', '));
  if (e.telephone) colonne.push(`Tél. ${e.telephone}`);
  if (e.email) colonne.push(e.email);
  if (e.rccm) colonne.push(`RCCM : ${e.rccm}`);
  if (e.ncc) colonne.push(`NCC : ${e.ncc}`);

  doc.setFontSize(8);
  let y = 15;
  colonne.filter(Boolean).forEach((ligne, index) => {
    doc.setFont('helvetica', index === 0 ? 'bold' : 'normal');
    doc.setTextColor(...(index === 0 ? ENCRE : GRIS));
    doc.text(ligne, BORD_DROIT, y, { align: 'right' });
    y += 3.8;
  });

  doc.setFillColor(...ORANGE);
  doc.rect(MARGE, 34, BORD_DROIT - MARGE, 1.1, 'F');
}

/** Pied de page : mentions légales + pagination, sur chaque page. */
function dessinerPiedDePage(doc: jsPDF, facture: Facture, page: number, total: number) {
  const e = facture.emetteur ?? {};

  doc.setDrawColor(...GRIS_CLAIR);
  doc.setLineWidth(0.4);
  doc.line(MARGE, HAUTEUR_PAGE - 18, BORD_DROIT, HAUTEUR_PAGE - 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GRIS);

  const mentions =
    e.mentions_bas_page || `${e.nom_commercial || 'MayLary Group'} — ${[e.ville, e.pays].filter(Boolean).join(', ')}`;
  doc.text(doc.splitTextToSize(mentions, 130), MARGE, HAUTEUR_PAGE - 13);
  doc.text(`Page ${page} / ${total}`, BORD_DROIT, HAUTEUR_PAGE - 13, { align: 'right' });
}

/** Bandeau de colonnes du tableau des lignes. */
function dessinerEnTeteTableau(doc: jsPDF, y: number): number {
  doc.setFillColor(...ENCRE);
  doc.rect(MARGE, y, BORD_DROIT - MARGE, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('DÉSIGNATION', MARGE + 3, y + 5.4);
  doc.text('QTÉ', 128, y + 5.4, { align: 'right' });
  doc.text('PRIX UNITAIRE', 162, y + 5.4, { align: 'right' });
  doc.text('MONTANT', BORD_DROIT - 3, y + 5.4, { align: 'right' });

  return y + 8;
}

/**
 * Compose la facture (ou proforma) au format PDF A4. Rendu entièrement
 * vectoriel : texte sélectionnable, impression nette à n'importe quelle taille.
 *
 * Séparé du téléchargement pour rester exécutable hors navigateur (tests).
 */
export function construireFacturePdf(facture: Facture): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const estProforma = facture.type_document === 'proforma';
  const lignes: LigneFacture[] = Array.isArray(facture.lignes) ? facture.lignes : [];

  dessinerEnTete(doc, facture);

  // --- Titre du document ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...ORANGE_SOMBRE);
  doc.text(estProforma ? 'FACTURE PROFORMA' : 'FACTURE', MARGE, 48);

  if (estProforma) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text("Ce document ne constitue pas une facture définitive.", MARGE, 53);
  }

  // --- Encadré numéro / dates ---
  const boiteX = 120;
  const boiteLargeur = BORD_DROIT - boiteX;
  doc.setFillColor(...GRIS_CLAIR);
  doc.roundedRect(boiteX, 41, boiteLargeur, 24, 1.5, 1.5, 'F');

  const infos: [string, string][] = [
    ['N°', facture.numero],
    ["Date d'émission", jour(facture.date_emission)],
    [estProforma ? "Valable jusqu'au" : 'Échéance', facture.date_echeance ? jour(facture.date_echeance) : '—'],
  ];
  let yInfo = 46.5;
  for (const [libelle, valeur] of infos) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text(libelle, boiteX + 4, yInfo);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...ENCRE);
    doc.text(valeur, BORD_DROIT - 4, yInfo, { align: 'right' });
    yInfo += 7;
  }

  // --- Client / dossier ---
  const yBloc = 74;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS);
  doc.text('FACTURÉ À', MARGE, yBloc);
  doc.text('DOSSIER', boiteX, yBloc);

  const client: string[] = [];
  if (facture.client_entreprise) client.push(facture.client_entreprise);
  if (facture.client_nom) client.push(facture.client_nom);
  if (facture.client_adresse) client.push(facture.client_adresse);
  if (facture.client_ville) client.push(facture.client_ville);
  if (facture.client_telephone) client.push(`Tél. ${facture.client_telephone}`);
  if (facture.client_email) client.push(facture.client_email);
  if (client.length === 0) client.push('Client MayLary Group');

  let yClient = yBloc + 6;
  client.forEach((ligne, index) => {
    doc.setFont('helvetica', index === 0 ? 'bold' : 'normal');
    doc.setFontSize(index === 0 ? 10 : 8.5);
    doc.setTextColor(...(index === 0 ? ENCRE : GRIS));
    doc.text(doc.splitTextToSize(ligne, 95), MARGE, yClient);
    yClient += index === 0 ? 5.5 : 4.4;
  });

  const LIBELLES_SOURCE: Record<string, string> = {
    commande_gp: 'Commande boutique',
    devis_pro: 'Devis professionnel',
    demande_import: "Dossier d'import",
    demande_export: "Dossier d'export",
  };
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...ENCRE);
  doc.text(LIBELLES_SOURCE[facture.source_type] ?? 'Dossier', boiteX, yBloc + 6);
  if (facture.reference_source) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRIS);
    doc.text(`Référence : ${facture.reference_source}`, boiteX, yBloc + 11.5);
  }

  // --- Tableau des lignes ---
  let y = Math.max(yClient, yBloc + 20) + 6;
  y = dessinerEnTeteTableau(doc, y);

  doc.setFontSize(8.5);
  lignes.forEach((ligne, index) => {
    const designation = doc.splitTextToSize(ligne.designation, 105) as string[];
    const hauteur = Math.max(8, designation.length * 4 + 4);

    // Saut de page : on referme la page courante et on repart sous un en-tête.
    if (y + hauteur > HAUTEUR_PAGE - 60) {
      doc.addPage();
      dessinerEnTete(doc, facture);
      y = dessinerEnTeteTableau(doc, 44);
      doc.setFontSize(8.5);
    }

    if (index % 2 === 1) {
      doc.setFillColor(250, 249, 247);
      doc.rect(MARGE, y, BORD_DROIT - MARGE, hauteur, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...ENCRE);
    doc.text(designation, MARGE + 3, y + 5.2);
    doc.text(String(ligne.quantite), 128, y + 5.2, { align: 'right' });
    doc.setTextColor(...GRIS);
    doc.text(montant(ligne.prix_unitaire), 162, y + 5.2, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ENCRE);
    doc.text(montant(ligne.montant), BORD_DROIT - 3, y + 5.2, { align: 'right' });

    y += hauteur;
    doc.setDrawColor(235, 232, 228);
    doc.setLineWidth(0.2);
    doc.line(MARGE, y, BORD_DROIT, y);
  });

  // --- Totaux ---
  if (y > HAUTEUR_PAGE - 85) {
    doc.addPage();
    dessinerEnTete(doc, facture);
    y = 44;
  }

  y += 6;
  const totauxX = 120;
  const avecTva = Number(facture.taux_tva) > 0;

  // Sans TVA, une ligne « Total HT » identique au total final n'apporte rien :
  // on ne montre que le montant à payer, avec la mention d'exonération.
  const totaux: [string, string][] = avecTva
    ? [
        ['Total HT', montant(facture.montant_ht)],
        [`TVA (${Math.round(Number(facture.taux_tva) * 100)} %)`, montant(facture.montant_tva)],
      ]
    : [];

  doc.setFontSize(9);
  for (const [libelle, valeur] of totaux) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRIS);
    doc.text(libelle, totauxX + 4, y + 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ENCRE);
    doc.text(valeur, BORD_DROIT - 4, y + 4, { align: 'right' });
    y += 6.5;
  }

  doc.setFillColor(...ORANGE);
  doc.roundedRect(totauxX, y, BORD_DROIT - totauxX, 11, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...ENCRE);
  doc.text(avecTva ? 'TOTAL TTC' : 'TOTAL À PAYER', totauxX + 4, y + 7.2);
  doc.setFontSize(11);
  doc.text(montant(facture.montant_ttc), BORD_DROIT - 4, y + 7.2, { align: 'right' });
  y += 15;

  if (!avecTva) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text('TVA non applicable.', BORD_DROIT, y, { align: 'right' });
    y += 5;
  }

  // --- Montant en toutes lettres ---
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...ENCRE);
  const enLettres = `Arrêtée ${estProforma ? 'la présente proforma' : 'la présente facture'} à la somme de : ${nombreEnLettres(
    facture.montant_ttc,
  )} francs CFA.`;
  const enLettresLignes = doc.splitTextToSize(enLettres, BORD_DROIT - MARGE) as string[];
  doc.text(enLettresLignes, MARGE, y);
  y += enLettresLignes.length * 4.5 + 5;

  // --- Conditions de règlement ---
  const e = facture.emetteur ?? {};
  const conditions = [facture.conditions_paiement, e.coordonnees_paiement].filter(Boolean) as string[];
  if (conditions.length > 0) {
    doc.setFillColor(...GRIS_CLAIR);
    const hauteurBloc = conditions.length * 4.6 + 9;
    doc.roundedRect(MARGE, y, BORD_DROIT - MARGE, hauteurBloc, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text('CONDITIONS DE RÈGLEMENT', MARGE + 4, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...ENCRE);
    let yCondition = y + 10.5;
    for (const condition of conditions) {
      doc.text(doc.splitTextToSize(condition, BORD_DROIT - MARGE - 8), MARGE + 4, yCondition);
      yCondition += 4.6;
    }
  }

  // --- Pagination (une fois le nombre de pages connu) ---
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    dessinerPiedDePage(doc, facture, page, total);
  }

  return doc;
}

/** Nom de fichier proposé au client lors du téléchargement. */
export function nomFichierFacture(facture: Facture): string {
  return `${facture.type_document === 'proforma' ? 'Proforma' : 'Facture'}_${facture.numero}_Maylary.pdf`;
}

/** Compose puis télécharge le document depuis le navigateur. */
export function telechargerFacturePdf(facture: Facture) {
  construireFacturePdf(facture).save(nomFichierFacture(facture));
}
