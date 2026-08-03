-- Fiche de qualité d'un atelier, construite sur nos commandes et rien d'autre.
--
-- Quatre décomptes indépendants, réunis autour du catalogue. Le catalogue est
-- la table de gauche : un atelier chez qui nous n'avons encore rien vendu doit
-- apparaître, à zéro, plutôt que disparaître.
--
-- `taux_incident_pct` reste volontairement NULL tant qu'aucune pièce n'a été
-- livrée. Zéro pour cent sans livraison se lirait comme un sans-faute, alors
-- que c'est une absence de mesure.
create or replace view app_e08c374bc4_qualite_fournisseurs as
with livraisons as (
  select p.fournisseur_origine_id, p.fournisseur_origine, sum(l.quantite) as pieces
  from app_e08c374bc4_lignes_commande_gp l
  join app_e08c374bc4_commandes_gp c on c.id = l.commande_id
  join app_e08c374bc4_produits p on p.id = l.produit_id
  where c.statut = 'livree' and p.fournisseur_origine_id is not null
  group by p.fournisseur_origine_id, p.fournisseur_origine
),
notes as (
  select p.fournisseur_origine_id,
         round(avg(a.note), 2) as note_moyenne,
         count(*) as nb_avis
  from app_e08c374bc4_avis_articles a
  join app_e08c374bc4_produits p on p.id = a.produit_id
  where a.publie and p.fournisseur_origine_id is not null
  group by p.fournisseur_origine_id
),
incidents as (
  select fournisseur_origine_id,
         count(*) as nb_incidents,
         sum(cout_fcfa) as cout_incidents_fcfa
  from app_e08c374bc4_incidents_fournisseur
  where fournisseur_origine_id is not null
  group by fournisseur_origine_id
),
catalogue as (
  select fournisseur_origine_id,
         max(fournisseur_origine) as nom,
         count(*) filter (where actif) as articles_actifs,
         max(marchands_vendeurs) as marchands_max
  from app_e08c374bc4_produits
  where fournisseur_origine_id is not null
  group by fournisseur_origine_id
)
select c.fournisseur_origine_id,
       coalesce(c.nom, l.fournisseur_origine) as fournisseur,
       c.articles_actifs,
       c.marchands_max,
       coalesce(l.pieces, 0) as pieces_livrees,
       n.note_moyenne,
       coalesce(n.nb_avis, 0) as nb_avis,
       coalesce(i.nb_incidents, 0) as nb_incidents,
       coalesce(i.cout_incidents_fcfa, 0) as cout_incidents_fcfa,
       case when coalesce(l.pieces, 0) > 0
            then round(100.0 * coalesce(i.nb_incidents, 0) / l.pieces, 1)
       end as taux_incident_pct
from catalogue c
left join livraisons l on l.fournisseur_origine_id = c.fournisseur_origine_id
left join notes n on n.fournisseur_origine_id = c.fournisseur_origine_id
left join incidents i on i.fournisseur_origine_id = c.fournisseur_origine_id
-- Une vue s'exécute avec les droits de son propriétaire : les RLS des tables
-- sous-jacentes ne s'appliquent pas ici. Sans ce filtre, n'importe quel compte
-- connecté lirait nos volumes livrés et la liste de nos ateliers. Le test rend
-- la vue vide pour tout autre que l'administrateur.
where app_e08c374bc4_is_admin();
