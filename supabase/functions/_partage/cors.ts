/**
 * Qui a le droit d'appeler nos fonctions depuis un navigateur.
 *
 * CE QU'EST LE CORS, ET CE QU'IL N'EST PAS
 *
 * Le CORS ne protège pas une fonction : il dit au NAVIGATEUR d'un visiteur
 * s'il a le droit de lire notre réponse. Un programme, un script, une commande
 * `curl` ne s'en soucient pas. La vraie protection reste le jeton — et elle
 * n'a pas bougé.
 *
 * Ce qu'il empêche est précis, et vaut la peine : qu'une page web hébergée
 * ailleurs, ouverte dans le navigateur d'un de nos clients connectés, appelle
 * nos fonctions en profitant de sa session et lise ce qu'elles répondent.
 *
 * POURQUOI L'ÉTOILE ÉTAIT UN DÉFAUT
 *
 * Vingt-trois fonctions répondaient `Access-Control-Allow-Origin: *` —
 * « n'importe quel site peut lire ma réponse ». C'est le réglage qu'on met
 * pour que ça marche pendant qu'on développe, et qu'on oublie de resserrer.
 *
 * LA RÈGLE ICI
 *
 * Trois cas, et trois seulement.
 *
 * 1. Pas d'en-tête `Origin` du tout. C'est un appel de serveur à serveur : nos
 *    tâches planifiées, la base qui déclenche un traitement, un webhook. Le
 *    CORS ne s'applique pas, on ne renvoie aucun en-tête, et la requête passe.
 *    CE CAS EST VITAL : nos automatismes horaires passent par là. Les casser
 *    arrêterait la cotation, la tarification et l'enrichissement du catalogue.
 *
 * 2. Origine connue. On la renvoie telle quelle — jamais l'étoile, qui
 *    interdirait au navigateur d'envoyer les identifiants de session.
 *
 * 3. Origine inconnue. On ne renvoie pas d'en-tête. Le navigateur du visiteur
 *    refusera de lui montrer la réponse. La fonction, elle, a déjà refusé
 *    l'appel bien avant, faute de jeton valable.
 *
 * `Vary: Origin` est indispensable : sans lui, un cache intermédiaire pourrait
 * servir à un site la réponse autorisée d'un autre.
 */

/**
 * Les domaines de la maison.
 *
 * `maylarygroup.ci` et son `www` sont servis tous les deux par l'hébergeur ;
 * un visiteur peut arriver par l'un ou par l'autre.
 */
const ORIGINES_FIXES = [
  'https://maylarygroup.ci',
  'https://www.maylarygroup.ci',
];

/**
 * Les adresses de prévisualisation et de développement.
 *
 * L'hébergeur crée une adresse par déploiement, en `.vercel.app` : les figer
 * une par une est impossible, on les reconnaît donc à leur forme. Et
 * `localhost` sert au développement local, sur n'importe quel port.
 *
 * Le motif est volontairement strict : il exige `https://` et une fin en
 * `.vercel.app`, pour qu'un domaine comme `maylarygroup.ci.attaquant.fr` ou
 * `evil-vercel.app.pirate.com` ne puisse pas se glisser dedans.
 */
const MOTIFS_ORIGINE = [
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/i,
  /^http:\/\/localhost(:\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/i,
];

function origineAutorisee(origine: string): boolean {
  if (ORIGINES_FIXES.includes(origine)) return true;
  return MOTIFS_ORIGINE.some((motif) => motif.test(origine));
}

/**
 * Les en-têtes CORS à joindre à une réponse, selon d'où vient la demande.
 *
 * À appeler avec la requête reçue. Renvoie un objet vide quand il n'y a rien
 * à autoriser — ce qui est le bon comportement, pas un échec.
 */
export function enTetesCors(req: Request): Record<string, string> {
  const origine = req.headers.get('Origin');

  // Cas 1 : appel de serveur à serveur. Rien à dire au navigateur, il n'y en
  // a pas. On ne renvoie rien et tout continue comme avant.
  if (!origine) return {};

  // Cas 3 : origine inconnue. On ne l'autorise pas, mais on répond quand même
  // `Vary` pour qu'aucun cache ne confonde cette réponse avec une autre.
  if (!origineAutorisee(origine)) return { Vary: 'Origin' };

  // Cas 2 : origine connue.
  return {
    'Access-Control-Allow-Origin': origine,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/**
 * La réponse à la question préalable que pose le navigateur avant un appel.
 *
 * Le navigateur envoie d'abord une requête `OPTIONS` pour demander s'il a le
 * droit. On répond 204 — « oui, et sans contenu ». Si l'origine n'est pas
 * connue, la réponse ne portera pas l'autorisation et le navigateur
 * s'arrêtera là.
 */
export function reponsePrevol(req: Request): Response {
  return new Response(null, { status: 204, headers: enTetesCors(req) });
}

/**
 * Poser la règle sur une fonction existante, sans toucher à ce qu'elle fait.
 *
 * POURQUOI UNE ENVELOPPE PLUTÔT QU'UNE RÉÉCRITURE
 *
 * Vingt-trois fonctions portaient l'étoile, écrites à cinq époques et selon
 * cinq habitudes différentes : `corsHeaders`, `enTetes`, `CORS`... Réécrire
 * l'intérieur de chacune, c'était vingt-trois occasions de casser une
 * fonction qui marche — sur du code qui touche aux commandes, aux paiements
 * et aux devis.
 *
 * Cette enveloppe se pose AUTOUR. Elle laisse la fonction répondre ce qu'elle
 * veut, puis remplace les en-têtes d'autorisation sur le chemin du retour.
 * Deux lignes changent dans chaque fichier : l'import, et `Deno.serve` qui
 * devient `servirAvecCors`. Le reste n'est pas touché, donc rien ne peut s'y
 * casser.
 *
 * L'étoile éventuellement posée par l'ancienne écriture est ÉCRASÉE : la
 * dernière valeur écrite gagne, et c'est la nôtre.
 *
 * ELLE RATTRAPE AUSSI LES PANNES
 *
 * Si la fonction lève une erreur non prévue, l'enveloppe répond 500 avec les
 * bons en-têtes plutôt que de laisser le navigateur devant une réponse sans
 * autorisation — ce qui afficherait au client « erreur CORS » au lieu de
 * « erreur serveur », et enverrait chercher la panne au mauvais endroit.
 */
export function servirAvecCors(
  handler: (req: Request) => Response | Promise<Response>,
): void {
  Deno.serve(async (req: Request) => {
    const cors = enTetesCors(req);

    // La question préalable du navigateur se règle ici, une fois pour toutes.
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    let reponse: Response;
    try {
      reponse = await handler(req);
    } catch (erreur) {
      console.log(JSON.stringify({ cors: 'handler_en_erreur', erreur: String(erreur) }));
      reponse = new Response(JSON.stringify({ error: 'Erreur interne du serveur.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // On recopie les en-têtes de la réponse, puis on impose les nôtres.
    const entetes = new Headers(reponse.headers);
    entetes.delete('Access-Control-Allow-Origin');
    entetes.delete('Access-Control-Allow-Headers');
    entetes.delete('Access-Control-Allow-Methods');
    for (const [cle, valeur] of Object.entries(cors)) entetes.set(cle, valeur);

    return new Response(reponse.body, {
      status: reponse.status,
      statusText: reponse.statusText,
      headers: entetes,
    });
  });
}
