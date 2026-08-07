# Maylary — plan directeur

*Document de travail, 7 août 2026. Écrit pour être repris, discuté et corrigé —
pas pour être appliqué tel quel. Il sert de base à la conversation de cadrage
avec le fondateur.*

---

## 1. Ce qu'est Maylary

**La phrase à tenir :** en Côte d'Ivoire, importer est un métier d'initié.
Maylary en fait un achat.

Aujourd'hui, un Ivoirien qui veut faire venir une machine, un lot de
marchandise ou un simple équipement doit connaître quelqu'un. Il négocie un
prix par WhatsApp avec un agent, il ne sait pas ce qu'il paie, il découvre les
frais au port, et il n'a aucun recours. Le commerce se fait à la confiance
personnelle, et la confiance personnelle ne s'étend pas.

Maylary remplace cette chaîne d'initiés par un service : **vous choisissez,
vous payez, le reste est fait.** Pas « une plateforme qui met en relation » —
un opérateur qui répond de bout en bout.

**Les deux actifs qu'aucun concurrent numérique n'a :**

1. **Le fondateur est transitaire de métier.** Il connaît le port, la douane,
   les barèmes, les délais réels, et les endroits où les autres ajoutent leur
   marge sans le dire. Un site de e-commerce ne peut pas apprendre ça ; un
   transitaire peut apprendre à faire un site.
2. **`le-declarant.com`, déjà en ligne**, qui résout le classement tarifaire et
   le calcul des droits et taxes. C'est-à-dire exactement l'étape que
   j'identifiais comme le verrou de toute la chaîne. Voir le § 4.

**La direction :** faire de Maylary l'infrastructure du commerce importé en
Côte d'Ivoire, puis dans la sous-région, puis partout où le même problème
existe — c'est-à-dire dans la plus grande partie du monde qui n'est ni
l'Europe ni l'Amérique du Nord.

---

## 2. Où nous en sommes réellement

Inventaire honnête. La colonne qui compte est la troisième.

### Construit, éprouvé sur données réelles

| Brique | État |
|---|---|
| Boutique grand public | Catalogue, panier, commande, choix du transporteur, **fret affiché séparément du prix** |
| Espace Pro | 16 rayons, demandes de devis |
| Import | Demande → cotation → devis → validation client → suivi → documents |
| Export | Même circuit, sens inverse |
| Sourcing sur demande | Le client décrit, Maylary cherche et chiffre |
| Coût de revient | FOB + fret réel + assurance au **barème CIMA réel** + douane. Aucune valeur inventée sauf celles listées au § 7 |
| Facturation | Proforma et facture définitive, PDF |
| Comptabilité | Partie double SYSCOHADA, équilibre **imposé par la base**, contrepassation obligatoire |
| Qualité fournisseur | Avis clients après livraison + incidents par atelier |
| Marketplace | Inscription vendeur, commission, reversements |
| Paiement | Wave (lien), virement SGCI, Orange Money (inactif). Référence **et** reçu obligatoires, montant contrôlé, référence non réutilisable |
| Garantie « payé, protégé » | Reversement bloqué en base tant que la réception n'est pas acquise |
| Achat groupé | Réservation sans paiement, prix ferme, seuil, conversion en commandes |
| Données personnelles | Politique publiée, RLS prouvée table par table |
| **`le-declarant.com`** | **En ligne, hors Maylary.** Classement tarifaire et calcul des droits et taxes — le verrou de la chaîne, déjà ouvert |

### Construit mais vide

| Brique | Réalité |
|---|---|
| Marketplace | **0 vendeur inscrit** |
| Achats groupés | **0 campagne ouverte** |
| Comptabilité | **0 écriture** — aucune commande n'a encore été comptabilisée |
| Commandes | 7 créées, **aucune payée et confirmée** |

C'est le point le plus important de ce document. **Maylary n'a pas encore fait
une seule vente complète.** Tout le reste est de la capacité, pas de
l'activité.

### Manquant

