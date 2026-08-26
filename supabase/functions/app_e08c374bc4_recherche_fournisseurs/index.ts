// Recherche d'un article chez les fournisseurs de MayLary Group.
//
// Cette fonction est appelée par Le Déclarant quand un client cherche quelque
// chose qui n'est pas au catalogue. Elle est volontairement séparée de
// l'assistant : la logique fournisseur bouge souvent — une API qui change, un
// fournisseur qui s'ouvre — et il ne faut pas redéployer tout l'assistant pour
// corriger une traduction.
//
// ACCÈS : compte connecté, avec un plafond de vingt recherches par heure et
// par personne. Chaque recherche coûte un appel à une API tierce qui nous
// compte : sans plafond, un visiteur qui s'amuse épuise le quota du jour et
// prive tous les autres. Le plafond est tenu en base, pas ici — deux requêtes
// simultanées ne doivent pas passer toutes les deux.
//
// ---------------------------------------------------------------------------
// POURQUOI LE FILTRE DE PERTINENCE EXISTE
//
// Un test réel a montré le pire scénario possible. Le service de traduction
// gratuit a répondu 200 avec, en guise de traduction :
//
//     « MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY »
//
// Cette phrase a été envoyée à CJ comme mot-clé. CJ, ne trouvant rien, n'a pas
// répondu « aucun résultat » : il a renvoyé vingt articles au hasard — un sapin
// de Noël, une montre, une pince à cheveux — pour une recherche de trottinette
// électrique. Sans garde-fou, l'assistant aurait présenté un sapin de Noël à
// un client qui cherchait une trottinette.
//
// Deux verrous en découlent, et ils tiennent quelle que soit la panne d'en
// face : on refuse une traduction qui ressemble à un message d'erreur, et on
// ne garde que les articles dont le nom porte vraiment un des mots cherchés.
// Rendre une liste vide est une réponse ; rendre une liste au hasard est un
// mensonge.

const CJ_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';

// Les en-têtes d'autorisation sont posés par `servirAvecCors`, qui
// connaît l'origine de la demande. Ce qui reste ici est écrasé en sortie.
const enTetes = {
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: enTetes });

const secret = (nom: string) => (Deno.env.get(nom) ?? '').replace(/\s+/g, '');

/** Mots vides : ils n'apportent rien à un contrôle de pertinence. */
const MOTS_VIDES = new Set([
  'pour', 'avec', 'dans', 'les', 'des', 'une', 'the', 'and', 'for', 'with',
  'sans', 'chez', 'plus', 'tout', 'cette',
]);

/** Enlève les accents : « électrique » et « electrique » doivent se valoir. */
const sansAccent = (t: string) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function motsUtiles(texte: string): string[] {
  return sansAccent(texte)
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length >= 3 && !MOTS_VIDES.has(m));
}

/**
 * Un petit lexique interne, qui ne tombe jamais en panne.
 *
 * Le test l'a montré : le traducteur gratuit a un quota journalier, et
 * lorsqu'il est épuisé la recherche part en français dans un catalogue indexé
 * en anglais — donc ne trouve rien. Les mots ci-dessous couvrent l'essentiel
 * de ce qu'on cherche dans un catalogue de biens de consommation. Ils ne
 * remplacent pas un traducteur : ils garantissent un plancher.
 */
import { servirAvecCors } from '../_partage/cors.ts';
const LEXIQUE: Record<string, string> = {
  trottinette: 'scooter', velo: 'bicycle', voiture: 'car', moto: 'motorcycle',
  electrique: 'electric', solaire: 'solar', sans: '', batterie: 'battery',
  chargeur: 'charger', cable: 'cable', ecouteurs: 'earphones', casque: 'headphones',
  montre: 'watch', telephone: 'phone', ordinateur: 'laptop', tablette: 'tablet',
  imprimante: 'printer', camera: 'camera', enceinte: 'speaker', ampoule: 'bulb',
  ventilateur: 'fan', climatiseur: 'air conditioner', refrigerateur: 'refrigerator',
  congelateur: 'freezer', cuisiniere: 'stove', micro: 'microwave', bouilloire: 'kettle',
  mixeur: 'blender', friteuse: 'fryer', machine: 'machine', laver: 'washing',
  aspirateur: 'vacuum cleaner', fer: 'iron', repasser: 'ironing',
  meuble: 'furniture', chaise: 'chair', table: 'table', bureau: 'desk',
  armoire: 'wardrobe', matelas: 'mattress', canape: 'sofa', etagere: 'shelf',
  perceuse: 'drill', visseuse: 'screwdriver', marteau: 'hammer', scie: 'saw',
  meuleuse: 'grinder', compresseur: 'compressor', groupe: 'generator',
  outillage: 'tools', quincaillerie: 'hardware', peinture: 'paint',
  robinet: 'faucet', tuyau: 'hose', pompe: 'pump', serrure: 'lock',
  chaussures: 'shoes', sac: 'bag', valise: 'suitcase', vetement: 'clothing',
  chemise: 'shirt', pantalon: 'trousers', robe: 'dress', montre_bracelet: 'watch',
  bijou: 'jewelry', bague: 'ring', collier: 'necklace', parure: 'jewelry set',
  cosmetique: 'cosmetics', creme: 'cream', parfum: 'perfume', savon: 'soap',
  jouet: 'toy', poussette: 'stroller', couche: 'diaper', biberon: 'baby bottle',
  pneu: 'tire', huile: 'oil', filtre: 'filter', frein: 'brake', phare: 'headlight',
  panneau: 'panel', onduleur: 'inverter', cuisine: 'kitchen', maison: 'home',
  jardin: 'garden', sport: 'sports', bebe: 'baby', femme: 'women', homme: 'men',
};

