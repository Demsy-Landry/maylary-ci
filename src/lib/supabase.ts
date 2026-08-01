import { createClient } from '@supabase/supabase-js';

// Ces valeurs viennent des variables d'environnement Vercel (voir .env.example).
// La clé "anon" Supabase est publique par nature (visible côté navigateur) :
// la vraie protection des données vient des règles RLS côté Supabase, pas du secret de cette clé.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes. Vérifiez la configuration sur Vercel (Settings > Environment Variables) ou votre fichier .env local.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Base URL to invoke Supabase Edge Functions. Always use this, never window.location.origin. */
export const EDGE_FUNCTIONS_URL = `${supabaseUrl}/functions/v1`;

/** Public storage bucket for enseigne logos. */
export const LOGO_BUCKET = 'app_e08c374bc4_enseigne_logos';

/** Public storage bucket for produit photos. */
export const PRODUIT_PHOTOS_BUCKET = 'app_e08c374bc4_produit_photos';

/** Public storage bucket for reference photos uploaded by clients on an import request. */
export const IMPORT_PHOTOS_BUCKET = 'app_e08c374bc4_import_photos';
/** Public storage bucket for transit documents (invoices, BL, customs declarations). */
export const IMPORT_DOCUMENTS_BUCKET = 'app_e08c374bc4_import_documents';

/** Public storage bucket for reference photos uploaded by clients on an export request. */
export const EXPORT_PHOTOS_BUCKET = 'app_e08c374bc4_export_photos';
/** Public storage bucket for export documents (commercial invoice, certificates, customs declaration). */
export const EXPORT_DOCUMENTS_BUCKET = 'app_e08c374bc4_export_documents';

export const SECTEURS_TABLE = 'app_e08c374bc4_secteurs';
export const ENSEIGNES_TABLE = 'app_e08c374bc4_enseignes';
export const PROFILES_TABLE = 'app_e08c374bc4_profiles';
export const PRODUITS_TABLE = 'app_e08c374bc4_produits';
/** Vue publique sans le prix d'achat fournisseur : à utiliser pour TOUTE lecture côté client. */
export const PRODUITS_PUBLIC_VIEW = 'app_e08c374bc4_produits_public';
/** Grille de prix dégressive, exposée sans nos coûts. */
export const PALIERS_PRIX_PUBLIC_VIEW = 'app_e08c374bc4_paliers_prix_public';
export const DEMANDES_DEVIS_TABLE = 'app_e08c374bc4_demandes_devis';
export const LIGNES_DEVIS_TABLE = 'app_e08c374bc4_lignes_devis';
export const HISTORIQUE_STATUT_TABLE = 'app_e08c374bc4_historique_statut_devis';
export const PRODUITS_FAVORIS_TABLE = 'app_e08c374bc4_produits_favoris';

export const FOURNISSEURS_TABLE = 'app_e08c374bc4_fournisseurs';
export const CATEGORIES_GP_TABLE = 'app_e08c374bc4_categories_gp';
export const PARAMETRES_PAIEMENT_TABLE = 'app_e08c374bc4_parametres_paiement';
export const PARAMETRES_IMPORT_TABLE = 'app_e08c374bc4_parametres_import';
export const PARAMETRES_INCOTERM_TABLE = 'app_e08c374bc4_parametres_incoterm';
export const COMMANDES_GP_TABLE = 'app_e08c374bc4_commandes_gp';
export const LIGNES_COMMANDE_GP_TABLE = 'app_e08c374bc4_lignes_commande_gp';
export const HISTORIQUE_COMMANDE_GP_TABLE = 'app_e08c374bc4_historique_statut_commande_gp';
export const PROSPECTION_FOURNISSEURS_TABLE = 'app_e08c374bc4_prospection_fournisseurs';

export const DEMANDES_IMPORT_TABLE = 'app_e08c374bc4_demandes_import';
export const HISTORIQUE_IMPORT_TABLE = 'app_e08c374bc4_historique_statut_import';
export const DOCUMENTS_IMPORT_TABLE = 'app_e08c374bc4_documents_import';

