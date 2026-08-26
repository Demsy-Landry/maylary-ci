-- Une barre de qualité mesurable, et le rayon Quincaillerie enfin garni
--
-- CE QUE LE FONDATEUR DEMANDE, ET CE QUE CJ PERMET
--
-- « Tous les articles doivent être chez des fournisseurs certifiés avec des
-- avis favorables. »
--
-- CJ n'expose NI le fournisseur, NI sa note, NI le moindre avis. Vérifié sur
-- des réponses brutes : `supplierName` et `supplierId` sont nuls, et le seul
-- `supplierId` rencontré valait « 9999 » — un bouche-trou. La demande, prise au
-- pied de la lettre, est irréalisable avec cette source.
--
-- Ce que CJ expose, c'est `listedNum` : LE NOMBRE DE MARCHANDS QUI REVENDENT
-- l'article. C'est un signal de marché réel — un produit que onze boutiques ont
-- mis en rayon a été validé par d'autres avant nous ; un produit que personne
-- ne revend ne l'a pas été. C'est un SUBSTITUT, et il est nommé comme tel.
--
-- POURQUOI LA BARRE EST À 1 ET NON À 3
--
-- Mesuré : à 3 marchands, la recherche « drill » rend 3 candidats sur 60 — et
-- 2 des 3 ne sont pas des perceuses (« drill-free », « No Drill » ont matché le
-- mot). Un seul article pertinent sur soixante.
--
-- À 1 marchand, la même famille de recherche rend une vingtaine de candidats
-- dont l'essentiel tient debout : coffrets de douilles, clés à choc, crics.
--
-- La barre reste dans les réglages, pas dans le code : elle se relèvera le jour
-- où le catalogue sera assez fourni pour être exigeant.
--
-- CE QUE LE CHIFFRE DIT DE L'OBJECTIF DE CENT ARTICLES PAR RAYON
--
-- Dix-neuf rayons à cent articles font mille neuf cents références. Au rendement
-- observé, et à un appel toutes les 1,6 seconde plus cinq appels de devis par
-- article importé, on parle de dizaines d'heures d'appels — et CJ a déjà bloqué
-- une fois sur sa limite de sessions par adresse IP. Le catalogue de CJ ne
-- contient vraisemblablement pas cent articles de quincaillerie sérieux.
-- Cible retenue avec le fondateur : trente à quarante par rayon.

update app_e08c374bc4_parametres_import
set marchands_minimum = 1, updated_at = now()
where id = 1;

-- Douze articles retenus pour Quincaillerie & BTP sur soixante regardés, tous
-- revendus par au moins un marchand, deux poids aberrants écartés au passage
-- (460 kg et 29 tonnes annoncés pour des clés). Nommés, décrits, tarifés et
-- mis en ligne — contenu appliqué en base, ce fichier tient lieu de trace.
