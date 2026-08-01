/**
 * Simulateur de groupage.
 *
 * Sert à évaluer une offre de transitaire avant de s'y engager : on saisit un
 * tarif, on choisit des produits et des quantités, et on obtient le coût de
 * revient débarqué et le prix de vente qui en découle, article par article.
 *
 * Le calcul applique les règles des groupeurs (module `_partage/fret-groupage`) :
 * unité payante au plus fort du volume et du poids, minimum de taxation,
 * répartition au prorata, puis droits et taxes sur la valeur CAF.
 *
 * Rien n'est écrit en base : c'est un outil de décision, pas une opération.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  coutDebarque,
  EQUIVALENCE_KG_PAR_M3,
  type ArticleExpedie,
  type ModeTransport,
} from '../_partage/fret-groupage.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

const reponse = (corps: unknown, statut: number) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface CorpsSimulation {
  mode?: ModeTransport;
  tarif_unite_payante_fcfa?: number;
  minimum_taxation_up?: number;
  taux_surcharges?: number;
  frais_fixes_expedition_fcfa?: number;
  /** Produits à embarquer, avec la quantité envisagée. */
  lignes?: { produit_id: string; quantite: number }[];
  /** Remplace ponctuellement le taux de marge par défaut. */
  taux_marge?: number;
}

Deno.serve(async (req: Request) => {
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

    let corps: CorpsSimulation;
    try {
      corps = await req.json();
    } catch {
      return reponse({ error: 'Corps de requête JSON invalide.' }, 400);
    }

    if (!corps.lignes?.length) {
      return reponse({ error: 'Indiquez au moins un produit et sa quantité.' }, 400);
    }
    if (!(Number(corps.tarif_unite_payante_fcfa) > 0)) {
      return reponse({ error: "Le prix de l'unité payante est requis." }, 400);
    }

    const { data: parametres } = await db
      .from('app_e08c374bc4_parametres_import')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (!parametres) return reponse({ error: 'Impossible de lire les paramètres.' }, 500);

    const { data: produits } = await db
      .from('app_e08c374bc4_produits')
      .select('id, nom, prix_achat_fcfa, prix_unitaire_fcfa, poids_unitaire_g, volume_unitaire_cm3')
      .in(
        'id',
        corps.lignes.map((l) => l.produit_id),
      );

    const parId = new Map((produits ?? []).map((p) => [p.id, p]));

    // Un produit sans mesure ne peut pas entrer dans une expédition : son unité
    // payante est inconnue. On le signale plutôt que de le compter pour zéro,
    // ce qui fausserait la répartition de tous les autres.
    const sansMesure: string[] = [];
    const articles: ArticleExpedie[] = [];
    /** Aligné sur `articles` : permet de rattacher chaque résultat à son produit. */
    const produitsRetenus: { id: string; prix_aerien_fcfa: number }[] = [];

    for (const ligne of corps.lignes) {
      const p = parId.get(ligne.produit_id);
      if (!p) continue;
      if (!p.poids_unitaire_g || !p.volume_unitaire_cm3) {
        sansMesure.push(p.nom);
        continue;
      }
      produitsRetenus.push({ id: p.id, prix_aerien_fcfa: Number(p.prix_unitaire_fcfa ?? 0) });
      articles.push({
        reference: p.nom,
        quantite: Math.max(1, Math.round(ligne.quantite)),
        volume_unitaire_cm3: Number(p.volume_unitaire_cm3),
        poids_unitaire_g: Number(p.poids_unitaire_g),
        valeur_unitaire_fcfa: Number(p.prix_achat_fcfa ?? 0),
      });
    }

    if (articles.length === 0) {
      return reponse(
        { error: 'Aucun produit mesuré dans la sélection.', sans_mesure: sansMesure },
        400,
      );
    }

    const mode: ModeTransport = corps.mode ?? 'maritime';

    const tarif = {
      mode,
      tarif_unite_payante_fcfa: Number(corps.tarif_unite_payante_fcfa),
      minimum_taxation_up: Number(corps.minimum_taxation_up ?? 1),
      taux_surcharges: Number(corps.taux_surcharges ?? 0),
      frais_fixes_expedition_fcfa: Number(corps.frais_fixes_expedition_fcfa ?? 0),
    };

    const regime = {
      taux_droit_douane: Number(parametres.taux_droit_douane),
      taux_redevances: Number(parametres.taux_redevances_importation),
      taux_tva: Number(parametres.taux_tva),
      frais_dedouanement_fcfa: Number(parametres.frais_dedouanement_fcfa),
    };

    // L'assurance suit le barème de l'assureur : valeur assurée majorée, prime
    // nette, frais de police une fois par expédition, puis taxe. Elle porte sur
    // la valeur CAF de l'expédition entière, fret compris — d'où un premier
    // calcul du fret seul.
    const valeurMarchandise = articles.reduce(
      (s, a) => s + a.valeur_unitaire_fcfa * a.quantite,
      0,
    );
    const { expedition: fretSeul } = coutDebarque({
      articles,
      tarif,
      regime,
      prime_assurance_expedition_fcfa: 0,
    });
    const valeurAssuree = Math.round(
      (valeurMarchandise + fretSeul.fret_total_fcfa) *
        Number(parametres.taux_couverture_assurance),
    );
    const primeNette = Math.round(valeurAssuree * Number(parametres.taux_assurance));
    const primeAssurance = Math.round(
      (primeNette + Number(parametres.frais_police_assurance_fcfa)) *
        (1 + Number(parametres.taux_taxe_assurance)),
    );

    const { expedition, articles: lignes } = coutDebarque({
      articles,
      tarif,
      regime,
      prime_assurance_expedition_fcfa: primeAssurance,
    });

    const tauxMarge = corps.taux_marge ?? Number(parametres.taux_marge_defaut);

    const resultats = lignes.map((l, i) => {
      const prix_unitaire_fcfa = Math.round(l.cout_revient_unitaire_fcfa * (1 + tauxMarge));
      const prixAerien = produitsRetenus[i].prix_aerien_fcfa;
      return {
        ...l,
        produit_id: produitsRetenus[i].id,
        paye_au_volume: expedition.lignes[i].paye_au_volume,
        prix_unitaire_fcfa,
        prix_aerien_actuel_fcfa: prixAerien || null,
        ecart_vs_aerien_pct:
          prixAerien > 0 ? Math.round((1 - prix_unitaire_fcfa / prixAerien) * 100) : null,
      };
    });

    console.log(
      JSON.stringify({ requestId, step: 'simulation', mode, articles: articles.length }),
    );

    return reponse(
      {
        success: true,
        mode,
        equivalence_kg_par_m3: EQUIVALENCE_KG_PAR_M3[mode],
        expedition: {
          unites_payantes_reelles: expedition.unites_payantes_reelles,
          unites_payantes_facturees: expedition.unites_payantes_facturees,
          minimum_applique: expedition.minimum_applique,
          fret_base_fcfa: expedition.fret_base_fcfa,
          surcharges_fcfa: expedition.surcharges_fcfa,
          frais_fixes_fcfa: expedition.frais_fixes_fcfa,
          fret_total_fcfa: expedition.fret_total_fcfa,
          prime_assurance_fcfa: primeAssurance,
          valeur_marchandise_fcfa: valeurMarchandise,
        },
        regime,
        taux_marge_applique: tauxMarge,
        articles: resultats,
        sans_mesure: sansMesure,
      },
      200,
    );
  } catch (erreur) {
    console.log(JSON.stringify({ requestId, erreur: String(erreur) }));
    return reponse({ error: 'Erreur interne du serveur.' }, 500);
  }
});
