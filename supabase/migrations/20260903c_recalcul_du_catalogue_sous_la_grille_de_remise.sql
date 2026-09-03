-- Remettre tout le catalogue en file de retarification, et le faire avancer.
--
-- POURQUOI
--
-- Les 513 fiches importées portent des grilles calculées sous une règle
-- fausse : le garde-fou des paliers comparait des prix de marchandise, qui ne
-- contiennent plus le transport depuis qu'il est facturé à part. Il ne rejetait
-- donc plus rien, et des paliers où le prix RENDU montait étaient publiés comme
-- des remises de volume.
--
-- Mesuré au banc d'essai sur vingt articles : dix-huit paliers à rejeter. Le
-- pire, un demi-casque de scooter, annonçait une dégressivité alors que la
-- pièce passait de 41 670 F à l'unité à 59 305 F par deux cents.
--
-- S'ajoute la grille de remise du 3 septembre : les marges 40 / 30 / 22 / 15 %
-- et les seuils 1 / 10 / 50 / 200 ne peuvent s'appliquer qu'en recalculant.
--
-- COMMENT
--
-- Vider `paliers_calcules_le` remet un article dans la file. C'est le seul
-- signal que `tarifer_lancer` accepte : il lit sa cible en base et refuse
-- qu'on la lui dicte, si bien qu'un appelant anonyme ne peut qu'avancer un
-- travail déjà mis en file par un administrateur.
--
-- LA CADENCE, ET POURQUOI ELLE EST LENTE
--
-- Chaque article coûte un appel au transporteur par palier, et il ne répond
-- qu'une fois par seconde — cadence partagée avec les cinq autres tâches. Neuf
-- articles toutes les deux minutes tiennent le catalogue en un peu moins de
-- deux heures sans jamais saturer la file.
--
-- Une erreur passagère du transporteur ferait basculer un article en groupage à
-- tort. Ce n'est pas définitif : la branche concernée repose `fret_source` à
-- `forfait`, et `cj_amortir` reprend précisément les articles en `forfait` à
-- chaque demi-heure. Le catalogue se répare de lui-même au passage suivant.
--
-- À FAIRE QUAND LA FILE EST VIDE
--
-- Cette tâche ne s'arrête pas seule : elle continuera d'appeler le lanceur, qui
-- répondra « Aucun article à retarifer » sans rien consommer chez le
-- transporteur. C'est inoffensif mais inutile. La retirer alors :
--
--     select cron.unschedule('maylary-recalcul-grille-remise');

update public.app_e08c374bc4_produits
set paliers_calcules_le = null
where source_donnee = 'import_cj_dropshipping'
  and reference_externe is not null;

select cron.schedule(
  'maylary-recalcul-grille-remise',
  '*/2 * * * *',
  $$select net.http_post(
      url := 'https://oubowmftzxpruckjzwuq.supabase.co/functions/v1/app_e08c374bc4_tarifer_lancer',
      body := '{"simulation":false,"lots":3,"taille_lot":3}'::jsonb,
      headers := jsonb_build_object('Content-Type','application/json'),
      timeout_milliseconds := 100000
    )$$
);
