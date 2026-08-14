# Ce qu'il me faut pour finir l'application

**Établi le 14 août 2026.** Chaque ligne dit : ce que je demande, sous quelle
forme, ce que ça débloque. Rien ici n'est du confort — ce sont les endroits où
le code est écrit, testé, en production, et où il refuse de fonctionner faute
de la donnée réelle. C'est voulu : la règle du projet est qu'aucun chiffre
inventé n'entre dans un prix.

État mesuré en base le 14 août 2026 :

| Table | Contenu |
|---|---|
| `tec_dd_reference` (positions tarifaires) | **6 298** ✅ |
| `regimes_origine` (droit commun, APE, ZLECAf, CEDEAO) | **4** ✅ |
| `produits` (catalogue) | **60** ✅ |
| `marchandises_reglementees` (fiches AIRP) | **3** ⚠️ à élargir |
| `frais_transit_local` | 15 postes, **4 confirmés**, 11 à confirmer ⚠️ |
| `taux_fret` | **0 ligne** ❌ |
| `commandes_gp` | **0** — les 7 commandes d'essai ont été supprimées le 14/08 ✅ |
| `ecritures` (comptabilité) | **0** ❌ |
| `vendeurs` (marketplace) | **0** ❌ |

---

## P0 — Sans ça, la boucle de vente ne peut pas être prouvée

### 00. VERCEL REFUSE DE CONSTRUIRE — le site ne reçoit plus aucune mise à jour

**Mesuré le 14 août 2026 au soir.** Les cinq derniers déploiements de
production sont en `ERROR`. Ce n'est pas notre code : le build local passe en
1,6 seconde, et côté Vercel il n'y a **aucun journal de construction** — la
construction n'a jamais démarré.

| Déploiement | Durée | Erreur |
|---|---|---|
| `dadaab7` (le travail de ce soir) | 0,5 s | `BUILD_FAILED — Resource provisioning failed` |
| `917a806` | 0,6 s | idem |
| `9483116` | 0,6 s | idem |
| `2587fdf` | 0,6 s | idem |
| `560c1a9` | 0,6 s | idem |

Cinq échecs identiques, instantanés, sans journal : la construction est
refusée **avant** d'être lancée. Le dernier déploiement réussi est
`70ac9d9`, il y a environ quatre heures.

**Conséquence : tout ce qui a été livré depuis est en ligne dans la base et
dans le dépôt, mais PAS sur le site.** Les nouvelles images de couverture, le
message d'accueil, les animations — vous ne les verrez pas tant que ceci n'est
pas réglé.

**Ce qu'il faut regarder, dans cet ordre :**

1. **La limite quotidienne du plan Hobby** — 100 déploiements par 24 heures.
   Nous avons beaucoup poussé aujourd'hui, et chaque commit déclenche DEUX
   déploiements (la branche et la production). C'est l'explication la plus
   probable, et elle se règle toute seule au bout de 24 heures.
2. **L'état du compte** sur [vercel.com](https://vercel.com/demsy-landrys-projects/maylary-ci)
   — un moyen de paiement expiré ou un plan suspendu donne exactement ce
   symptôme.
3. Si ni l'un ni l'autre : le bouton **Redeploy** sur le dernier déploiement.

**Dites-moi ce que la page affiche**, et je reprends. Je ne peux pas lire
l'état de facturation de votre compte depuis ici.

*Note au passage : le site n'est aujourd'hui accessible que derrière
l'authentification Vercel (`vercel.com/sso`), et aucun nom de domaine propre
n'est rattaché au projet. Avant l'ouverture au public il faudra brancher
`maylary.ci` et lever cette protection.*


### 0. LE CRÉDIT GOOGLE AI — Le Déclarant est ARRÊTÉ

**Mesuré le 14 août 2026**, en interrogeant l'assistant avec un vrai compte
client. Réponse du fournisseur, sur les deux clés configurées :

> `RESOURCE_EXHAUSTED — Your prepayment credits are depleted.`

**Conséquence : l'assistant ne répond plus à personne.** Le message affiché au
client est correct (« Le Déclarant est momentanément injoignable ») et la
question ne lui est pas décomptée, mais le service est à l'arrêt.

**Ce qu'il faut faire :** recharger le projet sur
[AI Studio](https://ai.studio/projects), puis me dire que c'est fait. Ou
déposer une nouvelle clé dans les secrets Supabase sous `GOOGLE_API_KEY`.

C'est le premier de la liste parce que **tout ce qu'on vient de construire
autour de l'assistant en dépend** : l'accueil client, le suivi de commande, le
passage de main à l'équipe, et la recherche chez les fournisseurs.

### 1. Les identifiants de l'opérateur de paiement (Wave en priorité)

**Ce qu'il me faut :** un compte marchand Wave Business (ou Orange Money /
MTN MoMo), et l'accès aux clés d'API + l'URL de webhook.

