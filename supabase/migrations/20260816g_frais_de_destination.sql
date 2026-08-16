-- Ce qui se paie entre le Bon À Enlever et la sortie du port.
--
-- LA LACUNE, TELLE QUE LE FONDATEUR L'A POSÉE
--
-- « Il ne suffit pas de payer la marchandise, payer le fret, faire l'assurance
-- et liquider les droits et taxes pour que la marchandise soit livrée. »
--
-- C'est exact, et notre modèle de coût s'arrêtait précisément là. La chaîne
-- documentaire (`documents_procedure`) va du code importateur au bordereau de
-- livraison en passant par le BAE — mais entre le BAE et le camion qui sort du
-- port, il y a une facture, et elle n'est émise ni par la douane ni par le
-- fournisseur. Elle est émise par la COMPAGNIE et par le PORT.
--
-- Maritime : acconage, échange du connaissement, magasinage.
-- Aérien   : retrait documentaire, magasinage.
--
-- Un devis d'import qui les oublie est faux, et il est faux du même montant à
-- chaque dossier — ce n'est pas une imprécision, c'est un poste manquant.
--
-- POURQUOI CE N'EST PAS UNE COLONNE DE PLUS SUR `parametres_import`
--
-- Ces frais ne suivent pas la marchandise, ils suivent le MODE et le
-- CONDITIONNEMENT. L'acconage d'un conteneur complet se compte au conteneur ;
-- celui d'un groupage se compte à la tonne. Le magasinage se compte au jour,
-- après une franchise. Le retrait documentaire est un forfait par LTA. Un seul
-- nombre ne peut pas porter ça.
--
-- Ils varient aussi d'une compagnie à l'autre — d'où la colonne `compagnie`,
-- nulle pour le tarif par défaut, renseignée pour une grille particulière.
--
-- AUCUN MONTANT N'EST INVENTÉ ICI
--
-- `montant_fcfa` est NUL sur toutes les lignes semées. C'est délibéré, et c'est
-- la même règle que pour un code tarifaire absent du Tarif Extérieur Commun :
-- tant que le chiffre réel n'est pas saisi, le calcul REFUSE de conclure et dit
-- ce qui lui manque. Un acconage plausible mais faux coûterait plus cher qu'un
-- refus, parce qu'on le découvrirait au moment de payer, marchandise déjà à
-- quai.
--
-- CE À QUOI ÇA NE S'APPLIQUE PAS
--
-- Le dropshipping CJ n'a ni connaissement, ni acconier, ni magasin sous douane :
-- c'est un porte-à-porte droits acquittés, la compagnie livre à l'adresse. Lui
-- appliquer ces frais le compterait deux fois. La dissociation est portée par
-- le code de calcul, et rappelée ici pour qu'elle ne se perde pas.

create table if not exists public.app_e08c374bc4_frais_destination (
  code text primary key,
  libelle text not null,
  sens text not null default 'import' check (sens in ('import', 'export')),
  mode text not null check (mode in ('maritime', 'aerien', 'tous')),
  conditionnement text not null default 'tous'
    check (conditionnement in ('conteneur', 'groupage', 'tous')),
  /** Nul = grille par défaut ; renseigné = grille propre à une compagnie. */
  compagnie text,
  percepteur text not null,
  base_calcul text not null check (base_calcul in (
    'forfait_expedition', 'par_conteneur', 'par_tonne', 'par_m3', 'par_kg',
    'par_jour', 'pourcentage_caf'
  )),
  /** NUL tant que le montant réel n'est pas connu : le calcul refuse alors de conclure. */
  montant_fcfa numeric,
  /** Pour `pourcentage_caf` uniquement. */
  taux numeric,
  /** Jours de franchise avant que le magasinage ne commence à courir. */
  franchise_jours integer,
  /** Vrai quand un dossier mené vite permet de ne pas le payer (magasinage). */
  evitable boolean not null default false,
  obligation text not null default 'obligatoire'
    check (obligation in ('obligatoire', 'conditionnel')),
  source text,
  /** Vrai seulement quand le montant vient d'une facture ou d'un tarif publié. */
  verifie boolean not null default false,
  date_releve date,
  ordre integer not null default 100,
  actif boolean not null default true,
  note text,
  updated_at timestamptz not null default now()
);

