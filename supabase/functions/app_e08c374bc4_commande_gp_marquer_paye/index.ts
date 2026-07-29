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

/**
 * Transition contrôlée côté serveur : le client ne peut pas modifier
 * commandes_gp.statut directement (RLS admin-only), donc cette fonction
 * vérifie la propriété de la commande et n'autorise qu'un seul passage,
 * en_attente_paiement -> paiement_recu_verification, jamais un autre statut.
 */
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

    let body: { commande_id?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corps de requête JSON invalide.' }, 400);
    }

    if (!body.commande_id) {
      return jsonResponse({ error: 'commande_id requis.' }, 400);
    }

    const supabaseService = createClient(supabaseUrl, serviceRoleKey);

    const { data: commande, error: commandeError } = await supabaseService
      .from('app_e08c374bc4_commandes_gp')
      .select('id, user_id, statut, reference_publique, montant_total_fcfa')
      .eq('id', body.commande_id)
      .maybeSingle();

    if (commandeError || !commande) {
      return jsonResponse({ error: 'Commande introuvable.' }, 404);
    }

    if (commande.user_id !== user.id) {
      return jsonResponse({ error: "Cette commande ne vous appartient pas." }, 403);
    }

    if (commande.statut !== 'en_attente_paiement') {
      return jsonResponse(
        { error: 'Cette commande a déjà été marquée comme payée ou a changé de statut.' },
        409,
      );
    }

    const { error: updateError } = await supabaseService
      .from('app_e08c374bc4_commandes_gp')
      .update({ statut: 'paiement_recu_verification' })
      .eq('id', commande.id);

    if (updateError) {
      console.log(JSON.stringify({ requestId, step: 'update_error', error: updateError }));
      return jsonResponse({ error: 'Impossible de mettre à jour la commande.' }, 500);
    }

    await supabaseService.from('app_e08c374bc4_historique_statut_commande_gp').insert({
      commande_id: commande.id,
      statut: 'paiement_recu_verification',
      commentaire_admin: null,
    });

    // Notifie l'admin (best-effort : n'échoue jamais la requête principale
    // si l'email ne part pas). Attendu avant la réponse car Deno peut couper
    // les appels réseau en arrière-plan une fois la réponse envoyée.
    await fetch(`${supabaseUrl}/functions/v1/app_e08c374bc4_admin_notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({
        type: 'commande',
        reference_publique: commande.reference_publique,
        montant_fcfa: commande.montant_total_fcfa,
      }),
    }).catch(() => {});

    console.log(JSON.stringify({ requestId, step: 'ok', commandeId: commande.id }));

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    console.log(JSON.stringify({ requestId, error: String(error) }));
    return jsonResponse({ error: 'Erreur interne du serveur.' }, 500);
  }
});