/** Traduit ce que le lexique connaît. Rend null s'il ne connaît rien. */
function parLeLexique(texte: string): string | null {
  const mots = sansAccent(texte).split(/[^a-z0-9]+/).filter(Boolean);
  const traduits = mots.map((m) => LEXIQUE[m]).filter((t) => t !== undefined && t !== '');
  return traduits.length ? traduits.join(' ') : null;
}

/**
 * Traduction vers l'anglais, avec refus des réponses qui n'en sont pas.
 *
 * Le service gratuit répond 200 même quand il refuse : il place son message
 * d'erreur à la place de la traduction. On vérifie donc le code applicatif ET
 * la forme du texte rendu. Au moindre doute, on garde le mot d'origine : une
 * recherche en français donnera peu de résultats, mais elle ne donnera pas de
 * faux résultats.
 */
async function versAnglais(texte: string): Promise<{ mots: string; traduit: boolean; motif?: string }> {
  try {
    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', texte);
    url.searchParams.set('langpair', 'fr|en');

    const r = await fetch(url);
    const d = await r.json().catch(() => null);
    const t = d?.responseData?.translatedText;

    if (typeof t !== 'string' || !t.trim()) {
      return { mots: texte, traduit: false, motif: 'traduction vide' };
    }
    if (Number(d?.responseStatus) !== 200) {
      return { mots: texte, traduit: false, motif: `traducteur en erreur (${d?.responseStatus})` };
    }
    // Le message de quota arrive en majuscules dans le champ de traduction.
    if (/WARNING|LIMIT|QUOTA|MYMEMORY/i.test(t)) {
      return { mots: texte, traduit: false, motif: 'quota du traducteur épuisé' };
    }
    // Une traduction trois fois plus longue que l'original n'est pas une
    // traduction : c'est une phrase de service.
    if (t.length > texte.length * 3 + 20) {
      return { mots: texte, traduit: false, motif: 'réponse du traducteur anormale' };
    }
    return { mots: t.trim(), traduit: true };
  } catch {
    return { mots: texte, traduit: false, motif: 'traducteur injoignable' };
  }
}

async function jetonCJ(url: string, cle: string): Promise<string | null> {
  const entete = { apikey: cle, Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' };

  const lu = await fetch(
    `${url}/rest/v1/app_e08c374bc4_jetons_fournisseurs?fournisseur=eq.cj&select=jeton,expire_le`,
    { headers: entete },
  );
  const lignes = (await lu.json().catch(() => [])) as { jeton?: string; expire_le?: string }[];
  const cache = lignes?.[0];
  if (cache?.jeton && new Date(cache.expire_le!).getTime() - Date.now() > 3_600_000) {
    return cache.jeton;
  }

  const email = secret('CJ_DROPSHIPPING_EMAIL');
  const motDePasse = secret('CJ_DROPSHIPPING_API_KEY');
  if (!email || !motDePasse) return null;

  const r = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: motDePasse }),
  });
  const corps = await r.json().catch(() => null);
  const jeton = corps?.data?.accessToken as string | undefined;
  if (!jeton) return null;

  const echeance = corps?.data?.accessTokenExpiryDate
    ? new Date(String(corps.data.accessTokenExpiryDate))
    : new Date(Date.now() + 10 * 24 * 3_600_000);

  await fetch(`${url}/rest/v1/app_e08c374bc4_jetons_fournisseurs`, {
    method: 'POST',
    headers: { ...entete, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      fournisseur: 'cj',
      jeton,
      expire_le: echeance.toISOString(),
      obtenu_le: new Date().toISOString(),
    }),
  });

  return jeton;
}

