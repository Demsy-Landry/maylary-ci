-- Traçabilité de la commande passée chez le fournisseur.
--
-- Le prix de vente est figé au paiement du client : ces colonnes servent à
-- constater ce que la commande a réellement coûté, jamais à recalculer ce que
-- le client doit.
alter table app_e08c374bc4_commandes_gp
  add column if not exists cout_fournisseur_usd numeric,
  add column if not exists envoye_fournisseur_le timestamptz,
  add column if not exists erreur_fournisseur text,
  add column if not exists url_suivi text;

comment on column app_e08c374bc4_commandes_gp.cout_fournisseur_usd is
  'Montant réellement facturé par le fournisseur (marchandise + transport).';
comment on column app_e08c374bc4_commandes_gp.erreur_fournisseur is
  'Dernier motif d''échec de transmission, conservé pour que l''admin sache quoi corriger.';

-- Une commande ne doit jamais partir deux fois chez le fournisseur : la
-- référence renvoyée par celui-ci est donc unique côté base, indépendamment de
-- la prudence du code applicatif.
create unique index if not exists app_e08c374bc4_commandes_gp_ref_fournisseur_uniq
  on app_e08c374bc4_commandes_gp (reference_fournisseur)
  where reference_fournisseur is not null;

-- Jeton d'accès au fournisseur, partagé par toutes les fonctions.
--
-- Le fournisseur ne délivre un jeton qu'une fois toutes les 300 secondes et en
-- plafonne le nombre total. Demander un jeton neuf à chaque invocation faisait
-- échouer les appels rapprochés sous un message trompeur : « fournisseur
-- injoignable », alors que c'est nous qui frappions trop souvent à la porte.
--
-- Le jeton est valable une quinzaine de jours : il se conserve.
create table if not exists app_e08c374bc4_cj_jeton (
  id smallint primary key default 1 check (id = 1),
  access_token text not null,
  expire_le timestamptz not null,
  obtenu_le timestamptz not null default now()
);

alter table app_e08c374bc4_cj_jeton enable row level security;

-- Aucune politique : le jeton n'est lisible que par la clé de service, donc
-- uniquement depuis le serveur. Il ne doit jamais atteindre un navigateur.
comment on table app_e08c374bc4_cj_jeton is
  'Jeton fournisseur mis en cache. Aucune politique RLS : accès réservé au serveur.';
