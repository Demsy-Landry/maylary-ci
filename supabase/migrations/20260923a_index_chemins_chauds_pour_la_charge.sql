-- Tenir la charge à 100 000 / 1 000 000 d'utilisateurs et de demandes.
--
-- Sans index, la base LIT LA TABLE ENTIÈRE à chaque requête. Sur 5 lignes ça ne
-- se voit pas ; sur un million, une page qui répondait en 5 ms en prend 5 000 et
-- l'application « bugge ». Un index, c'est le sommaire d'un livre : la base va
-- droit à la bonne page au lieu de tout feuilleter.
--
-- On n'ajoute que ce qui manque sur les CHEMINS CHAUDS — ceux parcourus à
-- chaque visite ou à chaque appel — et rien de décoratif : un index de trop
-- ralentit les écritures pour rien.

-- 1) Clés étrangères sans index (signalées par l'audit). Une clé étrangère non
--    indexée oblige à un balayage complet dès qu'on suit le lien ou qu'on
--    supprime la ligne parente.
create index if not exists idx_lignes_commande_gp_declinaison
  on public.app_e08c374bc4_lignes_commande_gp (declinaison_id)
  where declinaison_id is not null;

create index if not exists idx_releve_fret_produit
  on public.app_e08c374bc4_releve_fret (produit_id);

-- 2) La vitrine grand public : filtre en permanence sur `espace` + `actif`.
--    C'est LA requête la plus fréquente du site. Index partiel : on n'indexe
--    que les produits actifs, les seuls que la vitrine montre — plus petit,
--    plus rapide, et il ne pèse pas sur les produits archivés.
create index if not exists idx_produits_espace_actif
  on public.app_e08c374bc4_produits (espace)
  where actif = true;

-- 3) Le comptage du quota IA par personne et par jour, fait à CHAQUE appel de
--    classification. Un index composé (personne, jour) répond sans lire les
--    usages des autres.
create index if not exists idx_usage_ia_personne_jour
  on public.app_e08c374bc4_usage_ia (utilisateur_id, cree_le);
