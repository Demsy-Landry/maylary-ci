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
| `frais_transit_local` | 12 postes, **12 en « contractuel »**, 0 confirmé ❌ |
| `taux_fret` | **0 ligne** ❌ |
| `commandes_gp` | 7 créées, **0 payée de bout en bout** ❌ |
| `ecritures` (comptabilité) | **0** ❌ |
| `vendeurs` (marketplace) | **0** ❌ |

---

## P0 — Sans ça, la boucle de vente ne peut pas être prouvée

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

1. Honoraires de transit et de déclaration
2. Frais de dossier
3. Acconage et manutention portuaire
4. Manutention et magasinage aéroport
5. Magasinage et stationnement
6. Passage au scanner
7. Bordereau de suivi des cargaisons (BSC/BESC)
8. Dégroupage et déconsolidation
9. Groupage et empotage au départ
10. Transport terrestre jusqu'au lieu de livraison
11. Formalités et attestations à l'export
12. Débours et frais divers

**Forme la plus simple :** une photo d'un de vos devis réels, ou une liste
écrite au fil de la plume. Je m'occupe de la mise en forme.

**Ce que ça débloque :** les douze sont aujourd'hui marqués « contractuel »,
c'est-à-dire non confirmés. Tant qu'ils le sont, le moteur **refuse de
totaliser un devis de transit** — il affiche les postes manquants au lieu
d'inventer un total. C'est le seul blocage du module transit.

### 3. Des taux de fret réels, avec leur date de validité

**Ce qu'il me faut,** pour vos liaisons habituelles (Chine, France, Turquie,
Maroc, Tunisie → Abidjan) :
- le mode : aérien / express / groupage maritime
- l'origine et la compagnie
- le prix : par kg (aérien, express) ou par unité payante (groupage maritime)
- le minimum de facturation
- **la date jusqu'à laquelle le taux est valable**

**Forme :** une capture d'écran de la cotation reçue de la compagnie suffit.

**Ce que ça débloque :** la table est vide. La mécanique est en place — vous
avez eu raison de dire que le fret change selon les périodes, et le moteur
refuse désormais de chiffrer sur un taux périmé. Mais sans une seule ligne, il
n'a rien à refuser : il ne chiffre pas du tout.

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
