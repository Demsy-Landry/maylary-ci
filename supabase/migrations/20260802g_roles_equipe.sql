-- ============================================================
-- Rôles d'équipe : déléguer sans tout ouvrir
-- ============================================================
--
-- « admin » était tout ou rien. Confier les commandes à un associé lui donnait
-- aussi la main sur les marges, les taux de commission et les versements. À une
-- personne c'est tenable ; à trois, c'est le moyen le plus sûr de perdre le
-- contrôle de ses prix sans savoir qui a changé quoi.
--
--   proprietaire : tout, y compris l'argent et les réglages. Ne se délègue pas.
--   operations   : commandes, sourcing, vendeurs, import/export. Le quotidien.
--   catalogue    : import fournisseur et produits. Ni commandes ni versements.
alter table app_e08c374bc4_profiles
  add column if not exists role_equipe text
    check (role_equipe is null or role_equipe in ('proprietaire', 'operations', 'catalogue'));

comment on column app_e08c374bc4_profiles.role_equipe is
  'Rôle interne Maylary. Null pour un client. Ne vaut que si type_compte = admin.';

-- Les comptes admin existants deviennent propriétaires : la bascule ne retire
-- de droits à personne.
update app_e08c374bc4_profiles
   set role_equipe = 'proprietaire'
 where type_compte = 'admin' and role_equipe is null;

-- Rôle du compte courant, lu sans passer par les politiques de la table : une
-- politique qui interroge la table qu'elle protège boucle.
create or replace function app_e08c374bc4_role_equipe()
returns text language sql stable security definer set search_path = public as $$
  select role_equipe from app_e08c374bc4_profiles
   where user_id = auth.uid() and type_compte = 'admin';
$$;

-- Vrai pour le propriétaire seul — ou pour un appel serveur, déjà de confiance.
create or replace function app_e08c374bc4_est_proprietaire()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is null or app_e08c374bc4_role_equipe() = 'proprietaire';
$$;

create or replace function app_e08c374bc4_peut_operer()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is null
      or app_e08c374bc4_role_equipe() in ('proprietaire', 'operations');
$$;

-- ---- Ce qui touche à l'argent revient au propriétaire ---------------------
drop policy if exists marketplace_admin on app_e08c374bc4_parametres_marketplace;
create policy marketplace_admin on app_e08c374bc4_parametres_marketplace
  for update to authenticated
  using (app_e08c374bc4_est_proprietaire())
  with check (app_e08c374bc4_est_proprietaire());

drop policy if exists reversements_admin on app_e08c374bc4_reversements;
create policy reversements_admin on app_e08c374bc4_reversements
  for all to authenticated
  using (app_e08c374bc4_est_proprietaire())
  with check (app_e08c374bc4_est_proprietaire());

-- Les paramètres de coût commandent tous les prix. Toute l'équipe doit pouvoir
-- les lire — sinon l'écran d'import ne sait plus calculer — mais seul le
-- propriétaire les modifie.
drop policy if exists app_e08c374bc4_parametres_import_admin_all on app_e08c374bc4_parametres_import;
drop policy if exists parametres_import_admin_update on app_e08c374bc4_parametres_import;
drop policy if exists parametres_import_proprietaire_update on app_e08c374bc4_parametres_import;
create policy parametres_import_proprietaire_update on app_e08c374bc4_parametres_import
  for update to authenticated
  using (app_e08c374bc4_est_proprietaire())
  with check (app_e08c374bc4_est_proprietaire());

-- Un membre d'équipe ne se promeut pas lui-même, et ne promeut personne.
create or replace function app_e08c374bc4_profil_champs_reserves()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or app_e08c374bc4_est_proprietaire() then
    return new;
  end if;
  if new.type_compte is distinct from old.type_compte
     or new.role_equipe is distinct from old.role_equipe then
    raise exception 'Seul le propriétaire attribue les rôles de l''équipe.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

drop trigger if exists app_e08c374bc4_profils_reserve on app_e08c374bc4_profiles;
create trigger app_e08c374bc4_profils_reserve before update on app_e08c374bc4_profiles
  for each row execute function app_e08c374bc4_profil_champs_reserves();

-- Sans cette politique, le propriétaire ne pouvait modifier que sa propre fiche
-- et l'équipe restait ingérable.
drop policy if exists profiles_proprietaire_update on app_e08c374bc4_profiles;
create policy profiles_proprietaire_update on app_e08c374bc4_profiles
  for update to authenticated
  using (app_e08c374bc4_est_proprietaire())
  with check (app_e08c374bc4_est_proprietaire());