- **Confirmation de paiement automatique** — la clé d'API Wave n'est pas
  obtenue ; chaque règlement se vérifie à la main.
- **Déclaration ARTCI** — obligatoire, annoncée dans la politique publiée.
- **Deux inconnues du modèle de coût** : le tarif du transitaire maritime, et
  la catégorie douanière par famille de produits.
- **Suivi sans compte** — celui qui reçoit n'est pas toujours celui qui commande.
- **Carnet d'importation client** — l'historique douanier, utile au client au
  moment de sa propre déclaration.
- **Service client organisé** — pas de canal, pas de délai de réponse annoncé,
  pas de traçabilité des échanges.
- **Dernier kilomètre** — aucun accord de livraison formalisé.
- **Stock et entrepôt** — aucune notion de marchandise détenue.
- **Mesure** — aucune audience mesurée, donc aucune décision fondée sur l'usage.

---

## 3. La cible : « choisir et payer, le reste est fait »

Pour tenir cette promesse, il faut savoir précisément ce que « le reste »
contient. Voici la chaîne réelle d'une importation, étape par étape, avec ce
qui est déjà automatique, ce qui peut l'être, et ce qui ne le sera jamais.

| # | Étape | Aujourd'hui | Peut devenir |
|---|---|---|---|
| 1 | Exprimer le besoin (photo, lien, description) | Formulaire | Automatique — un agent lit une photo ou un lien et propose la fiche |
| 2 | Trouver le fournisseur, vérifier sa fiabilité | CJ automatique, sourcing manuel | Semi-automatique — la note fournisseur maison devient le filtre |
| 3 | Chiffrer marchandise + fret + assurance + douane + transit | **Déjà automatique** | C'est l'atout ; reste à couvrir plus d'origines |
| 4 | **Classer la marchandise (position tarifaire SH), calculer droits et taxes** | **`le-declarant.com`, déjà en ligne** — mais séparé de Maylary | À brancher. Voir § 4 |
| 5 | Payer | Manuel (Wave, virement) | Automatique dès l'API Wave |
| 6 | Commander chez le fournisseur | CJ automatique, autres manuels | Extensible par API et par courriel structuré |
| 7 | Suivre l'acheminement | CJ automatique, maritime manuel | Automatique par intégration transitaire / compagnie |
| 8 | **Dédouaner** | Fondateur, agréé | **Restera humain.** C'est la barrière à l'entrée et l'actif de l'entreprise |
| 9 | Livrer le dernier kilomètre | Non organisé | Partenariat + suivi intégré |
| 10 | Facturer et comptabiliser | **Déjà automatique** | Rien à faire, sinon brancher les écritures |
| 11 | Après-vente, avis, qualité fournisseur | **Déjà automatique** | Alimente la boucle en 2 |

**Lecture :** **quatre** étapes sur onze sont déjà résolues quelque part — 3,
4, 10 et 11 — et ce sont les plus difficiles à copier. La 4 l'est dans une
autre application, ce qui n'est pas la même chose qu'être résolue dans
celle-ci : c'est un branchement à faire, pas un problème à traiter.

Une seule étape ne sera jamais automatique, et c'est tant mieux : la **8**, le
dédouanement, qui engage la responsabilité d'un déclarant agréé. C'est elle qui
empêche un pur acteur numérique de vous concurrencer, et elle vous appartient.

### Les agents IA — où ils servent, où ils nuisent

À introduire, avec un humain qui tranche :

- **Assister Le Déclarant, pas le remplacer** — un agent qui traduit une
  description de client (« une machine à coudre industrielle, 120 kg ») en une
  requête exploitable par le moteur tarifaire, et qui explique le résultat au
  client en français ordinaire.
- **Lecture de documents** — facture fournisseur, connaissement, déclaration :
  extraire les montants, les poids, les positions, et les rapprocher du devis.
- **Rédaction des réponses client** — brouillon systématique, envoi supervisé.
- **Détection d'anomalie** — un devis qui s'écarte du modèle de coût, un poids
  incohérent avec le volume, un fournisseur dont la note se dégrade.
