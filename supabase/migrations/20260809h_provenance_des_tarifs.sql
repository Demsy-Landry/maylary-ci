-- La provenance d'un tarif fait partie du tarif.
--
-- Le fondateur m'a demandé de chercher les barèmes en ligne. Je l'ai fait, et
-- la recherche a surtout appris une chose : les chiffres qu'on trouve ne sont
-- pas de même nature, et les mélanger est exactement la façon dont un moteur
-- de cotation se met à mentir.
--
--   officiel    — une convention, une circulaire, un texte réglementaire. Il
--                 s'impose à tout le monde et ne se négocie pas.
--   contractuel — le devis de NOTRE groupeur, de NOTRE assureur. C'est le seul
--                 qui engage Maylary, et le seul qui puisse figurer dans un
--                 prix ferme.
--   indicatif   — un tarif public relevé sur un site commercial. Il situe un
--                 ordre de grandeur, il est daté, il vieillit vite, et il n'a
--                 jamais à devenir un prix.
--
-- Le moteur ne totalise que l'officiel et le contractuel. Un tarif indicatif
-- peut nourrir une fourchette et doit s'afficher avec sa date et sa source —
-- jamais comme un montant dû. C'est la règle du corpus TEC, étendue au reste :
-- ce qui n'est pas vérifié ne s'affiche pas comme vérifié.
--
-- Ce que la recherche a réellement donné est consigné dans
-- `docs/reference/BAREMES_TRANSIT_CI.md`, avec les sources. Ce qu'elle n'a pas
-- donné y est aussi, parce qu'un manque documenté vaut mieux qu'un manque
-- oublié : les barèmes FEDERMAR, l'acconage du terminal et le tarif du BSC ne
-- sont pas publiés en clair et devront venir du fondateur ou d'un devis.

alter table app_e08c374bc4_frais_transit_local
  add column if not exists nature text not null default 'contractuel'
    check (nature in ('officiel', 'contractuel', 'indicatif')),
  add column if not exists date_releve date,
  add column if not exists source_url text,
  add column if not exists devise text not null default 'XOF'
    check (devise in ('XOF', 'EUR', 'USD'));

comment on column app_e08c374bc4_frais_transit_local.nature is
  'officiel (texte réglementaire), contractuel (notre devis fournisseur) ou indicatif (relevé public). Seuls les deux premiers entrent dans un prix ferme.';

-- ---------------------------------------------------------------------------
-- Les faits de procédure, qui ne sont pas des montants mais coûtent de l'argent
-- ---------------------------------------------------------------------------
-- Une franchise de magasinage n'est pas un tarif : c'est le nombre de jours
-- avant que le tarif commence. Un dossier qui traîne trois jours de trop coûte
-- plus cher qu'une négociation d'honoraires. Ces seuils sont donc de la donnée
-- de premier plan, pas une note de bas de page.

create table if not exists app_e08c374bc4_regles_procedure (
  code          text primary key,
  libelle       text not null,
  valeur        numeric,
  unite         text,
  sens          text not null default 'import'
                check (sens in ('import', 'export', 'les_deux')),
  nature        text not null default 'officiel'
                check (nature in ('officiel', 'contractuel', 'indicatif')),
  reference     text,
  source_url    text,
  date_releve   date,
  explication   text,
  actif         boolean not null default true,
  ordre         integer not null default 100
);

insert into app_e08c374bc4_regles_procedure
  (code, libelle, valeur, unite, sens, nature, reference, date_releve, explication, ordre)
