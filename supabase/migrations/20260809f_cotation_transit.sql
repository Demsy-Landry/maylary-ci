-- Le Déclarant devient le socle de tous les chiffrages de transit.
--
-- Ce que cette migration remplace, et pourquoi c'est urgent.
--
-- L'estimation instantanée montrée au client sur une demande d'import se
-- calculait ainsi, dans `src/lib/supabase.ts` :
--
--     douaneEtTransitEstimes = (valeur + fret) × 0,25
--
-- Vingt-cinq pour cent. Un forfait que j'avais posé faute de moteur, affiché à
-- un client comme un ordre de grandeur. C'est exactement ce que la règle du
-- module Déclarant interdit : un chiffre qu'on n'a pas vérifié devient un
-- chiffre sur lequel quelqu'un s'engage. Sur une marchandise à 5 % de droit il
-- surestime du simple au double ; sur du 35 % il sous-estime, et c'est pire —
-- le client découvre la différence au moment de payer.
--
-- Et la majoration par incoterm multipliait le *fret* par un coefficient
-- (EXW 1,15, DDP 0,75). Un incoterm ne majore pas un fret. Il dit qui supporte
-- quelle étape : le pré-acheminement, le transport principal, l'assurance, le
-- dédouanement export, le dédouanement import, les droits, la livraison
-- finale. Sept réponses binaires, pas un coefficient.
--
-- Le remplacement tient en une idée : un seul moteur de chiffrage, qui délègue
-- la partie douanière à `liquider_declaration` — donc au corpus TEC — et qui
-- déclare ce qu'il ne sait pas au lieu de le combler.

-- ---------------------------------------------------------------------------
-- 1. L'incoterm dit qui supporte quoi
-- ---------------------------------------------------------------------------

alter table app_e08c374bc4_parametres_incoterm
  add column if not exists dedouanement_export_a_charge boolean not null default true,
  add column if not exists dedouanement_import_a_charge boolean not null default true,
  add column if not exists droits_a_charge              boolean not null default true,
  add column if not exists livraison_finale_a_charge    boolean not null default true,
  add column if not exists point_transfert              text;

comment on column app_e08c374bc4_parametres_incoterm.droits_a_charge is
  'Faux sous DDP seulement : le vendeur acquitte les droits et taxes à l''importation.';

-- Incoterms 2020, côté acheteur importateur. « À charge » signifie : supporté
-- par nous ou par notre client, pas par le vendeur étranger.
update app_e08c374bc4_parametres_incoterm set
  dedouanement_export_a_charge = case incoterm when 'EXW' then true else false end,
  dedouanement_import_a_charge = case incoterm when 'DDP' then false else true end,
  droits_a_charge              = case incoterm when 'DDP' then false else true end,
  livraison_finale_a_charge    = incoterm not in ('DAP', 'DDP'),
  point_transfert = case incoterm
    when 'EXW' then 'Locaux du vendeur, marchandise non chargée'
    when 'FCA' then 'Remise au transporteur désigné par l''acheteur'
    when 'FOB' then 'À bord du navire au port d''embarquement'
    when 'CFR' then 'À bord du navire au port d''embarquement — le vendeur paie le fret'
    when 'CIF' then 'À bord du navire au port d''embarquement — le vendeur paie fret et assurance'
    when 'DAP' then 'Au lieu de destination convenu, avant déchargement'
    when 'DDP' then 'Au lieu de destination convenu, droits acquittés par le vendeur'
  end;

-- ---------------------------------------------------------------------------
-- 2. Les frais de transit local
-- ---------------------------------------------------------------------------
-- Les postes sont nommés — ce sont ceux d'un dossier de dédouanement en Côte
-- d'Ivoire, je les connais. Les montants ne le sont pas, et je ne les invente
-- pas : chaque poste naît `confirme = false` avec un montant nul, et le moteur
-- refuse d'annoncer un total tant qu'il en reste un seul non confirmé. C'est
-- la même discipline que le corpus TEC, appliquée au transit.
--
-- Le fondateur renseigne les montants depuis l'écran d'administration, ou par
-- un UPDATE. Le jour où un poste est tarifé, il bascule `confirme = true` et
-- entre dans le total sans qu'on touche au code.

