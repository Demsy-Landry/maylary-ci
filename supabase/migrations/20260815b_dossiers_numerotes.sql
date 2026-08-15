-- ---------------------------------------------------------------------------
-- Le dossier numéroté.
--
-- Directive du fondateur : « Chaque demande doit faire l'ouverture d'un dossier
-- numéroté qui contient toute la documentation jusqu'au bordereau de livraison,
-- puis fermeture du dossier, archivage. »
--
-- C'est la façon dont un transit se tient réellement. Une demande d'import, une
-- demande d'export, une commande boutique et un sourcing sont quatre portes
-- d'entrée différentes, mais derrière, c'est le même objet : un dossier qui
-- s'ouvre, accumule ses pièces, se clôt, et s'archive. Sans cet objet, la
-- documentation vit éparpillée dans quatre tables et personne ne peut répondre
-- à « qu'est-ce qui manque ? » — la seule question qui compte.
--
-- Deux règles sont posées en dur, parce qu'elles ne survivraient pas à une
-- consigne :
--
--   1. La liste des pièces attendues n'est pas saisie à la main. Elle est
--      DÉDUITE de la base documentaire au moment de l'ouverture, selon le sens,
--      le mode et les conditions déclarées. Un dossier ne peut donc pas naître
--      avec une liste incomplète parce que quelqu'un était pressé.
--
--   2. On ne clôt pas un dossier auquel il manque une pièce obligatoire. La
--      fonction refuse et rend la liste. C'est exactement le moment où l'oubli
--      coûte cher — après, il est trop tard pour le rattraper proprement.
-- ---------------------------------------------------------------------------

