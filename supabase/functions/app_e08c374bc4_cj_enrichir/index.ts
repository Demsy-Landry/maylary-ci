/**
 * Enrichir le catalogue à partir de la fiche complète de CJ.
 *
 * CE QUI ÉTAIT PERDU À CHAQUE IMPORT
 *
 * L'import ne gardait que le nom, le prix et LA PREMIÈRE image. Or la même
 * réponse contient jusqu'à douze photos, une vidéo, le poids net et emballé, le
 * volume, la matière, le type d'emballage et la description. Tout cela était
 * reçu puis jeté.
 *
 * CE QU'ON NE REPREND PAS : LA POSITION TARIFAIRE
 *
 * CJ rend aussi le code SH sous lequel la marchandise sort de Chine. Je l'avais
 * gardé, en me disant qu'une hypothèse valait mieux qu'une page blanche. Le
 * fondateur a tranché autrement, et il a raison : ce code est saisi par un
 * fournisseur chinois, pour SON export, sous SA réglementation. Il n'engage
 * rien envers la douane ivoirienne.
 *
 * Posé à côté du moteur de liquidation, il ne serait pas resté une suggestion :
 * il aurait fini recopié. Une position fausse, c'est un taux de droit faux et
 * la signature d'un commissionnaire engagée sur une erreur. Mieux vaut une case
 * vide, qui oblige à classer.
 *
 * Relevé avant : 58 articles pro, 58 avec exactement une photo, 2 avec un
 * poids, 0 avec une description.
 *
 * POURQUOI PAR LOTS, ET POURQUOI DES PAUSES
 *
 * CJ limite le rythme des appels sèchement — mesuré ailleurs dans cette base :
 * douze requêtes espacées d'une seconde et demie, onze refusées. On avance donc
 * par petits lots avec une pause franche, et la fonction se rappelle jusqu'à
 * épuisement. `enrichi_le` sert de marque-page : un article déjà traité n'est
 * pas repris, ce qui rend l'opération reprenable après n'importe quel incident.
 *
 * CE QUE LA FONCTION N'ÉCRIT PAS
 *
 * Elle ne touche NI au prix, NI à la marge, NI au fret. Ces trois-là ont leur
 * propre moteur, vérifié, et un enrichissement de fiche n'a aucune raison de
 * les déplacer. Elle ne remplit que ce qui décrit la marchandise.
 *
 * Et elle n'écrase jamais une photo par une liste vide : si CJ ne rend rien,
 * l'article garde ce qu'il avait.
 */

const CJ = 'https://developers.cjdropshipping.com/api2.0/v1';
const URL_SB = Deno.env.get('SUPABASE_URL')!;
const CLE_SB = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (c: unknown, s = 200) =>
  new Response(JSON.stringify(c), { status: s, headers: { 'Content-Type': 'application/json' } });

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const enTetesSb = {
  apikey: CLE_SB,
  Authorization: `Bearer ${CLE_SB}`,
  'Content-Type': 'application/json',
};

async function jetonEnCache(): Promise<string | null> {
  const r = await fetch(
    `${URL_SB}/rest/v1/app_e08c374bc4_cj_jeton?select=access_token,expire_le&limit=1`,
    { headers: enTetesSb },
  );
  const l = await r.json().catch(() => []);
  const t = l?.[0];
  return t?.access_token && new Date(t.expire_le) > new Date() ? t.access_token : null;
}