servirAvecCors(async (requete) => {
  if (requete.method === 'OPTIONS') return new Response('ok', { headers: enTetes });

  const url = Deno.env.get('SUPABASE_URL')!;
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cleAnon = Deno.env.get('SUPABASE_ANON_KEY')!;

  const autorisation = requete.headers.get('Authorization') ?? '';
  if (!autorisation) return json({ erreur: 'Authentification requise.' }, 401);

  let designation = '';
  try {
    const corps = (await requete.json()) as { designation?: string };
    designation = String(corps.designation ?? '').trim();
  } catch {
    return json({ erreur: 'Requête illisible.' }, 400);
  }
  if (designation.length < 2) {
    return json({ erreur: 'Précisez ce qui est cherché.' }, 400);
  }

  // Le plafond se réserve avant tout appel sortant : c'est la réservation qui
  // fait foi, pas la lecture d'un compteur.
  const reservation = await fetch(
    `${url}/rest/v1/rpc/app_e08c374bc4_reserver_recherche_fournisseur`,
    {
      method: 'POST',
      headers: { apikey: cleAnon, Authorization: autorisation, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_recherche: designation }),
    },
  );
  const droit = await reservation.json().catch(() => null);
  if (!droit?.autorise) {
    return json(
      { erreur: droit?.motif ?? 'Recherche refusée.', plafond_atteint: true },
      429,
    );
  }

  // Le cache, avant tout appel sortant. Les clients cherchent en grande partie
  // les mêmes choses ; repayer un appel d'API pour une question déjà posée
  // dans la journée n'a pas de sens, et c'est ce qui fait tomber le service
  // quand deux personnes cherchent en même temps.
  const cle = sansAccent(designation).replace(/\s+/g, ' ').trim();
  const enteteService = {
    apikey: cleService,
    Authorization: `Bearer ${cleService}`,
    'Content-Type': 'application/json',
  };

  const luCache = await fetch(
    `${url}/rest/v1/app_e08c374bc4_cache_recherches_fournisseurs?cle=eq.${encodeURIComponent(cle)}&select=resultat,cree_le`,
    { headers: enteteService },
  );
  const cache = (await luCache.json().catch(() => []))?.[0] as
    | { resultat: Record<string, unknown>; cree_le: string }
    | undefined;

  if (cache && Date.now() - new Date(cache.cree_le).getTime() < 24 * 3_600_000) {
    await fetch(`${url}/rest/v1/app_e08c374bc4_recherches_fournisseurs?id=eq.${droit.id}`, {
      method: 'PATCH',
      headers: enteteService,
      body: JSON.stringify({
        trouves: Array.isArray(cache.resultat.articles) ? cache.resultat.articles.length : 0,
      }),
    });
    return json({
      ...cache.resultat,
      depuis_le_cache: true,
      cherche_le: cache.cree_le,
      recherches_restantes_cette_heure: droit.restant,
    });
  }

  const jeton = await jetonCJ(url, cleService);
  if (!jeton) {
    return json({
      recherche: designation,
      consultes: [],
      non_consultes: ['CJ Dropshipping (Chine) — identifiants absents ou refusés'],
      articles: [],
    });
  }

  // Le lexique d'abord : il est immédiat et n'a pas de quota. Le service tiers
  // ne sert que pour ce qu'il ne couvre pas.
  const duLexique = parLeLexique(designation);
  const traduction = duLexique
    ? { mots: duLexique, traduit: true, motif: undefined as string | undefined, source: 'lexique interne' }
    : { ...(await versAnglais(designation)), source: 'service de traduction' };

  // CJ limite le débit : mesuré, deux recherches simultanées sur trois sont
  // refusées. Une seule reprise, espacée, suffit à absorber une rafale.
  const interroger = async (mots: string) => {
    const u = new URL(`${CJ_BASE}/product/list`);
    u.searchParams.set('pageNum', '1');
    u.searchParams.set('pageSize', '20');
    u.searchParams.set('productNameEn', mots);
    const rep = await fetch(u, { headers: { 'CJ-Access-Token': jeton } });
    return { rep, corps: await rep.json().catch(() => null) };
  };

  let { rep: r, corps } = await interroger(traduction.mots);
  if (!r.ok || !corps?.result) {
    await new Promise((suite) => setTimeout(suite, 1500));
    ({ rep: r, corps } = await interroger(traduction.mots));
  }
  if (!r.ok || !corps?.result) {
    return json({
      recherche: designation,
      consultes: [],
      non_consultes: ['CJ Dropshipping (Chine) — a refusé la requête ou est indisponible'],
      articles: [],
    });
  }

  const bruts: unknown[] = corps?.data?.list ?? [];

  // Le contrôle de pertinence. CJ ne dit pas « je n'ai rien » : il rend une
  // liste par défaut, et c'est elle qu'il faut écarter.
  //
  // On confronte les noms rendus aux mots de la LANGUE DU CATALOGUE, pas à
  // ceux de la question. Mélanger les deux était une erreur mesurée : pour
  // « montre homme », traduit en « watch men », exiger deux mots parmi
  // {montre, homme, watch} écartait « Men's Quartz Watch » — un mot français
  // n'a aucune chance d'apparaître dans un titre anglais.
  const attendus = traduction.traduit
    ? motsUtiles(traduction.mots)
    : motsUtiles(designation);

  const enArticle = (brut: unknown) => {
    const p = brut as Record<string, unknown>;
    const prixBrut = p.sellPrice ?? p.sellPriceMin ?? p.price;
    let prix: number | null = null;
    if (typeof prixBrut === 'number') prix = prixBrut;
    else if (typeof prixBrut === 'string') {
      const m = prixBrut.match(/[\d.]+/);
      prix = m ? Number.parseFloat(m[0]) : null;
    }
    return {
      fournisseur: 'CJ Dropshipping (Chine)',
      reference: String(p.pid ?? p.productId ?? p.id ?? ''),
      nom: String(p.productNameEn ?? p.productName ?? p.nameEn ?? 'Article sans nom'),
      photo:
        (p.productImage as string) ??
        (Array.isArray(p.productImageSet) ? (p.productImageSet[0] as string) : null) ??
        null,
      prix_achat: prix,
      devise: 'USD',
    };
  };

  const tous = bruts.map(enArticle);

  // Un seul mot commun ne suffit pas : « trottinette électrique » a d'abord
  // ramené un THERMOS ÉLECTRIQUE, retenu sur le seul adjectif. Dès que la
  // demande porte deux mots utiles, on en exige deux — jamais plus, sinon on
  // écarte les titres qui décrivent l'article autrement.
  const seuil = Math.min(2, Math.max(1, attendus.length));
  const pertinents = attendus.length
    ? tous.filter((a) => {
        const nom = sansAccent(a.nom);
        return attendus.filter((mot) => nom.includes(mot)).length >= seuil;
      })
    : tous;

  // Rien de pertinent avec la phrase entière ? CJ cherche une suite de mots :
  // l'ordre des adjectifs compte, et « scooter electric » ne trouve pas ce que
  // « scooter » trouve. On repose donc la question sur le mot le plus
  // spécifique avant de conclure qu'il n'y a rien.
  let articlesRetenus = pertinents;
  let essaiSecond: string | null = null;
  const motsTraduits = traduction.mots.split(/\s+/).filter((m) => m.length >= 3);
  if (articlesRetenus.length === 0 && motsTraduits.length >= 2) {
    essaiSecond = motsTraduits.sort((a, b) => b.length - a.length)[0];
    await new Promise((suite) => setTimeout(suite, 1200));
    const second = await interroger(essaiSecond);
    if (second.rep.ok && second.corps?.result) {
      const bis = (second.corps?.data?.list ?? []).map(enArticle);
      articlesRetenus = bis.filter((a: { nom: string }) => {
        const nom = sansAccent(a.nom);
        return attendus.filter((mot) => nom.includes(mot)).length >= seuil;
      });
    }
  }

  // Le journal sert aussi de mesure : une recherche qui ne trouve rien est une
  // ligne à mettre au catalogue.
  await fetch(`${url}/rest/v1/app_e08c374bc4_recherches_fournisseurs?id=eq.${droit.id}`, {
    method: 'PATCH',
    headers: enteteService,
    body: JSON.stringify({ trouves: articlesRetenus.length }),
  });

  const reponse = {
    recherche: designation,
    mots_envoyes: traduction.mots,
    traduction_reussie: traduction.traduit,
    traduction_par: traduction.source,
    ...(traduction.traduit ? {} : { traduction_indisponible: traduction.motif }),
    consultes: ['CJ Dropshipping (Chine)'],
    non_consultes: [],
    rendus_par_le_fournisseur: tous.length,
    retenus_apres_controle: articlesRetenus.length,
    ...(essaiSecond ? { second_essai_sur: essaiSecond } : {}),
    articles: articlesRetenus.slice(0, 8),
    ...(tous.length > 0 && articlesRetenus.length === 0
      ? {
          note:
            "Le fournisseur a renvoyé une liste, mais aucun article ne correspond réellement à la demande — c'est sa réponse par défaut quand il ne trouve pas. À traiter comme « rien trouvé », et surtout ne rien proposer de cette liste.",
        }
      : {}),
    avertissement:
      "Les prix sont des PRIX D'ACHAT chez le fournisseur, en dollars, hors fret, hors assurance, hors droits de douane, hors transit local et hors livraison. Ne jamais les présenter comme un prix de vente.",
  };

  await fetch(`${url}/rest/v1/app_e08c374bc4_cache_recherches_fournisseurs`, {
    method: 'POST',
    headers: { ...enteteService, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ cle, resultat: reponse, cree_le: new Date().toISOString() }),
  });

  return json({ ...reponse, recherches_restantes_cette_heure: droit.restant });
});
