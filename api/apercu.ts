import { ALIAS, PAGES, metaDeLaPage, normaliser, type MetaPage } from '../src/lib/referencement-pages';

/**
 * L'aperçu d'un lien collé dans WhatsApp, Facebook, LinkedIn ou Telegram.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE DÉFAUT QU'IL CORRIGE
 *
 * La moitié du trafic arrive par un lien partagé dans une conversation. Ces
 * liens ne montraient rien d'utile : quelle que soit la page envoyée — une
 * montre, un rayon, la page d'import — l'aperçu affichait le titre de la maison
 * et la vignette générique.
 *
 * La cause n'est pas un oubli de balises : `useReferencement` les pose
 * correctement pour Google. Mais les robots d'aperçu, EUX, N'EXÉCUTENT PAS LE
 * JAVASCRIPT. Ils demandent la page, lisent le `<head>` du fichier brut, et
 * repartent. Or ce fichier brut est le même pour les cent soixante-huit
 * adresses du site : c'est l'accueil qu'ils lisaient, à chaque fois.
 *
 * Aucune correction côté navigateur ne peut y changer quoi que ce soit. Il faut
 * que le SERVEUR réponde autre chose. C'est ce que fait cette fonction.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELLE NE VOIT QUE LES ROBOTS, ET C'EST VOULU
 *
 * `vercel.json` ne l'appelle QUE si l'en-tête `User-Agent` désigne un robot
 * d'aperçu connu. Un visiteur humain ne passe jamais par ici : son chemin est
 * exactement celui d'avant, sans une milliseconde de plus.
 *
 * GOOGLE EN EST DÉLIBÉRÉMENT EXCLU. Il exécute le JavaScript et lit donc déjà
 * les bonnes balises. Lui servir une page différente de celle du visiteur
 * s'appelle du « cloaking », et c'est sanctionné. La règle est simple : on ne
 * répond ici qu'aux robots incapables de faire autrement.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELLE FABRIQUE SA PAGE PLUTÔT QUE DE RETOUCHER LA VRAIE
 *
 * Un robot d'aperçu ne lit que le `<head>`. Reprendre `index.html` pour y
 * remplacer des balises obligerait à le récupérer à chaque appel, et à dépendre
 * du nom des fichiers produits par la construction — qui change à chaque
 * déploiement. On écrit donc un document complet, court, qui contient
 * exactement ce que le robot vient chercher.
 *
 * Le corps porte tout de même le titre, le texte et un lien : si un robot
 * inconnu — ou un humain, par accident — atterrissait ici, il ne trouverait pas
 * une page vide.
 */

export const config = { runtime: 'edge' };

const SITE = 'https://maylarygroup.ci';
const MARQUE = 'MayLary Group';
const IMAGE_MAISON = `${SITE}/og-image.png`;

const URL_SB = process.env.VITE_SUPABASE_URL ?? '';
const CLE_SB = process.env.VITE_SUPABASE_ANON_KEY ?? '';

const PRODUITS = 'app_e08c374bc4_produits_public';
const CATEGORIES = 'app_e08c374bc4_categories_gp';
const SECTEURS = 'app_e08c374bc4_secteurs';

interface Apercu extends MetaPage {
  image?: string | null;
  type?: 'website' | 'product';
}

