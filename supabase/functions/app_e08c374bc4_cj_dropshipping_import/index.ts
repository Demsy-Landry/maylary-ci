import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

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

    // Chaîne de coût : achat → fret (part selon incoterm) → valeur CIF →
    // assurance facultés sur la valeur CIF majorée (règle des 110 %) →
    // coût de revient → marge → prix plancher.
    // ⚠️ Formule dupliquée dans src/lib/cout-import.ts (aperçu admin) : toute
    // évolution doit être reportée aux deux endroits.
    const tauxMarge = body.taux_marge ?? Number(parametres.taux_marge_defaut);
    const tauxChange = Number(parametres.taux_change_usd_fcfa);

    const prix_achat_fcfa = Math.round(prix_fournisseur_usd * tauxChange);
    const cout_fret_fcfa = Math.round(
      Number(parametres.fret_base_article_fcfa) * Number(repartition.part_fret),
    );
    const valeur_cif_fcfa = prix_achat_fcfa + cout_fret_fcfa;

    const valeur_assuree_fcfa = repartition.assurance_a_charge
      ? Math.round(valeur_cif_fcfa * Number(parametres.taux_couverture_assurance))
      : 0;
    const cout_assurance_fcfa = repartition.assurance_a_charge
      ? Math.max(
          Math.round(valeur_assuree_fcfa * Number(parametres.taux_assurance)),
          Number(parametres.prime_assurance_minimum_fcfa),
        )
      : 0;

    const cout_revient_fcfa = prix_achat_fcfa + cout_fret_fcfa + cout_assurance_fcfa;
    const prix_avant_plancher_fcfa = Math.round(cout_revient_fcfa * (1 + tauxMarge));
    const prix_plancher_fcfa = Number(parametres.prix_plancher_fcfa);
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
        categorie_gp_id: body.categorie_gp_id ?? null,
        espace: 'grand_public',
        stock_disponible: (body.stock ?? 0) > 0 ? 'en_stock' : 'sur_commande',
        actif: true,
        source_donnee: 'import_cj_dropshipping',
        reference_externe,
      })
      .select('id, nom, prix_achat_fcfa, cout_fret_fcfa, cout_assurance_fcfa, prix_unitaire_fcfa, incoterm_achat')
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
        },
      },
      200,
    );
  } catch (error) {
    console.log(JSON.stringify({ requestId, error: String(error) }));
    return jsonResponse({ error: 'Erreur interne du serveur.' }, 500);
  }
});
