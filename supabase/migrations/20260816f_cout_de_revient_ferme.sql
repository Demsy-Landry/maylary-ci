-- Le coût de revient cesse d'être lisible par le client.
--
-- CE QUI SE PASSAIT
--
-- Les écrans « Mes demandes » lisaient `select('*')`. La politique RLS filtre
-- les LIGNES, jamais les COLONNES : le navigateur du client recevait donc, pour
-- chacune de ses demandes, notre coût marchandise, notre fret, notre assurance,
-- notre transit, notre livraison, notre marge — et, depuis l'atelier de
-- chiffrage, le document douanier complet en JSON, valeur FOB et CAF comprises.
--
-- Retirer l'affichage à l'écran ne règle rien : la charge utile part quand même
-- sur le réseau, et il suffit d'ouvrir les outils du navigateur pour la lire.
-- Un concurrent n'avait qu'à ouvrir un compte et demander un devis pour
-- connaître nos conditions d'achat sur toute la chaîne.
--
-- POURQUOI DES PRIVILÈGES DE COLONNE ET PAS UNE POLITIQUE
--
-- Une politique RLS ne sait pas dire « cette ligne, mais pas cette colonne ».
-- Postgres le sait, par `grant select (colonnes)`. Et comme un privilège de
-- colonne ne peut pas s'ôter d'un privilège de table déjà accordé, il faut
-- d'abord révoquer la table entière, puis rendre les colonnes autorisées.
--
-- LE PIÈGE, DÉJÀ RENCONTRÉ ICI
--
-- L'administrateur est lui aussi `authenticated` : révoquer sur `authenticated`
-- l'aveugle exactement comme le client. Les vues de `20260816e` lui rendent la
-- lecture complète, et le code déployé les utilise déjà quand cette migration
-- s'applique.
--
-- `service_role` n'est pas touché : les fonctions edge continuent de tout lire.
--
-- L'ÉNUMÉRATION EST VOULUE
--
-- Une colonne ajoutée demain ne sera pas lisible par le client tant qu'elle
-- n'aura pas été inscrite ici. C'est le bon sens du défaut : une nouvelle
-- colonne de coût oubliée reste fermée, au lieu de fuir en silence.

-- ---------------------------------------------------------------------------
-- 1. Demandes d'import
--
-- Restent fermés : cout_marchandise_fcfa, cout_fret_fcfa, assurance_fcfa,
-- douane_estimee_fcfa, transit_local_fcfa, livraison_fcfa, marge_fcfa,
-- chiffrage_douanier.
-- ---------------------------------------------------------------------------
revoke select on public.app_e08c374bc4_demandes_import from anon, authenticated;

grant select (
  id, user_id, reference_publique, statut,
  description_produit, lien_produit, photos, quantite,
  pays_fournisseur, incoterm, mode_transport, transporteur_souhaite,
  delai_souhaite, notes_client,
  poids_estime_kg, volume_estime_m3, valeur_marchandise_estimee_fcfa,
  estimation_indicative_fcfa,
  montant_total_devis_fcfa, commentaire_admin_devis,
  created_at, updated_at, demonstration
) on public.app_e08c374bc4_demandes_import to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Demandes d'export
--
-- Restent fermés : transport_local_fcfa, douane_export_fcfa, cout_fret_fcfa,
-- assurance_fcfa, frais_certification_fcfa, livraison_destination_fcfa,
-- marge_fcfa.
-- ---------------------------------------------------------------------------
revoke select on public.app_e08c374bc4_demandes_export from anon, authenticated;

grant select (
  id, user_id, reference_publique, statut,
  description_produit, pays_destination, acheteur_destinataire, contact_acheteur,
  photos, quantite, incoterm, mode_transport, transporteur_souhaite,
  delai_souhaite, notes_client,
  poids_estime_kg, volume_estime_m3, valeur_marchandise_estimee_fcfa,
  estimation_indicative_fcfa,
  montant_total_devis_fcfa, commentaire_admin_devis,
  created_at, updated_at, demonstration
) on public.app_e08c374bc4_demandes_export to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Lignes de commande boutique
--
-- `cout_achat_fcfa`, `cout_fret_fcfa` et `cout_assurance_fcfa` sont posés par
-- un déclencheur au moment de l'insertion, précisément pour qu'ils ne
-- transitent pas par le navigateur à l'écriture. Ils en repartaient pourtant à
-- la lecture. Le vendeur de la place de marché garde ce qui le concerne — sa
-- commission et son net —, pas notre coût d'achat.
-- ---------------------------------------------------------------------------
revoke select on public.app_e08c374bc4_lignes_commande_gp from anon, authenticated;

grant select (
  id, commande_id, produit_id, nom_produit, quantite,
  prix_unitaire_fcfa, sous_total,
  vendeur_id, taux_commission_applique, commission_fcfa, net_vendeur_fcfa
) on public.app_e08c374bc4_lignes_commande_gp to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Commandes boutique
--
-- Deux familles de colonnes partent d'ici :
--
--   • le coût — `cout_fournisseur_usd`, `fret_reel_panier_fcfa` : ce que la
--     marchandise et son acheminement nous coûtent réellement, à distinguer de
--     `fret_facture_articles_fcfa`, qui est ce que le client paie et qu'il a
--     donc le droit de voir ;
--
--   • le fournisseur — `reference_fournisseur`, `statut_fournisseur`,
--     `envoye_fournisseur_le`, `erreur_fournisseur` : la trace de notre
--     approvisionnement. Le client suit son colis par `numero_suivi`,
--     `transporteur_suivi` et `url_suivi`, qui restent ouverts. Il n'a pas
--     besoin de savoir chez qui nous commandons, ni qu'une commande
--     fournisseur a échoué avant d'être reprise.
-- ---------------------------------------------------------------------------
revoke select on public.app_e08c374bc4_commandes_gp from anon, authenticated;

grant select (
  id, user_id, reference_publique, statut, mode_paiement,
  montant_total_fcfa,
  nom_destinataire, telephone_destinataire, adresse_livraison, ville_livraison,
  notes_client, created_at, updated_at,
  numero_suivi, transporteur_suivi, suivi_maj_le, url_suivi,
  remise_groupage_fcfa, fret_facture_articles_fcfa,
  transporteur_choisi, supplement_transporteur_fcfa, delai_transporteur,
  canal_paiement_declare, reference_transaction, preuve_paiement_chemin,
  paiement_declare_le, montant_recu_fcfa, paiement_confirme_le,
  paiement_confirme_par, note_reglement, montant_declare_fcfa,
  livree_le, reception_confirmee_le, reception_confirmee_par
) on public.app_e08c374bc4_commandes_gp to anon, authenticated;
