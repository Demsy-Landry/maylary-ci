# SCHÉMA DIRECTEUR TECHNIQUE — MAYLARY CI
## Document de pilotage pour Claude Code (et tout agent de développement)

**Dépôt :** `Demsy-Landry/maylary-ci`  
**Stack :** React + TypeScript + Vite + Supabase (Postgres + Auth + Storage + Edge Functions Deno) + Vercel  
**Date :** 14 août 2026  
**Statut :** Document opérationnel — à lire **avant toute modification**  
**Vision business :** Plateforme lean, automatisée, priorité Aérien / Express / Groupage-dégroupage. Fondateur encore salarié, zéro bureau, intervention humaine ciblée uniquement.

---

## 0. Règles non négociables (à respecter dans chaque session)

1. **Ne jamais afficher un chiffre non vérifié.** Si une donnée (taux, barème, fret, droit, assurance) est absente ou périmée → afficher « non disponible » ou bloquer le calcul. **Jamais inventer.**
2. **La base fait respecter les règles, pas l’écran.** Contraintes SQL, RLS, triggers > validations UI.
3. **Le prix ne bouge jamais après paiement.** Toute évolution de barème s’applique uniquement aux nouvelles commandes.
4. **Séparer débours et chiffre d’affaires** (SYSCOHADA). Les écritures comptables sont déjà structurées ainsi — ne pas casser.
5. **Priorité métier :** Aérien / Express / Groupage-dégroupage. Le volume portuaire lourd est secondaire.
6. **Intervention humaine minimale.** Automatiser tout ce qui peut l’être. Le fondateur n’intervient que sur : dédouanement (via CAD), litiges, validation qualité, décisions stratégiques.
7. **H0 d’abord.** Une vente complète de bout en bout prime sur toute nouvelle fonctionnalité.
8. **Architecture « moteur + véhicule ».** Le Déclarant reste un service (API / moteur tarifaire). MayLary le consomme. Ne pas le fusionner comme simple onglet.
9. **Sécurité :** RLS partout, liste blanche des edge functions (migration 20260810a). Ne jamais bypasser.
10. **Noms en français** pour tables / colonnes (convention existante du projet). TypeScript strict.

---

## 1. État réel de l’application (inventaire honnête)

### 1.1 Construit et fonctionnel

| Domaine | Éléments clés | Zones de code |
|---------|---------------|---------------|
| Boutique GP | Catalogue, panier, commande, choix transporteur, fret séparé | `CatalogueGrandPublic`, `CommandeGP`, `useCartGP`, `ProduitDetailGP` |
| Espace Pro | 16 rayons, devis, paliers | `CataloguePro`, `CatalogueSecteurPro`, `PanierDevis`, `usePaliers` |
| Import / Export | Demande → cotation → suivi → documents | `NouvelleDemandeImport/Export`, admin `ImportGestion` / `ExportGestion` |
| Sourcing | Recherche + chiffrage | `SourcingGP`, edge `app_..._sourcing` |
| Coût de revient | FOB + fret + assurance CIMA + douane | `src/lib/cout-import.ts`, `supabase/functions/_partage/cout-import.ts` |
| Facturation PDF | Proforma + définitive | `facture-pdf.ts`, `bulletin-pdf.ts` |
| Comptabilité | Partie double SYSCOHADA, équilibre imposé | migrations `20260804a/b`, page `Comptabilite` |
| Marketplace | Inscription vendeur, commission, reversements | `EspaceVendeur`, admin `VendeursGestion` |
| Paiement | Wave (lien manuel), virement SGCI, ref unique + reçu | `DeclarerPaiement`, admin `CanauxPaiementCard` |
| Garantie Payé-Protégé | Reversement bloqué jusqu’à confirmation réception | migration `20260807a`, `ConfirmerReception`, `GarantiePayeProtege` |
| Achats groupés | Réservation, seuil, conversion | `AchatsGroupes`, admin `AchatsGroupesGestion` |
| Le Déclarant | Classification HS + liquidation | `Declarant.tsx`, edge `classification_hs`, migrations `20260807c` → `20260809` |
| Sécurité | RLS, liste blanche fonctions (10 août 2026) | `docs/reference/SECURITE.md`, migration `20260810a` |
| CJ Dropshipping | Import, stock, commande, retarification | edges `cj_*`, admin `CjDropshippingImport` |
| Régie pub | Emplacements | `EmplacementPublicitaire` |
| Admin | Dashboard, commandes, fournisseurs, qualité, équipe | `src/pages/admin/*` |

### 1.2 Construit mais vide / non prouvé

