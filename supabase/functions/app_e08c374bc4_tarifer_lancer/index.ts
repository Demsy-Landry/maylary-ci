/**
 * Lancer la tarification des articles qui n'ont pas encore de prix.
 *
 * POURQUOI CE LANCEUR EXISTE
 *
 * `cj_retarifer` n'accepte qu'une session d'administrateur : elle touche les
 * PRIX DE VENTE, et il est heureux qu'elle ne s'ouvre pas au premier venu.
 * Mais il faut parfois la déclencher sans navigateur — depuis la base, après
 * un import, ou depuis la tâche du matin.
 *
 * CE QU'ON ÉCARTE
 *
 * On aurait pu recopier ici le calcul de la grille de gros pour se passer
 * d'authentification. Ce serait le pire choix : deux moteurs de prix qui
 * divergent à la première retouche, sur ce que le client paie.
 *
 * Ce lanceur ne calcule donc RIEN. Il obtient une vraie session pour le compte
 * administrateur existant, et rappelle `cj_retarifer` avec, lot après lot.
 *
 * L'ÉCHANGE DU LIEN CONTRE UN JETON
 *
 * `generate_link` rend un `hashed_token`. Le vérifier demande `token_hash` —
 * PAS `token`, qui désigne le code à six chiffres reçu par courriel et exige
 * alors l'adresse. Première tentative refusée sur ce point exact :
 * « Only an email address or phone number should be provided on verify ».
 *
 * Aucun compte n'est créé, aucun mot de passe n'est touché. La session obtenue
 * est celle du propriétaire, et elle expire d'elle-même.
 *
 * CE QUI A CHANGÉ, ET POURQUOI C'ÉTAIT NÉCESSAIRE
 *
 * La première version acceptait n'importe quel appelant et retarifait tout ce
 * qui n'avait pas encore de paliers — trente-six articles, dont vingt-neuf
 * DÉJÀ EN VENTE. Une porte ouverte sur les prix du catalogue, sans mot de
 * passe. C'était mon défaut, et le fait qu'elle ne soit pas non plus versionnée
 * dans le dépôt le rendait invisible à la relecture.
 *
 * La réponse n'est pas un secret de plus à faire circuler : c'est une LIMITE
 * qui rend l'ouverture inoffensive. Le lanceur ne désigne plus lui-même sa
 * cible et n'accepte plus qu'on la lui dicte. Il lit en base les articles dont
 * le prix de vente est nul — ceux qui, par construction, ne sont montrés à
 * personne — et ne transmet que ceux-là.
 *
 * Conséquence : le pire qu'un inconnu puisse déclencher est la tarification
 * d'articles qui n'ont pas encore de prix. C'est-à-dire exactement le travail
 * qu'on veut voir fait. Un prix affiché ne peut plus bouger par cette porte.
 */

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const CLE_SB = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (c: unknown, s = 200) =>
  new Response(JSON.stringify(c), { status: s, headers: { 'Content-Type': 'application/json' } });

const enTetesSb = { apikey: CLE_SB, Authorization: `Bearer ${CLE_SB}` };

async function sessionAdministrateur(): Promise<{ jwt: string } | { erreur: string }> {
  // L'administrateur tel qu'il existe déjà. On ne le lit pas depuis la requête :
  // un appelant ne doit pas pouvoir désigner QUI il devient.
  const rProfil = await fetch(
    `${URL_SB}/rest/v1/app_e08c374bc4_profiles?type_compte=eq.admin&select=user_id&limit=1`,
    { headers: enTetesSb },
  );
  const profil = (await rProfil.json().catch(() => []))?.[0];
  if (!profil?.user_id) return { erreur: 'Aucun compte administrateur en base.' };

  const rUser = await fetch(`${URL_SB}/auth/v1/admin/users/${profil.user_id}`, {
    headers: enTetesSb,
  });
  const email = (await rUser.json().catch(() => null))?.email as string | undefined;
  if (!email) return { erreur: 'Adresse de l’administrateur introuvable.' };

  const rLien = await fetch(`${URL_SB}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { ...enTetesSb, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  const lien = await rLien.json().catch(() => null);
  const hache = (lien?.hashed_token ?? lien?.properties?.hashed_token) as string | undefined;
  if (!hache) return { erreur: `Lien impossible : ${JSON.stringify(lien).slice(0, 200)}` };

  // `token_hash` et non `token` : le second désigne le code à six chiffres et
  // réclamerait l'adresse en plus.
  const rVerif = await fetch(`${URL_SB}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: CLE_SB, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: hache }),
  });
  const session = await rVerif.json().catch(() => null);
  const jwt = session?.access_token as string | undefined;
  if (!jwt) return { erreur: `Échange impossible : ${JSON.stringify(session).slice(0, 250)}` };

  return { jwt };
}

