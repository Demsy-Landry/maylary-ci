-- ============================================================
-- Marketplace : les entreprises vendent, Maylary facture le service
-- ============================================================
--
-- Modèle économique : l'inscription et la publication sont gratuites. Maylary
-- ne prélève qu'une commission sur les ventes réellement conclues. Aucune
-- barrière à l'entrée pour le vendeur, aucun revenu pour Maylary tant qu'il n'a
-- rien apporté.
--
-- Cette migration reprend, dans l'ordre d'application, les quatre migrations
-- passées en production : marketplace_vendeurs_et_commission,
-- marketplace_produits_commission_reversements, marketplace_contraintes_produits
-- et vendeurs_garde_fou_explicite.

create table if not exists app_e08c374bc4_parametres_marketplace (
  id smallint primary key default 1 check (id = 1),
  taux_commission_defaut numeric not null default 0.10,
  -- Délai sous lequel Maylary reverse au vendeur après livraison. Affiché au
  -- vendeur : un délai annoncé et tenu vaut mieux qu'un délai flou.
  delai_reversement_jours integer not null default 7,
  commission_minimum_fcfa numeric not null default 0,
  updated_at timestamptz not null default now()
);
insert into app_e08c374bc4_parametres_marketplace (id) values (1) on conflict (id) do nothing;

-- ---- L'entreprise vendeuse ---------------------------------------------
create table if not exists app_e08c374bc4_vendeurs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  reference_publique text unique,

  nom_entreprise text not null,
  secteur_id uuid references app_e08c374bc4_secteurs(id),
  description text,
  logo_url text,
  ville text,
  adresse text,
  telephone text not null,
  email_contact text,

  -- Pièces d'identification de l'entreprise. Exigées pour valider, jamais pour
  -- s'inscrire : on n'arrête pas quelqu'un à la porte.
  registre_commerce text,
  numero_contribuable text,

  mode_reversement text not null default 'mobile_money'
    check (mode_reversement in ('mobile_money', 'virement')),
  compte_reversement text,
  titulaire_compte text,

  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'valide', 'suspendu', 'refuse')),
  motif_statut text,
  -- Null : le vendeur suit le taux général. Renseigné : accord particulier.
  taux_commission numeric check (taux_commission is null or (taux_commission >= 0 and taux_commission < 1)),

  valide_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_e08c374bc4_vendeurs_statut_idx on app_e08c374bc4_vendeurs (statut);

