/**
 * La relève du suivi chez le transporteur.
 *
 * CE QU'ELLE FAIT, ET CE QU'ELLE NE FERA JAMAIS
 *
 * Elle demande au transporteur où en est un colis, et écrit ce qu'il répond.
 * Si le transporteur ne répond pas, ou répond « inconnu », elle n'écrit AUCUN
 * événement et laisse `derniere_reponse_le` où elle était. La frise dira alors
 * « pas de nouvelle depuis le … ».
 *
 * C'est la même règle que pour les taux du tarif : un statut de colis inventé
 * engage MayLary devant son client exactement comme un droit de douane inventé.
 * Un client à qui l'on annonce « en route vers Abidjan » sur la foi d'une
 * supposition organise sa trésorerie dessus.
 *
 * POURQUOI EN DENO ET PAS EN BASE
 *
 * Même raison que l'enrichissement du catalogue : `pg_net` met en file et un
 * travailleur d'arrière-plan vide la file par rafales, sans considération pour
 * les pauses. Mesuré sur CJ : douze requêtes espacées d'une seconde et demie,
 * onze refusées. Ici l'attente est réelle.
 *
 * INDÉPENDANTE DU FOURNISSEUR
 *
 * Le seul endroit qui connaît 17TRACK est `interrogerAgregateur`. Changer
 * d'agrégateur — AfterShip, TrackingMore — ne touche que cette fonction ; le
 * reste manipule une forme neutre. Un connecteur écrit autour d'un fournisseur
 * unique se réécrit entièrement le jour où l'on en change, et on en change.
 *
 * LA CLÉ
 *
 * `SUIVI_AGREGATEUR_CLE`, déposée par le fondateur dans les secrets du projet.
 * Elle n'apparaît nulle part ailleurs. Sans clé, la fonction le DIT au lieu de
 * faire semblant de fonctionner.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

const json = (corps: unknown, statut: number) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? '';
const CLE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLE_AGREGATEUR = Deno.env.get('SUIVI_AGREGATEUR_CLE') ?? '';

const AGREGATEUR = 'https://api.17track.net/track/v2.2';

async function sql(chemin: string, options: RequestInit = {}) {
  return fetch(`${URL_SUPABASE}/rest/v1/${chemin}`, {
    ...options,
    headers: {
      apikey: CLE_SERVICE,
      Authorization: `Bearer ${CLE_SERVICE}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
}

/** La forme neutre : ce que TOUT agrégateur doit savoir nous rendre. */
interface Releve {
  /** Vide quand le transporteur n'a rien à dire — ce n'est pas une erreur. */
  evenements: { libelle: string; lieu: string | null; survenu_le: string }[];
  /** Statut normalisé, ou null si l'agrégateur ne se prononce pas. */
  statut: string | null;
  eta: string | null;
  /** Renseigné quand l'appel a échoué : on écrit l'échec, pas une position. */
  erreur: string | null;
}

/**
 * Le vocabulaire de l'agrégateur, traduit dans le nôtre.
 *
 * Tout ce qui n'est pas reconnu rend `null` — donc ne touche pas au statut de
 * l'expédition. Deviner à partir d'un mot inconnu produirait exactement le
 * genre d'erreur qu'on cherche à éviter.
 */
const STATUTS: Record<string, string> = {
  InfoReceived: 'a_expedier',
  InTransit: 'en_transit',
  OutForDelivery: 'en_livraison',
  AvailableForPickup: 'en_livraison',
  Delivered: 'livree',
  Exception: 'incident',
  DeliveryFailure: 'incident',
};

