-- Les 21 articles qui attendaient un fret qu'on n'aura jamais avant la commande
--
-- POURQUOI ILS ÉTAIENT ÉTEINTS, ET POURQUOI CE MOTIF NE TIENT PLUS
--
-- Ces 21 articles portaient tous `indisponible_motif = 'fret_non_cote'`. Le
-- transporteur refuse de les coter — ils sont trop lourds ou trop encombrants
-- pour son porte-à-porte — donc leur prix de vente ne pouvait pas être calculé,
-- donc ils restaient invisibles.
--
-- Ce raisonnement ne valait que tant que le prix affiché devait CONTENIR le
-- fret. Le fondateur vient de trancher l'inverse : « le groupage ne doit pas
-- afficher le prix du fret car il n'est pas vérifié ». Le fret de groupage se
-- communique après vérification du volume, il ne s'affiche jamais d'avance.
--
-- L'absence de cotation cesse donc d'être un obstacle. La marchandise, elle, a
-- toujours eu un prix connu : ce qu'elle coûte chez le fournisseur, plus la
-- marge commerciale. C'est cela qu'on publie, et rien d'autre.
--
-- CE QU'ON NE PUBLIE PAS
--
-- Ni fret, ni assurance, ni frais de destination. `cout_fret_fcfa` reste à zéro
-- pour ces articles : ce n'est pas un fret nul, c'est un fret non encore établi,
-- et aucun écran client ne le lit.
--
-- Le frais de service de 2 000 F ne s'ajoute pas non plus ici : il se prend une
-- fois par COMMANDE, au panier, pas une fois par article.

begin;

-- ---------------------------------------------------------------------------
-- 1. Retirer quatre volumes physiquement impossibles
-- ---------------------------------------------------------------------------
--
-- Le volume sert à calculer le fret de groupage, qui se paie au plus élevé du
-- poids et du volume. Quatre fiches en portent un qui ne peut pas exister :
--
--   trois annoncent une densité de 476 000 à 3 780 000 kg/m³ — l'osmium, corps
--   le plus dense connu, plafonne à 22 590. Le fournisseur a saisi des mètres
--   cubes dans une colonne en centimètres cubes.
--
--   une annonce 1,7 kg/m³, soit plus léger que l'air (1,2).
--
-- On ne corrige pas en devinant le facteur : on efface. Une valeur absente se
-- lit « à confirmer » sur la fiche technique et sera mesurée au moment de coter
-- le groupage. Une valeur fausse, elle, se serait propagée en silence jusque
-- dans un devis.
update app_e08c374bc4_produits
set volume_unitaire_cm3 = null
where coalesce(prix_unitaire_fcfa, 0) = 0
  and volume_unitaire_cm3 is not null
  and (
    poids_unitaire_g / nullif(volume_unitaire_cm3, 0) * 1000 > 22590   -- plus dense que l'osmium
    or poids_unitaire_g / nullif(volume_unitaire_cm3, 0) * 1000 < 1.2  -- plus léger que l'air
  );

