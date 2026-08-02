-- Identifiant de variante chez le fournisseur
-- ------------------------------------------
-- La référence produit ne suffit pas : le stock se lit et la commande se passe
-- au niveau de la variante. Sans elle, ni vérification de disponibilité ni
-- expédition automatique.
alter table app_e08c374bc4_produits
  add column if not exists reference_variante text,
  add column if not exists stock_quantite integer,
  add column if not exists stock_verifie_le timestamptz;

comment on column app_e08c374bc4_produits.reference_variante is
  'Identifiant de variante chez le fournisseur (vid). Nécessaire au stock et à la commande.';
comment on column app_e08c374bc4_produits.stock_quantite is
  'Quantité disponible chez le fournisseur au dernier contrôle. Null = jamais vérifié.';
comment on column app_e08c374bc4_produits.stock_verifie_le is
  'Date du dernier contrôle de disponibilité. Un stock ancien ne vaut pas un stock connu.';

-- Suivi de l'expédition fournisseur
alter table app_e08c374bc4_commandes_gp
  add column if not exists reference_fournisseur text,
  add column if not exists numero_suivi text,
  add column if not exists transporteur_suivi text,
  add column if not exists statut_fournisseur text,
  add column if not exists suivi_maj_le timestamptz;

-- Sourcing sur demande
-- --------------------
-- Un client cherche un produit que le catalogue n'a pas. La demande est
-- transmise au fournisseur, qui recherche l'article et le cote. C'est le métier
-- de transitaire, appliqué au sourcing.
create table if not exists app_e08c374bc4_demandes_sourcing (
  id uuid primary key default gen_random_uuid(),
  reference_publique text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  designation text not null,
  lien_reference text,
  photos text[] not null default '{}',
  quantite_souhaitee integer not null default 1 check (quantite_souhaitee > 0),
  prix_cible_fcfa numeric,
  precisions text,
  statut text not null default 'nouvelle'
    check (statut in ('nouvelle','transmise','cotee','devis_envoye','acceptee','refusee','abandonnee')),
  reference_sourcing_fournisseur text,
  prix_source_usd numeric,
  delai_source_jours integer,
  commentaire_admin text,
  prix_propose_fcfa numeric,
  devis_envoye_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table app_e08c374bc4_demandes_sourcing enable row level security;

create policy sourcing_client_lit on app_e08c374bc4_demandes_sourcing
  for select to authenticated
  using (user_id = auth.uid() or app_e08c374bc4_is_admin());
create policy sourcing_client_cree on app_e08c374bc4_demandes_sourcing
  for insert to authenticated with check (user_id = auth.uid());
create policy sourcing_admin_gere on app_e08c374bc4_demandes_sourcing
  for update to authenticated
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

create index if not exists idx_sourcing_user on app_e08c374bc4_demandes_sourcing (user_id, created_at desc);
create index if not exists idx_sourcing_statut on app_e08c374bc4_demandes_sourcing (statut);

create trigger sourcing_touch before update on app_e08c374bc4_demandes_sourcing
  for each row execute function app_e08c374bc4_set_updated_at();

-- Référence lisible, sur le modèle des autres modules.
create or replace function app_e08c374bc4_set_sourcing_ref()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.reference_publique is null then
    new.reference_publique := 'SRC-' || to_char(now(), 'YYYY') || '-' ||
      lpad((select count(*) + 1 from app_e08c374bc4_demandes_sourcing
            where date_trunc('year', created_at) = date_trunc('year', now()))::text, 4, '0');
  end if;
  return new;
end; $$;

create trigger sourcing_ref before insert on app_e08c374bc4_demandes_sourcing
  for each row execute function app_e08c374bc4_set_sourcing_ref();
