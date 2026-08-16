-- Le suivi d'une expédition, de bout en bout.
--
-- POURQUOI UNE TABLE À PART, ET NON UN CHAMP DE PLUS SUR LA COMMANDE
--
-- Une commande boutique porte déjà numero_suivi et transporteur_suivi. Ça
-- suffit tant qu'il n'y a qu'un colis et qu'un transporteur. Ça ne suffit plus
-- dès qu'une demande d'import voyage en trois segments — enlèvement chez le
-- fournisseur, traversée maritime, transit local — chacun avec son propre
-- transporteur et son propre numéro.
--
-- LA DISTINCTION QUI COMPTE : QUI PARLE
--
-- Chaque événement porte sa SOURCE. « Le transporteur dit » et « MayLary dit »
-- n'engagent pas de la même façon. Le client doit pouvoir faire la différence
-- sans nous croire sur parole — même règle que pour les taux du tarif.
--
-- CE QU'ON N'ÉCRIT JAMAIS ICI
--
-- Une position devinée. Si le transporteur ne répond pas, aucun événement n'est
-- créé et `derniere_reponse_le` reste où elle était : la frise dira « pas de
-- nouvelle depuis le … ».
--
-- Fichier de référence. Les migrations ont été appliquées en trois temps
-- (tables, correction des droits, fonctions) ; elles sont réunies ici.

create table if not exists app_e08c374bc4_compteurs_expedition (
  annee   integer primary key,
  dernier integer not null default 0
);

create table if not exists app_e08c374bc4_expeditions (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  user_id uuid,
  origine_type text not null
    check (origine_type in ('commande_gp', 'demande_import', 'demande_export', 'dossier', 'libre')),
  origine_id uuid,
  designation text,
  mode text not null default 'maritime'
    check (mode in ('maritime', 'aerien', 'routier', 'express')),
  transporteur text,
  transporteur_code text,
  numero_suivi text,
  statut text not null default 'a_expedier'
    check (statut in ('a_expedier', 'en_transit', 'arrive_ci', 'dedouanement',
                      'en_livraison', 'livree', 'incident', 'annulee')),
  eta date,
  -- `derniere_releve` = quand on a DEMANDÉ. `derniere_reponse_le` = quand on a
  -- REÇU. Les confondre ferait passer un transporteur muet depuis trois jours
  -- pour un suivi à jour.
  suivi_automatique boolean not null default true,
  derniere_releve timestamptz,
  derniere_reponse_le timestamptz,
  releve_erreur text,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);

create index if not exists expeditions_user on app_e08c374bc4_expeditions (user_id);
create index if not exists expeditions_origine on app_e08c374bc4_expeditions (origine_type, origine_id);
create index if not exists expeditions_a_relever
  on app_e08c374bc4_expeditions (derniere_releve nulls first)
  where suivi_automatique and numero_suivi is not null;

create table if not exists app_e08c374bc4_expedition_evenements (
  id uuid primary key default gen_random_uuid(),
  expedition_id uuid not null references app_e08c374bc4_expeditions (id) on delete cascade,
  source text not null check (source in ('transporteur', 'maylary')),
  libelle text not null,
  lieu text,
  survenu_le timestamptz not null,
  enregistre_le timestamptz not null default now(),
  auteur_id uuid,
  -- Une relève rejoue TOUT l'historique du transporteur à chaque appel : sans
  -- empreinte, la frise triplerait à chaque passage.
  empreinte text
);

create unique index if not exists expedition_evenements_empreinte
  on app_e08c374bc4_expedition_evenements (expedition_id, empreinte)
  where empreinte is not null;

create index if not exists expedition_evenements_frise
  on app_e08c374bc4_expedition_evenements (expedition_id, survenu_le desc);

alter table app_e08c374bc4_expeditions enable row level security;
alter table app_e08c374bc4_expedition_evenements enable row level security;

create policy expeditions_lecture on app_e08c374bc4_expeditions for select
  using (user_id = auth.uid() or app_e08c374bc4_is_admin());
create policy expeditions_ecriture_admin on app_e08c374bc4_expeditions for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

create policy evenements_lecture on app_e08c374bc4_expedition_evenements for select
  using (exists (
    select 1 from app_e08c374bc4_expeditions e
    where e.id = expedition_id
      and (e.user_id = auth.uid() or app_e08c374bc4_is_admin())
  ));
