import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Rapatrie une image depuis une URL externe (export Canva, banque d'images) et
 * la dépose dans Supabase Storage.
 *
 * Le téléchargement se fait côté serveur pour deux raisons : le navigateur d'un
 * administrateur serait bloqué par la politique d'origine du fournisseur, et
 * l'environnement de développement n'atteint pas canva.com.
 *
 * Deux façons de s'authentifier, parce que deux usages différents s'en servent :
 *
 *  - un jeton partagé, pour les scripts d'outillage qui n'ont pas de session ;
 *  - une session d'administrateur, pour que l'application elle-même puisse
 *    appeler la fonction sans qu'un secret ait à circuler dans le navigateur.
 *
 * Les deux donnent le même pouvoir : écrire dans un dépôt public. Il n'y a donc
 * pas de voie plus permissive que l'autre.
 */
const INTERNAL_TOKEN = Deno.env.get('IMPORT_REMOTE_IMAGE_TOKEN');

async function estAdministrateur(entete: string | null): Promise<boolean> {
  if (!entete) return false;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return false;

  const commeAppelant = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: entete } },
  });
  const {
    data: { user },
  } = await commeAppelant.auth.getUser();
  if (!user) return false;

  const service = createClient(supabaseUrl, serviceRoleKey);
  const { data: profil } = await service
    .from('app_e08c374bc4_profiles')
    .select('type_compte')
    .eq('user_id', user.id)
    .maybeSingle();

  return profil?.type_compte === 'admin';
}

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: 'Corps de requête JSON invalide.' }), { status: 400 });
    }

    const jetonValide = Boolean(INTERNAL_TOKEN) && body.token === INTERNAL_TOKEN;
    const autorise = jetonValide || (await estAdministrateur(req.headers.get('Authorization')));

    if (!autorise) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { source_url, bucket, path, content_type } = body as {
      source_url?: string;
      bucket?: string;
      path?: string;
      content_type?: string;
    };

    if (!source_url || !bucket || !path) {
      return new Response(JSON.stringify({ error: 'source_url, bucket, path requis.' }), { status: 400 });
    }

    const imgRes = await fetch(source_url);
    if (!imgRes.ok) {
      return new Response(
        JSON.stringify({ error: `Téléchargement échoué (${imgRes.status})` }),
        { status: 502 },
      );
    }
    const bytes = new Uint8Array(await imgRes.arrayBuffer());

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, bytes, {
        contentType: content_type ?? imgRes.headers.get('content-type') ?? 'image/png',
        upsert: true,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);

    return new Response(
      JSON.stringify({ success: true, public_url: publicUrlData.publicUrl, bytes: bytes.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
