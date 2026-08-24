-- Remettre chaque article dans le mode d'acheminement qui est vraiment le sien
--
-- LA RÈGLE, DITE PAR LE FONDATEUR
--
-- « Le groupage, c'est uniquement pour les articles qui ne sont pas supportés
-- par les modes de transport CJ ou DHL, ou par choix du client lui-même. »
--
-- CE QUI S'ÉTAIT PASSÉ
--
-- La migration 20260824b contenait ceci, dans cet ordre :
--
--     set mode_acheminement = 'groupage'
--     where fret_source is distinct from 'cj_reel' or indisponible_motif is not null;
--
--     set indisponible_motif = null
--     where indisponible_motif in ('fret_non_cote','fret_disproportionne') ...
--
-- La première requête bascule au groupage tout ce qui porte UN MOTIF QUELCONQUE.
-- Or `fret_disproportionne` n'est pas un refus du transporteur : c'est un fret
-- élevé RAPPORTÉ À UNE SEULE PIÈCE. CJ porte parfaitement ces articles.
--
-- La seconde efface ensuite le motif — donc la trace de la raison. Le résultat
-- était indétectable après coup : seize articles se retrouvaient en groupage
-- avec un fret CJ réel au compteur et plus aucune explication.
--
-- CE QU'ON RÉTABLIT
--
-- Un seul critère, et il porte sur le transporteur, jamais sur le prix :
-- le transporteur a-t-il coté cet article, oui ou non ?
--
--   `fret_source = 'cj_reel'`  → CJ a coté  → porte-à-porte CJ.
--   toute autre valeur         → pas de cotation → groupage.
--
-- Le choix du client, lui, se fait au panier et ne concerne pas cette table.
--
-- Ce que ce nettoyage NE règle pas, et qui se règle dans le code : un fret
-- disproportionné à l'unité appelle une COMMANDE MINIMUM, pas une bascule de
-- mode ni une extinction. Voir `_partage/amortir-le-fret.ts`.

update app_e08c374bc4_produits
set mode_acheminement = 'cj_ddp', updated_at = now()
where mode_acheminement = 'groupage' and fret_source = 'cj_reel';

update app_e08c374bc4_produits
set mode_acheminement = 'groupage', updated_at = now()
where fret_source is distinct from 'cj_reel';
