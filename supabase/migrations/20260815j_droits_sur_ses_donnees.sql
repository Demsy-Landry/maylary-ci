-- ---------------------------------------------------------------------------
-- Vos données : les emporter, et fermer son compte.
--
-- La politique de confidentialité annonce le droit d'accès et le droit
-- d'effacement (loi n° 2013-450 du 19 juin 2013), et renvoie à une adresse
-- e-mail pour les exercer. Ce n'est pas faux, mais ça repose entièrement sur
-- quelqu'un qui répond sous trente jours, à la main, pour chaque demande.
-- Avant une première vente, autant que le système le fasse.
--
-- ---------------------------------------------------------------------------
-- POURQUOI LA FERMETURE N'EST PAS UNE SUPPRESSION PURE ET SIMPLE
--
-- Supprimer la ligne `auth.users` d'un client emporterait en cascade ses
-- commandes, ses factures et les écritures comptables qui s'y rattachent. Or
-- ces pièces doivent être conservées : une facture émise ne s'efface pas parce
-- que son destinataire ferme son compte, et l'obligation de conservation
-- comptable prime sur le droit à l'effacement pour ces pièces précises.
--
-- Le compromis, qui est celui du droit et pas un arrangement de confort :
--   - les données d'identification sont EFFACÉES du profil (nom, téléphone,
--     ville, adresse de livraison) ;
--   - les pièces comptables restent, rattachées à un identifiant devenu muet ;
--   - le compte ne peut plus servir.
--
-- Ce que ça donne : plus personne ne peut relier ces pièces à une personne
-- depuis l'application, et la comptabilité reste tenable.
--
-- La suppression complète de l'identifiant de connexion relève de
-- l'administration : elle exige de vérifier qu'aucune obligation en cours ne
-- s'y oppose. La demande est donc enregistrée, et le fondateur la voit.
-- ---------------------------------------------------------------------------


-- ------------------------------------------------------------------
-- Emporter ses données.
--
-- Une seule lecture qui rend TOUT ce que la maison détient sur celui qui
-- appelle. Elle ne rend que ce qui lui appartient — le contrôle est dans la
-- fonction, pas dans l'écran.
--
-- Les tables sont interrogées une par une plutôt que par une boucle sur le
-- catalogue : une boucle embarquerait automatiquement toute table ajoutée
-- demain, y compris une table interne qui n'a rien à faire dans un export
-- client. Ici, ce qui sort est ce qui a été décidé.
-- ------------------------------------------------------------------
create or replace function app_e08c374bc4_exporter_mes_donnees()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_moi uuid := auth.uid();
begin
  if v_moi is null then
    raise exception 'Connectez-vous pour exporter vos données.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'export', jsonb_build_object(
      'genere_le', now(),
      'a_propos', 'Export de vos données personnelles détenues par MayLary Group (Dems''Inc), '
                  || 'au titre de la loi n° 2013-450 du 19 juin 2013.'),

    'profil', (select to_jsonb(p) - 'id'
               from app_e08c374bc4_profiles p where p.user_id = v_moi),

    'compte', (select jsonb_build_object(
                 'email', u.email,
                 'inscrit_le', u.created_at,
                 'derniere_connexion', u.last_sign_in_at)
               from auth.users u where u.id = v_moi),

    'commandes', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at)
                           from app_e08c374bc4_commandes_gp c where c.user_id = v_moi), '[]'::jsonb),

    'demandes_import', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at)
                                 from app_e08c374bc4_demandes_import d where d.user_id = v_moi), '[]'::jsonb),

    'demandes_export', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at)
                                 from app_e08c374bc4_demandes_export d where d.user_id = v_moi), '[]'::jsonb),

    'classifications', coalesce((select jsonb_agg(to_jsonb(c) order by c.cree_le)
                                 from app_e08c374bc4_classifications_hs c
                                 where c.utilisateur_id = v_moi), '[]'::jsonb),

    'liquidations', coalesce((select jsonb_agg(to_jsonb(l) order by l.cree_le)
                              from app_e08c374bc4_liquidations l
                              where l.utilisateur_id = v_moi), '[]'::jsonb),

    'abonnement', (select to_jsonb(a) from app_e08c374bc4_abonnements_ia a
                   where a.utilisateur_id = v_moi)
  );
