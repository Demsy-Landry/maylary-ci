/**
 * Transmission des commandes au fournisseur, et remontée du suivi.
 *
 * Trois actions, toutes réservées à l'administration :
 *
 *  - `solde`    : provision disponible chez le fournisseur ;
 *  - `envoyer`  : transmet une commande payée et la règle ;
 *  - `suivre`   : relève l'avancement des commandes déjà transmises.
 *
 * Deux règles gouvernent ce fichier, et aucune n'est négociable :
 *
 *  1. **Une commande ne part que si le client a payé.** Avancer l'argent du
 *     fournisseur sur une commande non réglée, c'est financer un impayé.
 *
 *  2. **Une commande ne part qu'une fois.** La référence renvoyée par le
 *     fournisseur est unique en base, et notre propre référence sert de numéro
 *     de commande chez lui : une double transmission se heurte à l'un ou à
 *     l'autre avant de produire une seconde expédition.
 *
 * Le prix payé par le client n'est jamais recalculé ici. Ce que la commande
 * coûte réellement est enregistré pour être constaté, pas pour être répercuté.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  creerCommandeCj,
  getCjAccessToken,
  obtenirDetailProduitCj,
  obtenirEtatCommandeCj,
  obtenirFretReelLotCj,
  obtenirSoldeCj,
  pause,
  payerCommandeCj,
} from '../_partage/cj-api.ts';
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

/** Seuls ces statuts autorisent l'engagement d'une dépense chez le fournisseur. */
const STATUTS_PAYES = ['paiement_confirme', 'en_preparation'];

/** Au-delà, la relève dépasse le budget d'une invocation (1 appel/seconde). */
const TAILLE_LOT_SUIVI = 12;

/**
 * Correspondance entre l'avancement chez le fournisseur et notre suivi client.
 *
 * On n'avance le statut local que sur des faits d'expédition. Le reste
 * (préparation, attente) reste sous le contrôle de l'administration : le client
 * ne doit pas voir sa commande reculer parce qu'un fournisseur a changé un
 * libellé interne.
 */
function statutLocalDepuisFournisseur(statutCj: string | null): string | null {
  if (!statutCj) return null;
  const s = statutCj.toUpperCase();
  if (s.includes('DELIVERED')) return 'livree';
  if (s.includes('SHIPPED') || s.includes('SHIPPING')) return 'expediee';
  return null;
}

interface CorpsRequete {
  action?: 'solde' | 'envoyer' | 'suivre';
  commande_id?: string;
  /** Passe outre le contrôle de provision, pour un compte réglé autrement. */
  ignorer_solde?: boolean;
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
    if (profil?.type_compte !== 'admin') {
      return reponse({ error: 'Accès réservé aux administrateurs.' }, 403);
    }

    let corps: CorpsRequete;
    try {
      corps = await req.json();
    } catch {
      return reponse({ error: 'Corps de requête JSON invalide.' }, 400);
    }

    const token = await getCjAccessToken();
    if (!token) return reponse({ error: 'Fournisseur injoignable.' }, 502);

    const action = corps.action ?? 'solde';

    // ---- Provision disponible -------------------------------------------
    if (action === 'solde') {
      const solde = await obtenirSoldeCj(token);
      return reponse({ success: true, solde_usd: solde }, 200);
    }

    // ---- Relève du suivi -------------------------------------------------
    if (action === 'suivre') {
      const { data: commandes } = await db
        .from('app_e08c374bc4_commandes_gp')
        .select('id, reference_publique, statut, reference_fournisseur, numero_suivi')
        .not('reference_fournisseur', 'is', null)
        .not('statut', 'in', '("livree","annulee")')
        .order('suivi_maj_le', { ascending: true, nullsFirst: true })
        .limit(TAILLE_LOT_SUIVI);

      const releves: Record<string, unknown>[] = [];

      for (const c of commandes ?? []) {
        const etat = await obtenirEtatCommandeCj(token, String(c.reference_fournisseur));
        await pause(1100);
        if (!etat) {
          releves.push({ reference: c.reference_publique, releve: false });
          continue;
        }

        const maj: Record<string, unknown> = {
          statut_fournisseur: etat.statut,
          suivi_maj_le: new Date().toISOString(),
        };
        if (etat.numero_suivi) maj.numero_suivi = etat.numero_suivi;
        if (etat.transporteur) maj.transporteur_suivi = etat.transporteur;
        if (etat.montant_usd) maj.cout_fournisseur_usd = etat.montant_usd;

        // Le suivi public est celui du transporteur, pas un lien interne au
        // fournisseur : le client doit pouvoir le vérifier lui-même.
        if (etat.numero_suivi) {
          maj.url_suivi = `https://t.17track.net/fr#nums=${encodeURIComponent(etat.numero_suivi)}`;
        }

        const nouveauStatut = statutLocalDepuisFournisseur(etat.statut);
        const avance = nouveauStatut !== null && nouveauStatut !== c.statut;
        if (avance) maj.statut = nouveauStatut;

        await db.from('app_e08c374bc4_commandes_gp').update(maj).eq('id', c.id);

        if (avance) {
          await db.from('app_e08c374bc4_historique_statut_commande_gp').insert({
            commande_id: c.id,
            statut: nouveauStatut,
            commentaire_admin: etat.numero_suivi
              ? `Suivi transporteur ${etat.transporteur ?? ''} — ${etat.numero_suivi}`.trim()
              : null,
          });
        }

        releves.push({
          reference: c.reference_publique,
          releve: true,
          statut_fournisseur: etat.statut,
          numero_suivi: etat.numero_suivi,
          statut_local: nouveauStatut ?? c.statut,
        });
      }

      console.log(JSON.stringify({ requestId, action, releves: releves.length }));
      return reponse({ success: true, commandes: releves }, 200);
    }

