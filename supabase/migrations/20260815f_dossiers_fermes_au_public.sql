-- ---------------------------------------------------------------------------
-- Les dossiers étaient lisibles par n'importe qui. Correction.
--
-- CE QUI S'EST PASSÉ, ET POURQUOI JE NE L'AVAIS PAS VU
--
-- J'ai posé des politiques RLS soignées sur les tables `dossiers` et
-- `dossier_pieces` : le client voit les siens, l'équipe voit tout. Elles sont
-- justes, et elles n'ont servi à rien.
--
-- Parce qu'à côté, j'ai écrit `etat_dossier` et `tableau_dossiers` en SECURITY
-- DEFINER. Une fonction SECURITY DEFINER s'exécute avec les droits de son
-- PROPRIÉTAIRE, pas de son appelant : elle traverse RLS sans le voir. Et
-- Postgres accorde EXECUTE à PUBLIC par défaut sur toute fonction nouvellement
-- créée. Les deux ensemble ouvrent une porte que la RLS croyait fermer.
--
-- Mesuré, pas supposé. Un appel à `tableau_dossiers` avec la seule clé publique
-- du site — celle qui est dans le JavaScript, lisible par n'importe quel
-- visiteur — a rendu :
--
--   {"ouverts": 1, "incomplets": [{"numero": "MLY-IMP-2026-0001",
--     "designation": "400 cartons de carrelage pour MAXPLUS", "manquantes": 12}]}
--
-- Soit : combien de dossiers la maison traite, pour quels clients, sur quelles
-- marchandises, et lesquels sont bloqués. Un concurrent n'a pas besoin d'autre
-- chose. Et `etat_dossier` rendait de la même façon le détail complet d'un
-- dossier à qui connaissait son identifiant.
--
-- La leçon, écrite ici pour qu'elle serve la prochaine fois : poser une
-- politique RLS ne suffit pas. Il faut aussi vérifier PAR QUI les fonctions
-- qui traversent cette politique peuvent être appelées. C'est exactement ce que
-- signale l'avertissement « security_definer_function_executable » du
-- conseiller Supabase, que je n'avais pas relu après avoir créé ces fonctions.
--
-- LA CORRECTION, EN DEUX TEMPS
--
-- On ne se contente pas de retirer le droit d'exécution : on pose AUSSI le
-- contrôle à l'intérieur de chaque fonction. Une seule barrière peut sauter au
-- prochain déploiement — un `grant` recopié par distraction suffit. Deux
-- barrières indépendantes, non.
-- ---------------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1. Le contrôle À L'INTÉRIEUR des fonctions
-- ------------------------------------------------------------------

-- Le tableau des dossiers est un écran d'exploitation : l'équipe, et personne
-- d'autre.
create or replace function app_e08c374bc4_tableau_dossiers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not app_e08c374bc4_is_admin() then
    raise exception 'Réservé à l''équipe MayLary Group.' using errcode = '42501';
  end if;

  return (select jsonb_build_object(
    'par_etape', coalesce((
      select jsonb_agg(jsonb_build_object('statut', statut, 'n', n) order by n desc)
      from (select statut, count(*) n from app_e08c374bc4_dossiers
            where statut <> 'archive' group by statut) t), '[]'::jsonb),
    'ouverts', (select count(*) from app_e08c374bc4_dossiers where statut not in ('clos','archive')),
    'archives', (select count(*) from app_e08c374bc4_dossiers where statut = 'archive'),
    'incomplets', coalesce((
      select jsonb_agg(x order by x->>'ouvert_le')
      from (
        select jsonb_build_object(
                 'id', d.id, 'numero', d.numero, 'designation', d.designation,
                 'sens', d.sens, 'statut', d.statut, 'ouvert_le', d.ouvert_le,
                 'jours', extract(day from now() - d.ouvert_le)::int,
                 'manquantes', count(*)) x
        from app_e08c374bc4_dossiers d
        join app_e08c374bc4_dossier_pieces p on p.dossier_id = d.id
        join app_e08c374bc4_documents_procedure doc on doc.code = p.code_document
        where d.statut not in ('clos','archive')
          and doc.obligation = 'obligatoire'
          and p.statut not in ('recu','valide','sans_objet')
        group by d.id, d.numero, d.designation, d.sens, d.statut, d.ouvert_le
        limit 8) s), '[]'::jsonb),
    'pieces_les_plus_absentes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'libelle', libelle, 'sigle', sigle, 'n', n,
               'consequence', consequence_oubli) order by n desc)
      from (
        select doc.libelle, doc.sigle, doc.consequence_oubli, count(*) n
        from app_e08c374bc4_dossier_pieces p
        join app_e08c374bc4_dossiers d on d.id = p.dossier_id
        join app_e08c374bc4_documents_procedure doc on doc.code = p.code_document
        where d.statut not in ('clos','archive')
          and doc.obligation = 'obligatoire'
          and p.statut not in ('recu','valide','sans_objet')
        group by doc.libelle, doc.sigle, doc.consequence_oubli
        order by n desc limit 5) t), '[]'::jsonb),
    'dormants', (
      select count(*) from app_e08c374bc4_dossiers
      where statut not in ('clos','archive') and updated_at < now() - interval '5 days')
  ));
