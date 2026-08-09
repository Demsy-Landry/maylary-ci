import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/*
 * Classification tarifaire assistée.
 *
 * Le modèle propose un code et le raisonnement qui le soutient. Il ne donne
 * jamais le taux : le code proposé est confronté au corpus TEC juste après, et
 * c'est le corpus qui répond — ou personne. Un modèle qui invente un code
 * inventerait aussi son taux, et un taux inventé coûte un redressement au
 * client.
 *
 * Deux fournisseurs, une seule sortie. Le choix se règle en base et ne change
 * rien à la fiabilité : elle vient de la vérification en corpus, pas du modèle.
 * C'est précisément pourquoi la bascule peut être un réglage et non un choix
 * d'architecture.
 *
 * Aucune erreur interne ne ressort d'ici. Un message d'erreur peut contenir la
 * valeur qui l'a provoquée — une clé mal collée, par exemple — et se retrouver
 * dans un journal ou une réponse HTTP. Le corps d'erreur renvoyé par le
 * fournisseur, lui, décrit la requête et jamais l'en-tête d'authentification :
 * il est remonté, parce que sans lui un refus ne dit rien.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const CONSIGNE = `Tu es expert en classification tarifaire, spécialiste du Système Harmonisé et du Tarif Extérieur Commun CEDEAO/UEMOA appliqué en Côte d'Ivoire.

Méthode obligatoire, dans cet ordre :
1. Identifier la matière constitutive, la fonction et l'usage de la marchandise.
2. Repérer la section du Système Harmonisé, puis le chapitre.
3. Lire les notes de section et de chapitre, notamment leurs exclusions.
4. Appliquer les Règles Générales Interprétatives dans l'ordre : RGI 1 d'abord (textes des positions et notes), puis RGI 2 à 6 seulement si RGI 1 ne tranche pas.
5. Retenir la position à quatre chiffres.
6. Descendre à la sous-position à six chiffres, puis à la ligne tarifaire nationale à dix chiffres au format UEMOA.
7. Citer explicitement la ou les RGI qui ont tranché, et les notes utilisées.

Règles absolues :
- Ne donne JAMAIS de taux de droit de douane, ni de pourcentage, ni de catégorie tarifaire. Ce n'est pas ton rôle : le taux est lu dans le tarif officiel après ta réponse.
- Si la description est trop vague pour trancher, dis-le dans "question" et laisse "code_hs" à null plutôt que de deviner.
- Le code doit être au format 0000.00.00.00.

Réponds uniquement en JSON valide, sans texte autour et sans balises de code :
{"code_hs":"0000.00.00.00 ou null","section":"Section N — intitulé","chapitre":"Chapitre NN — intitulé","position":"0000 — intitulé","sous_position":"0000.00 — intitulé","caracteristiques":"matière, fonction, composition, usage retenus","raisonnement_rgi":"RGI appliquées et notes utilisées, en français, concis","notes_declarant":"documents exigibles, restrictions, pièges de classement","question":"la précision manquante, ou null"}`;

/**
 * Un copier-coller depuis un affichage replié ramène des retours à la ligne au
 * milieu de la clé. On les retire, sinon l'en-tête HTTP est refusé et le
 * message d'erreur cite la clé en clair.
 */
const secret = (nom: string) => (Deno.env.get(nom) ?? '').replace(/\s+/g, '');

interface Refus {
  statut: number;
  genre: string | null;
  motif: string | null;
}

interface Proposition {
  texte: string;
  arret: string | null;
}

/** Ce que les deux fournisseurs rendent en commun : du texte, ou un refus. */
type Reponse = { ok: true; valeur: Proposition } | { ok: false; refus: Refus };

async function lireRefus(reponse: Response, chemin: string[]): Promise<Refus> {
  let genre: string | null = null;
  let motif: string | null = null;
  try {
    const corps = await reponse.json();
    let noeud: unknown = corps;
    for (const cle of chemin) noeud = (noeud as Record<string, unknown> | null)?.[cle];
    genre = (noeud as { type?: string; status?: string })?.type
      ?? (noeud as { status?: string })?.status
      ?? null;
    motif = (noeud as { message?: string })?.message ?? null;
  } catch {
    motif = null;
  }
  return { statut: reponse.status, genre, motif };
}