**Comment me les donner :** ⚠️ **jamais dans la conversation.** Vous les
déposez vous-même dans Supabase → *Project Settings* → *Edge Functions* →
*Secrets*, sous les noms exacts :
- `WAVE_API_KEY`
- `WAVE_WEBHOOK_SECRET`

Vous me dites seulement « c'est déposé ». Je branche et je teste.

**Ce que ça débloque :** la confirmation automatique du paiement, donc la
chaîne complète commande → payé → écriture comptable → garantie payé-protégé.
Aujourd'hui le paiement est déclaré à la main et validé à la main.

### 2. Vos douze tarifs de transit local, confirmés

**Ce qu'il me faut :** pour chacun des douze postes ci-dessous, le montant
réel que vous facturez (ou que votre CAD partenaire vous facture), l'unité
(par dossier / par tonne / par m³ / par conteneur / par kg), et si le montant
change selon le mode (aérien, maritime, express).

**Quatre sont tombés le 14 août**, tirés de votre cotation DEMCI du 20/05/2025
et recoupés en partie double contre le devis lui-même :

| Poste | Montant | Assiette |
|---|---|---|
| Honoraires (H.A.D.) | **100 000** | par dossier |
| Tirage de la déclaration | **70 000** | par dossier |
| Apurement D3 | **20 000** | par dossier |
| Frais d'agio | **10 000** | par dossier |
| | **200 000** | **par dossier** |

*Pourquoi je les ai retenus sans vous redemander confirmation :* le bloc
douane de votre devis fait 509 187, le bloc divers 386 654, et la somme tombe
sur 895 841 — exactement le montant écrit en toutes lettres au bas de la page.
Une seule erreur d'affectation ferait tomber ce total à côté. Il tombe juste.

**Ce qui reste à confirmer — onze postes :**

1. Frais de dossier
2. Acconage et manutention portuaire
3. Manutention et magasinage aéroport
4. Magasinage et stationnement *(votre devis dit 150 000, mais ce poste croît
   avec les jours passés sous douane — je l'ai noté sans le confirmer, pour ne
   pas annoncer 150 000 à un dossier qui dormira trois semaines)*
5. Passage au scanner
6. Bordereau de suivi des cargaisons (BSC/BESC)
7. Dégroupage et déconsolidation
8. Groupage et empotage au départ
9. Transport terrestre jusqu'au lieu de livraison
10. Formalités et attestations à l'export
11. Débours et frais divers

**Forme la plus simple :** une photo d'un de vos devis réels, ou une liste
écrite au fil de la plume. Je m'occupe de la mise en forme.

**Deux choses que votre cotation soulève, et sur lesquelles j'ai besoin de vous :**

- **Le RPI y figure à 70 000.** La règle codée dans le moteur est
  *FOB × 0,75 %, plancher 100 000 par déclaration*. Sur cette cotation, ni le
  taux ni le plancher ne rendent 70 000. Est-ce un forfait de votre CAD, une
  ancienne règle, ou ai-je mal lu la ligne ?
- **La TVA du bloc « débours divers » est de 36 654.** Elle correspond à 18 %
  d'une base de 203 633, que je n'arrive pas à reconstituer à partir des lignes
  visibles. Sur quoi porte-t-elle exactement ?

**Les deux autres pièces jointes sont des scans** que mon environnement ne sait
pas lire — seule la première contient du texte. Retapez les montants, ou
envoyez-les en photo JPEG : les images, je les lis directement.

### 3. Des taux de fret réels, avec leur date de validité

**Ce qu'il me faut,** pour vos liaisons habituelles (Chine, France, Turquie,
Maroc, Tunisie → Abidjan) :
- le mode : aérien / express / groupage maritime
- l'origine et la compagnie
- le prix : par kg (aérien, express) ou par unité payante (groupage maritime)
- le minimum de facturation
- **la date jusqu'à laquelle le taux est valable**

**Forme :** une capture d'écran de la cotation reçue de la compagnie suffit.

**Votre règle du plafond prudent est en place depuis le 14 août.** Vous
m'aviez dit : *« le fret est demandé à la compagnie, je ne peux pas avoir un
tarif réel… on ne peut que se baser sur les normes, dans l'extrême vigilance,
en mettant l'estimation au-dessus de la moyenne, en le signifiant au client. »*

