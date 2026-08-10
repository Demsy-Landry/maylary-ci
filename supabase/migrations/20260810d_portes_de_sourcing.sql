-- Les portes d'entrée pour diversifier hors de Chine.
--
-- Ce que cette liste n'est pas : un carnet d'adresses de fournisseurs. Je n'ai
-- pas pu vérifier une seule raison sociale individuelle, et inventer un nom
-- d'entreprise avec un contact serait pire que ne rien mettre — on écrirait à
-- une adresse qui n'existe pas et on croirait la piste morte.
--
-- Ce qu'elle est : les organismes et annuaires par lesquels on obtient ces
-- fournisseurs. Chacun est vérifié, la plupart sont gratuits, et deux d'entre
-- eux ont un bureau ou un réseau en Afrique de l'Ouest.
--
-- Priorité 1 = organisme public, gratuit, dont c'est littéralement le métier de
-- nous mettre en relation. Priorité 2 = annuaire à défricher soi-même.
-- Priorité 3 = grossiste utilisable tout de suite, mais sans preuve d'origine.

insert into app_e08c374bc4_prospection_fournisseurs
  (nom_entreprise, secteur, offre, adresse, site_web, priorite, statut, notes) values

  ('CEPEX — Centre de Promotion des Exportations de la Tunisie',
   'Textile et confection, agroalimentaire, cosmétique, pièces automobiles',
   'Mise en relation gratuite avec les exportateurs tunisiens ; place de marché numérique des produits tunisiens.',
   'Tunis — réseau de 15 bureaux à l''étranger dont 6 en Afrique',
   'https://www.cepex.nat.tn', 1, 'a_contacter',
   'À CONTACTER EN PREMIER. Le CEPEX tient un bureau de représentation commerciale EN CÔTE D''IVOIRE : la mise en relation se fait donc à Abidjan, sans déplacement. Organisme public, service gratuit, c''est leur mission. Demander l''accès à la place de marché et le calendrier des Rencontres Professionnelles Tuniso-Africaines. Origine ZLECAf : la Tunisie délivre déjà des certificats nommément pour la Côte d''Ivoire.'),

  ('ASMEX — Confédération Marocaine des Exportateurs',
   'Agroalimentaire, agro-industrie, cosmétique, logistique',
   'Fédération des exportateurs marocains ; mise en relation acheteurs étrangers / producteurs.',
   'Casablanca, Maroc',
   'https://asmex.org', 1, 'a_contacter',
   'L''équivalent marocain du CEPEX. Casablanca–Abidjan représente environ une semaine de mer, contre 35 à 40 jours depuis la Chine. Origine ZLECAf à vérifier position par position. Points forts marocains : conserves, huiles, produits d''hygiène, cosmétique à l''argan.'),

  ('Europages — annuaire B2B européen',
   'Quincaillerie et outillage, pièces détachées, tous secteurs',
   'Annuaire de fabricants et grossistes : Europe, Turquie, Tunisie, Maroc. Contact direct.',
   'Europe',
   'https://www.europages.fr', 2, 'a_contacter',
   'La source la plus dense pour la quincaillerie et l''outillage : 85 fabricants référencés pour la seule Turquie. C''est un annuaire, pas un catalogue — il faut écrire, demander un tarif FOB et un minimum de commande. Question éliminatoire à poser dès le premier message : « pouvez-vous fournir un EUR.1 ? » pour les fournisseurs de l''Union européenne.'),

  ('EspaceAgro — annuaire agroalimentaire et quincaillerie',
   'Agroalimentaire, quincaillerie, outillage',
   'Petites annonces professionnelles import-export, marché francophone.',
   'France / francophonie',
   'https://www.espaceagro.com', 2, 'a_contacter',
   'Moins structuré qu''Europages mais francophone, donc plus rapide à traiter. Utile pour les lots et les fins de série.'),

  ('BigBuy',
   'Électroménager et maison, électronique, mode, sport, beauté',
   'Grossiste B2B espagnol, plus de 400 000 références, sans minimum de commande, API sur le pack grossiste.',
   'Espagne',
   'https://www.bigbuy.eu', 3, 'a_contacter',
   'Le plus proche du modèle CJ, côté européen : catalogue et API, donc intégrable comme l''est CJ. LIMITE À CONNAÎTRE : c''est du dropshipping, colis par colis, sans groupage et SANS PREUVE D''ORIGINE — donc aucun bénéfice de l''APE. À utiliser pour tester une référence sans risque, pas pour construire une marge.'),

  ('VidaXL',
   'Électroménager et maison, jardin, jouets',
   'Grossiste néerlandais, environ 90 000 références, entrepôts répartis en Europe.',
   'Pays-Bas',
   'https://www.vidaxl.com', 3, 'a_contacter',
   'Même réserve que BigBuy sur l''origine. Fort sur la maison et le jardin, qui recoupe directement le rayon le mieux fourni par CJ aujourd''hui : c''est là qu''on pourra comparer les deux origines sur un même produit.'),

  ('Brandsdistribution',
   'Textile et confection',
   'Distributeur italien de mode, plus de 500 000 articles, une centaine de marques.',
   'Italie',
   'https://brandsdistribution.com', 3, 'a_contacter',
   'Marques reconnues, donc argument de vente immédiat sur le marché ivoirien. Vérifier la politique d''export hors Union européenne et la disponibilité d''un EUR.1 : sur du textile de marque, le montant justifie largement la démarche.')

on conflict do nothing;
