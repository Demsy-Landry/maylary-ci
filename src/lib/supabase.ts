import { createClient } from '@supabase/supabase-js';

// Coordonnées du projet Supabase de MayLary Group.
//
// Ces deux valeurs sont publiques par construction : elles partent dans le
// paquet envoyé au navigateur, l'URL figure déjà en clair dans l'en-tête
// Content-Security-Policy de `vercel.json` et dans les adresses d'images du
// site. La protection des données ne vient pas de leur secret — elle vient des
// règles RLS, éprouvées côté Supabase.
//
// Elles servent de repli et non de réglage principal : les variables
// d'environnement restent prioritaires, pour qu'un environnement de recette
// puisse viser une autre base sans toucher au code. Mais l'application ne doit
// pas dépendre d'elles pour démarrer. Elle le faisait, et cette dépendance a
// déjà coûté cher : quand l'intégration Vercel ↔ Supabase se détache, les
// variables disparaissent avec elle et le site s'ouvrait sur une page blanche —
// une panne totale pour un réglage de tableau de bord.
const URL_PROJET = 'https://oubowmftzxpruckjzwuq.supabase.co';
const CLE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91Ym93bWZ0enhwcnVja2p6d3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NjIyNjcsImV4cCI6MjEwMDAzODI2N30.pCNBwo_TJCxTxPYSeoAsTltqVwPgQRBVXd7NKe-3qs4';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || URL_PROJET;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || CLE_ANON;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Racine des fichiers publics (photos produits, visuels d'accueil, secteurs).
 *
 * Elle était recopiée à la main dans chaque page qui affiche une image. Une
 * adresse recopiée finit toujours par diverger : elle se dérive désormais de
 * l'URL du projet, comme le reste.
 */
export const STORAGE_PUBLIC_URL = `${supabaseUrl}/storage/v1/object/public`;

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
/** @deprecated Remplacée par CANAUX_PAIEMENT_TABLE, qui accepte plusieurs canaux. */
export const PARAMETRES_PAIEMENT_TABLE = 'app_e08c374bc4_parametres_paiement';
/** Coordonnées d'encaissement : lecture réservée aux comptes connectés. */
export const CANAUX_PAIEMENT_TABLE = 'app_e08c374bc4_canaux_paiement';
/** Compartiment privé des reçus de paiement déposés par les clients. */
export const PREUVES_PAIEMENT_BUCKET = 'app_e08c374bc4_preuves_paiement';
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

export const DEMANDES_SOURCING_TABLE = 'app_e08c374bc4_demandes_sourcing';

export const VENDEURS_TABLE = 'app_e08c374bc4_vendeurs';
export const VENDEURS_PUBLIC_VIEW = 'app_e08c374bc4_vendeurs_public';
export const REVERSEMENTS_TABLE = 'app_e08c374bc4_reversements';
export const PARAMETRES_MARKETPLACE_TABLE = 'app_e08c374bc4_parametres_marketplace';

export const FACTURES_TABLE = 'app_e08c374bc4_factures';
export const PARAMETRES_FACTURATION_TABLE = 'app_e08c374bc4_parametres_facturation';

/** Avis clients : écriture réservée à l'auteur d'une commande livrée (RLS). */
export const AVIS_ARTICLES_TABLE = 'app_e08c374bc4_avis_articles';
/** Lecture publique d'un avis : ni user_id, ni commande_id, nom abrégé. */
export const AVIS_PUBLIC_VIEW = 'app_e08c374bc4_avis_public';
/** Note moyenne par produit, pour les vignettes de catalogue. */
export const NOTES_PRODUITS_VIEW = 'app_e08c374bc4_notes_produits';
export const INCIDENTS_FOURNISSEUR_TABLE = 'app_e08c374bc4_incidents_fournisseur';
/** Fiche de qualité par atelier — vide pour tout autre que l'administrateur. */
export const QUALITE_FOURNISSEURS_VIEW = 'app_e08c374bc4_qualite_fournisseurs';

/* --- Comptabilité (partie double, réservée à l'administrateur) ----------- */
export const COMPTES_TABLE = 'app_e08c374bc4_comptes';
export const JOURNAUX_TABLE = 'app_e08c374bc4_journaux';
export const ECRITURES_TABLE = 'app_e08c374bc4_ecritures';
export const LIGNES_ECRITURE_TABLE = 'app_e08c374bc4_lignes_ecriture';
export const BALANCE_VIEW = 'app_e08c374bc4_balance';
export const GRAND_LIVRE_VIEW = 'app_e08c374bc4_grand_livre';
export const COMPTE_RESULTAT_VIEW = 'app_e08c374bc4_compte_resultat';

