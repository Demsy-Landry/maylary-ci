-- Avis clients et qualité fournisseur.
--
-- CJ ne publie ni note, ni avis, ni volume de ventes : sur 20 références
-- relevées, 15 étaient à zéro marchand. Aucun signal de fiabilité ne vient donc
-- du fournisseur. Le seul jugement qui nous appartienne est celui que nos
-- propres commandes produisent : ce que le client dit après livraison, et ce
-- que nous constatons nous-mêmes quand une expédition tourne mal.

-- ---------------------------------------------------------------------------
-- Avis client, adossés à une livraison réelle
-- ---------------------------------------------------------------------------
create table if not exists app_e08c374bc4_avis_articles (
  id            uuid primary key default gen_random_uuid(),
  produit_id    uuid not null references app_e08c374bc4_produits (id) on delete cascade,
  commande_id   uuid not null references app_e08c374bc4_commandes_gp (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  note          smallint not null check (note between 1 and 5),
  commentaire   text,
  -- La modération retire un avis sans l'effacer : on garde la trace du motif.
  publie        boolean not null default true,
  motif_retrait text,
  created_at    timestamptz not null default now(),
  -- Un avis par article et par commande : c'est l'achat qui donne le droit de
  -- parler, donc deux achats donnent deux avis, un achat n'en donne qu'un.
  unique (produit_id, commande_id)
);

create index if not exists app_e08c374bc4_avis_produit_idx
  on app_e08c374bc4_avis_articles (produit_id) where publie;
create index if not exists app_e08c374bc4_avis_user_idx
  on app_e08c374bc4_avis_articles (user_id);

alter table app_e08c374bc4_avis_articles enable row level security;

drop policy if exists avis_lecture_publique on app_e08c374bc4_avis_articles;
create policy avis_lecture_publique on app_e08c374bc4_avis_articles
  for select using (
    publie or auth.uid() = user_id or app_e08c374bc4_is_admin()
  );

-- Trois conditions, chacune indispensable :
--   - l'avis est signé par celui qui l'écrit ;
--   - la commande lui appartient et elle est livrée ;
--   - l'article noté figurait bien dans cette commande.
--
-- La troisième mérite son insistance : rédigée sans qualifier la ligne insérée,
-- elle se replie sur l'alias de la sous-requête (`l.produit_id = l.produit_id`),
-- devient toujours vraie, et laisse un client possédant une seule commande
-- livrée noter n'importe quel article du catalogue. C'est le nom complet de la
-- table qui lève l'ambiguïté.
drop policy if exists avis_depot_apres_livraison on app_e08c374bc4_avis_articles;
create policy avis_depot_apres_livraison on app_e08c374bc4_avis_articles
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from app_e08c374bc4_commandes_gp c
      where c.id = app_e08c374bc4_avis_articles.commande_id
        and c.user_id = auth.uid()
        and c.statut = 'livree'
    )
    and exists (
      select 1 from app_e08c374bc4_lignes_commande_gp l
      where l.commande_id = app_e08c374bc4_avis_articles.commande_id
        and l.produit_id = app_e08c374bc4_avis_articles.produit_id
    )
  );

drop policy if exists avis_correction_auteur on app_e08c374bc4_avis_articles;
create policy avis_correction_auteur on app_e08c374bc4_avis_articles
  for update using (auth.uid() = user_id or app_e08c374bc4_is_admin());

-- Une politique RLS ne voit qu'une seule version de la ligne : elle ne peut pas
-- empêcher l'auteur de déplacer son avis vers un article jamais acheté, ni de
-- remettre en ligne un avis que la modération a retiré. Seul un déclencheur
-- compare l'ancienne et la nouvelle ligne.
create or replace function app_e08c374bc4_avis_correction_bornee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `is_admin()` interroge le profil rattaché à `auth.uid()` : il répond faux
  -- quand la mise à jour vient de la clé de service (edge function, tâche de
  -- fond), qui n'a pas d'identité. Sans ce premier test, le déclencheur
  -- annulerait silencieusement les retraits de modération.
  --
  -- Le cas anonyme n'est pas concerné : la politique de mise à jour exige déjà
  -- `auth.uid() = user_id`, impossible à satisfaire sans identité.
  if auth.uid() is null or app_e08c374bc4_is_admin() then
    return new;
  end if;

  -- L'auteur ne corrige que ce qu'il a écrit : la note et le commentaire.
  new.produit_id    := old.produit_id;
  new.commande_id   := old.commande_id;
  new.user_id       := old.user_id;
  new.publie        := old.publie;
  new.motif_retrait := old.motif_retrait;
  new.created_at    := old.created_at;
  return new;
end;
$$;

-- Fonction de déclencheur : elle n'a rien à faire dans l'API REST. Un appel
-- direct échouerait, mais une fonction `security definer` joignable depuis
-- l'extérieur n'a pas à exister.
revoke execute on function app_e08c374bc4_avis_correction_bornee() from public, anon, authenticated;

drop trigger if exists app_e08c374bc4_avis_correction_bornee on app_e08c374bc4_avis_articles;
create trigger app_e08c374bc4_avis_correction_bornee
  before update on app_e08c374bc4_avis_articles
  for each row execute function app_e08c374bc4_avis_correction_bornee();

-- ---------------------------------------------------------------------------
-- Incidents constatés par nous, que le client n'a pas forcément vus
-- ---------------------------------------------------------------------------
-- Un article cassé remplacé avant expédition ne produira jamais de mauvais
-- avis : le client ne l'a pas vu. Il coûte pourtant, et il dit quelque chose de
-- l'atelier. C'est ce que cette table retient.
create table if not exists app_e08c374bc4_incidents_fournisseur (
  id                     uuid primary key default gen_random_uuid(),
  produit_id             uuid references app_e08c374bc4_produits (id) on delete set null,
  commande_id            uuid references app_e08c374bc4_commandes_gp (id) on delete set null,
  -- Recopiés à la constatation : l'incident doit survivre au retrait de
  -- l'article du catalogue, sinon l'historique d'un atelier s'efface avec lui.
  fournisseur_origine_id text,
  fournisseur_origine    text,
  -- Liste close en base autant qu'à l'écran : un libellé inconnu introduit par
  -- une saisie programmatique s'afficherait tel quel dans la fiche.
  type_incident          text not null check (type_incident in (
                           'article_defectueux', 'non_conforme', 'rupture_apres_commande',
                           'retard_expedition', 'emballage_insuffisant', 'quantite_manquante',
                           'autre')),
  description            text not null,
  cout_fcfa              numeric not null default 0,
  constate_par           uuid references auth.users (id) on delete set null,
  created_at             timestamptz not null default now()
);

create index if not exists app_e08c374bc4_incidents_fournisseur_idx
  on app_e08c374bc4_incidents_fournisseur (fournisseur_origine_id);

alter table app_e08c374bc4_incidents_fournisseur enable row level security;

drop policy if exists incidents_admin on app_e08c374bc4_incidents_fournisseur;
create policy incidents_admin on app_e08c374bc4_incidents_fournisseur
  for all using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());
