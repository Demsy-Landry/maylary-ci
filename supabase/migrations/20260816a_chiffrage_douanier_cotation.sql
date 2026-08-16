-- Le chiffrage douanier d'une demande d'import, conservé avec elle.
--
-- Jusqu'ici, « Douane estimée » était un nombre que l'administrateur tapait à
-- la main dans l'atelier de cotation. Rien ne disait d'où il venait, et rien
-- ne permettait de le refaire : deux cotations du même dossier à deux
-- semaines d'intervalle pouvaient donner deux chiffres sans qu'on sache
-- lequel était juste.
--
-- On range donc à côté de la demande la SAISIE qui a produit le chiffre
-- (régime, lignes, positions tarifaires) et le RÉSULTAT COMPLET rendu par
-- `app_e08c374bc4_liquider_declaration`. Le résultat est archivé tel quel,
-- comme pour les liquidations du Déclarant : les taux du tarif changent, et
-- un recalcul ultérieur ferait mentir le devis déjà remis au client.
--
-- POURQUOI SUR LA DEMANDE, ET NON DANS UNE TABLE FERMÉE
--
-- Le client voit déjà le détail de son devis ligne par ligne, y compris la
-- douane. Le document de déclaration lui est remis avec le devis. Lui cacher
-- le calcul qui produit une ligne qu'il paie n'aurait aucun sens — MayLary
-- est transitaire, le décompte douanier est le cœur du métier, pas un secret.
-- La politique de lecture existante (propriétaire ou administrateur) suffit.

alter table app_e08c374bc4_demandes_import
  add column if not exists chiffrage_douanier jsonb;

comment on column app_e08c374bc4_demandes_import.chiffrage_douanier is
  'Saisie et résultat complet de la liquidation qui a produit douane_estimee_fcfa. '
  'Archivé tel quel : un recalcul ultérieur ferait mentir le devis déjà remis.';