- **Veille prix** — le même article chez plusieurs fournisseurs.

À ne pas confier à un agent, jamais :

- **Engager la responsabilité douanière.** Une déclaration erronée est une
  faute de l'entreprise, pas du modèle.
- **Confirmer un paiement.** Tant que la vérification est humaine, elle reste
  humaine ; le jour où elle est automatique, elle vient de la banque, pas d'un
  agent.
- **Fixer un prix seul.** Le modèle de coût décide ; un agent peut le
  contester, pas le remplacer.
- **Parler au client sans supervision**, tant que la réputation se construit.

---

## 4. Le Déclarant : le second actif, et ce qu'il change

`le-declarant.com` est en ligne et résout le classement tarifaire et le calcul
des droits et taxes. C'est **le verrou de toute la chaîne d'importation**, et
vous l'avez déjà ouvert — dans une autre application.

### Ce que ça change concrètement

Aujourd'hui, Maylary ne sait chiffrer automatiquement que ce qui vient de CJ
Dropshipping, parce que le reste demande de savoir *sous quelle position
tarifaire* la marchandise entre et *quels taux* s'y appliquent. C'est la raison
pour laquelle une demande d'import passe par un atelier de cotation manuel.

Branchez Le Déclarant, et cette limite tombe : Maylary sait chiffrer
**n'importe quelle marchandise, de n'importe quelle origine**, sans vous.
C'est-à-dire, littéralement, votre phrase — *il choisit, il paie, le reste est
fait.*

Ce n'est plus une fonction à construire. C'est un branchement.

### La question stratégique : un produit ou deux ?

Vous avez maintenant deux applications qui se répondent. Trois façons de les
tenir, et elles n'ont pas la même valeur.

| | Ce que ça donne | Le risque |
|---|---|---|
| **Fusionner** — Le Déclarant devient un onglet de Maylary | Un seul produit, une seule histoire | On perd un service qui a ses propres utilisateurs, et qui parle à des transitaires que Maylary n'intéresse pas |
| **Séparer complètement** | Deux produits, deux marchés | Deux fois le travail, à deux, en freelance. Intenable |
| **Moteur et véhicule** — Le Déclarant reste un service, Maylary le consomme par API | Un actif technique réutilisable, deux revenus | Demande de traiter Le Déclarant comme un service et non comme un site : version, disponibilité, contrat |

**Ma recommandation : moteur et véhicule.**

Le Déclarant devient le service de référence tarifaire. Maylary l'appelle pour
chiffrer. Et — c'est là que ça devient intéressant — **les autres transitaires
ivoiriens peuvent l'appeler aussi, contre paiement**. Vous connaissez la
profession, vous savez combien de temps un déclarant passe à chercher une
position et à recalculer une liquidation.

Ça vous donne :

- **un revenu qui ne dépend pas du commerce** — donc qui tient pendant que
  Maylary cherche ses premiers clients ;
- **une barrière qui grandit toute seule** : chaque question posée au service
  améliore la base de correspondances, et personne d'autre ne l'a ;
- **une raison d'exister devant un financeur** qui ne repose pas sur des
  volumes que vous n'avez pas encore.

C'est aussi cohérent avec la vision d'expansion : un moteur tarifaire se porte
d'un pays à l'autre bien plus facilement qu'une opération logistique. Le TEC de
l'UEMOA est commun à huit pays.

### Ce que j'ai besoin de savoir pour le brancher

Je n'ai pas pu ouvrir le site depuis cet environnement — l'accès sortant y est
filtré. Donc, honnêtement, je ne sais rien de sa technique. Ce qui manque :

1. **Y a-t-il une API**, ou seulement une interface web ?
2. **Sur quoi c'est construit** — Supabase aussi ? Même compte ? Quel dépôt ?
3. **D'où viennent les données tarifaires** — TEC UEMOA, tarif DGD, saisie
   manuelle ? Et **comment sont-elles tenues à jour** ? C'est la question la
   plus importante : un moteur tarifaire périmé est pire qu'inutile.
