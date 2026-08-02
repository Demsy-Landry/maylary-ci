/**
 * Remise de groupage d'un panier.
 *
 * Le prix de chaque article porte le transport de son propre colis : c'est la
 * seule façon d'afficher un prix ferme avant de connaître le panier. Mais un
 * panier de plusieurs références part dans un seul envoi, et la part fixe du
 * colis — mesurée à 1,31 $ chez le fournisseur — n'est due qu'une fois.
 *
 * Cette fonction cote le panier tel qu'il est, compare au transport déjà
 * contenu dans les prix, et rend la différence.
 *
 * Trois règles :
 *
 *  - la remise ne peut jamais être négative. Si le panier groupé revient plus
 *    cher que la somme des articles — poids qui bascule sur un service express,
 *    par exemple — le client garde le prix annoncé. C'est notre affaire, pas
 *    la sienne ;
 *
 *  - elle est calculée ici, jamais par le navigateur. Le client ne choisit pas
 *    la remise qu'il obtient ;
 *
 *  - elle est annoncée avant le paiement. Un montant présenté puis modifié
 *    détruit la confiance, même à la baisse.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCjAccessToken, obtenirFretReelLotCj } from '../_partage/cj-api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

const reponse = (corps: unknown, statut: number) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface CorpsRequete {
  lignes?: { produit_id: string; quantite: number }[];
}

Deno.serve(async (req: Request) => {
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

    let corps: CorpsRequete;
    try {
      corps = await req.json();
    } catch {
      return reponse({ error: 'Corps de requête JSON invalide.' }, 400);
    }
    if (!corps.lignes?.length) return reponse({ error: 'Panier vide.' }, 400);

    const db = createClient(url, service);
    const { data: produits } = await db
      .from('app_e08c374bc4_produits')
      .select('id, nom, reference_variante, cout_fret_fcfa, source_donnee')
      .in(
        'id',
        corps.lignes.map((l) => l.produit_id),
      );

    // Seuls les articles expédiés depuis le fournisseur entrent dans le calcul.
    // Un article local ou d'un vendeur de la place ne voyage pas avec eux.
    const aExpedier: { vid: string; quantite: number }[] = [];
    let fretFactureArticles = 0;

    for (const ligne of corps.lignes) {
      const p = produits?.find((x) => x.id === ligne.produit_id);
      if (!p || p.source_donnee !== 'import_cj_dropshipping') continue;
      const quantite = Math.max(1, Math.round(ligne.quantite));
      fretFactureArticles += Number(p.cout_fret_fcfa ?? 0) * quantite;
      if (p.reference_variante) {
        aExpedier.push({ vid: String(p.reference_variante), quantite });
      }
    }

    // Un seul article, ou aucun : rien n'est facturé en double, il n'y a pas de
    // part fixe à rendre.
    if (aExpedier.length < 2) {
      return reponse(
        { success: true, remise_fcfa: 0, motif: 'panier_mono_colis', articles_groupes: aExpedier.length },
        200,
      );
    }

    const { data: parametres } = await db
      .from('app_e08c374bc4_parametres_import')
      .select('taux_change_usd_fcfa, pays_destination_code')
      .eq('id', 1)
      .maybeSingle();
    if (!parametres) return reponse({ error: 'Paramètres indisponibles.' }, 500);

    const token = await getCjAccessToken();
    if (!token) {
      // Sans devis, on ne remet rien plutôt que d'improviser un rabais : le
      // client paie le prix annoncé, qui reste tenable pour nous.
      return reponse({ success: true, remise_fcfa: 0, motif: 'fournisseur_injoignable' }, 200);
    }

    const fret = await obtenirFretReelLotCj(
      aExpedier,
      token,
      String(parametres.pays_destination_code ?? 'CI'),
    );
    if (!fret) {
      return reponse({ success: true, remise_fcfa: 0, motif: 'fret_non_cote' }, 200);
    }

    const fretReelPanier = Math.round(fret.prix_usd * Number(parametres.taux_change_usd_fcfa));
    const remise = Math.max(0, fretFactureArticles - fretReelPanier);

    console.log(
      JSON.stringify({
        requestId,
        articles: aExpedier.length,
        fretFactureArticles,
        fretReelPanier,
        remise,
      }),
    );

    return reponse(
      {
        success: true,
        remise_fcfa: remise,
        fret_facture_articles_fcfa: fretFactureArticles,
        fret_reel_panier_fcfa: fretReelPanier,
        transporteur: fret.transporteur,
        articles_groupes: aExpedier.length,
      },
      200,
    );
  } catch (erreur) {
    console.log(JSON.stringify({ requestId, erreur: String(erreur) }));
    return reponse({ error: 'Erreur interne du serveur.' }, 500);
  }
});
