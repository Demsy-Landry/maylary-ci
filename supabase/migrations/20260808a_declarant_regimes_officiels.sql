-- Aligne le module sur le document de référence du fondateur
-- (`docs/reference/LE-DECLARANT_REFERENCE.md`), qui corrige trois choses.
--
--  1. « TS » est le **Timbre Statistique**, pas une « taxe spécifique ».
--  2. Les régimes portent leurs **codes officiels DGD-CI** (4000, 7000, 8000…)
--     et non des étiquettes inventées : c'est ce que le déclarant saisit, et le
--     menu du simulateur doit un jour se peupler de la centaine de codes réels
--     de la liste du 29 juillet 2021.
--  3. Surtout : **sous entrepôt sous douane, le timbre reste dû.** Mon
--     implémentation le mettait à zéro parce qu'elle liait toutes les taxes au
--     même drapeau. Le tableau du § 3.6 du document distingue trois
--     exigibilités séparées — droits, RPI, timbre — il faut donc trois
--     drapeaux, et non un seul.
--
-- Ajouté aussi : `depend_autorisation`. Certains régimes n'ont pas de réponse
-- unique — l'exonération d'une admission temporaire dépend de l'autorisation
-- accordée. Mieux vaut le dire à l'écran que choisir à la place du déclarant.

update app_e08c374bc4_taxes_douanieres
set libelle = 'Timbre statistique',
    note = 'Forfait par déclaration, jamais par ligne ni par quantité. Dû aussi sous entrepôt.'
where code = 'TS';

alter table app_e08c374bc4_regimes_douaniers
  add column if not exists ts_exigible boolean not null default true,
  add column if not exists caution_requise boolean not null default false,
  add column if not exists categorie text,
  add column if not exists depend_autorisation boolean not null default false;

delete from app_e08c374bc4_regimes_douaniers;

insert into app_e08c374bc4_regimes_douaniers
  (code, libelle, categorie, droits_exigibles, rpi_exigible, ts_exigible,
   caution_requise, depend_autorisation, mention, ordre) values
  ('4000', 'Mise à la consommation directe', 'import', true, true, true, false, false,
   'Droits et taxes exigibles au comptant.', 10),
  ('4050', 'Mise à la consommation en suite d''admission temporaire', 'import', true, true, true, false, false,
   'Droits et taxes exigibles à la sortie de l''admission temporaire.', 20),
  ('7000', 'Entrée en entrepôt de stockage', 'entrepot', false, true, true, false, false,
   'Droits suspendus jusqu''à la sortie de l''entrepôt, où le calcul redevient celui de la mise à la consommation. La redevance informatique et le timbre restent dus.', 30),
  ('8000', 'Transit national', 'transit', false, false, false, true, false,
   'Aucun droit payé au moment du transit : une caution ou un acquit-à-caution est exigé à la place.', 40),
  ('5000', 'Admission temporaire ordinaire', 'admission_temporaire', false, true, true, false, true,
   'Exonération totale ou partielle selon l''autorisation accordée. Engagement de réexportation requis dans un délai déterminé. Les montants ci-dessous sont donnés à titre indicatif : l''exonération réelle dépend de votre autorisation.', 50),
  ('5200', 'Admission temporaire pour perfectionnement actif', 'admission_temporaire', false, true, true, false, true,
   'Exonération totale ou partielle selon l''autorisation accordée. Engagement de réexportation requis. Les montants ci-dessous sont indicatifs.', 60),
  ('9200', 'Entrée en zone franche', 'zone_franche', false, true, true, false, true,
   'Régime suspensif de zone franche. Le traitement exact dépend du statut de l''entreprise bénéficiaire.', 70),
  ('1000', 'Exportation définitive', 'export', false, true, true, false, true,
   'Régime d''exportation : les droits de sortie éventuels ne relèvent pas du barème d''importation ci-dessous.', 80);

