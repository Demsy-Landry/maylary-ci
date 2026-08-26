-- JAMAIS UN ARTICLE SANS PRIX EN VITRINE.
--
-- CE QUI S'EST PASSÉ, TROIS FOIS DANS LA MÊME JOURNÉE
--
-- Un article importé entre au catalogue à zéro franc : c'est voulu, le vrai
-- prix vient du moteur de tarification, plus tard. Il entre donc éteint.
--
-- Mais le moteur d'amortissement du fret, lui, RALLUME un article dès qu'il a
-- obtenu un devis de transport — sans regarder si un prix de vente existe. Six
-- sacs à main se sont ainsi retrouvés en boutique, visibles de tous, affichés
-- à 0 FCFA. Un client aurait pu les mettre au panier.
--
-- POURQUOI LA CORRECTION EST ICI ET NON DANS LA FONCTION FAUTIVE
--
-- On pouvait ajouter la vérification dans le moteur d'amortissement. Ce serait
-- réparer la fuite là où l'eau est apparue cette fois-ci. Demain une autre
-- fonction rallumera un article — l'écran d'administration, une reprise après
-- incident, une tâche planifiée — et le trou se rouvrira ailleurs.
--
-- La vitrine est le point de passage OBLIGÉ : tout ce qu'un visiteur voit
-- passe par cette vue. La règle posée ici tient pour toutes les fonctions,
-- celles d'aujourd'hui et celles qu'on écrira. Un article sans prix ne peut
-- plus être montré, quel que soit le chemin par lequel on l'a rallumé.
--
-- CE QUE ÇA NE FAIT PAS
--
-- Rien n'est supprimé, rien n'est éteint. Les articles restent en base avec
-- leur fiche complète et réapparaissent d'eux-mêmes dès que le moteur écrit
-- leur prix. La règle ne cache que ce qui n'a pas de sens à montrer.
--
-- AU PASSAGE : LE NOMBRE DE REVENDEURS, QUE LA VITRINE RÉCLAMAIT SANS L'AVOIR
--
-- La page d'accueil choisit ses articles en croisant les rayons et le nombre
-- de marchands qui revendent chaque référence — c'est le seul signal de
-- qualité dont on dispose, le fournisseur n'exposant aucune note.
--
-- Or cette colonne n'était pas dans la vue. Le tri par qualité s'appliquait
-- donc à une valeur absente : il ne plantait pas, il ne faisait simplement
-- RIEN. La rotation entre rayons fonctionnait, le classement par mérite non.
-- Mon défaut, et invisible — un tri qui ne trie pas ne se voit pas.
--
-- Le nombre seul ne dit rien du fournisseur, qui reste hors de portée du
-- client comme convenu. Il dit combien de commerçants ont jugé l'article
-- assez bon pour le revendre.
create or replace view app_e08c374bc4_produits_public as
 SELECT p.id,
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
        CASE
            WHEN p.source_donnee = 'import_cj_dropshipping'::text THEN 'import_international'::text
            WHEN p.vendeur_id IS NOT NULL THEN 'vendeur_local'::text
            ELSE 'local'::text
        END AS origine,
    p.vendeur_id,
    v.nom_entreprise AS vendeur_nom,
    v.ville AS vendeur_ville,
    v.logo_url AS vendeur_logo,
    p.created_at,
    p.updated_at,
    p.canal_acheminement,
    p.poids_unitaire_g,
    p.volume_unitaire_cm3,
    p.mode_acheminement,
    p.video_url,
    p.matiere,
    p.emballage,
    p.poids_produit_g,
    p.marchands_vendeurs
   FROM app_e08c374bc4_produits p
     LEFT JOIN app_e08c374bc4_vendeurs v ON v.id = p.vendeur_id
  WHERE p.actif = true
    AND coalesce(p.prix_unitaire_fcfa, 0) > 0
    AND (p.vendeur_id IS NULL OR v.statut = 'valide'::text);
