-- Clés de poste : ouvrir la classification assistée à une application tierce
-- sans ouvrir un point d'accès IA au tout-venant.
--
-- Le problème. La classification coûte de l'argent à chaque appel. Elle est
-- donc réservée aux comptes connectés. Or la cotation E-Transit n'a pas de
-- comptes : elle vit sur un poste de bureau, sans inscription. Lui donner un
-- point d'accès public reviendrait à laisser n'importe qui vider le compte.
--
-- La réponse. Une clé propre au poste, rattachée à un compte MayLary. Elle
-- porte l'identité, elle porte le quota, elle se révoque d'un clic, et chaque
-- classification qu'elle produit entre dans l'historique de ce compte — ce qui
-- donne au passage la continuité recherchée : un code trouvé au Déclarant se
-- retrouve dans E-Transit, et l'inverse.
--
-- La clé elle-même n'est jamais écrite ici. Elle est engendrée dans le
-- navigateur de l'administrateur, montrée une fois, et seule son empreinte
-- SHA-256 arrive en base. Une base recopiée ne livre donc aucune clé.

create table if not exists public.app_e08c374bc4_cles_poste (
  id uuid primary key default gen_random_uuid(),

  -- Empreinte SHA-256 de la clé, en hexadécimal minuscule. Jamais la clé.
  empreinte text not null unique,

  -- À quoi sert cette clé, en clair : « Cotation E-Transit — poste bureau ».
  libelle text not null,

  -- Le compte dont la clé emprunte l'identité, le quota et l'historique.
  utilisateur_id uuid not null references auth.users (id) on delete cascade,

  actif boolean not null default true,

  -- Plafond propre à la clé. Il s'ajoute à celui du compte, jamais ne l'élargit :
  -- c'est le plus bas des deux qui s'applique.
  classifications_par_jour integer not null default 20
    check (classifications_par_jour between 0 and 500),

  cree_le timestamptz not null default now(),
  dernier_usage_le timestamptz,
  usages integer not null default 0,

  -- Ce que l'administrateur veut se rappeler : à qui la clé a été remise.
  note text
);

comment on table public.app_e08c374bc4_cles_poste is
  'Clés d''accès à la classification assistée pour une application tierce sans compte. Seule l''empreinte de la clé est conservée.';
comment on column public.app_e08c374bc4_cles_poste.empreinte is
  'SHA-256 hexadécimal de la clé. La clé en clair n''existe que sur le poste qui s''en sert.';

create index if not exists app_e08c374bc4_cles_poste_utilisateur
  on public.app_e08c374bc4_cles_poste (utilisateur_id);

alter table public.app_e08c374bc4_cles_poste enable row level security;

-- Personne d'autre que l'administration n'a affaire à cette table. La fonction
-- qui vérifie une clé passe par la clé de service et ne lit donc pas à travers
-- ces politiques.
drop policy if exists "Clés de poste réservées à l'administration"
  on public.app_e08c374bc4_cles_poste;
create policy "Clés de poste réservées à l'administration"
  on public.app_e08c374bc4_cles_poste
  for all
  using ((select public.app_e08c374bc4_is_admin()))
  with check ((select public.app_e08c374bc4_is_admin()));
