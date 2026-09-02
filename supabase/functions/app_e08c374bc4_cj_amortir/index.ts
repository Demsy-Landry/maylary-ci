/**
 * Demander le fret à CJ, palier par palier, et en tirer le MODE d'acheminement.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️  UNE SEULE LIGNE DIFFÈRE ENTRE CE FICHIER ET LA FONCTION EN LIGNE
 *
 * L'import ci-dessous s'écrit `../_partage/amortir-le-fret.ts` dans le dépôt,
 * où le module partagé vit en un seul exemplaire. Au déploiement, les fichiers
 * sont mis à plat côte à côte et cette ligne devient `./amortir-le-fret.ts`.
 * C'est la SEULE différence tolérée. Tout le reste doit rester identique.
 *
 * Pourquoi c'est écrit si haut : ce fichier avait divergé. Le dépôt était resté
 * à une version simple pendant que la fonction en ligne gagnait le paramètre
 * `cible`, la résolution des variantes manquantes et l'assistant d'écriture.
 * Un correctif écrit sur la copie du dépôt, puis déployé tel quel, aurait effacé
 * tout cela — un correctif qui régresse est pire que pas de correctif. Le
 * 31 août, le fichier a donc été resynchronisé sur ce qui tournait vraiment,
 * AVANT d'y reporter la correction.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * LA RÈGLE, DITE PAR LE FONDATEUR
 *
 * « Le groupage à tous les coups doit être les articles qui ne sont pas pris en
 * charge par CJ. Lorsque les valeurs sont petites, mettre un achat minimum. »
 *
 * Le catalogue lui donnait tort : sur 73 articles en groupage, 36 pesaient
 * moins de deux kilos. On ne les avait pas mis en groupage — on avait omis de
 * demander à CJ, et une absence de question était traitée comme un refus.
 *
 * TROIS ÉTATS DE `fret_source`
 *
 *   `forfait`    jamais demandé.
 *   `cj_reel`    CJ a coté — porte-à-porte, avec la quantité minimum qui rend
 *                le fret tenable.
 *   `cj_refuse`  CJ interrogé à chaque palier, et n'a rien coté. Seul cas où le
 *                groupage s'impose.
 *
 * UN ÉCHEC RÉSEAU N'EST PAS UN REFUS
 *
 * Première version : `variantePour` rendait `null` sur n'importe quel incident
 * — dépassement de cadence compris — et l'appelant inscrivait `cj_refuse`.
 * Neuf articles légers ont ainsi été déclarés hors de portée de CJ alors que
 * personne ne le lui avait demandé. Vérifié à la main sur l'un d'eux : le
 * cadenas de 155 g a bel et bien une variante, et CJ répond « Success ».
 *
 * Deux corrections. D'abord une SECONDE TENTATIVE espacée, car un 429 est
 * passager par nature. Ensuite, quand même la seconde échoue, on ne conclut
 * plus au refus : l'article reste en `forfait`, c'est-à-dire « à redemander ».
 * Mieux vaut un article en attente qu'un article mal classé : le premier se
 * rattrape au passage suivant, le second est perdu.
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

/**
 * L'identifiant de variante, avec une seconde tentative.
 *
 * `null` ne veut PAS dire « pas de variante » : il veut dire « pas obtenue ».
 * L'appelant doit traiter ce cas comme une attente, jamais comme un refus.
 */
async function variantePour(pid: string, token: string): Promise<string | null> {
  for (let essai = 0; essai < 2; essai++) {
    if (essai > 0) await pause(3000);
    try {
      const u = new URL(`${CJ}/product/query`);
      u.searchParams.set('pid', pid);
      const r = await fetch(u, { headers: { 'CJ-Access-Token': token } });
      const d = await r.json().catch(() => null);
      if (!d?.result) continue;   // cadence dépassée, ou fiche momentanément illisible
      const v = (d?.data?.variants as Record<string, unknown>[] | undefined)?.[0];
      const vid = v?.vid ?? v?.variantSku ?? null;
      if (vid) return String(vid);
    } catch { /* on retente */ }
  }
  return null;
}

