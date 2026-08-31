-- Le rangement de la boutique : huit fourre-tout deviennent quatorze rayons.
--
-- CE QUI N'ALLAIT PAS, MESURÉ AVANT DE TOUCHER À QUOI QUE CE SOIT
--
-- « Maison & Animalerie » comptait 29 articles : 13 meubles, 6 luminaires,
-- 4 rallonges électriques, 3 articles de cuisine, 1 armoire à outils, 1 miroir
-- de maquillage — et DEUX articles d'animalerie. Le nom du rayon décrivait 7 %
-- de son contenu.
--
-- « Mode & Accessoires » comptait 32 articles : 10 vêtements femme, 3 vêtements
-- homme, 5 bijoux, 11 articles de lunetterie, plus des divers. Quatre familles
-- sans rapport dans un seul rayon.
--
-- « Tech & Audio » était cohérent, à trois accessoires automobiles près.
--
-- POURQUOI C'EST UN VRAI DÉFAUT, ET PAS UNE QUESTION DE GOÛT
--
-- Un visiteur qui cherche une robe ne clique pas sur « Mode & Accessoires » en
-- espérant y trouver des lunettes de soleil et une bague. Il regarde le nom du
-- rayon, n'y reconnaît pas ce qu'il cherche, et s'en va. Un rayon mal nommé ne
-- cache pas seulement ses articles : il apprend au visiteur que la maison ne
-- sait pas ce qu'elle vend.
--
-- CE QUI A ÉTÉ FAIT
--
-- Trois rayons sont RENOMMÉS plutôt que recréés, pour que les liens déjà
-- partagés continuent de fonctionner — l'application adresse un rayon par son
-- identifiant, jamais par son nom :
--
--   « Tech & Audio »        -> « Tech, Audio & Téléphonie »
--   « Maison & Animalerie » -> « Maison, Cuisine & Déco »
--   « Mode & Accessoires »  -> « Lunettes de soleil »   (le gros du reliquat)
--
-- Six rayons sont créés : Vêtements femme, Vêtements homme, Vêtements enfant,
-- Bijoux, Meubles & Électroménager, Auto Moto & Vélo.
--
-- L'ORDRE D'AFFICHAGE SUIT UN PARCOURS, PAS L'ORDRE DE CRÉATION
--
-- On s'habille d'abord (1-4), on s'accessoirise ensuite (5-8), on prend soin de
-- soi (9), on équipe l'enfant (10), puis la maison et le véhicule (11-14).
--
-- AUCUNE MODIFICATION DE CODE N'A ÉTÉ NÉCESSAIRE
--
-- Vérifié avant d'agir : aucun nom de rayon n'est écrit en dur dans
-- l'application. `CatalogueGrandPublic` lit la table et trie par
-- `ordre_affichage`, `CatalogueCategorieGP` adresse le rayon par son
-- identifiant. Le rangement est donc une opération de données pure.

-- 1. Les rayons existants changent de nom et de rang.
update app_e08c374bc4_categories_gp set nom = 'Tech, Audio & Téléphonie', ordre_affichage = 11 where nom = 'Tech & Audio';
update app_e08c374bc4_categories_gp set nom = 'Maison, Cuisine & Déco',   ordre_affichage = 13 where nom = 'Maison & Animalerie';
update app_e08c374bc4_categories_gp set nom = 'Lunettes de soleil',       ordre_affichage = 7  where nom = 'Mode & Accessoires';
update app_e08c374bc4_categories_gp set ordre_affichage = 4  where nom = 'Lingerie & Nuit';
update app_e08c374bc4_categories_gp set ordre_affichage = 5  where nom = 'Sacs & Maroquinerie';
update app_e08c374bc4_categories_gp set ordre_affichage = 8  where nom = 'Montres';
update app_e08c374bc4_categories_gp set ordre_affichage = 9  where nom = 'Beauté & Soins';
update app_e08c374bc4_categories_gp set ordre_affichage = 10 where nom = 'Bébé & Puériculture';

-- 2. Les rayons manquants sont créés.
insert into app_e08c374bc4_categories_gp (nom, ordre_affichage, actif) values
  ('Vêtements femme', 1, true),
  ('Vêtements homme', 2, true),
  ('Vêtements enfant', 3, true),
  ('Bijoux', 6, true),
  ('Meubles & Électroménager', 12, true),
  ('Auto, Moto & Vélo', 14, true)
