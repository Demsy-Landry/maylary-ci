-- Poids et encombrement : la donnée qui manquait
-- ----------------------------------------------
-- Le fret aérien se facture au poids, le maritime au plus grand des deux entre
-- le volume et le poids. Sans ces deux mesures, aucun calcul maritime n'est
-- possible. Le fournisseur les expose ; on les conserve à l'import.
alter table app_e08c374bc4_produits
  add column if not exists poids_unitaire_g numeric,
  add column if not exists volume_unitaire_cm3 numeric;

comment on column app_e08c374bc4_produits.poids_unitaire_g is
  'Poids emballé d''une pièce, en grammes, tel que déclaré par le fournisseur.';
comment on column app_e08c374bc4_produits.volume_unitaire_cm3 is
  'Volume emballé d''une pièce, en cm³. Sert au calcul du fret maritime.';

-- Campagnes de groupage
-- ---------------------
-- Une campagne est une expédition consolidée : plusieurs commandes voyagent
-- dans le même envoi, ce qui divise le coût unitaire.
--
-- Le tarif est saisi par l'administrateur d'après le devis de son transitaire :
-- il n'est pas deviné. Il est figé à l'ouverture et ne change plus, pour que le
-- prix annoncé au client reste celui qu'il paiera.
create table if not exists app_e08c374bc4_campagnes_groupage (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  libelle text not null,
  pays_origine text not null default 'CN',
  mode_transport text not null default 'maritime'
    check (mode_transport in ('maritime', 'aerien', 'routier')),
  tarif_par_m3_fcfa numeric not null,
  tarif_par_tonne_fcfa numeric not null,
  frais_fixes_expedition_fcfa numeric not null default 0,
  volume_minimum_m3 numeric not null default 1,
  volume_capacite_m3 numeric,
  date_ouverture date not null default current_date,
  date_cloture date not null,
  delai_acheminement_jours integer,
  statut text not null default 'ouverte'
    check (statut in ('brouillon', 'ouverte', 'cloturee', 'expediee', 'livree', 'annulee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_cloture >= date_ouverture)
);

comment on table app_e08c374bc4_campagnes_groupage is
  'Expédition consolidée. Le tarif provient du devis du transitaire et reste figé : le prix annoncé au client est celui qu''il paiera.';

alter table app_e08c374bc4_campagnes_groupage enable row level security;

create policy campagnes_admin_tout on app_e08c374bc4_campagnes_groupage
  for all to authenticated
  using (app_e08c374bc4_is_admin())
  with check (app_e08c374bc4_is_admin());

-- Les clients voient les campagnes ouvertes, sans le détail des tarifs.
create or replace view app_e08c374bc4_campagnes_groupage_public as
  select id, reference, libelle, pays_origine, mode_transport,
         date_ouverture, date_cloture, delai_acheminement_jours, statut
    from app_e08c374bc4_campagnes_groupage
   where statut in ('ouverte', 'cloturee', 'expediee');

grant select on app_e08c374bc4_campagnes_groupage_public to anon, authenticated;

create trigger campagnes_touch
  before update on app_e08c374bc4_campagnes_groupage
  for each row execute function app_e08c374bc4_set_updated_at();
