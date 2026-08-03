import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCjAccessToken,
  obtenirDetailProduitCj,
  obtenirFretReelCj,
  pause,
  type FretReel,
} from '../_partage/cj-api.ts';
import { calculerCout, quantiteMinimumPour } from '../_partage/cout-import.ts';

/** Enseigne maison sous laquelle paraissent les imports Maylary en espace pro. */
const ENSEIGNE_MAYLARY = 'Maylary Import';

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
  /** Destination de l'article : vitrine grand public ou espace professionnel. */
  espace?: 'grand_public' | 'pro';
  /** Pour l'espace pro : le rayon où ranger l'article. */
  secteur_id?: string | null;
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

    const espace = body.espace === 'pro' ? 'pro' : 'grand_public';
    if (espace === 'grand_public' && !body.categorie_gp_id) {
      return jsonResponse({ error: 'Choisissez une catégorie de la boutique.' }, 400);
    }
    if (espace === 'pro' && !body.secteur_id) {
      return jsonResponse({ error: "Choisissez un secteur de l'espace professionnel." }, 400);
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

    const prix_achat_fcfa = Math.round(
      prix_fournisseur_usd * Number(parametres.taux_change_usd_fcfa),
    );
    const quantite_minimum = quantiteMinimumPour(
      prix_achat_fcfa,
      parametres,
      body.quantite_minimum ?? null,
    );

    // Devis de transport réel auprès de CJ ; à défaut, fret forfaitaire réparti
    // selon l'incoterm.
    let fretReel: FretReel | null = null;
    let mesures: { poids_g: number | null; volume_cm3: number | null } = { poids_g: null, volume_cm3: null };
    // La variante est l'identifiant que le fournisseur exige pour coter un
    // transport ou passer une commande — la référence produit ne suffit pas.
    // Sans elle en base, l'article ne peut plus être ni groupé ni expédié.
    let referenceVariante: string | null = null;
    if (parametres.utiliser_fret_reel_cj) {
      const token = await getCjAccessToken();
      if (token) {
        const detail = await obtenirDetailProduitCj(reference_externe, token);
        const { vid } = detail;
        referenceVariante = vid;
        mesures = { poids_g: detail.poids_g, volume_cm3: detail.volume_cm3 };
        if (vid) {
          // CJ plafonne à 1 appel par seconde : sans cette pause, le devis part en 429.
          await pause(1100);
          fretReel = await obtenirFretReelCj(
            vid,
            token,
            String(parametres.pays_destination_code),
            quantite_minimum,
          );
        }
      }
    }

    const cout = calculerCout({
      prixAchatFcfa: prix_achat_fcfa,
      quantiteMinimum: quantite_minimum,
      fretReel,
      parametres,
      incoterm: repartition,
      tauxMarge: body.taux_marge ?? null,
    });

    // Garde-fou contre le fret disproportionné.
    //
    // Le plafond de commande minimum ne protège que des montants absolus : il a
    // laissé entrer une lampe achetée 4 002 FCFA avec 52 213 FCFA de fret DHL,
    // vendue 78 701 FCFA. Le client aurait payé 93 % de transport.
    //
    // Les deux conditions sont exigées ensemble, jamais séparément : un rapport
    // élevé sur une petite commande reste acceptable — une pochette bulle a un
    // rapport de 10 et se vend 500 FCFA, personne ne s'en plaint. C'est la
    // conjonction « transport écrasant » et « facture salée » qui est refusée.
    const ratioFret =
      cout.prix_achat_fcfa > 0 ? cout.cout_fret_fcfa / cout.prix_achat_fcfa : Infinity;
    // Ce que le client débourse réellement, transport compris — que celui-ci
    // soit dans le prix ou facturé à part. Juger sur la seule marchandise
    // laisserait passer un article de 3 000 FCFA avec 50 000 FCFA de port.
    const commandeMinimum =
      (cout.prix_unitaire_fcfa + (cout.fret_inclus_dans_prix ? 0 : cout.cout_fret_fcfa)) *
      cout.quantite_minimum;
    const ratioMaximum = Number(parametres.ratio_fret_maximum);
    const seuilSurveille = Number(parametres.seuil_commande_surveillee_fcfa);

    if (ratioFret > ratioMaximum && commandeMinimum > seuilSurveille) {
      console.log(
        JSON.stringify({ requestId, refus: 'fret_disproportionne', ratio: ratioFret, commandeMinimum }),
      );
      return jsonResponse(
        {
          error:
            `Transport disproportionné : ${Math.round(cout.cout_fret_fcfa).toLocaleString('fr-FR')} FCFA de fret ` +
            `pour ${Math.round(cout.prix_achat_fcfa).toLocaleString('fr-FR')} FCFA de marchandise ` +
            `(${ratioFret.toFixed(1)}×), soit une commande minimum de ` +
            `${Math.round(commandeMinimum).toLocaleString('fr-FR')} FCFA. ` +
            `Cet article n'est pas vendable depuis ce fournisseur.`,
          motif: 'fret_disproportionne',
          detail_cout: cout,
        },
        422,
      );
    }

    // Sur l'espace professionnel, un article relève d'une enseigne. Les articles
    // importés par Maylary sont regroupés sous une enseigne maison, créée à la
    // demande dans le secteur choisi : l'administration choisit un rayon, pas
    // une entité à administrer en plus.
    let enseigneId: string | null = null;
    if (espace === 'pro') {
      const { data: existante } = await supabaseService
        .from('app_e08c374bc4_enseignes')
        .select('id')
        .eq('secteur_id', body.secteur_id)
        .eq('nom', ENSEIGNE_MAYLARY)
        .maybeSingle();

      if (existante) {
        enseigneId = existante.id as string;
      } else {
        const { data: creee, error: enseigneError } = await supabaseService
          .from('app_e08c374bc4_enseignes')
          .insert({
            secteur_id: body.secteur_id,
            nom: ENSEIGNE_MAYLARY,
            description_courte:
              'Références sourcées et importées par Maylary, prix dégressifs selon la quantité.',
            ville: 'Abidjan',
            actif: true,
          })
          .select('id')
          .single();
        if (enseigneError || !creee) {
          console.log(JSON.stringify({ requestId, error: enseigneError }));
          return jsonResponse({ error: "Impossible de préparer l'enseigne Maylary." }, 500);
        }
        enseigneId = creee.id as string;
      }
    }

    // 4. Insertion du produit.
    const { data: produit, error: insertError } = await supabaseService
      .from('app_e08c374bc4_produits')
      .insert({
        nom,
        description: body.description ?? null,
        photos: body.photos ?? [],
        prix_achat_fcfa: cout.prix_achat_fcfa,
        prix_unitaire_fcfa: cout.prix_unitaire_fcfa,
        cout_fret_fcfa: cout.cout_fret_fcfa,
        cout_assurance_fcfa: cout.cout_assurance_fcfa,
        incoterm_achat: incotermChoisi,
        fret_source: cout.fret_source,
        fret_transporteur: cout.fret_transporteur,
        quantite_minimum: cout.quantite_minimum,
        // Le délai annoncé par le transporteur devient le délai affiché au client.
        delai_livraison_estime: cout.fret_delai ? `${cout.fret_delai} jours` : null,
        categorie_gp_id: espace === 'grand_public' ? (body.categorie_gp_id ?? null) : null,
        enseigne_id: enseigneId,
        espace,
        stock_disponible: (body.stock ?? 0) > 0 ? 'en_stock' : 'sur_commande',
        actif: true,
        source_donnee: 'import_cj_dropshipping',
        reference_externe,
        reference_variante: referenceVariante,
        poids_unitaire_g: mesures.poids_g,
        volume_unitaire_cm3: mesures.volume_cm3,
        retarife_le: new Date().toISOString(),
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
        taux_marge_applique: cout.taux_marge_applique,
        detail_cout: { ...cout, incoterm: incotermChoisi },
      },
      200,
    );
  } catch (error) {
    console.log(JSON.stringify({ requestId, error: String(error) }));
    return jsonResponse({ error: 'Erreur interne du serveur.' }, 500);
  }
});
