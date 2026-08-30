/**
 * Contrôle des écrans : ce qu'un œil verrait, mesuré par la machine.
 *
 * CE QUI L'A RENDU NÉCESSAIRE
 *
 * Deux défauts sont partis en production sans être vus. Un cycle jour/nuit qui
 * rendait la page d'accueil illisible, et deux textes qui se chevauchaient sur
 * la fiche produit. Dans les deux cas j'avais vérifié la logique — les couleurs
 * en isolation, les classes dans le fichier — et jamais l'écran.
 *
 * Ce script charge les pages dans un vrai navigateur et rapporte trois choses
 * qu'aucune relecture de code ne donne :
 *
 *   1. LES PLANTAGES. Toute erreur de script remontée par la page.
 *   2. LE DÉBORDEMENT HORIZONTAL. Une page plus large que l'écran oblige à
 *      pousser du doigt pour lire une ligne : sur un téléphone c'est
 *      rédhibitoire, et ça ne se voit pas en relisant du CSS.
 *   3. LES TEXTES QUI SE SUPERPOSENT. Deux boîtes de texte dont les rectangles
 *      se recouvrent — exactement le défaut « Acheminement / Groupage maritime »
 *      relevé sur le téléphone du fondateur.
 *
 * CE QU'IL NE FAIT PAS
 *
 * Il ne juge pas le goût, ni la lisibilité d'un contraste. Il attrape ce qui
 * est mécaniquement faux. Le reste demande un œil — mais au moins l'œil n'est
 * plus obligé de chercher ce qu'une machine sait trouver.
 *
 * USAGE
 *
 *   npm run build && node scripts/verifier-ecrans.mjs
 *
 * Le script sert `dist/` lui-même : il contrôle donc ce qui partira réellement,
 * pas ce que le serveur de développement veut bien montrer.
 */

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RACINE, 'dist');
const PORT = 4188;

/* ===========================================================================
   LE COMPTE D'ESSAI
   ===========================================================================

   Les écrans derrière connexion — l'espace client, les vingt-quatre écrans
   d'administration — n'étaient pas contrôlés. C'est précisément là que vivent
   les tableaux denses, ceux où deux textes se marchent dessus.

   POURQUOI UNE SESSION FABRIQUÉE PLUTÔT QU'UN VRAI COMPTE

   Trois raisons, dans cet ordre :

   1. Le contrôle doit pouvoir tourner partout, y compris sans accès au
      serveur. Un audit qui dépend du réseau ne tourne pas le jour où on en a
      le plus besoin.
   2. Il doit être REPRODUCTIBLE. Avec un vrai compte, le résultat change selon
      ce que contient la base ce jour-là : un défaut apparaît lundi et
      disparaît mardi parce qu'une commande a été livrée.
   3. Un compte d'essai réel dans la base de production, c'est une porte de
      plus à surveiller. Celui-ci n'existe nulle part.

   Ce qu'on fabrique : une session déposée dans le stockage du navigateur, et
   toutes les requêtes au serveur interceptées. La bibliothèque cliente ne
   vérifie pas la signature du jeton — elle en lit seulement la date
   d'expiration — donc un jeton de forme correcte suffit.

   CE QUE ÇA CONTRÔLE, ET CE QUE ÇA NE CONTRÔLE PAS

   Ça contrôle la MISE EN PAGE : plantages, débordements, chevauchements, sur
   des écrans vides comme sur des écrans remplis. Ça ne contrôle ni les droits
   d'accès, ni les calculs, ni ce que la base renvoie vraiment — pour cela il
   faut le serveur, et ce sont d'autres contrôles.
   =========================================================================== */

const PROJET = 'oubowmftzxpruckjzwuq';
const CLE_SESSION = `sb-${PROJET}-auth-token`;
const UTILISATEUR = '00000000-0000-4000-8000-000000000001';

