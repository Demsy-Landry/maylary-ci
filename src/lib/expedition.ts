/**
 * Ouvrir une expédition : la marque, la porte, et le contrat de connecteur.
 *
 * CE QUE LE FONDATEUR DEMANDE
 *
 * « Si on peut avoir une API où les commandes, après devis acheté, enclenchent
 * l'expédition chez ce transporteur ou consolidateur, ça nous permettra de
 * lever le pied sur une autre charge. »
 *
 * La charge est réelle, mais elle n'est pas là où l'API la prendrait. Elle se
 * décompose en deux moitiés très inégales.
 *
 * LA PETITE MOITIÉ : LE GESTE DE RÉSERVATION
 *
 * Appeler le transporteur. Automatisable là où une API existe — chez DHL
 * Express oui, chez un consolidateur chinois non. Ce sont des PME qui
 * travaillent sur WeChat, et attendre qu'elles publient une API, c'est attendre
 * indéfiniment.
 *
 * LA GRANDE MOITIÉ : LE RAPPROCHEMENT
 *
 * Savoir quel carton appartient à quelle commande. Refaire la liste de
 * colisage. Recopier les références d'un message à un formulaire. C'est ça qui
 * coûte du temps tous les jours, et ça s'automatise SANS aucune API.
 *
 * D'où ce module : il ne suppose l'existence d'aucune API. Il produit la marque
 * qui permet le rapprochement physique, il dit quand une expédition est
 * réellement ouvrable, et il pose la forme commune que chaque connecteur
 * remplit — celui de DHL comme celui qui n'appelle personne.
 */

/** Qui réserve. Ce n'est pas forcément qui achemine. */
export type Connecteur = 'cj' | 'dhl' | 'consolidateur';

/**
 * LE SHIPPING MARK
 *
 * Dans le métier, c'est ce qu'on peint sur le carton. Le consolidateur donne
 * une adresse d'entrepôt et un code client ; tout colis qui arrive portant
 * cette marque lui est attribué sans qu'on ait à écrire à personne.
 *
 * C'est le rapprochement automatique du monde physique. Il fonctionne depuis un
 * siècle, sans réseau, chez des gens qui n'ouvriront jamais notre application —
 * et c'est précisément pour ça qu'il vaut mieux qu'une API qui n'existe pas.
 *
 * L'ORDRE DES ÉLÉMENTS N'EST PAS ESTHÉTIQUE
 *
 * Le code que le consolidateur NOUS a attribué vient en premier, parce que
 * c'est sur lui que trie son magasinier. Notre propre référence vient ensuite :
 * elle ne sert qu'à nous, une fois le carton déjà dans la bonne pile.
 *
 * Mettre notre référence devant ferait un marquage qui nous parle et qui ne
 * dit rien à celui qui le lit.
 */
export interface ContexteMarque {
  /** Le numéro de l'expédition, tel qu'il existe déjà en base. */
  numero: string;
  /** Le code que le consolidateur nous a attribué, quand il y en a un. */
  code_client?: string | null;
}

/**
 * La marque, en une chaîne.
 *
 * Elle est normalisée mais jamais réécrite : les caractères sont mis en
 * capitales et les séparations ramenées au tiret, rien de plus. Réencoder la
 * référence produirait une marque qui ne désigne plus l'expédition dont elle
 * vient — et le rapprochement se ferait sur un identifiant que la base ignore.
 */
export function marqueExpedition({ numero, code_client }: ContexteMarque): string {
  const reference = numero
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const prefixe = (code_client ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, '');

  return prefixe ? `${prefixe}/MLY-${reference}` : `MLY-${reference}`;
}

/**
 * Le bloc de marquage, tel qu'il se peint sur le carton.
 *
 * Quatre lignes, et chacune répond à une question que se pose quelqu'un qui
 * manipule le colis :
 *
 *     la marque      à quelle pile appartient ce carton ?
 *     le destinataire où va-t-il, si la pile se disperse ?
 *     le numéro      en manque-t-il un ?
 *     l'origine      mention exigée à l'importation
 *
 * `C/NO: 1 OF 3` est la forme consacrée, en anglais : c'est un magasinier
 * chinois qui la lit. La traduire en français serait la rendre inutile.
 */
export function blocMarquage(
  contexte: ContexteMarque,
  colis: { numero: number; total: number },
): string {
  return [
    marqueExpedition(contexte),
    "MAYLARY GROUP — ABIDJAN, COTE D'IVOIRE",
    `C/NO: ${colis.numero} OF ${colis.total}`,
    'MADE IN CHINA',
  ].join('\n');
}

