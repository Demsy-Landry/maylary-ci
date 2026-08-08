# LE-DECLARANT — document de référence

*Déposé par le fondateur le 8 août 2026. Transcription fidèle du PDF
`LEDECLARANT_REFERENCE_CLAUDE_CODE.pdf`.*

> **À relire intégralement avant toute intervention sur le module LE-DECLARANT.**
> Ce fichier remplace la mémoire conversationnelle absente entre deux sessions.
> En cas de contradiction entre ce document et une instruction ponctuelle en
> conversation, demander confirmation explicite avant de s'écarter des règles
> ci-dessous — en particulier la **règle absolue de la section 5**.

Fondateur : Demsy Landry — Responsable adjoint Aérien/Dégroupage & Express,
E-Transit (Yeshi Group).

---

## 1. Contexte et objectif

LE-DECLARANT était une application Flask/Python hébergée sur Atoms.dev,
aujourd'hui inaccessible faute de renouvellement. Elle permettait la
classification automatique de codes SH par IA, le calcul des droits et taxes
ivoiriens, et la génération d'un document de simulation façon SYDAM.

**Exigence non négociable :** aucune fonctionnalité de l'ancienne application ne
doit être perdue lors de la reconstruction dans Maylary. Le module devient un
service interne, connecté au module Import (cotation des devis) et
potentiellement à l'Export.

Utilisateurs visés : le fondateur, son équipe E-Transit, et à terme les clients
de Maylary qui veulent une estimation fiable avant de s'engager.

---

## 2. Formation douanière (à injecter en contexte système de la classification)

### 2.1 Cadre régional

La Côte d'Ivoire appartient à deux ensembles superposés :

- **UEMOA** (Bénin, Burkina Faso, Côte d'Ivoire, Guinée-Bissau, Mali, Niger,
  Sénégal, Togo) — définit le **TEC**, appliqué identiquement par tous les États
  membres.
- **CEDEAO** — ensemble plus large, avec son prélèvement communautaire propre
  (PCC).

Les échanges entre pays UEMOA bénéficient d'un abattement (libre circulation en
principe, sous réserve des règles d'origine). Les pays tiers acquittent
l'intégralité des droits et taxes du TEC.

### 2.2 Catégories tarifaires du TEC UEMOA

| Catégorie | Taux DD | Type de produits |
|---|---|---|
| 0 | 0 % | Biens sociaux essentiels (liste limitative) |
| 1 | 5 % | Première nécessité, matières premières de base, biens d'équipement, intrants spécifiques |
| 2 | 10 % | Intrants et produits intermédiaires |
| 3 | 20 % | Biens de consommation finale et autres produits non repris ailleurs |

> **Le taux DD n'est jamais une estimation ni une déduction logique depuis la
> catégorie.** Il doit **toujours** être lu directement dans `tec_dd_reference`,
> construite à partir du Bulletin Officiel Spécial TEC UEMOA janvier 2023
> (Règlement N°02/2022/CM/UEMOA), qui liste le taux exact pour chacun des
> **6 299 codes à 10 chiffres** du format UEMOA.

### 2.3 Hiérarchie du Système Harmonisé

