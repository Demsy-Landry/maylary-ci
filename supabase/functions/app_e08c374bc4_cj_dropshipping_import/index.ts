import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

const CJ_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Copie de getCjAccessToken() de app_e08c374bc4_cj_dropshipping_search : les
 * edge functions Deno ne partagent pas de module commun. Toute correction doit
 * être reportée dans les deux fonctions.
 */
async function getCjAccessToken(): Promise<string | null> {
  const email = Deno.env.get('CJ_DROPSHIPPING_EMAIL');
  const apiKey = Deno.env.get('CJ_DROPSHIPPING_API_KEY');
  if (!email || !apiKey) return null;

  const res = await fetch(`${CJ_BASE_URL}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: apiKey }),
  });
  const data = await res.json().catch(() => null);
  return data?.data?.accessToken ?? null;
}

interface FretReel {
  prix_usd: number;
  transporteur: string;
  delai: string | null;
}

/**
 * Coût de transport réel d'un article, du dépôt chinois jusqu'au pays du
 * client. On retient l'option la moins chère.
 *
 * Renvoie null à la moindre difficulté (produit sans variante, quota CJ
 * dépassé, réseau) : l'import doit aboutir même sans devis, quitte à retomber
 * sur le fret forfaitaire.
 */
async function obtenirFretReelCj(
  pid: string,
  token: string,
  paysDestination: string,
  quantite: number,
  requestId: string,
): Promise<FretReel | null> {
  try {
    const urlVariantes = new URL(`${CJ_BASE_URL}/product/query`);
    urlVariantes.searchParams.set('pid', pid);
    const detail = await (
      await fetch(urlVariantes, { headers: { 'CJ-Access-Token': token } })
    ).json().catch(() => null);

    const vid = detail?.data?.variants?.[0]?.vid;
    if (!vid) return null;

    // CJ plafonne à 1 appel par seconde : sans cette pause, le devis part en 429.
    await pause(1100);

    const res = await fetch(`${CJ_BASE_URL}/logistic/freightCalculate`, {
      method: 'POST',
      headers: { 'CJ-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startCountryCode: 'CN',
        endCountryCode: paysDestination,
        products: [{ quantity: quantite, vid }],
      }),
    });
    const data = await res.json().catch(() => null);
    const options = Array.isArray(data?.data) ? data.data : [];
    if (options.length === 0) return null;

    const moinsChere = options.reduce((a: Record<string, unknown>, b: Record<string, unknown>) =>
      Number(a.logisticPrice) <= Number(b.logisticPrice) ? a : b,
    );
    const prix = Number(moinsChere.logisticPrice);
    if (!Number.isFinite(prix) || prix <= 0) return null;

    return {
      prix_usd: prix,
      transporteur: String(moinsChere.logisticName ?? 'CJ Dropshipping'),
      delai: moinsChere.logisticAging ? String(moinsChere.logisticAging) : null,
    };
  } catch (error) {
    console.log(JSON.stringify({ requestId, step: 'fret_reel', error: String(error) }));
    return null;
  }
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface ImportBody {
  reference_externe?: string;
  nom?: string;
  description?: string | null;
  photos?: string[];
  prix_fournisseur_usd?: number;
  categorie_gp_id?: string | null;
  stock?: number | null;
  /** Optionnel : remplace ponctuellement le taux de marge par défaut pour cet import. */
  taux_marge?: number;
  /** Incoterm d'achat auprès du fournisseur ; détermine le fret restant à notre charge. */
  incoterm?: string;
  /** Quantité minimum de vente : dilue la part fixe du fret et de l'assurance. */
  quantite_minimum?: number;
}

Deno.serve(async (req: Request) => {
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

    // 1. Authentification admin (identique à cj_dropshipping_search).
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

    // 2. Lecture et validation du corps de requête.
    let body: ImportBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corps de requête JSON invalide.' }, 400);
    }

    const { reference_externe, nom, prix_fournisseur_usd } = body;

    if (!reference_externe || !nom || typeof prix_fournisseur_usd !== 'number') {
      return jsonResponse(
        { error: 'reference_externe, nom et prix_fournisseur_usd sont requis.' },
        400,
      );
    }

    // 3. Paramètres de coût de revient (configurables en base, jamais en dur).
    const { data: parametres, error: parametresError } = await supabaseService
      .from('app_e08c374bc4_parametres_import')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (parametresError || !parametres) {
      console.log(JSON.stringify({ requestId, error: parametresError }));
      return jsonResponse({ error: 'Impossible de lire les paramètres de marge.' }, 500);
    }

    const incotermChoisi = body.incoterm ?? parametres.incoterm_achat_defaut;
    const { data: repartition } = await supabaseService
      .from('app_e08c374bc4_parametres_incoterm')
      .select('incoterm, part_fret, assurance_a_charge')
      .eq('incoterm', incotermChoisi)
      .maybeSingle();

    if (!repartition) {
      return jsonResponse({ error: `Incoterm inconnu : ${incotermChoisi}.` }, 400);
    }

    // Chaîne de coût : achat → fret → valeur CIF → assurance facultés sur la
    // valeur CIF majorée (règle des 110 %) → coût de revient → marge → plancher.
    // ⚠️ Formule dupliquée dans src/lib/cout-import.ts (aperçu admin) : toute
    // évolution doit être reportée aux deux endroits.
    const tauxMarge = body.taux_marge ?? Number(parametres.taux_marge_defaut);
    const tauxChange = Number(parametres.taux_change_usd_fcfa);

    const prix_achat_fcfa = Math.round(prix_fournisseur_usd * tauxChange);

    // Le fret et la prime d'assurance comportent une part fixe par colis. La
    // répartir sur un lot n'a de sens que pour les articles bon marché : sur un
    // article cher, un lot imposerait au client une commande minimum absurde.
    // Le seuil décide, l'admin peut toujours forcer une valeur à l'import.
    const estPetitArticle = prix_achat_fcfa < Number(parametres.seuil_petit_article_fcfa);
    const quantite_minimum = Math.max(
      1,
      Math.round(
        body.quantite_minimum ??
          (estPetitArticle ? Number(parametres.quantite_minimum_defaut) : 1),
      ),
    );

    // Devis de transport réel auprès de CJ ; à défaut, fret forfaitaire réparti
    // selon l'incoterm. Le devis CJ est déjà un coût porte-à-porte complet :
    // la part de l'incoterm ne s'y applique pas.
    let fretReel: FretReel | null = null;
    if (parametres.utiliser_fret_reel_cj) {
      const token = await getCjAccessToken();
      if (token) {
        fretReel = await obtenirFretReelCj(
          reference_externe,
          token,
          String(parametres.pays_destination_code),
          quantite_minimum,
          requestId,
        );
      }
    }

    // Le devis CJ porte sur le lot entier : on ramène à l'unité.
    const cout_fret_fcfa = fretReel
      ? Math.round((fretReel.prix_usd * tauxChange) / quantite_minimum)
      : Math.round(Number(parametres.fret_base_article_fcfa) * Number(repartition.part_fret));
    const fret_source = fretReel ? 'cj_reel' : 'forfait';

    const valeur_cif_fcfa = prix_achat_fcfa + cout_fret_fcfa;

    // La prime s'applique au colis complet ; on la répartit sur les unités.
    const valeur_assuree_lot_fcfa = repartition.assurance_a_charge
      ? Math.round(valeur_cif_fcfa * quantite_minimum * Number(parametres.taux_couverture_assurance))
      : 0;
    const prime_lot_fcfa = repartition.assurance_a_charge
      ? Math.max(
          Math.round(valeur_assuree_lot_fcfa * Number(parametres.taux_assurance)),
          Number(parametres.prime_assurance_minimum_fcfa),
        )
      : 0;

    const valeur_assuree_fcfa = Math.round(valeur_assuree_lot_fcfa / quantite_minimum);
    const cout_assurance_fcfa = Math.round(prime_lot_fcfa / quantite_minimum);

    const cout_revient_fcfa = prix_achat_fcfa + cout_fret_fcfa + cout_assurance_fcfa;
    const prix_avant_plancher_fcfa = Math.round(cout_revient_fcfa * (1 + tauxMarge));

    // Le plancher protège la valeur d'une commande, pas celle d'une pièce :
    // sur un lot il se répartit, sinon imposer un minimum par unité annulerait
    // l'intérêt du lot pour le client.
    const prix_plancher_fcfa = Math.round(
      Number(parametres.prix_plancher_fcfa) / quantite_minimum,
    );
    const prix_unitaire_fcfa = Math.max(prix_avant_plancher_fcfa, prix_plancher_fcfa);

    // 4. Insertion du produit.
    const { data: produit, error: insertError } = await supabaseService
      .from('app_e08c374bc4_produits')
      .insert({
        nom,
        description: body.description ?? null,
        photos: body.photos ?? [],
        prix_achat_fcfa,
        prix_unitaire_fcfa,
        cout_fret_fcfa,
        cout_assurance_fcfa,
        incoterm_achat: incotermChoisi,
        fret_source,
        fret_transporteur: fretReel?.transporteur ?? null,
        quantite_minimum,
        // Le délai annoncé par le transporteur devient le délai affiché au client.
        delai_livraison_estime: fretReel?.delai ? `${fretReel.delai} jours` : null,
        categorie_gp_id: body.categorie_gp_id ?? null,
        espace: 'grand_public',
        stock_disponible: (body.stock ?? 0) > 0 ? 'en_stock' : 'sur_commande',
        actif: true,
        source_donnee: 'import_cj_dropshipping',
        reference_externe,
      })
      .select(
        'id, nom, prix_achat_fcfa, cout_fret_fcfa, cout_assurance_fcfa, prix_unitaire_fcfa, incoterm_achat, fret_source, fret_transporteur, quantite_minimum',
      )
      .single();

    if (insertError) {
      console.log(JSON.stringify({ requestId, error: insertError }));
      if (insertError.code === '23505') {
        return jsonResponse({ error: 'Ce produit CJ Dropshipping a déjà été importé.' }, 409);
      }
      return jsonResponse({ error: "Impossible d'enregistrer le produit." }, 500);
    }

    console.log(JSON.stringify({ requestId, step: 'import_ok', produitId: produit.id }));

    return jsonResponse(
      {
        success: true,
        produit,
        taux_marge_applique: tauxMarge,
        detail_cout: {
          prix_achat_fcfa,
          cout_fret_fcfa,
          valeur_cif_fcfa,
          valeur_assuree_fcfa,
          cout_assurance_fcfa,
          cout_revient_fcfa,
          prix_avant_plancher_fcfa,
          prix_unitaire_fcfa,
          plancher_applique: prix_unitaire_fcfa > prix_avant_plancher_fcfa,
          incoterm: incotermChoisi,
          fret_source,
          fret_transporteur: fretReel?.transporteur ?? null,
          fret_delai: fretReel?.delai ?? null,
          quantite_minimum,
          petit_article: estPetitArticle,
        },
      },
      200,
    );
  } catch (error) {
    console.log(JSON.stringify({ requestId, error: String(error) }));
    return jsonResponse({ error: 'Erreur interne du serveur.' }, 500);
  }
});
