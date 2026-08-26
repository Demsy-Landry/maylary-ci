/**
 * Transport d'un panier : offres du fournisseur, refus, et remise de groupage.
 *
 * Le prix affiché d'un article ne porte plus le transport : celui-ci est coté
 * ici, sur le panier réel, et facturé en ligne séparée. Personne ne porte plus
 * le risque d'une estimation, et le client voit où va son argent.
 *
 * Cette fonction en tire trois choses.
 *
 * 1. Les offres du transporteur, toutes, avec leur délai. Retenir d'office la
 *    moins chère convient pour bâtir un prix de vente, pas pour servir un
 *    client : sur un même colis l'écart mesuré va de 11,04 $ en 20-60 jours à
 *    85,41 $ en 3-7 jours. Cet arbitrage appartient à celui qui paie.
 *
 * 2. Le refus. Quand le fournisseur répond mais qu'aucun transporteur n'accepte
 *    la combinaison — un liquide mêlé à un colis sec suffit — le panier n'est
 *    pas expédiable. On le dit avant le paiement, et on nomme l'article en
 *    cause : découvrir cela après encaissement obligerait à revenir sur un prix
 *    déjà payé.
 *
 * 3. La remise de groupage, si l'ancien modèle est rétabli. Quand les prix
 *    portent le transport d'un colis chacun, un panier de plusieurs références
 *    facture plusieurs fois une part fixe qui n'est due qu'une fois — mesurée
 *    à 1,31 $ chez le fournisseur. Elle ne peut jamais être négative : si le
 *    groupage revient plus cher, le client garde le prix annoncé.
 *
 * Tout est annoncé avant le paiement. Un montant présenté puis modifié détruit
 * la confiance, même à la baisse.
 */import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCjAccessToken, obtenirOptionsFretLotCj, pause } from '../_partage/cj-api.ts';
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

interface CorpsRequete {
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
    const aExpedier: { vid: string; quantite: number; nom: string }[] = [];
    let fretFactureArticles = 0;

    for (const ligne of corps.lignes) {
      const p = produits?.find((x) => x.id === ligne.produit_id);
      if (!p || p.source_donnee !== 'import_cj_dropshipping') continue;
      const quantite = Math.max(1, Math.round(ligne.quantite));
      fretFactureArticles += Number(p.cout_fret_fcfa ?? 0) * quantite;
      if (p.reference_variante) {
        aExpedier.push({ vid: String(p.reference_variante), quantite, nom: String(p.nom ?? '') });
      }
    }

    // Aucun article expédié depuis le fournisseur : rien à coter.
    if (aExpedier.length === 0) {
      return reponse(
        { success: true, remise_fcfa: 0, motif: 'aucun_article_fournisseur', options: [], articles_groupes: 0 },
        200,
      );
    }

    const { data: parametres } = await db
      .from('app_e08c374bc4_parametres_import')
      .select('taux_change_usd_fcfa, pays_destination_code, fret_inclus_dans_prix, taux_marge_fret')
      .eq('id', 1)
      .maybeSingle();
    if (!parametres) return reponse({ error: 'Paramètres indisponibles.' }, 500);

    const token = await getCjAccessToken();
    if (!token) {
      // Sans devis, on ne remet rien plutôt que d'improviser un rabais : le
      // client paie le prix annoncé, qui reste tenable pour nous. On ne bloque
      // pas la vente pour autant — un fournisseur qui ne répond pas est notre
      // problème, pas celui du client.
      return reponse(
        { success: true, expediable: true, remise_fcfa: 0, options: [], motif: 'fournisseur_injoignable' },
        200,
      );
    }

    const pays = String(parametres.pays_destination_code ?? 'CI');
    const taux = Number(parametres.taux_change_usd_fcfa);
    // Le transport est répercuté à prix coûtant tant que la marge sur fret reste
    // à zéro. Ce n'est pas une générosité : c'est ce qui rend la ligne
    // vérifiable par le client, et ce qui nous décharge du risque d'estimation.
    const margeFret = Number(parametres.taux_marge_fret ?? 0);
    const fretInclusDansPrix = parametres.fret_inclus_dans_prix !== false;
    const enFcfa = (usd: number) => Math.round(usd * taux * (1 + margeFret));

