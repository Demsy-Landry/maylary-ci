-- Les frais des compagnies et des terminaux, tels qu'ils se facturent.
--
-- TROISIÈME CORRECTION DE FORME, ET LA BONNE
--
-- Le premier modèle posait UN montant par poste : il supposait un tarif fixe,
-- le fondateur l'a corrigé. Le deuxième, tiré du barème FEDERMAR, ajoutait la
-- catégorie de marchandise. La base tarifaire des compagnies montre qu'il
-- manquait encore quatre dimensions :
--
--   LA COMPAGNIE  un « échange de connaissement » vaut 40 000 F chez CMA CGM,
--                 50 000 chez OOCL, 61 EUR chez Hapag-Lloyd. Ce n'est pas un
--                 poste, c'est un poste PAR TRANSPORTEUR.
--   LA DEVISE     28 des 90 lignes sont en euros ou en dollars.
--   LA TVA        18 % sur certains postes et pas sur d'autres. Le timbre non,
--                 le bon à délivrer oui.
--   LE STATUT     deux frais de TERRA sont DÉNONCÉS par les transitaires
--                 (SNGTIVO-CI) depuis décembre 2025. Les chiffrer sans le dire
--                 reviendrait à facturer un client sur un frais contesté.
--
-- Les surestaries ajoutent une cinquième dimension : des PALIERS. Onze jours
-- francs, puis 14 000 F par jour du douzième au seizième, puis 28 000 au-delà.
-- Les colonnes franchise_jours, jour_min et jour_max les rendent calculables au
-- lieu de les laisser dans un libellé.
--
-- LA CAUTION N'EST PAS UN COÛT
--
-- Jusqu'à 750 000 F par conteneur, et REMBOURSABLE au retour de la boîte. La
-- compter dans le coût de revient gonflerait le prix de vente d'une somme qu'on
-- récupère. Le moteur la sort du total et la présente à part : c'est de la
-- trésorerie à sortir, pas une charge.
--
-- CE QUI RESTE SANS TARIF
--
-- Six lignes n'en ont pas : magasinage des terminaux, plug-in reefer,
-- manutention de San Pedro et du TC2. Elles ne disparaissent pas du chiffrage —
-- elles remontent nommées. Un poste qu'on sait dû mais qu'on ne sait pas
-- chiffrer doit se voir ; c'est le poste oublié qui coûte cher.

create table if not exists public.app_e08c374bc4_frais_logistiques (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('local_charge','surcharge','terminal_fee','detention','additional_fee')),
  compagnie_code text,
  compagnie_nom text,
  terminal_code text,
  code_frais text not null,
  libelle text not null,
  sens text not null check (sens in ('IMP','EXP','BOTH')),
  unite text not null check (unite in ('PER_BL','PER_CNTR','PER_TEU','PER_DAY','PER_TONNE','PERCENT_FREIGHT','PER_UNIT')),
  devise text not null check (devise in ('XOF','EUR','USD')),
  montant_20 numeric,
  montant_40 numeric,
  montant_45 numeric,
  pourcentage numeric,
  montant_min numeric,
  montant_max numeric,
  tva_applicable boolean not null default false,
  entree_en_vigueur date,
  statut text,
  note text,
  source text,
  franchise_jours integer,
  jour_min integer,
  jour_max integer,
  actif boolean not null default true,
  releve_le date not null default current_date
);

create unique index if not exists frais_logistiques_cle
  on public.app_e08c374bc4_frais_logistiques
  (coalesce(compagnie_code,''), coalesce(terminal_code,''), code_frais, sens, unite);

alter table public.app_e08c374bc4_frais_logistiques enable row level security;

create policy frais_logistiques_admin_tout
  on public.app_e08c374bc4_frais_logistiques
  for all to authenticated
  using (public.app_e08c374bc4_is_admin())
  with check (public.app_e08c374bc4_is_admin());

revoke all on public.app_e08c374bc4_frais_logistiques from anon;
grant select, insert, update, delete on public.app_e08c374bc4_frais_logistiques to authenticated;

-- Les 90 lignes sont chargées par la migration appliquée en base, depuis le
-- fichier base_tarifaire_cote_divoire_complete.csv fourni par le fondateur.

-- `frais_destination` est remplacée : elle n'avait ni compagnie, ni devise,
-- ni TVA, ni statut, ni paliers.
update public.app_e08c374bc4_frais_destination set actif = false where actif;