/** Un compte du plan comptable, dans la logique des classes SYSCOHADA. */
export interface CompteComptable {
  code: string;
  libelle: string;
  classe: number;
  sens: 'debit' | 'credit';
  actif: boolean;
  note: string | null;
}

export interface LigneGrandLivre {
  id: string;
  numero: string;
  date_ecriture: string;
  journal: string;
  ecriture_libelle: string;
  piece: string | null;
  source_type: string | null;
  source_id: string | null;
  compte: string;
  compte_libelle: string;
  ligne_libelle: string | null;
  debit_fcfa: number;
  credit_fcfa: number;
  ordre: number;
}

export interface LigneBalance {
  code: string;
  libelle: string;
  classe: number;
  sens: 'debit' | 'credit';
  total_debit: number;
  total_credit: number;
  solde: number;
}

export interface LigneCompteResultat {
  classe: number;
  nature: 'Charges' | 'Produits';
  code: string;
  libelle: string;
  montant: number;
}

export const JOURNAUX_LABELS: Record<string, string> = {
  VE: 'Ventes',
  AC: 'Achats',
  BQ: 'Banque',
  MM: 'Monnaie électronique',
  OD: 'Opérations diverses',
};

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
export type OrigineProduit = 'import_international' | 'local' | 'vendeur_local';

export const ORIGINE_PRODUIT_LABELS: Record<OrigineProduit, string> = {
  import_international: 'Import sur commande',
  local: 'Disponible localement',
  vendeur_local: 'Vendu par une entreprise ivoirienne',
};

export const ORIGINE_PRODUIT_DESCRIPTIONS: Record<OrigineProduit, string> = {
  import_international:
    "Article commandé à l'international par MayLary Group : comptez un délai de livraison plus long, mais un prix négocié à la source.",
  local: 'Article déjà disponible en Côte d’Ivoire : livraison rapide après confirmation de votre commande.',
  vendeur_local:
    'Article proposé par une entreprise ivoirienne inscrite sur MayLary Group. MayLary Group sécurise le paiement et suit la livraison.',
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
  /** Visuels du rayon, dans l'ordre de défilement. Vide : illustration dessinée. */
  photos: string[];
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
  /** Rôle interne MayLary Group. Null pour un client. */
  role_equipe: RoleEquipe | null;
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

export type TypeCanalPaiement = 'mobile_money' | 'virement' | 'lien_paiement';

export const TYPE_CANAL_LABELS: Record<TypeCanalPaiement, string> = {
  mobile_money: 'Mobile Money',
  virement: 'Virement bancaire',
  lien_paiement: 'Lien de paiement',
};

/**
 * Un moyen d'encaissement de MayLary Group. Plusieurs coexistent : en Côte d'Ivoire
 * un commerçant encaisse sur Wave, Orange Money, MTN, Moov et par virement, et
 * imposer un seul canal revient à refuser les clients des autres.
 */
export interface CanalPaiement {
  id: string;
  type_canal: TypeCanalPaiement;
  /** « Wave », « Orange Money », « Ecobank »… tel que le client le reconnaîtra. */
  libelle: string;
  /**
   * Numéro marchand, IBAN/RIB, ou URL du lien de paiement selon le type. Le
   * champ garde son nom : le renommer imposerait de toucher toutes les lectures
   * pour un gain nul.
   */
  numero: string;
  /** Sans objet pour un lien : c'est la page du marchand qui affiche son nom. */
  titulaire: string | null;
  instructions: string | null;
  actif: boolean;
  ordre: number;
  created_at: string;
  updated_at: string;
}

/** @deprecated Remplacée par CanalPaiement. */
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
  /** Rapport maximum toléré entre le fret et le prix d'achat d'un article. */
  ratio_fret_maximum: number;
  /** En dessous de ce montant de commande minimum, le rapport de fret n'est pas opposé. */
  seuil_commande_surveillee_fcfa: number;
  updated_at: string;
}

