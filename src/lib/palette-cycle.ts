/**
 * Les couleurs de la boutique, à toute heure du jour.
 *
 * POURQUOI CE CALCUL EST EN JAVASCRIPT ET NON EN CSS
 *
 * La première version interpolait les couleurs directement en CSS, avec des
 * `calc()` pilotés par une variable. Deux choses l'ont condamnée, et les deux
 * ont été mesurées, pas supposées :
 *
 * 1. Le minificateur de la chaîne de construction remplaçait la variable par sa
 *    valeur initiale et figeait tout le calcul à zéro. Le CSS livré contenait
 *    « * 0 » en dur : le cycle était mort avant d'arriver au navigateur.
 *
 * 2. Plus grave : un fondu continu entre un thème clair et son inverse fait se
 *    CROISER le fond et le texte. Relevé à mi-chemin — fond `oklch(0.5885 …)`,
 *    texte `oklch(0.575 …)`. Deux clartés identiques : la page devient
 *    illisible. Aucun réglage n'y échappe, c'est la conséquence de faire monter
 *    une courbe pendant qu'on en descend une autre.
 *
 * D'OÙ LES DEUX RÉGIMES
 *
 *   nuit 0 → 0,5   LE SOIR TOMBE. Le fond se réchauffe et s'assombrit un peu,
 *                  le texte reste sombre. Toujours très lisible.
 *   nuit = 0,5     LE COUCHER. Un seul basculement franc, assumé, à l'endroit
 *                  exact où la métaphore l'attend.
 *   nuit 0,5 → 1   LA NUIT S'INSTALLE. Le fond continue de descendre, le texte
 *                  est clair. Toujours très lisible.
 *
 * On garde ainsi la dérive demandée — la boutique change au fil des heures —
 * sans jamais traverser la zone où plus rien ne se lit.
 */

/** Une couleur, décomposée pour pouvoir être interpolée composante par composante. */
interface Teinte {
  /** Clarté perçue, de 0 (noir) à 1 (blanc). */
  l: number;
  /** Saturation. */
  c: number;
  /** Angle de teinte, en degrés. */
  h: number;
  /** Opacité, 1 par défaut. */
  a?: number;
}

/** Les jetons de couleur que l'application consomme. */
type Jeton =
  | 'background' | 'foreground'
  | 'card' | 'card-foreground'
  | 'popover' | 'popover-foreground'
  | 'primary' | 'primary-foreground' | 'primary-emphasis'
  | 'secondary' | 'secondary-foreground'
  | 'muted' | 'muted-foreground'
  | 'accent' | 'accent-foreground'
  | 'destructive' | 'destructive-foreground'
  | 'border' | 'input' | 'ring';

type Palette = Record<Jeton, Teinte>;

/**
 * Plein jour. Copie exacte des valeurs de `index.css` — c'est l'apparence
 * actuelle, et elle doit être rendue au millième près à `nuit = 0`, sans quoi
 * la boutique changerait d'aspect à midi sans raison.
 */
const JOUR: Palette = {
  background: { l: 0.977, c: 0.008, h: 78 },
  foreground: { l: 0.19, c: 0.02, h: 250 },
  card: { l: 1, c: 0, h: 0 },
  'card-foreground': { l: 0.19, c: 0.02, h: 250 },
  popover: { l: 1, c: 0, h: 0 },
  'popover-foreground': { l: 0.19, c: 0.02, h: 250 },
  primary: { l: 0.78, c: 0.16, h: 75 },
  'primary-foreground': { l: 0.2, c: 0.02, h: 60 },
  'primary-emphasis': { l: 0.52, c: 0.17, h: 50 },
  secondary: { l: 0.96, c: 0.003, h: 250 },
  'secondary-foreground': { l: 0.25, c: 0.01, h: 250 },
  muted: { l: 0.95, c: 0.003, h: 250 },
  'muted-foreground': { l: 0.48, c: 0.01, h: 250 },
  accent: { l: 0.5, c: 0.09, h: 220 },
  'accent-foreground': { l: 1, c: 0, h: 0 },
  destructive: { l: 0.577, c: 0.245, h: 27.325 },
  'destructive-foreground': { l: 0.99, c: 0.01, h: 75 },
  border: { l: 0.87, c: 0.004, h: 250 },
  input: { l: 0.87, c: 0.004, h: 250 },
  ring: { l: 0.78, c: 0.16, h: 75, a: 0.5 },
};

/**
 * La fin de l'après-midi, juste avant le coucher.
 *
 * Le fond a perdu un peu de clarté et gagné en chaleur — la lumière rase de
 * dix-sept heures. Le texte, lui, n'a pas bougé : c'est ce qui garantit qu'on
 * lit aussi bien qu'à midi. Les surfaces suivent le fond, les accents restent
 * eux-mêmes.
 */
const CREPUSCULE: Palette = {
  ...JOUR,
  background: { l: 0.90, c: 0.022, h: 68 },
  card: { l: 0.955, c: 0.012, h: 70 },
  popover: { l: 0.955, c: 0.012, h: 70 },
  secondary: { l: 0.90, c: 0.010, h: 200 },
  muted: { l: 0.89, c: 0.010, h: 200 },
  'muted-foreground': { l: 0.44, c: 0.012, h: 250 },
  border: { l: 0.80, c: 0.008, h: 230 },
  input: { l: 0.80, c: 0.008, h: 230 },
};

/**
 * Le début de la nuit, juste après le coucher.
 *
 * C'est ici que le texte bascule au clair. Le fond est déjà franchement sombre
 * — un fond intermédiaire avec un texte clair serait le défaut qu'on cherche à
 * éviter. L'écart de clarté entre le fond et le texte reste large des deux
 * côtés du basculement.
 */