-- ---------------------------------------------------------------------------
-- Le calcul suit
-- ---------------------------------------------------------------------------
create or replace function app_e08c374bc4_liquider_declaration(
  p_lignes           jsonb,
  p_fret_total       numeric default 0,
  p_assurance_total  numeric default 0,
  p_poids_brut_total numeric default null,
  p_regime           text    default '4000'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_regime      app_e08c374bc4_regimes_douaniers;
  v_ligne       jsonb;
  v_fob_total   numeric := 0;
  v_poids_total numeric;
  v_resultats   jsonb := '[]'::jsonb;

  v_fob         numeric;
  v_poids       numeric;
  v_taux_dd     numeric;
  v_fret_l      numeric;
  v_assur_l     numeric;
  v_poids_stat  numeric;
  v_caf_l       numeric;
  v_base_tva    numeric;
  v_taxe        record;
  v_montant     numeric;
  v_taxes_l     jsonb;

  v_caf_total   numeric := 0;
  v_totaux      jsonb := '{}'::jsonb;
  v_cumul       numeric;
  v_rpi         numeric := 0;
  v_ts          numeric := 0;
begin
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) = 0 then
    raise exception 'Aucune ligne de marchandise à liquider.' using errcode = '22023';
  end if;

  select * into v_regime from app_e08c374bc4_regimes_douaniers where code = coalesce(p_regime, '4000');
  if v_regime.code is null then
    raise exception 'Régime douanier inconnu : %.', p_regime using errcode = '22023';
  end if;

  -- Totaux préalables : la répartition au prorata a besoin des dénominateurs
  -- avant de pouvoir calculer quoi que ce soit.
  for v_ligne in select * from jsonb_array_elements(p_lignes) loop
    v_fob_total := v_fob_total + coalesce((v_ligne->>'fob')::numeric, 0);
  end loop;

  if v_fob_total <= 0 then
    raise exception 'La valeur FOB totale doit être strictement positive.' using errcode = '22023';
  end if;

  select coalesce(p_poids_brut_total,
                  sum(coalesce((l->>'poids_brut')::numeric, 0)))
    into v_poids_total
  from jsonb_array_elements(p_lignes) l;

  for v_ligne in select * from jsonb_array_elements(p_lignes) loop
    v_fob   := coalesce((v_ligne->>'fob')::numeric, 0);
    v_poids := coalesce((v_ligne->>'poids_brut')::numeric, 0);

    v_taux_dd := coalesce(
      (v_ligne->>'taux_dd')::numeric,
      (select pt.taux_dd from app_e08c374bc4_positions_tarifaires pt
        where pt.code = (v_ligne->>'position'))
    );

    if v_taux_dd is null then
      raise exception
        'Ligne « % » : droit de douane inconnu. Indiquez une position présente au corpus, ou saisissez le taux.',
        coalesce(v_ligne->>'designation', v_ligne->>'position', '?') using errcode = '22023';
    end if;

    -- Le fret se répartit au poids : sans poids renseigné nulle part, on ne
    -- peut pas répartir, et répartir à la valeur serait une autre formule
    -- présentée sous le même nom.
    v_fret_l := case
      when coalesce(p_fret_total, 0) = 0 then 0
      when coalesce(v_poids_total, 0) > 0 then p_fret_total / v_poids_total * v_poids
      else null
    end;

    if v_fret_l is null then
      raise exception
        'Fret à répartir mais aucun poids brut renseigné : la répartition du fret se fait au poids.'
        using errcode = '22023';
    end if;

    v_assur_l    := coalesce(p_assurance_total, 0) / v_fob_total * v_fob;
    v_poids_stat := coalesce(v_poids_total, 0) / v_fob_total * v_fob;
    v_caf_l      := v_fob + v_fret_l + v_assur_l;
    v_caf_total  := v_caf_total + v_caf_l;

    -- Assiette de la TVA : la valeur en douane augmentée des seules taxes qui
    -- y entrent. Elle se construit en deux temps, d'où la première boucle.
    v_base_tva := v_caf_l;
    for v_taxe in
      select * from app_e08c374bc4_taxes_douanieres
      where actif and niveau = 'ligne' and entre_base_tva order by ordre
    loop
      v_base_tva := v_base_tva + round(v_caf_l * coalesce(v_taxe.taux, v_taux_dd));
    end loop;

    v_taxes_l := '[]'::jsonb;
    for v_taxe in
      select * from app_e08c374bc4_taxes_douanieres
      where actif and niveau = 'ligne' order by ordre
    loop
      v_montant := case
        when not v_regime.droits_exigibles then 0
        when v_taxe.assiette = 'caf'      then round(v_caf_l * coalesce(v_taxe.taux, v_taux_dd))
        when v_taxe.assiette = 'base_tva' then round(v_base_tva * v_taxe.taux)
        else 0
      end;

      v_taxes_l := v_taxes_l || jsonb_build_object(
        'code', v_taxe.code,
        'libelle', v_taxe.libelle,
        'base_fcfa', round(case v_taxe.assiette when 'base_tva' then v_base_tva else v_caf_l end),
        'taux', coalesce(v_taxe.taux, v_taux_dd),
        'montant_fcfa', v_montant,
        'confirme', v_taxe.confirme
      );
    end loop;

    v_resultats := v_resultats || jsonb_build_object(
      'numero',          v_ligne->>'numero',
      'designation',     v_ligne->>'designation',
      'position',        v_ligne->>'position',
      'taux_dd',         v_taux_dd,
      'fob_fcfa',        round(v_fob),
      'poids_brut_kg',   v_poids,
      'poids_stat_kg',   round(v_poids_stat, 3),
      'fret_fcfa',       round(v_fret_l),
      'assurance_fcfa',  round(v_assur_l),
      'part_fret',       case when coalesce(v_poids_total, 0) > 0 then round(v_poids / v_poids_total, 6) else 0 end,
      'part_valeur',     round(v_fob / v_fob_total, 6),
      'caf_fcfa',        round(v_caf_l),
      'base_tva_fcfa',   round(v_base_tva),
      'taxes',           v_taxes_l
    );
  end loop;

  -- Taxes de niveau déclaration : une seule fois, quel que soit le nombre de
  -- lignes. C'est la distinction que le premier modèle ne portait pas.
  for v_taxe in
    select * from app_e08c374bc4_taxes_douanieres
    where actif and niveau = 'declaration' order by ordre
  loop
    if v_taxe.code = 'RPI' then
      v_rpi := case when v_regime.rpi_exigible
                    then greatest(round(v_fob_total * v_taxe.taux), coalesce(v_taxe.minimum_fcfa, 0))
                    else 0 end;
    elsif v_taxe.code = 'TS' then
      -- Le timbre suit son propre drapeau : sous entrepôt les droits sont
      -- suspendus mais le timbre reste dû.
      v_ts := case when v_regime.ts_exigible then coalesce(v_taxe.montant_fixe_fcfa, 0) else 0 end;
    end if;
  end loop;

  -- Somme de chaque taxe de ligne, sur toutes les lignes.
  for v_taxe in
    select * from app_e08c374bc4_taxes_douanieres
    where actif and niveau = 'ligne' order by ordre
  loop
    select coalesce(sum((t->>'montant_fcfa')::numeric), 0) into v_cumul
    from jsonb_array_elements(v_resultats) l,
         jsonb_array_elements(l->'taxes') t
    where t->>'code' = v_taxe.code;
    v_totaux := v_totaux || jsonb_build_object(v_taxe.code, v_cumul);
  end loop;

  v_totaux := v_totaux || jsonb_build_object('RPI', v_rpi, 'TS', v_ts);

  select coalesce(sum(value::numeric), 0) into v_cumul from jsonb_each_text(v_totaux);

  return jsonb_build_object(
    'regime', jsonb_build_object(
      'code', v_regime.code, 'libelle', v_regime.libelle, 'mention', v_regime.mention,
      'categorie', v_regime.categorie,
      'droits_exigibles', v_regime.droits_exigibles,
      'caution_requise', v_regime.caution_requise,
      'depend_autorisation', v_regime.depend_autorisation),
    'tarif', (select jsonb_build_object('libelle', libelle_tarif, 'date_version', date_version)
                from app_e08c374bc4_parametres_tarif limit 1),
    'tarif_confirme', app_e08c374bc4_tarif_confirme(),
    'globaux', jsonb_build_object(
      'fob_total_fcfa',        round(v_fob_total),
      'fret_total_fcfa',       round(coalesce(p_fret_total, 0)),
      'assurance_total_fcfa',  round(coalesce(p_assurance_total, 0)),
      'poids_brut_total_kg',   v_poids_total,
      'caf_total_fcfa',        round(v_caf_total)),
    'lignes', v_resultats,
    'totaux_taxes', v_totaux,
    'total_a_payer_fcfa', v_cumul
  );
end;
$$;

revoke execute on function app_e08c374bc4_liquider_declaration(jsonb, numeric, numeric, numeric, text) from public;
grant execute on function app_e08c374bc4_liquider_declaration(jsonb, numeric, numeric, numeric, text) to anon, authenticated;

-- La liquidation d'un article isolé n'est plus qu'un cas particulier : une
-- déclaration d'une seule ligne. Deux calculs séparés finiraient par diverger.