values
  ('RFCV_SEUIL', 'Seuil d''obligation du RFCV', 1000000, 'FCFA FOB', 'import', 'officiel',
   'Convention État de Côte d''Ivoire — Webb Fontaine du 28/02/2013 ; circulaire n° 1618/MPMEF/DGD du 21/06/2013',
   '2026-08-09',
   'Toute importation dont la valeur FOB dépasse 1 000 000 FCFA doit faire l''objet d''un Rapport Final de Classification et de Valeur. Le RFCV porte la valeur et le code SH retenus par l''organisme : c''est lui, et non la facture, qui fixera l''assiette si les deux divergent.', 10),

  ('RFCV_DELAI', 'Délai de délivrance du RFCV', 5, 'jours ouvrés', 'import', 'officiel',
   'Convention État de Côte d''Ivoire — Webb Fontaine',
   '2026-08-09',
   'À compter du dépôt du dossier complet. À intégrer au délai annoncé au client : il court avant l''arrivée du navire, pas après.', 20),

  ('MAGASINAGE_FRANCHISE', 'Franchise de magasinage au terminal', 10, 'jours', 'import', 'indicatif',
   'Usage du terminal à conteneurs du Port d''Abidjan, relevé sur documentation transitaire',
   '2026-08-09',
   'Gratuit pendant dix jours à compter du déchargement, facturé par conteneur et par jour ensuite. À confirmer auprès du terminal : c''est un usage relevé, pas un texte.', 30),

  ('SURESTARIES_FRANCHISE', 'Franchise de surestaries', 6, 'jours', 'import', 'indicatif',
   'Usage des compagnies maritimes, négociable au volume',
   '2026-08-09',
   'Court à compter du déchargement. Négociable selon le volume traité — c''est un des rares postes où un transitaire régulier obtient mieux qu''un chargeur occasionnel.', 40),

  ('CAD_CAUTION', 'Caution d''agrément du commissionnaire en douane', 50000000, 'FCFA', 'les_deux', 'officiel',
   'Réforme des Douanes ivoiriennes, en vigueur au 1er janvier 2026',
   '2026-08-09',
   'Relevée de 30 à 50 millions FCFA. Concerne directement l''agrément de Dems''Inc, et le crédit d''enlèvement passe de 50 à 100 millions dans le même mouvement.', 50),

  ('CAD_CREDIT_ENLEVEMENT', 'Crédit d''enlèvement du commissionnaire', 100000000, 'FCFA', 'les_deux', 'officiel',
   'Réforme des Douanes ivoiriennes, en vigueur au 1er janvier 2026',
   '2026-08-09',
   'Plafond des droits qu''un commissionnaire peut engager avant paiement. Relevé de 50 à 100 millions FCFA.', 60),

  ('CONTESTATION_VALEUR', 'Délai de contestation d''une valeur', 2, 'jours', 'import', 'officiel',
   'Procédure de recours devant le Comité d''arbitrage de la valeur',
   '2026-08-09',
   'Un opérateur qui refuse la valeur retenue peut demander une révision ou saisir le Comité d''arbitrage. Le délai est court : un client prévenu tard a déjà perdu son recours.', 70)
on conflict (code) do nothing;

alter table app_e08c374bc4_regles_procedure enable row level security;
drop policy if exists "Règles de procédure lisibles" on app_e08c374bc4_regles_procedure;
create policy "Règles de procédure lisibles"
  on app_e08c374bc4_regles_procedure for select using (true);
drop policy if exists "Règles de procédure modifiables par l'admin" on app_e08c374bc4_regles_procedure;
create policy "Règles de procédure modifiables par l'admin"
  on app_e08c374bc4_regles_procedure for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

-- ---------------------------------------------------------------------------
-- Repères de marché, explicitement non contractuels
-- ---------------------------------------------------------------------------
-- Relevés publics de fret. Ils ne servent qu'à une chose : dire au fondateur
-- si le devis qu'on lui propose est dans le marché. Ils ne peuvent pas entrer
-- dans un prix client, et la table le dit dans son nom.

create table if not exists app_e08c374bc4_reperes_fret_marche (
  id           uuid primary key default gen_random_uuid(),
  origine      text not null,
  destination  text not null default 'Abidjan',
  mode         text not null check (mode in ('maritime', 'aerien', 'routier')),
  conditionnement text not null check (conditionnement in ('groupage', 'conteneur')),
  unite        text not null,
  montant      numeric(14,2) not null,
  devise       text not null check (devise in ('XOF', 'EUR', 'USD')),
  delai_min_jours integer,
  delai_max_jours integer,
  source       text not null,
  date_releve  date not null,
  note         text
);

insert into app_e08c374bc4_reperes_fret_marche
  (origine, mode, conditionnement, unite, montant, devise, delai_min_jours, delai_max_jours, source, date_releve, note)
values
  ('Chine', 'maritime', 'groupage', 'm3', 211, 'USD', 34, 40,
   'Relevé public de tarifs de groupage Chine — Abidjan', '2026-02-01',
   'Ordre de grandeur seulement. Le tarif réel dépend du port de départ, du volume et de la saison.'),
  ('France', 'maritime', 'groupage', 'm3', 95, 'EUR', null, null,
   'Relevé public de tarifs de groupage France — Côte d''Ivoire', '2026-08-09',
   'Tarif d''appel « à partir de ». Les frais de destination n''y sont pas compris.'),
  ('France', 'maritime', 'conteneur', 'conteneur 20 pieds', 1350, 'EUR', null, null,
   'Relevé public de tarifs conteneur France — Côte d''Ivoire', '2026-08-09',
   'Tarif d''appel « à partir de », hors frais de destination et hors dédouanement.')
on conflict do nothing;

alter table app_e08c374bc4_reperes_fret_marche enable row level security;
drop policy if exists "Repères de fret lisibles par l'admin" on app_e08c374bc4_reperes_fret_marche;
create policy "Repères de fret lisibles par l'admin"
  on app_e08c374bc4_reperes_fret_marche for select
  using (app_e08c374bc4_is_admin());
drop policy if exists "Repères de fret modifiables par l'admin" on app_e08c374bc4_reperes_fret_marche;
create policy "Repères de fret modifiables par l'admin"
  on app_e08c374bc4_reperes_fret_marche for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());