create table if not exists app_e08c374bc4_frais_transit_local (
  code        text primary key,
  libelle     text not null,
  -- 'import', 'export' ou 'les_deux' : un BSC ne concerne que l'import, une
  -- attestation d'exportation que l'export.
  sens        text not null default 'les_deux'
              check (sens in ('import', 'export', 'les_deux')),
  mode        text not null default 'tous'
              check (mode in ('tous', 'maritime', 'aerien', 'routier')),
  -- Comment le poste se calcule. Un acconage se paie au conteneur, des
  -- honoraires au pourcentage de la valeur en douane, un scanner au forfait.
  assiette    text not null
              check (assiette in ('forfait', 'par_kg', 'par_m3', 'par_conteneur', 'pct_caf')),
  montant_fcfa numeric(14,2),
  taux        numeric(6,5),
  minimum_fcfa numeric(14,2),
  -- Faux tant que le montant n'a pas été relevé sur une facture réelle.
  confirme    boolean not null default false,
  actif       boolean not null default true,
  ordre       integer not null default 100,
  source      text,
  note        text
);

insert into app_e08c374bc4_frais_transit_local
  (code, libelle, sens, mode, assiette, ordre, note)
values
  ('HONORAIRES', 'Honoraires de transit et de déclaration', 'les_deux', 'tous', 'pct_caf', 10,
   'Rémunération du commissionnaire agréé. Souvent un pourcentage de la valeur en douane, avec un minimum.'),
  ('DOSSIER',    'Frais de dossier', 'les_deux', 'tous', 'forfait', 20,
   'Ouverture et suivi administratif du dossier.'),
  ('BSC',        'Bordereau de suivi des cargaisons (BSC/BESC)', 'import', 'maritime', 'forfait', 30,
   'Obligatoire à l''import maritime. Se prend avant l''embarquement — pris après, il coûte une pénalité.'),
  ('ACCONAGE',   'Acconage et manutention portuaire', 'import', 'maritime', 'par_conteneur', 40,
   'Facturé par la société d''acconage selon le type et la taille du conteneur.'),
  ('MAGASINAGE', 'Magasinage et stationnement', 'import', 'tous', 'forfait', 50,
   'Court par nature : il croît avec le nombre de jours passés sous douane. Le montant retenu ici est celui d''un dossier sans retard.'),
  ('SCANNER',    'Passage au scanner', 'import', 'tous', 'forfait', 60,
   'Contrôle non intrusif, exigible selon le circuit de dédouanement.'),
  ('MANUTENTION_AERIEN', 'Manutention et magasinage aéroport', 'import', 'aerien', 'par_kg', 70,
   'Facturé au poids par le gestionnaire de fret aérien.'),
  ('TRANSPORT_LOCAL', 'Transport terrestre jusqu''au lieu de livraison', 'les_deux', 'tous', 'forfait', 80,
   'Dépend de la distance et du type de véhicule. À coter par destination.'),
  ('DEBOURS',    'Débours et frais divers', 'les_deux', 'tous', 'forfait', 90,
   'Avances faites pour le compte du client, refacturées à l''identique.'),
  ('ATTESTATION_EXPORT', 'Formalités et attestations à l''export', 'export', 'tous', 'forfait', 100,
   'Certificat d''origine, phytosanitaire, attestation d''exportation selon la marchandise et la destination.')
on conflict (code) do nothing;

alter table app_e08c374bc4_frais_transit_local enable row level security;

drop policy if exists "Frais de transit lisibles" on app_e08c374bc4_frais_transit_local;
create policy "Frais de transit lisibles"
  on app_e08c374bc4_frais_transit_local for select using (true);

drop policy if exists "Frais de transit modifiables par l'admin" on app_e08c374bc4_frais_transit_local;
create policy "Frais de transit modifiables par l'admin"
  on app_e08c374bc4_frais_transit_local for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