1. **Section** (I à XXI)
2. **Chapitre** (2 chiffres, 01 à 97)
3. **Position** (4 chiffres)
4. **Sous-position** (6 chiffres, niveau international harmonisé)
5. **Extension nationale/régionale** (jusqu'à 10 chiffres, format UEMOA) — c'est
   ce code qui porte le taux DD exact.

### 2.4 Règles Générales d'Interprétation (RGI), par ordre de priorité

- **RGI 1** — classement déterminé par les termes des positions et des notes de
  section/chapitre. Règle prioritaire : on ne passe aux suivantes que si elle ne
  suffit pas.
- **RGI 2a** — article incomplet ou non fini classé comme l'article complet s'il
  en présente les caractéristiques essentielles.
- **RGI 2b** — mélange ou assemblage de matières : classement selon la RGI 3.
- **RGI 3** — articles relevant de plusieurs positions :
  - **3a** la position la plus spécifique prime sur la générale ;
  - **3b** à défaut, selon la matière ou l'article qui donne le caractère essentiel ;
  - **3c** à défaut, la position numériquement la plus élevée.
- **RGI 4** — position de l'article le plus analogue.
- **RGI 5** — étuis, contenants et emballages.
- **RGI 6** — le classement en sous-position suit les mêmes principes, en ne
  comparant que des sous-positions de même niveau.

> **L'IA doit citer explicitement les RGI appliquées** dans son raisonnement,
> pas seulement donner un code.

### 2.5 Documents justificatifs

| Origine / cas | Document requis |
|---|---|
| Produits UEMOA | Facture commerciale (marchandise, prix FOB, assurance, fret) |
| Produits originaires UE | Certificat EUR1 |
| Pays tiers | Certificat d'origine |
| Coton et produits 100 % coton (wax, bazin) | Licence d'importation (hors DAI) |
| Tout import/export | Immatriculation — code importateur/exportateur auprès de la Direction de la Promotion du Commerce Extérieur |

### 2.6 Circuits de dédouanement

- **Vert** (traditionnel) : 10 minutes à 24-48 h, pas de contrôle physique approfondi.
- **Rouge** : contrôles supplémentaires, durée moyenne d'une semaine.
- **Blanc** : opérateurs à bonnes références sans contentieux — dédouanement rapide.

Contrôle qualité/quantité avant embarquement par **BIVAC** ou **COTECNA** :
obligatoire à partir de 1,5 M FCFA de valeur FOB, aléatoire entre 0,5 et 1,5 M.

### 2.7 Régimes douaniers (nomenclature officielle DGD-CI, 29 juillet 2021)

| Code | Libellé |
|---|---|
| 1000 | Exportation définitive |
| 4000 | Mise à la consommation directe (le plus courant à l'import) |
| 4050 | Mise à la consommation en suite d'admission temporaire ordinaire |
| 5000 | Admission temporaire ordinaire |
| 5200 | Admission temporaire pour perfectionnement actif |
| 7000 | Entrée en entrepôt de stockage |
| 8000 | Transit national |
| 9200 | Entrée en zone franche |

> La liste complète (une centaine de codes) est dans
> `liste_des_regimes_douaniers_a_la_date_du_29-07-2021.pdf` et **doit être
> chargée intégralement** — ne pas se limiter aux exemples ci-dessus.

---

## 3. Formules de calcul officielles

> **Validées sur un bulletin de liquidation SYDAM réel. Non négociables.**
> Toute fonction de calcul doit les reproduire à l'identique.

### 3.1 Valeur en douane

```
Valeur CAF = FOB + Fret + Assurance
```

### 3.2 Droits et taxes (sur la valeur CAF de chaque ligne)

```
DD  = CAF × taux_DD      (variable par code HS — lu dans tec_dd_reference)
RST = CAF × 1 %          (Redevance Statistique — taux fixe)
PCS = CAF × 0,8 %        (Prélèvement Communautaire de Solidarité — taux fixe)
PUA = CAF × 0,2 %        (taux fixe)
PCC = CAF × 0,5 %        (Prélèvement Communautaire CEDEAO — taux fixe)
TVA = (CAF + DD + RST) × 18 %
```

> **ATTENTION : la TVA ne se calcule PAS sur PCS/PUA/PCC.**

### 3.3 Taxes complémentaires (non liées au CAF de ligne)

```
RPI = FOB × 0,75 %, minimum 100 000 XOF   (Redevance de Prestation Informatique)
TS  = 20 000 XOF par déclaration          (Timbre Statistique — PAS par ligne)
```

### 3.4 Prorata pour déclarations multi-lignes

```
Fret_ligne            = (Fret_total / Poids_brut_total) × Poids_brut_ligne
Assurance_ligne       = (Assurance_totale / FOB_total)  × FOB_ligne
Poids_brut_stat_ligne = (Poids_brut_total / FOB_total)  × FOB_ligne
```

### 3.5 Éclatement de ligne

Une ligne tarifaire peut être éclatée en sous-lignes **sans limite de nombre** :
`Ligne 1 → 1.1, 1.2, 1.3, …` Chaque sous-ligne porte son propre code HS et sa
propre quantité, et hérite du calcul de prorata de la ligne parente.

### 3.6 Impact des régimes sur le calcul

| Régime | DD/RST/PCS/PUA/PCC/TVA | RPI | TS |
|---|---|---|---|
| Mise à la consommation (4000) | Dus intégralement | Dû | Dû |
| Transit (8000) | 0 — caution requise à la place | — | — |
| Entrepôt sous douane (7000) | Suspendus | **Dû** | **Dû** |
| Admission temporaire (5000) | Exonération totale ou partielle selon autorisation | Selon cas | Selon cas |

---

## 4. Base TEC UEMOA — état d'avancement

### 4.1 Terminé

Extraction vérifiée du **taux DD pour 6 299 codes HS** (format 10 chiffres
UEMOA) depuis le Bulletin Officiel Spécial TEC UEMOA janvier 2023 (886 pages).

**Méthode :** extraction *géométrique* — lecture des positions X/Y exactes des
colonnes du tableau PDF, plutôt qu'une extraction de texte linéaire qui aurait
désaligné les colonnes sur les désignations longues. Cas limites vérifiés
manuellement un par un. **Fiabilité confirmée à 100 % sur le champ DD, aucun
code sans taux associé.**

Fichier livré : `TEC_DD_par_code_HS_DEFINITIF.txt` — contient `code_hs`,
`désignation`, `DD`.

### 4.2 Reste à faire avant l'import définitif

La colonne **US (Unité Statistique)** n'est pas encore extraite (kg, u/pièce,
m², litre…). Elle sert à valider la cohérence d'une déclaration — détecter par
exemple une quantité saisie en pièces pour un article qui se déclare en kg.

> **Instruction : avant toute création de la table définitive
> `tec_dd_reference`, vérifier avec le fondateur si la colonne US a été
> complétée.** Si elle est absente, proposer une nouvelle extraction géométrique
> du même PDF source, par la même méthode que pour le DD.

### 4.3 Schéma de table cible

```sql
CREATE TABLE tec_dd_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hs TEXT NOT NULL UNIQUE,   -- format 10 chiffres UEMOA
  designation TEXT NOT NULL,
  unite_us TEXT,                  -- à compléter (kg, u, m2, l…)
  taux_dd NUMERIC(5,2) NOT NULL,  -- ex. 5.00, 10.00, 20.00, 0.00
  categorie INTEGER,              -- 0, 1, 2 ou 3
  statut TEXT DEFAULT 'actif',    -- actif / obsolète / à vérifier
  source_reglement TEXT DEFAULT 'Règlement N°02/2022/CM/UEMOA',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tec_code_hs ON tec_dd_reference (code_hs);
```

Import par script (CSV → COPY, ou script Node/Python contrôlé) — **pas de saisie
manuelle** vu le volume de 6 299 lignes.

---

## 5. Classification HS — RÈGLE ABSOLUE

### 5.1 Principe fondamental (décision actée, non négociable)

**Un seul modèle IA effectue la classification (Claude). Il n'y a PAS de système
à deux IA en vote/consensus.** La fiabilité ne vient pas d'un accord entre
plusieurs modèles, mais de la **vérification systématique du code proposé contre
la base réelle `tec_dd_reference`**.

### 5.2 Séquence obligatoire

1. L'utilisateur décrit un article (texte libre, éventuellement avec photo).
2. Claude propose un code HS via un raisonnement en 7 étapes (voir 5.3).
3. Le code proposé est **systématiquement** recherché dans `tec_dd_reference`.
4. **Si le code existe en base** → afficher le taux_dd réel, avec la mention
   explicite « vérifié dans la base TEC UEMOA officielle ».
5. **Si le code n'existe PAS en base** :
   - **ne jamais afficher de taux estimé ou inventé** ;
   - afficher un message explicite demandant une vérification manuelle ;
   - proposer à titre indicatif seulement le code le plus proche trouvé en base
     (recherche par proximité sur les 6 premiers chiffres par exemple),
     **clairement marqué « non confirmé »**.

> Cette règle protège le fondateur et ses clients d'une erreur de classification
> aux conséquences réelles : redressement douanier, blocage de marchandise.
> **Aucune exception ne doit être introduite, même pour « améliorer
> l'expérience utilisateur » en évitant un message d'incertitude.**

### 5.3 Méthode de classification en 7 étapes

1. **Identification de l'article** : DCI si médicament, famille de produit si
   référence commerciale générique, formule chimique si produit chimique,
   secteur d'usage si pièce technique.
2. **Section SH** (I à XXI).
3. **Chapitre** (01 à 97).
4. **Position** à 4 chiffres.
5. **Sous-position** à 6 chiffres, puis extension à 10 chiffres format UEMOA.
6. **Recherche du taux DD réel** dans `tec_dd_reference` — étape de vérification
   obligatoire, jamais sautée.
7. **Vérification de cohérence** entre le code trouvé et la nature réelle de
   l'article décrit.

### 5.4 Niveaux de confiance — distinction importante

- **Confiance sur l'identification du produit** (élevée / moyenne / faible) :
  reflète l'ambiguïté de la description fournie par l'utilisateur.
- **Fiabilité du taux affiché** : toujours « certaine » si le code existe en
  base, puisque le taux vient alors de la donnée réelle et non d'une estimation.

> **Ces deux notions ne doivent jamais être confondues dans l'interface.**

---

## 6. Spécification des trois livrables

### 6.1 Simulateur de déclaration

**En-tête :** référence (générée), régime douanier (menu peuplé depuis la table
des régimes DGD-CI), bureau de douane, importateur/déclarant (nom, code
importateur), fournisseur, pays d'origine, n° facture, n° connaissement (BL
maritime / LTA aérien), mode de transport, n° RCCM / CC.

