-- ---------------------------------------------------------------------------
-- Ce que l'assistant sait du client à qui il parle.
--
-- Le fondateur : « l'onglet chat ne doit pas être figé, il doit être basé sur
-- l'expérience du compte client dans l'app ». Le chat n'envoyait que le nom de
-- la page : il répondait donc la même chose à quelqu'un qui attend une
-- livraison depuis trois semaines et à quelqu'un qui découvre le site.
--
-- LE POINT DE SÉCURITÉ QUI DÉCIDE DE TOUT
--
-- Ce résumé est produit ICI, à partir de `auth.uid()`, et n'est jamais composé
-- par le navigateur. Si le contexte partait du client, il suffirait d'y écrire
-- « type_compte: admin » pour que le modèle le tienne pour un fait établi. Le
-- navigateur ne dit pas qui il est : il présente un jeton, et le serveur en
-- déduit ce qu'il peut voir.
--
-- Ce qui sort est volontairement court et sans donnée sensible : des états et
-- des références, pas des adresses ni des montants de facture. Un résumé qui
-- part dans un modèle de langage doit être ce qu'on accepterait de voir dans
-- un journal.
-- ---------------------------------------------------------------------------
create or replace function app_e08c374bc4_contexte_client()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_moi uuid := auth.uid();
  v_p   app_e08c374bc4_profiles;
begin
  if v_moi is null then
    -- On le dit explicitement plutôt que de rendre un objet vide, que
    -- l'assistant lirait comme « client sans commande ».
    return jsonb_build_object('connecte', false);
  end if;

  select * into v_p from app_e08c374bc4_profiles where user_id = v_moi;

  return jsonb_build_object(
    'connecte', true,
    'type_compte', coalesce(v_p.type_compte, 'particulier'),
    'nom', coalesce(v_p.nom_entreprise, v_p.nom_complet),
    'ville', v_p.ville,
    'client_depuis', v_p.created_at::date,
    'commandes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'reference', c.reference_publique, 'statut', c.statut,
               'passee_le', c.created_at::date) order by c.created_at desc)
      from (select * from app_e08c374bc4_commandes_gp
            where user_id = v_moi order by created_at desc limit 5) c), '[]'::jsonb),
    'demandes_import', coalesce((
      select jsonb_agg(jsonb_build_object(
               'reference', d.reference_publique, 'statut', d.statut,
               'marchandise', left(d.description_produit, 90)) order by d.created_at desc)
      from (select * from app_e08c374bc4_demandes_import
            where user_id = v_moi order by created_at desc limit 5) d), '[]'::jsonb),
    'demandes_export', coalesce((
      select jsonb_agg(jsonb_build_object(
               'reference', d.reference_publique, 'statut', d.statut,
               'marchandise', left(d.description_produit, 90)) order by d.created_at desc)
      from (select * from app_e08c374bc4_demandes_export
            where user_id = v_moi order by created_at desc limit 5) d), '[]'::jsonb),
    'declarant', jsonb_build_object(
      'formule', coalesce((select formule from app_e08c374bc4_abonnements_ia
                           where utilisateur_id = v_moi
                             and (actif_jusquau is null or actif_jusquau >= current_date)),
                          'decouverte'),
      'classifications', (select count(*) from app_e08c374bc4_classifications_hs where utilisateur_id = v_moi),
      'liquidations', (select count(*) from app_e08c374bc4_liquidations where utilisateur_id = v_moi),
      'requetes_aujourdhui', (select count(*) from app_e08c374bc4_usage_ia
                              where utilisateur_id = v_moi and cree_le::date = current_date)),
    'panier_en_cours', exists (
      select 1 from app_e08c374bc4_commandes_gp
      where user_id = v_moi and statut = 'en_attente_paiement')
  );
end; $$;
revoke all on function app_e08c374bc4_contexte_client() from public;
grant execute on function app_e08c374bc4_contexte_client() to anon, authenticated;