create table if not exists app_e08c374bc4_dossiers (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null unique,

  sens          text not null check (sens in ('import', 'export')),
  mode          text not null default 'tous' check (mode in ('aerien', 'maritime', 'routier', 'tous')),

  -- D'où vient le dossier. Le couple (type, id) plutôt qu'une clé étrangère par
  -- table : quatre colonnes nullables donneraient quatre façons d'avoir un
  -- dossier orphelin.
  origine_type  text not null check (origine_type in
                  ('demande_import', 'demande_export', 'commande_gp', 'sourcing', 'manuel')),
  origine_id    uuid,

  user_id       uuid references auth.users(id) on delete set null,
  designation   text,
  reference_client text,

  statut        text not null default 'ouvert' check (statut in
                  ('ouvert', 'documentation', 'declaration', 'liquidation',
                   'enlevement', 'livraison', 'clos', 'archive')),

  ouvert_le     timestamptz not null default now(),
  clos_le       timestamptz,
  archive_le    timestamptz,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists app_e08c374bc4_dossiers_user_idx on app_e08c374bc4_dossiers (user_id);
create index if not exists app_e08c374bc4_dossiers_origine_idx on app_e08c374bc4_dossiers (origine_type, origine_id);
create index if not exists app_e08c374bc4_dossiers_statut_idx on app_e08c374bc4_dossiers (statut);

-- Les pièces du dossier : une ligne par document attendu, posée à l'ouverture.
create table if not exists app_e08c374bc4_dossier_pieces (
  id            uuid primary key default gen_random_uuid(),
  dossier_id    uuid not null references app_e08c374bc4_dossiers(id) on delete cascade,
  code_document text not null references app_e08c374bc4_documents_procedure(code),

  statut        text not null default 'attendu' check (statut in
                  ('attendu', 'demande', 'recu', 'valide', 'sans_objet')),

  -- « sans_objet » mérite une justification écrite. Écarter une pièce sans dire
  -- pourquoi, c'est reconstruire l'oubli qu'on cherche à empêcher.
  motif_sans_objet text,

  fichier_chemin text,
  reference      text,
  recu_le        timestamptz,
  valide_le      timestamptz,
  valide_par     uuid references auth.users(id) on delete set null,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (dossier_id, code_document),
  constraint app_e08c374bc4_piece_sans_objet_motive
    check (statut <> 'sans_objet' or coalesce(btrim(motif_sans_objet), '') <> '')
);

create index if not exists app_e08c374bc4_pieces_dossier_idx on app_e08c374bc4_dossier_pieces (dossier_id);

-- Le compteur de numéros, par année et par sens.
create table if not exists app_e08c374bc4_compteurs_dossier (
  annee   integer not null,
  sens    text not null,
  dernier integer not null default 0,
  primary key (annee, sens)
);

-- ---------------------------------------------------------------------------
-- Le numéro.
--
-- Verrouillage par insertion-puis-incrément dans la même instruction : deux
-- demandes déposées à la même seconde ne peuvent pas recevoir le même numéro.
-- ---------------------------------------------------------------------------
create or replace function app_e08c374bc4_numero_dossier(p_sens text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_annee integer := extract(year from now())::integer;
  v_n     integer;
begin
  insert into app_e08c374bc4_compteurs_dossier (annee, sens, dernier)
  values (v_annee, p_sens, 1)
  on conflict (annee, sens) do update set dernier = app_e08c374bc4_compteurs_dossier.dernier + 1
  returning dernier into v_n;

  return format('MLY-%s-%s-%s',
    case p_sens when 'export' then 'EXP' else 'IMP' end,
    v_annee, lpad(v_n::text, 4, '0'));
end;
$$;

-- ---------------------------------------------------------------------------
-- L'ouverture.
--
-- « p_conditions » porte ce qui déclenche les pièces conditionnelles :
-- 'fob_1m' (valeur FOB ≥ 1 000 000), 'preferentiel', 'supports_son_image',
-- 'vegetaux', 'denrees', 'filiere_reglementee'. Ce que l'appelant ne déclare
-- pas n'est pas attendu — mais rien n'est retiré du socle obligatoire.
-- ---------------------------------------------------------------------------
create or replace function app_e08c374bc4_ouvrir_dossier(
  p_sens          text,
  p_mode          text default 'tous',
  p_origine_type  text default 'manuel',
  p_origine_id    uuid default null,
  p_user_id       uuid default null,
  p_designation   text default null,
  p_conditions    text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid;
  v_numero  text;
  v_pieces  integer := 0;
begin
  if p_sens not in ('import', 'export') then
    raise exception 'Sens inconnu : %. Attendu « import » ou « export ».', p_sens using errcode = '22023';
  end if;

  -- Un même objet d'origine ne peut pas ouvrir deux dossiers : on rend celui
  -- qui existe plutôt que d'en créer un doublon silencieux.
  if p_origine_id is not null then
    select id, numero into v_id, v_numero
    from app_e08c374bc4_dossiers
    where origine_type = p_origine_type and origine_id = p_origine_id
    limit 1;
    if v_id is not null then
      return jsonb_build_object('id', v_id, 'numero', v_numero, 'deja_ouvert', true);
    end if;
  end if;

  v_numero := app_e08c374bc4_numero_dossier(p_sens);

  insert into app_e08c374bc4_dossiers
    (numero, sens, mode, origine_type, origine_id, user_id, designation)
  values (v_numero, p_sens, coalesce(p_mode, 'tous'), p_origine_type, p_origine_id, p_user_id, p_designation)
  returning id into v_id;

  insert into app_e08c374bc4_dossier_pieces (dossier_id, code_document)
  select v_id, d.code
  from app_e08c374bc4_documents_procedure d
  where d.actif
    and (d.sens = 'les_deux' or d.sens = p_sens)
    and (d.mode = 'tous' or d.mode = coalesce(p_mode, 'tous') or coalesce(p_mode, 'tous') = 'tous')
    and (
      d.obligation = 'obligatoire'
      or (d.code = 'RFCV'              and 'fob_1m'              = any(p_conditions))
      or (d.code = 'AD_VALEUR'         and 'fob_1m'          <> all(p_conditions) and p_sens = 'import')
      or (d.code = 'CERTIFICAT_ORIGINE' and 'preferentiel'       = any(p_conditions))
      or (d.code = 'BURIDA'            and 'supports_son_image'  = any(p_conditions))
      or (d.code = 'CERTIFICAT_PHYTO'  and 'vegetaux'            = any(p_conditions))
      or (d.code = 'CERTIFICAT_SANITAIRE' and 'denrees'          = any(p_conditions))
      or (d.code = 'AGREMENT_FILIERE'  and 'filiere_reglementee' = any(p_conditions))
    );
  get diagnostics v_pieces = row_count;

  return jsonb_build_object(
    'id', v_id, 'numero', v_numero, 'deja_ouvert', false, 'pieces_attendues', v_pieces);
end;
$$;

-- ---------------------------------------------------------------------------
-- L'état du dossier : ce qui manque, et ce que coûte chaque manque.
-- ---------------------------------------------------------------------------
create or replace function app_e08c374bc4_etat_dossier(p_dossier_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'dossier', to_jsonb(d) - 'user_id',
    'pieces', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', p.code_document, 'libelle', doc.libelle, 'sigle', doc.sigle,
        'emetteur', doc.emetteur, 'moment', doc.moment,
        'obligation', doc.obligation, 'condition', doc.condition,
        'consequence_oubli', doc.consequence_oubli,
        'delai_indicatif', doc.delai_indicatif, 'cout_fcfa', doc.cout_fcfa,
        'reference', doc.reference, 'source', doc.source, 'verifie', doc.verifie,
        'statut', p.statut, 'motif_sans_objet', p.motif_sans_objet,
        'fichier_chemin', p.fichier_chemin, 'recu_le', p.recu_le)
        order by doc.ordre)
      from app_e08c374bc4_dossier_pieces p
      join app_e08c374bc4_documents_procedure doc on doc.code = p.code_document
      where p.dossier_id = d.id), '[]'::jsonb),
    'manquantes', coalesce((
      select jsonb_agg(doc.libelle order by doc.ordre)
      from app_e08c374bc4_dossier_pieces p
      join app_e08c374bc4_documents_procedure doc on doc.code = p.code_document
      where p.dossier_id = d.id
        and doc.obligation = 'obligatoire'
        and p.statut not in ('recu', 'valide', 'sans_objet')), '[]'::jsonb),
    'complet', not exists (
      select 1 from app_e08c374bc4_dossier_pieces p
      join app_e08c374bc4_documents_procedure doc on doc.code = p.code_document
      where p.dossier_id = d.id
        and doc.obligation = 'obligatoire'
        and p.statut not in ('recu', 'valide', 'sans_objet'))
  )
  from app_e08c374bc4_dossiers d
  where d.id = p_dossier_id;