**Valeurs globales :** devise (au moins 20 devises avec taux en temps réel, sauf
**EUR/XOF qui est un ancrage fixe BCEAO à 655,957 — ne jamais appeler d'API de
change pour ce taux, il est légalement fixe**), fret total, assurance totale,
poids brut et net totaux, FOB et CAF totaux (calculés, jamais saisis).

**Lignes tarifaires :** ajout multiple, éclatement en sous-lignes sans limite.
Par ligne : code HS (avec assistance IA), désignation, quantité, poids brut/net,
FOB. **Affichage détaillé par ligne** : prorata fret/assurance appliqué, CAF de
ligne, DD/RST/PCS/PUA/PCC/TVA/RPI — chaque montant visible individuellement, pas
seulement un total agrégé.

**Récapitulatif :** somme de toutes les lignes ; RPI et TS au niveau de la
déclaration entière ; **TOTAL À PAYER mis en évidence visuellement — élément le
plus important de l'écran.**

### 6.2 Document imprimable style SYDAM

- En-tête officiel Côte d'Ivoire, **sans** la mention « SYDAM WORLD+ » (éviter
  toute confusion avec le vrai logiciel douanier).
- Cases numérotées, dans l'esprit visuel d'une déclaration réelle.
- **Chiffres en gras et lisibles** — le document doit pouvoir être imprimé et lu
  facilement.
