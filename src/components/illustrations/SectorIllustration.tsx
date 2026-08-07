import type { CSSProperties, ReactElement } from 'react';
import { STORAGE_PUBLIC_URL } from '@/lib/supabase';

/**
 * Illustrations figuratives par secteur — codées en dur en SVG (aucune photo
 * disponible). But : montrer concrètement ce que Maylary vend, secteur par
 * secteur, plutôt qu'une composition abstraite. Chaque illustration flotte
 * doucement (voir .animate-float-drift dans index.css), désactivé pour
 * prefers-reduced-motion.
 */

export type SectorKey =
  | 'boutique'
  | 'mobilier'
  | 'quincaillerie'
  | 'automobile'
  | 'tech'
  | 'textile';

/**
 * Vraies photos (hébergées sur Supabase Storage, sourcées via Canva) qui
 * remplacent l'illustration SVG codée en dur quand elles existent. Un
 * secteur sans entrée ici retombe automatiquement sur son SVG.
 */
const PHOTOS_BASE_URL = `${STORAGE_PUBLIC_URL}/app_e08c374bc4_produit_photos/secteurs`;

export const SECTOR_PHOTOS: Partial<Record<SectorKey, string>> = {
  boutique: `${PHOTOS_BASE_URL}/boutique.jpg`,
  mobilier: `${PHOTOS_BASE_URL}/mobilier.png`,
  quincaillerie: `${PHOTOS_BASE_URL}/quincaillerie.jpg`,
  automobile: `${PHOTOS_BASE_URL}/automobile.jpg`,
  tech: `${PHOTOS_BASE_URL}/tech.jpg`,
  textile: `${PHOTOS_BASE_URL}/textile.jpg`,
};

export const SECTORS: Array<{ key: SectorKey; label: string; description: string }> = [
  { key: 'boutique', label: 'Boutique', description: 'Produits tendance, sourcing international' },
  { key: 'mobilier', label: 'Mobilier', description: 'Bureaux, salons, agencement professionnel' },
  { key: 'quincaillerie', label: 'Quincaillerie', description: 'Outillage, matériaux, équipement' },
  { key: 'automobile', label: 'Automobile', description: 'Pièces, accessoires, entretien' },
  { key: 'tech', label: 'Tech', description: 'Informatique, téléphonie, bureautique' },
  { key: 'textile', label: 'Textile pro', description: 'Uniformes, tissus, confection' },
];

function ChairArt() {
  return (
    <>
      <rect x="15" y="25" width="70" height="35" rx="14" className="fill-primary" />
      <rect x="10" y="40" width="14" height="35" rx="7" className="fill-primary/80" />
      <rect x="76" y="40" width="14" height="35" rx="7" className="fill-primary/80" />
      <rect x="15" y="55" width="70" height="20" rx="10" className="fill-accent" />
      <rect x="22" y="82" width="6" height="10" rx="2" className="fill-foreground/30" />
      <rect x="72" y="82" width="6" height="10" rx="2" className="fill-foreground/30" />
    </>
  );
}

function ToolboxArt() {
  return (
    <>
      <path d="M40,45 a10,18 0 0 1 20,0" className="fill-none stroke-primary" strokeWidth="6" strokeLinecap="round" />
      <rect x="15" y="45" width="70" height="35" rx="6" className="fill-primary" />
      <rect x="15" y="45" width="70" height="10" rx="5" className="fill-accent" />
      <circle cx="50" cy="63" r="5" className="fill-background" />
    </>
  );
}

function CarArt() {
  return (
    <>
      <rect x="26" y="35" width="42" height="26" rx="10" className="fill-primary" />
      <rect x="32" y="41" width="13" height="13" rx="3" className="fill-background/70" />
      <rect x="50" y="41" width="12" height="13" rx="3" className="fill-background/70" />
      <rect x="8" y="55" width="84" height="20" rx="10" className="fill-primary" />
      <circle cx="27" cy="76" r="10" className="fill-foreground/70" />
      <circle cx="27" cy="76" r="4" className="fill-accent" />
      <circle cx="73" cy="76" r="10" className="fill-foreground/70" />
      <circle cx="73" cy="76" r="4" className="fill-accent" />
    </>
  );
}

function TechArt() {
  return (
    <>
      <rect x="15" y="28" width="47" height="32" rx="4" className="fill-primary" />
      <rect x="19" y="32" width="39" height="24" rx="2" className="fill-accent" />
      <rect x="10" y="60" width="57" height="7" rx="3.5" className="fill-primary" />
      <rect x="68" y="38" width="19" height="36" rx="5" className="fill-accent" />
      <circle cx="77.5" cy="68" r="1.6" className="fill-background" />
    </>
  );
}

function ShirtArt() {
  return (
    <>
      <polygon
        points="50,18 40,18 24,29 30,43 38,38 38,82 62,82 62,38 70,43 76,29 60,18"
        className="fill-primary"
      />
      <circle cx="50" cy="24" r="6" className="fill-accent" />
    </>
  );
}

function BagArt() {
  return (
    <>
      <path d="M35,37 q15,-24 30,0" className="fill-none stroke-accent" strokeWidth="5" strokeLinecap="round" />
      <polygon points="25,37 75,37 80,82 20,82" className="fill-primary" />
      <circle cx="50" cy="58" r="6" className="fill-accent" />
    </>
  );
}

const ART: Record<SectorKey, () => ReactElement> = {
  boutique: BagArt,
  mobilier: ChairArt,
  quincaillerie: ToolboxArt,
  automobile: CarArt,
  tech: TechArt,
  textile: ShirtArt,
};

const KEYWORDS: Array<[SectorKey, string[]]> = [
  ['mobilier', ['mobilier', 'meuble', 'bureau', 'salon', 'chaise', 'fauteuil', 'canape', 'table']],
  ['quincaillerie', ['quincaillerie', 'outil', 'materiau', 'bricolage', 'plomberie', 'electricite']],
  ['automobile', ['auto', 'voiture', 'vehicule', 'moto', 'pneu', 'pièce', 'piece']],
  ['tech', ['tech', 'informatique', 'telephon', 'electronique', 'ordinateur', 'bureautique', 'gadget']],
  ['textile', ['textile', 'vetement', 'mode', 'tissu', 'confection', 'uniforme', 'chaussure', 'accessoire']],
];

function normalize(label: string) {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Devine un secteur illustré à partir d'un libellé libre (nom de catégorie, de secteur…). */
export function guessSector(label: string): SectorKey {
  const n = normalize(label);
  for (const [key, words] of KEYWORDS) {
    if (words.some((w) => n.includes(w))) return key;
  }
  return 'boutique';
}

interface SectorIllustrationProps {
  sector: SectorKey;
  className?: string;
  animated?: boolean;
  style?: CSSProperties;
}

export default function SectorIllustration({
  sector,
  className = '',
  animated = false,
  style,
}: SectorIllustrationProps) {
  const Art = ART[sector];
  return (
    <svg
      viewBox="0 0 100 100"
      className={`${animated ? 'animate-float-drift' : ''} ${className}`}
      style={style}
      aria-hidden="true"
    >
      <Art />
    </svg>
  );
}
