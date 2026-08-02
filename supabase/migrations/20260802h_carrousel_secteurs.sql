-- Visuels de catégorie, plusieurs par rayon pour un défilement.
--
-- Le tableau est vide par défaut : une catégorie sans visuel garde
-- l'illustration dessinée actuelle. C'est ce qui permet de remplir les seize
-- rayons progressivement sans jamais laisser une carte vide en vitrine.
alter table app_e08c374bc4_secteurs
  add column if not exists photos text[] not null default '{}';

comment on column app_e08c374bc4_secteurs.photos is
  'Adresses publiques des visuels du rayon, dans l''ordre de défilement. Vide : on retombe sur l''illustration dessinée.';

-- Huit rayons supplémentaires, choisis sur les besoins réels des entreprises
-- ivoiriennes : des secteurs qui achètent en volume et régulièrement.
insert into app_e08c374bc4_secteurs (nom, icone, actif, ordre_affichage) values
  ('Hôtellerie & Restauration', 'utensils', true, 9),
  ('Santé & Matériel médical', 'stethoscope', true, 10),
  ('Sécurité & Équipements de protection', 'shield', true, 11),
  ('Énergie solaire & Électricité', 'zap', true, 12),
  ('Agroalimentaire & Équipement agricole', 'wheat', true, 13),
  ('Beauté & Cosmétique professionnelle', 'sparkles', true, 14),
  ('Imprimerie & Signalétique', 'printer', true, 15),
  ('Hygiène & Entretien professionnel', 'spray-can', true, 16)
on conflict do nothing;
