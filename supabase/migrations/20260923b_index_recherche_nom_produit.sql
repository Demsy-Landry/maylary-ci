-- La recherche produit passe de « côté navigateur sur ce qui est déjà chargé »
-- à « côté base sur tout le catalogue ». Pour qu'un `nom ILIKE '%montre%'` ne
-- lise pas la table entière, il faut un index trigramme : il découpe chaque nom
-- en triplets de lettres et sait retrouver « montre » même au milieu d'un mot.
-- L'extension pg_trgm est déjà présente.
create index if not exists idx_produits_nom_trgm
  on public.app_e08c374bc4_produits using gin (nom gin_trgm_ops)
  where actif = true;
