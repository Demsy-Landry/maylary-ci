-- Rendre le paiement opérationnel.
--
-- État constaté avant cette migration, en production :
--   - `parametres_paiement` ne contenait que des NULL, et aucun écran ne
--     permettait de la remplir ;
--   - la RLS y était active sans aucune politique : même remplie, la table
--     était illisible par le client. Deux pannes indépendantes empilées, dont
--     la seconde aurait masqué la correction de la première ;
--   - « J'ai payé » basculait la commande sur simple déclaration, sans
--     référence de transaction ni reçu. Rien à confronter en cas de litige.
--
-- Le règlement reste manuel — le client paie par ses moyens et Maylary
-- confirme — mais il devient traçable des deux côtés.

-- ---------------------------------------------------------------------------
-- Les canaux d'encaissement, plusieurs et modifiables
-- ---------------------------------------------------------------------------
-- Une seule ligne figée ne convenait pas : en Côte d'Ivoire un commerçant
-- encaisse sur Wave, Orange Money, MTN, Moov et par virement, et la liste
-- change. Chaque canal est une ligne qu'on active ou retire sans redéploiement.
create table if not exists app_e08c374bc4_canaux_paiement (
  id           uuid primary key default gen_random_uuid(),
  type_canal   text not null check (type_canal in ('mobile_money', 'virement')),
  -- « Wave », « Orange Money », « Ecobank »… tel que le client le reconnaîtra.
  libelle      text not null,
  -- Numéro de téléphone marchand, ou IBAN/RIB selon le type.
  numero       text not null,
  titulaire    text not null,
  instructions text,
  actif        boolean not null default true,
  ordre        integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table app_e08c374bc4_canaux_paiement enable row level security;

-- Lecture réservée aux comptes connectés : ces coordonnées ne servent qu'à
-- régler une commande, et seul un client connecté peut en passer une. Les
-- exposer en anonyme les offrirait à qui les recopierait pour se faire payer
-- à notre place.
drop policy if exists canaux_lecture_client on app_e08c374bc4_canaux_paiement;
create policy canaux_lecture_client on app_e08c374bc4_canaux_paiement
  for select to authenticated using (actif or app_e08c374bc4_is_admin());

drop policy if exists canaux_ecriture_admin on app_e08c374bc4_canaux_paiement;
create policy canaux_ecriture_admin on app_e08c374bc4_canaux_paiement
  for all to authenticated
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

comment on table app_e08c374bc4_parametres_paiement is
  'Remplacée par app_e08c374bc4_canaux_paiement, qui accepte plusieurs canaux. Conservée sans usage.';

-- ---------------------------------------------------------------------------
-- Ce que le client déclare, et ce que Maylary constate
-- ---------------------------------------------------------------------------
-- Deux colonnes de montant, et c'est volontaire : `montant_total_fcfa` est ce
-- qui était dû, `montant_recu_fcfa` ce qui est réellement arrivé. Les écraser
-- l'un sur l'autre effacerait justement le cas qu'on veut voir — le règlement
-- partiel.
alter table app_e08c374bc4_commandes_gp
  add column if not exists canal_paiement_declare  text,
  add column if not exists reference_transaction   text,
  add column if not exists preuve_paiement_chemin  text,
  add column if not exists paiement_declare_le     timestamptz,
  add column if not exists montant_recu_fcfa       numeric,
  add column if not exists paiement_confirme_le    timestamptz,
  add column if not exists paiement_confirme_par   uuid references auth.users (id) on delete set null,
  add column if not exists note_reglement          text;

-- ---------------------------------------------------------------------------
-- Le reçu déposé par le client
-- ---------------------------------------------------------------------------
-- Compartiment privé : une capture de transaction porte un numéro de
-- téléphone, un solde, parfois un nom. Elle ne doit jamais être servie par une
-- URL publique devinable.
insert into storage.buckets (id, name, public)
values ('app_e08c374bc4_preuves_paiement', 'app_e08c374bc4_preuves_paiement', false)
on conflict (id) do nothing;

-- Le premier segment du chemin est l'identifiant du client : c'est lui qui
-- porte la règle, et non une colonne à tenir à jour.
drop policy if exists preuves_depot_client on storage.objects;
create policy preuves_depot_client on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'app_e08c374bc4_preuves_paiement'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists preuves_lecture on storage.objects;
create policy preuves_lecture on storage.objects
  for select to authenticated
  using (
    bucket_id = 'app_e08c374bc4_preuves_paiement'
    and ((storage.foldername(name))[1] = auth.uid()::text or app_e08c374bc4_is_admin())
  );

-- Pas de mise à jour ni de suppression par le client : un reçu déposé est une
-- pièce du dossier. Le remplacer après coup viderait la preuve de son sens.
drop policy if exists preuves_menage_admin on storage.objects;
create policy preuves_menage_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'app_e08c374bc4_preuves_paiement' and app_e08c374bc4_is_admin());
