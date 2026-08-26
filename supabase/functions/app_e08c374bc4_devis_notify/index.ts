import { createClient } from "npm:@supabase/supabase-js@2";
import { servirAvecCors } from '../_partage/cors.ts';

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const STATUT_LABELS: Record<string, string> = {
  nouvelle: "Nouvelle demande",
  en_traitement: "En traitement",
  devis_envoye: "Devis envoyé",
  commande_confirmee: "Commande confirmée",
  annulee: "Annulée",
};

const STATUT_MESSAGES: Record<string, string> = {
  nouvelle: "Votre demande de devis a bien été reçue par notre équipe.",
  en_traitement: "Votre demande de devis est en cours de traitement par notre équipe.",
  devis_envoye: "Votre devis est prêt. Notre équipe va vous contacter avec le détail des tarifs.",
  commande_confirmee: "Votre commande a été confirmée. Merci de votre confiance.",
  annulee: "Votre demande de devis a été annulée. Contactez-nous pour plus d'informations.",
};

// Les en-têtes d'autorisation sont posés par `servirAvecCors`, qui
// connaît l'origine de la demande. Ce qui reste ici est écrasé en sortie.
const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

servirAvecCors(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { demande_devis_id } = await req.json();
    if (!demande_devis_id) {
      return new Response(JSON.stringify({ error: "demande_devis_id est requis." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: demande, error: demandeError } = await supabaseAdmin
      .from("app_e08c374bc4_demandes_devis")
      .select("id, statut, reference_publique, user_id, montant_total_estime_fcfa")
      .eq("id", demande_devis_id)
      .maybeSingle();

    if (demandeError || !demande) {
      return new Response(JSON.stringify({ error: "Demande de devis introuvable." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
      demande.user_id,
    );
    if (authError || !authUser?.user?.email) {
      return new Response(JSON.stringify({ error: "Client introuvable." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resendApiKey) {
      // Pas de clé Resend configurée : on considère la notification comme non bloquante.
      return new Response(JSON.stringify({ skipped: true, reason: "RESEND_API_KEY absente" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const statutLabel = STATUT_LABELS[demande.statut] ?? demande.statut;
    const message = STATUT_MESSAGES[demande.statut] ?? "Le statut de votre demande a changé.";

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Maylary <notifications@maylary.ci>",
        to: [authUser.user.email],
        subject: `Maylary — Demande ${demande.reference_publique} : ${statutLabel}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color:#b5451f;">Maylary</h2>
            <p>Bonjour,</p>
            <p>${message}</p>
            <table style="width:100%; border-collapse: collapse; margin-top:16px;">
              <tr><td style="padding:6px 0; color:#666;">Référence</td><td style="padding:6px 0; font-weight:bold;">${demande.reference_publique}</td></tr>
              <tr><td style="padding:6px 0; color:#666;">Statut</td><td style="padding:6px 0; font-weight:bold;">${statutLabel}</td></tr>
              <tr><td style="padding:6px 0; color:#666;">Montant estimé</td><td style="padding:6px 0; font-weight:bold;">${Number(demande.montant_total_estime_fcfa ?? 0).toLocaleString("fr-FR")} FCFA</td></tr>
            </table>
            <p style="margin-top:24px; color:#666; font-size:12px;">Cet email a été envoyé automatiquement par la plateforme Maylary.</p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      return new Response(JSON.stringify({ error: "Échec de l'envoi de l'email.", detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erreur interne.", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
