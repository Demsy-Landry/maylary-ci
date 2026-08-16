-- Quelle intelligence artificielle sert réellement, et à quoi.
--
-- POURQUOI CETTE FONCTION PLUTÔT QU'UN TEXTE ÉCRIT DANS LA PAGE
--
-- Le fournisseur de la classification se règle en base : il peut passer de
-- Google à Anthropic sans redéploiement. Une page qui l'annoncerait en dur
-- dirait donc un jour le contraire de ce qui tourne — et sur une page qui
-- promet la transparence, ce serait le pire endroit pour mentir.
--
-- CE QU'ELLE REND, ET CE QU'ELLE NE RENDRA JAMAIS
--
-- Le nom de l'IA — « google », « anthropic » — et rien d'autre. Pas le modèle,
-- pas la version, pas un fragment de clé. Le fondateur l'a formulé ainsi : on
-- dit l'IA utilisée, pas le modèle. C'est aussi la bonne règle de sécurité :
-- la table des paramètres reste réservée à l'administration, et cette fonction
-- n'en laisse sortir que l'étiquette.
--
-- L'assistant et les visuels ne sont pas réglables : leur fournisseur est
-- inscrit dans le code des fonctions correspondantes. Il est donc écrit ici
-- tel qu'il y est, et non deviné.

create or replace function app_e08c374bc4_ia_en_service()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    -- Réglable : lu dans les paramètres.
    'classification', coalesce(
      (select fournisseur from app_e08c374bc4_parametres_classification limit 1), 'google'),
    'classification_active', coalesce(
      (select actif from app_e08c374bc4_parametres_classification limit 1), false),
    -- Fixés dans le code des fonctions : `api.anthropic.com` pour l'assistant,
    -- `generativelanguage.googleapis.com` pour les visuels.
    'assistant', 'anthropic',
    'visuels', 'google'
  );
$$;

-- Lisible par tous : c'est une information que la page publique affiche.
grant execute on function app_e08c374bc4_ia_en_service() to anon, authenticated;