create policy evenements_ecriture_admin on app_e08c374bc4_expedition_evenements for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

-- L'administrateur est lui aussi « authenticated » : lui retirer le privilège
-- de table le priverait d'écriture, et aucune politique ne peut le lui rendre —
-- une politique restreint, elle n'accorde jamais. C'est la POLITIQUE qui filtre.
grant insert, update, delete on app_e08c374bc4_expeditions to authenticated;
grant insert, update, delete on app_e08c374bc4_expedition_evenements to authenticated;
revoke all on app_e08c374bc4_expeditions from anon;
revoke all on app_e08c374bc4_expedition_evenements from anon;
revoke all on app_e08c374bc4_compteurs_expedition from anon, authenticated;

-- ---------------------------------------------------------------------------
-- La numérotation, sur le patron des dossiers.
-- ---------------------------------------------------------------------------
create or replace function app_e08c374bc4_numero_expedition()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_annee integer := extract(year from now())::integer;
  v_n     integer;
begin
  insert into app_e08c374bc4_compteurs_expedition (annee, dernier) values (v_annee, 1)
  on conflict (annee) do update set dernier = app_e08c374bc4_compteurs_expedition.dernier + 1
  returning dernier into v_n;
  return format('MLY-EXP-%s-%s', v_annee, lpad(v_n::text, 4, '0'));
end;
$$;

-- Idempotente sur l'origine : un double clic ne donne pas deux frises au même colis.
create or replace function app_e08c374bc4_ouvrir_expedition(
  p_origine_type text, p_origine_id uuid, p_user_id uuid,
  p_designation text default null, p_mode text default 'maritime')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_numero text;
begin
  if not app_e08c374bc4_is_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;

  select id, numero into v_id, v_numero from app_e08c374bc4_expeditions
  where origine_type = p_origine_type and origine_id = p_origine_id limit 1;
  if v_id is not null then
    return jsonb_build_object('id', v_id, 'numero', v_numero, 'deja_ouverte', true);
  end if;

  v_numero := app_e08c374bc4_numero_expedition();
  insert into app_e08c374bc4_expeditions
    (numero, user_id, origine_type, origine_id, designation, mode)
  values (v_numero, p_user_id, p_origine_type, p_origine_id, p_designation,
          coalesce(p_mode, 'maritime'))
  returning id into v_id;

  insert into app_e08c374bc4_expedition_evenements
    (expedition_id, source, libelle, survenu_le, auteur_id)
  values (v_id, 'maylary', 'Expédition ouverte', now(), auth.uid());

  return jsonb_build_object('id', v_id, 'numero', v_numero, 'deja_ouverte', false);
end;
$$;

-- Le geste principal : sur un groupage maritime, aucune API ne dira
-- « conteneur empoté à Nansha ». C'est MayLary qui le sait.
create or replace function app_e08c374bc4_noter_etape(
  p_expedition_id uuid, p_libelle text, p_lieu text default null,
  p_survenu_le timestamptz default null, p_statut text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not app_e08c374bc4_is_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_libelle), '') = '' then
    raise exception 'Une étape sans libellé ne dit rien au client.' using errcode = '22023';
  end if;
  -- Une étape datée dans le futur n'est pas une étape, c'est une prévision.
  if coalesce(p_survenu_le, now()) > now() + interval '1 day' then
    raise exception 'Une étape ne peut pas être datée dans le futur.' using errcode = '22023';
  end if;

  insert into app_e08c374bc4_expedition_evenements
    (expedition_id, source, libelle, lieu, survenu_le, auteur_id)
  values (p_expedition_id, 'maylary', btrim(p_libelle),
          nullif(btrim(coalesce(p_lieu, '')), ''), coalesce(p_survenu_le, now()), auth.uid())
  returning id into v_id;

  if p_statut is not null then
    update app_e08c374bc4_expeditions set statut = p_statut, maj_le = now()
    where id = p_expedition_id;
  else
    update app_e08c374bc4_expeditions set maj_le = now() where id = p_expedition_id;
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke execute on function app_e08c374bc4_ouvrir_expedition(text, uuid, uuid, text, text) from public, anon;
revoke execute on function app_e08c374bc4_noter_etape(uuid, text, text, timestamptz, text) from public, anon;
revoke execute on function app_e08c374bc4_numero_expedition() from public, anon;