end; $$;
revoke all on function app_e08c374bc4_exporter_mes_donnees() from public, anon;
grant execute on function app_e08c374bc4_exporter_mes_donnees() to authenticated;


-- ------------------------------------------------------------------
-- Les demandes de fermeture, pour que le fondateur les voie.
-- ------------------------------------------------------------------
create table if not exists app_e08c374bc4_demandes_fermeture (
  utilisateur_id uuid primary key references auth.users(id) on delete cascade,
  motif          text,
  demandee_le    timestamptz not null default now(),
  traitee_le     timestamptz,
  note_interne   text
);
alter table app_e08c374bc4_demandes_fermeture enable row level security;

drop policy if exists "Fermeture lisible par son auteur" on app_e08c374bc4_demandes_fermeture;
create policy "Fermeture lisible par son auteur" on app_e08c374bc4_demandes_fermeture for select
  using (utilisateur_id = auth.uid() or app_e08c374bc4_is_admin());

drop policy if exists "Fermeture pilotée par l'admin" on app_e08c374bc4_demandes_fermeture;
create policy "Fermeture pilotée par l'admin" on app_e08c374bc4_demandes_fermeture for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

revoke all    on app_e08c374bc4_demandes_fermeture from anon, authenticated;
grant  select on app_e08c374bc4_demandes_fermeture to   authenticated;


-- ------------------------------------------------------------------
-- Fermer son compte.
--
-- L'effacement des données d'identification est IMMÉDIAT : c'est la partie du
-- droit qui n'attend pas. La suppression de l'identifiant de connexion est
-- enregistrée comme demande.
--
-- Un administrateur ne peut pas fermer son propre compte par cette porte : la
-- maison se retrouverait sans personne pour ouvrir la suivante.
-- ------------------------------------------------------------------
create or replace function app_e08c374bc4_fermer_mon_compte(p_motif text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_moi        uuid := auth.uid();
  v_type       text;
  v_commandes  integer;
begin
  if v_moi is null then
    raise exception 'Connectez-vous pour fermer votre compte.' using errcode = '42501';
  end if;

  select type_compte into v_type from app_e08c374bc4_profiles where user_id = v_moi;
  if v_type = 'admin' then
    raise exception 'Un compte d''administration ne se ferme pas depuis cet écran.'
      using errcode = '42501';
  end if;

  -- Les pièces conservées, comptées avant effacement : le client doit savoir
  -- ce qui reste, et pourquoi.
  select count(*) into v_commandes from app_e08c374bc4_commandes_gp where user_id = v_moi;

  -- L'effacement de ce qui identifie. Le profil survit, muet : il porte le
  -- rattachement des pièces comptables, plus une personne.
  update app_e08c374bc4_profiles set
    nom_complet              = 'Compte fermé',
    nom_entreprise           = null,
    telephone                = null,
    ville                    = null,
    adresse_livraison_defaut = null,
    secteur_activite_client  = null
  where user_id = v_moi;

  insert into app_e08c374bc4_demandes_fermeture (utilisateur_id, motif)
  values (v_moi, nullif(btrim(coalesce(p_motif, '')), ''))
  on conflict (utilisateur_id) do update set
    motif = excluded.motif, demandee_le = now(), traitee_le = null;

  return jsonb_build_object(
    'ferme', true,
    'donnees_effacees', jsonb_build_array(
      'nom', 'nom d''entreprise', 'téléphone', 'ville', 'adresse de livraison',
      'secteur d''activité'),
    'pieces_conservees', v_commandes,
    'pourquoi', 'Les commandes et les factures émises sont conservées au titre des '
                || 'obligations comptables. Elles ne sont plus rattachables à votre identité '
                || 'depuis l''application.');
end; $$;
revoke all on function app_e08c374bc4_fermer_mon_compte(text) from public, anon;
grant execute on function app_e08c374bc4_fermer_mon_compte(text) to authenticated;


-- ---------------------------------------------------------------------------
-- Une fonction repérée par l'analyseur en passant : `search_path` modifiable.
--
-- Une fonction SECURITY DEFINER dont le `search_path` n'est pas figé peut être
-- détournée en plaçant une table homonyme dans un schéma en tête de chemin.
-- Toutes les autres fonctions de l'application le figent déjà ; celle-ci était
-- passée au travers.
-- ---------------------------------------------------------------------------
alter function app_e08c374bc4_reserve_plafond_fret() set search_path = public;
