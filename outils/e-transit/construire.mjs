/* Assemblage de l'application en un seul fichier.
 *
 * Les sources vivent dans source/ pour rester lisibles et modifiables. Le
 * livrable, lui, est un fichier unique : on le copie sur le bureau du poste,
 * on double-clique, et rien ne peut être laissé derrière.
 *
 *   node outils/e-transit/construire.mjs
 *   → outils/cotation-e-transit.html
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, '..', '..');
const source = join(ici, 'source');

// Une balise fermante glissée dans une chaîne de caractères refermerait le
// bloc <script> et casserait la page : on la neutralise.
const proteger = (code) => code.replace(/<\/(script|style)/gi, '<\\/$1');

const lire = (chemin) => readFileSync(chemin, 'utf8');

const morceaux = {
  'style.css': lire(join(source, 'style.css')),
  'reference.js': lire(join(source, 'reference.js')),
  'liquidation.js': lire(join(source, 'liquidation.js')),
  'base.js': lire(join(source, 'base.js')),
  'jspdf': lire(join(racine, 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js')),
  'pdf.js': lire(join(source, 'pdf.js')),
  'interface.js': lire(join(source, 'interface.js')),
};

let page = lire(join(source, 'index.html'));

const attendus = ['style.css', 'reference.js', 'liquidation.js', 'base.js', 'jspdf', 'pdf.js', 'interface.js'];
for (const nom of attendus) {
  const marqueur = nom.endsWith('.css') ? `/*@css ${nom}*/` : `/*@js ${nom}*/`;
  if (!page.includes(marqueur)) throw new Error(`Marqueur absent du gabarit : ${marqueur}`);
  page = page.replace(marqueur, () => proteger(morceaux[nom]));
}

const banniere = `<!--
  Cotation E-Transit — droits, taxes et devis.
  Application autonome : un seul fichier, aucune installation, aucun compte.
  Ouvrir avec Microsoft Edge ou Google Chrome.

  Les données saisies restent dans la base locale du navigateur de ce poste.
  Sauvegarde régulière depuis Réglages → Sauvegarder tout.

  Construit le ${new Date().toISOString().slice(0, 10)}.
  By Dems'Inc — Demsy Landry.

  Contient jsPDF (MIT, https://github.com/parallax/jsPDF) pour l'édition des PDF.
-->
`;

page = page.replace('<!doctype html>', `<!doctype html>\n${banniere}`);

const sortie = join(racine, 'outils', 'cotation-e-transit.html');
writeFileSync(sortie, page, 'utf8');

const ko = (n) => `${(n / 1024).toFixed(0)} Ko`;
console.log(`écrit  ${sortie}`);
console.log(`taille ${ko(statSync(sortie).size)}`);
for (const nom of attendus) console.log(`  ${nom.padEnd(16)} ${ko(morceaux[nom].length)}`);
