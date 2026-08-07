-- Le Déclarant, premier étage : la liquidation des droits et taxes.
--
-- Reconstruction dans Maylary de l'outil qui vivait sur `le-declarant.com`,
-- dont l'hébergement est perdu. Voir `docs/le-declarant-reprise.md` pour le
-- raisonnement d'ensemble.
--
-- ---------------------------------------------------------------------------
-- Le principe qui gouverne ce module
-- ---------------------------------------------------------------------------
-- Un outil douanier qui se trompe coûte plus cher que pas d'outil du tout. Un
-- client qui découvre au port qu'il doit le double n'est pas un client déçu,
-- c'est un client perdu, et il le raconte.
--
-- D'où trois règles appliquées sans exception :
--
--   1. Aucun taux inventé. Chaque taxe porte sa source et un état de
--      confirmation. Les valeurs ci-dessous sont issues de sources publiques
--      qui se contredisent — notamment sur la redevance statistique — et sont
--      donc toutes marquées « non confirmées » jusqu'à relecture par un
--      déclarant agréé.
--   2. Le résultat dit s'il repose sur des taux confirmés. La cotation
--      automatique de Maylary refusera de s'appuyer sur ce qui ne l'est pas :
--      elle basculera en cotation manuelle plutôt que d'afficher un prix qu'on
--      ne pourrait pas tenir. La règle de la maison — un prix ne bouge jamais
--      après paiement — l'exige.
--   3. Le tarif porte une date de version, rendue avec chaque liquidation. Un
--      tarif périmé fait perdre de l'argent à qui s'y fie.

-- ---------------------------------------------------------------------------
-- La version du tarif appliqué
-- ---------------------------------------------------------------------------
create table if not exists app_e08c374bc4_parametres_tarif (
  ligne_unique   boolean primary key default true check (ligne_unique),
  libelle_tarif  text not null default 'TEC CEDEAO / UEMOA — à confirmer',
  date_version   date not null default current_date,
  note           text,
  updated_at     timestamptz not null default now()
);

insert into app_e08c374bc4_parametres_tarif (ligne_unique, note) values
  (true, 'Structure saisie à partir de sources publiques, non relue par un déclarant agréé.')
on conflict (ligne_unique) do nothing;

alter table app_e08c374bc4_parametres_tarif enable row level security;

drop policy if exists parametres_tarif_lecture on app_e08c374bc4_parametres_tarif;
create policy parametres_tarif_lecture on app_e08c374bc4_parametres_tarif
  for select to anon, authenticated using (true);

drop policy if exists parametres_tarif_ecriture on app_e08c374bc4_parametres_tarif;
create policy parametres_tarif_ecriture on app_e08c374bc4_parametres_tarif
  for all to authenticated
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

-- ---------------------------------------------------------------------------
-- La structure fiscale
-- ---------------------------------------------------------------------------
-- Les taxes sont des données, pas du code. Un taux se corrige depuis
-- l'administration, sans redéploiement : c'est la seule façon de suivre un
-- tarif qui change par arrêté.
create table if not exists app_e08c374bc4_taxes_douanieres (
  code     text primary key,
  libelle  text not null,

  -- Sur quoi la taxe se calcule. « caf » : la valeur en douane. « caf_et_droits » :
  -- la valeur en douane augmentée des droits déjà liquidés — c'est l'assiette
  -- de la TVA. L'ordre de la colonne `ordre` fait donc partie du calcul.
  assiette text not null check (assiette in ('caf', 'caf_et_droits', 'fob')),

  -- Nul pour le droit de douane, qui dépend de la position tarifaire et non de
  -- la taxe elle-même.
  taux     numeric check (taux is null or (taux >= 0 and taux < 1)),

  ordre    integer not null,
  actif    boolean not null default true,

  -- Le cœur de la règle n° 1. Tant que ceci vaut faux, le chiffre est un
  -- ordre de grandeur, pas une liquidation.
  confirme boolean not null default false,
  source   text,
  note     text,
  updated_at timestamptz not null default now()
);