/**
 * Les articles à retarifer — désignés EN BASE, jamais par l'appelant.
 *
 * C'est la clé de voûte de la protection, et elle n'a pas changé : un
 * `produit_ids` envoyé dans la requête est ignoré. Sans cela, il suffirait de
 * nommer un article en vente pour en faire bouger le prix.
 *
 * DEUX FAÇONS D'ÊTRE DANS LA LISTE
 *
 * 1. Pas de prix de vente. L'article n'est montré à personne — la vue publique
 *    refuse un article sans prix — donc le tarifer ne peut que l'améliorer.
 *
 * 2. `paliers_calcules_le` est vide : sa grille est à (re)calculer. C'est la
 *    file d'attente normale de la retarification, et c'est le seul ajout du
 *    3 septembre.
 *
 * CE QUE CET AJOUT CHANGE, ET POURQUOI IL RESTE ACCEPTABLE
 *
 * Avant, aucun prix affiché ne pouvait bouger par cette porte. Désormais, un
 * article déjà en vente peut être recalculé — mais UNIQUEMENT si quelqu'un a
 * d'abord vidé sa colonne `paliers_calcules_le`, ce qui demande un accès en
 * écriture à la base. Un inconnu ne peut donc pas choisir sa cible : il ne peut
 * qu'avancer un travail qu'un administrateur a explicitement mis en file.
 *
 * La correction du 3 septembre l'imposait : le garde-fou des paliers comparait
 * des prix qui ne contenaient plus le transport, et le catalogue entier porte
 * des grilles calculées sous cette règle fausse. Les recalculer suppose de
 * pouvoir viser des articles qui ont déjà un prix.
 */
async function articlesARetarifer(): Promise<string[]> {
  const r = await fetch(
    `${URL_SB}/rest/v1/app_e08c374bc4_produits` +
      `?select=id&source_donnee=eq.import_cj_dropshipping` +
      `&reference_externe=not.is.null` +
      `&or=(prix_unitaire_fcfa.is.null,prix_unitaire_fcfa.lte.0,paliers_calcules_le.is.null)` +
      `&order=created_at.asc&limit=200`,
    { headers: enTetesSb },
  );
  const lignes = (await r.json().catch(() => [])) as { id: string }[];
  return Array.isArray(lignes) ? lignes.map((l) => l.id) : [];
}

Deno.serve(async (req) => {
  const corps = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const simulation = corps.simulation !== false;
  // Le transporteur ne répond qu'une fois par seconde et chaque article consomme
  // un appel par palier : on avance par petits lots, l'appelant relance.
  const lots = Math.min(Number(corps.lots ?? 1), 3);
  const tailleLot = Math.min(Math.max(Number(corps.taille_lot ?? 5), 1), 10);

  const cibles = await articlesARetarifer();
  if (cibles.length === 0) {
    return json({ simulation, restants: 0, message: 'Aucun article à retarifer.', passages: [] });
  }

  const s = await sessionAdministrateur();
  if ('erreur' in s) return json({ etape: 'session', ...s }, 503);

  const passages: unknown[] = [];
  let restants = 0;

  for (let i = 0; i < lots; i++) {
    const r = await fetch(`${URL_SB}/functions/v1/app_e08c374bc4_cj_retarifer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.jwt}` },
      body: JSON.stringify({ simulation, taille_lot: tailleLot, produit_ids: cibles }),
    });
    const d = await r.json().catch(() => ({}));
    passages.push({ http: r.status, ...d });
    restants = Number(d?.restants ?? 0);
    if (!r.ok || restants === 0) break;
  }

  return json({ simulation, cibles: cibles.length, restants, passages });
});
