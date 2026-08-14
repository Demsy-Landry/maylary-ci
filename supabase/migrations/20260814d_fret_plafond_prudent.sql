-- ---------------------------------------------------------------------------
-- Le plafond prudent : coter un fret qu'on ne connaît pas encore, sans mentir.
--
-- Directive du fondateur, et elle règle un problème que le moteur n'avait pas
-- résolu : « le fret est demandé à la compagnie, je ne peux pas avoir un tarif
-- réel, c'est en fonction de la marchandise, du poids, des mesures, et du
-- marché. On ne peut que se baser sur les normes internationales, dans
-- l'extrême vigilance, en mettant l'estimation au-dessus de la moyenne pour
-- garantir la réalité sur des bases de valeur instable, en le signifiant à la
-- cotation au client. »
--
-- Jusqu'ici la table ne connaissait que trois natures de taux :
--
--   officiel     barème publié            → prix ferme possible
--   contractuel  notre accord compagnie   → prix ferme possible
--   indicatif    relevé de marché         → INTERDIT dans un prix ferme
--
-- Le fret groupage, sourcing et import tombait donc dans « indicatif », et le
-- moteur refusait de chiffrer. Refuser est honnête, mais ce n'est pas ce qu'un
-- transitaire fait dans la vie : il annonce un chiffre haut, et il le dit.
--
-- D'où une quatrième nature. Un plafond n'est PAS un prix ferme — c'est un
-- engagement asymétrique : la facture pourra être inférieure ou égale, jamais
-- supérieure. Cet engagement n'a de valeur que s'il est dit au client, mot pour
-- mot, à chaque cotation. La phrase est donc portée par la base et non par une
-- consigne rédactionnelle : une consigne s'oublie, une colonne non nulle ne
-- s'oublie pas.
-- ---------------------------------------------------------------------------

alter table app_e08c374bc4_taux_fret
  drop constraint if exists app_e08c374bc4_taux_fret_nature_check;

alter table app_e08c374bc4_taux_fret
  add constraint app_e08c374bc4_taux_fret_nature_check
  check (nature in ('officiel', 'contractuel', 'indicatif', 'plafond'));

comment on column app_e08c374bc4_taux_fret.nature is
  'officiel : barème publié. contractuel : notre accord avec le groupeur ou la '
  'compagnie. indicatif : relevé de marché, jamais dans un prix ferme. '
  'plafond : estimation volontairement placée au-dessus de la moyenne, cotable '
  'au client sous réserve expresse — la facture peut être inférieure ou égale, '
  'jamais supérieure.';

-- La phrase de réserve, en dur et une seule fois.
--
-- On ne la range pas dans une table de réglages : c'est un engagement
-- commercial, pas un paramètre. La mettre au bout d'une fonction garantit
-- qu'aucun écran ne peut coter un plafond sans elle.
create or replace function app_e08c374bc4_reserve_plafond_fret()
returns text
language sql
immutable
as $$
  select 'Sous réserve de la confirmation par la compagnie : elle peut diminuer '
      || 'ou être ce montant, mais jamais plus.'
$$;

comment on function app_e08c374bc4_reserve_plafond_fret is
  'La formule que le fondateur impose à toute cotation de fret non confirmée. '
  'Un plafond sans cette phrase est une promesse de prix ferme que la maison '
  'ne peut pas tenir.';

