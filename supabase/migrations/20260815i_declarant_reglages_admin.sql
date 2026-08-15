-- ---------------------------------------------------------------------------
-- Le Déclarant, côté maison : réglages et lecture d'ensemble.
--
-- Directive du fondateur : « il faut améliorer les paramètres, c'est un service
-- à part entière, un produit à valoriser ».
--
-- Un produit se règle. Aujourd'hui les trois formules sont à zéro franc, et je
-- n'ai pas à inventer leur prix : ce qu'il faut, c'est l'endroit où le
-- fondateur le pose lui-même, et l'endroit où il voit ce que le service
-- consomme et rapporte.
--
-- Ce fichier ajoute trois choses, et resserre deux boulons trouvés en passant.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Une politique de lecture disait « tout », l'autre disait « ce qui est
--    actif ». C'est la première qui gagnait.
--
-- Les politiques permissives s'additionnent : « using (true) » posée lors du
-- premier jet du service annulait purement et simplement le filtre « actif »
-- ajouté hier. Une formule retirée de la vente — parce qu'on refait son prix,
-- parce qu'on l'arrête — restait donc visible de tous.
--
-- Ce n'est pas une fuite de données personnelles ; c'est une fuite
-- commerciale, et elle se voit sur la page publique des tarifs. On garde une
-- seule règle de lecture, et elle dit « actif ».
-- ---------------------------------------------------------------------------
drop policy if exists "Formules IA lisibles"                on app_e08c374bc4_formules_ia;
drop policy if exists "Formules IA modifiables par l'admin" on app_e08c374bc4_formules_ia;
-- Restent « Formules lisibles » (using actif) et « Formules admin ».


-- ---------------------------------------------------------------------------
-- 2. Des droits de table que rien ne justifie.
--
-- Vérifié avant de toucher quoi que ce soit, avec deux comptes réels : un
-- client qui tente de s'offrir la formule Cabinet reçoit 403, un anonyme 401.
-- RLS tient. Ce sont donc des droits LATENTS — inutiles aujourd'hui, et prêts
-- à devenir la porte le jour où quelqu'un ajoute une politique par commodité.
--
-- Même raisonnement que pour `cj_jeton` et `compteurs_facture` hier : on les
-- retire maintenant, pas ce jour-là. Deux barrières valent mieux qu'une.
--
-- Ce qui reste ouvert, et pourquoi :
--   formules_ia        lecture pour tous — c'est la vitrine tarifaire
--   abonnements_ia     lecture au connecté — il lit le sien, RLS s'en charge
--   usage_ia           lecture au connecté — RLS ne rend que l'admin
--   classifications_hs lecture et suppression au connecté — les siennes
--   liquidations       lecture et écriture au connecté — les siennes
-- ---------------------------------------------------------------------------
revoke all    on app_e08c374bc4_formules_ia        from anon, authenticated;
grant  select on app_e08c374bc4_formules_ia        to   anon, authenticated;

revoke all    on app_e08c374bc4_abonnements_ia     from anon, authenticated;
grant  select on app_e08c374bc4_abonnements_ia     to   authenticated;

revoke all    on app_e08c374bc4_usage_ia           from anon, authenticated;
grant  select on app_e08c374bc4_usage_ia           to   authenticated;

revoke all    on app_e08c374bc4_classifications_hs from anon, authenticated;
grant  select, delete on app_e08c374bc4_classifications_hs to authenticated;

revoke all    on app_e08c374bc4_liquidations       from anon, authenticated;
grant  select, insert on app_e08c374bc4_liquidations to authenticated;


