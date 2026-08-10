-- Fermeture du droit d'exécution par défaut.
--
-- PostgreSQL accorde EXECUTE à PUBLIC sur toute fonction créée sans REVOKE
-- explicite. Combiné à SECURITY DEFINER, cela rendait 30 fonctions appelables
-- par un visiteur non authentifié avec les droits du propriétaire — dont
-- `consommer_ia` (vider le quota d'IA de n'importe quel compte) et `mesurer_ia`
-- (se recréditer indéfiniment). Ces deux-là ne sont appelées que par la
-- fonction serveur de l'agent, avec la clé de service.
--
-- La règle posée ici : on retire tout, puis on rend le strict nécessaire.
-- Toute fonction ajoutée plus tard naît donc fermée, et il faudra un GRANT
-- délibéré pour l'ouvrir.

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'app\_e08c374bc4\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    -- La clé de service perdait aussi son droit implicite : les fonctions
    -- serveur cesseraient de fonctionner sans ce GRANT.
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

-- 1. Auxiliaires appelés depuis les politiques RLS et les vues à droits de
--    l'appelant. Ils s'exécutent dans le contexte du navigateur : sans EXECUTE,
--    toute lecture de table protégée échoue. Ils ne révèlent que ce que
--    l'appelant est déjà.
grant execute on function
  app_e08c374bc4_is_admin(),
  app_e08c374bc4_est_proprietaire(),
  app_e08c374bc4_mon_vendeur_id(),
  app_e08c374bc4_peut_operer(),
  app_e08c374bc4_role_equipe(),
  app_e08c374bc4_tarif_confirme(),
  app_e08c374bc4_delai_confirmation(),
  app_e08c374bc4_nom_abrege(text),
  app_e08c374bc4_vendeur_valide(uuid)
to anon, authenticated;

-- 2. Appels réellement émis par le navigateur d'un visiteur.
grant execute on function
  app_e08c374bc4_annonce_pour(text),
  app_e08c374bc4_compter_pub(uuid, text),
  app_e08c374bc4_tec_chercher(text, integer),
  app_e08c374bc4_tec_verifier(text),
  app_e08c374bc4_quota_classification(),
  app_e08c374bc4_liquider_declaration(jsonb, numeric, numeric, numeric, text)
to anon, authenticated;

-- 3. Appels réservés à un compte connecté : chacun vérifie déjà en interne que
--    l'appelant est bien partie à l'opération.
grant execute on function
  app_e08c374bc4_rejoindre_achat_groupe(uuid, integer),
  app_e08c374bc4_quitter_achat_groupe(uuid),
  app_e08c374bc4_cloturer_achat_groupe(uuid, boolean),
  app_e08c374bc4_comptabiliser_commande(uuid),
  app_e08c374bc4_confirmer_reception(uuid)
to authenticated;

-- Les fonctions de déclencheur n'apparaissent dans aucune liste : PostgreSQL
-- vérifie le droit d'exécution à la création du déclencheur, pas à son
-- déclenchement. Elles restent donc actives sans être appelables directement.
-- Vérifié sur cette base : un UPDATE exécuté sous le rôle `anon` déclenche
-- toujours `set_updated_at`, alors qu'un appel direct lui est refusé.

-- `reversements_dus` filtre elle-même sur is_admin() / mon_vendeur_id(). Sans
-- `security_barrier`, le planificateur peut faire descendre une condition
-- fournie par l'appelant sous ce filtre : une fonction volatile peu coûteuse
-- glissée dans un filtre PostgREST verrait alors des lignes d'un autre vendeur
-- avant que la restriction ne s'applique. La barrière l'interdit.
alter view app_e08c374bc4_reversements_dus set (security_barrier = true);

-- Un `search_path` non figé sur une fonction de déclencheur permet à qui peut
-- créer un schéma de détourner un appel non qualifié.
alter function app_e08c374bc4_verifier_origine_annonce() set search_path = public, pg_temp;
