import { createClient } from "npm:@supabase/supabase-js@2";
import { servirAvecCors } from '../_partage/cors.ts';

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Les en-têtes d'autorisation sont posés par `servirAvecCors`, qui
// connaît l'origine de la demande. Ce qui reste ici est écrasé en sortie.
const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

servirAvecCors(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    const nom_complet = String(body.nom_complet ?? "").trim();
    const nom_entreprise = String(body.nom_entreprise ?? "").trim();
    const secteur_activite_client = String(body.secteur_activite_client ?? "").trim();
    const telephone = String(body.telephone ?? "").trim();
    const ville = String(body.ville ?? "").trim();
    const type_compte = body.type_compte === "particulier" ? "particulier" : "entreprise_acheteuse";

    if (!email || !isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "Adresse email invalide." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Le mot de passe doit contenir au moins 8 caractères." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!nom_complet) {
      return new Response(
        JSON.stringify({ error: "Le nom complet est obligatoire." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (type_compte === "entreprise_acheteuse" && !nom_entreprise) {
      return new Response(
        JSON.stringify({ error: "Le nom de l'entreprise est obligatoire pour un compte professionnel." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !created?.user) {
      const message = createError?.message?.includes("already been registered")
        ? "Un compte existe déjà avec cet email."
        : "Impossible de créer le compte. Veuillez réessayer.";
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: profileError } = await supabaseAdmin.from("app_e08c374bc4_profiles").insert({
      user_id: created.user.id,
      type_compte,
      nom_complet,
      nom_entreprise: type_compte === "entreprise_acheteuse" ? nom_entreprise : null,
      secteur_activite_client: secteur_activite_client || null,
      telephone: telephone || null,
      ville: ville || null,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: "Impossible de créer le profil." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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
