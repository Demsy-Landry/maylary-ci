-- Le modèle Google par défaut passe de « gemini-2.5-pro » à « gemini-3.6-flash ».
--
-- Motif mesuré, pas préféré. Un appel réel de génération sur chaque modèle et
-- chaque clé a donné ceci :
--
--   clé principale  : 429 RESOURCE_EXHAUSTED sur tous les modèles (crédits épuisés)
--   clé secondaire  : gemini-3.6-flash OK, gemini-3.5-flash OK, gemini-flash-latest OK
--                     gemini-2.5-pro et gemini-3-pro-preview : 429 (les « pro » sont
--                     hors du palier gratuit)
--                     gemini-2.5-flash : 404, « no longer available to new users »
--
-- Deux enseignements valent d'être écrits ici, parce qu'ils reviendront :
--
--  1. La liste renvoyée par /v1beta/models ne dit pas la vérité. Elle annonçait
--     gemini-2.5-flash sur les deux clés, alors que generateContent le refuse
--     aux comptes récents. Seul un appel réel tranche.
--  2. Un modèle « pro » suppose un compte financé. Tant que la classification
--     tourne sur la clé gratuite, un défaut « pro » se traduirait par un 429 à
--     chaque demande — l'outil paraîtrait cassé alors qu'il est seulement mal
--     réglé.
--
-- Le jour où le compte principal est approvisionné, repasser en « pro » est un
-- UPDATE d'une ligne, sans redéploiement. C'était tout l'intérêt d'en faire un
-- réglage : la fiabilité du module ne vient pas du modèle mais de la
-- confrontation du code proposé au corpus TEC.

alter table app_e08c374bc4_parametres_classification
  alter column modele_google set default 'gemini-3.6-flash';

update app_e08c374bc4_parametres_classification
set modele_google = 'gemini-3.6-flash'
where modele_google in ('gemini-2.5-pro', 'gemini-2.5-flash');