/** `&`, `<` et `"` dans un titre casseraient le document. */
function echapper(texte: string): string {
  return String(texte)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resumer(texte: string, limite = 200): string {
  const propre = texte.replace(/\s+/g, ' ').trim();
  if (propre.length <= limite) return propre;
  const coupe = propre.slice(0, limite);
  const espace = coupe.lastIndexOf(' ');
  return `${coupe.slice(0, espace > 80 ? espace : limite)}…`;
}

/**
 * Une lecture publique, avec la clé anonyme — la même que le navigateur d'un
 * visiteur. Rien de secret ne transite ici.
 *
 * Le délai est court et l'échec est silencieux : un aperçu générique vaut mieux
 * qu'un robot qui attend, abandonne, et n'affiche aucun aperçu du tout.
 */
async function lire(requete: string): Promise<Record<string, unknown> | null> {
  if (!URL_SB || !CLE_SB) return null;
  try {
    const r = await fetch(`${URL_SB}/rest/v1/${requete}`, {
      headers: { apikey: CLE_SB, Authorization: `Bearer ${CLE_SB}` },
      signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) return null;
    const lignes = await r.json();
    return Array.isArray(lignes) ? (lignes[0] ?? null) : null;
  } catch {
    return null;
  }
}

/** Ce que l'adresse demandée doit montrer en aperçu. */
async function apercuPour(chemin: string): Promise<Apercu> {
  const propre = normaliser(chemin);

  // 1. Une page fixe : la réponse est dans la table, sans aller en base.
  const fixe = metaDeLaPage(propre);
  if (fixe) return fixe;

  // 2. Une fiche produit.
  const produit = propre.match(/^\/(boutique|catalogue)\/produit\/([0-9a-f-]{36})$/i);
  if (produit) {
    const p = await lire(
      `${PRODUITS}?id=eq.${produit[2]}&select=nom,description,description_fournisseur,photos&limit=1`,
    );
    if (p?.nom) {
      const photos = Array.isArray(p.photos) ? (p.photos as string[]) : [];
      const texte =
        (typeof p.description === 'string' && p.description.trim()) ||
        (typeof p.description_fournisseur === 'string' && p.description_fournisseur.trim()) ||
        `Disponible chez ${MARQUE}, livré en Côte d'Ivoire.`;
      return {
        titre: String(p.nom),
        description: resumer(texte),
        image: photos[0] ?? null,
        type: 'product',
      };
    }
    // Référence inconnue : on retombe sur le rayon dont elle relève, ce qui
    // reste vrai, plutôt que d'annoncer un article qui n'existe pas.
    return PAGES[produit[1] === 'pro' ? '/catalogue' : `/${produit[1]}`] ?? PAGES['/'];
  }

  // 3. Un rayon de la boutique.
  const categorie = propre.match(/^\/boutique\/categorie\/([0-9a-f-]{36})$/i);
  if (categorie) {
    const c = await lire(`${CATEGORIES}?id=eq.${categorie[1]}&select=nom,description&limit=1`);
    if (c?.nom) {
      return {
        titre: `${c.nom} — Boutique`,
        description:
          (typeof c.description === 'string' && c.description.trim()) ||
          `Le rayon ${c.nom} de la boutique ${MARQUE}, livré en Côte d'Ivoire.`,
      };
    }
    return PAGES['/boutique'];
  }

  // 4. Un secteur de l'espace professionnel.
  const secteur = propre.match(/^\/catalogue\/secteur\/([0-9a-f-]{36})$/i);
  if (secteur) {
    const s = await lire(`${SECTEURS}?id=eq.${secteur[1]}&select=nom,description&limit=1`);
    if (s?.nom) {
      return {
        titre: `${s.nom} — Achat en gros`,
        description:
          (typeof s.description === 'string' && s.description.trim()) ||
          `Le secteur ${s.nom} de l'espace professionnel ${MARQUE}.`,
      };
    }
    return PAGES['/catalogue'];
  }

  // 5. Adresse inconnue : la maison, jamais une erreur. Un robot d'aperçu qui
  //    reçoit un 404 n'affiche rien du tout, et le lien paraît cassé.
  return PAGES['/'];
}

function document(apercu: Apercu, adresse: string): string {
  const titre = apercu.titre.includes(MARQUE) ? apercu.titre : `${apercu.titre} — ${MARQUE}`;
  const image = apercu.image || IMAGE_MAISON;
  const t = echapper(titre);
  const d = echapper(apercu.description);
  const i = echapper(image);
  const a = echapper(adresse);

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${a}" />
${apercu.horsIndex ? '<meta name="robots" content="noindex, nofollow" />\n' : ''}<meta property="og:site_name" content="${MARQUE}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:type" content="${apercu.type === 'product' ? 'product' : 'website'}" />
<meta property="og:locale" content="fr_CI" />
<meta property="og:url" content="${a}" />
<meta property="og:image" content="${i}" />
<meta property="og:image:alt" content="${t}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${i}" />
</head>
<body style="font-family:system-ui,sans-serif;max-width:34rem;margin:4rem auto;padding:0 1.5rem;line-height:1.6">
<h1 style="font-size:1.3rem">${t}</h1>
<p>${d}</p>
<p><a href="${a}">Ouvrir la page sur maylarygroup.ci</a></p>
</body>
</html>
`;
}

export default async function handler(requete: Request): Promise<Response> {
  // Le chemin d'origine, transmis par la réécriture de `vercel.json` : la
  // fonction, elle, est appelée sur `/api/apercu` et ne le connaîtrait pas.
  const chemin = new URL(requete.url).searchParams.get('chemin') ?? '/';
  const propre = normaliser(chemin.startsWith('/') ? chemin : `/${chemin}`);
  // Comme dans le crochet : une adresse jumelle annonce son adresse
  // principale, pour que les partages d'une même page se cumulent au lieu
  // de se répartir entre deux adresses.
  const principal = ALIAS[propre] ?? propre;
  const adresse = principal === '/' ? `${SITE}/` : SITE + principal;

  let apercu: Apercu;
  try {
    apercu = await apercuPour(propre);
  } catch {
    // Un aperçu ne doit jamais échouer : un robot sans réponse affiche un lien
    // nu, ce qui est pire que l'aperçu générique de la maison.
    apercu = PAGES['/'];
  }

  return new Response(document(apercu, adresse), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Les robots d'aperçu repassent souvent sur le même lien. Dix minutes
      // suffisent à absorber une conversation active sans figer un prix ou un
      // titre corrigé entre-temps.
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    },
  });
}
