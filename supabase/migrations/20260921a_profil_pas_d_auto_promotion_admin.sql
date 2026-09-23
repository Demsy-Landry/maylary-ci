-- Faille corrigée : un compte pouvait s'inscrire directement en administrateur.
--
-- La politique `profiles_self_insert` laissait un utilisateur connecté créer sa
-- propre ligne de profil sans contrôler le `type_compte`. Un compte neuf, qui
-- n'a pas encore de profil, pouvait donc s'insérer en `type_compte = 'admin'`
-- et prendre la main sur tout MayLary. Les politiques de MODIFICATION, elles,
-- interdisaient déjà de basculer en admin ; seule la porte de la CRÉATION était
-- ouverte.
--
-- On la referme : à la création de son propre profil, un utilisateur ne peut
-- pas se donner le type `admin`, ni s'attribuer un rôle d'équipe. Le rôle
-- d'administrateur ne s'accorde plus que côté serveur (clé de service / SQL),
-- jamais depuis le navigateur. Les inscriptions normales — acheteurs, vendeurs —
-- ne sont pas touchées : tous les types autres qu'admin restent permis.

drop policy if exists "profiles_self_insert" on public.app_e08c374bc4_profiles;

create policy "profiles_self_insert"
  on public.app_e08c374bc4_profiles
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and type_compte is distinct from 'admin'
    and role_equipe is null
  );
