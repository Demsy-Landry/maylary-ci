/**
 * Le simulateur de déclaration : ses données, séparées de son écran.
 *
 * Cahier du fondateur, transitaire de métier : quatre blocs successifs —
 * en-tête, valeurs globales, lignes tarifaires, récapitulatif — puis un
 * document imprimable.
 *
 * CE QUI EST ICI ET CE QUI N'Y EST PAS
 *
 * Ici : la forme de la saisie, les unités, les modes de transport, ce qui est
 * obligatoire. C'est de la connaissance métier, elle se corrige sans toucher à
 * l'écran.
 *
 * PAS ici : le calcul. Les droits et taxes viennent de
 * `app_e08c374bc4_liquider_declaration`, en base, et rien de ce fichier ne les
 * touche. Le fondateur a été explicite là-dessus — « ne touche à rien sur les
 * calculs » — et la raison est bonne : un moteur de liquidation dupliqué côté
 * navigateur finit toujours par diverger de celui qui fait foi, et c'est le
 * client qui découvre l'écart sur sa facture.
 */

/** Unités de la colonne « US » du Tarif Extérieur Commun. */
export const UNITES = [
  { code: 'U', libelle: 'Unité' },
  { code: 'KG', libelle: 'Kilogramme' },
  { code: 'L', libelle: 'Litre' },
  { code: 'M', libelle: 'Mètre' },
  { code: 'M2', libelle: 'Mètre carré' },
  { code: 'M3', libelle: 'Mètre cube' },
  { code: 'T', libelle: 'Tonne' },
  { code: 'BTE', libelle: 'Boîte' },
  { code: 'SAC', libelle: 'Sac' },
  { code: 'CTN', libelle: 'Carton' },
] as const;

/**
 * Les modes de transport, avec leur code du Document Administratif Unique.
 *
 * Le fondateur demande une icône par mode « pour une reconnaissance rapide ».
 * C'est juste : on remplit ce champ vingt fois par jour, et l'œil va plus vite
 * que la lecture.
 */
export const MODES_TRANSPORT = [
  { code: '1', libelle: 'Maritime', icone: 'ship' },
  { code: '4', libelle: 'Aérien', icone: 'plane' },
  { code: '3', libelle: 'Routier', icone: 'truck' },
  { code: '2', libelle: 'Ferroviaire', icone: 'train' },
] as const;

export interface EnTeteSimulateur {
  reference: string;
  regime: string;
  bureau: string;
  date: string;
  importateur: string;
  fournisseur: string;
  pays_origine: string;
  numero_facture: string;
  numero_connaissement: string;
  mode_transport: string;
  rccm_cc: string;
}

export interface ValeursGlobales {
  devise: string;
  taux_change: string;
  fret: string;
  assurance: string;
  poids_brut_total: string;
  poids_net_total: string;
}

export interface LigneSimulateur {
  cle: number;
  numero: string;
  designation: string;
  code_hs: string;
  /** Renseignés par la classification assistée, jamais saisis à la main. */
  designation_tec: string | null;
  taux_dd: number | null;
  verifie: boolean;
  fob: string;
  poids_brut: string;
  poids_net: string;
  quantite: string;
  unite: string;
}

export const enTeteVide = (): EnTeteSimulateur => ({
  reference: '',
  regime: '4000',
  bureau: '',
  // Pré-remplie, modifiable : on déclare presque toujours le jour même.
  date: new Date().toISOString().slice(0, 10),
  importateur: '',
  fournisseur: '',
  pays_origine: '',
  numero_facture: '',
  numero_connaissement: '',
  mode_transport: '1',
  rccm_cc: '',
});

export const valeursVides = (): ValeursGlobales => ({
  devise: 'XOF',
  taux_change: '1',
  fret: '',
  assurance: '',
  poids_brut_total: '',
  poids_net_total: '',
});

export const ligneVide = (numero: string, cle: number): LigneSimulateur => ({
  cle,
  numero,
  designation: '',
  code_hs: '',
  designation_tec: null,
  taux_dd: null,
  verifie: false,
  fob: '',
  poids_brut: '',
  poids_net: '',
  quantite: '',
  unite: 'U',
});

/**
 * Le sous-numéro d'une ligne éclatée : 1 devient 1.1, puis 1.2.
 *
 * L'éclatement sert quand un même colis porte deux positions tarifaires — cas
 * courant d'un lot mélangé. Les sous-lignes gardent le rang de leur parente
 * pour que la déclaration se relise dans l'ordre.
 */
export const prochainSousNumero = (lignes: LigneSimulateur[], parent: string): string => {
  const racine = parent.split('.')[0];
  const rang = lignes.filter((l) => l.numero.startsWith(`${racine}.`)).length + 1;
  return `${racine}.${rang}`;
};

/** Le taux de conversion vers le franc CFA, quand il est de droit. */
export const PARITES_FIXES: Record<string, number> = {
  XOF: 1,
  // Ancrage légal, jamais une cotation du jour.
  EUR: 655.957,
  XAF: 1,
};

/**
 * Ce qui manque avant de pouvoir produire le document.
 *
 * On ne bloque pas la SAISIE là-dessus — personne ne remplit une déclaration
 * dans l'ordre — mais on bloque la GÉNÉRATION : un document remis à un client
 * avec le bureau de douane vide n'est pas un document.
 */
export function manquesAvantDocument(
  entete: EnTeteSimulateur,
  valeurs: ValeursGlobales,
  lignes: LigneSimulateur[],
): string[] {
  const manques: string[] = [];
  if (!entete.reference.trim()) manques.push('la référence de la déclaration');
  if (!entete.bureau.trim()) manques.push('le bureau de douane');
  if (!entete.importateur.trim()) manques.push('l’importateur');
  if (!entete.pays_origine.trim()) manques.push('le pays d’origine');
  if (!valeurs.devise) manques.push('la devise de la facture');
  if (!Number(valeurs.taux_change)) manques.push('le taux de change vers le franc CFA');
  const utiles = lignes.filter((l) => Number(l.fob) > 0);
  if (utiles.length === 0) manques.push('au moins une ligne avec une valeur FOB');
  if (utiles.some((l) => !l.code_hs.trim())) manques.push('le code HS de chaque ligne');
  return manques;
}
