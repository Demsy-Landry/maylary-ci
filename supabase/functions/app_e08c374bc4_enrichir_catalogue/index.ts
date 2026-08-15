/**
 * Remplir les fiches produit avec ce que le fournisseur donne déjà.
 *
 * Constat de départ : 94 articles sur 94 n'avaient AUCUNE description. Pas
 * « une description courte » — aucune. Or l'appel `product/query` de CJ rend,
 * pour chaque référence, deux à trois mille caractères de description, la
 * matière, l'emballage et le poids net. Tout cela était jeté à l'import.
 *
 * POURQUOI CE TRAVAIL EST ICI ET PAS DANS LA BASE
 *
 * J'ai d'abord essayé depuis PostgreSQL avec pg_net. Ça ne peut pas marcher :
 * CJ plafonne à UNE requête par seconde, et pg_net se contente de mettre en
 * file — un travailleur d'arrière-plan la vide par rafales, sans considération
 * pour les pauses demandées. Mesuré : douze requêtes espacées d'une seconde et
 * demie, onze refusées en 429. Même à quatre secondes d'écart, deux sur trois
 * échouaient.
 *
 * Ici, en Deno, l'attente est réelle : on envoie, on attend, on envoie. C'est
 * le même `pause(1100)` que l'import unitaire utilise déjà.
 *
 * Le traitement lui-même — nettoyage du texte, traduction du vocabulaire,
 * écriture — reste en base, dans `app_e08c374bc4_enrichir_produit`. Cette
 * fonction ne fait que le va-et-vient réseau : elle ne décide rien.
 */
import { getCjAccessToken, pause } from '../_partage/cj-api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

const json = (corps: unknown, statut: number) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? '';
const CLE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** Lecture et écriture avec la clé de service : cette fonction touche au
 *  catalogue entier, ce que personne d'autre qu'elle ne doit pouvoir faire. */
async function sql(chemin: string, options: RequestInit = {}) {
  return fetch(`${URL_SUPABASE}/rest/v1/${chemin}`, {
    ...options,
    headers: {
      apikey: CLE_SERVICE,
      Authorization: `Bearer ${CLE_SERVICE}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Seul un administrateur déclenche un parcours du catalogue : c'est long, ça
  // consomme le quota du fournisseur, et ça réécrit des fiches.
  const autorisation = req.headers.get('Authorization') ?? '';
  const verif = await fetch(`${URL_SUPABASE}/rest/v1/rpc/app_e08c374bc4_is_admin`, {
    method: 'POST',
    headers: {
      apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      Authorization: autorisation,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!verif.ok || (await verif.json()) !== true) {
    return json({ erreur: "Réservé à l'administration." }, 403);
  }

  let limite = 40;
  try {
    const corps = await req.json();
    const n = Number(corps?.limite);
    // Borné : au-delà, la fonction dépasse son temps d'exécution et on perd
    // tout le lot. Mieux vaut plusieurs passages courts qu'un long qui échoue.
    if (Number.isFinite(n) && n > 0) limite = Math.min(Math.floor(n), 60);
  } catch {
    // Corps absent : on garde la valeur par défaut.
  }

  const jeton = await getCjAccessToken();
  if (!jeton) return json({ erreur: 'Fournisseur injoignable.' }, 502);

  // On ne reprend que ce qui n'a jamais été enrichi : la fonction est ainsi
  // rejouable autant de fois qu'il faut, sans refaire le travail déjà fait.
  const r = await sql(
    'app_e08c374bc4_produits?select=id,reference_externe&reference_externe=not.is.null&enrichi_le=is.null&limit=' +
      limite,
  );
  const articles = (await r.json()) as { id: string; reference_externe: string }[];

  let enrichis = 0;
  let echecs = 0;

  for (const [i, a] of articles.entries()) {
    try {
      const url = new URL('https://developers.cjdropshipping.com/api2.0/v1/product/query');
      url.searchParams.set('pid', a.reference_externe);
      const reponse = await fetch(url, { headers: { 'CJ-Access-Token': jeton } });
      const detail = await reponse.json().catch(() => null);

      if (detail?.data) {
        await sql('rpc/app_e08c374bc4_enrichir_produit', {
          method: 'POST',
          body: JSON.stringify({ p_id: a.id, p_donnees: detail.data }),
        });
        enrichis += 1;
      } else {
        echecs += 1;
      }
    } catch {
      echecs += 1;
    }

    // La pause qui rend tout ceci possible. Pas après la dernière : elle ne
    // servirait qu'à retarder la réponse.
    if (i < articles.length - 1) await pause(1200);
  }

  const reste = await sql(
    'app_e08c374bc4_produits?select=id&reference_externe=not.is.null&enrichi_le=is.null',
    { headers: { Prefer: 'count=exact' } },
  );
  const restant = reste.headers.get('content-range')?.split('/')[1] ?? '?';

  return json(
    {
      success: true,
      enrichis,
      echecs,
      restant: Number(restant) || 0,
      message:
        Number(restant) > 0
          ? `${enrichis} fiche(s) complétée(s). Il en reste ${restant} : relancez.`
          : `${enrichis} fiche(s) complétée(s). Le catalogue entier est couvert.`,
    },
    200,
  );
});
