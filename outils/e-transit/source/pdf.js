/* Génération des documents PDF.
 *
 * Deux pièces sortent d'ici :
 *   - le devis remis au client, qui dit ce qu'il aura à payer et pourquoi ;
 *   - la note de liquidation, ligne par ligne, qui montre le détail du calcul
 *     et se garde au dossier.
 *
 * Le tableau est dessiné à la main plutôt qu'avec une extension : moins de
 * poids embarqué, et la maîtrise complète de la mise en page à l'impression.
 */
window.PDF = (function () {
  'use strict';

  // Dimensions de la page en cours. Le devis se lit en portrait ; la note de
  // liquidation, avec ses douze colonnes de taxes, ne tient qu'en paysage —
  // c'est d'ailleurs le format des feuilles de liquidation.
  var MARGE = 14;
  var LARGEUR = 210;
  var HAUTEUR = 297;
  var UTILE = LARGEUR - 2 * MARGE;

  var ENCRE = [23, 37, 54];
  var GRIS = [107, 118, 132];
  var TRAIT = [214, 220, 228];
  var ACCENT = [11, 87, 164];
  var FOND_ENTETE = [239, 244, 250];

  function fr(n, decimales) {
    var d = decimales === undefined ? 0 : decimales;
    return (Math.round(n * Math.pow(10, d)) / Math.pow(10, d))
      .toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
      .replace(/ | /g, ' ');
  }

  function creer(paysage) {
    var constructeur = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!constructeur) throw new Error("Le générateur PDF n'a pas été chargé avec l'application.");
    LARGEUR = paysage ? 297 : 210;
    HAUTEUR = paysage ? 210 : 297;
    UTILE = LARGEUR - 2 * MARGE;
    return new constructeur({
      unit: 'mm', format: 'a4', compress: true,
      orientation: paysage ? 'landscape' : 'portrait'
    });
  }

  /* ------------------------------------------------------------- fragments */

  function entete(doc, contexte, titre, sousTitre) {
    var societe = contexte.societe || {};
    var y = MARGE;
    var xTexte = MARGE;

    if (contexte.logo) {
      try {
        // Le logo garde ses proportions : une identité déformée fait amateur.
        var h = 18;
        var l = Math.min(46, h * (contexte.logo_ratio || 2.6));
        doc.addImage(contexte.logo, MARGE, y - 2, l, h, undefined, 'FAST');
        xTexte = MARGE + l + 6;
      } catch { /* un logo illisible ne doit pas empêcher le devis de sortir */ }
    }

    doc.setTextColor(ENCRE[0], ENCRE[1], ENCRE[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(societe.nom || 'E-TRANSIT', xTexte, y + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    var lignes = [];
    if (societe.activite) lignes.push(societe.activite);
    var adresse = [societe.adresse, societe.boite_postale, societe.ville, societe.pays].filter(Boolean).join(' — ');
    if (adresse) lignes.push(adresse);
    var contact = [societe.telephone && ('Tél. ' + societe.telephone), societe.courriel].filter(Boolean).join('  ·  ');
    if (contact) lignes.push(contact);
    var legal = [societe.rccm && ('RCCM ' + societe.rccm), societe.contribuable && ('CC ' + societe.contribuable),
      societe.agrement_declarant && ('Agrément ' + societe.agrement_declarant)].filter(Boolean).join('  ·  ');
    if (legal) lignes.push(legal);
    lignes.forEach(function (l, i) { doc.text(l, xTexte, y + 9 + i * 3.6); });

    // Bloc titre, calé à droite.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text(titre, LARGEUR - MARGE, y + 4, { align: 'right' });
    if (sousTitre) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
      doc.text(sousTitre, LARGEUR - MARGE, y + 9.5, { align: 'right' });
    }

    var bas = Math.max(y + 9 + lignes.length * 3.6, y + 14);
    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setLineWidth(0.8);
    doc.line(MARGE, bas + 2, LARGEUR - MARGE, bas + 2);
    doc.setLineWidth(0.2);
    return bas + 9;
  }

  function piedDePage(doc, contexte) {
    var pages = doc.getNumberOfPages();
    for (var p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setDrawColor(TRAIT[0], TRAIT[1], TRAIT[2]);
      doc.line(MARGE, HAUTEUR - 15, LARGEUR - MARGE, HAUTEUR - 15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
      doc.text((contexte.societe && contexte.societe.nom) || 'E-TRANSIT', MARGE, HAUTEUR - 11);
      doc.text('By Dems’Inc — Demsy Landry', LARGEUR / 2, HAUTEUR - 11, { align: 'center' });
      doc.text('Page ' + p + ' / ' + pages, LARGEUR - MARGE, HAUTEUR - 11, { align: 'right' });
      doc.setFontSize(6.5);
      doc.text(
        'Montants en francs CFA (XOF). Document établi le ' + new Date().toLocaleDateString('fr-FR') + '.',
        MARGE, HAUTEUR - 7.5
      );
    }
  }

  /* Deux colonnes d'informations en vis-à-vis, façon en-tête de déclaration. */
  function blocsParties(doc, y, gauche, droite) {
    var largeurBloc = (UTILE - 6) / 2;
    var hauteur = 4 + Math.max(gauche.lignes.length, droite.lignes.length) * 4.2 + 4;

    [[MARGE, gauche], [MARGE + largeurBloc + 6, droite]].forEach(function (paire) {
      var x = paire[0], bloc = paire[1];
      doc.setFillColor(FOND_ENTETE[0], FOND_ENTETE[1], FOND_ENTETE[2]);
      doc.setDrawColor(TRAIT[0], TRAIT[1], TRAIT[2]);
      doc.roundedRect(x, y, largeurBloc, hauteur, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.text(bloc.titre.toUpperCase(), x + 3, y + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(ENCRE[0], ENCRE[1], ENCRE[2]);
      bloc.lignes.forEach(function (l, i) {
        if (i === 0) doc.setFont('helvetica', 'bold'); else doc.setFont('helvetica', 'normal');
        doc.text(String(l || ''), x + 3, y + 9.5 + i * 4.2, { maxWidth: largeurBloc - 6 });
      });
    });
    return y + hauteur + 6;
  }

  /* Tableau générique. colonnes : [{ titre, largeur, aligne, gras }] */
  function tableau(doc, y, colonnes, lignes, options) {
    options = options || {};
    var hauteurLigne = options.hauteurLigne || 6;
    var tailleTexte = options.taille || 8;
    // Le cadre suit les colonnes : un tableau étroit ne traîne pas derrière lui
    // un bandeau qui court jusqu'au bord de la page.
    var largeurTableau = colonnes.reduce(function (s, c) { return s + c.largeur; }, 0);

    function enteteTableau(yy) {
      doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.rect(MARGE, yy, largeurTableau, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(tailleTexte);
      doc.setTextColor(255, 255, 255);
      var x = MARGE;
      colonnes.forEach(function (c) {
        var ax = c.aligne === 'right' ? x + c.largeur - 2 : (c.aligne === 'center' ? x + c.largeur / 2 : x + 2);
        doc.text(c.titre, ax, yy + 4.7, { align: c.aligne || 'left' });
        x += c.largeur;
      });
      return yy + 7;
    }

    y = enteteTableau(y);
    doc.setTextColor(ENCRE[0], ENCRE[1], ENCRE[2]);

    lignes.forEach(function (ligne, i) {
      if (y + hauteurLigne > HAUTEUR - 24) {
        doc.addPage();
        y = MARGE;
        y = enteteTableau(y);
        doc.setTextColor(ENCRE[0], ENCRE[1], ENCRE[2]);
      }
      if (ligne.__separateur) {
        doc.setDrawColor(TRAIT[0], TRAIT[1], TRAIT[2]);
        doc.line(MARGE, y + 1, MARGE + largeurTableau, y + 1);
        y += 2.5;
        return;
      }
      if (i % 2 === 1 && !ligne.__total) {
        doc.setFillColor(249, 250, 252);
        doc.rect(MARGE, y, largeurTableau, hauteurLigne, 'F');
      }
      if (ligne.__total) {
        doc.setFillColor(FOND_ENTETE[0], FOND_ENTETE[1], FOND_ENTETE[2]);
        doc.rect(MARGE, y, largeurTableau, hauteurLigne, 'F');
      }
      var x = MARGE;
      colonnes.forEach(function (c, j) {
        var valeur = ligne.cellules[j];
        doc.setFont('helvetica', (ligne.__total || c.gras) ? 'bold' : 'normal');
        doc.setFontSize(tailleTexte);
        if (ligne.__attention) doc.setTextColor(176, 106, 0);
        else doc.setTextColor(ENCRE[0], ENCRE[1], ENCRE[2]);
        var ax = c.aligne === 'right' ? x + c.largeur - 2 : (c.aligne === 'center' ? x + c.largeur / 2 : x + 2);
        doc.text(String(valeur === null || valeur === undefined ? '' : valeur), ax, y + hauteurLigne / 2 + 1.4, {
          align: c.aligne || 'left',
          maxWidth: c.largeur - 4
        });
        x += c.largeur;
      });
      y += hauteurLigne;
    });

    doc.setDrawColor(TRAIT[0], TRAIT[1], TRAIT[2]);
    doc.line(MARGE, y, MARGE + largeurTableau, y);
    return y + 6;
  }

  function paragraphe(doc, y, texte, options) {
    options = options || {};
    doc.setFont('helvetica', options.gras ? 'bold' : 'normal');
    doc.setFontSize(options.taille || 8);
    var couleur = options.couleur || GRIS;
    doc.setTextColor(couleur[0], couleur[1], couleur[2]);
    var lignes = doc.splitTextToSize(texte, UTILE);
    if (y + lignes.length * 3.8 > HAUTEUR - 24) { doc.addPage(); y = MARGE; }
    doc.text(lignes, MARGE, y);
    return y + lignes.length * 3.8 + 3;
  }

  function nomFichier(prefixe, dossier) {
    var client = (dossier.importateur_nom || 'client').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28);
    return prefixe + '_' + (dossier.numero || 'sans-numero') + '_' + client + '.pdf';
  }

  /* ----------------------------------------------------------------- devis */

  function devis(dossier, liquidation, chiffrage, contexte) {
    var doc = creer();
    var y = entete(doc, contexte, 'DEVIS', 'N° ' + (dossier.numero || '—'));

    y = blocsParties(doc, y,
      {
        titre: 'Client — importateur',
        lignes: [
          dossier.importateur_nom || '—',
          dossier.importateur_adresse || '',
          dossier.importateur_contribuable ? ('Compte contribuable : ' + dossier.importateur_contribuable) : '',
          dossier.importateur_telephone || ''
        ].filter(function (l) { return l !== ''; })
      },
      {
        titre: 'Opération',
        lignes: [
          (dossier.regime_code || '') + (dossier.regime_libelle ? ' — ' + dossier.regime_libelle : ''),
          dossier.bureau_nom ? ('Bureau : ' + dossier.bureau_nom) : '',
          dossier.provenance_nom ? ('Provenance : ' + dossier.provenance_nom) : '',
          [dossier.incoterm, dossier.incoterm_lieu].filter(Boolean).join(' ') || '',
          dossier.navire ? ((dossier.mode_libelle || 'Transport') + ' : ' + dossier.navire) : '',
          dossier.connaissement ? ('Titre de transport : ' + dossier.connaissement) : ''
        ].filter(function (l) { return l !== ''; })
      }
    );

    // Valeur en douane : le client doit voir sur quoi la douane se fonde.
    var g = liquidation.globaux;
    y = tableau(doc, y, [
      { titre: 'Valeur en douane', largeur: UTILE - 45 },
      { titre: 'Montant (XOF)', largeur: 45, aligne: 'right' }
    ], [
      { cellules: ['Valeur FOB des marchandises', fr(g.fob_total_xof)] },
      { cellules: ['Fret', fr(g.fret_total_xof)] },
      { cellules: ['Assurance', fr(g.assurance_total_xof)] },
      { cellules: ['Valeur CAF servant d’assiette', fr(g.caf_total_xof)], __total: true }
    ], { hauteurLigne: 6 });

    // Droits et taxes.
    var t = liquidation.totaux_taxes;
    var libelles = {};
    (contexte.taxes || []).forEach(function (x) { libelles[x.code] = x.libelle; });
    var lignesTaxes = Object.keys(t)
      .filter(function (code) { return t[code] > 0 || code === 'DD'; })
      .map(function (code) {
        return { cellules: [code + ' — ' + (libelles[code] || ''), fr(t[code])] };
      });
    lignesTaxes.push({ cellules: ['Total des droits et taxes dus à la Douane', fr(liquidation.total_a_payer_xof)], __total: true });

    y = tableau(doc, y, [
      { titre: 'Droits et taxes', largeur: UTILE - 45 },
      { titre: 'Montant (XOF)', largeur: 45, aligne: 'right' }
    ], lignesTaxes, { hauteurLigne: 6 });

    // Prestations et débours.
    var postes = (dossier.postes_devis || []).filter(function (p) { return LIQ().nombre(p.montant_xof) !== 0 || p.libelle; });
    if (postes.length) {
      var lignesPostes = postes.map(function (p) {
        return { cellules: [p.libelle, p.nature === 'honoraire' ? 'Honoraires' : 'Débours', fr(LIQ().nombre(p.montant_xof))] };
      });
      if (chiffrage.honoraires_xof > 0) {
        lignesPostes.push({
          cellules: ['TVA sur honoraires', fr(chiffrage.taux_tva_honoraires * 100, 0) + ' %', fr(chiffrage.tva_honoraires_xof)]
        });
      }
      y = tableau(doc, y, [
        { titre: 'Prestations et débours', largeur: UTILE - 75 },
        { titre: 'Nature', largeur: 30 },
        { titre: 'Montant (XOF)', largeur: 45, aligne: 'right' }
      ], lignesPostes, { hauteurLigne: 6 });
    }

    // Total à régler, mis en évidence.
    if (y + 20 > HAUTEUR - 30) { doc.addPage(); y = MARGE; }
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.roundedRect(MARGE, y, UTILE, 16, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('TOTAL À RÉGLER', MARGE + 5, y + 6.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text(fr(chiffrage.total_xof) + ' XOF', LARGEUR - MARGE - 5, y + 11, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Droits et taxes + prestations + débours', MARGE + 5, y + 12);
    y += 22;

    doc.setTextColor(ENCRE[0], ENCRE[1], ENCRE[2]);
    if (contexte.validite_jours) {
      y = paragraphe(doc, y, 'Validité du devis : ' + contexte.validite_jours + ' jours à compter de sa date.', { gras: true, couleur: ENCRE });
    }
    if (liquidation.regime && liquidation.regime.mention) {
      y = paragraphe(doc, y, liquidation.regime.mention);
    }
    if (contexte.conditions) y = paragraphe(doc, y, contexte.conditions);

    var nonVerifies = liquidation.lignes.filter(function (l) { return !l.verifie_en_base; }).length;
    if (nonVerifies > 0) {
      y = paragraphe(doc, y,
        'Réserve : ' + nonVerifies + ' position' + (nonVerifies > 1 ? 's' : '') + ' du présent devis ' +
        (nonVerifies > 1 ? 'ont' : 'a') + ' été liquidée' + (nonVerifies > 1 ? 's' : '') +
        ' avec un taux saisi manuellement, faute de correspondance dans le tarif chargé. ' +
        'Ces lignes sont à confirmer avant dépôt de la déclaration.',
        { couleur: [176, 106, 0], gras: true });
    }

    // Signature.
    if (y + 26 > HAUTEUR - 24) { doc.addPage(); y = MARGE; }
    y += 4;
    var societe = contexte.societe || {};
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    doc.text('Fait à ' + (societe.ville || 'Abidjan') + ', le ' + new Date().toLocaleDateString('fr-FR'),
      LARGEUR - MARGE, y, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(ENCRE[0], ENCRE[1], ENCRE[2]);
    doc.text(societe.responsable || '', LARGEUR - MARGE, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    doc.text(societe.fonction_responsable || '', LARGEUR - MARGE, y + 9, { align: 'right' });

    piedDePage(doc, contexte);
    return { doc: doc, nom: nomFichier('Devis', dossier) };
  }

  /* --------------------------------------------------- note de liquidation */

  function note(dossier, liquidation, contexte) {
    var doc = creer(true);
    var y = entete(doc, contexte, 'NOTE DE LIQUIDATION', 'Dossier ' + (dossier.numero || '—'));

    y = blocsParties(doc, y,
      {
        titre: 'Déclaration',
        lignes: [
          (dossier.regime_code || '—') + ' — ' + (dossier.regime_libelle || ''),
          dossier.bureau_nom ? ('Bureau : ' + dossier.bureau_nom) : '',
          dossier.numero_declaration ? ('N° déclaration : ' + dossier.numero_declaration) : '',
          'Devise : ' + (dossier.devise || 'XOF') + (dossier.taux_change && dossier.devise !== 'XOF' ? ('  ·  1 ' + dossier.devise + ' = ' + fr(dossier.taux_change, 3) + ' XOF') : '')
        ].filter(function (l) { return l !== ''; })
      },
      {
        titre: 'Parties',
        lignes: [
          'Importateur : ' + (dossier.importateur_nom || '—'),
          'Fournisseur : ' + (dossier.fournisseur_nom || '—'),
          'Origine / provenance : ' +
            ([dossier.origine_nom, dossier.provenance_nom].filter(Boolean).join(' / ') || '—')
        ]
      }
    );

    var codes = ['DD', 'RST', 'PCS', 'PUA', 'PCC', 'TVA'];
    // Les largeurs sont données en parts, puis étalées sur la largeur utile :
    // le tableau ne peut donc pas déborder de la page, quel que soit le format.
    var parts = [
      { titre: 'N°', part: 9, aligne: 'center' },
      { titre: 'Position', part: 30 },
      { titre: 'Désignation', part: 64 },
      { titre: 'Poids br.', part: 22, aligne: 'right' },
      { titre: 'Fret', part: 24, aligne: 'right' },
      { titre: 'Assurance', part: 24, aligne: 'right' },
      { titre: 'CAF', part: 28, aligne: 'right' },
      { titre: 'DD %', part: 16, aligne: 'right' },
      { titre: 'DD', part: 26, aligne: 'right' },
      { titre: 'RST', part: 22, aligne: 'right' },
      { titre: 'PCS', part: 21, aligne: 'right' },
      { titre: 'PUA', part: 20, aligne: 'right' },
      { titre: 'PCC', part: 20, aligne: 'right' },
      { titre: 'TVA', part: 27, aligne: 'right' },
      { titre: 'Total ligne', part: 29, aligne: 'right' }
    ];
    var sommeParts = parts.reduce(function (s, c) { return s + c.part; }, 0);
    var colonnes = parts.map(function (c) {
      return { titre: c.titre, aligne: c.aligne, largeur: UTILE * c.part / sommeParts };
    });

    var lignes = liquidation.lignes.map(function (l) {
      function montant(code) {
        var t = l.taxes.filter(function (x) { return x.code === code; })[0];
        return t ? t.montant_xof : 0;
      }
      var totalLigne = codes.reduce(function (s, c) { return s + montant(c); }, 0);
      return {
        __attention: !l.verifie_en_base,
        cellules: [
          l.numero, l.position || '—', l.designation,
          fr(l.poids_brut_kg, 2), fr(l.fret_xof), fr(l.assurance_xof), fr(l.caf_xof),
          fr(l.taux_dd_applique * 100, 1),
          fr(montant('DD')), fr(montant('RST')), fr(montant('PCS')),
          fr(montant('PUA')), fr(montant('PCC')), fr(montant('TVA')), fr(totalLigne)
        ]
      };
    });

    // Ligne de totaux, pour que la note se recoupe d'un coup d'œil.
    var g = liquidation.globaux;
    lignes.push({
      __total: true,
      cellules: ['', '', 'Totaux', fr(g.poids_brut_total_kg, 2), fr(g.fret_total_xof),
        fr(g.assurance_total_xof), fr(g.caf_total_xof), '',
        fr(liquidation.totaux_taxes.DD || 0), fr(liquidation.totaux_taxes.RST || 0),
        fr(liquidation.totaux_taxes.PCS || 0), fr(liquidation.totaux_taxes.PUA || 0),
        fr(liquidation.totaux_taxes.PCC || 0), fr(liquidation.totaux_taxes.TVA || 0),
        fr(codes.reduce(function (s, c) { return s + (liquidation.totaux_taxes[c] || 0); }, 0))]
    });

    y = tableau(doc, y, colonnes, lignes, { hauteurLigne: 6.5, taille: 6.6 });

    var t = liquidation.totaux_taxes;
    var recap = [
      { cellules: ['Total des taxes de ligne', fr(codes.reduce(function (s, c) { return s + (t[c] || 0); }, 0))] },
      { cellules: ['RPI — redevance prestations informatiques (une fois)', fr(t.RPI || 0)] },
      { cellules: ['TS — timbre statistique (une fois)', fr(t.TS || 0)] },
      { cellules: ['TOTAL DES DROITS ET TAXES', fr(liquidation.total_a_payer_xof)], __total: true }
    ];
    // En paysage, un récapitulatif étalé sur toute la page se lit mal : on le
    // garde à la largeur d'une colonne de lecture.
    y = tableau(doc, y, [
      { titre: 'Récapitulatif', largeur: 110 },
      { titre: 'Montant (XOF)', largeur: 45, aligne: 'right' }
    ], recap, { hauteurLigne: 6 });

    y = paragraphe(doc, y,
      'Règles appliquées — valeur en douane CAF = FOB + fret + assurance ; le fret est réparti au poids brut, ' +
      'l’assurance à la valeur FOB ; l’assiette de la TVA est la valeur CAF augmentée du droit de douane et de la ' +
      'redevance statistique, à l’exclusion des prélèvements communautaires ; la redevance informatique et le ' +
      'timbre statistique sont dus une seule fois par déclaration. La prime d’assurance est retenue en francs CFA, ' +
      'sans conversion.');

    if (liquidation.regime && liquidation.regime.mention) {
      y = paragraphe(doc, y, liquidation.regime.mention, { couleur: ENCRE });
    }

    piedDePage(doc, contexte);
    return { doc: doc, nom: nomFichier('Liquidation', dossier) };
  }

  function LIQ() { return window.LIQUIDATION; }

  return { devis: devis, note: note, fr: fr };
})();
