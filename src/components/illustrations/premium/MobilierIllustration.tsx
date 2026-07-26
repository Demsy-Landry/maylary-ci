/**
 * Illustration "Mobilier" — première pièce de la série premium (Stripe /
 * Notion / Linear). 100% SVG codé à la main : formes superposées, dégradés
 * internes, ombres portées, un détail narratif (la plante — suggère un
 * bureau meublé, pas juste "une chaise"), micro-interaction au survol.
 *
 * Toutes les couleurs référencent les tokens du thème (--color-primary,
 * --color-primary-emphasis, --color-accent) via color-mix(), donc
 * l'illustration reste raccordée à la charte si la palette évolue.
 */
export default function MobilierIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`group/art overflow-visible ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mob-seat" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="color-mix(in oklch, var(--color-primary) 65%, white)" />
          <stop offset="100%" stopColor="var(--color-primary-emphasis)" />
        </linearGradient>
        <linearGradient id="mob-back" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--color-primary-emphasis) 82%, black)" />
        </linearGradient>
        <linearGradient id="mob-accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="color-mix(in oklch, var(--color-accent) 60%, white)" />
          <stop offset="100%" stopColor="var(--color-accent)" />
        </linearGradient>
        <linearGradient id="mob-leg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="color-mix(in oklch, var(--color-foreground) 35%, transparent)" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--color-foreground) 55%, transparent)" />
        </linearGradient>
        <filter id="mob-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* Halo d'ambiance */}
      <circle cx="104" cy="86" r="70" fill="var(--color-accent)" opacity="0.06" />

      {/* Ombre au sol — répond au survol (se resserre quand la chaise "monte") */}
      <ellipse
        cx="100"
        cy="176"
        rx="52"
        ry="9"
        fill="var(--color-foreground)"
        opacity="0.14"
        filter="url(#mob-blur)"
        className="origin-center transition-all duration-300 ease-out group-hover/art:scale-90 group-hover/art:opacity-[0.08]"
      />

      {/* ---- Plante (détail narratif) ---- */}
      <g
        className="transition-transform duration-500 ease-out group-hover/art:rotate-[6deg]"
        style={{ transformBox: 'fill-box', transformOrigin: 'bottom center' }}
      >
        <ellipse cx="46" cy="151" rx="13" ry="4" fill="var(--color-foreground)" opacity="0.12" />
        <path d="M35,150 L40,128 H52 L57,150 Z" fill="url(#mob-accent)" opacity="0.9" />
        <path d="M40,128 H52 L50,133 H42 Z" fill="var(--color-accent)" opacity="0.5" />
        <path
          d="M46,128 C40,116 28,114 24,102 C34,102 44,110 46,120 Z"
          fill="url(#mob-accent)"
        />
        <path
          d="M46,128 C50,112 62,108 66,96 C58,98 47,106 44,118 Z"
          fill="var(--color-accent)"
          opacity="0.85"
        />
        <path
          d="M46,126 C44,110 34,104 32,92 C42,94 49,104 48,116 Z"
          fill="color-mix(in oklch, var(--color-accent) 70%, white)"
        />
      </g>

      {/* ---- Groupe chaise : se soulève légèrement au survol ---- */}
      <g className="transition-transform duration-300 ease-out group-hover/art:-translate-y-1.5">
        {/* Base + colonne */}
        <rect x="90" y="120" width="8" height="38" rx="4" fill="url(#mob-leg)" />
        <path
          d="M62,158 Q100,168 138,158 L134,163 Q100,172 66,163 Z"
          fill="url(#mob-leg)"
        />
        <circle cx="68" cy="163" r="4" fill="var(--color-foreground)" opacity="0.45" />
        <circle cx="132" cy="163" r="4" fill="var(--color-foreground)" opacity="0.45" />
        <circle cx="100" cy="166" r="4" fill="var(--color-foreground)" opacity="0.35" />

        {/* Accoudoirs (sous l'assise, pour la superposition) */}
        <rect x="58" y="96" width="10" height="34" rx="5" fill="url(#mob-back)" opacity="0.92" />
        <rect x="132" y="96" width="10" height="34" rx="5" fill="url(#mob-back)" opacity="0.92" />

        {/* Dossier */}
        <rect x="66" y="40" width="68" height="80" rx="22" fill="url(#mob-back)" />
        {/* Appui lombaire — forme secondaire superposée */}
        <rect x="78" y="76" width="44" height="26" rx="13" fill="url(#mob-accent)" opacity="0.9" />
        {/* Reflet premium en haut du dossier */}
        <path
          d="M76,48 Q100,38 124,48 Q100,54 76,48 Z"
          fill="color-mix(in oklch, var(--color-background) 80%, transparent)"
          opacity="0.35"
        />
        {/* Capuchon d'appui-tête */}
        <rect x="84" y="34" width="32" height="14" rx="7" fill="url(#mob-accent)" />

        {/* Assise */}
        <rect x="60" y="98" width="80" height="30" rx="14" fill="url(#mob-seat)" />
        {/* Piqûres / coutures */}
        <path d="M72,104 Q100,112 128,104" stroke="var(--color-primary-emphasis)" strokeOpacity="0.25" strokeWidth="1.5" fill="none" />
        <path d="M72,118 Q100,124 128,118" stroke="var(--color-primary-emphasis)" strokeOpacity="0.25" strokeWidth="1.5" fill="none" />
        {/* Liseré lumineux sur le bord avant de l'assise */}
        <rect x="60" y="120" width="80" height="4" rx="2" fill="color-mix(in oklch, var(--color-background) 70%, transparent)" opacity="0.4" />
      </g>
    </svg>
  );
}
