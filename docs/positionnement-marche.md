# Où se gagne le marché ivoirien

Note de marché du 7 août 2026, rédigée à partir des données réelles du projet et
d'un relevé public du marché ivoirien. Elle sert de cadre aux arbitrages de
produit : ce qui suit explique *pourquoi* certaines fonctions valent d'être
construites avant d'autres.

## Le terrain

Trois faits structurent ce marché.

1. **L'achat se fait au téléphone**, et le paiement passe par Wave ou Orange
   Money. Tout le monde l'a compris ; ce n'est pas un avantage.
2. **Le paiement à la livraison reste dominant.** Ce n'est pas un service, c'est
   le prix que le commerce ivoirien paie pour son manque de confiance. Il coûte
   cher (retours, immobilisation de trésorerie, colis perdus) et il plafonne le
   panier moyen : personne ne fait livrer contre remboursement un lot à
   800 000 FCFA.
3. **Le vrai concurrent n'est pas une plateforme, c'est le commerce WhatsApp et
   Facebook.** Pas de prix affiché, pas de facture, pas de recours — et il prend
   quand même la majorité des transactions, parce qu'il y a un visage derrière.

Ordres de grandeur de place, à confirmer au cas par cas : commission des places
de marché 5 à 20 % ; commission d'un transitaire classique 100 000 à
250 000 FCFA ; droits de douane plafond 35 %, taxe statistique 2,6 %, TVA 18 %.

## Où les autres cèdent

Aucune de ces faiblesses n'est une maladresse : ce sont des conséquences de leur
modèle. C'est ce qui les rend exploitables — ils ne peuvent pas les corriger sans
se renier.

| Acteur | Faille structurelle |
|---|---|
| Grandes places de marché (Jumia, Yaatoo) | Elles hébergent des revendeurs qu'elles ne connaissent pas et ne maîtrisent pas l'amont. Les griefs récurrents portent tous sur l'après-vente : garantie ramenée à sept jours, remboursement partiel, déplacement en agence à la charge du client. Un intermédiaire qui arbitre ne rassure jamais autant qu'un vendeur qui répond. |
| Commerce WhatsApp / Facebook | Sa force est la proximité. Sa faille est qu'il n'y a rien derrière : pas de prix opposable, pas de trace, pas de recours. Le client paie d'avance à quelqu'un qu'il ne connaît qu'en photo de profil. |
| Transitaires et agents d'importation | Compétents, mais opaques sur le prix : un total par WhatsApp, aucune décomposition. Leur marge repose sur le fait que le client ne sait pas calculer. Afficher marchandise, fret, assurance et douane poste par poste leur retire cet avantage — et ils ne peuvent pas répondre sans montrer leur propre marge. |

## Ce que Maylary a déjà et qu'on ne copie pas en trois mois

- Un **coût de revient calculé, pas estimé** : prix fournisseur, fret réel,
  assurance au barème réel de l'assureur ivoirien, droits de douane. Le fret est
  affiché à part, jamais dissous dans le prix de l'article.
- Une **comptabilité en partie double** dans la logique des classes SYSCOHADA,
  branchée sur les commandes, avec l'équilibre imposé par la base.
- Une **note fournisseur construite sur les livraisons réelles de Maylary** —
  avis clients après réception, incidents relevés par atelier.
- **Trois métiers dans un seul compte** : boutique, sourcing, import/export.
- **Le prix ne bouge jamais après paiement** (règle du fondateur).

## Six positions à prendre

Classées par effet rapporté à l'effort.

1. **Payé, protégé — l'argent retenu jusqu'à la livraison.** *(construit le
   7 août 2026)* Sur un article vendu par une entreprise tierce, le reversement
   n'intervient qu'une fois la réception acquise — par confirmation du client,
   ou par expiration du délai de contestation. C'est la réponse directe au
   paiement à la livraison.

   Un déclencheur sur `app_e08c374bc4_reversements` refuse tout versement au
   delà de ce qui est libéré ; la vue `app_e08c374bc4_reversements_dus` sépare
   le libéré, le retenu et l'en-cours ; la fonction
   `app_e08c374bc4_confirmer_reception` n'accepte que le titulaire de la
   commande. Le délai vit dans `app_e08c374bc4_parametres_garantie`, réglable
   depuis l'administration des vendeurs — sept jours par défaut.

   Le repli sur le délai n'est pas un détail : sans lui, un client silencieux
   gèlerait l'argent d'un vendeur indéfiniment, et aucune entreprise sérieuse
   n'accepterait de vendre ici.
2. **L'achat groupé.** *(à construire, moyen)* Le fret a une part fixe : cinq
   clients sur la même référence la divisent par cinq. Le moteur existe déjà côté
   administration (`app_e08c374bc4_groupage_simuler`) mais n'est pas ouvert au
   client. Ce qui manque est la campagne : seuil, date limite, et ce qui se passe
   si le seuil n'est pas atteint.
3. **Le devis d'import opposable.** *(en grande partie en place)* Daté, décomposé
   poste par poste, durée de validité écrite, PDF téléchargeable. Reste de la
   finition et l'équivalent pour l'export.
4. **Le suivi par référence, sans compte.** *(à construire, petit)* Celui qui
   reçoit le colis n'est pas toujours celui qui l'a commandé.
5. **Le carnet d'importation du client.** *(à construire, moyen)* Historique
   douanier d'une entreprise cliente — catégories, droits payés, documents
   archivés — utile au moment de sa propre déclaration.
6. **Le prix rendu chez vous, écrit noir sur blanc.** *(décision, pas de
   développement)* « Aucun frais découvert à la livraison » est déjà la réalité
   de l'application ; ce n'est écrit nulle part.

## Ce qui dépend du fondateur

- Déclaration ARTCI.
- Clé d'API Wave (tant qu'on reste sur le lien statique, la confirmation de
  paiement est manuelle).
- Validation du plan de comptes par un expert-comptable avant tout dépôt d'états
  financiers.
- Tarif du transitaire maritime et catégorie douanière par famille de produits :
  les deux dernières inconnues du calcul de coût.
- Jusqu'où va la garantie : délai de confirmation, que faire si le client ne
  confirme jamais, qui tranche un litige.
