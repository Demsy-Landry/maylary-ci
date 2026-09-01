/**
 * Relever TOUTES les déclinaisons d'un article, et pas seulement la première.
 *
 * CE QUE ÇA RÉPARE
 *
 * L'import ne gardait qu'une déclinaison par article : `variants[0]`, la
 * première que le fournisseur renvoyait. Relevé le 31 août sur « Robe fleurie
 * col V » : quinze déclinaisons existaient — trois couleurs fois cinq tailles —
 * et nous vendions « Color-S ». Toute cliente aurait reçu un S.
 *
 * Cette fonction rattrape le catalogue existant et sert de filet pour la suite :
 * elle reprend les articles dont les déclinaisons n'ont jamais été relevées.
 *
 * POURQUOI UNE FONCTION SÉPARÉE DE L'IMPORT
 *
 * Le fournisseur plafonne à un appel par seconde, et l'import en consomme déjà
 * un par article. Y ajouter le relevé doublerait la durée d'un import déjà
 * lent, et un incident réseau au milieu perdrait l'article entier. Séparées,
 * les deux étapes se relancent indépendamment : un relevé raté se rejoue sans
 * toucher à l'article.
 *
 * CE QU'ELLE NE FAIT PAS
 *
 * Elle ne touche NI aux prix de vente, NI à `paliers_calcules_le`. La
 * tarification a son propre moteur et sa propre cadence. Le seul champ qu'elle
 * écrit sur l'article est `declinaisons_relevees_le`, qui dit « déjà demandé ».
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
  return t?.access_token && new Date(t.expire_le) > new Date() ? t.access_token : null;
}

/**
 * Ce qui ressemble à une taille, et non à une couleur.
 *
 * On y trouve les tailles de vêtement (S à 5XL), les tailles chiffrées
 * (chaussures, bagues, 38, 40…), et les mentions de taille unique. Un mot qui
 * ne rentre pas ici est traité comme une couleur — c'est le bon défaut : une
 * couleur mal prise pour une taille rendrait le choix incompréhensible, alors
 * qu'une taille rangée en couleur reste lisible par le client.
 */
const MOTIF_TAILLE =
  /^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL|[2-9]XL|ONE ?SIZE|ONESIZE|FREE ?SIZE|F|\d{1,3}(\.\d)?|\d{2}-\d{2}|EU ?\d{2}|US ?\d{1,2}|UK ?\d{1,2})$/i;

/**
 * Les couleurs, en français.
 *
 * Le fournisseur écrit en anglais, et souvent en un seul mot collé
 * (« LightBlue »). La vitrine est en français : afficher « DarkGreen » à une
 * cliente d'Abidjan n'a pas de sens.
 *
 * Ce qui n'est pas dans cette table est recopié tel quel plutôt qu'effacé —
 * mieux vaut un mot anglais qu'une case vide. Et la valeur d'origine est
 * conservée à part, dans `couleur`, pour qu'on puisse toujours vérifier.
 */
