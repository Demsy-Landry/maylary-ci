-- Le corpus tarifaire TEC UEMOA — le référentiel qui manquait.
--
-- Schéma conforme au § 4.3 du document de référence, au préfixe près : toutes
-- les tables de Maylary portent `app_e08c374bc4_`, et rompre la convention pour
-- un seul module coûterait plus cher que de la suivre.
--
-- Les données viennent des trois PDF du fondateur, extraits du Bulletin
-- Officiel Spécial TEC UEMOA janvier 2023 (Règlement N°02/2022/CM/UEMOA). Le
-- fichier déposé dans `docs/reference/TEC_DD_par_code_HS.tsv` fait foi : il est
-- versionné avec le code, et l'import se rejoue à l'identique depuis lui —
-- 6 298 codes, zéro doublon, 95 chapitres.
create table if not exists app_e08c374bc4_tec_dd_reference (
  code_hs          text primary key,          -- format 10 chiffres UEMOA
  designation      text not null,
  unite_us         text,
  taux_dd          numeric(5,2) not null check (taux_dd >= 0 and taux_dd <= 100),
  -- Déductible du taux, mais stockée : c'est la catégorie que le TEC nomme, et
  -- un déclarant raisonne en catégories.
  categorie        smallint check (categorie between 0 and 4),
  -- « a_verifier » signale les lignes dont l'unité ou la désignation ne
  -- s'interprète pas sans risque d'inventer. Elles restent consultables, mais
  -- l'écran doit le dire.
  statut           text not null default 'actif' check (statut in ('actif', 'obsolete', 'a_verifier')),
  source_reglement text not null default 'Règlement N°02/2022/CM/UEMOA',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists app_e08c374bc4_tec_chapitre_idx
  on app_e08c374bc4_tec_dd_reference (left(code_hs, 2));
create index if not exists app_e08c374bc4_tec_position_idx
  on app_e08c374bc4_tec_dd_reference (left(code_hs, 4));

-- Recherche par mots : c'est ainsi qu'un déclarant cherche quand il ne connaît
-- pas le code. Le français est déclaré explicitement, sinon les accents et les
-- pluriels ne se réduisent pas.
create index if not exists app_e08c374bc4_tec_texte_idx
  on app_e08c374bc4_tec_dd_reference
  using gin (to_tsvector('french', designation));

-- Recherche par fragment, pour les fautes de frappe et les mots partiels.
create extension if not exists pg_trgm;
create index if not exists app_e08c374bc4_tec_trigramme_idx
  on app_e08c374bc4_tec_dd_reference using gin (designation gin_trgm_ops);

alter table app_e08c374bc4_tec_dd_reference enable row level security;

-- Référentiel public : ce n'est pas une donnée personnelle, et c'est le service
-- rendu à la profession. Un transitaire qui vient vérifier un taux découvre
-- Maylary.
drop policy if exists tec_lecture on app_e08c374bc4_tec_dd_reference;
create policy tec_lecture on app_e08c374bc4_tec_dd_reference
  for select to anon, authenticated using (true);

drop policy if exists tec_ecriture on app_e08c374bc4_tec_dd_reference;
create policy tec_ecriture on app_e08c374bc4_tec_dd_reference
  for all to authenticated
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

-- L'ancienne table de positions, posée avant de disposer du corpus, n'a plus
-- lieu d'être : deux référentiels du même objet finiraient par diverger.
drop table if exists app_e08c374bc4_positions_tarifaires cascade;

-- ---------------------------------------------------------------------------
-- Import du corpus
-- ---------------------------------------------------------------------------
-- Le fichier versionné est récupéré depuis le dépôt et analysé en base. Le
-- détour par le dépôt n'en est pas un : le fichier fait foi, il est relu par
-- git, et l'import se rejoue à l'identique le jour d'une mise à jour du tarif.
--
--   select net.http_get(
--     'https://raw.githubusercontent.com/Demsy-Landry/maylary-ci/main/'
--     || 'docs/reference/TEC_DD_par_code_HS.tsv',
--     timeout_milliseconds := 60000);
--
--   with lignes as (
--     select trim(both e'\r' from l) as l
--     from net._http_response r, regexp_split_to_table(r.content, e'\n') as l
--     where r.id = <identifiant de la requête> and l <> '' and l not like 'code_hs%'
--   ), champs as (select string_to_array(l, e'\t') as c from lignes)
--   insert into app_e08c374bc4_tec_dd_reference
--     (code_hs, designation, unite_us, taux_dd, categorie, statut)
--   select c[1], c[2], nullif(c[3], ''), c[4]::numeric,
--          nullif(c[5], '')::smallint, c[6]
--   from champs
--   on conflict (code_hs) do update set
--     designation = excluded.designation, unite_us = excluded.unite_us,
--     taux_dd = excluded.taux_dd, categorie = excluded.categorie,
--     statut = excluded.statut, updated_at = now();