-- ---------------------------------------------------------------------------
-- La fonction de recherche apprend la quatrième nature.
--
-- Deux drapeaux séparés plutôt qu'un seul, parce que ce sont deux questions
-- distinctes :
--
--   utilisable_en_prix_ferme  puis-je graver ce montant dans une facture ?
--   cotable_sous_reserve      puis-je l'annoncer au client, avec la phrase ?
--
-- Un taux indicatif répond non aux deux. Un plafond répond non à la première
-- et oui à la seconde. C'est exactement la nuance que le fondateur demande, et
-- la confondre reviendrait soit à ne jamais rien coter, soit à s'engager sur
-- un chiffre qu'on ne maîtrise pas.
-- ---------------------------------------------------------------------------
create or replace function app_e08c374bc4_taux_fret_applicable(
  p_mode      text,
  p_origine   text,
  p_poids_kg  numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_taux   app_e08c374bc4_taux_fret;
  v_perime app_e08c374bc4_taux_fret;
begin
  select * into v_taux from app_e08c374bc4_taux_fret t
  where t.mode = p_mode
    and app_e08c374bc4_sans_accent(t.origine) = app_e08c374bc4_sans_accent(p_origine)
    and current_date between t.valide_du and t.valide_au
    and (p_poids_kg is null
         or ((t.tranche_min_kg is null or p_poids_kg >= t.tranche_min_kg)
         and (t.tranche_max_kg is null or p_poids_kg < t.tranche_max_kg)))
  -- Un accord contractuel prime sur tout. À défaut, on préfère un plafond
  -- assumé à un simple relevé de marché : le premier engage la maison, le
  -- second n'engage personne.
  order by (t.nature = 'contractuel') desc,
           (t.nature = 'officiel') desc,
           (t.nature = 'plafond') desc,
           t.valide_au desc
  limit 1;

  if v_taux.id is not null then
    return jsonb_build_object(
      'disponible', true,
      'utilisable_en_prix_ferme', v_taux.nature in ('officiel', 'contractuel'),
      'cotable_sous_reserve', v_taux.nature <> 'indicatif',
      'reserve', case when v_taux.nature = 'plafond'
                      then app_e08c374bc4_reserve_plafond_fret() end,
      'montant', v_taux.montant, 'devise', v_taux.devise, 'unite', v_taux.unite,
      'minimum', v_taux.minimum, 'compagnie', v_taux.compagnie,
      'nature', v_taux.nature, 'source', v_taux.source,
      'valide_au', v_taux.valide_au,
      'jours_restants', v_taux.valide_au - current_date,
      'message', case
        when v_taux.nature = 'indicatif' then
          'Taux indicatif : il situe un ordre de grandeur mais ne peut pas entrer dans un prix ferme. À faire confirmer par la compagnie.'
        when v_taux.nature = 'plafond' then
          'Plafond prudent, placé au-dessus de la moyenne du marché. Il se cote '
          || 'au client avec la réserve, et il ne peut jamais être dépassé à la facture. '
          || app_e08c374bc4_reserve_plafond_fret()
        else format('Taux %s, valide encore %s jour(s).', v_taux.nature, v_taux.valide_au - current_date)
      end);
  end if;

  select * into v_perime from app_e08c374bc4_taux_fret t
  where t.mode = p_mode
    and app_e08c374bc4_sans_accent(t.origine) = app_e08c374bc4_sans_accent(p_origine)
  order by t.valide_au desc limit 1;

  return jsonb_build_object(
    'disponible', false,
    'utilisable_en_prix_ferme', false,
    'cotable_sous_reserve', false,
    'expire_depuis_jours', case when v_perime.id is not null
                                then current_date - v_perime.valide_au else null end,
    'message', case
      when v_perime.id is not null then format(
        'Le dernier taux relevé pour cette liaison a expiré il y a %s jour(s). Le fret varie selon les périodes : demandez une cotation à la compagnie avant de vous engager.',
        current_date - v_perime.valide_au)
      else
        'Aucun taux de fret en base pour cette liaison. Le montant ne peut pas être annoncé : il doit être demandé à la compagnie.'
    end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Ce qui manque encore, et qui n'est pas à moi de décider.
--
-- La table reste VIDE. Le mécanisme sait désormais porter un plafond ; il ne
-- sait pas quel plafond. Ces chiffres relèvent du métier du fondateur —
-- combien il faut poser par kilo au départ de Chine en aérien, par unité
-- payante en groupage maritime, pour être certain de ne jamais être dépassé.
-- Les inventer serait exactement la faute que ce fichier existe pour empêcher.
-- ---------------------------------------------------------------------------
