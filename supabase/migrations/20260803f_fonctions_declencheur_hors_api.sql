-- Toutes les fonctions de déclencheur du projet étaient joignables depuis l'API
-- REST (`/rest/v1/rpc/...`) par un visiteur anonyme : Postgres accorde EXECUTE
-- à `public` par défaut, et PostgREST expose le schéma.
--
-- Un appel direct échouerait — une fonction `returns trigger` refuse d'être
-- appelée autrement — mais une fonction `security definer` atteignable de
-- l'extérieur n'a aucune raison d'exister. L'exécution par un déclencheur ne
-- consulte pas ce privilège : le retrait ne casse rien. Vérifié sur le cas le
-- plus sensible, la création du profil à l'inscription, qui fonctionne toujours.
--
-- Les fonctions qui répondent une valeur (`is_admin`, `peut_operer`,
-- `role_equipe`, `mon_vendeur_id`, `est_proprietaire`, `vendeur_valide`) ne sont
-- volontairement pas touchées : les politiques RLS les appellent dans la session
-- de l'appelant, donc `anon` et `authenticated` doivent pouvoir les exécuter.
-- Elles ne renvoient que des faits sur l'appelant lui-même.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'app\_e08c374bc4\_%'
      and p.prosecdef
      and pg_get_function_result(p.oid) = 'trigger'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.signature);
  end loop;
end $$;

-- `prochain_numero_facture` attribue un numéro de facture et incrémente un
-- compteur : l'exposer laisserait n'importe qui creuser des trous dans la
-- numérotation comptable. Seules les edge functions (clé de service) l'appellent.
revoke execute on function app_e08c374bc4_prochain_numero_facture(text) from public, anon, authenticated;
grant execute on function app_e08c374bc4_prochain_numero_facture(text) to service_role;