/** Répartition du fret et de l'assurance entre fournisseur et MayLary Group, par incoterm. */
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
  /** Référence de la commande chez le fournisseur, une fois transmise. */
  reference_fournisseur: string | null;
  numero_suivi: string | null;
  transporteur_suivi: string | null;
  statut_fournisseur: string | null;
  suivi_maj_le: string | null;
  url_suivi: string | null;
  cout_fournisseur_usd: number | null;
  envoye_fournisseur_le: string | null;
  erreur_fournisseur: string | null;
  /** Transporteur retenu par le client au moment de commander. */
  transporteur_choisi: string | null;
  /** Écart payé par rapport à la livraison économique, déjà comprise dans les prix. */
  supplement_transporteur_fcfa: number;
  delai_transporteur: string | null;

  /* --- Règlement -------------------------------------------------------- */
  /** Canal par lequel le client dit avoir payé (« Wave », « Ecobank »…). */
  canal_paiement_declare: string | null;
  reference_transaction: string | null;
  /** Chemin du reçu dans le compartiment privé. Jamais une URL : elle expirerait. */
  preuve_paiement_chemin: string | null;
  paiement_declare_le: string | null;
  /** Ce que le client dit avoir versé, refusé par le serveur s'il diffère du dû. */
  montant_declare_fcfa: number | null;
  /**
   * Ce qui est réellement arrivé, distinct de `montant_total_fcfa` qui est ce
   * qui était dû. Les confondre effacerait le règlement partiel, précisément le
   * cas qu'on veut voir.
   */
  montant_recu_fcfa: number | null;
  paiement_confirme_le: string | null;
  paiement_confirme_par: string | null;
  note_reglement: string | null;

  /* --- Garantie « payé, protégé » --------------------------------------- */
  /** Bascule vers « livrée ». Point de départ du délai de contestation. */
  livree_le: string | null;
  /** Réception acquise : le client a confirmé, ou le délai a couru. */
  reception_confirmee_le: string | null;
  reception_confirmee_par: 'client' | 'delai' | 'administration' | null;
}

export const PARAMETRES_GARANTIE_TABLE = 'app_e08c374bc4_parametres_garantie';
export const REVERSEMENTS_DUS_VIEW = 'app_e08c374bc4_reversements_dus';

/* --- Le Déclarant : douane, position tarifaire et liquidation ------------ */
export const TEC_TABLE = 'app_e08c374bc4_tec_dd_reference';
export const REGIMES_DOUANIERS_TABLE = 'app_e08c374bc4_regimes_douaniers';
export const TAXES_DOUANIERES_TABLE = 'app_e08c374bc4_taxes_douanieres';

/** Une ligne du corpus TEC UEMOA. Le taux y est en pourcentage (5.00 = 5 %). */
export interface PositionTec {
  code_hs: string;
  designation: string;
  unite_us: string | null;
  taux_dd: number;
  categorie: number | null;
  /** « a_verifier » : la ligne source était ambiguë, l'écran doit le dire. */
  statut: 'actif' | 'obsolete' | 'a_verifier';
  pertinence?: number;
}

/**
 * Réponse de la vérification d'un code.
 *
 * Quand `trouve` vaut faux, `taux_dd_pourcent` est toujours nul — c'est la
 * règle absolue du module : on n'affiche jamais un taux qu'on n'a pas vérifié.
 */
export interface VerificationTec {
  trouve: boolean;
  code_hs?: string;
  code_recherche?: string | null;
  designation?: string;
  unite_us?: string | null;
  taux_dd_pourcent: number | null;
  categorie?: number | null;
  statut?: string;
  verifie_en_base: boolean;
  mention?: string;
  code_proche_indicatif?: string | null;
  designation_proche?: string | null;
  mention_utilisateur?: string;
  tarif: { libelle: string; date_version: string };
}

export interface RegimeDouanier {
  code: string;
  libelle: string;
  categorie: string | null;
  droits_exigibles: boolean;
  rpi_exigible: boolean;
  ts_exigible: boolean;
  caution_requise: boolean;
  depend_autorisation: boolean;
  mention: string;
  ordre: number;
  /** Sens de l'opération : le Déclarant ne liquide que l'importation. */
  sens: 'import' | 'export' | 'transit' | 'special';
  /**
   * Faux tant que le traitement fiscal du régime n'a pas été confirmé. Le
   * régime reste affiché — il est au référentiel officiel — mais aucun total
   * n'en est tiré, côté serveur comme côté écran.
   */
  liquidation_supportee: boolean;
  source: string;
}

