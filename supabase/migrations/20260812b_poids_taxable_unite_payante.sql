-- En groupage maritime, on ne facture pas des kilos : on facture l'unité
-- payante, c'est-à-dire le plus grand du mètre cube et de la tonne. Annoncer
-- « 8 400 kg taxables » à un client qui recevra une facture en UP l'oblige à
-- refaire la conversion — et c'est le genre de détail sur lequel un
-- professionnel juge un outil.
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
  v_au_poids  boolean;
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
  -- Aérien, express et routier se facturent au kilo ; le groupage maritime à
  -- l'unité payante.
  v_au_poids  := p_mode <> 'maritime';

  return jsonb_build_object(
    'calculable', true,
    'mode', p_mode,
    'libelle_mode', v_libelle,
    'volume_m3', round(v_volume, 4),
    'poids_reel_kg', coalesce(p_poids_reel_kg, 0),
    'poids_volumique_kg', v_volumique,
    'poids_taxable_kg', v_taxable,
    'facture_au_poids', v_au_poids,
    'unite_facturation', case when v_au_poids then 'kg' else 'unité payante' end,
    -- L'unité payante : le plus grand du volume en m³ et du poids en tonnes.
    'unites_payantes', case when v_au_poids then null
                            else round(greatest(v_volume, coalesce(p_poids_reel_kg, 0) / 1000.0), 3) end,
    'retenu', case when v_volumique > coalesce(p_poids_reel_kg, 0) then 'volumique' else 'reel' end,
    'diviseur_cm3_par_kg', case when v_au_poids then v_diviseur else null end,
    'kg_par_m3', v_kg_par_m3,
    'source', v_source,
    'explication', case
      when not v_au_poids then format(
        'Groupage maritime : la facturation se fait à l''unité payante, le plus grand du volume et du tonnage. Votre envoi occupe %s m³ et pèse %s tonne(s) : %s unité(s) payante(s) seront facturées.',
        round(v_volume, 3), round(coalesce(p_poids_reel_kg, 0) / 1000.0, 3),
        round(greatest(v_volume, coalesce(p_poids_reel_kg, 0) / 1000.0), 3))
      when v_volumique > coalesce(p_poids_reel_kg, 0) then format(
        'Envoi volumineux pour son poids : il occupe %s m³, soit %s kg au diviseur de %s cm³/kg. C''est ce chiffre qui sera facturé, et non les %s kg de la balance.',
        round(v_volume, 3), v_volumique, v_diviseur, coalesce(p_poids_reel_kg, 0))
      else format(
        'Envoi dense : ses %s m³ n''équivalent qu''à %s kg volumétriques, en dessous du poids réel. C''est donc le poids de la balance, %s kg, qui sera facturé.',
        round(v_volume, 3), v_volumique, coalesce(p_poids_reel_kg, 0))
    end);
end;
$$;

revoke all on function app_e08c374bc4_poids_taxable(text, numeric, numeric, numeric, numeric, integer, numeric)
  from public, anon, authenticated;
grant execute on function app_e08c374bc4_poids_taxable(text, numeric, numeric, numeric, numeric, integer, numeric)
  to anon, authenticated, service_role;
