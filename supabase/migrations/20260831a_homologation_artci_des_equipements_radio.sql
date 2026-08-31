-- Le régime ARTCI des équipements radioélectriques entre au registre.
--
-- POURQUOI CETTE FICHE MANQUAIT, ET CE QUE ÇA COÛTAIT
--
-- Trente-deux articles du catalogue émettent des ondes : enceintes Bluetooth,
-- veilleuses connectées, lunettes à caméra, montres connectées. Le registre des
-- marchandises réglementées n'en portait aucune trace — il ne couvrait que trois
-- familles, toutes du côté de l'AIRP. Le Déclarant ne pouvait donc pas avertir,
-- et la maison achetait sans savoir.
--
-- CE QUI A ÉTÉ LU, ET CE QUE ÇA A RÉVÉLÉ
--
-- Trois documents officiels de l'ARTCI, lus le 31 août 2026 :
--   — la page des homologations ;
--   — le formulaire officiel (6 pages, 217 413 octets) ;
--   — le registre ECPF au 25/03/2020 (64 pages, 2 061 896 octets).
--
-- Le registre ECPF n'est PAS ce qu'on pouvait espérer. « Équipement à Courte
-- Portée et à Faible Puissance » n'est pas une dispense : c'est une CATÉGORIE.
-- Le document est un registre d'homologations INDIVIDUELLES — nom commercial,
-- marque, modèle, fabricant, date d'homologation, date d'expiration à cinq ans,
-- demandeur nommé. Des modules Bluetooth 4.0 et des cartes Wi-Fi y figurent un
-- par un, chacun avec son certificat.
--
-- L'OBSTACLE RÉEL N'EST PAS LA DÉMARCHE
--
-- C'est l'Annexe I du formulaire. Elle réclame, bande par bande, les fréquences
-- d'émission et de réception, la largeur des canaux, la puissance PIRE, puis les
-- valeurs de DAS et d'intensité de champ. Ce sont des mesures de laboratoire que
-- seul le constructeur détient. Un fournisseur chinois sans marque propre ne les
-- publie pas.
--
-- CE QUI N'A PAS PU ÊTRE VÉRIFIÉ, ET QUI EST DIT COMME TEL
--
-- L'article exact de l'ordonnance 2012-293 : le PDF publié par l'ARTCI est un
-- scan sans couche texte — 27 pages, 10,4 Mo, zéro caractère extractible. Le
-- titre de l'ordonnance est relevé de la page officielle, l'article ne l'est pas,
-- et la fiche le dit plutôt que de combler le trou.
--
-- Idem pour le montant de la redevance, le délai d'instruction, et le point de
-- contrôle douanier. Tout cela est consigné en creux dans la note.

