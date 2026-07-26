/**
 * Scène animée du hero de la page d'accueil — motion design 100% généré en
 * code (aucune photo/vidéo). Construite en couches : ciel, skyline, éléments
 * de commerce flottants — assemblées dans Index.tsx, derrière le texte.
 */

const BUILDINGS: Array<{ x: number; w: number; h: number; rx?: number }> = [
  { x: 0, w: 48, h: 60, rx: 4 },
  { x: 52, w: 34, h: 92, rx: 6 },
  { x: 90, w: 56, h: 46, rx: 4 },
  { x: 150, w: 40, h: 110, rx: 6 },
  { x: 194, w: 30, h: 70, rx: 4 },
  { x: 228, w: 52, h: 130, rx: 6 },
  { x: 284, w: 36, h: 84, rx: 4 },
  { x: 324, w: 44, h: 58, rx: 4 },
  { x: 372, w: 32, h: 104, rx: 6 },
  { x: 408, w: 48, h: 72, rx: 4 },
  { x: 640, w: 38, h: 96, rx: 6 },
  { x: 682, w: 50, h: 64, rx: 4 },
  { x: 736, w: 30, h: 118, rx: 6 },
  { x: 856, w: 46, h: 80, rx: 4 },
  { x: 906, w: 34, h: 108, rx: 6 },
  { x: 944, w: 56, h: 54, rx: 4 },
  { x: 1004, w: 38, h: 92, rx: 6 },
  { x: 1046, w: 44, h: 66, rx: 4 },
  { x: 1094, w: 32, h: 100, rx: 6 },
  { x: 1130, w: 50, h: 50, rx: 4 },
];

const SKYLINE_HEIGHT = 220;

export default function HeroScene() {
  return (
    <div
      className="hero-scene pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Couche 2 — ciel et lumière : dégradé qui dérive très lentement, façon aube sur la lagune */}
      <div className="animate-sky-drift absolute inset-0 bg-[length:200%_200%] bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
      <div className="animate-glow-drift-a absolute -top-8 -left-16 h-72 w-72 rounded-full bg-primary/20 blur-3xl sm:h-96 sm:w-96" />
      <div className="animate-glow-drift-b absolute top-1/4 right-0 h-64 w-64 rounded-full bg-accent/15 blur-3xl sm:h-80 sm:w-80" />
      <div className="animate-glow-drift-c absolute top-1/3 left-1/3 h-56 w-56 rounded-full bg-primary/10 blur-3xl sm:h-72 sm:w-72" />

      {/* Couche 1 — skyline stylisée d'Abidjan, dérive lente en fond (parallax) */}
      <div className="hero-skyline absolute inset-x-0 bottom-0 h-32 sm:h-44 md:h-52">
        <svg
          viewBox={`0 0 1200 ${SKYLINE_HEIGHT}`}
          preserveAspectRatio="xMidYMax slice"
          className="animate-skyline-parallax h-full w-[130%] -translate-x-[8%]"
        >
          <defs>
            <linearGradient id="landmark-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--color-primary)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--color-accent)' }} />
            </linearGradient>
          </defs>

          {/* Buildings ordinaires — silhouette discrète, ton encre */}
          {BUILDINGS.map((b) => (
            <rect
              key={`${b.x}-${b.w}`}
              x={b.x}
              y={SKYLINE_HEIGHT - b.h}
              width={b.w}
              height={b.h}
              rx={b.rx}
              className="fill-foreground/[0.07]"
            />
          ))}

          {/* Repère 1 — clin d'œil à la Pyramide du Plateau, en dégradé de marque */}
          <polygon
            points="454,220 606,220 566,90 494,90"
            fill="url(#landmark-gradient)"
            opacity="0.9"
          />

          {/* Repère 2 — tour élancée, ton émeraude */}
          <rect x="770" y="30" width="26" height="190" rx="8" className="fill-accent/70" />
          <rect x="779" y="10" width="8" height="24" rx="3" className="fill-accent/70" />
        </svg>
      </div>
    </div>
  );
}
