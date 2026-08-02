/**
 * Accès à l'API CJ Dropshipping, partagé par l'import et la retarification.
 *
 * CJ plafonne à 1 appel par seconde et limite fortement la création de jetons :
 * tout appelant doit espacer ses requêtes et réutiliser un même jeton.
 */

export const CJ_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getCjAccessToken(): Promise<string | null> {
  const email = Deno.env.get('CJ_DROPSHIPPING_EMAIL');
  const apiKey = Deno.env.get('CJ_DROPSHIPPING_API_KEY');
  if (!email || !apiKey) return null;

  const res = await fetch(`${CJ_BASE_URL}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: apiKey }),
  });
  const data = await res.json().catch(() => null);
  return data?.data?.accessToken ?? null;
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
  try {
    const res = await fetch(`${CJ_BASE_URL}/logistic/freightCalculate`, {
      method: 'POST',
      headers: { 'CJ-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startCountryCode: 'CN',
        endCountryCode: paysDestination,
        products: [{ quantity: quantite, vid }],
      }),
    });
    const data = await res.json().catch(() => null);
    const options = Array.isArray(data?.data) ? data.data : [];
    if (options.length === 0) return null;

    const moinsChere = options.reduce((a: Record<string, unknown>, b: Record<string, unknown>) =>
      Number(a.logisticPrice) <= Number(b.logisticPrice) ? a : b,
    );
    const prix = Number(moinsChere.logisticPrice);
    if (!Number.isFinite(prix) || prix <= 0) return null;

    return {
      prix_usd: prix,
      transporteur: String(moinsChere.logisticName ?? 'CJ Dropshipping'),
      delai: moinsChere.logisticAging ? String(moinsChere.logisticAging) : null,
    };
  } catch {
    return null;
  }
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
