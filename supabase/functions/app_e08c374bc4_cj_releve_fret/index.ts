/**
 * Relevé du fret par quantité : interroger le transporteur pour de vrai.
 *
 * POURQUOI CETTE FONCTION EXISTE
 *
 * On soupçonne que le prix rendu par pièce REMONTE quand la quantité augmente,
 * ce qui est exactement l'inverse de ce qu'attend un revendeur. Le catalogue
 * ne permet pas de le vérifier : huit articles seulement portent plus d'un
 * palier. Huit articles ne prouvent rien.
 *
 * Cette fonction va donc chercher la réponse à la source : pour un même
 * article, elle demande un devis à 1, 10, 50 et 200 pièces, et consigne tout ce
 * que le transporteur a répondu — y compris le nombre d'offres et la présence
 * de l'offre lente. C'est cette dernière qui est en cause : au-delà d'un
 * certain poids elle disparaît, et « la moins chère » devient l'express.
 *
 * Les quantités relevées sont celles de la grille de remise. Mesurer ailleurs
 * qu'aux seuils où le prix change n'aurait rien dit d'utile.
 *
 * Elle N'ÉCRIT RIEN sur les produits. C'est un instrument de mesure : il
 * observe, il ne corrige pas. La correction se fait ailleurs, et se vérifie en
 * comparant deux relevés.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCjAccessToken, obtenirOptionsFretLotCj, pause } from '../_partage/cj-api.ts';
import { servirAvecCors } from '../_partage/cors.ts';

const corsHeaders = { 'Access-Control-Allow-Headers': '*' };

const reponse = (corps: unknown, statut: number) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Les seuils de la grille de remise : c'est là que le prix est censé baisser. */
const QUANTITES_PAR_DEFAUT = [1, 10, 50, 200];

/**
 * À partir de combien de jours une offre est « lente », donc économique.
 *
 * Le transporteur annonce ses délais sous la forme « 3-7 » ou « 20-60 ». On
 * retient la borne HAUTE : c'est celle que le client subit, et c'est elle qui
 * distingue un envoi économique d'un express.
 */
const SEUIL_JOURS_OFFRE_LENTE = 15;

function borneHauteDuDelai(delai: string | null): number | null {
  if (!delai) return null;
  const nombres = delai.match(/\d+/g);
  if (!nombres || nombres.length === 0) return null;
  return Math.max(...nombres.map(Number));
}

const estOffreLente = (delai: string | null): boolean => {
  const jours = borneHauteDuDelai(delai);
  // Un délai que le transporteur n'annonce pas ne peut pas être présumé lent :
  // le présumer ferait retenir un express au tarif d'un économique.
  return jours !== null && jours >= SEUIL_JOURS_OFFRE_LENTE;
};

interface CorpsRequete {
  espace?: 'grand_public' | 'pro';
  limite?: number;
  quantites?: number[];
  /** Rejoint un relevé déjà commencé, pour le poursuivre par lots. */
  releve_id?: string;
}

