# Cotation E-Transit

Application de chiffrage des droits et taxes de douane, et d'établissement des
devis clients. Elle est faite pour E-Transit.

Elle existe en **deux versions, construites depuis les mêmes sources** :

| | Pour | Où |
| --- | --- | --- |
| **En ligne** | téléphone, tablette, ordinateur | `https://maylarygroup.ci/e-transit/` |
| **Hors ligne** | un ordinateur sans connexion | le fichier `outils/cotation-e-transit.html` |

Les deux calculent exactement pareil. Elles ne partagent pas leurs dossiers :
chaque appareil garde les siens.

Elle n'a **rien à voir avec MayLary** : c'est une application séparée, avec sa
propre base, sa propre identité, ses propres dossiers. Elle emprunte seulement
les règles de liquidation, qui sont les mêmes pour tout le monde parce que ce
sont celles de la Douane.

---

## Installer sur un téléphone

1. Ouvrir **`https://maylarygroup.ci/e-transit/`** au navigateur.
2. **iPhone** : bouton Partager → *Sur l'écran d'accueil*.
   **Android** : menu ⋮ → *Installer l'application* (ou *Ajouter à l'écran d'accueil*).
3. L'icône se pose comme celle d'une vraie application. Elle s'ouvre en plein
   écran, sans barre de navigateur, et **fonctionne ensuite sans connexion**.

Le pavé de navigation passe en bas de l'écran, sous le pouce, et les tableaux
larges se présentent en fiches, une ligne par article.

## Installer sur un ordinateur

Le plus simple est la même adresse, ouverte avec Edge ou Chrome — et l'icône
d'installation dans la barre d'adresse pour en faire une fenêtre à part.

**Pour un poste sans connexion**, c'est le fichier unique :