on conflict do nothing;

-- 3. Les articles rejoignent le rayon qui les décrit.
--    Le déplacement se fait par motif de NOM et non par identifiant : les noms
--    sont en français et stables, tandis que les identifiants changent d'une
--    base à l'autre. Chaque motif a été vérifié sur le contenu réel avant
--    d'être écrit.
do $$
declare
  v_femme   uuid := (select id from app_e08c374bc4_categories_gp where nom = 'Vêtements femme');
  v_homme   uuid := (select id from app_e08c374bc4_categories_gp where nom = 'Vêtements homme');
  v_bijoux  uuid := (select id from app_e08c374bc4_categories_gp where nom = 'Bijoux');
  v_lunette uuid := (select id from app_e08c374bc4_categories_gp where nom = 'Lunettes de soleil');
  v_montres uuid := (select id from app_e08c374bc4_categories_gp where nom = 'Montres');
  v_sacs    uuid := (select id from app_e08c374bc4_categories_gp where nom = 'Sacs & Maroquinerie');
  v_auto    uuid := (select id from app_e08c374bc4_categories_gp where nom = 'Auto, Moto & Vélo');
  v_meubles uuid := (select id from app_e08c374bc4_categories_gp where nom = 'Meubles & Électroménager');
  v_maison  uuid := (select id from app_e08c374bc4_categories_gp where nom = 'Maison, Cuisine & Déco');
  v_beaute  uuid := (select id from app_e08c374bc4_categories_gp where nom = 'Beauté & Soins');
begin
  update app_e08c374bc4_produits set categorie_gp_id = v_femme
  where categorie_gp_id = v_lunette
    and (nom like 'Brassière%' or nom like 'Ensemble de sport%' or nom like 'Ensemble de yoga%'
      or nom like 'Ensemble fitness%' or nom like 'Manteau%' or nom like 'Pull long%'
      or nom like 'Tailleur femme%');

  update app_e08c374bc4_produits set categorie_gp_id = v_homme
  where categorie_gp_id = v_lunette
    and (nom like 'Chemise homme%' or nom like 'Costume homme%' or nom like 'Veste polaire homme%');

  update app_e08c374bc4_produits set categorie_gp_id = v_bijoux
  where categorie_gp_id = v_lunette
    and (nom like 'Bague%' or nom like 'Boucles d''oreilles%' or nom like 'Bracelet homme%'
      or nom like 'Pendentif%');

  update app_e08c374bc4_produits set categorie_gp_id = v_montres
  where nom = 'Bracelet de montre sport en silicone';

  update app_e08c374bc4_produits set categorie_gp_id = v_sacs
  where nom like 'Coffret cadeau homme%';

  update app_e08c374bc4_produits set categorie_gp_id = v_auto
  where nom like 'Pince à lunettes pour pare-soleil%' or nom like 'Lunettes moto anti-vent%'
     or nom like 'Boîtier CarPlay%' or nom like 'Réfrigérateur-congélateur 12 V%'
     or nom like 'Compresseur portatif%' or nom like 'Support téléphone voiture%';

  update app_e08c374bc4_produits set categorie_gp_id = v_meubles
  where categorie_gp_id = v_maison
    and (nom like 'Armoire%' or nom like 'Buffet%' or nom like 'Colonne d''angle%'
      or nom like 'Meuble%' or nom like 'Niche d''intérieur%');

  update app_e08c374bc4_produits set categorie_gp_id = v_beaute
  where nom like 'Miroir de maquillage rond sur socle lumineux%';
end $$;

-- 4. Chaque nouveau rayon prend pour vignette la photo de son article le plus
--    revendu. On ne fabrique pas d'image : on réutilise une photo qu'on héberge
--    déjà et qui montre vraiment ce que le rayon contient.
update app_e08c374bc4_categories_gp c
set image_url = sub.photo
from (
  select distinct on (p.categorie_gp_id) p.categorie_gp_id, p.photos[1] as photo
  from app_e08c374bc4_produits p
  where p.actif and p.photos is not null and array_length(p.photos, 1) > 0
  order by p.categorie_gp_id, p.marchands_vendeurs desc nulls last
) sub
where c.id = sub.categorie_gp_id and c.image_url is null;
