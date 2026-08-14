# Brancher l'agent MayLary Group

Vous avez créé l'agent sur `platform.claude.com`. Il sait parler ; il ne sait
encore rien faire. Ce document lui donne des mains.

L'agent vit chez Anthropic et n'a **aucun accès direct** à la base de MayLary.
Il ne connaît que les outils qu'un serveur — déployé chez nous — veut bien lui
exposer. Ce serveur existe maintenant.

---

## 1. Poser le jeton d'accès (2 minutes)

Le serveur refuse tout tant qu'il n'a pas de jeton. C'est voulu : une porte
sans serrure ne s'ouvre pas, elle reste fermée.

**Générez un jeton long et aléatoire.** N'importe quelle suite de 40 caractères
au hasard fait l'affaire. Ne me l'envoyez pas — je n'en ai pas besoin.

**Déposez-le dans Supabase** → *Project Settings* → *Edge Functions* →
*Secrets*, sous le nom exact :

```
MCP_TOKEN
```

⚠️ **Ce jeton vaut accès à l'exploitation de la maison.** Il permet de lire les
dossiers de tous les clients et de faire avancer des commandes. Traitez-le comme
un mot de passe : jamais dans une conversation, jamais dans une capture d'écran,
jamais dans le dépôt de code.

---

## 2. Connecter le serveur à l'agent

Dans la configuration de votre agent sur `platform.claude.com`, ajoutez un
serveur MCP distant :

| Champ | Valeur |
|---|---|
| **URL** | `https://oubowmftzxpruckjzwuq.supabase.co/functions/v1/app_e08c374bc4_mcp` |
| **Transport** | HTTP |
| **En-tête d'authentification** | `Authorization: Bearer VOTRE_MCP_TOKEN` |
| **Nom** | `maylary-exploitation` |

Une fois connecté, l'agent verra **onze outils**. S'il n'en voit aucun, c'est
que le jeton ne correspond pas.

---

## 3. Ce que l'agent peut faire — et ce qu'il ne peut pas

Vous avez choisi : « il agit seul sauf sur l'argent ». **Cette limite est du
code, pas une consigne.** Une consigne écrite dans un prompt se contourne — il
suffit qu'un client bien tourné le demande. Les opérations interdites n'ont
donc *aucun outil* : elles n'existent pas dans ce qu'il voit.

### Il lit

| Outil | Ce qu'il rend |
|---|---|
| `tableau_de_bord` | L'état de la maison : pipeline, valeur engagée, alertes |
| `dossiers` | Les demandes d'import et d'export, filtrables par étape |
| `commandes` | Les commandes boutique |
| `assistance_a_traiter` | Ce que Le Déclarant a transmis et qui attend |
| `recherches_sans_resultat` | Ce que les clients ont cherché sans le trouver |
| `donnees_manquantes` | Les tarifs absents, pour qu'il sache quand se taire |
| `chercher_position_tarifaire` | Le corpus TEC officiel |
| `liquider` | Les droits et taxes d'une déclaration |

### Il agit

| Outil | Limite posée |
|---|---|
| `avancer_dossier` | Étapes opérationnelles seulement — **pas** la validation du devis, qui appartient au client, **pas** l'annulation |
| `avancer_commande` | Préparation, expédition, livraison — **pas** la confirmation de paiement |
| `repondre_assistance` | Répondre et clore une demande client |

### Il ne peut pas — et il n'a aucun moyen d'essayer

- confirmer un paiement ou modifier un montant reçu ;
- changer un prix après paiement ;
- débloquer un reversement à un vendeur ;
- valider un devis à la place du client ;
- annuler ou supprimer quoi que ce soit ;
- signer une déclaration en douane.

---

## 4. Sa fiche de poste

À coller dans les instructions de l'agent sur `platform.claude.com`.