    // ---- Transmission d'une commande ------------------------------------
    if (!corps.commande_id) return reponse({ error: 'Commande non précisée.' }, 400);

    const { data: commande } = await db
      .from('app_e08c374bc4_commandes_gp')
      .select('*')
      .eq('id', corps.commande_id)
      .maybeSingle();
    if (!commande) return reponse({ error: 'Commande introuvable.' }, 404);

    if (commande.reference_fournisseur) {
      return reponse(
        {
          error: 'Cette commande a déjà été transmise au fournisseur.',
          reference_fournisseur: commande.reference_fournisseur,
        },
        409,
      );
    }
    if (!STATUTS_PAYES.includes(String(commande.statut))) {
      return reponse(
        { error: "Le paiement du client n'est pas confirmé : la commande ne peut pas être engagée." },
        409,
      );
    }

    const { data: lignes } = await db
      .from('app_e08c374bc4_lignes_commande_gp')
      .select('produit_id, nom_produit, quantite')
      .eq('commande_id', commande.id);
    if (!lignes?.length) return reponse({ error: 'Commande sans ligne.' }, 400);

    const { data: produits } = await db
      .from('app_e08c374bc4_produits')
      .select('id, nom, reference_externe, reference_variante, source_donnee')
      .in('id', lignes.map((l) => l.produit_id).filter(Boolean) as string[]);

    // Seuls les articles du fournisseur partent chez lui. Un article local dans
    // la même commande n'est pas une erreur : il se prépare chez nous.
    const aCommander: { vid: string; quantite: number; nom: string }[] = [];
    const nonTransmis: string[] = [];

    for (const ligne of lignes) {
      const p = produits?.find((x) => x.id === ligne.produit_id);
      if (!p || p.source_donnee !== 'import_cj_dropshipping') {
        nonTransmis.push(ligne.nom_produit);
        continue;
      }
      let vid = p.reference_variante as string | null;
      if (!vid && p.reference_externe) {
        const detail = await obtenirDetailProduitCj(String(p.reference_externe), token);
        vid = detail.vid;
        if (vid) {
          await db.from('app_e08c374bc4_produits').update({ reference_variante: vid }).eq('id', p.id);
        }
        await pause(1100);
      }
      if (!vid) {
        nonTransmis.push(ligne.nom_produit);
        continue;
      }
      aCommander.push({ vid, quantite: ligne.quantite, nom: ligne.nom_produit });
    }

    if (aCommander.length === 0) {
      return reponse(
        { error: 'Aucun article de cette commande ne provient du fournisseur.', non_transmis: nonTransmis },
        400,
      );
    }

    // Le transporteur est celui que le client a choisi et payé au panier. On ne
    // le recalcule pas : le tarif du fournisseur bouge d'un jour à l'autre, et
    // reprendre la main ici reviendrait à livrer autrement que ce qui a été
    // annoncé — parfois plus lentement que ce qui a été facturé.
    //
    // Sans choix enregistré — commande antérieure à cette fonctionnalité, ou
    // fournisseur injoignable ce jour-là — on retombe sur l'option la moins
    // chère, celle sur laquelle les prix de vente ont été bâtis. Laisser le
    // fournisseur décider exposerait à un express dont le surcoût ne serait
    // facturé à personne.
    const fret = await obtenirFretReelLotCj(
      aCommander.map((a) => ({ vid: a.vid, quantite: a.quantite })),
      token,
      'CI',
    );
    await pause(1100);
    const transporteur = (commande.transporteur_choisi as string | null) ?? fret?.transporteur ?? null;
    const fretUsd = fret?.prix_usd ?? null;

