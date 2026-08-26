/**
 * Sourcing sur demande : un client décrit un article que le catalogue ne
 * contient pas, nous allons le chercher chez le fournisseur et lui proposons un
 * prix ferme.
 *
 * Trois actions :
 *
 *  - `chercher` (admin) : interroge le catalogue du fournisseur à partir de la
 *    désignation, puis chiffre chaque candidat *pour la quantité demandée*,
 *    avec la même chaîne de coût que le catalogue — achat, fret réel,
 *    assurance, marge. Un prix de sourcing calculé autrement que les prix de la
 *    boutique serait un prix qu'on ne sait pas tenir ;
 *
 *  - `devis` (admin)    : fige la proposition et la transmet au client ;
 *
 *  - `refuser` (admin)  : clôt la demande avec un motif. Dire non clairement
 *    vaut mieux que laisser une demande sans réponse.
 *
 * Le client dépose sa demande directement en base — la politique RLS l'autorise
 * à écrire ses propres lignes — mais il ne peut pas la modifier ensuite. Sa
 * réponse au devis passe donc par ici (`accepter`, `abandonner`), ce qui garantit
 * qu'il répond au prix qu'on lui a effectivement annoncé et à aucun autre.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  CJ_BASE_URL,
  getCjAccessToken,
  obtenirDetailProduitCj,
  obtenirFretReelCj,
  obtenirStockVariante,
  pause,
} from '../_partage/cj-api.ts';
import { calculerCout, quantiteMinimumPour } from '../_partage/cout-import.ts';
import { servirAvecCors } from '../_partage/cors.ts';

// Les en-têtes d'autorisation sont posés par `servirAvecCors`, qui
// connaît l'origine de la demande. Ce qui reste ici est écrasé en sortie.
const corsHeaders = {
  'Access-Control-Allow-Headers': '*',
};

const reponse = (corps: unknown, statut: number) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Le catalogue du fournisseur n'est indexé qu'en anglais : une désignation
 * française n'y trouve que des correspondances fortuites. En cas d'échec de la
 * traduction on interroge tel quel, plutôt que de ne rien chercher.
 */
async function traduireEnAnglais(texte: string): Promise<string> {
  try {
    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', texte);
    url.searchParams.set('langpair', 'fr|en');
    const data = await (await fetch(url)).json().catch(() => null);
    const traduit = data?.responseData?.translatedText;
    return typeof traduit === 'string' && traduit.trim() ? traduit.trim() : texte;
  } catch {
    return texte;
  }
}

/**
 * Nombre de candidats réellement chiffrés.
 *
 * Chaque chiffrage coûte deux appels au fournisseur, cadencés à un par seconde.
 * Au-delà de trois, l'invocation expire avant d'avoir répondu.
 */
const CANDIDATS_CHIFFRES = 3;

interface CorpsRequete {
  action?: 'chercher' | 'devis' | 'refuser' | 'accepter' | 'abandonner';
  demande_id?: string;
  /** Remplace la désignation pour affiner la recherche. */
  mot_cle?: string;
  /** Pour `devis` : le candidat retenu et le prix annoncé au client. */
  reference_externe?: string;
  prix_propose_fcfa?: number;
  prix_source_usd?: number;
  delai_source_jours?: number;
  commentaire?: string;
}

