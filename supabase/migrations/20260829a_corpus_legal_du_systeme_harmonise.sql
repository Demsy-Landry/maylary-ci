-- Le socle juridique du classement tarifaire : les Règles Générales
-- Interprétatives et les Notes légales de Section et de Chapitre.
--
-- POURQUOI
--
-- Les classements enregistrés dans app_e08c374bc4_classements_reference
-- s'appuient sur des RGI et sur des Notes de Section ou de Chapitre. Jusqu'ici
-- ces textes n'étaient nulle part dans la base : ils étaient récités. Un
-- classement dont le fondement n'est pas consultable n'est pas défendable
-- devant un contentieux douanier — et il n'est pas vérifiable par nous non
-- plus.
--
-- D'OÙ VIENT LE TEXTE
--
-- De l'UEMOA elle-même, c'est-à-dire du même organe que le Règlement
-- N°02/2022/CM/UEMOA qui porte notre TEC. Deux canaux, parce que l'UEMOA ne
-- publie pas tout de la même façon :
--
--   - en pages web (e-docucenter.uemoa.int) : les RGI, les Notes des Sections
--     I à VIII et celles des Chapitres 1 à 43 ;
--   - en PDF, un par Section : les Sections IX à XXI, donc les Chapitres 44 à
--     97 — ceux de notre catalogue (61 vêtements, 64 chaussures, 71
--     bijouterie, 85 électrique, 94 meubles, 96 divers).
--
-- Le texte des PDF est extrait par la fonction app_e08c374bc4_sh_pdf : la base
-- ne sait pas lire un PDF, `pg_net` traite la réponse comme du texte et jette
-- les octets binaires.
--
-- CE QUI EST GARANTI
--
-- Chaque ligne porte `url_source` et `releve_le` : on peut toujours retourner
-- à la source et confronter. Le chargement a été suivi d'un contrôle
-- machine — début et fin de chaque texte retrouvés dans le document d'origine.
--
-- Ce fichier crée la structure. Le contenu, lui, vient d'un relevé daté chez
-- l'UEMOA : il se recharge en rejouant la collecte, pas en rejouant ce
-- fichier.

-- ---------------------------------------------------------------------------
-- Les Règles Générales pour l'interprétation du Système Harmonisé
-- ---------------------------------------------------------------------------

create table if not exists app_e08c374bc4_sh_regles_interpretation (
  numero      text primary key,
  ordre       smallint not null unique,
  texte       text not null,
  portee      text not null check (portee in ('positions', 'sous-positions')),
  source      text not null,
  url_source  text not null,
  -- Quand une seconde publication officielle a été confrontée au texte, on dit
  -- laquelle, et on consigne tout écart au lieu de le taire.
  corroboration       text,
  url_corroboration   text,
  ecart_entre_sources text,
  releve_le   timestamptz not null default now()
);

comment on table app_e08c374bc4_sh_regles_interpretation is
  'Règles Générales pour l''interprétation du Système Harmonisé, texte intégral, relevé sur la publication officielle de l''UEMOA.';
comment on column app_e08c374bc4_sh_regles_interpretation.ecart_entre_sources is
  'Différence de rédaction constatée avec la source de corroboration. NULL = les deux publications disent la même chose au mot près.';

-- ---------------------------------------------------------------------------
-- Les Notes légales de Section et de Chapitre
-- ---------------------------------------------------------------------------

create table if not exists app_e08c374bc4_sh_notes_legales (
  id         uuid primary key default gen_random_uuid(),
  portee     text not null check (portee in ('section', 'chapitre')),
  section    text,
  chapitre   smallint,
  intitule   text not null,
  texte      text not null,
  source     text not null,
  url_source text not null,
  releve_le  timestamptz not null default now(),
  -- Une note de Section n'a pas de chapitre, une note de Chapitre pas de
  -- section : sans NULLS NOT DISTINCT, Postgres laisserait passer les doublons,
  -- puisqu'il tient deux NULL pour différents.
  constraint sh_notes_legales_unicite unique nulls not distinct (portee, section, chapitre),
  constraint sh_notes_legales_coherence check (
    (portee = 'section'  and section is not null and chapitre is null) or
    (portee = 'chapitre' and chapitre is not null)
  )
);

comment on table app_e08c374bc4_sh_notes_legales is
  'Notes légales de Section et de Chapitre du Système Harmonisé, texte intégral, relevé sur la publication officielle de l''UEMOA.';

create index if not exists sh_notes_legales_chapitre_idx
  on app_e08c374bc4_sh_notes_legales (chapitre) where chapitre is not null;

-- ---------------------------------------------------------------------------
-- La matière première : le texte brut des PDF, avant découpage
-- ---------------------------------------------------------------------------
--
-- On garde la matière première séparée du produit fini. Si le découpage se
-- révèle mauvais, on le refait à partir d'ici sans retourner chercher les
-- documents chez l'UEMOA.

create table if not exists app_e08c374bc4_sh_pdf_texte (
  url         text primary key,
  section     text not null,
  pages       int,
  octets      int,
  texte       text not null,
  recupere_le timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Qui lit, qui écrit
-- ---------------------------------------------------------------------------

alter table app_e08c374bc4_sh_regles_interpretation enable row level security;
alter table app_e08c374bc4_sh_notes_legales          enable row level security;
alter table app_e08c374bc4_sh_pdf_texte              enable row level security;

-- Le droit est public : tout le monde le lit. Seul un administrateur l'écrit.
create policy sh_regles_lecture on app_e08c374bc4_sh_regles_interpretation
  for select to anon, authenticated using (true);
create policy sh_regles_ecriture on app_e08c374bc4_sh_regles_interpretation
  for all to authenticated
  using ((select app_e08c374bc4_is_admin())) with check ((select app_e08c374bc4_is_admin()));

create policy sh_notes_lecture on app_e08c374bc4_sh_notes_legales
  for select to anon, authenticated using (true);
create policy sh_notes_ecriture on app_e08c374bc4_sh_notes_legales
  for all to authenticated
  using ((select app_e08c374bc4_is_admin())) with check ((select app_e08c374bc4_is_admin()));

-- La matière première, elle, reste au personnel : c'est du texte de travail,
-- pas la référence publiée.
create policy sh_pdf_texte_admin on app_e08c374bc4_sh_pdf_texte
  for all to authenticated
  using ((select app_e08c374bc4_is_admin())) with check ((select app_e08c374bc4_is_admin()));