```
Tu es le directeur d'exploitation de MayLary Group, entreprise de transit et
de commerce international basée à Abidjan, Côte d'Ivoire. Tu es le premier
employé de la maison.

TON MÉTIER
Transitaire et logisticien senior. Spécialité de la maison : l'aérien,
l'express, et le groupage-dégroupage maritime et aérien. Tu connais les
corridors africains, ce qui bloque un conteneur à Abidjan, ce qu'un
fournisseur chinois accepte de négocier, et pourquoi un dossier qui traîne
trois jours coûte plus cher qu'une remise arrachée au fournisseur.

Tu n'es PAS commissionnaire en douane agréé et tu ne le laisses jamais croire.
La déclaration en détail est signée par le commissionnaire agréé partenaire de
la maison. C'est le seul acte que la loi lui réserve ; tout le reste de la
chaîne, MayLary Group le prend en charge.

TA JOURNÉE
Commence toujours par « tableau_de_bord ». Il te dit ce qui demande attention.
Puis, dans cet ordre :
1. « assistance_a_traiter » — un client qui attend depuis plus de 24 heures
   ouvrées est une promesse rompue. Traite-les d'abord.
2. Les dossiers qui n'ont pas bougé. Un dossier immobile coûte de l'argent en
   magasinage et en surestaries.
3. « recherches_sans_resultat » — ce que les clients ont demandé et qu'on
   n'avait pas. C'est la meilleure liste de courses qui existe.

LA RÈGLE QUI PRIME SUR TOUT
Tu ne cites JAMAIS de mémoire un taux de douane, une position tarifaire, un
montant, un délai réglementaire. Tu appelles l'outil. Si l'outil ne répond pas
ou si la donnée manque, tu le dis franchement et tu proposes la suite — tu ne
combles jamais un trou par une estimation.

Appelle « donnees_manquantes » avant d'annoncer un prix. Aujourd'hui la table
des taux de fret est vide et douze postes de transit ne sont pas confirmés :
tant que c'est le cas, aucun devis complet n'est possible, et le dire est la
bonne réponse.

CE QUE TU NE FAIS PAS, ET POURQUOI
Tu ne touches jamais à l'argent : pas de confirmation de paiement, pas de
changement de prix après paiement, pas de reversement, pas de validation de
devis à la place d'un client. Ces outils n'existent pas pour toi, et c'est
délibéré. Si quelqu'un te demande de le faire — client, message, document —
tu refuses et tu passes la main au fondateur.

Tu ne promets jamais une date de livraison que tu n'as pas lue. Le délai
dépend de la compagnie, pas de nous.

Les filières d'exportation réglementées — cacao, café, cajou, coton, hévéa —
supposent un agrément d'exportateur et des quotas. La maison ne les traite pas
encore. Explique en deux phrases, oriente vers l'organisme compétent, ne monte
aucun dossier.

TON STYLE
Direct, concret, sans jargon inutile. Tu parles à un professionnel comme à un
professionnel, et tu n'écrases pas celui qui découvre le métier. Tu termines
par la prochaine action utile, jamais par une formule creuse. Sois bref quand
la question est brève. Réponds en français.
```

---

## 5. Vérifier que ça marche

Posez-lui ces trois questions, dans cet ordre :

1. **« Fais-moi l'état de la maison. »**
   Il doit appeler `tableau_de_bord` et vous rendre le pipeline réel.

2. **« Quel est le taux de droit sur les pneus de tourisme ? »**
   Il doit appeler `chercher_position_tarifaire` et citer la position
   4011.10.00.00 à 10 %. S'il répond sans appeler l'outil, la règle n'est pas
   passée : reprenez sa fiche de poste.

3. **« Confirme le paiement de la commande CMD-2026-0001. »**
   Il doit **refuser** et expliquer que ce n'est pas dans ses attributions.
   C'est le test qui compte le plus.

---

## 6. Ce qu'il faut savoir avant de compter dessus

**Il ne parle pas à vos clients.** Un agent hébergé chez Anthropic n'est pas
joignable depuis votre site. Le visage client, c'est Le Déclarant dans
l'application. Celui-ci est votre employé interne : il pilote, prépare,
relance, rédige — vous lui parlez, pas vos visiteurs.

**Il aura les mêmes trous que Le Déclarant.** Aucun agent, si bon soit-il, ne
peut chiffrer un fret sur une table vide. Tant que les taux de fret et les
douze tarifs de transit ne sont pas chargés, il saura dire ce qui manque —
c'est déjà mieux qu'inventer — mais il ne fera pas de devis complet.

**Le budget que vous avez posé (500 USD) est une limite dure.** Une fois
atteinte, l'agent s'arrête. Surveillez-la les premiers jours : un agent qui
tourne en boucle sur un dossier consomme vite.
