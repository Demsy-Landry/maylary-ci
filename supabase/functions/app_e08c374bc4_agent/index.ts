import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/*
 * Le Déclarant — assistant de toute l'application.
 *
 * Une seule règle le tient : il ne produit JAMAIS un chiffre de mémoire. Pas
 * un taux, pas un droit, pas un prix, pas un délai réglementaire. Il appelle
 * les moteurs — corpus TEC, liquidation, cotation, règles de procédure — et
 * rapporte ce qu'ils rendent.
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

const secret = (nom: string) => (Deno.env.get(nom) ?? '').replace(/\s+/g, '');
const CLES_GOOGLE = ['GOOGLE_API_KEY', 'GOOGLE_API_KEY2'];

const PERSONNAGE = `Tu es « Le Déclarant », le logisticien de Maylary.

QUI TU ES
Commissionnaire en douane et logisticien senior, plus de dix ans dans le transit et
l'approvisionnement international, formé sur les grands corridors africains et
particulièrement sur la Côte d'Ivoire. Tu as vu passer des milliers de dossiers :
tu sais ce qui bloque un conteneur à Abidjan, ce qu'un fournisseur chinois
accepte de négocier, à quel moment un client se fait avoir sur un incoterm, et
pourquoi un dossier qui traîne trois jours coûte plus cher qu'une remise
arrachée au fournisseur.

Tu conseilles sur la stratégie d'approvisionnement, le sourcing, la négociation,
le choix du mode et de l'incoterm, la conformité documentaire et le montage du
dossier de dédouanement. Tu parles au client comme un professionnel parle à un
professionnel : direct, concret, sans jargon inutile — et sans le prendre de
haut quand il découvre le métier.

CE QUE MAYLARY SAIT FAIRE, ET QUE TU DOIS CONNAÎTRE
- Import : le client décrit ce qu'il veut acheter à l'étranger, Maylary chiffre
  la marchandise, le fret, l'assurance, la douane et la livraison, puis exécute.
- Export : collecte, dédouanement export, expédition, suivi jusqu'à l'acheteur.
- Le Déclarant : recherche de position tarifaire dans le TEC UEMOA officiel,
  classification assistée d'une marchandise, calcul des droits et taxes,
  bulletin de liquidation imprimable.
- Sourcing sur demande : on cherche le fournisseur quand le client ne l'a pas.
- Boutique et Espace Pro : catalogue prêt à commander, particuliers et
  entreprises, avec devis pour les volumes.
- Achat groupé : plusieurs acheteurs réunis sur une même référence pour obtenir
  un prix de gros.
- Garantie « payé, protégé » : le paiement du fournisseur est retenu jusqu'à la
  confirmation de livraison par le client.

RÈGLE ABSOLUE, QUI PRIME SUR TOUT LE RESTE
Tu ne donnes JAMAIS de mémoire :
- un taux de droit de douane ou une position tarifaire,
- un montant de droits, de taxes ou de prix rendu,
- un délai réglementaire, un seuil, une franchise.
Ces éléments s'obtiennent par tes outils, et seulement par eux. Si un outil ne
répond pas, tu dis que tu ne peux pas le confirmer et tu proposes la suite —
tu ne combles jamais un trou par une estimation.

Tu peux en revanche expliquer librement : ce qu'est un incoterm et ce qu'il
implique, comment se déroule un dédouanement, pourquoi le groupage se facture à
l'unité payante, quels documents réunir, comment négocier un fournisseur, quels
pièges guettent un premier import. C'est ton métier et cela n'engage aucun
chiffre.

COMMENT TU TRAVAILLES
- Si la question porte sur un classement, une taxe, un prix ou une procédure
  chiffrée : appelle l'outil, puis explique le résultat en français simple.
- Si la description d'une marchandise est trop vague pour être classée, pose UNE
  question précise plutôt que de deviner.
- Quand un chiffrage revient incomplet, dis-le franchement et nomme ce qui
  manque. Un devis partiel annoncé comme tel vaut mieux qu'un total inventé.
- Termine par la prochaine action utile, jamais par une formule creuse.
- Réponds en français, sauf si l'on t'écrit dans une autre langue.
- Sois bref quand la question est brève.

CE QUE TU NE FAIS PAS
Tu n'engages pas la responsabilité douanière de l'entreprise : la déclaration
est signée par un commissionnaire agréé, pas par toi. Tu ne confirmes pas un
paiement. Tu ne fixes pas un prix de vente seul. Sur ces trois points, tu
prépares le travail et tu passes la main.`;

const OUTILS = [
  {
    name: 'chercher_position',
    description:
      "Cherche des positions tarifaires dans le corpus TEC UEMOA officiel à partir de mots-clés décrivant une marchandise.",
    parameters: {
      type: 'object',
      properties: {
        texte: { type: 'string', description: 'Mots décrivant la marchandise, ou un code SH partiel.' },
      },
      required: ['texte'],
    },
  },
  {
    name: 'verifier_position',
    description:
      "Vérifie un code SH complet à dix chiffres dans le corpus TEC et rend sa désignation, son taux de droit et son unité statistique.",
    parameters: {
      type: 'object',
      properties: { code: { type: 'string', description: 'Code au format 0000.00.00.00' } },
      required: ['code'],
    },
  },
  {
    name: 'calculer_droits',
    description:
      "Calcule les droits et taxes d'une déclaration selon le régime douanier fourni.",
    parameters: {
      type: 'object',
      properties: {
        lignes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              designation: { type: 'string' },
              position: { type: 'string' },
              fob: { type: 'number' },
              poids_brut: { type: 'number' },
            },
            required: ['fob'],
          },
        },
        fret_total: { type: 'number' },
        assurance_total: { type: 'number' },
        regime: { type: 'string', description: "4000 à l'import, 1000 à l'export." },
      },
      required: ['lignes'],
    },
  },
  {
    name: 'chiffrer_operation',
    description:
      "Chiffre une opération complète : marchandise, fret, assurance, droits, transit local, selon l'incoterm et le conditionnement. Rend complet:false et les postes manquants quand un tarif n'est pas renseigné.",
    parameters: {
      type: 'object',
      properties: {
        lignes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              designation: { type: 'string' },
              position: { type: 'string' },
              fob: { type: 'number' },
              poids_brut: { type: 'number' },
            },
            required: ['fob'],
          },
        },
        incoterm: { type: 'string' },
        sens: { type: 'string' },
        mode: { type: 'string' },
        conditionnement: { type: 'string' },
        fret_total: { type: 'number' },
        volume_m3: { type: 'number' },
      },
      required: ['lignes'],
    },
  },
  {
    name: 'regles_de_procedure',
    description:
      "Rend les seuils et délais officiels : RFCV, franchises de magasinage et de surestaries, cautions, délai de contestation.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'regimes_douaniers',
    description: "Rend les régimes douaniers DGD-CI et leur traitement fiscal.",
    parameters: {
      type: 'object',
      properties: { recherche: { type: 'string' } },
      required: [],
    },
  },
];

type Client = ReturnType<typeof createClient>;

async function executer(sb: Client, nom: string, args: Record<string, unknown>): Promise<unknown> {
  switch (nom) {
    case 'chercher_position': {
      const { data } = await sb.rpc('app_e08c374bc4_tec_chercher', {
        p_texte: String(args.texte ?? ''),
        p_limite: 12,
      });
      return { resultats: data ?? [] };
    }
    case 'verifier_position': {
      const { data } = await sb.rpc('app_e08c374bc4_tec_verifier', { p_code: String(args.code ?? '') });
      return data;
    }
    case 'calculer_droits': {
      const { data, error } = await sb.rpc('app_e08c374bc4_liquider_declaration', {
        p_lignes: args.lignes ?? [],
        p_fret_total: Number(args.fret_total ?? 0),
        p_assurance_total: Number(args.assurance_total ?? 0),
        p_poids_brut_total: null,
        p_regime: String(args.regime ?? '4000'),
      });
      return error ? { erreur: error.message } : data;
    }
    case 'chiffrer_operation': {
      const { data, error } = await sb.rpc('app_e08c374bc4_coter', {
        p_lignes: args.lignes ?? [],
        p_incoterm: String(args.incoterm ?? 'FOB'),
        p_sens: String(args.sens ?? 'import'),
        p_regime: null,
        p_mode: String(args.mode ?? 'maritime'),
        p_fret_total: args.fret_total === undefined ? null : Number(args.fret_total),
        p_assurance_total: null,
        p_poids_total: null,
        p_conteneurs: 0,
        p_volume_m3: Number(args.volume_m3 ?? 0),
        p_conditionnement: String(args.conditionnement ?? 'groupage'),
        p_minimum_up: 1,
      });
      return error ? { erreur: error.message } : data;
    }
    case 'regles_de_procedure': {
      const { data } = await sb
        .from('app_e08c374bc4_regles_procedure')
        .select('code, libelle, valeur, unite, nature, reference, explication')
        .eq('actif', true)
        .order('ordre');
      return { regles: data ?? [] };
    }
    case 'regimes_douaniers': {
      let q = sb
        .from('app_e08c374bc4_regimes_douaniers')
        .select('code, libelle, sens, categorie, droits_exigibles, rpi_exigible, ts_exigible, liquidation_supportee, mention')
        .order('ordre')
        .limit(30);
      const recherche = String(args.recherche ?? '').trim();
      if (recherche) q = q.or(`code.ilike.%${recherche}%,libelle.ilike.%${recherche}%`);
      const { data } = await q;
      return { regimes: data ?? [] };
    }
    default:
      return { erreur: `Outil inconnu : ${nom}` };
  }
}

interface Tour {
  role: 'user' | 'model';
  texte: string;
}

async function appelerGoogle(modele: string, corps: unknown) {
  const disponibles = CLES_GOOGLE.filter((n) => secret(n).length > 0);
  let dernier: { statut: number; genre: string | null; motif: string | null; cle: string | null } = {
    statut: 503, genre: null, motif: 'Aucune clé Google configurée.', cle: null,
  };
  for (const nom of disponibles) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modele)}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': secret(nom), 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      },
    );
    if (r.ok) return { ok: true as const, corps: await r.json(), cle: nom };
    let genre: string | null = null;
    let motif: string | null = null;
    try {
      const e = (await r.json())?.error;
      genre = e?.status ?? null;
      motif = e?.message ?? null;
    } catch { /* corps illisible */ }
    dernier = { statut: r.status, genre, motif, cle: nom };
    const quota = r.status === 429 || genre === 'RESOURCE_EXHAUSTED';
    if (!quota) break;
  }
  return { ok: false as const, refus: dernier };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const autorisation = req.headers.get('Authorization') ?? '';
    const { data: auth } = await sb.auth.getUser(autorisation.replace('Bearer ', ''));
    const utilisateur = auth?.user;
    if (!utilisateur || utilisateur.role !== 'authenticated') {
      return json(
        { erreur: 'Connectez-vous pour parler au Déclarant.', connexion_requise: true },
        401,
      );
    }

    let message = '';
    let historique: Tour[] = [];
    let contexte = '';
    try {
      const corps = (await req.json()) as { message?: string; historique?: Tour[]; contexte?: string };
      message = String(corps.message ?? '').trim();
      historique = Array.isArray(corps.historique) ? corps.historique.slice(-12) : [];
      contexte = String(corps.contexte ?? '').slice(0, 400);
    } catch {
      return json({ erreur: 'Requête illisible.' }, 400);
    }
    if (message.length < 2 || message.length > 4000) {
      return json({ erreur: 'Écrivez votre question en 2 à 4 000 caractères.' }, 400);
    }

    const { data: parametres } = await sb
      .from('app_e08c374bc4_parametres_classification')
      .select('*')
      .limit(1)
      .single();
    if (!parametres?.actif) {
      return json({ erreur: 'L’assistant est momentanément indisponible.' }, 503);
    }
    const modele: string = parametres.modele_google ?? 'gemini-3.6-flash';

    const consigne = contexte
      ? `${PERSONNAGE}\n\nCONTEXTE : l'utilisateur écrit depuis « ${contexte} ».`
      : PERSONNAGE;

    const contents = [
      ...historique.map((t) => ({ role: t.role, parts: [{ text: t.texte }] })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const outilsAppeles: string[] = [];

    for (let tour = 0; tour < 6; tour++) {
      const reponse = await appelerGoogle(modele, {
        system_instruction: { parts: [{ text: consigne }] },
        contents,
        tools: [{ function_declarations: OUTILS }],
        generationConfig: { maxOutputTokens: 4000 },
      });

      if (!reponse.ok) {
        console.error('agent amont', reponse.refus.statut, reponse.refus.genre);
        return json(
          {
            erreur: 'Le Déclarant est momentanément injoignable. Réessayez dans un instant.',
            cle_amont: reponse.refus.cle,
            statut_amont: reponse.refus.statut,
            genre_amont: reponse.refus.genre,
            motif_amont: reponse.refus.motif,
          },
          502,
        );
      }

      const candidat = reponse.corps?.candidates?.[0];
      const parts = candidat?.content?.parts ?? [];
      const appels = parts.filter((p: { functionCall?: unknown }) => p?.functionCall);

      if (appels.length === 0) {
        const texte = parts
          .map((p: { text?: string }) => p?.text ?? '')
          .join('')
          .trim();
        return json({
          reponse: texte || "Je n'ai pas de réponse utile à donner ici. Reformulez ?",
          outils: outilsAppeles,
          modele,
        });
      }

      contents.push({ role: 'model', parts });

      const resultats = [];
      for (const p of appels) {
        const { name, args } = p.functionCall as { name: string; args: Record<string, unknown> };
        outilsAppeles.push(name);
        const sortie = await executer(sb, name, args ?? {});
        resultats.push({ functionResponse: { name, response: { resultat: sortie } } });
      }
      contents.push({ role: 'user', parts: resultats });
    }

    // Le budget d'outils est épuisé. On redemande une réponse en retirant les
    // outils : privé du moyen d'en appeler un de plus, le modèle rédige.
    //
    // Sans ce dernier appel, une demande de chiffrage complet — classer, puis
    // vérifier, puis coter — consommait ses six tours et rendait la main sur un
    // message d'échec, alors que tous les résultats étaient déjà là. C'était le
    // cas le plus utile de l'agent, et c'était précisément celui qui échouait.
    const conclusion = await appelerGoogle(modele, {
      system_instruction: { parts: [{ text: consigne }] },
      contents,
      generationConfig: { maxOutputTokens: 4000 },
    });

    if (conclusion.ok) {
      const texte = (conclusion.corps?.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p?.text ?? '')
        .join('')
        .trim();
      if (texte) return json({ reponse: texte, outils: outilsAppeles, modele });
    }

    return json({
      reponse:
        "Je n'arrive pas à conclure sans tourner en rond. Posez la question autrement, ou passez par l'écran du Déclarant pour la traiter pas à pas.",
      outils: outilsAppeles,
      modele,
    });
  } catch (e) {
    console.error('agent incident', (e as Error)?.name);
    return json({ erreur: 'Incident pendant la conversation. Réessayez.' }, 500);
  }
});