1. Copier **`outils/cotation-e-transit.html`** sur le poste, par exemple dans
   `Documents\E-Transit\`.
2. Clic droit → *Ouvrir avec* → **Microsoft Edge** (ou Google Chrome).

Il n'y a rien d'autre à installer. Pas de compte, pas de serveur, pas de
licence.

**Ce fichier ne marchera jamais sur un téléphone.** Un appareil mobile refuse
d'accorder une base de données à une page ouverte depuis un fichier posé sur
l'appareil ; c'est pour cela que la version en ligne existe. L'application le
dit à l'écran plutôt que de rester bloquée.

**Ni sur Firefox depuis le disque**, pour la même raison. Edge ou Chrome.

---

## Première ouverture

L'application s'ouvre directement, sans mot de passe. Sur un poste de bureau,
un code à retaper chaque matin n'aurait rien protégé de plus que la session
Windows : c'est elle qui garde l'accès à l'ordinateur.

Première chose à faire, une fois pour toutes : **Réglages → Identité de la
société**. Raison sociale, adresse, téléphone, RCCM, compte contribuable,
agrément de déclarant, et le nom de la personne qui signe les devis. Ce bloc
est repris en tête de chaque devis et de chaque impression.

Au premier lancement, l'application propose de **charger le tarif douanier** :
6 298 positions, quelques secondes, une connexion. Une fois descendu, le tarif
vit dans la base du poste et l'application fonctionne entièrement hors ligne.

---

## Ce qu'elle fait

- **Déclaration** au modèle SYDAM, avec les numéros de cases du DAU : bureau,
  régime (84 régimes réels), importateur, fournisseur, déclarant, origine et
  provenance, transport, facture et devise, incoterm, colis, conteneurs,
  documents joints.
- **Articles** : position tarifaire **écrite ou cherchée** dans le tarif — le
  taux de droit se remplit tout seul quand la position existe, et **reste vide
  quand elle n'existe pas**. L'application ne devine jamais un taux.
- **Liquidation** : CAF, répartition du fret au poids brut et de l'assurance à
  la valeur, DD, RST, PCS, PUA, PCC, TVA par article, puis RPI et timbre une
  fois par déclaration.
- **Devis client** : les droits et taxes, plus les honoraires et débours
  d'E-Transit, avec la TVA sur les seuls honoraires.
- **PDF** : le devis en portrait, la note de liquidation en paysage.
- **Historique** consultable, recherche, duplication d'un dossier.
- **Carnet d'adresses** : importateurs, fournisseurs, transporteurs.
- **Réglages** : identité de la société, logo, tarif, toutes les listes de
  référence, postes de facturation mémorisés, sauvegarde.

## Ce qu'elle ne fait pas

- **Elle ne se partage pas entre deux appareils.** La base vit dans le
  navigateur de l'appareil. Téléphone et ordinateur gardent chacun leurs
  dossiers, et un dossier commencé au bureau ne se retrouve pas sur le
  téléphone. Pour cela il faudrait une base en ligne et un compte par
  personne : c'est un autre chantier, choisi de ne pas être fait pour l'instant.
- **Elle ne dépose pas la déclaration.** Elle chiffre, elle édite le devis ;
  le dépôt se fait dans SYDAM comme d'habitude.
- **Elle ne fixe pas les honoraires.** Aucun montant d'honoraire ou de débours
  n'est proposé : ce sont ceux d'E-Transit, et personne d'autre ne les fixe.

---

## Le logo

Il n'est pas livré avec l'application : il n'a pas pu être retrouvé
automatiquement. Réglages → Logo → déposer le fichier (PNG, JPEG, WebP ou SVG,
fond transparent de préférence). Il apparaît aussitôt à l'écran, sur les devis
et à l'impression.

## La sauvegarde

Réglages → **Sauvegarder tout** produit un fichier qui contient les dossiers,
les carnets, les réglages et le logo. À déposer une fois par semaine sur une
clé ou dans le dossier partagé.

Ce n'est pas une précaution de luxe : « effacer les données de navigation »
avec la case *données de sites* effacerait la base.

Le tarif douanier n'est pas dans cette sauvegarde — il se recharge en un clic,
inutile de l'alourdir.

---

## Modifier l'application

Les sources sont dans `source/`, un fichier par sujet :

| Fichier | Rôle |
| --- | --- |
| `index.html` | la structure des écrans |
| `style.css` | l'habillage, les animations, l'impression |
| `reference.js` | les listes semées au premier démarrage |
| `liquidation.js` | le calcul des droits et taxes |
| `base.js` | la base locale et le tarif |
| `pdf.js` | le devis et la note de liquidation |
| `interface.js` | tout le reste |

Après modification :

```bash
node outils/e-transit/construire.mjs
```

Cela écrit les deux livrables :

- `outils/cotation-e-transit.html` — tout en un seul fichier ;
- `public/e-transit/` — index.html, style.css, app.js, jspdf.js, le manifeste
  et l'ouvrier de service, déployés avec le site.

**Pourquoi la version en ligne est en fichiers séparés** : le site applique
`script-src 'self'`, qui interdit le script écrit dans la page. Un fichier
unique ne s'exécuterait pas. Plutôt que d'affaiblir la politique de sécurité
du site pour un dossier, on livre ce qu'elle attend.

L'adresse `/e-transit/` porte `noindex` et figure en `Disallow` dans
`robots.txt` : elle ne sort dans aucun résultat de recherche.

### Le tarif douanier

Il est servi par la fonction `app_e08c374bc4_tec_public`, en lecture publique
et sans clé. Le TEC est un texte réglementaire : il n'y a rien à y protéger, et
une clé déposée dans un fichier installé sur un poste de bureau n'est plus une
clé.

L'adresse de la source se change dans Réglages, et un fichier de tarif peut
être importé à la place — l'application peut donc devenir complètement
autonome le jour où E-Transit le voudra.

---

## Les règles de calcul

Elles sont la transcription exacte de la fonction de liquidation qui tourne en
base côté Déclarant MayLary. Mêmes enchaînements, mêmes arrondis, mêmes refus.
Si les deux divergent un jour, c'est un défaut, pas une variante.

| | |
| --- | --- |
| Valeur en douane | CAF = FOB + fret + assurance |
| Fret | réparti au **poids brut** |
| Assurance | répartie à la **valeur FOB**, et **toujours en francs CFA**, jamais convertie |
| DD | CAF × taux de la position, moins l'exonération saisie |
| RST | CAF × 1 % |
| PCS / PUA / PCC | CAF × 0,8 % / 0,2 % / 0,5 % |
| Assiette TVA | CAF + DD + RST, **et rien d'autre** |
| TVA | 18 % de cette assiette |
| RPI | max(FOB total × 0,75 % ; 100 000) — **une fois par déclaration** |
| TS | 20 000 forfaitaires — **une fois par déclaration** |
| Exportation | le timbre seul |

Chaque taxe est arrondie au franc dès son calcul, et l'assiette de la TVA se
construit avec les montants déjà arrondis, comme le fait le système douanier.

L'écran Réglages reprend ces règles en toutes lettres, pour que personne n'ait
à ouvrir le code pour savoir ce que l'application fait.

---

*By Dems'Inc — Demsy Landry.*
*Contient jsPDF (licence MIT) pour l'édition des documents.*
