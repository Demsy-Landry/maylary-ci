-- Ce que l'import CJ jetait à chaque fois.
--
-- L'import ne gardait que le nom, le prix et LA PREMIÈRE image. Or la même
-- réponse contient jusqu'à douze photos, le poids net et emballé, le volume,
-- la matière, le type d'emballage, la description et la position tarifaire
-- déclarée à l'export chinois. Tout cela était reçu puis perdu.
--
-- Relevé avant : 58 articles pro, 58 avec exactement une photo, 2 avec un
-- poids, 0 avec une description.

alter table public.app_e08c374bc4_produits
  add column if not exists video_url text,
  add column if not exists code_sh_fournisseur text;

comment on column public.app_e08c374bc4_produits.video_url is
  'Vidéo de démonstration du fournisseur. Sur un article technique, elle vend mieux que six photos.';

-- CE CODE VAUT PLUS QU'IL N'EN A L'AIR
--
-- CJ rend un code SH avec chaque fiche : celui sous lequel la marchandise sort
-- de Chine. Ce n'est PAS une classification ivoirienne et il ne remplace pas
-- Le Déclarant — c'est le fournisseur qui l'a saisi, pour son propre export,
-- et il se trompe parfois.
--
-- Mais classer une marchandise à partir d'une position déjà proposée demande
-- de la VÉRIFIER ; la classer à partir de rien demande de la chercher. Le
-- Déclarant travaillera donc sur une hypothèse au lieu d'une page blanche, et
-- l'écart entre le code du fournisseur et celui qu'on retient est lui-même une
-- information.
--
-- Le suffixe `_fournisseur` existe pour qu'aucun écran ne le confonde avec une
-- classification de la maison.
comment on column public.app_e08c374bc4_produits.code_sh_fournisseur is
  'Position tarifaire déclarée par le fournisseur à l''export chinois. Point de départ pour la classification, JAMAIS une classification retenue : c''est Le Déclarant qui tranche.';

-- `cloth` manquait au traducteur à côté de `fabric`, et se voyait sur deux
-- fiches. Trois termes voisins sont ajoutés en même temps : ils reviendront au
-- prochain import, et corriger la table une fois vaut mieux que corriger deux
-- fiches à la main.
create or replace function public.app_e08c374bc4_traduire_terme(p_terme text)
returns text language sql immutable set search_path to 'pg_catalog' as $function$
  select coalesce(
    (select t.fr from (values
      ('plastic','plastique'), ('metal','métal'), ('others','autres'), ('other','autre'),
      ('stainless steel','acier inoxydable'), ('steel','acier'), ('iron','fer'),
      ('aluminum','aluminium'), ('aluminium','aluminium'), ('alloy','alliage'),
      ('copper','cuivre'), ('zinc','zinc'), ('brass','laiton'), ('titanium','titane'),
      ('cotton','coton'), ('polyester','polyester'), ('nylon','nylon'),
      ('fabric','tissu'), ('cloth','tissu'), ('textile','textile'),
      ('linen','lin'), ('wool','laine'), ('velvet','velours'), ('silk','soie'),
      ('leather','cuir'), ('pu leather','cuir synthétique'), ('rubber','caoutchouc'),
      ('silicone','silicone'), ('wood','bois'), ('bamboo','bambou'), ('mdf','panneau MDF'),
      ('glass','verre'), ('ceramic','céramique'), ('porcelain','porcelaine'),
      ('paper','papier'), ('cardboard','carton'),
      ('acrylic','acrylique'), ('sponge','éponge'), ('foam','mousse'),
      ('pvc','PVC'), ('abs','ABS'), ('pp','polypropylène'), ('pe','polyéthylène'),
      ('tpu','TPU'), ('eva','EVA'), ('resin','résine'), ('silica gel','gel de silice'),
      ('carbon fiber','fibre de carbone'), ('crystal','cristal'),
      ('carton','carton'), ('cartons','carton'), ('box','boîte'), ('boxes','boîte'),
      ('opp bag','sachet OPP'), ('opp bags','sachet OPP'),
      ('poly bag','sachet plastique'), ('poly bags','sachet plastique'),
      ('plastic bag','sachet plastique'), ('plastic bags','sachet plastique'),
      ('pe bag','sachet polyéthylène'), ('pe bags','sachet polyéthylène'),
      ('paper bag','sachet papier'), ('paper bags','sachet papier'),
      ('bubble bag','sachet à bulles'), ('bubble bags','sachet à bulles'),
      ('woven bag','sac tissé'), ('blister','blister'),
      ('paper box','boîte carton'), ('color box','boîte imprimée'),
      ('gift box','coffret cadeau'), ('bag','sachet'), ('bags','sachet'),
      ('none','sans emballage'), ('bulk','en vrac')
    ) as t(en, fr) where t.en = lower(btrim(p_terme))),
    btrim(p_terme));
$function$;
