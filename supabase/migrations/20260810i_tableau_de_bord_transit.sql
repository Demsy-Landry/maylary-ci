/**
 * Le tableau de bord d'un transitaire, en un seul appel.
 *
 * L'écran précédent posait neuf requêtes depuis le navigateur pour afficher
 * neuf compteurs. Ce n'était pas un poste de pilotage, c'était une liste de
 * choses à faire — et elle ne disait rien de ce qui fait le métier : où sont
 * les marchandises, combien de valeur est engagée en mer, et ce qui coûtera
 * cher si on ne le traite pas aujourd'hui.
 *
 * Trois choses que cette fonction rend et que l'ancien écran ignorait.
 *
 * **Le pipeline.** Un dossier d'import traverse dix étapes, de la cotation à la
 * livraison. Les voir alignées avec leur nombre et leur valeur, c'est voir son
 * activité ; les voir en vrac, c'est voir une boîte de réception. Les étapes
 * sont énumérées en dur plutôt que déduites des données : une étape vide doit
 * apparaître vide, pas disparaître.
 *
 * **La valeur engagée.** Ce qui flotte quelque part entre un fournisseur et
 * Abidjan est de l'argent immobilisé.
 *
 * **Ce qui coûte à ne rien faire.** La franchise de magasinage court dès le
 * déchargement ; passé le délai, le terminal facture chaque jour. Une alerte à
 * huit jours vaut mieux qu'une facture à quinze.
 */
create or replace function app_e08c374bc4_tableau_de_bord()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_franchise    integer;
  v_pipeline_imp jsonb;
  v_pipeline_exp jsonb;
  v_alertes      jsonb := '[]'::jsonb;
  v_n            integer;
