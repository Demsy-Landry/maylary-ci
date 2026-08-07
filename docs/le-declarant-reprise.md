# Le Déclarant — reconstruction dans Maylary

*Note de décision, 7 août 2026. Le projet d'origine, hébergé sur `atoms.dev`,
est bloqué faute d'abonnement et son code n'est pas récupérable. On reconstruit
à l'intérieur de Maylary.*

## Ce qu'on reconstruit, et pourquoi ici

Deux outils, qui existaient sur `le-declarant.com` :

1. **Recherche de position tarifaire (code SH)** à partir d'une description de
   marchandise, classée selon les **Règles Générales Interprétatives** et les
   notes explicatives.
2. **Éditeur de déclaration** : on saisit les éléments d'une importation, il
   liquide les droits et taxes.

Les intégrer à Maylary plutôt que d'en refaire une application séparée sert
trois choses à la fois :

- **Maylary chiffre enfin n'importe quelle marchandise.** Aujourd'hui la
  cotation automatique ne couvre que le catalogue CJ ; tout le reste passe par
  un atelier manuel, faute de savoir sous quelle position la marchandise entre.
- **Les professionnels s'en servent, et découvrent Maylary.** Un transitaire qui
  vient chercher une position tarifaire est exactement le visiteur qu'on veut :
  il connaît le métier, il juge l'outil sur pièces, et s'il le trouve juste il
  fait confiance au reste.
- **Une seule base, un seul déploiement, une seule facture.** Ce qui compte
  quand on est deux.

## La difficulté réelle : il n'y a pas de moteur sans corpus

Les deux outils n'ont pas du tout la même nature, et les confondre ferait
perdre des semaines.

**La liquidation est de l'arithmétique.** Valeur en douane, assiettes,
taux, ordre d'application. C'est exact, vérifiable, déterministe. On peut le
construire aujourd'hui et le prouver.

**Le classement tarifaire est de la documentation.** Il suppose la nomenclature
du Système Harmonisé — sections, chapitres, positions, sous-positions — et les
notes explicatives qui disent, pour chaque cas limite, où la marchandise tombe.
**Ce corpus, je ne l'ai pas.** Et une recherche de code SH construite sans
corpus ne serait pas un outil approximatif : ce serait une machine à inventer
des codes qui ont l'air justes. Pour un déclarant, c'est pire que rien.

D'où l'ordre : **liquidation d'abord, corpus ensuite, classement en dernier.**

## Le principe qui gouverne tout le module

> **Un outil douanier qui se trompe coûte plus cher que pas d'outil du tout.**

Trois conséquences, appliquées sans exception :

1. **Aucun taux inventé.** Chaque taxe porte sa source et un état
   « confirmé / à confirmer ». Tant qu'une valeur n'a pas été confirmée par le
   fondateur — qui est déclarant agréé —, elle est marquée comme telle jusque
   dans le résultat affiché.
2. **La cotation automatique de Maylary refuse les taux non confirmés.** Elle
   bascule en cotation manuelle plutôt que d'afficher un prix qu'on ne peut pas
   tenir. La règle de la maison — un prix ne bouge jamais après paiement —
   interdit de s'appuyer sur un chiffre incertain.
3. **Le tarif porte une date de version.** Un tarif périmé fait perdre de
   l'argent à qui s'y fie. La date est rendue avec chaque liquidation.

## L'architecture

```
  app_e08c374bc4_taxes_douanieres      ← la structure fiscale, éditable
  app_e08c374bc4_positions_tarifaires  ← le corpus SH + taux DD par position
                    │
                    ▼
      app_e08c374bc4_liquider(...)     ← le moteur, déterministe
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
   /declarant                Maylary
   (les professionnels)      (cotation automatique)
```

Le moteur est une fonction en base, pas du code d'écran. Deux consommateurs
l'appellent, et une API l'expose : un transitaire pourra la payer demain sans
qu'on réécrive quoi que ce soit.

## Ce dont j'ai besoin du fondateur

**Pour la liquidation — une demi-heure de votre temps, et le module devient exact :**

La liste exacte des droits et taxes à l'importation en Côte d'Ivoire, avec pour
chacun : le sigle, l'intitulé, **l'assiette** (sur quoi il se calcule) et le
taux. Ce que je crois savoir est ci-dessous, et **je ne l'utiliserai pas tant
que vous ne l'aurez pas corrigé** — les sources publiques se contredisent déjà
sur la redevance statistique.

| Sigle | Intitulé | Assiette supposée | Taux supposé |
|---|---|---|---|
| DD | Droit de douane | Valeur CAF | 0, 5, 10, 20 ou 35 % selon la catégorie TEC |
| RS | Redevance statistique | Valeur CAF | **1 % ou 2,6 % — sources contradictoires** |
| PCS | Prélèvement communautaire de solidarité (UEMOA) | Valeur CAF | 1 % |
| PC | Prélèvement communautaire (CEDEAO) | Valeur CAF | 0,5 % |
| TVA | Taxe sur la valeur ajoutée | CAF + DD + RS + PCS + PC | 18 % |
| AIRSI | Acompte d'impôt sur le revenu | ? | ? |

Manquent aussi : les taxes spécifiques (riz, alcool, tabac, produits
pétroliers), les exonérations courantes, et le traitement des marchandises
d'origine UEMOA/CEDEAO.

**Pour le classement — la question ouverte :**

Où trouver la nomenclature ? Trois pistes, par ordre de préférence :

1. **Vous l'avez déjà** sous une forme exploitable — fichier, tableur, export
   d'un logiciel de déclaration. C'est de loin le plus rapide.
2. **Le tarif publié par la DGD ou l'UEMOA**, à récupérer et à importer. Faisable
   côté serveur.
3. **Reconstruction progressive** : commencer par les 21 sections et 97
   chapitres, puis remplir les positions au fil des dossiers réels. Lent, mais
   chaque dossier traité enrichit le corpus — et ce corpus devient alors un
   actif que personne d'autre n'a.

## Ordre de travail

1. Structure fiscale + moteur de liquidation + preuve sur cas réels.
2. Page publique `/declarant` et API.
3. Import du corpus SH, dès qu'une source est disponible.
4. Recherche de position assistée, appuyée sur le corpus et les RGI.
5. Branchement de la cotation automatique de Maylary sur le moteur.
