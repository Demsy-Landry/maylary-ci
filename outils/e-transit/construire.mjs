/* Assemblage de l'application, en deux livrables depuis les mêmes sources.
 *
 *   outils/cotation-e-transit.html
 *     Un fichier unique, tout dedans. On le copie sur le bureau d'un poste,
 *     on double-clique, rien ne peut être laissé derrière. C'est la version
 *     pour un ordinateur sans connexion.
 *
 *   public/e-transit/
 *     La version en ligne : index.html, style.css, app.js, jspdf.js, plus le
 *     manifeste et l'ouvrier de service qui la rendent installable et
 *     utilisable hors connexion sur un téléphone.
 *
 *     Elle est en fichiers séparés pour une raison précise : le site applique
 *     « script-src 'self' », qui interdit le script écrit dans la page. Un
 *     fichier unique ne s'exécuterait pas. Plutôt que d'affaiblir la politique
 *     de sécurité du site pour un dossier, on livre ce qu'elle attend.
 *
 *   node outils/e-transit/construire.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, '..', '..');
const source = join(ici, 'source');
const enLigne = join(racine, 'public', 'e-transit');

const lire = (chemin) => readFileSync(chemin, 'utf8');

// Une balise fermante glissée dans une chaîne refermerait le bloc et casserait
// la page : on la neutralise.
const proteger = (code) => code.replace(/<\/(script|style)/gi, '<\\/$1');

const CODE = ['reference.js', 'liquidation.js', 'base.js', 'pdf.js', 'interface.js'];

const morceaux = {
  'style.css': lire(join(source, 'style.css')),
  jspdf: lire(join(racine, 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js')),
};
for (const nom of CODE) morceaux[nom] = lire(join(source, nom));

const gabarit = lire(join(source, 'index.html'));
const jour = new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------- version hors ligne */

function versionUnique() {
  let page = gabarit;
  const substituer = (marqueur, contenu) => {
    if (!page.includes(marqueur)) throw new Error(`Marqueur absent du gabarit : ${marqueur}`);
    page = page.replace(marqueur, () => proteger(contenu));
  };
  substituer('/*@css style.css*/', morceaux['style.css']);
  substituer('/*@js jspdf*/', morceaux.jspdf);
  for (const nom of CODE) substituer(`/*@js ${nom}*/`, morceaux[nom]);

  const banniere = `<!--
  Cotation E-Transit — droits, taxes et devis.
  Version hors ligne : un seul fichier, aucune installation, aucun compte.
  Ouvrir avec Microsoft Edge ou Google Chrome, sur un ordinateur.

  Pour le téléphone, c'est la version en ligne qu'il faut : une page web
  s'ajoute à l'écran d'accueil, un fichier posé sur l'appareil ne le peut pas.

  Les données saisies restent dans la base locale du navigateur de ce poste.
  Sauvegarde régulière depuis Réglages → Sauvegarder tout.

  Construit le ${jour}. By Dems'Inc — Demsy Landry.
  Contient jsPDF (MIT, https://github.com/parallax/jsPDF).
-->
`;
  page = page.replace('<!doctype html>', `<!doctype html>\n${banniere}`);
  const sortie = join(racine, 'outils', 'cotation-e-transit.html');
  writeFileSync(sortie, page, 'utf8');
  return sortie;
}

/* ---------------------------------------------------------- version en ligne */

