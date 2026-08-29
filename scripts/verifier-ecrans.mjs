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

const serveur = await servir();
const navigateur = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

let defauts = 0;

for (const { nom: taille, largeur, hauteur } of TAILLES) {
  for (const [chemin, titre] of ECRANS) {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur } });
    const plantages = [];
    page.on('pageerror', (e) => plantages.push(String(e).slice(0, 120)));

    await page.goto(`http://localhost:${PORT}${chemin}`, { waitUntil: 'domcontentloaded' });
    // Le temps que les écrans différés arrivent et que la mise en page se pose.
    await page.waitForTimeout(2200);

    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    const chevauchements = await page.evaluate(CHERCHER_CHEVAUCHEMENTS);

    const soucis = [];
    if (plantages.length) soucis.push(`PLANTAGE — ${plantages[0]}`);
    if (debordement > 2) soucis.push(`DÉBORDE de ${debordement} px vers la droite`);
    for (const c of chevauchements) {
      soucis.push(`SE CHEVAUCHENT (${c.surface} px²) — « ${c.a} » et « ${c.b} »`);
    }

    if (soucis.length) {
      defauts += soucis.length;
      console.log(`\n✗ ${titre} — ${taille} (${largeur} px)`);
      for (const s of soucis) console.log(`    ${s}`);
    }

    await page.close();
  }
}

await navigateur.close();
serveur.close();

console.log(
  defauts === 0
    ? `\nAucun défaut mécanique sur ${ECRANS.length} écrans × ${TAILLES.length} largeurs.`
    : `\n${defauts} défaut(s) à regarder.`,
);
process.exit(defauts === 0 ? 0 : 1);
