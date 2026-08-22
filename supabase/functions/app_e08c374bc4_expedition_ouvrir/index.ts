/**
 * Ouvrir une expédition chez le transporteur.
 *
 * LE PENDANT DE LA RELÈVE
 *
 * `app_e08c374bc4_suivi_relever` sait DEMANDER où en est un colis. Cette
 * fonction-ci sait le FAIRE PARTIR. Entre les deux, il n'y avait que du travail
 * humain : rassembler les références, écrire au transporteur, recopier ce qu'il
 * répond dans un formulaire.
 *
 * MÊME DISCIPLINE QUE LA RELÈVE
 *
 * La relève n'invente jamais un statut : si le transporteur ne répond pas, elle
 * n'écrit rien et la frise dit « pas de nouvelle depuis le … ». Ici c'est
 * pareil, et l'enjeu est plus grand encore : un numéro de suivi inventé
 * remonterait jusqu'à l'écran du client, qui organiserait sa trésorerie dessus.
 *
 * Donc un connecteur qui n'obtient pas de référence rend `reference: null` et
 * DIT ce qu'il reste à faire. Il ne fabrique rien.
 *
 * TROIS CONNECTEURS, DEUX RÉALITÉS
 *
 *     consolidateur   aucune API n'existe à ce niveau de marché, et il ne faut
 *                     pas l'attendre : ce sont des PME qui travaillent sur
 *                     WeChat. Le connecteur automatise donc le RAPPROCHEMENT —
 *                     la marque d'expédition, le bloc de marquage, l'instruction
 *                     au fournisseur — et laisse à la main le seul geste qui
 *                     l'exige : coller le numéro de connaissement. Une fois par
 *                     expédition, pas une fois par commande.
 *
 *     dhl             une vraie API existe. Elle demande des identifiants que le
 *                     fondateur dépose lui-même dans les secrets du projet. Tant
 *                     qu'ils manquent, le connecteur le DIT — il ne fait pas
 *                     semblant de fonctionner.
 *
 *     cj              déjà branché ailleurs, dans la filière boutique.
 *
 * POURQUOI LE DIAGNOSTIC DHL EXISTE
 *
 * Le portail de documentation de DHL est inaccessible depuis l'atelier où cette
 * fonction a été écrite. Écrire la requête de mémoire produirait une
 * intégration qui échoue en silence — l'erreur exacte déjà commise sur une
 * autre API cette semaine. `diagnostic_dhl` interroge donc le bac à sable et
 * rend la réponse BRUTE : c'est la spécification lue à la source, et le
 * connecteur définitif s'écrira dessus.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const enTetes = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

const reponse = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...enTetes, 'Content-Type': 'application/json' },
  });

/* ------------------------------------------------------------------------ */
/* La marque, dupliquée depuis src/lib/expedition.ts                          */
/*                                                                            */
/* Volontairement : le serveur fait foi, le navigateur sert d'aperçu. Une      */
/* marque calculée côté client puis envoyée ici serait une marque qu'un        */
/* appelant peut choisir — et l'unicité en base ne protège que des collisions, */
/* pas des marques choisies exprès.                                           */
/* ------------------------------------------------------------------------ */

