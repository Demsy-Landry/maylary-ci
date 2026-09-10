/* Liquidation des droits et taxes.
 *
 * Ce fichier est la transcription exacte de la fonction de liquidation qui
 * tourne en base côté Déclarant. Même enchaînement, mêmes arrondis, mêmes
 * refus. Si les deux divergent un jour, c'est un défaut, pas une variante :
 * un devis remis au client et une déclaration déposée à la douane doivent
 * donner le même chiffre au franc près.
 *
 * Les règles, une par une :
 *   CAF        = FOB + fret réparti + assurance répartie
 *   fret       réparti au poids brut  (jamais à la valeur)
 *   assurance  répartie à la valeur FOB, et toujours libellée en francs CFA
 *   DD         = CAF x taux de la position tarifaire
 *   RST        = CAF x 1 %
 *   PCS        = CAF x 0,8 %      PUA = CAF x 0,2 %      PCC = CAF x 0,5 %
 *   base TVA   = CAF + DD + RST      (et rien d'autre)
 *   TVA        = base TVA x 18 %
 *   RPI        = max(FOB total x 0,75 % ; 100 000)  une fois par déclaration
 *   TS         = 20 000                              une fois par déclaration
 *
 * Chaque taxe est arrondie au franc dès son calcul, exactement comme en base,
 * et l'assiette de la TVA est construite avec les montants déjà arrondis.
 */
