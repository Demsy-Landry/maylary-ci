/**
 * Contrôle de `vercel.json` avant le départ.
 *
 * CE QUI L'A RENDU NÉCESSAIRE
 *
 * J'avais glissé une clé `"//"` dans une réécriture pour y écrire un
 * commentaire — l'habitude vient d'ailleurs, `package.json` le tolère. Pas
 * celui-ci : l'hébergeur valide ce fichier contre un schéma strict et REFUSE
 * toute clé qu'il ne connaît pas.
 *
 *     rewrites[0] should NOT have additional property `//`
 *
 * Le déploiement a échoué avant même de construire. Rien n'était cassé pour les
 * clients — la version précédente continuait d'être servie — mais la correction
 * n'était pas en ligne, et je ne l'ai su qu'en allant lire l'état du
 * déploiement.
 *
 * Ce contrôle-ci ramène l'erreur à l'endroit où elle coûte le moins cher : la
 * construction locale, avant le commit.
 *
 * IL NE REMPLACE PAS LA VALIDATION DE L'HÉBERGEUR
 *
 * Il ne connaît que les clés que nous employons. Son but n'est pas de tout
 * couvrir, mais d'attraper la faute qui a déjà été commise : une clé inventée.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHEMIN = join(RACINE, 'vercel.json');

/** Ce que l'hébergeur accepte dans chaque objet, et rien d'autre. */
const CLES = {
  racine: ['rewrites', 'redirects', 'headers', 'cleanUrls', 'trailingSlash', 'functions', 'crons', 'regions', 'buildCommand', 'outputDirectory', 'installCommand', 'framework', 'devCommand', 'ignoreCommand', 'github', 'images', 'public'],
  rewrites: ['source', 'destination', 'has', 'missing', 'statusCode'],
  redirects: ['source', 'destination', 'permanent', 'statusCode', 'has', 'missing'],
  headers: ['source', 'headers', 'has', 'missing'],
  has: ['type', 'key', 'value'],
};

const fautes = [];

function controler(objet, permises, ou) {
  for (const cle of Object.keys(objet)) {
    if (!permises.includes(cle)) {
      fautes.push(`${ou} : clé « ${cle} » inconnue de l'hébergeur (permises : ${permises.join(', ')})`);
    }
  }
}

let config;
try {
  config = JSON.parse(readFileSync(CHEMIN, 'utf8'));
} catch (e) {
  console.error(`vercel.json : JSON illisible — ${e.message}`);
  process.exit(1);
}

controler(config, CLES.racine, 'vercel.json');

for (const section of ['rewrites', 'redirects', 'headers']) {
  for (const [i, regle] of (config[section] ?? []).entries()) {
    controler(regle, CLES[section], `${section}[${i}]`);
    for (const [j, condition] of (regle.has ?? []).entries()) {
      controler(condition, CLES.has, `${section}[${i}].has[${j}]`);
    }
    for (const [j, condition] of (regle.missing ?? []).entries()) {
      controler(condition, CLES.has, `${section}[${i}].missing[${j}]`);
    }
  }
}

// Une réécriture placée après le fourre-tout `/(.*)` ne serait jamais atteinte :
// la première règle qui correspond gagne.
const reecritures = config.rewrites ?? [];
const fourreTout = reecritures.findIndex((r) => r.source === '/(.*)' && !r.has);
if (fourreTout !== -1 && fourreTout !== reecritures.length - 1) {
  fautes.push(
    `rewrites[${fourreTout}] est le fourre-tout « /(.*) » mais n'est pas en dernier : ` +
      `les ${reecritures.length - fourreTout - 1} règle(s) qui suivent ne seront jamais atteintes.`,
  );
}

if (fautes.length) {
  console.error('vercel.json refusé :\n  - ' + fautes.join('\n  - '));
  process.exit(1);
}

console.log(`vercel.json : ${reecritures.length} réécriture(s), ${(config.headers ?? []).length} bloc(s) d'en-têtes — conforme.`);
