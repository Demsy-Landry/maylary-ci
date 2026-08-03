-- Ce que la boutique montre d'un avis, et rien de plus.
--
-- La table `avis_articles` porte `user_id` et `commande_id` : les exposer
-- reviendrait à publier qui a acheté quoi. Ces deux vues n'en laissent rien
-- passer — le nom est réduit au prénom et à l'initiale, et l'identifiant de
-- commande ne sort pas.

-- Nom d'affichage : « Konan A. ». Un prénom seul suffit à donner un visage à
-- l'avis ; le nom complet exposerait un client par article acheté.
create or replace function app_e08c374bc4_nom_abrege(nom text)
returns text
language sql
immutable
-- `search_path` figé : sans lui, un schéma placé devant `public` par l'appelant
-- détournerait les fonctions utilisées ici.
set search_path = pg_catalog, public
as $$
  select case
    when nom is null or btrim(nom) = '' then 'Client Maylary'
    when position(' ' in btrim(nom)) = 0 then btrim(nom)
    else split_part(btrim(nom), ' ', 1) || ' ' ||
         upper(left(split_part(btrim(nom), ' ', 2), 1)) || '.'
  end;
$$;

create or replace view app_e08c374bc4_avis_public as
select a.id,
       a.produit_id,
       a.note,
       a.commentaire,
       a.created_at,
       app_e08c374bc4_nom_abrege(p.nom_complet) as auteur
from app_e08c374bc4_avis_articles a
left join app_e08c374bc4_profiles p on p.user_id = a.user_id
where a.publie;

-- Agrégat pour les vignettes de catalogue : une liste de 40 produits ne doit
-- pas rapatrier tous les commentaires pour afficher quatre étoiles.
create or replace view app_e08c374bc4_notes_produits as
select produit_id,
       round(avg(note), 1) as note_moyenne,
       count(*) as nb_avis
from app_e08c374bc4_avis_articles
where publie
group by produit_id;

-- `notes_produits` n'agrège que des avis déjà publics : elle s'exécute avec les
-- droits de l'appelant et rentre donc dans le régime RLS normal.
--
-- `avis_public` reste en `security definer`, et c'est délibéré : elle joint la
-- table des profils pour composer le nom d'affichage, que la RLS des profils
-- réserve à leur propriétaire. En droits de l'appelant, tous les avis
-- s'afficheraient sous « Client Maylary ». Le seul champ qui en sort est le
-- prénom suivi d'une initiale — ni identifiant, ni commande, ni nom complet.
alter view app_e08c374bc4_notes_produits set (security_invoker = true);

grant select on app_e08c374bc4_avis_public to anon, authenticated;
grant select on app_e08c374bc4_notes_produits to anon, authenticated;