/** Un jeton de forme correcte, valable très longtemps, jamais signé. */
function jetonDEssai() {
  const b64 = (o) =>
    Buffer.from(JSON.stringify(o)).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const entete = b64({ alg: 'HS256', typ: 'JWT' });
  const charge = b64({
    sub: UTILISATEUR,
    email: 'essai@maylarygroup.ci',
    role: 'authenticated',
    aud: 'authenticated',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    user_metadata: { nom_complet: 'Compte d’essai' },
  });
  return `${entete}.${charge}.signature-absente-volontairement`;
}

const UTILISATEUR_JSON = {
  id: UTILISATEUR,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'essai@maylarygroup.ci',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email' },
  user_metadata: { nom_complet: 'Compte d’essai' },
  identities: [],
};

/**
 * Ce que le serveur répond, table par table.
 *
 * Le défaut est le TABLEAU VIDE : un écran sans donnée est un état réel, qu'il
 * faut contrôler aussi — c'est même celui que voit le premier client. Seules
 * les tables qui commandent la navigation reçoivent un contenu.
 */
/**
 * DEUX COMPTES, ET NON UN SEUL.
 *
 * Les écrans client refusent explicitement les administrateurs :
 *
 *     if (!user || isAdmin) return <Navigate to="/boutique/compte" />;
 *
 * C'est voulu — un administrateur n'a rien à faire dans l'espace client — mais
 * cela veut dire qu'un seul compte ne peut pas contrôler les deux espaces. Avec
 * le seul compte administrateur, quatre écrans client renvoyaient ailleurs et
 * n'étaient jamais vus.
 *
 * `role_equipe` compte autant : `AdminRoute` filtre écran par écran dessus, et
 * « propriétaire » est le seul rôle qui les ouvre tous.
 */
const PROFILS = {
  client: {
    id: UTILISATEUR,
    user_id: UTILISATEUR,
    type_compte: 'client',
    role_equipe: null,
    nom_complet: 'Cliente d’essai',
    email: 'essai@maylarygroup.ci',
    telephone: '+225 00 00 00 00 00',
    created_at: '2026-01-01T00:00:00Z',
  },
  admin: {
    id: UTILISATEUR,
    user_id: UTILISATEUR,
    type_compte: 'admin',
    role_equipe: 'proprietaire',
    nom_complet: 'Compte d’essai',
    email: 'essai@maylarygroup.ci',
    telephone: '+225 00 00 00 00 00',
    created_at: '2026-01-01T00:00:00Z',
  },
};

const FIXTURES = {};

/**
 * Les PROCÉDURES rendent un OBJET, pas un tableau.
 *
 * Première version du contrôle : toutes les réponses étaient des tableaux
 * vides, procédures comprises. Le tableau de bord faisait alors
 * `tb.alertes.length` sur un tableau vide — `alertes` valait `undefined` — et
 * plantait. Le contrôle a rapporté soixante-six défauts qui n'existaient pas.
 *
 * La leçon vaut d'être écrite : un contrôle mal réglé n'est pas neutre, il
 * ment. Et il ment dans le sens qui coûte le plus cher — il envoie chercher des
 * pannes ailleurs qu'où elles sont.
 *
 * Les formes ci-dessous sont RECOPIÉES DES TYPES DÉCLARÉS dans le code, pas
 * inventées. Les valeurs sont neutres : ce qu'on contrôle est la mise en page,
 * pas le contenu.
 */
const PROCEDURES = {
  app_e08c374bc4_tableau_de_bord: {
    pipeline_import: [],
    pipeline_export: [],
    alertes: [],
    engage: { dossiers: 0, valeur_fcfa: 0 },
    a_traiter: {},
    argent: { a_reverser_fcfa: 0, encaisse_30j_fcfa: 0 },
    sourcing: { fournisseurs: 0, api_branchees: 0, api_a_obtenir: 0, pistes_a_contacter: 0 },
    catalogue: { produits_actifs: 0, ruptures: 0 },
  },
  app_e08c374bc4_tableau_dossiers: {
    par_etape: [],
    ouverts: 0,
    archives: 0,
    incomplets: [],
    pieces_les_plus_absentes: [],
  },
  app_e08c374bc4_demonstration: { actif: false, imports: 0, exports: 0 },
};