Le moteur connaît désormais une quatrième nature de taux, « plafond ». Elle se
distingue des trois autres sur deux questions séparées : *puis-je graver ce
montant dans une facture* (non) et *puis-je l'annoncer au client* (oui, avec la
réserve). Votre phrase est portée par la base elle-même, pas par une consigne
de rédaction — une consigne s'oublie, une valeur qui doit être là ne s'oublie
pas :

> « Sous réserve de la confirmation par la compagnie : elle peut diminuer ou
> être ce montant, mais jamais plus. »

**Ce qu'il me manque, et que je ne peux pas inventer : les plafonds.** Pour
chaque liaison que vous traitez, le montant au-dessus duquel vous êtes certain
de ne jamais être dépassé :

| Mode | Origine | Unité | Votre plafond |
|---|---|---|---|
| Aérien | Chine → Abidjan | par kg | ? |
| Express | Chine → Abidjan | par kg | ? |
| Groupage maritime | Chine → Abidjan | par unité payante | ? |
| Aérien | France → Abidjan | par kg | ? |
| Groupage maritime | Europe → Abidjan | par unité payante | ? |

Ajoutez les liaisons qui manquent, retirez celles que vous ne faites pas. Ces
chiffres viennent de votre métier — c'est exactement le genre de valeur que je
refuse de produire à votre place.

**Ce que ça débloque :** aujourd'hui la table est vide, donc le moteur ne
chiffre aucun fret. Avec vos plafonds, il cote — avec la réserve, à chaque
fois.

### 4. La liste officielle des positions exonérées par l'APE

**Ce qu'il me faut :** le fichier de la DGD listant les positions tarifaires
couvertes par le démantèlement APE, phase par phase — au minimum la phase 4,
entrée en vigueur le 1er janvier 2026.

**Où le demander :** Direction générale des douanes, Abidjan-Plateau, place de
la République. L'ordonnance n° 2019-80 (phase 1) est publiée sur douanes.ci ;
les phases suivantes se demandent au bureau des régimes économiques.

**Ce que ça débloque :** aujourd'hui l'application sait qu'un régime APE
existe, exige le certificat EUR.1, et calcule l'écart de droit — mais elle ne
peut pas dire **si votre position est dans la liste**. C'est le seul argument
commercial qui vaut de l'argent immédiat : sur le dossier type calculé dans le
brief, 3 380 387 FCFA d'économie sur une seule expédition.

---

## P1 — Pour que ça tourne sans vous

### 5. Le canal de service client

**Ce qui est déjà fait.** Le Déclarant sait maintenant lire vos commandes et
vos dossiers, répondre « où en est ma marchandise », et — quand il ne peut pas
résoudre — ouvrir une demande d'assistance visible dans **Admin → Assistance
client**, avec le résumé de ce qu'il a déjà vérifié. Le délai annoncé au client
est de 24 heures ouvrées, et l'écran signale en rouge les demandes qui le
dépassent.

**Ce qu'il me faut :** le numéro WhatsApp Business de MayLary. Un simple numéro
suffit pour commencer — je poserai un lien direct depuis chaque commande et
depuis chaque demande d'assistance.

**Et une décision de votre part :** confirmez-vous les 24 heures ouvrées, ou
préférez-vous un autre délai ? Il est écrit en base, il se change en une ligne.
Mieux vaut « sous 48 h » tenu que « sous 24 h » raté.

### 6. Vos conditions générales, et qui répond de quoi

**Ce qu'il me faut,** en trois réponses courtes :
- Sur la marketplace, en cas de produit défectueux vendu par un tiers : qui
  rembourse, MayLary ou le vendeur ?
- Sous combien de jours l'acheteur peut-il refuser une marchandise ?
- Quelle commission prélevez-vous sur les ventes des vendeurs tiers ?

**Ce que ça débloque :** les CGV, la page de recrutement des vendeurs, et le
calcul des reversements. Les trois sont codés mais paramétrés sur des valeurs
que j'ai posées faute de décision.

### 7. Le premier vendeur, et la première vraie commande

**Ce qu'il me faut :** que vous passiez vous-même une commande réelle de bout
en bout, ou que vous inscriviez un commerçant que vous connaissez.

**Ce que ça débloque :** l'application a 60 produits, 7 commandes créées,
**0 payée, 0 écriture comptable, 0 vendeur**. Un investisseur qui teste voit
une belle mécanique vide. Une seule commande réellement livrée, avec son
écriture comptable équilibrée et son avis client, change complètement ce qu'il
regarde. C'est le critère de sortie H0 de votre propre schéma directeur, et je
suis d'accord avec vous : c'est ce qui compte le plus.

### 8. L'export : quelles marchandises, au juste

