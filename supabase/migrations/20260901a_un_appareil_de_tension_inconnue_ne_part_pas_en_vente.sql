-- La tension d'alimentation devient un motif d'indisponibilité à part entière.
--
-- LE RISQUE, ET POURQUOI CE N'EST PAS UNE QUESTION DE PRIX
--
-- Le fournisseur vend beaucoup d'appareils en 110 V, taillés pour le marché
-- américain. La Côte d'Ivoire est en 220 V. Un appareil de 110 V branché ici
-- grille au premier essai — et c'est le genre de panne qu'un client impute au
-- vendeur, pas au fabricant.
--
-- Le fondateur a tranché sur le prix : « si la qualité est bonne le prix ne
-- sera pas un problème ». La tension n'entre pas dans cet arbitrage : vendre un
-- appareil qui grille n'est pas cher, c'est mauvais.
--
-- CE QUI A ÉTÉ VÉRIFIÉ, ET COMMENT
--
-- La fiche du fournisseur est déjà stockée dans `description_fournisseur`. On
-- y cherche la tension plutôt que de la supposer. Relevé le 1er septembre sur
-- quatorze appareils sur secteur :
--
--   — trois annoncent 220/230 V : mixeur plongeant 400 W, moulin à café,
--     machine à lait de soja. Ils partent en vente.
--   — un annonce un moteur À ESSENCE (pulvérisateur à dos) : aucune question
--     de tension, il part aussi.
--   — neuf n'annoncent RIEN. Aucun ne dit 110 V — mais « non indiqué » n'est
--     pas « 220 V », et parmi eux se trouvent les deux batteurs sur socle qui
--     portent les meilleurs signaux marchands du catalogue (180 et 144
--     revendeurs). Ils sont mis en attente, pas écartés.
--
-- POURQUOI `paliers_calcules_le` EST RENSEIGNÉ SUR LES ARTICLES EN ATTENTE
--
-- Ce n'est pas une tarification : c'est un VERROU. Le moteur de prix reprend
-- les articles dont cette colonne est vide, et il termine en posant
-- `actif = true, indisponible_motif = null`. Sans ce verrou, il rallumerait au
-- passage suivant un appareil dont la tension est inconnue, en effaçant
-- justement le motif qui disait pourquoi il ne devait pas être vendu.
--
-- POUR LES REMETTRE EN VENTE
--
-- Une fois la tension confirmée par le fournisseur, il suffit de vider les deux
-- colonnes : le moteur de prix les reprendra au passage suivant.
--
--   update app_e08c374bc4_produits
--      set indisponible_motif = null, paliers_calcules_le = null
--    where id = '…';
--
-- Aucune contrainte ne restreint `indisponible_motif`, et aucun écran ne le
-- traduit : il est purement interne à la chaîne d'import. Ajouter une valeur ne
-- casse donc rien — ce commentaire tient lieu de documentation.

comment on column app_e08c374bc4_produits.indisponible_motif is
  'Pourquoi un article n''est pas en vente. Valeurs posées par la chaîne d''import : '
  'fret_disproportionne, fret_non_cote, fret_non_amortissable, '
  'commande_minimum_trop_elevee, a_verifier_chez_le_fournisseur, et '
  'tension_a_verifier — appareil sur secteur dont la fiche fournisseur '
  'n''indique pas s''il est en 110 V ou en 220 V. Ce dernier s''accompagne d''un '
  '`paliers_calcules_le` renseigné, qui empêche le moteur de prix de le '
  'rallumer en effaçant le motif.';
