-- Le même sac à main sur quatre rayons différents
--
-- CE QUE LE FONDATEUR A VU
--
-- Sur la page d'accueil, les rayons Montres, Sacs & Maroquinerie, Bébé &
-- Puériculture et Maison & Animalerie affichaient TOUS le même dessin de sac.
-- « Enlève-moi ça, ce n'est pas ce que je t'ai demandé. Tu as les images de CJ,
-- sers-t'en, ne me donne pas les trucs basiques. »
--
-- POURQUOI C'EST ARRIVÉ
--
-- Aucun rayon n'avait d'image : les six `image_url` étaient vides, les treize
-- secteurs sans photo. L'écran retombait donc sur un pictogramme choisi en
-- devinant un « secteur » à partir du NOM du rayon — et la devinette se
-- trompait quatre fois sur six.
--
-- Un pictogramme faux est pire qu'une case vide : il annonce des sacs à main
-- sous l'étiquette Montres, et le visiteur en conclut que la boutique est mal
-- tenue. Il a raison de le conclure.
--
-- CE QU'ON MET À LA PLACE
--
-- La photographie d'un article DU RAYON, prise dans le catalogue lui-même.
-- Le choix se fait sur le nombre de vues du produit : un fournisseur qui a
-- photographié son article douze fois l'a soigné, c'est le meilleur indicateur
-- disponible de la qualité du visuel. À nombre de vues égal, le plus cher — il
-- porte mieux un rayon qu'un accessoire à cinq cents francs.
--
-- Résultat : six rayons, six photos distinctes ; treize secteurs, treize photos
-- distinctes. Et le pictogramme de repli est retiré de l'écran d'accueil, pour
-- qu'aucune devinette ne puisse le ramener.

with meilleur as (
  select distinct on (p.categorie_gp_id) p.categorie_gp_id, p.photos[1] as photo
  from app_e08c374bc4_produits p
  where p.actif and p.categorie_gp_id is not null
    and coalesce(array_length(p.photos, 1), 0) > 0
  order by p.categorie_gp_id,
           coalesce(array_length(p.photos, 1), 0) desc,
           p.prix_unitaire_fcfa desc
)
update app_e08c374bc4_categories_gp c
set image_url = m.photo, updated_at = now()
from meilleur m
where c.id = m.categorie_gp_id;

with meilleur as (
  select distinct on (e.secteur_id) e.secteur_id, p.photos[1] as photo
  from app_e08c374bc4_produits p
  join app_e08c374bc4_enseignes e on e.id = p.enseigne_id
  where p.actif and coalesce(array_length(p.photos, 1), 0) > 0
  order by e.secteur_id,
           coalesce(array_length(p.photos, 1), 0) desc,
           p.prix_unitaire_fcfa desc
)
update app_e08c374bc4_secteurs s
set photos = array[m.photo], updated_at = now()
from meilleur m
where s.id = m.secteur_id;
