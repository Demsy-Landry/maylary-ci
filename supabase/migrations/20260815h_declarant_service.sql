-- ---------------------------------------------------------------------------
-- Le Déclarant devient un service, pas un outil.
--
-- Directive du fondateur : « c'est un service à part entière, un produit à
-- valoriser. Tout doit être fonctionnel et opérationnel : page d'accueil,
-- tableau de bord, historique, abonnement. »
--
-- Ce qui manquait pour que ce soit vrai :
--
--   1. LES LIQUIDATIONS N'ÉTAIENT NULLE PART. Les classifications étaient
--      enregistrées, les liquidations non. Un déclarant qui calcule des droits
--      un mardi ne pouvait pas les retrouver le mercredi, ni rééditer son
--      bulletin. C'est le trou le plus visible dès qu'on parle d'historique.
--
--   2. AUCUNE LECTURE D'ENSEMBLE. Rien ne disait à un abonné ce qu'il avait
--      consommé, ce qu'il lui restait, ni ce qu'il avait produit.
-- ---------------------------------------------------------------------------

-- ------------------------------------------------------------------
-- Les liquidations, conservées telles qu'elles ont été calculées.
--
-- On garde le RÉSULTAT COMPLET en jsonb, pas seulement le total. Deux raisons :
-- le bulletin doit pouvoir être réédité à l'identique des mois plus tard, et
-- les taux du TEC changent — un recalcul ultérieur donnerait un autre chiffre
-- et ferait mentir l'archive.
-- ------------------------------------------------------------------
create table if not exists app_e08c374bc4_liquidations (
  id             uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references auth.users(id) on delete cascade,
  numero         text not null,

  intitule       text,
  regime         text not null default '4000',
  fret_fcfa      numeric not null default 0,
  assurance_fcfa numeric not null default 0,

  -- Ce qui a été saisi, et ce que le moteur a rendu.
  lignes         jsonb not null,
  resultat       jsonb not null,

  -- Extraits pour pouvoir trier et totaliser sans ouvrir le jsonb.
  caf_fcfa            numeric,
  total_a_payer_fcfa  numeric,
  nombre_lignes       integer,

  cree_le        timestamptz not null default now()
);

create index if not exists app_e08c374bc4_liquidations_user_idx
  on app_e08c374bc4_liquidations (utilisateur_id, cree_le desc);
create unique index if not exists app_e08c374bc4_liquidations_numero_idx
  on app_e08c374bc4_liquidations (numero);

alter table app_e08c374bc4_liquidations enable row level security;

drop policy if exists "Liquidations du client" on app_e08c374bc4_liquidations;
create policy "Liquidations du client" on app_e08c374bc4_liquidations for select
  using (utilisateur_id = auth.uid() or app_e08c374bc4_is_admin());

drop policy if exists "Liquidations écrites par leur auteur" on app_e08c374bc4_liquidations;
create policy "Liquidations écrites par leur auteur" on app_e08c374bc4_liquidations for insert
  with check (utilisateur_id = auth.uid());

-- Pas de politique UPDATE ni DELETE, volontairement : une liquidation
-- enregistrée est une archive. On n'en refait pas l'histoire.

create table if not exists app_e08c374bc4_compteurs_liquidation (
  annee   integer primary key,
  dernier integer not null default 0
);
alter table app_e08c374bc4_compteurs_liquidation enable row level security;

create or replace function app_e08c374bc4_numero_liquidation()
returns text language plpgsql security definer set search_path = public as $$
declare v_annee integer := extract(year from now())::integer; v_n integer;
begin
  insert into app_e08c374bc4_compteurs_liquidation (annee, dernier) values (v_annee, 1)
  on conflict (annee) do update set dernier = app_e08c374bc4_compteurs_liquidation.dernier + 1
  returning dernier into v_n;
  return format('LIQ-%s-%s', v_annee, lpad(v_n::text, 4, '0'));
end; $$;
revoke all on function app_e08c374bc4_numero_liquidation() from public, anon, authenticated;

-- ------------------------------------------------------------------
-- Enregistrer une liquidation.
--
-- L'appelant ne choisit pas son numéro et ne choisit pas son propriétaire :
-- les deux sont posés ici. Sans quoi il suffirait de demander poliment pour
-- écrire au nom d'un autre.
-- ------------------------------------------------------------------
create or replace function app_e08c374bc4_enregistrer_liquidation(
  p_lignee jsonb, p_resultat jsonb, p_regime text default '4000',
  p_fret numeric default 0, p_assurance numeric default 0, p_intitule text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_moi uuid := auth.uid(); v_num text; v_id uuid;
begin
  if v_moi is null then
    raise exception 'Connectez-vous pour enregistrer une liquidation.' using errcode = '42501';
  end if;

  v_num := app_e08c374bc4_numero_liquidation();

  insert into app_e08c374bc4_liquidations
    (utilisateur_id, numero, intitule, regime, fret_fcfa, assurance_fcfa,
     lignes, resultat, caf_fcfa, total_a_payer_fcfa, nombre_lignes)
  values (v_moi, v_num, nullif(btrim(coalesce(p_intitule,'')),''), coalesce(p_regime,'4000'),
          coalesce(p_fret,0), coalesce(p_assurance,0), p_lignee, p_resultat,
          (p_resultat->'globaux'->>'caf_total_fcfa')::numeric,
          (p_resultat->>'total_a_payer_fcfa')::numeric,
          jsonb_array_length(p_lignee))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'numero', v_num);
