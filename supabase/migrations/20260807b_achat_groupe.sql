-- Achat groupé : diviser la part fixe du fret entre plusieurs acheteurs.
--
-- Importer coûte cher à l'unité non pas à cause de la marchandise, mais à cause
-- de ce qui ne dépend pas de la quantité : frais de police d'assurance,
-- minimum de taxation, forfait de dédouanement, part fixe du fret. Un acheteur
-- seul les paie en entier. Cinq acheteurs sur la même référence les divisent
-- par cinq. C'est de l'arithmétique, et c'est le levier que les particuliers
-- ivoiriens n'ont jamais eu — le groupage existe, mais entre transitaires et
-- grossistes, jamais ouvert au client final.
--
-- ---------------------------------------------------------------------------
-- La règle du fondateur commande la forme
-- ---------------------------------------------------------------------------
-- « On ne change jamais un prix après que le client a payé. » Cela interdit le
-- montage habituel de l'achat groupé — payer maintenant, être remboursé d'une
-- partie si assez de monde rejoint. Deux raisons, et la seconde est décisive :
--
--   * le prix bougerait après le paiement ;
--   * le remboursement se ferait à la main sur Wave, une opération par client,
--     sans garantie de retour.
--
-- D'où le montage retenu : **on réserve sans payer.** Maylary publie un prix
-- ferme et un seuil. Le client réserve une quantité à ce prix-là. Si le seuil
-- est atteint avant l'échéance, la campagne réussit et chaque réservation
-- devient une commande à régler — au prix annoncé, exactement. Sinon la
-- campagne échoue : personne n'a payé, personne n'est débité, rien à
-- rembourser.
--
-- Le prix publié est un prix rendu, tout compris. C'est la promesse même de
-- l'achat groupé : ce que vous voyez est ce que vous payez, livraison
-- comprise. Aucun supplément ne s'ajoute à l'étape suivante.

-- ---------------------------------------------------------------------------
-- Les campagnes
-- ---------------------------------------------------------------------------
-- Nommées « achats groupés » et non « campagnes de groupage » : ce dernier nom
-- désigne déjà, dans cette base, les expéditions consolidées côté transitaire
-- (`app_e08c374bc4_campagnes_groupage` : tarif au m³, capacité, mode de
-- transport). Deux notions voisines, deux tables distinctes — l'une est un
-- navire, l'autre est une offre faite aux clients.
create sequence if not exists app_e08c374bc4_achat_groupe_seq;

create table if not exists app_e08c374bc4_achats_groupes (
  id uuid primary key default gen_random_uuid(),
  reference_publique text not null unique
    default 'AG-' || to_char(now(), 'YYYY') || '-'
          || lpad(nextval('app_e08c374bc4_achat_groupe_seq')::text, 4, '0'),

  produit_id uuid not null references app_e08c374bc4_produits (id) on delete restrict,
  titre text,
  argumentaire text,

  -- Prix rendu, tout compris, ferme dès la publication.
  prix_unitaire_groupe_fcfa numeric not null check (prix_unitaire_groupe_fcfa > 0),
  -- Le prix catalogue au moment de l'ouverture. Figé, sinon l'économie
  -- annoncée changerait toute seule le jour d'une retarification, et une
  -- promesse qui bouge n'est plus une promesse.
  prix_unitaire_normal_fcfa numeric not null check (prix_unitaire_normal_fcfa > 0),

  -- Le seuil qui rend l'expédition viable.
  quantite_objectif integer not null check (quantite_objectif > 0),
  -- Plafond éventuel : un conteneur a une capacité.
  quantite_maximum integer check (quantite_maximum is null or quantite_maximum >= quantite_objectif),
  -- Ce qu'un même client peut réserver, pour qu'une campagne ne soit pas
  -- accaparée par un revendeur.
  quantite_max_par_client integer not null default 10 check (quantite_max_par_client > 0),

  cloture_prevue_le timestamptz not null,

  statut text not null default 'ouverte'
    check (statut in ('ouverte', 'reussie', 'echouee', 'annulee')),
  cloturee_le timestamptz,
  note_admin text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Une campagne qui n'économise rien n'a pas de raison d'exister, et
  -- l'afficher ferait douter de toutes les autres.
  constraint app_e08c374bc4_groupage_economie_reelle
    check (prix_unitaire_groupe_fcfa < prix_unitaire_normal_fcfa)
);

