-- L'ouverture de l'expédition : ce qui manquait entre le paiement et le suivi.
--
-- CE QUI EXISTAIT DÉJÀ, ET CE QUI MANQUAIT
--
-- La table des expéditions sait SUIVRE un colis : dès qu'un numéro de suivi est
-- renseigné, le connecteur interroge le transporteur tout seul et remplit la
-- frise du client. Mais l'expédition, elle, se créait à la main dans l'écran
-- d'administration. Entre « le client a payé » et « voici le numéro de suivi »,
-- il n'y avait que du travail humain : rassembler les références, écrire au
-- transporteur, recopier ce qu'il répond.
--
-- C'est cette charge-là que le fondateur veut lever. Elle se décompose en deux
-- moitiés très inégales.
--
-- LES DEUX MOITIÉS DE LA CHARGE
--
-- La petite moitié, c'est le geste de réservation : appeler l'API du
-- transporteur. Elle n'est automatisable que là où une API existe — chez DHL
-- Express oui, chez un consolidateur chinois non, et il ne faut pas l'attendre :
-- ce sont des PME qui travaillent sur WeChat.
--
-- La grande moitié, c'est le rapprochement : savoir quel carton appartient à
-- quelle commande, refaire la liste de colisage, recopier les références. Elle
-- s'automatise SANS aucune API, et c'est elle qui coûte du temps tous les jours.
--
-- D'où la forme de cette migration : elle ne suppose l'existence d'aucune API.
-- Elle pose l'état d'une réservation, et la marque d'expédition qui permet le
-- rapprochement même chez un transporteur qui n'a rien d'informatique.
--
-- LA MARQUE D'EXPÉDITION N'EST PAS UN NUMÉRO DE PLUS
--
-- Dans le métier, un « shipping mark » est ce qu'on peint sur le carton. Le
-- consolidateur donne une adresse d'entrepôt et un code client ; tout colis qui
-- arrive portant cette marque est attribué sans qu'on ait à écrire à personne.
-- C'est le rapprochement automatique du monde physique, et il fonctionne depuis
-- un siècle sans réseau.
--
-- Elle est unique par expédition et immuable une fois posée : une marque qui
-- change après que le fournisseur a peint ses cartons ne rapproche plus rien.

alter table public.app_e08c374bc4_expeditions
  -- Ce qu'on peint sur le carton, et qui le relie à cette expédition-ci.
  add column if not exists marque_expedition text,

  -- L'état de la réservation chez le transporteur, distinct du statut du
  -- voyage : une expédition peut être « à expédier » depuis trois jours parce
  -- que la réservation a ÉCHOUÉ, et rien ne le disait.
  add column if not exists reservation_statut text not null default 'non_ouverte',

  -- La référence que rend le transporteur : numéro de connaissement chez un
  -- consolidateur, numéro d'envoi chez DHL. Le suivi démarre sur elle.
  add column if not exists reservation_reference text,
  add column if not exists reservation_le timestamptz,

  -- Pourquoi ça a échoué, en clair. Une réservation qui échoue en silence est
  -- pire qu'une réservation jamais tentée : personne ne va la chercher.
  add column if not exists reservation_erreur text,

  -- Le transporteur chez qui on ouvre. Distinct de `transporteur_code`, qui
  -- désigne le transporteur chez l'AGRÉGATEUR de suivi : le consolidateur qui
  -- réserve et la compagnie qui achemine ne sont pas le même acteur.
  add column if not exists connecteur text,

  -- L'étiquette rendue par le transporteur, quand il en rend une.
  add column if not exists etiquette_chemin text,

  -- Les mesures nécessaires pour réserver. Sans elles, aucun transporteur ne
  -- cote : les demander au moment de l'ouverture, c'est déjà trop tard.
  add column if not exists nombre_colis integer,
  add column if not exists poids_brut_kg numeric,
  add column if not exists volume_m3 numeric;

