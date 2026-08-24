-- Ce que la fiche produit ne pouvait pas afficher, parce que la vue le retenait
--
-- Le fondateur signale que « les informations des articles ne sont toujours pas
-- affichées ». Elles sont pourtant en base. Le blocage était ici : les écrans
-- publics ne lisent pas la table `produits`, ils lisent la vue
-- `produits_public`, qui n'exposait ni la matière, ni l'emballage, ni le poids
-- net, ni l'adresse de la vidéo. On pouvait écrire ces colonnes jusqu'à demain :
-- rien ne serait jamais monté à l'écran.
--
-- Quatre-vingts articles en ligne portaient une matière et un emballage que
-- personne ne pouvait lire.
--
-- CE QU'ON AJOUTE, ET CE QU'ON CONTINUE DE RETENIR
--
-- On ajoute quatre attributs de la MARCHANDISE : de quoi c'est fait, comment
-- c'est emballé, ce que ça pèse net, et la vidéo.
--
-- Aucune donnée de COÛT n'entre ici, et c'est la règle qui ne bouge pas :
-- `prix_achat_fcfa`, `cout_fret_fcfa`, `cout_assurance_fcfa`, `fournisseur_id`
-- et `reference_externe` restent hors de la vue. Le client ne doit jamais
-- pouvoir reconstituer le coût de revient de la chaîne.
--
-- `description_fournisseur` reste dehors elle aussi, mais pour une autre
-- raison : c'est du HTML brut, en anglais, en espagnol ou en allemand. La page
-- grand public tentait de l'afficher — un bloc mort, puisque la vue ne l'a
-- jamais servi. Plutôt que d'ouvrir le robinet à du texte non traduit, le bloc
-- a été retiré de l'écran : la description française fait foi.

create or replace view app_e08c374bc4_produits_public as
select p.id,
       p.enseigne_id,
       p.nom,
       p.description,
       p.prix_unitaire_fcfa,
       p.photos,
       p.categorie,
       p.unite_vente,
       p.stock_disponible,
       p.delai_livraison_estime,
       p.actif,
       p.espace,
       p.categorie_gp_id,
       p.quantite_minimum,
       case
         when p.source_donnee = 'import_cj_dropshipping' then 'import_international'
         when p.vendeur_id is not null then 'vendeur_local'
         else 'local'
       end as origine,
       p.vendeur_id,
       v.nom_entreprise as vendeur_nom,
       v.ville          as vendeur_ville,
       v.logo_url       as vendeur_logo,
       p.created_at,
       p.updated_at,
       p.canal_acheminement,
       p.poids_unitaire_g,
       p.volume_unitaire_cm3,
       p.mode_acheminement,
       -- Les quatre nouveaux : des attributs de marchandise, pas de coût.
       p.video_url,
       p.matiere,
       p.emballage,
       p.poids_produit_g
from app_e08c374bc4_produits p
     left join app_e08c374bc4_vendeurs v on v.id = p.vendeur_id
where p.actif = true
  and (p.vendeur_id is null or v.statut = 'valide');