create index if not exists app_e08c374bc4_achats_groupes_statut_idx
  on app_e08c374bc4_achats_groupes (statut, cloture_prevue_le);

alter table app_e08c374bc4_achats_groupes enable row level security;

-- Une campagne se voit sans compte : c'est un argument d'entrée, pas une
-- fonction réservée aux clients déjà inscrits. Les campagnes annulées
-- disparaissent ; les échouées restent visibles, parce qu'un client qui a
-- réservé doit comprendre ce qui s'est passé.
drop policy if exists achats_groupes_lecture on app_e08c374bc4_achats_groupes;
create policy achats_groupes_lecture on app_e08c374bc4_achats_groupes
  for select to anon, authenticated
  using (statut <> 'annulee' or app_e08c374bc4_is_admin());

drop policy if exists achats_groupes_admin on app_e08c374bc4_achats_groupes;
create policy achats_groupes_admin on app_e08c374bc4_achats_groupes
  for all to authenticated
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

-- ---------------------------------------------------------------------------
-- Les réservations
-- ---------------------------------------------------------------------------
create table if not exists app_e08c374bc4_participations_achat_groupe (
  id uuid primary key default gen_random_uuid(),
  campagne_id uuid not null references app_e08c374bc4_achats_groupes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  quantite integer not null check (quantite > 0),

  -- Adresse recopiée à la réservation plutôt que relue à la conversion : le
  -- client doit voir où sa commande ira au moment où il s'engage, et un profil
  -- modifié entre-temps ne doit pas déplacer une livraison déjà décidée.
  nom_destinataire text not null,
  telephone_destinataire text not null,
  adresse_livraison text not null,
  ville_livraison text not null,

  statut text not null default 'reservee'
    check (statut in ('reservee', 'commandee', 'abandonnee')),
  commande_id uuid references app_e08c374bc4_commandes_gp (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Une réservation par client et par campagne : on modifie la quantité, on
  -- n'empile pas les lignes.
  constraint app_e08c374bc4_participation_unique unique (campagne_id, user_id)
);

create index if not exists app_e08c374bc4_participations_achat_groupe_idx
  on app_e08c374bc4_participations_achat_groupe (campagne_id);

alter table app_e08c374bc4_participations_achat_groupe enable row level security;

drop policy if exists participations_achat_groupe_client on app_e08c374bc4_participations_achat_groupe;
create policy participations_achat_groupe_client on app_e08c374bc4_participations_achat_groupe
  for select to authenticated
  using (user_id = auth.uid() or app_e08c374bc4_is_admin());

-- L'écriture passe par les fonctions ci-dessous : elles seules connaissent les
-- règles de plafond et d'échéance. Une politique d'insertion directe laisserait
-- réserver après la clôture.
drop policy if exists participations_achat_groupe_admin on app_e08c374bc4_participations_achat_groupe;
create policy participations_achat_groupe_admin on app_e08c374bc4_participations_achat_groupe
  for all to authenticated
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

-- ---------------------------------------------------------------------------
-- L'état d'une campagne, visible de tous
-- ---------------------------------------------------------------------------
-- Le compteur de réservations doit être public — c'est lui qui donne envie de
-- rejoindre — alors que les réservations elles-mêmes ne le sont pas. D'où une
-- vue en « security definer » qui n'expose que des agrégats et rien de nominatif.
create or replace view app_e08c374bc4_achats_groupes_publics as
select
  c.id,
  c.reference_publique,
  c.produit_id,
  coalesce(c.titre, p.nom)                             as titre,
  c.argumentaire,
  p.photos,
  c.prix_unitaire_groupe_fcfa,
  c.prix_unitaire_normal_fcfa,
  c.prix_unitaire_normal_fcfa - c.prix_unitaire_groupe_fcfa as economie_unitaire_fcfa,
  c.quantite_objectif,
  c.quantite_maximum,
  c.quantite_max_par_client,
  c.cloture_prevue_le,
  c.statut,
  c.cloturee_le,
  coalesce(r.quantite_reservee, 0)                     as quantite_reservee,
  coalesce(r.participants, 0)                          as participants,
  greatest(c.quantite_objectif - coalesce(r.quantite_reservee, 0), 0) as quantite_manquante
from app_e08c374bc4_achats_groupes c
join app_e08c374bc4_produits p on p.id = c.produit_id
left join (
  select campagne_id,
         sum(quantite)::integer as quantite_reservee,
         count(*)::integer      as participants
  from app_e08c374bc4_participations_achat_groupe
  where statut <> 'abandonnee'
  group by campagne_id
) r on r.campagne_id = c.id
where c.statut <> 'annulee';

revoke all on app_e08c374bc4_achats_groupes_publics from public;
grant select on app_e08c374bc4_achats_groupes_publics to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rejoindre une campagne
-- ---------------------------------------------------------------------------
create or replace function app_e08c374bc4_rejoindre_achat_groupe(
  p_campagne uuid,
  p_quantite integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campagne app_e08c374bc4_achats_groupes;
  v_profil   app_e08c374bc4_profiles;
  v_deja     integer;
  v_id       uuid;
begin
  if auth.uid() is null then
    raise exception 'Connectez-vous pour rejoindre un achat groupé.' using errcode = '42501';
  end if;

  if p_quantite is null or p_quantite < 1 then
    raise exception 'Indiquez une quantité d''au moins une unité.' using errcode = '22023';
  end if;

  select * into v_campagne from app_e08c374bc4_achats_groupes where id = p_campagne;
  if v_campagne.id is null then
    raise exception 'Cet achat groupé n''existe pas.' using errcode = 'no_data_found';
  end if;

  if v_campagne.statut <> 'ouverte' then
    raise exception 'Cet achat groupé est clôturé.' using errcode = '22023';
  end if;

  if v_campagne.cloture_prevue_le <= now() then
    raise exception 'La date limite de cet achat groupé est passée.' using errcode = '22023';
  end if;

  if p_quantite > v_campagne.quantite_max_par_client then
    raise exception 'Vous pouvez réserver au plus % unités sur cet achat groupé.',
      v_campagne.quantite_max_par_client using errcode = '22023';
  end if;

  -- Le plafond de la campagne se mesure hors réservation du demandeur : sinon
  -- réduire sa propre quantité pourrait être refusé faute de place.
  select coalesce(sum(quantite), 0) into v_deja
  from app_e08c374bc4_participations_achat_groupe
  where campagne_id = p_campagne and statut <> 'abandonnee' and user_id <> auth.uid();

  if v_campagne.quantite_maximum is not null
     and v_deja + p_quantite > v_campagne.quantite_maximum then
    raise exception 'Il ne reste que % unités sur cet achat groupé.',
      greatest(v_campagne.quantite_maximum - v_deja, 0) using errcode = '22023';
  end if;

  select * into v_profil from app_e08c374bc4_profiles where user_id = auth.uid();
  if v_profil.adresse_livraison_defaut is null or btrim(v_profil.adresse_livraison_defaut) = ''
     or v_profil.telephone is null or btrim(v_profil.telephone) = '' then
    raise exception
      'Complétez votre adresse de livraison et votre téléphone dans « Mon compte » avant de réserver.'
      using errcode = '22023';
  end if;

  insert into app_e08c374bc4_participations_achat_groupe (
    campagne_id, user_id, quantite,
    nom_destinataire, telephone_destinataire, adresse_livraison, ville_livraison)
  values (
    p_campagne, auth.uid(), p_quantite,
    coalesce(nullif(btrim(v_profil.nom_complet), ''), 'Client Maylary'),
    v_profil.telephone,
    v_profil.adresse_livraison_defaut,
    coalesce(nullif(btrim(v_profil.ville), ''), 'Abidjan'))
  on conflict (campagne_id, user_id) do update
    set quantite = excluded.quantite,
        statut = 'reservee',
        nom_destinataire = excluded.nom_destinataire,
        telephone_destinataire = excluded.telephone_destinataire,
        adresse_livraison = excluded.adresse_livraison,
        ville_livraison = excluded.ville_livraison,
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function app_e08c374bc4_rejoindre_achat_groupe(uuid, integer) from public, anon;
grant execute on function app_e08c374bc4_rejoindre_achat_groupe(uuid, integer) to authenticated;

create or replace function app_e08c374bc4_quitter_achat_groupe(p_campagne uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_statut text;
begin
  select statut into v_statut
  from app_e08c374bc4_participations_achat_groupe
  where campagne_id = p_campagne and user_id = auth.uid();

  if v_statut is null then
    return;
  end if;

  -- Une réservation devenue commande ne se retire plus ici : elle s'annule
  -- comme une commande, avec la trace que cela suppose.
  if v_statut = 'commandee' then
    raise exception
      'Cet achat groupé a réussi et votre commande est déjà créée : contactez-nous pour l''annuler.'
      using errcode = '22023';
  end if;

  delete from app_e08c374bc4_participations_achat_groupe
  where campagne_id = p_campagne and user_id = auth.uid();
end;
$$;

revoke execute on function app_e08c374bc4_quitter_achat_groupe(uuid) from public, anon;
grant execute on function app_e08c374bc4_quitter_achat_groupe(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Clôturer une campagne
-- ---------------------------------------------------------------------------
-- Réussite : chaque réservation devient une commande à régler, au prix annoncé.
-- On réutilise le circuit de paiement existant plutôt que d'en inventer un
-- second — le client retrouve le même écran, le même lien Wave, la même preuve
-- à déposer.
create or replace function app_e08c374bc4_cloturer_achat_groupe(
  p_campagne uuid,
  p_forcer_reussite boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campagne app_e08c374bc4_achats_groupes;
  v_reserve integer;
  v_part    record;
  v_commande uuid;
  v_creees  integer := 0;
begin
  if not app_e08c374bc4_is_admin() then
    raise exception 'Seule l''administration clôture un achat groupé.' using errcode = '42501';
  end if;

  select * into v_campagne from app_e08c374bc4_achats_groupes where id = p_campagne for update;
  if v_campagne.id is null then
    raise exception 'Achat groupé introuvable.' using errcode = 'no_data_found';
  end if;
  if v_campagne.statut <> 'ouverte' then
    raise exception 'Cet achat groupé est déjà clôturé (%).', v_campagne.statut using errcode = '22023';
  end if;

  select coalesce(sum(quantite), 0) into v_reserve
  from app_e08c374bc4_participations_achat_groupe
  where campagne_id = p_campagne and statut = 'reservee';

  -- Forcer permet d'honorer le prix alors que le seuil n'est pas atteint : la
  -- décision est commerciale, elle appartient au fondateur, mais elle reste
  -- explicite et tracée.
  if v_reserve < v_campagne.quantite_objectif and not p_forcer_reussite then
    update app_e08c374bc4_achats_groupes
    set statut = 'echouee', cloturee_le = now(), updated_at = now()
    where id = p_campagne;
    return format('Seuil non atteint (%s sur %s). Campagne close, aucune commande créée.',
                  v_reserve, v_campagne.quantite_objectif);
  end if;

  for v_part in
    select * from app_e08c374bc4_participations_achat_groupe
    where campagne_id = p_campagne and statut = 'reservee'
  loop
    insert into app_e08c374bc4_commandes_gp (
      user_id, statut, mode_paiement, montant_total_fcfa,
      nom_destinataire, telephone_destinataire, adresse_livraison, ville_livraison,
      notes_client)
    values (
      v_part.user_id, 'en_attente_paiement', 'mobile_money',
      v_part.quantite * v_campagne.prix_unitaire_groupe_fcfa,
      v_part.nom_destinataire, v_part.telephone_destinataire,
      v_part.adresse_livraison, v_part.ville_livraison,
      format('Achat groupé %s — prix rendu tout compris, livraison incluse.',
             v_campagne.reference_publique))
    returning id into v_commande;

    insert into app_e08c374bc4_lignes_commande_gp (
      commande_id, produit_id, nom_produit, quantite, prix_unitaire_fcfa, sous_total)
    select v_commande, v_campagne.produit_id, coalesce(v_campagne.titre, p.nom),
           v_part.quantite, v_campagne.prix_unitaire_groupe_fcfa,
           v_part.quantite * v_campagne.prix_unitaire_groupe_fcfa
    from app_e08c374bc4_produits p where p.id = v_campagne.produit_id;

    update app_e08c374bc4_participations_achat_groupe
    set statut = 'commandee', commande_id = v_commande, updated_at = now()
    where id = v_part.id;

    v_creees := v_creees + 1;
  end loop;

  update app_e08c374bc4_achats_groupes
  set statut = 'reussie', cloturee_le = now(), updated_at = now()
  where id = p_campagne;

  return format('Campagne réussie : %s unités réservées, %s commande(s) créée(s) à régler.',
                v_reserve, v_creees);
end;
$$;

revoke execute on function app_e08c374bc4_cloturer_achat_groupe(uuid, boolean) from public, anon;
grant execute on function app_e08c374bc4_cloturer_achat_groupe(uuid, boolean) to authenticated;
