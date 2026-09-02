/**
 * Banc d'essai de la grille de paliers : l'ancienne règle contre la nouvelle,
 * sur des devis réellement obtenus.
 *
 * POURQUOI CETTE FONCTION EXISTE
 *
 * Corriger un garde-fou est facile ; démontrer qu'il garde quelque chose l'est
 * moins. Rejouer la retarification pour le vérifier coûterait un appel par
 * article et par quantité chez le transporteur, à un appel par seconde, et
 * donnerait des tarifs du jour — donc jamais deux fois les mêmes chiffres.
 *
 * Ce banc ne parle pas au transporteur. Il relit les devis déjà consignés par
 * `cj_releve_fret` et les fait passer par le VRAI `construirePaliers`, celui
 * qui est déployé. Les entrées sont fixes, la comparaison est donc honnête :
 * ce qui change entre les deux colonnes est la règle, et rien d'autre.
 *
 * L'ancienne règle est reproduite ici, et seulement ici, pour pouvoir la
 * montrer. Elle ne sert à rien d'autre et ne doit jamais être appelée en
 * production : c'est une pièce à conviction, pas un chemin de calcul.
 *
 * La fonction N'ÉCRIT RIEN. Elle lit et elle compare.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  calculerCout,
  construirePaliers,
  type FretReel,
  type PalierRemise,
  type ParametresCout,
  type RepartitionIncoterm,
} from '../_partage/cout-import.ts';
import { servirAvecCors } from '../_partage/cors.ts';

const corsHeaders = { 'Access-Control-Allow-Headers': '*' };

const reponse = (corps: unknown, statut: number) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * LA RÈGLE D'AVANT, REPRODUITE POUR MÉMOIRE.
 *
 * Elle ne retenait un palier que si le PRIX DE LA MARCHANDISE baissait. Tant
 * que le transport était compris dans ce prix, cela revenait à comparer les
 * prix rendus. Depuis qu'il est facturé à part, ce prix ne contient plus le
 * transport : il baisse mécaniquement avec la quantité — prix d'achat fixe,
 * plancher qui se divise — et la comparaison ne rejetait plus jamais rien.
 *
 * On la garde ici uniquement pour montrer la différence sur des chiffres réels.
 */
function paliersSelonAncienneRegle(params: {
  prixAchatFcfa: number;
  devis: { quantite: number; fret: FretReel | null }[];
  parametres: ParametresCout;
  incoterm: RepartitionIncoterm;
  grilleRemise: PalierRemise[] | null;
}) {
  const retenus: { quantite_min: number; prix_unitaire_fcfa: number; fret_unitaire_fcfa: number }[] = [];
  let meilleurPrix = Number.POSITIVE_INFINITY;

  for (const { quantite, fret } of [...params.devis].sort((a, b) => a.quantite - b.quantite)) {
    if (!fret) continue;

    // Même marge que la nouvelle règle : sans cela, la comparaison mesurerait
    // aussi l'effet de la grille de remise, et on ne saurait plus ce qui vient
    // de quoi. Seul le CRITÈRE DE REJET diffère entre les deux colonnes.
    const applicable = [...(params.grilleRemise ?? [])]
      .sort((a, b) => a.quantite_min - b.quantite_min)
      .filter((p) => quantite >= p.quantite_min)
      .at(-1);

    const cout = calculerCout({
      prixAchatFcfa: params.prixAchatFcfa,
      quantiteMinimum: quantite,
      fretReel: fret,
      parametres: params.parametres,
      incoterm: params.incoterm,
      tauxMarge: applicable ? Number(applicable.taux_marge) : null,
    });

    if (cout.prix_unitaire_fcfa >= meilleurPrix) continue;
    meilleurPrix = cout.prix_unitaire_fcfa;

    retenus.push({
      quantite_min: quantite,
      prix_unitaire_fcfa: cout.prix_unitaire_fcfa,
      fret_unitaire_fcfa: cout.cout_fret_fcfa,
    });
  }
  return retenus;
}

interface CorpsRequete {
  releve_id?: string;
  limite?: number;
}

