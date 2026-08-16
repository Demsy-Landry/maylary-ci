-- Le journal des erreurs d'écran.
--
-- L'écran de secours affiche un code court « à donner par téléphone ». Ce code
-- ne menait NULLE PART : il n'était écrit que dans la console du visiteur, que
-- personne ne lira jamais. Le fondateur a reçu 5NIA-5J36 sur son téléphone et
-- il n'y avait rien à en faire. Une promesse faite au client et non tenue.
--
-- Une erreur de rendu vit entièrement dans le navigateur : aucun journal
-- serveur ne la voit, et l'hébergeur n'enregistre que les fonctions serveur.
-- Sans cette table, chaque écran cassé est un mystère définitif.

create table if not exists app_e08c374bc4_journal_erreurs (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  message text not null,
  pile text,
  composant text,
  chemin text,
  navigateur text,
  utilisateur_id uuid,
  cree_le timestamptz not null default now()
);

create index if not exists journal_erreurs_cree_le on app_e08c374bc4_journal_erreurs (cree_le desc);
create index if not exists journal_erreurs_code on app_e08c374bc4_journal_erreurs (code);

alter table app_e08c374bc4_journal_erreurs enable row level security;

-- Écrire : tout le monde, y compris un visiteur non connecté. Une erreur qui
-- survient AVANT la connexion est justement celle qu'on a le plus besoin de
-- voir, et exiger un jeton reviendrait à n'enregistrer que la moitié des pannes.
create policy journal_erreurs_depot
  on app_e08c374bc4_journal_erreurs for insert
  to anon, authenticated
  with check (true);

-- Lire : l'administration seule. Une pile d'appels décrit la structure interne
-- de l'application ; elle n'a rien à faire entre les mains d'un visiteur.
create policy journal_erreurs_lecture
  on app_e08c374bc4_journal_erreurs for select
  using (app_e08c374bc4_is_admin());

-- Ni modification ni suppression : un journal qui se réécrit ne vaut rien.
revoke update, delete on app_e08c374bc4_journal_erreurs from anon, authenticated;
