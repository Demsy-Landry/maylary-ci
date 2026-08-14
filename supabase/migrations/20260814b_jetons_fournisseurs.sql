-- Un jeton d'accès fournisseur ne se redemande pas à chaque recherche.
--
-- CJ Dropshipping limite la création de jetons à environ un toutes les cinq
-- minutes par compte. Tant que seul l'administrateur cherchait, depuis un
-- écran, la contrainte ne se voyait pas. À partir du moment où Le Déclarant
-- cherche pour un client — donc potentiellement plusieurs fois par minute —
-- redemander un jeton à chaque appel condamne la fonctionnalité dès le
-- deuxième client.
--
-- Le jeton est donc mis en cache ici, partagé par tous les appels, et
-- renouvelé seulement à l'approche de son échéance.
--
-- La table n'est accessible à personne : ni anon, ni authenticated. Seule la
-- clé de service, qui n'est pas soumise à RLS, la lit et l'écrit. Un jeton
-- d'accès fournisseur est un secret au même titre qu'une clé d'API.

create table if not exists app_e08c374bc4_jetons_fournisseurs (
  fournisseur text primary key,
  jeton       text not null,
  expire_le   timestamptz not null,
  obtenu_le   timestamptz not null default now()
);

comment on table app_e08c374bc4_jetons_fournisseurs is
  'Cache des jetons d''accès aux API fournisseurs. Aucune politique de lecture : seule la clé de service y accède.';

alter table app_e08c374bc4_jetons_fournisseurs enable row level security;
-- Aucune politique n'est créée volontairement : RLS activée sans politique
-- ferme la table à tout rôle applicatif.

revoke all on table app_e08c374bc4_jetons_fournisseurs from anon, authenticated;
