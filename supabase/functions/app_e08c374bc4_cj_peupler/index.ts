/* ⚠️  CE FICHIER EST EN RETARD SUR LA FONCTION DÉPLOYÉE.
 *
 * La version en production est la v3 : deux actions (`chercher` / `importer`),
 * et le service des DEUX vitrines — Espace Pro par secteur, boutique par
 * catégorie. Ce fichier-ci est resté à la v1, qui importait sur un simple
 * mot-clé.
 *
 * La divergence vient d'un déploiement fait depuis un contenu en ligne plutôt
 * que depuis le dépôt. C'est exactement le piège qu'il ne faut pas laisser
 * s'installer, et il est signalé ici plutôt que tu : la fonction déployée fait
 * foi jusqu'à resynchronisation.
 */

/**
 * Peupler un rayon de l'Espace Pro depuis CJ, fiche complète du premier coup.
 *
 * POURQUOI UNE FONCTION DE PLUS
 *
 * L'import existant est fait pour la main : un article à la fois, choisi dans
 * un écran, sous session administrateur. Il fallait de quoi remplir seize
 * rayons — dont cinq entièrement vides et six sous les cinq articles.
 *
 * ELLE NE FIXE PAS LES PRIX, ET C'EST VOULU
 *
 * Relevé avant d'écrire une ligne : sur les 55 articles pro, 12 seulement
 * suivent la formule simple « achat × marge ». Les 43 autres sont tarifés par
 * la GRILLE DE GROS, qui redemande un devis de transport à chaque palier de
 * quantité. Recopier ici une formule simplifiée aurait donc produit des prix
 * incohérents avec les quatre cinquièmes du catalogue.
 *
 * Cette fonction dépose donc l'article INACTIF, avec `paliers_calcules_le` à
 * vide — exactement ce que `cj_retarifer` cherche pour travailler. C'est lui
 * qui fixe le prix, par le chemin déjà vérifié, et l'article ne paraît qu'une
 * fois tarifé.
 *
 * Un article invisible tant qu'il n'a pas de vrai prix vaut mieux qu'un article
 * en rayon avec un prix approximatif.
 *
 * UN SEUL APPEL DE DÉTAIL PAR ARTICLE
 *
 * L'ancienne chaîne appelait CJ pour importer, puis une seconde fois pour
 * enrichir. La fiche de détail contient déjà tout : prix, poids, volume,
 * photos, matière, emballage, description. On la lit une fois et on écrit un
 * article complet. Compte tenu du rythme que CJ tolère, diviser les appels par
 * deux double la vitesse de remplissage.
 *
 * CE QU'ELLE REFUSE D'IMPORTER
 *
 * Un article sans prix, sans photo, ou déjà au catalogue. Et — c'est le
 * garde-fou qui compte — un article dont le fret dépasse le rapport toléré :
 * inutile de remplir un rayon d'articles qu'on ne pourra pas vendre.
 *
 * LA POSITION TARIFAIRE DU FOURNISSEUR N'EST PAS REPRISE
 *
 * CJ la rend, et je l'avais gardée. Le fondateur a tranché : elle est saisie
 * par un fournisseur chinois pour SON export, elle n'engage rien envers la
 * douane ivoirienne, et posée près du moteur de liquidation elle finirait
 * recopiée. Une case vide oblige à classer ; une case fausse trompe.
 */

const CJ = 'https://developers.cjdropshipping.com/api2.0/v1';
const URL_SB = Deno.env.get('SUPABASE_URL')!;
const CLE_SB = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (c: unknown, s = 200) =>
  new Response(JSON.stringify(c), { status: s, headers: { 'Content-Type': 'application/json' } });

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const sb = {
  apikey: CLE_SB,
  Authorization: `Bearer ${CLE_SB}`,
  'Content-Type': 'application/json',
};

