-- Ce que le transporteur n'expédie pas passe par l'Espace Pro.
--
-- LA RÈGLE DU FONDATEUR
--
-- « Tous les produits qui ne sont pas pris en compte par CJ pour l'expédition
-- doivent directement aller dans l'Espace Pro pour une importation en conteneur
-- complet ou en groupage. »
--
-- CE QUE LA BASE SAVAIT DÉJÀ SANS LE DIRE
--
-- `fret_source` valait `cj_reel` quand le transporteur avait coté le fret, et
-- `forfait` quand il ne l'avait pas fait — auquel cas l'article portait un fret
-- de 3 000 F posé par défaut. C'était donc déjà l'information « ce transporteur
-- ne l'achemine pas », mais elle n'était lisible que par qui connaissait la
-- convention, et rien n'en découlait.
--
-- `canal_acheminement` la nomme, et la colonne est GÉNÉRÉE : elle ne peut pas
-- diverger de `fret_source`, il n'y a rien à tenir à jour et rien à oublier.
--
-- LA BASCULE
--
-- Vingt et un articles étaient en vente directe en boutique alors qu'aucun
-- transporteur ne les achemine. Un client pouvait les commander ; nous
-- n'aurions pas su les livrer au prix affiché. Ils rejoignent l'Espace Pro,
-- rattachés à un secteur d'après leur rayon d'origine :
--
--     Tech & Audio            -> Informatique & Tech
--     tout le reste           -> Décoration & Aménagement
--
-- `categorie_gp_id` est conservé : la bascule est réversible, et le
-- rattachement se corrige article par article dans l'écran des articles.
--
-- LA COTATION PEUT VIVRE SOUS RÉSERVE, PAS LA FACTURE
--
-- « Ils peuvent avoir une cotation sous réserve des vrais tarifs » et « il y a
-- des actions qui nécessitent juste une vérification avant validation de
-- facture définitive ». Estimer est permis ; engager sur une estimation ne
-- l'est pas. D'où `sous_reserve`, `reserves` — nommées une à une, un
-- avertissement sans nom ne sert à rien — et `verifiee_le`, qui est la porte.

alter table public.app_e08c374bc4_produits
  add column if not exists canal_acheminement text
  generated always as (
    case when fret_source = 'cj_reel' then 'cj_express' else 'import_requis' end
  ) stored;

update public.app_e08c374bc4_produits p
set espace = 'pro',
    enseigne_id = case c.nom
      when 'Tech & Audio' then '424d6800-65fe-4dc6-9f26-1a5669b51ff7'::uuid
      else '2507c619-20aa-4d40-b12f-425f5332116b'::uuid
    end,
    updated_at = now()
from public.app_e08c374bc4_categories_gp c
where c.id = p.categorie_gp_id
  and p.actif and p.fret_source = 'forfait' and p.espace = 'grand_public';

-- La vue publique gagne le canal et les mesures : sans poids ni volume,
-- l'Espace Pro ne peut coter aucune importation.
-- (Définition complète appliquée en base ; elle reprend la vue existante à
--  l'identique et lui ajoute canal_acheminement, poids_unitaire_g,
--  volume_unitaire_cm3.)

alter table public.app_e08c374bc4_demandes_devis
  add column if not exists conditionnement text
    check (conditionnement in ('conteneur', 'groupage')),
  add column if not exists cotation_provisoire jsonb,
  add column if not exists sous_reserve boolean not null default true,
  add column if not exists reserves text[] not null default '{}',
  add column if not exists verifiee_le timestamptz,
  add column if not exists verifiee_par uuid;

-- Le détail de la cotation est du coût de revient : il ne sort pas.
revoke select on public.app_e08c374bc4_demandes_devis from anon, authenticated;
grant select (
  id, user_id, statut, reference_publique, montant_total_estime_fcfa,
  notes_client, demande_source_id, created_at, updated_at,
  conditionnement, sous_reserve, verifiee_le
) on public.app_e08c374bc4_demandes_devis to anon, authenticated;

create or replace view public.app_e08c374bc4_demandes_devis_cotation
with (security_invoker = false) as
select d.* from public.app_e08c374bc4_demandes_devis d
where public.app_e08c374bc4_is_admin();

revoke all on public.app_e08c374bc4_demandes_devis_cotation from anon;
grant select on public.app_e08c374bc4_demandes_devis_cotation to authenticated;