-- ---------------------------------------------------------------------------
-- 2. Nommer et décrire en français
-- ---------------------------------------------------------------------------
--
-- Les 21 arrivaient sous leur titre fournisseur — anglais, espagnol, écrit pour
-- un moteur de recherche et non pour un lecteur. Aucune n'avait de description.
--
-- Les textes ci-dessous ne traduisent pas la fiche du fournisseur : ils la
-- reformulent à partir des seules données vérifiables qu'elle contient. Aucune
-- caractéristique n'y est ajoutée. Là où le fournisseur signale une tension de
-- 110 V, c'est dit — vendre un appareil américain sur un réseau ivoirien à
-- 220 V sans le mentionner, c'est organiser le retour du colis.
update app_e08c374bc4_produits as p
set nom = v.nom, description = v.descr
from (values
  -- ---- Boutique grand public ----------------------------------------------
  ('582d597b-1117-47a6-abfb-8b4029a26d89'::uuid,
   'Rallonge électrique multiprise 7,4 m — boîtier orange, intérieur et extérieur',
   'Rallonge de 7,4 mètres à prises reliées à la terre, dans un boîtier orange qui reste visible au sol. Prévue pour l''intérieur comme pour l''extérieur : cour, atelier, chantier, raccordement d''un groupe électrogène. Une longueur suffisante d''un seul tenant évite de raccorder deux rallonges bout à bout, ce qui est déconseillé.'),

  ('c0d3cc85-2b4c-4b29-9093-dd8a02fac0b3'::uuid,
   'Rallonge électrique multiprise 5,4 m — intérieur et extérieur',
   'Rallonge multiprise de 5,4 mètres, prises reliées à la terre, pour usage domestique intérieur ou extérieur. Le format courant pour alimenter un poste de travail, un réfrigérateur d''appoint ou un éclairage de cour.'),

  ('9d26adda-b32a-4cad-9ce2-c44d212aac01'::uuid,
   'Rallonge électrique 15 m — bloc 4 prises avec terre, intérieur et extérieur',
   'Rallonge de 15 mètres terminée par un bloc de quatre prises reliées à la terre. La longueur permet d''alimenter un point de travail éloigné depuis une seule prise murale — boutique, cour, chantier — sans enchaîner plusieurs rallonges.'),

  ('2a9efe1f-2394-42c4-93a3-8b6c87c4fb00'::uuid,
   'Multiprise 5 prises avec interrupteur, 2 ports USB et protection contre les surtensions',
   'Multiprise de cinq prises avec interrupteur général et deux ports USB pour recharger téléphone et tablette sans adaptateur. La protection contre les surtensions coupe l''alimentation en cas de pointe de tension — ce qui compte sur un réseau sujet aux coupures et aux retours de courant.'),

  ('9e159326-7a34-4395-ad6e-475eb138e27f'::uuid,
   'Masque capillaire hydratant à l''huile d''argan',
   'Masque capillaire hydratant à l''huile d''argan, destiné aux cheveux secs, cassants ou traités. S''applique sur cheveux essorés, se laisse poser quelques minutes puis se rince.'),

  ('373edef5-7266-4ed7-b4bd-c41cf904ee29'::uuid,
   'Costume homme deux pièces — coupe ajustée, veste courte, style coréen',
   'Costume deux pièces pour homme : veste de coupe courte et ajustée d''inspiration coréenne, pantalon assorti. Tenue de ville ou de cérémonie.'),

  ('7ad776c6-9812-42ba-9cff-f503e9c7c746'::uuid,
   'Caméra de surveillance extérieure solaire — étanche, basse consommation',
   'Caméra de surveillance extérieure au format bullet, alimentée par panneau solaire, boîtier étanche. Sa faible consommation lui permet de fonctionner sans raccordement au réseau électrique : elle s''installe là où tirer une ligne coûterait plus cher que la caméra elle-même.'),

  ('36149cb6-8ea3-4f70-9f1e-9d439d1967e4'::uuid,
   'Enceinte Bluetooth portable KP-8013 500 W — caisson de basses, éclairage RVB, karaoké',
   'Enceinte Bluetooth portable de 500 W avec poignée de transport, caisson de basses et éclairage d''ambiance RVB. Entrée microphone pour le karaoké. La puissance et le format sont prévus pour l''extérieur : terrasse, animation, événement.'),

  -- ---- Espace Pro ----------------------------------------------------------
  ('3a2dc89a-336c-425f-9aee-23c7cdc2e758'::uuid,
   'Fauteuil de pédicure inclinable sans plomberie — hauteur réglable, pivot 360°, bain de pieds massant',
   'Fauteuil de pédicure sans raccordement à la plomberie : la cuve se remplit et se vide manuellement, ce qui permet d''ouvrir un poste dans un salon existant sans engager de travaux. Dossier inclinable, hauteur réglable par vérin hydraulique, rotation sur 360°, repose-pieds et bain de pieds massant. Structure métal garnie de mousse, finition or et noir.'),

  ('12140111-c8cb-441f-b94e-959dd90f1342'::uuid,
   'Perruque cheveux naturels du Viêt Nam — 600 g, coupe et couleur personnalisables (gros)',
   'Perruque tête entière en cheveux humains du Viêt Nam. Le poids de cheveux — 600 grammes, le plus fourni des trois densités proposées — détermine le volume de la chevelure. Coupe (carré court, long lisse, ondulé, bouclé) et coloration personnalisables. Tarif de gros, pour salons et revendeurs.'),

  ('8a8be1f7-6ce1-489b-8896-f0e3687aca67'::uuid,
   'Perruque cheveux naturels du Viêt Nam — 500 g, coupe et couleur personnalisables (gros)',
   'Perruque tête entière en cheveux humains du Viêt Nam. Le poids de cheveux — 500 grammes — détermine le volume de la chevelure : densité intermédiaire, la plus demandée. Coupe (carré court, long lisse, ondulé, bouclé) et coloration personnalisables. Tarif de gros, pour salons et revendeurs.'),

  ('815397ac-4356-486b-95e5-19399504e0b4'::uuid,
   'Perruque cheveux naturels du Viêt Nam — 350 g, coupe et couleur personnalisables (gros)',
   'Perruque tête entière en cheveux humains du Viêt Nam. Le poids de cheveux — 350 grammes — détermine le volume de la chevelure : densité légère, adaptée aux coupes courtes. Coupe et coloration personnalisables. Tarif de gros, pour salons et revendeurs.'),

  ('5f8cfc94-0166-48b0-9f39-3a8e55ce028f'::uuid,
   'Table haute 150 cm avec prises intégrées et 3 tabourets rembourrés — ensemble 4 pièces',
   'Ensemble de quatre pièces : une table haute de 150 cm et trois tabourets rembourrés. Le plateau intègre deux prises secteur, un port USB et un port Type-C, ce qui en fait autant une table de travail qu''une table de bar — séjour, salle à manger, cuisine, espace d''accueil. Attention : les prises intégrées sont au standard américain 110 V et demandent un transformateur pour être utilisées sur le réseau ivoirien 220 V.'),

  ('6b07ccc4-1f76-4fe7-be3d-b41ea7ee3f57'::uuid,
   'Coiffeuse professionnelle 9 ampoules Hollywood — grand miroir, 4 tiroirs, tabouret inclus',
   'Coiffeuse professionnelle à grand miroir cerné de neuf ampoules de type Hollywood, l''éclairage frontal qui ne creuse pas les traits et permet un maquillage fidèle. Quatre tiroirs et un casier ouvert, prise de courant intégrée et support sèche-cheveux. Tabouret fourni. Finition noire.'),

  ('48fe5c7e-3926-4d3b-abfe-1b368ae25b43'::uuid,
   'Coiffeuse moderne éclairage LED 3 intensités — 4 tiroirs, chaise incluse',
   'Coiffeuse à éclairage LED réglable en trois intensités, avec quatre tiroirs et plusieurs étagères ouvertes. Prise de courant intégrée et support sèche-cheveux. Chaise assortie fournie. Finition noire.'),

  ('bcb78bb0-347e-466d-b22c-f023d66b47f6'::uuid,
   'Station météo Wi-Fi 7 en 1 — écran couleur 19 cm, capteur extérieur solaire sans fil',
   'Station météo Wi-Fi réunissant sept mesures : température et humidité intérieures et extérieures, vitesse et direction du vent, pluviométrie. Écran couleur de 19 cm et capteur extérieur sans fil à alimentation solaire. Alertes paramétrables sur chaque mesure.'),

  ('dae3c2f9-61d5-447f-91e8-30700bcd8375'::uuid,
   'Ventilateur de toiture solaire 42 W — 2 800 CFM, silencieux, résistant aux intempéries',
   'Ventilateur de toiture à panneau solaire, 42 W pour un débit annoncé de 2 800 CFM, soit environ 4 750 m³ par heure. Il extrait l''air chaud accumulé sous la toiture : la température des locaux baisse et la climatisation travaille moins. Fonctionnement silencieux, boîtier résistant aux intempéries. Attention : l''adaptateur secteur de secours est au standard 110 V et demande un transformateur sur le réseau ivoirien 220 V.'),

  ('706ad2e6-fedb-4989-ba22-e4c1ff1710b9'::uuid,
   'Coupe-légumes manuel à pression — découpe en dés, usage professionnel',
   'Coupe-légumes manuel : on pose l''aliment sur la grille et on appuie, il ressort en dés réguliers. Prévu pour la mise en place rapide — oignons, tomates, poivrons — sans électricité et sans lame maniée à la main.'),

  ('9bd7de4d-3aaf-4ec8-a1ee-2cdc0d004422'::uuid,
   'Sac à dos isotherme de livraison de repas 35 × 25 × 40 cm — toile Oxford, bandes réfléchissantes',
   'Sac à dos isotherme de livraison, 35 × 25 × 40 cm, en toile Oxford résistante avec bandes réfléchissantes pour la visibilité de nuit. Le volume est prévu pour les grosses commandes de repas ; il convient aussi au transport de produits frais en tournée.'),

  ('836e1b37-891f-4af9-966f-64c5025979e6'::uuid,
   'Boîtes de conservation alimentaire — lot de 40 pièces hermétiques, étiquettes et marqueur',
   'Lot de 40 pièces : 20 boîtes hermétiques et leurs couvercles, en deux formes — rectangulaires et rondes — et plusieurs contenances. Fermeture étanche aux liquides. Étiquettes et marqueur fournis pour dater les préparations, ce qui est la base d''une traçabilité en cuisine professionnelle.'),

  ('4d436717-5afc-4471-aae6-aee7c47434d0'::uuid,
   'Coupe-légumes 8 lames — mandoline, râpe et découpe multifonction',
   'Ensemble de découpe à huit lames interchangeables : tranches, dés, bâtonnets, râpé fin ou épais. Un seul appareil remplace plusieurs ustensiles pour la mise en place en cuisine.')
) as v(id, nom, descr)
where p.id = v.id;

