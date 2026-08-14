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

**Ce qu'il me faut :** le numéro WhatsApp Business de MayLary, et si vous
l'avez, l'accès à l'API WhatsApp Business (Meta). Sinon, un simple numéro
suffit pour commencer — je poserai un lien direct depuis chaque commande.

**Et une décision de votre part :** le délai de réponse que vous vous engagez
à tenir. Il sera affiché. Mieux vaut « sous 24 h » tenu que « immédiat » raté.

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

### 8. Le Droit Unique de Sortie

**Ce qu'il me faut :** les taux et les positions du DUS sur cacao, café, cajou,
et les autres produits concernés.

**Ce que ça débloque :** la liquidation export est complète sauf sur ce point.
Aujourd'hui, sur un produit soumis au DUS, l'application le signale mais ne
peut pas le chiffrer.

---

## P2 — Pour élargir

### 9. Les accès fournisseurs

- **vidaXL** : écrire à `b2bperformance@vidaxl.com` pour un accès B2B gratuit.
  Le connecteur est écrit et déployé ; il attend `VIDAXL_EMAIL` et
  `VIDAXL_API_KEY` dans les secrets Supabase.
- **BigBuy** : nécessite un pack payant. À décider — ce n'est pas urgent.

### 10. Le crédit Google AI

**Ce qu'il me faut :** une clé d'API Google AI Studio, déposée dans les secrets
Supabase sous `GOOGLE_AI_API_KEY`.

**Ce que ça débloque :** la classification tarifaire assistée. Elle fonctionne
déjà, mais sur un quota gratuit qui s'épuise. Un seul modèle est utilisé, et
sa proposition est **toujours** vérifiée contre les 6 298 positions
officielles — l'IA propose, le corpus tranche.

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
