-- Le groupage passe devant, le conteneur complet passe derrière.
--
-- Décision du fondateur : « Le côté maritime TC plein pour un seul envoi doit
-- être en arrière-plan pour l'instant. Je préfère le groupage. »
--
-- Elle est juste, et pas seulement commercialement. Un conteneur complet
-- suppose un client qui a de quoi le remplir — c'est-à-dire un client qui a
-- déjà un transitaire. Le groupage sert celui qui a trois palettes et personne
-- pour les embarquer, et c'est là que Maylary a quelque chose à apporter. Le
-- conteneur complet reste possible, mais il cesse d'être le cas par défaut.
--
-- Ce que cela change dans le calcul, et c'est tout le sujet : en conteneur
-- complet on paie le conteneur, point. En groupage on paie l'**unité payante**,
-- qui est le plus grand du volume en m³ et du poids converti — « à l'avantage
-- du navire ». Deux marchandises de même poids ne coûtent pas le même fret si
-- l'une est du coton et l'autre de la fonte. Un moteur de cotation qui ignore
-- cette règle se trompe systématiquement sur la marchandise volumineuse, qui
-- est précisément celle du petit importateur.
--
-- La règle existe déjà dans `supabase/functions/_partage/fret-groupage.ts`,
-- éprouvée par le simulateur de groupage. On ne la réécrit pas : on met ses
-- équivalences en table pour que le moteur SQL et le module Deno cessent de
-- pouvoir diverger, et on lit la table.

create table if not exists app_e08c374bc4_equivalences_fret (
  mode              text primary key check (mode in ('maritime', 'aerien', 'routier')),
  kg_par_m3         numeric(10,3) not null check (kg_par_m3 > 0),
  libelle           text not null,
  source            text
);

insert into app_e08c374bc4_equivalences_fret (mode, kg_par_m3, libelle, source) values
  ('maritime', 1000,     'Maritime — 1 tonne pour 1 m³',
   'Usage des groupeurs : l''unité payante est le plus grand du m³ et de la tonne.'),
  ('aerien',   166.667,  'Aérien — 1 m³ pour 166,67 kg',
   'Diviseur volumétrique IATA de 6 000 cm³/kg.'),
  ('routier',  333,      'Routier — 1 m³ pour 333 kg',
   'Usage du groupage routier.')
on conflict (mode) do nothing;

alter table app_e08c374bc4_equivalences_fret enable row level security;
drop policy if exists "Équivalences de fret lisibles" on app_e08c374bc4_equivalences_fret;
create policy "Équivalences de fret lisibles"
  on app_e08c374bc4_equivalences_fret for select using (true);
drop policy if exists "Équivalences de fret modifiables par l'admin" on app_e08c374bc4_equivalences_fret;
create policy "Équivalences de fret modifiables par l'admin"
  on app_e08c374bc4_equivalences_fret for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

-- ---------------------------------------------------------------------------
-- Les frais de transit dépendent aussi du conditionnement
-- ---------------------------------------------------------------------------
-- L'acconage se facture au conteneur : il n'a pas de sens en groupage, où la
-- marchandise sort d'un conteneur partagé. Le dégroupage, lui, est l'inverse —
-- c'est le poste que le client de groupage découvre à l'arrivée s'il n'a pas
-- été annoncé, et c'est souvent celui qui fait la mauvaise surprise.

alter table app_e08c374bc4_frais_transit_local
  add column if not exists conditionnement text not null default 'tous'
    check (conditionnement in ('tous', 'groupage', 'conteneur'));

alter table app_e08c374bc4_frais_transit_local
  drop constraint if exists app_e08c374bc4_frais_transit_local_assiette_check;
alter table app_e08c374bc4_frais_transit_local
  add constraint app_e08c374bc4_frais_transit_local_assiette_check
  check (assiette in ('forfait', 'par_kg', 'par_m3', 'par_conteneur', 'par_up', 'pct_caf'));

update app_e08c374bc4_frais_transit_local
set conditionnement = 'conteneur'
where code = 'ACCONAGE';

insert into app_e08c374bc4_frais_transit_local
  (code, libelle, sens, mode, conditionnement, assiette, ordre, note)