/** Une ligne envoyée au moteur de liquidation. Le taux est une fraction. */
export interface LigneDeclaration {
  numero: string;
  designation: string;
  position: string;
  /** Fraction (0.20 pour 20 %) — le moteur refuse un pourcentage. */
  taux_dd?: number | null;
  fob: number;
  poids_brut: number;
}

export interface TaxeLiquidee {
  code: string;
  libelle: string;
  base_fcfa: number;
  taux: number;
  montant_fcfa: number;
  confirme: boolean;
}

export interface LigneLiquidee {
  numero: string | null;
  designation: string | null;
  position: string | null;
  designation_tec: string | null;
  unite_us: string | null;
  verifie_en_base: boolean;
  taux_dd: number;
  taux_dd_saisi: boolean;
  fob_fcfa: number;
  poids_brut_kg: number;
  poids_stat_kg: number;
  fret_fcfa: number;
  assurance_fcfa: number;
  part_fret: number;
  part_valeur: number;
  caf_fcfa: number;
  base_tva_fcfa: number;
  taxes: TaxeLiquidee[];
}

export interface Liquidation {
  regime: {
    code: string;
    libelle: string;
    mention: string;
    categorie: string | null;
    droits_exigibles: boolean;
    caution_requise: boolean;
    depend_autorisation: boolean;
  };
  tarif: { libelle: string; date_version: string };
  tarif_confirme: boolean;
  globaux: {
    fob_total_fcfa: number;
    fret_total_fcfa: number;
    assurance_total_fcfa: number;
    poids_brut_total_kg: number;
    caf_total_fcfa: number;
  };
  lignes: LigneLiquidee[];
  totaux_taxes: Record<string, number>;
  total_a_payer_fcfa: number;
}

export const CLASSIFICATIONS_HS_TABLE = 'app_e08c374bc4_classifications_hs';

/**
 * Le résultat d'une classification assistée.
 *
 * La séparation entre ce que le modèle propose et ce que le corpus confirme est
 * volontairement visible jusque dans le type : `code_propose` vient du modèle,
 * `taux_dd` vient du TEC et vaut `null` dès que `verifie_en_base` est faux. Un
 * champ unique laisserait croire qu'un taux non vérifié est affichable.
 */
export interface ClassificationHs {
  id: string | null;
  description: string;
  /** Proposé par le modèle. Nul si la description était trop vague. */
  code_propose: string | null;
  section: string | null;
  chapitre: string | null;
  position_sh: string | null;
  sous_position: string | null;
  caracteristiques: string | null;
  raisonnement_rgi: string | null;
  notes_declarant: string | null;
  /** La précision qui manque au modèle pour trancher, ou nul. */
  question: string | null;
  fournisseur: string;
  modele: string;
  /** Confirmé dans le corpus TEC. Sans cela, aucun taux n'est montré. */
  verifie_en_base: boolean;
  designation_tec: string | null;
  unite_us: string | null;
  /** En pourcentage (10 = 10 %). Toujours nul si `verifie_en_base` est faux. */
  taux_dd: number | null;
  mention: string;
  code_proche_indicatif: string | null;
  tarif: { libelle: string; date_version: string } | null;
  /** Classifications restantes pour la journée. */
  restant?: number;
}

/** Une ligne de l'historique, telle qu'elle est stockée. */
export interface ClassificationEnregistree {
  id: string;
  description: string;
  code_propose: string | null;
  designation_tec: string | null;
  verifie_en_base: boolean;
  taux_dd: number | null;
  cree_le: string;
}

export interface QuotaClassification {
  connecte: boolean;
  plafond: number;
  faites?: number;
  restant: number;
  actif: boolean;
}

/* --- Achat groupé ------------------------------------------------------- */
export const ACHATS_GROUPES_TABLE = 'app_e08c374bc4_achats_groupes';
export const ACHATS_GROUPES_PUBLICS_VIEW = 'app_e08c374bc4_achats_groupes_publics';
export const PARTICIPATIONS_ACHAT_GROUPE_TABLE = 'app_e08c374bc4_participations_achat_groupe';

export type StatutAchatGroupe = 'ouverte' | 'reussie' | 'echouee' | 'annulee';

export const STATUT_ACHAT_GROUPE_LABELS: Record<StatutAchatGroupe, string> = {
  ouverte: 'En cours',
  reussie: 'Objectif atteint',
  echouee: 'Objectif non atteint',
  annulee: 'Annulé',
};

