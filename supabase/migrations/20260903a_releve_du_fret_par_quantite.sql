-- Relevé du fret par quantité : mesurer avant de corriger.
--
-- POURQUOI CETTE TABLE EXISTE
--
-- On soupçonne que le prix rendu par pièce REMONTE quand la quantité augmente.
-- Le catalogue ne permet pas de le vérifier : huit articles seulement portent
-- plus d'un palier, ce qui ne prouve rien. Il faut donc interroger le
-- transporteur pour de vrai, à plusieurs quantités sur le même article, et
-- garder la trace de ce qu'il a répondu.
--
-- Une trace, pas un calcul. Chaque ligne est ce que le transporteur a coté ce
-- jour-là, à cette quantité. C'est ce qui rend la correction démontrable :
-- on relève avant, on corrige, on relève après, et on compare deux mesures
-- plutôt que deux opinions.
--
-- `option_lente_disponible` est le cœur du sujet. La théorie est que
-- l'expédition économique disparaît au-delà d'un certain poids, laissant
-- l'express comme seule offre — donc « la moins chère » devient chère. Cette
-- colonne dit si l'offre lente existait encore à cette quantité.

create table if not exists public.app_e08c374bc4_releve_fret (
  id uuid primary key default gen_random_uuid(),
  -- Toutes les lignes d'une même campagne de relevé partagent cet identifiant :
  -- comparer deux quantités n'a de sens qu'à l'intérieur d'un même relevé, les
  -- tarifs du transporteur bougeant d'un jour à l'autre.
  releve_id uuid not null,
  releve_le timestamptz not null default now(),
  produit_id uuid not null references public.app_e08c374bc4_produits(id) on delete cascade,
  espace text not null,
  quantite integer not null check (quantite > 0),

  -- Ce que le transporteur facture pour le LOT ENTIER, et ce que cela fait par
  -- pièce. Les deux sont gardés : le premier est sa réponse brute, le second
  -- est la seule chose qui intéresse un revendeur.
  fret_lot_usd numeric,
  fret_unitaire_fcfa numeric,
  transporteur text,
  delai text,

  -- Combien d'offres il a proposées, et si l'économique en faisait partie.
  options_total integer not null default 0,
  option_lente_disponible boolean,
  -- Le prix par pièce de la meilleure offre LENTE, quand elle existe. C'est
  -- l'étalon : si elle reste disponible et moins chère, la correction consiste
  -- simplement à cesser de la perdre de vue.
  fret_unitaire_lent_fcfa numeric,

  unique (releve_id, produit_id, quantite)
);

comment on table public.app_e08c374bc4_releve_fret is
  'Devis de transport réellement obtenus, à plusieurs quantités sur un même '
  'article. Sert à prouver — et non à supposer — que le prix rendu par pièce '
  'remonte avec la quantité, puis à vérifier la correction.';

create index if not exists idx_releve_fret_releve
  on public.app_e08c374bc4_releve_fret (releve_id, produit_id, quantite);

alter table public.app_e08c374bc4_releve_fret enable row level security;

-- Un relevé de fret expose nos coûts d'achat en creux : il ne sort pas de
-- l'administration. La règle de la maison est que le client ne connaît jamais
-- le coût de revient sur toute la chaîne.
drop policy if exists releve_fret_admin on public.app_e08c374bc4_releve_fret;
create policy releve_fret_admin
  on public.app_e08c374bc4_releve_fret
  for all to authenticated
  using (public.app_e08c374bc4_is_admin())
  with check (public.app_e08c374bc4_is_admin());

revoke all on public.app_e08c374bc4_releve_fret from anon;
grant select, insert, update, delete on public.app_e08c374bc4_releve_fret to authenticated;