- 0 vendeur marketplace inscrit
- 0 campagne d’achat groupé ouverte
- 0 écriture comptable **réelle** (mécanique prête, aucune commande payée + comptabilisée)
- Commandes créées mais **aucune payée et confirmée de bout en bout**

### 1.3 Manquant critique (bloquant H0 / H1)

| # | Manque | Impact | Priorité |
|---|--------|--------|----------|
| 1 | Clé API / webhook Wave (ou opérateur équivalent) | Paiement toujours manuel | **P0** |
| 2 | Liste officielle positions exonérées APE phase 4 | Calcul préférence incomplet | **P0** |
| 3 | Barèmes transit locaux complets (≈12 postes) | Cotations transit incomplètes | **P0** |
| 4 | Table de taux de fret réels (mécanique prête, table vide) | Fret affiché = estimation ou vide | **P0** |
| 5 | Branchement comptabilisation auto des commandes payées | Écritures restent à 0 | **P0** |
| 6 | Suivi par référence sans compte | Destinataire ≠ commanditaire bloqué | P1 |
| 7 | Service client organisé (canal + délai + trace) | Pas de support traçable | P1 |
| 8 | Mesure d’audience / conversion | Aucune décision data-driven | P1 |
| 9 | Droit Unique de Sortie (cacao, café, cajou…) | Export incomplet | P2 |
| 10 | Registre réglementaire élargi (médicaments, phyto, ARTCI…) | Alertes partielles | P2 |
| 11 | Connecteurs fournisseurs additionnels (vidaXL, BigBuy…) | Catalogue limité | P2 |
| 12 | Dernier kilomètre contractualisé | Livraison non formalisée | P2 |

---

## 2. Architecture cible

```
[Client navigateur]
       │
       ▼
[React / Vite / TypeScript]     ← src/pages, src/components, src/hooks, src/lib
       │
       ▼
[Supabase Client]               ← src/lib/supabase.ts
       │
       ├── Postgres (RLS strict) + Migrations SQL
       ├── Auth
       ├── Storage (fichiers privés)
       └── Edge Functions (Deno)  ← supabase/functions/app_e08c374bc4_*
              │
              ├── CJ API
              ├── Classification HS / Liquidation (Le Déclarant)
              ├── Fret / Groupage
              ├── Facturation PDF
              ├── Notifications
              └── (à venir) Webhooks paiement
```

**Principe directeur :**  
- **Le Déclarant** = moteur tarifaire (exposé en API aux autres transitaires demain).  
- **MayLary** = véhicule commerce + logistique qui consomme le moteur.

Ne jamais inverser cette séparation.

---

## 3. Roadmap technique ordonnée (pour Claude Code)

### Phase A — H0 « Prouver la boucle » (ne rien faire d’autre tant que non atteint)

**Objectif métier :** Une commande réelle livrée + écriture comptable + avis client.

#### A1. Finaliser le chemin de paiement
- [ ] Intégrer webhook / API Wave (ou opérateur choisi) pour confirmation automatique du paiement
- [ ] Garder le mode manuel (déclaration + validation admin) comme fallback
- [ ] Tests : montant contrôlé, référence unique, non-réutilisable, idempotence
- **Fichiers :** `DeclarerPaiement.tsx`, edge éventuelle, admin `CanauxPaiementCard`, migration paiement

#### A2. Brancher la comptabilisation automatique
- [ ] Déclencher les écritures SYSCOHADA dès qu’une commande passe à l’état « payé »
- [ ] Vérifier équilibre partie double (débit = crédit)
- [ ] Séparer clairement débours (transit) et chiffre d’affaires (marge / commission)
- **Fichiers :** migrations `20260804b`, page `Comptabilite`, edge `commande_gp_marquer_paye` (ou équivalent)

#### A3. Compléter les données manquantes du moteur de coût
- [ ] Charger barèmes transit manquants (table dédiée)
- [ ] Charger taux de fret réels avec **dates de validité strictes**
- [ ] Intégrer liste APE phase 4 (positions exonérées) dès que le fichier officiel est obtenu
- **Règle absolue :** si donnée absente → « non disponible », jamais de valeur inventée

#### A4. Parcours de test H0 (checklist obligatoire)
1. Créer / utiliser un produit existant
2. Passer une commande GP
3. Déclarer / confirmer le paiement
4. Générer facture proforma + définitive
5. Vérifier l’écriture comptable (équilibrée)
6. Simuler réception + confirmation client
7. Vérifier déblocage de la garantie Payé-Protégé
8. Déposer un avis client

**Condition de sortie H0 :** 1 commande état « livrée » + 1 écriture comptable équilibrée + 1 avis.

---

### Phase B — H1 « Self-service »

