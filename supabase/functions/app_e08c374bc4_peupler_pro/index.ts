/**
 * Peuplement de l'espace professionnel depuis le catalogue fournisseur.
 *
 * Trois générations, trois leçons :
 *
 *  1. On prenait les références les moins chères de la recherche. « souris sans
 *     fil » traduit en *wireless mouse* a ramené de la lingerie « wireless »
 *     dans le rayon informatique. L'erreur n'était pas le prix mais le critère :
 *     le moins cher n'a jamais voulu dire le plus pertinent.
 *
 *  2. On a donc exigé que le nom contienne le terme cherché. Mieux, mais
 *     insuffisant : « apron » a fait entrer un tablier de Père Noël et un
 *     nécessaire de jardinage licorne dans le rayon uniformes professionnels.
 *     Le mot était bien là — l'article n'avait rien d'un article de métier.
 *
 *  3. D'où ce filtre-ci : un registre de mots qui, à eux seuls, disqualifient un
 *     article pour une place professionnelle. Une entreprise qui commande des
 *     tabliers pour sa brigade ne veut pas d'un tablier « funny Christmas ».
 *
 * Aucune règle de coût n'est réimplantée ici : la fonction enchaîne les deux qui
 * font déjà autorité, `cj_dropshipping_search` puis `cj_dropshipping_import`.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

const reponse = (corps: unknown, statut: number) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mots trop courants pour prouver quoi que ce soit sur la pertinence. */
const MOTS_VIDES = new Set(['de', 'du', 'la', 'le', 'les', 'a', 'and', 'for', 'the', 'with', 'pour']);

/**
 * Registre disqualifiant pour un rayon professionnel.
 *
 * Ce ne sont pas de mauvais articles : ils se vendent très bien côté Boutique.
 * Ils n'ont simplement rien à faire dans un catalogue destiné à un hôtel, une
 * clinique ou un chantier. La liste est volontairement large — un article
 * légitime écarté à tort se réimporte à la main, alors qu'un article de fête
 * publié en vitrine professionnelle abîme la crédibilité de l'enseigne.
 */
const REGISTRE_DISQUALIFIANT = [
  'christmas', 'xmas', 'santa', 'halloween', 'easter', 'valentine', 'thanksgiving',
  'birthday', 'party', 'gift', 'novelty', 'funny', 'joke', 'prank',
  'unicorn', 'cartoon', 'anime', 'kawaii', 'plush', 'toy', 'doll',
  'costume', 'cosplay', 'fancy dress', 'wedding', 'bridal',
  'sexy', 'lingerie', 'bikini', 'erotic',
  'baby', 'toddler', 'kids', 'children',
  'keychain', 'sticker', 'ornament', 'decor pendant',
];

interface Recherche {
  /** Le mot-clé envoyé au fournisseur. */
  mot_cle: string;
  /** Termes anglais dont au moins un doit figurer au nom. */
  exiger: string[];
  /** Termes qui, en plus du registre commun, disqualifient l'article ici. */
  exclure?: string[];
}

interface CorpsRequete {
  secteur_id?: string;
  recherches?: Recherche[];
  par_recherche?: number;
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return reponse({ error: 'Méthode non autorisée.' }, 405);

  const entete = req.headers.get('Authorization');
  if (!entete) return reponse({ error: 'Authentification requise.' }, 401);

  let corps: CorpsRequete;
  try {
    corps = await req.json();
  } catch {
    return reponse({ error: 'Corps de requête JSON invalide.' }, 400);
  }
  if (!corps.secteur_id || !corps.recherches?.length) {
    return reponse({ error: 'Secteur et recherches requis.' }, 400);
  }

  const base = `${Deno.env.get('SUPABASE_URL')}/functions/v1`;
  const enTete = { 'Content-Type': 'application/json', Authorization: entete };
  const parRecherche = Math.min(4, Math.max(1, Math.round(corps.par_recherche ?? 2)));

  const importes: Record<string, unknown>[] = [];
  const ecartes: Record<string, unknown>[] = [];

  try {
    for (const { mot_cle, exiger, exclure } of corps.recherches.slice(0, 3)) {
      const rechercheRes = await fetch(`${base}/app_e08c374bc4_cj_dropshipping_search`, {
        method: 'POST',
        headers: enTete,
        body: JSON.stringify({ keyword: mot_cle }),
      });
      const recherche = await rechercheRes.json().catch(() => null);
      if (!rechercheRes.ok || !Array.isArray(recherche?.produits)) {
        ecartes.push({ mot_cle, motif: recherche?.error ?? 'recherche impossible' });
        await pause(1200);
        continue;
      }

      const termes = (exiger ?? [])
        .map((t) => t.toLowerCase().trim())
        .filter((t) => t.length > 2 && !MOTS_VIDES.has(t));

      const interdits = [
        ...REGISTRE_DISQUALIFIANT,
        ...(exclure ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean),
      ];

      let recales = 0;
      const candidats = (recherche.produits as Record<string, unknown>[])
        .filter((p) => Number(p.prix_fournisseur_usd) > 0 && p.reference_externe)
        .filter((p) => {
          const nom = String(p.nom ?? '').toLowerCase();
          if (termes.length > 0 && !termes.some((t) => nom.includes(t))) return false;
          if (interdits.some((t) => nom.includes(t))) {
            recales += 1;
            return false;
          }
          return true;
        })
        .slice(0, parRecherche);

      if (candidats.length === 0) {
        ecartes.push({
          mot_cle,
          motif: recales > 0 ? `${recales} article(s) hors registre professionnel` : 'aucun résultat pertinent',
        });
      }

      for (const p of candidats) {
        const importRes = await fetch(`${base}/app_e08c374bc4_cj_dropshipping_import`, {
          method: 'POST',
          headers: enTete,
          body: JSON.stringify({
            reference_externe: p.reference_externe,
            nom: p.nom,
            photos: p.photo ? [p.photo] : [],
            prix_fournisseur_usd: p.prix_fournisseur_usd,
            stock: p.stock,
            espace: 'pro',
            secteur_id: corps.secteur_id,
          }),
        });
        const resultat = await importRes.json().catch(() => null);

        if (importRes.ok && resultat?.success) {
          importes.push({
            nom: resultat.produit?.nom,
            prix_fcfa: resultat.produit?.prix_unitaire_fcfa,
            fret_fcfa: resultat.produit?.cout_fret_fcfa,
            achat_fcfa: resultat.produit?.prix_achat_fcfa,
            fret: resultat.produit?.fret_source,
          });
        } else {
          ecartes.push({ nom: p.nom, motif: resultat?.error ?? `HTTP ${importRes.status}` });
        }
        await pause(1300);
      }
    }

    console.log(
      JSON.stringify({ requestId, secteur: corps.secteur_id, importes: importes.length, ecartes: ecartes.length }),
    );
    return reponse({ success: true, importes, ecartes }, 200);
  } catch (erreur) {
    console.log(JSON.stringify({ requestId, erreur: String(erreur) }));
    return reponse({ error: 'Erreur interne du serveur.', importes, ecartes }, 500);
  }
});
