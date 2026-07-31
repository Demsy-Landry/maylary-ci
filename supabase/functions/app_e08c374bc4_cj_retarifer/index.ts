/**
 * Retarification du catalogue importé.
 *
 * Les produits importés avant la mise en place du modèle de coût portent une
 * marge appliquée au seul prix d'achat : ni le fret ni l'assurance n'y figurent,
 * et ils sont donc vendus en dessous de leur coût de revient. Cette fonction
 * rejoue sur eux exactement la chaîne de coût de l'import (module partagé), en
 * réinterrogeant CJ pour le prix fournisseur du jour et le fret réel.
 *
 * Traitement par lots : CJ plafonne à 1 appel par seconde et chaque produit en
 * demande deux. L'appelant relance tant que `restants` n'est pas nul.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCjAccessToken,
  obtenirDetailProduitCj,
  obtenirFretReelCj,
  pause,
  type FretReel,
} from '../_partage/cj-api.ts';
import { calculerCout, quantiteMinimumPour } from '../_partage/cout-import.ts';

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

/** Au-delà, le temps d'exécution dépasse le budget d'une invocation. */
const TAILLE_LOT_MAX = 6;

interface RetariferBody {
  /** Nombre de produits traités dans cette invocation. */
  taille_lot?: number;
  /** Vrai (défaut) : on calcule et on renvoie l'impact sans rien écrire. */
  simulation?: boolean;
  /** Restreint le traitement à ces produits ; sinon, tous les produits importés. */
  produit_ids?: string[];
}

interface LigneResultat {
  id: string;
  nom: string;
  ancien_prix_fcfa: number;
  nouveau_prix_fcfa: number;
  prix_achat_fcfa: number;
  cout_fret_fcfa: number;
  cout_assurance_fcfa: number;
  cout_revient_fcfa: number;
  quantite_minimum: number;
  fret_source: string;
  /** Vrai si l'ancien prix était inférieur au coût de revient : vente à perte. */
  vendait_a_perte: boolean;
  prix_achat_rafraichi: boolean;
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Authentification requise.' }, 401);

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

