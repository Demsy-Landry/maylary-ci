import { createClient } from 'npm:@supabase/supabase-js@2';
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

type TypeDocument = 'proforma' | 'facture';
type SourceType = 'commande_gp' | 'devis_pro' | 'demande_import' | 'demande_export';

interface LigneFacture {
  designation: string;
  quantite: number;
  prix_unitaire: number;
  montant: number;
}

/**
 * Statuts à partir desquels chaque document devient émettable. Une proforma
 * s'émet dès que le montant est arrêté ; une facture seulement une fois
 * l'engagement pris (commande payée / devis validé).
 */
const STATUTS_PROFORMA: Record<SourceType, string[]> = {
  commande_gp: [
    'en_attente_paiement',
    'paiement_recu_verification',
    'paiement_confirme',
    'en_preparation',
    'expediee',
    'livree',
  ],
  devis_pro: ['devis_envoye', 'commande_confirmee'],
  demande_import: [
    'devis_envoye',
    'validee',
    'achat_effectue',
    'expedition_internationale',
    'arrivee_ci',
    'dedouanement',
    'transit_local',
    'livree',
  ],
  demande_export: [
    'devis_envoye',
    'validee',
    'collecte_effectuee',
    'dedouanement_export',
    'expedition_internationale',
    'arrivee_destination',
    'livree',
  ],
};

const STATUTS_FACTURE: Record<SourceType, string[]> = {
  commande_gp: ['paiement_confirme', 'en_preparation', 'expediee', 'livree'],
  devis_pro: ['commande_confirmee'],
  demande_import: [
    'validee',
    'achat_effectue',
    'expedition_internationale',
    'arrivee_ci',
    'dedouanement',
    'transit_local',
    'livree',
  ],
  demande_export: [
    'validee',
    'collecte_effectuee',
    'dedouanement_export',
    'expedition_internationale',
    'arrivee_destination',
    'livree',
  ],
};

const TABLE_PAR_SOURCE: Record<SourceType, string> = {
  commande_gp: 'app_e08c374bc4_commandes_gp',
  devis_pro: 'app_e08c374bc4_demandes_devis',
  demande_import: 'app_e08c374bc4_demandes_import',
  demande_export: 'app_e08c374bc4_demandes_export',
};

/** Ajoute une ligne au document si le montant est renseigné et non nul. */
function pousserLigne(lignes: LigneFacture[], designation: string, montant: unknown) {
  const valeur = Number(montant ?? 0);
  if (!valeur) return;
  lignes.push({ designation, quantite: 1, prix_unitaire: valeur, montant: valeur });
}