comment on table public.app_e08c374bc4_frais_destination is
  'Frais dus à l''arrivée, hors droits et taxes de douane : acconage, échange de connaissement, magasinage, retrait documentaire. Ne s''appliquent pas au porte-à-porte droits acquittés.';

alter table public.app_e08c374bc4_frais_destination enable row level security;

-- Un coût de revient : personne d'autre que l'administration ne le lit.
create policy frais_destination_admin_tout
  on public.app_e08c374bc4_frais_destination
  for all to authenticated
  using (public.app_e08c374bc4_is_admin())
  with check (public.app_e08c374bc4_is_admin());

revoke all on public.app_e08c374bc4_frais_destination from anon;
grant select, insert, update, delete
  on public.app_e08c374bc4_frais_destination to authenticated;

-- ---------------------------------------------------------------------------
-- Les postes nommés par le fondateur, sans un seul montant supposé.
-- ---------------------------------------------------------------------------
insert into public.app_e08c374bc4_frais_destination
  (code, libelle, mode, conditionnement, percepteur, base_calcul,
   franchise_jours, evitable, obligation, ordre, note)
values
  ('ACCONAGE_CONTENEUR',
   'Acconage — conteneur complet',
   'maritime', 'conteneur',
   'Acconier / manutentionnaire portuaire',
   'par_conteneur', null, false, 'obligatoire', 10,
   'Manutention à quai. Se compte au conteneur, et diffère entre un 20 et un 40 pieds : prévoir une ligne par taille si les tarifs divergent.'),

  ('ACCONAGE_GROUPAGE',
   'Acconage — groupage',
   'maritime', 'groupage',
   'Acconier / manutentionnaire portuaire',
   'par_tonne', null, false, 'obligatoire', 11,
   'En groupage, la manutention se compte au poids débarqué et non au conteneur, puisque le conteneur n''est pas le nôtre.'),

  ('ECHANGE_BL',
   'Échange du connaissement (bon à délivrer)',
   'maritime', 'tous',
   'Compagnie maritime ou son agent',
   'forfait_expedition', null, false, 'obligatoire', 12,
   'Se paie contre remise du bon à délivrer. Sans lui, le conteneur ne sort pas, quand bien même la douane aurait donné le BAE. Le montant varie d''une compagnie à l''autre.'),

  ('MAGASINAGE_PORT',
   'Magasinage sous douane — port',
   'maritime', 'tous',
   'Terminal portuaire',
   'par_jour', null, true, 'conditionnel', 13,
   'Court après une franchise. C''est le seul poste de cette liste qu''un dossier mené vite fait tomber à zéro — raison de plus pour le chiffrer, afin que le coût d''un retard soit visible.'),

  ('RETRAIT_DOCUMENTAIRE',
   'Retrait documentaire — aérien',
   'aerien', 'tous',
   'Compagnie aérienne ou son assistant en escale',
   'forfait_expedition', null, false, 'obligatoire', 20,
   'Remise de la lettre de transport aérien à destination. Équivalent aérien de l''échange de connaissement.'),

  ('MAGASINAGE_AEROPORT',
   'Magasinage sous douane — aéroport',
   'aerien', 'tous',
   'Assistant en escale / magasin sous douane',
   'par_jour', null, true, 'conditionnel', 21,
   'Franchise plus courte qu''au port, et tarif souvent au kilo par jour : si c''est le cas, changer la base en `par_kg` et porter le tarif journalier.')
on conflict (code) do nothing;
