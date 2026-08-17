import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Connecteur AliExpress — recherche, fiche article, et surtout MODE D'EXPÉDITION.
 *
 * POURQUOI ALIEXPRESS ET PAS UNE AUTRE PLATEFORME
 *
 * Le fondateur voulait élargir la gamme. Notre analyse montrait que le problème
 * n'était pas le nombre de références mais l'acheminement : l'express au colis
 * coûte trente-huit fois le groupage maritime. Brancher une plateforme de plus
 * qui n'expédie qu'au colis aurait élargi le problème, pas la gamme utile.
 *
 * AliExpress est le seul de la liste où beaucoup de vendeurs proposent un
 * acheminement MARITIME ou consolidé. C'est cette information-là qu'il faut
 * ramener — sans elle, le connecteur n'apporterait qu'un catalogue de plus au
 * même prix.
 *
 * CE QUE LA FONCTION REFUSE DE FAIRE
 *
 * Elle ne rend jamais un article sans poids ni volume. Toute notre chaîne de
 * coût — unité payante, acconage à la tonne, assurance sur la valeur CAF — en
 * dépend, et un article sans mesures se retrouverait chiffré au forfait, ce qui
 * est exactement le défaut qu'on vient de corriger sur trente-six références.
 *
 * Elle ne devine pas non plus la réponse de l'API : quand la forme reçue n'est
 * pas celle attendue, elle rend la réponse brute plutôt qu'un résultat vide. Un
 * catalogue vide se lit « aucun résultat » ; une réponse brute se corrige.
 *
 * LA SIGNATURE
 *
 * La plateforme ouverte d'AliExpress signe chaque appel : paramètres triés,
 * concaténés en clé+valeur, puis HMAC-SHA256 avec le secret de l'application,
 * en hexadécimal majuscule. C'est le schéma documenté pour la passerelle
 * `/sync`. Il n'a PAS pu être éprouvé contre l'API réelle depuis ici — le
 * premier appel authentique le confirmera ou l'infirmera, et l'erreur renvoyée
 * par AliExpress le dira explicitement.
 */

const enTetesCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

const PASSERELLE = 'https://api-sg.aliexpress.com/sync';

const reponse = (corps: unknown, statut: number) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...enTetesCors, 'Content-Type': 'application/json' },
  });