const COULEURS: Record<string, string> = {
  red: 'Rouge', blue: 'Bleu', black: 'Noir', white: 'Blanc', green: 'Vert',
  pink: 'Rose', yellow: 'Jaune', purple: 'Violet', grey: 'Gris', gray: 'Gris',
  brown: 'Marron', orange: 'Orange', beige: 'Beige', navy: 'Bleu marine',
  'navy blue': 'Bleu marine', khaki: 'Kaki', wine: 'Bordeaux',
  'wine red': 'Bordeaux', burgundy: 'Bordeaux', apricot: 'Abricot',
  'sky blue': 'Bleu ciel', 'light blue': 'Bleu clair', 'dark blue': 'Bleu foncé',
  'light green': 'Vert clair', 'dark green': 'Vert foncé', 'army green': 'Vert kaki',
  'light pink': 'Rose clair', 'hot pink': 'Rose vif', 'light grey': 'Gris clair',
  'light gray': 'Gris clair', 'dark grey': 'Gris foncé', 'dark gray': 'Gris foncé',
  'light purple': 'Violet clair', coffee: 'Café', champagne: 'Champagne',
  silver: 'Argenté', gold: 'Doré', 'rose gold': 'Or rose', ivory: 'Ivoire',
  cream: 'Crème', turquoise: 'Turquoise', mint: 'Vert menthe',
  'mint green': 'Vert menthe', lavender: 'Lavande', peach: 'Pêche',
  nude: 'Nude', transparent: 'Transparent', clear: 'Transparent',
  leopard: 'Léopard', camouflage: 'Camouflage', denim: 'Denim',
  multicolor: 'Multicolore', multicolour: 'Multicolore',
  // `Color` est le mot fourre-tout du fournisseur quand une déclinaison est
  // imprimée ou bariolée. « Multicolore » est la lecture la moins fausse ; la
  // valeur d'origine reste dans `couleur` pour qui veut vérifier.
  color: 'Multicolore', colour: 'Multicolore',
  'as picture': 'Comme la photo', 'as shown': 'Comme la photo',
};

function traduireCouleur(brut: string | null): string | null {
  if (!brut) return null;
  // « LightBlue » -> « Light Blue », puis normalisation des séparateurs.
  const lisible = brut
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const cle = lisible.toLowerCase();
  if (COULEURS[cle]) return COULEURS[cle];
  // Première lettre en capitale, pour ne pas afficher « light blue » brut.
  return lisible.charAt(0).toUpperCase() + lisible.slice(1);
}

/**
 * Séparer la couleur de la taille dans une clé du fournisseur.
 *
 * Les clés s'écrivent « Couleur-Taille » (« Blue-2XL »), mais pas toujours :
 * certaines n'ont qu'une taille (« S »), d'autres qu'une couleur (« Red »), et
 * certaines couleurs contiennent elles-mêmes un tiret (« Blue-Green »).
 *
 * D'où la règle : on ne coupe QUE si le dernier morceau ressemble à une taille.
 * Sinon la clé entière est une couleur. C'est volontairement prudent.
 */
function analyserCle(cle: string | null): { couleur: string | null; taille: string | null } {
  if (!cle) return { couleur: null, taille: null };
  const morceaux = cle.split('-').map((m) => m.trim()).filter(Boolean);
  if (morceaux.length === 0) return { couleur: null, taille: null };

  const dernier = morceaux[morceaux.length - 1];
  if (MOTIF_TAILLE.test(dernier)) {
    const couleur = morceaux.slice(0, -1).join('-') || null;
    return { couleur, taille: dernier.toUpperCase().replace(/\s+/g, '') };
  }
  return { couleur: cle, taille: null };
}

const nombre = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v.replace(/[^\d.]/g, '')) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

