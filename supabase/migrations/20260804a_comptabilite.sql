-- Comptabilité en partie double.
--
-- Jusqu'ici, les chiffres de Maylary vivaient dispersés : un montant sur la
-- commande, un coût sur le produit, une commission sur la ligne de vente. On
-- pouvait répondre « combien ai-je vendu », jamais « que vaut mon entreprise »
-- ni « où est passé mon argent ». Un comptable ne peut rien faire d'une telle
-- dispersion, et l'administration fiscale non plus.
--
-- Ce module tient un journal : chaque événement financier y devient une écriture
-- équilibrée, rattachée à son fait générateur, dans un plan de comptes.
--
-- ⚠️ Le plan de comptes ci-dessous suit la logique des classes SYSCOHADA
-- (révisé), applicable en zone OHADA dont la Côte d'Ivoire fait partie.
-- L'imputation fine de certains postes — droits de douane, frais accessoires
-- d'achat — admet plusieurs lectures selon la doctrine. Ce plan est un point de
-- départ opérationnel : il doit être validé par un expert-comptable avant tout
-- dépôt d'états financiers. Le mécanisme, lui, est bon quelle que soit
-- l'imputation retenue, et les comptes se modifient sans redéploiement.

-- ---------------------------------------------------------------------------
-- Plan de comptes
-- ---------------------------------------------------------------------------
create table if not exists app_e08c374bc4_comptes (
  code       text primary key,
  libelle    text not null,
  -- Classe SYSCOHADA : 1 ressources durables, 2 immobilisations, 3 stocks,
  -- 4 tiers, 5 trésorerie, 6 charges, 7 produits.
  classe     smallint not null check (classe between 1 and 9),
  -- Sens naturel du solde, utile pour présenter la balance sans se tromper.
  sens       text not null check (sens in ('debit', 'credit')),
  actif      boolean not null default true,
  note       text,
  created_at timestamptz not null default now()
);

alter table app_e08c374bc4_comptes enable row level security;
drop policy if exists comptes_admin on app_e08c374bc4_comptes;
create policy comptes_admin on app_e08c374bc4_comptes
  for all to authenticated
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

insert into app_e08c374bc4_comptes (code, libelle, classe, sens, note) values
  ('401000', 'Fournisseurs',                       4, 'credit', 'Ce que nous devons à nos fournisseurs.'),
  ('411000', 'Clients',                            4, 'debit',  'Ce que nos clients nous doivent.'),
  ('443100', 'TVA facturée',                       4, 'credit', 'Inutilisé tant que Maylary n''est pas assujettie.'),
  ('445100', 'TVA récupérable',                    4, 'debit',  'Inutilisé tant que Maylary n''est pas assujettie.'),
  ('521000', 'Banque',                             5, 'debit',  'Compte Société Générale Côte d''Ivoire.'),
  ('531000', 'Caisse',                             5, 'debit',  'Espèces.'),
  ('551000', 'Monnaie électronique',               5, 'debit',  'Wave, Orange Money, MTN, Moov.'),
  ('601000', 'Achats de marchandises',             6, 'debit',  'Prix payé au fournisseur, hors transport.'),
  ('601500', 'Frais accessoires sur achats',       6, 'debit',  'Droits de douane et frais de dédouanement.'),
  ('611000', 'Transports sur achats',              6, 'debit',  'Fret international jusqu''à Abidjan.'),
  ('612000', 'Transports sur ventes',              6, 'debit',  'Livraison locale au client.'),
  ('625000', 'Primes d''assurance',                6, 'debit',  'Assurance facultés sur les marchandises.'),
  ('631000', 'Frais bancaires et de paiement',     6, 'debit',  'Commissions Wave, frais de virement.'),
  ('676000', 'Pertes de change',                   6, 'debit',  'Écart défavorable entre le cours retenu et le cours réel.'),
  ('701000', 'Ventes de marchandises',             7, 'credit', 'Chiffre d''affaires de la boutique et de l''espace pro.'),
  ('706000', 'Services vendus',                    7, 'credit', 'Commissions marketplace, prestations import et export.'),
  ('776000', 'Gains de change',                    7, 'credit', 'Écart favorable entre le cours retenu et le cours réel.')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Journaux
-- ---------------------------------------------------------------------------
create table if not exists app_e08c374bc4_journaux (
  code    text primary key,
  libelle text not null,
  actif   boolean not null default true
);

alter table app_e08c374bc4_journaux enable row level security;
drop policy if exists journaux_admin on app_e08c374bc4_journaux;
create policy journaux_admin on app_e08c374bc4_journaux
  for all to authenticated
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

insert into app_e08c374bc4_journaux (code, libelle) values
  ('VE', 'Ventes'),
  ('AC', 'Achats'),
  ('BQ', 'Banque'),
  ('MM', 'Monnaie électronique'),
  ('OD', 'Opérations diverses')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Écritures
-- ---------------------------------------------------------------------------
create sequence if not exists app_e08c374bc4_ecriture_seq;