#### B1. Suivi sans compte
- [ ] Page / token de suivi par référence de commande
- [ ] Visible par le destinataire **sans login**
- [ ] États clairs : payé → en préparation → en transit → livré

#### B2. Service client minimal
- [ ] Canal unique (WhatsApp Business API ou ticket interne lié à la commande)
- [ ] Délai de réponse annoncé
- [ ] Trace des échanges liée à la commande

#### B3. Mesure
- [ ] Analytics (Plausible / GA4 / events custom)
- [ ] Événements clés : vue produit, ajout panier, début checkout, paiement, abandon

#### B4. Robustesse Le Déclarant
- [ ] Améliorer classification HS (edge `classification_hs`)
- [ ] Couverture régimes DGD + origines préférentielles (APE, ZLECAf, CEDEAO)
- [ ] Messages d’erreur clairs quand une donnée manque
- [ ] Préparer endpoint API stable, versionné, authentifié pour consommation externe

**Condition de sortie H1 :** 10 commandes payées avec intervention manuelle limitée au seul dédouanement.

---

### Phase C — H2 « Industrialiser »

- Agents IA supervisés (proposition classification, lecture documents, brouillons réponses)
- Lecture automatique factures / BL / déclarations
- Peuplement marketplace (outils d’onboarding vendeurs guidé)
- Campagnes d’achats groupés récurrentes
- Décision stock / entrepôt (si validée business — optionnel)
- Dernier kilomètre (intégration partenaire livreur)
- Stabilisation du coût de traitement d’une commande

**Condition de sortie H2 :** Coût de traitement d’une commande stabilisé (ne croît plus linéairement avec le volume).

---

### Phase D — H3 « Étendre »

- Multi-origines (Turquie, Europe, Maghreb via ZLECAf)
- Multi-pays UEMOA (même TEC, partenaires locaux)
- Monétisation Le Déclarant (abonnements transitaires)
- Multidevise / multilingue si besoin
- Agrément CAD propre (hors scope code pur — structure juridique)

**Condition de sortie H3 :** Présence multi-pays UEMOA + monétisation du moteur tarifaire.

---

## 4. Zones de code prioritaires (navigation Claude Code)

### Cœur métier coût & douane
- `src/lib/cout-import.ts`
- `supabase/functions/_partage/cout-import.ts`
- `supabase/functions/_partage/fret-groupage.ts`
- `supabase/functions/app_e08c374bc4_classification_hs/`
- `src/pages/Declarant.tsx`
- Migrations `20260807c` → `20260810c` (liquidations, TEC, régimes, origines)

### Commerce & panier
- `src/hooks/useCartGP.tsx`, `useCart.tsx`, `usePaliers.ts`
- `src/pages/CommandeGP.tsx`, `CatalogueGrandPublic.tsx`, `ProduitDetailGP.tsx`
- `src/pages/AchatsGroupes.tsx`

### Paiement & garantie
- `src/components/DeclarerPaiement.tsx`
- `src/components/ConfirmerReception.tsx`
- `src/components/GarantiePayeProtege.tsx`
- Migration `20260807a_garantie_paye_protege.sql`
- Migration `20260803g_paiement_operationnel.sql`

### Comptabilité
- `src/pages/admin/Comptabilite.tsx`
- Migrations `20260804a_comptabilite.sql`, `20260804b_comptabilisation_commandes.sql`

### Admin & ops
- `src/pages/admin/Dashboard.tsx`
- `src/pages/admin/CommandesGP.tsx`
- `src/pages/admin/ImportGestion.tsx` / `ExportGestion.tsx`
- `src/components/admin/CanauxPaiementCard.tsx`

### Sécurité
- `docs/reference/SECURITE.md`
- Migration `20260810a_execution_des_fonctions_sur_liste_blanche.sql`
- RLS sur toutes les tables (ne jamais désactiver)

### Fournisseurs / CJ
- `supabase/functions/_partage/cj-api.ts`
- Edges `cj_dropshipping_*`, `cj_commande`, `cj_stock`, `cj_retarifer`
- `src/pages/admin/CjDropshippingImport.tsx`

### Docs métier à consulter
- `docs/maylary-plan-directeur.md`
- `docs/positionnement-marche.md`
- `docs/BAREMES_TRANSIT_CI.md`
- `docs/reference/SECURITE.md`

---

## 5. Conventions de travail pour Claude Code

### Avant chaque modification
1. Lire les fichiers concernés **et** les migrations liées
2. Vérifier RLS et liste blanche des edge functions
3. Ne pas introduire de valeur codée en dur pour un taux douanier / fret / barème
4. Préférer une **migration SQL** pour toute règle métier durable
5. Vérifier que le prix post-paiement reste figé