/** Le seul endroit qui connaît 17TRACK. */
async function interrogerAgregateur(numero: string, code: string | null): Promise<Releve> {
  const vide: Releve = { evenements: [], statut: null, eta: null, erreur: null };

  const appel = async (chemin: string, corps: unknown) => {
    const r = await fetch(`${AGREGATEUR}/${chemin}`, {
      method: 'POST',
      headers: { '17token': CLE_AGREGATEUR, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    return { ok: r.ok, statut: r.status, corps: await r.json().catch(() => null) };
  };

  try {
    /* L'enregistrement est idempotent : un numéro déjà suivi rend une erreur
     * « déjà enregistré » qu'on ignore volontairement. */
    const inscription: Record<string, unknown> = { number: numero };
    if (code) inscription.carrier = code;
    await appel('register', [inscription]);
    await pause(1100);

    const { ok, statut, corps } = await appel('gettrackinfo', [{ number: numero }]);
    if (!ok) return { ...vide, erreur: `L'agrégateur a répondu ${statut}.` };

    const accepte = corps?.data?.accepted?.[0];
    if (!accepte) {
      const refus = corps?.data?.rejected?.[0]?.error?.message;
      return { ...vide, erreur: refus ? String(refus).slice(0, 200) : 'Numéro non reconnu.' };
    }

    const info = accepte.track_info ?? {};
    const fournisseur = info.tracking?.providers?.[0] ?? {};
    const brut = Array.isArray(fournisseur.events) ? fournisseur.events : [];

    const evenements = brut
      .map((e: Record<string, unknown>) => ({
        libelle: String(e.description ?? '').trim(),
        lieu: (e.location ? String(e.location).trim() : null) || null,
        survenu_le: String(e.time_iso ?? e.time_utc ?? ''),
      }))
      .filter((e: { libelle: string; survenu_le: string }) => e.libelle && e.survenu_le);

    const brutStatut = info.latest_status?.status ?? null;

    return {
      evenements,
      statut: brutStatut ? (STATUTS[String(brutStatut)] ?? null) : null,
      eta: info.time_metrics?.estimated_delivery_date?.from ?? null,
      erreur: null,
    };
  } catch (e) {
    return { ...vide, erreur: `Agrégateur injoignable : ${String(e).slice(0, 150)}` };
  }
}

/**
 * L'empreinte d'un événement.
 *
 * Une relève rejoue TOUT l'historique du transporteur à chaque appel. Sans
 * empreinte, la frise du client triplerait à chaque passage. Elle est bâtie
 * sur la date et le libellé, les deux seuls champs qu'un transporteur ne
 * réécrit pas.
 */
const empreinte = (survenu: string, libelle: string) =>
  `${survenu}|${libelle}`.slice(0, 300);

interface Expedition {
  id: string;
  numero: string;
  numero_suivi: string | null;
  transporteur_code: string | null;
  statut: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  /* Deux appelants légitimes : un administrateur qui relance à la main depuis
   * l'écran de suivi, et la tâche planifiée qui porte le secret de service. */
  const autorisation = req.headers.get('Authorization') ?? '';
  const parLaTache = autorisation === `Bearer ${CLE_SERVICE}` && CLE_SERVICE !== '';

  if (!parLaTache) {
    const verif = await fetch(`${URL_SUPABASE}/rest/v1/rpc/app_e08c374bc4_is_admin`, {
      method: 'POST',
      headers: {
        apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        Authorization: autorisation,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!verif.ok || (await verif.json()) !== true) {
      return json({ erreur: "Réservé à l'administration." }, 403);
    }
  }

  if (!CLE_AGREGATEUR) {
    /* On le dit franchement plutôt que de rendre « 0 expédition relevée », qui
     * ferait croire que tout va bien alors que rien n'est branché. */
    return json(
      {
        erreur:
          "Aucune clé d'agrégateur n'est déposée. Déposez SUIVI_AGREGATEUR_CLE " +
          'dans les secrets du projet, puis relancez.',
        clef_manquante: true,
      },
      503,
    );
  }

  let limite = 20;
  let cible: string | null = null;
  try {
    const corps = await req.json();
    const n = Number(corps?.limite);
    // Borné : au-delà, la fonction dépasse son temps d'exécution et le lot est
    // perdu. Plusieurs passages courts valent mieux qu'un long qui échoue.
    if (Number.isFinite(n) && n > 0) limite = Math.min(Math.floor(n), 30);
    if (typeof corps?.expedition_id === 'string') cible = corps.expedition_id;
  } catch {
    /* Corps absent : valeurs par défaut. */
  }

  /* Une expédition ciblée (relance à la main), sinon les plus anciennement
   * relevées. `nullsfirst` fait passer d'abord celles jamais interrogées. */
  const filtre = cible
    ? `id=eq.${cible}`
    : 'suivi_automatique=is.true&numero_suivi=not.is.null' +
      '&statut=in.(a_expedier,en_transit,arrive_ci,dedouanement,en_livraison)' +
      `&order=derniere_releve.asc.nullsfirst&limit=${limite}`;

  const r = await sql(
    `app_e08c374bc4_expeditions?select=id,numero,numero_suivi,transporteur_code,statut&${filtre}`,
  );
  const expeditions = (await r.json()) as Expedition[];

  let relevees = 0;
  let nouveaux = 0;
  let muettes = 0;
  const echecs: { numero: string; raison: string }[] = [];

  for (const [i, e] of expeditions.entries()) {
    if (!e.numero_suivi) continue;
    if (i > 0) await pause(1100);

    const releve = await interrogerAgregateur(e.numero_suivi, e.transporteur_code);
    relevees += 1;
    const maintenant = new Date().toISOString();

    if (releve.erreur) {
      echecs.push({ numero: e.numero, raison: releve.erreur });
      /* On note la TENTATIVE et l'échec, jamais une position. `derniere_reponse_le`
       * ne bouge pas : c'est elle qui permettra de dire au client depuis quand
       * le transporteur est muet. */
      await sql(`app_e08c374bc4_expeditions?id=eq.${e.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ derniere_releve: maintenant, releve_erreur: releve.erreur }),
      });
      continue;
    }

    if (releve.evenements.length > 0) {
      const lignes = releve.evenements.map((ev) => ({
        expedition_id: e.id,
        source: 'transporteur',
        libelle: ev.libelle.slice(0, 300),
        lieu: ev.lieu ? ev.lieu.slice(0, 200) : null,
        survenu_le: ev.survenu_le,
        empreinte: empreinte(ev.survenu_le, ev.libelle),
      }));
      /* `ignore-duplicates` s'appuie sur l'index unique de l'empreinte : les
       * événements déjà connus sont écartés sans erreur, les nouveaux entrent. */
      const insertion = await sql('app_e08c374bc4_expedition_evenements', {
        method: 'POST',
        headers: {
          Prefer: 'resolution=ignore-duplicates,return=representation',
        },
        body: JSON.stringify(lignes),
      });
      const ajoutes = await insertion.json().catch(() => []);
      if (Array.isArray(ajoutes)) nouveaux += ajoutes.length;
    } else {
      muettes += 1;
    }

    const maj: Record<string, unknown> = {
      derniere_releve: maintenant,
      derniere_reponse_le: maintenant,
      releve_erreur: null,
      maj_le: maintenant,
    };
    /* Le statut ne recule pas : un transporteur qui rejoue un vieil événement
     * ne doit pas faire repasser une expédition livrée en transit. Et un
     * statut non reconnu ne touche à rien. */
    if (releve.statut && releve.statut !== e.statut) {
      const ordre = ['a_expedier', 'en_transit', 'arrive_ci', 'dedouanement', 'en_livraison', 'livree'];
      const avant = ordre.indexOf(e.statut);
      const apres = ordre.indexOf(releve.statut);
      if (releve.statut === 'incident' || apres > avant) maj.statut = releve.statut;
    }
    if (releve.eta) maj.eta = releve.eta;

    await sql(`app_e08c374bc4_expeditions?id=eq.${e.id}`, {
      method: 'PATCH',
      body: JSON.stringify(maj),
    });
  }

  return json(
    {
      relevees,
      nouveaux_evenements: nouveaux,
      sans_nouvelle: muettes,
      echecs,
    },
    200,
  );
});
