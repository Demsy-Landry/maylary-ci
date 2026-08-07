-- Le Déclarant — le barème réel, et la liquidation d'une déclaration entière.
--
-- Corrige et remplace la structure posée quelques heures plus tôt à partir de
-- sources publiques. Le fondateur, transitaire chez E-Transit, a fourni le
-- barème vérifié sur une déclaration SYDAM réelle. Trois valeurs étaient
-- fausses, dont une gravement :
--
--   * PCS valait 1 %, il vaut 0,8 % ;
--   * le PUA (prélèvement Union africaine, 0,2 %) manquait entièrement ;
--   * et surtout : **la TVA ne s'assied que sur CAF + DD + RST.** Je l'assoyais
--     sur tous les droits, PCS/PUA/PCC compris. Sur une valeur en douane d'un
--     million, l'erreur dépasse trois mille francs — assez pour discréditer
--     l'outil devant le premier déclarant qui le vérifie.
--
-- Manquaient aussi la RPI (0,75 % du FOB, plancher 100 000) et la TS (20 000
-- forfaitaires par déclaration).
--
-- ---------------------------------------------------------------------------
-- Ce que la structure doit désormais savoir dire
-- ---------------------------------------------------------------------------
-- Deux distinctions que le premier modèle ne portait pas, et sans lesquelles
-- le calcul est faux dès qu'une déclaration compte plus d'un article :
--
--   1. **Le niveau.** Certaines taxes se calculent article par article (DD,
--      RST, PCS, PUA, PCC, TVA), d'autres une seule fois pour la déclaration
--      entière (RPI, TS). Additionner une TS par ligne multiplierait par cinq
--      un forfait qui ne se paie qu'une fois.
--   2. **L'entrée dans l'assiette de la TVA.** Elle ne se déduit pas de
--      l'assiette d'une taxe : le PCS s'assied sur la valeur en douane comme
--      le DD, mais n'entre pas dans la base de la TVA. C'est une propriété
--      distincte, donc une colonne distincte.

alter table app_e08c374bc4_taxes_douanieres
  add column if not exists niveau text not null default 'ligne',
  add column if not exists entre_base_tva boolean not null default false,
  add column if not exists montant_fixe_fcfa numeric,
  add column if not exists minimum_fcfa numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'app_e08c374bc4_taxe_niveau_check') then
    alter table app_e08c374bc4_taxes_douanieres
      add constraint app_e08c374bc4_taxe_niveau_check
      check (niveau in ('ligne', 'declaration'));
  end if;
end $$;

-- Vider avant de resserrer la contrainte : les anciennes lignes portent une
-- assiette (« caf_et_droits ») que le nouveau modèle ne connaît plus, et une
-- contrainte se pose sur des données conformes.
delete from app_e08c374bc4_taxes_douanieres;

alter table app_e08c374bc4_taxes_douanieres drop constraint if exists app_e08c374bc4_taxes_douanieres_assiette_check;
alter table app_e08c374bc4_taxes_douanieres
  add constraint app_e08c374bc4_taxes_douanieres_assiette_check
  check (assiette in ('caf', 'base_tva', 'fob', 'forfait'));

-- Le barème vérifié. `confirme = true` parce qu'il vient d'une déclaration
-- réelle relue par un déclarant agréé — c'est exactement la condition que le
-- premier modèle attendait.

insert into app_e08c374bc4_taxes_douanieres
  (code, libelle, niveau, assiette, taux, montant_fixe_fcfa, minimum_fcfa,
   entre_base_tva, ordre, confirme, source, note) values
  ('DD',  'Droit de douane',                                'ligne',       'caf',      null,    null,  null,   true,  10, true,
   'TEC CEDEAO', 'Taux porté par la position tarifaire : C0 0 %, C1 5 %, C2 10 %, C3 20 %, C4 35 %.'),
  ('RST', 'Redevance statistique',                          'ligne',       'caf',      0.01,    null,  null,   true,  20, true,
   'Déclaration SYDAM réelle', null),
  ('PCS', 'Prélèvement communautaire de solidarité (UEMOA)', 'ligne',      'caf',      0.008,   null,  null,   false, 30, true,
   'Déclaration SYDAM réelle', 'N''entre pas dans l''assiette de la TVA.'),
  ('PUA', 'Prélèvement Union africaine',                    'ligne',       'caf',      0.002,   null,  null,   false, 40, true,
   'Déclaration SYDAM réelle', 'N''entre pas dans l''assiette de la TVA.'),
  ('PCC', 'Prélèvement communautaire (CEDEAO)',             'ligne',       'caf',      0.005,   null,  null,   false, 50, true,
   'Déclaration SYDAM réelle', 'N''entre pas dans l''assiette de la TVA.'),
  ('TVA', 'Taxe sur la valeur ajoutée',                     'ligne',       'base_tva', 0.18,    null,  null,   false, 60, true,
   'Déclaration SYDAM réelle', 'Assise sur CAF + DD + RST uniquement.'),
  ('RPI', 'Redevance prestations informatiques',            'declaration', 'fob',      0.0075,  null,  100000, false, 70, true,
   'Déclaration SYDAM réelle', 'Plancher de 100 000 FCFA par déclaration. Due même sous régime d''entrepôt.'),
  ('TS',  'Taxe spécifique',                                'declaration', 'forfait',  null,    20000, null,   false, 80, true,
   'Déclaration SYDAM réelle', 'Forfait par déclaration, jamais par ligne ni par quantité.');