4. **Ce qu'on lui donne en entrée** : une description libre, un code SH déjà
   connu, une photo ?
5. **Ce qu'il rend** : la position seule, ou la liquidation complète — DD, RS,
   PCS, PC, taxe statistique, TVA, AIRSI ?
6. **Calcule-t-il la valeur en douane** (CAF) ou part-il d'une valeur fournie ?
7. **Qui s'en sert aujourd'hui**, et est-ce payant ?

Répondez à ces sept points et je peux chiffrer le branchement précisément.

---

## 5. Les quatre horizons

Chaque horizon a une **condition de sortie**. On ne passe pas au suivant tant
qu'elle n'est pas remplie — c'est la seule protection contre le travail
d'accumulation.

### H0 — Prouver la boucle *(rien d'autre ne compte)*

Faire **une** vente complète, de bout en bout, avec un vrai client et un vrai
fournisseur : commande → paiement vérifié → achat fournisseur → acheminement →
dédouanement → livraison → confirmation de réception → facture → écriture
comptable → avis client.

Pourquoi d'abord : chaque brique a été vérifiée seule ; aucune n'a été
vérifiée dans la chaîne. Une entreprise qui n'a pas encaissé une fois ne sait
pas ce qu'elle vend.

**Condition de sortie :** une commande à l'état « livrée », une écriture
comptable équilibrée qui la reflète, un avis client déposé.

À faire dans H0 :
- financer le compte fournisseur ;
- obtenir le tarif du transitaire maritime ;
- fixer la catégorie douanière des familles déjà au catalogue ;
- déclarer à l'ARTCI ;
- brancher la comptabilisation automatique des commandes payées.

### H1 — Rendre l'import self-service

Ce qui manque pour qu'un particulier sans expérience aille au bout tout seul.

- Confirmation de paiement automatique (API Wave, ou constat bancaire).
- Suivi par référence, sans compte.
- **Brancher Le Déclarant** — c'est ce qui fait passer le chiffrage automatique
  de « les articles CJ » à « n'importe quelle marchandise ». Priorité de l'horizon.
- Service client : un canal, un délai annoncé, une trace.
- Le prix rendu écrit comme un engagement opposable.
- Mesure d'audience, pour savoir où les gens abandonnent.

**Condition de sortie :** dix commandes payées sans intervention manuelle
autre que le dédouanement.

### H2 — Industrialiser

- Agents IA sur les étapes 1, 2, 4 (proposition), 5 (contrôle), 11.
- Lecture automatique des documents de transit.
- Entrepôt et stock : détenir de la marchandise change le modèle — délais
  courts, prix stables, mais trésorerie immobilisée. **Décision de fond.**
- Dernier kilomètre contractualisé.
- Marketplace vraiment peuplée : la garantie « payé, protégé » est l'argument
  de recrutement des vendeurs, il faut aller les chercher.
- Achats groupés récurrents, adossés aux expéditions consolidées réelles.

**Condition de sortie :** le coût de traitement d'une commande cesse de
croître avec le nombre de commandes.

### H3 — Étendre

- Autres origines que la Chine (Turquie, Inde, Dubaï, Europe).
- Autres destinations UEMOA — même monnaie, même code des douanes, friction
  minimale : c'est l'expansion la moins chère du monde.
- Multidevise et multilingue.
- Le modèle de coût devient un produit en soi : d'autres transitaires
  pourraient le payer.

---

## 6. Comment nous travaillons

Ces règles ont déjà servi et méritent d'être écrites, parce qu'elles sont ce
qui distingue « coder » de « construire une entreprise ».

1. **Le prix ne bouge jamais après paiement.** Cette règle a déjà déterminé la
   forme de l'achat groupé. Elle en déterminera d'autres.
2. **La base fait respecter les règles, pas l'écran.** Un écran se contourne.
   Ce qui compte est écrit en contrainte, en politique RLS ou en déclencheur.
3. **Mesurer, corriger, remesurer.** Aucun « c'est corrigé » sans un chiffre
   avant et un chiffre après.
