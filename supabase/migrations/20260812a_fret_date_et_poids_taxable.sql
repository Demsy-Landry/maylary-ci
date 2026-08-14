-- Le fret n'est pas un prix, c'est une cotation datée.
--
-- Le fondateur, qui est du métier, l'a dit en une phrase : « il y a des tarifs
-- qui ne sont pas fixes, on ne peut pas avoir de montant de fret fixe, le fret
-- change en fonction des périodes ». C'est exact, et l'application le traitait
-- comme une constante — ce qui produit tôt ou tard un devis vendu sur un taux
-- périmé, donc une marge mangée.
--
-- Deux corrections structurelles.
--
-- **Tout taux porte une fin de validité.** Sans `valide_au`, un taux n'entre
-- pas dans un prix ferme. Passé la date, le moteur ne devine pas : il dit que
-- le taux a expiré et qu'il faut redemander à la compagnie.
--
-- **Le poids taxable se calcule, il ne se suppose pas.** C'est la méthode
-- internationale et la spécialité de la maison : aérien au diviseur IATA de
-- 6 000, express à 5 000, groupage maritime au rapport une tonne pour un mètre
-- cube. Un client qui ignore cette règle croit payer 12 kg et paie 40 kg.

-- L'express manquait à la liste des modes : c'est pourtant l'un des trois
-- métiers prioritaires de la maison.
alter table app_e08c374bc4_equivalences_fret
  drop constraint if exists app_e08c374bc4_equivalences_fret_mode_check;
alter table app_e08c374bc4_equivalences_fret
  add constraint app_e08c374bc4_equivalences_fret_mode_check
  check (mode in ('maritime', 'aerien', 'express', 'routier'));

insert into app_e08c374bc4_equivalences_fret (mode, kg_par_m3, libelle, source)
values ('express', 200.000, 'Express — 1 m³ pour 200 kg',
        'Diviseur volumétrique de 5 000 cm³/kg, usage des intégrateurs express.')
on conflict (mode) do nothing;

create table if not exists app_e08c374bc4_taux_fret (
  id             uuid primary key default gen_random_uuid(),
  mode           text not null check (mode in ('aerien', 'express', 'maritime', 'routier')),
  origine        text not null,
  destination    text not null default 'Abidjan',
  compagnie      text,
  -- 'kg' pour l'aérien et l'express, 'up' (unité payante) pour le groupage
  -- maritime, 'conteneur' pour le complet.
  unite          text not null check (unite in ('kg', 'up', 'conteneur', 'm3')),
  -- Le fret aérien se tarife par paliers de poids : franchir un palier coûte
  -- parfois moins cher que rester juste en dessous.
  tranche_min_kg numeric,
  tranche_max_kg numeric,
  montant        numeric not null check (montant >= 0),
  devise         text not null default 'EUR',
  minimum        numeric,
  valide_du      date not null default current_date,
  valide_au      date not null,
  nature         text not null default 'indicatif'
                 check (nature in ('officiel', 'contractuel', 'indicatif')),
  source         text,
  note           text,
  cree_le        timestamptz not null default now()
);

create index if not exists app_e08c374bc4_taux_fret_recherche_idx
  on app_e08c374bc4_taux_fret (mode, origine, valide_au desc);

comment on column app_e08c374bc4_taux_fret.valide_au is
  'Sans date de fin, pas de taux. Passé cette date le moteur refuse de chiffrer et renvoie vers une cotation compagnie.';
comment on column app_e08c374bc4_taux_fret.nature is
  'officiel : barème publié. contractuel : notre accord avec le groupeur ou la compagnie. indicatif : relevé de marché, jamais dans un prix ferme.';

alter table app_e08c374bc4_taux_fret enable row level security;
drop policy if exists "Taux de fret lisibles" on app_e08c374bc4_taux_fret;
create policy "Taux de fret lisibles" on app_e08c374bc4_taux_fret for select using (true);
drop policy if exists "Taux de fret admin" on app_e08c374bc4_taux_fret;
create policy "Taux de fret admin" on app_e08c374bc4_taux_fret for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

/**
 * Le poids taxable, selon la méthode internationale.
 *
 * On ne paie pas ce que pèse une marchandise : on paie le plus grand de son
 * poids réel et de son poids volumétrique. Un carton de coussins pèse 8 kg et
 * se facture 40 — c'est la découverte la plus fréquente, et la plus mal vécue,
 * de quelqu'un qui importe pour la première fois.
 *
 * Les diviseurs viennent de la table des équivalences, pas du code : ils
 * varient selon les compagnies et doivent pouvoir être corrigés sans
 * redéploiement.
 */
