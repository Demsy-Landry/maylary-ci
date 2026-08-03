/**
 * Accès à l'API CJ Dropshipping, partagé par l'import et la retarification.
 *
 * CJ plafonne à 1 appel par seconde et limite fortement la création de jetons :
 * tout appelant doit espacer ses requêtes et réutiliser un même jeton.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

export const CJ_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Table de cache du jeton, sans politique RLS : serveur uniquement. */
const TABLE_JETON = 'app_e08c374bc4_cj_jeton';

/**
 * Marge de renouvellement.
 *
 * On renouvelle un jour avant l'échéance plutôt qu'à la dernière minute : le
 * fournisseur n'accorde un jeton qu'une fois toutes les 300 secondes, donc
 * échouer au moment précis de l'expiration coûterait cinq minutes de service.
 */
const MARGE_RENOUVELLEMENT_MS = 24 * 60 * 60 * 1000;

/** Durée retenue quand le fournisseur n'annonce pas d'échéance. */
const DUREE_PAR_DEFAUT_MS = 10 * 24 * 60 * 60 * 1000;

function clientService() {
  const url = Deno.env.get('SUPABASE_URL');
  const cle = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return url && cle ? createClient(url, cle) : null;
}

async function demanderNouveauJeton(): Promise<{ token: string; expire: Date } | null> {
  const email = Deno.env.get('CJ_DROPSHIPPING_EMAIL');
  const apiKey = Deno.env.get('CJ_DROPSHIPPING_API_KEY');
  if (!email || !apiKey) return null;

  try {
    const res = await fetch(`${CJ_BASE_URL}/authentication/getAccessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: apiKey }),
    });
    const data = await res.json().catch(() => null);
    const token = data?.data?.accessToken;
    if (!token) return null;

    const annoncee = data?.data?.accessTokenExpiryDate;
    const expire = annoncee ? new Date(annoncee) : new Date(Date.now() + DUREE_PAR_DEFAUT_MS);
    return {
      token: String(token),
      expire: Number.isNaN(expire.getTime())
        ? new Date(Date.now() + DUREE_PAR_DEFAUT_MS)
        : expire,
    };
  } catch {
    return null;
  }
}

/**
 * Jeton d'accès au fournisseur, mis en cache et partagé par toutes les
 * fonctions.
 *
 * Le fournisseur ne délivre un jeton qu'une fois toutes les 300 secondes. Sans
 * cache, deux appels rapprochés — la relève du suivi et une transmission de
 * commande, par exemple — se privaient mutuellement de jeton et échouaient
 * toutes deux sous un message trompeur.
 */
export async function getCjAccessToken(): Promise<string | null> {
  const db = clientService();

  if (db) {
    const { data } = await db
      .from(TABLE_JETON)
      .select('access_token, expire_le')
      .eq('id', 1)
      .maybeSingle();

    if (data?.access_token) {
      const reste = new Date(String(data.expire_le)).getTime() - Date.now();
      if (reste > MARGE_RENOUVELLEMENT_MS) return String(data.access_token);
    }
  }

  const neuf = await demanderNouveauJeton();

  if (!neuf) {
    // Le renouvellement a échoué — souvent parce qu'on l'a demandé trop tôt.
    // Un jeton encore valable, même proche de l'échéance, vaut mieux que rien.
    if (db) {
      const { data } = await db
        .from(TABLE_JETON)
        .select('access_token, expire_le')
        .eq('id', 1)
        .maybeSingle();
      if (data?.access_token && new Date(String(data.expire_le)).getTime() > Date.now()) {
        return String(data.access_token);
      }
    }
    return null;
  }

  if (db) {
    await db.from(TABLE_JETON).upsert({
      id: 1,
      access_token: neuf.token,
      expire_le: neuf.expire.toISOString(),
      obtenu_le: new Date().toISOString(),
    });
  }
  return neuf.token;
}

export interface FretReel {
  prix_usd: number;
  transporteur: string;
  delai: string | null;
}

/**
 * Détail d'un produit CJ : prix fournisseur du jour, première variante, et
 * mesures d'encombrement.
 *
 * Le poids et le volume ne servent pas au fret aérien — le transporteur le
 * cote lui-même — mais ils commandent le fret maritime, qui se facture à
 * l'unité payante. Sans eux, un produit ne peut pas entrer en groupage.
 */
export async function obtenirDetailProduitCj(
  pid: string,
  token: string,
): Promise<{
  vid: string | null;
  prix_usd: number | null;
  poids_g: number | null;
  volume_cm3: number | null;
}> {
  try {
    const url = new URL(`${CJ_BASE_URL}/product/query`);
    url.searchParams.set('pid', pid);
    const detail = await (await fetch(url, { headers: { 'CJ-Access-Token': token } }))
      .json()
      .catch(() => null);

    const variante = detail?.data?.variants?.[0] ?? {};
    const vid = variante.vid ?? null;
    const prixBrut = Number(detail?.data?.sellPrice ?? variante.variantSellPrice);

    const poids = Number(variante.variantWeight ?? detail?.data?.packingWeight ?? 0);
    // Le fournisseur exprime le volume en mm³ ; on travaille en cm³.
    const volumeMm3 = Number(variante.variantVolume ?? 0);

    return {
      vid: vid ? String(vid) : null,
      prix_usd: Number.isFinite(prixBrut) && prixBrut > 0 ? prixBrut : null,
      poids_g: Number.isFinite(poids) && poids > 0 ? poids : null,
      volume_cm3: Number.isFinite(volumeMm3) && volumeMm3 > 0 ? volumeMm3 / 1000 : null,
    };
  } catch {
    return { vid: null, prix_usd: null, poids_g: null, volume_cm3: null };
  }
}

/**
 * Coût de transport réel du dépôt chinois jusqu'au pays du client, pour la
 * quantité demandée. On retient l'option la moins chère.
 *
 * Renvoie null à la moindre difficulté (variante absente, quota dépassé,
 * réseau) : l'appelant doit pouvoir retomber sur un fret forfaitaire.
 */
export async function obtenirFretReelCj(
  vid: string,
  token: string,
  paysDestination: string,
  quantite: number,
): Promise<FretReel | null> {
  return await obtenirFretReelLotCj([{ vid, quantite }], token, paysDestination);
}

/**
 * Même calcul, pour un panier de plusieurs références.
 *
 * Le transport se cote sur l'expédition entière : coter chaque ligne à part
 * paierait plusieurs fois la part fixe et désignerait un transporteur qui ne
 * sera pas celui du colis réellement formé.
 */
export async function obtenirFretReelLotCj(
  lignes: { vid: string; quantite: number }[],
  token: string,
  paysDestination: string,
): Promise<FretReel | null> {
  const options = await obtenirOptionsFretLotCj(lignes, token, paysDestination);
  return options.length > 0 ? options[0] : null;
}

/**
 * Toutes les options de transport pour une expédition, de la moins chère à la
 * plus chère.
 *
 * Retenir d'office la moins chère convient pour fixer un prix de vente, mais
 * pas pour servir un client : sur un même colis, l'écart mesuré va de 11,04 $
 * en 20-60 jours à 85,41 $ en 3-7 jours. C'est un arbitrage entre délai et
 * prix, et il appartient à celui qui paie.
 *
 * Une liste vide n'est pas une panne : le fournisseur répond bien, mais aucun
 * transporteur n'accepte cette combinaison de marchandises — un liquide mêlé à
 * un colis sec, typiquement. L'appelant doit traiter ce cas comme un refus
 * explicite, pas comme une indisponibilité passagère.
 */
export async function obtenirOptionsFretLotCj(
  lignes: { vid: string; quantite: number }[],
  token: string,
  paysDestination: string,
): Promise<FretReel[]> {
  if (lignes.length === 0) return [];
  try {
    const res = await fetch(`${CJ_BASE_URL}/logistic/freightCalculate`, {
      method: 'POST',
      headers: { 'CJ-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startCountryCode: 'CN',
        endCountryCode: paysDestination,
        products: lignes.map((l) => ({ quantity: l.quantite, vid: l.vid })),
      }),
    });
    const data = await res.json().catch(() => null);
    const brutes = Array.isArray(data?.data) ? (data.data as Record<string, unknown>[]) : [];

    return brutes
      .map((o) => ({
        prix_usd: Number(o.logisticPrice),
        transporteur: String(o.logisticName ?? 'CJ Dropshipping'),
        delai: o.logisticAging ? String(o.logisticAging) : null,
      }))
      .filter((o) => Number.isFinite(o.prix_usd) && o.prix_usd > 0)
      .sort((a, b) => a.prix_usd - b.prix_usd);
  } catch {
    return [];
  }
}

/** Réponse brute du fournisseur, ramenée à ce dont l'appelant a besoin. */
export interface ResultatCj<T> {
  ok: boolean;
  donnees: T | null;
  /** Message du fournisseur, à remonter tel quel : il dit quoi corriger. */
  message: string | null;
}

async function appelCj<T>(
  chemin: string,
  token: string,
  options: { methode?: 'GET' | 'POST'; corps?: unknown } = {},
): Promise<ResultatCj<T>> {
  try {
    const res = await fetch(`${CJ_BASE_URL}${chemin}`, {
      method: options.methode ?? 'GET',
      headers: { 'CJ-Access-Token': token, 'Content-Type': 'application/json' },
      body: options.corps ? JSON.stringify(options.corps) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (data?.code !== 200 || data?.result === false) {
      return { ok: false, donnees: null, message: String(data?.message ?? `HTTP ${res.status}`) };
    }
    return { ok: true, donnees: (data.data ?? null) as T, message: null };
  } catch (erreur) {
    return { ok: false, donnees: null, message: String(erreur) };
  }
}

/**
 * Solde du compte fournisseur, en dollars.
 *
 * Une commande ne peut pas être réglée sans provision : connaître le solde
 * avant d'envoyer évite de créer chez le fournisseur une commande impayée
 * qu'il faudrait aller supprimer à la main.
 */
export async function obtenirSoldeCj(token: string): Promise<number | null> {
  const r = await appelCj<{ amount: number }>('/shopping/pay/getBalance', token);
  const montant = Number(r.donnees?.amount);
  return r.ok && Number.isFinite(montant) ? montant : null;
}

export interface LigneCommandeCj {
  vid: string;
  quantite: number;
}

export interface AdresseLivraisonCj {
  nom: string;
  telephone: string;
  adresse: string;
  ville: string;
  province: string;
  code_pays: string;
  code_postal: string;
}

/**
 * Crée la commande chez le fournisseur.
 *
 * `orderNumber` reprend notre propre référence : c'est elle qui rend l'appel
 * rejouable sans risque. Si le réseau lâche après que le fournisseur a
 * enregistré la commande, un second envoi porte le même numéro et se fait
 * refuser pour doublon plutôt que de créer une seconde expédition.
 */
export async function creerCommandeCj(
  token: string,
  params: {
    reference: string;
    adresse: AdresseLivraisonCj;
    lignes: LigneCommandeCj[];
    transporteur: string | null;
    remarque?: string | null;
  },
): Promise<ResultatCj<{ orderId: string; orderNumber?: string }>> {
  return await appelCj('/shopping/order/createOrderV2', token, {
    methode: 'POST',
    corps: {
      orderNumber: params.reference,
      shippingZip: params.adresse.code_postal,
      shippingCountryCode: params.adresse.code_pays,
      shippingProvince: params.adresse.province,
      shippingCity: params.adresse.ville,
      shippingAddress: params.adresse.adresse,
      shippingCustomerName: params.adresse.nom,
      shippingPhone: params.adresse.telephone,
      remark: params.remarque ?? '',
      fromCountryCode: 'CN',
      logisticName: params.transporteur ?? undefined,
      products: params.lignes.map((l) => ({ vid: l.vid, quantity: l.quantite })),
    },
  });
}

/** Règle la commande sur le solde du compte. */
export async function payerCommandeCj(
  token: string,
  orderId: string,
): Promise<ResultatCj<unknown>> {
  return await appelCj('/shopping/pay/payBalance', token, {
    methode: 'POST',
    corps: { orderId },
  });
}

export interface EtatCommandeCj {
  statut: string | null;
  numero_suivi: string | null;
  transporteur: string | null;
  montant_usd: number | null;
}

/** État d'une commande chez le fournisseur : avancement et numéro de suivi. */
export async function obtenirEtatCommandeCj(
  token: string,
  orderId: string,
): Promise<EtatCommandeCj | null> {
  const r = await appelCj<Record<string, unknown>>(
    `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(orderId)}`,
    token,
  );
  if (!r.ok || !r.donnees) return null;
  const d = r.donnees;
  const montant = Number(d.orderAmount ?? d.orderWeightAmount);
  return {
    statut: d.orderStatus ? String(d.orderStatus) : null,
    numero_suivi: d.trackNumber ? String(d.trackNumber) : null,
    transporteur: d.logisticName ? String(d.logisticName) : null,
    montant_usd: Number.isFinite(montant) && montant > 0 ? montant : null,
  };
}

/**
 * Disponibilité d'une variante chez le fournisseur.
 *
 * Le stock est réparti entre plusieurs entrepôts ; on retient le total, seule
 * grandeur qui décide si l'article peut être vendu.
 *
 * Renvoie null quand la variante est inconnue ou que l'appel échoue : une
 * disponibilité inconnue ne doit jamais être confondue avec zéro, sous peine de
 * retirer de la vente un article qui s'y trouve légitimement.
 */
export async function obtenirStockVariante(
  vid: string,
  token: string,
): Promise<number | null> {
  try {
    const url = new URL(`${CJ_BASE_URL}/product/stock/queryByVid`);
    url.searchParams.set('vid', vid);
    const res = await fetch(url, { headers: { 'CJ-Access-Token': token } });
    const data = await res.json().catch(() => null);
    if (data?.code !== 200 || !Array.isArray(data?.data)) return null;

    const total = data.data.reduce((somme: number, entrepot: Record<string, unknown>) => {
      const n = Number(entrepot.storageNum ?? entrepot.countryStock ?? 0);
      return somme + (Number.isFinite(n) ? n : 0);
    }, 0);
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}