end;
$$;

-- L'état d'un dossier : son propriétaire, ou l'équipe. Le contrôle rejoue ce
-- que dit la politique RLS de la table, puisque la fonction la traverse.
create or replace function app_e08c374bc4_etat_dossier(p_dossier_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_proprietaire uuid; v_existe boolean;
begin
  select user_id, true into v_proprietaire, v_existe
  from app_e08c374bc4_dossiers where id = p_dossier_id;

  -- Un dossier introuvable et un dossier interdit rendent la MÊME réponse.
  -- Distinguer les deux dirait à un curieux quels identifiants existent.
  if not coalesce(v_existe, false)
     or not (v_proprietaire = auth.uid() or app_e08c374bc4_is_admin()) then
    return null;
  end if;

  return (select jsonb_build_object(
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
        'fichier_chemin', p.fichier_chemin, 'recu_le', p.recu_le) order by doc.ordre)
      from app_e08c374bc4_dossier_pieces p
      join app_e08c374bc4_documents_procedure doc on doc.code = p.code_document
      where p.dossier_id = d.id), '[]'::jsonb),
    'manquantes', coalesce((
      select jsonb_agg(doc.libelle order by doc.ordre)
      from app_e08c374bc4_dossier_pieces p
      join app_e08c374bc4_documents_procedure doc on doc.code = p.code_document
      where p.dossier_id = d.id and doc.obligation = 'obligatoire'
        and p.statut not in ('recu','valide','sans_objet')), '[]'::jsonb),
    'complet', not exists (
      select 1 from app_e08c374bc4_dossier_pieces p
      join app_e08c374bc4_documents_procedure doc on doc.code = p.code_document
      where p.dossier_id = d.id and doc.obligation = 'obligatoire'
        and p.statut not in ('recu','valide','sans_objet')))
  from app_e08c374bc4_dossiers d where d.id = p_dossier_id);
end;
$$;

