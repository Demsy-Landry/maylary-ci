-- Régime douanier à l'importation
-- -------------------------------
-- Le modèle de coût ne comportait aucun droit ni taxe : impossible pour une
-- marchandise qui passe en douane. La valeur CAF (marchandise + fret +
-- assurance) est l'assiette des droits ; la TVA porte sur cette valeur
-- augmentée des droits.
alter table app_e08c374bc4_parametres_import
  add column if not exists taux_droit_douane numeric not null default 0.20,
  add column if not exists taux_redevances_importation numeric not null default 0.025,
  add column if not exists taux_tva numeric not null default 0.18,
  add column if not exists frais_dedouanement_fcfa numeric not null default 0;

comment on column app_e08c374bc4_parametres_import.taux_droit_douane is
  'Tarif extérieur commun appliqué à la valeur CAF. Cinq catégories existent (0, 5, 10, 20, 35 %) selon la nature du produit ; 20 % est la catégorie des biens de consommation finale. À confirmer par famille.';
comment on column app_e08c374bc4_parametres_import.taux_redevances_importation is
  'Somme des prélèvements communautaires et de la redevance statistique, appliqués à la valeur CAF.';
comment on column app_e08c374bc4_parametres_import.taux_tva is
  'TVA à l''importation, assise sur la valeur CAF augmentée des droits et redevances.';
comment on column app_e08c374bc4_parametres_import.frais_dedouanement_fcfa is
  'Honoraires de transit, magasinage et livraison finale, par expédition. Répartis au prorata de l''unité payante.';

-- Tarif de groupage, exprimé selon les règles des groupeurs
alter table app_e08c374bc4_campagnes_groupage
  add column if not exists minimum_taxation_up numeric not null default 1,
  add column if not exists taux_surcharges numeric not null default 0;

comment on column app_e08c374bc4_campagnes_groupage.minimum_taxation_up is
  'Unités payantes facturées au minimum pour une expédition, quelle que soit sa taille. Usuellement 1 m³ en groupage maritime.';
comment on column app_e08c374bc4_campagnes_groupage.taux_surcharges is
  'Surcharges proportionnelles au fret de base : soutage, ajustement de change. Exprimées en fraction.';