async function jeton(): Promise<string | null> {
  const r = await fetch(
    `${URL_SB}/rest/v1/app_e08c374bc4_cj_jeton?select=access_token,expire_le&limit=1`,
    { headers: sb },
  );
  const l = await r.json().catch(() => []);
  const t = l?.[0];
  if (t?.access_token && new Date(t.expire_le) > new Date()) return t.access_token;

  const email = (Deno.env.get('CJ_DROPSHIPPING_EMAIL') ?? '').trim();
  const cle = (Deno.env.get('CJ_DROPSHIPPING_API_KEY') ?? '').replace(/\s+/g, '');
  if (!email || !cle) return null;

  const a = await fetch(`${CJ}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: cle }),
  });
  const d = await a.json().catch(() => null);
  const token = d?.data?.accessToken as string | undefined;
  if (!token) return null;

  await fetch(`${URL_SB}/rest/v1/app_e08c374bc4_cj_jeton`, {
    method: 'POST',
    headers: { ...sb, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      id: 1,
      access_token: token,
      obtenu_le: new Date().toISOString(),
      expire_le: d?.data?.accessTokenExpiryDate
        ? new Date(String(d.data.accessTokenExpiryDate)).toISOString()
        : new Date(Date.now() + 12 * 24 * 3600 * 1000).toISOString(),
    }),
  });
  return token;
}

const nombre = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v.replace(/[^\d.]/g, '')) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Première valeur utile d'un champ que CJ rend parfois en tableau sérialisé. */
function premier(v: unknown): string | null {
  if (typeof v === 'string' && v.startsWith('[')) {
    try { const t = JSON.parse(v); return t?.[0] ? String(t[0]) : null; } catch { /* brut */ }
  }
  if (Array.isArray(v)) return v[0] ? String(v[0]) : null;
  return v ? String(v) : null;
}

/** Toutes les photos, dédoublonnées, la principale en tête. */
function imagesDe(data: Record<string, unknown>): string[] {
  const brut: unknown[] = [];
  const ajouter = (v: unknown) => {
    if (typeof v === 'string' && v.startsWith('[')) {
      try { brut.push(...JSON.parse(v)); return; } catch { /* pas du JSON */ }
    }
    if (Array.isArray(v)) brut.push(...v);
    else if (v) brut.push(v);
  };
  ajouter(data.bigImage ?? data.productImage);
  ajouter(data.productImageSet);

  const vues = new Set<string>();
  const propres: string[] = [];
  for (const u of brut) {
    if (typeof u !== 'string') continue;
    const url = u.trim();
    if (!url.startsWith('http') || vues.has(url)) continue;
    vues.add(url);
    propres.push(url);
  }
  return propres.slice(0, 12);
}

Deno.serve(async (req) => {
  const corps = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const secteurId = String(corps.secteur_id ?? '');
  const motCle = String(corps.mot_cle ?? '');
  const cible = Math.min(Number(corps.cible ?? 4), 8);

  if (!secteurId || !motCle) return json({ erreur: 'secteur_id et mot_cle requis.' }, 400);

  const token = await jeton();
  if (!token) return json({ erreur: 'Authentification CJ impossible.' }, 503);

  // ---- Les réglages de coût, jamais en dur ---------------------------------
  const rParam = await fetch(
    `${URL_SB}/rest/v1/app_e08c374bc4_parametres_import?id=eq.1&select=*`,
    { headers: sb },
  );
  const parametres = (await rParam.json().catch(() => []))?.[0];
  if (!parametres) return json({ erreur: 'Paramètres de coût illisibles.' }, 500);

  const rInco = await fetch(
    `${URL_SB}/rest/v1/app_e08c374bc4_parametres_incoterm?incoterm=eq.${parametres.incoterm_achat_defaut}&select=*`,
    { headers: sb },
  );
  const incoterm = (await rInco.json().catch(() => []))?.[0] ?? {
    part_fret: 1, assurance_a_charge: true,
  };

  // ---- L'enseigne du rayon -------------------------------------------------
  const rEns = await fetch(
    `${URL_SB}/rest/v1/app_e08c374bc4_enseignes?secteur_id=eq.${secteurId}&select=id&limit=1`,
    { headers: sb },
  );
  let enseigneId = (await rEns.json().catch(() => []))?.[0]?.id as string | undefined;

  if (!enseigneId) {
    // Un rayon sans enseigne ne peut rien recevoir : la contrainte de cohérence
    // l'interdit. On en crée une au nom de la maison plutôt que d'échouer.
    const rNouvelle = await fetch(`${URL_SB}/rest/v1/app_e08c374bc4_enseignes`, {
      method: 'POST',
      headers: { ...sb, Prefer: 'return=representation' },
      body: JSON.stringify({ nom: 'Maylary Import', secteur_id: secteurId, actif: true }),
    });
    enseigneId = (await rNouvelle.json().catch(() => []))?.[0]?.id;
    if (!enseigneId) return json({ erreur: 'Création de l’enseigne impossible.' }, 500);
  }

  // ---- Ce que CJ propose sur ce mot-clé ------------------------------------
  const urlListe = new URL(`${CJ}/product/list`);
  urlListe.searchParams.set('productNameEn', motCle);
  urlListe.searchParams.set('pageSize', '20');
  const rListe = await fetch(urlListe, { headers: { 'CJ-Access-Token': token } });
  const dListe = await rListe.json().catch(() => null);
  const candidats = (dListe?.data?.list ?? []) as Record<string, unknown>[];

  if (candidats.length === 0) {
    return json({ ajoutes: 0, motif: String(dListe?.message ?? 'aucun résultat'), mot_cle: motCle });
  }

  const ajoutes: { nom: string; prix: number; photos: number }[] = [];
  const ecartes: { nom: string; motif: string }[] = [];

  for (const c of candidats) {
    if (ajoutes.length >= cible) break;

    const pid = String(c.pid ?? c.productId ?? c.id ?? '');
    if (!pid) continue;

    // Déjà au catalogue : on ne crée pas de doublon.
    const rExiste = await fetch(
      `${URL_SB}/rest/v1/app_e08c374bc4_produits?reference_externe=eq.${pid}&select=id&limit=1`,
      { headers: sb },
    );
    if (((await rExiste.json().catch(() => [])) as unknown[]).length > 0) continue;

    // ---- La fiche complète, un seul appel -----------------------------------
    const urlDetail = new URL(`${CJ}/product/query`);
    urlDetail.searchParams.set('pid', pid);
    const rD = await fetch(urlDetail, { headers: { 'CJ-Access-Token': token } });
    const dD = await rD.json().catch(() => null);
    await pause(1600);

    const data = (dD?.data ?? null) as Record<string, unknown> | null;
    if (!data || !dD?.result) {
      ecartes.push({ nom: String(c.productNameEn ?? pid), motif: String(dD?.message ?? 'fiche illisible') });
      continue;
    }

    const nom = String(data.productNameEn ?? data.productName ?? c.productNameEn ?? '').trim();
    const prixUsd = nombre(data.sellPrice) ?? nombre(c.sellPrice) ?? nombre(c.sellPriceMin);
    const images = imagesDe(data);

    if (!nom || !prixUsd) { ecartes.push({ nom: nom || pid, motif: 'prix absent' }); continue; }
    if (images.length === 0) { ecartes.push({ nom, motif: 'aucune photo' }); continue; }

    const variante = (data.variants as Record<string, unknown>[] | undefined)?.[0] ?? {};
    const poids = nombre(data.packingWeight) ?? nombre(data.productWeight) ?? nombre(variante.variantWeight);
    const volumeMm3 = nombre(variante.variantVolume);

    const prixAchatFcfa = Math.round(prixUsd * Number(parametres.taux_change_usd_fcfa));

    // Le lot dilue la part fixe du transport ; cela n'a de sens que sous le
    // seuil du petit article, sinon on imposerait une commande minimum absurde.
    const quantiteMinimum =
      prixAchatFcfa < Number(parametres.seuil_petit_article_fcfa)
        ? Math.max(1, Math.round(Number(parametres.quantite_minimum_defaut)))
        : 1;

    // Le fret forfaitaire sert ICI d'unique usage : juger si l'article vaut la
    // peine d'entrer au catalogue. Il ne devient jamais un prix de vente — la
    // retarification le remplacera par un devis réel, palier par palier.
    const fretForfait = Math.round(
      Number(parametres.fret_base_article_fcfa) * Number(incoterm.part_fret),
    );
    const ratio = fretForfait / Math.max(prixAchatFcfa, 1);
    if (ratio > Number(parametres.ratio_fret_maximum)) {
      ecartes.push({ nom, motif: `fret ${ratio.toFixed(1)}× le prix d’achat` });
      continue;
    }

    const insertion = {
      nom,
      reference_externe: pid,
      espace: 'pro',
      enseigne_id: enseigneId,
      photos: images,
      prix_achat_fcfa: prixAchatFcfa,
      // Provisoire, et jamais montré : l'article est inactif jusqu'à la
      // retarification, qui écrira le vrai prix depuis la grille de gros.
      prix_unitaire_fcfa: 0,
      cout_fret_fcfa: fretForfait,
      cout_assurance_fcfa: 0,
      fret_source: 'forfait',
      paliers_calcules_le: null,
      quantite_minimum: quantiteMinimum,
      poids_unitaire_g: poids,
      volume_unitaire_cm3: volumeMm3 ? volumeMm3 / 1000 : null,
      matiere: premier(data.materialNameEn),
      emballage: premier(data.packingNameEn),
      description_fournisseur: data.description ? String(data.description).slice(0, 8000) : null,
      video_url: data.productVideo ? String(data.productVideo) : null,
      source_donnee: 'import_cj_dropshipping',
      // Aucune cotation réelle n'a été demandée : cet article relève du
      // groupage tant que CJ n'a pas coté son transport.
      mode_acheminement: 'groupage',
      enrichi_le: new Date().toISOString(),
      // Invisible tant qu'il n'a pas de vrai prix. Un rayon plus court vaut
      // mieux qu'un rayon dont les prix ne veulent rien dire.
      actif: false,
    };

    const rIns = await fetch(`${URL_SB}/rest/v1/app_e08c374bc4_produits`, {
      method: 'POST',
      headers: { ...sb, Prefer: 'return=minimal' },
      body: JSON.stringify(insertion),
    });

    if (rIns.ok) ajoutes.push({ nom, prix: prixAchatFcfa, photos: images.length });
    else ecartes.push({ nom, motif: (await rIns.text()).slice(0, 120) });
  }

  return json({ mot_cle: motCle, ajoutes: ajoutes.length, detail: ajoutes, ecartes });
});