values
  ('DEGROUPAGE', 'Dégroupage et déconsolidation', 'import', 'maritime', 'groupage', 'par_up', 35,
   'Sortie de la marchandise du conteneur partagé, au magasin du groupeur. Facturé à l''unité payante. C''est le poste que le client de groupage ne voit pas venir : il doit figurer au devis.'),
  ('GROUPAGE_DEPART', 'Groupage et empotage au départ', 'export', 'maritime', 'groupage', 'par_up', 36,
   'Consolidation de la marchandise dans le conteneur partagé au port d''embarquement.')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Le moteur apprend l'unité payante
-- ---------------------------------------------------------------------------

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
  p_volume_m3       numeric default 0,
  -- Le groupage est le cas par défaut. Un conteneur complet se demande.
  p_conditionnement text    default 'groupage',
  -- Unités payantes facturées au minimum par le groupeur, quel que soit le lot.
  p_minimum_up      numeric default 1
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
  v_kg_par_m3   numeric;
  v_up_reelle   numeric := 0;
  v_up          numeric := 0;
begin
  if p_sens not in ('import', 'export') then
    raise exception 'Sens inconnu : %. Attendu « import » ou « export ».', p_sens using errcode = '22023';
  end if;
  if p_conditionnement not in ('groupage', 'conteneur') then
    raise exception 'Conditionnement inconnu : %. Attendu « groupage » ou « conteneur ».',
      p_conditionnement using errcode = '22023';
  end if;

  select * into v_inco from app_e08c374bc4_parametres_incoterm where incoterm = upper(p_incoterm);
  if v_inco.incoterm is null then
    raise exception 'Incoterm inconnu : %.', p_incoterm using errcode = '22023';
  end if;

  v_regime := coalesce(p_regime, case p_sens when 'export' then '1000' else '4000' end);

  select coalesce(sum((l->>'fob')::numeric), 0),
         coalesce(p_poids_total, sum(coalesce((l->>'poids_brut')::numeric, 0)))
    into v_marchandise, v_poids
  from jsonb_array_elements(p_lignes) l;

  -- --- Unité payante ------------------------------------------------------
  -- Le plus grand du volume et du poids converti, « à l'avantage du navire ».
  -- Sans volume renseigné, on ne peut que retenir le poids : le dire vaut
  -- mieux que de supposer une densité.
  select kg_par_m3 into v_kg_par_m3 from app_e08c374bc4_equivalences_fret where mode = p_mode;
  if v_kg_par_m3 is not null then
    v_up_reelle := greatest(coalesce(p_volume_m3, 0), v_poids / v_kg_par_m3);
    v_up := greatest(v_up_reelle, coalesce(p_minimum_up, 0));
  end if;

  v_fret := case when v_inco.part_fret = 0 then 0 else p_fret_total end;
  if v_fret is null then
    v_complet := false;
    v_manquants := v_manquants || 'fret';
    v_fret := 0;
  end if;

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

  v_liquidation := app_e08c374bc4_liquider_declaration(
    p_lignes, v_fret, v_assurance, nullif(v_poids, 0), v_regime);
  v_caf    := (v_liquidation->'globaux'->>'caf_total_fcfa')::numeric;
  v_douane := case when v_inco.droits_a_charge
                   then (v_liquidation->>'total_a_payer_fcfa')::numeric
                   else 0 end;

  for v_poste in
    select * from app_e08c374bc4_frais_transit_local
    where actif
      and (sens = 'les_deux' or sens = p_sens)
      and (mode = 'tous' or mode = p_mode)
      and (conditionnement = 'tous' or conditionnement = p_conditionnement)
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
        when 'par_up'        then coalesce(v_poste.montant_fcfa, 0) * v_up
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
    'conditionnement', p_conditionnement,
    'unite_payante', jsonb_build_object(
      'reelle', round(v_up_reelle, 3),
      'facturee', round(v_up, 3),
      'minimum_applique', v_up_reelle < coalesce(p_minimum_up, 0),
      'kg_par_m3', v_kg_par_m3,
      'volume_m3', coalesce(p_volume_m3, 0),
      'poids_kg', v_poids,
      'paye_au_volume', coalesce(p_volume_m3, 0) > (case when v_kg_par_m3 > 0 then v_poids / v_kg_par_m3 else 0 end)),
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

-- L'ancienne signature à dix arguments disparaît : deux fonctions de même nom
-- dont l'une ignore le conditionnement, c'est la divergence garantie.
drop function if exists app_e08c374bc4_coter(jsonb, text, text, text, text, numeric, numeric, numeric, numeric, numeric);

grant execute on function app_e08c374bc4_coter(
  jsonb, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text, numeric)
  to anon, authenticated;