### Style de code
- TypeScript strict
- Composants fonctionnels React + hooks
- Edge Functions Deno (pattern existant `app_e08c374bc4_*`)
- Noms de tables / colonnes en **français** (convention du projet)
- Commentaires utiles uniquement sur les règles métier non évidentes
- Pas de `any` inutile ; typer les retours d’API

### Tests minimaux à prévoir
- Calcul coût avec / sans préférence d’origine (APE)
- Passage commande → paiement → écriture comptable équilibrée
- Blocage reversement tant que réception non confirmée (garantie Payé-Protégé)
- Référence de transaction unique et non réutilisable
- Affichage « non disponible » quand un barème manque

### Ce qu’il ne faut PAS faire
- Inventer un taux de droit, de fret ou de barème
- Fusionner Le Déclarant comme simple onglet sans API
- Supprimer ou contourner les triggers de garantie / comptabilité
- Ajouter des features hors roadmap H0 tant que la première vente n’est pas prouvée
- Casser la séparation débours / chiffre d’affaires
- Désactiver ou contourner le RLS
- Committer des secrets (clés API) dans le dépôt

---

## 6. Backlog priorisé (tickets prêts à exécuter)

### P0 — Bloquants H0 (faire en premier)
1. **Webhook / API confirmation paiement** (Wave ou équivalent) + fallback manuel
2. **Comptabilisation auto des commandes payées** (brancher le mécanisme existant)
3. **Chargement barèmes transit manquants** (table)
4. **Chargement table fret réel + dates de validité**
5. **Intégration liste APE phase 4** (dès fichier officiel disponible — ne pas inventer)

### P1 — Self-service
6. Suivi commande par référence (sans compte)
7. Canal support + traçabilité liée à la commande
8. Analytics / événements conversion
9. Robustesse classification HS + messages d’erreur clairs
10. Endpoint API versionné Le Déclarant (préparation monétisation)

### P2 — Scale
11. Onboarding vendeurs marketplace (parcours guidé)
12. Campagnes achats groupés récurrentes
13. Connecteurs fournisseurs additionnels
14. Alertes marchandises réglementées élargies
15. Intégration dernier kilomètre (partenaire)

---

## 7. Critères de « done » par horizon

| Horizon | Condition de sortie technique |
|---------|-------------------------------|
| **H0** | 1 commande état « livrée » + 1 écriture comptable équilibrée + 1 avis client |
| **H1** | 10 commandes payées avec intervention manuelle limitée au seul dédouanement |
| **H2** | Coût de traitement d’une commande stabilisé (ne croît plus linéairement) |
| **H3** | Présence multi-pays UEMOA + monétisation moteur tarifaire |

---

## 8. Prompt type pour démarrer une session Claude Code

```
Tu travailles sur le dépôt Demsy-Landry/maylary-ci
(React + TypeScript + Vite + Supabase + Vercel).

Lis d’abord, dans cet ordre :
1. SCHEMA_DIRECTEUR_MAYLARY_CLAUDE_CODE.md (ce document)
2. docs/maylary-plan-directeur.md
3. docs/reference/SECURITE.md
4. Les fichiers et migrations liés à la tâche

Règles absolues :
- Ne jamais inventer un taux / barème / fret / droit
- Respecter RLS et liste blanche des edge functions
- Priorité H0 : prouver une vente complète avant toute feature non critique
- Architecture moteur + véhicule pour Le Déclarant
- Séparer débours et chiffre d’affaires (SYSCOHADA)
- Le prix ne change jamais après paiement

Tâche de cette session :
[Décrire ici la tâche P0 ou P1 précise, ex. :
« Intégrer la confirmation automatique de paiement Wave avec fallback manuel
et brancher la comptabilisation SYSCOHADA à l’état payé. »]
```

---

## 9. Notes d’environnement

- **Prod :** Vercel, domaine maylarygroup.ci (l’adresse maylary-ci.vercel.app reste servie et redirige)
- **Backend :** Supabase (Postgres + Edge Functions)
- **Paiement cible :** Wave (prioritaire) + virement bancaire SGCI en fallback
- **Comptabilité :** SYSCOHADA, partie double, équilibre imposé par la base
- **Douane :** TEC UEMOA, régimes DGD, origines APE / ZLECAf / CEDEAO, fiches AIRP
- **Priorité transport :** Aérien / Express / Groupage-dégroupage

---

## 10. Historique de ce document

| Date | Action |
|------|--------|
| 14 août 2026 | Création / consolidation du schéma directeur pour Claude Code, aligné sur le Business Plan Lean & Automatisé |

---

**Fin du schéma directeur.**  
Toute session de développement doit commencer par la lecture de ce fichier.