servirAvecCors(async (req: Request) => {
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return reponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(url, service);

    let corps: CorpsRequete;
    try {
      corps = await req.json();
    } catch {
      corps = {};
    }

    const { data: parametres } = await db
      .from('app_e08c374bc4_parametres_import')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (!parametres) return reponse({ error: 'Paramètres indisponibles.' }, 500);

    const { data: incoterm } = await db
      .from('app_e08c374bc4_parametres_incoterm')
      .select('incoterm, part_fret, assurance_a_charge')
      .eq('incoterm', parametres.incoterm_achat_defaut)
      .maybeSingle();
    if (!incoterm) return reponse({ error: 'Incoterm introuvable.' }, 500);

    const { data: grilleRemise } = await db
      .from('app_e08c374bc4_grille_remise')
      .select('quantite_min, taux_marge')
      .eq('actif', true)
      .order('quantite_min');

    let requete = db
      .from('app_e08c374bc4_releve_fret')
      .select('produit_id, espace, quantite, fret_lot_usd, transporteur, delai, options_total')
      .order('quantite');
    if (corps.releve_id) requete = requete.eq('releve_id', corps.releve_id);

    const { data: releves } = await requete;
    if (!releves?.length) return reponse({ error: 'Aucun relevé à rejouer.' }, 404);

    const parProduit = new Map<string, typeof releves>();
    for (const l of releves) {
      const cle = String(l.produit_id);
      if (!parProduit.has(cle)) parProduit.set(cle, [] as typeof releves);
      parProduit.get(cle)!.push(l);
    }

    const { data: produits } = await db
      .from('app_e08c374bc4_produits')
      .select('id, nom, espace, prix_achat_fcfa')
      .in('id', [...parProduit.keys()]);

    const comparaisons: Record<string, unknown>[] = [];

    for (const [produitId, lignes] of parProduit) {
      const p = produits?.find((x) => x.id === produitId);
      const prixAchatFcfa = Number(p?.prix_achat_fcfa ?? 0);
      if (!p || prixAchatFcfa <= 0) continue;

      // Une quantité sans offre reste une quantité sans devis : c'est ce que
      // `construirePaliers` attend, et elle l'écarte d'elle-même.
      const devis = lignes.map((l) => ({
        quantite: Number(l.quantite),
        fret:
          l.fret_lot_usd != null
            ? {
                prix_usd: Number(l.fret_lot_usd),
                transporteur: String(l.transporteur ?? ''),
                delai: l.delai ? String(l.delai) : null,
              }
            : null,
      }));

      const avant = paliersSelonAncienneRegle({
        prixAchatFcfa,
        devis,
        parametres,
        incoterm,
        grilleRemise,
      });

      const apres = construirePaliers({
        prixAchatFcfa,
        devis,
        parametres,
        incoterm,
        grilleRemise,
      });

      const renduDe = (prix: number, fret: number) =>
        parametres.fret_inclus_dans_prix === false ? prix + fret : prix;

      comparaisons.push({
        nom: p.nom,
        espace: p.espace,
        prix_achat_fcfa: prixAchatFcfa,
        avant: avant.map((x) => ({
          quantite: x.quantite_min,
          prix: x.prix_unitaire_fcfa,
          fret: x.fret_unitaire_fcfa,
          rendu: renduDe(x.prix_unitaire_fcfa, x.fret_unitaire_fcfa),
        })),
        apres: apres.map((x) => ({
          quantite: x.quantite_min,
          prix: x.prix_unitaire_fcfa,
          fret: x.cout_fret_unitaire_fcfa,
          rendu: renduDe(x.prix_unitaire_fcfa, x.cout_fret_unitaire_fcfa),
          marge_appliquee:
            [...(grilleRemise ?? [])]
              .sort((a, b) => a.quantite_min - b.quantite_min)
              .filter((g) => x.quantite_min >= g.quantite_min)
              .at(-1)?.taux_marge ?? parametres.taux_marge_defaut,
        })),
        paliers_rejetes: avant.length - apres.length,
      });
    }

    const rejetesEnTout = comparaisons.reduce(
      (s, c) => s + Number(c.paliers_rejetes ?? 0),
      0,
    );

    console.log(
      JSON.stringify({ requestId, produits: comparaisons.length, rejetesEnTout }),
    );

    return reponse(
      {
        success: true,
        produits_compares: comparaisons.length,
        paliers_rejetes_en_tout: rejetesEnTout,
        comparaisons,
      },
      200,
    );
  } catch (erreur) {
    console.log(JSON.stringify({ requestId, erreur: String(erreur) }));
    return reponse({ error: 'Erreur interne du serveur.' }, 500);
  }
});
