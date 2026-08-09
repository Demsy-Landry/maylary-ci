-- Le fournisseur du modèle devient un réglage, pas une constante du code.
--
-- Motif immédiat : le compte Anthropic n'a pas encore de crédit, et le
-- fondateur dispose déjà d'une clé Google. Motif durable : rien dans la
-- fiabilité du module ne dépend du modèle. Ce qui protège le client, c'est la
-- confrontation du code proposé au corpus TEC — un modèle qui se trompe est
-- rattrapé par la base, quel qu'il soit. Le fournisseur est donc un détail
-- d'exploitation, et un détail d'exploitation se règle sans redéploiement.
--
-- Un modèle par fournisseur plutôt qu'un champ unique : avec un seul champ,
-- basculer sur Google en laissant « claude-opus-5 » donnerait un 404 à la
-- première classification. Deux colonnes rendent la faute impossible.

alter table app_e08c374bc4_parametres_classification
  add column if not exists fournisseur text not null default 'google',
  add column if not exists modele_google text not null default 'gemini-2.5-pro';

do $$
begin
  -- L'ancienne colonne portait le modèle Anthropic sans le dire.
  if exists (
    select 1 from information_schema.columns
    where table_name = 'app_e08c374bc4_parametres_classification' and column_name = 'modele'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'app_e08c374bc4_parametres_classification' and column_name = 'modele_anthropic'
  ) then
    alter table app_e08c374bc4_parametres_classification rename column modele to modele_anthropic;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'app_e08c374bc4_classification_fournisseur_check'
  ) then
    alter table app_e08c374bc4_parametres_classification
      add constraint app_e08c374bc4_classification_fournisseur_check
      check (fournisseur in ('anthropic', 'google'));
  end if;
end $$;

-- Le fournisseur ayant servi est conservé sur chaque classification : un
-- historique qui ne dit pas quel modèle a proposé le code ne permet pas de
-- rejuger une classification contestée des mois plus tard.
alter table app_e08c374bc4_classifications_hs
  add column if not exists fournisseur text;

comment on column app_e08c374bc4_parametres_classification.fournisseur is
  'anthropic ou google. Bascule sans redéploiement ; la clé correspondante doit être déposée en secret d''Edge Function.';

/**
 * Quota, fournisseur et modèle en une seule lecture pour l'écran.
 */
create or replace function app_e08c374bc4_quota_classification()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_param  app_e08c374bc4_parametres_classification;
  v_faites integer;
begin
  select * into v_param from app_e08c374bc4_parametres_classification limit 1;

  if auth.uid() is null then
    return jsonb_build_object(
      'connecte', false, 'restant', 0, 'plafond', v_param.classifications_par_jour,
      'actif', v_param.actif);
  end if;

  select count(*) into v_faites
  from app_e08c374bc4_classifications_hs
  where utilisateur_id = auth.uid() and cree_le >= date_trunc('day', now());

  return jsonb_build_object(
    'connecte', true,
    'plafond',  v_param.classifications_par_jour,
    'faites',   v_faites,
    'restant',  greatest(0, v_param.classifications_par_jour - v_faites),
    'actif',    v_param.actif
  );
end;
$$;

grant execute on function app_e08c374bc4_quota_classification() to anon, authenticated;