create table if not exists app_e08c374bc4_ecritures (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null unique
                 default 'ECR-' || to_char(now(), 'YYYY') || '-'
                       || lpad(nextval('app_e08c374bc4_ecriture_seq')::text, 6, '0'),
  date_ecriture  date not null default current_date,
  journal        text not null references app_e08c374bc4_journaux (code),
  libelle        text not null,
  -- Numéro de la pièce justificative : facture, reçu, référence de commande.
  piece          text,
  -- Rattachement au fait générateur, pour remonter de l'écriture à la commande.
  source_type    text,
  source_id      uuid,
  -- Commerce international : l'achat se fait souvent en devise. On garde le
  -- montant d'origine et le cours retenu, sans quoi un écart de change devient
  -- impossible à expliquer six mois plus tard.
  devise         text not null default 'XOF',
  taux_change    numeric not null default 1 check (taux_change > 0),
  cree_par       uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists app_e08c374bc4_ecritures_date_idx
  on app_e08c374bc4_ecritures (date_ecriture desc);
create index if not exists app_e08c374bc4_ecritures_source_idx
  on app_e08c374bc4_ecritures (source_type, source_id);

alter table app_e08c374bc4_ecritures enable row level security;
drop policy if exists ecritures_admin on app_e08c374bc4_ecritures;
create policy ecritures_admin on app_e08c374bc4_ecritures
  for all to authenticated
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

create table if not exists app_e08c374bc4_lignes_ecriture (
  id          uuid primary key default gen_random_uuid(),
  ecriture_id uuid not null references app_e08c374bc4_ecritures (id) on delete cascade,
  compte      text not null references app_e08c374bc4_comptes (code),
  libelle     text,
  debit_fcfa  numeric not null default 0 check (debit_fcfa >= 0),
  credit_fcfa numeric not null default 0 check (credit_fcfa >= 0),
  -- Une ligne porte un débit ou un crédit, jamais les deux, jamais aucun des
  -- deux. Une ligne à zéro des deux côtés n'apprend rien et fausse les
  -- décomptes de contrôle.
  constraint app_e08c374bc4_ligne_un_seul_sens
    check ((debit_fcfa > 0 and credit_fcfa = 0) or (credit_fcfa > 0 and debit_fcfa = 0)),
  ordre       integer not null default 0
);

create index if not exists app_e08c374bc4_lignes_ecriture_idx
  on app_e08c374bc4_lignes_ecriture (ecriture_id);
create index if not exists app_e08c374bc4_lignes_compte_idx
  on app_e08c374bc4_lignes_ecriture (compte);

alter table app_e08c374bc4_lignes_ecriture enable row level security;
drop policy if exists lignes_ecriture_admin on app_e08c374bc4_lignes_ecriture;
create policy lignes_ecriture_admin on app_e08c374bc4_lignes_ecriture
  for all to authenticated
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

-- ---------------------------------------------------------------------------
-- L'équilibre, garanti par la base et non par l'écran
-- ---------------------------------------------------------------------------
-- C'est la règle qui fait la différence entre une comptabilité et une liste de
-- montants. Elle est vérifiée en fin de transaction — et non à chaque ligne —
-- car une écriture s'insère forcément déséquilibrée le temps d'écrire sa
-- première ligne.
create or replace function app_e08c374bc4_ecriture_equilibree()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ecriture uuid := coalesce(new.ecriture_id, old.ecriture_id);
  v_debit numeric;
  v_credit numeric;
  v_lignes integer;
begin
  select coalesce(sum(debit_fcfa), 0), coalesce(sum(credit_fcfa), 0), count(*)
    into v_debit, v_credit, v_lignes
  from app_e08c374bc4_lignes_ecriture where ecriture_id = v_ecriture;

  -- Une écriture entièrement supprimée est un cas légitime : c'est l'annulation
  -- de l'écriture elle-même, et son en-tête part avec elle.
  if v_lignes = 0 then
    return null;
  end if;

  if v_lignes < 2 then
    raise exception 'Écriture % : une écriture comporte au moins deux lignes.', v_ecriture;
  end if;

  if round(v_debit) <> round(v_credit) then
    raise exception 'Écriture % déséquilibrée : % au débit contre % au crédit.',
      v_ecriture, round(v_debit), round(v_credit);
  end if;

  return null;
end;
$$;

drop trigger if exists app_e08c374bc4_ecriture_equilibree on app_e08c374bc4_lignes_ecriture;
create constraint trigger app_e08c374bc4_ecriture_equilibree
  after insert or update or delete on app_e08c374bc4_lignes_ecriture
  deferrable initially deferred
  for each row execute function app_e08c374bc4_ecriture_equilibree();

-- ---------------------------------------------------------------------------
-- Une écriture validée ne se réécrit pas
-- ---------------------------------------------------------------------------
-- Corriger une écriture passée, c'est réécrire l'histoire. La comptabilité
-- corrige par contrepassation : une écriture inverse, datée du jour où l'on
-- s'aperçoit de l'erreur. Le verrou s'applique aux écritures de plus d'un jour,
-- pour laisser rattraper une saisie du jour même.
create or replace function app_e08c374bc4_ecriture_non_reecrite()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_creee timestamptz;
begin
  select e.created_at into v_creee
  from app_e08c374bc4_ecritures e
  where e.id = coalesce(new.ecriture_id, old.ecriture_id);

  if v_creee is not null and v_creee < now() - interval '1 day' then
    raise exception
      'Écriture close : passez une écriture de contrepassation plutôt que de modifier celle-ci.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists app_e08c374bc4_ecriture_non_reecrite on app_e08c374bc4_lignes_ecriture;
create trigger app_e08c374bc4_ecriture_non_reecrite
  before update or delete on app_e08c374bc4_lignes_ecriture
  for each row execute function app_e08c374bc4_ecriture_non_reecrite();
