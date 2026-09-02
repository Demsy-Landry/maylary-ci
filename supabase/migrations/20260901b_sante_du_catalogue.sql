-- Voir, d'un coup d'œil, ce qui va et ce qui ne va pas dans le catalogue.
--
-- CE QUI MANQUAIT
--
-- Rien ne disait si un article existait encore chez le fournisseur. Relevé le
-- 1er septembre : sur 513 articles importés, VINGT avaient été vérifiés une
-- fois, le 3 août. Les 493 autres étaient affichés « en stock » par défaut,
-- sans que personne ne l'ait jamais confirmé.
--
-- Le fondateur l'a dit simplement : « on ne peut pas avoir des articles en
-- boutique qui ne sont plus disponibles ». Le contrôle horaire (`cj_sante`)
-- fait le travail ; cette vue le rend LISIBLE, rayon par rayon.
--
-- POURQUOI UNE VUE ET PAS UN ÉCRAN
--
-- Un écran demande du code, des tests, une place dans la navigation. Une vue se
-- lit tout de suite, et elle ne peut pas se désynchroniser de la donnée
-- puisqu'elle EST la donnée. L'écran viendra si le besoin se confirme ; la
-- mesure, elle, ne peut pas attendre.
--
-- LES DEUX COLONNES QUI COMPTENT
--
-- `retires_par_le_fournisseur` : ces articles ont disparu de chez le
-- fournisseur et sont sortis de la vente automatiquement. C'est le trou à
-- combler — et c'est un acte commercial, pas technique. Le contrôle signale le
-- vide, il ne le comble pas : « chaque produit doit être examiné ».
--
-- `jamais_verifies` doit tendre vers zéro au fil des passages horaires. S'il
-- stagne, c'est que le contrôle ne tourne plus, et cette colonne est le seul
-- endroit où cela se voit.
--
-- SÉCURITÉ
--
-- `security_invoker` fait respecter les droits de celui qui interroge, et non
-- ceux du propriétaire de la vue. Seul un administrateur, qui a le droit de
-- lire la table des produits, verra donc des lignes ici. Sans cette option, une
-- vue laisse passer tout le monde.
create or replace view app_e08c374bc4_sante_catalogue
with (security_invoker = on) as
  select
    coalesce(c.nom, s.nom, '(sans rayon)') as rayon,
    case when p.espace = 'pro' then 'Espace Pro' else 'Boutique' end as espace,
    count(*) as articles,
    count(*) filter (where p.actif and coalesce(p.prix_unitaire_fcfa, 0) > 0) as en_vitrine,
    count(*) filter (where p.indisponible_motif = 'retire_par_le_fournisseur') as retires_par_le_fournisseur,
    count(*) filter (where p.indisponible_motif = 'tension_a_verifier') as tension_a_verifier,
    count(*) filter (
      where not p.actif
        and coalesce(p.indisponible_motif, '') not in ('retire_par_le_fournisseur', 'tension_a_verifier')
    ) as autres_indisponibles,
    count(*) filter (where p.stock_verifie_le is null) as jamais_verifies,
    count(*) filter (where p.stock_verifie_le < now() - interval '7 days') as verifies_il_y_a_plus_d_une_semaine,
    max(p.stock_verifie_le) as derniere_verification
  from app_e08c374bc4_produits p
  left join app_e08c374bc4_categories_gp c on c.id = p.categorie_gp_id
  left join app_e08c374bc4_enseignes e on e.id = p.enseigne_id
  left join app_e08c374bc4_secteurs s on s.id = e.secteur_id
  group by 1, 2;

grant select on app_e08c374bc4_sante_catalogue to authenticated;

comment on view app_e08c374bc4_sante_catalogue is
  'État de santé du catalogue par rayon. Alimentée par le contrôle horaire '
  'cj_sante, qui interroge le fournisseur article par article. '
  '`retires_par_le_fournisseur` est le trou à recombler à la main : le contrôle '
  'signale la disparition, il ne choisit pas le remplaçant.';

-- Le contrôle tourne toutes les heures, à la quarantième minute — le seul
-- créneau libre entre l'amortissement du fret (:05 et :35), le relevé des
-- déclinaisons (:10), la tarification (:20) et l'enrichissement (:50). Le
-- fournisseur ne tolérant qu'un appel par seconde, ces tâches ne doivent jamais
-- se chevaucher.
select cron.schedule(
  'maylary-sante-du-catalogue',
  '40 * * * *',
  $$select net.http_post(
      url := 'https://oubowmftzxpruckjzwuq.supabase.co/functions/v1/app_e08c374bc4_cj_sante',
      body := '{"limite":25}'::jsonb,
      headers := jsonb_build_object('Content-Type','application/json'),
      timeout_milliseconds := 400000);$$
);
