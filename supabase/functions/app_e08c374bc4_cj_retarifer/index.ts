/**
 * Retarification du catalogue importé et construction de la grille de gros.
 *
 * Pour chaque produit, on redemande au transporteur un devis à chaque quantité
 * de la grille, puis on ne retient que les paliers dont le prix unitaire baisse
 * réellement. Le produit prend le prix de son palier d'entrée.
 *
 * Traitement par lots : le transporteur plafonne à un appel par seconde et
 * chaque produit en consomme un par palier. L'appelant relance tant que
 * `restants` n'est pas nul.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCjAccessToken,
  obtenirDetailProduitCj,
  obtenirFretReelCj,
  pause,
  type FretReel,
} from '../_partage/cj-api.ts';
import { calculerCout, construirePaliers, quantiteMinimumPour } from '../_partage/cout-import.ts';
import { servirAvecCors } from '../_partage/cors.ts';

// Les en-têtes d'autorisation sont posés par `servirAvecCors`, qui
// connaît l'origine de la demande. Ce qui reste ici est écrasé en sortie.
const corsHeaders = {
  'Access-Control-Allow-Headers': '*',
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Au-delà, le temps d'exécution dépasse le budget d'une invocation. */
const TAILLE_LOT_MAX = 3;

interface RetariferBody {
  taille_lot?: number;
  simulation?: boolean;
  produit_ids?: string[];
}