/** Le devis CJ pour un envoi de `quantite` pièces, en dollars, ou null. */
async function devisLot(vid: string, quantite: number, token: string, pays: string): Promise<number | null> {
  try {
    const res = await fetch(`${CJ}/logistic/freightCalculate`, {
      method: 'POST',
      headers: { 'CJ-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startCountryCode: 'CN', endCountryCode: pays, products: [{ quantity: quantite, vid }] }),
    });
    const data = await res.json().catch(() => null);
    const options = Array.isArray(data?.data) ? (data.data as Record<string, unknown>[]) : [];
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
  const limite = Math.min(Number(corps.limite ?? 4), 10);
  const simulation = corps.simulation === true;
  const rejuger = corps.rejuger === true;
  /**
   * `eteints`        hors ligne pour un motif de fret.
   * `jamais_cotes`   fret jamais demandé à CJ.
   * `sans_variante`  déclarés refusés alors que leur variante n'avait pas pu
   *                  être obtenue — la réparation du défaut ci-dessus.
   */
  const cible = ['jamais_cotes', 'sans_variante'].includes(String(corps.cible))
    ? String(corps.cible) : 'eteints';

  const token = await jetonCj();
  if (!token) return json({ erreur: 'Jeton CJ indisponible.' }, 503);

  const rParam = await fetch(`${URL_SB}/rest/v1/app_e08c374bc4_parametres_import?select=*&id=eq.1`, { headers: enTetesSb });
  const parametres = ((await rParam.json().catch(() => [])) as Record<string, unknown>[])[0] ?? {};
  /*
   * Les quantités à essayer viennent de la grille de remise, qui en est la
   * seule source depuis le 3 septembre. `parametres.paliers_quantite` portait
   * ce réglage auparavant ; deux sources auraient fini par se contredire.
   *
   * Le repli sur la grille historique ne sert qu'au cas où la table serait
   * vide : mieux vaut amortir sur des quantités approchées que ne rien coter.
   */
  const rGrille = await fetch(
    `${URL_SB}/rest/v1/app_e08c374bc4_grille_remise?select=quantite_min&actif=eq.true&order=quantite_min`,
    { headers: enTetesSb },
  );
  const grilleLue = ((await rGrille.json().catch(() => [])) as { quantite_min: number }[]) ?? [];
  const paliers = grilleLue.length > 0
    ? grilleLue.map((p) => Number(p.quantite_min))
    : [1, 5, 20, 50];
  /*
   * `ratio_fret_maximum` ne sert PLUS à décider de l'acheminement — voir le
   * commentaire plus bas. Il ne sert qu'à choisir la plus petite quantité qui
   * amortit le fret, ce qui reste utile pour renseigner une commande minimum.
   *
   * `seuil_commande_surveillee_fcfa` a été retiré d'ici avec le garde-fou qui
   * l'utilisait : il ne restait plus qu'à faire basculer en groupage des
   * articles de cent grammes que le transporteur acceptait de porter.
   */
  const ratioMax = Number(parametres.ratio_fret_maximum ?? 5);
  const taux = Number(parametres.taux_change_usd_fcfa ?? 600);
  const pays = String(parametres.pays_destination_code ?? 'CI');

  const champs = 'id,nom,reference_variante,reference_externe,prix_achat_fcfa,prix_unitaire_fcfa,indisponible_motif,actif';
  const fin = `&order=prix_achat_fcfa.desc&limit=${limite}`;

  const filtre =
    cible === 'jamais_cotes'
      ? `?select=${champs}&fret_source=eq.forfait&reference_externe=not.is.null${fin}`
      : cible === 'sans_variante'
        ? `?select=${champs}&fret_source=eq.cj_refuse&reference_variante=is.null&reference_externe=not.is.null${fin}`
        : `?select=${champs}&actif=is.false&reference_externe=not.is.null&indisponible_motif=in.(${
            rejuger
              ? 'fret_disproportionne,fret_non_cote,commande_minimum_trop_elevee,fret_non_amortissable'
              : 'fret_disproportionne,fret_non_cote,commande_minimum_trop_elevee'
          })${fin}`;

  const rListe = await fetch(`${URL_SB}/rest/v1/app_e08c374bc4_produits${filtre}`, { headers: enTetesSb });
  const aTraiter = (await rListe.json().catch(() => [])) as {
    id: string; nom: string; reference_variante: string | null; reference_externe: string;
    prix_achat_fcfa: number; prix_unitaire_fcfa: number;
    indisponible_motif: string | null; actif: boolean;
  }[];

  if (aTraiter.length === 0) return json({ termine: true, traites: 0, cible, message: 'Plus rien à traiter.' });

  const rapport: Record<string, unknown>[] = [];

  const ecrire = async (id: string, maj: Record<string, unknown>) => {
    const r = await fetch(`${URL_SB}/rest/v1/app_e08c374bc4_produits?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...enTetesSb, Prefer: 'return=representation' },
      body: JSON.stringify(maj),
    });
    const texte = await r.text().catch(() => '');
    let n = 0;
    try { n = (JSON.parse(texte) as unknown[]).length; } catch { n = 0; }
    return n > 0 ? null : `écriture sans effet (${r.status}) ${texte.slice(0, 110)}`;
  };

  for (const p of aTraiter) {
    let vid = p.reference_variante;
    if (!vid) {
      vid = await variantePour(p.reference_externe, token);
      await pause(1600);
      if (vid && !simulation) await ecrire(p.id, { reference_variante: vid });
    }

    // VARIANTE NON OBTENUE : on ne conclut RIEN. L'article repasse en
    // `forfait`, c'est-à-dire « à redemander ». Le classer refusé serait
    // affirmer, sur la foi d'un incident réseau, que CJ ne le porte pas.
    if (!vid) {
      rapport.push({ nom: p.nom, decision: 'à redemander', motif: 'variante non obtenue après deux tentatives' });
      if (!simulation) await ecrire(p.id, { fret_source: 'forfait' });
      continue;
    }

    const devis: { quantite: number; fret_lot_fcfa: number }[] = [];
    for (const q of paliers) {
      const usd = await devisLot(vid, q, token, pays);
      if (usd != null) devis.push({ quantite: q, fret_lot_fcfa: usd * taux });
      await pause(1600);
    }

    if (devis.length === 0) {
      rapport.push({ nom: p.nom, decision: 'groupage', motif: 'aucun palier coté par CJ' });
      if (!simulation) {
        const err = await ecrire(p.id, {
          mode_acheminement: 'groupage', fret_source: 'cj_refuse',
          cout_fret_fcfa: 0, indisponible_motif: null, actif: true,
        });
        if (err) rapport[rapport.length - 1].ecriture = err;
      }
      continue;
    }

    const a = amortirLeFret({ prixAchatFcfa: p.prix_achat_fcfa, devis, ratioFretMaximum: ratioMax })!;
    const commandeMinimum = (p.prix_unitaire_fcfa + a.fret_unitaire_fcfa) * a.quantite;

    /*
     * LE RAPPORT FRET/PRIX NE DÉCIDE PLUS DE L'ACHEMINEMENT.
     *
     * Cette fonction basculait en groupage tout article dont le fret unitaire
     * dépassait 1,5 fois son prix d'achat. Ce garde-fou avait un sens quand le
     * fret était INCLUS dans le prix de vente : un rapport élevé donnait alors
     * un prix invendable.
     *
     * Il ne l'est plus. `fret_inclus_dans_prix` est à faux : le transport est
     * coté sur le PANIER RÉEL au passage en caisse et facturé à part. Le
     * rapport calculé sur une pièce isolée ne dit donc plus rien du prix que le
     * client verra.
     *
     * Ce que ça donnait, mesuré le 2 septembre : 109 articles en groupage alors
     * que le fournisseur avait coté leur fret. Poids moyen : CENT TREIZE
     * GRAMMES. Prix moyen : 2 775 FCFA. Des chaînes de cheville et des boucles
     * d'oreilles envoyées attendre un départ maritime, quand leur poids dans un
     * colis est celui d'une enveloppe. Le fondateur l'a relevé dans ces termes :
     * « c'est quand même illogique ».
     *
     * LA RÈGLE, TELLE QU'IL L'A POSÉE
     *
     * « Le groupage à tous les coups doit être les articles qui ne sont pas pris
     * en charge par CJ ou DHL, ou par choix du client. »
     *
     * Donc : le transporteur cote, l'article part en porte-à-porte. Le
     * transporteur refuse, l'article va en groupage. Et le groupage reste
     * offert au client comme une OPTION — moins cher, plus lent — au lieu de
     * lui être imposé par un calcul qu'il ne voit pas.
     */
    rapport.push({
      nom: p.nom,
      etait: p.actif ? 'en ligne' : 'éteint',
      decision: 'porte-à-porte CJ',
      quantite_minimum: a.amorti ? a.quantite : null,
      fret_unitaire_fcfa: a.fret_unitaire_fcfa,
      ratio: Number(a.ratio.toFixed(2)),
      commande_minimum_fcfa: Math.round(commandeMinimum),
      fret_amorti: a.amorti,
      essais: a.essais,
    });

    if (simulation) continue;

    /*
     * LE TRANSPORTEUR A COTÉ : L'ARTICLE PART EN PORTE-À-PORTE.
     *
     * Il n'y a plus qu'un seul cas ici, et c'est ce qui rend la règle lisible :
     * si l'on est arrivé jusqu'à cette ligne, c'est qu'au moins un palier a été
     * coté. Le transporteur prend donc l'article. Le seul chemin vers le
     * groupage est celui d'au-dessus — aucun palier coté, c'est-à-dire un refus
     * franc du transporteur.
     *
     * LA QUANTITÉ MINIMUM N'EST IMPOSÉE QUE SI ELLE SERT VRAIMENT
     *
     * Quand le fret s'amortit, `a.quantite` est la PLUS PETITE quantité qui
     * fait passer le fret sous le plafond : elle a un sens, on l'inscrit.
     *
     * Quand il ne s'amortit pas, `amortirLeFret` rend sa meilleure tentative —
     * souvent cinquante pièces. L'inscrire imposerait au client un lot de
     * cinquante pour économiser un fret qui, de toute façon, ne figure plus
     * dans le prix. Ce serait une barrière à l'achat sans contrepartie. On
     * laisse alors la quantité minimum telle qu'elle est.
     */
    const maj: Record<string, unknown> = {
      mode_acheminement: 'cj_ddp',
      fret_source: 'cj_reel',
      cout_fret_fcfa: a.fret_unitaire_fcfa,
      indisponible_motif: null,
      actif: true,
      retarife_le: new Date().toISOString(),
    };
    if (a.amorti) maj.quantite_minimum = a.quantite;

    const err = await ecrire(p.id, maj);
    if (err) rapport[rapport.length - 1].ecriture = err;
  }

  return json({ termine: false, cible, traites: rapport.length, simulation, rapport });
});