/** Les écrans publics, ceux qu'un visiteur atteint sans compte. */
const ECRANS = [
  ['/', 'Accueil'],
  ['/services', 'Services'],
  ['/boutique', 'Boutique'],
  ['/import', 'Import'],
  ['/export', 'Export'],
  ['/sourcing', 'Sourcing'],
  ['/achats-groupes', 'Achats groupés'],
  ['/vendre', 'Devenir vendeur'],
  ['/declarant', 'Le Déclarant'],
  ['/poids-taxable', 'Poids taxable'],
  ['/a-propos', 'À propos'],
  ['/conditions-generales', 'Conditions générales'],
  ['/confidentialite', 'Confidentialité'],
  ['/mentions-legales', 'Mentions légales'],
];

/** Les écrans de l'espace client — refusés aux administrateurs. */
const ECRANS_CLIENT = [
  ['/mon-compte', 'Mon compte'],
  ['/boutique/panier', 'Panier'],
  ['/boutique/mes-commandes', 'Mes commandes'],
  ['/catalogue/mes-devis', 'Mes devis'],
  ['/import/mes-demandes', 'Mes demandes d’import'],
  ['/export/mes-demandes', 'Mes demandes d’export'],
  ['/mes-expeditions', 'Mes expéditions'],
];

/** Les écrans d'administration. */
const ECRANS_ADMIN = [
  ['/admin', 'Administration — tableau de bord'],
  ['/admin/commandes', 'Admin — commandes'],
  ['/admin/produits', 'Admin — catalogue'],
  ['/admin/import', 'Admin — import'],
  ['/admin/export', 'Admin — export'],
  ['/admin/devis', 'Admin — devis'],
  ['/admin/dossiers', 'Admin — dossiers'],
  ['/admin/comptabilite', 'Admin — comptabilité'],
  ['/admin/vendeurs', 'Admin — vendeurs'],
  ['/admin/assistance', 'Admin — assistance'],
  ['/admin/parametres', 'Admin — paramètres'],
  ['/admin/equipe', 'Admin — équipe'],
  ['/admin/fournisseurs', 'Admin — fournisseurs'],
  ['/admin/frais-destination', 'Admin — frais de destination'],
  ['/admin/journal-erreurs', 'Admin — journal des erreurs'],
];

/** Deux largeurs : le téléphone le plus étroit encore courant, et un portable. */
const TAILLES = [
  { nom: 'téléphone', largeur: 360, hauteur: 780 },
  { nom: 'ordinateur', largeur: 1280, hauteur: 900 },
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

/** Un serveur minimal qui se comporte comme l'hébergeur : tout le reste → index. */
function servir() {
  return new Promise((resoudre) => {
    const serveur = createServer(async (req, res) => {
      const chemin = decodeURIComponent((req.url ?? '/').split('?')[0]);
      let fichier = join(DIST, chemin);
      try {
        const s = await stat(fichier);
        if (s.isDirectory()) fichier = join(fichier, 'index.html');
      } catch {
        fichier = join(DIST, 'index.html');
      }
      try {
        const contenu = await readFile(fichier);
        res.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] ?? 'application/octet-stream' });
        res.end(contenu);
      } catch {
        res.writeHead(404).end('introuvable');
      }
    });
    serveur.listen(PORT, () => resoudre(serveur));
  });
}

/**
 * Les textes qui se recouvrent.
 *
 * On ne compare que des éléments PORTANT DU TEXTE et sans enfant élément : un
 * parent recouvre toujours son enfant, ce n'est pas un défaut. Et on tolère un
 * chevauchement d'un pixel, qui vient des arrondis de rendu.
 */