servirAvecCors(async (req: Request) => {
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Authentification requise.' }, 401);

    const supabaseService = createClient(supabaseUrl, serviceRoleKey);

    /**
     * DEUX FAÇONS D'ÊTRE AUTORISÉ, ET UNE SEULE PORTE
     *
     * Le cas courant : un administrateur connecté depuis l'écran d'import.
     * Sa session est vérifiée, puis son profil.
     *
     * Le second : un appel déclenché depuis le serveur lui-même — une tâche
     * planifiée, ou une relance faite par `pg_net` depuis la base. Il n'y a
     * alors AUCUNE session d'utilisateur à présenter, et c'est normal : la
     * retarification n'appartient à personne en particulier.
     *
     * La clé de service fait donc foi dans ce cas. Elle ne quitte jamais le
     * serveur — elle n'est ni dans le navigateur, ni dans le dépôt — si bien
     * que la présenter revient déjà à être le serveur. Refuser cet appel
     * n'aurait rien protégé : il aurait fallu créer une seconde fonction qui
     * dupliquerait tout le calcul de la grille de gros, et c'est exactement le
     * genre de doublon qui finit par diverger sur les PRIX.
     */
    const jetonPresente = authHeader.replace(/^Bearer\s+/i, '').trim();
    const estAppelServeur = jetonPresente === serviceRoleKey;

    if (!estAppelServeur) {
      const supabaseAsCaller = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error: userError,
      } = await supabaseAsCaller.auth.getUser();
      if (userError || !user) {
        return jsonResponse({ error: 'Session invalide, reconnectez-vous.' }, 401);
      }

      const { data: profile } = await supabaseService
        .from('app_e08c374bc4_profiles')
        .select('type_compte')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile?.type_compte !== 'admin') {
        return jsonResponse({ error: 'Accès réservé aux administrateurs.' }, 403);
      }
    }

    let body: RetariferBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corps de requête JSON invalide.' }, 400);
    }

    const simulation = body.simulation !== false;
    const tailleLot = Math.min(TAILLE_LOT_MAX, Math.max(1, Math.round(body.taille_lot ?? TAILLE_LOT_MAX)));

    const { data: parametres } = await supabaseService
      .from('app_e08c374bc4_parametres_import')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (!parametres) return jsonResponse({ error: 'Impossible de lire les paramètres.' }, 500);

    const incotermChoisi = parametres.incoterm_achat_defaut;
    const { data: repartition } = await supabaseService
      .from('app_e08c374bc4_parametres_incoterm')
      .select('incoterm, part_fret, assurance_a_charge')
      .eq('incoterm', incotermChoisi)
      .maybeSingle();
    if (!repartition) return jsonResponse({ error: `Incoterm inconnu : ${incotermChoisi}.` }, 400);

    /*
     * LA GRILLE DE REMISE, SOURCE UNIQUE DES QUANTITÉS ET DES MARGES.
     *
     * Elle sert deux fois, et c'est ce qui garantit qu'on ne dérive pas : ses
     * seuils sont les quantités auxquelles on fait coter le transport, et ses
     * taux sont les marges appliquées à ces mêmes quantités. Deux réglages
     * séparés auraient fini par se contredire — on aurait coté le transport à
     * des quantités où le prix ne change plus.
     *
     * La grille est commune à la Boutique et à l'Espace Pro. Un revendeur peut
     * acheter par l'une comme par l'autre.
     */
    const { data: grilleRemise } = await supabaseService
      .from('app_e08c374bc4_grille_remise')
      .select('quantite_min, taux_marge')
      .eq('actif', true)
      .order('quantite_min');

    let requete = supabaseService
      .from('app_e08c374bc4_produits')
      .select('id, nom, reference_externe, prix_achat_fcfa, prix_unitaire_fcfa, paliers_calcules_le')
      .eq('source_donnee', 'import_cj_dropshipping')
      .not('reference_externe', 'is', null)
      .order('prix_achat_fcfa', { ascending: true });

    if (body.produit_ids?.length) requete = requete.in('id', body.produit_ids);
    if (!simulation) requete = requete.is('paliers_calcules_le', null);

    const { data: produits, error: produitsError } = await requete;
    if (produitsError || !produits) {
      console.log(JSON.stringify({ requestId, error: produitsError }));
      return jsonResponse({ error: 'Impossible de lire le catalogue.' }, 500);
    }

    const aTraiter = produits.slice(0, tailleLot);
    const restants = Math.max(0, produits.length - aTraiter.length);
    if (aTraiter.length === 0) {
      return jsonResponse({ success: true, simulation, resultats: [], restants: 0 }, 200);
    }

    const token = parametres.utiliser_fret_reel_cj ? await getCjAccessToken() : null;
    const resultats: Record<string, unknown>[] = [];

    for (const produit of aTraiter) {
      let prixAchatFcfa = Number(produit.prix_achat_fcfa ?? 0);
      let vid: string | null = null;
      let mesures: { poids_g: number | null; volume_cm3: number | null } = { poids_g: null, volume_cm3: null };

      if (token && produit.reference_externe) {
        const detail = await obtenirDetailProduitCj(String(produit.reference_externe), token);
        vid = detail.vid;
        mesures = { poids_g: detail.poids_g, volume_cm3: detail.volume_cm3 };
        if (detail.prix_usd) {
          prixAchatFcfa = Math.round(detail.prix_usd * Number(parametres.taux_change_usd_fcfa));
        }
        await pause(1100);
      }
      if (prixAchatFcfa <= 0) continue;

      // Le palier d'entrée est la quantité minimum de vente : proposer un devis
      // pour une quantité que le client ne peut pas commander n'a pas de sens.
      const quantiteEntree = quantiteMinimumPour(prixAchatFcfa, parametres);
      const grille: number[] = Array.from(
        new Set<number>([
          quantiteEntree,
          ...(grilleRemise ?? [])
            .map((p) => Number(p.quantite_min))
            .filter((q) => q > quantiteEntree),
        ]),
      ).sort((a, b) => a - b);

      const devis: { quantite: number; fret: FretReel | null }[] = [];
      for (const quantite of grille) {
        let fret: FretReel | null = null;
        if (token && vid) {
          fret = await obtenirFretReelCj(
            vid,
            token,
            String(parametres.pays_destination_code),
            quantite,
          );
          await pause(1100);
        }
        devis.push({ quantite, fret });
      }

      const paliers = construirePaliers({
        prixAchatFcfa,
        devis,
        parametres,
        incoterm: repartition,
        grilleRemise,
      });

      // SANS DEVIS DE FRET, L'ARTICLE RELÈVE DU GROUPAGE — PAS DE L'EXTINCTION
      //
      // Cette branche éteignait l'article sans jamais écrire son prix. Le
      // raisonnement d'origine — « on ne connaît pas l'acheminement, donc on ne
      // peut pas publier un prix inventé » — était juste tant que le fret était
      // INCLUS dans le prix. Il ne l'est plus : le transport est facturé à part,
      // à marge nulle sur le porte-à-porte.
      //
      // Le prix de vente ne dépend donc plus du fret. C'est coût de revient
      // × marge, et `calculerCout` le produit ici même — il était d'ailleurs
      // déjà rapporté sous le nom `prix_indicatif_fcfa`, puis jeté. Ce n'est pas
      // un prix inventé : c'est le prix normal de la marchandise.
      //
      // Ce qui reste inconnu, c'est le fret — et le groupage est fait pour ça :
      // il n'affiche aucun prix de transport tant qu'il n'est pas vérifié, et
      // aucun paiement ne part avant.
      //
      // Mesuré le 29 août : dix articles étaient restés à 0 F de prix de vente,
      // donc invisibles en vitrine, alors qu'ils avaient un prix d'achat, des
      // photos et une fiche complète. Un article sans prix n'est jamais montré —
      // c'est la vue publique qui le refuse, et elle a raison. C'est le prix qui
      // manquait, pas la règle.
      if (paliers.length === 0) {
        const coutForfait = calculerCout({
          prixAchatFcfa,
          quantiteMinimum: quantiteEntree,
          fretReel: null,
          parametres,
          incoterm: repartition,
        });
        resultats.push({
          id: produit.id,
          nom: produit.nom,
          publiable: true,
          motif: 'groupage_fret_a_verifier',
          prix_unitaire_fcfa: coutForfait.prix_unitaire_fcfa,
        });

        if (!simulation) {
          await supabaseService
            .from('app_e08c374bc4_produits')
            .update({
              prix_achat_fcfa: prixAchatFcfa,
              prix_unitaire_fcfa: coutForfait.prix_unitaire_fcfa,
              cout_assurance_fcfa: coutForfait.cout_assurance_fcfa,
              cout_fret_fcfa: 0,
              mode_acheminement: 'groupage',
              fret_source: 'forfait',
              actif: true,
              indisponible_motif: null,
              retarife_le: new Date().toISOString(),
              paliers_calcules_le: new Date().toISOString(),
            })
            .eq('id', produit.id);
        }
        continue;
      }

      const entree = paliers[0];

      // Avoir un devis ne suffit pas à rendre un produit vendable : si la plus
      // petite commande possible atteint un montant déraisonnable, le client
      // paie surtout du transport. Le recalcul ne doit jamais remettre en
      // vitrine un article écarté pour cette raison.
      // Ce que le client débourse réellement, transport compris — que celui-ci
      // soit dans le prix ou facturé à part au panier.
      const fretHorsPrix =
        parametres.fret_inclus_dans_prix === false ? entree.cout_fret_unitaire_fcfa : 0;
      const commandeMinimum =
        (entree.prix_unitaire_fcfa + fretHorsPrix) * entree.quantite_min;
      const plafond = Number(parametres.plafond_commande_minimum_fcfa);
      if (commandeMinimum > plafond) {
        resultats.push({
          id: produit.id,
          nom: produit.nom,
          publiable: false,
          motif: 'commande_minimum_trop_elevee',
          commande_minimum_fcfa: commandeMinimum,
        });

        if (!simulation) {
          await supabaseService
            .from('app_e08c374bc4_produits')
            .update({
              prix_achat_fcfa: prixAchatFcfa,
              prix_unitaire_fcfa: entree.prix_unitaire_fcfa,
              cout_fret_fcfa: entree.cout_fret_unitaire_fcfa,
              cout_assurance_fcfa: entree.cout_assurance_unitaire_fcfa,
              quantite_minimum: entree.quantite_min,
              actif: false,
              indisponible_motif: 'commande_minimum_trop_elevee',
              retarife_le: new Date().toISOString(),
              paliers_calcules_le: new Date().toISOString(),
            })
            .eq('id', produit.id);
          await supabaseService
            .from('app_e08c374bc4_paliers_prix')
            .delete()
            .eq('produit_id', produit.id);
        }
        continue;
      }

      // Second garde-fou, sur le rapport et non sur le montant : le transport ne
      // doit pas écraser la marchandise. Les deux conditions sont exigées
      // ensemble — un rapport élevé sur une petite commande reste acceptable,
      // une pochette bulle vendue 500 FCFA ne gêne personne. C'est la
      // conjonction « transport écrasant » et « facture salée » qu'on écarte.
      const ratioFret =
        prixAchatFcfa > 0 ? entree.cout_fret_unitaire_fcfa / prixAchatFcfa : Infinity;
      const ratioMaximum = Number(parametres.ratio_fret_maximum);
      const seuilSurveille = Number(parametres.seuil_commande_surveillee_fcfa);

      if (ratioFret > ratioMaximum && commandeMinimum > seuilSurveille) {
        resultats.push({
          id: produit.id,
          nom: produit.nom,
          publiable: false,
          motif: 'fret_disproportionne',
          ratio_fret: Number(ratioFret.toFixed(1)),
          commande_minimum_fcfa: commandeMinimum,
        });

        if (!simulation) {
          await supabaseService
            .from('app_e08c374bc4_produits')
            .update({
              prix_achat_fcfa: prixAchatFcfa,
              prix_unitaire_fcfa: entree.prix_unitaire_fcfa,
              cout_fret_fcfa: entree.cout_fret_unitaire_fcfa,
              cout_assurance_fcfa: entree.cout_assurance_unitaire_fcfa,
              quantite_minimum: entree.quantite_min,
              actif: false,
              indisponible_motif: 'fret_disproportionne',
              retarife_le: new Date().toISOString(),
              paliers_calcules_le: new Date().toISOString(),
            })
            .eq('id', produit.id);
          await supabaseService
            .from('app_e08c374bc4_paliers_prix')
            .delete()
            .eq('produit_id', produit.id);
        }
        continue;
      }

      resultats.push({
        id: produit.id,
        nom: produit.nom,
        publiable: true,
        prix_achat_fcfa: prixAchatFcfa,
        ancien_prix_fcfa: Number(produit.prix_unitaire_fcfa),
        paliers: paliers.map((p) => ({
          quantite: p.quantite_min,
          prix: p.prix_unitaire_fcfa,
          fret: p.cout_fret_unitaire_fcfa,
          transporteur: p.fret_transporteur,
        })),
        economie_max_pct:
          paliers.length > 1
            ? Math.round(
                (1 - paliers[paliers.length - 1].prix_unitaire_fcfa / entree.prix_unitaire_fcfa) * 100,
              )
            : 0,
      });

      if (!simulation) {
        const { error: majError } = await supabaseService
          .from('app_e08c374bc4_produits')
          .update({
            prix_achat_fcfa: prixAchatFcfa,
            prix_unitaire_fcfa: entree.prix_unitaire_fcfa,
            cout_fret_fcfa: entree.cout_fret_unitaire_fcfa,
            cout_assurance_fcfa: entree.cout_assurance_unitaire_fcfa,
            quantite_minimum: entree.quantite_min,
            // La variante conditionne toute cotation et toute commande future.
            // Le recalcul vient de la résoudre : on la garde, sans quoi
            // l'article resterait ingroupable et inexpédiable.
            reference_variante: vid,
            poids_unitaire_g: mesures.poids_g,
            volume_unitaire_cm3: mesures.volume_cm3,
            incoterm_achat: incotermChoisi,
            fret_source: 'cj_reel',
            fret_transporteur: entree.fret_transporteur,
            delai_livraison_estime: entree.fret_delai ? `${entree.fret_delai} jours` : null,
            actif: true,
            indisponible_motif: null,
            retarife_le: new Date().toISOString(),
            paliers_calcules_le: new Date().toISOString(),
          })
          .eq('id', produit.id);

        if (majError) {
          console.log(JSON.stringify({ requestId, produitId: produit.id, error: majError }));
          return jsonResponse({ error: `Échec de la mise à jour de « ${produit.nom} ».` }, 500);
        }

        // La grille est remplacée en bloc : un ancien palier qui n'est plus
        // rentable ne doit pas survivre au recalcul.
        await supabaseService
          .from('app_e08c374bc4_paliers_prix')
          .delete()
          .eq('produit_id', produit.id);
        await supabaseService.from('app_e08c374bc4_paliers_prix').insert(
          paliers.map((p) => ({ produit_id: produit.id, ...p })),
        );
      }
    }

    console.log(
      JSON.stringify({ requestId, step: 'paliers', simulation, traites: resultats.length, restants }),
    );
    return jsonResponse({ success: true, simulation, resultats, restants }, 200);
  } catch (error) {
    console.log(JSON.stringify({ requestId, error: String(error) }));
    return jsonResponse({ error: 'Erreur interne du serveur.' }, 500);
  }
});