const NUIT_DEBUT: Palette = {
  background: { l: 0.32, c: 0.030, h: 45 },
  foreground: { l: 0.94, c: 0.018, h: 75 },
  card: { l: 0.37, c: 0.034, h: 42 },
  'card-foreground': { l: 0.94, c: 0.018, h: 75 },
  popover: { l: 0.37, c: 0.034, h: 42 },
  'popover-foreground': { l: 0.94, c: 0.018, h: 75 },
  primary: { l: 0.76, c: 0.16, h: 75 },
  'primary-foreground': { l: 0.2, c: 0.02, h: 60 },
  'primary-emphasis': { l: 0.78, c: 0.14, h: 65 },
  secondary: { l: 0.40, c: 0.018, h: 250 },
  'secondary-foreground': { l: 0.94, c: 0.018, h: 75 },
  muted: { l: 0.40, c: 0.018, h: 250 },
  'muted-foreground': { l: 0.70, c: 0.010, h: 250 },
  accent: { l: 0.58, c: 0.09, h: 220 },
  'accent-foreground': { l: 0.98, c: 0.01, h: 75 },
  destructive: { l: 0.66, c: 0.20, h: 25 },
  'destructive-foreground': { l: 0.98, c: 0.01, h: 75 },
  border: { l: 1, c: 0, h: 0, a: 0.16 },
  input: { l: 1, c: 0, h: 0, a: 0.20 },
  ring: { l: 0.72, c: 0.17, h: 55, a: 0.5 },
};

/**
 * Le cœur de la nuit. Les valeurs sombres d'origine de `index.css`.
 */
const NUIT: Palette = {
  background: { l: 0.2, c: 0.035, h: 40 },
  foreground: { l: 0.96, c: 0.02, h: 75 },
  card: { l: 0.25, c: 0.04, h: 40 },
  'card-foreground': { l: 0.96, c: 0.02, h: 75 },
  popover: { l: 0.25, c: 0.04, h: 40 },
  'popover-foreground': { l: 0.96, c: 0.02, h: 75 },
  primary: { l: 0.72, c: 0.16, h: 75 },
  'primary-foreground': { l: 0.2, c: 0.02, h: 60 },
  'primary-emphasis': { l: 0.82, c: 0.13, h: 75 },
  secondary: { l: 0.3, c: 0.02, h: 250 },
  'secondary-foreground': { l: 0.96, c: 0.02, h: 75 },
  muted: { l: 0.3, c: 0.02, h: 250 },
  'muted-foreground': { l: 0.72, c: 0.01, h: 250 },
  accent: { l: 0.6, c: 0.09, h: 220 },
  'accent-foreground': { l: 0.98, c: 0.01, h: 75 },
  destructive: { l: 0.704, c: 0.191, h: 22.216 },
  'destructive-foreground': { l: 0.98, c: 0.01, h: 75 },
  border: { l: 1, c: 0, h: 0, a: 0.12 },
  input: { l: 1, c: 0, h: 0, a: 0.15 },
  ring: { l: 0.68, c: 0.18, h: 45, a: 0.5 },
};

const JETONS = Object.keys(JOUR) as Jeton[];

function entre(depart: Teinte, arrivee: Teinte, u: number): Teinte {
  return {
    l: depart.l + (arrivee.l - depart.l) * u,
    c: depart.c + (arrivee.c - depart.c) * u,
    h: depart.h + (arrivee.h - depart.h) * u,
    a: (depart.a ?? 1) + ((arrivee.a ?? 1) - (depart.a ?? 1)) * u,
  };
}

function ecrire(t: Teinte): string {
  const l = t.l.toFixed(4);
  const c = t.c.toFixed(4);
  const h = t.h.toFixed(2);
  const a = t.a ?? 1;
  return a >= 1 ? `oklch(${l} ${c} ${h})` : `oklch(${l} ${c} ${h} / ${a.toFixed(3)})`;
}

/** Le moment du basculement : le coucher proprement dit. */
export const COUCHER = 0.5;

/**
 * Les couleurs à appliquer pour une part de nuit donnée.
 *
 * @param nuit 0 = plein jour, 1 = pleine nuit.
 * @returns les valeurs CSS, prêtes à être posées sur la racine du document.
 */
export function paletteALHeure(nuit: number): Record<string, string> {
  const n = Math.min(1, Math.max(0, nuit));

  const [depart, arrivee, u] =
    n < COUCHER
      ? ([JOUR, CREPUSCULE, n / COUCHER] as const)
      : ([NUIT_DEBUT, NUIT, (n - COUCHER) / (1 - COUCHER)] as const);

  const sortie: Record<string, string> = {};
  for (const jeton of JETONS) {
    sortie[`--${jeton}`] = ecrire(entre(depart[jeton], arrivee[jeton], u));
  }
  return sortie;
}

/**
 * De combien assombrir les photographies.
 *
 * Une image éclairée pour le plein jour devient une lampe sur un fond sombre :
 * l'œil ne voit plus qu'elle. On l'atténue seulement après le coucher, et
 * modérément — assez pour qu'elle s'accorde, pas assez pour cacher la
 * marchandise.
 */
export function voileSurLesImages(nuit: number): string {
  const apres = Math.max(0, (Math.min(1, nuit) - COUCHER) / (1 - COUCHER));
  return `brightness(${(1 - 0.18 * apres).toFixed(3)}) saturate(${(1 - 0.07 * apres).toFixed(3)})`;
}