end; $$;
revoke all on function app_e08c374bc4_enregistrer_liquidation(jsonb, jsonb, text, numeric, numeric, text)
  from public, anon;
grant execute on function app_e08c374bc4_enregistrer_liquidation(jsonb, jsonb, text, numeric, numeric, text)
  to authenticated;

-- ------------------------------------------------------------------
-- Le tableau de bord de l'abonné.
--
-- Une seule lecture pour tout l'écran. Trois requêtes depuis le navigateur
-- pour trois compteurs, c'est trois allers-retours sur une liaison mobile
-- abidjanaise — et l'écran s'affiche par morceaux.
--
-- Il ne rend QUE ce qui appartient à celui qui appelle. Le contrôle est ici,
-- pas dans l'écran : un écran se contourne, une fonction non.
-- ------------------------------------------------------------------
create or replace function app_e08c374bc4_declarant_tableau_de_bord()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_moi     uuid := auth.uid();
  v_formule text;
  v_f       app_e08c374bc4_formules_ia;
  v_jour    integer;
begin
  if v_moi is null then
    raise exception 'Connectez-vous pour consulter votre tableau de bord.' using errcode = '42501';
  end if;

  -- La formule en cours : l'abonnement s'il est encore valide, sinon la
  -- formule d'entrée. Un abonnement expiré ne doit pas continuer d'ouvrir
  -- des droits.
  select formule into v_formule
  from app_e08c374bc4_abonnements_ia
  where utilisateur_id = v_moi
    and (actif_jusquau is null or actif_jusquau >= current_date);

  select * into v_f from app_e08c374bc4_formules_ia
  where code = coalesce(v_formule, 'decouverte');

  select count(*) into v_jour from app_e08c374bc4_usage_ia
  where utilisateur_id = v_moi and cree_le::date = current_date;

  return jsonb_build_object(
    'formule', jsonb_build_object(
      'code', v_f.code, 'libelle', v_f.libelle,
      'prix_mensuel_fcfa', v_f.prix_mensuel_fcfa,
      'requetes_par_jour', v_f.requetes_par_jour,
      'avantages', to_jsonb(v_f.avantages),
      'abonnement_actif', v_formule is not null),

    'aujourdhui', jsonb_build_object(
      'utilisees', v_jour,
      'plafond', v_f.requetes_par_jour,
      'restant', greatest(0, v_f.requetes_par_jour - v_jour)),

    'production', jsonb_build_object(
      'classifications', (select count(*) from app_e08c374bc4_classifications_hs where utilisateur_id = v_moi),
      'liquidations',    (select count(*) from app_e08c374bc4_liquidations where utilisateur_id = v_moi),
      'droits_calcules_fcfa', (select coalesce(sum(total_a_payer_fcfa), 0)
                               from app_e08c374bc4_liquidations where utilisateur_id = v_moi)),

    -- Trente jours de consommation, pour que la courbe ait un sens.
    'consommation_30j', coalesce((
      select jsonb_agg(jsonb_build_object('jour', j, 'n', n) order by j)
      from (select cree_le::date j, count(*) n from app_e08c374bc4_usage_ia
            where utilisateur_id = v_moi and cree_le >= current_date - 29
            group by 1) t), '[]'::jsonb),

    'dernieres_classifications', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'description', description, 'code', code_propose,
               'taux_dd', taux_dd, 'verifie', verifie_en_base, 'cree_le', cree_le)
             order by cree_le desc)
      from (select * from app_e08c374bc4_classifications_hs
            where utilisateur_id = v_moi order by cree_le desc limit 5) c), '[]'::jsonb),

    'dernieres_liquidations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'numero', numero, 'intitule', intitule, 'regime', regime,
               'caf_fcfa', caf_fcfa, 'total_a_payer_fcfa', total_a_payer_fcfa,
               'nombre_lignes', nombre_lignes, 'cree_le', cree_le)
             order by cree_le desc)
      from (select * from app_e08c374bc4_liquidations
            where utilisateur_id = v_moi order by cree_le desc limit 5) l), '[]'::jsonb)
  );
end; $$;
revoke all on function app_e08c374bc4_declarant_tableau_de_bord() from public, anon;
grant execute on function app_e08c374bc4_declarant_tableau_de_bord() to authenticated;

-- ------------------------------------------------------------------
-- Les formules sont un PRODUIT : elles doivent se lire sans compte.
-- Quelqu'un qui découvre le service doit voir ce qu'il coûte avant de
-- s'inscrire. La table ne contient aucune donnée personnelle.
-- ------------------------------------------------------------------
alter table app_e08c374bc4_formules_ia enable row level security;
drop policy if exists "Formules lisibles" on app_e08c374bc4_formules_ia;
create policy "Formules lisibles" on app_e08c374bc4_formules_ia for select using (actif);
drop policy if exists "Formules admin" on app_e08c374bc4_formules_ia;
create policy "Formules admin" on app_e08c374bc4_formules_ia for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());