alter table app_e08c374bc4_taxes_douanieres enable row level security;

-- Le barème est public : c'est un service rendu à la profession, et le cacher
-- n'apporterait rien. C'est même l'inverse — un transitaire qui vient vérifier
-- un taux découvre Maylary.
drop policy if exists taxes_douanieres_lecture on app_e08c374bc4_taxes_douanieres;
create policy taxes_douanieres_lecture on app_e08c374bc4_taxes_douanieres
  for select to anon, authenticated using (true);

drop policy if exists taxes_douanieres_ecriture on app_e08c374bc4_taxes_douanieres;
create policy taxes_douanieres_ecriture on app_e08c374bc4_taxes_douanieres
  for all to authenticated
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

-- Valeurs de départ. Toutes non confirmées, délibérément : elles viennent de
-- sources publiques divergentes et doivent être relues avant tout usage réel.
insert into app_e08c374bc4_taxes_douanieres (code, libelle, assiette, taux, ordre, source, note) values
  ('DD',    'Droit de douane',                                  'caf',           null,   10,
   'TEC CEDEAO', 'Taux porté par la position tarifaire : 0, 5, 10, 20 ou 35 % selon la catégorie.'),
  ('RS',    'Redevance statistique',                            'caf',           0.01,   20,
   'Sources publiques divergentes', 'Vue à 1 % et à 2,6 % selon les sources. À trancher.'),
  ('PCS',   'Prélèvement communautaire de solidarité (UEMOA)',  'caf',           0.01,   30,
   'UEMOA', null),
  ('PC',    'Prélèvement communautaire (CEDEAO)',               'caf',           0.005,  40,
   'CEDEAO', null),
  ('TVA',   'Taxe sur la valeur ajoutée',                       'caf_et_droits', 0.18,   90,
   'Code général des impôts', 'Assise sur la valeur en douane augmentée des droits et taxes.')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Le corpus tarifaire