window.LIQUIDATION = (function () {
  'use strict';

  var f = Math.round;

  function nombre(v) {
    if (v === null || v === undefined || v === '') return 0;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.').replace(/\s/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  /* Erreur porteuse d'un message destiné à l'écran, pas d'une trace technique.
   * On refuse de calculer plutôt que de calculer sur une donnée absente. */
  function Refus(message) {
    var e = new Error(message);
    e.name = 'Refus';
    return e;
  }

  /**
   * @param dossier {
   *   regime      : { code, libelle, droits, rpi, ts, categorie, mention }
   *   taxes       : liste des taxes (référence)
   *   fret_xof    : fret total déjà converti en francs CFA
   *   assurance_xof : prime totale, en francs CFA, jamais convertie
   *   lignes      : [{ numero, designation, position, taux_dd (fraction),
   *                    fob_xof, poids_brut_kg, origine, exoneration (fraction) }]
   * }
   */
  function liquider(dossier) {
    var regime = dossier.regime || { droits: true, rpi: true, ts: true };
    var taxes = (dossier.taxes || []).slice().filter(function (t) { return t.actif !== false; });
    var lignes = (dossier.lignes || []).filter(function (l) {
      return l && (nombre(l.fob_xof) > 0 || nombre(l.poids_brut_kg) > 0 || l.designation);
    });

    if (lignes.length === 0) throw new Refus("Aucun article saisi : il n'y a rien à liquider.");

    var fretTotal = nombre(dossier.fret_xof);
    var assuranceTotal = nombre(dossier.assurance_xof);

    var fobTotal = 0;
    var poidsTotal = 0;
    lignes.forEach(function (l) {
      fobTotal += nombre(l.fob_xof);
      poidsTotal += nombre(l.poids_brut_kg);
    });

    if (fobTotal <= 0) {
      throw new Refus("La valeur FOB totale est nulle : l'assurance et la redevance informatique ne peuvent pas être réparties.");
    }
    if (fretTotal > 0 && poidsTotal <= 0) {
      throw new Refus("Fret à répartir mais aucun poids brut renseigné : la répartition du fret se fait au poids. Renseignez le poids brut de chaque article.");
    }

    var taxesLigne = taxes.filter(function (t) { return t.niveau === 'ligne'; });
    var taxesBaseTva = taxesLigne.filter(function (t) { return t.base_tva; });

    var resultats = lignes.map(function (l, index) {
      var fob = nombre(l.fob_xof);
      var poids = nombre(l.poids_brut_kg);
      var tauxDd = l.taux_dd;

      if (tauxDd === null || tauxDd === undefined || tauxDd === '') {
        throw new Refus(
          'Ligne « ' + (l.designation || ('n° ' + (index + 1))) + ' » : droit de douane inconnu. ' +
          'Le code ' + (l.position || '(vide)') + " n'est pas dans le tarif — saisissez le taux à la main ou corrigez la position."
        );
      }
      tauxDd = nombre(tauxDd);
      if (tauxDd > 1) {
        throw new Refus(
          'Ligne « ' + (l.designation || ('n° ' + (index + 1))) + ' » : le taux de droit se donne en fraction (0,20 pour 20 %), pas en pourcentage.'
        );
      }
      // Une exonération partielle réduit le seul droit de douane.
      var exoneration = Math.min(Math.max(nombre(l.exoneration), 0), 1);
      var tauxDdApplique = tauxDd * (1 - exoneration);

      var fret = fretTotal === 0 ? 0 : (fretTotal / poidsTotal) * poids;
      var assurance = (assuranceTotal / fobTotal) * fob;
      var poidsStat = (poidsTotal / fobTotal) * fob;
      var caf = fob + fret + assurance;

      // L'assiette de la TVA se construit d'abord, avec les montants arrondis.
      var baseTva = caf;
      taxesBaseTva.forEach(function (t) {
        baseTva += f(caf * (t.taux === null || t.taux === undefined ? tauxDdApplique : t.taux));
      });

      var detail = taxesLigne.map(function (t) {
        var taux = (t.taux === null || t.taux === undefined) ? tauxDdApplique : t.taux;
        var montant;
        if (!regime.droits) montant = 0;
        else if (t.assiette === 'caf') montant = f(caf * taux);
        else if (t.assiette === 'base_tva') montant = f(baseTva * taux);
        else montant = 0;
        return {
          code: t.code,
          libelle: t.libelle,
          base_xof: f(t.assiette === 'base_tva' ? baseTva : caf),
          taux: taux,
          montant_xof: montant
        };
      });

      return {
        numero: l.numero || (index + 1),
        designation: l.designation || '',
        position: l.position || '',
        designation_tec: l.designation_tec || '',
        unite: l.unite || '',
        origine: l.origine || '',
        verifie_en_base: !!l.verifie_en_base,
        taux_dd: tauxDd,
        taux_dd_applique: tauxDdApplique,
        exoneration: exoneration,
        taux_dd_saisi: !!l.taux_dd_saisi,
        quantite: nombre(l.quantite),
        fob_xof: f(fob),
        poids_brut_kg: poids,
        poids_stat_kg: Math.round(poidsStat * 1000) / 1000,
        fret_xof: f(fret),
        assurance_xof: f(assurance),
        part_fret: poidsTotal > 0 ? poids / poidsTotal : 0,
        part_valeur: fob / fobTotal,
        caf_xof: f(caf),
        base_tva_xof: f(baseTva),
        taxes: detail
      };
    });

    // Taxes de niveau déclaration : une seule fois, quel que soit le nombre
    // de lignes. Le timbre suit son propre drapeau — sous entrepôt les droits
    // sont suspendus mais le timbre reste dû.
    var totaux = {};
    var rpi = 0;
    var ts = 0;
    taxes.filter(function (t) { return t.niveau === 'declaration'; }).forEach(function (t) {
      if (t.code === 'RPI') {
        rpi = regime.rpi ? Math.max(f(fobTotal * nombre(t.taux)), nombre(t.minimum)) : 0;
      } else if (t.code === 'TS') {
        ts = regime.ts ? nombre(t.fixe) : 0;
      }
    });

    taxesLigne.forEach(function (t) {
      totaux[t.code] = resultats.reduce(function (somme, ligne) {
        var trouve = ligne.taxes.filter(function (x) { return x.code === t.code; })[0];
        return somme + (trouve ? trouve.montant_xof : 0);
      }, 0);
    });
    totaux.RPI = rpi;
    totaux.TS = ts;

    var totalAPayer = Object.keys(totaux).reduce(function (s, k) { return s + totaux[k]; }, 0);

    var cafTotal = resultats.reduce(function (s, l) { return s + l.caf_xof; }, 0);

    return {
      regime: regime,
      globaux: {
        fob_total_xof: f(fobTotal),
        fret_total_xof: f(fretTotal),
        assurance_total_xof: f(assuranceTotal),
        poids_brut_total_kg: poidsTotal,
        caf_total_xof: cafTotal,
        nombre_lignes: resultats.length
      },
      lignes: resultats,
      totaux_taxes: totaux,
      total_a_payer_xof: totalAPayer
    };
  }

  /* Le devis remis au client : les droits et taxes, plus ce qu'E-Transit
   * facture pour son propre compte. Aucun montant d'honoraire n'est proposé
   * ici — ils appartiennent à E-Transit, et personne d'autre ne les fixe. */
  function devis(liquidation, postes, options) {
    options = options || {};
    var tvaHonoraires = options.taux_tva_honoraires;
    if (tvaHonoraires === null || tvaHonoraires === undefined) tvaHonoraires = 0.18;

    var honoraires = 0;
    var debours = 0;
    (postes || []).forEach(function (p) {
      var montant = nombre(p.montant_xof);
      if (p.nature === 'honoraire') honoraires += montant;
      else debours += montant;
    });

    // La TVA ne frappe que la prestation d'E-Transit. Les débours sont des
    // sommes avancées pour le compte du client : les refacturer avec TVA
    // reviendrait à taxer deux fois.
    var tvaSurHonoraires = f(honoraires * tvaHonoraires);
    var droitsEtTaxes = liquidation ? liquidation.total_a_payer_xof : 0;

    return {
      droits_et_taxes_xof: droitsEtTaxes,
      honoraires_xof: honoraires,
      tva_honoraires_xof: tvaSurHonoraires,
      taux_tva_honoraires: tvaHonoraires,
      debours_xof: debours,
      total_xof: droitsEtTaxes + honoraires + tvaSurHonoraires + debours
    };
  }

  return { liquider: liquider, devis: devis, nombre: nombre, Refus: Refus };
})();
