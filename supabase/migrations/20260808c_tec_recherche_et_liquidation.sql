-- Chercher et vérifier dans le corpus TEC.
--
-- `app_e08c374bc4_tec_verifier` applique la règle absolue du § 5.2 du document
-- de référence : si le code n'existe pas en base, AUCUN taux n'est rendu. On
-- propose seulement le code le plus proche, clairement marqué non confirmé.
-- C'est ce qui protège le client d'un redressement et Maylary de sa réputation.
--
-- `app_e08c374bc4_tec_chercher` cherche en OU et non en ET. Exiger tous les
-- mots saisis — comportement de `plainto_tsquery` — ne ramenait rien pour
-- « téléphone portable », alors que la nomenclature dit « téléphones pour
-- réseaux cellulaires ». Et la tolérance aux fautes passe par
-- `word_similarity` et non `similarity` : la seconde compare la saisie à la
-- désignation entière, or certaines font 780 caractères — deux mots justes y
-- obtiennent une similarité proche de zéro.

create or replace function app_e08c374bc4_tec_verifier(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code    text;
  v_ligne   app_e08c374bc4_tec_dd_reference;
  v_proche  app_e08c374bc4_tec_dd_reference;
  v_tarif   record;
begin
  v_code := regexp_replace(coalesce(p_code, ''), '[^0-9]', '', 'g');
  if length(v_code) = 10 then
    v_code := substr(v_code,1,4) || '.' || substr(v_code,5,2) || '.' ||
              substr(v_code,7,2) || '.' || substr(v_code,9,2);
  end if;

  select * into v_tarif from app_e08c374bc4_parametres_tarif limit 1;
  select * into v_ligne from app_e08c374bc4_tec_dd_reference where code_hs = v_code;

  if v_ligne.code_hs is not null then
    return jsonb_build_object(
      'trouve', true,
      'code_hs', v_ligne.code_hs,
      'designation', v_ligne.designation,
      'unite_us', v_ligne.unite_us,
      'taux_dd_pourcent', v_ligne.taux_dd,
      'categorie', v_ligne.categorie,
      'statut', v_ligne.statut,
      'verifie_en_base', true,
      'mention', 'Taux vérifié dans la base TEC UEMOA officielle (' || v_ligne.source_reglement || ').',
      'tarif', jsonb_build_object('libelle', v_tarif.libelle_tarif, 'date_version', v_tarif.date_version)
    );
  end if;

  -- Introuvable : on cherche le voisin le plus proche, du plus précis au moins
  -- précis. Il est donné à titre indicatif seulement — jamais son taux.
  select * into v_proche from app_e08c374bc4_tec_dd_reference
  where left(code_hs, 7) = left(v_code, 7) order by code_hs limit 1;
  if v_proche.code_hs is null then
    select * into v_proche from app_e08c374bc4_tec_dd_reference
    where left(code_hs, 4) = left(v_code, 4) order by code_hs limit 1;
  end if;
  if v_proche.code_hs is null then
    select * into v_proche from app_e08c374bc4_tec_dd_reference
    where left(code_hs, 2) = left(v_code, 2) order by code_hs limit 1;
  end if;

  return jsonb_build_object(
    'trouve', false,
    'code_recherche', nullif(v_code, ''),
    'verifie_en_base', false,
    -- Aucun taux. C'est le point entier de la règle : une estimation affichée
    -- sur un écran devient un chiffre sur lequel quelqu'un s'engage.
    'taux_dd_pourcent', null,
    'code_proche_indicatif', v_proche.code_hs,
    'designation_proche', v_proche.designation,
    'mention_utilisateur',
      'Ce code n''a pas pu être confirmé dans la base TEC UEMOA officielle. '
      || 'Aucun taux n''est affiché : une vérification manuelle est nécessaire.'
      || case when v_proche.code_hs is not null
              then ' Le code le plus proche trouvé en base est ' || v_proche.code_hs
                   || ', donné à titre indicatif et non confirmé.'
              else '' end,
    'tarif', jsonb_build_object('libelle', v_tarif.libelle_tarif, 'date_version', v_tarif.date_version)
  );
end;
$$;

grant execute on function app_e08c374bc4_tec_verifier(text) to anon, authenticated;

create or replace function app_e08c374bc4_tec_chercher(
  p_texte  text,
  p_limite integer default 15
)
returns table (
  code_hs      text,
  designation  text,
  unite_us     text,
  taux_dd      numeric,
  categorie    smallint,
  statut       text,
  pertinence   real
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_brut     text := btrim(coalesce(p_texte, ''));
  v_chiffres text := regexp_replace(coalesce(p_texte, ''), '[^0-9]', '', 'g');
  v_mots     text[];
  v_q        tsquery;
  v_limite   integer := greatest(1, least(coalesce(p_limite, 15), 50));
begin
  if length(v_brut) < 2 then
    return;
  end if;

  -- Une saisie de quatre chiffres ou plus est une position tarifaire, pas une
  -- description. On répond par les codes qui commencent par là.
  if length(v_chiffres) >= 4 then
    return query
      select t.code_hs, t.designation, t.unite_us, t.taux_dd, t.categorie, t.statut, 1.0::real
      from app_e08c374bc4_tec_dd_reference t
      where replace(t.code_hs, '.', '') like v_chiffres || '%'
      order by t.code_hs
      limit v_limite;
    if found then
      return;
    end if;
  end if;

  select array_agg(m) into v_mots
  from unnest(regexp_split_to_array(lower(v_brut), '[^[:alnum:]]+')) m
  where length(m) >= 3;

  if v_mots is not null and array_length(v_mots, 1) > 0 then
    v_q := websearch_to_tsquery('french', array_to_string(v_mots, ' or '));
  end if;

  return query
    select t.code_hs, t.designation, t.unite_us, t.taux_dd, t.categorie, t.statut,
           greatest(
             case when v_q is not null
                  then ts_rank(to_tsvector('french', t.designation), v_q)
                  else 0 end,
             word_similarity(v_brut, t.designation)
           )::real as pertinence
    from app_e08c374bc4_tec_dd_reference t
    where (v_q is not null and to_tsvector('french', t.designation) @@ v_q)
       or (v_brut <% t.designation)
    order by pertinence desc, t.code_hs
    limit v_limite;
end;
$$;

grant execute on function app_e08c374bc4_tec_chercher(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- La liquidation lit désormais le corpus
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
  v_saisi       numeric;
  v_tec         app_e08c374bc4_tec_dd_reference;
  v_code        text;
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
      'position',        nullif(v_code, ''),
      'designation_tec', v_tec.designation,
      'unite_us',        v_tec.unite_us,
      'verifie_en_base', v_tec.code_hs is not null,
      'taux_dd',         v_taux_dd,
      'taux_dd_saisi',   v_saisi is not null,
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
