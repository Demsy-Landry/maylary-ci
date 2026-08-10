-- Régie publicitaire : des emplacements, des annonces, des compteurs.
--
-- Une réserve est inscrite dans le schéma plutôt que dans une note, parce
-- qu'une note se perd. MayLary Group vend de la confiance : « aucun taux
-- inventé », « payé, protégé ». Une bannière d'un transitaire concurrent à côté
-- d'un calcul de droits de douane détruirait en une seconde ce que le corpus
-- TEC a mis des semaines à établir. Le lecteur ne distingue pas la régie de
-- l'éditeur.
--
-- D'où la colonne `accepte_externe`. Un emplacement peut accueillir une annonce
-- maison — un partenaire choisi, un produit du catalogue, un service de la
-- maison — sans accueillir pour autant un réseau tiers qui décide seul de ce
-- qui s'affiche. Sur les écrans du Déclarant, elle est fausse et doit le
-- rester.
--
-- Sur le rendement : une régie tierce sur un site à faible trafic rapporte des
-- sommes dérisoires. La vraie valeur de cet inventaire est ailleurs — une
-- compagnie maritime, un assureur, un fournisseur de l'Espace Pro paieront un
-- emplacement chez un transitaire agréé bien plus cher qu'un réseau
-- automatique, parce que l'audience est exactement la leur.

create table if not exists app_e08c374bc4_emplacements_pub (
  code            text primary key,
  libelle         text not null,
  zone            text not null,
  -- Faux là où une annonce tierce abîmerait la confiance dans le chiffre.
  accepte_externe boolean not null default false,
  actif           boolean not null default true,
  format          text not null default 'banniere'
                  check (format in ('banniere', 'carte', 'ligne')),
  note            text
);

insert into app_e08c374bc4_emplacements_pub (code, libelle, zone, accepte_externe, format, note) values
  ('accueil_bas',      'Accueil — sous les services',        'accueil',   true,  'banniere',
   'Fort passage, contexte neutre : c''est l''emplacement à vendre en premier.'),
  ('boutique_liste',   'Boutique — dans la liste produits',  'boutique',  true,  'carte',
   'Une annonce prend la place d''une vignette. À réserver à un produit ou un partenaire crédible.'),
  ('catalogue_pro',    'Espace Pro — haut de catalogue',     'catalogue', true,  'banniere',
   'Audience d''acheteurs professionnels : l''inventaire le mieux valorisé du site.'),
  ('suivi_commande',   'Suivi de commande — sous le statut', 'compte',    false, 'ligne',
   'Le client y vient pour savoir où est sa marchandise. Rien d''externe ici : l''inquiétude ne se monétise pas.'),
  ('declarant_bas',    'Le Déclarant — sous les résultats',  'declarant', false, 'ligne',
   'JAMAIS d''annonce externe. Une bannière de transitaire à côté d''un taux de douane ferait douter du taux lui-même.')
on conflict (code) do nothing;

create table if not exists app_e08c374bc4_annonces (
  id           uuid primary key default gen_random_uuid(),
  emplacement  text not null references app_e08c374bc4_emplacements_pub (code) on delete cascade,
  annonceur    text not null,
  titre        text not null,
  texte        text,
  image_url    text,
  lien         text not null,
  -- 'interne' : un partenaire que nous avons choisi et dont nous répondons.
  -- 'externe' : une régie tierce. Refusée là où accepte_externe est faux.
  origine      text not null default 'interne' check (origine in ('interne', 'externe')),
  -- Le poids départage deux annonces actives sur le même emplacement.
  poids        integer not null default 1 check (poids > 0),
  debut_le     date,
  fin_le       date,
  actif        boolean not null default true,
  cree_le      timestamptz not null default now()
);

create index if not exists app_e08c374bc4_annonces_emplacement_idx
  on app_e08c374bc4_annonces (emplacement, actif);

-- Une annonce externe ne peut pas se poser sur un emplacement qui les refuse.
-- La règle est dans la base : un écran peut se tromper, une contrainte non.
create or replace function app_e08c374bc4_verifier_origine_annonce()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare v_accepte boolean;
begin
  select accepte_externe into v_accepte
  from app_e08c374bc4_emplacements_pub where code = new.emplacement;
  if new.origine = 'externe' and not coalesce(v_accepte, false) then
    raise exception 'L''emplacement « % » n''accepte pas d''annonce externe.', new.emplacement
      using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists app_e08c374bc4_annonces_origine on app_e08c374bc4_annonces;