create or replace function app_e08c374bc4_poids_taxable(
  p_mode          text,
  p_poids_reel_kg numeric,
  p_longueur_cm   numeric default null,
  p_largeur_cm    numeric default null,
  p_hauteur_cm    numeric default null,
  p_colis         integer default 1,
  p_volume_m3     numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_kg_par_m3 numeric;
  v_libelle   text;
  v_source    text;
  v_volume    numeric;
  v_volumique numeric;
  v_taxable   numeric;
  v_diviseur  numeric;
begin
  select kg_par_m3, libelle, source into v_kg_par_m3, v_libelle, v_source
  from app_e08c374bc4_equivalences_fret where mode = p_mode;

  if v_kg_par_m3 is null then
    return jsonb_build_object('calculable', false,
      'motif', format('Mode « %s » inconnu : aucune équivalence enregistrée.', p_mode));
  end if;

  if p_volume_m3 is not null then
    v_volume := p_volume_m3;
  elsif p_longueur_cm is not null and p_largeur_cm is not null and p_hauteur_cm is not null then
    v_volume := (p_longueur_cm * p_largeur_cm * p_hauteur_cm * greatest(coalesce(p_colis, 1), 1))
                / 1000000.0;
  else
    return jsonb_build_object('calculable', false,
      'motif', 'Il faut soit les trois dimensions, soit le volume en mètres cubes.');
  end if;

  v_volumique := round(v_volume * v_kg_par_m3, 2);
  v_taxable   := greatest(coalesce(p_poids_reel_kg, 0), v_volumique);
  v_diviseur  := round(1000000.0 / v_kg_par_m3);

  return jsonb_build_object(
    'calculable', true,
    'mode', p_mode,
    'libelle_mode', v_libelle,
    'volume_m3', round(v_volume, 4),
    'poids_reel_kg', coalesce(p_poids_reel_kg, 0),
    'poids_volumique_kg', v_volumique,
    'poids_taxable_kg', v_taxable,
    'retenu', case when v_volumique > coalesce(p_poids_reel_kg, 0) then 'volumique' else 'reel' end,
    'diviseur_cm3_par_kg', v_diviseur,
    'kg_par_m3', v_kg_par_m3,
    'source', v_source,
    'explication', case
      when v_volumique > coalesce(p_poids_reel_kg, 0) then format(
        'Envoi volumineux pour son poids : il occupe %s m³, soit %s kg au diviseur de %s cm³/kg. C''est ce chiffre qui sera facturé, et non les %s kg de la balance.',
        round(v_volume, 3), v_volumique, v_diviseur, coalesce(p_poids_reel_kg, 0))
      else format(
        'Envoi dense : ses %s m³ n''équivalent qu''à %s kg volumétriques, en dessous du poids réel. C''est donc le poids de la balance, %s kg, qui sera facturé.',
        round(v_volume, 3), v_volumique, coalesce(p_poids_reel_kg, 0))
    end);
end;
$$;

/**
 * Le taux applicable aujourd'hui, ou le refus de chiffrer.
 *
 * S'il n'y a pas de taux valide, la fonction ne propose rien : elle dit depuis
 * combien de jours le dernier a expiré et renvoie vers la compagnie.
 */
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
  order by (t.nature = 'contractuel') desc, t.valide_au desc
  limit 1;

  if v_taux.id is not null then
    return jsonb_build_object(
      'disponible', true,
      'utilisable_en_prix_ferme', v_taux.nature <> 'indicatif',
      'montant', v_taux.montant, 'devise', v_taux.devise, 'unite', v_taux.unite,
      'minimum', v_taux.minimum, 'compagnie', v_taux.compagnie,
      'nature', v_taux.nature, 'source', v_taux.source,
      'valide_au', v_taux.valide_au,
      'jours_restants', v_taux.valide_au - current_date,
      'message', case
        when v_taux.nature = 'indicatif' then
          'Taux indicatif : il situe un ordre de grandeur mais ne peut pas entrer dans un prix ferme. À faire confirmer par la compagnie.'
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
    'expire_depuis_jours', case when v_perime.id is not null
                                then current_date - v_perime.valide_au else null end,
    'message', case
      when v_perime.id is not null then format(
        'Le dernier taux relevé pour cette liaison a expiré il y a %s jour(s). Le fret varie selon les périodes : demandez une cotation à la compagnie avant de vous engager.',
        current_date - v_perime.valide_au)
      else
        'Aucun taux enregistré pour cette liaison. Le fret varie selon les périodes : il se demande à la compagnie avant chaque envoi.'
    end);
end;
$$;

revoke all on function app_e08c374bc4_poids_taxable(text, numeric, numeric, numeric, numeric, integer, numeric)
  from public, anon, authenticated;
grant execute on function app_e08c374bc4_poids_taxable(text, numeric, numeric, numeric, numeric, integer, numeric)
  to anon, authenticated, service_role;
revoke all on function app_e08c374bc4_taux_fret_applicable(text, text, numeric)
  from public, anon, authenticated;
grant execute on function app_e08c374bc4_taux_fret_applicable(text, text, numeric)
  to anon, authenticated, service_role;