async function demanderJeton(): Promise<string | null> {
  const email = (Deno.env.get('CJ_DROPSHIPPING_EMAIL') ?? '').trim();
  const cle = (Deno.env.get('CJ_DROPSHIPPING_API_KEY') ?? '').replace(/\s+/g, '');
  if (!email || !cle) return null;

  const r = await fetch(`${CJ}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: cle }),
  });
  const d = await r.json().catch(() => null);
  const token = d?.data?.accessToken as string | undefined;
  if (!token) return null;

  const expire = d?.data?.accessTokenExpiryDate
    ? new Date(String(d.data.accessTokenExpiryDate))
    : new Date(Date.now() + 12 * 24 * 3600 * 1000);
  await fetch(`${URL_SB}/rest/v1/app_e08c374bc4_cj_jeton`, {
    method: 'POST',
    headers: { ...enTetesSb, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      id: 1,
      access_token: token,
      obtenu_le: new Date().toISOString(),
      expire_le: expire.toISOString(),
    }),
  });
  return token;
}

/** Une liste d'images propre : sans doublon, sans vide, l'originale en tête. */
function imagesDe(data: Record<string, unknown>): string[] {
  const brut: unknown[] = [];
  const principale = data.bigImage ?? data.productImage;

  // `productImage` est tantôt une chaîne, tantôt un tableau sérialisé en JSON.
  const ajouter = (v: unknown) => {
    if (typeof v === 'string' && v.startsWith('[')) {
      try { brut.push(...JSON.parse(v)); return; } catch { /* pas du JSON */ }
    }
    if (Array.isArray(v)) brut.push(...v);
    else if (v) brut.push(v);
  };

  ajouter(principale);
  ajouter(data.productImageSet);

  const vues = new Set<string>();
  const propres: string[] = [];
  for (const u of brut) {
    if (typeof u !== 'string') continue;
    const url = u.trim();
    if (!url.startsWith('http') || vues.has(url)) continue;
    vues.add(url);
    propres.push(url);
  }
  // Douze suffisent largement à une galerie ; au-delà on alourdit la fiche.
  return propres.slice(0, 12);
}

/** Première valeur utile d'un champ que CJ rend parfois en tableau. */
function premier(v: unknown): string | null {
  if (typeof v === 'string' && v.startsWith('[')) {
    try { const t = JSON.parse(v); return t?.[0] ? String(t[0]) : null; } catch { /* brut */ }
  }
  if (Array.isArray(v)) return v[0] ? String(v[0]) : null;
  return v ? String(v) : null;
}

const nombre = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

Deno.serve(async (req) => {
  const corps = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const espace = String(corps.espace ?? 'pro');
  const limite = Math.min(Number(corps.limite ?? 12), 20);

  const token = (await jetonEnCache()) ?? (await demanderJeton());
  if (!token) return json({ erreur: 'Authentification CJ impossible.' }, 503);

  // Les articles pas encore traités, dans l'ordre où ils ont été créés.
  const rListe = await fetch(
    `${URL_SB}/rest/v1/app_e08c374bc4_produits` +
      `?select=id,nom,reference_externe,photos` +
      `&espace=eq.${espace}&reference_externe=not.is.null&enrichi_le=is.null` +
      `&order=created_at.asc&limit=${limite}`,
    { headers: enTetesSb },
  );
  const aTraiter = (await rListe.json().catch(() => [])) as {
    id: string; nom: string; reference_externe: string; photos: string[] | null;
  }[];

  if (aTraiter.length === 0) {
    return json({ termine: true, traites: 0, message: 'Plus rien à enrichir.' });
  }

  const rapport: { nom: string; photos: number; poids_g: number | null; ok: boolean; motif?: string }[] = [];

  for (const p of aTraiter) {
    try {
      const url = new URL(`${CJ}/product/query`);
      url.searchParams.set('pid', p.reference_externe);
      const r = await fetch(url, { headers: { 'CJ-Access-Token': token } });
      const d = await r.json().catch(() => null);
      const data = (d?.data ?? null) as Record<string, unknown> | null;

      if (!data || !d?.result) {
        rapport.push({ nom: p.nom, photos: 0, poids_g: null, ok: false,
          motif: String(d?.message ?? `HTTP ${r.status}`) });
        await pause(1600);
        continue;
      }

      const images = imagesDe(data);
      const variante = (data.variants as Record<string, unknown>[] | undefined)?.[0] ?? {};

      // Le poids EMBALLÉ prime : c'est lui que paie le transporteur, et c'est
      // lui qu'un acheteur doit connaître pour prévoir sa place et son transport.
      const poids =
        nombre(data.packingWeight) ?? nombre(data.productWeight) ?? nombre(variante.variantWeight);
      const volumeMm3 = nombre(variante.variantVolume);

      const maj: Record<string, unknown> = {
        enrichi_le: new Date().toISOString(),
        matiere: premier(data.materialNameEn),
        emballage: premier(data.packingNameEn),
        video_url: data.productVideo ? String(data.productVideo) : null,
        description_fournisseur: data.description ? String(data.description).slice(0, 8000) : null,
      };
      // On n'écrase une photo existante que si CJ rend mieux.
      if (images.length > 0) maj.photos = images;
      if (poids) maj.poids_unitaire_g = poids;
      if (volumeMm3) maj.volume_unitaire_cm3 = volumeMm3 / 1000;

      await fetch(`${URL_SB}/rest/v1/app_e08c374bc4_produits?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: enTetesSb,
        body: JSON.stringify(maj),
      });

      rapport.push({ nom: p.nom, photos: images.length, poids_g: poids, ok: true });
    } catch (e) {
      rapport.push({ nom: p.nom, photos: 0, poids_g: null, ok: false, motif: String(e).slice(0, 90) });
    }

    // La pause vaut pour tous les cas : même un échec a consommé un appel.
    await pause(1600);
  }

  return json({ termine: false, traites: rapport.length, rapport });
});