const CHERCHER_CHEVAUCHEMENTS = () => {
  /*
   * Un élément SORTI DU FLUX recouvre légitimement le reste : c'est le rôle
   * d'une bannière de cookies, d'un bouton flottant, d'un menu déroulant. Il
   * faut donc regarder tous les PARENTS, et non le seul élément : la bannière
   * est bien en `fixed`, mais le texte qu'elle contient, lui, est en `static`.
   *
   * Sans cette remontée, le contrôle rapportait cinquante et un chevauchements
   * dont l'écrasante majorité venait de la bannière de cookies et du bouton du
   * Déclarant. Un contrôle qui crie sur tout n'est plus lu.
   */
  const horsDuFlux = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.position === 'fixed' || s.position === 'sticky' || s.position === 'absolute') return true;
      if (Number(s.zIndex) > 0) return true;
    }
    return false;
  };

  const feuilles = [...document.querySelectorAll('body *')].filter((el) => {
    if (el.children.length > 0) return false;
    const t = (el.textContent ?? '').trim();
    if (t.length < 2) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.05) return false;
    /*
     * Les éléments EN LIGNE n'ont pas de géométrie exploitable. Un `<em>` au
     * milieu d'un paragraphe qui passe à la ligne voit son rectangle englober
     * les deux lignes entières : il recoupe alors mécaniquement ses voisins,
     * sans que rien ne se chevauche à l'œil.
     * C'est ce qui faisait rapporter cinq faux chevauchements sur les
     * conditions générales, où six états de commande sont cités en italique
     * dans une même phrase.
     */
    if (s.display === 'inline') return false;
    if (horsDuFlux(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  });

  const trouves = [];
  for (let i = 0; i < feuilles.length; i++) {
    for (let j = i + 1; j < feuilles.length; j++) {
      const a = feuilles[i].getBoundingClientRect();
      const b = feuilles[j].getBoundingClientRect();
      const largeur = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const hauteur = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (largeur > 1 && hauteur > 1) {
        trouves.push({
          a: (feuilles[i].textContent ?? '').trim().slice(0, 42),
          b: (feuilles[j].textContent ?? '').trim().slice(0, 42),
          surface: Math.round(largeur * hauteur),
        });
      }
    }
  }
  return trouves.slice(0, 6);
};

/**
 * Pose la session d'essai et détourne tout ce qui part vers le serveur.
 *
 * Rien ne sort de la machine : chaque appel reçoit une réponse fabriquée ici.
 * C'est ce qui rend le contrôle reproductible — et exécutable hors ligne.
 */
async function connecter(page, role) {
  const jeton = jetonDEssai();

  await page.addInitScript(
    ({ cle, jeton, utilisateur }) => {
      const session = {
        access_token: jeton,
        refresh_token: 'essai-jamais-utilise',
        token_type: 'bearer',
        expires_in: 60 * 60 * 24 * 365,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
        user: utilisateur,
      };
      try {
        localStorage.setItem(cle, JSON.stringify(session));
      } catch {
        /* stockage refusé : la passe connectée n'aura simplement rien à dire */
      }
    },
    { cle: CLE_SESSION, jeton, utilisateur: UTILISATEUR_JSON },
  );

  await page.route(`**://${PROJET}.supabase.co/**`, async (route) => {
    const url = new URL(route.request().url());
    const repondre = (corps, statut = 200) =>
      route.fulfill({
        status: statut,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Range': '0-0/0' },
        body: JSON.stringify(corps),
      });

    if (url.pathname.startsWith('/auth/v1/user')) return repondre(UTILISATEUR_JSON);
    if (url.pathname.startsWith('/auth/v1/token')) {
      return repondre({
        access_token: jeton,
        refresh_token: 'essai-jamais-utilise',
        token_type: 'bearer',
        expires_in: 60 * 60 * 24 * 365,
        user: UTILISATEUR_JSON,
      });
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const procedure = url.pathname.replace('/rest/v1/rpc/', '').split('?')[0];
      // `null` plutôt qu'un objet vide : les écrans testent `if (data)` avant
      // de lire. Un objet vide passerait le test et ferait planter la lecture,
      // exactement le défaut que ce contrôle a d'abord fabriqué.
      return repondre(PROCEDURES[procedure] ?? null);
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.replace('/rest/v1/', '').split('?')[0];
      if (table === 'app_e08c374bc4_profiles') return repondre([PROFILS[role]]);
      return repondre(FIXTURES[table] ?? []);
    }
    if (url.pathname.startsWith('/functions/v1/')) return repondre({});
    // Images de produit et autres objets : une réponse vide suffit, la mise en
    // page réserve déjà la place.
    return route.fulfill({ status: 200, contentType: 'image/gif', body: '' });
  });
}