- Tableau détaillé par ligne et sous-ligne.
- Zone de signature : Déclarant / Receveur des Douanes / Cachet.
- **Mention obligatoire et visible** : « Document d'aide au calcul — ne remplace
  pas la déclaration officielle SYDAM ».
- Format : PDF téléchargeable et imprimable depuis le navigateur.

### 6.3 Classification HS par IA

Alimente directement le champ « code HS » du simulateur : **l'utilisateur ne
doit jamais avoir à chercher un code HS manuellement s'il ne le connaît pas.**

---

## 7. Schéma de base de données

Tables prévues : `tec_dd_reference` (§ 4.3), `regimes_douaniers`,
`declarations_simulees`, `declaration_lignes`.

```sql
CREATE TABLE regimes_douaniers (
  code_regime TEXT PRIMARY KEY,      -- ex. '4000'
  libelle TEXT NOT NULL,
  categorie TEXT,                    -- import / export / transit / entrepot / admission_temporaire
  taxes_suspendues BOOLEAN DEFAULT false,
  caution_requise BOOLEAN DEFAULT false
);

CREATE TABLE declarations_simulees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  reference TEXT UNIQUE,
  regime_code TEXT REFERENCES regimes_douaniers(code_regime),
  bureau_douane TEXT, importateur_nom TEXT, importateur_code TEXT,
  fournisseur TEXT, pays_origine TEXT, numero_facture TEXT,
  numero_connaissement TEXT, mode_transport TEXT, numero_rccm TEXT,
  devise TEXT DEFAULT 'XOF', taux_change NUMERIC(12,4),
  fret_total NUMERIC(14,2), assurance_total NUMERIC(14,2),
  poids_brut_total NUMERIC(12,3), poids_net_total NUMERIC(12,3),
  fob_total NUMERIC(14,2), caf_total NUMERIC(14,2),
  rpi NUMERIC(14,2), ts NUMERIC(14,2) DEFAULT 20000,
  total_a_payer NUMERIC(14,2),
  statut TEXT DEFAULT 'brouillon',   -- brouillon / finalisee
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE declaration_lignes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id UUID REFERENCES declarations_simulees(id) ON DELETE CASCADE,
  ligne_parent_id UUID REFERENCES declaration_lignes(id),  -- NULL si ligne principale
  numero_ligne TEXT NOT NULL,        -- ex. '1', '1.1', '1.2'
  code_hs TEXT REFERENCES tec_dd_reference(code_hs),
  designation TEXT, quantite NUMERIC(12,3), poids_brut NUMERIC(12,3),
  fob_ligne NUMERIC(14,2),
  fret_ligne NUMERIC(14,2),          -- calculé au prorata
  assurance_ligne NUMERIC(14,2),     -- calculé au prorata
  caf_ligne NUMERIC(14,2), taux_dd NUMERIC(5,2),
  dd NUMERIC(14,2), rst NUMERIC(14,2), pcs NUMERIC(14,2),
  pua NUMERIC(14,2), pcc NUMERIC(14,2), tva NUMERIC(14,2),
  classification_ia JSONB,           -- réponse JSON complète de la section 8
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS impérative** sur `declarations_simulees` et `declaration_lignes` : chaque
utilisateur ne voit que ses propres déclarations, sauf l'admin.
`tec_dd_reference` et `regimes_douaniers` sont en lecture publique — ce sont des
référentiels, pas des données personnelles.

---

## 8. Contrat d'interface JSON de la classification

Structure **stable** entre le moteur de classification et le frontend. Ne pas la
modifier sans mettre à jour toutes les fonctions qui la consomment.

```json
{
  "hs_code": "8442.50.00.00",
  "denomination_officielle": "Caractères, clichés, planches, cylindres et autres organes similaires",
  "identification_article": "Plaque d'impression CTP (Computer-to-Plate)",
  "description_detaillee": "Plaque offset destinée à la gravure directe par laser…",
  "caracteristiques": [
    "Support aluminium ou polyester",
    "Usage : impression offset",
    "Pas un support d'enregistrement au sens du Chapitre 37"
  ],
  "section": "XVI",
  "chapitre": "84",
  "position": "8442",
  "sous_position": "8442.50",
  "code_uemoa_10_chiffres": "8442.50.00.00",
  "notes_explicatives": "Distinction Chapitre 37 vs Chapitre 84 : …",
  "regles_classification": ["RGI 1"],
  "taux_dd": {
    "valeur": 5.0,
    "source": "tec_dd_reference",
    "verifie_en_base": true,
    "mention": "Taux vérifié dans la base TEC UEMOA officielle (Règlement N°02/2022/CM/UEMOA)"
  },
  "tva": 18.0,
  "restrictions": { "type": "aucune", "detail": null },
  "confiance": {
    "identification_produit": "elevee",
    "note": "Description suffisamment précise pour un classement sans ambiguïté"
  },
  "methode": "classification_7_etapes_v1",
  "code_non_trouve_en_base": false,
  "code_proche_indicatif": null,
  "horodatage": "2026-08-08T00:00:00Z"
}
```

**Cas où le code n'est pas trouvé en base — obligatoire à gérer :**

```json
{
  "hs_code": null,
  "code_non_trouve_en_base": true,
  "code_proche_indicatif": "8443.32.00.00",
  "mention_utilisateur": "Ce code n'a pas pu être confirmé dans la base TEC UEMOA officielle…",
  "taux_dd": null,
  "confiance": {
    "identification_produit": "moyenne",
    "note": "Article possiblement hors nomenclature standard ou erreur de saisie…"
  }
}
```

**Valeurs possibles**

- `restrictions.type` : `"aucune"` | `"licence"` | `"controle_sanitaire"` |
  `"controle_phytosanitaire"` | `"autre"`
- `confiance.identification_produit` : `"elevee"` | `"moyenne"` | `"faible"`
- `regles_classification` : tableau parmi `"RGI 1"`, `"RGI 2a"`, `"RGI 2b"`,
  `"RGI 3a"`, `"RGI 3b"`, `"RGI 3c"`, `"RGI 4"`, `"RGI 5"`, `"RGI 6"`

---

## 9. Architecture technique

### 9.1 Fonctions « edge » à créer

- **`classification_hs`** — entrée : description libre (+ photo optionnelle).
  Traitement : appel à l'API Claude avec le cours de la section 2 injecté en
  contexte système, raisonnement en 7 étapes, puis vérification SQL contre
  `tec_dd_reference`. Sortie : JSON conforme à la section 8.
- **`calcul_douane`** — entrée : déclaration complète (en-tête + lignes).
  Traitement : formules de la section 3, prorata multi-lignes, régimes
  suspensifs. Sortie : déclaration enrichie de tous les montants + récapitulatif.
- **`generation_pdf_declaration`** — entrée : `declaration_id`. Sortie : PDF
  stocké dans Supabase Storage, lien de téléchargement retourné.

### 9.2 Intégration avec l'existant

Le simulateur doit pouvoir être **appelé depuis le module Import**
(`/import/nouvelle-demande`) pour estimer les droits pendant la cotation, sans
obliger l'utilisateur à ressaisir ce qu'il a déjà donné. Même intégration côté
Export si pertinent.

Respecter le thème visuel « Marché Vivant » déjà en place — ocre soleil +
émeraude, police Baloo 2 pour les titres.

---

## 10. Règles de méthode de travail — non négociables

1. **Étape par étape** : ne jamais démarrer une fonctionnalité suivante avant que
   la précédente soit confirmée fonctionnelle et **testée avec une preuve
   concrète** (capture d'écran, test réel — pas seulement « vérifié en base »).
2. **`npm run build` sans erreur avant chaque commit.**
3. **Développement sur branche séparée ; fusion vers `main` uniquement après
   validation explicite du fondateur sur preuves concrètes.**
4. Le fondateur est novice en développement : **toute explication simple**, sans
   jargon non expliqué.
5. **Jamais de clé API ou de secret en clair dans les échanges** — guider le
   fondateur pour qu'il les dépose lui-même dans Supabase (Project Settings →
   Edge Functions → Secrets).
6. Vérifier l'état actif des connecteurs Supabase et Canva avant toute tâche qui
   en dépend — ils se déconnectent parfois seuls.
7. **Un seul modèle IA pour la classification (Claude)**, jamais de double
   vérification par une seconde IA. La fiabilité vient de la vérification
   systématique contre `tec_dd_reference`.
8. **Le taux EUR/XOF est un ancrage fixe légal (655,957 FCFA)**, jamais une
   valeur de marché récupérée par API.

---

## 11. Glossaire

| Sigle | Signification |
|---|---|
| DD | Droit de Douane |
| RST | Redevance STatistique |
| PCS | Prélèvement Communautaire de Solidarité (UEMOA) |
| PUA | Taxe fixe UEMOA, 0,2 % du CAF |
| PCC | Prélèvement Communautaire CEDEAO |
| TVA | Taxe sur la Valeur Ajoutée |
| RPI | Redevance de Prestation Informatique |
| TS | Timbre Statistique |
| CAF | Coût, Assurance, Fret (valeur en douane) |
| FOB | Free On Board (valeur marchandise au port de départ) |
| SYDAM | Système Automatisé de Dédouanement des Marchandises (logiciel officiel DGD-CI) |
| DGD-CI | Direction Générale des Douanes — Côte d'Ivoire |
| DAI | Déclaration Anticipée d'Importation |
| BIVAC / COTECNA | Sociétés d'inspection avant embarquement |
| SH | Système Harmonisé |
| RGI | Règles Générales d'Interprétation |
| UEMOA | Union Économique et Monétaire Ouest Africaine |
| CEDEAO | Communauté Économique des États de l'Afrique de l'Ouest |
| TEC | Tarif Extérieur Commun |
| RCCM | Registre du Commerce et du Crédit Mobilier |
| BL / LTA | Bill of Lading (maritime) / Lettre de Transport Aérien |

---

## Écarts assumés par rapport au document, et pourquoi

*Ajouté par Claude Code — à valider par le fondateur.*

1. **Préfixe des tables.** Le document nomme les tables `tec_dd_reference`,
   `regimes_douaniers`, etc. Toutes les tables de Maylary portent le préfixe
   `app_e08c374bc4_`, sans exception. Les noms retenus sont donc
   `app_e08c374bc4_tec_dd_reference`, `app_e08c374bc4_regimes_douaniers`… Rompre
   la convention pour un seul module coûterait plus cher que de la suivre.
2. **Le calcul vit en fonction Postgres, pas en fonction « edge ».** Le document
   prévoit `calcul_douane` en Edge Function. La liquidation est écrite en
   PL/pgSQL (`app_e08c374bc4_liquider_declaration`) : c'est du calcul pur sur des
   données de la base, il est plus rapide, testable en SQL, et appelable
   directement par la cotation d'import sans passage réseau. Une Edge Function
   pourra l'exposer en API publique le jour où un tiers l'appellera — elle ne
   fera qu'appeler cette fonction. `classification_hs` et
   `generation_pdf_declaration`, elles, seront bien des Edge Functions : la
   première appelle un modèle externe, la seconde produit un fichier.
