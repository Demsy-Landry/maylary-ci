-- Le barème de fret du fondateur remplace mes plafonds.
--
-- CE QUI ÉTAIT EN PLACE, ET POURQUOI C'ÉTAIT INSUFFISANT
--
-- `taux_fret` portait UN nombre par mode, qualifié de « plafond », posé au haut
-- de fourchettes lues dans des rapports de marché. Le maritime y valait
-- 280 USD par unité payante — le sommet d'une fourchette qui, d'après le
-- document du fondateur, court de 80 à 150 USD/m³ au départ de Chine.
--
-- Un plafond n'est pas un tarif. Chiffrer au plafond fait paraître un import
-- deux à trois fois plus cher qu'il ne l'est, et conduit à renoncer à des
-- opérations qui étaient viables. C'est exactement ce qui s'est produit dans
-- l'analyse du catalogue : le groupage y paraissait moins avantageux qu'il ne
-- l'est réellement.
--
-- CE QUI CHANGE
--
-- Trois valeurs par ligne au lieu d'une : un minimum, un maximum, et la
-- fourchette la plus fréquemment observée — qui est celle sur laquelle on
-- chiffre. Un tarif isolé ne dit pas s'il est cher ; encadré, il le dit.
--
-- Le conditionnement devient structurant : conteneur complet et groupage ne se
-- comparent pas, et ne se facturent pas dans la même unité.
--
-- CE QUE CE BARÈME N'EST PAS
--
-- Ce n'est PAS un barème douanier. La douane ivoirienne applique le Code
-- d'évaluation de l'OMC — valeur transactionnelle augmentée du transport
-- jusqu'au point d'entrée — et redresse par le RFCV au-delà d'un million de
-- francs FOB, le litige remontant au Comité d'Arbitrage de la Valeur. Il
-- n'existe pas de barème public minimum/maximum pour le fret des marchandises
-- générales, contrairement au forfait des véhicules d'occasion.
--
-- Ces fourchettes servent donc à DEUX choses, et à rien d'autre : chiffrer une
-- opération, et repérer qu'un fret déclaré est anormalement bas — donc exposé à
-- redressement. La colonne `avertissement` porte cette phrase pour qu'aucun
-- écran ne puisse l'afficher sans elle.
--
-- Les tarifs bas des agents et des offres promotionnelles sont des tarifs de
-- base hors surcharges (soutes, THC, documentation, frais locaux). Le marché
-- bouge de 20 à 30 % en un mois. D'où la date de relevé, obligatoire.

alter table public.app_e08c374bc4_reperes_fret_marche
  add column if not exists montant_min numeric,
  add column if not exists montant_max numeric,
  add column if not exists courant_min numeric,
  add column if not exists courant_max numeric,
  add column if not exists avertissement text,
  add column if not exists actif boolean not null default true;

comment on column public.app_e08c374bc4_reperes_fret_marche.courant_min is
  'Bas de la fourchette la plus fréquemment observée : c''est sur elle qu''on chiffre, pas sur le minimum absolu.';

-- Les relevés antérieurs sont conservés mais retirés du chiffrage : le repère
-- Chine à 211 USD/m³ de février incluait vraisemblablement des frais de
-- destination, que nous comptons désormais à part.
update public.app_e08c374bc4_reperes_fret_marche
set actif = false,
    note = coalesce(note || ' — ', '') ||
           'Retiré du chiffrage le 16/08/2026, remplacé par le barème de référence. Conservé comme relevé historique.'
where date_releve < date '2026-08-16';