alter table public.app_e08c374bc4_expeditions
  drop constraint if exists app_e08c374bc4_expeditions_reservation_statut_check;

alter table public.app_e08c374bc4_expeditions
  add constraint app_e08c374bc4_expeditions_reservation_statut_check
  check (reservation_statut in ('non_ouverte', 'a_ouvrir', 'ouverte', 'echec'));

comment on column public.app_e08c374bc4_expeditions.reservation_statut is
  'non_ouverte : rien n''a été demandé. a_ouvrir : le client a payé, la '
  'réservation est due. ouverte : le transporteur a rendu une référence. '
  'echec : la demande a été faite et refusée — voir reservation_erreur.';

comment on column public.app_e08c374bc4_expeditions.marque_expedition is
  'Le shipping mark peint sur les cartons. Immuable une fois posé : une marque '
  'qui change après que le fournisseur a marqué ses colis ne rapproche plus rien.';

comment on column public.app_e08c374bc4_expeditions.connecteur is
  'Qui réserve : cj, dhl, consolidateur. Distinct de transporteur_code, qui '
  'désigne qui ACHEMINE aux yeux de l''agrégateur de suivi.';

-- Une marque ne doit jamais désigner deux expéditions. L'index partiel laisse
-- passer les expéditions anciennes, qui n'en ont pas.
create unique index if not exists app_e08c374bc4_expeditions_marque_unique
  on public.app_e08c374bc4_expeditions (marque_expedition)
  where marque_expedition is not null;

-- Retrouver les réservations dues, et celles qui ont échoué sans qu'on le sache.
create index if not exists app_e08c374bc4_expeditions_reservation_idx
  on public.app_e08c374bc4_expeditions (reservation_statut)
  where reservation_statut in ('a_ouvrir', 'echec');

-- ---------------------------------------------------------------------------
-- Les points de consolidation
-- ---------------------------------------------------------------------------
--
-- Un consolidateur, c'est une adresse d'entrepôt et un code client. Rien de
-- plus, et c'est suffisant : c'est exactement ce qu'il faut communiquer au
-- fournisseur chinois pour que la marchandise arrive au bon endroit.
--
-- La table existe pour qu'on puisse en avoir PLUSIEURS — un à Guangzhou, un à
-- Yiwu — sans redéploiement. Changer de consolidateur ne doit pas être un
-- changement de code.

create table if not exists public.app_e08c374bc4_consolidateurs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  nom text not null,
  ville text,
  pays text not null default 'Chine',
  -- L'adresse telle qu'elle doit être recopiée par le fournisseur, en anglais
  -- ou en chinois : c'est lui qui la lira, pas nous.
  adresse_entrepot text,
  -- Le code que le consolidateur nous a attribué. Il préfixe chaque marque.
  code_client text,
  contact_nom text,
  contact_telephone text,
  contact_email text,
  -- Le délai annoncé, pour que la page de suivi ne promette pas au hasard.
  delai_min_jours integer,
  delai_max_jours integer,
  note text,
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);

alter table public.app_e08c374bc4_consolidateurs enable row level security;

-- Une adresse d'entrepôt et un contact chinois n'ont rien à faire chez un
-- visiteur : c'est de l'information commerciale, et la donner permettrait à
-- n'importe qui de court-circuiter la maison.
drop policy if exists "consolidateurs lisibles par l'administration"
  on public.app_e08c374bc4_consolidateurs;
create policy "consolidateurs lisibles par l'administration"
  on public.app_e08c374bc4_consolidateurs for select
  using (app_e08c374bc4_is_admin());

drop policy if exists "consolidateurs modifiables par l'administration"
  on public.app_e08c374bc4_consolidateurs;
create policy "consolidateurs modifiables par l'administration"
  on public.app_e08c374bc4_consolidateurs for all
  using (app_e08c374bc4_is_admin())
  with check (app_e08c374bc4_is_admin());
