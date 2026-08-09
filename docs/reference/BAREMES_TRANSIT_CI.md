# Barèmes et règles du transit ivoirien — ce qui est trouvé, ce qui manque

Relevé du 9 août 2026. Le fondateur a demandé de chercher les barèmes publics
plutôt que de les attendre. Voici le résultat, honnêtement séparé entre ce qui
est établi et ce qui ne l'est pas.

## Une limite à connaître

Une partie de la recherche s'est faite à l'aveugle. L'environnement où je
travaille filtre les sorties réseau : `cevalogistics.com`, `federmar.com`,
`douanes.ci`, `portabidjan.ci`, `oic.ci`, `eregulations.org` et les PDF
gouvernementaux sont **inaccessibles depuis ici**. Je n'ai pu passer que par la
recherche, jamais ouvrir les documents eux-mêmes. Les PDF suivants ont été
repérés et méritent d'être ouverts par le fondateur :

- `corridor.eregulations.org/media/Honoraires CAD.pdf` — honoraires du
  commissionnaire en douane agréé. C'est probablement le document qui manque le
  plus.
- Le guide de dédouanement de la CCI France–Côte d'Ivoire.
- `pwic.gouv.ci` — guides interactifs BSC et RFCV du guichet unique.

## Trois natures de chiffre, à ne jamais mélanger

C'est le principal enseignement de la recherche, et il est maintenant inscrit
dans le schéma (`nature` sur `frais_transit_local` et `regles_procedure`) :

| Nature | Ce que c'est | Peut entrer dans un prix ferme |
|---|---|---|
| **officiel** | Convention, circulaire, texte réglementaire | Oui |
| **contractuel** | Le devis de notre groupeur, de notre assureur | Oui |
| **indicatif** | Tarif public relevé sur un site commercial | **Non** |

Un tarif indicatif situe un ordre de grandeur et vieillit vite. Il s'affiche
avec sa date et sa source, jamais comme un montant dû.

## Établi et chargé en base

### Officiel

| Règle | Valeur | Référence |
|---|---|---|
| Seuil d'obligation du RFCV | 1 000 000 FCFA de valeur FOB | Convention État de Côte d'Ivoire — Webb Fontaine du 28/02/2013 ; circulaire n° 1618/MPMEF/DGD du 21/06/2013 |
| Délai de délivrance du RFCV | 5 jours ouvrés après dossier complet | idem |
| Caution d'agrément du commissionnaire | 50 000 000 FCFA (contre 30 M avant) | Réforme des Douanes, en vigueur au 01/01/2026 |
| Crédit d'enlèvement | 100 000 000 FCFA (contre 50 M avant) | idem |

Le RFCV mérite une attention particulière : il porte **la valeur et le code SH
retenus par l'organisme**. Si la facture et le RFCV divergent, c'est le RFCV qui
fixe l'assiette. Un client dont on a classé la marchandise sans anticiper cela
découvre son erreur trop tard.

### Indicatif — à confirmer

| Règle | Valeur relevée | Source |
|---|---|---|
| Franchise de magasinage au terminal | 10 jours depuis le déchargement | Documentation transitaire |
| Franchise de surestaries | 6 jours, négociable au volume | Usage des compagnies |

### Repères de fret, non contractuels

| Origine | Mode | Unité | Montant | Délai | Relevé |
|---|---|---|---|---|---|
| Chine | groupage maritime | m³ | 211 USD | 34–40 j | février 2026 |
| France | groupage maritime | m³ | dès 95 EUR | — | août 2026 |
| France | conteneur 20' | conteneur | dès 1 350 EUR | — | août 2026 |

Ils servent à une seule chose : dire si le devis qu'on nous propose est dans le
marché. Ils sont dans une table qui le dit dans son nom
(`reperes_fret_marche`), lisible par l'administration seulement.

## Cherché et non trouvé

Ces montants ne sont **pas publiés en clair** et devront venir d'un devis ou du
fondateur. Ils restent `confirme = false`, et le moteur refuse de totaliser tant
qu'il en manque un.

- **Barème FEDERMAR.** La Fédération Maritime de Côte d'Ivoire fédère les
  syndicats de transitaires, consignataires, acconiers et armateurs. Une base
  tarifaire de 2002 a été réorganisée et officialisée en novembre 2010, en
  vigueur au 1er décembre 2010. Le contenu n'est pas public.
- **Honoraires du commissionnaire en douane.** Un relevé commercial donne
  150 000 à 300 000 FCFA selon la complexité du dossier — ordre de grandeur, pas
  barème.
- **Acconage et manutention** au terminal, par type et taille de conteneur.
- **Tarif du BSC** auprès de l'Office Ivoirien des Chargeurs.
- **Passage au scanner.**
- **Dégroupage** à Abidjan, à l'unité payante. C'est le poste le plus important
  du modèle groupage et celui dont l'absence bloque le plus de devis.

## À trancher par le fondateur

- **Droit Unique de Sortie** sur le cacao, le café, la noix de cajou : existe-t-il
  toujours, à quel taux, sur quelles positions ? Le corpus TEC ne le porte pas,
  et sans lui l'export d'un conteneur de fèves affiche 20 000 FCFA de droits,
  ce qui serait faux.
- **Délais réels par origine**, pour que le devis annonce un temps en même temps
  qu'un prix. Un client qui compare deux offres sans voir les délais compare mal.