const serveur = await servir();
const navigateur = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/** Les deux passes : sans session, puis avec le compte d'essai. */
const PASSES = [
  { nom: 'public', ecrans: ECRANS, role: null },
  { nom: 'client', ecrans: ECRANS_CLIENT, role: 'client' },
  { nom: 'administration', ecrans: ECRANS_ADMIN, role: 'admin' },
];

let defauts = 0;
let controles = 0;

for (const passe of PASSES)
for (const { nom: taille, largeur, hauteur } of TAILLES) {
  for (const [chemin, titre] of passe.ecrans) {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur } });
    const plantages = [];
    page.on('pageerror', (e) => plantages.push(String(e).slice(0, 120)));
    if (passe.role) await connecter(page, passe.role);
    controles++;

    await page.goto(`http://localhost:${PORT}${chemin}`, { waitUntil: 'domcontentloaded' });
    // Le temps que les écrans différés arrivent et que la mise en page se pose.
    await page.waitForTimeout(2200);

    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    const chevauchements = await page.evaluate(CHERCHER_CHEVAUCHEMENTS);

    /*
     * LA BARRIÈRE D'ERREUR REND UNE PAGE PROPRE — DONC MUETTE.
     *
     * Quand un écran plante, React l'attrape et affiche « Cette page s'est
     * arrêtée en chemin ». Rien ne remonte au navigateur : `pageerror` ne se
     * déclenche pas, la page n'a ni débordement ni chevauchement, et le
     * contrôle rendait « aucun défaut » sur un tableau de bord qui ne
     * fonctionnait pas. C'est le premier résultat qu'il a donné, et il était
     * faux.
     *
     * On regarde donc aussi si la page rendue EST l'écran de secours.
     */
    const rattrapee = await page.evaluate(
      () => document.querySelector('[data-frontiere-erreur]') !== null,
    );
    /*
     * Et si l'écran demandé a renvoyé ailleurs — vers la connexion, par
     * exemple — le contrôle ne porte pas sur ce qu'on croit. Mieux vaut le dire
     * que de compter un succès qui n'en est pas un.
     */
    const arrivee = await page.evaluate(() => location.pathname);

    const soucis = [];
    if (rattrapee) soucis.push("PLANTE — l'écran de secours s'affiche à la place");
    if (arrivee !== chemin) soucis.push(`RENVOIE vers ${arrivee} — écran non contrôlé`);
    if (plantages.length) soucis.push(`PLANTAGE — ${plantages[0]}`);
    if (debordement > 2) soucis.push(`DÉBORDE de ${debordement} px vers la droite`);
    for (const c of chevauchements) {
      soucis.push(`SE CHEVAUCHENT (${c.surface} px²) — « ${c.a} » et « ${c.b} »`);
    }

    if (soucis.length) {
      defauts += soucis.length;
      console.log(`\n✗ ${titre} — ${taille} (${largeur} px) — ${passe.nom}`);
      for (const s of soucis) console.log(`    ${s}`);
    }

    await page.close();
  }
}

await navigateur.close();
serveur.close();

console.log(
  defauts === 0
    ? `\nAucun défaut mécanique sur ${controles} contrôles ` +
        `(${ECRANS.length} publics + ${ECRANS_CLIENT.length} client + ${ECRANS_ADMIN.length} administration, ` +
        `× ${TAILLES.length} largeurs).`
    : `\n${defauts} défaut(s) à regarder, sur ${controles} contrôles.`,
);
process.exit(defauts === 0 ? 0 : 1);
