-- Une seule grille de remise, pour la Boutique comme pour l'Espace Pro.
--
-- POURQUOI
--
-- Il n'existait aucune remise de volume. Mesuré le 2 septembre : sur les 217
-- articles porteurs d'une grille, 209 n'avaient qu'un seul palier — et un seul
-- palier n'est pas une grille. Sur les 164 articles du Pro, 128 n'en avaient
-- aucun. Un commerçant achetait donc cinquante pièces au prix d'une seule,
-- marge de détail comprise, et devait poser la sienne par-dessus la nôtre.
--
-- La remise ne dépend pas de la porte par laquelle le client entre. Un
-- revendeur achète aussi bien depuis la Boutique que depuis l'Espace Pro, et
-- rien ne justifie qu'il paie plus cher parce qu'il a cliqué au mauvais
-- endroit. La grille est donc UNIQUE et s'applique aux deux espaces.
--
-- CE QUI EST STOCKÉ ICI, ET POURQUOI PAS DANS LE CODE
--
-- Des taux de marge se règlent ; ils ne se redéploient pas. Écrits en dur, le
-- moindre ajustement commercial aurait demandé une mise en production, et
-- personne d'autre que le développeur n'aurait pu y toucher.
--
-- Cette table porte les DEUX choses à la fois, et c'est délibéré : les seuils
-- de quantité et la marge de chaque seuil. Les séparer aurait créé deux
-- réglages à tenir d'accord, et ils auraient fini par diverger — on cote le
-- transport à des quantités qui ne sont plus celles où le prix change.

create table if not exists public.app_e08c374bc4_grille_remise (
  -- À partir de combien de pièces ce palier s'applique. Sert deux fois : il
  -- fixe la remise, et il dit au transporteur à quelle quantité coter.
  quantite_min integer primary key check (quantite_min > 0),

  -- La marge, pas la remise. C'est ce que le calcul de prix consomme
  -- directement : 0.40 signifie coût de revient majoré de 40 %.
  taux_marge numeric not null check (taux_marge >= 0 and taux_marge <= 5),

  libelle text,
  actif boolean not null default true
);

comment on table public.app_e08c374bc4_grille_remise is
  'Grille de remise dégressive, unique et commune à la Boutique et à l''Espace '
  'Pro. Chaque ligne fixe la marge appliquée à partir d''une quantité, et ces '
  'mêmes quantités sont celles auxquelles le transport est coté.';

comment on column public.app_e08c374bc4_grille_remise.taux_marge is
  'Marge appliquée au coût de revient à partir de cette quantité. 0.30 = +30 %. '
  'C''est une marge, pas un pourcentage de rabais.';

comment on column public.app_e08c374bc4_grille_remise.actif is
  'Un palier désactivé n''est ni coté chez le transporteur ni proposé au '
  'client. Permet de retirer un seuil sans perdre son réglage.';

insert into public.app_e08c374bc4_grille_remise (quantite_min, taux_marge, libelle)
values
  (1,   0.40, 'Détail — 1 à 9 pièces'),
  (10,  0.30, 'Demi-gros — 10 à 49 pièces'),
  (50,  0.22, 'Gros — 50 à 199 pièces'),
  (200, 0.15, 'Grossiste — 200 pièces et plus')
on conflict (quantite_min) do update
  set taux_marge = excluded.taux_marge,
      libelle = excluded.libelle,
      actif = true;

alter table public.app_e08c374bc4_grille_remise enable row level security;

-- La grille se lit par tout le monde : c'est un argument de vente, et le
-- client doit pouvoir voir à partir de quelle quantité le prix baisse. Elle ne
-- s'écrit que par l'administration. Aucune de ces lignes ne révèle un coût de
-- revient — seulement une marge appliquée, pas la base sur laquelle elle porte.
drop policy if exists grille_remise_lisible on public.app_e08c374bc4_grille_remise;
create policy grille_remise_lisible
  on public.app_e08c374bc4_grille_remise for select using (true);

drop policy if exists grille_remise_admin on public.app_e08c374bc4_grille_remise;
create policy grille_remise_admin
  on public.app_e08c374bc4_grille_remise for all
  using (public.app_e08c374bc4_is_admin())
  with check (public.app_e08c374bc4_is_admin());

-- `parametres_import.paliers_quantite` portait jusqu'ici les quantités à coter.
-- Il n'est plus lu : la grille ci-dessus en est la seule source. La colonne est
-- laissée en place — la supprimer casserait toute fonction encore déployée qui
-- la sélectionne — mais elle ne décide plus de rien.
comment on column public.app_e08c374bc4_parametres_import.paliers_quantite is
  'OBSOLÈTE depuis le 3 septembre. Les quantités cotées viennent désormais de '
  'app_e08c374bc4_grille_remise. Conservée pour ne pas casser une fonction '
  'déployée qui la lirait encore ; ne plus s''y fier.';