/**
 * Un achat groupé tel qu'il se montre — y compris à un visiteur sans compte.
 *
 * Le compteur de réservations est public parce que c'est lui qui donne envie de
 * rejoindre ; les réservations elles-mêmes ne le sont pas. La vue n'expose que
 * des agrégats, jamais un nom.
 */
export interface AchatGroupePublic {
  id: string;
  reference_publique: string;
  produit_id: string;
  titre: string;
  argumentaire: string | null;
  photos: string[] | null;
  /** Prix rendu, tout compris, ferme dès la publication. */
  prix_unitaire_groupe_fcfa: number;
  /** Prix catalogue figé à l'ouverture, pour que l'économie annoncée ne bouge pas. */
  prix_unitaire_normal_fcfa: number;
  economie_unitaire_fcfa: number;
  quantite_objectif: number;
  quantite_maximum: number | null;
  quantite_max_par_client: number;
  cloture_prevue_le: string;
  statut: StatutAchatGroupe;
  cloturee_le: string | null;
  quantite_reservee: number;
  participants: number;
  quantite_manquante: number;
}

export interface ParticipationAchatGroupe {
  id: string;
  campagne_id: string;
  user_id: string;
  quantite: number;
  nom_destinataire: string;
  telephone_destinataire: string;
  adresse_livraison: string;
  ville_livraison: string;
  statut: 'reservee' | 'commandee' | 'abandonnee';
  commande_id: string | null;
  created_at: string;
}

/**
 * Ce qu'on doit à un vendeur, et ce qu'on retient encore.
 *
 * Le partage entre `retenu` et `libere` est la garantie elle-même : tant que la
 * réception n'est pas acquise, l'argent reste du côté de l'acheteur.
 */
export interface ReversementsDus {
  vendeur_id: string;
  nom_entreprise: string;
  /** Réception acquise : reversable. */
  libere_fcfa: number;
  /** Livré, mais le client peut encore contester. */
  retenu_fcfa: number;
  /** Payé par le client, pas encore arrivé chez lui. */
  en_cours_fcfa: number;
  deja_reverse_fcfa: number;
  /** `libere` moins ce qui a déjà été engagé. C'est le plafond d'un reversement. */
  disponible_fcfa: number;
}

/**
 * Une offre de transport du fournisseur pour le panier entier.
 *
 * `supplement_fcfa` se compte par rapport à l'option économique, la seule déjà
 * comprise dans les prix affichés en boutique. Choisir plus rapide ajoute donc
 * une ligne au total ; ça ne refait jamais le prix des articles.
 */
