/**
 * Fabriquer le sitemap à partir du catalogue réel.
 *
 * CE QUI MANQUAIT, ET CE QUE ÇA COÛTAIT
 *
 * Le sitemap listait dix-huit pages : l'accueil, les services, les pages
 * légales. Rien d'autre. Or le catalogue compte cent vingt-huit fiches produit,
 * six rayons et treize secteurs — cent quarante-sept adresses qu'aucun moteur
 * ne pouvait découvrir.
 *
 * Ce sont pourtant elles qui ramènent du trafic. Personne ne cherche « MayLary
 * Group » sur Google avant de nous connaître ; on cherche « fauteuil de pédicure
 * Abidjan » ou « rallonge électrique 15 m ». Sans les fiches dans le sitemap,
 * ces recherches ne peuvent pas nous trouver.
 *
 * POURQUOI UN SCRIPT ET NON UN FICHIER ÉCRIT À LA MAIN
 *
 * Un sitemap figé ment dès le lendemain : un article importé n'y est pas, un
 * article éteint y reste. Un moteur qui suit un lien mort perd confiance dans
 * le fichier entier, et l'utilise moins.
 *
 * Ce script se lance à CHAQUE CONSTRUCTION du site. Le sitemap déployé décrit
 * donc toujours le catalogue tel qu'il est au moment du déploiement.
 *
 * IL NE LIT QUE CE QUI EST DÉJÀ PUBLIC
 *
 * Il interroge la vue `produits_public` avec la clé anonyme — la même que le
 * navigateur d'un visiteur. Aucun secret n'entre ici, et rien ne peut fuiter
 * par ce chemin : ce que le script voit, n'importe quel visiteur le voit déjà.
 *
 * ET IL NE FAIT PAS ÉCHOUER LA CONSTRUCTION
 *
 * Si la base ne répond pas, le script garde le sitemap des pages fixes et
 * prévient. Un catalogue absent du sitemap est ennuyeux ; un déploiement
 * bloqué parce qu'une requête a expiré l'est bien davantage.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..');

const SITE = process.env.VITE_SITE_URL ?? 'https://maylarygroup.ci';
const URL_SB = process.env.VITE_SUPABASE_URL ?? '';
const CLE_SB = process.env.VITE_SUPABASE_ANON_KEY ?? '';

/**
 * Les pages fixes, avec leur importance relative.
 *
 * `priority` n'est qu'une indication de hiérarchie INTERNE : il dit à un moteur
 * quelles pages comptent le plus chez nous, pas qu'on mérite d'être premier.
 * Tout mettre à 1.0 revient à ne rien dire.
 */
const PAGES_FIXES = [
  ['/', 1.0, 'daily'],
  ['/services', 0.9, 'weekly'],
  ['/boutique', 0.9, 'daily'],
  ['/catalogue', 0.9, 'daily'],
  ['/import', 0.8, 'weekly'],
  ['/export', 0.8, 'weekly'],
  ['/declarant', 0.8, 'weekly'],
  ['/declarant/atelier', 0.7, 'weekly'],
  ['/declarant/abonnement', 0.6, 'monthly'],
  ['/poids-taxable', 0.6, 'monthly'],
  ['/boutique/sourcing', 0.7, 'weekly'],
  ['/boutique/achats-groupes', 0.7, 'daily'],
  ['/vendre', 0.7, 'monthly'],
  ['/a-propos', 0.5, 'monthly'],
  ['/conditions-generales', 0.3, 'yearly'],
  ['/mentions-legales', 0.3, 'yearly'],
  ['/confidentialite', 0.3, 'yearly'],
  ['/cookies', 0.3, 'yearly'],
];

/** `&` et `<` dans une adresse casseraient le XML. */
const echapper = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const entree = (chemin, priorite, frequence, modifie) =>
  [
    '  <url>',
    `    <loc>${echapper(SITE + chemin)}</loc>`,
    modifie ? `    <lastmod>${modifie.slice(0, 10)}</lastmod>` : null,
    `    <changefreq>${frequence}</changefreq>`,
    `    <priority>${priorite.toFixed(1)}</priority>`,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');

async function lire(chemin) {
  if (!URL_SB || !CLE_SB) return null;
  try {
    const r = await fetch(`${URL_SB}/rest/v1/${chemin}`, {
      headers: { apikey: CLE_SB, Authorization: `Bearer ${CLE_SB}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

const entrees = PAGES_FIXES.map(([c, p, f]) => entree(c, p, f, null));
let dynamiques = 0;

const produits = await lire(
  'app_e08c374bc4_produits_public?select=id,espace,updated_at&order=updated_at.desc&limit=2000',
);
if (produits) {
  for (const p of produits) {
    const base = p.espace === 'pro' ? '/catalogue/produit' : '/boutique/produit';
    // Une fiche produit change quand son prix ou son stock bouge : « weekly »
    // dit au moteur de repasser sans le faire revenir tous les jours pour rien.
    entrees.push(entree(`${base}/${p.id}`, 0.7, 'weekly', p.updated_at));
    dynamiques++;
  }
}

const categories = await lire('app_e08c374bc4_categories_gp?select=id&actif=is.true');
if (categories) {
  for (const c of categories) {
    entrees.push(entree(`/boutique/categorie/${c.id}`, 0.8, 'daily', null));
    dynamiques++;
  }
}

const secteurs = await lire('app_e08c374bc4_secteurs?select=id');
if (secteurs) {
  for (const s of secteurs) {
    entrees.push(entree(`/catalogue/secteur/${s.id}`, 0.8, 'daily', null));
    dynamiques++;
  }
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Fichier ENGENDRÉ par scripts/generer-sitemap.mjs à chaque construction.
  Ne pas le modifier à la main : la prochaine construction écraserait la retouche.
-->
<urlset xmlns="http://www.w3.org/1999/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
${entrees.join('\n')}
</urlset>
`.replace('http://www.w3.org/1999/sitemap/0.9', 'http://www.sitemaps.org/schemas/sitemap/0.9');

writeFileSync(join(RACINE, 'public', 'sitemap.xml'), xml, 'utf8');

if (dynamiques === 0 && (URL_SB || CLE_SB)) {
  console.warn(
    'sitemap : catalogue injoignable, seules les %d pages fixes sont listées.',
    PAGES_FIXES.length,
  );
} else {
  console.log(
    'sitemap : %d adresses (%d pages fixes, %d issues du catalogue).',
    entrees.length,
    PAGES_FIXES.length,
    dynamiques,
  );
}
