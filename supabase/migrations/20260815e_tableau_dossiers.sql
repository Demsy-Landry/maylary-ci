-- ---------------------------------------------------------------------------
-- La documentation vue depuis la tour de contrôle.
--
-- Le tableau de bord savait dire où sont les marchandises et combien d'argent
-- flotte. Il ne savait pas dire ce qui BLOQUE — or un dossier ne se perd
-- presque jamais sur un prix, il se perd sur une pièce absente pendant que le
-- magasinage court.
--
-- Trois lectures, dans l'ordre où elles servent :
--
--   1. le décompte par étape, pour voir la forme du flux ;
--   2. les dossiers qui ont une pièce obligatoire manquante, les plus vieux
--      d'abord — c'est la liste d'appels du matin ;
--   3. LA PIÈCE QUI MANQUE LE PLUS SOUVENT, tous dossiers confondus. C'est la
--      seule des trois qui parle du PROCESSUS et non des dossiers : si le BSC
--      manque sur huit dossiers sur dix, ce n'est pas huit oublis, c'est une
--      étape qui n'est pas dans les habitudes de la maison.
-- ---------------------------------------------------------------------------
create or replace function app_e08c374bc4_tableau_dossiers()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(

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

    -- Un dossier immobile coûte en magasinage et en surestaries : cinq jours
    -- sans mouvement méritent qu'on le regarde.
    'dormants', (
      select count(*) from app_e08c374bc4_dossiers
      where statut not in ('clos','archive') and updated_at < now() - interval '5 days')
  );
$$;

comment on function app_e08c374bc4_tableau_dossiers is
  'Lecture des dossiers pour le tableau de bord : forme du flux, dossiers '
  'bloqués par une pièce absente, et la pièce qui manque le plus souvent — '
  'celle-là parle du processus, pas des dossiers.';