/**
 * Ce qui manque pour ouvrir, nommé un par un.
 *
 * Même principe que partout ailleurs dans le chiffrage : un poste qu'on ne peut
 * pas traiter doit se VOIR. « Impossible d'ouvrir l'expédition » n'apprend rien
 * et ne se corrige pas ; « il manque le poids brut » se corrige en trente
 * secondes.
 */
export interface ManqueOuverture {
  champ: string;
  raison: string;
}

export interface ContexteOuverture {
  /** Vrai quand le client a payé. Aucun transporteur n'est appelé avant. */
  paye: boolean;
  connecteur: Connecteur | null;
  nombre_colis: number | null;
  poids_brut_kg: number | null;
  /** Exigé au maritime seul : l'aérien facture au poids volumétrique. */
  volume_m3: number | null;
  mode: 'aerien' | 'maritime' | 'routier' | string;
  /** L'adresse de livraison du client, sans laquelle DHL ne cote pas. */
  destinataire_complet: boolean;
}

export type VerdictOuverture =
  | { ouvrable: true }
  | { ouvrable: false; manquants: ManqueOuverture[] };

/**
 * LA PORTE DEVANT LE TRANSPORTEUR
 *
 * On n'ouvre pas une expédition avant le paiement. Ce n'est pas de la prudence
 * comptable : une réservation DHL engage un enlèvement, et un enlèvement annulé
 * se facture. Réserver sur une commande non payée, c'est payer le transport des
 * clients qui se ravisent.
 *
 * Et on n'ouvre pas sans les mesures. Aucun transporteur ne cote un colis dont
 * il ignore le poids ; demander ces chiffres au moment de la réservation, c'est
 * découvrir qu'ils manquent quand le client attend déjà.
 */
export function peutOuvrirExpedition(c: ContexteOuverture): VerdictOuverture {
  const manquants: ManqueOuverture[] = [];

  if (!c.paye) {
    manquants.push({
      champ: 'Paiement',
      raison:
        'la réservation engage un enlèvement, et un enlèvement annulé se facture',
    });
  }

  if (!c.connecteur) {
    manquants.push({
      champ: 'Transporteur',
      raison: 'aucun connecteur choisi : on ne sait pas à qui adresser la demande',
    });
  }

  if (!c.nombre_colis || c.nombre_colis < 1) {
    manquants.push({
      champ: 'Nombre de colis',
      raison: 'le marquage se numérote « 1 sur n » : sans n, il ne se compose pas',
    });
  }

  if (!c.poids_brut_kg || c.poids_brut_kg <= 0) {
    manquants.push({
      champ: 'Poids brut',
      raison: 'aucun transporteur ne cote un colis dont il ignore le poids',
    });
  }

  // Le maritime facture au maximum du volume et de la tonne. Sans volume, on ne
  // connaît pas l'unité payante — et donc pas le prix.
  if (c.mode === 'maritime' && (!c.volume_m3 || c.volume_m3 <= 0)) {
    manquants.push({
      champ: 'Volume',
      raison: "en maritime l'unité payante est le maximum du volume et de la tonne",
    });
  }

  if (!c.destinataire_complet) {
    manquants.push({
      champ: 'Adresse du destinataire',
      raison: 'une expédition sans destinataire complet est refusée à la saisie',
    });
  }

  return manquants.length === 0 ? { ouvrable: true } : { ouvrable: false, manquants };
}

/**
 * LE CONTRAT QUE CHAQUE CONNECTEUR REMPLIT
 *
 * La même forme pour celui qui appelle une API et pour celui qui n'appelle
 * personne. C'est ce qui permet d'ajouter DHL le jour où les identifiants
 * existent, sans toucher à ce qui l'entoure — exactement comme le connecteur de
 * suivi, où seule `interrogerAgregateur` connaît 17TRACK.
 *
 * `reference` est ce sur quoi le suivi démarrera : numéro d'envoi chez DHL,
 * numéro de connaissement chez un consolidateur. Le connecteur qui n'en obtient
 * pas rend `reference: null` et le dit — il ne fabrique jamais un numéro pour
 * faire bonne figure, parce qu'un numéro inventé remonterait jusqu'à la frise
 * du client.
 */
export interface ResultatOuverture {
  ouverte: boolean;
  reference: string | null;
  /** L'étiquette, en base64, quand le transporteur en rend une. */
  etiquette_base64?: string | null;
  /** Ce qu'il reste à faire à la main, nommé. Vide quand tout est automatique. */
  a_faire_main: string[];
  erreur?: string | null;
}
