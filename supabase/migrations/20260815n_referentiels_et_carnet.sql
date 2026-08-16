-- ---------------------------------------------------------------------------
-- Ce qui se choisit dans une liste ne doit pas se taper.
--
-- Le fondateur : « il y a des cases qui n'ont pas besoin d'être réécrites mais
-- sélectionnées dans une liste » — et il ajoute une mémorisation des
-- intervenants « pour une saisie prochaine rapide et intelligente ».
--
-- Le motif va plus loin qu'un confort : une case de déclaration tapée à la
-- main est FAUSSE une fois sur dix. « Cote d'ivoire », « CIV », « RCI »
-- désignent le même pays et se ressaisissent différemment dans SYDAM. Le code
-- ISO, lui, ne se discute pas.
--
-- CE QUI EXISTAIT DÉJÀ, ET QU'ON NE REFAIT PAS
--   regimes_douaniers     81 régimes, avec leur sens et leur mention
--   parametres_incoterm   7 incoterms, avec la charge du fret et des droits
--
-- Le contenu applique est identique à celui des migrations
-- `referentiels_declaration` et `memoire_intervenants`, reprises ici pour que
-- le dépôt reste la source de vérité.
-- ---------------------------------------------------------------------------

create table if not exists app_e08c374bc4_pays (
  code text primary key, nom text not null,
  uemoa boolean not null default false, cedeao boolean not null default false,
  courant boolean not null default false
);
alter table app_e08c374bc4_pays enable row level security;
drop policy if exists "Pays lisibles" on app_e08c374bc4_pays;
create policy "Pays lisibles" on app_e08c374bc4_pays for select using (true);
revoke all on app_e08c374bc4_pays from anon, authenticated;
grant select on app_e08c374bc4_pays to anon, authenticated;

-- Les bureaux de douane de Côte d'Ivoire.
--
-- AVERTISSEMENT QUI COMPTE : les NOMS sont ceux des bureaux réels. Les CODES
-- SYDAM ne sont PAS renseignés — je ne les connais pas avec certitude, et un
-- code de bureau inventé fait rejeter une déclaration au dépôt. La colonne
-- existe, elle est vide, et `code_verifie` dit qu'elle attend confirmation.
-- Tant qu'elle l'est, c'est le nom qui fait valeur.
create table if not exists app_e08c374bc4_bureaux_douane (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique, code text, code_verifie boolean not null default false,
  ville text, type text, ordre integer not null default 100,
  actif boolean not null default true
);
alter table app_e08c374bc4_bureaux_douane enable row level security;
drop policy if exists "Bureaux lisibles" on app_e08c374bc4_bureaux_douane;
create policy "Bureaux lisibles" on app_e08c374bc4_bureaux_douane for select using (actif);
drop policy if exists "Bureaux admin" on app_e08c374bc4_bureaux_douane;
create policy "Bureaux admin" on app_e08c374bc4_bureaux_douane for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());
revoke all on app_e08c374bc4_bureaux_douane from anon, authenticated;
grant select on app_e08c374bc4_bureaux_douane to anon, authenticated;

-- Le franc CFA porte son ancrage : 655,957 pour un euro, taux légal fixe. Ce
-- n'est pas une cotation du jour et ne doit jamais être rafraîchi depuis une
-- API de change — c'est une parité de droit.
create table if not exists app_e08c374bc4_monnaies (
  code text primary key, nom text not null,
  parite_xof_fixe numeric, courant boolean not null default false,
  ordre integer not null default 100
);
alter table app_e08c374bc4_monnaies enable row level security;
drop policy if exists "Monnaies lisibles" on app_e08c374bc4_monnaies;
create policy "Monnaies lisibles" on app_e08c374bc4_monnaies for select using (true);
revoke all on app_e08c374bc4_monnaies from anon, authenticated;
grant select on app_e08c374bc4_monnaies to anon, authenticated;

-- Modes de transport, natures de transaction, types de colis, types de
-- déclaration : codage du Document Administratif Unique dont SYDAM dérive.
create table if not exists app_e08c374bc4_nomenclatures (
  famille text not null, code text not null, libelle text not null,
  aide text, ordre integer not null default 100,
  primary key (famille, code)
);
alter table app_e08c374bc4_nomenclatures enable row level security;
drop policy if exists "Nomenclatures lisibles" on app_e08c374bc4_nomenclatures;
create policy "Nomenclatures lisibles" on app_e08c374bc4_nomenclatures for select using (true);
revoke all on app_e08c374bc4_nomenclatures from anon, authenticated;
grant select on app_e08c374bc4_nomenclatures to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Le carnet d'adresses de la déclaration.
--
-- Un transitaire retravaille avec les mêmes vingt fournisseurs. Retaper
-- l'adresse complète à chaque déclaration est une perte de temps ET une source
-- de fautes : trois orthographes du même exportateur dans trois déclarations,
-- c'est trois occasions de question au bureau.
--
-- Chaque compte a son carnet. Un client ne voit pas les fournisseurs d'un
-- autre — ce serait lui livrer le fichier commercial de son voisin. La règle
-- est dans RLS, pas dans l'écran. Vérifié : le compte B lit « [] » là où A
-- voit sa fiche, et l'anonyme reçoit 401.
-- ---------------------------------------------------------------------------
create table if not exists app_e08c374bc4_intervenants (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references auth.users(id) on delete cascade,
  role text not null, nom text not null,
  adresse text, ville text, pays text, identifiant text,
  telephone text, email text, note text,
  utilisations integer not null default 1,
  derniere_utilisation timestamptz not null default now(),
  cree_le timestamptz not null default now()
);
create unique index if not exists app_e08c374bc4_intervenants_unicite
  on app_e08c374bc4_intervenants (utilisateur_id, role, lower(btrim(nom)));
