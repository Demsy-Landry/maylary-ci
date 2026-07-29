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

// Tant que le domaine maylary.ci n'est pas vérifié sur resend.com/domains,
// Resend refuse TOUT l'envoi (pas juste le destinataire invalide) dès qu'un
// destinataire autre que l'adresse du compte Resend est présent. On tente
// donc d'abord la vraie liste des admins, et si Resend la refuse pour cette
// raison précise, on retombe sur cette seule adresse (propriétaire du compte)
// pour garantir la livraison. Une fois le domaine vérifié, le premier essai
// suffira et ce repli ne servira plus jamais.
const RESEND_SANDBOX_FALLBACK = 'yaolandry67@gmail.com';

const SUJETS: Record<string, (ref: string) => string> = {
  devis: (ref) => `Maylary — Nouvelle demande de devis ${ref}`,
  commande: (ref) => `Maylary — Paiement à vérifier : commande ${ref}`,
  import: (ref) => `Maylary Import — Nouvelle demande à coter : ${ref}`,
  import_valide: (ref) => `Maylary Import — Devis validé par le client : ${ref}`,
  export: (ref) => `Maylary Export — Nouvelle demande à coter : ${ref}`,
  export_valide: (ref) => `Maylary Export — Devis validé par le client : ${ref}`,
};

const LIENS: Record<string, string> = {
  devis: 'https://maylary-ci.vercel.app/admin/devis',
  commande: 'https://maylary-ci.vercel.app/admin/commandes',
  import: 'https://maylary-ci.vercel.app/admin/import',
  import_valide: 'https://maylary-ci.vercel.app/admin/import',
  export: 'https://maylary-ci.vercel.app/admin/export',
  export_valide: 'https://maylary-ci.vercel.app/admin/export',
};

const MESSAGES: Record<string, string> = {
  devis: 'Nouvelle demande de devis à traiter.',
  commande: 'Un client indique avoir payé, vérification requise.',
  import: "Nouvelle demande d'import à coter (marchandise, fret, douane, transit).",
  import_valide: "Le client a validé le devis — vous pouvez lancer l'achat et le transit.",
  export: "Nouvelle demande d'export à coter (transport local, douane export, fret, certifications).",
  export_valide: "Le client a validé le devis — vous pouvez lancer la collecte et l'export.",
};

Deno.serve(async (req: Request) => {
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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

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
      return jsonResponse({ error: 'Session invalide.' }, 401);
    }

    let body: { type?: string; reference_publique?: string; montant_fcfa?: number };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corps de requête JSON invalide.' }, 400);
    }

    if (!body.type || !SUJETS[body.type] || !body.reference_publique) {
      return jsonResponse({ error: 'type et reference_publique requis.' }, 400);
    }

    if (!resendApiKey) {
      return jsonResponse({ skipped: true, reason: 'RESEND_API_KEY absente' }, 200);
    }

    const supabaseService = createClient(supabaseUrl, serviceRoleKey);
    const { data: admins } = await supabaseService
      .from('app_e08c374bc4_profiles')
      .select('user_id')
      .eq('type_compte', 'admin');

    const emails = new Set<string>();
    for (const a of admins ?? []) {
      const { data: authUser } = await supabaseService.auth.admin.getUserById(a.user_id);
      if (authUser?.user?.email) emails.add(authUser.user.email);
    }
    if (emails.size === 0) emails.add(RESEND_SANDBOX_FALLBACK);

    const montant =
      typeof body.montant_fcfa === 'number' ? `${body.montant_fcfa.toLocaleString('fr-FR')} FCFA` : null;

    const buildPayload = (to: string[]) => ({
      from: 'Maylary <onboarding@resend.dev>',
      to,
      subject: SUJETS[body.type as string](body.reference_publique as string),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#b5451f;">Maylary</h2>
          <p>${MESSAGES[body.type as string]}</p>
          <table style="width:100%; border-collapse: collapse; margin-top:16px;">
            <tr><td style="padding:6px 0; color:#666;">Référence</td><td style="padding:6px 0; font-weight:bold;">${body.reference_publique}</td></tr>
            ${montant ? `<tr><td style="padding:6px 0; color:#666;">Montant</td><td style="padding:6px 0; font-weight:bold;">${montant}</td></tr>` : ''}
          </table>
          <p style="margin-top:20px;"><a href="${LIENS[body.type as string]}" style="color:#b5451f;">Ouvrir dans l'admin Maylary →</a></p>
        </div>
      `,
    });

    const sendTo = async (to: string[]) =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(to)),
      });

    let emailRes = await sendTo([...emails]);

    if (!emailRes.ok) {
      const firstErr = await emailRes.json().catch(() => null);
      const isSandboxRestriction =
        emailRes.status === 403 &&
        typeof firstErr?.message === 'string' &&
        firstErr.message.includes('own email address');

      if (isSandboxRestriction && !emails.has(RESEND_SANDBOX_FALLBACK)) {
        emailRes = await sendTo([RESEND_SANDBOX_FALLBACK]);
      } else {
        return jsonResponse({ error: 'Échec de l’envoi.', detail: firstErr }, 502);
      }
    }

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      return jsonResponse({ error: 'Échec de l’envoi.', detail: errText }, 502);
    }

    return jsonResponse({ sent: true }, 200);
  } catch (error) {
    return jsonResponse({ error: 'Erreur interne du serveur.', detail: String(error) }, 500);
  }
});
