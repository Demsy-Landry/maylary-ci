-- Référentiel complet des régimes douaniers de la Direction Générale des
-- Douanes de Côte d'Ivoire.
--
-- Source : « LISTE DES REGIMES A LA DATE DU 29 JUILLET 2021 », publiée par la
-- DGD-CI. 81 codes, transcrits verbatim — y compris les coquilles de la source
-- (« consomation », « dezone ») et les libellés qu'elle tronque elle-même
-- (« pr transfo », « pour repara »). Un déclarant reconnaît ces chaînes : ce
-- sont celles que SYDAM lui montre. Les corriger les rendrait introuvables, et
-- les accents absents ne sont pas rajoutés pour la même raison.
--
-- Le traitement fiscal, lui, ne vient pas de ce document. Il vient du § 3.6 du
-- document de référence, qui ne couvre que quatre familles : mise à la
-- consommation, admission temporaire, entrepôt, transit. Les quarante autres
-- régimes sont chargés pour référence mais marqués non liquidables. Afficher un
-- total sur un régime dont on ignore la règle serait précisément le défaut que
-- tout ce module cherche à éviter — un chiffre d'apparence officielle sur
-- lequel quelqu'un s'engage.
--
-- Le transbordement (8100) appartient à la famille 8 mais n'est pas un transit
-- national : il n'hérite pas de la règle du transit.

alter table app_e08c374bc4_regimes_douaniers
  add column if not exists sens text not null default 'import',
  add column if not exists liquidation_supportee boolean not null default false,
  add column if not exists source text not null
    default 'DGD-CI — Liste des régimes à la date du 29 juillet 2021';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'app_e08c374bc4_regimes_sens_check'
  ) then
    alter table app_e08c374bc4_regimes_douaniers
      add constraint app_e08c374bc4_regimes_sens_check
      check (sens in ('import', 'export', 'transit', 'special'));
  end if;
end $$;

-- La liste officielle : code et libellé, rien d'autre. Les huit régimes déjà
-- présents venaient d'une saisie manuelle antérieure ; leurs libellés sont
-- remplacés par ceux du référentiel.
insert into app_e08c374bc4_regimes_douaniers (code, libelle, mention, ordre)
select p.code, p.libelle, '', p.code::integer
from (values
  ('1000', 'Exportation definitive'),
  ('1022', 'Exportation definitive en suite de perfectionnement passif pr transfo'),
  ('1023', 'Exportation definitive en suite de perfectionnement passif pour repara'),
  ('1024', 'Exportation definitive en suite de perfectionnement passif autre'),
  ('1052', 'Exportation definitive en suite de perfectionnement actif'),
  ('1094', 'Exportation en régularisation de Bon Provisoire'),
  ('2200', 'Perfectionnement passif pour transformation'),
  ('2300', 'Perfectionnement passif en suite de reparation'),
  ('2400', 'Perfectionnement passif autre'),
  ('3000', 'Re-exportation directe'),
  ('3050', 'Re-exportation en suite d''admission temporaire ordinaire'),
  ('3051', 'Re-exportation en suite d''admission temporaire speciale'),
  ('3052', 'Re-exportation en suite d''AT pour perfectionnement actif'),
  ('3070', 'Re-exportation en suite d''entrepot de stockage'),
  ('3079', 'Re-exportation en suite de depot'),
  ('3080', 'Re-exportation en suite de transit national'),
  ('3092', 'Re-exportation en sortie de zone franche'),
  ('3094', 'Re-exportation en régularisation de Bon Provisoire'),
  ('4000', 'Mise a la consommation directe'),
  ('4050', 'Mise a la consommation en suite d''admission temporaire ordinaire'),
  ('4051', 'Mise a la consommation en suite d''admission temporaire speciale'),
  ('4052', 'Mise a la consommation en suite d''AT pour perfectionnement actif'),
  ('4070', 'Mise a la consommation en suite d''entrepot de stockage'),
  ('4079', 'Mise a la consomation en suite de depot'),
  ('4080', 'Mise a la consommation en suite de transit national'),
  ('4094', 'Mise à la consommation en régularisation de Bon Provisoire'),
  ('5000', 'Admission temporaire ordinaire'),
  ('5050', 'Mutation d''admission temporaire ordinaire'),
  ('5052', 'Admission Temporaire Ordinaire ensuite de perfectionnement actif'),
  ('5070', 'Admission temporaire en suite d''entrepot de stockage'),
  ('5079', 'Admission temporaire ordinaire en suite de depot'),
  ('5080', 'Admission temporaire ordinaire en suite de transit national'),
  ('5092', 'Admission temporaire en suite dezone franche'),
  ('5094', 'Admission temporaire en régularisation de Bon Provisoire'),
  ('5100', 'Admission temporaire speciale (materiels d''entreprises)'),
  ('5150', 'Admission temporaire speciale en suite d''ATO'),
  ('5170', 'Admission temporaire speciale en suite d''entrepot de stockage'),
  ('5179', 'Admission temporaire speciale en suite de depot'),
  ('5180', 'Admission temporaire speciale en suite de transit national'),
  ('5200', 'AT pour perfectionnement actif (ouvraison,reparation,transformation)'),
  ('5250', 'Mutation d''ATO en ATT'),
  ('5252', 'Mutation de perfectionnement actif (ouvraison, reparation...)'),
  ('5270', 'AT pour perfectionnement actif en suite d''entrepot de stockage'),
  ('5279', 'Perfectionnement actif en suite de depot'),
  ('5280', 'Perfectionnement actif en suite de transit national'),
  ('5294', 'AT pour perfectionnement actif en régularisation de Bon Provisoire'),
  ('6022', 'Re-importation en suite de perfectionnement passif pour transformation'),
  ('6023', 'Re-importation en suite de perfectionnement passif pour reparation'),
  ('6024', 'Re-importation en suite de perfectionnement passif autre'),
  ('7000', 'Entree en entrepot de stockage'),
  ('7050', 'Entree en entrepot de stockage en suite d''AT ordinaire'),
  ('7051', 'Entree en entrepot de stockage en suite d''AT speciale'),
  ('7052', 'Entree en entrepot de stockage en suite d''AT perfectionnement actif'),
  ('7070', 'Mutation d''entrepot de stockage'),
  ('7079', 'Entrepot de stockage en suite de depot'),
  ('7080', 'Mise en entrepot en suite de transit national'),
  ('7094', 'Entrepot de stockage En Régularisation de Bon Provisoire'),
  ('8000', 'Transit national'),
  ('8052', 'Transit national en suite de perfectionnement actif'),
  ('8070', 'Transit national en suite d''entrepot de stockage'),
  ('8079', 'Transit national en suite de depot'),
  ('8080', 'Transit national par mer vers port/aeroport CI en suite de transit'),
  ('8100', 'Transbordement'),
  ('9100', 'Cabotage'),
  ('9200', 'Entree en zone franche'),
  ('9280', 'Entrée en zone franche industriel en suite de transit national'),
  ('9292', 'Mutation de zone franche'),
  ('9294', 'Entrée en zone franche en régularisation de Bon Provisoire'),
  ('9351', 'Declaration anniversaire d''AT speciale (mat. d''entreprises)'),
  ('9900', 'Déclaration Manuelle'),
  ('9910', 'Liquidation manuelle en suite d exportation'),
  ('9922', 'Liquidation manuelle en suite de perfectionnement passif pour transfor'),
  ('9923', 'Liquidation manuelle en suite de perfectionnement passif pour reparati'),
  ('9924', 'Liquidation manuelle en suite de perfectionnement passif autre'),
  ('9930', 'Liquidation manuelle en suite de reexportation'),
  ('9950', 'Liquidation manuelle en suite d''admission temporaire ordinaire'),
  ('9951', 'Liquidation Manuelle en suite d''ATME'),
  ('9952', 'Liquidation manuelle en suite de perfectionnement actif'),
  ('9970', 'Liquidation manuelle en suite d''entrepot de stockage'),
  ('9980', 'Liquidation manuelle en suite de transit national'),
  ('9992', 'Liquidation manuelle en suite de zone franche')) as p(code, libelle)