function marqueExpedition(numero: string, codeClient?: string | null): string {
  const reference = numero
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const prefixe = (codeClient ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
  return prefixe ? `${prefixe}/MLY-${reference}` : `MLY-${reference}`;
}

function blocMarquage(marque: string, numero: number, total: number): string {
  return [
    marque,
    "MAYLARY GROUP — ABIDJAN, COTE D'IVOIRE",
    `C/NO: ${numero} OF ${total}`,
    'MADE IN CHINA',
  ].join('\n');
}

interface Manque {
  champ: string;
  raison: string;
}

/**
 * La porte devant le transporteur.
 *
 * On n'ouvre pas avant le paiement : une réservation engage un enlèvement, et
 * un enlèvement annulé se facture. Et on n'ouvre pas sans les mesures — aucun
 * transporteur ne cote un colis dont il ignore le poids.
 */
function manquesOuverture(e: Record<string, unknown>, paye: boolean): Manque[] {
  const manques: Manque[] = [];
  const nombre = (v: unknown) => (v == null ? 0 : Number(v));

  if (!paye) {
    manques.push({
      champ: 'Paiement',
      raison: 'la réservation engage un enlèvement, et un enlèvement annulé se facture',
    });
  }
  if (!e.connecteur) {
    manques.push({
      champ: 'Transporteur',
      raison: 'aucun connecteur choisi : on ne sait pas à qui adresser la demande',
    });
  }
  if (nombre(e.nombre_colis) < 1) {
    manques.push({
      champ: 'Nombre de colis',
      raison: 'le marquage se numérote « 1 sur n » : sans n, il ne se compose pas',
    });
  }
  if (nombre(e.poids_brut_kg) <= 0) {
    manques.push({
      champ: 'Poids brut',
      raison: 'aucun transporteur ne cote un colis dont il ignore le poids',
    });
  }
  if (e.mode === 'maritime' && nombre(e.volume_m3) <= 0) {
    manques.push({
      champ: 'Volume',
      raison: "en maritime l'unité payante est le maximum du volume et de la tonne",
    });
  }
  return manques;
}

/* ------------------------------------------------------------------------ */
/* Le connecteur consolidateur : aucun réseau, et pourtant l'essentiel        */
/* ------------------------------------------------------------------------ */

interface Consolidateur {
  nom: string;
  ville: string | null;
  adresse_entrepot: string | null;
  code_client: string | null;
  contact_nom: string | null;
  contact_email: string | null;
  contact_telephone: string | null;
}

/**
 * Ce que le connecteur produit à la place d'un appel d'API.
 *
 * L'instruction est en anglais parce que c'est un fournisseur chinois qui la
 * lit. La traduire en français serait la rendre inutile — et c'est exactement
 * le genre de détail qui fait qu'un carton part à la mauvaise adresse.
 */
function instructionFournisseur(c: Consolidateur, marque: string, colis: number): string {
  return [
    'SHIPPING INSTRUCTION — MAYLARY GROUP',
    '',
    'Please deliver the goods to our consolidation warehouse:',
    '',
    c.nom + (c.ville ? `, ${c.ville}` : ''),
    c.adresse_entrepot ?? '[adresse d’entrepôt non renseignée]',
    c.contact_nom ? `Contact: ${c.contact_nom}` : '',
    c.contact_telephone ? `Tel: ${c.contact_telephone}` : '',
    '',
    'EVERY CARTON MUST BEAR THIS MARK:',
    '',
    marque,
    "MAYLARY GROUP — ABIDJAN, COTE D'IVOIRE",
    `C/NO: 1 OF ${colis}  ...  ${colis} OF ${colis}`,
    'MADE IN CHINA',
    '',
    'Unmarked cartons cannot be attributed and will be held at the warehouse.',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

/* ------------------------------------------------------------------------ */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: enTetes });

  /* Même garde que les autres fonctions d'administration. */
  const jeton = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jeton) return reponse({ erreur: 'Authentification requise.' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: utilisateur } = await supabase.auth.getUser(jeton);
  if (!utilisateur?.user) return reponse({ erreur: 'Session invalide.' }, 401);

  const { data: profil } = await supabase
    .from('app_e08c374bc4_profiles')
    .select('type_compte')
    .eq('user_id', utilisateur.user.id)
    .maybeSingle();
  if (profil?.type_compte !== 'admin') {
    return reponse({ erreur: 'Réservé à l’administration.' }, 403);
  }

  const corps = await req.json().catch(() => ({}));
  const action = corps.action ?? 'ouvrir';

  /* ---------------------------------------------------------------------- */
  /* Le diagnostic DHL : la spécification lue à la source                    */
  /* ---------------------------------------------------------------------- */

  if (action === 'diagnostic_dhl') {
    const cle = Deno.env.get('DHL_API_KEY') ?? '';
    const secret = Deno.env.get('DHL_API_SECRET') ?? '';
    const compte = Deno.env.get('DHL_COMPTE') ?? '';

    const etat = {
      cle_posee: cle.length > 0,
      secret_pose: secret.length > 0,
      compte_pose: compte.length > 0,
      compte_debut: compte ? compte.slice(0, 3) : null,
    };

    if (!cle || !secret) {
      return reponse({
        etat,
        conclusion:
          'Identifiants absents. Déposez DHL_API_KEY et DHL_API_SECRET dans les ' +
          'secrets du projet Supabase, puis relancez ce diagnostic.',
      });
    }

    /* Le bac à sable de MyDHL. On interroge un point de lecture — les temps de
       transit — plutôt qu'une création d'envoi : un diagnostic ne doit jamais
       laisser de trace facturable chez le transporteur. */
    const base = 'https://express.api.dhl.com/mydhlapi/test';
    const auth = 'Basic ' + btoa(`${cle}:${secret}`);
    const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const url =
      `${base}/rates?accountNumber=${encodeURIComponent(compte)}` +
      '&originCountryCode=CN&originCityName=Guangzhou' +
      '&destinationCountryCode=CI&destinationCityName=Abidjan' +
      '&weight=5&length=30&width=20&height=15' +
      `&plannedShippingDate=${demain}&isCustomsDeclarable=true&unitOfMeasurement=metric`;

    try {
      const r = await fetch(url, {
        headers: { Authorization: auth, 'Message-Reference': crypto.randomUUID() },
      });
      const texte = await r.text();
      return reponse({
        etat,
        http: r.status,
        /* La réponse BRUTE, tronquée. C'est elle la documentation : elle dit
           quels champs DHL attend et lesquels il refuse. */
        reponse_brute: texte.slice(0, 4000),
      });
    } catch (e) {
      return reponse({ etat, erreur_reseau: String(e) });
    }
  }

  /* ---------------------------------------------------------------------- */
  /* L'ouverture                                                             */
  /* ---------------------------------------------------------------------- */

  if (action !== 'ouvrir') return reponse({ erreur: 'Action inconnue.' }, 400);

  const expeditionId = corps.expedition_id;
  if (!expeditionId) return reponse({ erreur: 'expedition_id requis.' }, 400);

  const { data: exp, error } = await supabase
    .from('app_e08c374bc4_expeditions')
    .select('*')
    .eq('id', expeditionId)
    .maybeSingle();

  if (error || !exp) return reponse({ erreur: 'Expédition introuvable.' }, 404);

  /* Le paiement est affirmé par l'appelant administrateur, faute d'un chemin
     unique vers l'origine : une expédition peut naître d'une commande, d'une
     demande d'import ou d'un dossier, qui ne portent pas le paiement au même
     endroit. C'est un administrateur authentifié qui l'affirme, pas le client. */
  const paye = corps.paye === true;

  const manques = manquesOuverture(exp, paye);
  if (manques.length > 0) {
    return reponse({ ouverte: false, manquants: manques }, 200);
  }

  if (exp.reservation_statut === 'ouverte') {
    return reponse({
      ouverte: true,
      deja: true,
      reference: exp.reservation_reference,
      marque: exp.marque_expedition,
    });
  }

  /* ---- Connecteur consolidateur ---------------------------------------- */

  if (exp.connecteur === 'consolidateur') {
    const { data: conso } = await supabase
      .from('app_e08c374bc4_consolidateurs')
      .select('*')
      .eq('actif', true)
      .eq('code', corps.consolidateur_code ?? '')
      .maybeSingle();

    if (!conso) {
      return reponse({
        ouverte: false,
        manquants: [
          {
            champ: 'Consolidateur',
            raison:
              'aucun point de consolidation actif sous ce code : renseignez-en un ' +
              'dans l’administration avant d’ouvrir',
          },
        ],
      });
    }

    /* La marque est IMMUABLE une fois posée : si le fournisseur a déjà peint
       ses cartons, la changer ferait perdre le rapprochement. On réutilise
       donc celle qui existe plutôt que d'en recalculer une. */
    const marque =
      exp.marque_expedition ?? marqueExpedition(exp.numero, conso.code_client);

    const colis = Number(exp.nombre_colis);

    const { error: erreurMaj } = await supabase
      .from('app_e08c374bc4_expeditions')
      .update({
        marque_expedition: marque,
        reservation_statut: 'a_ouvrir',
        reservation_le: new Date().toISOString(),
        reservation_erreur: null,
      })
      .eq('id', expeditionId);

    if (erreurMaj) return reponse({ erreur: erreurMaj.message }, 500);

    return reponse({
      ouverte: false,
      reference: null,
      marque,
      bloc_marquage: blocMarquage(marque, 1, colis),
      instruction_fournisseur: instructionFournisseur(conso, marque, colis),
      /* Nommé, parce qu'un « il reste des choses à faire » ne se fait jamais. */
      a_faire_main: [
        `Transmettre l’instruction ci-dessus au fournisseur (${conso.nom}).`,
        'À réception du connaissement, coller son numéro dans « Référence de ' +
          'réservation » — le suivi démarrera seul.',
      ],
    });
  }

  /* ---- Connecteur DHL --------------------------------------------------- */

  if (exp.connecteur === 'dhl') {
    const cle = Deno.env.get('DHL_API_KEY') ?? '';
    const secret = Deno.env.get('DHL_API_SECRET') ?? '';
    if (!cle || !secret) {
      return reponse({
        ouverte: false,
        reference: null,
        a_faire_main: [],
        erreur:
          'Identifiants DHL absents. Déposez DHL_API_KEY et DHL_API_SECRET dans ' +
          'les secrets du projet Supabase.',
      });
    }
    /* Le connecteur définitif s'écrira sur la réponse de `diagnostic_dhl` :
       tant que la forme exacte de la requête n'a pas été vérifiée contre le
       bac à sable, envoyer une création d'envoi reviendrait à deviner. */
    return reponse({
      ouverte: false,
      reference: null,
      a_faire_main: [],
      erreur:
        'Connecteur DHL pas encore raccordé. Lancez « diagnostic_dhl » pour ' +
        'relever la forme exacte attendue par l’API, puis il sera écrit dessus.',
    });
  }

  return reponse({ erreur: `Connecteur « ${exp.connecteur} » inconnu.` }, 400);
});