    const solde = await obtenirSoldeCj(token);
    if (!corps.ignorer_solde && solde != null && solde <= 0) {
      const motif =
        `Provision insuffisante chez le fournisseur (solde ${solde.toFixed(2)} $). ` +
        'Créditez le compte avant de transmettre la commande.';
      await db
        .from('app_e08c374bc4_commandes_gp')
        .update({ erreur_fournisseur: motif })
        .eq('id', commande.id);
      return reponse({ error: motif, solde_usd: solde, commande_creee: false }, 402);
    }

    const creation = await creerCommandeCj(token, {
      reference: String(commande.reference_publique),
      adresse: {
        nom: String(commande.nom_destinataire),
        // Le fournisseur expédie à l'international : le numéro doit porter son
        // indicatif, faute de quoi le transporteur ne peut pas joindre le client.
        telephone: String(commande.telephone_destinataire).trim().startsWith('+')
          ? String(commande.telephone_destinataire).trim()
          : `+225${String(commande.telephone_destinataire).replace(/\D/g, '')}`,
        adresse: String(commande.adresse_livraison),
        ville: String(commande.ville_livraison),
        province: String(commande.ville_livraison),
        code_pays: 'CI',
        // La Côte d'Ivoire n'a pas d'adressage postal : le champ reste requis
        // par le fournisseur, on l'honore sans lui prêter de sens.
        code_postal: '00225',
      },
      lignes: aCommander.map((a) => ({ vid: a.vid, quantite: a.quantite })),
      transporteur,
      remarque: `Maylary — ${commande.reference_publique}`,
    });
    await pause(1100);

    if (!creation.ok || !creation.donnees?.orderId) {
      const motif = creation.message ?? 'Le fournisseur a refusé la commande.';
      await db
        .from('app_e08c374bc4_commandes_gp')
        .update({ erreur_fournisseur: motif })
        .eq('id', commande.id);
      console.log(JSON.stringify({ requestId, action, echec: 'creation', motif }));
      return reponse({ error: motif, commande_creee: false }, 502);
    }

    const orderId = String(creation.donnees.orderId);

    // La commande existe désormais chez le fournisseur : on l'enregistre avant
    // de tenter le paiement. Si le règlement échoue, la référence reste connue
    // et la commande peut être réglée depuis l'interface du fournisseur, au lieu
    // de rester orpheline.
    await db
      .from('app_e08c374bc4_commandes_gp')
      .update({
        reference_fournisseur: orderId,
        envoye_fournisseur_le: new Date().toISOString(),
        statut_fournisseur: 'CREATED',
        erreur_fournisseur: null,
        cout_fournisseur_usd: fretUsd,
      })
      .eq('id', commande.id);

    const paiement = await payerCommandeCj(token, orderId);
    await pause(1100);

    if (!paiement.ok) {
      const motif = `Commande créée (${orderId}) mais non réglée : ${paiement.message ?? 'paiement refusé'}.`;
      await db
        .from('app_e08c374bc4_commandes_gp')
        .update({ erreur_fournisseur: motif })
        .eq('id', commande.id);
      console.log(JSON.stringify({ requestId, action, echec: 'paiement', orderId }));
      return reponse(
        { error: motif, commande_creee: true, reference_fournisseur: orderId, payee: false },
        402,
      );
    }

    await db
      .from('app_e08c374bc4_commandes_gp')
      .update({ statut_fournisseur: 'PAID', erreur_fournisseur: null })
      .eq('id', commande.id);

    // Le client voit sa commande avancer : elle est réellement en préparation.
    if (commande.statut === 'paiement_confirme') {
      await db
        .from('app_e08c374bc4_commandes_gp')
        .update({ statut: 'en_preparation' })
        .eq('id', commande.id);
      await db.from('app_e08c374bc4_historique_statut_commande_gp').insert({
        commande_id: commande.id,
        statut: 'en_preparation',
        commentaire_admin: 'Commande transmise au fournisseur.',
      });
    }

    console.log(JSON.stringify({ requestId, action, orderId, lignes: aCommander.length }));

    return reponse(
      {
        success: true,
        commande_creee: true,
        payee: true,
        reference_fournisseur: orderId,
        transporteur,
        non_transmis: nonTransmis,
      },
      200,
    );
  } catch (erreur) {
    console.log(JSON.stringify({ requestId, erreur: String(erreur) }));
    return reponse({ error: 'Erreur interne du serveur.' }, 500);
  }
});