on conflict (code) do update set
  libelle = excluded.libelle,
  ordre   = excluded.ordre,
  actif   = true;

-- La règle fiscale, écrite une seule fois plutôt que recopiée quatre-vingts.
-- C'est ici, et nulle part ailleurs, qu'on saura demain pourquoi un régime
-- liquide ou non.
update app_e08c374bc4_regimes_douaniers r
set sens                  = g.sens,
    categorie             = g.categorie,
    liquidation_supportee = g.supportee,
    droits_exigibles      = g.droits,
    rpi_exigible          = g.rpi,
    ts_exigible           = g.ts,
    caution_requise       = g.caution,
    depend_autorisation   = g.autorisation,
    mention               = g.mention,
    source                = 'DGD-CI — Liste des régimes à la date du 29 juillet 2021'
from (
  select
    code,
    case
      when left(code, 1) in ('1', '2', '3') then 'export'
      when left(code, 1) = '8'              then 'transit'
      when left(code, 1) = '9'              then 'special'
      else 'import'
    end as sens,
    case left(code, 1)
      when '1' then 'exportation'
      when '2' then 'perfectionnement_passif'
      when '3' then 'reexportation'
      when '4' then 'mise_consommation'
      when '5' then 'admission_temporaire'
      when '6' then 'reimportation'
      when '7' then 'entrepot'
      when '8' then 'transit'
      else 'special'
    end as categorie,
    left(code, 1) in ('4', '5', '7') or code in ('8000','8052','8070','8079','8080') as supportee,
    left(code, 1) = '4' as droits,
    left(code, 1) in ('4', '5', '7') as rpi,
    left(code, 1) in ('4', '5', '7') as ts,
    code in ('8000','8052','8070','8079','8080') as caution,
    left(code, 1) = '5' as autorisation,
    case
      when left(code, 1) = '4' then
        'Régime de droit commun : droits et taxes exigibles en totalité, redevance informatique et timbre statistique dus.'
      when left(code, 1) = '5' then
        'Admission temporaire : droits et taxes suspendus, en totalité ou en partie selon l''autorisation détenue. Redevance informatique et timbre restent dus, et les montants affichés sont indicatifs.'
      when left(code, 1) = '7' then
        'Entrepôt sous douane : droits et taxes suspendus jusqu''à la mise à la consommation. Redevance informatique et timbre statistique restent dus.'
      when code in ('8000','8052','8070','8079','8080') then
        'Transit : aucun droit ni taxe acquitté à ce stade. Une caution ou un acquit-à-caution est exigé à la place.'
      when left(code, 1) in ('1', '2', '3') then
        'Régime d''exportation : Le Déclarant calcule les droits et taxes à l''importation, qui ne s''appliquent pas ici. Aucune liquidation n''est proposée.'
      else
        'Traitement fiscal non confirmé pour ce régime. Aucune liquidation n''est proposée tant que la règle n''a pas été validée par un déclarant agréé.'
    end as mention
  from app_e08c374bc4_regimes_douaniers
) g
where g.code = r.code;

