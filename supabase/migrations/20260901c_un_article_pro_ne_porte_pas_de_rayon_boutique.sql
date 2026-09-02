-- Un article de l'Espace Pro ne doit pas traîner un rayon de boutique.
--
-- CE QUE LA VUE DE SANTÉ A RÉVÉLÉ
--
-- Elle affichait des secteurs Pro portant des noms de rayons boutique :
-- « Espace Pro / Bébé & Puériculture », « Espace Pro / Meubles ». En cherchant
-- pourquoi : VINGT ET UN articles de l'Espace Pro portaient à la fois un
-- secteur (par leur enseigne) ET une catégorie de boutique.
--
-- La contrainte de cohérence ne l'interdit pas — elle exige seulement qu'un
-- article `pro` ait une enseigne, et qu'un article `grand_public` ait une
-- catégorie. Rien n'empêchait le cumul.
--
-- AUCUN CLIENT N'A RIEN VU, ET C'EST VÉRIFIÉ
--
-- Les deux écrans de la boutique filtrent sur `espace = 'grand_public'` :
-- `CatalogueGrandPublic` et `CatalogueCategorieGP`. Un article Pro ne pouvait
-- donc pas apparaître en boutique, même avec une catégorie. Le défaut était
-- dans la donnée, pas dans la vitrine.
--
-- MAIS UNE DONNÉE MORTE FINIT TOUJOURS PAR ÊTRE LUE
--
-- Elle l'a d'ailleurs été, par la première vue qui a joint les deux tables. Le
-- prochain écran, le prochain export, le prochain calcul la reprendra aussi —
-- et se trompera de la même façon. On l'efface donc, plutôt que d'apprendre à
-- chaque nouveau lecteur à s'en méfier.
update app_e08c374bc4_produits
   set categorie_gp_id = null
 where espace = 'pro'
   and categorie_gp_id is not null;

-- La vue choisit désormais le rayon SELON L'ESPACE, au lieu de préférer la
-- catégorie quand les deux existent. Elle reste juste même si le cumul revient.
create or replace view app_e08c374bc4_sante_catalogue
with (security_invoker = on) as
  select
    case
      when p.espace = 'pro' then coalesce(s.nom, '(secteur inconnu)')
      else coalesce(c.nom, '(rayon inconnu)')
    end as rayon,
    case when p.espace = 'pro' then 'Espace Pro' else 'Boutique' end as espace,
    count(*) as articles,
    count(*) filter (where p.actif and coalesce(p.prix_unitaire_fcfa, 0) > 0) as en_vitrine,
    count(*) filter (where p.indisponible_motif = 'retire_par_le_fournisseur') as retires_par_le_fournisseur,
    count(*) filter (where p.indisponible_motif = 'tension_a_verifier') as tension_a_verifier,
    count(*) filter (
      where not p.actif
        and coalesce(p.indisponible_motif, '') not in ('retire_par_le_fournisseur', 'tension_a_verifier')
    ) as autres_indisponibles,
    count(*) filter (where p.stock_verifie_le is null) as jamais_verifies,
    count(*) filter (where p.stock_verifie_le < now() - interval '7 days') as verifies_il_y_a_plus_d_une_semaine,
    max(p.stock_verifie_le) as derniere_verification
  from app_e08c374bc4_produits p
  left join app_e08c374bc4_categories_gp c on c.id = p.categorie_gp_id
  left join app_e08c374bc4_enseignes e on e.id = p.enseigne_id
  left join app_e08c374bc4_secteurs s on s.id = e.secteur_id
  group by 1, 2;

grant select on app_e08c374bc4_sante_catalogue to authenticated;
