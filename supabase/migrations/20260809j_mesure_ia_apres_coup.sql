-- La consommation se réserve avant l'appel, se mesure après.
--
-- Réserver d'abord, c'est ce qui empêche deux requêtes simultanées de passer
-- toutes deux le contrôle. Mais au moment de la réservation on ignore encore
-- combien de jetons l'appel coûtera : la ligne naît donc vide et se complète
-- au retour. Sans ce second temps, on saurait combien de requêtes ont été
-- faites, jamais combien elles ont coûté — et c'est le coût qui décide du prix.
--
-- Ces deux fonctions ne sont appelées que par la fonction serveur de l'agent,
-- avec la clé de service. La migration 20260810a leur retire tout droit
-- d'exécution pour `anon` et `authenticated` : ouvertes, elles permettaient de
-- vider le quota d'un autre compte ou de se recréditer indéfiniment.

create or replace function app_e08c374bc4_consommer_ia(
  p_utilisateur uuid,
  p_service     text,
  p_modele      text default null,
  p_entree      integer default null,
  p_sortie      integer default null,
  p_outils      integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_formule app_e08c374bc4_formules_ia;
  v_code    text;
  v_faites  integer;
  v_id      bigint;
begin
  select a.formule into v_code
  from app_e08c374bc4_abonnements_ia a
  where a.utilisateur_id = p_utilisateur
    and (a.actif_jusquau is null or a.actif_jusquau >= current_date);

  select * into v_formule
  from app_e08c374bc4_formules_ia
  where code = coalesce(v_code, 'decouverte') and actif;

  if v_formule.code is null then
    select * into v_formule from app_e08c374bc4_formules_ia where code = 'decouverte';
  end if;

  select count(*) into v_faites
  from app_e08c374bc4_usage_ia
  where utilisateur_id = p_utilisateur
    and aboutie
    and cree_le >= date_trunc('day', now());

  if v_faites >= v_formule.requetes_par_jour then
    return jsonb_build_object(
      'autorise', false,
      'formule', v_formule.code,
      'libelle', v_formule.libelle,
      'plafond', v_formule.requetes_par_jour,
      'faites', v_faites,
      'restant', 0);
  end if;

  insert into app_e08c374bc4_usage_ia
    (utilisateur_id, service, modele, jetons_entree, jetons_sortie, outils_appeles)
  values (p_utilisateur, p_service, p_modele, p_entree, p_sortie, p_outils)
  returning id into v_id;

  return jsonb_build_object(
    'autorise', true,
    'usage_id', v_id,
    'formule', v_formule.code,
    'libelle', v_formule.libelle,
    'plafond', v_formule.requetes_par_jour,
    'faites', v_faites + 1,
    'restant', v_formule.requetes_par_jour - v_faites - 1);
end;
$$;

/**
 * Complète une ligne d'usage au retour de l'appel.
 *
 * `aboutie = false` rend le crédit : un appel que le fournisseur a refusé n'a
 * rien coûté et ne doit pas être décompté du quota du client.
 */
create or replace function app_e08c374bc4_mesurer_ia(
  p_id      bigint,
  p_entree  integer default null,
  p_sortie  integer default null,
  p_outils  integer default 0,
  p_aboutie boolean default true
)
returns void
language sql
security definer
set search_path = public
as $$
  update app_e08c374bc4_usage_ia
  set jetons_entree  = coalesce(p_entree, jetons_entree),
      jetons_sortie  = coalesce(p_sortie, jetons_sortie),
      outils_appeles = coalesce(p_outils, outils_appeles),
      aboutie        = p_aboutie
  where id = p_id;
$$;
