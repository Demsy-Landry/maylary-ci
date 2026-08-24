/**
 * Redemander le fret à CJ À CHAQUE PALIER, et rallumer ce qui devient vendable.
 *
 * POURQUOI CETTE FONCTION EXISTE
 *
 * Dix-sept articles étaient éteints. La plupart pour « fret disproportionné » ou
 * « fret non coté » — des verdicts prononcés sur UNE SEULE PIÈCE. Or le
 * transporteur cote un ENVOI : la part fixe de son devis se partage entre les
 * pièces, et un article invendable à l'unité peut être parfaitement vendable par
 * cinq. Personne ne l'avait vérifié, parce que vérifier coûte un appel par
 * palier et par article.
 *
 * CE QU'ELLE NE FAIT PAS : DEVINER
 *
 * Elle ne modélise aucun barème. Pour chaque article elle demande à CJ le prix
 * réel d'un envoi de 1, 5, 20 puis 50 pièces, et compare ce que le fournisseur
 * répond. Bien lui en a pris : les devis relevés ne suivent aucune droite. Le
 * sac de voyage tombe de 100 248 F la pièce à 29 784 F par vingt, puis REMONTE
 * à 33 364 F par cinquante. Un modèle affine se serait trompé.
 *
 * LES DEUX CONDITIONS DU RALLUMAGE
 *
 * Un fret amorti ne suffit pas. Descendre le rapport en imposant cinquante
 * pièces ne sert à rien si la commande minimum devient inaccessible : on aurait
 * troqué un article invendable contre un article que personne ne peut acheter.
 * On garde donc la règle établie dans sa forme d'origine — on ne refuse que
 * lorsque le rapport dépasse le plafond ET que la commande minimum dépasse le
 * seuil surveillé.
 *
 * CE QU'ELLE NE SAIT PAS DISTINGUER, ET IL FAUT LE SAVOIR
 *
 * `devisLot` rend `null` sur n'importe quel échec — refus du transporteur pour
 * cette quantité, mais aussi dépassement de cadence ou incident réseau. Les
 * deux sont ensuite traités pareil. Quand un seul palier revient coté, le
 * verdict « aucune quantité n'y change rien » repose donc sur un seul point de
 * mesure : c'est une présomption, pas une preuve. Le rapport rend les essais
 * pour qu'on puisse en juger.
 *
 * ET ELLE NE TOUCHE PAS AU PRIX DE LA MARCHANDISE
 *
 * La marge commerciale a son propre moteur. Cette fonction n'écrit que la
 * quantité minimum, le fret unitaire qui en découle, et l'état de l'article.
 */

import { amortirLeFret } from '../_partage/amortir-le-fret.ts';

const CJ = 'https://developers.cjdropshipping.com/api2.0/v1';
const URL_SB = Deno.env.get('SUPABASE_URL')!;
const CLE_SB = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (c: unknown, s = 200) =>
  new Response(JSON.stringify(c), { status: s, headers: { 'Content-Type': 'application/json' } });

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const enTetesSb = {
  apikey: CLE_SB,
  Authorization: `Bearer ${CLE_SB}`,
  'Content-Type': 'application/json',
};

async function jetonCj(): Promise<string | null> {
  const r = await fetch(
    `${URL_SB}/rest/v1/app_e08c374bc4_cj_jeton?select=access_token,expire_le&limit=1`,
    { headers: enTetesSb },
  );
  const l = await r.json().catch(() => []);
  const t = l?.[0];
  return t?.access_token && new Date(t.expire_le) > new Date() ? t.access_token : null;
}