**Correction.** J'avais mis en tête de liste le Droit Unique de Sortie sur le
cacao, le café et le cajou. C'était une erreur de ma part, et vous l'avez dit :
ces filières supposent un agrément d'exportateur, des quotas et un contrôle
qualité propres à chaque filière. Ce n'est pas un démarrage, c'est un métier
à part entière, et s'y risquer sans l'agrément expose à bien pire qu'un
mauvais devis.

**Ce qui est fait :** Le Déclarant a désormais pour consigne d'écarter ces
filières, d'expliquer en deux phrases ce qu'elles exigent, et d'orienter vers
l'organisme compétent — sans monter de dossier ni chiffrer quoi que ce soit.

**Ce qu'il me faut à la place :** votre liste des marchandises d'export que
vous acceptez réellement de traiter aujourd'hui. Ma proposition, à corriger :
effets personnels, échantillons commerciaux, pièces et équipements, produits
manufacturés, colis express vers la diaspora. Le DUS reviendra le jour où
l'agrément filière sera là — pas avant.

---

## P2 — Pour élargir

### 9. Les accès fournisseurs — à décider, pas à faire

**Correction, et je l'assume.** vidaXL et BigBuy étaient MON initiative, pas
une de vos demandes. Je les avais proposés pour élargir le catalogue au-delà
de CJ en Chine ; j'ai continué à les inscrire comme s'ils étaient décidés.
Ils ne le sont pas.

Où on en est réellement : le connecteur vidaXL est écrit et déployé, mais il
**ne fait rien** tant qu'aucun identifiant n'est déposé — il répond « pas
prêt » et dit ce qui manque. Il ne consomme rien et ne gêne rien.

**Ce que je vous demande :** un simple oui ou non.
- *Non* → je retire le connecteur et je n'en reparle plus. Le catalogue reste
  sur CJ et sur vos propres fournisseurs.
- *Oui* → vous écrivez à leur service B2B, et vous déposez les identifiants
  reçus dans les secrets Supabase.

Aucun des deux n'est nécessaire pour vendre. Le catalogue compte déjà
60 références.

### 10. Le crédit Google AI — remonté en tête de liste

Voir le point 0. Le crédit est épuisé et l'assistant est arrêté.

### 11. Les marchandises réglementées à ajouter

Trois fiches sont chargées (laits et farines infantiles, compléments
alimentaires, cosmétiques à allégation de santé). À élargir, dans l'ordre où
vos clients en auront besoin : médicaments, produits phytosanitaires,
équipements radio (ARTCI), denrées animales, produits chimiques.

**Ce qu'il me faut :** pour chaque famille, quelle autorisation, délivrée par
quel service, et **quelles qualités doit avoir le demandeur**. C'est ce dernier
point qui compte — vous l'avez dit vous-même : il faut prévenir avant que
quelqu'un s'engage sur une marchandise qu'il n'a pas le droit d'importer.

---

## Ce qui ne dépend pas de moi et que je ne peux pas faire à votre place

Ces points sont dans le brief, section 3, 4 et 10. Ils ne bloquent pas le code,
mais ils bloquent le lancement :

1. **Trancher la structure juridique** avec un juriste ivoirien : une entité ou
   deux. J'ai lu le Code des douanes — l'incompatibilité commerçant/transit n'y
   figure pas — mais le Code renvoie à la réglementation UEMOA que je n'ai pas
   pu lire.
2. **Votre situation vis-à-vis de votre employeur actuel**, et l'hypothèse d'en
   faire le CAD partenaire.
3. **L'encaissement de fonds pour compte de tiers** : la garantie
   « payé, protégé » est de l'intermédiation en paiement, activité réglementée
   par la BCEAO. À traiter en même temps que le point 1 de la liste P0.
4. **La convention écrite d'adossement au CAD.**
5. **La déclaration ARTCI** pour le traitement de données personnelles.

---

## Comment me livrer tout ça

- **Les chiffres, tarifs et listes** : dans la conversation, en photo ou au fil
  de la plume, peu importe la forme. Je m'occupe de la mise en forme.
- **Les clés d'API et les secrets** : jamais dans la conversation. Vous les
  déposez dans Supabase → *Project Settings* → *Edge Functions* → *Secrets*, et
  vous me dites simplement lesquels sont posés.
- **Les décisions** : une phrase suffit.

Vous n'êtes pas obligé de tout fournir d'un coup. Dans l'ordre d'impact réel :
**les douze tarifs de transit** (2), puis **une commande réelle payée** (7),
puis **les clés Wave** (1). Avec ces trois-là, l'application passe de
« mécanique complète mais vide » à « entreprise qui tourne ».