/** Signature TOP : paramètres triés, concaténés, HMAC-SHA256, hexadécimal majuscule. */
async function signer(params: Record<string, string>, secret: string): Promise<string> {
  const base = Object.keys(params)
    .sort()
    .map((c) => c + params[c])
    .join('');

  const cle = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const octets = await crypto.subtle.sign('HMAC', cle, new TextEncoder().encode(base));
  return [...new Uint8Array(octets)]
    .map((o) => o.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

interface Identifiants {
  cle: string;
  secret: string;
  jeton: string | null;
}

function lireIdentifiants(): Identifiants | { erreur: string } {
  const cle = Deno.env.get('ALIEXPRESS_APP_KEY');
  const secret = Deno.env.get('ALIEXPRESS_APP_SECRET');
  if (!cle || !secret) {
    return {
      erreur:
        'Identifiants AliExpress absents. Déposez ALIEXPRESS_APP_KEY et ALIEXPRESS_APP_SECRET dans Supabase → Edge Functions → Secrets. ALIEXPRESS_ACCESS_TOKEN est nécessaire en plus pour les méthodes du programme dropshipping.',
    };
  }
  return { cle, secret, jeton: Deno.env.get('ALIEXPRESS_ACCESS_TOKEN') ?? null };
}

async function appeler(
  methode: string,
  arguments_: Record<string, string>,
  id: Identifiants,
): Promise<{ ok: true; donnees: unknown } | { ok: false; erreur: string; brut?: unknown }> {
  const params: Record<string, string> = {
    ...arguments_,
    method: methode,
    app_key: id.cle,
    timestamp: String(Date.now()),
    sign_method: 'sha256',
    format: 'json',
    v: '2.0',
    simplify: 'true',
  };
  if (id.jeton) params.session = id.jeton;

  params.sign = await signer(params, id.secret);

  let res: Response;
  try {
    res = await fetch(PASSERELLE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
  } catch (e) {
    return { ok: false, erreur: `AliExpress injoignable : ${(e as Error).message}` };
  }

  const donnees = await res.json().catch(() => null);

  /* Une erreur de la plateforme arrive avec un code 200 : c'est le corps qui
     porte l'échec. Le lire évite de croire à une réponse vide. */
  const err = donnees as Record<string, unknown> | null;
  if (err && (err.error_response || err.code)) {
    const detail = (err.error_response ?? err) as Record<string, unknown>;
    return {
      ok: false,
      erreur:
        String(detail.msg ?? detail.sub_msg ?? detail.message ?? 'refus AliExpress') +
        (detail.sub_code ? ` (${detail.sub_code})` : ''),
      brut: donnees,
    };
  }
  if (!res.ok || !donnees) {
    return { ok: false, erreur: `AliExpress a répondu ${res.status}`, brut: donnees };
  }
  return { ok: true, donnees };
}

/**
 * Le mode d'acheminement que le vendeur propose réellement.
 *
 * C'est la raison d'être de ce connecteur. Un service dont le nom évoque la mer
 * ou un délai long fait entrer l'article dans la filière qui nous rend
 * compétitifs ; à défaut, l'article suit le régime de l'express, et son prix
 * portera le surcoût qu'on cherche justement à éviter.
 *
 * Le nom du service est ce qu'AliExpress donne de plus fiable : les vendeurs
 * n'exposent pas tous un champ de mode normalisé.
 */
const INDICES_MARITIME = [
  'sea', 'ocean', 'maritime', 'shipping by sea', 'sea freight',
  'cainiao super economy', 'super economy', 'economy global',
];

export function modeDepuisServices(services: string[]): {
  maritime_disponible: boolean;
  service_retenu: string | null;
  canal: 'boutique_ddp' | 'import_requis';
} {
  const bas = services.map((s) => s.toLowerCase());
  const trouve = bas.findIndex((s) => INDICES_MARITIME.some((i) => s.includes(i)));

  if (trouve >= 0) {
    return {
      maritime_disponible: true,
      service_retenu: services[trouve],
      canal: 'boutique_ddp',
    };
  }
  return {
    maritime_disponible: false,
    service_retenu: services[0] ?? null,
    /* Sans acheminement lent et consolidé, l'article ne se vend pas au détail à
       un prix tenable : il rejoint la filière import, où le groupage le rend
       viable en quantité. */
    canal: 'import_requis',
  };
}

interface ArticleAliExpress {
  reference_externe: string;
  nom: string;
  photo: string | null;
  prix_usd: number | null;
  poids_g: number | null;
  volume_cm3: number | null;
  services_expedition: string[];
  maritime_disponible: boolean;
  service_retenu: string | null;
  canal: 'boutique_ddp' | 'import_requis';
  /** Ce qui manque pour pouvoir le chiffrer. Vide = exploitable. */
  manques: string[];
}

const nombre = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Cherche une valeur quelle que soit la profondeur où l'API la range. */
function pecher(source: unknown, cles: string[]): unknown {
  if (source == null || typeof source !== 'object') return undefined;
  const o = source as Record<string, unknown>;
  for (const c of cles) if (o[c] != null) return o[c];
  for (const v of Object.values(o)) {
    const trouve = pecher(v, cles);
    if (trouve !== undefined) return trouve;
  }
  return undefined;
}

function cartographier(brut: unknown): ArticleAliExpress | null {
  const ref = pecher(brut, ['product_id', 'productId', 'item_id']);
  if (ref == null) return null;

  const poids_kg = nombre(pecher(brut, ['package_weight', 'gross_weight', 'weight']));
  const l = nombre(pecher(brut, ['package_length', 'length']));
  const w = nombre(pecher(brut, ['package_width', 'width']));
  const h = nombre(pecher(brut, ['package_height', 'height']));

  const services = ((pecher(brut, ['delivery_service_list', 'logistics_service_name', 'service_name']) ??
    []) as unknown[])
    .flatMap((s) => (typeof s === 'string' ? [s] : typeof s === 'object' && s ? Object.values(s).filter((v): v is string => typeof v === 'string') : []));

  const mode = modeDepuisServices(services);

  const poids_g = poids_kg != null ? Math.round(poids_kg * 1000) : null;
  const volume_cm3 = l != null && w != null && h != null ? Math.round(l * w * h) : null;

  const manques: string[] = [];
  if (poids_g == null) manques.push('poids');
  if (volume_cm3 == null) manques.push('dimensions');
  if (services.length === 0) manques.push('services d’expédition');

  return {
    reference_externe: String(ref),
    nom: String(pecher(brut, ['subject', 'product_title', 'title', 'name']) ?? 'Sans intitulé'),
    photo: (pecher(brut, ['product_main_image_url', 'image_url', 'main_image']) as string) ?? null,
    prix_usd: nombre(pecher(brut, ['target_sale_price', 'sale_price', 'app_sale_price', 'price'])),
    poids_g,
    volume_cm3,
    services_expedition: services,
    maritime_disponible: mode.maritime_disponible,
    service_retenu: mode.service_retenu,
    canal: mode.canal,
    manques,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: enTetesCors });

  /* Même garde que les autres fonctions d'administration : seul un
     administrateur connecté déclenche un appel qui consomme notre quota. */
  const jetonAppelant = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jetonAppelant) return reponse({ erreur: 'Authentification requise.' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: utilisateur } = await supabase.auth.getUser(jetonAppelant);
  if (!utilisateur?.user) return reponse({ erreur: 'Session invalide.' }, 401);

  const { data: profil } = await supabase
    .from('app_e08c374bc4_profiles')
    .select('type_compte')
    .eq('user_id', utilisateur.user.id)
    .maybeSingle();
  if (profil?.type_compte !== 'admin') {
    return reponse({ erreur: 'Réservé à l’administration.' }, 403);
  }

  const id = lireIdentifiants();
  if ('erreur' in id) return reponse({ erreur: id.erreur }, 400);

  const corps = await req.json().catch(() => ({}));
  const action = String(corps.action ?? 'rechercher');

  if (action === 'diagnostic') {
    /* Un appel minimal, uniquement pour savoir si la signature passe. C'est la
       première chose à faire quand la clé arrive : distinguer « mauvaise clé »
       de « mauvaise signature » évite des heures de tâtonnement. */
    const r = await appeler('aliexpress.ds.category.get', {}, id);
    return reponse(
      r.ok
        ? { signature: 'acceptée', reponse: r.donnees }
        : { signature: 'refusée', erreur: r.erreur, reponse_brute: r.brut },
      r.ok ? 200 : 502,
    );
  }

  if (action === 'rechercher') {
    const motsCles = String(corps.mots_cles ?? '').trim();
    if (!motsCles) return reponse({ erreur: 'Précisez des mots-clés.' }, 400);

    const r = await appeler(
      'aliexpress.ds.text.search',
      {
        keyWord: motsCles,
        local: 'fr_FR',
        countryCode: 'CI',
        currency: 'USD',
        pageSize: String(Math.min(Number(corps.limite ?? 20), 50)),
        pageIndex: '1',
      },
      id,
    );
    if (!r.ok) return reponse({ erreur: r.erreur, reponse_brute: r.brut }, 502);

    const liste = (pecher(r.donnees, ['products', 'product_list', 'items']) ?? []) as unknown[];
    const articles = (Array.isArray(liste) ? liste : [])
      .map(cartographier)
      .filter((a): a is ArticleAliExpress => a !== null);

    return reponse(
      {
        articles,
        /* On dit ce qu'on a trouvé ET ce qui manque : un article sans poids ne
           doit pas se glisser au catalogue, il doit se voir. */
        exploitables: articles.filter((a) => a.manques.length === 0).length,
        maritime: articles.filter((a) => a.maritime_disponible).length,
        reponse_brute: articles.length === 0 ? r.donnees : undefined,
      },
      200,
    );
  }

  if (action === 'fiche') {
    const ref = String(corps.reference_externe ?? '').trim();
    if (!ref) return reponse({ erreur: 'Référence absente.' }, 400);

    const r = await appeler(
      'aliexpress.ds.product.get',
      { product_id: ref, ship_to_country: 'CI', target_currency: 'USD', target_language: 'fr' },
      id,
    );
    if (!r.ok) return reponse({ erreur: r.erreur, reponse_brute: r.brut }, 502);

    const article = cartographier(r.donnees);
    if (!article) {
      return reponse(
        { erreur: 'Réponse AliExpress illisible pour cette référence.', reponse_brute: r.donnees },
        502,
      );
    }
    return reponse({ article }, 200);
  }

  return reponse({ erreur: `Action inconnue : ${action}` }, 400);
});
