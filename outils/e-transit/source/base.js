/* La base de données locale.
 *
 * Tout ce que l'application retient vit ici : les dossiers, les carnets
 * d'adresses, le tarif douanier, les listes de référence, le logo, les
 * réglages. C'est une base IndexedDB, celle que le navigateur met à
 * disposition — pas un fichier à côté qu'on peut perdre en déplaçant
 * l'application.
 *
 * Ce qu'il faut savoir, et que l'application dit à l'écran :
 *   - la base vit dans le navigateur du poste. Elle survit à la fermeture, au
 *     redémarrage, à la mise à jour de l'application.
 *   - elle ne suit pas d'un poste à l'autre. Deux ordinateurs = deux bases.
 *     D'où la sauvegarde complète en un fichier, dans les Réglages.
 *   - « Effacer les données de navigation » avec la case « données de site »
 *     l'effacerait. La sauvegarde régulière n'est pas une précaution de luxe.
 */
window.BASE = (function () {
  'use strict';

  var NOM = 'etransit-cotation';
  var VERSION = 1;
  var bd = null;

  var MAGASINS = {
    parametres:      { keyPath: 'cle' },
    dossiers:        { keyPath: 'id', index: { date: 'date_creation', importateur: 'importateur_nom', statut: 'statut' } },
    importateurs:    { keyPath: 'id', index: { nom: 'nom' } },
    fournisseurs:    { keyPath: 'id', index: { nom: 'nom' } },
    transporteurs:   { keyPath: 'id', index: { nom: 'nom' } },
    tec:             { keyPath: 'code' },
    taux_personnels: { keyPath: 'code' },
    modeles_devis:   { keyPath: 'id' }
  };

  /* Le motif n'est pas le m\u00eame selon d'o\u00f9 l'application est ouverte, et la
   * marche \u00e0 suivre non plus. Donner la mauvaise consigne serait pire que de
   * n'en donner aucune. */
  function messageSansBase() {
    var debut = "Cette application a besoin d\u2019enregistrer les dossiers sur l\u2019appareil, " +
      "et cet appareil ne l\u2019autorise pas.\n\n";
    if (location.protocol.indexOf('http') === 0) {
      return debut +
        "C\u2019est le cas d\u2019une fen\u00eatre de navigation priv\u00e9e, et d\u2019un navigateur r\u00e9gl\u00e9 " +
        "pour bloquer les donn\u00e9es de sites.\n\n" +
        "Rouvrez l\u2019adresse dans une fen\u00eatre ordinaire, et autorisez ce site \u00e0 " +
        "conserver des donn\u00e9es.";
    }
    return debut +
      "C\u2019est le cas d\u2019un t\u00e9l\u00e9phone ou d\u2019une tablette qui ouvre le fichier depuis un " +
      "aper\u00e7u, et de Firefox pour un fichier ouvert depuis le disque.\n\n" +
      "Sur ordinateur : copiez le fichier sur le disque et ouvrez-le avec Microsoft Edge " +
      "ou Google Chrome.\nSur t\u00e9l\u00e9phone : c\u2019est la version en ligne qu\u2019il faut, " +
      "un fichier pos\u00e9 sur l\u2019appareil ne peut pas y fonctionner.";
  }

  function ouvrir() {
    if (bd) return Promise.resolve(bd);
    return new Promise(function (resoudre, rejeter) {
      if (typeof indexedDB === 'undefined') {
        rejeter(new Error(messageSansBase()));
        return;
      }

      // Certains navigateurs n'ouvrent pas la base et ne refusent pas non plus :
      // ils ne répondent jamais. Sans garde-fou, l'application attend
      // indéfiniment sans rien dire à personne.
      var repondu = false;
      var minuterie = setTimeout(function () {
        if (repondu) return;
        repondu = true;
        rejeter(new Error(messageSansBase()));
      }, 6000);

      function fini(action) {
        return function () {
          if (repondu) return;
          repondu = true;
          clearTimeout(minuterie);
          action();
        };
      }

      var requete = indexedDB.open(NOM, VERSION);
      requete.onupgradeneeded = function () {
        var base = requete.result;
        Object.keys(MAGASINS).forEach(function (nom) {
          if (base.objectStoreNames.contains(nom)) return;
          var def = MAGASINS[nom];
          var magasin = base.createObjectStore(nom, { keyPath: def.keyPath });
          Object.keys(def.index || {}).forEach(function (cle) {
            magasin.createIndex(cle, def.index[cle], { unique: false });
          });
        });
      };
      requete.onsuccess = fini(function () { bd = requete.result; resoudre(bd); });
      requete.onerror = fini(function () { rejeter(new Error(messageSansBase())); });
      requete.onblocked = fini(function () {
        rejeter(new Error(
          "Une autre fenêtre de l'application est déjà ouverte. Fermez-la, puis rechargez cette page."
        ));
      });
    });
  }

  function transaction(magasins, mode) {
    return ouvrir().then(function (base) { return base.transaction(magasins, mode); });
  }

  function promesse(requete) {
    return new Promise(function (resoudre, rejeter) {
      requete.onsuccess = function () { resoudre(requete.result); };
      requete.onerror = function () { rejeter(requete.error); };
    });
  }

  function lire(magasin, cle) {
    return transaction(magasin, 'readonly').then(function (tx) {
      return promesse(tx.objectStore(magasin).get(cle));
    });
  }

  function tout(magasin) {
    return transaction(magasin, 'readonly').then(function (tx) {
      return promesse(tx.objectStore(magasin).getAll());
    });
  }

  function ecrire(magasin, valeur) {
    return transaction(magasin, 'readwrite').then(function (tx) {
      var r = promesse(tx.objectStore(magasin).put(valeur));
      return r.then(function () { return valeur; });
    });
  }

  function ecrireLot(magasin, valeurs) {
    return transaction(magasin, 'readwrite').then(function (tx) {
      return new Promise(function (resoudre, rejeter) {
        var m = tx.objectStore(magasin);
        valeurs.forEach(function (v) { m.put(v); });
        tx.oncomplete = function () { resoudre(valeurs.length); };
        tx.onerror = function () { rejeter(tx.error); };
        tx.onabort = function () { rejeter(tx.error || new Error('transaction interrompue')); };
      });
    });
  }

  function supprimer(magasin, cle) {
    return transaction(magasin, 'readwrite').then(function (tx) {
      return promesse(tx.objectStore(magasin).delete(cle));
    });
  }

  function vider(magasin) {
    return transaction(magasin, 'readwrite').then(function (tx) {
      return promesse(tx.objectStore(magasin).clear());
    });
  }

  /* ------------------------------------------------------------ paramètres */

  function parametre(cle, defaut) {
    return lire('parametres', cle).then(function (r) {
      return r === undefined ? defaut : r.valeur;
    });
  }

  function poserParametre(cle, valeur) {
    return ecrire('parametres', { cle: cle, valeur: valeur });
  }

  /* Une amorce antérieure inscrivait un nom de responsable dans la fiche
   * société. On efface cette valeur-là si elle n'a pas été touchée — jamais
   * une saisie de l'utilisateur. */
  function oublierResponsableParDefaut() {
    return parametre('societe', null).then(function (societe) {
      if (!societe) return false;
      var pose = false;
      if (societe.responsable === 'Madame Estelle') { societe.responsable = ''; pose = true; }
      if (societe.fonction_responsable === 'Responsable cotation') { societe.fonction_responsable = ''; pose = true; }
      return pose ? poserParametre('societe', societe).then(function () { return true; }) : false;
    });
  }

  /* Une version antérieure fermait l'application par un code d'accès. Il a été
   * retiré : sur un poste de bureau il ajoutait une porte à ouvrir chaque matin
   * sans rien protéger de plus que la session Windows. On efface l'empreinte
   * laissée en base plutôt que de la garder à traîner. */
  function oublierAncienCodeAcces() {
    return lire('parametres', 'acces').then(function (a) {
      return a === undefined ? false : supprimer('parametres', 'acces').then(function () { return true; });
    });
  }

  /* -------------------------------------------------- listes de référence */
  /* Les listes vivent en base, pas dans le code : E-Transit peut en ajouter,
   * en corriger, en retirer. L'amorce livrée avec l'application ne sert qu'au
   * premier démarrage. */

  var LISTES = ['taxes', 'monnaies', 'pays', 'bureaux', 'regimes', 'incoterms',
    'modes', 'colis', 'types_conteneur', 'unites', 'documents', 'origines', 'postes_devis'];

  function semer(reference) {
    return parametre('amorce_faite', false).then(function (faite) {
      if (faite) return false;
      var ecritures = LISTES.map(function (nom) {
        var cle = nom.toUpperCase();
        return poserParametre('liste_' + nom, reference[cle] || []);
      });
      ecritures.push(poserParametre('societe', {
        nom: 'E-TRANSIT',
        forme: '',
        activite: 'Transit — Dédouanement — Logistique',
        adresse: '',
        boite_postale: '',
        ville: 'Abidjan',
        pays: 'Côte d’Ivoire',
        telephone: '',
        courriel: 'etransit@etransitci.com',
        site: '',
        rccm: '',
        contribuable: '',
        compte_bancaire: '',
        agrement_declarant: '',
        responsable: '',
        fonction_responsable: ''
      }));
      ecritures.push(poserParametre('devis_conditions',
        "Devis établi sur la base des documents communiqués. Les droits et taxes sont ceux résultant du tarif " +
        "en vigueur à la date d'établissement ; ils seront ajustés au montant réellement liquidé par la Douane. " +
        "Les débours sont refacturés à l'euro l'euro sur justificatifs."));
      ecritures.push(poserParametre('devis_validite_jours', 15));
      ecritures.push(poserParametre('taux_tva_honoraires', 0.18));
      ecritures.push(poserParametre('compteur_dossier', 0));
      ecritures.push(poserParametre('amorce_faite', true));
      return Promise.all(ecritures).then(function () { return true; });
    });
  }

  function liste(nom) {
    return parametre('liste_' + nom, []);
  }

  function poserListe(nom, valeurs) {
    return poserParametre('liste_' + nom, valeurs);
  }

  /* -------------------------------------------------------------- dossiers */

  function numeroSuivant() {
    return parametre('compteur_dossier', 0).then(function (n) {
      var suivant = n + 1;
      return poserParametre('compteur_dossier', suivant).then(function () {
        return String(new Date().getFullYear()) + '-' + ('0000' + suivant).slice(-4);
      });
    });
  }

  function identifiant() {
    return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ------------------------------------------------------------------ TEC */
  /* Le tarif est chargé une fois depuis la source, puis vit en base. Ensuite
   * l'application n'a plus besoin du réseau. Le bouton « Mettre à jour »
   * refait le voyage quand le tarif change. */

  var SOURCE_TEC_DEFAUT = 'https://oubowmftzxpruckjzwuq.supabase.co/functions/v1/app_e08c374bc4_tec_public';

  function sourceTec() {
    return parametre('source_tec', SOURCE_TEC_DEFAUT);
  }

  function synchroniserTec(surAvancement) {
    var dire = surAvancement || function () {};
    return sourceTec().then(function (url) {
      dire('Connexion au tarif…');
      return fetch(url, { cache: 'no-store' });
    }).then(function (reponse) {
      if (!reponse.ok) throw new Error('Le tarif a répondu ' + reponse.status + '.');
      dire('Téléchargement du tarif…');
      return reponse.json();
    }).then(function (charge) {
      if (!charge || !Array.isArray(charge.lignes) || charge.lignes.length === 0) {
        throw new Error('Le tarif reçu est vide. Rien n’a été remplacé.');
      }
      dire('Enregistrement de ' + charge.lignes.length.toLocaleString('fr-FR') + ' positions…');
      var enregistrements = charge.lignes.map(function (l) {
        return {
          code: l[0],
          // Le corpus porte les taux en pourcentage ; on range en fraction,
          // qui est l'unité de tout le reste du calcul.
          taux_dd: (l[1] === null || l[1] === undefined) ? null : Number(l[1]) / 100,
          unite: l[2] || '',
          designation: l[3] || '',
          categorie: l[4],
          recherche: (l[0] + ' ' + (l[3] || '')).toLowerCase()
        };
      });
      return vider('tec')
        .then(function () { return ecrireLot('tec', enregistrements); })
        .then(function () {
          return Promise.all([
            poserParametre('tec_source_libelle', charge.source || ''),
            poserParametre('tec_version', charge.version || null),
            poserParametre('tec_charge_le', new Date().toISOString()),
            poserParametre('tec_nombre', enregistrements.length)
          ]);
        })
        .then(function () { return enregistrements.length; });
    });
  }

  function importerTecDepuisTexte(texte) {
    var charge;
    try { charge = JSON.parse(texte); }
    catch { throw new Error("Ce fichier n'est pas un tarif au format attendu."); }
    var lignes = Array.isArray(charge) ? charge : charge.lignes;
    if (!Array.isArray(lignes) || lignes.length === 0) throw new Error('Aucune position dans ce fichier.');
    var enregistrements = lignes.map(function (l) {
      if (Array.isArray(l)) {
        return { code: l[0], taux_dd: l[1] === null ? null : Number(l[1]) / 100, unite: l[2] || '', designation: l[3] || '', categorie: l[4], recherche: (l[0] + ' ' + (l[3] || '')).toLowerCase() };
      }
      return { code: l.code, taux_dd: l.taux_dd === null ? null : Number(l.taux_dd), unite: l.unite || '', designation: l.designation || '', categorie: l.categorie, recherche: ((l.code || '') + ' ' + (l.designation || '')).toLowerCase() };
    });
    return vider('tec')
      .then(function () { return ecrireLot('tec', enregistrements); })
      .then(function () {
        return Promise.all([
          poserParametre('tec_source_libelle', charge.source || 'Fichier importé'),
          poserParametre('tec_charge_le', new Date().toISOString()),
          poserParametre('tec_nombre', enregistrements.length)
        ]);
      })
      .then(function () { return enregistrements.length; });
  }

  /* -------------------------------------------- sauvegarde et restauration */

  function exporterTout(avecTarif) {
    var magasins = ['parametres', 'dossiers', 'importateurs', 'fournisseurs',
      'transporteurs', 'taux_personnels', 'modeles_devis'];
    if (avecTarif) magasins.push('tec');
    return Promise.all(magasins.map(tout)).then(function (resultats) {
      var paquet = { application: 'Cotation E-Transit', version: VERSION, exporte_le: new Date().toISOString(), donnees: {} };
      magasins.forEach(function (nom, i) { paquet.donnees[nom] = resultats[i]; });
      return paquet;
    });
  }

  function importerTout(paquet) {
    if (!paquet || !paquet.donnees) throw new Error("Ce fichier n'est pas une sauvegarde de l'application.");
    var noms = Object.keys(paquet.donnees).filter(function (n) { return MAGASINS[n]; });
    return noms.reduce(function (chaine, nom) {
      return chaine.then(function () {
        var valeurs = paquet.donnees[nom] || [];
        return vider(nom).then(function () { return valeurs.length ? ecrireLot(nom, valeurs) : 0; });
      });
    }, Promise.resolve()).then(function () { return noms; });
  }

  return {
    ouvrir: ouvrir, lire: lire, tout: tout, ecrire: ecrire, ecrireLot: ecrireLot,
    supprimer: supprimer, vider: vider,
    parametre: parametre, poserParametre: poserParametre,
    liste: liste, poserListe: poserListe, semer: semer, LISTES: LISTES,
    oublierAncienCodeAcces: oublierAncienCodeAcces,
    oublierResponsableParDefaut: oublierResponsableParDefaut,
    numeroSuivant: numeroSuivant, identifiant: identifiant,
    sourceTec: sourceTec, SOURCE_TEC_DEFAUT: SOURCE_TEC_DEFAUT,
    synchroniserTec: synchroniserTec, importerTecDepuisTexte: importerTecDepuisTexte,
    exporterTout: exporterTout, importerTout: importerTout
  };
})();
