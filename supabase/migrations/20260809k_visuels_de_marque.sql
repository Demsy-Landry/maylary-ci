-- Les visuels de marque deviennent une donnée, pas une constante du code.
--
-- Motif immédiat : les visuels sont produits dans Canva, et l'environnement de
-- développement ne peut pas joindre les hôtes Canva. Je les fais transiter par
-- le stockage Supabase, mais je ne peux pas les regarder. Mettre en production
-- une image que je n'ai jamais vue serait exactement ce que je refuse de faire
-- avec un taux de douane.
--
-- D'où l'interrupteur : chaque visuel naît inactif, l'application garde
-- l'existant tant qu'il l'est, et le fondateur bascule après avoir regardé.
-- Motif durable : il pourra changer un visuel sans redéploiement, ce qui est
-- la bonne granularité pour de l'image.

create table if not exists app_e08c374bc4_visuels_marque (
  cle       text primary key,
  libelle   text not null,
  url       text not null,
  -- Faux tant que personne n'a regardé. L'écran retombe alors sur l'existant.
  actif     boolean not null default false,
  source    text,
  note      text,
  maj_le    timestamptz not null default now()
);

insert into app_e08c374bc4_visuels_marque (cle, libelle, url, source, note) values
  ('accueil_hero',
   'Bandeau de la page d''accueil',
   'https://oubowmftzxpruckjzwuq.supabase.co/storage/v1/object/public/app_e08c374bc4_enseigne_logos/marque/maylary-group-accueil.png',
   'Canva — design DAHR0_xpyms',
   'Port d''Abidjan à l''heure dorée, silhouette d''une professionnelle au premier plan. Un dégradé sombre se pose par-dessus : la moitié gauche doit rester lisible sous le titre.'),
  ('logo_principal',
   'Logo MayLary Group',
   'https://oubowmftzxpruckjzwuq.supabase.co/storage/v1/object/public/app_e08c374bc4_enseigne_logos/marque/maylary-group-logo.png',
   'Canva — design DAHR0ziCbzQ',
   'Une femme et une fille dans l''univers logistique. À ne basculer qu''après vérification à petite taille : l''en-tête est le seul endroit où un visuel raté casse tout le site.')
on conflict (cle) do update set url = excluded.url, source = excluded.source, maj_le = now();

alter table app_e08c374bc4_visuels_marque enable row level security;
drop policy if exists "Visuels de marque lisibles" on app_e08c374bc4_visuels_marque;
create policy "Visuels de marque lisibles"
  on app_e08c374bc4_visuels_marque for select using (true);
drop policy if exists "Visuels de marque modifiables par l'admin" on app_e08c374bc4_visuels_marque;
create policy "Visuels de marque modifiables par l'admin"
  on app_e08c374bc4_visuels_marque for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());
