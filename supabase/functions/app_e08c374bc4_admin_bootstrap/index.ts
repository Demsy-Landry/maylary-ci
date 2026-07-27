import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let body: { email?: string; password?: string; nom_complet?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Corps de requête JSON invalide.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { email, password, nom_complet } = body ?? {};

    if (!email || !password || !nom_complet) {
      return new Response(
        JSON.stringify({ error: 'Email, mot de passe et nom complet sont requis.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(JSON.stringify({ requestId, step: 'check_existing_admin' }));

    const { count, error: countError } = await supabase
      .from('app_e08c374bc4_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('type_compte', 'admin');

    if (countError) {
      console.log(JSON.stringify({ requestId, error: countError }));
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la vérification des comptes administrateur existants.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (count && count > 0) {
      return new Response(
        JSON.stringify({ error: 'Un compte administrateur existe déjà. Veuillez vous connecter.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !createdUser?.user) {
      console.log(JSON.stringify({ requestId, error: createError }));
      return new Response(
        JSON.stringify({ error: createError?.message ?? 'Impossible de créer le compte administrateur.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { error: profileError } = await supabase
      .from('app_e08c374bc4_profiles')
      .insert({
        user_id: createdUser.user.id,
        type_compte: 'admin',
        nom_complet,
      });

    if (profileError) {
      console.log(JSON.stringify({ requestId, error: profileError }));
      return new Response(
        JSON.stringify({ error: "Compte créé mais le profil administrateur n'a pas pu être enregistré." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(JSON.stringify({ requestId, step: 'admin_created', userId: createdUser.user.id }));

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.log(JSON.stringify({ requestId, error: String(error) }));
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
