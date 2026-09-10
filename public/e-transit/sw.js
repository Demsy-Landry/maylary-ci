/* Ouvrier de service — Cotation E-Transit.
 *
 * Il ne garde que la coquille de l'application : la page, le style, le code.
 * Les dossiers, eux, vivent dans la base du navigateur, pas ici.
 *
 * Stratégie : le réseau d'abord, le cache en secours. L'application est donc
 * toujours à jour quand la connexion est là, et elle s'ouvre quand même
 * quand elle ne l'est pas.
 */
const VERSION = 'e-transit-2026-09-10-mtv84m1n';
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