    let body: RetariferBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corps de requête JSON invalide.' }, 400);
    }

    const simulation = body.simulation !== false;
    const tailleLot = Math.min(
      TAILLE_LOT_MAX,
      Math.max(1, Math.round(body.taille_lot ?? TAILLE_LOT_MAX)),
    );

    const { data: parametres } = await supabaseService
      .from('app_e08c374bc4_parametres_import')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (!parametres) {
      return jsonResponse({ error: 'Impossible de lire les paramètres de marge.' }, 500);
    }

    const incotermChoisi = parametres.incoterm_achat_defaut;
    const { data: repartition } = await supabaseService
      .from('app_e08c374bc4_parametres_incoterm')
      .select('incoterm, part_fret, assurance_a_charge')
      .eq('incoterm', incotermChoisi)
      .maybeSingle();
    if (!repartition) {
      return jsonResponse({ error: `Incoterm inconnu : ${incotermChoisi}.` }, 400);
    }

    // Sélection des produits à traiter. En simulation, on les reprend tous à
    // chaque appel ; en application, `retarife_le` marque ceux qui sont faits,
    // ce qui rend la reprise après interruption naturelle.
    let requete = supabaseService
      .from('app_e08c374bc4_produits')
      .select('id, nom, prix_achat_fcfa, prix_unitaire_fcfa, retarife_le')
      .eq('source_donnee', 'import_cj_dropshipping')
      .not('reference_externe', 'is', null)
      .order('prix_achat_fcfa', { ascending: true });

    if (body.produit_ids?.length) {
      requete = requete.in('id', body.produit_ids);
    }
    if (!simulation) {
      requete = requete.is('retarife_le', null);
    }

    const { data: produits, error: produitsError } = await requete;
    if (produitsError || !produits) {
      console.log(JSON.stringify({ requestId, error: produitsError }));
      return jsonResponse({ error: 'Impossible de lire le catalogue.' }, 500);
    }

    const aTraiter = produits.slice(0, tailleLot);
    const restants = Math.max(0, produits.length - aTraiter.length);

    if (aTraiter.length === 0) {
      return jsonResponse({ success: true, simulation, resultats: [], restants: 0 }, 200);
    }

    const token = parametres.utiliser_fret_reel_cj ? await getCjAccessToken() : null;
    const resultats: LigneResultat[] = [];

    for (const produit of aTraiter) {
      // Chaque produit est retraité en repartant de sa référence CJ : le prix
      // fournisseur a pu bouger depuis l'import.
      const { data: fiche } = await supabaseService
        .from('app_e08c374bc4_produits')
        .select('reference_externe')
        .eq('id', produit.id)
        .single();

      let prixAchatFcfa = Number(produit.prix_achat_fcfa ?? 0);
      let prixAchatRafraichi = false;
      let vid: string | null = null;

      if (token && fiche?.reference_externe) {
        const detail = await obtenirDetailProduitCj(String(fiche.reference_externe), token);
        vid = detail.vid;
        if (detail.prix_usd) {
          prixAchatFcfa = Math.round(detail.prix_usd * Number(parametres.taux_change_usd_fcfa));
          prixAchatRafraichi = true;
        }
        await pause(1100);
      }

      if (prixAchatFcfa <= 0) {
        console.log(JSON.stringify({ requestId, produitId: produit.id, step: 'prix_achat_absent' }));
        continue;
      }

      const quantiteMinimum = quantiteMinimumPour(prixAchatFcfa, parametres);

      let fretReel: FretReel | null = null;
      if (token && vid) {
        fretReel = await obtenirFretReelCj(
          vid,
          token,
          String(parametres.pays_destination_code),
          quantiteMinimum,
        );
        await pause(1100);
      }

      const cout = calculerCout({
        prixAchatFcfa,
        quantiteMinimum,
        fretReel,
        parametres,
        incoterm: repartition,
      });

      resultats.push({
        id: produit.id,
        nom: produit.nom,
        ancien_prix_fcfa: Number(produit.prix_unitaire_fcfa),
        nouveau_prix_fcfa: cout.prix_unitaire_fcfa,
        prix_achat_fcfa: cout.prix_achat_fcfa,
        cout_fret_fcfa: cout.cout_fret_fcfa,
        cout_assurance_fcfa: cout.cout_assurance_fcfa,
        cout_revient_fcfa: cout.cout_revient_fcfa,
        quantite_minimum: cout.quantite_minimum,
        fret_source: cout.fret_source,
        vendait_a_perte: Number(produit.prix_unitaire_fcfa) < cout.cout_revient_fcfa,
        prix_achat_rafraichi: prixAchatRafraichi,
      });

      if (!simulation) {
        const { error: updateError } = await supabaseService
          .from('app_e08c374bc4_produits')
          .update({
            prix_achat_fcfa: cout.prix_achat_fcfa,
            prix_unitaire_fcfa: cout.prix_unitaire_fcfa,
            cout_fret_fcfa: cout.cout_fret_fcfa,
            cout_assurance_fcfa: cout.cout_assurance_fcfa,
            incoterm_achat: incotermChoisi,
            fret_source: cout.fret_source,
            fret_transporteur: cout.fret_transporteur,
            quantite_minimum: cout.quantite_minimum,
            delai_livraison_estime: cout.fret_delai ? `${cout.fret_delai} jours` : null,
            retarife_le: new Date().toISOString(),
          })
          .eq('id', produit.id);

        if (updateError) {
          console.log(JSON.stringify({ requestId, produitId: produit.id, error: updateError }));
          return jsonResponse({ error: `Échec de la mise à jour de « ${produit.nom} ».` }, 500);
        }
      }
    }

    console.log(
      JSON.stringify({ requestId, step: 'retarifer', simulation, traites: resultats.length, restants }),
    );

    return jsonResponse({ success: true, simulation, resultats, restants }, 200);
  } catch (error) {
    console.log(JSON.stringify({ requestId, error: String(error) }));
    return jsonResponse({ error: 'Erreur interne du serveur.' }, 500);
  }
});