-- ---------------------------------------------------------------------------
-- 3. Tarifer la marchandise, et elle seule
-- ---------------------------------------------------------------------------
--
--   prix = prix d'achat × (1 + marge commerciale), avec le prix plancher
--
-- La marge commerciale et le plancher sont lus dans les réglages, jamais écrits
-- en dur : le fondateur doit pouvoir les changer sans qu'on redéploie.
--
-- Rien d'autre n'entre dans ce prix. Le fret de groupage sera communiqué après
-- vérification ; le frais de service se prend une fois par commande au panier ;
-- les droits et taxes se refacturent au franc près, sans marge.
update app_e08c374bc4_produits as p
set prix_unitaire_fcfa = greatest(
      round(p.prix_achat_fcfa * (1 + i.taux_marge_defaut)),
      i.prix_plancher_fcfa
    ),
    cout_fret_fcfa = 0,        -- non chiffré, et non lu par les écrans clients
    cout_assurance_fcfa = 0,   -- établie sur l'expédition, pas sur l'article
    indisponible_motif = null,
    actif = true,
    retarife_le = now(),
    updated_at = now()
from app_e08c374bc4_parametres_import as i
where i.id = 1
  and coalesce(p.prix_unitaire_fcfa, 0) = 0
  and p.prix_achat_fcfa > 0
  and p.mode_acheminement = 'groupage';

commit;
