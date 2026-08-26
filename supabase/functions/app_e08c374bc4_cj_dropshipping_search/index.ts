import { createClient } from 'npm:@supabase/supabase-js@2';
import { servirAvecCors } from '../_partage/cors.ts';

// Les en-têtes d'autorisation sont posés par `servirAvecCors`, qui
// connaît l'origine de la demande. Ce qui reste ici est écrasé en sortie.
const corsHeaders = {
  'Access-Control-Allow-Headers': '*',
};

const CJ_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Récupère un jeton d'accès CJ Dropshipping à partir de l'email + clé API
 * stockés en secrets serveur (jamais exposés au navigateur).
 * Note : CJ Dropshipping limite la fréquence de génération de jetons
 * (environ 1 toutes les 5 minutes par compte) — normal en usage admin ponctuel,
 * mais peut renvoyer une erreur en cas de recherches très rapprochées.
 */
async function getCjAccessToken(): Promise<{ token: string } | { error: string }> {
  const email = Deno.env.get('CJ_DROPSHIPPING_EMAIL');
  const apiKey = Deno.env.get('CJ_DROPSHIPPING_API_KEY');

  if (!email || !apiKey) {
    return {
      error:
        "Clé API CJ Dropshipping non configurée. Ajoutez CJ_DROPSHIPPING_EMAIL et CJ_DROPSHIPPING_API_KEY dans Supabase > Edge Functions > Secrets.",
    };
  }

  const res = await fetch(`${CJ_BASE_URL}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: apiKey }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.result || !data?.data?.accessToken) {
    return {
      error: data?.message ?? "Authentification CJ Dropshipping refusée. Vérifiez l'email et la clé API.",
    };
  }

  return { token: data.data.accessToken as string };
}

interface CjSearchResult {
  reference_externe: string;
  nom: string;
  photo: string | null;
  prix_fournisseur_usd: number | null;
  stock: number | null;
}

/**
 * Le catalogue CJ Dropshipping n'est indexé qu'en anglais (champ productNameEn) :
 * une recherche en français ne matche que des bouts de mots au hasard. On
 * traduit donc le mot-clé avant d'interroger CJ. Si la traduction échoue,
 * on retombe sur le mot-clé original plutôt que de bloquer la recherche.
 */
async function translateToEnglish(text: string): Promise<string> {
  try {
    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', text);
    url.searchParams.set('langpair', 'fr|en');

    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    const translated = data?.responseData?.translatedText;

    return typeof translated === 'string' && translated.trim() ? translated.trim() : text;
  } catch {
    return text;
  }
}

servirAvecCors(async (req: Request) => {
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Méthode non autorisée.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Authentification : l'appelant doit être connecté et avoir le rôle admin.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Authentification requise.' }, 401);
    }

    const supabaseAsCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabaseAsCaller.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Session invalide, reconnectez-vous.' }, 401);
    }

    const supabaseService = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await supabaseService
      .from('app_e08c374bc4_profiles')
      .select('type_compte')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.type_compte !== 'admin') {
      return jsonResponse({ error: 'Accès réservé aux administrateurs.' }, 403);
    }

    // 2. Lecture du mot-clé de recherche.
    let body: { keyword?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corps de requête JSON invalide.' }, 400);
    }

    const keyword = body.keyword?.trim();
    if (!keyword) {
      return jsonResponse({ error: 'Mot-clé de recherche requis.' }, 400);
    }

    // 3. Jeton CJ Dropshipping.
    const tokenResult = await getCjAccessToken();
    if ('error' in tokenResult) {
      console.log(JSON.stringify({ requestId, step: 'cj_token_error', error: tokenResult.error }));
      return jsonResponse({ error: tokenResult.error }, 502);
    }

    // 4. Traduction du mot-clé (catalogue CJ en anglais uniquement), puis recherche.
    const keywordEn = await translateToEnglish(keyword);

    const searchUrl = new URL(`${CJ_BASE_URL}/product/list`);
    searchUrl.searchParams.set('pageNum', '1');
    searchUrl.searchParams.set('pageSize', '20');
    searchUrl.searchParams.set('productNameEn', keywordEn);

    const cjRes = await fetch(searchUrl, {
      method: 'GET',
      headers: { 'CJ-Access-Token': tokenResult.token },
    });
    const cjData = await cjRes.json().catch(() => null);

    if (!cjRes.ok || !cjData?.result) {
      console.log(JSON.stringify({ requestId, step: 'cj_search_error', status: cjRes.status, body: cjData }));
      return jsonResponse(
        { error: cjData?.message ?? 'CJ Dropshipping est indisponible ou a refusé la requête. Réessayez dans quelques instants.' },
        502,
      );
    }

    const list: unknown[] = cjData?.data?.list ?? [];

    // Le format exact des champs peut varier selon la version d'API CJ Dropshipping ;
    // lecture défensive avec plusieurs noms de champs possibles.
    const produits: CjSearchResult[] = list.map((raw) => {
      const p = raw as Record<string, unknown>;
      const pid = String(p.pid ?? p.productId ?? p.id ?? '');
      const nom = String(p.productNameEn ?? p.productName ?? p.nameEn ?? 'Produit sans nom');
      const photo =
        (p.productImage as string) ?? (Array.isArray(p.productImageSet) ? (p.productImageSet[0] as string) : null) ?? null;
      const prixRaw = p.sellPrice ?? p.sellPriceMin ?? p.price;
      let prix_fournisseur_usd: number | null = null;
      if (typeof prixRaw === 'number') {
        prix_fournisseur_usd = prixRaw;
      } else if (typeof prixRaw === 'string') {
        const match = prixRaw.match(/[\d.]+/);
        prix_fournisseur_usd = match ? parseFloat(match[0]) : null;
      }
      const stockRaw = p.stock ?? p.inventoryNum ?? p.stockNum;
      const stock = typeof stockRaw === 'number' ? stockRaw : typeof stockRaw === 'string' ? parseInt(stockRaw, 10) : null;

      return { reference_externe: pid, nom, photo, prix_fournisseur_usd, stock };
    });

    console.log(
      JSON.stringify({ requestId, step: 'search_ok', keyword, keywordEn, count: produits.length }),
    );

    return jsonResponse({ produits, mot_cle_traduit: keywordEn }, 200);
  } catch (error) {
    console.log(JSON.stringify({ requestId, error: String(error) }));
    return jsonResponse({ error: 'Erreur interne du serveur.' }, 500);
  }
});