-- ---------------------------------------------------------------------------
-- Barème de référence — document du fondateur, relevés mai-août 2026
-- ---------------------------------------------------------------------------
with bareme(origine, mode, conditionnement, unite, montant_min, montant_max,
            courant_min, courant_max, delai_min, delai_max, commentaire) as (values
  -- Maritime, conteneur complet (FCL), port à port
  ('Chine',        'maritime', 'conteneur', 'conteneur 20 pieds', 1850, 4200, 2200, 3500, 30, 45,
   'Fourchette la plus courante : 2 200 à 3 500 USD.'),
  ('Chine',        'maritime', 'conteneur', 'conteneur 40 pieds', 2800, 5500, 3200, 4500, 30, 45,
   'Le 40 pieds ne coûte pas le double du 20 : c''est ce qui rend le volume payant.'),
  ('Europe',       'maritime', 'conteneur', 'conteneur 20 pieds', 1500, 3500, 1800, 2800, 18, 30,
   'Généralement inférieur à l''Asie.'),
  ('Europe',       'maritime', 'conteneur', 'conteneur 40 pieds', 2200, 4800, 2600, 3800, 18, 30,
   'Généralement inférieur à l''Asie.'),
  ('États-Unis',   'maritime', 'conteneur', 'conteneur 20 pieds', 3000, 5500, 3500, 4800, 30, 45,
   'Côte Est. Le plus élevé des quatre origines.'),
  ('États-Unis',   'maritime', 'conteneur', 'conteneur 40 pieds', 4000, 7000, 4500, 6000, 30, 45,
   'Côte Est.'),
  ('Asie hors Chine', 'maritime', 'conteneur', 'conteneur 20 pieds', 1800, 3800, 2100, 3200, 30, 50,
   'Inde, Vietnam. Variable selon la ligne.'),
  ('Asie hors Chine', 'maritime', 'conteneur', 'conteneur 40 pieds', 2700, 5000, 3000, 4200, 30, 50,
   'Inde, Vietnam.'),

  -- Maritime, groupage (LCL). Minimum courant de facturation : 2 à 3 m³.
  ('Chine',        'maritime', 'groupage', 'm3',  80, 150,  90, 135, 35, 55,
   'Minimum de facturation courant : 2 à 3 m³. En deçà, on paie le minimum.'),
  ('Europe',       'maritime', 'groupage', 'm3',  70, 130,  80, 115, 20, 35,
   'Minimum de facturation courant : 2 à 3 m³.'),
  ('États-Unis',   'maritime', 'groupage', 'm3', 100, 180, 120, 160, 30, 45,
   'Minimum de facturation courant : 2 à 3 m³.'),

  -- Aérien, aéroport à aéroport
  ('Chine',        'aerien',   'groupage', 'kg',  4.5,  9.0,  5.0,  7.5,  5, 10,
   'Fourchette courante au-delà de 100 kg. En deçà, le minimum de facturation domine.'),
  ('Europe',       'aerien',   'groupage', 'kg',  5.0, 12.0,  5.5,  9.0,  3,  7,
   'Groupage standard : 5 à 8 EUR/kg selon les relevés.'),
  ('États-Unis',   'aerien',   'groupage', 'kg',  6.0, 15.0,  7.0, 12.0,  5, 10,
   'Plus élevé, surtout en express.')
)
insert into public.app_e08c374bc4_reperes_fret_marche
  (origine, destination, mode, conditionnement, unite,
   montant, montant_min, montant_max, courant_min, courant_max,
   devise, delai_min_jours, delai_max_jours, date_releve, source, avertissement, note, actif)
select
  origine, 'Abidjan', mode, conditionnement, unite,
  round(((courant_min + courant_max) / 2)::numeric, 2),
  montant_min, montant_max, courant_min, courant_max,
  'USD', delai_min, delai_max, date '2026-08-16',
  'Relevés publics de transitaires et transporteurs, mai à août 2026 : Basenton, Ubest Shipping, Dantful, Sino Shipping (rapports de marché mensuels), Chrislion Logistics, Topway Shipping, Maersk (tarifs et surcharges), agrégateurs.',
  'Estimation de marché, non un barème officiel de la douane ivoirienne. La douane évalue selon le Code de l''OMC et redresse par le RFCV ; la décision lui appartient seule.',
  commentaire,
  true
from bareme;

-- ---------------------------------------------------------------------------
-- `taux_fret` alimente le chiffrage. On l'aligne sur le milieu de la fourchette
-- courante, et non plus sur le plafond.
-- ---------------------------------------------------------------------------
update public.app_e08c374bc4_taux_fret
set montant = 112.50,
    nature = 'indicatif',
    note = 'Milieu de la fourchette la plus fréquente au départ de Chine (90 à 135 USD/m³), barème du 16/08/2026. Remplace le plafond de 280 USD par unité payante, qui était le sommet absolu du marché et faisait paraître tout groupage deux à trois fois plus cher qu''il ne l''est. L''unité reste l''unité payante (`up`) : la règle poids/volume est portée par le moteur, et le tarif au m³ s''y applique tel quel puisque le volume domine sur ces marchandises.',
    source = 'Barème de référence MayLary du 16/08/2026, relevés mai-août 2026.',
    valide_du = date '2026-08-16'
where mode = 'maritime' and origine = 'Chine';

update public.app_e08c374bc4_taux_fret
set montant = 6.25,
    nature = 'indicatif',
    note = 'Milieu de la fourchette courante au départ de Chine au-delà de 100 kg (5 à 7,5 USD/kg), barème du 16/08/2026. Remplace le plafond de 9,50. Minimum de facturation conservé : une expédition de deux kilos ne coûte pas deux fois le prix du kilo.',
    source = 'Barème de référence MayLary du 16/08/2026, relevés mai-août 2026.',
    valide_du = date '2026-08-16'
where mode = 'aerien' and origine = 'Chine';

-- L'express reste au-dessus de l'aérien de ligne : c'est sa définition.
update public.app_e08c374bc4_taux_fret
set montant = 11.00,
    nature = 'indicatif',
    note = 'Environ 1,75 fois l''aérien de ligne courant, rapport constaté entre express et fret de ligne. Remplace le plafond de 14 USD. À remplacer par la grille réelle de l''intégrateur dès qu''un compte est ouvert.',
    source = 'Dérivé du barème de référence MayLary du 16/08/2026.',
    valide_du = date '2026-08-16'
where mode = 'express' and origine = 'Chine';