-- ---------------------------------------------------------------------------
-- Liquidation : un noyau, un garde-fou
-- ---------------------------------------------------------------------------
-- L'arithmétique déménage sous `_noyau`, en un seul exemplaire. La fonction
-- publique ne fait plus que deux choses avant de l'appeler : reconnaître le
-- régime, et refuser ceux dont le traitement fiscal n'est pas confirmé.
--
-- Cette séparation n'est pas cosmétique. Le corps du calcul avait déjà été
-- recopié d'une migration à l'autre, et les deux copies avaient divergé sans
-- que rien ne le signale. Il n'y en a maintenant qu'une.

create or replace function app_e08c374bc4_liquider_declaration_noyau(
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
as $noyau$
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

    v_saisi := (v_ligne->>'taux_dd')::numeric;

    -- Le corpus porte les taux en pourcentage, l'appelant les donne en
    -- fraction. Confondre les deux multiplie les droits par cent sans que
    -- rien ne le signale : on refuse plutôt que de deviner.
    if v_saisi is not null and v_saisi > 1 then
      raise exception
        'Ligne « % » : le taux de droit se donne en fraction (0.20 pour 20 %%), pas en pourcentage.',
        coalesce(v_ligne->>'designation', '?') using errcode = '22023';
    end if;

    v_code := regexp_replace(coalesce(v_ligne->>'position', ''), '[^0-9]', '', 'g');
    if length(v_code) = 10 then
      v_code := substr(v_code, 1, 4) || '.' || substr(v_code, 5, 2) || '.' ||
                substr(v_code, 7, 2) || '.' || substr(v_code, 9, 2);
    end if;
    select * into v_tec from app_e08c374bc4_tec_dd_reference where code_hs = v_code;

    -- Le taux saisi l'emporte : un déclarant qui corrige sait ce qu'il fait.
    v_taux_dd := coalesce(v_saisi, v_tec.taux_dd / 100.0);

    -- Le taux n'est exigé que là où il sert. Sous un régime qui n'appelle
    -- aucun droit — une exportation, un transit — réclamer une position au
    -- corpus TEC bloquerait une liquidation dont le résultat ne dépend pas
    -- d'elle. La règle du « jamais de taux inventé » est intacte : ce zéro
    -- n'est pas une estimation du droit, c'est l'absence de droit.
    if v_taux_dd is null then
      if v_regime.droits_exigibles then
        raise exception
          'Ligne « % » : droit de douane inconnu. Le code % n''est pas dans la base TEC — vérification manuelle nécessaire, ou saisissez le taux.',
          coalesce(v_ligne->>'designation', '?'), coalesce(nullif(v_code, ''), '(vide)')
          using errcode = '22023';
      end if;
      v_taux_dd := 0;
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
$noyau$;

-- Le noyau n'est appelable que par le garde-fou, qui est SECURITY DEFINER :
-- personne ne peut court-circuiter le contrôle de régime en l'appelant
-- directement.
revoke execute on function app_e08c374bc4_liquider_declaration_noyau(jsonb, numeric, numeric, numeric, text) from public;

-- Un régime non liquidable n'est pas une erreur de saisie : il figure au
-- référentiel, on le montre, mais on refuse d'en tirer un total.
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
as $garde$
declare
  v_regime app_e08c374bc4_regimes_douaniers;
begin
  select * into v_regime from app_e08c374bc4_regimes_douaniers
  where code = coalesce(p_regime, '4000');

  if v_regime.code is null then
    raise exception 'Régime douanier inconnu : %.', p_regime using errcode = '22023';
  end if;

  if not v_regime.liquidation_supportee then
    raise exception '%', v_regime.mention using errcode = '22023';
  end if;

  return app_e08c374bc4_liquider_declaration_noyau(
    p_lignes, p_fret_total, p_assurance_total, p_poids_brut_total, p_regime);
end;
$garde$;

revoke execute on function app_e08c374bc4_liquider_declaration(jsonb, numeric, numeric, numeric, text) from public;
grant execute on function app_e08c374bc4_liquider_declaration(jsonb, numeric, numeric, numeric, text) to anon, authenticated;
