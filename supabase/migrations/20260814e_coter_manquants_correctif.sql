-- ---------------------------------------------------------------------------
-- Le chiffrage plantait exactement là où il devait servir.
--
-- « app_e08c374bc4_coter » est la fonction qui monte un devis complet :
-- marchandise, fret, assurance, droits, transit local. Quand une donnée
-- manque, elle est censée rendre « complet: false » et la liste des postes
-- absents — c'est tout le principe de la maison : ne jamais inventer un
-- montant, dire lequel manque.
--
-- Elle levait en réalité une erreur SQL :
--
--   22P02 malformed array literal: "fret"
--   Array value must start with "{" or dimension information.
--
-- La cause tient en un caractère. « v_manquants || 'fret' » : à gauche un
-- text[], à droite une constante SANS TYPE. Postgres a deux opérateurs
-- candidats — tableau || élément, et tableau || tableau — et devant une
-- constante non typée il choisit le second. Il tente alors de lire « fret »
-- comme un littéral de tableau, et échoue.
--
-- Le poste voisin, « v_manquants || ('transit:' || v_poste.code) », ne
-- plantait pas : sa concaténation force le type text, l'ambiguïté disparaît.
-- C'est pourquoi le défaut est resté invisible — il ne se déclenche que sur
-- les deux seuls postes écrits en constante nue, le fret et l'assurance.
--
-- Conséquence réelle : l'outil de chiffrage du Déclarant renvoyait une erreur
-- au lieu d'un devis dès que le fret n'était pas fourni. Or la table des taux
-- de fret est vide — le fret n'est JAMAIS fourni aujourd'hui. L'outil censé
-- annoncer proprement ce qui manque était donc hors service en permanence,
-- et précisément dans le cas pour lequel il avait été écrit.
--
-- « array_append » n'a qu'une signature : l'ambiguïté ne peut pas revenir.
-- ---------------------------------------------------------------------------

create or replace function app_e08c374bc4_coter(
  p_lignes jsonb,
  p_incoterm text default 'FOB',
  p_sens text default 'import',
  p_regime text default null,
  p_mode text default 'maritime',
  p_fret_total numeric default null,
  p_assurance_total numeric default null,
  p_poids_total numeric default null,
  p_conteneurs numeric default 0,
  p_volume_m3 numeric default 0,
  p_conditionnement text default 'groupage',
  p_minimum_up numeric default 1
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
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

  select kg_par_m3 into v_kg_par_m3 from app_e08c374bc4_equivalences_fret where mode = p_mode;
  if v_kg_par_m3 is not null then
    v_up_reelle := greatest(coalesce(p_volume_m3, 0), v_poids / v_kg_par_m3);
    v_up := greatest(v_up_reelle, coalesce(p_minimum_up, 0));
  end if;

  v_fret := case when v_inco.part_fret = 0 then 0 else p_fret_total end;
  if v_fret is null then
    v_complet := false;
    v_manquants := array_append(v_manquants, 'fret');
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
    v_manquants := array_append(v_manquants, 'assurance');
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
      v_manquants := array_append(v_manquants, 'transit:' || v_poste.code);
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
$function$;
