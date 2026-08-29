/**
 * Le cycle du jour et de la nuit de la boutique.
 *
 * L'application ne bascule pas d'un thème clair à un thème sombre : elle
 * DÉRIVE de l'un vers l'autre au fil des heures, comme la lumière du dehors.
 * Ce fichier ne fait qu'une chose : dire, pour une heure donnée, à quel point
 * il fait nuit — un nombre entre 0 (plein jour) et 1 (nuit complète).
 *
 * Tout le reste — les couleurs, les images, les ombres — se déduit de ce seul
 * nombre dans `index.css`. C'est voulu : une seule valeur à comprendre, un
 * seul endroit à régler.
 *
 * LA JOURNÉE, HEURE PAR HEURE
 *
 *   00 h ──── 04 h ──── 06 h ──────── 12 h ──────── 18 h ──── 21 h ──── 24 h
 *    nuit      aube      PLEIN JOUR    le soir tombe   COUCHER  la nuit   nuit
 *   pleine                                                      s'installe
 *
 *   00 h → 04 h   nuit pleine
 *   04 h → 06 h   l'aube. Le LEVER — retour au clair — se fait vers 5 h,
 *                 pour que 6 h trouve la boutique exactement comme aujourd'hui
 *   06 h → 12 h   plein jour, apparence actuelle inchangée
 *   12 h → 18 h   le soir tombe : le fond se réchauffe et perd de la clarté,
 *                 le texte reste sombre. Toujours parfaitement lisible
 *   18 h          LE COUCHER. La part de nuit atteint 0,5 pile : c'est
 *                 l'instant du basculement au sombre
 *   18 h → 21 h   la nuit s'installe, le fond continue de descendre
 *   21 h → 24 h   nuit pleine
 *
 * POURQUOI CE DÉCOUPAGE
 *
 * La consigne disait « sombre au fur et à mesure JUSQU'À 18 h » et « comme
 * actuellement À 6 h ». Les deux heures sont donc des points d'arrivée, et
 * elles sont respectées au sens strict : à 18 h la boutique bascule, à 6 h elle
 * est redevenue exactement ce qu'elle est aujourd'hui.
 *
 * Le « au fur et à mesure » est tenu par les six heures de soirée qui
 * précèdent : de midi à dix-huit heures, la lumière baisse sans que rien ne
 * saute à l'œil. Ce n'est qu'à dix-huit heures que la nuit prend la main.
 *
 * Ces bornes sont ici et nulle part ailleurs : les déplacer se fait sur une
 * ligne.
 */

/** Fin de la nuit pleine : l'aube commence. */
export const HEURE_AUBE = 4;
/** Fin de l'aube : à partir de là, plein jour et apparence d'aujourd'hui. */
export const HEURE_LEVER = 6;
/** Le soir commence à tomber, insensiblement. */
export const HEURE_DEBUT_SOIREE = 12;
/** Le coucher : l'instant du basculement au sombre. */
export const HEURE_COUCHER = 18;
/** La nuit est pleine et ne bouge plus. */
export const HEURE_NUIT_PLEINE = 21;

/**
 * La part de nuit au coucher. C'est le seuil de basculement, partagé avec la
 * palette : au-dessus, le texte est clair et le fond sombre.
 */
const PART_AU_COUCHER = 0.5;

/**
 * Adoucit une progression linéaire en une courbe sans angle.
 *
 * Une interpolation droite se voit : la couleur avance d'un pas régulier puis
 * s'arrête net à la borne. Le cosinus démarre et finit en douceur, et le
 * changement devient imperceptible d'une minute à l'autre — ce qui est tout
 * l'intérêt d'un cycle qui doit se vivre sans être remarqué.
 */
function adoucir(u: number): number {
  const borne = Math.min(1, Math.max(0, u));
  return (1 - Math.cos(Math.PI * borne)) / 2;
}

/**
 * Quelle part de nuit à cette heure-là.
 *
 * @param heureDecimale heure locale en heures décimales — 18 h 30 vaut 18,5.
 * @returns 0 en plein jour, 1 en pleine nuit, et la dérive entre les deux.
 */
export function partDeNuit(heureDecimale: number): number {
  // On ramène dans [0, 24) : un appel à minuit passé peut donner 24 tout rond,
  // et une heure négative n'a pas de raison d'exister mais ne doit pas casser.
  const h = ((heureDecimale % 24) + 24) % 24;

  // La fin de la nuit : rien ne bouge encore.
  if (h < HEURE_AUBE) return 1;

  // L'aube : la nuit se retire de 1 vers 0. Le retour au clair se fait à
  // mi-parcours, vers 5 h, pour que 6 h trouve la boutique déjà entièrement
  // rendue à son apparence de jour.
  if (h < HEURE_LEVER) {
    return 1 - adoucir((h - HEURE_AUBE) / (HEURE_LEVER - HEURE_AUBE));
  }

  // Le plein jour : l'apparence actuelle, inchangée.
  if (h < HEURE_DEBUT_SOIREE) return 0;

  // Le soir tombe. On monte jusqu'à — sans l'atteindre — la part du coucher :
  // le texte reste sombre pendant toute cette phase, c'est ce qui la rend
  // parfaitement lisible.
  if (h < HEURE_COUCHER) {
    const u = (h - HEURE_DEBUT_SOIREE) / (HEURE_COUCHER - HEURE_DEBUT_SOIREE);
    return adoucir(u) * PART_AU_COUCHER;
  }

  // La nuit s'installe, du coucher jusqu'à la nuit pleine.
  if (h < HEURE_NUIT_PLEINE) {
    const u = (h - HEURE_COUCHER) / (HEURE_NUIT_PLEINE - HEURE_COUCHER);
    return PART_AU_COUCHER + adoucir(u) * (1 - PART_AU_COUCHER);
  }

  // La nuit, pleine et entière.
  return 1;
}

/** L'heure décimale d'une date, dans le fuseau de celui qui regarde. */
export function heureDecimale(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

/**
 * Ce que le visiteur a choisi, s'il a choisi quelque chose.
 *
 * `auto` suit l'heure. Les deux autres figent l'apparence — parce qu'un client
 * qui veut lire en clair à 21 h a le droit, et qu'un cycle imposé sans échappée
 * est une contrariété, pas une attention.
 */
export type ModeAffichage = 'auto' | 'jour' | 'nuit';

export const CLE_MODE = 'maylary.affichage';

/** La part de nuit à appliquer, en tenant compte du choix du visiteur. */
export function partDeNuitSelonMode(mode: ModeAffichage, maintenant: Date): number {
  if (mode === 'jour') return 0;
  if (mode === 'nuit') return 1;
  return partDeNuit(heureDecimale(maintenant));
}

/**
 * Le nom de l'heure, pour l'expliquer au visiteur qui survole le bouton.
 *
 * Dire « Nuit » quand il fait nuit vaut mieux qu'une icône seule : le visiteur
 * comprend que l'application suit l'heure, et non qu'elle s'est déréglée.
 */
export function nomDuMoment(part: number): string {
  if (part <= 0) return 'Plein jour';
  if (part >= 1) return 'Nuit';
  return part < 0.5 ? 'Fin de journée' : 'Crépuscule';
}
