/**
 * Fabrique le PDF du dossier de référence à partir de `docs/dossier-reference.html`.
 *
 * POURQUOI UN NAVIGATEUR PLUTÔT QU'UNE BIBLIOTHÈQUE PDF
 *
 * Les bibliothèques qui écrivent du PDF ligne à ligne obligent à placer chaque
 * bloc à la main. Un document de cinquante pages avec des tableaux, des images
 * et des sauts de page devient alors ingérable : une phrase ajoutée au
 * chapitre 3 décale tout le reste.
 *
 * Le navigateur, lui, sait déjà faire la mise en page. On écrit le document en
 * HTML et en CSS, il s'occupe des coupures, des veuves, des tableaux qui ne
 * doivent pas se scinder. C'est aussi ce qui permet de relire le document à
 * l'écran avant de le figer.
 *
 * Le chemin est ouvert en `file://` pour que les visuels de `public/` soient
 * chargés depuis le disque, sans serveur.
 */

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Les documents fabriqués par ce script : source HTML → PDF livré. */
const DOCUMENTS = {
  dossier: ['docs/dossier-reference.html', 'docs/MayLaryGroup-Dossier-de-reference.pdf',
    'MayLary Group — Dossier de référence'],
  rapport: ['docs/rapport-construction.html', 'docs/MayLaryGroup-Rapport-de-construction.pdf',
    'MayLary Group — Rapport de construction'],
};

const demande = process.argv[2] ?? 'dossier';
if (!DOCUMENTS[demande]) {
  console.error(`Document inconnu : « ${demande} ». Choix : ${Object.keys(DOCUMENTS).join(', ')}`);
  process.exit(1);
}
const [cheminSource, cheminSortie, TITRE] = DOCUMENTS[demande];
const SOURCE = resolve(RACINE, cheminSource);
const SORTIE = resolve(RACINE, cheminSortie);

const navigateur = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await navigateur.newPage();

// Les erreurs de chargement d'image sont silencieuses dans un PDF : une image
// absente laisse un cadre vide qu'on ne remarque qu'à l'impression. On les
// remonte ici.
const manquants = [];
page.on('requestfailed', (r) => manquants.push(r.url()));

await page.goto(pathToFileURL(SOURCE).href, { waitUntil: 'networkidle' });

await page.pdf({
  path: SORTIE,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `
    <div style="width:100%;font-family:Liberation Sans,Arial,sans-serif;font-size:7pt;
                color:#8a939d;padding:0 16mm;display:flex;justify-content:space-between;">
      <span>${TITRE}</span>
      <span class="pageNumber"></span>
    </div>`,
  margin: { top: '17mm', right: '16mm', bottom: '14mm', left: '16mm' },
});

await navigateur.close();

if (manquants.length) {
  console.error('Ressources non chargées :\n  - ' + manquants.join('\n  - '));
  process.exit(1);
}

const { size } = statSync(SORTIE);
console.log(`PDF écrit : ${SORTIE} (${(size / 1024).toFixed(0)} Ko)`);