servirAvecCors(async (req: Request) => {
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return reponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(url, service);

    let corps: CorpsRequete;
    try {
      corps = await req.json();
    } catch {
      corps = {};
    }

    const quantites = (corps.quantites?.length ? corps.quantites : QUANTITES_PAR_DEFAUT)
      .map((q) => Math.max(1, Math.round(q)))
      .sort((a, b) => a - b);
    // Chaque article consomme un appel par quantité, à un appel par seconde —
    // et jusqu'à deux quand la seconde chance se déclenche. Au-delà, le relevé
    // dépasse le budget d'une invocation.
    const limite = Math.min(4, Math.max(1, Math.round(corps.limite ?? 3)));
    const releveId = corps.releve_id ?? crypto.randomUUID();

    const { data: parametres } = await db
      .from('app_e08c374bc4_parametres_import')
      .select('taux_change_usd_fcfa, pays_destination_code')
      .eq('id', 1)
      .maybeSingle();
    if (!parametres) return reponse({ error: 'Paramètres indisponibles.' }, 500);

    const taux = Number(parametres.taux_change_usd_fcfa);
    const pays = String(parametres.pays_destination_code ?? 'CI');

    // Seuls les articles que le transporteur cote peuvent être relevés : sur un
    // article en groupage il n'a par définition aucune offre à donner.
    let requete = db
      .from('app_e08c374bc4_produits')
      .select('id, nom, espace, reference_variante')
      .eq('actif', true)
      .eq('mode_acheminement', 'cj_ddp')
      .eq('source_donnee', 'import_cj_dropshipping')
      .not('reference_variante', 'is', null);
    if (corps.espace) requete = requete.eq('espace', corps.espace);

    // On ne reprend pas un article déjà relevé dans cette campagne : c'est ce
    // qui rend la fonction rejouable par lots sans refaire le même appel.
    const { data: dejaFaits } = await db
      .from('app_e08c374bc4_releve_fret')
      .select('produit_id')
      .eq('releve_id', releveId);
    const vus = new Set((dejaFaits ?? []).map((l) => String(l.produit_id)));

    const { data: candidats } = await requete.order('nom').limit(limite + vus.size);
    const produits = (candidats ?? []).filter((p) => !vus.has(String(p.id))).slice(0, limite);

    const lignes: Record<string, unknown>[] = [];
    const token = await getCjAccessToken();
    if (!token) return reponse({ error: 'Fournisseur injoignable.' }, 502);

    /**
     * Une liste vide a DEUX causes, et les confondre ruine la mesure.
     *
     *  - un refus réel : aucun transporteur ne prend cette marchandise à cette
     *    quantité. C'est un résultat, et il compte ;
     *  - un appel refusé par le fournisseur, qui plafonne à un appel par
     *    seconde. La bibliothèque avale l'erreur et rend une liste vide, en
     *    tout point identique à un refus.
     *
     * Mesuré le 2 septembre : deux relevés lancés en parallèle ont produit huit
     * fausses « absences d'offre » sur quarante-quatre lignes, soit près d'une
     * sur cinq. On ne bâtit pas une démonstration là-dessus.
     *
     * On redemande donc une fois, après une pause plus longue. Une deuxième
     * réponse vide au calme est un refus ; la première pouvait n'être qu'un
     * appel de trop.
     */
    const coterAvecSecondeChance = async (quantite: number, vid: string) => {
      const premiere = await obtenirOptionsFretLotCj([{ vid, quantite }], token, pays);
      await pause(1100);
      if (premiere.length > 0) return premiere;

      await pause(3000);
      const seconde = await obtenirOptionsFretLotCj([{ vid, quantite }], token, pays);
      await pause(1100);
      return seconde;
    };

    for (const p of produits) {
      for (const quantite of quantites) {
        const options = await coterAvecSecondeChance(quantite, String(p.reference_variante));

        // `obtenirOptionsFretLotCj` rend la liste triée du moins cher au plus
        // cher : la première est donc celle que le calcul retient aujourd'hui.
        const retenue = options[0] ?? null;
        const lentes = options.filter((o) => estOffreLente(o.delai));
        const meilleureLente = lentes[0] ?? null;

        const parPiece = (usd: number) => Math.round((usd * taux) / quantite);

        lignes.push({
          releve_id: releveId,
          produit_id: p.id,
          espace: p.espace,
          quantite,
          fret_lot_usd: retenue?.prix_usd ?? null,
          fret_unitaire_fcfa: retenue ? parPiece(retenue.prix_usd) : null,
          transporteur: retenue?.transporteur ?? null,
          delai: retenue?.delai ?? null,
          options_total: options.length,
          option_lente_disponible: options.length > 0 ? lentes.length > 0 : null,
          fret_unitaire_lent_fcfa: meilleureLente ? parPiece(meilleureLente.prix_usd) : null,
        });
      }
    }

    if (lignes.length > 0) {
      await db.from('app_e08c374bc4_releve_fret').upsert(lignes, {
        onConflict: 'releve_id,produit_id,quantite',
      });
    }

    console.log(
      JSON.stringify({
        requestId,
        releveId,
        produits: produits.length,
        quantites,
        lignes: lignes.length,
      }),
    );

    return reponse(
      {
        success: true,
        releve_id: releveId,
        produits_releves: produits.length,
        lignes_ecrites: lignes.length,
        quantites,
      },
      200,
    );
  } catch (erreur) {
    console.log(JSON.stringify({ requestId, erreur: String(erreur) }));
    return reponse({ error: 'Erreur interne du serveur.' }, 500);
  }
});
