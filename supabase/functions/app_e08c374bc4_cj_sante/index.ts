/**
 * L'état de santé du catalogue : ce qui existe encore chez le fournisseur, et
 * ce qui n'existe plus.
 *
 * CE QUE ÇA RÉPARE
 *
 * Rien ne vérifiait qu'un article du catalogue existait toujours. Relevé le
 * 1er septembre : sur 513 articles importés, VINGT avaient été vérifiés une
 * fois — le 3 août. Les 493 autres étaient affichés « en stock » par défaut,
 * sans que personne ne l'ait jamais confirmé.
 *
 * Un fournisseur retire un article sans prévenir. Sans ce contrôle, on ne
 * l'apprend qu'au pire moment : quand un client a payé et que la commande part
 * en erreur. Le client a alors donné son argent pour un article qui n'existe
 * plus, et c'est nous qui portons la faute.
 *
 * UN SEUL APPEL PAR ARTICLE, ET C'EST UN CHOIX
 *
 * Le fournisseur plafonne à un appel par seconde. Le catalogue entier coûte
 * donc un quart d'heure de budget, étalé sur les passages horaires. Y ajouter
 * un second appel pour le stock doublerait ce coût — sans rien apporter, parce
 * que le passage en caisse interroge DÉJÀ le stock, en temps réel et ligne par
 * ligne, juste avant de valider. Ce contrôle-ci s'occupe de ce que la caisse ne
 * voit pas : la disparition pure et simple, et la dérive des prix.
 *
 * TROIS VERDICTS
 *
 *   `retiré`    la fiche n'existe plus chez le fournisseur. L'article sort de
 *               la vente, avec un motif qui dit pourquoi.
 *   `prix`      le prix d'achat a bougé au-delà du seuil toléré. L'article est
 *               remis dans la file de tarification : le moteur de prix le
 *               recalculera par le chemin normal, sans qu'on invente un montant
 *               ici.
 *   `revenu`    un article précédemment retiré est réapparu. Il retrouve la
 *               vente, à condition d'avoir un prix.
 *
 * CE QU'IL NE FAIT JAMAIS
 *
 * Il ne remplace pas un article disparu par un autre. Choisir un produit est un
 * acte commercial — le fondateur l'a posé en règle : « chaque produit doit être
 * examiné ». Le contrôle signale le vide, il ne le comble pas.
 *
 * ET IL NE CONFOND PAS UNE PANNE AVEC UNE DISPARITION
 *
 * Une fiche illisible pour cause de réseau, de cadence dépassée ou de jeton
 * expiré n'est PAS une disparition. Dans ce cas on ne touche à rien et on ne
 * marque même pas la date de vérification : l'article sera repris au passage
 * suivant. Retirer de la vente sur la foi d'un incident réseau serait bien pire
 * que de ne rien faire.
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

/**
 * Au-delà de cette dérive, le prix d'achat n'est plus celui sur lequel notre
 * prix de vente a été bâti. Quinze pour cent laisse passer les arrondis de
 * change et les micro-ajustements du fournisseur, et attrape les vraies
 * révisions de tarif.
 */
const DERIVE_PRIX_TOLEREE = 0.15;

async function jeton(): Promise<string | null> {
  const r = await fetch(
    `${URL_SB}/rest/v1/app_e08c374bc4_cj_jeton?select=access_token,expire_le&limit=1`,
    { headers: sb },
  );
  const l = await r.json().catch(() => []);
  const t = l?.[0];
  return t?.access_token && new Date(t.expire_le) > new Date() ? t.access_token : null;
}

