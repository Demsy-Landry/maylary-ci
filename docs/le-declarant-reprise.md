# Le Déclarant — reprise en main et mise à disposition de Maylary

*Note de décision, 7 août 2026. Écrite avant réception du code, pour que le
travail commence par l'exécution et non par l'hésitation.*

## Ce que l'application fait

D'après le fondateur, `le-declarant.com` réunit deux outils :

1. **Recherche de position tarifaire (code SH)** à partir d'une description de
   marchandise, classée selon les **Règles Générales Interprétatives** et les
   **notes explicatives**.
2. **Éditeur de déclaration en douane** : on saisit les informations d'une
   importation, il calcule les droits et taxes à payer.

Elle est déployée depuis `atoms.dev` et **instable**. Le fondateur veut la
reprendre en main et l'exposer en API pour que Maylary l'appelle.

## Pourquoi cette application compte plus que sa taille ne le suggère

C'est l'étape n° 4 de la chaîne d'importation du plan directeur — celle que
j'identifiais comme le verrou. Sans elle, Maylary ne sait chiffrer
automatiquement que le catalogue CJ Dropshipping, parce que tout le reste
suppose de connaître la position tarifaire et les taux applicables.

Une fois branchée, Maylary chiffre n'importe quelle marchandise, de n'importe
quelle origine, sans intervention humaine. C'est exactement la promesse de
l'entreprise : *vous choisissez, vous payez, le reste est fait.*

## L'architecture retenue

**Un moteur, deux consommateurs.**

```
                    ┌──────────────────────────────┐
                    │  Fonctions « edge » Supabase │
                    │   classer()   liquider()     │   ← le moteur
                    │  + corpus SH, RGI, taux      │
                    └───────────┬──────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
   ┌──────────▼─────────┐            ┌────────────▼───────────┐
   │ le-declarant.com   │            │  Maylary               │
   │ (Vercel, refonte)  │            │  cotation automatique  │
   │ les transitaires   │            │  achat groupé, import  │
   └────────────────────┘            └────────────────────────┘
```

### Trois décisions, et leurs raisons

**1. Le moteur vit dans Supabase, pas dans le site.**

Aujourd'hui la logique est probablement dans l'application web. Tant qu'elle y
reste, Maylary ne peut pas l'appeler sans passer par une seconde application en
ligne — donc une seconde source de panne, une latence supplémentaire et un
secret à faire circuler. Déplacée dans une fonction « edge », elle devient
appelable par les deux, versionnée, et testable sans navigateur.

**2. Même projet Supabase que Maylary, préfixe de tables distinct.**

Arguments pour : un seul projet à administrer, une seule facture, aucun
problème d'authentification croisée quand Maylary appelle, et — argument
concret — le plan gratuit limite le nombre de projets actifs, ce qui vient
déjà de coûter une journée de déploiements bloqués.

Argument contre, à ne pas oublier : si Le Déclarant est vendu un jour à
d'autres transitaires, leurs données ne doivent pas cohabiter avec celles des
clients de Maylary. **Le corpus tarifaire n'est pas une donnée personnelle**,
donc la cohabitation est acceptable aujourd'hui ; les comptes des transitaires
utilisateurs, eux, feront l'objet d'une décision séparée le jour où il y en
aura.

**3. L'API est publique dès le départ, même si Maylary est son seul client.**

Pas de raccourci interne. Une fonction appelée par clé, avec un contrat écrit,
peut être facturée demain à un transitaire sans rien réécrire. Un raccourci
interne, non.

## Le point de vigilance : la fiabilité de la réponse

Un code SH erroné coûte de l'argent au client et de la crédibilité à Maylary.
Avant de brancher quoi que ce soit sur la cotation automatique, il faut savoir :

- **La classification est-elle déterministe ?** Si elle repose sur un modèle de
  langage, deux appels identiques peuvent donner deux positions différentes.
  C'est inacceptable pour un chiffre qu'un client paie. Il faudra alors soit
  figer les réponses (mise en cache par description normalisée), soit
  transformer la sortie en **proposition assortie d'un niveau de confiance**,
  jamais en décision.
- **D'où viennent les taux, et comment sont-ils mis à jour ?** Un moteur
  tarifaire périmé est pire qu'inutile : il fait perdre de l'argent à ceux qui
  s'y fient. Il faut une date de version du tarif, affichée dans la réponse.
- **Qui répond en cas d'erreur ?** Tant que le fondateur est déclarant agréé et
  qu'il valide les déclarations réelles, la responsabilité est tenue. Le jour
  où l'API sert un tiers, le contrat doit dire ce qu'elle garantit — et ce
  qu'elle ne garantit pas.

## Ce qu'il faut dans le ZIP

- **Tout le code source**, sans `node_modules` (il se réinstalle).
- Le `package.json` et le fichier de verrouillage des versions.
- Les **données tarifaires** : corpus SH, notes explicatives, table des taux —
  sous la forme où elles existent (fichiers, base, ou en dur dans le code).
- Le schéma de base s'il y en a une, et l'endroit où elle est hébergée.
- **Pas de secret en clair.** S'il y en a dans le ZIP — clé de modèle, jeton de
  service — le dire : ils seront à révoquer et à remplacer, un secret parti
  dans un fichier est un secret perdu.

## Les trois questions auxquelles je ne peux pas répondre seul

1. La classification appelle-t-elle un modèle d'IA ? Lequel, avec quelle clé,
   payée par qui ?
2. Y a-t-il une base de données derrière, et où vit-elle aujourd'hui ?
3. Des transitaires s'en servent-ils déjà ? Si oui, la reprise doit préserver
   leurs accès — ce n'est plus une refonte, c'est une migration.
