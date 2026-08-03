-- Ce que le fournisseur dit de la fiabilité d'un article — et ce qu'il n'en dit pas.
--
-- Relevé sur l'API : CJ n'expose ni note, ni avis, ni volume de ventes. Aucun
-- signal de qualité. Il expose en revanche trois faits vérifiables :
--
--   listedNum    combien de marchands vendent déjà cette référence ;
--   createrTime  depuis quand elle est au catalogue ;
--   supplierName l'atelier d'origine, derrière CJ.
--
-- Le premier est le plus parlant. Mesuré sur 19 de nos articles : 15 à zéro
-- marchand, la plupart créés entre le 29 juillet et le 2 août. Autrement dit,
-- le peuplement automatique a ramené les nouveautés de CJ, que personne n'a
-- encore testées, et Maylary les a mises en vitrine.
--
-- Zéro marchand ne prouve pas qu'un article est mauvais. Mais il prouve que
-- personne ne s'est encore engagé dessus, et ce n'est pas au client de Maylary
-- d'essuyer les plâtres : on vend notre fiabilité avant nos prix.
alter table app_e08c374bc4_produits
  add column if not exists fournisseur_origine text,
  add column if not exists fournisseur_origine_id text,
  add column if not exists marchands_vendeurs integer,
  add column if not exists reference_creee_le date,
  add column if not exists traction_relevee_le timestamptz;

comment on column app_e08c374bc4_produits.fournisseur_origine is
  'Atelier d''origine derrière CJ. CJ ne le note pas : notre propre historique le fera.';
comment on column app_e08c374bc4_produits.marchands_vendeurs is
  'Marchands vendant déjà cette référence chez CJ. Zéro = référence non éprouvée.';

create index if not exists app_e08c374bc4_produits_traction_idx
  on app_e08c374bc4_produits (marchands_vendeurs) where actif;

-- Seuil de traction exigé à l'import, réglable : il vaut 1 pour commencer,
-- c'est-à-dire « au moins un autre marchand a testé cette référence ».
alter table app_e08c374bc4_parametres_import
  add column if not exists marchands_minimum integer not null default 1;

comment on column app_e08c374bc4_parametres_import.marchands_minimum is
  'Nombre minimum de marchands vendant déjà la référence pour qu''elle soit importable.';