const nombre = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v.replace(/[^\d.]/g, '')) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function ecrire(id: string, maj: Record<string, unknown>): Promise<string | null> {
  const r = await fetch(`${URL_SB}/rest/v1/app_e08c374bc4_produits?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...sb, Prefer: 'return=representation' },
    body: JSON.stringify(maj),
  });
  const texte = await r.text().catch(() => '');
  let n = 0;
  try { n = (JSON.parse(texte) as unknown[]).length; } catch { n = 0; }
  return n > 0 ? null : `écriture sans effet (${r.status}) ${texte.slice(0, 110)}`;
}

Deno.serve(async (req) => {
  const corps = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const limite = Math.min(Number(corps.limite ?? 15), 40);
  const simulation = corps.simulation === true;
  /** Reprendre aussi les articles déjà retirés, pour voir s'ils sont revenus. */
  const inclureRetires = corps.inclure_retires === true;

  const token = await jeton();
  if (!token) return json({ erreur: 'Jeton CJ indisponible.' }, 503);

  const rParam = await fetch(
    `${URL_SB}/rest/v1/app_e08c374bc4_parametres_import?id=eq.1&select=taux_change_usd_fcfa`,
    { headers: sb },
  );
  const taux = Number((await rParam.json().catch(() => []))?.[0]?.taux_change_usd_fcfa ?? 600);

  // Les moins récemment vérifiés d'abord, jamais vérifiés en tête. C'est ce qui
  // fait qu'un passage horaire finit par couvrir tout le catalogue, sans qu'on
  // ait à tenir un curseur ailleurs.
  /*
   * ⚠️ `not.eq` NE FAIT PAS CE QU'ON CROIT SUR UNE COLONNE VIDE.
   *
   * Écrit `indisponible_motif=not.eq.retire_par_le_fournisseur`, ce filtre
   * excluait aussi TOUTES les lignes dont le motif est vide — c'est-à-dire la
   * quasi-totalité du catalogue, puisqu'un article en bonne santé n'a pas de
   * motif. En SQL, `NULL <> 'x'` ne vaut pas « vrai » mais « inconnu », et
   * l'inconnu ne passe pas un filtre.
   *
   * Mesuré à la première simulation : dix articles demandés, UN SEUL contrôlé.
   * Le contrôle aurait tourné toutes les heures en ne regardant jamais que la
   * poignée d'articles déjà porteurs d'un motif — et aurait donné l'illusion
   * de veiller sur le catalogue.
   *
   * Il faut donc dire explicitement que le vide est acceptable.
   */
  const filtreRetires = inclureRetires
    ? ''
    : '&or=(indisponible_motif.is.null,indisponible_motif.neq.retire_par_le_fournisseur)';

  const rListe = await fetch(
    `${URL_SB}/rest/v1/app_e08c374bc4_produits` +
      `?select=id,nom,reference_externe,prix_achat_fcfa,prix_unitaire_fcfa,actif,indisponible_motif` +
      `&source_donnee=eq.import_cj_dropshipping&reference_externe=not.is.null` +
      filtreRetires +
      `&order=stock_verifie_le.asc.nullsfirst&limit=${limite}`,
    { headers: sb },
  );
  const articles = (await rListe.json().catch(() => [])) as {
    id: string; nom: string; reference_externe: string;
    prix_achat_fcfa: number | null; prix_unitaire_fcfa: number | null;
    actif: boolean; indisponible_motif: string | null;
  }[];

  if (articles.length === 0) {
    return json({ termine: true, controles: 0, message: 'Rien à contrôler.' });
  }

  const rapport: Record<string, unknown>[] = [];
  const maintenant = new Date().toISOString();

  for (const a of articles) {
    const u = new URL(`${CJ}/product/query`);
    u.searchParams.set('pid', a.reference_externe);
    const r = await fetch(u, { headers: { 'CJ-Access-Token': token } });
    const d = await r.json().catch(() => null);
    await pause(1600);

    const message = String(d?.message ?? '').toLowerCase();

    /*
     * DISTINGUER « N'EXISTE PLUS » DE « JE N'AI PAS PU LIRE »
     *
     * Le fournisseur répond `result: false` aussi bien pour une fiche supprimée
     * que pour une cadence dépassée. La différence est dans le message. On ne
     * retire de la vente QUE sur un message qui parle d'absence — et devant
     * n'importe quoi d'autre, on laisse l'article tranquille sans même noter la
     * date, pour qu'il repasse au tour suivant.
     */
    const ficheAbsente =
      d?.result === false &&
      /not exist|no data|not found|deleted|off shelf|removed|无此商品|不存在/.test(message);

    if (ficheAbsente) {
      rapport.push({ nom: a.nom, verdict: 'retiré', detail: message || 'fiche absente' });
      if (!simulation) {
        const err = await ecrire(a.id, {
          actif: false,
          indisponible_motif: 'retire_par_le_fournisseur',
          stock_disponible: 'rupture',
          stock_quantite: 0,
          stock_verifie_le: maintenant,
        });
        if (err) rapport[rapport.length - 1].ecriture = err;
      }
      continue;
    }

    if (!d?.result || !d?.data) {
      // Ni disponible, ni disparu : illisible. On ne conclut rien et on ne
      // marque pas la date, pour que l'article revienne au prochain passage.
      rapport.push({ nom: a.nom, verdict: 'à reprendre', detail: message || 'fiche illisible' });
      continue;
    }

    const prixUsd = nombre(d.data.sellPrice);
    const prixActuel = prixUsd ? Math.round(prixUsd * taux) : null;
    const ancien = a.prix_achat_fcfa ?? 0;
    const derive =
      prixActuel && ancien > 0 ? Math.abs(prixActuel - ancien) / ancien : 0;

    const maj: Record<string, unknown> = {
      stock_verifie_le: maintenant,
      stock_disponible: 'en_stock',
    };
    let verdict = 'inchangé';
    const detail: Record<string, unknown> = {};

    // Un article retiré à tort, ou revenu chez le fournisseur, retrouve la
    // vente — à condition d'avoir un prix. Sans prix, la vitrine le refuserait
    // de toute façon, et on le laisse à la tarification.
    if (a.indisponible_motif === 'retire_par_le_fournisseur') {
      if ((a.prix_unitaire_fcfa ?? 0) > 0) {
        maj.actif = true;
        maj.indisponible_motif = null;
        verdict = 'revenu';
      } else {
        maj.indisponible_motif = null;
        maj.paliers_calcules_le = null;
        verdict = 'revenu, à tarifer';
      }
    }

    if (derive > DERIVE_PRIX_TOLEREE && prixActuel) {
      // On n'écrit PAS le prix de vente ici. On remet l'article dans la file du
      // moteur de prix, qui refera le chemin complet — fret, assurance, marge,
      // plancher. Recalculer à la main dans deux endroits différents, c'est la
      // garantie que les deux finiront par diverger.
      maj.prix_achat_fcfa = prixActuel;
      maj.paliers_calcules_le = null;
      verdict = verdict === 'inchangé' ? 'prix à revoir' : `${verdict} + prix à revoir`;
      detail.prix_achat_avant = ancien;
      detail.prix_achat_apres = prixActuel;
      detail.derive_pct = Math.round(derive * 100);
    }

    rapport.push({ nom: a.nom, verdict, ...detail });
    if (!simulation) {
      const err = await ecrire(a.id, maj);
      if (err) rapport[rapport.length - 1].ecriture = err;
    }
  }

  const compte = (v: string) => rapport.filter((x) => String(x.verdict).startsWith(v)).length;

  return json({
    termine: false,
    controles: rapport.length,
    simulation,
    resume: {
      retires: compte('retiré'),
      prix_a_revoir: rapport.filter((x) => String(x.verdict).includes('prix')).length,
      revenus: compte('revenu'),
      a_reprendre: compte('à reprendre'),
      inchanges: compte('inchangé'),
    },
    rapport,
  });
});
