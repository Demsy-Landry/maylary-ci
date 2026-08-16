-- Le barème FEDERMAR : l'acconage n'est pas un forfait.
--
-- LE REPROCHE DU FONDATEUR, ET IL EST FONDÉ
--
-- « Me demander ces montants serait une très grosse erreur ou du mensonge, car
-- ils ne sont pas fixes : tout dépend de la marchandise, du poids et d'autres
-- paramètres internes à chaque compagnie. »
--
-- La migration `20260816g` posait un `montant_fcfa` unique par poste. C'était
-- déjà supposer un tarif fixe — l'erreur de forme, avant même l'erreur de
-- chiffre. Le document FEDERMAR (Base tarifaire marchandises conteneurisées,
-- février 2013, applicable à Abidjan Terminal au 1er mars 2013, enregistré et
-- timbré) donne la vraie structure : le tarif dépend de QUATRE variables.
--
--   1. le SENS       import, export, transit import, transit export
--   2. la CATÉGORIE  C1 à C5, selon la nature de la marchandise
--   3. la TAILLE     20 ou 40 pieds
--   4. le POIDS      au-delà d'un seuil, une surcharge colis lourd
--
-- Un sac de riz et un décapsuleur ne paient pas le même acconage dans le même
-- conteneur : 67 600 contre 140 400 francs en 20 pieds, soit plus du double.
--
-- ACCONAGE ET RELEVAGE SONT DEUX LIGNES
--
-- Ils se facturent ensemble mais figurent séparément au barème, et ne suivent
-- pas le même rapport d'une catégorie à l'autre. Une facture de terminal les
-- distingue : le rapprochement doit pouvoir se faire ligne à ligne.
--
-- LA CATÉGORIE PAR DÉFAUT EST LA PLUS CHÈRE, ET C'EST VOULU
--
-- « Marchandises diverses » est le fourre-tout, et le tarif le plus élevé.
-- Classer par défaut vers elle ne peut que SURESTIMER. Une erreur dans ce sens
-- coûte une opération qu'on aurait pu faire ; l'erreur inverse coûte de
-- l'argent décaissé sur une marchandise déjà à quai.
--
-- LA SURCHARGE COLIS LOURD EST SIGNALÉE, PAS CHIFFRÉE
--
-- Le barème dit à partir de quel poids elle s'applique. Il ne dit pas combien
-- elle coûte. La deviner referait exactement l'erreur corrigée ici.
--
-- CE QUE CE BARÈME NE COUVRE PAS
--
-- Il se compte AU CONTENEUR. En groupage, ce n'est pas nous qui le payons : le
-- groupeur l'acquitte pour le conteneur entier et le refacture au mètre cube.
-- L'ajouter alors le compterait deux fois. Voir `APPLICATION_PAR_SERVICE`
-- dans `src/lib/bareme-manutention.ts`.
--
-- LA DATE
--
-- Février 2013. Le document est officiel, signé et timbré, mais il a treize
-- ans. `date_application` et `source` sont portées sur chaque ligne pour que
-- l'âge soit visible partout où le chiffre s'affiche, et qu'une mise à jour
-- FEDERMAR se substitue sans rien deviner.

create table if not exists public.app_e08c374bc4_bareme_manutention (
  id uuid primary key default gen_random_uuid(),
  sens text not null check (sens in ('import', 'export', 'transit_import', 'transit_export')),
  categorie text not null,
  libelle_categorie text not null,
  taille_conteneur integer not null check (taille_conteneur in (20, 40)),
  acconage_fcfa numeric not null check (acconage_fcfa >= 0),
  relevage_fcfa numeric not null check (relevage_fcfa >= 0),
  surcharge_colis_lourd boolean not null default false,
  /** Poids au-delà duquel la surcharge s'applique. Son MONTANT n'est pas au barème. */
  seuil_colis_lourd_tonnes numeric,
  categorie_par_defaut boolean not null default false,
  mots_cles text[] not null default '{}',
  source text not null,
  date_application date not null,
  verifie boolean not null default true,
  actif boolean not null default true,
  note text,
  unique (sens, categorie, taille_conteneur)
);

alter table public.app_e08c374bc4_bareme_manutention enable row level security;

create policy bareme_manutention_admin_tout
  on public.app_e08c374bc4_bareme_manutention
  for all to authenticated
  using (public.app_e08c374bc4_is_admin())
  with check (public.app_e08c374bc4_is_admin());

revoke all on public.app_e08c374bc4_bareme_manutention from anon;
grant select, insert, update, delete on public.app_e08c374bc4_bareme_manutention to authenticated;

-- Les 18 lignes du barème sont chargées par la migration appliquée en base ;
-- elles sont reprises telles quelles depuis les annexes 1, 2 et 3 du document.

-- Les deux postes d'acconage forfaitaires de `20260816g` sont retirés : ils
-- supposaient un tarif fixe, ce que ce barème dément.
update public.app_e08c374bc4_frais_destination
set actif = false,
    note = 'Remplacé par le barème FEDERMAR : l''acconage n''est pas un forfait, il dépend de la catégorie de marchandise, de la taille du conteneur, du sens et du poids. Voir app_e08c374bc4_bareme_manutention. Le relevage, facturé avec lui, y figure aussi.'
where code in ('ACCONAGE_CONTENEUR', 'ACCONAGE_GROUPAGE');
