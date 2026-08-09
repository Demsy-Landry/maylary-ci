// Génération d'images par le modèle Google, et dépôt dans le stockage.
//
// Le bac à sable de développement ne joint aucun service d'image ; le réseau de
// Supabase, si. La fonction génère, téléverse, et ne renvoie que des
// métadonnées : une image complète en base64 ne tient pas dans une réponse
// lisible, et la bibliothèque de redimensionnement essayée fait tomber le
// worker. L'examen du résultat se fait donc par l'URL publique.
//
// Réservée à l'administrateur, et ce n'est pas une précaution de principe :
// chaque appel consomme du crédit sur le compte du fondateur. Une fonction de
// génération ouverte à la clé anonyme serait une facture ouverte.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const secret = (n: string) => (Deno.env.get(n) ?? '').replace(/\s+/g, '');
const CLES = ['GOOGLE_API_KEY2', 'GOOGLE_API_KEY'];
const BUCKET = 'app_e08c374bc4_enseigne_logos';

function versOctets(base64: string): Uint8Array {
  const binaire = atob(base64);
  const out = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) out[i] = binaire.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: auth } = await sb.auth.getUser(
      (req.headers.get('Authorization') ?? '').replace('Bearer ', ''),
    );
    const utilisateur = auth?.user;
    if (!utilisateur) {
      return new Response(JSON.stringify({ erreur: 'Authentification requise.' }), { status: 401 });
    }
    const { data: profil } = await sb
      .from('app_e08c374bc4_profiles')
      .select('type_compte')
      .eq('user_id', utilisateur.id)
      .maybeSingle();
    if (profil?.type_compte !== 'admin') {
      return new Response(JSON.stringify({ erreur: 'Réservé à l\'administrateur.' }), { status: 403 });
    }

    const { prompt, chemin, modele } = await req.json().catch(() => ({}));
    if (!prompt || !chemin) {
      return new Response(JSON.stringify({ erreur: 'prompt et chemin requis' }), { status: 400 });
    }
    const m = modele || 'nano-banana-pro-preview';
    const echecs: unknown[] = [];

    for (const nom of CLES.filter((n) => secret(n).length > 0)) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
        {
          method: 'POST',
          headers: { 'x-goog-api-key': secret(nom), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['IMAGE'] },
          }),
        },
      );

      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        // Tous les échecs sont conservés : n'en garder qu'un masquait le motif
        // de la première clé derrière celui de la seconde.
        echecs.push({ cle: nom, statut: r.status, genre: e?.error?.status,
          motif: String(e?.error?.message ?? '').slice(0, 220) });
        continue;
      }

      const corps = await r.json();
      const parts = corps?.candidates?.[0]?.content?.parts ?? [];
      const img = parts.find((p: { inlineData?: { data?: string } }) => p?.inlineData?.data);
      if (!img) {
        echecs.push({ cle: nom, erreur: 'aucune image dans la reponse', nb_parts: parts.length });
        continue;
      }

      const octets = versOctets(img.inlineData.data);
      const { error } = await sb.storage.from(BUCKET).upload(chemin, octets, {
        contentType: img.inlineData.mimeType ?? 'image/png',
        upsert: true,
      });
      if (error) return new Response(JSON.stringify({ erreur: error.message }), { status: 500 });
      const { data } = sb.storage.from(BUCKET).getPublicUrl(chemin);

      return new Response(
        JSON.stringify({ ok: true, cle: nom, modele: m, chemin,
          octets: octets.length, mime: img.inlineData.mimeType, url: data.publicUrl }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ ok: false, echecs }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ erreur: (e as Error).name }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
