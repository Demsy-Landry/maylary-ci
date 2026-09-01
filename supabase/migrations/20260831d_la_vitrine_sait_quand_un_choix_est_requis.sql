-- La vitrine doit savoir, SANS requête supplémentaire, si un article demande
-- un choix de taille ou de couleur.
--
-- POURQUOI DANS LA VUE PLUTÔT QUE DANS L'ÉCRAN
--
-- La liste de la boutique affiche jusqu'à cinquante articles et porte un bouton
-- « ajouter au panier » sur chacun. Sans cette colonne, il faudrait cinquante
-- requêtes pour savoir lesquels ont des déclinaisons — ou pire, l'écran
-- ajouterait au panier sans savoir, et le client se retrouverait avec une robe
-- sans taille.
--
-- LE SEUIL EST À DEUX, ET C'EST VOULU
--
-- Une seule déclinaison n'est pas un choix : la chaîne de cheville en
-- coquillages n'existe qu'en un modèle, lui demander de « choisir » serait une
-- case à cocher inutile entre le client et son achat. Le choix n'est exigé qu'à
-- partir de deux.
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
    v.ville as vendeur_ville,
    v.logo_url as vendeur_logo,
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
    p.marchands_vendeurs,
    -- Vrai dès qu'il existe au moins DEUX déclinaisons actives : en dessous,
    -- il n'y a rien à choisir.
    (select count(*) from app_e08c374bc4_declinaisons d
      where d.produit_id = p.id and d.actif) > 1 as choix_requis
   from app_e08c374bc4_produits p
     left join app_e08c374bc4_vendeurs v on v.id = p.vendeur_id
  where p.actif = true
    and coalesce(p.prix_unitaire_fcfa, 0::numeric) > 0::numeric
    and (p.vendeur_id is null or v.statut = 'valide');