-- ---------------------------------------------------------------------------
-- 3. Le moteur de chiffrage
-- ---------------------------------------------------------------------------
/**
 * Coût rendu complet d'une opération de transit — import ou export.
 *
 * Ce que la fonction ne fait pas, et c'est délibéré : elle ne calcule aucun
 * droit elle-même. Elle appelle `liquider_declaration`, qui lit le corpus TEC.
 * Il n'y a donc qu'un seul endroit au monde où se calcule un droit de douane
 * dans cette application, et c'est celui qui refuse d'inventer un taux.
 *
 * `complet` vaut faux dès qu'un poste manque, et `manquants` les nomme. Un
 * écran qui reçoit `complet = false` doit présenter une fourchette ou un
 * « chiffrage en cours », jamais un total. C'est la seule façon de tenir la
 * promesse « il choisit, il paie, le reste est fait » sans mentir sur le prix.
 */
create or replace function app_e08c374bc4_coter(
  p_lignes          jsonb,
  p_incoterm        text    default 'FOB',
  p_sens            text    default 'import',
  p_regime          text    default null,
  p_mode            text    default 'maritime',
  p_fret_total      numeric default null,
  p_assurance_total numeric default null,
  p_poids_total     numeric default null,
  p_conteneurs      numeric default 0,
  p_volume_m3       numeric default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inco        app_e08c374bc4_parametres_incoterm;
  v_regime      text;
  v_marchandise numeric := 0;
  v_poids       numeric := 0;
  v_fret        numeric;
  v_assurance   numeric;
  v_valeur_ass  numeric := 0;
  v_prime_nette numeric := 0;
  v_par         record;
  v_liquidation jsonb;
  v_douane      numeric := 0;
  v_poste       record;
  v_postes      jsonb := '[]'::jsonb;
  v_transit     numeric := 0;
  v_montant     numeric;
  v_caf         numeric;
  v_manquants   text[] := '{}';
  v_complet     boolean := true;
  v_total       numeric;
begin
  if p_sens not in ('import', 'export') then
    raise exception 'Sens inconnu : %. Attendu « import » ou « export ».', p_sens using errcode = '22023';
  end if;

  select * into v_inco from app_e08c374bc4_parametres_incoterm where incoterm = upper(p_incoterm);
  if v_inco.incoterm is null then
    raise exception 'Incoterm inconnu : %.', p_incoterm using errcode = '22023';
  end if;

  -- À défaut de régime, celui qui correspond au sens : mise à la consommation
  -- à l'import, exportation définitive à l'export.
  v_regime := coalesce(p_regime, case p_sens when 'export' then '1000' else '4000' end);

  select coalesce(sum((l->>'fob')::numeric), 0),
         coalesce(p_poids_total, sum(coalesce((l->>'poids_brut')::numeric, 0)))
    into v_marchandise, v_poids
  from jsonb_array_elements(p_lignes) l;

  -- --- Fret ---------------------------------------------------------------
  -- Aucun barème au kilo inventé ici. Si le fret n'est pas fourni et qu'il est
  -- à notre charge, il manque — et le dire vaut mieux que de le deviner.
  v_fret := case when v_inco.part_fret = 0 then 0 else p_fret_total end;
  if v_fret is null then
    v_complet := false;
    v_manquants := v_manquants || 'fret';
    v_fret := 0;
  end if;

  -- --- Assurance ----------------------------------------------------------
  -- Barème réel de l'assureur ivoirien, déjà éprouvé côté import :
  -- (valeur + fret) × 110 % × taux, + frais de police, puis + taxe.
  select * into v_par from app_e08c374bc4_parametres_import limit 1;
  if not v_inco.assurance_a_charge then
    v_assurance := 0;
  elsif p_assurance_total is not null then
    v_assurance := p_assurance_total;
  elsif v_par is null then
    v_assurance := 0;
    v_complet := false;
    v_manquants := v_manquants || 'assurance';
  else
    v_valeur_ass  := round((v_marchandise + v_fret) * v_par.taux_couverture_assurance);
    v_prime_nette := round(v_valeur_ass * v_par.taux_assurance);
    v_assurance   := round((v_prime_nette + v_par.frais_police_assurance_fcfa)
                           * (1 + v_par.taux_taxe_assurance));
  end if;

  -- --- Droits et taxes ----------------------------------------------------
  -- Sous DDP le vendeur les acquitte : ils ne sont pas de notre côté du devis,
  -- mais on les calcule quand même pour les montrer, parce qu'ils sont déjà
  -- dans le prix payé au fournisseur et qu'un acheteur a le droit de le voir.
  v_liquidation := app_e08c374bc4_liquider_declaration(
    p_lignes, v_fret, v_assurance, nullif(v_poids, 0), v_regime);
  v_caf    := (v_liquidation->'globaux'->>'caf_total_fcfa')::numeric;
  v_douane := case when v_inco.droits_a_charge
                   then (v_liquidation->>'total_a_payer_fcfa')::numeric
                   else 0 end;

  -- --- Transit local ------------------------------------------------------
  for v_poste in
    select * from app_e08c374bc4_frais_transit_local
    where actif
      and (sens = 'les_deux' or sens = p_sens)
      and (mode = 'tous' or mode = p_mode)
    order by ordre
  loop
    if not v_poste.confirme then
      v_complet := false;
      v_manquants := v_manquants || ('transit:' || v_poste.code);
      v_montant := null;
    else
      v_montant := case v_poste.assiette
        when 'forfait'       then coalesce(v_poste.montant_fcfa, 0)
        when 'par_kg'        then coalesce(v_poste.montant_fcfa, 0) * v_poids
        when 'par_m3'        then coalesce(v_poste.montant_fcfa, 0) * coalesce(p_volume_m3, 0)
        when 'par_conteneur' then coalesce(v_poste.montant_fcfa, 0) * coalesce(p_conteneurs, 0)
        when 'pct_caf'       then greatest(round(v_caf * coalesce(v_poste.taux, 0)),
                                           coalesce(v_poste.minimum_fcfa, 0))
      end;
      v_transit := v_transit + v_montant;
    end if;

    v_postes := v_postes || jsonb_build_object(
      'code', v_poste.code, 'libelle', v_poste.libelle,
      'assiette', v_poste.assiette, 'confirme', v_poste.confirme,
      'montant_fcfa', v_montant, 'note', v_poste.note);
  end loop;

  v_total := v_marchandise + v_fret + v_assurance + v_douane + v_transit;

  return jsonb_build_object(
    'sens', p_sens,
    'mode', p_mode,
    'incoterm', jsonb_build_object(
      'code', v_inco.incoterm, 'libelle', v_inco.libelle,
      'commentaire', v_inco.commentaire, 'point_transfert', v_inco.point_transfert,
      'part_fret', v_inco.part_fret,
      'assurance_a_charge', v_inco.assurance_a_charge,
      'droits_a_charge', v_inco.droits_a_charge,
      'dedouanement_import_a_charge', v_inco.dedouanement_import_a_charge,
      'dedouanement_export_a_charge', v_inco.dedouanement_export_a_charge,
      'livraison_finale_a_charge', v_inco.livraison_finale_a_charge),
    'marchandise_fcfa', round(v_marchandise),
    'fret_fcfa',        round(v_fret),
    'assurance', jsonb_build_object(
      'montant_fcfa', round(v_assurance),
      'valeur_assuree_fcfa', v_valeur_ass,
      'prime_nette_fcfa', v_prime_nette,
      'a_notre_charge', v_inco.assurance_a_charge),
    'douane', jsonb_build_object(
      'montant_fcfa', round(v_douane),
      'a_notre_charge', v_inco.droits_a_charge,
      'liquidation', v_liquidation),
    'transit_local', jsonb_build_object(
      'postes', v_postes, 'total_fcfa', round(v_transit)),
    'caf_fcfa', round(coalesce(v_caf, 0)),
    'total_fcfa', case when v_complet then round(v_total) else null end,
    'total_partiel_fcfa', round(v_total),
    'complet', v_complet,
    'manquants', to_jsonb(v_manquants)
  );
end;
$$;

grant execute on function app_e08c374bc4_coter(jsonb, text, text, text, text, numeric, numeric, numeric, numeric, numeric)
  to anon, authenticated;
