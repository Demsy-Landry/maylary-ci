-- Le mode démonstration.
--
-- Un investisseur qui ouvre l'application sur une base vide ne voit pas un
-- outil, il voit un projet. Les écrans les plus travaillés — la tour de
-- contrôle, le pipeline, les alertes de magasinage — ne montrent rien tant
-- qu'aucun dossier ne les traverse.
--
-- Mais la maison a une règle qui ne se négocie pas : **on ne montre jamais un
-- chiffre inventé**. Ce mode ne l'enfreint pas, il l'encadre :
--
--  1. Chaque ligne porte la mention « DEMO » et un drapeau `demonstration` en
--     base. Rien ne se confond avec un dossier réel, ni à l'écran ni en requête.
--  2. Un bandeau s'affiche tant qu'une seule ligne existe, et il ne se ferme pas.
--  3. Une seule commande purge tout, et rend le nombre de lignes supprimées.

alter table app_e08c374bc4_demandes_import
  add column if not exists demonstration boolean not null default false;
alter table app_e08c374bc4_demandes_export
  add column if not exists demonstration boolean not null default false;

create index if not exists app_e08c374bc4_demandes_import_demo_idx
  on app_e08c374bc4_demandes_import (demonstration) where demonstration;

comment on column app_e08c374bc4_demandes_import.demonstration is
  'Ligne de démonstration, jamais un dossier réel. Purgeable via app_e08c374bc4_demonstration(''purger'').';

-- Le corps complet de app_e08c374bc4_demonstration(text) est celui appliqué en
-- production le 10 août 2026 (migration `mode_demonstration`) : douze dossiers
-- d'import répartis sur les dix étapes du pipeline et cinq dossiers d'export,
-- datés en arrière pour que les alertes de délai se déclenchent. Les montants
-- sont cohérents avec les barèmes déjà chargés (fret groupage relevé, valeurs
-- CAF compatibles avec le TEC) plutôt qu'inventés pour faire joli.