-- ---------------------------------------------------------------------------
-- 3. Régler une formule.
--
-- Passer par une fonction plutôt que par un UPDATE direct, pour une raison
-- précise : le CODE d'une formule est porté par les abonnements existants.
-- Le laisser modifiable depuis un écran, c'est offrir de débrancher d'un clic
-- tous les abonnés d'un palier. La fonction ne touche donc jamais au code.
--
-- Un prix négatif ou un plafond négatif sont refusés ici, et pas seulement
-- dans le formulaire : un écran se contourne.
-- ---------------------------------------------------------------------------
create or replace function app_e08c374bc4_regler_formule_ia(
  p_code text,
  p_prix_mensuel_fcfa numeric,
  p_requetes_par_jour integer,
  p_libelle text default null,
  p_avantages text[] default null,
  p_actif boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_f app_e08c374bc4_formules_ia;
begin
  if not app_e08c374bc4_is_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;
  if p_prix_mensuel_fcfa is null or p_prix_mensuel_fcfa < 0 then
    raise exception 'Le prix mensuel ne peut pas être négatif.' using errcode = '22023';
  end if;
  if p_requetes_par_jour is null or p_requetes_par_jour < 0 then
    raise exception 'Le plafond quotidien ne peut pas être négatif.' using errcode = '22023';
  end if;

  update app_e08c374bc4_formules_ia set
    prix_mensuel_fcfa = p_prix_mensuel_fcfa,
    requetes_par_jour = p_requetes_par_jour,
    libelle           = coalesce(nullif(btrim(coalesce(p_libelle,'')),''), libelle),
    avantages         = coalesce(p_avantages, avantages),
    actif             = coalesce(p_actif, actif)
  where code = p_code
  returning * into v_f;

  if v_f.code is null then
    raise exception 'Formule inconnue : %', p_code using errcode = 'P0002';
  end if;
  return to_jsonb(v_f);
end; $$;
revoke all on function app_e08c374bc4_regler_formule_ia(text, numeric, integer, text, text[], boolean)
  from public, anon;
grant execute on function app_e08c374bc4_regler_formule_ia(text, numeric, integer, text, text[], boolean)
  to authenticated;


-- ---------------------------------------------------------------------------
-- 4. Accorder — ou retirer — un abonnement.
--
-- Il n'y a pas encore de paiement en ligne pour ce service : la souscription
-- se fait de la main à la main, et quelqu'un doit pouvoir l'inscrire. Le
-- retrait passe par la même porte, parce qu'un droit qu'on ne sait pas
-- reprendre n'est pas un droit, c'est un cadeau.
--
-- `p_jusquau` à NULL vaut « sans terme ». C'est déjà ce que lit le tableau de
-- bord : « actif_jusquau is null or actif_jusquau >= current_date ».
--
-- `p_note` sert à écrire COMMENT l'abonnement a été payé — « virement du
-- 12/09 », « espèces, reçu n° 41 ». Sans cette ligne, un abonnement accordé à
-- la main est un droit sans justification, et personne ne saura dans six mois
-- pourquoi ce compte a la formule Cabinet.
--
-- La table n'a pas de colonne `id` : sa clé est l'utilisateur. On rend donc la
-- ligne écrite, pas un identifiant qui n'existe pas.
-- ---------------------------------------------------------------------------
create or replace function app_e08c374bc4_accorder_abonnement_ia(
  p_utilisateur uuid, p_formule text, p_jusquau date default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ligne app_e08c374bc4_abonnements_ia;
begin
  if not app_e08c374bc4_is_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;
  if not exists (select 1 from app_e08c374bc4_formules_ia where code = p_formule) then
    raise exception 'Formule inconnue : %', p_formule using errcode = 'P0002';
  end if;
  if not exists (select 1 from auth.users where id = p_utilisateur) then
    raise exception 'Compte inconnu.' using errcode = 'P0002';
  end if;

  delete from app_e08c374bc4_abonnements_ia where utilisateur_id = p_utilisateur;
  insert into app_e08c374bc4_abonnements_ia (utilisateur_id, formule, actif_jusquau, note)
  values (p_utilisateur, p_formule, p_jusquau, nullif(btrim(coalesce(p_note,'')),''))
  returning * into v_ligne;

  return to_jsonb(v_ligne);
end; $$;
revoke all on function app_e08c374bc4_accorder_abonnement_ia(uuid, text, date, text) from public, anon;
grant execute on function app_e08c374bc4_accorder_abonnement_ia(uuid, text, date, text) to authenticated;

-- L'ancienne signature à trois arguments, écrite avant qu'on regarde la table.
drop function if exists app_e08c374bc4_accorder_abonnement_ia(uuid, text, date);

create or replace function app_e08c374bc4_retirer_abonnement_ia(p_utilisateur uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not app_e08c374bc4_is_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;
  delete from app_e08c374bc4_abonnements_ia where utilisateur_id = p_utilisateur;
  get diagnostics v_n = row_count;
  return jsonb_build_object('retires', v_n);
end; $$;
revoke all on function app_e08c374bc4_retirer_abonnement_ia(uuid) from public, anon;
grant execute on function app_e08c374bc4_retirer_abonnement_ia(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 5. La lecture d'ensemble du service.
--
-- Ce qu'un patron veut savoir d'un produit : combien de gens s'en servent, à
-- quel rythme, qui sont les plus gros usagers, et ce que ça produit. Une seule
-- lecture pour tout l'écran, comme pour le tableau de bord de l'abonné.
--
-- Les usagers sont nommés par leur profil quand il existe. Pas d'adresse
-- e-mail ici : `profiles` n'en porte pas, et aller la chercher dans
-- `auth.users` ferait sortir une donnée d'identification d'un périmètre où
-- elle n'a rien à faire.
-- ---------------------------------------------------------------------------
create or replace function app_e08c374bc4_declarant_admin_apercu()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not app_e08c374bc4_is_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'formules', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', f.code, 'libelle', f.libelle,
               'prix_mensuel_fcfa', f.prix_mensuel_fcfa,
               'requetes_par_jour', f.requetes_par_jour,
               'avantages', to_jsonb(f.avantages),
               'actif', f.actif, 'ordre', f.ordre,
               'abonnes', (select count(*) from app_e08c374bc4_abonnements_ia a
                           where a.formule = f.code
                             and (a.actif_jusquau is null or a.actif_jusquau >= current_date)),
               'recette_mensuelle_fcfa', f.prix_mensuel_fcfa *
                 (select count(*) from app_e08c374bc4_abonnements_ia a
                  where a.formule = f.code
                    and (a.actif_jusquau is null or a.actif_jusquau >= current_date)))
             order by f.ordre)
      from app_e08c374bc4_formules_ia f), '[]'::jsonb),

    'activite', jsonb_build_object(
      'requetes_aujourdhui', (select count(*) from app_e08c374bc4_usage_ia where cree_le::date = current_date),
      'requetes_30j',        (select count(*) from app_e08c374bc4_usage_ia where cree_le >= current_date - 29),
      'classifications',     (select count(*) from app_e08c374bc4_classifications_hs),
      'liquidations',        (select count(*) from app_e08c374bc4_liquidations),
      'droits_calcules_fcfa',(select coalesce(sum(total_a_payer_fcfa),0) from app_e08c374bc4_liquidations),
      'comptes_actifs_30j',  (select count(distinct utilisateur_id) from app_e08c374bc4_usage_ia
                              where cree_le >= current_date - 29)),

    'consommation_30j', coalesce((
      select jsonb_agg(jsonb_build_object('jour', j, 'n', n) order by j)
      from (select cree_le::date j, count(*) n from app_e08c374bc4_usage_ia
            where cree_le >= current_date - 29 group by 1) t), '[]'::jsonb),

    -- Les plus gros usagers : c'est là que se trouvent les abonnements à
    -- vendre, et les abus éventuels.
    'plus_actifs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'utilisateur_id', u.utilisateur_id,
               'nom', coalesce(p.nom_complet, p.nom_entreprise, 'Compte sans nom'),
               'type_compte', p.type_compte,
               'requetes_30j', u.n,
               'formule', coalesce(a.formule, 'decouverte'))
             order by u.n desc)
      from (select utilisateur_id, count(*) n from app_e08c374bc4_usage_ia
            where cree_le >= current_date - 29 group by 1 order by 2 desc limit 10) u
      left join app_e08c374bc4_profiles p on p.user_id = u.utilisateur_id
      left join app_e08c374bc4_abonnements_ia a on a.utilisateur_id = u.utilisateur_id
           and (a.actif_jusquau is null or a.actif_jusquau >= current_date)), '[]'::jsonb),

    'abonnes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'utilisateur_id', a.utilisateur_id,
               'nom', coalesce(p.nom_complet, p.nom_entreprise, 'Compte sans nom'),
               'formule', a.formule,
               'actif_jusquau', a.actif_jusquau)
             order by a.formule)
      from app_e08c374bc4_abonnements_ia a
      left join app_e08c374bc4_profiles p on p.user_id = a.utilisateur_id), '[]'::jsonb)
  );
end; $$;
revoke all on function app_e08c374bc4_declarant_admin_apercu() from public, anon;
grant execute on function app_e08c374bc4_declarant_admin_apercu() to authenticated;