Deno.serve(async (req) => {
  const corps = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const limite = Math.min(Number(corps.limite ?? 8), 20);
  /** Reprendre des articles déjà relevés — quand le fournisseur a changé sa gamme. */
  const rejouer = corps.rejouer === true;
  const produitIds = (corps.produit_ids ?? []) as string[];

  const token = await jeton();
  if (!token) return json({ erreur: 'Jeton CJ indisponible.' }, 503);

  const taux = await (async () => {
    const r = await fetch(
      `${URL_SB}/rest/v1/app_e08c374bc4_parametres_import?id=eq.1&select=taux_change_usd_fcfa`,
      { headers: sb },
    );
    const p = (await r.json().catch(() => []))?.[0];
    return Number(p?.taux_change_usd_fcfa ?? 600);
  })();

  const filtre = produitIds.length
    ? `?select=id,nom,reference_externe&id=in.(${produitIds.join(',')})`
    : `?select=id,nom,reference_externe&reference_externe=not.is.null&source_donnee=eq.import_cj_dropshipping` +
      (rejouer ? '' : '&declinaisons_relevees_le=is.null') +
      `&order=prix_achat_fcfa.desc&limit=${limite}`;

  const rListe = await fetch(`${URL_SB}/rest/v1/app_e08c374bc4_produits${filtre}`, { headers: sb });
  const articles = (await rListe.json().catch(() => [])) as
    { id: string; nom: string; reference_externe: string }[];

  if (articles.length === 0) {
    return json({ termine: true, traites: 0, message: 'Plus rien à relever.' });
  }

  const rapport: Record<string, unknown>[] = [];

  for (const a of articles) {
    const u = new URL(`${CJ}/product/query`);
    u.searchParams.set('pid', a.reference_externe);
    const r = await fetch(u, { headers: { 'CJ-Access-Token': token } });
    const d = await r.json().catch(() => null);
    await pause(1600);

    // Une fiche illisible n'est PAS une absence de déclinaison : on ne marque
    // rien, l'article sera repris au passage suivant. Marquer ici graverait un
    // incident réseau dans la base.
    if (!d?.result || !d?.data) {
      rapport.push({ nom: a.nom, etat: 'à reprendre', motif: String(d?.message ?? 'fiche illisible') });
      continue;
    }

    const variantes = (d.data.variants ?? []) as Record<string, unknown>[];
    if (variantes.length === 0) {
      rapport.push({ nom: a.nom, etat: 'aucune déclinaison', declinaisons: 0 });
      await fetch(`${URL_SB}/rest/v1/app_e08c374bc4_produits?id=eq.${a.id}`, {
        method: 'PATCH',
        headers: { ...sb, Prefer: 'return=minimal' },
        body: JSON.stringify({ declinaisons_relevees_le: new Date().toISOString() }),
      });
      continue;
    }

    const lignes = variantes
      .map((v, i) => {
        const vid = v.vid ? String(v.vid) : null;
        if (!vid) return null;
        const cle = v.variantKey ? String(v.variantKey) : null;
        const { couleur, taille } = analyserCle(cle);
        const prixUsd = nombre(v.variantSellPrice);
        const volumeMm3 = nombre(v.variantVolume);
        return {
          produit_id: a.id,
          reference_variante: vid,
          cle_source: cle,
          couleur,
          couleur_fr: traduireCouleur(couleur),
          taille,
          prix_achat_fcfa: prixUsd ? Math.round(prixUsd * taux) : null,
          poids_g: nombre(v.variantWeight),
          volume_cm3: volumeMm3 ? volumeMm3 / 1000 : null,
          photo_url: v.variantImage ? String(v.variantImage) : null,
          ordre: i,
          actif: true,
        };
      })
      .filter(Boolean);

    if (lignes.length === 0) {
      rapport.push({ nom: a.nom, etat: 'déclinaisons sans identifiant', declinaisons: 0 });
      continue;
    }

    const rIns = await fetch(`${URL_SB}/rest/v1/app_e08c374bc4_declinaisons`, {
      method: 'POST',
      headers: {
        ...sb,
        // Le fournisseur peut réordonner ou renommer sa gamme : on écrase la
        // ligne existante plutôt que d'en créer une seconde pour le même vid.
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(lignes),
    });

    if (!rIns.ok) {
      rapport.push({ nom: a.nom, etat: 'écriture refusée', detail: (await rIns.text()).slice(0, 140) });
      continue;
    }

    await fetch(`${URL_SB}/rest/v1/app_e08c374bc4_produits?id=eq.${a.id}`, {
      method: 'PATCH',
      headers: { ...sb, Prefer: 'return=minimal' },
      body: JSON.stringify({ declinaisons_relevees_le: new Date().toISOString() }),
    });

    const couleurs = [...new Set(lignes.map((l) => l!.couleur_fr).filter(Boolean))];
    const tailles = [...new Set(lignes.map((l) => l!.taille).filter(Boolean))];
    rapport.push({
      nom: a.nom,
      etat: 'relevé',
      declinaisons: lignes.length,
      couleurs: couleurs.length ? couleurs : null,
      tailles: tailles.length ? tailles : null,
    });
  }

  return json({ termine: false, traites: rapport.length, rapport });
});