begin
  if not app_e08c374bc4_is_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;

  select coalesce(valeur, 10)::integer into v_franchise
  from app_e08c374bc4_regles_procedure where code = 'MAGASINAGE_FRANCHISE';

  with etapes(rang, statut, libelle) as (values
    (1,'nouvelle','Nouvelle'), (2,'en_cotation','En cotation'),
    (3,'devis_envoye','Devis envoyé'), (4,'validee','Validée'),
    (5,'achat_effectue','Achat effectué'), (6,'expedition_internationale','En transit'),
    (7,'arrivee_ci','Arrivée en Côte d''Ivoire'), (8,'dedouanement','Dédouanement'),
    (9,'transit_local','Transit local'), (10,'livree','Livrée')
  )
  select jsonb_agg(jsonb_build_object(
           'statut', e.statut, 'libelle', e.libelle, 'rang', e.rang,
           'n', coalesce(d.n, 0), 'valeur_fcfa', coalesce(d.valeur, 0))
         order by e.rang)
  into v_pipeline_imp
  from etapes e
  left join (
    select statut, count(*) as n,
           sum(coalesce(montant_total_devis_fcfa, valeur_marchandise_estimee_fcfa, 0)) as valeur
    from app_e08c374bc4_demandes_import group by statut
  ) d on d.statut = e.statut;

  with etapes(rang, statut, libelle) as (values
    (1,'nouvelle','Nouvelle'), (2,'en_cotation','En cotation'),
    (3,'devis_envoye','Devis envoyé'), (4,'validee','Validée'),
    (5,'collecte_effectuee','Collecte effectuée'), (6,'dedouanement_export','Dédouanement export'),
    (7,'expedition_internationale','En transit'), (8,'arrivee_destination','Arrivée à destination'),
    (9,'livree','Livrée')
  )
  select jsonb_agg(jsonb_build_object(
           'statut', e.statut, 'libelle', e.libelle, 'rang', e.rang,
           'n', coalesce(d.n, 0), 'valeur_fcfa', coalesce(d.valeur, 0))
         order by e.rang)
  into v_pipeline_exp
  from etapes e
  left join (
    select statut, count(*) as n,
           sum(coalesce(montant_total_devis_fcfa, valeur_marchandise_estimee_fcfa, 0)) as valeur
    from app_e08c374bc4_demandes_export group by statut
  ) d on d.statut = e.statut;

  select count(*) into v_n from app_e08c374bc4_demandes_import
  where statut in ('arrivee_ci', 'dedouanement')
    and updated_at < now() - make_interval(days => v_franchise);
  if v_n > 0 then
    v_alertes := v_alertes || jsonb_build_object(
      'code', 'magasinage', 'gravite', 'haute', 'n', v_n, 'lien', '/admin/import',
      'libelle', format('%s dossier(s) au port depuis plus de %s jours', v_n, v_franchise),
      'explication', 'La franchise de magasinage est dépassée : le terminal facture désormais chaque jour de séjour.');
  end if;

  select count(*) into v_n from app_e08c374bc4_demandes_import
  where statut = 'devis_envoye' and updated_at < now() - interval '7 days';
  if v_n > 0 then
    v_alertes := v_alertes || jsonb_build_object(
      'code', 'devis_sans_reponse', 'gravite', 'moyenne', 'n', v_n, 'lien', '/admin/import',
      'libelle', format('%s devis sans réponse depuis plus de 7 jours', v_n),
      'explication', 'Un devis qu''on ne relance pas est un devis perdu, et le taux de fret sur lequel il repose vieillit.');
  end if;

  select count(*) into v_n from app_e08c374bc4_demandes_import
  where statut in ('nouvelle', 'en_cotation') and created_at < now() - interval '2 days';
  if v_n > 0 then
    v_alertes := v_alertes || jsonb_build_object(
      'code', 'cotation_en_retard', 'gravite', 'moyenne', 'n', v_n, 'lien', '/admin/import',
      'libelle', format('%s demande(s) en attente de cotation depuis plus de 2 jours', v_n),
      'explication', 'Le client compare pendant ce temps-là.');
  end if;

  select count(*) into v_n from app_e08c374bc4_frais_transit_local where not confirme;
  if v_n > 0 then
    v_alertes := v_alertes || jsonb_build_object(
      'code', 'tarifs_non_confirmes', 'gravite', 'haute', 'n', v_n, 'lien', '/admin/parametres',
      'libelle', format('%s poste(s) de transit sans tarif confirmé', v_n),
      'explication', 'Le moteur refuse de totaliser un devis tant qu''un poste manque : ces lignes bloquent des cotations complètes.');
  end if;

  return jsonb_build_object(
    'pipeline_import', coalesce(v_pipeline_imp, '[]'::jsonb),
    'pipeline_export', coalesce(v_pipeline_exp, '[]'::jsonb),
    'alertes', v_alertes,

    'engage', (
      select jsonb_build_object(
        'dossiers', count(*),
        'valeur_fcfa', coalesce(sum(coalesce(montant_total_devis_fcfa, valeur_marchandise_estimee_fcfa, 0)), 0))
      from app_e08c374bc4_demandes_import
      where statut in ('achat_effectue','expedition_internationale','arrivee_ci','dedouanement','transit_local')),

    'a_traiter', jsonb_build_object(
      'imports',   (select count(*) from app_e08c374bc4_demandes_import where statut in ('nouvelle','en_cotation')),
      'exports',   (select count(*) from app_e08c374bc4_demandes_export where statut in ('nouvelle','en_cotation')),
      'devis',     (select count(*) from app_e08c374bc4_demandes_devis where statut = 'nouvelle'),
      'sourcing',  (select count(*) from app_e08c374bc4_demandes_sourcing where statut in ('nouvelle','transmise','cotee')),
      'commandes', (select count(*) from app_e08c374bc4_commandes_gp where statut = 'paiement_recu_verification'),
      'vendeurs',  (select count(*) from app_e08c374bc4_vendeurs where statut = 'en_attente')),

    'argent', jsonb_build_object(
      'a_reverser_fcfa', greatest(0,
        coalesce((select sum(net_vendeur_fcfa) from app_e08c374bc4_lignes_commande_gp where vendeur_id is not null), 0)
        - coalesce((select sum(montant_fcfa) from app_e08c374bc4_reversements where statut = 'paye'), 0)),
      'encaisse_30j_fcfa', coalesce((
        select sum(montant_total_fcfa) from app_e08c374bc4_commandes_gp
        where statut in ('paiement_confirme','en_preparation','expediee','livree')
          and created_at >= now() - interval '30 days'), 0)),

    'sourcing', jsonb_build_object(
      'fournisseurs',   (select count(*) from app_e08c374bc4_fournisseurs),
      'api_branchees',  (select count(*) from app_e08c374bc4_fournisseurs where api_statut = 'branchee'),
      'api_a_obtenir',  (select count(*) from app_e08c374bc4_fournisseurs where api_statut = 'a_obtenir'),
      'pistes_a_contacter', (select count(*) from app_e08c374bc4_prospection_fournisseurs where statut = 'a_contacter')),

    'catalogue', jsonb_build_object(
      'produits_actifs', (select count(*) from app_e08c374bc4_produits where actif),
      'ruptures',        (select count(*) from app_e08c374bc4_produits where actif and stock_disponible = 'rupture'))
  );
end;
$$;

revoke all on function app_e08c374bc4_tableau_de_bord() from public, anon, authenticated;
grant execute on function app_e08c374bc4_tableau_de_bord() to authenticated, service_role;
