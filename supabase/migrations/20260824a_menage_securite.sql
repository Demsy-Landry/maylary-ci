-- Deux corrections relevées par l'audit, l'une inoffensive, l'autre pas tout à fait.
--
-- LA TABLE DE JETONS EN DOUBLE
--
-- `app_e08c374bc4_jetons_fournisseur` (singulier) et `..._fournisseurs`
-- (pluriel) coexistaient. La singulière est vide, n'est référencée nulle part
-- dans le code, et la pluriel porte le jeton réellement utilisé par la
-- recherche de fournisseurs.
--
-- Une table orpheline dont le nom annonce « jetons » est un piège : le jour où
-- quelqu'un y écrira un secret en croyant alimenter la bonne, personne ne le
-- verra. On la supprime plutôt que de la documenter.

drop table if exists public.app_e08c374bc4_jetons_fournisseur;

-- LE CHEMIN DE RECHERCHE DE LA TRADUCTION
--
-- `traduire_terme` est une table de correspondance pure : elle ne lit aucune
-- table et n'est pas SECURITY DEFINER, donc son chemin mutable ne présentait
-- pas de risque réel. Le figer coûte une ligne et retire la dernière alerte de
-- cette famille — autant que l'audit ne serve plus qu'à signaler du vrai.
--
-- Le corps est repris à l'identique : c'est un ajout de `set search_path`, pas
-- une réécriture. Vérifié après application sur trois cas, dont le repli quand
-- le terme est inconnu.

create or replace function public.app_e08c374bc4_traduire_terme(p_terme text)
returns text
language sql
immutable
set search_path to 'pg_catalog'
as $function$
  select coalesce(
    (select t.fr from (values
      ('plastic','plastique'), ('metal','métal'), ('others','autres'), ('other','autre'),
      ('stainless steel','acier inoxydable'), ('steel','acier'), ('iron','fer'),
      ('aluminum','aluminium'), ('aluminium','aluminium'), ('alloy','alliage'),
      ('copper','cuivre'), ('zinc','zinc'), ('brass','laiton'), ('titanium','titane'),
      ('cotton','coton'), ('polyester','polyester'), ('nylon','nylon'),
      ('fabric','tissu'), ('linen','lin'), ('wool','laine'), ('velvet','velours'),
      ('leather','cuir'), ('pu leather','cuir synthétique'), ('rubber','caoutchouc'),
      ('silicone','silicone'), ('wood','bois'), ('bamboo','bambou'), ('mdf','panneau MDF'),
      ('glass','verre'), ('ceramic','céramique'), ('porcelain','porcelaine'),
      ('paper','papier'), ('cardboard','carton'),
      ('acrylic','acrylique'), ('sponge','éponge'), ('foam','mousse'),
      ('pvc','PVC'), ('abs','ABS'), ('pp','polypropylène'), ('pe','polyéthylène'),
      ('tpu','TPU'), ('eva','EVA'), ('resin','résine'), ('silica gel','gel de silice'),
      ('carbon fiber','fibre de carbone'), ('crystal','cristal'),
      -- Emballages. « Plastic bags » manquait, et se voyait sur la fiche.
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