create or replace function app_e08c374bc4_ref_vendeur()
returns trigger language plpgsql security definer set search_path = public as $$
declare suivant integer;
begin
  if new.reference_publique is null then
    select coalesce(max(substring(reference_publique from 10)::integer), 0) + 1
      into suivant
      from app_e08c374bc4_vendeurs
     where reference_publique like 'VEN-' || to_char(now(), 'YYYY') || '-%';
    new.reference_publique := 'VEN-' || to_char(now(), 'YYYY') || '-' || lpad(suivant::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists app_e08c374bc4_vendeurs_ref on app_e08c374bc4_vendeurs;
create trigger app_e08c374bc4_vendeurs_ref before insert on app_e08c374bc4_vendeurs
  for each row execute function app_e08c374bc4_ref_vendeur();

-- Le vendeur du compte courant, lu sans déclencher les politiques de la table
-- elle-même : sans cela, toute politique qui s'y réfère boucle.
create or replace function app_e08c374bc4_mon_vendeur_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from app_e08c374bc4_vendeurs where user_id = auth.uid();
$$;

create or replace function app_e08c374bc4_vendeur_valide(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_e08c374bc4_vendeurs where id = p_id and statut = 'valide');
$$;

alter table app_e08c374bc4_vendeurs enable row level security;

drop policy if exists vendeurs_inscription on app_e08c374bc4_vendeurs;
create policy vendeurs_inscription on app_e08c374bc4_vendeurs
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists vendeurs_lecture on app_e08c374bc4_vendeurs;
create policy vendeurs_lecture on app_e08c374bc4_vendeurs
  for select to authenticated using (user_id = auth.uid() or app_e08c374bc4_is_admin());

drop policy if exists vendeurs_maj on app_e08c374bc4_vendeurs;
create policy vendeurs_maj on app_e08c374bc4_vendeurs
  for update to authenticated
  using (user_id = auth.uid() or app_e08c374bc4_is_admin())
  with check (user_id = auth.uid() or app_e08c374bc4_is_admin());

-- Garde-fou sur les champs réservés. Deux points, tous deux appris à l'épreuve :
--
--  1. sans jeton, `auth.uid()` est nul et `is_admin()` répond faux. Refuser cet
--     appel bloquait le serveur lui-même, alors que la clé de service contourne
--     déjà RLS : le refus n'ajoutait aucune sécurité, seulement une panne ;
--
--  2. une modification refusée doit échouer franchement. Annuler en silence
--     laissait croire qu'un vendeur était suspendu alors que son catalogue
--     restait en vitrine.
create or replace function app_e08c374bc4_vendeur_champs_reserves()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or app_e08c374bc4_is_admin() then
    return new;
  end if;

  if new.statut is distinct from old.statut
     or new.motif_statut is distinct from old.motif_statut
     or new.taux_commission is distinct from old.taux_commission
     or new.valide_le is distinct from old.valide_le
     or new.user_id is distinct from old.user_id then
    raise exception
      'Statut, commission et titulaire du compte relèvent de Maylary.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end $$;

drop trigger if exists app_e08c374bc4_vendeurs_reserve on app_e08c374bc4_vendeurs;
create trigger app_e08c374bc4_vendeurs_reserve before update on app_e08c374bc4_vendeurs
  for each row execute function app_e08c374bc4_vendeur_champs_reserves();

alter table app_e08c374bc4_parametres_marketplace enable row level security;
drop policy if exists marketplace_lecture on app_e08c374bc4_parametres_marketplace;
create policy marketplace_lecture on app_e08c374bc4_parametres_marketplace
  for select to authenticated using (true);
drop policy if exists marketplace_admin on app_e08c374bc4_parametres_marketplace;
create policy marketplace_admin on app_e08c374bc4_parametres_marketplace
  for update to authenticated using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

-- ---- Rattachement des produits -----------------------------------------
alter table app_e08c374bc4_produits
  add column if not exists vendeur_id uuid references app_e08c374bc4_vendeurs(id) on delete cascade;

comment on column app_e08c374bc4_produits.vendeur_id is
  'Entreprise propriétaire de l''article. Null : article vendu par Maylary.';

create index if not exists app_e08c374bc4_produits_vendeur_idx on app_e08c374bc4_produits (vendeur_id);

drop policy if exists produits_vendeur_select on app_e08c374bc4_produits;
create policy produits_vendeur_select on app_e08c374bc4_produits
  for select to authenticated
  using (vendeur_id is not null and vendeur_id = app_e08c374bc4_mon_vendeur_id());

-- Publier suppose d'être validé : la validation est la promesse faite à
-- l'acheteur, elle ne peut pas être contournée en publiant avant.
drop policy if exists produits_vendeur_insert on app_e08c374bc4_produits;
create policy produits_vendeur_insert on app_e08c374bc4_produits
  for insert to authenticated
  with check (
    vendeur_id is not null
    and vendeur_id = app_e08c374bc4_mon_vendeur_id()
    and app_e08c374bc4_vendeur_valide(vendeur_id)
  );

drop policy if exists produits_vendeur_update on app_e08c374bc4_produits;
create policy produits_vendeur_update on app_e08c374bc4_produits
  for update to authenticated
  using (vendeur_id is not null and vendeur_id = app_e08c374bc4_mon_vendeur_id())
  with check (vendeur_id is not null and vendeur_id = app_e08c374bc4_mon_vendeur_id());

drop policy if exists produits_vendeur_delete on app_e08c374bc4_produits;
create policy produits_vendeur_delete on app_e08c374bc4_produits
  for delete to authenticated
  using (vendeur_id is not null and vendeur_id = app_e08c374bc4_mon_vendeur_id());

-- Un vendeur ne fixe ni sa provenance ni ses coûts d'import : ces champs
-- appartiennent à la chaîne d'approvisionnement de Maylary. Sans ce filtre, un
-- vendeur pouvait publier un article maquillé en import CJ.
create or replace function app_e08c374bc4_produit_champs_maylary()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if app_e08c374bc4_is_admin() or new.vendeur_id is null then
    return new;
  end if;
  new.source_donnee := 'vendeur_local';
  new.reference_externe := null;
  new.reference_variante := null;
  new.prix_achat_fcfa := null;
  new.cout_fret_fcfa := null;
  new.cout_assurance_fcfa := null;
  new.incoterm_achat := null;
  new.fret_source := null;
  new.fret_transporteur := null;
  if tg_op = 'UPDATE' then
    new.vendeur_id := old.vendeur_id;
  end if;
  return new;
end $$;

drop trigger if exists app_e08c374bc4_produits_champs_maylary on app_e08c374bc4_produits;
create trigger app_e08c374bc4_produits_champs_maylary
  before insert or update on app_e08c374bc4_produits
  for each row execute function app_e08c374bc4_produit_champs_maylary();

alter table app_e08c374bc4_produits
  drop constraint if exists app_e08c374bc4_produits_source_donnee_check;
alter table app_e08c374bc4_produits
  add constraint app_e08c374bc4_produits_source_donnee_check
  check (source_donnee in ('manuel', 'import_cj_dropshipping', 'vendeur_local'));

-- Sur l'espace professionnel, l'entreprise vendeuse tient le rôle de l'enseigne :
-- elle a un nom, une ville, un logo et une fiche publique.
alter table app_e08c374bc4_produits
  drop constraint if exists app_e08c374bc4_produits_espace_coherence_check;
alter table app_e08c374bc4_produits
  add constraint app_e08c374bc4_produits_espace_coherence_check
  check (
    (espace = 'pro' and (enseigne_id is not null or vendeur_id is not null))
    or (espace = 'grand_public' and categorie_gp_id is not null)
  );

-- ---- Vitrine publique ---------------------------------------------------
-- Un article de vendeur ne paraît que si son vendeur est validé. Suspendre un
-- vendeur retire donc tout son catalogue de la vitrine d'un seul geste.
drop view if exists app_e08c374bc4_produits_public;

create view app_e08c374bc4_produits_public
with (security_invoker = false) as
select p.id, p.enseigne_id, p.nom, p.description, p.prix_unitaire_fcfa, p.photos,
       p.categorie, p.unite_vente, p.stock_disponible, p.delai_livraison_estime,
       p.actif, p.espace, p.categorie_gp_id, p.quantite_minimum,
       case
         when p.source_donnee = 'import_cj_dropshipping' then 'import_international'
         when p.vendeur_id is not null then 'vendeur_local'
         else 'local'
       end as origine,
       p.vendeur_id,
       v.nom_entreprise as vendeur_nom,
       v.ville as vendeur_ville,
       v.logo_url as vendeur_logo,
       p.created_at, p.updated_at
from app_e08c374bc4_produits p
left join app_e08c374bc4_vendeurs v on v.id = p.vendeur_id
where p.actif = true
  and (p.vendeur_id is null or v.statut = 'valide');

grant select on app_e08c374bc4_produits_public to anon, authenticated;

-- Ce que le public peut savoir d'un vendeur. Les coordonnées de reversement et
-- les pièces légales n'y figurent pas.
create or replace view app_e08c374bc4_vendeurs_public
with (security_invoker = false) as
select id, reference_publique, nom_entreprise, secteur_id, description,
       logo_url, ville, created_at
from app_e08c374bc4_vendeurs
where statut = 'valide';

grant select on app_e08c374bc4_vendeurs_public to anon, authenticated;

-- ---- Commission, figée au moment de la vente ----------------------------
alter table app_e08c374bc4_lignes_commande_gp
  add column if not exists vendeur_id uuid references app_e08c374bc4_vendeurs(id),
  add column if not exists taux_commission_applique numeric,
  add column if not exists commission_fcfa numeric,
  add column if not exists net_vendeur_fcfa numeric;

comment on column app_e08c374bc4_lignes_commande_gp.commission_fcfa is
  'Service Maylary sur cette ligne, figé à la commande. Null : article vendu par Maylary.';

create index if not exists app_e08c374bc4_lignes_cmd_vendeur_idx
  on app_e08c374bc4_lignes_commande_gp (vendeur_id);

-- Le calcul est fait en base plutôt que par le navigateur : le client ne doit
-- pas pouvoir décider de la commission qu'il déclenche.
create or replace function app_e08c374bc4_calculer_commission()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_vendeur uuid;
  v_taux numeric;
  v_minimum numeric;
begin
  select vendeur_id into v_vendeur
    from app_e08c374bc4_produits where id = new.produit_id;

  if v_vendeur is null then
    new.vendeur_id := null;
    new.taux_commission_applique := null;
    new.commission_fcfa := null;
    new.net_vendeur_fcfa := null;
    return new;
  end if;

  select coalesce(v.taux_commission, m.taux_commission_defaut), m.commission_minimum_fcfa
    into v_taux, v_minimum
    from app_e08c374bc4_vendeurs v
    cross join app_e08c374bc4_parametres_marketplace m
   where v.id = v_vendeur and m.id = 1;

  new.vendeur_id := v_vendeur;
  new.taux_commission_applique := v_taux;
  new.commission_fcfa := greatest(round(new.sous_total * v_taux), coalesce(v_minimum, 0));
  -- La commission ne peut jamais dépasser la vente : un plancher mal réglé ne
  -- doit pas produire un net négatif pour le vendeur.
  new.commission_fcfa := least(new.commission_fcfa, new.sous_total);
  new.net_vendeur_fcfa := new.sous_total - new.commission_fcfa;
  return new;
end $$;

drop trigger if exists app_e08c374bc4_lignes_commission on app_e08c374bc4_lignes_commande_gp;
create trigger app_e08c374bc4_lignes_commission
  before insert on app_e08c374bc4_lignes_commande_gp
  for each row execute function app_e08c374bc4_calculer_commission();

-- Le vendeur voit les lignes qui le concernent, et rien d'autre de la commande.
drop policy if exists lignes_vendeur_select on app_e08c374bc4_lignes_commande_gp;
create policy lignes_vendeur_select on app_e08c374bc4_lignes_commande_gp
  for select to authenticated
  using (vendeur_id is not null and vendeur_id = app_e08c374bc4_mon_vendeur_id());

-- ---- Reversements -------------------------------------------------------
create table if not exists app_e08c374bc4_reversements (
  id uuid primary key default gen_random_uuid(),
  reference_publique text unique,
  vendeur_id uuid not null references app_e08c374bc4_vendeurs(id) on delete cascade,
  montant_fcfa numeric not null check (montant_fcfa > 0),
  periode_debut date,
  periode_fin date,
  mode_reglement text,
  reference_reglement text,
  statut text not null default 'a_payer' check (statut in ('a_payer', 'paye', 'annule')),
  commentaire text,
  paye_le timestamptz,
  created_at timestamptz not null default now()
);

alter table app_e08c374bc4_reversements enable row level security;

drop policy if exists reversements_vendeur_lit on app_e08c374bc4_reversements;
create policy reversements_vendeur_lit on app_e08c374bc4_reversements
  for select to authenticated
  using (vendeur_id = app_e08c374bc4_mon_vendeur_id() or app_e08c374bc4_is_admin());

drop policy if exists reversements_admin on app_e08c374bc4_reversements;
create policy reversements_admin on app_e08c374bc4_reversements
  for all to authenticated
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());
