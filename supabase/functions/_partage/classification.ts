/*
 * Le moteur de classification tarifaire, partagé.
 *
 * Il vivait dans la fonction du Déclarant. Il en sort parce qu'une deuxième
 * application — la cotation E-Transit — s'en sert désormais, et que deux
 * consignes finiraient par diverger : la même marchandise décrite pareil
 * rendrait deux codes différents selon la porte d'entrée. Une seule consigne,
 * un seul fournisseur à la fois, une seule vérification en corpus.
 *
 * Le partage tient sur une règle : le modèle propose, le corpus tranche. Le
 * modèle ne donne jamais de taux — il n'en a pas le droit et on ne le lui
 * demande pas. Le code qu'il propose est confronté au TEC officiel juste
 * après, et c'est cette confrontation, pas le modèle, qui autorise l'affichage
 * d'un taux. Un modèle qui invente un code inventerait aussi son taux, et un
 * taux inventé coûte un redressement au client.
 */

export const CONSIGNE =
  `Tu es expert en classification tarifaire, spécialiste du Système Harmonisé et du Tarif Extérieur Commun CEDEAO/UEMOA appliqué en Côte d'Ivoire.

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
export const secret = (nom: string) => (Deno.env.get(nom) ?? '').replace(/\s+/g, '');

export interface Refus {
  statut: number;
  genre: string | null;
  motif: string | null;
  /** Nom du secret utilisé, jamais sa valeur — pour savoir laquelle a refusé. */
  cle?: string;
}

export interface Proposition {
  texte: string;
  arret: string | null;
  cle?: string;
}

/** Ce que les deux fournisseurs rendent en commun : du texte, ou un refus. */
export type Reponse = { ok: true; valeur: Proposition } | { ok: false; refus: Refus };

async function lireRefus(reponse: Response): Promise<Refus> {
  let genre: string | null = null;
  let motif: string | null = null;
  try {
    const corps = await reponse.json();
    const noeud = corps?.error ?? corps;
    genre = noeud?.type ?? noeud?.status ?? null;
    motif = noeud?.message ?? null;
  } catch {
    motif = null;
  }
  return { statut: reponse.status, genre, motif };
}

async function interrogerAnthropic(
  modele: string,
  description: string,
  consigne: string,
): Promise<Reponse> {
  const appel = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': secret('ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modele,
      max_tokens: 4000,
      system: consigne,
      messages: [{ role: 'user', content: `Classe cette marchandise : ${description}` }],
    }),
  });

  if (!appel.ok) return { ok: false, refus: { ...(await lireRefus(appel)), cle: 'ANTHROPIC_API_KEY' } };

  const corps = await appel.json();
  // La réponse peut commencer par un bloc de raisonnement : on concatène les
  // blocs de texte plutôt que de lire le premier, qui n'est pas toujours le JSON.
  const texte: string = (corps?.content ?? [])
    .filter((b: { type?: string }) => b?.type === 'text')
    .map((b: { text?: string }) => b.text ?? '')
    .join('');
  return { ok: true, valeur: { texte, arret: corps?.stop_reason ?? null, cle: 'ANTHROPIC_API_KEY' } };
}

/**
 * Clés Google essayées dans l'ordre. La première est le compte principal, la
 * seconde un compte de secours au palier gratuit. On ne bascule que sur un
 * épuisement de quota : sur une clé invalide ou une requête mal formée,
 * réessayer avec une autre clé masquerait le vrai défaut derrière un second
 * refus identique.
 */
export const CLES_GOOGLE = ['GOOGLE_API_KEY', 'GOOGLE_API_KEY2'];

const quotaEpuise = (refus: Refus) =>
  refus.statut === 429 ||
  refus.genre === 'RESOURCE_EXHAUSTED' ||
  (refus.statut === 403 && /quota/i.test(refus.motif ?? ''));

async function interrogerGoogle(
  modele: string,
  description: string,
  consigne: string,
): Promise<Reponse> {
  const disponibles = CLES_GOOGLE.filter((nom) => secret(nom).length > 0);
  let dernier: Refus = { statut: 503, genre: null, motif: 'Aucune clé Google configurée.' };

  for (const nom of disponibles) {
    const appel = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modele)}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': secret(nom), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: consigne }] },
          contents: [
            { role: 'user', parts: [{ text: `Classe cette marchandise : ${description}` }] },
          ],
          // Le mode JSON natif évite d'avoir à extraire le JSON d'un texte
          // enrobé — l'échec de lecture le plus fréquent côté modèle.
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4000 },
        }),
      },
    );

    if (appel.ok) {
      const corps = await appel.json();
      const candidat = corps?.candidates?.[0];
      const texte: string = (candidat?.content?.parts ?? [])
        .map((p: { text?: string }) => p?.text ?? '')
        .join('');
      return { ok: true, valeur: { texte, arret: candidat?.finishReason ?? null, cle: nom } };
    }

    dernier = await lireRefus(appel);
    dernier.cle = nom;
    if (!quotaEpuise(dernier)) break;
    console.error('quota epuise', nom, '- bascule sur la cle suivante');
  }

  return { ok: false, refus: dernier };
}

export interface Parametres {
  actif: boolean;
  fournisseur: string;
  modele_anthropic: string;
  modele_google: string;
  consigne_complement: string | null;
  classifications_par_jour: number;
}

export function clesAttendues(fournisseur: string) {
  return fournisseur === 'anthropic' ? ['ANTHROPIC_API_KEY'] : CLES_GOOGLE;
}

export function modelePour(parametres: Parametres) {
  return parametres.fournisseur === 'anthropic'
    ? parametres.modele_anthropic
    : parametres.modele_google;
}

/** Le code tel que le tarif l'écrit, ou rien. On ne redresse pas un code bancal. */
export function normaliserCode(brut: unknown): string | null {
  const chiffres = (typeof brut === 'string' ? brut : '').replace(/\D/g, '');
  if (chiffres.length !== 10) return null;
  return `${chiffres.slice(0, 4)}.${chiffres.slice(4, 6)}.${chiffres.slice(6, 8)}.${chiffres.slice(8, 10)}`;
}

export type Issue =
  | { ok: true; propose: Record<string, unknown>; code: string | null; fournisseur: string; modele: string }
  | { ok: false; statut: number; corps: Record<string, unknown> };

/**
 * Interroge le modèle et rend sa proposition analysée. La confrontation au
 * corpus se fait ensuite, chez l'appelant, parce que c'est lui qui sait au nom
 * de qui il la demande.
 */
export async function proposer(parametres: Parametres, description: string): Promise<Issue> {
  const fournisseur = parametres.fournisseur ?? 'google';
  const modele = modelePour(parametres);
  const consigne = parametres.consigne_complement
    ? `${CONSIGNE}\n\n${parametres.consigne_complement}`
    : CONSIGNE;

  const reponse =
    fournisseur === 'anthropic'
      ? await interrogerAnthropic(modele, description, consigne)
      : await interrogerGoogle(modele, description, consigne);

  if (!reponse.ok) {
    console.error('fournisseur', fournisseur, reponse.refus.statut, reponse.refus.genre);
    return {
      ok: false,
      statut: 502,
      corps: {
        erreur: 'Le service de classification est indisponible. Réessayez dans un instant.',
        fournisseur,
        cle_amont: reponse.refus.cle ?? null,
        statut_amont: reponse.refus.statut,
        genre_amont: reponse.refus.genre,
        motif_amont: reponse.refus.motif,
      },
    };
  }

  let propose: Record<string, unknown>;
  try {
    const { texte } = reponse.valeur;
    const debut = texte.indexOf('{');
    const fin = texte.lastIndexOf('}');
    propose = JSON.parse(debut >= 0 && fin > debut ? texte.slice(debut, fin + 1) : texte);
  } catch {
    console.error('reponse non json', fournisseur, reponse.valeur.arret);
    return {
      ok: false,
      statut: 502,
      corps: {
        erreur: "La réponse n'a pas pu être interprétée. Reformulez la description.",
        arret_amont: reponse.valeur.arret,
      },
    };
  }

  return { ok: true, propose, code: normaliserCode(propose.code_hs), fournisseur, modele };
}

/**
 * La confrontation au corpus. Tout se joue ici : le taux ne peut venir que de
 * cette ligne, jamais du modèle.
 */
// deno-lint-ignore no-explicit-any
export async function confronterAuCorpus(supabase: any, description: string, issue: Issue) {
  if (!issue.ok) throw new Error('issue non exploitable');
  const { propose, code, fournisseur, modele } = issue;

  const { data: verification } = await supabase.rpc('app_e08c374bc4_tec_verifier', {
    p_code: code ?? '',
  });
  const trouve = verification?.trouve === true;

  return {
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
}
