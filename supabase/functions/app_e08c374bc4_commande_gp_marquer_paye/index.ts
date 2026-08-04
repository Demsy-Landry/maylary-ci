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
 * Déclaration de règlement par le client.
 *
 * Transition contrôlée côté serveur : le client ne peut pas modifier
 * `commandes_gp.statut` directement (RLS admin-only), donc cette fonction
 * vérifie la propriété de la commande et n'autorise qu'un seul passage,
 * en_attente_paiement -> paiement_recu_verification, jamais un autre statut.
 *
 * Trois contrôles, tous imposés par ce qu'un lien de paiement statique ne sait
 * pas faire — il ne fixe ni le montant, ni l'unicité du règlement :
 *
 *  1. la référence de transaction ET le reçu sont exigés, les deux. Wave comme
 *     la banque fournissent l'un et l'autre ; n'en demander qu'un laissait au
 *     client le choix de la pièce la plus facile à inventer ;
 *  2. le montant déclaré doit correspondre au montant dû. Le client saisit
 *     lui-même la somme sur la page de paiement, et un règlement partiel ne se
 *     découvrait qu'à la vérification, commande déjà engagée. Ce contrôle
 *     rattrape l'erreur honnête, pas la fraude : qui veut tricher déclarera le
 *     bon montant. C'est le rapprochement bancaire qui tranche, pas ceci ;
 *  3. une référence ne sert qu'une fois. Un index unique en base refuse le code
 *     d'un règlement déjà passé, quelle que soit sa casse ou ses espaces. Celui-
 *     là est un vrai verrou, pas un garde-fou.
 *
 * Le reçu lui-même n'est pas reçu ici : le client le dépose directement dans un
 * compartiment privé dont la RLS impose que le premier segment du chemin soit
 * son propre identifiant. La fonction ne fait que consigner ce chemin, après
 * l'avoir vérifié — un chemin fabriqué désignerait le reçu d'un autre client.
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

    let body: {
      commande_id?: string;
      canal?: string;
      reference_transaction?: string;
      preuve_chemin?: string;
      montant_declare?: number | string;
    };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corps de requête JSON invalide.' }, 400);
    }

    if (!body.commande_id) {
      return jsonResponse({ error: 'commande_id requis.' }, 400);
    }

    const reference = (body.reference_transaction ?? '').trim();
    const preuve = (body.preuve_chemin ?? '').trim();

    if (!reference) {
      return jsonResponse(
        { error: 'La référence de votre transaction est obligatoire.' },
        400,
      );
    }
    if (!preuve) {
      return jsonResponse(
        { error: 'Le reçu de votre transaction est obligatoire.' },
        400,
      );
    }

    // Un chemin de reçu commence par l'identifiant de son déposant. La RLS du
    // compartiment l'impose déjà à l'écriture ; on le revérifie ici pour qu'un
    // client ne puisse pas rattacher à sa commande le reçu d'un autre.
    if (preuve && !preuve.startsWith(`${user.id}/`)) {
      return jsonResponse({ error: 'Reçu invalide.' }, 400);
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
      return jsonResponse({ error: 'Cette commande ne vous appartient pas.' }, 403);
    }

    if (commande.statut !== 'en_attente_paiement') {
      return jsonResponse(
        { error: 'Cette commande a déjà été marquée comme payée ou a changé de statut.' },
        409,
      );
    }

    // Le montant déclaré doit correspondre à ce qui est dû. La comparaison se
    // fait à l'unité près : en francs CFA il n'y a pas de centimes, un écart
    // d'un franc est une erreur de saisie, pas un arrondi.
    const du = Number(commande.montant_total_fcfa);
    const declare = Number(body.montant_declare);
    if (!Number.isFinite(declare) || declare <= 0) {
      return jsonResponse({ error: 'Indiquez le montant que vous avez réglé.' }, 400);
    }
    if (Math.round(declare) !== Math.round(du)) {
      const ecart = Math.round(du) - Math.round(declare);
      return jsonResponse(
        {
          error:
            ecart > 0
              ? `Le montant réglé ne correspond pas : il manque ${ecart.toLocaleString('fr-FR')} FCFA sur les ${du.toLocaleString('fr-FR')} FCFA dus. Complétez votre règlement, puis déclarez le total.`
              : `Vous avez déclaré ${declare.toLocaleString('fr-FR')} FCFA alors que ${du.toLocaleString('fr-FR')} FCFA sont dus. Vérifiez le montant saisi.`,
        },
        400,
      );
    }

    // Le reçu doit exister réellement : sans ce contrôle, un chemin bien formé
    // mais vide passerait, et la commande porterait une preuve fantôme.
    if (preuve) {
      const dernierSlash = preuve.lastIndexOf('/');
      const { data: fichiers } = await supabaseService.storage
        .from('app_e08c374bc4_preuves_paiement')
        .list(preuve.slice(0, dernierSlash), { search: preuve.slice(dernierSlash + 1) });
      if (!fichiers || fichiers.length === 0) {
        return jsonResponse({ error: "Le reçu n'a pas pu être retrouvé. Réessayez." }, 400);
      }
    }

    const { error: updateError } = await supabaseService
      .from('app_e08c374bc4_commandes_gp')
      .update({
        statut: 'paiement_recu_verification',
        canal_paiement_declare: (body.canal ?? '').trim() || null,
        reference_transaction: reference,
        preuve_paiement_chemin: preuve,
        montant_declare_fcfa: Math.round(declare),
        paiement_declare_le: new Date().toISOString(),
      })
      .eq('id', commande.id);

    if (updateError) {
      console.log(JSON.stringify({ requestId, step: 'update_error', error: updateError }));
      // 23505 : l'index unique a refusé une référence déjà consignée sur une
      // autre commande. C'est le cas que le contrôle existe pour attraper, il
      // mérite donc son propre message plutôt qu'une erreur interne.
      if ((updateError as { code?: string }).code === '23505') {
        return jsonResponse(
          {
            error:
              'Cette référence de transaction a déjà servi pour une autre commande. ' +
              'Vérifiez que vous recopiez bien celle du règlement de cette commande-ci.',
          },
          409,
        );
      }
      return jsonResponse({ error: 'Impossible de mettre à jour la commande.' }, 500);
    }

    await supabaseService.from('app_e08c374bc4_historique_statut_commande_gp').insert({
      commande_id: commande.id,
      statut: 'paiement_recu_verification',
      // Ce que le client a déclaré est repris tel quel dans l'historique : la
      // trace doit rester lisible même si la commande est modifiée ensuite.
      commentaire_admin: [
        (body.canal ?? '').trim() ? `Canal : ${(body.canal ?? '').trim()}` : null,
        `Référence : ${reference}`,
        `Déclaré : ${Math.round(declare).toLocaleString('fr-FR')} FCFA`,
        'Reçu joint',
      ]
        .filter(Boolean)
        .join(' · '),
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
