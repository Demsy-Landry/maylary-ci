-- Le Déclarant doit pouvoir passer la main, et laisser une trace.
--
-- Jusqu'ici l'assistant savait calculer un droit de douane mais ne savait rien
-- du client à qui il parlait : ni sa commande, ni son dossier, ni où en est sa
-- livraison. Un client qui écrit « où est ma marchandise ? » tombait donc sur
-- un expert en tarif douanier incapable de répondre à la seule question qu'il
-- se posait.
--
-- Deux manques à combler. Le premier est de la lecture : l'assistant reçoit
-- désormais des outils qui lisent les commandes et les dossiers de la personne
-- connectée — et d'elle seule. Le second est celui-ci : quand il ne peut pas
-- résoudre, il doit ouvrir une demande d'assistance plutôt que de laisser le
-- client sans suite. Une conversation qui se termine par « contactez-nous »
-- sans rien créer est une conversation perdue.
--
-- Le délai de réponse est inscrit dans la table, pas dans une promesse orale :
-- il est annoncé au client à l'ouverture et il est mesurable ensuite.

create table if not exists app_e08c374bc4_demandes_assistance (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  -- La référence du dossier concerné, quand il y en a un. Volontairement du
  -- texte libre : une commande, une demande d'import ou d'export, ou rien.
  reference_liee   text,
  sujet            text not null,
  message          text not null,
  urgence          text not null default 'normale'
                   check (urgence in ('normale', 'bloquante')),
  statut           text not null default 'ouverte'
                   check (statut in ('ouverte', 'en_cours', 'resolue', 'close')),
  -- D'où vient la demande. Aujourd'hui toujours l'assistant ; demain le
  -- formulaire de contact ou WhatsApp.
  canal            text not null default 'assistant',
  -- Ce que l'assistant avait compris au moment de passer la main. C'est ce qui
  -- évite au client de tout réexpliquer.
  resume_assistant text,
  reponse          text,
  traite_le        timestamptz,
  traite_par       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists app_e08c374bc4_assistance_ouvertes_idx
  on app_e08c374bc4_demandes_assistance (statut, created_at desc);
create index if not exists app_e08c374bc4_assistance_client_idx
  on app_e08c374bc4_demandes_assistance (user_id, created_at desc);

comment on table app_e08c374bc4_demandes_assistance is
  'Passage de main du Déclarant vers l''équipe. Une conversation qui n''aboutit pas doit laisser une trace, sinon le client est perdu sans que personne ne le sache.';

alter table app_e08c374bc4_demandes_assistance enable row level security;

drop policy if exists "Assistance : le client voit la sienne" on app_e08c374bc4_demandes_assistance;
create policy "Assistance : le client voit la sienne"
  on app_e08c374bc4_demandes_assistance for select
  using (user_id = auth.uid());

drop policy if exists "Assistance : le client ouvre la sienne" on app_e08c374bc4_demandes_assistance;
create policy "Assistance : le client ouvre la sienne"
  on app_e08c374bc4_demandes_assistance for insert
  with check (user_id = auth.uid());

drop policy if exists "Assistance : l'équipe voit tout" on app_e08c374bc4_demandes_assistance;
create policy "Assistance : l'équipe voit tout"
  on app_e08c374bc4_demandes_assistance for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

/**
 * Ouvre une demande d'assistance pour la personne connectée.
 *
 * Rend le délai de réponse annoncé, pour que l'assistant le dise au client au
 * lieu de l'inventer. Mieux vaut « sous vingt-quatre heures ouvrées » tenu que
 * « tout de suite » raté.
 */
create or replace function app_e08c374bc4_ouvrir_assistance(
  p_sujet     text,
  p_message   text,
  p_reference text default null,
  p_resume    text default null,
  p_urgence   text default 'normale'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid;
  v_user    uuid := auth.uid();
  v_ouverte integer;
begin
  if v_user is null then
    return jsonb_build_object('ouverte', false,
      'motif', 'Il faut être connecté pour ouvrir une demande d''assistance.');
  end if;

  -- Un client qui reformule trois fois la même question ne doit pas créer
  -- trois dossiers : au-delà de trois demandes ouvertes, on renvoie vers
  -- celles qui existent déjà.
  select count(*) into v_ouverte
  from app_e08c374bc4_demandes_assistance
  where user_id = v_user and statut in ('ouverte', 'en_cours');

  if v_ouverte >= 3 then
    return jsonb_build_object(
      'ouverte', false,
      'motif', 'Vous avez déjà trois demandes en cours de traitement. Notre équipe les reprend dans l''ordre ; inutile d''en ouvrir une de plus.');
  end if;

  insert into app_e08c374bc4_demandes_assistance
    (user_id, sujet, message, reference_liee, resume_assistant, urgence)
  values
    (v_user, left(coalesce(p_sujet, 'Demande du client'), 200), p_message,
     nullif(trim(coalesce(p_reference, '')), ''), p_resume,
     case when p_urgence = 'bloquante' then 'bloquante' else 'normale' end)
  returning id into v_id;

  return jsonb_build_object(
    'ouverte', true,
    'id', v_id,
    'delai_annonce', 'sous 24 heures ouvrées',
    'message', 'Votre demande est enregistrée. Notre équipe vous répond sous 24 heures ouvrées.');
end;
$$;

revoke all on function app_e08c374bc4_ouvrir_assistance(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function app_e08c374bc4_ouvrir_assistance(text, text, text, text, text)
  to authenticated, service_role;
