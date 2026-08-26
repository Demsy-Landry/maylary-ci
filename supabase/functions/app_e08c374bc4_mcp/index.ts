import { servirAvecCors } from '../_partage/cors.ts';
// Serveur MCP — les mains de l'agent MayLary Group.
//
// L'agent vit chez Anthropic. Il n'a aucun accès à la base : il ne connaît que
// les outils déclarés ici, et il ne peut rien faire d'autre. C'est le principe
// qui gouverne ce fichier : ce qu'on ne déclare pas n'existe pas pour lui.
//
// ---------------------------------------------------------------------------
// LA BARRIÈRE SUR L'ARGENT EST DU CODE, PAS UNE CONSIGNE
//
// Le fondateur a choisi que l'agent agisse seul « sauf sur l'argent ». Une
// consigne écrite dans un prompt se contourne : il suffit qu'un client bien
// tourné le lui demande, ou qu'un texte lu quelque part le lui suggère. Les
// opérations suivantes n'ont donc AUCUN outil dans ce serveur, et il n'y a
// aucun moyen de les atteindre depuis ici :
//
//   - confirmer un paiement, ou changer le montant reçu ;
//   - modifier un prix après paiement ;
//   - débloquer un reversement à un vendeur ;
//   - valider un devis à la place du client ;
//   - annuler ou supprimer un dossier, une commande, un compte ;
//   - signer une déclaration en douane.
//
// L'agent peut faire avancer un dossier dans la chaîne logistique, répondre à
// un client, chercher chez les fournisseurs, chiffrer. Il ne peut pas toucher
// à une somme.
//
// ---------------------------------------------------------------------------
// ACCÈS
//
// Un jeton unique, déposé par le fondateur dans les secrets Supabase sous
// MCP_TOKEN, et donné à l'agent au moment de le connecter. Ce jeton vaut accès
// à l'exploitation de la maison : il se traite comme un mot de passe.

// Les en-têtes d'autorisation sont posés par `servirAvecCors`, qui
// connaît l'origine de la demande. Ce qui reste ici est écrasé en sortie.
const enTetes = {
  'Access-Control-Allow-Headers': 'authorization, content-type, mcp-session-id, mcp-protocol-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

const PROTOCOLE = '2024-11-05';

interface Requete {
  jsonrpc: string;
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

const reponse = (id: unknown, result: unknown) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), { headers: enTetes });

const echec = (id: unknown, code: number, message: string) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }), {
    headers: enTetes,
  });

/** Les étapes que l'agent a le droit de poser lui-même. */
const ETAPES_IMPORT_PERMISES = [
  'en_cotation',
  'devis_envoye',
  'achat_effectue',
  'expedition_internationale',
  'arrivee_ci',
  'dedouanement',
  'transit_local',
  'livree',
];

const ETAPES_EXPORT_PERMISES = [
  'en_cotation',
  'devis_envoye',
  'collecte_effectuee',
  'dedouanement_export',
  'expedition_internationale',
  'arrivee_destination',
  'livree',
];

// Ni « paiement_confirme » ni « annulee » : la première touche à l'argent, la
// seconde efface un engagement pris avec un client.
const ETAPES_COMMANDE_PERMISES = ['en_preparation', 'expediee', 'livree'];

