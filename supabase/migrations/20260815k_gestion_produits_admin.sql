-- ---------------------------------------------------------------------------
-- Reprendre la main sur le catalogue.
--
-- Le fondateur : « je ne peux pas supprimer un article ». Ce n'était pas un
-- bouton manquant — il n'existait aucun écran de gestion des produits. Ni
-- suppression, ni correction d'un libellé, ni désactivation.
--
-- Mesuré avant d'écrire : 55 noms sur 94 étaient en anglais tels que CJ les
-- rend, et 94 sur 94 n'avaient AUCUNE description.
--
-- Trois fonctions plutôt qu'un accès direct à la table, pour trois règles qui
-- sont des règles de la maison et pas du confort d'écran :
--   * on ne descend pas un prix sous son prix d'achat ;
--   * on ne supprime pas un article déjà commandé ;
--   * le prix d'achat et le fret mesuré ne se modifient pas — ce sont des
--     faits relevés chez le fournisseur, pas des réglages.
-- ---------------------------------------------------------------------------

create or replace function app_e08c374bc4_corriger_produit(
  p_id uuid,
  p_nom text default null,
  p_description text default null,
  p_prix_unitaire_fcfa numeric default null,
  p_actif boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_p app_e08c374bc4_produits;
begin
  if not app_e08c374bc4_is_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;

  select * into v_p from app_e08c374bc4_produits where id = p_id;
  if v_p.id is null then
    raise exception 'Article introuvable.' using errcode = 'P0002';
  end if;

  if p_prix_unitaire_fcfa is not null then
    if p_prix_unitaire_fcfa <= 0 then
      raise exception 'Le prix doit être supérieur à zéro.' using errcode = '22023';
    end if;
    -- Vendre à perte ne doit pas pouvoir arriver par une faute de frappe.
    if coalesce(v_p.prix_achat_fcfa, 0) > 0 and p_prix_unitaire_fcfa < v_p.prix_achat_fcfa then
      raise exception 'Ce prix (%) est inférieur au prix d''achat (%). Vendre à perte ne se fait pas par accident.',
        round(p_prix_unitaire_fcfa), round(v_p.prix_achat_fcfa) using errcode = '22023';
    end if;
  end if;

  update app_e08c374bc4_produits set
    nom                = coalesce(nullif(btrim(coalesce(p_nom, '')), ''), nom),
    description        = coalesce(p_description, description),
    prix_unitaire_fcfa = coalesce(p_prix_unitaire_fcfa, prix_unitaire_fcfa),
    actif              = coalesce(p_actif, actif),
    updated_at         = now()
  where id = p_id
  returning * into v_p;

  return to_jsonb(v_p);
end; $$;
revoke all on function app_e08c374bc4_corriger_produit(uuid, text, text, numeric, boolean) from public, anon;
grant execute on function app_e08c374bc4_corriger_produit(uuid, text, text, numeric, boolean) to authenticated;


-- Un article DÉJÀ COMMANDÉ ne se supprime pas : sa ligne de commande porte le
-- libellé et le prix du jour de la vente, et l'effacer trouerait une facture
-- émise. Dans ce cas la fonction bascule en désactivation, qui le retire de la
-- vitrine sans toucher à l'historique, et le dit.
create or replace function app_e08c374bc4_supprimer_produit(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_nom text; v_commandes integer;
begin
  if not app_e08c374bc4_is_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;

  select nom into v_nom from app_e08c374bc4_produits where id = p_id;
  if v_nom is null then
    raise exception 'Article introuvable.' using errcode = 'P0002';
  end if;

  select count(*) into v_commandes
  from app_e08c374bc4_lignes_commande_gp where produit_id = p_id;

  if v_commandes > 0 then
    update app_e08c374bc4_produits set actif = false, updated_at = now() where id = p_id;
    return jsonb_build_object(
      'supprime', false, 'desactive', true, 'commandes', v_commandes,
      'message', format('« %s » a déjà été commandé %s fois : il est retiré de la vente mais '
                        || 'conservé, parce que les factures émises le citent.', v_nom, v_commandes));
  end if;

  delete from app_e08c374bc4_produits where id = p_id;
  return jsonb_build_object('supprime', true, 'desactive', false,
    'message', format('« %s » a été supprimé.', v_nom));
end; $$;
revoke all on function app_e08c374bc4_supprimer_produit(uuid) from public, anon;
grant execute on function app_e08c374bc4_supprimer_produit(uuid) to authenticated;


-- La liste de travail : ce que la vitrine ne montre pas, et surtout les
-- DÉFAUTS de chaque fiche. « 55 fiches à revoir » ne fait travailler personne ;
-- « nom en anglais », « sans description », « fret supérieur au prix » disent
-- quoi faire, et permettent de traiter le catalogue par ordre de gravité.
create or replace function app_e08c374bc4_produits_a_corriger()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not app_e08c374bc4_is_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'nom', p.nom,
      'description', p.description,
      'photo', p.photos[1],
      'espace', p.espace,
      'actif', p.actif,
      'prix_unitaire_fcfa', p.prix_unitaire_fcfa,
      'prix_achat_fcfa', p.prix_achat_fcfa,
      'cout_fret_fcfa', p.cout_fret_fcfa,
      'source_donnee', p.source_donnee,
      'reference_externe', p.reference_externe,
      'commandes', (select count(*) from app_e08c374bc4_lignes_commande_gp l where l.produit_id = p.id),
      'coefficient', case when coalesce(p.prix_achat_fcfa,0) > 0
                          then round((p.prix_unitaire_fcfa / p.prix_achat_fcfa)::numeric, 2) end,
      'defauts', (
        select coalesce(jsonb_agg(d), '[]'::jsonb) from (
          select 'nom_anglais' as d where p.nom ~* '\y(with|and|for|the|set|black|white|portable|adjustable|storage|holder|cover|inch)\y'
          union all
          select 'sans_description' where p.description is null or length(btrim(p.description)) < 30
          union all
          select 'fret_superieur_au_prix' where coalesce(p.cout_fret_fcfa,0) > p.prix_unitaire_fcfa
          union all
          select 'sans_photo' where p.photos is null or array_length(p.photos,1) is null
        ) t)
    ) order by p.updated_at desc)
    from app_e08c374bc4_produits p), '[]'::jsonb);
end; $$;
revoke all on function app_e08c374bc4_produits_a_corriger() from public, anon;
grant execute on function app_e08c374bc4_produits_a_corriger() to authenticated;
