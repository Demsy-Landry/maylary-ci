import { jsPDF } from 'jspdf';
import { ORANGE, ENCRE, GRIS, GRIS_CLAIR, dessinerLogo } from '@/lib/facture-pdf';
import {
  GROUPES_DECLARATION,
  CASES_ARTICLE,
  type ValeursDeclaration,
  type ArticleDeclaration,
} from '@/lib/declaration-sydam';

/**
 * Le brouillon de déclaration, en PDF.
 *
 * Il reprend la grammaire visuelle d'une déclaration en détail : cases
 * encadrées, numéro en petit dans le coin, valeur en dessous. Ce n'est pas de
 * l'esthétique — c'est ce qui permet de ressaisir dans SYDAM World en suivant
 * les numéros, sans relire les libellés.
 *
 * CE QU'IL NE REPREND PAS, DÉLIBÉRÉMENT
 *
 * Ni les armoiries de la République, ni le timbre de la Direction Générale des
 * Douanes, ni la mise en page exacte du formulaire officiel. Un document émis
 * par une société privée sous ces marques se ferait prendre pour un acte
 * officiel, quelle que soit la mention qu'on y ajoute. L'émetteur affiché est
 * MayLary Group, et le bandeau « brouillon » barre le haut de chaque page.
 *
 * Format portrait : contrairement au bulletin de liquidation, qui aligne huit
 * taxes sur une ligne, la déclaration se lit case par case. Le portrait est ce
 * qui s'imprime et se classe le plus simplement au dossier.
 */

const MARGE = 12;
const LARGEUR = 210;
const HAUTEUR = 297;
const UTILE = LARGEUR - 2 * MARGE;

/** Une case encadrée : numéro en haut à gauche, libellé, puis la valeur. */
function dessinerCase(
  doc: jsPDF,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  numero: string,
  libelle: string,
  valeur: string,
) {
  doc.setDrawColor(190, 185, 180);
  doc.setLineWidth(0.2);
  doc.rect(x, y, largeur, hauteur);

  doc.setFillColor(...GRIS_CLAIR);
  doc.rect(x, y, 6.5, 4.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.setTextColor(...ORANGE);
  doc.text(numero, x + 3.25, y + 3, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.6);
  doc.setTextColor(...GRIS);
  doc.text(doc.splitTextToSize(libelle, largeur - 8)[0] ?? '', x + 7.5, y + 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(...ENCRE);
  const lignes = doc.splitTextToSize(valeur || '—', largeur - 3) as string[];
  const max = Math.max(1, Math.floor((hauteur - 5.5) / 3.2));
  lignes.slice(0, max).forEach((l, i) => doc.text(l, x + 1.5, y + 7.6 + i * 3.2));
}

function enTete(doc: jsPDF, page: number) {
  dessinerLogo(doc, MARGE, 10, 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...ENCRE);
  doc.text('MayLary Group', MARGE + 14, 15.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.4);
  doc.setTextColor(...GRIS);
  doc.text('TRANSIT · IMPORT · EXPORT — Abidjan, Côte d’Ivoire', MARGE + 14, 19);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...ENCRE);
  doc.text('DÉCLARATION EN DÉTAIL', LARGEUR - MARGE, 15.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.4);
  doc.setTextColor(...GRIS);
  doc.text('Modèle SYDAM World — préparation', LARGEUR - MARGE, 19, { align: 'right' });
  doc.text(`Page ${page}`, LARGEUR - MARGE, 22, { align: 'right' });

  // Le bandeau qui empêche la confusion avec un acte officiel. Il barre le
  // haut de CHAQUE page : une page détachée du reste doit le porter aussi.
  doc.setFillColor(255, 244, 224);
  doc.rect(MARGE, 24.5, UTILE, 6, 'F');
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.3);
  doc.line(MARGE, 24.5, MARGE, 30.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(...ENCRE);
  doc.text(
    'BROUILLON — ne vaut pas dépôt. Le dépôt se fait dans SYDAM World sous la signature d’un commissionnaire en douane agréé.',
    MARGE + 2,
    28.4,
  );

  return 34;
}

function piedDePage(doc: jsPDF) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(...GRIS);
  doc.text(
    `Préparé le ${new Date().toLocaleDateString('fr-FR')} avec Le Déclarant — MayLary Group. Document de travail interne.`,
    MARGE,
    HAUTEUR - 8,
  );
}

/**
 * Le libellé d'une valeur codée.
 *
 * Depuis que les cases se choisissent dans une liste, elles portent un CODE :
 * « 1 » pour le maritime, « CN » pour la Chine, « 4000 » pour la mise à la
 * consommation. Le déposant a besoin du code — c'est lui qu'il ressaisit dans
 * SYDAM — mais un document où on lit « Mode de transport : 1 » est illisible
 * pour le client à qui on le remet, et invérifiable par celui qui relit.
 *
 * On imprime donc les deux : « 1 — Transport maritime ». C'est exactement ce
 * que le fondateur demande quand il dit que le détail doit être sur le PDF.
 */
