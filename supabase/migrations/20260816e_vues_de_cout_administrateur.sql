-- Les quatre vues par lesquelles l'administrateur gardera accès aux coûts.
--
-- POURQUOI CETTE MIGRATION EST SÉPARÉE DE LA SUIVANTE
--
-- La migration `20260816f` retire au client le droit de lire nos colonnes de
-- coût. Appliquée avant que le nouveau code ne soit en ligne, elle casserait
-- l'application en production : les écrans y lisent encore `select('*')`, qui
-- se heurterait à un refus de privilège.
--
-- L'ordre est donc : ces vues d'abord (purement additives, sans effet sur
-- l'existant), puis le déploiement du code qui s'en sert, puis seulement la
-- révocation. À aucun moment la production n'est en défaut.
--
-- CE QUE FAIT `security_invoker = false`
--
-- La vue s'exécute avec les droits de son PROPRIÉTAIRE, pas de l'appelant.
-- Elle franchit donc la restriction de colonne que la migration suivante posera
-- sur `authenticated` — restriction qui, sans cela, aveuglerait aussi
-- l'administrateur, lui-même `authenticated`.
--
-- Ce qui la rend sûre, c'est qu'elle se garde elle-même : `where
-- app_e08c374bc4_is_admin()`. Un client qui l'interrogerait obtiendrait zéro
-- ligne, jamais une erreur — et jamais un chiffre.

-- Cotation d'import : coûts, marge et document douanier.
create or replace view public.app_e08c374bc4_demandes_import_cotation
with (security_invoker = false) as
select d.*
from public.app_e08c374bc4_demandes_import d
where public.app_e08c374bc4_is_admin();

revoke all on public.app_e08c374bc4_demandes_import_cotation from anon;
grant select on public.app_e08c374bc4_demandes_import_cotation to authenticated;

-- Cotation d'export.
create or replace view public.app_e08c374bc4_demandes_export_cotation
with (security_invoker = false) as
select d.*
from public.app_e08c374bc4_demandes_export d
where public.app_e08c374bc4_is_admin();

revoke all on public.app_e08c374bc4_demandes_export_cotation from anon;
grant select on public.app_e08c374bc4_demandes_export_cotation to authenticated;

-- Lignes de commande boutique, coût d'achat compris.
create or replace view public.app_e08c374bc4_lignes_commande_gp_cout
with (security_invoker = false) as
select l.*
from public.app_e08c374bc4_lignes_commande_gp l
where public.app_e08c374bc4_is_admin();

revoke all on public.app_e08c374bc4_lignes_commande_gp_cout from anon;
grant select on public.app_e08c374bc4_lignes_commande_gp_cout to authenticated;

-- Commandes boutique, coût fournisseur et trace d'approvisionnement compris.
create or replace view public.app_e08c374bc4_commandes_gp_cout
with (security_invoker = false) as
select c.*
from public.app_e08c374bc4_commandes_gp c
where public.app_e08c374bc4_is_admin();

revoke all on public.app_e08c374bc4_commandes_gp_cout from anon;
grant select on public.app_e08c374bc4_commandes_gp_cout to authenticated;