const OUTILS = [
  {
    name: 'tableau_de_bord',
    description:
      "L'état de la maison en un appel : dossiers d'import et d'export par étape, commandes, valeur engagée, alertes de délai. À appeler en premier pour savoir ce qui demande attention aujourd'hui.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'dossiers',
    description:
      "Liste les dossiers d'import et d'export de la maison, tous clients confondus. Filtrer par sens et par étape pour trouver ce qui est bloqué.",
    inputSchema: {
      type: 'object',
      properties: {
        sens: { type: 'string', description: "'import', 'export', ou vide pour les deux." },
        etape: { type: 'string', description: "Code d'étape exact, ou vide pour toutes." },
        limite: { type: 'number', description: 'Nombre de dossiers à rendre, 20 par défaut.' },
      },
    },
  },
  {
    name: 'commandes',
    description:
      'Liste les commandes de la boutique, tous clients confondus, avec leur étape, leur montant et leur transporteur.',
    inputSchema: {
      type: 'object',
      properties: {
        etape: { type: 'string', description: "Code d'étape exact, ou vide pour toutes." },
        limite: { type: 'number' },
      },
    },
  },
  {
    name: 'assistance_a_traiter',
    description:
      "Les demandes d'assistance que Le Déclarant a transmises à l'équipe et qui attendent une réponse humaine, avec ce qu'il avait déjà vérifié. Le délai annoncé au client est de 24 heures ouvrées.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'repondre_assistance',
    description:
      "Répond à une demande d'assistance et la marque résolue ou en cours. Écrire la réponse telle qu'elle a été faite au client, et par quel canal.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: "Identifiant de la demande, rendu par assistance_a_traiter." },
        reponse: { type: 'string', description: 'Ce qui a été répondu au client.' },
        statut: { type: 'string', description: "'resolue' ou 'en_cours'." },
      },
      required: ['id', 'reponse'],
    },
  },
  {
    name: 'avancer_dossier',
    description:
      "Fait avancer un dossier d'import ou d'export dans la chaîne logistique. N'accepte QUE les étapes opérationnelles : ni la validation du devis, qui appartient au client, ni l'annulation, qui appartient à un humain.",
    inputSchema: {
      type: 'object',
      properties: {
        reference: { type: 'string', description: 'Référence publique du dossier.' },
        etape: { type: 'string', description: "Nouvelle étape. Voir les étapes permises dans l'erreur si refus." },
        note: { type: 'string', description: "Ce qui justifie l'avancement, pour la trace." },
      },
      required: ['reference', 'etape'],
    },
  },
  {
    name: 'avancer_commande',
    description:
      "Fait avancer une commande boutique : préparation, expédition, livraison. Ne peut PAS confirmer un paiement ni annuler.",
    inputSchema: {
      type: 'object',
      properties: {
        reference: { type: 'string' },
        etape: { type: 'string', description: "'en_preparation', 'expediee' ou 'livree'." },
        numero_suivi: { type: 'string', description: "Numéro de suivi du transporteur, si l'étape est l'expédition." },
      },
      required: ['reference', 'etape'],
    },
  },
  {
    name: 'chercher_position_tarifaire',
    description:
      'Cherche une position tarifaire dans le corpus TEC UEMOA officiel. Le seul moyen légitime de connaître un taux de droit : il ne se cite jamais de mémoire.',
    inputSchema: {
      type: 'object',
      properties: { texte: { type: 'string' } },
      required: ['texte'],
    },
  },
  {
    name: 'liquider',
    description:
      "Calcule les droits et taxes d'une déclaration selon le régime douanier. Rend le détail poste par poste.",
    inputSchema: {
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
    name: 'recherches_sans_resultat',
    description:
      "Ce que les clients ont cherché et qu'on n'avait pas. C'est la liste, mesurée et non supposée, de ce qu'il faudrait mettre au catalogue.",
    inputSchema: { type: 'object', properties: { jours: { type: 'number' } } },
  },
  {
    name: 'donnees_manquantes',
    description:
      "L'état des données sur lesquelles la maison ne peut pas travailler : taux de fret, barèmes de transit non confirmés, positions APE. À consulter avant d'annoncer un prix — si la donnée manque, on ne chiffre pas.",
    inputSchema: { type: 'object', properties: {} },
  },
];

type Sortie = Record<string, unknown>;