-- ---------------------------------------------------------------------------
-- Volontairement vide à la création. La nomenclature du Système Harmonisé
-- n'est pas quelque chose qui se devine : une position inventée a l'air juste
-- et coûte cher. Elle se remplira par import d'une source officielle, ou
-- dossier par dossier — auquel cas ce corpus devient un actif que personne
-- d'autre n'a.
create table if not exists app_e08c374bc4_positions_tarifaires (
  code       text primary key,
  libelle    text not null,
  chapitre   text generated always as (left(code, 2)) stored,
  taux_dd    numeric check (taux_dd is null or (taux_dd >= 0 and taux_dd < 1)),
  unite      text,
  note       text,
  confirme   boolean not null default false,
  actif      boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists app_e08c374bc4_positions_tarifaires_chapitre_idx
  on app_e08c374bc4_positions_tarifaires (chapitre);
create index if not exists app_e08c374bc4_positions_tarifaires_libelle_idx
  on app_e08c374bc4_positions_tarifaires using gin (to_tsvector('french', libelle));

alter table app_e08c374bc4_positions_tarifaires enable row level security;

drop policy if exists positions_tarifaires_lecture on app_e08c374bc4_positions_tarifaires;
create policy positions_tarifaires_lecture on app_e08c374bc4_positions_tarifaires
  for select to anon, authenticated using (actif);

drop policy if exists positions_tarifaires_ecriture on app_e08c374bc4_positions_tarifaires;
create policy positions_tarifaires_ecriture on app_e08c374bc4_positions_tarifaires
  for all to authenticated
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

-- ---------------------------------------------------------------------------
-- Le moteur
-- ---------------------------------------------------------------------------
-- Déterministe et en base, pas dans l'écran : deux consommateurs l'appellent —
-- la page publique du Déclarant et la cotation de Maylary — et une API pourra
-- l'exposer demain à un transitaire sans qu'on réécrive quoi que ce soit.
--
-- La valeur en douane se calcule ici plutôt que d'être demandée toute faite :
-- c'est l'erreur la plus fréquente des outils approximatifs, qui oublient que
-- le fret et l'assurance en font partie.
create or replace function app_e08c374bc4_liquider(
  p_valeur_fob_fcfa numeric,
  p_fret_fcfa       numeric default 0,
  p_assurance_fcfa  numeric default 0,
  p_position        text    default null,
  p_taux_dd         numeric default null
)
returns table (
  code        text,
  libelle     text,
  assiette    text,
  base_fcfa   numeric,
  taux        numeric,
  montant_fcfa numeric,
  confirme    boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caf     numeric;
  v_taux_dd numeric;
  v_droits  numeric := 0;
  v_taxe    record;
  v_base    numeric;
  v_montant numeric;
begin
  if p_valeur_fob_fcfa is null or p_valeur_fob_fcfa < 0 then
    raise exception 'Valeur de la marchandise manquante ou négative.' using errcode = '22023';
  end if;

  v_caf := p_valeur_fob_fcfa + coalesce(p_fret_fcfa, 0) + coalesce(p_assurance_fcfa, 0);

  -- Le droit de douane vient de la position tarifaire, ou d'un taux fourni
  -- quand la position n'est pas encore au corpus. Sans l'un ni l'autre on ne
  -- liquide pas : un droit de douane supposé nul est une erreur silencieuse.
  v_taux_dd := coalesce(
    p_taux_dd,
    (select pt.taux_dd from app_e08c374bc4_positions_tarifaires pt where pt.code = p_position)
  );

  if v_taux_dd is null then
    raise exception
      'Droit de douane inconnu : indiquez une position tarifaire présente au corpus, ou saisissez le taux.'
      using errcode = '22023';
  end if;

  -- Ligne d'information : la valeur en douane, montrée parce que c'est elle
  -- que le client conteste quand il conteste.
  return query select
    'CAF'::text, 'Valeur en douane (CAF)'::text, 'fob'::text,
    p_valeur_fob_fcfa, null::numeric, round(v_caf), true;

  for v_taxe in
    select t.* from app_e08c374bc4_taxes_douanieres t
    where t.actif order by t.ordre
  loop
    v_base := case v_taxe.assiette
                when 'caf'           then v_caf
                when 'caf_et_droits' then v_caf + v_droits
                when 'fob'           then p_valeur_fob_fcfa
              end;

    v_montant := round(v_base * coalesce(v_taxe.taux, case when v_taxe.code = 'DD' then v_taux_dd else 0 end));

    -- Seules les taxes assises sur la valeur en douane entrent dans l'assiette
    -- de celles qui viennent après : ajouter la TVA à sa propre base la ferait
    -- se calculer sur elle-même.
    if v_taxe.assiette = 'caf' then
      v_droits := v_droits + v_montant;
    end if;

    return query select
      v_taxe.code, v_taxe.libelle, v_taxe.assiette, round(v_base),
      coalesce(v_taxe.taux, case when v_taxe.code = 'DD' then v_taux_dd end),
      v_montant,
      -- Le droit de douane n'est confirmé que si sa position l'est aussi.
      case when v_taxe.code = 'DD'
           then v_taxe.confirme and coalesce(
                  (select pt.confirme from app_e08c374bc4_positions_tarifaires pt
                    where pt.code = p_position), false)
           else v_taxe.confirme end;
  end loop;
end;
$$;

revoke execute on function app_e08c374bc4_liquider(numeric, numeric, numeric, text, numeric) from public;
grant execute on function app_e08c374bc4_liquider(numeric, numeric, numeric, text, numeric) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Le garde-fou dont dépend la cotation automatique
-- ---------------------------------------------------------------------------
-- Tant que ceci renvoie faux, Maylary n'a pas le droit de fabriquer un prix
-- ferme à partir d'une liquidation : il basculera en cotation manuelle.
create or replace function app_e08c374bc4_tarif_confirme()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from app_e08c374bc4_taxes_douanieres where actif and not confirme
  );
$$;

grant execute on function app_e08c374bc4_tarif_confirme() to anon, authenticated;
