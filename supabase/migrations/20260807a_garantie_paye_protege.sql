-- Garantie « payé, protégé » : l'argent du vendeur attend la livraison.
--
-- En Côte d'Ivoire, le paiement à la livraison n'est pas un service : c'est le
-- prix que le commerce paie pour son manque de confiance. Il coûte cher en
-- retours et en colis perdus, et il plafonne le panier — personne ne fait
-- livrer contre remboursement un lot à 800 000 FCFA.
--
-- La réponse n'est pas de rassurer par la parole, c'est de retenir l'argent :
-- ce qui revient à une entreprise vendeuse de la place de marché n'est reversé
-- qu'une fois la réception acquise. Le client n'a plus besoin de payer à la
-- livraison pour être tranquille, puisque son argent est déjà tenu pour lui.
--
-- Dans les faits Maylary payait déjà après livraison, par campagnes de
-- reversement manuelles. Mais rien ne l'imposait : une saisie distraite
-- suffisait à payer un vendeur pour une commande jamais reçue, et rien n'était
-- promis au client. Ce fichier fait de cette pratique une règle que la base
-- applique elle-même.
--
-- La réception est acquise de deux façons :
--   * le client confirme lui-même ;
--   * ou le délai de contestation s'écoule sans qu'il se manifeste.
--
-- Le second cas n'est pas un détail : sans lui, un client silencieux gèlerait
-- l'argent d'un vendeur indéfiniment, et aucune entreprise sérieuse
-- n'accepterait de vendre ici. Le délai est réglable sans redéploiement.

-- ---------------------------------------------------------------------------
-- Le délai de contestation
-- ---------------------------------------------------------------------------
create table if not exists app_e08c374bc4_parametres_garantie (
  -- Table à ligne unique : la contrainte porte la règle plutôt qu'un
  -- commentaire qu'on oublie de lire.
  ligne_unique              boolean primary key default true check (ligne_unique),
  delai_confirmation_jours  integer not null default 7 check (delai_confirmation_jours > 0),
  updated_at                timestamptz not null default now()
);

insert into app_e08c374bc4_parametres_garantie (ligne_unique) values (true)
on conflict (ligne_unique) do nothing;

alter table app_e08c374bc4_parametres_garantie enable row level security;

-- Le client doit pouvoir lire le délai : on le lui affiche, c'est la moitié de
-- l'engagement. Seule l'administration le modifie.
drop policy if exists parametres_garantie_lecture on app_e08c374bc4_parametres_garantie;
create policy parametres_garantie_lecture on app_e08c374bc4_parametres_garantie
  for select to authenticated using (true);

drop policy if exists parametres_garantie_ecriture on app_e08c374bc4_parametres_garantie;
create policy parametres_garantie_ecriture on app_e08c374bc4_parametres_garantie
  for all to authenticated
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

create or replace function app_e08c374bc4_delai_confirmation()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select delai_confirmation_jours from app_e08c374bc4_parametres_garantie limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Quand la commande a été livrée, et quand la réception a été acquise
-- ---------------------------------------------------------------------------
alter table app_e08c374bc4_commandes_gp
  add column if not exists livree_le               timestamptz,
  add column if not exists reception_confirmee_le  timestamptz,
  add column if not exists reception_confirmee_par text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'app_e08c374bc4_reception_confirmee_par_check'
  ) then
    alter table app_e08c374bc4_commandes_gp
      add constraint app_e08c374bc4_reception_confirmee_par_check
      check (reception_confirmee_par is null
             or reception_confirmee_par in ('client', 'delai', 'administration'));
  end if;
end $$;

-- La date de livraison sert de point de départ au délai. On l'inscrit au
-- moment où le statut bascule, plutôt que de la relire dans l'historique à
-- chaque calcul : le montant dû à un vendeur se consulte souvent.
create or replace function app_e08c374bc4_horodater_livraison()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.statut = 'livree' and coalesce(old.statut, '') <> 'livree' and new.livree_le is null then
    new.livree_le := now();
  end if;
  return new;
end;
$$;

drop trigger if exists app_e08c374bc4_horodater_livraison on app_e08c374bc4_commandes_gp;
create trigger app_e08c374bc4_horodater_livraison
  before update on app_e08c374bc4_commandes_gp
  for each row execute function app_e08c374bc4_horodater_livraison();

-- Reprise de l'existant : les commandes déjà livrées tirent leur date de
-- l'historique des statuts, qui l'a conservée.
update app_e08c374bc4_commandes_gp c
set livree_le = coalesce(
  (select min(h.horodatage) from app_e08c374bc4_historique_statut_commande_gp h
    where h.commande_id = c.id and h.statut = 'livree'),
  c.updated_at)
where c.statut = 'livree' and c.livree_le is null;

