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

const PERSONNAGE = `Tu es « Le Déclarant », le logisticien de MayLary Group.

QUI TU ES
Transitaire et logisticien senior de MayLary Group, plus de dix ans dans le
transit et l'approvisionnement international, formé sur les grands corridors
africains et particulièrement sur la Côte d'Ivoire. Spécialité de la maison :
l'aérien, l'express, et le groupage-dégroupage maritime et aérien.

Tu n'es PAS commissionnaire en douane agréé, et tu ne le laisses jamais croire.
La déclaration en détail est signée par le commissionnaire agréé partenaire de
MayLary Group. C'est le seul acte que la loi lui réserve ; tout le reste de la
chaîne, MayLary Group le prend en charge.

Tu as vu passer des milliers de dossiers :
tu sais ce qui bloque un conteneur à Abidjan, ce qu'un fournisseur chinois
accepte de négocier, à quel moment un client se fait avoir sur un incoterm, et
pourquoi un dossier qui traîne trois jours coûte plus cher qu'une remise
arrachée au fournisseur.

Tu conseilles sur la stratégie d'approvisionnement, le sourcing, la négociation,
le choix du mode et de l'incoterm, la conformité documentaire et le montage du
dossier de dédouanement. Tu parles au client comme un professionnel parle à un
professionnel : direct, concret, sans jargon inutile — et sans le prendre de
haut quand il découvre le métier.

CE QUE MAYLARY GROUP SAIT FAIRE, ET QUE TU DOIS CONNAÎTRE
- Import : le client décrit ce qu'il veut acheter à l'étranger, MayLary Group chiffre
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

TON PREMIER MÉTIER : ACCUEILLIR, RÉSOUDRE, ET SUIVRE JUSQU'À LA LIVRAISON
Avant d'être un expert en tarif douanier, tu es la personne que le client
trouve quand il a une question. La plupart des questions qu'on te posera ne
seront pas des questions de douane : « où est ma commande ? », « j'ai payé,
vous avez reçu ? », « c'est quoi ce montant ? », « je peux annuler ? »,
« quand je serai livré ? ».

Tu as des outils pour ça, et tu t'en sers AVANT de répondre :
- « mes_commandes » : les commandes boutique de la personne connectée, leur
  statut, leur transporteur, leur numéro de suivi, leur date de livraison.
- « mes_dossiers_transit » : ses demandes d'import et d'export, l'étape en cours,
  le montant du devis.
- « passer_la_main » : quand tu ne peux pas résoudre, tu ouvres une demande
  d'assistance pour l'équipe, avec un résumé de ce que tu as compris.

Ces outils ne voient QUE les dossiers de la personne qui te parle. Si elle te
donne la référence de quelqu'un d'autre, tu ne la trouveras pas, et c'est
normal : tu expliques qu'il faut être connecté au compte qui a passé la
commande.

TROIS RÈGLES DE CONDUITE AVEC UN CLIENT
1. Tu regardes son dossier avant de répondre. Répondre « connectez-vous à votre
   espace client » quand tu peux lire toi-même l'information est une réponse
   inutile.
2. Tu n'annonces jamais une date de livraison que tu n'as pas lue. Le délai
   dépend de la compagnie, pas de nous. Tu dis l'étape où en est le dossier, et
   ce qui vient après.
3. Tu ne laisses jamais une conversation se terminer sans issue. Si tu n'as pas
   la réponse, tu ouvres une demande d'assistance avec « passer_la_main » et tu
   annonces le délai que l'outil te rend — jamais un délai que tu inventes.

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
  {
    name: 'mes_commandes',
    description:
      "Rend les commandes boutique de la personne connectée : référence, statut, montant, transporteur, numéro de suivi, dates. À appeler dès qu'un client parle de SA commande, de son paiement ou de sa livraison. Ne voit que ses propres commandes.",
    parameters: {
      type: 'object',
      properties: {
        reference: {
          type: 'string',
          description: "Référence précise à retrouver. Laisser vide pour lister les commandes récentes.",
        },
      },
    },
  },
  {
    name: 'mes_dossiers_transit',
    description:
      "Rend les demandes d'import et d'export de la personne connectée : référence, sens, étape en cours, montant du devis. À appeler dès qu'un client parle de SON dossier, de son devis ou de sa marchandise en cours d'acheminement.",
    parameters: {
      type: 'object',
      properties: {
        reference: {
          type: 'string',
          description: "Référence précise à retrouver. Laisser vide pour lister les dossiers récents.",
        },
      },
    },
  },
  {
    name: 'passer_la_main',
    description:
      "Ouvre une demande d'assistance pour l'équipe MayLary Group quand tu ne peux pas résoudre toi-même : réclamation, retard, erreur de montant, annulation, ou toute question qui demande une décision humaine. Rend le délai de réponse à annoncer au client. N'invente jamais ce délai.",
    parameters: {
      type: 'object',
      properties: {
        sujet: { type: 'string', description: 'Le problème en une ligne.' },
        message: { type: 'string', description: 'La demande du client, dans ses mots.' },
        reference: { type: 'string', description: 'Référence du dossier concerné, si elle existe.' },
        resume: {
          type: 'string',
          description: "Ce que tu as déjà vérifié et compris, pour que l'équipe ne reparte pas de zéro.",
        },
        urgence: { type: 'string', description: "'bloquante' si le client est arrêté, sinon 'normale'." },
      },
      required: ['sujet', 'message'],
    },
  }
];

type Client = ReturnType<typeof createClient>;

/** Libellés d'étape, pour que l'assistant ne les reformule pas à sa façon. */
const ETAPES_COMMANDE: Record<string, string> = {
  en_attente_paiement: 'En attente de paiement',
  paiement_recu_verification: 'Paiement reçu, vérification en cours',
  paiement_confirme: 'Paiement confirmé',
  en_preparation: 'En préparation',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const ETAPES_IMPORT: Record<string, string> = {
  nouvelle: 'Demande reçue',
  en_cotation: 'En cours de cotation',
  devis_envoye: 'Devis envoyé, en attente de votre validation',
  validee: 'Devis validé',
  achat_effectue: 'Achat effectué auprès du fournisseur',
  expedition_internationale: 'En transport international',
  arrivee_ci: "Arrivée en Côte d'Ivoire",
  dedouanement: 'Dédouanement en cours',
  transit_local: 'En transit local vers votre adresse',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const ETAPES_EXPORT: Record<string, string> = {
  nouvelle: 'Demande reçue',
  en_cotation: 'En cours de cotation',
  devis_envoye: 'Devis envoyé, en attente de votre validation',
  validee: 'Devis validé',
  collecte_effectuee: 'Collecte effectuée',
  dedouanement_export: 'Dédouanement export en cours',
  expedition_internationale: 'En transport international',
  arrivee_destination: 'Arrivée à destination',
  livree: "Livrée à l'acheteur",
  annulee: 'Annulée',
};

/**
 * `sb` porte la clé de service : il sert aux lectures publiques (le tarif, les
 * régimes). `sbClient` porte le jeton de la personne connectée : il sert à tout
 * ce qui la concerne. La distinction n'est pas décorative — c'est elle qui
 * garantit qu'un client ne peut pas lire la commande d'un autre, même si le
 * modèle est amené à demander une référence qui ne lui appartient pas. La
 * sécurité tient à la politique RLS, pas à l'obéissance du modèle.
 */
async function executer(
  sb: Client,
  nom: string,
  args: Record<string, unknown>,
  sbClient: Client,
): Promise<unknown> {
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
    case 'mes_commandes': {
      const reference = String(args.reference ?? '').trim();
      let q = sbClient
        .from('app_e08c374bc4_commandes_gp')
        .select(
          'reference_publique, statut, montant_total_fcfa, transporteur_choisi, delai_transporteur, numero_suivi, url_suivi, created_at, livree_le, reception_confirmee_le, ville_livraison',
        )
        .order('created_at', { ascending: false })
        .limit(10);
      if (reference) q = q.ilike('reference_publique', `%${reference}%`);
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      if (!data?.length) {
        return {
          commandes: [],
          note: reference
            ? "Aucune commande à cette référence sur ce compte. Vérifier que le client est connecté au compte qui a passé la commande."
            : "Ce compte n'a encore passé aucune commande.",
        };
      }
      return {
        commandes: data.map((c) => ({
          reference: c.reference_publique,
          etape: ETAPES_COMMANDE[c.statut as string] ?? c.statut,
          montant_fcfa: c.montant_total_fcfa,
          transporteur: c.transporteur_choisi,
          delai_annonce_par_le_transporteur: c.delai_transporteur,
          numero_de_suivi: c.numero_suivi,
          lien_de_suivi: c.url_suivi,
          passee_le: c.created_at,
          livree_le: c.livree_le,
          reception_confirmee_le: c.reception_confirmee_le,
          ville: c.ville_livraison,
        })),
      };
    }
    case 'mes_dossiers_transit': {
      const reference = String(args.reference ?? '').trim();
      const colonnes =
        'reference_publique, statut, description_produit, montant_total_devis_fcfa, mode_transport, created_at';

      const lire = async (table: string) => {
        let q = sbClient
          .from(table)
          .select(colonnes)
          .order('created_at', { ascending: false })
          .limit(8);
        if (reference) q = q.ilike('reference_publique', `%${reference}%`);
        const { data } = await q;
        return data ?? [];
      };

      const [imports, exports] = await Promise.all([
        lire('app_e08c374bc4_demandes_import'),
        lire('app_e08c374bc4_demandes_export'),
      ]);

      const mettreEnForme = (lignes: Record<string, unknown>[], sens: 'import' | 'export') =>
        lignes.map((d) => ({
          reference: d.reference_publique,
          sens,
          etape:
            (sens === 'import' ? ETAPES_IMPORT : ETAPES_EXPORT)[d.statut as string] ?? d.statut,
          marchandise: d.description_produit,
          mode: d.mode_transport,
          montant_devis_fcfa: d.montant_total_devis_fcfa,
          ouvert_le: d.created_at,
        }));

      const dossiers = [
        ...mettreEnForme(imports as Record<string, unknown>[], 'import'),
        ...mettreEnForme(exports as Record<string, unknown>[], 'export'),
      ];

      return dossiers.length
        ? { dossiers }
        : {
            dossiers: [],
            note: reference
              ? "Aucun dossier à cette référence sur ce compte."
              : "Ce compte n'a encore ouvert aucun dossier d'import ou d'export.",
          };
    }
    case 'passer_la_main': {
      const { data, error } = await sbClient.rpc('app_e08c374bc4_ouvrir_assistance', {
        p_sujet: String(args.sujet ?? 'Demande du client'),
        p_message: String(args.message ?? ''),
        p_reference: args.reference ? String(args.reference) : null,
        p_resume: args.resume ? String(args.resume) : null,
        p_urgence: String(args.urgence ?? 'normale'),
      });
      return error ? { erreur: error.message } : data;
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
    // Le second client rejoue exactement les droits de la personne connectée :
    // les politiques RLS s'appliquent, donc un outil ne peut rendre que ce
    // qu'elle a le droit de voir.
    const sbClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: autorisation } } },
    );
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

    // La place se réserve AVANT l'appel. Vérifier puis appeler puis écrire
    // laisserait deux requêtes simultanées passer toutes deux le contrôle, et
    // chacune coûte du crédit fournisseur.
    const { data: droit } = await sb.rpc('app_e08c374bc4_consommer_ia', {
      p_utilisateur: utilisateur.id,
      p_service: 'agent',
      p_modele: modele,
    });

    if (!droit?.autorise) {
      return json(
        {
          erreur: `Vous avez utilisé vos ${droit?.plafond ?? 0} questions du jour sur la formule ${droit?.libelle ?? 'Découverte'}. Passez à une formule supérieure pour continuer, ou revenez demain.`,
          quota_atteint: true,
          formule: droit?.formule ?? null,
          plafond: droit?.plafond ?? null,
        },
        429,
      );
    }
    const usageId: number | null = droit.usage_id ?? null;

    /** Rend le crédit quand l'appel n'a rien produit d'utile. */
    const mesurer = async (entree: number | null, sortie: number | null, outils: number, aboutie: boolean) => {
      if (usageId === null) return;
      await sb.rpc('app_e08c374bc4_mesurer_ia', {
        p_id: usageId,
        p_entree: entree,
        p_sortie: sortie,
        p_outils: outils,
        p_aboutie: aboutie,
      });
    };

    // Former l'assistant ne doit pas exiger un redéploiement. Le complément de
    // consigne se règle depuis l'écran d'administration : le fondateur y écrit
    // ce qu'il veut voir répondre — un tour de phrase, une marchandise à
    // écarter au démarrage, un délai à annoncer — et c'est pris en compte à la
    // question suivante.
    const complement = String(parametres.consigne_complement ?? '').trim();

    const consigne = [
      PERSONNAGE,
      complement ? `CONSIGNES DE LA MAISON, QUI PRIMENT SUR LE STYLE CI-DESSUS\n${complement}` : '',
      contexte ? `CONTEXTE : l'utilisateur écrit depuis « ${contexte} ».` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const contents = [
      ...historique.map((t) => ({ role: t.role, parts: [{ text: t.texte }] })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const outilsAppeles: string[] = [];
    // Les jetons se cumulent sur tous les tours : un chiffrage qui enchaîne
    // trois outils coûte trois appels, et c'est ce total qui décide du prix.
    let jetonsEntree = 0;
    let jetonsSortie = 0;
    const compter = (corps: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }) => {
      jetonsEntree += corps?.usageMetadata?.promptTokenCount ?? 0;
      jetonsSortie += corps?.usageMetadata?.candidatesTokenCount ?? 0;
    };

    for (let tour = 0; tour < 6; tour++) {
      const reponse = await appelerGoogle(modele, {
        system_instruction: { parts: [{ text: consigne }] },
        contents,
        tools: [{ function_declarations: OUTILS }],
        generationConfig: { maxOutputTokens: 4000 },
      });

      if (!reponse.ok) {
        console.error('agent amont', reponse.refus.statut, reponse.refus.genre);
        // Le fournisseur a refusé : la question n'a rien coûté, on rend le
        // crédit au lieu de facturer une panne au client.
        await mesurer(jetonsEntree, jetonsSortie, outilsAppeles.length, false);
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

      compter(reponse.corps);
      const candidat = reponse.corps?.candidates?.[0];
      const parts = candidat?.content?.parts ?? [];
      const appels = parts.filter((p: { functionCall?: unknown }) => p?.functionCall);

      if (appels.length === 0) {
        const texte = parts
          .map((p: { text?: string }) => p?.text ?? '')
          .join('')
          .trim();
        await mesurer(jetonsEntree, jetonsSortie, outilsAppeles.length, true);
        return json({
          reponse: texte || "Je n'ai pas de réponse utile à donner ici. Reformulez ?",
          outils: outilsAppeles,
          modele,
          restant: droit.restant ?? null,
        });
      }

      contents.push({ role: 'model', parts });

      const resultats = [];
      for (const p of appels) {
        const { name, args } = p.functionCall as { name: string; args: Record<string, unknown> };
        outilsAppeles.push(name);
        const sortie = await executer(sb, name, args ?? {}, sbClient);
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
      compter(conclusion.corps);
      const texte = (conclusion.corps?.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p?.text ?? '')
        .join('')
        .trim();
      if (texte) {
        await mesurer(jetonsEntree, jetonsSortie, outilsAppeles.length, true);
        return json({ reponse: texte, outils: outilsAppeles, modele, restant: droit.restant ?? null });
      }
    }

    await mesurer(jetonsEntree, jetonsSortie, outilsAppeles.length, false);
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
