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

export const SECTEURS_TABLE = 'app_e08c374bc4_secteurs';
export const ENSEIGNES_TABLE = 'app_e08c374bc4_enseignes';
export const PROFILES_TABLE = 'app_e08c374bc4_profiles';
export const PRODUITS_TABLE = 'app_e08c374bc4_produits';
/** Vue publique sans le prix d'achat fournisseur : à utiliser pour TOUTE lecture côté client. */
export const PRODUITS_PUBLIC_VIEW = 'app_e08c374bc4_produits_public';
export const DEMANDES_DEVIS_TABLE = 'app_e08c374bc4_demandes_devis';
export const LIGNES_DEVIS_TABLE = 'app_e08c374bc4_lignes_devis';
export const HISTORIQUE_STATUT_TABLE = 'app_e08c374bc4_historique_statut_devis';
export const PRODUITS_FAVORIS_TABLE = 'app_e08c374bc4_produits_favoris';

export const FOURNISSEURS_TABLE = 'app_e08c374bc4_fournisseurs';
export const CATEGORIES_GP_TABLE = 'app_e08c374bc4_categories_gp';
export const PARAMETRES_PAIEMENT_TABLE = 'app_e08c374bc4_parametres_paiement';
export const COMMANDES_GP_TABLE = 'app_e08c374bc4_commandes_gp';
export const LIGNES_COMMANDE_GP_TABLE = 'app_e08c374bc4_lignes_commande_gp';
export const HISTORIQUE_COMMANDE_GP_TABLE = 'app_e08c374bc4_historique_statut_commande_gp';
export const PROSPECTION_FOURNISSEURS_TABLE = 'app_e08c374bc4_prospection_fournisseurs';

export type StockDisponible = 'en_stock' | 'sur_commande' | 'rupture';
export type StatutDevis =
  | 'nouvelle'
  | 'en_traitement'
  | 'devis_envoye'
  | 'commande_confirmee'
  | 'annulee';

export type Espace = 'pro' | 'grand_public';
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