servirAvecCors(async (req: Request) => {
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return reponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const entete = req.headers.get('Authorization');
    if (!entete) return reponse({ error: 'Authentification requise.' }, 401);

    const appelant = createClient(url, anon, { global: { headers: { Authorization: entete } } });
    const {
      data: { user },
    } = await appelant.auth.getUser();
    if (!user) return reponse({ error: 'Session invalide, reconnectez-vous.' }, 401);

    const db = createClient(url, service);
    const { data: profil } = await db
      .from('app_e08c374bc4_profiles')
      .select('type_compte')
      .eq('user_id', user.id)
      .maybeSingle();
    const estAdmin = profil?.type_compte === 'admin';

    let corps: CorpsRequete;
    try {
      corps = await req.json();
    } catch {
      return reponse({ error: 'Corps de requête JSON invalide.' }, 400);
    }

    if (!corps.demande_id) return reponse({ error: 'Demande non précisée.' }, 400);

    const { data: demande } = await db
      .from('app_e08c374bc4_demandes_sourcing')
      .select('*')
      .eq('id', corps.demande_id)
      .maybeSingle();
    if (!demande) return reponse({ error: 'Demande introuvable.' }, 404);

    const action = corps.action ?? 'chercher';

    // Le client ne dispose que de la réponse au devis, et seulement sur ses
    // propres demandes. Tout le reste relève de l'administration.
    const ACTIONS_CLIENT = ['accepter', 'abandonner'];
    if (ACTIONS_CLIENT.includes(action)) {
      if (demande.user_id !== user.id && !estAdmin) {
        return reponse({ error: 'Demande introuvable.' }, 404);
      }
    } else if (!estAdmin) {
      return reponse({ error: 'Accès réservé aux administrateurs.' }, 403);
    }

    // ---- Réponse du client au devis --------------------------------------
    if (action === 'accepter' || action === 'abandonner') {
      if (action === 'accepter' && demande.statut !== 'devis_envoye') {
        return reponse({ error: "Aucun devis en attente sur cette demande." }, 409);
      }
      if (demande.statut === 'acceptee' || demande.statut === 'abandonnee') {
        return reponse({ error: 'Cette demande est déjà close.' }, 409);
      }
      await db
        .from('app_e08c374bc4_demandes_sourcing')
        .update({ statut: action === 'accepter' ? 'acceptee' : 'abandonnee' })
        .eq('id', demande.id);
      console.log(JSON.stringify({ requestId, action, demande: demande.reference_publique }));
      return reponse({ success: true, statut: action === 'accepter' ? 'acceptee' : 'abandonnee' }, 200);
    }

    // ---- Transmission du devis au client --------------------------------
    if (action === 'devis') {
      const prix = Number(corps.prix_propose_fcfa);
      if (!Number.isFinite(prix) || prix <= 0) {
        return reponse({ error: 'Prix proposé invalide.' }, 400);
      }
      await db
        .from('app_e08c374bc4_demandes_sourcing')
        .update({
          statut: 'devis_envoye',
          prix_propose_fcfa: Math.round(prix),
          prix_source_usd: corps.prix_source_usd ?? null,
          delai_source_jours: corps.delai_source_jours ?? null,
          reference_sourcing_fournisseur: corps.reference_externe ?? null,
          commentaire_admin: corps.commentaire ?? null,
          devis_envoye_le: new Date().toISOString(),
        })
        .eq('id', demande.id);

      console.log(JSON.stringify({ requestId, action, demande: demande.reference_publique }));
      return reponse({ success: true, statut: 'devis_envoye' }, 200);
    }

    // ---- Refus motivé ----------------------------------------------------
    if (action === 'refuser') {
      if (!corps.commentaire?.trim()) {
        return reponse({ error: 'Un motif est requis : le client doit savoir pourquoi.' }, 400);
      }
      await db
        .from('app_e08c374bc4_demandes_sourcing')
        .update({ statut: 'refusee', commentaire_admin: corps.commentaire.trim() })
        .eq('id', demande.id);
      return reponse({ success: true, statut: 'refusee' }, 200);
    }

    // ---- Recherche et chiffrage -----------------------------------------
    const token = await getCjAccessToken();
    if (!token) return reponse({ error: 'Fournisseur injoignable.' }, 502);

    const { data: parametres } = await db
      .from('app_e08c374bc4_parametres_import')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (!parametres) return reponse({ error: 'Impossible de lire les paramètres.' }, 500);

    const motCle = (corps.mot_cle?.trim() || String(demande.designation)).slice(0, 120);
    const motCleEn = await traduireEnAnglais(motCle);

    const rechercheUrl = new URL(`${CJ_BASE_URL}/product/list`);
    rechercheUrl.searchParams.set('pageNum', '1');
    rechercheUrl.searchParams.set('pageSize', '20');
    rechercheUrl.searchParams.set('productNameEn', motCleEn);

    const brut = await (await fetch(rechercheUrl, { headers: { 'CJ-Access-Token': token } }))
      .json()
      .catch(() => null);
    await pause(1100);

    if (brut?.code !== 200) {
      return reponse({ error: brut?.message ?? 'Le fournisseur a refusé la recherche.' }, 502);
    }

    const liste: Record<string, unknown>[] = brut?.data?.list ?? [];
    if (liste.length === 0) {
      return reponse(
        { success: true, mot_cle_traduit: motCleEn, candidats: [], message: 'Aucune correspondance.' },
        200,
      );
    }

    const quantite = Math.max(1, Number(demande.quantite_souhaitee) || 1);
    const tauxChange = Number(parametres.taux_change_usd_fcfa);

    // Le prix affiché par la recherche sert seulement à classer : les moins
    // chers d'abord, puisque c'est le prix cible du client qu'on vise.
    const prixAffiche = (p: Record<string, unknown>): number => {
      const v = p.sellPrice ?? p.sellPriceMin ?? p.price;
      if (typeof v === 'number') return v;
      const m = String(v ?? '').match(/[\d.]+/);
      return m ? parseFloat(m[0]) : Number.POSITIVE_INFINITY;
    };
    const classes = [...liste].sort((a, b) => prixAffiche(a) - prixAffiche(b));

    const incoterm = { part_fret: 1, assurance_a_charge: true };
    const candidats: Record<string, unknown>[] = [];

    for (const p of classes.slice(0, CANDIDATS_CHIFFRES)) {
      const pid = String(p.pid ?? p.productId ?? p.id ?? '');
      if (!pid) continue;

      const detail = await obtenirDetailProduitCj(pid, token);
      await pause(1100);
      if (!detail.vid || !detail.prix_usd) continue;

      const fret = await obtenirFretReelCj(detail.vid, token, 'CI', quantite);
      await pause(1100);

      const stock = await obtenirStockVariante(detail.vid, token);
      await pause(1100);

      const prixAchatFcfa = Math.round(detail.prix_usd * tauxChange);
      const cout = calculerCout({
        prixAchatFcfa,
        quantiteMinimum: quantite,
        fretReel: fret,
        parametres,
        incoterm,
      });

      const cible = Number(demande.prix_cible_fcfa);
      candidats.push({
        reference_externe: pid,
        nom: String(p.productNameEn ?? p.productName ?? 'Produit sans nom'),
        photo:
          (p.productImage as string) ??
          (Array.isArray(p.productImageSet) ? (p.productImageSet[0] as string) : null) ??
          null,
        prix_source_usd: detail.prix_usd,
        stock_disponible: stock,
        // Le prix est chiffré pour la quantité demandée : à quantité différente,
        // le fret par pièce change et ce prix ne vaut plus.
        quantite_chiffree: quantite,
        prix_unitaire_fcfa: cout.prix_unitaire_fcfa,
        total_fcfa: cout.prix_unitaire_fcfa * quantite,
        cout_fret_unitaire_fcfa: cout.cout_fret_fcfa,
        cout_assurance_unitaire_fcfa: cout.cout_assurance_fcfa,
        cout_revient_unitaire_fcfa: cout.cout_revient_fcfa,
        fret_source: cout.fret_source,
        fret_transporteur: cout.fret_transporteur,
        fret_delai: cout.fret_delai,
        quantite_minimum_conseillee: quantiteMinimumPour(prixAchatFcfa, parametres),
        dans_le_budget:
          Number.isFinite(cible) && cible > 0 ? cout.prix_unitaire_fcfa <= cible : null,
      });
    }

    // La demande est passée entre nos mains : le client doit le voir sans
    // attendre le devis.
    if (demande.statut === 'nouvelle') {
      await db
        .from('app_e08c374bc4_demandes_sourcing')
        .update({ statut: candidats.length > 0 ? 'cotee' : 'transmise' })
        .eq('id', demande.id);
    }

    console.log(
      JSON.stringify({ requestId, action, motCleEn, trouves: liste.length, chiffres: candidats.length }),
    );

    return reponse(
      {
        success: true,
        mot_cle_traduit: motCleEn,
        resultats_bruts: liste.length,
        quantite_demandee: quantite,
        candidats,
      },
      200,
    );
  } catch (erreur) {
    console.log(JSON.stringify({ requestId, erreur: String(erreur) }));
    return reponse({ error: 'Erreur interne du serveur.' }, 500);
  }
});
