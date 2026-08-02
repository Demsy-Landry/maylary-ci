-- Remise de groupage.
--
-- Le prix de chaque article porte le transport de son propre colis : c'est la
-- seule façon d'afficher un prix ferme avant de connaître le panier. Or un
-- panier de plusieurs références part dans un seul envoi, et la part fixe du
-- colis — mesurée à 1,31 $ chez le fournisseur, soit environ 787 FCFA — n'est
-- due qu'une fois. Sans correction, un panier de quatre articles fait payer
-- trois colis qui n'existent pas.
--
-- La remise est calculée au moment de valider, sur un devis de transport
-- réellement obtenu pour le panier tel qu'il est, et enregistrée avec la
-- commande : le montant payé reste celui qui a été annoncé.
alter table app_e08c374bc4_commandes_gp
  add column if not exists remise_groupage_fcfa numeric not null default 0
    check (remise_groupage_fcfa >= 0),
  add column if not exists fret_facture_articles_fcfa numeric,
  add column if not exists fret_reel_panier_fcfa numeric;

comment on column app_e08c374bc4_commandes_gp.remise_groupage_fcfa is
  'Part fixe de transport facturée en double par les prix article, rendue au client. Jamais négative : le prix ne peut que baisser.';
comment on column app_e08c374bc4_commandes_gp.fret_facture_articles_fcfa is
  'Transport contenu dans les prix des articles du panier, avant remise.';
comment on column app_e08c374bc4_commandes_gp.fret_reel_panier_fcfa is
  'Transport réellement coté par le fournisseur pour le panier groupé.';