export interface OptionTransport {
  transporteur: string;
  delai: string | null;
  prix_fcfa: number;
  supplement_fcfa: number;
  economique: boolean;
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

/**
 * Avis déposé par un client sur un article qu'il a réellement reçu. La table
 * n'est ouverte en écriture que si la commande lui appartient, qu'elle est
 * livrée, et que l'article y figurait — la base le vérifie, pas le formulaire.
 */
export interface AvisArticle {
  id: string;
  produit_id: string;
  commande_id: string;
  user_id: string;
  note: number;
  commentaire: string | null;
  publie: boolean;
  motif_retrait: string | null;
  created_at: string;
}

/** Ce qu'une fiche produit affiche : jamais l'acheteur, jamais la commande. */
export interface AvisPublic {
  id: string;
  produit_id: string;
  note: number;
  commentaire: string | null;
  created_at: string;
  auteur: string;
}

export interface NoteProduit {
  produit_id: string;
  note_moyenne: number;
  nb_avis: number;
}

/**
 * Défaut constaté par nous, que le client ne verra jamais : un article cassé
 * remplacé avant expédition ne produit aucun mauvais avis mais coûte, et dit
 * quelque chose de l'atelier.
 */
export type TypeIncidentFournisseur =
  | 'article_defectueux'
  | 'non_conforme'
  | 'rupture_apres_commande'
  | 'retard_expedition'
  | 'emballage_insuffisant'
  | 'quantite_manquante'
  | 'autre';

export const TYPE_INCIDENT_LABELS: Record<TypeIncidentFournisseur, string> = {
  article_defectueux: 'Article défectueux',
  non_conforme: 'Non conforme à la fiche',
  rupture_apres_commande: 'Rupture après commande',
  retard_expedition: "Retard d'expédition",
  emballage_insuffisant: 'Emballage insuffisant',
  quantite_manquante: 'Quantité manquante',
  autre: 'Autre',
};

export interface IncidentFournisseur {
  id: string;
  produit_id: string | null;
  commande_id: string | null;
  fournisseur_origine_id: string | null;
  fournisseur_origine: string | null;
  type_incident: TypeIncidentFournisseur;
  description: string;
  cout_fcfa: number;
  constate_par: string | null;
  created_at: string;
}

/**
 * Fiche de qualité d'un atelier. `taux_incident_pct` est nul tant qu'aucune
 * pièce n'a été livrée : zéro pour cent sans livraison se lirait comme un
 * sans-faute alors que c'est une absence de mesure.
 */
export interface QualiteFournisseur {
  fournisseur_origine_id: string;
  fournisseur: string | null;
  articles_actifs: number;
  marchands_max: number | null;
  pieces_livrees: number;
  note_moyenne: number | null;
  nb_avis: number;
  nb_incidents: number;
  cout_incidents_fcfa: number;
  taux_incident_pct: number | null;
}

/**
 * Sourcing sur demande : le client décrit un article absent du catalogue, nous
 * le cherchons chez nos fournisseurs et lui proposons un prix ferme.
 */
export type StatutSourcing =
  | 'nouvelle'
  | 'transmise'
  | 'cotee'
  | 'devis_envoye'
  | 'acceptee'
  | 'refusee'
  | 'abandonnee';

export const STATUT_SOURCING_LABELS: Record<StatutSourcing, string> = {
  nouvelle: 'Reçue',
  transmise: 'Recherche en cours',
  cotee: 'Chiffrage en cours',
  devis_envoye: 'Prix proposé',
  acceptee: 'Acceptée',
  refusee: 'Introuvable',
  abandonnee: 'Abandonnée',
};

/** Ce que le client lit sous le statut, pour savoir où en est sa demande. */
export const STATUT_SOURCING_MESSAGES: Record<StatutSourcing, string> = {
  nouvelle: "Votre demande nous est bien parvenue. Nous lançons la recherche.",
  transmise: 'Nous interrogeons nos fournisseurs pour trouver cet article.',
  cotee: 'Nous avons des pistes et finalisons le chiffrage.',
  devis_envoye:
    "Voici notre prix, valable pour la quantité demandée. À vous de décider — rien n'est engagé tant que vous n'acceptez pas.",
  acceptee: 'Merci ! Nous vous recontactons pour finaliser la commande.',
  refusee: "Nous n'avons pas trouvé cet article à des conditions acceptables. Le motif est indiqué ci-dessous.",
  abandonnee: 'Vous avez abandonné cette demande.',
};

export interface DemandeSourcing {
  id: string;
  reference_publique: string;
  user_id: string;
  designation: string;
  lien_reference: string | null;
  photos: string[];
  quantite_souhaitee: number;
  prix_cible_fcfa: number | null;
  precisions: string | null;
  statut: StatutSourcing;
  reference_sourcing_fournisseur: string | null;
  prix_source_usd: number | null;
  delai_source_jours: number | null;
  commentaire_admin: string | null;
  prix_propose_fcfa: number | null;
  devis_envoye_le: string | null;
  created_at: string;
  updated_at: string;
}

/** Un candidat trouvé chez le fournisseur, déjà chiffré au coût réel. */
export interface CandidatSourcing {
  reference_externe: string;
  nom: string;
  photo: string | null;
  prix_source_usd: number;
  stock_disponible: number | null;
  quantite_chiffree: number;
  prix_unitaire_fcfa: number;
  total_fcfa: number;
  cout_fret_unitaire_fcfa: number;
  cout_assurance_unitaire_fcfa: number;
  cout_revient_unitaire_fcfa: number;
  fret_source: 'cj_reel' | 'forfait';
  fret_transporteur: string | null;
  fret_delai: string | null;
  quantite_minimum_conseillee: number;
  dans_le_budget: boolean | null;
}

/**
 * Marketplace : une entreprise ivoirienne vend sur MayLary Group. L'inscription et la
 * publication sont gratuites ; MayLary Group ne facture que son service, prélevé sur
 * chaque vente conclue.
 */
/**
 * Rôle interne MayLary Group. « admin » était tout ou rien : confier les commandes à
 * un associé lui donnait aussi la main sur les marges et les versements.
 */
export type RoleEquipe = 'proprietaire' | 'operations' | 'catalogue';

export const ROLE_EQUIPE_LABELS: Record<RoleEquipe, string> = {
  proprietaire: 'Propriétaire',
  operations: 'Opérations',
  catalogue: 'Catalogue',
};

export const ROLE_EQUIPE_DESCRIPTIONS: Record<RoleEquipe, string> = {
  proprietaire:
    'Accès complet, y compris les marges, les taux de commission et les versements aux vendeurs.',
  operations:
    'Commandes, sourcing, vendeurs, demandes d’import et d’export. Ne modifie ni les prix de revient ni les versements.',
  catalogue:
    'Import fournisseur et gestion des produits. N’accède ni aux commandes ni à l’argent.',
};

/** Écrans réservés à certains rôles. Le propriétaire atteint tout. */
export const ROLES_PAR_ECRAN: Record<string, RoleEquipe[]> = {
  '/admin': ['proprietaire', 'operations', 'catalogue'],
  '/admin/commandes': ['proprietaire', 'operations'],
  '/admin/sourcing': ['proprietaire', 'operations'],
  '/admin/vendeurs': ['proprietaire', 'operations'],
  '/admin/import': ['proprietaire', 'operations'],
  '/admin/export': ['proprietaire', 'operations'],
  '/admin/devis': ['proprietaire', 'operations'],
  '/admin/cj-dropshipping': ['proprietaire', 'catalogue'],
  '/admin/prospection': ['proprietaire', 'catalogue'],
  '/admin/qualite-fournisseurs': ['proprietaire', 'operations', 'catalogue'],
  // Les comptes de l'entreprise : le propriétaire seul.
  '/admin/comptabilite': ['proprietaire'],
  '/admin/equipe': ['proprietaire'],
  '/admin/parametres': ['proprietaire'],
};

export type StatutVendeur = 'en_attente' | 'valide' | 'suspendu' | 'refuse';

export const STATUT_VENDEUR_LABELS: Record<StatutVendeur, string> = {
  en_attente: 'Dossier en cours d\u2019examen',
  valide: 'Boutique active',
  suspendu: 'Boutique suspendue',
  refuse: 'Dossier refus\u00e9',
};

/** Ce que le vendeur lit sous son statut : ce qui se passe, et ce qu'il peut faire. */
export const STATUT_VENDEUR_MESSAGES: Record<StatutVendeur, string> = {
  en_attente:
    'Nous v\u00e9rifions votre dossier. Vous pourrez publier votre catalogue d\u00e8s la validation \u2014 comptez un jour ouvr\u00e9.',
  valide:
    'Votre boutique est en ligne. Publiez vos articles : ils apparaissent imm\u00e9diatement dans la boutique MayLary Group.',
  suspendu:
    'Votre catalogue est retir\u00e9 de la vitrine. Le motif est indiqu\u00e9 ci-dessous ; contactez-nous pour r\u00e9tablir la situation.',
  refuse: 'Nous n\u2019avons pas pu retenir votre dossier. Le motif est indiqu\u00e9 ci-dessous.',
};

export type ModeReversement = 'mobile_money' | 'virement';

export const MODE_REVERSEMENT_LABELS: Record<ModeReversement, string> = {
  mobile_money: 'Mobile Money',
  virement: 'Virement bancaire',
};

export interface Vendeur {
  id: string;
  user_id: string;
  reference_publique: string;
  nom_entreprise: string;
  secteur_id: string | null;
  description: string | null;
  logo_url: string | null;
  ville: string | null;
  adresse: string | null;
  telephone: string;
  email_contact: string | null;
  registre_commerce: string | null;
  numero_contribuable: string | null;
  mode_reversement: ModeReversement;
  compte_reversement: string | null;
  titulaire_compte: string | null;
  statut: StatutVendeur;
  motif_statut: string | null;
  /** Null : le vendeur suit le taux g\u00e9n\u00e9ral de la place. */
  taux_commission: number | null;
  valide_le: string | null;
  created_at: string;
  updated_at: string;
}

export type StatutReversement = 'a_payer' | 'paye' | 'annule';

export const STATUT_REVERSEMENT_LABELS: Record<StatutReversement, string> = {
  a_payer: '\u00c0 verser',
  paye: 'Vers\u00e9',
  annule: 'Annul\u00e9',
};

export interface Reversement {
  id: string;
  reference_publique: string | null;
  vendeur_id: string;
  montant_fcfa: number;
  periode_debut: string | null;
  periode_fin: string | null;
  mode_reglement: string | null;
  reference_reglement: string | null;
  statut: StatutReversement;
  commentaire: string | null;
  paye_le: string | null;
  created_at: string;
}

export interface ParametresMarketplace {
  id: number;
  taux_commission_defaut: number;
  delai_reversement_jours: number;
  commission_minimum_fcfa: number;
  updated_at: string;
}

/** Une vente r\u00e9alis\u00e9e par un vendeur, telle qu'il la voit. */
export interface VenteVendeur {
  id: string;
  commande_id: string;
  nom_produit: string;
  quantite: number;
  sous_total: number;
  commission_fcfa: number | null;
  net_vendeur_fcfa: number | null;
  taux_commission_applique: number | null;
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
 * Fourchette de droits et taxes, avant que la position tarifaire soit connue.
 *
 * Ce qui existait ici était un forfait : « douane et transit ≈ 25 % de la
 * valeur ». Il était faux dans les deux sens — surestimé sur une marchandise à
 * 5 % de droit, sous-estimé sur du 35 %, et le client découvrait l'écart au
 * moment de payer. Le remplacer par un autre forfait n'aurait rien réglé.
 *
 * La sortie n'est donc plus un nombre mais un encadrement, et il est exact :
 * le TEC UEMOA ne connaît que cinq taux de droit — 0, 5, 10, 20 et 35 %. Sans
 * position tarifaire, on ne sait pas lequel s'applique, mais on sait avec
 * certitude que le résultat tombe entre le calcul à 0 % et le calcul à 35 %.
 * Les deux bornes sortent de la formule officielle, la même que celle du
 * moteur de liquidation :
 *
 *   DD = CAF × taux · RST 1 % · PCS 0,8 % · PUA 0,2 % · PCC 0,5 %
 *   TVA = (CAF + DD + RST) × 18 %      ← jamais sur PCS/PUA/PCC
 *   RPI = FOB × 0,75 %, plancher 100 000 · TS = 20 000 par déclaration
 *
 * Le fret et le transit local n'y figurent pas : ils dépendent d'une route et
 * d'un barème, et aucun des deux ne se devine. L'écran les annonce « à coter »
 * plutôt que de les inventer.
 */
export const TAUX_DD_TEC = [0, 0.05, 0.1, 0.2, 0.35] as const;

export interface FourchetteDroits {
  /** Valeur en douane retenue : marchandise + fret connu + assurance. */
  caf_fcfa: number;
  /** Droits et taxes si la marchandise relève de la catégorie 0 %. */
  minimum_fcfa: number;
  /** Droits et taxes si elle relève de la catégorie 35 %. */
  maximum_fcfa: number;
  /** Vrai quand le fret est connu ; sinon les bornes portent sur la seule marchandise. */
  fret_connu: boolean;
}

export function droitsEtTaxesFcfa(cafFcfa: number, fobFcfa: number, tauxDd: number): number {
  const dd = Math.round(cafFcfa * tauxDd);
  const rst = Math.round(cafFcfa * 0.01);
  const pcs = Math.round(cafFcfa * 0.008);
  const pua = Math.round(cafFcfa * 0.002);
  const pcc = Math.round(cafFcfa * 0.005);
  const tva = Math.round((cafFcfa + dd + rst) * 0.18);
  const rpi = Math.max(Math.round(fobFcfa * 0.0075), 100_000);
  const ts = 20_000;
  return dd + rst + pcs + pua + pcc + tva + rpi + ts;
}

export function encadrerDroitsImport(params: {
  valeurMarchandiseFcfa: number;
  fretFcfa?: number | null;
  assuranceFcfa?: number | null;
}): FourchetteDroits {
  const fob = params.valeurMarchandiseFcfa;
  const fret = params.fretFcfa ?? 0;
  const assurance = params.assuranceFcfa ?? 0;
  const caf = fob + fret + assurance;
  return {
    caf_fcfa: caf,
    minimum_fcfa: droitsEtTaxesFcfa(caf, fob, TAUX_DD_TEC[0]),
    maximum_fcfa: droitsEtTaxesFcfa(caf, fob, TAUX_DD_TEC[TAUX_DD_TEC.length - 1]),
    fret_connu: (params.fretFcfa ?? 0) > 0,
  };
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

/**
 * À l'export, il n'y a rien à encadrer : le timbre statistique de 20 000 XOF
 * est dû une fois par déclaration, quelle que soit la marchandise, et aucune
 * autre imposition douanière ne s'applique à une marchandise qui sort. Le
 * chiffre est donc exact, pas estimé.
 */
export const DROITS_EXPORT_FCFA = 20_000;

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
