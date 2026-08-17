-- Élargir la gamme : par quelle porte chaque fournisseur entre.
--
-- LA DEMANDE, ET LA RÉSERVE QU'ELLE APPELLE
--
-- « Nous pouvons intégrer ces fournisseurs via API pour élargir la gamme des
-- produits qu'on vend. » Techniquement oui. Mais notre propre analyse a montré
-- que le problème de prix ne vient PAS d'un manque de références : il vient du
-- mode d'acheminement. L'express au colis coûte trente-huit fois le groupage.
--
-- Brancher dix plateformes de dropshipping au détail multiplierait donc le
-- catalogue ET l'exposition au même surcoût. Ce n'est pas un élargissement,
-- c'est un élargissement du problème.
--
-- CE QUI CHANGE TOUT : LE RÔLE
--
-- Le modèle en base savait déjà distinguer, sans le dire : CJ est en DDP —
-- droits acquittés, livré à l'adresse — quand BigBuy, VidaXL et
-- Brandsdistribution sont en EXW, c'est-à-dire que c'est NOUS qui importons.
-- La colonne `role` nomme cette coupure et en ajoute deux autres :
--
--   boutique_ddp             livre en Côte d'Ivoire droits acquittés :
--                            vendable directement en boutique
--   import_exw               part d'un entrepôt : Espace Pro, conteneur ou
--                            groupage, avec toute la chaîne douanière
--   catalogue_sourcing       sert à TROUVER un fournisseur, pas à expédier
--   impression_a_la_demande  personnalisation : une ligne de service, pas une
--                            gamme
--
-- AutoDS relève du troisième cas et mérite d'être dit : ce n'est pas un
-- fournisseur, c'est une couche d'automatisation posée sur d'autres sources.
-- L'intégrer n'ajouterait aucune référence.
--
-- `livre_cote_divoire` EST NUL, ET C'EST LE POINT
--
-- Spocket, Zendrop, Doba, Wholesale2B, Modalyst sont bâtis pour les marchés
-- américain et européen, et vendus sur la rapidité de livraison LÀ-BAS. Leur
-- capacité à livrer Abidjan décide de tout, et elle ne se suppose pas : la
-- colonne reste nulle tant qu'un essai réel ne l'a pas tranchée.
--
-- Seul AliExpress entre en boutique sans réserve de principe : gros catalogue,
-- prix bas, et de nombreux vendeurs acceptent le maritime consolidé — le seul
-- mode qui règle notre écart de prix.

alter table public.app_e08c374bc4_fournisseurs
  drop constraint if exists app_e08c374bc4_fournisseurs_modele_check;
alter table public.app_e08c374bc4_fournisseurs
  add constraint app_e08c374bc4_fournisseurs_modele_check
  check (modele in ('gros','dropshipping','annuaire','organisme','impression'));

alter table public.app_e08c374bc4_fournisseurs
  add column if not exists role text
    check (role in ('boutique_ddp','import_exw','catalogue_sourcing','impression_a_la_demande')),
  add column if not exists livre_cote_divoire boolean,
  add column if not exists livraison_verifiee_le date;

-- Le rôle des quatre fournisseurs existants découle de leur incoterm.
update public.app_e08c374bc4_fournisseurs
set role = case when incoterm_defaut = 'DDP' then 'boutique_ddp' else 'import_exw' end,
    livre_cote_divoire = case when incoterm_defaut = 'DDP' then true else null end,
    livraison_verifiee_le = case when incoterm_defaut = 'DDP' then current_date else null end
where role is null;

-- Les douze plateformes proposées sont chargées par la migration appliquée en
-- base, chacune avec son rôle, sa devise et sa réserve de livraison.
