-- Les fournisseurs qu'on peut nommer entrent dans la table. Les pistes qu'on
-- ne peut pas encore nommer restent en prospection.
--
-- La distinction n'est pas de la pédanterie : `fournisseurs` sert à rattacher
-- des produits et à comparer des origines. Y mettre un organisme de promotion
-- des exportations reviendrait à proposer « acheter chez le CEPEX », ce qui n'a
-- pas de sens — le CEPEX ne vend rien, il présente ceux qui vendent.
--
-- CJ Dropshipping n'y figurait pas alors qu'il alimente tout le catalogue.
-- Comparer deux origines suppose que la première soit décrite.

insert into app_e08c374bc4_fournisseurs
  (nom, pays, ville, secteur, modele, regime_origine, preuve_origine,
   incoterm_defaut, devise, mode_transport, site_web, note)
values
  ('CJ Dropshipping', 'Chine', 'Yiwu / Guangzhou',
   'Électroménager et maison, électronique, mode, accessoires',
   'dropshipping', 'droit_commun', 'non',
   'DDP', 'USD', 'aérien ou maritime selon la référence',
   'https://cjdropshipping.com',
   'Le fournisseur historique, celui qui remplit le catalogue aujourd''hui. Aucune préférence tarifaire possible : la Chine relève du droit commun, et le modèle colis par colis exclut de toute façon une preuve d''origine. Sert de référence de comparaison — c''est contre lui que se mesurent les autres.'),

  ('BigBuy', 'Espagne', 'Valence',
   'Électroménager et maison, électronique, mode, sport, beauté',
   'dropshipping', 'ape_ue', 'non',
   'EXW', 'EUR', 'routier puis maritime depuis un port espagnol',
   'https://www.bigbuy.eu',
   'Plus de 400 000 références, pas de minimum de commande, API disponible sur le pack grossiste — donc intégrable comme l''est CJ. RÉSERVE : marchandise européenne mais expédiée en dropshipping, sans EUR.1. Le bénéfice de l''APE n''est atteignable qu''en passant chez eux une commande en gros livrée EXW, puis en groupant nous-mêmes.'),

  ('VidaXL', 'Pays-Bas', 'Venlo',
   'Électroménager et maison, jardin, jouets',
   'dropshipping', 'ape_ue', 'non',
   'EXW', 'EUR', 'routier puis maritime depuis Rotterdam ou Anvers',
   'https://www.vidaxl.com',
   'Environ 90 000 références, entrepôts répartis en Europe. Recouvre exactement le rayon maison et jardin le mieux fourni par CJ : c''est le premier terrain de comparaison à monter, même produit, deux origines.'),

  ('Brandsdistribution', 'Italie', 'Gussago',
   'Textile et confection',
   'gros', 'ape_ue', 'sur_demande',
   'EXW', 'EUR', 'maritime depuis Gênes ou Livourne',
   'https://brandsdistribution.com',
   'Plus de 500 000 articles, une centaine de marques reconnues — argument de vente immédiat à Abidjan. Modèle gros, donc l''EUR.1 est envisageable : à confirmer auprès d''eux. Sur du textile de marque, le montant justifie largement la démarche.')

on conflict do nothing;

-- Les portes CEDEAO. On n'a pas encore de raison sociale à mettre dans
-- `fournisseurs`, et l'inventer serait pire que de l'attendre.
insert into app_e08c374bc4_prospection_fournisseurs
  (nom_entreprise, secteur, offre, adresse, site_web, priorite, statut, notes) values

  ('GEPA — Ghana Export Promotion Authority',
   'Agroalimentaire, textile, quincaillerie, transformation',
   'Agence publique de promotion des exportations ghanéennes ; mise en relation avec les exportateurs agréés.',
   'Accra, Ghana',
   'https://www.gepaghana.org', 1, 'a_contacter',
   'LA PISTE LA PLUS COURTE. Accra est à une journée de route d''Abidjan, contre 35 à 40 jours de mer depuis la Chine. Origine CEDEAO : droit de douane NUL avec le certificat d''origine et le numéro d''entreprise agréée — la seule origine qui bat l''APE. Institution nationale de soutien à l''export rattachée au ministère du Commerce, établie par l''Act 396. Demander la liste des exportateurs agréés au schéma de libéralisation des échanges.'),

  ('NEPC — Nigerian Export Promotion Council',
   'Agroalimentaire, cosmétique, textile, plastiques',
   'Conseil public de promotion des exportations nigérianes.',
   'Abuja, Nigeria',
   'https://nepc.gov.ng', 2, 'a_contacter',
   'Le plus gros marché de la CEDEAO, donc la plus grande profondeur d''offre. Origine CEDEAO, droit nul sous certificat. Point d''attention : la logistique Lagos–Abidjan et le change naira sont plus délicats que le corridor ghanéen. À traiter après le Ghana.'),

  ('ASEPEX — Agence sénégalaise de promotion des exportations',
   'Agroalimentaire, cosmétique, textile',
   'Agence publique sénégalaise de promotion des exportations.',
   'Dakar, Sénégal',
   'https://www.asepex.sn', 2, 'a_contacter',
   'Zone franc, donc pas de risque de change — le seul de la liste avec cet avantage, et il n''est pas mince. Origine CEDEAO. Liaison maritime Dakar–Abidjan régulière.')

on conflict do nothing;