-- ---------------------------------------------------------------------------
-- La confirmation par le client
-- ---------------------------------------------------------------------------
-- Passe par une fonction plutôt que par une politique d'écriture : autoriser le
-- client à modifier sa commande pour un seul champ l'autoriserait à en modifier
-- d'autres au même moment. Ici il ne peut faire qu'une chose, et seulement sur
-- sa propre commande livrée.
create or replace function app_e08c374bc4_confirmer_reception(p_commande uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commande app_e08c374bc4_commandes_gp;
begin
  select * into v_commande from app_e08c374bc4_commandes_gp where id = p_commande;

  if v_commande.id is null then
    raise exception 'Commande introuvable.' using errcode = 'no_data_found';
  end if;

  if v_commande.user_id <> auth.uid() then
    raise exception 'Cette commande n''est pas la vôtre.' using errcode = '42501';
  end if;

  if v_commande.statut <> 'livree' then
    raise exception 'La commande n''est pas encore marquée livrée.' using errcode = '22023';
  end if;

  -- Confirmer deux fois n'ajoute rien et ne doit pas repousser la date.
  if v_commande.reception_confirmee_le is not null then
    return v_commande.reception_confirmee_le;
  end if;

  update app_e08c374bc4_commandes_gp
  set reception_confirmee_le = now(), reception_confirmee_par = 'client'
  where id = p_commande;

  return now();
end;
$$;

revoke execute on function app_e08c374bc4_confirmer_reception(uuid) from public, anon;
grant execute on function app_e08c374bc4_confirmer_reception(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Ce qui est dû à chaque vendeur, et ce qui est encore retenu
-- ---------------------------------------------------------------------------
-- Vue en « security definer » assumée : un vendeur n'a pas le droit de lire les
-- commandes, et ne pourrait donc pas calculer lui-même ce qu'on lui doit. Le
-- filtre de la clause `where` est ici la seule protection — il ne doit jamais
-- être retiré.
create or replace view app_e08c374bc4_reversements_dus as
with lignes as (
  select
    l.vendeur_id,
    coalesce(l.net_vendeur_fcfa, 0) as net,
    c.statut,
    c.reception_confirmee_le,
    c.livree_le
  from app_e08c374bc4_lignes_commande_gp l
  join app_e08c374bc4_commandes_gp c on c.id = l.commande_id
  where l.vendeur_id is not null
),
cumul as (
  select
    vendeur_id,
    -- Réception acquise : le client a confirmé, ou le délai a couru.
    sum(net) filter (
      where statut = 'livree'
        and (reception_confirmee_le is not null
             or livree_le < now() - make_interval(days => app_e08c374bc4_delai_confirmation()))
    ) as libere_fcfa,
    -- Livré, mais le client peut encore contester.
    sum(net) filter (
      where statut = 'livree'
        and reception_confirmee_le is null
        and livree_le >= now() - make_interval(days => app_e08c374bc4_delai_confirmation())
    ) as retenu_fcfa,
    -- Payé par le client, pas encore arrivé chez lui.
    sum(net) filter (
      where statut in ('paiement_confirme', 'en_preparation', 'expediee')
    ) as en_cours_fcfa
  from lignes
  group by vendeur_id
),
regle as (
  -- Une ligne annulée ne compte pas ; une ligne « à payer » compte, sinon deux
  -- campagnes de reversement lancées le même jour paieraient deux fois.
  select vendeur_id, sum(montant_fcfa) as deja_reverse_fcfa
  from app_e08c374bc4_reversements
  where statut in ('a_payer', 'paye')
  group by vendeur_id
)
select
  v.id                                             as vendeur_id,
  v.nom_entreprise,
  coalesce(cumul.libere_fcfa, 0)                   as libere_fcfa,
  coalesce(cumul.retenu_fcfa, 0)                   as retenu_fcfa,
  coalesce(cumul.en_cours_fcfa, 0)                 as en_cours_fcfa,
  coalesce(regle.deja_reverse_fcfa, 0)             as deja_reverse_fcfa,
  coalesce(cumul.libere_fcfa, 0)
    - coalesce(regle.deja_reverse_fcfa, 0)         as disponible_fcfa
from app_e08c374bc4_vendeurs v
left join cumul on cumul.vendeur_id = v.id
left join regle on regle.vendeur_id = v.id
where app_e08c374bc4_is_admin() or v.id = app_e08c374bc4_mon_vendeur_id();

revoke all on app_e08c374bc4_reversements_dus from public, anon;
grant select on app_e08c374bc4_reversements_dus to authenticated;

-- ---------------------------------------------------------------------------
-- Le verrou
-- ---------------------------------------------------------------------------
-- Sans lui, tout ce qui précède ne serait qu'un tableau de bord : rien
-- n'empêcherait de saisir un reversement pour une commande jamais reçue. La
-- règle vit ici, dans la base, et non dans l'écran qui la saisit.
create or replace function app_e08c374bc4_reversement_apres_reception()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_libere numeric;
  v_engage numeric;
  v_retenu numeric;
begin
  -- Annuler un reversement libère au contraire du montant : rien à vérifier.
  if new.statut = 'annule' then
    return new;
  end if;

  select
    coalesce(sum(coalesce(l.net_vendeur_fcfa, 0)) filter (
      where c.statut = 'livree'
        and (c.reception_confirmee_le is not null
             or c.livree_le < now() - make_interval(days => app_e08c374bc4_delai_confirmation()))
    ), 0),
    coalesce(sum(coalesce(l.net_vendeur_fcfa, 0)) filter (
      where c.statut = 'livree'
        and c.reception_confirmee_le is null
        and c.livree_le >= now() - make_interval(days => app_e08c374bc4_delai_confirmation())
    ), 0)
  into v_libere, v_retenu
  from app_e08c374bc4_lignes_commande_gp l
  join app_e08c374bc4_commandes_gp c on c.id = l.commande_id
  where l.vendeur_id = new.vendeur_id;

  select coalesce(sum(montant_fcfa), 0) into v_engage
  from app_e08c374bc4_reversements
  where vendeur_id = new.vendeur_id
    and statut in ('a_payer', 'paye')
    and id <> new.id;

  if v_engage + new.montant_fcfa > v_libere then
    raise exception
      'Reversement refusé : % FCFA disponibles pour ce vendeur (% FCFA déjà engagés, % FCFA encore retenus en attente de réception).',
      round(v_libere - v_engage), round(v_engage), round(v_retenu)
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists app_e08c374bc4_reversement_apres_reception on app_e08c374bc4_reversements;
create trigger app_e08c374bc4_reversement_apres_reception
  before insert or update on app_e08c374bc4_reversements
  for each row execute function app_e08c374bc4_reversement_apres_reception();