    const options = await obtenirOptionsFretLotCj(aExpedier, token, pays);

    // Aucune option n'est un refus explicite, pas une panne : le fournisseur a
    // répondu, mais aucun transporteur n'accepte ce mélange de marchandises.
    // Un liquide glissé dans un colis sec suffit à le provoquer.
    //
    // On ne laisse surtout pas passer : la commande serait payée puis
    // intransmissible, et il faudrait revenir sur un prix déjà encaissé. On
    // cherche donc quelle ligne bloque, en cotant chacune seule, pour pouvoir
    // le dire au client au lieu de lui opposer un échec sans explication.
    if (options.length === 0) {
      const acceptes: string[] = [];
      const refuses: string[] = [];
      for (const article of aExpedier) {
        const seul = await obtenirOptionsFretLotCj(
          [{ vid: article.vid, quantite: article.quantite }],
          token,
          pays,
        );
        (seul.length > 0 ? acceptes : refuses).push(article.nom);
        await pause(1100);
      }

      // Chaque article passe seul mais pas ensemble : c'est la combinaison qui
      // est en cause, aucun article n'est fautif à lui seul.
      const incompatibles = refuses.length > 0 ? refuses : acceptes;

      console.log(JSON.stringify({ requestId, blocage: 'panier_non_expediable', refuses, acceptes }));
      return reponse(
        {
          success: true,
          expediable: false,
          motif: refuses.length > 0 ? 'article_non_expediable' : 'combinaison_non_expediable',
          articles_en_cause: incompatibles,
          remise_fcfa: 0,
          options: [],
          articles_groupes: aExpedier.length,
        },
        200,
      );
    }

    const economique = options[0];
    const fretReelPanier = enFcfa(economique.prix_usd);

    // Deux façons de facturer le transport, selon le réglage.
    //
    // Séparé — le prix des articles ne le porte pas : chaque offre se paie en
    // entier, et il n'y a plus rien à rendre puisque rien n'a été facturé
    // d'avance. C'est le modèle en vigueur.
    //
    // Compris — l'ancien modèle : les prix portaient le transport d'un colis
    // chacun, on rendait la part comptée en double et les offres plus rapides
    // se payaient en supplément. Conservé pour qu'un retour en arrière reste
    // possible sans redéploiement.
    const remise =
      fretInclusDansPrix && aExpedier.length >= 2
        ? Math.max(0, fretFactureArticles - fretReelPanier)
        : 0;

    const optionsClient = options.map((o, i) => {
      const prix = enFcfa(o.prix_usd);
      return {
        transporteur: o.transporteur,
        delai: o.delai,
        prix_fcfa: prix,
        // Ce que cette offre ajoute au total, une fois la remise déduite.
        supplement_fcfa: fretInclusDansPrix ? Math.max(0, prix - fretReelPanier) : prix,
        economique: i === 0,
      };
    });

    console.log(
      JSON.stringify({
        requestId,
        articles: aExpedier.length,
        fretFactureArticles,
        fretReelPanier,
        remise,
        fretInclusDansPrix,
        options: optionsClient.length,
      }),
    );

    return reponse(
      {
        success: true,
        expediable: true,
        remise_fcfa: remise,
        fret_facture_articles_fcfa: fretFactureArticles,
        fret_reel_panier_fcfa: fretReelPanier,
        transporteur: economique.transporteur,
        options: optionsClient,
        fret_inclus_dans_prix: fretInclusDansPrix,
        articles_groupes: aExpedier.length,
      },
      200,
    );
  } catch (erreur) {
    console.log(JSON.stringify({ requestId, erreur: String(erreur) }));
    return reponse({ error: 'Erreur interne du serveur.' }, 500);
  }
});
