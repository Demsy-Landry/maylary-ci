/**
 * Les six Règles Générales Interprétatives du Système harmonisé.
 *
 * Elles ne sont pas de la décoration pédagogique : ce sont ELLES qui décident
 * du classement, et un déclarant qui reçoit un code sans savoir par quelle
 * règle il a été obtenu ne peut ni le défendre devant un vérificateur, ni voir
 * qu'il est faux.
 *
 * Le texte ci-dessous est une reformulation en français courant, pas une
 * citation officielle : le libellé exact figure dans le Système harmonisé de
 * l'OMD et dans le Tarif Extérieur Commun de l'UEMOA. La distinction est
 * marquée à l'écran — présenter une paraphrase comme un texte réglementaire
 * serait la faire opposer à un vérificateur qui, lui, a le vrai texte.
 *
 * L'ordre compte, et c'est le point que la plupart des tableaux de ce genre
 * ratent : les RGI s'appliquent SUCCESSIVEMENT. On ne passe à la RGI 3 que si
 * la RGI 2 n'a pas tranché. Un classement qui invoque la RGI 3 alors que la
 * RGI 1 suffisait est un classement fragile.
 */

export interface RegleRGI {
  numero: string;
  titre: string;
  enonce: string;
  /** Ce qu'elle change concrètement pour celui qui classe. */
  usage: string;
  exemple: string;
}

export const REGLES_RGI: RegleRGI[] = [
  {
    numero: 'RGI 1',
    titre: 'Le texte des positions et les notes priment',
    enonce:
      'Le classement est déterminé par le libellé des positions et par les notes de sections et de chapitres. Les titres de sections et de chapitres n’ont qu’une valeur indicative.',
    usage:
      'C’est la règle qui tranche la plupart des cas. Si le libellé d’une position et les notes suffisent à désigner la marchandise, on s’arrête là — les règles suivantes ne servent pas.',
    exemple:
      'Un titre de chapitre « Machines » ne suffit jamais à classer : c’est le libellé de la position et la note du chapitre qui décident.',
  },
  {
    numero: 'RGI 2',
    titre: 'Articles incomplets, et mélanges',
    enonce:
      'a) Une marchandise incomplète ou non montée se classe comme l’article complet, dès lors qu’elle en présente les caractéristiques essentielles. b) Une matière mentionnée dans une position s’entend de cette matière mélangée ou associée à d’autres.',
    usage:
      'Elle évite qu’un article démonté pour le transport change de classement. Elle ouvre aussi la question des mélanges — que la RGI 3 tranchera.',
    exemple:
      'Un vélo livré démonté en carton reste classé comme un vélo, pas comme un assemblage de tubes et de roues.',
  },
  {
    numero: 'RGI 3',
    titre: 'Quand plusieurs positions sont possibles',
    enonce:
      'a) La position la plus spécifique l’emporte sur la plus générale. b) À défaut, on retient la matière ou l’article qui confère à l’ensemble son caractère essentiel. c) À défaut encore, on retient la position placée la dernière dans l’ordre de numérotation.',
    usage:
      'Les trois branches s’appliquent dans cet ordre, jamais au choix. C’est le point où se perdent la plupart des classements contestés.',
    exemple:
      'Un coffret rasoir + mousse + trousse : c’est le rasoir qui donne son caractère essentiel à l’ensemble (RGI 3 b).',
  },
  {
    numero: 'RGI 4',
    titre: 'Le plus analogue',
    enonce:
      'Une marchandise qu’aucune position ne désigne se classe dans la position afférente aux articles les plus analogues.',
    usage:
      'Recours rare, et volontairement placé après les autres. L’invoquer trop vite signale presque toujours qu’on a mal lu les notes.',
    exemple:
      'Un produit véritablement nouveau, sans position dédiée, rejoint la famille dont il est le plus proche par nature et par usage.',
  },
  {
    numero: 'RGI 5',
    titre: 'Étuis, emballages et contenants',
    enonce:
      'a) Les étuis et contenants spécialement conçus pour un article et vendus avec lui suivent son classement. b) Les emballages suivent la marchandise, sauf s’ils sont clairement réutilisables.',
    usage:
      'Elle évite de déclarer séparément la housse d’un instrument ou le carton d’un téléviseur. Attention aux contenants réutilisables : eux se déclarent à part.',
    exemple:
      'L’étui rigide d’une guitare vendu avec elle se classe avec la guitare ; une bouteille de gaz consignée, non.',
  },
  {
    numero: 'RGI 6',
    titre: 'Le même raisonnement au niveau des sous-positions',
    enonce:
      'Le classement dans les sous-positions d’une même position se fait selon leurs propres libellés et notes, les règles précédentes s’appliquant par analogie — et seules des sous-positions de même niveau sont comparables.',
    usage:
      'C’est elle qui rend le code complet. On ne compare jamais une sous-position à deux tirets avec une sous-position à un tiret.',
    exemple:
      'Une fois la position 8703 retenue, on redescend entre ses sous-positions selon la cylindrée et le carburant, à niveau égal.',
  },
];

/**
 * Les six niveaux de la descente, du plus large au code déclarable.
 *
 * Les deux derniers niveaux sont propres à la sous-région : le Système
 * harmonisé de l'OMD s'arrête à six chiffres, la nomenclature UEMOA en ajoute
 * quatre. Un code à six chiffres n'est donc PAS déclarable en Côte d'Ivoire, et
 * c'est une confusion courante qu'il vaut mieux nommer à l'écran.
 */
export const NIVEAUX_DESCENTE = [
  { cle: 'section', libelle: 'Section', aide: 'Le grand domaine de marchandises (21 sections).' },
  { cle: 'chapitre', libelle: 'Chapitre', aide: 'Deux chiffres. 97 chapitres au Système harmonisé.' },
  { cle: 'position_sh', libelle: 'Position', aide: 'Quatre chiffres. Le libellé qui désigne la marchandise.' },
  {
    cle: 'sous_position',
    libelle: 'Sous-position',
    aide: 'Six chiffres. Fin du Système harmonisé mondial de l’OMD.',
  },
] as const;
