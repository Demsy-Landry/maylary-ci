-- ---------------------------------------------------------------------------
-- Les premiers plafonds de fret, tirés des références de marché publiées.
--
-- Le fondateur : « Pour le plafond du fret, fais déjà sur les bases
-- internationales et les règles du transport international. »
--
-- MÉTHODE, parce qu'elle doit pouvoir être contestée ligne à ligne :
--
--   1. On relève la FOURCHETTE publiée par les places de marché du fret pour
--      2026, pas une moyenne ni une impression.
--   2. On prend le HAUT de la fourchette, jamais le milieu.
--   3. On y ajoute la prime des lignes secondaires : Abidjan n'est pas un hub,
--      et les sources notent que les lignes africaines secondaires se paient
--      au-dessus des grandes routes.
--   4. Le résultat est marqué « plafond » : cotable au client AVEC la réserve,
--      jamais gravé dans une facture.
--
-- Ce que ces lignes NE SONT PAS : un tarif. Aucune compagnie ne s'est engagée
-- dessus. Elles servent à ne plus répondre « je ne sais pas » à un client qui
-- demande un ordre de grandeur, tout en garantissant que la facture ne les
-- dépassera pas. Le jour où une cotation compagnie arrive, elle entre en
-- « contractuel » et prime automatiquement sur le plafond.
--
-- La validité est courte — 90 jours. Le fret bouge, et un plafond périmé
-- redevient un mensonge : passée la date, le moteur refuse de s'en servir.
-- ---------------------------------------------------------------------------

insert into app_e08c374bc4_taux_fret
  (mode, origine, destination, compagnie, unite, montant, devise, minimum,
   valide_du, valide_au, nature, source, note)
values

('aerien', 'Chine', 'Abidjan', null, 'kg', 9.50, 'USD', 45,
 current_date, current_date + 90, 'plafond',
 'Fourchette de marché 2026 publiée pour le fret aérien au départ de Chine : 2,5 à 9,0 USD/kg (FreightAmigo, BSI Freight, Suaid Global). Ligne Chine-Ghana relevée à partir de 3,75 USD/kg.',
 'Haut de fourchette 9,0 porté à 9,50 : les sources signalent que les lignes '
 'africaines secondaires se paient au-dessus des grandes routes, et Abidjan '
 'n''est pas un hub. Minimum de facturation 45 USD — tout fret aérien en porte '
 'un, une expédition de deux kilos ne coûte pas deux fois le prix du kilo.'),

('express', 'Chine', 'Abidjan', null, 'kg', 14.00, 'USD', 35,
 current_date, current_date + 90, 'plafond',
 'Dérivé de la fourchette aérienne 2026 : l''express se paie couramment 1,5 à 2 fois le fret aérien de ligne.',
 'Plafond posé à 14 USD/kg, soit environ 1,5 fois le plafond aérien. À '
 'remplacer par les grilles réelles des intégrateurs dès qu''un compte est '
 'ouvert — c''est le poste le plus facile à confirmer, les tarifs express sont '
 'publics.'),

('maritime', 'Chine', 'Abidjan', null, 'up', 280, 'USD', 1,
 current_date, current_date + 90, 'plafond',
 'Fourchette LCL 2026 : 40 à 180 USD/CBM selon la route, et 60 à 280 USD/CBM au départ de Chine (FreightAmigo, Suaid Global). Les sources placent l''Afrique de l''Ouest au-dessus de la route Chine-États-Unis (80 à 180).',
 'Haut de la fourchette Chine retenu tel quel : 280 USD par unité payante. '
 'L''unité payante suit la règle W/M du groupage — on paie le plus grand du '
 'poids et du volume, règle déjà appliquée par le moteur. Minimum une unité '
 'payante : aucun groupeur ne facture une fraction.')

on conflict do nothing;
