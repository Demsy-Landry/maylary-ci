-- Grille de prix dégressive par quantité
-- --------------------------------------
-- Chaque palier correspond à un devis de transport réellement obtenu pour cette
-- quantité-là : le fret comporte une part fixe par colis que seul le volume
-- dilue, et un changement de transporteur au-delà d'un certain poids peut au
-- contraire faire remonter le prix unitaire. Un palier ne se calcule pas, il se
-- mesure.
create table if not exists app_e08c374bc4_paliers_prix (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references app_e08c374bc4_produits(id) on delete cascade,
  quantite_min integer not null check (quantite_min > 0),
  cout_fret_unitaire_fcfa numeric not null,
  cout_assurance_unitaire_fcfa numeric not null,
  cout_revient_unitaire_fcfa numeric not null,
  prix_unitaire_fcfa numeric not null,
  fret_transporteur text,
  fret_delai text,
  created_at timestamptz not null default now(),
  unique (produit_id, quantite_min)
);

create index if not exists idx_paliers_produit
  on app_e08c374bc4_paliers_prix (produit_id, quantite_min);

alter table app_e08c374bc4_paliers_prix enable row level security;

-- Les paliers portent nos coûts : ils ne sortent que par la vue publique.
create policy paliers_admin_tout on app_e08c374bc4_paliers_prix
  for all to authenticated
  using (app_e08c374bc4_is_admin())
  with check (app_e08c374bc4_is_admin());

create or replace view app_e08c374bc4_paliers_prix_public as
  select pal.produit_id, pal.quantite_min, pal.prix_unitaire_fcfa
    from app_e08c374bc4_paliers_prix pal
    join app_e08c374bc4_produits p on p.id = pal.produit_id
   where p.actif = true;

grant select on app_e08c374bc4_paliers_prix_public to anon, authenticated;

-- Réglages
-- --------
alter table app_e08c374bc4_parametres_import
  add column if not exists paliers_quantite integer[] not null default array[1, 5, 20, 50];
comment on column app_e08c374bc4_parametres_import.paliers_quantite is
  'Quantités pour lesquelles un devis de transport est demandé. Chaque appel coûte une seconde de quota transporteur.';

-- Au-delà de ce montant, la commande minimum d'un bien de consommation n'est
-- plus crédible : le client paie surtout du transport.
alter table app_e08c374bc4_parametres_import
  add column if not exists plafond_commande_minimum_fcfa numeric not null default 100000;
comment on column app_e08c374bc4_parametres_import.plafond_commande_minimum_fcfa is
  'Montant maximum acceptable pour une commande minimum (prix du palier d''entrée x quantité minimum).';

alter table app_e08c374bc4_produits
  add column if not exists paliers_calcules_le timestamptz;
comment on column app_e08c374bc4_produits.paliers_calcules_le is
  'Date du dernier calcul de la grille de prix dégressive.';