insert into app_e08c374bc4_marchandises_reglementees (
  code, libelle, famille, sens, autorite, autorite_sigle, base_legale, document_requis,
  personnes_morales_autorisees, pieces_du_dossier, exemplaires, adresse_depot, contact,
  site_web, difficulte, conseil_demarrage, mots_cles, positions_sh, actif, note
) values (
  'artci_homologation_equipements_radio',
  $$Équipements terminaux et/ou radioélectriques — homologation préalable$$,
  $$Équipements de télécommunication$$,
  'import',
  $$Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire$$,
  'ARTCI',
  $$Ordonnance n° 2012-293 du 21 mars 2012 relative aux Télécommunications et aux Technologies de l'Information et de la Communication (texte-cadre, titre relevé sur artci.ci/ordonnances/). ⚠️ L'article précis fondant l'obligation n'a PAS été vérifié : le PDF publié par l'ARTCI est un scan sans couche texte (27 pages, 10,4 Mo, zéro caractère extractible). À confirmer sur exemplaire papier ou au Journal officiel avant tout usage contentieux.$$,
  $$Certificat d'homologation délivré par l'ARTCI. Durée relevée dans le registre officiel : cinq ans (exemple constaté : homologation du 12/07/2013, expiration au 11/07/2018).$$,
  array[$$« Présentateur » justifiant d'un numéro de registre de commerce (le formulaire exige ce numéro)$$],
  array[
    $$Formulaire de demande d'homologation d'équipement terminal et/ou radioélectrique, renseigné et signé$$,
    $$Nature de la demande : nouvelle demande, ou renouvellement avec le numéro de l'ancien certificat$$,
    $$Identité du Présentateur : raison sociale, n° de registre de commerce, adresse, téléphone, fax, courriel$$,
    $$Personne chargée du dossier : nom, téléphone, courriel$$,
    $$Identification de l'équipement : nature (radioélectrique, filaire ou mixte), désignation commerciale, marque, modèle, constructeur, type, usage, pays d'origine$$,
    $$Engagement signé et cacheté par une personne ayant qualité pour engager le Présentateur$$,
    $$Annexe I — utilisation du spectre : par bande, fréquences d'émission et de réception (MHz), largeur des canaux (kHz), puissance maximale PIRE/PAR (W)$$,
    $$Annexe I — exposition aux ondes : émissions simultanées, usage grand public ou professionnel, distance d'utilisation (moins ou plus de 20 cm)$$,
    $$Annexe I — valeurs mesurées selon le domaine de fréquence : densité de courant (mA/m), DAS moyen corps entier, DAS local tête et tronc, DAS local membres (W/kg), intensité des champs E (V/m) et H (A/m), densité du champ B (µT), densité de puissance (W/m²)$$
  ],
  null,
  $$Siège social : Marcory Anoumambo, 18 BP 2203 Abidjan 18$$,
  $$Tél. 20 34 43 73 / 74 — Fax 20 34 43 75 — courrier@artci.ci$$,
  'https://artci.ci/homologations/',
  3,
  $$L'obstacle n'est pas la démarche, c'est l'Annexe I. Elle réclame les bandes de fréquences, la puissance PIRE et les valeurs de DAS de l'équipement — des mesures de laboratoire que seul le constructeur détient. Un fournisseur chinois sans marque propre ne les fournira pas. Avant d'engager quoi que ce soit : demander au fournisseur le rapport d'essai radio du modèle exact. S'il ne l'a pas, le modèle n'est pas homologable, et il faut soit changer de fournisseur pour une marque qui publie ses rapports, soit renoncer à ce produit. Le numéro de registre de commerce étant exigé du Présentateur, le RCCM de la société est un préalable.$$,
  array['bluetooth','wifi','sans fil','radioélectrique','ECPF','ETRA','homologation','enceinte','écouteur','montre connectée','traceur','télécommande','DAS','spectre'],
  array[]::text[],
  true,
  $$SOURCES LUES ET DATÉES (31 août 2026)

1. artci.ci/homologations/ — la page officielle porte la procédure « Demande d'homologation d'équipement terminal et/ou radioélectrique » et les registres annuels d'équipements homologués.

2. Formulaire officiel (artci.ci/wp-content/uploads/2024/06/5-formulaire_homologation_30_10_16.pdf) — 6 pages, 217 413 octets, lu intégralement. C'est de lui que viennent les pièces listées.

3. Registre ECPF « Équipements à Courte Portée et à Faible Puissance au 25/03/2020 » (artci.ci/wp-content/uploads/2024/06/4-1-liste-equipements-courte-portee-et-faible-puissance-25-03-2020.pdf) — 64 pages, 2 061 896 octets, lu.

CE QUE LE REGISTRE ECPF DIT, ET QUI N'ÉTAIT PAS ATTENDU

Ce n'est PAS une liste d'équipements dispensés d'homologation. C'est un registre d'homologations INDIVIDUELLES : chaque ligne porte un nom commercial, une marque, un modèle, un fabricant, un type, une date d'homologation, une date d'expiration et un demandeur nommé. On y trouve des modules Bluetooth 4.0 et des cartes Wi-Fi listés un par un, chacun avec son certificat.

Autrement dit : « courte portée et faible puissance » désigne une CATÉGORIE d'équipements, pas une dispense. Le Bluetooth d'une enceinte de salon relève du même registre qu'un module Wi-Fi d'ordinateur portable.

CE QUE CELA IMPLIQUE POUR LE CATALOGUE

Trente-deux articles du catalogue émettent des ondes (enceintes Bluetooth, veilleuses connectées, lunettes à caméra, montres connectées). Ils proviennent de fournisseurs chinois sans marque propre : leurs modèles ne figurent dans aucun registre de l'ARTCI, et l'Annexe I du formulaire exige des mesures de DAS que ces fournisseurs ne publient pas.

DÉCISION EN ATTENTE DU FONDATEUR — ce n'est pas une décision technique.

CE QUI N'A PAS PU ÊTRE VÉRIFIÉ

— L'article exact de l'ordonnance 2012-293 (scan sans couche texte).
— Le coût de la redevance d'homologation : l'ordonnance n° 97-173 du 19 mars 1997 relative aux droits, taxes et redevances sur les radiocommunications existe et est publiée, mais son montant n'a pas été relevé.
— Le délai d'instruction.
— Le régime douanier à l'importation : savoir si la douane exige le certificat au dédouanement, ou si l'ARTCI ne contrôle qu'à la mise sur le marché. Point à trancher avec un transitaire ou la douane.$$
)
on conflict (code) do nothing;
