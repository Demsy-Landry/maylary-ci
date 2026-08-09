-- Classification tarifaire assistée : historique, quota, et la règle du corpus.
--
-- Reprise de la structure de résultat de l'application d'origine, qui est bonne :
-- un déclarant n'a pas besoin d'un code, il a besoin de quoi le défendre —
-- la section, le chapitre, la position, la sous-position, les caractéristiques
-- retenues, les RGI appliquées, et les notes utiles au dossier.
--
-- Ce qui change, et c'est tout le sujet : dans la version d'origine le modèle
-- rendait le code ET le taux, et son propre « niveau de confiance ». Un modèle
-- qui s'attribue une confiance élevée sur un code qu'il vient d'inventer ne dit
-- rien d'utile. Ici le taux ne vient jamais du modèle : le code proposé est
-- confronté au corpus TEC, et c'est le corpus qui donne le taux — ou personne.
-- « Vérifié au TEC » est un fait vérifiable, pas une opinion du modèle.

create table if not exists app_e08c374bc4_classifications_hs (
  id                uuid primary key default gen_random_uuid(),
  utilisateur_id    uuid not null references auth.users (id) on delete cascade,
  description       text not null check (length(btrim(description)) between 3 and 2000),

  -- Ce que le modèle propose.
  code_propose      text,
  section           text,
  chapitre          text,
  position_sh       text,
  sous_position     text,
  caracteristiques  text,
  raisonnement_rgi  text,
  notes_declarant   text,
  modele            text not null,

  -- Ce que le corpus confirme. `taux_dd` est nul quand le code proposé n'est
  -- pas en base : c'est la règle du § 5.2, tenue jusque dans le stockage.
  verifie_en_base   boolean not null default false,
  designation_tec   text,
  unite_us          text,
  taux_dd           numeric(5,2),

  cree_le           timestamptz not null default now()
);

create index if not exists app_e08c374bc4_classifications_hs_utilisateur_idx
  on app_e08c374bc4_classifications_hs (utilisateur_id, cree_le desc);

alter table app_e08c374bc4_classifications_hs enable row level security;

drop policy if exists "Chacun lit ses classifications" on app_e08c374bc4_classifications_hs;
create policy "Chacun lit ses classifications"
  on app_e08c374bc4_classifications_hs for select
  using (utilisateur_id = auth.uid() or app_e08c374bc4_is_admin());

drop policy if exists "Chacun supprime ses classifications" on app_e08c374bc4_classifications_hs;
create policy "Chacun supprime ses classifications"
  on app_e08c374bc4_classifications_hs for delete
  using (utilisateur_id = auth.uid() or app_e08c374bc4_is_admin());

-- L'écriture passe par la fonction edge, qui utilise la clé de service : aucune
-- politique d'insertion n'est ouverte au client. Une classification ne doit pas
-- pouvoir être fabriquée depuis le navigateur, sinon l'historique ne prouve
-- plus rien.

-- Quota : chaque appel coûte de l'argent au fondateur, et la page est publique.
create table if not exists app_e08c374bc4_parametres_classification (
  id                        boolean primary key default true check (id),
  classifications_par_jour  integer not null default 20 check (classifications_par_jour > 0),
  modele                    text not null default 'claude-opus-5',
  actif                     boolean not null default true
);

insert into app_e08c374bc4_parametres_classification (id) values (true)
on conflict (id) do nothing;

alter table app_e08c374bc4_parametres_classification enable row level security;

drop policy if exists "Paramètres de classification lisibles" on app_e08c374bc4_parametres_classification;
create policy "Paramètres de classification lisibles"
  on app_e08c374bc4_parametres_classification for select using (true);

drop policy if exists "Paramètres de classification modifiables par l'admin" on app_e08c374bc4_parametres_classification;
create policy "Paramètres de classification modifiables par l'admin"
  on app_e08c374bc4_parametres_classification for update
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

/**
 * Compte ce qu'il reste à l'utilisateur pour la journée. Appelée par l'écran
 * avant d'afficher le formulaire, et par la fonction edge avant de dépenser.
 */
create or replace function app_e08c374bc4_quota_classification()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_param  app_e08c374bc4_parametres_classification;
  v_faites integer;
begin
  select * into v_param from app_e08c374bc4_parametres_classification limit 1;

  if auth.uid() is null then
    return jsonb_build_object(
      'connecte', false, 'restant', 0, 'plafond', v_param.classifications_par_jour,
      'actif', v_param.actif);
  end if;

  select count(*) into v_faites
  from app_e08c374bc4_classifications_hs
  where utilisateur_id = auth.uid() and cree_le >= date_trunc('day', now());

  return jsonb_build_object(
    'connecte', true,
    'plafond',  v_param.classifications_par_jour,
    'faites',   v_faites,
    'restant',  greatest(0, v_param.classifications_par_jour - v_faites),
    'actif',    v_param.actif
  );
end;
$$;

grant execute on function app_e08c374bc4_quota_classification() to anon, authenticated;
