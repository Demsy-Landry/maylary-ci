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

grant select on app_e08c374bc4_avis_public to anon, authenticated;
grant select on app_e08c374bc4_notes_produits to anon, authenticated;