create index if not exists app_e08c374bc4_intervenants_tri
  on app_e08c374bc4_intervenants (utilisateur_id, role, derniere_utilisation desc);
alter table app_e08c374bc4_intervenants enable row level security;
drop policy if exists "Carnet du propriétaire" on app_e08c374bc4_intervenants;
create policy "Carnet du propriétaire" on app_e08c374bc4_intervenants for select
  using (utilisateur_id = auth.uid());
drop policy if exists "Carnet écrit par son propriétaire" on app_e08c374bc4_intervenants;
create policy "Carnet écrit par son propriétaire" on app_e08c374bc4_intervenants for insert
  with check (utilisateur_id = auth.uid());
drop policy if exists "Carnet modifié par son propriétaire" on app_e08c374bc4_intervenants;
create policy "Carnet modifié par son propriétaire" on app_e08c374bc4_intervenants for update
  using (utilisateur_id = auth.uid()) with check (utilisateur_id = auth.uid());
drop policy if exists "Carnet supprimé par son propriétaire" on app_e08c374bc4_intervenants;
create policy "Carnet supprimé par son propriétaire" on app_e08c374bc4_intervenants for delete
  using (utilisateur_id = auth.uid());
revoke all on app_e08c374bc4_intervenants from anon, authenticated;
grant select, delete on app_e08c374bc4_intervenants to authenticated;

-- L'écriture passe par une fonction : le propriétaire est posé ici, jamais
-- choisi par l'appelant, et un même nom saisi deux fois met à jour la fiche
-- plutôt que d'en créer une seconde. Sans cela, le carnet se remplit de
-- doublons et la suggestion devient inutilisable au bout d'un mois.
create or replace function app_e08c374bc4_retenir_intervenant(
  p_role text, p_nom text, p_adresse text default null, p_ville text default null,
  p_pays text default null, p_identifiant text default null,
  p_telephone text default null, p_email text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_moi uuid := auth.uid(); v_id uuid; v_nom text := btrim(coalesce(p_nom, ''));
begin
  if v_moi is null then
    raise exception 'Connectez-vous.' using errcode = '42501';
  end if;
  if v_nom = '' then
    return jsonb_build_object('retenu', false, 'motif', 'nom vide');
  end if;
  if p_role not in ('exportateur','importateur','declarant','transporteur') then
    raise exception 'Rôle inconnu : %', p_role using errcode = '22023';
  end if;

  insert into app_e08c374bc4_intervenants
    (utilisateur_id, role, nom, adresse, ville, pays, identifiant, telephone, email)
  values (v_moi, p_role, v_nom, nullif(btrim(coalesce(p_adresse,'')),''),
          nullif(btrim(coalesce(p_ville,'')),''), nullif(btrim(coalesce(p_pays,'')),''),
          nullif(btrim(coalesce(p_identifiant,'')),''), nullif(btrim(coalesce(p_telephone,'')),''),
          nullif(btrim(coalesce(p_email,'')),''))
  on conflict (utilisateur_id, role, lower(btrim(nom))) do update set
    -- On ne remplace que ce qui est renseigné : une saisie partielle ne doit
    -- pas effacer une adresse complète mémorisée la fois précédente.
    adresse     = coalesce(excluded.adresse, app_e08c374bc4_intervenants.adresse),
    ville       = coalesce(excluded.ville, app_e08c374bc4_intervenants.ville),
    pays        = coalesce(excluded.pays, app_e08c374bc4_intervenants.pays),
    identifiant = coalesce(excluded.identifiant, app_e08c374bc4_intervenants.identifiant),
    telephone   = coalesce(excluded.telephone, app_e08c374bc4_intervenants.telephone),
    email       = coalesce(excluded.email, app_e08c374bc4_intervenants.email),
    utilisations = app_e08c374bc4_intervenants.utilisations + 1,
    derniere_utilisation = now()
  returning id into v_id;

  return jsonb_build_object('retenu', true, 'id', v_id);
end; $$;
revoke all on function app_e08c374bc4_retenir_intervenant(text,text,text,text,text,text,text,text)
  from public, anon;
grant execute on function app_e08c374bc4_retenir_intervenant(text,text,text,text,text,text,text,text)
  to authenticated;