$$;

-- ---------------------------------------------------------------------------
-- La clôture, et le refus de clore un dossier incomplet.
-- ---------------------------------------------------------------------------
create or replace function app_e08c374bc4_clore_dossier(p_dossier_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manque text[];
begin
  if not app_e08c374bc4_is_admin() then
    raise exception 'Seule l''équipe MayLary Group peut clore un dossier.' using errcode = '42501';
  end if;

  select array_agg(doc.libelle order by doc.ordre) into v_manque
  from app_e08c374bc4_dossier_pieces p
  join app_e08c374bc4_documents_procedure doc on doc.code = p.code_document
  where p.dossier_id = p_dossier_id
    and doc.obligation = 'obligatoire'
    and p.statut not in ('recu', 'valide', 'sans_objet');

  if v_manque is not null then
    return jsonb_build_object(
      'clos', false, 'manquantes', to_jsonb(v_manque),
      'message', 'Le dossier ne peut pas être clos : ' || array_length(v_manque, 1)
        || ' pièce(s) obligatoire(s) manquent. Une pièce non applicable doit être '
        || 'marquée « sans objet » AVEC son motif — pas laissée en attente.');
  end if;

  update app_e08c374bc4_dossiers
  set statut = 'clos', clos_le = now(), updated_at = now()
  where id = p_dossier_id;

  return jsonb_build_object('clos', true, 'message', 'Dossier clos. Il peut être archivé.');
end;
$$;

create or replace function app_e08c374bc4_archiver_dossier(p_dossier_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_statut text;
begin
  if not app_e08c374bc4_is_admin() then
    raise exception 'Seule l''équipe MayLary Group peut archiver un dossier.' using errcode = '42501';
  end if;

  select statut into v_statut from app_e08c374bc4_dossiers where id = p_dossier_id;
  if v_statut is null then
    return jsonb_build_object('archive', false, 'message', 'Dossier introuvable.');
  end if;
  -- On n'archive que ce qui est clos. Archiver un dossier ouvert, c'est le
  -- perdre de vue avec ses pièces manquantes.
  if v_statut <> 'clos' then
    return jsonb_build_object('archive', false,
      'message', 'Un dossier s''archive après sa clôture. Celui-ci est au statut « ' || v_statut || ' ».');
  end if;

  update app_e08c374bc4_dossiers
  set statut = 'archive', archive_le = now(), updated_at = now()
  where id = p_dossier_id;

  return jsonb_build_object('archive', true, 'message', 'Dossier archivé.');
end;
$$;

-- ---------------------------------------------------------------------------
-- Confidentialité : le client voit SON dossier, l'équipe voit tout.
-- ---------------------------------------------------------------------------
alter table app_e08c374bc4_dossiers enable row level security;
drop policy if exists "Dossiers du client" on app_e08c374bc4_dossiers;
create policy "Dossiers du client" on app_e08c374bc4_dossiers for select
  using (user_id = auth.uid() or app_e08c374bc4_is_admin());
drop policy if exists "Dossiers admin" on app_e08c374bc4_dossiers;
create policy "Dossiers admin" on app_e08c374bc4_dossiers for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

alter table app_e08c374bc4_dossier_pieces enable row level security;
drop policy if exists "Pièces du client" on app_e08c374bc4_dossier_pieces;
create policy "Pièces du client" on app_e08c374bc4_dossier_pieces for select
  using (exists (select 1 from app_e08c374bc4_dossiers d
                 where d.id = dossier_id and (d.user_id = auth.uid() or app_e08c374bc4_is_admin())));
drop policy if exists "Pièces admin" on app_e08c374bc4_dossier_pieces;
create policy "Pièces admin" on app_e08c374bc4_dossier_pieces for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

alter table app_e08c374bc4_compteurs_dossier enable row level security;
drop policy if exists "Compteurs admin" on app_e08c374bc4_compteurs_dossier;
create policy "Compteurs admin" on app_e08c374bc4_compteurs_dossier for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());