export type Libelles = Record<string, string>;

export function telechargerDeclarationPdf(
  valeurs: ValeursDeclaration,
  articles: ArticleDeclaration[],
  libelles: Libelles = {},
) {
  // La valeur telle qu'elle doit s'imprimer : code et libellé quand les deux
  // existent, la valeur brute sinon.
  const afficher = (cle: string, brut: string): string => {
    const v = (brut ?? '').trim();
    if (!v) return '';
    const l = libelles[`${cle}:${v}`];
    if (!l || l === v) return v;
    // Un intervenant est déjà multiligne : y accoler son propre nom ferait
    // doublon.
    return v.includes('\n') ? v : `${v} — ${l}`;
  };
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = enTete(doc, 1);
  let page = 1;

  const sautSiNecessaire = (hauteurVoulue: number) => {
    if (y + hauteurVoulue <= HAUTEUR - 14) return;
    piedDePage(doc);
    doc.addPage();
    page += 1;
    y = enTete(doc, page);
  };

  for (const groupe of GROUPES_DECLARATION) {
    sautSiNecessaire(18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...ENCRE);
    doc.text(groupe.titre.toUpperCase(), MARGE, y);
    doc.setDrawColor(...ORANGE);
    doc.setLineWidth(0.4);
    doc.line(MARGE, y + 1.2, MARGE + 22, y + 1.2);
    y += 4;

    // Deux colonnes, sauf pour les cases longues qui prennent toute la largeur.
    let colonne = 0;
    const largeurColonne = (UTILE - 3) / 2;

    for (const c of groupe.cases) {
      const pleineLargeur = c.type === 'long';
      const hauteur = pleineLargeur ? 14 : 11;

      if (pleineLargeur && colonne === 1) {
        y += 11 + 2;
        colonne = 0;
      }
      sautSiNecessaire(hauteur + 2);

      const x = pleineLargeur ? MARGE : MARGE + colonne * (largeurColonne + 3);
      dessinerCase(
        doc,
        x,
        y,
        pleineLargeur ? UTILE : largeurColonne,
        hauteur,
        c.numero,
        c.libelle,
        afficher(c.cle, valeurs[c.cle] ?? ''),
      );

      if (pleineLargeur) {
        y += hauteur + 2;
        colonne = 0;
      } else if (colonne === 0) {
        colonne = 1;
      } else {
        y += hauteur + 2;
        colonne = 0;
      }
    }
    if (colonne === 1) y += 11 + 2;
    y += 2;
  }

  // ------- Le détail des articles -------
  for (const [i, a] of articles.entries()) {
    sautSiNecessaire(46);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...ENCRE);
    doc.text(`ARTICLE ${a.numero || i + 1}`, MARGE, y);
    doc.setDrawColor(...ORANGE);
    doc.setLineWidth(0.4);
    doc.line(MARGE, y + 1.2, MARGE + 18, y + 1.2);
    y += 4;

    const designation = CASES_ARTICLE.find((c) => c.cle === 'designation');
    if (designation) {
      dessinerCase(doc, MARGE, y, UTILE, 14, designation.numero, designation.libelle, a.designation);
      y += 16;
    }

    const autres = CASES_ARTICLE.filter((c) => c.cle !== 'designation' && c.cle !== 'numero');
    const largeurTiers = (UTILE - 6) / 3;
    autres.forEach((c, j) => {
      const col = j % 3;
      if (col === 0 && j > 0) y += 13;
      sautSiNecessaire(13);
      dessinerCase(
        doc,
        MARGE + col * (largeurTiers + 3),
        y,
        largeurTiers,
        11,
        c.numero,
        c.libelle,
        afficher(c.cle, String(a[c.cle as keyof ArticleDeclaration] ?? '')),
      );
    });
    y += 15;
  }

  // ------- Signature -------
  sautSiNecessaire(30);
  doc.setDrawColor(190, 185, 180);
  doc.setLineWidth(0.2);
  doc.rect(MARGE, y, UTILE, 24);
  doc.setFillColor(...GRIS_CLAIR);
  doc.rect(MARGE, y, 6.5, 4.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.setTextColor(...ORANGE);
  doc.text('54', MARGE + 3.25, y + 3, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.6);
  doc.setTextColor(...GRIS);
  doc.text(
    'Lieu et date, signature et nom du déclarant / représentant',
    MARGE + 7.5,
    y + 3,
  );
  doc.setFontSize(6.4);
  doc.text('Abidjan, le ..............................', MARGE + 3, y + 11);
  doc.text('Nom et qualité : ....................................................', MARGE + 3, y + 16);
  doc.text('Signature :', MARGE + 3, y + 21);

  piedDePage(doc);

  const reference = valeurs.numero_reference?.trim() || 'brouillon';
  doc.save(`declaration-${reference.replace(/[^\w-]/g, '-')}.pdf`);
}
