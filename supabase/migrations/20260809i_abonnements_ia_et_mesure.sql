-- L'accès à l'IA devient un service payant, et il se mesure.
--
-- Deux tables et une fonction, parce que deux questions se posent séparément :
-- « cet utilisateur a-t-il le droit ? » et « combien cela nous coûte-t-il ? ».
-- La seconde est la plus importante au démarrage : sans elle, on fixe un prix
-- au jugé et on découvre la marge trois mois plus tard.

create table if not exists app_e08c374bc4_formules_ia (
  code                text primary key,
  libelle             text not null,
  prix_mensuel_fcfa   integer not null default 0 check (prix_mensuel_fcfa >= 0),
  requetes_par_jour   integer not null check (requetes_par_jour >= 0),
  -- Le grand public découvre l'outil ; le transitaire l'use toute la journée.
  avantages           text[] not null default '{}',
  ordre               integer not null default 100,
  actif               boolean not null default true
);

insert into app_e08c374bc4_formules_ia (code, libelle, prix_mensuel_fcfa, requetes_par_jour, avantages, ordre) values
  ('decouverte', 'Découverte', 0, 3, array[
     'Recherche de position tarifaire illimitée',
     'Calcul des droits et taxes illimité',
     '3 questions par jour au Déclarant'], 10),
  ('pro', 'Professionnel', 0, 50, array[
     'Tout Découverte',
     '50 questions par jour au Déclarant',
     'Classification assistée des marchandises',
     'Historique conservé et exportable'], 20),
  ('cabinet', 'Cabinet', 0, 300, array[
     'Tout Professionnel',
     '300 questions par jour, partagées entre les postes',
     'Chiffrage complet import et export',
     'Assistance prioritaire'], 30)
on conflict (code) do nothing;

comment on column app_e08c374bc4_formules_ia.prix_mensuel_fcfa is
  'À zéro tant que le fondateur n''a pas arrêté sa grille. Un prix se fixe sur un coût mesuré, pas sur une intuition — la table usage_ia est là pour ça.';

alter table app_e08c374bc4_formules_ia enable row level security;
drop policy if exists "Formules IA lisibles" on app_e08c374bc4_formules_ia;
create policy "Formules IA lisibles" on app_e08c374bc4_formules_ia for select using (true);
drop policy if exists "Formules IA modifiables par l'admin" on app_e08c374bc4_formules_ia;
create policy "Formules IA modifiables par l'admin" on app_e08c374bc4_formules_ia for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

create table if not exists app_e08c374bc4_abonnements_ia (
  utilisateur_id  uuid primary key references auth.users (id) on delete cascade,
  formule         text not null references app_e08c374bc4_formules_ia (code),
  -- Nul = sans échéance. Une date passée ramène au palier découverte sans
  -- qu'on ait à repasser sur les lignes.
  actif_jusquau   date,
  cree_le         timestamptz not null default now(),
  note            text
);

alter table app_e08c374bc4_abonnements_ia enable row level security;
drop policy if exists "Chacun lit son abonnement" on app_e08c374bc4_abonnements_ia;
create policy "Chacun lit son abonnement" on app_e08c374bc4_abonnements_ia for select
  using (utilisateur_id = auth.uid() or app_e08c374bc4_is_admin());
drop policy if exists "Abonnements modifiables par l'admin" on app_e08c374bc4_abonnements_ia;
create policy "Abonnements modifiables par l'admin" on app_e08c374bc4_abonnements_ia for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

-- Ce que chaque appel a réellement consommé. Sans cette table, « combien coûte
-- un client ? » n'a pas de réponse, et toute grille tarifaire est un pari.
create table if not exists app_e08c374bc4_usage_ia (
  id              bigserial primary key,
  utilisateur_id  uuid references auth.users (id) on delete set null,
  service         text not null check (service in ('agent', 'classification')),
  modele          text,
  jetons_entree   integer,
  jetons_sortie   integer,
  outils_appeles  integer not null default 0,
  aboutie         boolean not null default true,
  cree_le         timestamptz not null default now()
);

create index if not exists app_e08c374bc4_usage_ia_jour_idx
  on app_e08c374bc4_usage_ia (cree_le desc);

alter table app_e08c374bc4_usage_ia enable row level security;
drop policy if exists "Usage IA réservé à l'admin" on app_e08c374bc4_usage_ia;
create policy "Usage IA réservé à l'admin" on app_e08c374bc4_usage_ia for select
  using (app_e08c374bc4_is_admin());

/** Ce qu'il reste à l'utilisateur, pour l'afficher avant qu'il ne dépense. */
create or replace function app_e08c374bc4_quota_ia()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_formule app_e08c374bc4_formules_ia;
  v_code    text;
  v_faites  integer;
begin
  if auth.uid() is null then
    select * into v_formule from app_e08c374bc4_formules_ia where code = 'decouverte';
    return jsonb_build_object('connecte', false, 'formule', 'decouverte',
      'plafond', v_formule.requetes_par_jour, 'restant', 0);
  end if;

  select a.formule into v_code from app_e08c374bc4_abonnements_ia a
  where a.utilisateur_id = auth.uid()
    and (a.actif_jusquau is null or a.actif_jusquau >= current_date);

  select * into v_formule from app_e08c374bc4_formules_ia
  where code = coalesce(v_code, 'decouverte');

  select count(*) into v_faites from app_e08c374bc4_usage_ia
  where utilisateur_id = auth.uid() and aboutie and cree_le >= date_trunc('day', now());

  return jsonb_build_object(
    'connecte', true,
    'formule', v_formule.code,
    'libelle', v_formule.libelle,
    'plafond', v_formule.requetes_par_jour,
    'faites', v_faites,
    'restant', greatest(0, v_formule.requetes_par_jour - v_faites));
end;
$$;

-- Note du 10 août 2026 : le GRANT qui suivait ici a été retiré par la migration
-- 20260810a. `quota_ia` n'est appelée par aucun écran ; la laisser ouverte
-- n'apportait rien et élargissait la surface.