update app_e08c374bc4_parametres_tarif
set libelle_tarif = 'TEC CEDEAO — Côte d''Ivoire',
    note = 'Barème vérifié sur une déclaration SYDAM réelle par un déclarant agréé.',
    updated_at = now();

-- ---------------------------------------------------------------------------
-- Les régimes douaniers
-- ---------------------------------------------------------------------------
-- Le régime ne change pas les formules, il change ce qui est exigible. Le dire
-- en table plutôt qu'en cascade de `if` : un régime s'ajoute sans redéploiement,
-- et l'écran peut afficher la mention exacte au client.
create table if not exists app_e08c374bc4_regimes_douaniers (
  code        text primary key,
  libelle     text not null,
  -- Rien n'est exigible en transit ; sous entrepôt seule la RPI l'est.
  droits_exigibles boolean not null default true,
  rpi_exigible     boolean not null default true,
  mention     text not null,
  ordre       integer not null default 0,
  actif       boolean not null default true
);

alter table app_e08c374bc4_regimes_douaniers enable row level security;

drop policy if exists regimes_douaniers_lecture on app_e08c374bc4_regimes_douaniers;
create policy regimes_douaniers_lecture on app_e08c374bc4_regimes_douaniers
  for select to anon, authenticated using (actif);

drop policy if exists regimes_douaniers_ecriture on app_e08c374bc4_regimes_douaniers;
create policy regimes_douaniers_ecriture on app_e08c374bc4_regimes_douaniers
  for all to authenticated
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

insert into app_e08c374bc4_regimes_douaniers (code, libelle, droits_exigibles, rpi_exigible, mention, ordre) values
  ('IM4',      'Mise à la consommation',  true,  true,
   'Droits et taxes exigibles au comptant.', 10),
  ('T1',       'Transit (T1)',            false, false,
   'Aucun droit payé au moment du transit : une caution ou un acquit-à-caution est exigé à la place.', 20),
  ('T2',       'Transit (T2)',            false, false,
   'Aucun droit payé au moment du transit : une caution ou un acquit-à-caution est exigé à la place.', 30),
  ('ENTREPOT', 'Entrepôt sous douane',    false, true,
   'Droits suspendus jusqu''à la sortie de l''entrepôt, où le calcul redevient celui de la mise à la consommation. La redevance informatique reste due.', 40),
  ('AT',       'Admission temporaire',    false, false,
   'Exonération totale ou partielle selon l''accord. Engagement de réexportation requis.', 50)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- La liquidation d'une déclaration entière
-- ---------------------------------------------------------------------------
-- Le calcul par ligne isolée ne suffit pas : le fret et l'assurance globaux se
-- répartissent entre les articles avant tout calcul de taxe, et deux taxes ne
-- se comptent qu'une fois pour l'ensemble. La fonction prend donc la
-- déclaration entière et rend le détail ligne par ligne plus les totaux.
--
-- Les formules de répartition viennent du fondateur et ne se modifient pas :
--   fret ligne      = (fret total / poids brut total) × poids brut ligne
--   assurance ligne = (assurance totale / FOB total)  × FOB ligne
--   poids statistique ligne = (poids brut total / FOB total) × FOB ligne
--
-- Noter que le fret se répartit au poids et l'assurance à la valeur : c'est
-- cohérent avec ce que chacun couvre, et les inverser fausserait toutes les
-- lignes d'une déclaration hétérogène.
create or replace function app_e08c374bc4_liquider_declaration(
  p_lignes           jsonb,
  p_fret_total       numeric default 0,
  p_assurance_total  numeric default 0,
  p_poids_brut_total numeric default null,
  p_regime           text    default 'IM4'
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

  select * into v_regime from app_e08c374bc4_regimes_douaniers where code = coalesce(p_regime, 'IM4');
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
      v_ts := case when v_regime.droits_exigibles then coalesce(v_taxe.montant_fixe_fcfa, 0) else 0 end;
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
      'droits_exigibles', v_regime.droits_exigibles),
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
drop function if exists app_e08c374bc4_liquider(numeric, numeric, numeric, text, numeric);