async function executer(nom: string, args: Record<string, unknown>): Promise<Sortie> {
  const url = Deno.env.get('SUPABASE_URL')!;
  const cle = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const entete = { apikey: cle, Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' };

  const lire = async (chemin: string) => {
    const r = await fetch(`${url}/rest/v1/${chemin}`, { headers: entete });
    return await r.json().catch(() => null);
  };
  const appeler = async (fonction: string, corps: unknown) => {
    const r = await fetch(`${url}/rest/v1/rpc/${fonction}`, {
      method: 'POST',
      headers: entete,
      body: JSON.stringify(corps),
    });
    return await r.json().catch(() => null);
  };
  const modifier = async (chemin: string, corps: unknown) => {
    const r = await fetch(`${url}/rest/v1/${chemin}`, {
      method: 'PATCH',
      headers: { ...entete, Prefer: 'return=representation' },
      body: JSON.stringify(corps),
    });
    return { ok: r.ok, corps: await r.json().catch(() => null) };
  };

  const limite = Math.min(Math.max(Number(args.limite ?? 20) || 20, 1), 50);

  switch (nom) {
    case 'tableau_de_bord':
      return { tableau: await appeler('app_e08c374bc4_tableau_de_bord', {}) };

    case 'dossiers': {
      const etape = String(args.etape ?? '').trim();
      const sens = String(args.sens ?? '').trim();
      const colonnes =
        'reference_publique,statut,description_produit,pays_fournisseur,mode_transport,montant_total_devis_fcfa,created_at,updated_at';
      const filtre = etape ? `&statut=eq.${encodeURIComponent(etape)}` : '';

      const resultat: Sortie = {};
      if (sens !== 'export') {
        resultat.import = await lire(
          `app_e08c374bc4_demandes_import?select=${colonnes}${filtre}&order=updated_at.desc&limit=${limite}`,
        );
      }
      if (sens !== 'import') {
        resultat.export = await lire(
          `app_e08c374bc4_demandes_export?select=reference_publique,statut,description_produit,pays_destination,mode_transport,montant_total_devis_fcfa,created_at,updated_at${filtre}&order=updated_at.desc&limit=${limite}`,
        );
      }
      return resultat;
    }

    case 'commandes': {
      const etape = String(args.etape ?? '').trim();
      const filtre = etape ? `&statut=eq.${encodeURIComponent(etape)}` : '';
      return {
        commandes: await lire(
          `app_e08c374bc4_commandes_gp?select=reference_publique,statut,montant_total_fcfa,ville_livraison,transporteur_choisi,numero_suivi,created_at,livree_le${filtre}&order=created_at.desc&limit=${limite}`,
        ),
      };
    }

    case 'assistance_a_traiter':
      return {
        demandes: await lire(
          'app_e08c374bc4_demandes_assistance?select=id,sujet,message,resume_assistant,reference_liee,urgence,statut,created_at&statut=in.(ouverte,en_cours)&order=created_at.asc&limit=30',
        ),
        delai_annonce_au_client: 'sous 24 heures ouvrées',
      };

    case 'repondre_assistance': {
      const statut = String(args.statut ?? 'resolue');
      if (!['resolue', 'en_cours'].includes(statut)) {
        return { erreur: "Statut refusé. Seuls 'resolue' et 'en_cours' sont permis ici." };
      }
      const r = await modifier(`app_e08c374bc4_demandes_assistance?id=eq.${encodeURIComponent(String(args.id))}`, {
        reponse: String(args.reponse ?? ''),
        statut,
        traite_le: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return r.ok ? { fait: true, demande: r.corps } : { fait: false, motif: r.corps };
    }

    case 'avancer_dossier': {
      const etape = String(args.etape ?? '').trim();
      const reference = String(args.reference ?? '').trim();

      const estImport = reference.toUpperCase().includes('IMP');
      const permises = estImport ? ETAPES_IMPORT_PERMISES : ETAPES_EXPORT_PERMISES;
      const table = estImport ? 'app_e08c374bc4_demandes_import' : 'app_e08c374bc4_demandes_export';

      if (!permises.includes(etape)) {
        return {
          fait: false,
          motif:
            "Cette étape ne vous appartient pas. La validation d'un devis est un acte du client, et l'annulation un acte humain — aucune des deux ne peut être posée par l'agent.",
          etapes_permises: permises,
        };
      }

      const r = await modifier(
        `${table}?reference_publique=eq.${encodeURIComponent(reference)}`,
        {
          statut: etape,
          updated_at: new Date().toISOString(),
          ...(args.note ? { commentaire_admin_devis: String(args.note) } : {}),
        },
      );
      if (!r.ok) return { fait: false, motif: r.corps };
      if (!Array.isArray(r.corps) || r.corps.length === 0) {
        return { fait: false, motif: `Aucun dossier à la référence ${reference}.` };
      }
      return { fait: true, dossier: r.corps[0] };
    }

    case 'avancer_commande': {
      const etape = String(args.etape ?? '').trim();
      if (!ETAPES_COMMANDE_PERMISES.includes(etape)) {
        return {
          fait: false,
          motif:
            "Étape refusée. Confirmer un paiement ou annuler une commande touche à l'argent et à l'engagement pris : ces actes restent humains.",
          etapes_permises: ETAPES_COMMANDE_PERMISES,
        };
      }
      const r = await modifier(
        `app_e08c374bc4_commandes_gp?reference_publique=eq.${encodeURIComponent(String(args.reference))}`,
        {
          statut: etape,
          updated_at: new Date().toISOString(),
          ...(args.numero_suivi ? { numero_suivi: String(args.numero_suivi) } : {}),
          ...(etape === 'livree' ? { livree_le: new Date().toISOString() } : {}),
        },
      );
      if (!r.ok) return { fait: false, motif: r.corps };
      if (!Array.isArray(r.corps) || r.corps.length === 0) {
        return { fait: false, motif: 'Aucune commande à cette référence.' };
      }
      return { fait: true, commande: r.corps[0] };
    }

    case 'chercher_position_tarifaire':
      return {
        resultats: await appeler('app_e08c374bc4_tec_chercher', {
          p_texte: String(args.texte ?? ''),
          p_limite: 12,
        }),
      };

    case 'liquider':
      return {
        liquidation: await appeler('app_e08c374bc4_liquider_declaration', {
          p_lignes: args.lignes ?? [],
          p_fret_total: Number(args.fret_total ?? 0),
          p_assurance_total: Number(args.assurance_total ?? 0),
          p_poids_brut_total: null,
          p_regime: String(args.regime ?? '4000'),
        }),
      };

    case 'recherches_sans_resultat': {
      const jours = Math.min(Math.max(Number(args.jours ?? 30) || 30, 1), 365);
      const depuis = new Date(Date.now() - jours * 86_400_000).toISOString();
      return {
        recherches: await lire(
          `app_e08c374bc4_recherches_fournisseurs?select=recherche,trouves,cree_le&trouves=eq.0&cree_le=gte.${depuis}&order=cree_le.desc&limit=50`,
        ),
        lecture:
          "Chaque ligne est un client qui voulait acheter et n'a rien trouvé. C'est la meilleure liste de courses qui existe.",
      };
    }

    case 'donnees_manquantes': {
      const fret = await lire('app_e08c374bc4_taux_fret?select=id&limit=1');
      const transit = await lire('app_e08c374bc4_frais_transit_local?select=libelle,nature');
      const nonConfirmes = Array.isArray(transit)
        ? transit.filter((f: { nature?: string }) => f.nature !== 'officiel').map((f: { libelle?: string }) => f.libelle)
        : [];
      return {
        taux_de_fret_charges: Array.isArray(fret) ? fret.length : 0,
        postes_de_transit_non_confirmes: nonConfirmes,
        consequence:
          "Tant que ces données manquent, le moteur REFUSE de totaliser un devis, et c'est voulu. Ne jamais combler le trou par une estimation : dire ce qui manque et proposer de le demander à la compagnie.",
      };
    }

    default:
      return { erreur: `Outil inconnu : ${nom}` };
  }
}

servirAvecCors(async (requete) => {
  if (requete.method === 'OPTIONS') return new Response('ok', { headers: enTetes });

  const attendu = (Deno.env.get('MCP_TOKEN') ?? '').trim();
  if (!attendu) {
    return echec(null, -32001, 'Le serveur MCP n’est pas configuré : MCP_TOKEN absent des secrets.');
  }
  const presente = (requete.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (presente !== attendu) return echec(null, -32001, 'Jeton refusé.');

  let corps: Requete;
  try {
    corps = await requete.json();
  } catch {
    return echec(null, -32700, 'Requête illisible.');
  }

  switch (corps.method) {
    case 'initialize':
      return reponse(corps.id, {
        protocolVersion: PROTOCOLE,
        capabilities: { tools: {} },
        serverInfo: { name: 'maylary-exploitation', version: '1.0.0' },
      });

    case 'notifications/initialized':
      return new Response(null, { status: 202, headers: enTetes });

    case 'ping':
      return reponse(corps.id, {});

    case 'tools/list':
      return reponse(corps.id, { tools: OUTILS });

    case 'tools/call': {
      const nom = String(corps.params?.name ?? '');
      const args = (corps.params?.arguments ?? {}) as Record<string, unknown>;
      if (!OUTILS.some((o) => o.name === nom)) {
        return echec(corps.id, -32602, `Outil inconnu : ${nom}`);
      }
      try {
        const sortie = await executer(nom, args);
        return reponse(corps.id, {
          content: [{ type: 'text', text: JSON.stringify(sortie, null, 1) }],
        });
      } catch (e) {
        console.error('mcp incident', nom, (e as Error)?.name);
        return reponse(corps.id, {
          content: [{ type: 'text', text: JSON.stringify({ erreur: "L'outil a échoué." }) }],
          isError: true,
        });
      }
    }

    default:
      return echec(corps.id ?? null, -32601, `Méthode non gérée : ${corps.method}`);
  }
});