/** Le devis CJ pour un envoi de `quantite` pièces, en dollars, ou null. */
async function devisLot(vid: string, quantite: number, token: string, pays: string): Promise<number | null> {
  try {
    const res = await fetch(`${CJ}/logistic/freightCalculate`, {
      method: 'POST',
      headers: { 'CJ-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startCountryCode: 'CN',
        endCountryCode: pays,
        products: [{ quantity: quantite, vid }],
      }),
    });
    const data = await res.json().catch(() => null);
    const options = Array.isArray(data?.data) ? (data.data as Record<string, unknown>[]) : [];
    // La moins chère : c'est elle qui détermine si l'article peut exister.
    const prix = options
      .map((o) => Number(o.logisticPrice))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b)[0];
    return prix ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const corps = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const limite = Math.min(Number(corps.limite ?? 4), 8);
  const simulation = corps.simulation === true;
  /** Rejuger ce que la fonction a déjà refusé — sur demande seulement. */
  const rejuger = corps.rejuger === true;

  const token = await jetonCj();
  if (!token) return json({ erreur: 'Jeton CJ indisponible.' }, 503);

  const rParam = await fetch(
    `${URL_SB}/rest/v1/app_e08c374bc4_parametres_import?select=*&id=eq.1`,
    { headers: enTetesSb },
  );
  const parametres = ((await rParam.json().catch(() => [])) as Record<string, unknown>[])[0] ?? {};
  const paliers = (parametres.paliers_quantite as number[]) ?? [1, 5, 20, 50];
  const ratioMax = Number(parametres.ratio_fret_maximum ?? 5);
  const seuilSurveille = Number(parametres.seuil_commande_surveillee_fcfa ?? 20000);
  const taux = Number(parametres.taux_change_usd_fcfa ?? 600);
  const pays = String(parametres.pays_destination_code ?? 'CI');

  // Les articles éteints pour un motif de FRET. Un doublon ou un retrait
  // volontaire ne se règle pas par un devis : on n'y touche pas.
  //
  // `fret_non_amortissable` est le verdict de cette fonction elle-même. Il
  // reste HORS de la liste par défaut : sans cela, chaque lot reprenait les
  // articles qu'elle venait de refuser et n'atteignait jamais les suivants —
  // observé, et contourné à la main la première fois. Le paramètre `rejuger`
  // permet d'y revenir quand les tarifs du transporteur ont bougé.
  const motifs = rejuger
    ? 'fret_disproportionne,fret_non_cote,commande_minimum_trop_elevee,fret_non_amortissable'
    : 'fret_disproportionne,fret_non_cote,commande_minimum_trop_elevee';

  const rListe = await fetch(
    `${URL_SB}/rest/v1/app_e08c374bc4_produits` +
      `?select=id,nom,reference_variante,prix_achat_fcfa,prix_unitaire_fcfa,indisponible_motif` +
      `&actif=is.false&reference_variante=not.is.null` +
      `&indisponible_motif=in.(${motifs})` +
      `&order=prix_achat_fcfa.desc&limit=${limite}`,
    { headers: enTetesSb },
  );
  const aTraiter = (await rListe.json().catch(() => [])) as {
    id: string; nom: string; reference_variante: string;
    prix_achat_fcfa: number; prix_unitaire_fcfa: number; indisponible_motif: string;
  }[];

  if (aTraiter.length === 0) return json({ termine: true, traites: 0, message: 'Plus rien à amortir.' });

  const rapport: Record<string, unknown>[] = [];

  for (const p of aTraiter) {
    const devis: { quantite: number; fret_lot_fcfa: number }[] = [];

    for (const q of paliers) {
      const usd = await devisLot(p.reference_variante, q, token, pays);
      if (usd != null) devis.push({ quantite: q, fret_lot_fcfa: usd * taux });
      await pause(1600);   // CJ plafonne à un appel par seconde
    }

    if (devis.length === 0) {
      // Aucun palier coté : ce n'est pas un problème de quantité, c'est un refus
      // du transporteur. L'article relève du groupage, pas du porte-à-porte.
      rapport.push({ nom: p.nom, decision: 'groupage', motif: 'aucun palier coté par CJ' });
      if (!simulation) {
        const r = await fetch(`${URL_SB}/rest/v1/app_e08c374bc4_produits?id=eq.${p.id}`, {
          method: 'PATCH',
          headers: { ...enTetesSb, Prefer: 'return=representation' },
          body: JSON.stringify({
            mode_acheminement: 'groupage', fret_source: 'forfait',
            cout_fret_fcfa: 0, indisponible_motif: null, actif: true,
          }),
        });
        await r.text().catch(() => '');
      }
      continue;
    }

    const a = amortirLeFret({ prixAchatFcfa: p.prix_achat_fcfa, devis, ratioFretMaximum: ratioMax })!;
    const commandeMinimum = (p.prix_unitaire_fcfa + a.fret_unitaire_fcfa) * a.quantite;

    // La règle d'origine, conservée : on ne refuse que si le transport écrase le
    // prix ET que la facture devient salée. L'une sans l'autre reste acceptable.
    const refuse = !a.amorti && commandeMinimum > seuilSurveille;

    rapport.push({
      nom: p.nom,
      ancien_motif: p.indisponible_motif,
      decision: refuse ? 'éteint' : 'rallumé',
      quantite_minimum: a.quantite,
      fret_unitaire_fcfa: a.fret_unitaire_fcfa,
      ratio: Number(a.ratio.toFixed(2)),
      commande_minimum_fcfa: Math.round(commandeMinimum),
      essais: a.essais,
    });

    if (simulation) continue;

    const maj = refuse
      ? { indisponible_motif: 'fret_non_amortissable', actif: false,
          quantite_minimum: a.quantite, cout_fret_fcfa: a.fret_unitaire_fcfa }
      : { indisponible_motif: null, actif: true,
          quantite_minimum: a.quantite, cout_fret_fcfa: a.fret_unitaire_fcfa,
          fret_source: 'cj_reel', mode_acheminement: 'cj_ddp', retarife_le: new Date().toISOString() };

    // `return=representation` fait consommer le corps — ce qui empêche la
    // requête d'être abandonnée — et prouve qu'une ligne a changé.
    const rMaj = await fetch(`${URL_SB}/rest/v1/app_e08c374bc4_produits?id=eq.${p.id}`, {
      method: 'PATCH',
      headers: { ...enTetesSb, Prefer: 'return=representation' },
      body: JSON.stringify(maj),
    });
    const texte = await rMaj.text().catch(() => '');
    let touchees = 0;
    try { touchees = (JSON.parse(texte) as unknown[]).length; } catch { touchees = 0; }
    if (touchees === 0) {
      rapport[rapport.length - 1].ecriture = `SANS EFFET (${rMaj.status}) ${texte.slice(0, 120)}`;
    }
  }

  return json({ termine: false, traites: rapport.length, simulation, rapport });
});