create trigger app_e08c374bc4_annonces_origine
  before insert or update on app_e08c374bc4_annonces
  for each row execute function app_e08c374bc4_verifier_origine_annonce();

-- Compteurs agrégés par jour : une ligne par affichage ferait des millions de
-- lignes pour une information qu'on ne lit qu'en cumul.
create table if not exists app_e08c374bc4_stats_pub (
  annonce_id  uuid not null references app_e08c374bc4_annonces (id) on delete cascade,
  jour        date not null default current_date,
  impressions integer not null default 0,
  clics       integer not null default 0,
  primary key (annonce_id, jour)
);

alter table app_e08c374bc4_emplacements_pub enable row level security;
alter table app_e08c374bc4_annonces enable row level security;
alter table app_e08c374bc4_stats_pub enable row level security;

drop policy if exists "Emplacements lisibles" on app_e08c374bc4_emplacements_pub;
create policy "Emplacements lisibles" on app_e08c374bc4_emplacements_pub for select using (true);
drop policy if exists "Emplacements admin" on app_e08c374bc4_emplacements_pub;
create policy "Emplacements admin" on app_e08c374bc4_emplacements_pub for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

drop policy if exists "Annonces actives lisibles" on app_e08c374bc4_annonces;
create policy "Annonces actives lisibles" on app_e08c374bc4_annonces for select
  using (actif or app_e08c374bc4_is_admin());
drop policy if exists "Annonces admin" on app_e08c374bc4_annonces;
create policy "Annonces admin" on app_e08c374bc4_annonces for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

drop policy if exists "Stats pub admin" on app_e08c374bc4_stats_pub;
create policy "Stats pub admin" on app_e08c374bc4_stats_pub for select
  using (app_e08c374bc4_is_admin());

/**
 * L'annonce à montrer pour un emplacement, tirée au poids.
 *
 * Rend NULL quand l'emplacement est vide ou inactif — l'écran n'affiche alors
 * rien du tout. Un cadre vide « Espace publicitaire disponible » sur un site qui
 * démarre annonce surtout qu'il n'a pas d'annonceurs.
 */
create or replace function app_e08c374bc4_annonce_pour(p_emplacement text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(a) - 'poids' - 'cree_le'
  from app_e08c374bc4_annonces a
  join app_e08c374bc4_emplacements_pub e on e.code = a.emplacement
  where a.emplacement = p_emplacement
    and a.actif and e.actif
    and (a.debut_le is null or a.debut_le <= current_date)
    and (a.fin_le   is null or a.fin_le   >= current_date)
  order by random() / a.poids
  limit 1;
$$;

/** Incrémente un compteur. Écrit par la clé anonyme, sans lecture possible. */
create or replace function app_e08c374bc4_compter_pub(p_annonce uuid, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_type not in ('impression', 'clic') then return; end if;
  insert into app_e08c374bc4_stats_pub (annonce_id, jour, impressions, clics)
  values (p_annonce, current_date,
          case p_type when 'impression' then 1 else 0 end,
          case p_type when 'clic' then 1 else 0 end)
  on conflict (annonce_id, jour) do update
  set impressions = app_e08c374bc4_stats_pub.impressions + excluded.impressions,
      clics       = app_e08c374bc4_stats_pub.clics + excluded.clics;
end $$;

grant execute on function app_e08c374bc4_annonce_pour(text) to anon, authenticated;
grant execute on function app_e08c374bc4_compter_pub(uuid, text) to anon, authenticated;

-- Deux verrous sur les adresses d'une annonce (migration 20260810).
--
-- `lien` part directement dans un href. Un `javascript:…` y exécuterait du code
-- dans la page, avec la session du visiteur : c'est du script stocké, et le
-- fait que seule l'administration insère des annonces ne change rien à la
-- gravité si un compte d'équipe est compromis.
--
-- `image_url` est chargée par le navigateur. La politique de sécurité de
-- contenu du site n'autorise que nos propres domaines : une image hébergée
-- ailleurs serait simplement bloquée, et l'annonceur verrait un cadre vide sans
-- comprendre pourquoi. On l'interdit à la source.
alter table app_e08c374bc4_annonces
  add constraint annonces_lien_sur
    check (lien ~ '^(https://|/)'),
  add constraint annonces_image_hebergee
    check (
      image_url is null
      or image_url like 'https://oubowmftzxpruckjzwuq.supabase.co/storage/v1/object/public/%'
    );

comment on constraint annonces_image_hebergee on app_e08c374bc4_annonces is
  'Le visuel d''une annonce doit être déposé dans notre stockage : la politique de sécurité de contenu bloque les images externes.';