async function interrogerAnthropic(modele: string, description: string): Promise<Reponse> {
  const cle = secret('ANTHROPIC_API_KEY');
  const appel = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': cle,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modele,
      max_tokens: 4000,
      system: CONSIGNE,
      messages: [{ role: 'user', content: `Classe cette marchandise : ${description}` }],
    }),
  });

  if (!appel.ok) return { ok: false, refus: await lireRefus(appel, ['error']) };

  const corps = await appel.json();
  // La réponse peut commencer par un bloc de raisonnement : on concatène les
  // blocs de texte plutôt que de lire le premier, qui n'est pas toujours le JSON.
  const texte: string = (corps?.content ?? [])
    .filter((b: { type?: string }) => b?.type === 'text')
    .map((b: { text?: string }) => b.text ?? '')
    .join('');
  return { ok: true, valeur: { texte, arret: corps?.stop_reason ?? null } };
}

async function interrogerGoogle(modele: string, description: string): Promise<Reponse> {
  const cle = secret('GOOGLE_API_KEY');
  const appel = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modele)}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': cle, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: CONSIGNE }] },
        contents: [
          { role: 'user', parts: [{ text: `Classe cette marchandise : ${description}` }] },
        ],
        // Le mode JSON natif évite d'avoir à extraire le JSON d'un texte
        // enrobé — l'échec de lecture le plus fréquent côté modèle.
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4000 },
      }),
    },
  );

  if (!appel.ok) return { ok: false, refus: await lireRefus(appel, ['error']) };

  const corps = await appel.json();
  const candidat = corps?.candidates?.[0];
  const texte: string = (candidat?.content?.parts ?? [])
    .map((p: { text?: string }) => p?.text ?? '')
    .join('');
  return { ok: true, valeur: { texte, arret: candidat?.finishReason ?? null } };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // La clé anonyme est un JWT valide : elle ne prouve pas qu'un compte est
    // derrière la demande. On lit l'identité réelle de l'appelant.
    const autorisation = req.headers.get('Authorization') ?? '';
    const { data: auth } = await supabase.auth.getUser(autorisation.replace('Bearer ', ''));
    const utilisateur = auth?.user;
    if (!utilisateur || utilisateur.role !== 'authenticated') {
      return json(
        { erreur: 'Connectez-vous pour utiliser la classification assistée.', connexion_requise: true },
        401,
      );
    }

    let description = '';
    try {
      description = String(((await req.json()) as { description?: string }).description ?? '').trim();
    } catch {
      return json({ erreur: 'Requête illisible.' }, 400);
    }
    if (description.length < 3 || description.length > 2000) {
      return json({ erreur: 'Décrivez la marchandise en 3 à 2 000 caractères.' }, 400);
    }

    const { data: parametres } = await supabase
      .from('app_e08c374bc4_parametres_classification')
      .select('*')
      .limit(1)
      .single();

    if (!parametres?.actif) {
      return json({ erreur: 'La classification assistée est momentanément désactivée.' }, 503);
    }

    const fournisseur: string = parametres.fournisseur ?? 'google';
    const modele: string =
      fournisseur === 'anthropic' ? parametres.modele_anthropic : parametres.modele_google;

    const cleAttendue = fournisseur === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY';
    if (secret(cleAttendue).length === 0) {
      return json(
        { erreur: "La clé de classification n'est pas configurée. Contactez Maylary." },
        503,
      );
    }

    // Chaque appel coûte de l'argent et la page est publique : le plafond
    // journalier est ce qui empêche un robot de vider le compte.
    const debutJour = new Date();
    debutJour.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('app_e08c374bc4_classifications_hs')
      .select('id', { count: 'exact', head: true })
      .eq('utilisateur_id', utilisateur.id)
      .gte('cree_le', debutJour.toISOString());

    if ((count ?? 0) >= parametres.classifications_par_jour) {
      return json(
        {
          erreur: `Vous avez atteint ${parametres.classifications_par_jour} classifications aujourd'hui. Réessayez demain, ou écrivez-nous pour un accès professionnel.`,
          quota_atteint: true,
        },
        429,
      );
    }

    // --- Le modèle propose ---
    const reponse =
      fournisseur === 'anthropic'
        ? await interrogerAnthropic(modele, description)
        : await interrogerGoogle(modele, description);

    if (!reponse.ok) {
      console.error('fournisseur', fournisseur, reponse.refus.statut, reponse.refus.genre);
      return json(
        {
          erreur: 'Le service de classification est indisponible. Réessayez dans un instant.',
          fournisseur,
          statut_amont: reponse.refus.statut,
          genre_amont: reponse.refus.genre,
          motif_amont: reponse.refus.motif,
        },
        502,
      );
    }

    let propose: Record<string, unknown>;
    try {
      const { texte } = reponse.valeur;
      const debut = texte.indexOf('{');
      const fin = texte.lastIndexOf('}');
      propose = JSON.parse(debut >= 0 && fin > debut ? texte.slice(debut, fin + 1) : texte);
    } catch {
      console.error('reponse non json', fournisseur, reponse.valeur.arret);
      return json(
        {
          erreur: "La réponse n'a pas pu être interprétée. Reformulez la description.",
          arret_amont: reponse.valeur.arret,
        },
        502,
      );
    }

    const brut = typeof propose.code_hs === 'string' ? propose.code_hs : '';
    const chiffres = brut.replace(/\D/g, '');
    const code =
      chiffres.length === 10
        ? `${chiffres.slice(0, 4)}.${chiffres.slice(4, 6)}.${chiffres.slice(6, 8)}.${chiffres.slice(8, 10)}`
        : null;

    // --- Le corpus confirme, ou refuse ---
    // Tout se joue ici : le taux ne peut venir que de cette ligne.
    const { data: verification } = await supabase.rpc('app_e08c374bc4_tec_verifier', {
      p_code: code ?? '',
    });
    const trouve = verification?.trouve === true;

    const resultat = {
      description,
      code_propose: code,
      section: propose.section ?? null,
      chapitre: propose.chapitre ?? null,
      position_sh: propose.position ?? null,
      sous_position: propose.sous_position ?? null,
      caracteristiques: propose.caracteristiques ?? null,
      raisonnement_rgi: propose.raisonnement_rgi ?? null,
      notes_declarant: propose.notes_declarant ?? null,
      question: propose.question ?? null,
      fournisseur,
      modele,
      verifie_en_base: trouve,
      designation_tec: trouve ? verification.designation : null,
      unite_us: trouve ? verification.unite_us : null,
      taux_dd: trouve ? verification.taux_dd_pourcent : null,
      mention: trouve
        ? verification.mention
        : (verification?.mention_utilisateur ??
          "Le code proposé n'a pas pu être confirmé dans la base TEC officielle. Aucun taux n'est affiché."),
      code_proche_indicatif: trouve ? null : (verification?.code_proche_indicatif ?? null),
      tarif: verification?.tarif ?? null,
    };

    // L'écriture passe par la clé de service : une classification ne doit pas
    // pouvoir être fabriquée depuis le navigateur, sinon l'historique ne prouve
    // plus rien.
    const { data: enregistre, error: erreurEcriture } = await supabase
      .from('app_e08c374bc4_classifications_hs')
      .insert({
        utilisateur_id: utilisateur.id,
        description,
        code_propose: resultat.code_propose,
        section: resultat.section,
        chapitre: resultat.chapitre,
        position_sh: resultat.position_sh,
        sous_position: resultat.sous_position,
        caracteristiques: resultat.caracteristiques,
        raisonnement_rgi: resultat.raisonnement_rgi,
        notes_declarant: resultat.notes_declarant,
        fournisseur,
        modele,
        verifie_en_base: resultat.verifie_en_base,
        designation_tec: resultat.designation_tec,
        unite_us: resultat.unite_us,
        taux_dd: resultat.taux_dd,
      })
      .select('id')
      .single();

    if (erreurEcriture) console.error('ecriture historique', erreurEcriture.code);

    return json({
      ...resultat,
      id: enregistre?.id ?? null,
      restant: Math.max(0, parametres.classifications_par_jour - (count ?? 0) - 1),
    });
  } catch (e) {
    // Volontairement sans le message : il peut citer la valeur fautive.
    console.error('incident', (e as Error)?.name);
    return json(
      { erreur: 'Incident pendant la classification. Réessayez, et signalez-le si cela persiste.' },
      500,
    );
  }
});