export const DEMANDES_EXPORT_TABLE = 'app_e08c374bc4_demandes_export';
export const HISTORIQUE_EXPORT_TABLE = 'app_e08c374bc4_historique_statut_export';
export const DOCUMENTS_EXPORT_TABLE = 'app_e08c374bc4_documents_export';

export const FACTURES_TABLE = 'app_e08c374bc4_factures';
export const PARAMETRES_FACTURATION_TABLE = 'app_e08c374bc4_parametres_facturation';

export type StockDisponible = 'en_stock' | 'sur_commande' | 'rupture';
export type StatutDevis =
  | 'nouvelle'
  | 'en_traitement'
  | 'devis_envoye'
  | 'commande_confirmee'
  | 'annulee';

export type Espace = 'pro' | 'grand_public';

/**
 * Provenance d'un produit du catalogue. « import_international » signale au
 * client un article commandé à l'étranger (délai plus long) ; « local » un
 * article déjà disponible en Côte d'Ivoire.
 */
export type OrigineProduit = 'import_international' | 'local';

export const ORIGINE_PRODUIT_LABELS: Record<OrigineProduit, string> = {
  import_international: 'Import sur commande',
  local: 'Disponible localement',
};

export const ORIGINE_PRODUIT_DESCRIPTIONS: Record<OrigineProduit, string> = {
  import_international:
    "Article commandé à l'international par Maylary : comptez un délai de livraison plus long, mais un prix négocié à la source.",
  local: 'Article déjà disponible en Côte d’Ivoire : livraison rapide après confirmation de votre commande.',
};

export type Fiabilite = 'a_verifier' | 'fiable' | 'tres_fiable';
export type ModePaiement = 'virement' | 'mobile_money';
export type StatutCommandeGP =
  | 'en_attente_paiement'
  | 'paiement_recu_verification'
  | 'paiement_confirme'
  | 'en_preparation'
  | 'expediee'
  | 'livree'
  | 'annulee';

export const STATUT_LABELS: Record<StatutDevis, string> = {
  nouvelle: 'Nouvelle',
  en_traitement: 'En traitement',
  devis_envoye: 'Devis envoyé',
  commande_confirmee: 'Commande confirmée',
  annulee: 'Annulée',
};

export const FIABILITE_LABELS: Record<Fiabilite, string> = {
  a_verifier: 'À vérifier',
  fiable: 'Fiable',
  tres_fiable: 'Très fiable',
};

