/* L'interface.
 *
 * Une règle tient tout le fichier : rien ne s'affiche qui ne vienne d'une
 * saisie ou d'une source. Quand une donnée manque, l'application le dit et
 * laisse la main — elle ne comble jamais un trou par une estimation.
 */
(function () {
  'use strict';

  var L = window.LIQUIDATION;
  var etat = {
    dossier: null,
    listes: {},
    tec: [],
    tauxPersonnels: [],
    societe: {},
    logo: null,
    logoRatio: 2.6,
    conditions: '',
    validite: 15,
    tvaHonoraires: 0.18,
    modelesDevis: [],
    page: 'bord',
    sauvegardeEnAttente: null
  };

  /* ================================================================ outils */

  function $(s, racine) { return (racine || document).querySelector(s); }
  function $$(s, racine) { return Array.prototype.slice.call((racine || document).querySelectorAll(s)); }

  function el(balise, attributs, enfants) {
    var n = document.createElement(balise);
    Object.keys(attributs || {}).forEach(function (c) {
      if (c === 'class') n.className = attributs[c];
      else if (c === 'html') n.innerHTML = attributs[c];
      else if (c === 'texte') n.textContent = attributs[c];
      else if (c.slice(0, 2) === 'on') n.addEventListener(c.slice(2), attributs[c]);
      else if (attributs[c] !== null && attributs[c] !== undefined) n.setAttribute(c, attributs[c]);
    });
    (enfants || []).forEach(function (e) { if (e) n.appendChild(typeof e === 'string' ? document.createTextNode(e) : e); });
    return n;
  }

  /* Une <svg> sans dimension se rend en 300 x 150 : dans une case de tableau,
   * cela suffit à faire déborder toute la page. On pose donc une taille par
   * défaut sur l'élément, que n'importe quelle règle CSS peut ensuite reprendre. */
  function icone(nom, classe) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '16');
    s.setAttribute('height', '16');
    if (classe) s.setAttribute('class', classe);
    var u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    u.setAttribute('href', '#i-' + nom);
    s.appendChild(u);
    return s;
  }

  var nb = L.nombre;

  function fr(n, decimales) {
    var d = decimales === undefined ? 0 : decimales;
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function frDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
  }

  function aujourdhui() { return new Date().toISOString().slice(0, 10); }

  function message(texte, genre) {
    var n = el('div', { class: 'message ' + (genre || '') }, [
      icone(genre === 'erreur' ? 'alerte' : (genre === 'succes' ? 'ok' : 'info')),
      el('div', { texte: texte })
    ]);
    $('#messages').appendChild(n);
    setTimeout(function () {
      n.style.transition = 'opacity 240ms, transform 240ms';
      n.style.opacity = '0';
      n.style.transform = 'translateY(8px)';
      setTimeout(function () { n.remove(); }, 260);
    }, genre === 'erreur' ? 7000 : 4000);
  }

  function avis(genre, titre, texte) {
    return el('div', { class: 'avis ' + genre }, [
      icone(genre === 'succes' ? 'ok' : (genre === 'info' ? 'info' : 'alerte')),
      el('div', {}, [el('strong', { texte: titre + ' ' }), el('span', { texte: texte })])
    ]);
  }

  /* Compteur qui monte : sur un tableau de bord, un chiffre qui s'installe se
   * remarque et se retient mieux qu'un chiffre déjà posé. */
  function compter(noeud, valeur, decimales, suffixe) {
    var reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduit || !Number.isFinite(valeur)) {
      noeud.textContent = fr(valeur, decimales) + (suffixe || '');
      return;
    }
    var debut = performance.now();
    var duree = 620;
    function pas(t) {
      var p = Math.min((t - debut) / duree, 1);
      var doux = 1 - Math.pow(1 - p, 3);
      noeud.textContent = fr(valeur * doux, decimales) + (suffixe || '');
      if (p < 1) requestAnimationFrame(pas);
    }
    requestAnimationFrame(pas);
  }

  function telecharger(nom, contenu, type) {
    var blob = contenu instanceof Blob ? contenu : new Blob([contenu], { type: type || 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: nom });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  function lireFichier(accept, commeTexte) {
    return new Promise(function (resoudre) {
      var entree = $('#fichier-generique');
      entree.value = '';
      entree.accept = accept || '';
      entree.onchange = function () {
        var f = entree.files[0];
        if (!f) { resoudre(null); return; }
        var lecteur = new FileReader();
        lecteur.onload = function () { resoudre({ nom: f.name, type: f.type, contenu: lecteur.result }); };
        if (commeTexte === false) lecteur.readAsDataURL(f); else lecteur.readAsText(f);
      };
      entree.click();
    });
  }

  /* --------------------------------------------------------------- modales */

  function modale(titre, corps, boutons) {
    var m = $('#modale');
    m.innerHTML = '';
    var entete = el('header', {}, [el('h3', { texte: titre })]);
    var fermer = el('button', { class: 'icone fermer', title: 'Fermer', onclick: fermerModale }, [icone('croix')]);
    entete.appendChild(fermer);
    m.appendChild(entete);
    var c = el('div', { class: 'corps' });
    if (typeof corps === 'string') c.innerHTML = corps; else c.appendChild(corps);
    m.appendChild(c);
    if (boutons && boutons.length) {
      var pied = el('footer');
      boutons.forEach(function (b) {
        pied.appendChild(el('button', {
          class: 'b ' + (b.genre || ''), texte: b.libelle,
          onclick: function () { if (b.action) b.action(); }
        }));
      });
      m.appendChild(pied);
    }
    $('#voile').classList.remove('masquee');
    var premier = c.querySelector('input,select,textarea');
    if (premier) setTimeout(function () { premier.focus(); }, 60);
    return c;
  }

  function fermerModale() { $('#voile').classList.add('masquee'); }

  $('#voile').addEventListener('click', function (e) { if (e.target === this) fermerModale(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { fermerModale(); fermerListesCombo(); }
  });

  function confirmer(titre, texte, libelleAction) {
    return new Promise(function (resoudre) {
      modale(titre, el('p', { texte: texte }), [
        { libelle: 'Annuler', action: function () { fermerModale(); resoudre(false); } },
        { libelle: libelleAction || 'Confirmer', genre: 'primaire danger', action: function () { fermerModale(); resoudre(true); } }
      ]);
    });
  }

  /* ====================================================== dossier courant */

  function dossierVierge() {
    return {
      id: BASE.identifiant(),
      numero: '',
      date_creation: new Date().toISOString(),
      date_modification: new Date().toISOString(),
      statut: 'brouillon',
      reference: '',
      date: aujourdhui(),
      bureau_nom: '', bureau_code: '',
      regime_code: '4000',
      numero_declaration: '', bureau_entree: '', lieu_marchandises: '',
      importateur_nom: '', importateur_contribuable: '', importateur_code: '',
      importateur_adresse: '', importateur_telephone: '', importateur_courriel: '',
      fournisseur_nom: '', fournisseur_adresse: '',
      declarant: etat.societe.nom || 'E-TRANSIT',
      declarant_agrement: etat.societe.agrement_declarant || '',
      declarant_repere: '',
      provenance: '', origine: '', regime_origine: 'TIERS',
      mode: '1', navire: '', voyage: '', connaissement: '', manifeste: '', date_arrivee: '',
      facture: '', date_facture: '', devise: 'XOF', taux_change: 1,
      incoterm: 'FOB', incoterm_lieu: '',
      fret: 0, assurance: 0,
      nb_colis: 0, nature_colis: 'CT', marques: '', poids_brut_manifeste: '',
      conteneurs: [],
      documents: {},
      observations: '',
      articles: [articleVierge()],
      postes_devis: modelesProposes()
    };
  }

  function articleVierge() {
    return {
      position: '', designation: '', designation_tec: '', origine: '',
      quantite: '', unite: '', poids_brut: '', poids_net: '', valeur: '',
      taux_dd_pct: '', exoneration_pct: 0,
      verifie_en_base: false, taux_dd_saisi: false
    };
  }

  function modelesProposes() {
    return etat.modelesDevis.filter(function (m) { return m.doffice; }).map(function (m) {
      return { libelle: m.libelle, nature: m.nature, montant_xof: nb(m.montant_xof) };
    });
  }

  function marquerModifie() {
    if (!etat.dossier) return;
    etat.dossier.date_modification = new Date().toISOString();
    clearTimeout(etat.sauvegardeEnAttente);
    etat.sauvegardeEnAttente = setTimeout(enregistrerDossier, 700);
  }

  function enregistrerDossier() {
    if (!etat.dossier) return Promise.resolve();
    var d = etat.dossier;
    var vide = !d.importateur_nom && !d.fournisseur_nom && !d.facture &&
      d.articles.every(function (a) { return !a.designation && !a.position && !nb(a.valeur); });
    if (vide && !d.numero) return Promise.resolve();

    var avant = d.numero ? Promise.resolve(d.numero) : BASE.numeroSuivant().then(function (n) {
      d.numero = n;
      $('#d-numero').value = n;
      $('#declaration-indice').textContent = 'Dossier ' + n;
      return n;
    });

    return avant.then(function () {
      return BASE.ecrire('dossiers', JSON.parse(JSON.stringify(d)));
    }).then(function () {
      rafraichirPastilles();
    }).catch(function (e) { message('Enregistrement impossible : ' + e.message, 'erreur'); });
  }

  /* ================================================================ départ */

  function demarrer() {
    var texte = $('#chargement-texte');
    BASE.ouvrir()
      .then(function () { return BASE.semer(window.REFERENCE); })
      .then(function () { return BASE.oublierAncienCodeAcces(); })
      .then(function () { return BASE.oublierResponsableParDefaut(); })
      .then(chargerContexte)
      .then(ouvrirApplication)
      .catch(function (e) {
        // Sans base, il n'y a rien à afficher : on dit pourquoi, en clair, et
        // on dit quoi faire. Une attente sans fin n'apprend rien à personne.
        var voile = $('#chargement');
        voile.classList.add('en-panne');
        var fenetre = texte.parentNode;
        fenetre.innerHTML = '';
        var alerte = icone('alerte');
        alerte.setAttribute('style', 'width:22px;height:22px;flex:none;margin-top:1px');
        fenetre.appendChild(alerte);
        fenetre.appendChild(el('div', {}, [
          el('div', { class: 'titre', texte: 'L’application ne peut pas s’ouvrir ici' }),
          el('div', { class: 'texte', texte: e.message })
        ]));
      });
  }

  function chargerContexte() {
    var listes = BASE.LISTES;
    return Promise.all(
      listes.map(function (n) { return BASE.liste(n); })
        .concat([
          BASE.parametre('societe', {}),
          BASE.parametre('logo', null),
          BASE.parametre('logo_ratio', 2.6),
          BASE.parametre('devis_conditions', ''),
          BASE.parametre('devis_validite_jours', 15),
          BASE.parametre('taux_tva_honoraires', 0.18),
          BASE.tout('modeles_devis'),
          BASE.tout('taux_personnels'),
          BASE.tout('tec')
        ])
    ).then(function (r) {
      listes.forEach(function (n, i) { etat.listes[n] = r[i] || []; });
      var k = listes.length;
      etat.societe = r[k] || {};
      etat.logo = r[k + 1];
      etat.logoRatio = r[k + 2] || 2.6;
      etat.conditions = r[k + 3] || '';
      etat.validite = r[k + 4];
      etat.tvaHonoraires = r[k + 5];
      etat.modelesDevis = r[k + 6] || [];
      etat.tauxPersonnels = r[k + 7] || [];
      etat.tec = r[k + 8] || [];
    });
  }

  function ouvrirApplication() {
    $('#chargement').classList.add('parti');
    setTimeout(function () { $('#chargement').style.display = 'none'; }, 260);
    $('#application').classList.add('visible');
    document.body.setAttribute('data-pret', 'oui');
    construire();
  }

  /* ============================================================ ossature */

  function construire() {
    peindreLogo($('#rail-logo'), 128, 40);
    $('#rail-nom').textContent = etat.societe.nom || 'E-TRANSIT';
    $('#banniere-nom').textContent = etat.societe.nom || 'E-TRANSIT';

    $$('#navigation button').forEach(function (b) {
      b.addEventListener('click', function () { aller(b.dataset.page); });
    });
    $$('[data-aller]').forEach(function (b) {
      b.addEventListener('click', function () { aller(b.dataset.aller); });
    });

    remplirSelecteurs();
    brancherDeclaration();
    brancherArticles();
    brancherReglages();
    brancherCarnet();
    brancherHistorique();

    nouveauDossier(true);
    rafraichirPastilles();
    peindreEtatTec();
    aller('bord');

    // Si le tarif n'est jamais descendu, on le propose tout de suite : sans
    // lui, chaque position devra être tapée à la main.
    if (etat.tec.length === 0) {
      setTimeout(proposerChargementTec, 700);
    }
  }

  var TITRES = {
    bord: ['Tableau de bord', 'Vue d’ensemble de l’activité'],
    declaration: ['Déclaration', 'Renseignements du dossier, modèle SYDAM'],
    articles: ['Articles', 'Positions tarifaires, poids et valeurs'],
    liquidation: ['Liquidation et devis', 'Droits, taxes et montant à régler'],
    historique: ['Historique', 'Toutes les cotations établies'],
    carnet: ['Carnet d’adresses', 'Importateurs, fournisseurs, transporteurs'],
    reglages: ['Réglages', 'Société, tarif, listes, sauvegarde']
  };

  function aller(page) {
    etat.page = page;
    $$('.page').forEach(function (p) { p.classList.add('masquee'); });
    var n = $('#page-' + page);
    n.classList.remove('masquee');
    n.classList.remove('monte');
    void n.offsetWidth;
    n.classList.add('monte');
    $$('#navigation button').forEach(function (b) { b.classList.toggle('actif', b.dataset.page === page); });
    $('#barre-titre').textContent = TITRES[page][0];
    $('#barre-fil').textContent = TITRES[page][1];
    peindreActionsBarre(page);
    if (page === 'bord') peindreBord();
    if (page === 'liquidation') peindreLiquidation();
    if (page === 'historique') peindreHistorique();
    if (page === 'carnet') peindreCarnet();
    if (page === 'reglages') peindreReglages();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function peindreActionsBarre(page) {
    var z = $('#barre-actions');
    z.innerHTML = '';
    function bouton(libelle, ic, action, genre) {
      var b = el('button', { class: 'b ' + (genre || ''), onclick: action }, [icone(ic), document.createTextNode(libelle)]);
      z.appendChild(b);
      return b;
    }
    if (page === 'declaration' || page === 'articles') {
      bouton('Nouveau dossier', 'plus', function () { nouveauDossier(); });
      bouton('Liquider', 'calcul', function () { aller('liquidation'); }, 'primaire');
    }
    if (page === 'liquidation') {
      bouton('Imprimer', 'imprimer', function () { window.print(); });
      bouton('Note de liquidation', 'pdf', function () { sortirPdf('note'); });
      bouton('Devis PDF', 'pdf', function () { sortirPdf('devis'); }, 'primaire');
    }
    if (page === 'bord') {
      bouton('Nouveau dossier', 'plus', function () { nouveauDossier(); aller('declaration'); }, 'primaire');
    }
  }

  function rafraichirPastilles() {
    $('#pastille-articles').textContent = etat.dossier
      ? etat.dossier.articles.filter(function (a) { return a.designation || a.position || nb(a.valeur); }).length
      : 0;
    BASE.tout('dossiers').then(function (d) { $('#pastille-historique').textContent = d.length; });
  }

  function peindreLogo(cible, largeurMax, hauteurMax) {
    cible.innerHTML = '';
    if (etat.logo) {
      cible.appendChild(el('img', {
        src: etat.logo, alt: (etat.societe.nom || 'E-Transit'),
        style: 'max-width:' + largeurMax + 'px;max-height:' + hauteurMax + 'px;object-fit:contain'
      }));
    }
    // Le logo porte déjà le nom : le répéter à côté le comprime et le coupe.
    var identite = cible.closest ? cible.closest('.identite') : null;
    if (identite) {
      var texte = identite.querySelector('.texte');
      if (texte) texte.style.display = etat.logo ? 'none' : '';
    }
  }

  /* ========================================================= sélecteurs */

  function remplirSelect(noeud, entrees, valeur, options) {
    options = options || {};
    noeud.innerHTML = '';
    if (options.vide) noeud.appendChild(el('option', { value: '', texte: options.vide }));
    entrees.forEach(function (e) {
      noeud.appendChild(el('option', { value: e.valeur, texte: e.libelle }));
    });
    if (valeur !== undefined && valeur !== null) noeud.value = valeur;
  }

  function optionsPays() {
    var l = etat.listes.pays || [];
    var courants = l.filter(function (p) { return p.courant; });
    var autres = l.filter(function (p) { return !p.courant; });
    return courants.concat(autres).map(function (p) {
      return { valeur: p.code, libelle: p.nom + (p.uemoa ? '  · UEMOA' : (p.cedeao ? '  · CEDEAO' : '')) };
    });
  }

  function remplirSelecteurs() {
    remplirSelect($('#d-bureau'), (etat.listes.bureaux || []).map(function (b, i) {
      return { valeur: String(i), libelle: b.nom };
    }), null, { vide: '— choisir —' });

    var regimes = (etat.listes.regimes || []).map(function (r) {
      return { valeur: r.code, libelle: r.code + ' — ' + r.libelle };
    });
    remplirSelect($('#d-regime'), regimes, '4000');

    remplirSelect($('#d-provenance'), optionsPays(), null, { vide: '— choisir —' });
    remplirSelect($('#d-origine'), optionsPays(), null, { vide: '— choisir —' });
    remplirSelect($('#d-regime-origine'), (etat.listes.origines || []).map(function (o) {
      return { valeur: o.code, libelle: o.libelle };
    }), 'TIERS');
    remplirSelect($('#d-mode'), (etat.listes.modes || []).map(function (m) {
      return { valeur: m.code, libelle: m.code + ' — ' + m.libelle };
    }), '1');
    remplirSelect($('#d-nature-colis'), (etat.listes.colis || []).map(function (c) {
      return { valeur: c.code, libelle: c.code + ' — ' + c.libelle };
    }), 'CT');
    remplirSelect($('#d-incoterm'), (etat.listes.incoterms || []).map(function (i) {
      return { valeur: i.code, libelle: i.code + ' — ' + i.libelle };
    }), 'FOB');
    remplirSelect($('#d-devise'), (etat.listes.monnaies || []).map(function (m) {
      return { valeur: m.code, libelle: m.code + ' — ' + m.nom };
    }), 'XOF');
  }

  /* ======================================================== déclaration */

  var CHAMPS_DOSSIER = [
    ['d-date', 'date'], ['d-statut', 'statut'], ['d-reference', 'reference'],
    ['d-bureau-code', 'bureau_code'], ['d-numero-declaration', 'numero_declaration'],
    ['d-bureau-entree', 'bureau_entree'], ['d-lieu-marchandises', 'lieu_marchandises'],
    ['d-importateur-nom', 'importateur_nom'], ['d-importateur-contribuable', 'importateur_contribuable'],
    ['d-importateur-code', 'importateur_code'], ['d-importateur-adresse', 'importateur_adresse'],
    ['d-importateur-telephone', 'importateur_telephone'], ['d-importateur-courriel', 'importateur_courriel'],
    ['d-fournisseur-nom', 'fournisseur_nom'], ['d-fournisseur-adresse', 'fournisseur_adresse'],
    ['d-declarant', 'declarant'], ['d-declarant-agrement', 'declarant_agrement'], ['d-declarant-repere', 'declarant_repere'],
    ['d-provenance', 'provenance'], ['d-origine', 'origine'], ['d-regime-origine', 'regime_origine'],
    ['d-mode', 'mode'], ['d-navire', 'navire'], ['d-voyage', 'voyage'],
    ['d-connaissement', 'connaissement'], ['d-manifeste', 'manifeste'], ['d-date-arrivee', 'date_arrivee'],
    ['d-facture', 'facture'], ['d-date-facture', 'date_facture'],
    ['d-devise', 'devise'], ['d-taux-change', 'taux_change'],
    ['d-incoterm', 'incoterm'], ['d-incoterm-lieu', 'incoterm_lieu'],
    ['d-fret', 'fret'], ['d-assurance', 'assurance'],
    ['d-nb-colis', 'nb_colis'], ['d-nature-colis', 'nature_colis'],
    ['d-marques', 'marques'], ['d-poids-brut-manifeste', 'poids_brut_manifeste'],
    ['d-observations', 'observations']
  ];

  function brancherDeclaration() {
    CHAMPS_DOSSIER.forEach(function (paire) {
      var n = $('#' + paire[0]);
      if (!n) return;
      n.addEventListener('input', function () {
        etat.dossier[paire[1]] = n.value;
        if (paire[1] === 'devise') surChangementDevise();
        if (paire[1] === 'regime_origine') peindreAvisOrigine();
        marquerModifie();
      });
      n.addEventListener('change', function () {
        etat.dossier[paire[1]] = n.value;
        if (paire[1] === 'devise') surChangementDevise();
        marquerModifie();
      });
    });

    $('#d-bureau').addEventListener('change', function () {
      var b = (etat.listes.bureaux || [])[Number(this.value)];
      etat.dossier.bureau_nom = b ? b.nom : '';
      if (b && b.code) { etat.dossier.bureau_code = b.code; $('#d-bureau-code').value = b.code; }
      marquerModifie();
    });
    $('#d-bureau-code').addEventListener('change', memoriserCodeBureau);

    $('#d-regime').addEventListener('change', function () {
      etat.dossier.regime_code = this.value;
      peindreMentionRegime();
      marquerModifie();
    });
    $('#d-incoterm').addEventListener('change', peindreAvisIncoterm);
    $('#btn-nouveau-dossier').addEventListener('click', function () { nouveauDossier(); });
    $('#btn-ajouter-conteneur').addEventListener('click', function () {
      etat.dossier.conteneurs.push({ numero: '', type: '', plomb: '' });
      peindreConteneurs();
      marquerModifie();
    });

    $('#btn-choisir-importateur').addEventListener('click', function () { choisirDansCarnet('importateurs'); });
    $('#btn-choisir-fournisseur').addEventListener('click', function () { choisirDansCarnet('fournisseurs'); });
    $('#btn-enregistrer-importateur').addEventListener('click', enregistrerImportateurAuCarnet);
    $('#btn-enregistrer-fournisseur').addEventListener('click', enregistrerFournisseurAuCarnet);
  }

  /* Le code d'un bureau se saisit une fois puis se retient : c'est le genre
   * de détail qu'on ne veut pas retaper à chaque dossier. */
  function memoriserCodeBureau() {
    var code = this.value.trim();
    var index = Number($('#d-bureau').value);
    var bureaux = etat.listes.bureaux || [];
    if (!code || !bureaux[index] || bureaux[index].code === code) return;
    bureaux[index].code = code;
    BASE.poserListe('bureaux', bureaux).then(function () {
      message('Code bureau mémorisé pour « ' + bureaux[index].nom + ' ».', 'succes');
    });
  }

  function surChangementDevise() {
    var d = etat.dossier;
    var m = (etat.listes.monnaies || []).filter(function (x) { return x.code === d.devise; })[0];
    if (m && m.parite !== null && m.parite !== undefined) {
      d.taux_change = m.parite;
      $('#d-taux-change').value = m.parite;
      $('#d-taux-change').readOnly = true;
    } else {
      $('#d-taux-change').readOnly = false;
      if (nb(d.taux_change) <= 1 && d.devise !== 'XOF') { d.taux_change = ''; $('#d-taux-change').value = ''; }
    }
    peindreAvisDevise();
    peindreArticles();
  }

  function peindreAvisDevise() {
    var z = $('#d-devise-avis');
    z.innerHTML = '';
    var d = etat.dossier;
    var m = (etat.listes.monnaies || []).filter(function (x) { return x.code === d.devise; })[0];
    if (!m) return;
    if (d.devise === 'XOF') return;
    if (m.parite !== null && m.parite !== undefined) {
      z.appendChild(avis('info', 'Parité fixe.',
        '1 ' + m.code + ' = ' + fr(m.parite, 3) + ' XOF. C’est un ancrage légal, pas un cours du jour : ' +
        'il ne bouge pas et ne vient d’aucune source extérieure.'));
    } else {
      z.appendChild(avis(nb(d.taux_change) > 0 ? 'info' : 'attention',
        nb(d.taux_change) > 0 ? 'Taux saisi.' : 'Taux à saisir.',
        'Le ' + m.code + ' n’a pas de parité fixe avec le franc CFA. Reportez le taux retenu par la Douane à la date ' +
        'de la déclaration — l’application n’en invente aucun.'));
    }
  }

  function peindreMentionRegime() {
    var z = $('#d-regime-mention');
    z.innerHTML = '';
    var r = regimeCourant();
    if (!r) return;
    var genre = r.droits ? 'info' : (r.categorie === 'special' || r.categorie === 'reimportation' ? 'attention' : 'attention');
    z.appendChild(avis(genre, r.code + ' — ' + r.libelle + '.', r.mention));
  }

  function peindreAvisOrigine() {
    var z = $('#d-origine-avis');
    z.innerHTML = '';
    var o = (etat.listes.origines || []).filter(function (x) { return x.code === etat.dossier.regime_origine; })[0];
    if (!o || o.code === 'TIERS') return;
    z.appendChild(avis('attention', 'Origine préférentielle.',
      'Elle ne se présume pas : sans « ' + o.preuve + ' » au dossier, la marchandise se liquide au taux plein. ' +
      'L’application n’applique aucune réduction d’office — appliquez-la ligne par ligne dans la colonne « Exo. % » ' +
      'une fois la preuve en main.'));
  }

  function peindreAvisIncoterm() {
    var i = (etat.listes.incoterms || []).filter(function (x) { return x.code === etat.dossier.incoterm; })[0];
    if (!i) return;
    if (i.part_fret === 1) {
      message('Incoterm ' + i.code + ' : le transport principal est déjà dans le prix facturé. Ne saisissez au fret que ce qui reste à votre charge.', 'attention');
    }
  }

  function regimeCourant() {
    return (etat.listes.regimes || []).filter(function (r) { return r.code === etat.dossier.regime_code; })[0];
  }

  function peindreConteneurs() {
    var corps = $('#table-conteneurs tbody');
    corps.innerHTML = '';
    var types = (etat.listes.types_conteneur || []);
    etat.dossier.conteneurs.forEach(function (c, i) {
      var tr = el('tr');
      var tdNum = el('td', {}, [el('input', {
        value: c.numero, placeholder: 'MSCU1234567',
        oninput: function () { c.numero = this.value; marquerModifie(); }
      })]);
      var sel = el('select');
      remplirSelect(sel, types.map(function (t) { return { valeur: t.code, libelle: t.libelle }; }), c.type, { vide: '—' });
      sel.addEventListener('change', function () { c.type = this.value; marquerModifie(); });
      var tdType = el('td', {}, [sel]);
      var tdPlomb = el('td', {}, [el('input', {
        value: c.plomb, oninput: function () { c.plomb = this.value; marquerModifie(); }
      })]);
      var tdSup = el('td', {}, [el('button', {
        class: 'icone danger', title: 'Retirer',
        onclick: function () { etat.dossier.conteneurs.splice(i, 1); peindreConteneurs(); marquerModifie(); }
      }, [icone('poubelle')])]);
      [tdNum, tdType, tdPlomb, tdSup].forEach(function (t) { tr.appendChild(t); });
      corps.appendChild(tr);
    });
    if (etat.dossier.conteneurs.length === 0) {
      corps.appendChild(el('tr', {}, [el('td', {
        colspan: '4', class: 'aide', style: 'padding:12px;color:var(--gris)',
        texte: 'Aucun conteneur. En groupage ou en aérien, cette liste reste vide.'
      })]));
    }
  }

  function peindreDocuments() {
    var z = $('#d-documents');
    z.innerHTML = '';
    (etat.listes.documents || []).forEach(function (doc) {
      var coche = el('input', { type: 'checkbox', style: 'width:auto;margin:0' });
      coche.checked = !!etat.dossier.documents[doc.code];
      coche.addEventListener('change', function () {
        etat.dossier.documents[doc.code] = this.checked;
        marquerModifie();
      });
      var ligne = el('label', {
        style: 'display:flex;align-items:center;gap:9px;font-weight:500;font-size:13px;cursor:pointer;padding:7px 10px;border:1px solid var(--trait);border-radius:8px;background:var(--carte)'
      }, [coche, el('span', { texte: doc.libelle }),
        doc.obligatoire ? el('span', { class: 'etiq bleu', style: 'margin-left:auto', texte: 'usuel' }) : null]);
      z.appendChild(ligne);
    });
  }

  function nouveauDossier(silencieux) {
    if (etat.dossier && !silencieux) enregistrerDossier();
    etat.dossier = dossierVierge();
    peindreDossier();
    if (!silencieux) { message('Nouveau dossier ouvert.', 'succes'); aller('declaration'); }
  }

  function peindreDossier() {
    var d = etat.dossier;
    $('#d-numero').value = d.numero || '';
    $('#declaration-indice').textContent = d.numero ? ('Dossier ' + d.numero) : 'Nouveau dossier — le numéro se pose à la première saisie';
    CHAMPS_DOSSIER.forEach(function (paire) {
      var n = $('#' + paire[0]);
      if (n) n.value = d[paire[1]] === null || d[paire[1]] === undefined ? '' : d[paire[1]];
    });
    var index = (etat.listes.bureaux || []).findIndex(function (b) { return b.nom === d.bureau_nom; });
    $('#d-bureau').value = index >= 0 ? String(index) : '';
    $('#d-regime').value = d.regime_code;
    surChangementDevise();
    peindreMentionRegime();
    peindreAvisOrigine();
    peindreConteneurs();
    peindreDocuments();
    peindreArticles();
    rafraichirPastilles();
  }

  /* ============================================================ articles */

  function brancherArticles() {
    $('#btn-ajouter-article').addEventListener('click', function () {
      etat.dossier.articles.push(articleVierge());
      peindreArticles();
      marquerModifie();
      var lignes = $$('#table-articles tbody tr');
      var derniere = lignes[lignes.length - 1];
      if (derniere) { derniere.scrollIntoView({ block: 'center', behavior: 'smooth' }); var i = derniere.querySelector('input'); if (i) i.focus(); }
    });
    $('#btn-importer-articles').addEventListener('click', importerArticles);
  }

  function peindreArticles() {
    var corps = $('#table-articles tbody');
    corps.innerHTML = '';
    var d = etat.dossier;
    var devise = d.devise || 'XOF';

    d.articles.forEach(function (a, i) {
      var tr = el('tr');
      tr.classList.toggle('attention', !!a.position && !a.verifie_en_base);

      tr.appendChild(el('td', { class: 'num', style: 'color:var(--gris);font-weight:600', texte: String(i + 1) }));
      tr.appendChild(el('td', {}, [construireComboPosition(a, tr)]));
      tr.appendChild(el('td', {}, [champTexte(a, 'designation', 'Désignation commerciale')]));

      var selOrigine = el('select');
      remplirSelect(selOrigine, optionsPays().map(function (o) { return { valeur: o.valeur, libelle: o.valeur }; }), a.origine, { vide: '—' });
      selOrigine.title = 'Pays d’origine de l’article';
      selOrigine.addEventListener('change', function () { a.origine = this.value; marquerModifie(); });
      tr.appendChild(el('td', {}, [selOrigine]));

      tr.appendChild(el('td', {}, [champNombre(a, 'quantite')]));

      var selUnite = el('select');
      remplirSelect(selUnite, (etat.listes.unites || []).map(function (u) { return { valeur: u.code, libelle: u.code }; }), a.unite, { vide: '—' });
      selUnite.addEventListener('change', function () { a.unite = this.value; marquerModifie(); });
      tr.appendChild(el('td', {}, [selUnite]));

      tr.appendChild(el('td', {}, [champNombre(a, 'poids_brut', recalculerTotaux)]));
      tr.appendChild(el('td', {}, [champNombre(a, 'poids_net', recalculerTotaux)]));
      tr.appendChild(el('td', {}, [champNombre(a, 'valeur', recalculerTotaux)]));

      var tdTaux = el('td', {}, [champNombre(a, 'taux_dd_pct', function () {
        a.taux_dd_saisi = true;
        marquerModifie();
      })]);
      tdTaux.firstChild.placeholder = 'à saisir';
      tdTaux.firstChild.title = a.verifie_en_base
        ? 'Taux issu du tarif chargé. Vous pouvez le corriger.'
        : 'Position absente du tarif : aucun taux n’est proposé, saisissez-le.';
      tr.appendChild(tdTaux);

      tr.appendChild(el('td', {}, [champNombre(a, 'exoneration_pct')]));

      tr.appendChild(el('td', {}, [el('button', {
        class: 'icone danger', title: 'Supprimer la ligne',
        onclick: function () {
          if (d.articles.length === 1) { d.articles[0] = articleVierge(); }
          else d.articles.splice(i, 1);
          peindreArticles(); marquerModifie();
        }
      }, [icone('poubelle')])]));

      corps.appendChild(tr);
    });

    $('#articles-indice').textContent = d.articles.length + ' ligne' + (d.articles.length > 1 ? 's' : '') +
      ' · valeurs en ' + devise;
    recalculerTotaux();
    peindreAvisArticles();
    rafraichirPastilles();
  }

  function champTexte(objet, cle, placeholder) {
    return el('input', {
      value: objet[cle] || '', placeholder: placeholder || '',
      oninput: function () { objet[cle] = this.value; marquerModifie(); }
    });
  }

  function champNombre(objet, cle, apres) {
    return el('input', {
      class: 'nombre', inputmode: 'decimal',
      value: objet[cle] === null || objet[cle] === undefined ? '' : objet[cle],
      oninput: function () {
        objet[cle] = this.value;
        if (apres) apres();
        marquerModifie();
      }
    });
  }

  function recalculerTotaux() {
    var d = etat.dossier;
    var pb = 0, pn = 0, v = 0;
    d.articles.forEach(function (a) { pb += nb(a.poids_brut); pn += nb(a.poids_net); v += nb(a.valeur); });
    $('#total-poids-brut').textContent = fr(pb, 2);
    $('#total-poids-net').textContent = fr(pn, 2);
    $('#total-valeur').textContent = fr(v, 2) + ' ' + (d.devise || '');
  }

  function peindreAvisArticles() {
    var z = $('#articles-avis');
    z.innerHTML = '';
    var d = etat.dossier;
    var sansTaux = d.articles.filter(function (a) {
      return (a.designation || a.position) && (a.taux_dd_pct === '' || a.taux_dd_pct === null || a.taux_dd_pct === undefined);
    }).length;
    var horsTarif = d.articles.filter(function (a) { return a.position && !a.verifie_en_base; }).length;
    var sansPoids = d.articles.filter(function (a) { return nb(a.valeur) > 0 && nb(a.poids_brut) <= 0; }).length;

    if (etat.tec.length === 0) {
      z.appendChild(avis('attention', 'Tarif non chargé.',
        'Aucune position n’est disponible à la recherche : les codes et les taux devront être tapés à la main. ' +
        'Réglages → Tarif douanier → Mettre à jour.'));
    }
    if (horsTarif > 0) {
      z.appendChild(avis('attention', horsTarif + ' position' + (horsTarif > 1 ? 's' : '') + ' hors tarif.',
        'Le code saisi n’existe pas dans le tarif chargé. Aucun taux n’est proposé pour ' +
        (horsTarif > 1 ? 'ces lignes' : 'cette ligne') + ' : vérifiez le code, ou saisissez le taux et gardez-le en tête au moment du dépôt.'));
    }
    if (sansTaux > 0) {
      z.appendChild(avis('erreur', sansTaux + ' ligne' + (sansTaux > 1 ? 's' : '') + ' sans taux de droit.',
        'La liquidation ne peut pas aboutir tant qu’un taux manque. Rien ne sera calculé au jugé.'));
    }
    if (sansPoids > 0 && nb(d.fret) > 0) {
      z.appendChild(avis('attention', sansPoids + ' ligne' + (sansPoids > 1 ? 's' : '') + ' sans poids brut.',
        'Le fret se répartit au poids brut. Une ligne sans poids ne recevra aucune part de fret, et sa valeur CAF sera sous-évaluée.'));
    }
  }

  /* -------------------------------------------- recherche de position */

  function construireComboPosition(article, ligne) {
    var enveloppe = el('div', { class: 'combo' });
    var entree = el('input', {
      value: article.position || '',
      placeholder: 'Code ou mot-clé',
      autocomplete: 'off',
      spellcheck: 'false'
    });
    var liste = el('div', { class: 'liste masquee' });
    enveloppe.appendChild(entree);
    enveloppe.appendChild(liste);

    var indexSurvol = -1;
    var resultats = [];

    function fermer() { liste.classList.add('masquee'); indexSurvol = -1; }

    function normaliserCode(brut) {
      var chiffres = String(brut).replace(/[^0-9]/g, '');
      if (chiffres.length === 10) {
        return chiffres.slice(0, 4) + '.' + chiffres.slice(4, 6) + '.' + chiffres.slice(6, 8) + '.' + chiffres.slice(8, 10);
      }
      return null;
    }

    function appliquer(position) {
      article.position = position.code;
      article.designation_tec = position.designation;
      article.verifie_en_base = !position.personnel ? true : true;
      article.personnel = !!position.personnel;
      article.taux_dd_saisi = false;
      if (position.taux_dd !== null && position.taux_dd !== undefined) {
        article.taux_dd_pct = Math.round(position.taux_dd * 10000) / 100;
      }
      if (position.unite && !article.unite) article.unite = position.unite;
      if (!article.designation) article.designation = position.designation;
      entree.value = position.code;
      fermer();
      peindreArticles();
      marquerModifie();
    }

    function chercher(texte) {
      var q = texte.trim().toLowerCase();
      resultats = [];
      if (q.length < 2) { fermer(); return; }

      var perso = etat.tauxPersonnels.filter(function (t) {
        return (t.code + ' ' + (t.designation || '')).toLowerCase().indexOf(q) >= 0;
      }).map(function (t) {
        return { code: t.code, designation: t.designation, taux_dd: t.taux_dd, unite: t.unite, personnel: true };
      });

      var chiffres = q.replace(/[^0-9]/g, '');
      var parCode = [];
      var parMot = [];
      if (chiffres.length >= 3) {
        parCode = etat.tec.filter(function (p) { return p.code.replace(/\./g, '').indexOf(chiffres) === 0; });
      }
      if (parCode.length < 40) {
        var mots = q.split(/\s+/).filter(function (m) { return m.length > 1; });
        if (mots.length) {
          parMot = etat.tec.filter(function (p) {
            if (parCode.indexOf(p) >= 0) return false;
            for (var i = 0; i < mots.length; i++) if (p.recherche.indexOf(mots[i]) < 0) return false;
            return true;
          });
        }
      }
      resultats = perso.concat(parCode, parMot).slice(0, 60);
      peindreResultats(q);
    }

    function peindreResultats(q) {
      liste.innerHTML = '';
      if (resultats.length === 0) {
        var codeNormalise = normaliserCode(q);
        liste.appendChild(el('div', { class: 'rien' }, [
          el('div', { texte: 'Aucune position ne correspond.' }),
          el('div', {
            style: 'margin-top:6px;font-size:12px',
            texte: codeNormalise
              ? 'Le code ' + codeNormalise + ' sera retenu tel quel, sans taux. À vous de saisir le taux.'
              : 'Vous pouvez écrire directement le code : il sera retenu tel quel, sans taux.'
          })
        ]));
        liste.classList.remove('masquee');
        return;
      }
      resultats.forEach(function (p, i) {
        var item = el('div', { class: 'item' + (i === indexSurvol ? ' survol' : '') }, [
          el('span', { class: 'code', texte: p.code }),
          el('span', { class: 'lib', texte: (p.designation || '').slice(0, 110) }),
          p.personnel ? el('span', { class: 'etiq ambre', texte: 'personnel' }) : null,
          el('span', {
            class: 'taux',
            texte: (p.taux_dd === null || p.taux_dd === undefined) ? '—' : (fr(p.taux_dd * 100, 0) + ' %')
          })
        ]);
        item.addEventListener('mousedown', function (e) { e.preventDefault(); appliquer(p); });
        liste.appendChild(item);
      });
      liste.classList.remove('masquee');
    }

    entree.addEventListener('input', function () {
      article.position = this.value;
      article.verifie_en_base = false;
      article.designation_tec = '';
      chercher(this.value);
      marquerModifie();
    });
    entree.addEventListener('focus', function () { if (this.value.trim().length >= 2) chercher(this.value); });
    entree.addEventListener('blur', function () {
      setTimeout(function () {
        fermer();
        // À la sortie du champ, on range le code au format tarifaire et on
        // regarde une dernière fois s'il existe.
        var normalise = normaliserCode(entree.value);
        if (normalise) {
          var trouve = etat.tec.filter(function (p) { return p.code === normalise; })[0];
          if (trouve) { appliquer(trouve); return; }
          article.position = normalise;
          entree.value = normalise;
          peindreArticles();
        }
        if (ligne) ligne.classList.toggle('attention', !!article.position && !article.verifie_en_base);
      }, 140);
    });
    function deplacerSurvol(pas) {
      indexSurvol = Math.min(Math.max(indexSurvol + pas, 0), resultats.length - 1);
      peindreResultats(entree.value);
      var item = liste.children[indexSurvol];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }

    entree.addEventListener('keydown', function (e) {
      if (liste.classList.contains('masquee')) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); deplacerSurvol(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); deplacerSurvol(-1); }
      else if (e.key === 'Enter' && indexSurvol >= 0) { e.preventDefault(); appliquer(resultats[indexSurvol]); }
    });

    return enveloppe;
  }

  function fermerListesCombo() {
    $$('.combo .liste').forEach(function (l) { l.classList.add('masquee'); });
  }

  function importerArticles() {
    var corps = el('div');
    corps.appendChild(el('p', { class: 'aide', texte:
      'Collez ici les lignes de la facture ou du colisage, une par ligne, colonnes séparées par une tabulation ' +
      'ou un point-virgule. Ordre attendu : position ; désignation ; quantité ; unité ; poids brut ; poids net ; valeur.' }));
    var zone = el('textarea', { rows: '10', style: 'margin-top:10px', placeholder: '8517.62.00.00\tRouteur wifi\t50\tu\t120\t100\t2500000' });
    corps.appendChild(zone);
    modale('Importer des articles', corps, [
      { libelle: 'Annuler', action: fermerModale },
      { libelle: 'Importer', genre: 'primaire', action: function () {
        var lignes = zone.value.split(/\r?\n/).filter(function (l) { return l.trim(); });
        if (!lignes.length) { message('Rien à importer.', 'attention'); return; }
        var ajoutes = 0;
        lignes.forEach(function (l) {
          var c = l.split(/\t|;/).map(function (x) { return x.trim(); });
          var a = articleVierge();
          a.position = c[0] || '';
          a.designation = c[1] || '';
          a.quantite = c[2] || '';
          a.unite = c[3] || '';
          a.poids_brut = c[4] || '';
          a.poids_net = c[5] || '';
          a.valeur = c[6] || '';
          var chiffres = a.position.replace(/[^0-9]/g, '');
          if (chiffres.length === 10) {
            a.position = chiffres.slice(0, 4) + '.' + chiffres.slice(4, 6) + '.' + chiffres.slice(6, 8) + '.' + chiffres.slice(8, 10);
          }
          var trouve = etat.tec.filter(function (p) { return p.code === a.position; })[0];
          if (trouve) {
            a.verifie_en_base = true;
            a.designation_tec = trouve.designation;
            if (trouve.taux_dd !== null) a.taux_dd_pct = Math.round(trouve.taux_dd * 10000) / 100;
            if (!a.unite) a.unite = trouve.unite;
          }
          etat.dossier.articles.push(a);
          ajoutes++;
        });
        etat.dossier.articles = etat.dossier.articles.filter(function (a, i) {
          return a.designation || a.position || nb(a.valeur) || i === 0;
        });
        fermerModale();
        peindreArticles();
        marquerModifie();
        message(ajoutes + ' ligne' + (ajoutes > 1 ? 's importées' : ' importée') + '.', 'succes');
      } }
    ]);
  }

  /* ========================================================= liquidation */

  function preparerLiquidation() {
    var d = etat.dossier;
    var taux = d.devise === 'XOF' ? 1 : nb(d.taux_change);
    if (d.devise !== 'XOF' && taux <= 0) {
      throw new L.Refus('Le taux de change vers le franc CFA n’est pas renseigné. Sans lui, aucune conversion n’est possible.');
    }
    var regime = regimeCourant();
    if (!regime) throw new L.Refus('Aucun régime douanier choisi.');

    var lignes = d.articles
      .filter(function (a) { return a.designation || a.position || nb(a.valeur) > 0; })
      .map(function (a, i) {
        var pct = a.taux_dd_pct;
        return {
          numero: i + 1,
          designation: a.designation || a.designation_tec || ('Article ' + (i + 1)),
          position: a.position,
          designation_tec: a.designation_tec,
          unite: a.unite,
          origine: a.origine || d.origine,
          quantite: nb(a.quantite),
          verifie_en_base: !!a.verifie_en_base,
          taux_dd_saisi: !!a.taux_dd_saisi,
          taux_dd: (pct === '' || pct === null || pct === undefined) ? null : nb(pct) / 100,
          exoneration: nb(a.exoneration_pct) / 100,
          fob_xof: nb(a.valeur) * taux,
          poids_brut_kg: nb(a.poids_brut)
        };
      });

    return L.liquider({
      regime: regime,
      taxes: etat.listes.taxes || [],
      fret_xof: nb(d.fret) * taux,
      assurance_xof: nb(d.assurance), // jamais convertie
      lignes: lignes
    });
  }

  function peindreLiquidation() {
    var zAvis = $('#liquidation-avis');
    var z = $('#liquidation-contenu');
    zAvis.innerHTML = '';
    z.innerHTML = '';

    var liq;
    try { liq = preparerLiquidation(); }
    catch (e) {
      zAvis.appendChild(avis('erreur', 'Liquidation impossible.', e.message));
      zAvis.appendChild(el('div', { style: 'margin-top:12px' }, [
        el('button', { class: 'b primaire', onclick: function () { aller('articles'); }, texte: 'Aller aux articles' })
      ]));
      etat.dossier.liquidation = null;
      return;
    }

    etat.dossier.liquidation = liq;
    var chiffrage = L.devis(liq, etat.dossier.postes_devis, { taux_tva_honoraires: etat.tvaHonoraires });
    etat.dossier.chiffrage = chiffrage;
    marquerModifie();

    var regime = liq.regime;
    if (regime.mention) zAvis.appendChild(avis(regime.droits ? 'info' : 'attention', regime.code + ' — ' + regime.libelle + '.', regime.mention));
    var horsTarif = liq.lignes.filter(function (l) { return !l.verifie_en_base; });
    if (horsTarif.length) {
      zAvis.appendChild(avis('attention', horsTarif.length + ' position' + (horsTarif.length > 1 ? 's' : '') + ' hors tarif chargé.',
        'Le taux a été saisi à la main pour ' + horsTarif.map(function (l) { return l.position || l.designation; }).join(', ') +
        '. À confirmer avant le dépôt de la déclaration.'));
    }

    // Total en vedette.
    var vedette = el('div', { class: 'total-vedette monte' });
    vedette.appendChild(el('div', { class: 'etiquette', texte: 'Total à régler par le client' }));
    var montant = el('div', { class: 'montant chiffre' }, [el('span', { texte: '0' }), el('span', { class: 'devise', texte: 'XOF' })]);
    vedette.appendChild(montant);
    compter(montant.firstChild, chiffrage.total_xof, 0);

    var repartition = el('div', { class: 'repartition' });
    [['Droits et taxes', chiffrage.droits_et_taxes_xof],
     ['Honoraires', chiffrage.honoraires_xof + chiffrage.tva_honoraires_xof],
     ['Débours', chiffrage.debours_xof],
     ['Valeur CAF', liq.globaux.caf_total_xof]].forEach(function (p) {
      repartition.appendChild(el('div', {}, [
        el('div', { class: 'cle', texte: p[0] }),
        el('div', { class: 'val chiffre', texte: fr(p[1]) })
      ]));
    });
    vedette.appendChild(repartition);

    var jauge = el('div', { class: 'jauge' });
    var total = Math.max(chiffrage.total_xof, 1);
    [[chiffrage.droits_et_taxes_xof, '#4fa3f0'],
     [chiffrage.honoraires_xof + chiffrage.tva_honoraires_xof, '#7bd0a5'],
     [chiffrage.debours_xof, '#e0a02c']].forEach(function (p) {
      var i = el('i', { style: 'width:0;background:' + p[1] });
      jauge.appendChild(i);
      setTimeout(function () { i.style.width = (p[0] / total * 100) + '%'; }, 60);
    });
    vedette.appendChild(jauge);
    z.appendChild(vedette);

    // Valeur en douane.
    var g = liq.globaux;
    var carteValeur = carte('Valeur en douane', 'Assiette de tous les calculs qui suivent');
    var grille = el('div', { class: 'grille quatre echelonne' });
    [['Valeur FOB', g.fob_total_xof, 'billet'],
     ['Fret', g.fret_total_xof, 'navire'],
     ['Assurance', g.assurance_total_xof, 'dossier'],
     ['Valeur CAF', g.caf_total_xof, 'balance']].forEach(function (v) {
      var vg = el('div', { class: 'vignette' }, [
        icone(v[2], 'glyphe'),
        el('div', { class: 'etiquette', texte: v[0] }),
        el('div', { class: 'valeur chiffre' }, [el('span', { texte: '0' }), el('span', { class: 'unite', texte: 'XOF' })])
      ]);
      grille.appendChild(vg);
      compter(vg.querySelector('.valeur span'), v[1], 0);
      setTimeout(function () { vg.classList.add('animee'); }, 200);
    });
    carteValeur.corps.appendChild(grille);
    carteValeur.corps.appendChild(el('p', { class: 'aide', style: 'margin-top:14px', texte:
      'Poids brut total ' + fr(g.poids_brut_total_kg, 2) + ' kg réparti sur ' + g.nombre_lignes + ' ligne' +
      (g.nombre_lignes > 1 ? 's' : '') + '. Le fret est réparti au poids brut, l’assurance à la valeur FOB. ' +
      'La prime d’assurance est prise en francs CFA sans conversion.' }));
    z.appendChild(carteValeur.noeud);

    // Détail par article.
    var carteLignes = carte('Détail par article', liq.lignes.length + ' ligne' + (liq.lignes.length > 1 ? 's' : ''));
    carteLignes.corps.className = 'corps serre';
    var cadre = el('div', { class: 'tableau-cadre' });
    var codes = ['DD', 'RST', 'PCS', 'PUA', 'PCC', 'TVA'];
    var table = el('table', { class: 't' });
    var thead = el('thead');
    var trh = el('tr');
    ['N°', 'Position', 'Désignation', 'Poids br.', 'Part fret', 'CAF', 'DD %'].forEach(function (t, i) {
      trh.appendChild(el('th', { class: i >= 3 ? 'num' : '', texte: t }));
    });
    codes.forEach(function (c) { trh.appendChild(el('th', { class: 'num', texte: c })); });
    trh.appendChild(el('th', { class: 'num', texte: 'Total ligne' }));
    thead.appendChild(trh);
    table.appendChild(thead);

    var tbody = el('tbody');
    liq.lignes.forEach(function (l) {
      var tr = el('tr', { class: l.verifie_en_base ? '' : 'attention' });
      tr.appendChild(el('td', { class: 'num', texte: String(l.numero) }));
      tr.appendChild(el('td', {}, [
        el('div', { style: 'font-weight:600;font-variant-numeric:tabular-nums', texte: l.position || '—' }),
        l.verifie_en_base ? null : el('span', { class: 'etiq ambre', texte: 'hors tarif' })
      ]));
      tr.appendChild(el('td', {}, [
        el('div', { texte: l.designation }),
        l.designation_tec ? el('div', { style: 'font-size:11.5px;color:var(--gris)', texte: l.designation_tec.slice(0, 70) }) : null
      ]));
      tr.appendChild(el('td', { class: 'num', texte: fr(l.poids_brut_kg, 2) }));
      tr.appendChild(el('td', { class: 'num', texte: fr(l.part_fret * 100, 1) + ' %' }));
      tr.appendChild(el('td', { class: 'num', texte: fr(l.caf_xof) }));
      tr.appendChild(el('td', { class: 'num' }, [
        el('span', { texte: fr(l.taux_dd_applique * 100, 1) }),
        l.exoneration > 0 ? el('div', { style: 'font-size:11px;color:var(--vert)', texte: '−' + fr(l.exoneration * 100, 0) + ' % exo.' }) : null
      ]));
      var totalLigne = 0;
      codes.forEach(function (c) {
        var t = l.taxes.filter(function (x) { return x.code === c; })[0];
        var m = t ? t.montant_xof : 0;
        totalLigne += m;
        tr.appendChild(el('td', { class: 'num', texte: fr(m) }));
      });
      tr.appendChild(el('td', { class: 'num', style: 'font-weight:700', texte: fr(totalLigne) }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    var tfoot = el('tfoot');
    var trf = el('tr');
    trf.appendChild(el('td', { colspan: '5', texte: 'Totaux' }));
    trf.appendChild(el('td', { class: 'num', texte: fr(liq.globaux.caf_total_xof) }));
    trf.appendChild(el('td', {}));
    var totalLignes = 0;
    codes.forEach(function (c) {
      totalLignes += liq.totaux_taxes[c] || 0;
      trf.appendChild(el('td', { class: 'num', texte: fr(liq.totaux_taxes[c] || 0) }));
    });
    trf.appendChild(el('td', { class: 'num', texte: fr(totalLignes) }));
    tfoot.appendChild(trf);
    table.appendChild(tfoot);
    cadre.appendChild(table);
    carteLignes.corps.appendChild(cadre);
    z.appendChild(carteLignes.noeud);

    // Récapitulatif des taxes.
    var carteRecap = carte('Récapitulatif des droits et taxes', 'Ce qui sera versé à la Douane');
    var libelles = {};
    (etat.listes.taxes || []).forEach(function (t) { libelles[t.code] = t.libelle; });
    var tRecap = el('table', { class: 't' });
    var corpsRecap = el('tbody');
    Object.keys(liq.totaux_taxes).forEach(function (code) {
      var m = liq.totaux_taxes[code];
      var t = (etat.listes.taxes || []).filter(function (x) { return x.code === code; })[0] || {};
      var assiette = t.niveau === 'declaration'
        ? (code === 'RPI' ? 'FOB total × 0,75 %, plancher 100 000 — une fois par déclaration'
                          : 'Forfait, une fois par déclaration')
        : (t.assiette === 'base_tva' ? 'CAF + DD + RST' : 'Valeur CAF');
      var tr = el('tr');
      tr.appendChild(el('td', { style: 'width:90px;font-weight:700', texte: code }));
      tr.appendChild(el('td', {}, [
        el('div', { texte: libelles[code] || '' }),
        el('div', { style: 'font-size:11.5px;color:var(--gris)', texte: assiette })
      ]));
      tr.appendChild(el('td', { class: 'num', style: 'width:120px', texte: t.taux ? fr(t.taux * 100, t.taux < 0.01 ? 2 : 1) + ' %' : (t.fixe ? 'forfait' : 'tarif') }));
      tr.appendChild(el('td', { class: 'num', style: 'width:150px;font-weight:650', texte: fr(m) }));
      corpsRecap.appendChild(tr);
    });
    tRecap.appendChild(corpsRecap);
    var pied = el('tfoot', {}, [el('tr', {}, [
      el('td', { colspan: '3', texte: 'Total des droits et taxes' }),
      el('td', { class: 'num', texte: fr(liq.total_a_payer_xof) + ' XOF' })
    ])]);
    tRecap.appendChild(pied);
    carteRecap.corps.className = 'corps serre';
    carteRecap.corps.appendChild(el('div', { class: 'tableau-cadre' }, [tRecap]));
    z.appendChild(carteRecap.noeud);

    // Devis.
    z.appendChild(construireDevis(liq, chiffrage));

    // Bloc d'impression : ce que le rail et la barre cachent à l'écran.
    var pied2 = el('div', { class: 'impression-seule', style: 'margin-top:14px;font-size:10px;color:#6b7684' });
    pied2.textContent = (etat.societe.nom || 'E-TRANSIT') + ' — dossier ' + (etat.dossier.numero || '—') +
      ' — établi le ' + new Date().toLocaleDateString('fr-FR') + ' — By Dems’Inc, Demsy Landry';
    z.appendChild(pied2);
  }

  function carte(titre, indice) {
    var corps = el('div', { class: 'corps' });
    var entete = el('header', {}, [el('h3', { texte: titre })]);
    if (indice) entete.appendChild(el('span', { class: 'indice', texte: indice }));
    var noeud = el('div', { class: 'carte' }, [entete, corps]);
    return { noeud: noeud, corps: corps, entete: entete };
  }

  function construireDevis(liq, chiffrage) {
    var c = carte('Devis client', 'Honoraires et débours d’E-Transit');
    var d = etat.dossier;

    var cadre = el('div', { class: 'tableau-cadre' });
    var table = el('table', { class: 't' });
    table.appendChild(el('thead', {}, [el('tr', {}, [
      el('th', { texte: 'Intitulé' }),
      el('th', { style: 'width:150px', texte: 'Nature' }),
      el('th', { class: 'num', style: 'width:160px', texte: 'Montant XOF' }),
      el('th', { style: 'width:40px' })
    ])]));
    var corps = el('tbody');

    d.postes_devis.forEach(function (p, i) {
      var tr = el('tr');
      tr.appendChild(el('td', {}, [el('input', {
        value: p.libelle || '', placeholder: 'Intitulé de la prestation',
        oninput: function () { p.libelle = this.value; marquerModifie(); }
      })]));
      var sel = el('select');
      remplirSelect(sel, [
        { valeur: 'honoraire', libelle: 'Honoraires · TVA' },
        { valeur: 'debours', libelle: 'Débours · hors TVA' }
      ], p.nature || 'debours');
      sel.addEventListener('change', function () { p.nature = this.value; marquerModifie(); peindreLiquidation(); });
      tr.appendChild(el('td', {}, [sel]));
      tr.appendChild(el('td', { class: 'num' }, [el('input', {
        class: 'nombre', inputmode: 'decimal', value: p.montant_xof === 0 ? '' : (p.montant_xof || ''),
        placeholder: '0',
        oninput: function () { p.montant_xof = nb(this.value); marquerModifie(); },
        onchange: function () { peindreLiquidation(); }
      })]));
      tr.appendChild(el('td', {}, [el('button', {
        class: 'icone danger', onclick: function () { d.postes_devis.splice(i, 1); marquerModifie(); peindreLiquidation(); }
      }, [icone('poubelle')])]));
      corps.appendChild(tr);
    });
    table.appendChild(corps);
    cadre.appendChild(table);
    c.corps.appendChild(cadre);

    var barre = el('div', { class: 'sans-impression', style: 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap' });
    barre.appendChild(el('button', { class: 'b petit', onclick: function () {
      d.postes_devis.push({ libelle: '', nature: 'debours', montant_xof: 0 });
      peindreLiquidation();
    } }, [icone('plus'), document.createTextNode('Ajouter une ligne')]));
    (etat.listes.postes_devis || []).forEach(function (modele) {
      if (d.postes_devis.some(function (p) { return p.libelle === modele.libelle; })) return;
      barre.appendChild(el('button', {
        class: 'b petit discret', texte: '+ ' + modele.libelle,
        onclick: function () {
          d.postes_devis.push({ libelle: modele.libelle, nature: modele.nature, montant_xof: 0 });
          peindreLiquidation();
        }
      }));
    });
    c.corps.appendChild(barre);

    var recap = el('div', { style: 'margin-top:18px;border-top:1px solid var(--trait);padding-top:14px' });
    function ligneRecap(libelle, montant, gras) {
      return el('div', {
        style: 'display:flex;justify-content:space-between;padding:5px 0;' + (gras ? 'font-weight:700;font-size:16px;border-top:1px solid var(--trait);margin-top:8px;padding-top:12px' : '')
      }, [
        el('span', { texte: libelle }),
        el('span', { class: 'chiffre', texte: fr(montant) + ' XOF' })
      ]);
    }
    recap.appendChild(ligneRecap('Droits et taxes dus à la Douane', chiffrage.droits_et_taxes_xof));
    recap.appendChild(ligneRecap('Honoraires', chiffrage.honoraires_xof));
    recap.appendChild(ligneRecap('TVA sur honoraires (' + fr(chiffrage.taux_tva_honoraires * 100, 0) + ' %)', chiffrage.tva_honoraires_xof));
    recap.appendChild(ligneRecap('Débours', chiffrage.debours_xof));
    recap.appendChild(ligneRecap('TOTAL À RÉGLER', chiffrage.total_xof, true));
    c.corps.appendChild(recap);

    c.corps.appendChild(el('p', { class: 'aide', style: 'margin-top:12px', texte:
      'La TVA ne frappe que la prestation d’E-Transit. Les débours sont des sommes avancées pour le compte du ' +
      'client et refacturées à l’identique sur justificatifs : les soumettre à la TVA reviendrait à taxer deux fois.' }));

    if (etat.conditions) {
      c.corps.appendChild(el('div', { style: 'margin-top:14px;padding:12px;background:var(--carte-douce);border-radius:8px;font-size:12.5px;color:var(--encre-douce)' }, [
        el('strong', { texte: 'Conditions — ' }), document.createTextNode(etat.conditions),
        etat.validite ? el('div', { style: 'margin-top:6px;font-weight:600', texte: 'Validité : ' + etat.validite + ' jours.' }) : null
      ]));
    }
    return c.noeud;
  }

  function sortirPdf(genre) {
    var d = etat.dossier;
    if (!d.liquidation) { message('Rien à éditer : la liquidation n’a pas abouti.', 'erreur'); return; }
    var regime = regimeCourant() || {};
    var contexte = {
      societe: etat.societe,
      logo: etat.logo,
      logo_ratio: etat.logoRatio,
      taxes: etat.listes.taxes,
      conditions: etat.conditions,
      validite_jours: etat.validite
    };
    var infos = Object.assign({}, d, {
      regime_libelle: regime.libelle || '',
      bureau_nom: d.bureau_nom,
      mode_libelle: ((etat.listes.modes || []).filter(function (m) { return m.code === d.mode; })[0] || {}).libelle || '',
      provenance_nom: nomPays(d.provenance),
      origine_nom: nomPays(d.origine)
    });
    try {
      var r = genre === 'devis'
        ? PDF.devis(infos, d.liquidation, d.chiffrage, contexte)
        : PDF.note(infos, d.liquidation, contexte);
      r.doc.save(r.nom);
      message(r.nom + ' généré.', 'succes');
    } catch (e) {
      message('Génération du PDF impossible : ' + e.message, 'erreur');
    }
  }

  function nomPays(code) {
    var p = (etat.listes.pays || []).filter(function (x) { return x.code === code; })[0];
    return p ? p.nom : (code || '');
  }

  /* ======================================================= tableau de bord */

  function peindreBord() {
    BASE.tout('dossiers').then(function (dossiers) {
      var z = $('#vignettes-bord');
      z.innerHTML = '';
      var moisCourant = new Date().toISOString().slice(0, 7);
      var duMois = dossiers.filter(function (d) { return (d.date || d.date_creation || '').slice(0, 7) === moisCourant; });
      var cafMois = duMois.reduce(function (s, d) { return s + ((d.liquidation && d.liquidation.globaux.caf_total_xof) || 0); }, 0);
      var taxesMois = duMois.reduce(function (s, d) { return s + ((d.liquidation && d.liquidation.total_a_payer_xof) || 0); }, 0);
      var enCours = dossiers.filter(function (d) { return d.statut === 'brouillon' || d.statut === 'devis_envoye'; }).length;

      [['Dossiers ce mois', duMois.length, 0, '', 'dossier', dossiers.length + ' au total'],
       ['Valeur CAF traitée', cafMois, 0, ' XOF', 'balance', 'sur le mois en cours'],
       ['Droits et taxes chiffrés', taxesMois, 0, ' XOF', 'billet', 'sur le mois en cours'],
       ['Dossiers en cours', enCours, 0, '', 'navire', 'brouillons et devis envoyés']
      ].forEach(function (v) {
        var vg = el('div', { class: 'vignette' }, [
          icone(v[4], 'glyphe'),
          el('div', { class: 'etiquette', texte: v[0] }),
          el('div', { class: 'valeur chiffre' }, [el('span', { texte: '0' })]),
          el('div', { class: 'detail', texte: v[5] })
        ]);
        z.appendChild(vg);
        compter(vg.querySelector('.valeur span'), v[1], v[2], v[3]);
        setTimeout(function () { vg.classList.add('animee'); }, 180);
      });

      var recents = dossiers.slice().sort(function (a, b) {
        return (b.date_modification || '').localeCompare(a.date_modification || '');
      }).slice(0, 8);
      peindreListeDossiers($('#bord-recents'), recents, true);
      peindreEtatApplication(dossiers);
    });
  }

  function peindreEtatApplication(dossiers) {
    var z = $('#bord-etat');
    z.innerHTML = '';
    if (etat.tec.length === 0) {
      z.appendChild(avis('attention', 'Tarif douanier non chargé.',
        'Les positions ne peuvent pas être recherchées et aucun taux ne sera proposé. ' +
        'Un clic sur « Mettre à jour » dans les Réglages suffit — ensuite l’application fonctionne hors ligne.'));
    } else {
      z.appendChild(avis('succes', fr(etat.tec.length) + ' positions tarifaires en base.',
        'Chargées le ' + frDate(etat.tecChargeLe) + '. L’application fonctionne sans réseau.'));
    }
    if (!etat.logo) {
      z.appendChild(avis('info', 'Logo non installé.',
        'Le logo E-Transit n’a pas pu être retrouvé automatiquement. Déposez le fichier dans les Réglages : ' +
        'il apparaîtra aussitôt à l’écran, sur les devis et sur les impressions.'));
    }
    if (!etat.societe.contribuable || !etat.societe.telephone) {
      z.appendChild(avis('info', 'Identité de la société à compléter.',
        'Numéro de contribuable, RCCM, téléphone : ces mentions figurent sur les devis remis aux clients.'));
    }
    var sansSauvegarde = dossiers.length >= 5;
    if (sansSauvegarde) {
      z.appendChild(avis('info', 'Pensez à la sauvegarde.',
        dossiers.length + ' dossiers vivent dans le navigateur de ce poste. Une sauvegarde par semaine, ' +
        'et rien ne peut être perdu.'));
    }
  }

  function peindreListeDossiers(cible, dossiers, compact) {
    cible.innerHTML = '';
    if (!dossiers.length) {
      cible.appendChild(el('div', { class: 'vide' }, [
        icone('dossier'),
        el('div', { class: 'titre', texte: 'Aucun dossier' }),
        el('div', { texte: 'Les cotations établies apparaîtront ici.' })
      ]));
      return;
    }
    var STATUTS = {
      brouillon: ['gris', 'Brouillon'], devis_envoye: ['bleu', 'Devis envoyé'],
      accepte: ['vert', 'Accepté'], declare: ['vert', 'Déclaré'],
      clos: ['gris', 'Clos'], abandonne: ['rouge', 'Abandonné']
    };
    var table = el('table', { class: 't' });
    var thead = el('thead', {}, [el('tr', {}, [
      el('th', { texte: 'Dossier' }),
      el('th', { texte: 'Client' }),
      compact ? null : el('th', { texte: 'Régime' }),
      compact ? null : el('th', { texte: 'Transport' }),
      el('th', { class: 'num', texte: 'Total XOF' }),
      el('th', { texte: 'Statut' }),
      compact ? null : el('th', { style: 'width:110px' })
    ].filter(Boolean))]);
    table.appendChild(thead);
    var corps = el('tbody');
    dossiers.forEach(function (d) {
      var s = STATUTS[d.statut] || ['gris', d.statut];
      var tr = el('tr', { class: 'cliquable' });
      tr.addEventListener('click', function (e) { if (e.target.closest('button')) return; ouvrirDossier(d.id); });
      tr.appendChild(el('td', {}, [
        el('div', { style: 'font-weight:650', texte: d.numero || '—' }),
        el('div', { style: 'font-size:11.5px;color:var(--gris)', texte: frDate(d.date || d.date_creation) })
      ]));
      tr.appendChild(el('td', {}, [
        el('div', { texte: d.importateur_nom || '—' }),
        d.reference ? el('div', { style: 'font-size:11.5px;color:var(--gris)', texte: d.reference }) : null
      ]));
      if (!compact) {
        tr.appendChild(el('td', { texte: d.regime_code || '—' }));
        tr.appendChild(el('td', {}, [
          el('div', { texte: d.navire || '—' }),
          d.connaissement ? el('div', { style: 'font-size:11.5px;color:var(--gris)', texte: d.connaissement }) : null
        ]));
      }
      tr.appendChild(el('td', { class: 'num', style: 'font-weight:650', texte: d.chiffrage ? fr(d.chiffrage.total_xof) : '—' }));
      tr.appendChild(el('td', {}, [el('span', { class: 'etiq ' + s[0], texte: s[1] })]));
      if (!compact) {
        tr.appendChild(el('td', {}, [
          el('button', { class: 'icone', title: 'Dupliquer', onclick: function () { dupliquerDossier(d); } }, [icone('copie')]),
          el('button', { class: 'icone danger', title: 'Supprimer', onclick: function () { supprimerDossier(d); } }, [icone('poubelle')])
        ]));
      }
      corps.appendChild(tr);
    });
    table.appendChild(corps);
    cible.appendChild(el('div', { class: 'tableau-cadre' }, [table]));
  }

  function ouvrirDossier(id) {
    enregistrerDossier().then(function () { return BASE.lire('dossiers', id); }).then(function (d) {
      if (!d) return;
      etat.dossier = d;
      if (!d.articles || !d.articles.length) d.articles = [articleVierge()];
      if (!d.postes_devis) d.postes_devis = [];
      if (!d.conteneurs) d.conteneurs = [];
      if (!d.documents) d.documents = {};
      peindreDossier();
      aller('declaration');
      message('Dossier ' + (d.numero || '') + ' ouvert.', 'succes');
    });
  }

  function dupliquerDossier(source) {
    BASE.numeroSuivant().then(function (n) {
      var copie = JSON.parse(JSON.stringify(source));
      copie.id = BASE.identifiant();
      copie.numero = n;
      copie.statut = 'brouillon';
      copie.date = aujourdhui();
      copie.date_creation = new Date().toISOString();
      copie.date_modification = copie.date_creation;
      copie.numero_declaration = '';
      return BASE.ecrire('dossiers', copie).then(function () { return copie; });
    }).then(function (copie) {
      message('Dossier dupliqué sous le numéro ' + copie.numero + '.', 'succes');
      peindreHistorique();
      rafraichirPastilles();
    });
  }

  function supprimerDossier(d) {
    confirmer('Supprimer le dossier ' + (d.numero || '') + ' ?',
      'Le dossier et sa liquidation seront effacés. Cette action ne se défait pas.',
      'Supprimer').then(function (ok) {
      if (!ok) return;
      BASE.supprimer('dossiers', d.id).then(function () {
        message('Dossier supprimé.', 'succes');
        peindreHistorique();
        rafraichirPastilles();
      });
    });
  }

  /* ========================================================== historique */

  function brancherHistorique() {
    $('#historique-recherche').addEventListener('input', peindreHistorique);
    $('#historique-statut').addEventListener('change', peindreHistorique);
    $('#btn-exporter-historique').addEventListener('click', function () {
      BASE.tout('dossiers').then(function (d) {
        telecharger('historique-e-transit-' + aujourdhui() + '.json', JSON.stringify(d, null, 2));
        message(d.length + ' dossiers exportés.', 'succes');
      });
    });
  }

  function peindreHistorique() {
    var q = $('#historique-recherche').value.trim().toLowerCase();
    var statut = $('#historique-statut').value;
    BASE.tout('dossiers').then(function (dossiers) {
      var filtres = dossiers.filter(function (d) {
        if (statut && d.statut !== statut) return false;
        if (!q) return true;
        return [d.numero, d.importateur_nom, d.fournisseur_nom, d.navire, d.connaissement,
          d.reference, d.facture, d.numero_declaration]
          .filter(Boolean).join(' ').toLowerCase().indexOf(q) >= 0;
      }).sort(function (a, b) { return (b.date_modification || '').localeCompare(a.date_modification || ''); });
      peindreListeDossiers($('#historique-liste'), filtres, false);
    });
  }

  /* =============================================================== carnet */

  var CHAMPS_CARNET = {
    importateurs: [['nom', 'Raison sociale'], ['contribuable', 'Compte contribuable'], ['code', 'Code importateur'],
      ['adresse', 'Adresse'], ['telephone', 'Téléphone'], ['courriel', 'Courriel']],
    fournisseurs: [['nom', 'Raison sociale'], ['adresse', 'Adresse'], ['pays', 'Pays'], ['courriel', 'Courriel'], ['note', 'Note']],
    transporteurs: [['nom', 'Nom'], ['type', 'Type (compagnie, transitaire, camionneur)'], ['contact', 'Contact'], ['telephone', 'Téléphone'], ['note', 'Note']]
  };

  function brancherCarnet() {
    $$('[data-carnet-ajout]').forEach(function (b) {
      b.addEventListener('click', function () { formulaireCarnet(b.dataset.carnetAjout, null); });
    });
  }

  function peindreCarnet() {
    ['importateurs', 'fournisseurs', 'transporteurs'].forEach(function (magasin) {
      BASE.tout(magasin).then(function (entrees) {
        var cible = $('#carnet-' + magasin);
        cible.innerHTML = '';
        if (!entrees.length) {
          cible.appendChild(el('div', { class: 'vide' }, [
            icone('carnet'), el('div', { class: 'titre', texte: 'Carnet vide' }),
            el('div', { texte: 'Enregistrez vos correspondants une fois, retrouvez-les toujours.' })
          ]));
          return;
        }
        var table = el('table', { class: 't' });
        var corps = el('tbody');
        entrees.sort(function (a, b) { return (a.nom || '').localeCompare(b.nom || ''); }).forEach(function (e) {
          var tr = el('tr');
          tr.appendChild(el('td', {}, [
            el('div', { style: 'font-weight:600', texte: e.nom || '—' }),
            el('div', { style: 'font-size:11.5px;color:var(--gris)', texte: [e.contribuable, e.adresse, e.telephone, e.pays, e.type].filter(Boolean).join(' · ') })
          ]));
          tr.appendChild(el('td', { style: 'width:90px' }, [
            el('button', { class: 'icone', title: 'Modifier', onclick: function () { formulaireCarnet(magasin, e); } }, [icone('declaration')]),
            el('button', { class: 'icone danger', title: 'Supprimer', onclick: function () {
              BASE.supprimer(magasin, e.id).then(peindreCarnet);
            } }, [icone('poubelle')])
          ]));
          corps.appendChild(tr);
        });
        table.appendChild(corps);
        cible.appendChild(el('div', { class: 'tableau-cadre' }, [table]));
      });
    });
  }

  function formulaireCarnet(magasin, entree) {
    var champs = CHAMPS_CARNET[magasin];
    var valeurs = entree ? Object.assign({}, entree) : { id: BASE.identifiant() };
    var corps = el('div', { class: 'champs' });
    champs.forEach(function (c) {
      var input = el('input', { value: valeurs[c[0]] || '', oninput: function () { valeurs[c[0]] = this.value; } });
      corps.appendChild(el('div', { class: 'champ c6' }, [el('label', { texte: c[1] }), input]));
    });
    modale(entree ? 'Modifier la fiche' : 'Nouvelle fiche', corps, [
      { libelle: 'Annuler', action: fermerModale },
      { libelle: 'Enregistrer', genre: 'primaire', action: function () {
        if (!valeurs.nom) { message('Le nom est nécessaire.', 'attention'); return; }
        BASE.ecrire(magasin, valeurs).then(function () { fermerModale(); peindreCarnet(); message('Fiche enregistrée.', 'succes'); });
      } }
    ]);
  }

  function choisirDansCarnet(magasin) {
    BASE.tout(magasin).then(function (entrees) {
      if (!entrees.length) { message('Le carnet est vide. Enregistrez d’abord une fiche.', 'attention'); return; }
      var corps = el('div');
      var recherche = el('input', { placeholder: 'Rechercher…', style: 'margin-bottom:12px' });
      corps.appendChild(recherche);
      var liste = el('div');
      corps.appendChild(liste);
      function peindre() {
        var q = recherche.value.trim().toLowerCase();
        liste.innerHTML = '';
        entrees.filter(function (e) {
          return !q || (e.nom || '').toLowerCase().indexOf(q) >= 0 || (e.contribuable || '').indexOf(q) >= 0;
        }).sort(function (a, b) { return (a.nom || '').localeCompare(b.nom || ''); }).forEach(function (e) {
          liste.appendChild(el('div', {
            class: 'item', style: 'padding:10px;border:1px solid var(--trait);border-radius:8px;margin-bottom:7px;cursor:pointer',
            onclick: function () { appliquerFicheCarnet(magasin, e); fermerModale(); }
          }, [
            el('div', { style: 'font-weight:600', texte: e.nom }),
            el('div', { style: 'font-size:12px;color:var(--gris)', texte: [e.contribuable, e.adresse].filter(Boolean).join(' · ') })
          ]));
        });
      }
      recherche.addEventListener('input', peindre);
      peindre();
      modale('Choisir dans le carnet', corps, [{ libelle: 'Fermer', action: fermerModale }]);
    });
  }

  function appliquerFicheCarnet(magasin, e) {
    var d = etat.dossier;
    if (magasin === 'importateurs') {
      d.importateur_nom = e.nom || '';
      d.importateur_contribuable = e.contribuable || '';
      d.importateur_code = e.code || '';
      d.importateur_adresse = e.adresse || '';
      d.importateur_telephone = e.telephone || '';
      d.importateur_courriel = e.courriel || '';
    } else {
      d.fournisseur_nom = e.nom || '';
      d.fournisseur_adresse = [e.adresse, e.pays].filter(Boolean).join(', ');
    }
    peindreDossier();
    marquerModifie();
    message('Fiche reprise.', 'succes');
  }

  function enregistrerImportateurAuCarnet() {
    var d = etat.dossier;
    if (!d.importateur_nom) { message('Renseignez d’abord la raison sociale.', 'attention'); return; }
    BASE.ecrire('importateurs', {
      id: BASE.identifiant(), nom: d.importateur_nom, contribuable: d.importateur_contribuable,
      code: d.importateur_code, adresse: d.importateur_adresse,
      telephone: d.importateur_telephone, courriel: d.importateur_courriel
    }).then(function () { message('Importateur enregistré au carnet.', 'succes'); });
  }

  function enregistrerFournisseurAuCarnet() {
    var d = etat.dossier;
    if (!d.fournisseur_nom) { message('Renseignez d’abord la raison sociale.', 'attention'); return; }
    BASE.ecrire('fournisseurs', {
      id: BASE.identifiant(), nom: d.fournisseur_nom, adresse: d.fournisseur_adresse
    }).then(function () { message('Fournisseur enregistré au carnet.', 'succes'); });
  }

  /* ============================================================= réglages */

  var CHAMPS_SOCIETE = [
    ['nom', 'Raison sociale', 'c8'], ['forme', 'Forme juridique', 'c4'],
    ['activite', 'Activité', 'c12'],
    ['adresse', 'Adresse', 'c8'], ['boite_postale', 'Boîte postale', 'c4'],
    ['ville', 'Ville', 'c6'], ['pays', 'Pays', 'c6'],
    ['telephone', 'Téléphone', 'c6'], ['courriel', 'Courriel', 'c6'],
    ['site', 'Site internet', 'c6'], ['rccm', 'RCCM', 'c6'],
    ['contribuable', 'Compte contribuable', 'c6'], ['agrement_declarant', 'Agrément de déclarant', 'c6'],
    ['compte_bancaire', 'Compte bancaire', 'c12'],
    ['responsable', 'Responsable de la cotation', 'c6'], ['fonction_responsable', 'Fonction', 'c6']
  ];

  function brancherReglages() {
    $('#depot-logo').addEventListener('click', function () { $('#fichier-logo').click(); });
    $('#btn-choisir-logo').addEventListener('click', function (e) { e.stopPropagation(); $('#fichier-logo').click(); });
    $('#fichier-logo').addEventListener('change', function () {
      var f = this.files[0];
      if (f) recevoirLogo(f);
      this.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      $('#depot-logo').addEventListener(ev, function (e) { e.preventDefault(); this.classList.add('survol'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      $('#depot-logo').addEventListener(ev, function (e) { e.preventDefault(); this.classList.remove('survol'); });
    });
    $('#depot-logo').addEventListener('drop', function (e) {
      var f = e.dataTransfer.files[0];
      if (f) recevoirLogo(f);
    });
    $('#btn-retirer-logo').addEventListener('click', function (e) {
      e.stopPropagation();
      etat.logo = null;
      BASE.poserParametre('logo', null).then(function () {
        peindreApercuLogo(); peindreLogo($('#rail-logo'), 128, 40);
        message('Logo retiré.', 'succes');
      });
    });

    $('#btn-sync-tec').addEventListener('click', function () { lancerSyncTec(); });
    $('#btn-importer-tec').addEventListener('click', function () {
      lireFichier('.json,application/json').then(function (f) {
        if (!f) return;
        try {
          BASE.importerTecDepuisTexte(f.contenu).then(function (n) {
            return BASE.tout('tec').then(function (t) { etat.tec = t; return n; });
          }).then(function (n) {
            message(fr(n) + ' positions importées.', 'succes');
            peindreEtatTec(); peindreReglages();
          }).catch(function (e) { message(e.message, 'erreur'); });
        } catch (e) { message(e.message, 'erreur'); }
      });
    });
    $('#btn-exporter-tec').addEventListener('click', function () {
      if (!etat.tec.length) { message('Aucun tarif en base.', 'attention'); return; }
      telecharger('tarif-douanier-' + aujourdhui() + '.json', JSON.stringify({
        source: 'Export depuis Cotation E-Transit',
        exporte_le: new Date().toISOString(),
        lignes: etat.tec.map(function (p) {
          return [p.code, p.taux_dd === null ? null : p.taux_dd * 100, p.unite, p.designation, p.categorie];
        })
      }));
      message(fr(etat.tec.length) + ' positions exportées.', 'succes');
    });
    $('#btn-remettre-source').addEventListener('click', function () {
      $('#reglages-source-tec').value = BASE.SOURCE_TEC_DEFAUT;
      BASE.poserParametre('source_tec', BASE.SOURCE_TEC_DEFAUT);
    });
    $('#reglages-source-tec').addEventListener('change', function () {
      BASE.poserParametre('source_tec', this.value.trim() || BASE.SOURCE_TEC_DEFAUT);
    });

    $('#btn-ajouter-taux').addEventListener('click', function () { formulaireTauxPersonnel(null); });

    $('#choix-liste').addEventListener('change', peindreEditeurListe);
    $('#btn-ajouter-entree').addEventListener('click', ajouterEntreeListe);
    $('#btn-restaurer-liste').addEventListener('click', restaurerListe);

    $('#btn-ajouter-modele').addEventListener('click', function () { formulaireModeleDevis(null); });

    $('#btn-sauvegarder').addEventListener('click', function () {
      BASE.exporterTout(false).then(function (p) {
        telecharger('sauvegarde-e-transit-' + aujourdhui() + '.json', JSON.stringify(p));
        message('Sauvegarde enregistrée. Déposez-la hors de ce poste.', 'succes');
      });
    });
    $('#btn-restaurer').addEventListener('click', function () {
      confirmer('Restaurer une sauvegarde ?',
        'Le contenu actuel de la base — dossiers, carnets, réglages — sera remplacé par celui du fichier. ' +
        'Faites d’abord une sauvegarde de l’état actuel si vous avez un doute.',
        'Choisir le fichier').then(function (ok) {
        if (!ok) return;
        lireFichier('.json,application/json').then(function (f) {
          if (!f) return;
          try {
            BASE.importerTout(JSON.parse(f.contenu)).then(function () {
              message('Sauvegarde restaurée. L’application va se recharger.', 'succes');
              setTimeout(function () { location.reload(); }, 1200);
            });
          } catch (e) { message('Fichier illisible : ' + e.message, 'erreur'); }
        });
      });
    });

    ['reglages-validite', 'reglages-tva-honoraires', 'reglages-conditions'].forEach(function (id) {
      $('#' + id).addEventListener('change', function () {
        if (id === 'reglages-validite') { etat.validite = nb(this.value); BASE.poserParametre('devis_validite_jours', etat.validite); }
        if (id === 'reglages-tva-honoraires') { etat.tvaHonoraires = nb(this.value) / 100; BASE.poserParametre('taux_tva_honoraires', etat.tvaHonoraires); }
        if (id === 'reglages-conditions') { etat.conditions = this.value; BASE.poserParametre('devis_conditions', etat.conditions); }
      });
    });
  }

  function recevoirLogo(fichier) {
    if (fichier.size > 900 * 1024) {
      message('Ce fichier dépasse 900 Ko. Un logo de quelques dizaines de kilo-octets suffit et s’imprime mieux.', 'attention');
    }
    var lecteur = new FileReader();
    lecteur.onload = function () {
      var donnees = lecteur.result;
      var img = new Image();
      img.onload = function () {
        etat.logo = donnees;
        etat.logoRatio = img.naturalWidth / img.naturalHeight || 2.6;
        Promise.all([
          BASE.poserParametre('logo', donnees),
          BASE.poserParametre('logo_ratio', etat.logoRatio)
        ]).then(function () {
          peindreApercuLogo();
          peindreLogo($('#rail-logo'), 128, 40);
          message('Logo installé. Il figure désormais à l’écran, sur les devis et à l’impression.', 'succes');
        });
      };
      img.onerror = function () { message('Ce fichier n’est pas une image lisible.', 'erreur'); };
      img.src = donnees;
    };
    lecteur.readAsDataURL(fichier);
  }

  function peindreApercuLogo() {
    var z = $('#apercu-logo');
    z.innerHTML = '';
    if (etat.logo) {
      z.appendChild(el('img', { src: etat.logo, alt: 'Logo' }));
    } else {
      var glyphe = icone('televerser');
      glyphe.setAttribute('style', 'width:30px;height:30px;color:var(--accent)');
      z.appendChild(el('div', { class: 'invite' }, [
        glyphe,
        el('div', { style: 'margin-top:8px' }, [
          el('strong', { texte: 'Déposez le logo E-Transit ici' })
        ]),
        el('div', { style: 'margin-top:4px', texte: 'ou cliquez pour choisir un fichier' })
      ]));
    }
  }

  function peindreEtatTec() {
    BASE.parametre('tec_charge_le', null).then(function (le) {
      etat.tecChargeLe = le;
      var point = $('#point-tec');
      var texte = $('#etat-tec');
      if (etat.tec.length) {
        point.classList.remove('attention');
        texte.textContent = fr(etat.tec.length) + ' positions · ' + frDate(le);
      } else {
        point.classList.add('attention');
        texte.textContent = 'Tarif non chargé';
      }
    });
  }

  function proposerChargementTec() {
    var corps = el('div');
    corps.appendChild(el('p', { texte:
      'Le tarif douanier n’est pas encore dans la base de ce poste. Sans lui, chaque position et chaque taux ' +
      'devront être tapés à la main.' }));
    corps.appendChild(el('p', { class: 'aide', texte:
      'Le chargement dure quelques secondes et demande une connexion, une seule fois. Ensuite l’application ' +
      'fonctionne entièrement hors ligne : le tarif reste dans la base du poste.' }));
    modale('Charger le tarif douanier', corps, [
      { libelle: 'Plus tard', action: fermerModale },
      { libelle: 'Charger maintenant', genre: 'primaire', action: function () { fermerModale(); lancerSyncTec(); } }
    ]);
  }

  function lancerSyncTec() {
    var corps = el('div');
    var etatTexte = el('p', { texte: 'Connexion…' });
    var barre = el('div', { class: 'progression', style: 'margin-top:12px' }, [el('i', { style: 'width:15%' })]);
    corps.appendChild(etatTexte);
    corps.appendChild(barre);
    modale('Mise à jour du tarif', corps, []);
    var etape = 0;
    BASE.synchroniserTec(function (t) {
      etape++;
      etatTexte.textContent = t;
      barre.firstChild.style.width = Math.min(20 + etape * 28, 92) + '%';
    }).then(function (n) {
      barre.firstChild.style.width = '100%';
      return BASE.tout('tec').then(function (t) { etat.tec = t; return n; });
    }).then(function (n) {
      fermerModale();
      message(fr(n) + ' positions tarifaires chargées. L’application fonctionne maintenant hors ligne.', 'succes');
      peindreEtatTec();
      if (etat.page === 'reglages') peindreReglages();
      if (etat.page === 'bord') peindreBord();
      peindreArticles();
    }).catch(function (e) {
      fermerModale();
      modale('Le tarif n’a pas pu être chargé', el('div', {}, [
        el('p', { texte: e.message }),
        el('p', { class: 'aide', texte:
          'Rien n’a été remplacé : le tarif déjà en base, s’il y en a un, est intact. Vérifiez la connexion du ' +
          'poste, ou importez un fichier de tarif depuis les Réglages.' })
      ]), [{ libelle: 'Fermer', genre: 'primaire', action: fermerModale }]);
    });
  }

  function peindreReglages() {
    // Société.
    var z = $('#champs-societe');
    z.innerHTML = '';
    CHAMPS_SOCIETE.forEach(function (c) {
      var input = el('input', {
        value: etat.societe[c[0]] || '',
        onchange: function () {
          etat.societe[c[0]] = this.value;
          BASE.poserParametre('societe', etat.societe).then(function () {
            $('#rail-nom').textContent = etat.societe.nom || 'E-TRANSIT';
            $('#banniere-nom').textContent = etat.societe.nom || 'E-TRANSIT';
          });
        }
      });
      z.appendChild(el('div', { class: 'champ ' + c[2] }, [el('label', { texte: c[1] }), input]));
    });
    peindreApercuLogo();

    // Tarif.
    $('#reglages-source-tec').value = '';
    BASE.sourceTec().then(function (u) { $('#reglages-source-tec').value = u; });
    var zTec = $('#tec-etat');
    zTec.innerHTML = '';
    if (etat.tec.length) {
      $('#reglages-tec-indice').textContent = fr(etat.tec.length) + ' positions en base';
      zTec.appendChild(avis('succes', fr(etat.tec.length) + ' positions tarifaires.',
        'Chargées le ' + frDate(etat.tecChargeLe) + '. Elles vivent dans la base de ce poste : aucune connexion ' +
        'n’est nécessaire pour s’en servir.'));
    } else {
      $('#reglages-tec-indice').textContent = 'aucune position';
      zTec.appendChild(avis('attention', 'Aucun tarif en base.',
        'La recherche de position est inopérante et aucun taux ne sera proposé.'));
    }
    peindreTauxPersonnels();

    // Listes.
    var choix = $('#choix-liste');
    if (!choix.options.length) {
      var noms = {
        taxes: 'Taxes', monnaies: 'Monnaies', pays: 'Pays', bureaux: 'Bureaux de douane',
        regimes: 'Régimes douaniers', incoterms: 'Incoterms', modes: 'Modes de transport',
        colis: 'Natures de colis', types_conteneur: 'Types de conteneur', unites: 'Unités',
        documents: 'Documents joints', origines: 'Régimes d’origine', postes_devis: 'Postes de devis'
      };
      remplirSelect(choix, BASE.LISTES.map(function (n) { return { valeur: n, libelle: noms[n] || n }; }), 'bureaux');
    }
    peindreEditeurListe();
    peindreModelesDevis();

    // Devis.
    $('#reglages-validite').value = etat.validite;
    $('#reglages-tva-honoraires').value = Math.round(etat.tvaHonoraires * 10000) / 100;
    $('#reglages-conditions').value = etat.conditions;

    peindreStockage();
    peindreRegles();
  }

  function peindreTauxPersonnels() {
    var corps = $('#table-taux-personnels tbody');
    corps.innerHTML = '';
    BASE.tout('taux_personnels').then(function (entrees) {
      etat.tauxPersonnels = entrees.filter(function (e) { return e.code; });
      if (!etat.tauxPersonnels.length) {
        corps.appendChild(el('tr', {}, [el('td', {
          colspan: '5', style: 'color:var(--gris);padding:14px', texte: 'Aucun taux personnel. Le tarif chargé fait foi.'
        })]));
        return;
      }
      etat.tauxPersonnels.forEach(function (t) {
        var tr = el('tr');
        tr.appendChild(el('td', { style: 'font-weight:600;font-variant-numeric:tabular-nums', texte: t.code }));
        tr.appendChild(el('td', { texte: t.designation || '—' }));
        tr.appendChild(el('td', { class: 'num', texte: t.taux_dd === null ? '—' : fr(t.taux_dd * 100, 2) }));
        tr.appendChild(el('td', { texte: t.unite || '—' }));
        tr.appendChild(el('td', {}, [
          el('button', { class: 'icone', onclick: function () { formulaireTauxPersonnel(t); } }, [icone('declaration')]),
          el('button', { class: 'icone danger', onclick: function () {
            BASE.supprimer('taux_personnels', t.code).then(peindreTauxPersonnels);
          } }, [icone('poubelle')])
        ]));
        corps.appendChild(tr);
      });
    });
  }

  function formulaireTauxPersonnel(entree) {
    var v = entree ? Object.assign({}, entree) : { code: '', designation: '', taux_dd: null, unite: '' };
    var corps = el('div', { class: 'champs' });
    var iCode = el('input', { value: v.code, placeholder: '8517.62.00.00' });
    var iDes = el('input', { value: v.designation || '' });
    var iTaux = el('input', { class: 'nombre', inputmode: 'decimal', value: v.taux_dd === null || v.taux_dd === undefined ? '' : v.taux_dd * 100, placeholder: 'en %' });
    var iUnite = el('input', { value: v.unite || '', placeholder: 'kg, u…' });
    corps.appendChild(el('div', { class: 'champ c6' }, [el('label', { texte: 'Position tarifaire' }), iCode]));
    corps.appendChild(el('div', { class: 'champ c6' }, [el('label', { texte: 'Désignation' }), iDes]));
    corps.appendChild(el('div', { class: 'champ c6' }, [el('label', { texte: 'Taux de droit de douane (%)' }), iTaux]));
    corps.appendChild(el('div', { class: 'champ c6' }, [el('label', { texte: 'Unité statistique' }), iUnite]));
    corps.appendChild(el('div', { class: 'champ c12' }, [el('p', { class: 'aide', texte:
      'Ce taux prendra le pas sur celui du tarif chargé, et sera signalé comme personnel partout où il sert. ' +
      'N’y portez que ce que vous pouvez justifier.' })]));
    modale(entree ? 'Modifier le taux personnel' : 'Nouveau taux personnel', corps, [
      { libelle: 'Annuler', action: fermerModale },
      { libelle: 'Enregistrer', genre: 'primaire', action: function () {
        var code = iCode.value.trim();
        if (!code) { message('La position est nécessaire.', 'attention'); return; }
        var chiffres = code.replace(/[^0-9]/g, '');
        if (chiffres.length === 10) code = chiffres.slice(0, 4) + '.' + chiffres.slice(4, 6) + '.' + chiffres.slice(6, 8) + '.' + chiffres.slice(8, 10);
        var enregistrement = {
          code: code, designation: iDes.value.trim(),
          taux_dd: iTaux.value === '' ? null : nb(iTaux.value) / 100,
          unite: iUnite.value.trim()
        };
        // Renommer une position, c'est en créer une autre : l'ancienne clé part.
        var avant = (entree && entree.code && entree.code !== code)
          ? BASE.supprimer('taux_personnels', entree.code) : Promise.resolve();
        avant.then(function () { return BASE.ecrire('taux_personnels', enregistrement); })
          .then(function () { fermerModale(); peindreTauxPersonnels(); message('Taux personnel enregistré.', 'succes'); });
      } }
    ]);
  }

  /* ------------------------------------------------------ éditeur de liste */

  function peindreEditeurListe() {
    var nom = $('#choix-liste').value;
    var entrees = etat.listes[nom] || [];
    var z = $('#editeur-liste');
    z.innerHTML = '';
    if (!entrees.length) {
      z.appendChild(el('div', { class: 'vide' }, [el('div', { texte: 'Liste vide.' })]));
      return;
    }
    var colonnes = Object.keys(entrees[0]);
    var table = el('table', { class: 't' });
    table.appendChild(el('thead', {}, [el('tr', {}, colonnes.map(function (c) {
      return el('th', { texte: c.replace(/_/g, ' ') });
    }).concat([el('th', { style: 'width:40px' })]))]));
    var corps = el('tbody');
    entrees.forEach(function (entree, i) {
      var tr = el('tr');
      colonnes.forEach(function (c) {
        var valeur = entree[c];
        var td = el('td');
        if (typeof valeur === 'boolean') {
          var coche = el('input', { type: 'checkbox', style: 'width:auto' });
          coche.checked = valeur;
          coche.addEventListener('change', function () { entree[c] = this.checked; sauverListe(nom); });
          td.appendChild(coche);
        } else {
          td.appendChild(el('input', {
            value: valeur === null || valeur === undefined ? '' : valeur,
            onchange: function () {
              var v = this.value;
              entree[c] = (typeof entrees[0][c] === 'number' && v !== '') ? nb(v) : (v === '' && valeur === null ? null : v);
              sauverListe(nom);
            }
          }));
        }
        tr.appendChild(td);
      });
      tr.appendChild(el('td', {}, [el('button', {
        class: 'icone danger', onclick: function () {
          entrees.splice(i, 1); sauverListe(nom); peindreEditeurListe();
        }
      }, [icone('poubelle')])]));
      corps.appendChild(tr);
    });
    table.appendChild(corps);
    z.appendChild(table);
  }

  function sauverListe(nom) {
    BASE.poserListe(nom, etat.listes[nom]).then(function () {
      remplirSelecteurs();
      if (etat.dossier) peindreDossier();
    });
  }

  function ajouterEntreeListe() {
    var nom = $('#choix-liste').value;
    var entrees = etat.listes[nom] || [];
    var modele = entrees[0] || {};
    var neuve = {};
    Object.keys(modele).forEach(function (c) {
      neuve[c] = typeof modele[c] === 'boolean' ? false : (typeof modele[c] === 'number' ? 0 : '');
    });
    entrees.push(neuve);
    etat.listes[nom] = entrees;
    sauverListe(nom);
    peindreEditeurListe();
    message('Ligne ajoutée. Remplissez-la puis quittez la case pour enregistrer.', 'succes');
  }

  function restaurerListe() {
    var nom = $('#choix-liste').value;
    confirmer('Restaurer la liste d’origine ?',
      'Vos ajouts et corrections sur cette liste seront perdus et remplacés par la version livrée avec l’application.',
      'Restaurer').then(function (ok) {
      if (!ok) return;
      var origine = window.REFERENCE[nom.toUpperCase()] || [];
      etat.listes[nom] = JSON.parse(JSON.stringify(origine));
      sauverListe(nom);
      peindreEditeurListe();
      message('Liste restaurée.', 'succes');
    });
  }

  /* ------------------------------------------------------- modèles de devis */

  function peindreModelesDevis() {
    var corps = $('#table-modeles-devis tbody');
    corps.innerHTML = '';
    BASE.tout('modeles_devis').then(function (modeles) {
      etat.modelesDevis = modeles;
      if (!modeles.length) {
        corps.appendChild(el('tr', {}, [el('td', {
          colspan: '5', style: 'color:var(--gris);padding:14px',
          texte: 'Aucun poste mémorisé. Les intitulés usuels restent proposés en un clic sur l’écran du devis.'
        })]));
        return;
      }
      modeles.forEach(function (m) {
        var tr = el('tr');
        tr.appendChild(el('td', { texte: m.libelle }));
        tr.appendChild(el('td', { texte: m.nature === 'honoraire' ? 'Honoraires' : 'Débours' }));
        tr.appendChild(el('td', { class: 'num', texte: nb(m.montant_xof) ? fr(nb(m.montant_xof)) : '—' }));
        tr.appendChild(el('td', {}, [el('span', { class: 'etiq ' + (m.doffice ? 'vert' : 'gris'), texte: m.doffice ? 'oui' : 'non' })]));
        tr.appendChild(el('td', {}, [
          el('button', { class: 'icone', onclick: function () { formulaireModeleDevis(m); } }, [icone('declaration')]),
          el('button', { class: 'icone danger', onclick: function () {
            BASE.supprimer('modeles_devis', m.id).then(peindreModelesDevis);
          } }, [icone('poubelle')])
        ]));
        corps.appendChild(tr);
      });
    });
  }

  function formulaireModeleDevis(modele) {
    var v = modele ? Object.assign({}, modele) : { id: BASE.identifiant(), libelle: '', nature: 'debours', montant_xof: 0, doffice: false };
    var corps = el('div', { class: 'champs' });
    var iLib = el('input', { value: v.libelle });
    var sNat = el('select');
    remplirSelect(sNat, [
      { valeur: 'honoraire', libelle: 'Honoraires (soumis à la TVA)' },
      { valeur: 'debours', libelle: 'Débours (hors TVA)' }
    ], v.nature);
    var iMontant = el('input', { class: 'nombre', inputmode: 'decimal', value: v.montant_xof || '', placeholder: 'laisser vide si variable' });
    var cOffice = el('input', { type: 'checkbox', style: 'width:auto' });
    cOffice.checked = !!v.doffice;
    corps.appendChild(el('div', { class: 'champ c12' }, [el('label', { texte: 'Intitulé' }), iLib]));
    corps.appendChild(el('div', { class: 'champ c6' }, [el('label', { texte: 'Nature' }), sNat]));
    corps.appendChild(el('div', { class: 'champ c6' }, [el('label', { texte: 'Montant habituel (XOF)' }), iMontant]));
    corps.appendChild(el('div', { class: 'champ c12' }, [
      el('label', { style: 'font-weight:500;flex-direction:row;align-items:center;gap:8px' }, [cOffice, document.createTextNode('Proposer d’office sur chaque nouveau devis')])
    ]));
    modale(modele ? 'Modifier le poste' : 'Nouveau poste de facturation', corps, [
      { libelle: 'Annuler', action: fermerModale },
      { libelle: 'Enregistrer', genre: 'primaire', action: function () {
        if (!iLib.value.trim()) { message('L’intitulé est nécessaire.', 'attention'); return; }
        BASE.ecrire('modeles_devis', {
          id: v.id, libelle: iLib.value.trim(), nature: sNat.value,
          montant_xof: nb(iMontant.value), doffice: cOffice.checked
        }).then(function () { fermerModale(); peindreModelesDevis(); message('Poste enregistré.', 'succes'); });
      } }
    ]);
  }

  /* ------------------------------------------------------------ stockage */

  function peindreStockage() {
    var z = $('#reglages-stockage');
    z.innerHTML = '';
    if (!navigator.storage || !navigator.storage.estimate) return;
    navigator.storage.estimate().then(function (e) {
      var utilise = (e.usage || 0) / (1024 * 1024);
      z.appendChild(el('div', { class: 'aide', texte:
        'Place occupée par la base sur ce poste : ' + fr(utilise, 1) + ' Mo.' }));
    });
  }

  function peindreRegles() {
    var z = $('#reglages-regles');
    z.innerHTML = '';
    var regles = [
      ['Valeur en douane', 'CAF = valeur FOB + fret + assurance.'],
      ['Répartition du fret', 'Au poids brut de chaque article. Sans poids renseigné, la liquidation s’arrête plutôt que de répartir à la valeur, qui serait une autre formule sous le même nom.'],
      ['Répartition de l’assurance', 'À la valeur FOB de chaque article.'],
      ['Assurance', 'Toujours retenue en francs CFA. La prime est souscrite localement et n’est jamais convertie par le taux de change.'],
      ['Droit de douane', 'CAF × taux de la position tarifaire, diminué de l’exonération saisie s’il y en a une.'],
      ['Redevance statistique', 'CAF × 1 %.'],
      ['Prélèvements communautaires', 'PCS 0,8 % (UEMOA), PUA 0,2 % (Union africaine), PCC 0,5 % (CEDEAO), tous sur la valeur CAF.'],
      ['Assiette de la TVA', 'CAF + droit de douane + redevance statistique. Les prélèvements communautaires n’y entrent pas.'],
      ['TVA', '18 % de cette assiette.'],
      ['Redevance informatique', 'FOB total × 0,75 %, avec un plancher de 100 000 XOF. Une fois par déclaration, pas par article.'],
      ['Timbre statistique', '20 000 XOF forfaitaires. Une fois par déclaration.'],
      ['Exportation', 'Seul le timbre est dû. Ni droits, ni TVA, ni prélèvements, ni redevance informatique.'],
      ['Arrondis', 'Chaque taxe est arrondie au franc dès son calcul, et l’assiette de la TVA se construit avec les montants déjà arrondis — exactement comme le fait le système douanier.'],
      ['Position inconnue', 'Si le code n’est pas dans le tarif chargé, aucun taux n’est proposé. L’application ne devine jamais un droit de douane.']
    ];
    var table = el('table', { class: 't' });
    var corps = el('tbody');
    regles.forEach(function (r) {
      corps.appendChild(el('tr', {}, [
        el('td', { style: 'width:230px;font-weight:650', texte: r[0] }),
        el('td', { texte: r[1] })
      ]));
    });
    table.appendChild(corps);
    z.appendChild(el('div', { class: 'tableau-cadre' }, [table]));
  }

  /* ================================================================ départ */

  window.addEventListener('beforeunload', function () {
    if (etat.dossier) { clearTimeout(etat.sauvegardeEnAttente); enregistrerDossier(); }
  });

  demarrer();
})();
