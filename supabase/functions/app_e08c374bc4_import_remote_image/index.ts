import { createClient } from 'npm:@supabase/supabase-js@2';

// Utilitaire interne : télécharge une image depuis une URL externe (ex: export
// Canva) et la dépose dans Supabase Storage, server-side (contourne les
// restrictions réseau de l'environnement de développement qui ne peut pas
// atteindre canva.com directement). Protégé par un jeton partagé stocké en
// secret Supabase (Project Settings > Edge Functions > Secrets), jamais en dur
// dans le code.
const INTERNAL_TOKEN = Deno.env.get('IMPORT_REMOTE_IMAGE_TOKEN');

Deno.serve(async (req: Request) => {
  try {
    if (!INTERNAL_TOKEN) {
      return new Response(JSON.stringify({ error: 'IMPORT_REMOTE_IMAGE_TOKEN non configuré.' }), { status: 500 });
    }

    const body = await req.json().catch(() => null);
    if (!body || body.token !== INTERNAL_TOKEN) {
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