-- L'ouverture exige un compte. Sans elle, un visiteur anonyme pouvait épuiser
-- la numérotation de la maison — MLY-IMP-2026-0001 à 9999 en une boucle.
create or replace function app_e08c374bc4_ouvrir_dossier(
  p_sens text, p_mode text default 'tous', p_origine_type text default 'manuel',
  p_origine_id uuid default null, p_user_id uuid default null,
  p_designation text default null, p_conditions text[] default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_numero text; v_pieces integer := 0; v_moi uuid := auth.uid();
begin
  if v_moi is null then
    raise exception 'Connectez-vous pour ouvrir un dossier.' using errcode = '42501';
  end if;
  if p_sens not in ('import', 'export') then
    raise exception 'Sens inconnu : %. Attendu « import » ou « export ».', p_sens using errcode = '22023';
  end if;

  -- On ne prend « p_user_id » que de l'équipe : sinon le dossier appartient à
  -- celui qui l'ouvre. Un client ne doit pas pouvoir écrire au nom d'un autre.
  if p_user_id is not null and p_user_id <> v_moi and not app_e08c374bc4_is_admin() then
    raise exception 'Vous ne pouvez ouvrir un dossier qu''à votre nom.' using errcode = '42501';
  end if;

  if p_origine_id is not null then
    select id, numero into v_id, v_numero from app_e08c374bc4_dossiers
    where origine_type = p_origine_type and origine_id = p_origine_id limit 1;
    if v_id is not null then
      return jsonb_build_object('id', v_id, 'numero', v_numero, 'deja_ouvert', true);
    end if;
  end if;

  v_numero := app_e08c374bc4_numero_dossier(p_sens);
  insert into app_e08c374bc4_dossiers
    (numero, sens, mode, origine_type, origine_id, user_id, designation)
  values (v_numero, p_sens, coalesce(p_mode, 'tous'), p_origine_type, p_origine_id,
          coalesce(p_user_id, v_moi), p_designation)
  returning id into v_id;

  insert into app_e08c374bc4_dossier_pieces (dossier_id, code_document)
  select v_id, d.code from app_e08c374bc4_documents_procedure d
  where d.actif
    and (d.sens = 'les_deux' or d.sens = p_sens)
    and (d.mode = 'tous' or d.mode = coalesce(p_mode, 'tous') or coalesce(p_mode, 'tous') = 'tous')
    and (
      d.obligation = 'obligatoire'
      or (d.code = 'RFCV'                 and 'fob_1m'              = any(p_conditions))
      or (d.code = 'AD_VALEUR'            and 'fob_1m'          <> all(p_conditions) and p_sens = 'import')
      or (d.code = 'CERTIFICAT_ORIGINE'   and 'preferentiel'        = any(p_conditions))
      or (d.code = 'BURIDA'               and 'supports_son_image'  = any(p_conditions))
      or (d.code = 'CERTIFICAT_PHYTO'     and 'vegetaux'            = any(p_conditions))
      or (d.code = 'CERTIFICAT_SANITAIRE' and 'denrees'             = any(p_conditions))
      or (d.code = 'AGREMENT_FILIERE'     and 'filiere_reglementee' = any(p_conditions))
    );
  get diagnostics v_pieces = row_count;
  return jsonb_build_object('id', v_id, 'numero', v_numero, 'deja_ouvert', false, 'pieces_attendues', v_pieces);
end; $$;

-- ------------------------------------------------------------------
-- 2. Le droit d'exécution, retiré à qui n'en a pas besoin
--
-- Postgres accorde EXECUTE à PUBLIC sur toute fonction créée. On reprend ce
-- droit, puis on ne le rend qu'aux rôles qui doivent réellement appeler.
-- ------------------------------------------------------------------

revoke all on function app_e08c374bc4_tableau_dossiers()            from public, anon;
revoke all on function app_e08c374bc4_etat_dossier(uuid)            from public, anon;
revoke all on function app_e08c374bc4_ouvrir_dossier(text, text, text, uuid, uuid, text, text[]) from public, anon;
revoke all on function app_e08c374bc4_clore_dossier(uuid)           from public, anon;
revoke all on function app_e08c374bc4_archiver_dossier(uuid)        from public, anon;

-- La numérotation n'est appelée que par « ouvrir_dossier », qui s'exécute avec
-- les droits du propriétaire : personne d'autre n'a de raison d'y toucher.
revoke all on function app_e08c374bc4_numero_dossier(text) from public, anon, authenticated;

grant execute on function app_e08c374bc4_tableau_dossiers()      to authenticated;
grant execute on function app_e08c374bc4_etat_dossier(uuid)      to authenticated;
grant execute on function app_e08c374bc4_ouvrir_dossier(text, text, text, uuid, uuid, text, text[]) to authenticated;
grant execute on function app_e08c374bc4_clore_dossier(uuid)     to authenticated;
grant execute on function app_e08c374bc4_archiver_dossier(uuid)  to authenticated;
