-- Une référence de transaction ne sert qu'une fois.
--
-- Constaté par le fondateur en testant le lien Wave : rien n'empêchait un
-- client de recopier le code d'un règlement déjà passé pour faire valider une
-- seconde commande. La déclaration était traçable, mais pas unique — une trace
-- réutilisable n'en est pas une.
--
-- L'unicité porte sur une forme normalisée : majuscules et sans espaces. Sans
-- cela, « mp260803.1425.a12345 » et « MP260803.1425.A12345 » passeraient pour
-- deux règlements distincts, ce qui vide la contrainte de son sens. On ne va
-- pas plus loin dans la normalisation : retirer les points ou les tirets
-- risquerait de confondre deux références légitimement voisines.
--
-- Index partiel : les commandes non encore réglées portent un NULL, et il y en
-- aura toujours beaucoup.
create unique index if not exists app_e08c374bc4_reference_transaction_unique
  on app_e08c374bc4_commandes_gp (upper(regexp_replace(reference_transaction, '\s', '', 'g')))
  where reference_transaction is not null;

-- Ce que le client dit avoir versé, distinct de ce qui est dû
-- (`montant_total_fcfa`) et de ce que la caisse constate
-- (`montant_recu_fcfa`). Trois nombres, trois sources : le client, le tarif, la
-- banque. Les confondre effacerait justement l'écart qu'on cherche à voir.
alter table app_e08c374bc4_commandes_gp
  add column if not exists montant_declare_fcfa numeric;