4. **Prouver sur données réelles**, puis supprimer le jeu d'essai.
5. **Dire ce qui n'a pas été vérifié.** Une incertitude annoncée coûte moins
   cher qu'une certitude fausse.
6. **Vendre la fiabilité, pas le prix.** Le prix absolu compte moins que la
   valeur et la tenue de la promesse.
7. **Construire pour l'expansion.** Aucune valeur codée en dur qui empêcherait
   un second pays, une seconde devise, un second entrepôt.

---

## 7. Ce qui dépend du fondateur, et de lui seul

| Sujet | Pourquoi c'est bloquant |
|---|---|
| Déclaration ARTCI | Obligation légale, déjà annoncée publiquement |
| Clé d'API Wave | Sans elle, chaque paiement se vérifie à la main — H1 ne peut pas se terminer |
| Financer le compte fournisseur | Sans lui, aucune commande réelle |
| Tarif du transitaire maritime | Dernière inconnue du fret |
| Catégorie douanière par famille | Dernière inconnue de la douane |
| Validation du plan de comptes par un expert-comptable | Avant tout dépôt d'états financiers |
| Qui tranche un litige de livraison | La garantie existe, l'arbitrage n'est pas organisé |
| Détenir du stock, ou non | Change le modèle économique en entier |
| Répondre aux sept questions sur Le Déclarant (§ 4) | Sans elles, impossible de chiffrer le branchement |

---

## 8. Ce qu'il faut trancher dans la conversation de cadrage

Questions ouvertes, classées par ce qu'elles engagent.

**Modèle**
1. Maylary est-il un **opérateur** (achète, détient, revend, répond de tout) ou
   un **intermédiaire** (met en relation, prend une commission) ? Aujourd'hui
   l'application fait les deux. Les deux ne se défendent pas de la même façon,
   ne se financent pas pareil, et n'ont pas la même valeur.
2. Le stock : jamais, jamais avant H2, ou tout de suite sur quelques références
   à rotation rapide ?
3. La marketplace mérite-t-elle un effort commercial maintenant, ou attend-elle
   que la boutique tourne ?

**Modèle (suite)**
3 bis. **Le Déclarant : moteur, onglet ou produit séparé ?** Voir § 4. C'est
   probablement la décision la plus lourde de conséquences de toute cette
   liste — elle détermine s'il y a une ou deux sources de revenu.

**Client**
4. Qui est le client prioritaire — le particulier qui importe une fois, ou la
   PME qui importe tous les mois ? Ils ne veulent pas la même application.
5. Le paiement à la livraison : refusé par principe, ou proposé un jour comme
   arme commerciale ?

**Métier**
6. Jusqu'où va la promesse « tout compris » ? Douane comprise, oui — mais les
   surestaries, les contrôles, les jours de magasinage ?
7. Que fait-on quand un fournisseur livre non conforme ? Qui supporte ?

**Technique et IA**
8. Quel premier agent construit-on : le classement tarifaire (le plus
   rentable) ou la lecture de documents (le plus visible) ?
9. Accepte-t-on qu'un agent écrive au client, même supervisé ?

**Rythme**
10. Combien d'heures par semaine le fondateur peut-il réellement consacrer aux
    tâches qui n'appartiennent qu'à lui ? C'est ce chiffre, et non la vitesse
    de développement, qui fixe la durée de H0.

---

## 9. Ce que je propose, si l'on ne devait retenir qu'une chose

**Arrêter d'ajouter des fonctions et terminer une vente.**

L'application sait déjà faire plus de choses que l'entreprise n'en a jamais
vendu. Chaque brique nouvelle augmente l'écart entre ce qui est possible et ce
qui est prouvé. La première commande réellement livrée, encaissée et
comptabilisée apprendra davantage que les six positions restantes de la note de
marché.

C'est aussi le seul moyen d'être crédible pour la suite : devant un
partenaire, un investisseur ou un vendeur qu'on veut recruter, « nous savons
faire » vaut ce que vaut « nous avons fait ».