servirAvecCors(async (req: Request) => {
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Méthode non autorisée.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Authentification requise.' }, 401);
    }

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

    const body = await req.json().catch(() => null);
    if (!body) {
      return jsonResponse({ error: 'Corps de requête JSON invalide.' }, 400);
    }

    const source_type = body.source_type as SourceType;
    const source_id = body.source_id as string;
    const type_document = body.type_document as TypeDocument;

    if (!TABLE_PAR_SOURCE[source_type] || !source_id) {
      return jsonResponse({ error: 'source_type et source_id sont requis.' }, 400);
    }
    if (type_document !== 'proforma' && type_document !== 'facture') {
      return jsonResponse({ error: "type_document doit valoir 'proforma' ou 'facture'." }, 400);
    }

    const supabaseService = createClient(supabaseUrl, serviceRoleKey);

    const { data: profilAppelant } = await supabaseService
      .from('app_e08c374bc4_profiles')
      .select('type_compte')
      .eq('user_id', user.id)
      .maybeSingle();
    const estAdmin = profilAppelant?.type_compte === 'admin';

    // 1. Charge le document source et vérifie que l'appelant y a droit.
    const { data: source, error: sourceError } = await supabaseService
      .from(TABLE_PAR_SOURCE[source_type])
      .select('*')
      .eq('id', source_id)
      .maybeSingle();

    if (sourceError || !source) {
      return jsonResponse({ error: 'Document introuvable.' }, 404);
    }
    if (source.user_id !== user.id && !estAdmin) {
      return jsonResponse({ error: 'Accès refusé.' }, 403);
    }

    // 2. Vérifie que l'état d'avancement autorise ce type de document.
    const statutsAutorises =
      type_document === 'facture' ? STATUTS_FACTURE[source_type] : STATUTS_PROFORMA[source_type];
    if (!statutsAutorises.includes(source.statut)) {
      return jsonResponse(
        {
          error:
            type_document === 'facture'
              ? "La facture définitive sera disponible une fois la commande confirmée."
              : "Le montant n'est pas encore arrêté pour ce dossier.",
        },
        409,
      );
    }

    // 3. Un document numéroté ne se régénère pas : on renvoie l'existant.
    const { data: existante } = await supabaseService
      .from('app_e08c374bc4_factures')
      .select('*')
      .eq('source_type', source_type)
      .eq('source_id', source_id)
      .eq('type_document', type_document)
      .maybeSingle();

    if (existante) {
      return jsonResponse({ facture: existante, deja_emise: true }, 200);
    }

    // 4. Construit les lignes selon la nature du dossier.
    const lignes: LigneFacture[] = [];
    const reference_source: string | null = source.reference_publique ?? null;

    if (source_type === 'commande_gp') {
      const { data: lignesCommande } = await supabaseService
        .from('app_e08c374bc4_lignes_commande_gp')
        .select('nom_produit, quantite, prix_unitaire_fcfa, sous_total')
        .eq('commande_id', source_id);
      for (const l of lignesCommande ?? []) {
        lignes.push({
          designation: l.nom_produit,
          quantite: Number(l.quantite),
          prix_unitaire: Number(l.prix_unitaire_fcfa),
          montant: Number(l.sous_total),
        });
      }
    } else if (source_type === 'devis_pro') {
      const { data: lignesDevis } = await supabaseService
        .from('app_e08c374bc4_lignes_devis')
        .select('quantite, prix_unitaire_au_moment_demande, sous_total, produit_id')
        .eq('demande_devis_id', source_id);
      const produitIds = (lignesDevis ?? []).map((l) => l.produit_id).filter(Boolean);
      const { data: produits } = produitIds.length
        ? await supabaseService
            .from('app_e08c374bc4_produits')
            .select('id, nom')
            .in('id', produitIds)
        : { data: [] };
      const nomParId = new Map((produits ?? []).map((p) => [p.id, p.nom]));
      for (const l of lignesDevis ?? []) {
        lignes.push({
          designation: nomParId.get(l.produit_id) ?? 'Produit',
          quantite: Number(l.quantite),
          prix_unitaire: Number(l.prix_unitaire_au_moment_demande),
          montant: Number(l.sous_total),
        });
      }
    } else if (source_type === 'demande_import') {
      pousserLigne(lignes, 'Marchandise (achat fournisseur)', source.cout_marchandise_fcfa);
      pousserLigne(lignes, 'Fret international', source.cout_fret_fcfa);
      pousserLigne(lignes, 'Assurance transport', source.assurance_fcfa);
      pousserLigne(lignes, 'Droits et taxes de douane', source.douane_estimee_fcfa);
      pousserLigne(lignes, 'Transit local et manutention', source.transit_local_fcfa);
      pousserLigne(lignes, 'Livraison à destination', source.livraison_fcfa);
      pousserLigne(lignes, 'Frais de service et coordination Maylary', source.marge_fcfa);
    } else if (source_type === 'demande_export') {
      pousserLigne(lignes, 'Transport local et collecte', source.transport_local_fcfa);
      pousserLigne(lignes, "Douane export et formalités", source.douane_export_fcfa);
      pousserLigne(lignes, 'Fret international', source.cout_fret_fcfa);
      pousserLigne(lignes, 'Assurance transport', source.assurance_fcfa);
      pousserLigne(lignes, 'Certifications et documents', source.frais_certification_fcfa);
      pousserLigne(lignes, 'Livraison à destination', source.livraison_destination_fcfa);
      pousserLigne(lignes, 'Frais de service et coordination Maylary', source.marge_fcfa);
    }

    if (lignes.length === 0) {
      return jsonResponse({ error: 'Ce dossier ne comporte aucun montant facturable.' }, 409);
    }

    // 5. Identité du client et de l'émetteur, figées dans le document.
    const { data: profilClient } = await supabaseService
      .from('app_e08c374bc4_profiles')
      .select('nom_complet, nom_entreprise, telephone, ville, adresse_livraison_defaut')
      .eq('user_id', source.user_id)
      .maybeSingle();

    const { data: authClient } = await supabaseService.auth.admin.getUserById(source.user_id);

    const { data: parametres } = await supabaseService
      .from('app_e08c374bc4_parametres_facturation')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (!parametres) {
      return jsonResponse({ error: 'Paramètres de facturation introuvables.' }, 500);
    }

    const montant_ht = lignes.reduce((total, l) => total + l.montant, 0);
    const taux_tva = parametres.assujetti_tva ? Number(parametres.taux_tva) : 0;
    const montant_tva = Math.round(montant_ht * taux_tva);
    const montant_ttc = montant_ht + montant_tva;

    const dateEcheance = new Date();
    dateEcheance.setDate(
      dateEcheance.getDate() +
        (type_document === 'proforma' ? Number(parametres.validite_proforma_jours) : 30),
    );

    const numero = await supabaseService.rpc('app_e08c374bc4_prochain_numero_facture', {
      p_type: type_document,
    });
    if (numero.error || !numero.data) {
      console.log(JSON.stringify({ requestId, step: 'numerotation', error: numero.error }));
      return jsonResponse({ error: 'Impossible d’attribuer un numéro de document.' }, 500);
    }

    const { data: facture, error: insertError } = await supabaseService
      .from('app_e08c374bc4_factures')
      .insert({
        numero: numero.data,
        type_document,
        source_type,
        source_id,
        reference_source,
        user_id: source.user_id,
        client_nom: profilClient?.nom_complet ?? source.nom_destinataire ?? null,
        client_entreprise: profilClient?.nom_entreprise ?? null,
        client_telephone: profilClient?.telephone ?? source.telephone_destinataire ?? null,
        client_email: authClient?.user?.email ?? null,
        client_adresse: source.adresse_livraison ?? profilClient?.adresse_livraison_defaut ?? null,
        client_ville: source.ville_livraison ?? profilClient?.ville ?? null,
        lignes,
        montant_ht,
        taux_tva,
        montant_tva,
        montant_ttc,
        emetteur: parametres,
        conditions_paiement: parametres.conditions_paiement,
        date_echeance: dateEcheance.toISOString().slice(0, 10),
      })
      .select('*')
      .single();

    if (insertError || !facture) {
      console.log(JSON.stringify({ requestId, step: 'insert', error: insertError }));
      // Course possible : un autre appel a créé le document entre-temps.
      const { data: concurrente } = await supabaseService
        .from('app_e08c374bc4_factures')
        .select('*')
        .eq('source_type', source_type)
        .eq('source_id', source_id)
        .eq('type_document', type_document)
        .maybeSingle();
      if (concurrente) {
        return jsonResponse({ facture: concurrente, deja_emise: true }, 200);
      }
      return jsonResponse({ error: "Impossible d'émettre le document." }, 500);
    }

    console.log(JSON.stringify({ requestId, step: 'ok', numero: facture.numero }));
    return jsonResponse({ facture, deja_emise: false }, 200);
  } catch (error) {
    console.log(JSON.stringify({ requestId, error: String(error) }));
    return jsonResponse({ error: 'Erreur interne du serveur.' }, 500);
  }
});