export const STATUT_COMMANDE_GP_LABELS: Record<StatutCommandeGP, string> = {
  en_attente_paiement: 'En attente de paiement',
  paiement_recu_verification: 'Paiement reçu — vérification en cours',
  paiement_confirme: 'Paiement confirmé',
  en_preparation: 'En préparation',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

/** Message affiché au client pour chaque statut, dans le suivi de commande. */
export const STATUT_COMMANDE_GP_MESSAGES: Record<StatutCommandeGP, string> = {
  en_attente_paiement:
    "En attente de votre paiement. Une fois réglé, cliquez sur « J'ai payé » pour nous en informer.",
  paiement_recu_verification:
    'Merci ! Nous vérifions la réception de votre paiement — cela peut prendre quelques heures. Vous serez notifié dès la confirmation.',
  paiement_confirme: 'Votre paiement est confirmé, votre commande va être préparée.',
  en_preparation: 'Votre commande est en cours de préparation.',
  expediee: 'Votre commande a été expédiée.',
  livree: 'Votre commande a été livrée. Merci de votre confiance !',
  annulee: "Cette commande a été annulée. Contactez-nous si vous avez des questions.",
};

export const MODE_PAIEMENT_LABELS: Record<ModePaiement, string> = {
  virement: 'Virement bancaire',
  mobile_money: 'Mobile Money',
};

export interface Secteur {
  id: string;
  nom: string;
  icone: string | null;
  actif: boolean;
  ordre_affichage: number;
  created_at: string;
  updated_at: string;
}

export interface Enseigne {
  id: string;
  secteur_id: string;
  nom: string;
  logo_url: string | null;
  description_courte: string | null;
  ville: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  type_compte: 'entreprise_acheteuse' | 'particulier' | 'admin';
  nom_complet: string;
  nom_entreprise: string | null;
  secteur_activite_client: string | null;
  telephone: string | null;
  ville: string | null;
  adresse_livraison_defaut: string | null;
}

/** Produit tel qu'exposé publiquement — ne contient JAMAIS le prix d'achat fournisseur. */
export interface Produit {
  id: string;
  enseigne_id: string | null;
  nom: string;
  description: string | null;
  prix_unitaire_fcfa: number;
  photos: string[];
  categorie: string | null;
  unite_vente: string | null;
  stock_disponible: StockDisponible;
  delai_livraison_estime: string | null;
  actif: boolean;
  espace: Espace;
  categorie_gp_id: string | null;
  /**
   * Quantité minimum de commande. Sur les articles importés à faible valeur
   * unitaire, elle répartit la part fixe du fret et de l'assurance et rend le
   * prix unitaire acceptable.
   */
  quantite_minimum: number;
  /** Grille de gros, chargée séparément depuis la vue des paliers. */
  paliers?: { quantite_min: number; prix_unitaire_fcfa: number }[];
  /**
   * Provenance du produit, exposée au client pour qu'il sache à quoi s'attendre
   * en termes de délai. Le nom du fournisseur réel n'est jamais divulgué.
   */
  origine: OrigineProduit;
  created_at: string;
  updated_at: string;
}

/** Vue admin complète du produit, incluant le prix d'achat privé — jamais utilisée côté public. */
export interface ProduitAdmin extends Produit {
  prix_achat_fcfa: number | null;
  fournisseur_id: string | null;
}

export interface Fournisseur {
  id: string;
  nom: string;
  contact: string | null;
  fiabilite: Fiabilite;
  secteur: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategorieGP {
  id: string;
  nom: string;
  image_url: string | null;
  ordre_affichage: number;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParametresPaiement {
  id: number;
  nom_banque: string | null;
  titulaire_compte: string | null;
  numero_compte_rib: string | null;
  mobile_money_operateur: string | null;
  mobile_money_numero: string | null;
  mobile_money_titulaire: string | null;
  instructions_complementaires: string | null;
  updated_at: string;
}

export interface ParametresImport {
  id: number;
  taux_marge_defaut: number;
  taux_change_usd_fcfa: number;
  /** Fret supporté pour un article, avant répartition selon l'incoterm. */
  fret_base_article_fcfa: number;
  /** Prix de vente minimum : empêche de vendre à perte les articles à très bas prix d'achat. */
  prix_plancher_fcfa: number;
  /** Taux de prime de l'assurance facultés (ex. 0.005 = 0,5 %). */
  taux_assurance: number;
  /** Règle des 110 % : la valeur assurée majore la valeur CIF. */
  taux_couverture_assurance: number;
  /** Frais de police, facturés une fois par expédition. */
  frais_police_assurance_fcfa: number;
  /** Taxe sur les contrats d'assurance, appliquée à la prime frais compris. */
  taux_taxe_assurance: number;
  incoterm_achat_defaut: Incoterm;
  /** Interroger CJ pour le coût de transport exact plutôt que d'appliquer le forfait. */
  utiliser_fret_reel_cj: boolean;
  /** Pays de livraison servant à demander le devis de transport (code ISO). */
  pays_destination_code: string;
  /** Lot appliqué aux articles bon marché, pour diluer les frais fixes du colis. */
  quantite_minimum_defaut: number;
  /** En dessous de ce prix d'achat, l'article est vendu par lot. */
  seuil_petit_article_fcfa: number;
  updated_at: string;
}

/** Répartition du fret et de l'assurance entre fournisseur et Maylary, par incoterm. */
export interface ParametresIncoterm {
  incoterm: Incoterm;
  libelle: string;
  part_fret: number;
  assurance_a_charge: boolean;
  /** Explique ce que le prix fournisseur couvre déjà sous cet incoterm. */
  commentaire: string | null;
  ordre_affichage: number;
  updated_at: string;
}

export interface CommandeGP {
  id: string;
  user_id: string;
  reference_publique: string;
  statut: StatutCommandeGP;
  mode_paiement: ModePaiement;
  montant_total_fcfa: number;
  nom_destinataire: string;
  telephone_destinataire: string;
  adresse_livraison: string;
  ville_livraison: string;
  notes_client: string | null;
  created_at: string;
  updated_at: string;
}

export interface LigneCommandeGP {
  id: string;
  commande_id: string;
  produit_id: string | null;
  nom_produit: string;
  quantite: number;
  prix_unitaire_fcfa: number;
  sous_total: number;
}

export interface HistoriqueStatutCommandeGP {
  id: string;
  commande_id: string;
  statut: StatutCommandeGP;
  horodatage: string;
  commentaire_admin: string | null;
}

export interface DemandeDevis {
  id: string;
  user_id: string;
  statut: StatutDevis;
  reference_publique: string;
  montant_total_estime_fcfa: number;
  notes_client: string | null;
  demande_source_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LigneDevis {
  id: string;
  demande_devis_id: string;
  produit_id: string | null;
  quantite: number;
  prix_unitaire_au_moment_demande: number;
  sous_total: number;
}

export interface HistoriqueStatutDevis {
  id: string;
  demande_devis_id: string;
  statut: StatutDevis;
  horodatage: string;
  commentaire_admin: string | null;
}

export interface ProduitFavori {
  id: string;
  user_id: string;
  produit_id: string;
  created_at: string;
}

export type StatutProspection = 'a_contacter' | 'contacte' | 'partenariat_signe';

export interface ProspectionFournisseur {
  id: string;
  nom_entreprise: string;
  secteur: string;
  offre: string | null;
  adresse: string | null;
  contact: string | null;
  site_web: string | null;
  priorite: 1 | 2 | 3;
  statut: StatutProspection;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const STATUT_PROSPECTION_LABELS: Record<StatutProspection, string> = {
  a_contacter: 'À contacter',
  contacte: 'Contacté',
  partenariat_signe: 'Partenariat signé',
};

export type StatutImport =
  | 'nouvelle'
  | 'en_cotation'
  | 'devis_envoye'
  | 'validee'
  | 'achat_effectue'
  | 'expedition_internationale'
  | 'arrivee_ci'
  | 'dedouanement'
  | 'transit_local'
  | 'livree'
  | 'annulee';

export type Incoterm = 'EXW' | 'FCA' | 'FOB' | 'CFR' | 'CIF' | 'DAP' | 'DDP';
export type ModeTransport = 'aerien' | 'maritime' | 'routier';
export type TypeDocumentImport =
  | 'facture_fournisseur'
  | 'packing_list'
  | 'connaissement_bl'
  | 'lta'
  | 'declaration_douaniere'
  | 'bon_livraison'
  | 'photo_produit'
  | 'autre';

export const STATUT_IMPORT_LABELS: Record<StatutImport, string> = {
  nouvelle: 'Nouvelle demande',
  en_cotation: 'En cours de cotation',
  devis_envoye: 'Devis envoyé',
  validee: 'Devis validé',
  achat_effectue: 'Achat effectué',
  expedition_internationale: 'Expédition internationale',
  arrivee_ci: 'Arrivée en Côte d\'Ivoire',
  dedouanement: 'Dédouanement en cours',
  transit_local: 'Transit local',
  livree: 'Livrée',
  annulee: 'Annulée',
};

/** Message affiché au client pour chaque étape, dans le suivi de sa demande. */
export const STATUT_IMPORT_MESSAGES: Record<StatutImport, string> = {
  nouvelle: 'Votre demande a bien été reçue. Notre équipe transit prépare votre cotation.',
  en_cotation: 'Nous chiffrons votre demande (marchandise, fret, douane, transit local).',
  devis_envoye: 'Votre devis est prêt. Consultez le détail et validez-le pour lancer votre commande.',
  validee: 'Devis validé, merci ! Nous lançons l\'achat auprès du fournisseur.',
  achat_effectue: 'Votre commande a été passée auprès du fournisseur.',
  expedition_internationale: 'Votre marchandise est en transport international.',
  arrivee_ci: 'Votre marchandise est arrivée en Côte d\'Ivoire.',
  dedouanement: 'Votre marchandise est en cours de dédouanement.',
  transit_local: 'Votre marchandise est en transit local vers votre adresse.',
  livree: 'Votre marchandise a été livrée. Merci de votre confiance !',
  annulee: 'Cette demande a été annulée. Contactez-nous si vous avez des questions.',
};

export const INCOTERM_LABELS: Record<Incoterm, string> = {
  EXW: 'EXW — Ex Works (départ usine)',
  FCA: 'FCA — Free Carrier',
  FOB: 'FOB — Free On Board',
  CFR: 'CFR — Cost and Freight',
  CIF: 'CIF — Cost, Insurance and Freight',
  DAP: 'DAP — Delivered At Place',
  DDP: 'DDP — Delivered Duty Paid',
};

export const MODE_TRANSPORT_LABELS: Record<ModeTransport, string> = {
  aerien: 'Aérien',
  maritime: 'Maritime',
  routier: 'Routier',
};

export const TYPE_DOCUMENT_LABELS: Record<TypeDocumentImport, string> = {
  facture_fournisseur: 'Facture fournisseur',
  packing_list: 'Packing list',
  connaissement_bl: 'Connaissement (B/L)',
  lta: "Lettre de transport aérien (LTA)",
  declaration_douaniere: 'Déclaration douanière',
  bon_livraison: 'Bon de livraison',
  photo_produit: 'Photo du produit',
  autre: 'Autre document',
};

export interface DemandeImport {
  id: string;
  user_id: string;
  reference_publique: string;
  statut: StatutImport;
  description_produit: string;
  lien_produit: string | null;
  photos: string[];
  quantite: number;
  pays_fournisseur: string | null;
  incoterm: Incoterm | null;
  mode_transport: ModeTransport;
  transporteur_souhaite: string | null;
  delai_souhaite: string | null;
  notes_client: string | null;
  poids_estime_kg: number | null;
  volume_estime_m3: number | null;
  valeur_marchandise_estimee_fcfa: number | null;
  estimation_indicative_fcfa: number | null;
  cout_marchandise_fcfa: number | null;
  cout_fret_fcfa: number | null;
  assurance_fcfa: number | null;
  douane_estimee_fcfa: number | null;
  transit_local_fcfa: number | null;
  livraison_fcfa: number | null;
  marge_fcfa: number | null;
  montant_total_devis_fcfa: number | null;
  commentaire_admin_devis: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistoriqueStatutImport {
  id: string;
  demande_import_id: string;
  statut: StatutImport;
  commentaire_admin: string | null;
  horodatage: string;
}

export interface DocumentImport {
  id: string;
  demande_import_id: string;
  type_document: TypeDocumentImport;
  nom_fichier: string;
  url: string;
  uploaded_by: string | null;
  created_at: string;
}

/**
 * Estimation indicative très grossière (avant cotation réelle) pour donner
 * un ordre de grandeur immédiat au client. Tarifs au kilo par mode de
 * transport + majoration selon l'incoterm choisi ; la cotation ferme de
 * l'équipe transit prévaudra toujours sur ce chiffre.
 */
const TARIF_FRET_FCFA_PAR_KG: Record<ModeTransport, number> = {
  aerien: 4500,
  maritime: 1200,
  routier: 2000,
};

const MAJORATION_INCOTERM: Record<Incoterm, number> = {
  EXW: 1.15,
  FCA: 1.1,
  FOB: 1.05,
  CFR: 1.0,
  CIF: 0.95,
  DAP: 0.85,
  DDP: 0.75,
};

export function estimerCoutIndicatifFcfa(params: {
  poidsKg: number;
  valeurMarchandiseFcfa: number;
  modeTransport: ModeTransport;
  incoterm: Incoterm | null;
}): number {
  const { poidsKg, valeurMarchandiseFcfa, modeTransport, incoterm } = params;
  const fret = poidsKg * TARIF_FRET_FCFA_PAR_KG[modeTransport];
  const majoration = incoterm ? MAJORATION_INCOTERM[incoterm] : 1;
  const douaneEtTransitEstimes = (valeurMarchandiseFcfa + fret) * 0.25;
  return Math.round((valeurMarchandiseFcfa + fret * majoration + douaneEtTransitEstimes) / 100) * 100;
}

export type StatutExport =
  | 'nouvelle'
  | 'en_cotation'
  | 'devis_envoye'
  | 'validee'
  | 'collecte_effectuee'
  | 'dedouanement_export'
  | 'expedition_internationale'
  | 'arrivee_destination'
  | 'livree'
  | 'annulee';

export type TypeDocumentExport =
  | 'facture_commerciale'
  | 'packing_list'
  | 'certificat_origine'
  | 'certificat_phytosanitaire'
  | 'declaration_exportation'
  | 'connaissement_bl'
  | 'lta'
  | 'bon_livraison'
  | 'photo_produit'
  | 'autre';

export const STATUT_EXPORT_LABELS: Record<StatutExport, string> = {
  nouvelle: 'Nouvelle demande',
  en_cotation: 'En cours de cotation',
  devis_envoye: 'Devis envoyé',
  validee: 'Devis validé',
  collecte_effectuee: 'Collecte effectuée',
  dedouanement_export: "Dédouanement export en cours",
  expedition_internationale: 'Expédition internationale',
  arrivee_destination: 'Arrivée à destination',
  livree: 'Livrée à l’acheteur',
  annulee: 'Annulée',
};

/** Message affiché au client pour chaque étape, dans le suivi de sa demande d'export. */
export const STATUT_EXPORT_MESSAGES: Record<StatutExport, string> = {
  nouvelle: 'Votre demande a bien été reçue. Notre équipe transit prépare votre cotation.',
  en_cotation: 'Nous chiffrons votre demande (transport local, douane export, fret, certifications).',
  devis_envoye: 'Votre devis est prêt. Consultez le détail et validez-le pour lancer votre exportation.',
  validee: 'Devis validé, merci ! Nous organisons la collecte de votre marchandise.',
  collecte_effectuee: 'Votre marchandise a été collectée et préparée pour l’export.',
  dedouanement_export: 'Votre marchandise est en cours de dédouanement à l’export.',
  expedition_internationale: 'Votre marchandise est en transport international.',
  arrivee_destination: 'Votre marchandise est arrivée à destination.',
  livree: 'Votre marchandise a été livrée à l’acheteur. Merci de votre confiance !',
  annulee: 'Cette demande a été annulée. Contactez-nous si vous avez des questions.',
};

export const TYPE_DOCUMENT_EXPORT_LABELS: Record<TypeDocumentExport, string> = {
  facture_commerciale: 'Facture commerciale',
  packing_list: 'Packing list',
  certificat_origine: "Certificat d'origine",
  certificat_phytosanitaire: 'Certificat phytosanitaire',
  declaration_exportation: "Déclaration d'exportation",
  connaissement_bl: 'Connaissement (B/L)',
  lta: 'Lettre de transport aérien (LTA)',
  bon_livraison: 'Bon de livraison',
  photo_produit: 'Photo du produit',
  autre: 'Autre document',
};

export interface DemandeExport {
  id: string;
  user_id: string;
  reference_publique: string;
  statut: StatutExport;
  description_produit: string;
  pays_destination: string | null;
  acheteur_destinataire: string | null;
  contact_acheteur: string | null;
  photos: string[];
  quantite: number;
  incoterm: Incoterm | null;
  mode_transport: ModeTransport;
  transporteur_souhaite: string | null;
  delai_souhaite: string | null;
  notes_client: string | null;
  poids_estime_kg: number | null;
  volume_estime_m3: number | null;
  valeur_marchandise_estimee_fcfa: number | null;
  estimation_indicative_fcfa: number | null;
  transport_local_fcfa: number | null;
  douane_export_fcfa: number | null;
  cout_fret_fcfa: number | null;
  assurance_fcfa: number | null;
  frais_certification_fcfa: number | null;
  livraison_destination_fcfa: number | null;
  marge_fcfa: number | null;
  montant_total_devis_fcfa: number | null;
  commentaire_admin_devis: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistoriqueStatutExport {
  id: string;
  demande_export_id: string;
  statut: StatutExport;
  commentaire_admin: string | null;
  horodatage: string;
}

export interface DocumentExport {
  id: string;
  demande_export_id: string;
  type_document: TypeDocumentExport;
  nom_fichier: string;
  url: string;
  uploaded_by: string | null;
  created_at: string;
}

/** Même logique d'estimation indicative que pour l'import, réutilisée pour l'export. */
export function estimerCoutIndicatifExportFcfa(params: {
  poidsKg: number;
  valeurMarchandiseFcfa: number;
  modeTransport: ModeTransport;
  incoterm: Incoterm | null;
}): number {
  return estimerCoutIndicatifFcfa(params);
}

/* ------------------------------------------------------------------ */
/* Facturation                                                         */
/* ------------------------------------------------------------------ */

export type TypeDocumentFacture = 'proforma' | 'facture';

/** Nature du dossier à l'origine du document facturé. */
export type SourceFacture = 'commande_gp' | 'devis_pro' | 'demande_import' | 'demande_export';

export const SOURCE_FACTURE_LABELS: Record<SourceFacture, string> = {
  commande_gp: 'Commande boutique',
  devis_pro: 'Devis professionnel',
  demande_import: "Dossier d'import",
  demande_export: "Dossier d'export",
};

export interface LigneFacture {
  designation: string;
  quantite: number;
  prix_unitaire: number;
  montant: number;
}

/** Identité de l'émetteur, figée dans chaque document au moment de l'émission. */
export interface ParametresFacturation {
  id: number;
  raison_sociale: string;
  nom_commercial: string;
  adresse: string | null;
  ville: string;
  pays: string;
  telephone: string | null;
  email: string | null;
  site_web: string | null;
  rccm: string | null;
  ncc: string | null;
  assujetti_tva: boolean;
  taux_tva: number;
  conditions_paiement: string | null;
  coordonnees_paiement: string | null;
  mentions_bas_page: string | null;
  validite_proforma_jours: number;
  updated_at: string;
}

/**
 * Document émis et numéroté. Une fois créé il n'est jamais modifié : c'est la
 * pièce comptable de référence, y compris si les tarifs changent ensuite.
 */
export interface Facture {
  id: string;
  numero: string;
  type_document: TypeDocumentFacture;
  source_type: SourceFacture;
  source_id: string;
  reference_source: string | null;
  user_id: string;
  client_nom: string | null;
  client_entreprise: string | null;
  client_telephone: string | null;
  client_email: string | null;
  client_adresse: string | null;
  client_ville: string | null;
  lignes: LigneFacture[];
  montant_ht: number;
  taux_tva: number;
  montant_tva: number;
  montant_ttc: number;
  emetteur: Partial<ParametresFacturation>;
  conditions_paiement: string | null;
  date_emission: string;
  date_echeance: string | null;
  created_at: string;
}
