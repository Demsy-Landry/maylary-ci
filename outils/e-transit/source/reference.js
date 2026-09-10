/* Données de référence semées dans la base locale au premier démarrage.
 *
 * Tout ce qui est ici provient soit de la base tarifaire vérifiée, soit d'une
 * nomenclature internationale publique (UN/ECE, Incoterms 2020, ISO 3166).
 * Rien n'est inventé. Ce qui n'a pas de source certaine — les codes des
 * bureaux de douane, par exemple — est laissé vide et saisissable, jamais
 * rempli au jugé.
 *
 * Toutes ces listes sont recopiées en base au premier lancement, puis
 * modifiables et complétables depuis l'écran Réglages. Cette copie n'est
 * qu'une amorce.
 */
window.REFERENCE = (function () {
  'use strict';

  /* ------------------------------------------------------------------ taxes */
  /* Source : table des taxes douanières, Côte d'Ivoire.
   * assiette  : caf | fob | base_tva | forfait
   * niveau    : ligne (par article) | declaration (une fois)
   * base_tva  : la taxe entre-t-elle dans l'assiette de la TVA */
  var TAXES = [
    { code: 'DD',  libelle: 'Droit de douane',                                   assiette: 'caf',      taux: null,    niveau: 'ligne',       base_tva: true,  fixe: null,   minimum: null,   verrou: true },
    { code: 'RST', libelle: 'Redevance statistique',                             assiette: 'caf',      taux: 0.01,    niveau: 'ligne',       base_tva: true,  fixe: null,   minimum: null,   verrou: true },
    { code: 'PCS', libelle: 'Prélèvement communautaire de solidarité (UEMOA)',   assiette: 'caf',      taux: 0.008,   niveau: 'ligne',       base_tva: false, fixe: null,   minimum: null,   verrou: true },
    { code: 'PUA', libelle: 'Prélèvement Union africaine',                       assiette: 'caf',      taux: 0.002,   niveau: 'ligne',       base_tva: false, fixe: null,   minimum: null,   verrou: true },
    { code: 'PCC', libelle: 'Prélèvement communautaire (CEDEAO)',                assiette: 'caf',      taux: 0.005,   niveau: 'ligne',       base_tva: false, fixe: null,   minimum: null,   verrou: true },
    { code: 'TVA', libelle: 'Taxe sur la valeur ajoutée',                        assiette: 'base_tva', taux: 0.18,    niveau: 'ligne',       base_tva: false, fixe: null,   minimum: null,   verrou: true },
    { code: 'RPI', libelle: 'Redevance prestations informatiques',               assiette: 'fob',      taux: 0.0075,  niveau: 'declaration', base_tva: false, fixe: null,   minimum: 100000, verrou: true },
    { code: 'TS',  libelle: 'Timbre statistique',                                assiette: 'forfait',  taux: null,    niveau: 'declaration', base_tva: false, fixe: 20000,  minimum: null,   verrou: true }
  ];

  /* --------------------------------------------------------------- monnaies */
  /* La parité EUR/XOF est un ancrage légal fixe, pas un cours de marché :
   * elle ne bouge jamais et ne vient d'aucune API de change. Les monnaies
   * sans parité fixe demandent un taux saisi, celui du jour de la facture. */
  var MONNAIES = [
    { code: 'XOF', nom: 'Franc CFA (BCEAO)',       parite: 1,        courant: true },
    { code: 'EUR', nom: 'Euro',                    parite: 655.957,  courant: true },
    { code: 'USD', nom: 'Dollar des États-Unis',   parite: null,     courant: true },
    { code: 'CNY', nom: 'Yuan chinois',            parite: null,     courant: true },
    { code: 'XAF', nom: 'Franc CFA (BEAC)',        parite: 1,        courant: false },
    { code: 'GBP', nom: 'Livre sterling',          parite: null,     courant: false },
    { code: 'AED', nom: 'Dirham des Émirats',      parite: null,     courant: false },
    { code: 'MAD', nom: 'Dirham marocain',         parite: null,     courant: false },
    { code: 'TND', nom: 'Dinar tunisien',          parite: null,     courant: false },
    { code: 'TRY', nom: 'Livre turque',            parite: null,     courant: false },
    { code: 'GHS', nom: 'Cedi ghanéen',            parite: null,     courant: false },
    { code: 'NGN', nom: 'Naira nigérian',          parite: null,     courant: false },
    { code: 'ZAR', nom: 'Rand sud-africain',       parite: null,     courant: false },
    { code: 'INR', nom: 'Roupie indienne',         parite: null,     courant: false },
    { code: 'JPY', nom: 'Yen japonais',            parite: null,     courant: false },
    { code: 'CHF', nom: 'Franc suisse',            parite: null,     courant: false },
    { code: 'CAD', nom: 'Dollar canadien',         parite: null,     courant: false }
  ];

  /* ------------------------------------------------------------------- pays */
  /* Codes ISO 3166-1 alpha-2. U = UEMOA, C = CEDEAO hors UEMOA. */
  var PAYS_BRUT = "ZA|Afrique du Sud|-*;DZ|Algérie|-;DE|Allemagne|-*;AO|Angola|-;SA|Arabie saoudite|-;AR|Argentine|-;AU|Australie|-;AT|Autriche|-;BD|Bangladesh|-*;BE|Belgique|-*;BJ|Bénin|U;BR|Brésil|-;BG|Bulgarie|-;BF|Burkina Faso|U*;CV|Cabo Verde|C;CM|Cameroun|-;CA|Canada|-;CL|Chili|-;CN|Chine|-*;CG|Congo|-;CD|Congo (RDC)|-;KR|Corée du Sud|-;CI|Côte d'Ivoire|U*;DK|Danemark|-;EG|Égypte|-;AE|Émirats arabes unis|-*;ES|Espagne|-*;US|États-Unis|-*;ET|Éthiopie|-;FI|Finlande|-;FR|France|-*;GA|Gabon|-;GM|Gambie|C;GH|Ghana|C*;GR|Grèce|-;GN|Guinée|C;GW|Guinée-Bissau|U;HK|Hong Kong|-*;HU|Hongrie|-;IN|Inde|-*;ID|Indonésie|-;IR|Iran|-;IE|Irlande|-;IL|Israël|-;IT|Italie|-*;JP|Japon|-;JO|Jordanie|-;KE|Kenya|-;KW|Koweït|-;LB|Liban|-;LR|Libéria|C;LY|Libye|-;MG|Madagascar|-;MY|Malaisie|-;ML|Mali|U*;MA|Maroc|-*;MU|Maurice|-;MR|Mauritanie|-;MX|Mexique|-;MZ|Mozambique|-;NE|Niger|U;NG|Nigéria|C*;NO|Norvège|-;NZ|Nouvelle-Zélande|-;OM|Oman|-;UG|Ouganda|-;PK|Pakistan|-;NL|Pays-Bas|-*;PH|Philippines|-;PL|Pologne|-;PT|Portugal|-;QA|Qatar|-;CF|République centrafricaine|-;RO|Roumanie|-;GB|Royaume-Uni|-*;RU|Russie|-;RW|Rwanda|-;SN|Sénégal|U*;SL|Sierra Leone|C;SG|Singapour|-;SD|Soudan|-;LK|Sri Lanka|-;SE|Suède|-;CH|Suisse|-;TW|Taïwan|-;TZ|Tanzanie|-;TD|Tchad|-;CZ|Tchéquie|-;TH|Thaïlande|-;TG|Togo|U*;TN|Tunisie|-*;TR|Turquie|-*;UA|Ukraine|-;VN|Viêt Nam|-*;ZM|Zambie|-;ZW|Zimbabwe|-";

  var PAYS = PAYS_BRUT.split(';').map(function (bloc) {
    var p = bloc.split('|');
    var drapeaux = p[2] || '-';
    return {
      code: p[0],
      nom: p[1],
      uemoa: drapeaux.charAt(0) === 'U',
      cedeao: drapeaux.charAt(0) === 'U' || drapeaux.charAt(0) === 'C',
      courant: drapeaux.indexOf('*') >= 0
    };
  });

  /* --------------------------------------------------------------- bureaux */
  /* Les codes bureau SYDAM ne sont pas confirmés dans nos sources : la colonne
   * reste vide, à saisir une fois par madame Estelle. Elle sera mémorisée. */
  var BUREAUX = [
    { code: '', nom: 'Abidjan Port — Vridi',                       ville: 'Abidjan',        type: 'maritime' },
    { code: '', nom: 'Abidjan Port — Terminal à conteneurs',       ville: 'Abidjan',        type: 'maritime' },
    { code: '', nom: 'Abidjan Aéroport Félix Houphouët-Boigny',    ville: 'Abidjan',        type: 'aerien' },
    { code: '', nom: 'Abidjan — Bureau des colis postaux',         ville: 'Abidjan',        type: 'postal' },
    { code: '', nom: 'San Pédro Port',                             ville: 'San Pédro',      type: 'maritime' },
    { code: '', nom: 'Bouaké',                                     ville: 'Bouaké',         type: 'terrestre' },
    { code: '', nom: 'Yamoussoukro',                               ville: 'Yamoussoukro',   type: 'terrestre' },
    { code: '', nom: 'Ferkessédougou',                             ville: 'Ferkessédougou', type: 'terrestre' },
    { code: '', nom: 'Ouangolodougou',                             ville: 'Ouangolodougou', type: 'frontiere' },
    { code: '', nom: 'Pogo (frontière Mali)',                      ville: 'Pogo',           type: 'frontiere' },
    { code: '', nom: 'Noé (frontière Ghana)',                      ville: 'Noé',            type: 'frontiere' },
    { code: '', nom: 'Aboisso',                                    ville: 'Aboisso',        type: 'terrestre' },
    { code: '', nom: 'Korhogo',                                    ville: 'Korhogo',        type: 'terrestre' },
    { code: '', nom: 'Man',                                        ville: 'Man',            type: 'terrestre' },
    { code: '', nom: 'Danané (frontière Guinée/Libéria)',          ville: 'Danané',         type: 'frontiere' },
    { code: '', nom: 'Odienné',                                    ville: 'Odienné',        type: 'terrestre' },
    { code: '', nom: 'Daloa',                                      ville: 'Daloa',          type: 'terrestre' },
    { code: '', nom: 'Gagnoa',                                     ville: 'Gagnoa',         type: 'terrestre' },
    { code: '', nom: 'Bondoukou',                                  ville: 'Bondoukou',      type: 'terrestre' }
  ];

  /* --------------------------------------------------------------- régimes */
  /* Les 84 régimes SYDAM. Format compact :
   * code|sens|droits|rpi|ts|catégorie|libellé
   * droits/rpi/ts : 1 exigible, 0 non exigible. Le commentaire affiché à
   * l'écran est reconstitué à partir de la catégorie. */
  var REGIMES_BRUT = [
    "1000|export|0|0|1|exportation|Exportation définitive",
    "1022|export|0|0|1|exportation|Exportation définitive en suite de perfectionnement passif pour transformation",
    "1023|export|0|0|1|exportation|Exportation définitive en suite de perfectionnement passif pour réparation",
    "1024|export|0|0|1|exportation|Exportation définitive en suite de perfectionnement passif autre",
    "1052|export|0|0|1|exportation|Exportation définitive en suite de perfectionnement actif",
    "1094|export|0|0|1|exportation|Exportation en régularisation de Bon Provisoire",
    "2200|export|0|0|1|perfectionnement_passif|Perfectionnement passif pour transformation",
    "2300|export|0|0|1|perfectionnement_passif|Perfectionnement passif en suite de réparation",
    "2400|export|0|0|1|perfectionnement_passif|Perfectionnement passif autre",
    "3000|export|0|0|1|reexportation|Réexportation directe",
    "3050|export|0|0|1|reexportation|Réexportation en suite d'admission temporaire ordinaire",
    "3051|export|0|0|1|reexportation|Réexportation en suite d'admission temporaire spéciale",
    "3052|export|0|0|1|reexportation|Réexportation en suite d'AT pour perfectionnement actif",
    "3070|export|0|0|1|reexportation|Réexportation en suite d'entrepôt de stockage",
    "3079|export|0|0|1|reexportation|Réexportation en suite de dépôt",
    "3080|export|0|0|1|reexportation|Réexportation en suite de transit national",
    "3092|export|0|0|1|reexportation|Réexportation en sortie de zone franche",
    "3094|export|0|0|1|reexportation|Réexportation en régularisation de Bon Provisoire",
    "4000|import|1|1|1|mise_consommation|Mise à la consommation directe",
    "4050|import|1|1|1|mise_consommation|Mise à la consommation en suite d'admission temporaire ordinaire",
    "4051|import|1|1|1|mise_consommation|Mise à la consommation en suite d'admission temporaire spéciale",
    "4052|import|1|1|1|mise_consommation|Mise à la consommation en suite d'AT pour perfectionnement actif",
    "4070|import|1|1|1|mise_consommation|Mise à la consommation en suite d'entrepôt de stockage",
    "4079|import|1|1|1|mise_consommation|Mise à la consommation en suite de dépôt",
    "4080|import|1|1|1|mise_consommation|Mise à la consommation en suite de transit national",
    "4094|import|1|1|1|mise_consommation|Mise à la consommation en régularisation de Bon Provisoire",
    "5000|import|0|1|1|admission_temporaire|Admission temporaire ordinaire",
    "5050|import|0|1|1|admission_temporaire|Mutation d'admission temporaire ordinaire",
    "5052|import|0|1|1|admission_temporaire|Admission temporaire ordinaire en suite de perfectionnement actif",
    "5070|import|0|1|1|admission_temporaire|Admission temporaire en suite d'entrepôt de stockage",
    "5079|import|0|1|1|admission_temporaire|Admission temporaire ordinaire en suite de dépôt",
    "5080|import|0|1|1|admission_temporaire|Admission temporaire ordinaire en suite de transit national",
    "5092|import|0|1|1|admission_temporaire|Admission temporaire en suite de zone franche",
    "5094|import|0|1|1|admission_temporaire|Admission temporaire en régularisation de Bon Provisoire",
    "5100|import|0|1|1|admission_temporaire|Admission temporaire spéciale (matériels d'entreprises)",
    "5150|import|0|1|1|admission_temporaire|Admission temporaire spéciale en suite d'ATO",
    "5170|import|0|1|1|admission_temporaire|Admission temporaire spéciale en suite d'entrepôt de stockage",
    "5179|import|0|1|1|admission_temporaire|Admission temporaire spéciale en suite de dépôt",
    "5180|import|0|1|1|admission_temporaire|Admission temporaire spéciale en suite de transit national",
    "5200|import|0|1|1|admission_temporaire|AT pour perfectionnement actif (ouvraison, réparation, transformation)",
    "5250|import|0|1|1|admission_temporaire|Mutation d'ATO en ATT",
    "5252|import|0|1|1|admission_temporaire|Mutation de perfectionnement actif (ouvraison, réparation…)",
    "5270|import|0|1|1|admission_temporaire|AT pour perfectionnement actif en suite d'entrepôt de stockage",
    "5279|import|0|1|1|admission_temporaire|Perfectionnement actif en suite de dépôt",
    "5280|import|0|1|1|admission_temporaire|Perfectionnement actif en suite de transit national",
    "5294|import|0|1|1|admission_temporaire|AT pour perfectionnement actif en régularisation de Bon Provisoire",
    "6022|import|0|0|0|reimportation|Réimportation en suite de perfectionnement passif pour transformation",
    "6023|import|0|0|0|reimportation|Réimportation en suite de perfectionnement passif pour réparation",
    "6024|import|0|0|0|reimportation|Réimportation en suite de perfectionnement passif autre",
    "7000|import|0|1|1|entrepot|Entrée en entrepôt de stockage",
    "7050|import|0|1|1|entrepot|Entrée en entrepôt de stockage en suite d'AT ordinaire",
    "7051|import|0|1|1|entrepot|Entrée en entrepôt de stockage en suite d'AT spéciale",
    "7052|import|0|1|1|entrepot|Entrée en entrepôt de stockage en suite d'AT perfectionnement actif",
    "7070|import|0|1|1|entrepot|Mutation d'entrepôt de stockage",
    "7079|import|0|1|1|entrepot|Entrepôt de stockage en suite de dépôt",
    "7080|import|0|1|1|entrepot|Mise en entrepôt en suite de transit national",
    "7094|import|0|1|1|entrepot|Entrepôt de stockage en régularisation de Bon Provisoire",
    "8000|transit|0|0|0|transit|Transit national",
    "8052|transit|0|0|0|transit|Transit national en suite de perfectionnement actif",
    "8070|transit|0|0|0|transit|Transit national en suite d'entrepôt de stockage",
    "8079|transit|0|0|0|transit|Transit national en suite de dépôt",
    "8080|transit|0|0|0|transit|Transit national par mer vers port/aéroport CI en suite de transit",
    "8100|transit|0|0|0|transit|Transbordement",
    "9100|special|0|0|0|special|Cabotage",
    "9200|special|0|0|0|special|Entrée en zone franche",
    "9280|special|0|0|0|special|Entrée en zone franche industrielle en suite de transit national",
    "9292|special|0|0|0|special|Mutation de zone franche",
    "9294|special|0|0|0|special|Entrée en zone franche en régularisation de Bon Provisoire",
    "9351|special|0|0|0|special|Déclaration anniversaire d'AT spéciale (matériels d'entreprises)",
    "9900|special|0|0|0|special|Déclaration manuelle",
    "9910|special|0|0|0|special|Liquidation manuelle en suite d'exportation",
    "9922|special|0|0|0|special|Liquidation manuelle en suite de perfectionnement passif pour transformation",
    "9923|special|0|0|0|special|Liquidation manuelle en suite de perfectionnement passif pour réparation",
    "9924|special|0|0|0|special|Liquidation manuelle en suite de perfectionnement passif autre",
    "9930|special|0|0|0|special|Liquidation manuelle en suite de réexportation",
    "9950|special|0|0|0|special|Liquidation manuelle en suite d'admission temporaire ordinaire",
    "9951|special|0|0|0|special|Liquidation manuelle en suite d'ATME",
    "9952|special|0|0|0|special|Liquidation manuelle en suite de perfectionnement actif",
    "9970|special|0|0|0|special|Liquidation manuelle en suite d'entrepôt de stockage",
    "9980|special|0|0|0|special|Liquidation manuelle en suite de transit national",
    "9992|special|0|0|0|special|Liquidation manuelle en suite de zone franche"
  ];

  var MENTIONS_REGIME = {
    exportation: "Exportation : seul le timbre statistique de 20 000 XOF est dû, une fois par déclaration. Ni droits de douane, ni TVA, ni prélèvements communautaires, ni redevance informatique — ces impositions sont liées à l'importation. Hors produits soumis au Droit Unique de Sortie (cacao, café, noix de cajou…), qui reste à confirmer.",
    perfectionnement_passif: "Perfectionnement passif : à la sortie, seul le timbre statistique de 20 000 XOF est dû, une fois par déclaration. Les droits et taxes se poseront au retour de la marchandise, sur la déclaration d'importation. Hors produits soumis au Droit Unique de Sortie.",
    reexportation: "Réexportation : seul le timbre statistique de 20 000 XOF est dû, une fois par déclaration. Les droits et taxes à l'importation ne s'appliquent pas à une marchandise qui quitte le territoire. Hors produits soumis au Droit Unique de Sortie.",
    mise_consommation: "Régime de droit commun : droits et taxes exigibles en totalité, redevance informatique et timbre statistique dus.",
    admission_temporaire: "Admission temporaire : droits et taxes suspendus, en totalité ou en partie selon l'autorisation détenue. Redevance informatique et timbre restent dus, et les montants affichés sont indicatifs.",
    entrepot: "Entrepôt sous douane : droits et taxes suspendus jusqu'à la mise à la consommation. Redevance informatique et timbre statistique restent dus.",
    transit: "Transit : aucun droit ni taxe acquitté à ce stade. Une caution ou un acquit-à-caution est exigé à la place.",
    reimportation: "Traitement fiscal non confirmé pour ce régime. Aucune liquidation n'est proposée tant que la règle n'a pas été validée par un déclarant agréé.",
    special: "Traitement fiscal non confirmé pour ce régime. Aucune liquidation n'est proposée tant que la règle n'a pas été validée par un déclarant agréé."
  };

  var REGIMES = REGIMES_BRUT.map(function (bloc) {
    var p = bloc.split('|');
    return {
      code: p[0],
      sens: p[1],
      droits: p[2] === '1',
      rpi: p[3] === '1',
      ts: p[4] === '1',
      categorie: p[5],
      libelle: p[6],
      mention: MENTIONS_REGIME[p[5]] || ''
    };
  });

  /* ------------------------------------------------------------ incoterms */
  /* Incoterms 2020, règles publiées par la Chambre de commerce internationale.
   * part_fret : la part du transport principal déjà comprise dans le prix
   * facturé — 1 signifie que le fret est dedans, 0 qu'il reste à ajouter.
   * assurance : le vendeur souscrit-il l'assurance. */
  var INCOTERMS = [
    { code: 'EXW', libelle: 'À l’usine',                        part_fret: 0, assurance: false, point: "Départ usine du vendeur" },
    { code: 'FCA', libelle: 'Franco transporteur',              part_fret: 0, assurance: false, point: "Remise au transporteur désigné" },
    { code: 'FAS', libelle: 'Franco le long du navire',         part_fret: 0, assurance: false, point: "Le long du navire au port d'embarquement" },
    { code: 'FOB', libelle: 'Franco à bord',                    part_fret: 0, assurance: false, point: "À bord du navire au port d'embarquement" },
    { code: 'CFR', libelle: 'Coût et fret',                     part_fret: 1, assurance: false, point: "À bord du navire, fret payé jusqu'au port d'arrivée" },
    { code: 'CIF', libelle: 'Coût, assurance et fret',          part_fret: 1, assurance: true,  point: "À bord du navire, fret et assurance payés" },
    { code: 'CPT', libelle: 'Port payé jusqu’à',                part_fret: 1, assurance: false, point: "Remise au premier transporteur, port payé" },
    { code: 'CIP', libelle: 'Port payé, assurance comprise',    part_fret: 1, assurance: true,  point: "Remise au premier transporteur, port et assurance payés" },
    { code: 'DAP', libelle: 'Rendu au lieu de destination',     part_fret: 1, assurance: false, point: "Au lieu convenu, non déchargé, non dédouané import" },
    { code: 'DPU', libelle: 'Rendu au lieu déchargé',           part_fret: 1, assurance: false, point: "Au lieu convenu, déchargé, non dédouané import" },
    { code: 'DDP', libelle: 'Rendu droits acquittés',           part_fret: 1, assurance: false, point: "Au lieu convenu, droits et taxes payés par le vendeur" }
  ];

  /* ------------------------------------------------- modes de transport */
  /* Nomenclature UN/ECE Recommandation 19, celle de la case 25 du DAU. */
  var MODES = [
    { code: '1', libelle: 'Transport maritime' },
    { code: '2', libelle: 'Transport par chemin de fer' },
    { code: '3', libelle: 'Transport par route' },
    { code: '4', libelle: 'Transport aérien' },
    { code: '5', libelle: 'Envois postaux' },
    { code: '7', libelle: 'Installations de transport fixes' },
    { code: '8', libelle: 'Transport par voies navigables intérieures' },
    { code: '9', libelle: 'Propulsion propre' }
  ];

  /* ------------------------------------------------- natures de colis */
  /* Nomenclature UN/ECE Recommandation 21, celle de la case 31 du DAU. */
  var COLIS = [
    { code: 'CN', libelle: 'Conteneur' },
    { code: 'CT', libelle: 'Carton' },
    { code: 'CS', libelle: 'Caisse' },
    { code: 'BX', libelle: 'Boîte' },
    { code: 'PK', libelle: 'Colis' },
    { code: 'PX', libelle: 'Palette' },
    { code: 'BG', libelle: 'Sac' },
    { code: 'BL', libelle: 'Balle' },
    { code: 'DR', libelle: 'Fût' },
    { code: 'RO', libelle: 'Rouleau' },
    { code: 'CY', libelle: 'Bouteille à gaz / cylindre' },
    { code: 'BD', libelle: 'Planche / madrier' },
    { code: 'VL', libelle: 'Vrac liquide' },
    { code: 'VR', libelle: 'Vrac solide' },
    { code: 'NE', libelle: 'Non emballé' }
  ];

  /* ----------------------------------------------------------- conteneurs */
  var TYPES_CONTENEUR = [
    { code: '20DV', libelle: "20 pieds sec (dry)" },
    { code: '40DV', libelle: "40 pieds sec (dry)" },
    { code: '40HC', libelle: "40 pieds high cube" },
    { code: '45HC', libelle: "45 pieds high cube" },
    { code: '20RF', libelle: "20 pieds frigorifique" },
    { code: '40RF', libelle: "40 pieds frigorifique" },
    { code: '20OT', libelle: "20 pieds open top" },
    { code: '40OT', libelle: "40 pieds open top" },
    { code: '20FR', libelle: "20 pieds flat rack" },
    { code: '40FR', libelle: "40 pieds flat rack" },
    { code: '20TK', libelle: "20 pieds citerne" },
    { code: 'LCL',  libelle: "Groupage — pas de conteneur complet" }
  ];

  /* ------------------------------------------------- unités de mesure */
  var UNITES = [
    { code: 'kg',  libelle: 'Kilogramme' },
    { code: 'u',   libelle: 'Unité / pièce' },
    { code: 'l',   libelle: 'Litre' },
    { code: 'm',   libelle: 'Mètre' },
    { code: 'm2',  libelle: 'Mètre carré' },
    { code: 'm3',  libelle: 'Mètre cube' },
    { code: 'pr',  libelle: 'Paire' },
    { code: 'dz',  libelle: 'Douzaine' },
    { code: 'ct',  libelle: 'Carat' },
    { code: 'mil', libelle: 'Millier' },
    { code: '1000kWh', libelle: 'Millier de kilowattheures' },
    { code: 'gi F/S',  libelle: 'Gramme de matière fissile' }
  ];

  /* ------------------------------------------------- documents joints */
  /* Pièces habituelles d'un dossier d'importation en Côte d'Ivoire. La liste
   * est modifiable : ce n'est pas une obligation réglementaire figée. */
  var DOCUMENTS = [
    { code: 'FACT', libelle: 'Facture commerciale',                       obligatoire: true },
    { code: 'BL',   libelle: 'Connaissement maritime (B/L)',              obligatoire: false },
    { code: 'LTA',  libelle: 'Lettre de transport aérien (LTA)',          obligatoire: false },
    { code: 'CMR',  libelle: 'Lettre de voiture routière (CMR)',          obligatoire: false },
    { code: 'PACK', libelle: 'Liste de colisage',                         obligatoire: true },
    { code: 'ORIG', libelle: "Certificat d'origine",                      obligatoire: false },
    { code: 'FDI',  libelle: "Fiche de déclaration à l'importation (FDI)", obligatoire: true },
    { code: 'BSC',  libelle: 'Bordereau de suivi des cargaisons (BSC)',   obligatoire: true },
    { code: 'ASS',  libelle: "Certificat d'assurance",                    obligatoire: true },
    { code: 'COC',  libelle: 'Certificat de conformité (VOC / COC)',      obligatoire: false },
    { code: 'PHYT', libelle: 'Certificat phytosanitaire',                 obligatoire: false },
    { code: 'SANI', libelle: 'Certificat sanitaire / vétérinaire',        obligatoire: false },
    { code: 'EXON', libelle: "Attestation d'exonération",                 obligatoire: false },
    { code: 'AUTO', libelle: "Autorisation spéciale d'importation",       obligatoire: false },
    { code: 'PROC', libelle: 'Procuration du client',                     obligatoire: false }
  ];

  /* ------------------------------------------------- régimes d'origine */
  /* Une origine préférentielle ne se présume pas : elle se prouve. Sans le
   * document, on liquide au taux plein. */
  var ORIGINES = [
    { code: 'TIERS',  libelle: 'Pays tiers — tarif plein',                     preuve: 'Aucune',                                           reduction: 0 },
    { code: 'UEMOA',  libelle: 'Origine UEMOA agréée',                         preuve: "Certificat d'origine UEMOA + agrément produit",    reduction: null },
    { code: 'CEDEAO', libelle: 'Origine CEDEAO agréée (SLEC)',                 preuve: "Certificat d'origine CEDEAO + agrément SLEC",      reduction: null },
    { code: 'APE',    libelle: "Accord de partenariat économique — UE",        preuve: "Déclaration d'origine sur facture / EUR.1",         reduction: null },
    { code: 'ZLECAf', libelle: 'Zone de libre-échange continentale africaine', preuve: "Certificat d'origine ZLECAf",                       reduction: null }
  ];

  /* --------------------------------------------------- lignes de devis */
  /* Aucun montant n'est proposé : ce sont les honoraires et débours propres à
   * E-Transit, et personne d'autre qu'E-Transit ne peut les fixer. Ce sont
   * seulement des intitulés, pour que rien ne soit oublié dans un devis. */
  var POSTES_DEVIS = [
    { code: 'HON',   libelle: 'Honoraires de transit et de dédouanement', nature: 'honoraire' },
    { code: 'DECL',  libelle: 'Établissement de la déclaration en douane', nature: 'honoraire' },
    { code: 'FDI',   libelle: 'Frais de FDI',                             nature: 'debours' },
    { code: 'BSC',   libelle: 'Bordereau de suivi des cargaisons',        nature: 'debours' },
    { code: 'REDOC', libelle: 'Retrait documentaire compagnie',           nature: 'debours' },
    { code: 'MAG',   libelle: 'Magasinage et surestaries',                nature: 'debours' },
    { code: 'MANU',  libelle: 'Manutention et acconage',                  nature: 'debours' },
    { code: 'SCAN',  libelle: 'Scanner / visite douanière',               nature: 'debours' },
    { code: 'TRANS', libelle: 'Transport terrestre jusqu’au magasin',     nature: 'debours' },
    { code: 'CAUT',  libelle: 'Caution / consignation conteneur',         nature: 'debours' },
    { code: 'DIV',   libelle: 'Frais divers',                             nature: 'debours' }
  ];

  return {
    TAXES: TAXES,
    MONNAIES: MONNAIES,
    PAYS: PAYS,
    BUREAUX: BUREAUX,
    REGIMES: REGIMES,
    INCOTERMS: INCOTERMS,
    MODES: MODES,
    COLIS: COLIS,
    TYPES_CONTENEUR: TYPES_CONTENEUR,
    UNITES: UNITES,
    DOCUMENTS: DOCUMENTS,
    ORIGINES: ORIGINES,
    POSTES_DEVIS: POSTES_DEVIS
  };
})();