function versionEnLigne() {
  mkdirSync(enLigne, { recursive: true });

  // Le code applicatif part dans un seul fichier, dans l'ordre de dépendance.
  const app = CODE.map((nom) => `/* ===== ${nom} ===== */\n${morceaux[nom]}`).join('\n\n');
  writeFileSync(join(enLigne, 'app.js'), app, 'utf8');
  writeFileSync(join(enLigne, 'jspdf.js'), morceaux.jspdf, 'utf8');
  writeFileSync(join(enLigne, 'style.css'), morceaux['style.css'], 'utf8');

  let page = gabarit;
  page = page.replace(
    /<style>\/\*@css style\.css\*\/<\/style>/,
    '<link rel="stylesheet" href="style.css">'
  );
  page = page.replace(/<script>\/\*@js jspdf\*\/<\/script>/, '<script src="jspdf.js"></script>');
  page = page.replace(/<script>\/\*@js reference\.js\*\/<\/script>/, '<script src="app.js"></script>');
  for (const nom of CODE.slice(1)) {
    page = page.replace(new RegExp(`<script>/\\*@js ${nom.replace('.', '\\.')}\\*/</script>\\n?`), '');
  }

  // Ce qu'il faut pour qu'un téléphone la traite comme une application, et
  // pour qu'aucun moteur de recherche ne la référence.
  const entetes = `<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0d2340">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="E-Transit">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icone-192.png">
<link rel="apple-touch-icon" href="icone-180.png">
`;
  page = page.replace('<link rel="stylesheet" href="style.css">', entetes + '<link rel="stylesheet" href="style.css">');

  const banniere = `<!--
  Cotation E-Transit — version en ligne.
  Ouvrir l'adresse au navigateur, puis « Ajouter à l'écran d'accueil » sur
  téléphone. Les dossiers restent sur l'appareil : un téléphone et un
  ordinateur gardent chacun les leurs.
  Construit le ${jour}. By Dems'Inc — Demsy Landry.
-->
`;
  page = page.replace('<!doctype html>', `<!doctype html>\n${banniere}`);
  writeFileSync(join(enLigne, 'index.html'), page, 'utf8');

  const manifeste = {
    name: 'Cotation E-Transit',
    short_name: 'E-Transit',
    description: 'Droits et taxes de douane, et devis clients.',
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f2f5f9',
    theme_color: '#0d2340',
    lang: 'fr',
    dir: 'ltr',
    icons: [
      { src: 'icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icone-512-pleine.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  writeFileSync(join(enLigne, 'manifest.webmanifest'), JSON.stringify(manifeste, null, 2), 'utf8');

  // L'ouvrier de service : il met la coquille de côté au premier passage, et
  // la ressert ensuite même sans réseau. La version change à chaque
  // construction, ce qui suffit à déclencher la mise à jour.
  const ouvrier = `/* Ouvrier de service — Cotation E-Transit.
 *
 * Il ne garde que la coquille de l'application : la page, le style, le code.
 * Les dossiers, eux, vivent dans la base du navigateur, pas ici.
 *
 * Stratégie : le réseau d'abord, le cache en secours. L'application est donc
 * toujours à jour quand la connexion est là, et elle s'ouvre quand même
 * quand elle ne l'est pas.
 */
const VERSION = 'e-transit-${jour}-${Date.now().toString(36)}';
const COQUILLE = ['./', './index.html', './style.css', './app.js', './jspdf.js',
  './manifest.webmanifest', './icone-192.png', './icone-512.png', './icone-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const requete = e.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(new URL('./', self.location).pathname)) return;

  e.respondWith(
    fetch(requete)
      .then((reponse) => {
        if (reponse && reponse.ok) {
          const copie = reponse.clone();
          caches.open(VERSION).then((c) => c.put(requete, copie));
        }
        return reponse;
      })
      .catch(() => caches.match(requete).then((r) => r || caches.match('./index.html')))
  );
});
`;
  writeFileSync(join(enLigne, 'sw.js'), ouvrier, 'utf8');
  return enLigne;
}

const ko = (n) => `${(n / 1024).toFixed(0)} Ko`;

const fichierUnique = versionUnique();
const dossierEnLigne = versionEnLigne();

console.log(`hors ligne  ${fichierUnique}  (${ko(statSync(fichierUnique).size)})`);
console.log(`en ligne    ${dossierEnLigne}/`);
for (const nom of ['index.html', 'style.css', 'app.js', 'jspdf.js', 'manifest.webmanifest', 'sw.js']) {
  console.log(`  ${nom.padEnd(20)} ${ko(statSync(join(dossierEnLigne, nom)).size)}`);
}
