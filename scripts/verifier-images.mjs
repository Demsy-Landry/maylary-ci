/**
 * Aucune image du catalogue ne doit être bloquée par notre propre en-tête de
 * sécurité.
 *
 * CE QUI L'A RENDU NÉCESSAIRE
 *
 * Le fondateur a signalé des articles dont les images ne s'affichaient pas.
 * Vérifié plutôt que supposé : les 503 articles en vitrine ont tous une adresse
 * de photo, et vingt et une adresses tirées au hasard répondent toutes 200
 * depuis le serveur. Les images existaient donc bel et bien.
 *
 * Le blocage venait de NOUS. La règle `img-src` de notre `Content-Security-
 * Policy` autorisait `*.cjdropshipping.com` mais pas
 * `cj-product-center.oss-accelerate.aliyuncs.com`, où le fournisseur héberge
 * une partie de ses visuels : 80 photos sur 9 articles, plus 181 photos de
 * déclinaisons — donc les pastilles de couleur du sélecteur de taille.
 *
 * POURQUOI ÇA MÉRITE UN CONTRÔLE AUTOMATIQUE
 *
 * Une image refusée par la politique de sécurité ne fait AUCUN bruit. Pas
 * d'erreur réseau, pas de 404, rien dans les journaux du serveur : le
 * navigateur refuse simplement de la charger, et le visiteur voit un cadre
 * vide. C'est la pire forme de panne — celle qu'on ne découvre qu'en regardant
 * l'écran, article par article.
 *
 * Et elle reviendra : le fournisseur change de dépôt d'images sans prévenir. Ce
 * contrôle transforme une panne invisible en construction qui s'arrête, avec la
 * ligne exacte à ajouter.
 *
 * CE QU'IL NE FAIT PAS
 *
 * Il ne vérifie pas que l'image existe — c'est le rôle du fournisseur, et une
 * adresse morte se voit, elle. Il ne vérifie que ce qui dépend de nous : la
 * liste des hébergeurs que nous autorisons.
 *
 * Sans identifiants de base, il n'échoue pas : il le dit et laisse passer. Une
 * construction ne doit pas casser parce qu'une variable d'environnement manque
 * sur le poste de quelqu'un.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL_SB = process.env.VITE_SUPABASE_URL ?? '';
const CLE_SB = process.env.VITE_SUPABASE_ANON_KEY ?? '';

/** Les hébergeurs autorisés, lus dans `vercel.json` plutôt que recopiés ici. */
function hebergeursAutorises() {
  const config = JSON.parse(readFileSync(join(RACINE, 'vercel.json'), 'utf8'));
  const csp = config.headers
    ?.flatMap((h) => h.headers ?? [])
    .find((e) => e.key === 'Content-Security-Policy')?.value;
  if (!csp) return null;

  const regle = csp
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('img-src'));
  if (!regle) return null;

  return regle
    .replace('img-src', '')
    .trim()
    .split(/\s+/)
    .filter((s) => s.startsWith('https://'))
    .map((s) => s.replace('https://', ''));
}

/**
 * Un hébergeur est couvert s'il figure tel quel, ou s'il tombe sous un motif
 * en `*.` — la seule forme de joker que la politique de sécurité accepte.
 */
function estCouvert(hote, autorises) {
  return autorises.some((a) =>
    a.startsWith('*.') ? hote.endsWith(a.slice(1)) : a === hote,
  );
}

const hoteDe = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

async function lire(chemin) {
  const r = await fetch(`${URL_SB}/rest/v1/${chemin}`, {
    headers: { apikey: CLE_SB, Authorization: `Bearer ${CLE_SB}` },
  });
  if (!r.ok) throw new Error(`${r.status} sur ${chemin}`);
  return await r.json();
}

const autorises = hebergeursAutorises();
if (!autorises) {
  console.error("✗ Impossible de lire la règle img-src dans vercel.json.");
  process.exit(1);
}

if (!URL_SB || !CLE_SB) {
  console.log(
    'Contrôle des images ignoré : identifiants de base absents. ' +
      `Hébergeurs autorisés : ${autorises.join(', ')}.`,
  );
  process.exit(0);
}

try {
  const [produits, declinaisons] = await Promise.all([
    lire('app_e08c374bc4_produits_public?select=nom,photos&limit=2000'),
    lire('app_e08c374bc4_declinaisons_public?select=photo_url&limit=5000'),
  ]);

  /** Chaque hébergeur rencontré, avec un exemple d'article pour le retrouver. */
  const rencontres = new Map();
  const noter = (url, exemple) => {
    const hote = hoteDe(url);
    if (!hote) return;
    if (!rencontres.has(hote)) rencontres.set(hote, { n: 0, exemple });
    rencontres.get(hote).n += 1;
  };

  for (const p of produits) for (const u of p.photos ?? []) noter(u, p.nom);
  for (const d of declinaisons) noter(d.photo_url, 'déclinaison');

  const bloques = [...rencontres.entries()].filter(([hote]) => !estCouvert(hote, autorises));

  if (bloques.length === 0) {
    console.log(
      `Images : ${rencontres.size} hébergeur(s) rencontré(s), tous autorisés par la politique de sécurité.`,
    );
    process.exit(0);
  }

  console.error('\n✗ Des images seront BLOQUÉES par notre propre politique de sécurité.\n');
  for (const [hote, { n, exemple }] of bloques) {
    console.error(`  ${hote} — ${n} image(s), par exemple « ${exemple} »`);
  }
  console.error(
    '\nÀ corriger dans vercel.json, règle img-src, en ajoutant :\n' +
      bloques.map(([h]) => `  https://${h}`).join('\n') +
      '\n\nUne image refusée par la politique ne produit aucune erreur visible :\n' +
      "le visiteur voit un cadre vide et personne n'en est averti.\n",
  );
  process.exit(1);
} catch (erreur) {
  // La base injoignable n'est pas une raison de bloquer une construction : le
  // contrôle est une protection, pas un péage.
  console.log(`Contrôle des images ignoré : ${erreur.message}`);
  process.exit(0);
}
