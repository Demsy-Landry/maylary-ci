-- LES INDEX QUI MANQUAIENT SOUS LES JOINTURES.
--
-- Trente et une clés étrangères n'avaient pas d'index. Concrètement : chaque
-- fois qu'on demande « les lignes de cette commande » ou « les documents de ce
-- dossier », Postgres parcourt la table ENTIÈRE au lieu de sauter directement
-- aux bonnes lignes.
--
-- Sur cent lignes personne ne le voit. Sur cent mille, chaque affichage de
-- commande lit cent mille lignes pour en garder trois.
--
-- Ces index ne changent rien au comportement de l'application. Ils coûtent un
-- peu d'espace disque et un peu de temps à l'écriture, et font gagner un
-- facteur considérable à la lecture — dans une boutique, on lit cent fois plus
-- qu'on n'écrit.
--
-- Ils apparaîtront comme « inutilisés » tant qu'il n'y aura pas de trafic :
-- c'est normal, un index ne sert qu'une fois qu'on l'interroge.

create index if not exists idx_abonnements_ia_formule            on app_e08c374bc4_abonnements_ia (formule);
create index if not exists idx_achats_groupes_produit            on app_e08c374bc4_achats_groupes (produit_id);
create index if not exists idx_avis_articles_commande            on app_e08c374bc4_avis_articles (commande_id);
create index if not exists idx_avis_articles_user                on app_e08c374bc4_avis_articles (user_id);
create index if not exists idx_commandes_gp_paiement_confirme_par on app_e08c374bc4_commandes_gp (paiement_confirme_par);
create index if not exists idx_demandes_assistance_traite_par    on app_e08c374bc4_demandes_assistance (traite_par);
create index if not exists idx_demandes_devis_source             on app_e08c374bc4_demandes_devis (demande_source_id);
create index if not exists idx_demandes_devis_user               on app_e08c374bc4_demandes_devis (user_id);
create index if not exists idx_documents_export_demande          on app_e08c374bc4_documents_export (demande_export_id);
create index if not exists idx_documents_import_demande          on app_e08c374bc4_documents_import (demande_import_id);
create index if not exists idx_dossier_pieces_code_document      on app_e08c374bc4_dossier_pieces (code_document);
create index if not exists idx_dossier_pieces_valide_par         on app_e08c374bc4_dossier_pieces (valide_par);
create index if not exists idx_ecritures_cree_par                on app_e08c374bc4_ecritures (cree_par);
create index if not exists idx_ecritures_journal                 on app_e08c374bc4_ecritures (journal);
create index if not exists idx_fournisseurs_regime_origine       on app_e08c374bc4_fournisseurs (regime_origine);
create index if not exists idx_hist_statut_devis_demande         on app_e08c374bc4_historique_statut_devis (demande_devis_id);
create index if not exists idx_hist_statut_export_demande        on app_e08c374bc4_historique_statut_export (demande_export_id);
create index if not exists idx_hist_statut_import_demande        on app_e08c374bc4_historique_statut_import (demande_import_id);
create index if not exists idx_incidents_fournisseur_commande    on app_e08c374bc4_incidents_fournisseur (commande_id);
create index if not exists idx_incidents_fournisseur_constate_par on app_e08c374bc4_incidents_fournisseur (constate_par);
create index if not exists idx_incidents_fournisseur_produit     on app_e08c374bc4_incidents_fournisseur (produit_id);
create index if not exists idx_lignes_commande_gp_produit        on app_e08c374bc4_lignes_commande_gp (produit_id);
create index if not exists idx_lignes_devis_produit              on app_e08c374bc4_lignes_devis (produit_id);
create index if not exists idx_participations_ag_commande        on app_e08c374bc4_participations_achat_groupe (commande_id);
create index if not exists idx_participations_ag_user            on app_e08c374bc4_participations_achat_groupe (user_id);
create index if not exists idx_produits_categorie_gp             on app_e08c374bc4_produits (categorie_gp_id);
create index if not exists idx_produits_fournisseur              on app_e08c374bc4_produits (fournisseur_id);
create index if not exists idx_produits_favoris_produit          on app_e08c374bc4_produits_favoris (produit_id);
create index if not exists idx_reversements_vendeur              on app_e08c374bc4_reversements (vendeur_id);
create index if not exists idx_usage_ia_utilisateur              on app_e08c374bc4_usage_ia (utilisateur_id);
create index if not exists idx_vendeurs_secteur                  on app_e08c374bc4_vendeurs (secteur_id);
