/**
 * Disponibilité réelle des produits chez le fournisseur.
 *
 * Deux usages, volontairement distincts :
 *
 *  - `rafraichir` : passe en revue le catalogue par lots et met à jour le stock.
 *    Destiné à une exécution régulière. Le fournisseur plafonne à un appel par
 *    seconde, ce qui interdit d'interroger à chaque affichage de page.
 *
 *  - `verifier` : contrôle immédiatement quelques produits précis. Appelé au
 *    moment du paiement, là où une erreur coûte cher — encaisser puis
 *    rembourser détruit la confiance qu'on met des mois à bâtir.
 *
 * Une disponibilité inconnue n'est jamais traitée comme une rupture : on ne
 * retire pas de la vente un article faute d'avoir pu joindre le fournisseur.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCjAccessToken,
  obtenirDetailProduitCj,
  obtenirStockVariante,
  pause,
} from '../_partage/cj-api.ts';
import { servirAvecCors } from '../_partage/cors.ts';

// Les en-têtes d'autorisation sont posés par `servirAvecCors`, qui
// connaît l'origine de la demande. Ce qui reste ici est écrasé en sortie.
const corsHeaders = {
  'Access-Control-Allow-Headers': '*',
};

const reponse = (corps: unknown, statut: number) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Au-delà, le temps d'exécution dépasse le budget d'une invocation. */
const TAILLE_LOT_MAX = 15;

interface CorpsRequete {
  action?: 'rafraichir' | 'verifier';
  taille_lot?: number;
  /** Pour `verifier` : les produits et les quantités souhaitées. */
  lignes?: { produit_id: string; quantite: number }[];
}

servirAvecCors(async (req: Request) => {
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return reponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const entete = req.headers.get('Authorization');
    if (!entete) return reponse({ error: 'Authentification requise.' }, 401);

    const appelant = createClient(url, anon, { global: { headers: { Authorization: entete } } });
    const {
      data: { user },
    } = await appelant.auth.getUser();
    if (!user) return reponse({ error: 'Session invalide, reconnectez-vous.' }, 401);

    const db = createClient(url, service);

    let corps: CorpsRequete;
    try {
      corps = await req.json();
    } catch {
      return reponse({ error: 'Corps de requête JSON invalide.' }, 400);
    }

    const action = corps.action ?? 'verifier';

    // Le rafraîchissement complet touche tout le catalogue : réservé à l'admin.
    // La vérification porte sur le panier de l'appelant : ouverte à tout client.
    if (action === 'rafraichir') {
      const { data: profil } = await db
        .from('app_e08c374bc4_profiles')
        .select('type_compte')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profil?.type_compte !== 'admin') {
        return reponse({ error: 'Accès réservé aux administrateurs.' }, 403);
      }
    }

    const token = await getCjAccessToken();
    if (!token) return reponse({ error: 'Fournisseur injoignable.' }, 502);

    // ---- Vérification immédiate d'un panier ------------------------------
    if (action === 'verifier') {
      if (!corps.lignes?.length) {
        return reponse({ error: 'Indiquez au moins un produit.' }, 400);
      }

      const { data: produits } = await db
        .from('app_e08c374bc4_produits')
        .select('id, nom, reference_externe, reference_variante')
        .in(
          'id',
          corps.lignes.map((l) => l.produit_id),
        );

      const resultats: Record<string, unknown>[] = [];

      for (const ligne of corps.lignes) {
        const p = produits?.find((x) => x.id === ligne.produit_id);
        if (!p) continue;

        let vid = p.reference_variante as string | null;
        if (!vid && p.reference_externe) {
          const detail = await obtenirDetailProduitCj(String(p.reference_externe), token);
          vid = detail.vid;
          if (vid) await db.from('app_e08c374bc4_produits').update({ reference_variante: vid }).eq('id', p.id);
          await pause(1100);
        }

        const stock = vid ? await obtenirStockVariante(vid, token) : null;
        if (vid) await pause(1100);

        if (stock != null) {
          await db
            .from('app_e08c374bc4_produits')
            .update({ stock_quantite: stock, stock_verifie_le: new Date().toISOString() })
            .eq('id', p.id);
        }

        resultats.push({
          produit_id: p.id,
          nom: p.nom,
          quantite_demandee: ligne.quantite,
          stock_disponible: stock,
          // Une disponibilité inconnue laisse passer : on ne bloque pas une
          // vente parce que le fournisseur n'a pas répondu.
          suffisant: stock == null ? true : stock >= ligne.quantite,
          disponibilite_inconnue: stock == null,
        });
      }

      const insuffisants = resultats.filter((r) => !r.suffisant);
      console.log(JSON.stringify({ requestId, action, lignes: resultats.length, insuffisants: insuffisants.length }));

      return reponse(
        { success: true, tout_disponible: insuffisants.length === 0, lignes: resultats },
        200,
      );
    }

    // ---- Rafraîchissement par lots --------------------------------------
    const tailleLot = Math.min(TAILLE_LOT_MAX, Math.max(1, Math.round(corps.taille_lot ?? TAILLE_LOT_MAX)));

    // On traite d'abord ce qu'on ignore, puis ce qui est le plus ancien : un
    // stock jamais vérifié est plus dangereux qu'un stock vérifié hier.
    const { data: produits } = await db
      .from('app_e08c374bc4_produits')
      .select('id, nom, reference_externe, reference_variante, stock_quantite')
      .eq('source_donnee', 'import_cj_dropshipping')
      .not('reference_externe', 'is', null)
      .order('stock_verifie_le', { ascending: true, nullsFirst: true })
      .limit(tailleLot);

    if (!produits?.length) return reponse({ success: true, traites: [], restants: 0 }, 200);

    const traites: Record<string, unknown>[] = [];

    for (const p of produits) {
      let vid = p.reference_variante as string | null;
      if (!vid && p.reference_externe) {
        const detail = await obtenirDetailProduitCj(String(p.reference_externe), token);
        vid = detail.vid;
        await pause(1100);
      }
      if (!vid) {
        traites.push({ nom: p.nom, stock: null, motif: 'variante_inconnue' });
        continue;
      }

      const stock = await obtenirStockVariante(vid, token);
      await pause(1100);

      const maj: Record<string, unknown> = {
        reference_variante: vid,
        stock_verifie_le: new Date().toISOString(),
      };
      if (stock != null) {
        maj.stock_quantite = stock;
        // Le libellé affiché au client suit la disponibilité constatée.
        maj.stock_disponible = stock > 0 ? 'en_stock' : 'rupture';
      }
      await db.from('app_e08c374bc4_produits').update(maj).eq('id', p.id);

      traites.push({ nom: p.nom, stock, en_rupture: stock === 0 });
    }

    const { count } = await db
      .from('app_e08c374bc4_produits')
      .select('id', { count: 'exact', head: true })
      .eq('source_donnee', 'import_cj_dropshipping')
      .not('reference_externe', 'is', null)
      .is('stock_verifie_le', null);

    console.log(JSON.stringify({ requestId, action, traites: traites.length, jamais_verifies: count ?? 0 }));

    return reponse({ success: true, traites, jamais_verifies: count ?? 0 }, 200);
  } catch (erreur) {
    console.log(JSON.stringify({ requestId, erreur: String(erreur) }));
    return reponse({ error: 'Erreur interne du serveur.' }, 500);
  }
});
