-- ---------------------------------------------------------------------------
-- Vos comptes étaient publics. Ils ne le sont plus.
--
-- CE QUE L'AUDIT A TROUVÉ
--
-- Cinq vues internes étaient lisibles avec la seule clé publique du site :
--
--   app_e08c374bc4_grand_livre        le journal de tous les mouvements
--   app_e08c374bc4_balance            la balance des comptes
--   app_e08c374bc4_compte_resultat    le résultat de l'entreprise
--   app_e08c374bc4_qualite_fournisseurs   la notation interne des fournisseurs
--   app_e08c374bc4_reversements_dus   ce que la maison doit à ses vendeurs
--
-- Les tables SOUS ces vues sont pourtant bien protégées : `ecritures`,
-- `comptes` et `journaux` portent chacune une politique « is_admin() ». Le
-- problème est le même que celui des dossiers, sous une autre forme : une vue
-- s'exécute par défaut avec les droits de son PROPRIÉTAIRE, et traverse donc
-- la politique de ses tables sans la voir.
--
-- POURQUOI C'ÉTAIT INVISIBLE, ET POURQUOI C'ÉTAIT GRAVE
--
-- Interrogées aujourd'hui, ces vues rendent « [] ». Pas parce qu'elles sont
-- fermées — parce que la comptabilité est vide. Le contrôle est bien passant :
-- vérifié sur une vue publique comparable, qui rend ses lignes à un appel
-- anonyme.
--
-- Autrement dit : rien ne fuit tant qu'il n'y a rien à faire fuir, et tout
-- fuit à la première vente. C'est le pire moment pour découvrir une faille —
-- le jour où elle commence à livrer des chiffres réels.
--
-- LA CORRECTION
--
-- « security_invoker = true » : la vue s'exécute désormais avec les droits de
-- CELUI QUI LA LIT. Les politiques des tables reprennent la main, et elles
-- disent déjà la bonne chose. On ne réécrit aucune règle de sécurité — on
-- arrête simplement de les contourner.
--
-- Le droit de lecture anonyme est retiré en plus. Deux barrières, comme pour
-- les dossiers : la seconde tient si la première saute un jour.
--
-- Les vues réellement publiques — produits, avis, notes, paliers de prix,
-- vendeurs, achats groupés, campagnes — ne sont pas touchées. Elles doivent
-- rester ouvertes : c'est la vitrine.
-- ---------------------------------------------------------------------------

alter view app_e08c374bc4_grand_livre          set (security_invoker = true);
alter view app_e08c374bc4_balance              set (security_invoker = true);
alter view app_e08c374bc4_compte_resultat      set (security_invoker = true);
alter view app_e08c374bc4_qualite_fournisseurs set (security_invoker = true);
alter view app_e08c374bc4_reversements_dus     set (security_invoker = true);

revoke select on app_e08c374bc4_grand_livre          from anon;
revoke select on app_e08c374bc4_balance              from anon;
revoke select on app_e08c374bc4_compte_resultat      from anon;
revoke select on app_e08c374bc4_qualite_fournisseurs from anon;
revoke select on app_e08c374bc4_reversements_dus     from anon;

-- ---------------------------------------------------------------------------
-- Deux tables gardaient des droits que rien ne justifie.
--
-- `cj_jeton` porte le jeton d'accès au fournisseur, `compteurs_facture` la
-- numérotation des factures. Toutes deux ont RLS active et AUCUNE politique :
-- elles sont donc fermées aujourd'hui, et c'est vérifié. Mais le droit de
-- table restait accordé à l'anonyme — en lecture, en écriture, et jusqu'à la
-- suppression.
--
-- Tant que RLS tient, ce droit ne sert à rien. Le jour où quelqu'un ajoute une
-- politique par commodité, il devient la porte. On le retire maintenant, pas
-- ce jour-là.
-- ---------------------------------------------------------------------------

revoke all on app_e08c374bc4_cj_jeton          from anon, authenticated;
revoke all on app_e08c374bc4_compteurs_facture from anon, authenticated;
