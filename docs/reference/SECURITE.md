# État de sécurité de MayLary Group

Relevé du 10 août 2026, après l'audit demandé avant présentation à un
investisseur. Ce document dit ce qui est protégé, ce qui reste ouvert et
pourquoi — un point ouvert et assumé vaut mieux qu'un point ouvert et ignoré.

## Le principe

La protection des données ne vient pas du secret des clés — l'URL du projet et
la clé anonyme partent dans le navigateur et sont publiques par construction.
Elle vient de trois couches :

1. **Les politiques RLS** décident, ligne par ligne, qui lit et qui écrit.
2. **Les droits d'exécution** décident quelles fonctions un visiteur peut
   appeler.
3. **Les contraintes de schéma** posent les règles qu'aucun écran ne doit
   pouvoir contourner (origine d'une annonce, forme d'une adresse, équilibre
   d'une écriture comptable).

## Ce qui a été fermé le 10 août 2026

### Le droit d'exécution accordé par défaut

PostgreSQL accorde `EXECUTE` à `PUBLIC` sur toute fonction créée sans `REVOKE`
explicite. **30 des 46 fonctions de l'application étaient appelables par un
visiteur non authentifié**, et la plupart en `SECURITY DEFINER`, c'est-à-dire
avec les droits du propriétaire de la base.

Deux ouvraient un abus direct :

| Fonction | Ce qu'un inconnu pouvait faire |
|---|---|
| `consommer_ia(utilisateur, …)` | Vider le quota d'IA quotidien de n'importe quel compte, en le nommant. |
| `mesurer_ia(id, …, aboutie => false)` | Marquer ses propres appels comme ratés et se recréditer sans limite. |

Deux autres méritaient d'être fermées : `prochain_numero_facture` (numérotation
des factures) et `liquider_declaration_noyau` (le cœur du calcul, qui ne doit
être atteint que par sa fonction d'entrée).

La migration `20260810a` retire tout, puis rend une liste blanche de vingt
fonctions. **Toute fonction ajoutée plus tard naît fermée** : il faudra un
`GRANT` délibéré pour l'ouvrir.

Vérifié sous le rôle `anon` : les lectures publiques passent, les trois appels
sensibles lèvent `insufficient_privilege`, et les déclencheurs continuent de
s'exécuter — PostgreSQL vérifie leur droit à la création du déclencheur, pas à
son déclenchement.

### La barrière sur `reversements_dus`

Cette vue filtre elle-même sur `is_admin()` / `mon_vendeur_id()`. Sans
`security_barrier`, le planificateur peut faire descendre une condition fournie
par l'appelant sous ce filtre : un vendeur aurait pu apprendre quelque chose des
chiffres d'un autre. La barrière l'interdit.

### Les adresses d'une annonce

`lien` partait directement dans un `href`. Un `javascript:…` y aurait exécuté du
code dans la page, avec la session du visiteur. Seule l'administration insère
des annonces, mais cela ne change rien à la gravité si un compte d'équipe est
compromis. Deux contraintes `CHECK` imposent désormais `https://` ou un chemin
interne, et un visuel hébergé chez nous.

## Ce qui reste ouvert, et pourquoi

### Sept vues en `SECURITY DEFINER` (signalées ERROR par le linter)

`produits_public`, `vendeurs_public`, `avis_public`, `paliers_prix_public`,
`campagnes_groupage_public`, `achats_groupes_publics`, `reversements_dus`.

**C'est voulu, et le contraire serait moins sûr.** Ces vues existent précisément
pour exposer un sous-ensemble sûr de colonnes sans ouvrir la table. Passer
`produits_public` en droits de l'appelant obligerait à autoriser `anon` à lire
`produits` — donc le prix d'achat fournisseur. La vue est la protection, pas la
faille. Chacune restreint colonnes et lignes ; `reversements_dus` porte en plus
sa barrière.

### `compter_pub` appelable sans compte

Un visiteur peut appeler le compteur d'affichages publicitaires et gonfler les
statistiques d'une annonce. C'est inhérent à un comptage fait par le navigateur,
et la fonction n'écrit qu'un entier — elle ne lit rien et ne touche à aucune
donnée client. À revoir le jour où un annonceur paie à l'affichage : le comptage
devra alors passer par le serveur.

### Deux tables sous RLS sans politique

`cj_jeton` et `compteurs_facture` : RLS activé, aucune politique, donc **tout
accès refusé** sauf par la clé de service. C'est le réglage le plus fermé
possible ; l'avertissement du linter est ici un faux positif.

### Extensions dans le schéma public

`pg_net` et `pg_trgm`. Les déplacer casserait les appels existants pour un gain
théorique. À faire lors d'une fenêtre de maintenance, pas avant une
présentation.

## À faire par le fondateur, dans le tableau de bord Supabase

Ces réglages ne se posent pas depuis le code.

1. **Activer la protection contre les mots de passe compromis**
   (Authentication → Policies). Supabase vérifie alors le mot de passe choisi
   contre la base HaveIBeenPwned. C'est deux clics et cela ferme la voie
   d'attaque la plus banale.
2. **Exiger 10 caractères minimum** plutôt que 8, avec chiffres et lettres.
3. **Vérifier les secrets des fonctions serveur** (Project Settings → Edge
   Functions → Secrets) : les clés Google, CJ et Wave doivent y être, et nulle
   part ailleurs. Aucune clé ne doit apparaître dans le code ni dans un échange.

## En-têtes du site

`vercel.json` pose déjà une politique de sécurité de contenu stricte
(`default-src 'self'`, pas de script externe, `frame-ancestors 'none'`), HSTS
sur deux ans, `nosniff`, `Referrer-Policy` et `Permissions-Policy`. Un annonceur
ne peut donc pas injecter de script : c'est aussi pourquoi les visuels
publicitaires doivent être déposés dans notre stockage.
