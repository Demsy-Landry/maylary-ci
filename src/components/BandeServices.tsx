import { Link } from 'react-router-dom';
import {
  PackageSearch,
  Ship,
  ShoppingBag,
  Building2,
  Search,
  Store,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { STORAGE_PUBLIC_URL } from '@/lib/supabase';

const STORAGE_BASE = `${STORAGE_PUBLIC_URL}/app_e08c374bc4_produit_photos/accueil`;

interface Service {
  to: string;
  titre: string;
  phrase: string;
  icone: LucideIcon;
  image: string;
  /** Texte alternatif : ce que montre la photo, pour qui ne la voit pas. */
  alt: string;
  /** Famille de métier, pour situer le service d'un coup d'œil. */
  famille: string;
}

/**
 * Les six métiers de Maylary, dans l'ordre où ils comptent pour un visiteur qui
 * arrive : ce qu'il vient chercher d'abord, puis ce qu'il ne savait pas qu'on
 * faisait.
 */
const SERVICES: Service[] = [
  {
    to: '/import/nouvelle-demande',
    titre: 'Importer',
    phrase:
      "Achetez chez n'importe quel fournisseur dans le monde. Marchandise, fret, assurance, douane et livraison : un seul devis, un seul interlocuteur.",
    icone: PackageSearch,
    image: `${STORAGE_BASE}/service-importer.jpg`,
    alt: "Entrepôt logistique : cartons palettisés et manutentionnaire en gilet de sécurité vérifiant un colis.",
    famille: 'Commerce international',
  },
  {
    to: '/export/nouvelle-demande',
    titre: 'Exporter',
    phrase:
      "Vendez votre production ivoirienne à l'étranger. Nous montons le dossier, la logistique et les documents d'exportation.",
    icone: Ship,
    image: `${STORAGE_BASE}/service-exporter.jpg`,
    alt: "Quai d'exportation : sacs de fèves de cacao empilés devant un conteneur maritime ouvert.",
    famille: 'Commerce international',
  },
  {
    to: '/boutique',
    titre: 'Boutique',
    phrase:
      "Un catalogue prêt à l'achat, au prix réel : le fret est affiché à part, jamais caché dans le prix de l'article.",
    icone: ShoppingBag,
    image: `${STORAGE_BASE}/service-boutique.jpg`,
    alt: 'Cliente ouvrant chez elle un colis de commande en ligne.',
    famille: 'Achat en ligne',
  },
  {
    to: '/catalogue',
    titre: 'Espace Pro',
    phrase:
      "Équipement professionnel par rayon — outillage, mobilier, électricité, informatique — chiffré pour votre entreprise.",
    icone: Building2,
    image: `${STORAGE_BASE}/service-espace-pro.jpg`,
    alt: "Gérant consultant son stock, tablette en main, dans les rayons d'un magasin professionnel.",
    famille: 'Entreprises',
  },
  {
    to: '/boutique/sourcing',
    titre: 'Sourcing sur demande',
    phrase:
      "L'article que vous cherchez n'est pas au catalogue ? Décrivez-le : nous allons le chercher chez le fournisseur et nous vous chiffrons.",
    icone: Search,
    image: `${STORAGE_BASE}/service-sourcing.jpg`,
    alt: "Acheteur examinant à la main des échantillons de produits posés sur un bureau.",
    famille: 'Sur demande',
  },
  {
    to: '/vendre',
    titre: 'Vendre sur Maylary',
    phrase:
      "Entreprise ivoirienne ? Ouvrez votre boutique sans abonnement : vous êtes payé, nous prenons une commission sur la vente.",
    icone: Store,
    image: `${STORAGE_BASE}/service-vendre.jpg`,
    alt: 'Commerçante ivoirienne refermant un colis dans sa boutique, ordinateur portable ouvert à côté.',
    famille: 'Marketplace',
  },
];

/**
 * Tous les métiers, visibles dès la première page.
 *
 * Ils vivaient jusqu'ici dispersés : l'import et l'export en grand, la boutique
 * et l'espace pro tout en bas de la page d'accueil, le sourcing et la
 * marketplace nulle part. Un visiteur devait dérouler l'écran entier pour
 * découvrir la moitié de l'offre — et la plupart ne déroulent pas.
 *
 * Chaque service porte désormais sa photographie, comme les sections Import et
 * Export : six pastilles d'icônes se ressemblaient toutes, et rien ne disait à
 * quoi ressemble le métier. Les images sont servies en 800 px et chargées à la
 * demande — sur une connexion mobile ivoirienne, six visuels pleine résolution
 * en haut de page coûteraient plus cher que ce qu'ils rapportent.
 *
 * Sur téléphone la carte se couche : vignette à gauche, texte à droite. Six
 * cartes en pleine largeur avec leur image en 16/9 faisaient 2 200 px de bande —
 * on retombait dans le défaut qu'elle corrige, celui de devoir dérouler pour
 * voir l'offre. À partir de la tablette, la place existe : la carte se redresse
 * et l'image passe en grand.
 */
export default function BandeServices() {
  return (
    <section className="border-b bg-muted/30">
      <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6">
        <h2 className="font-display text-center text-xl font-extrabold uppercase tracking-tight text-foreground sm:text-2xl">
          Tout ce que Maylary fait pour vous
        </h2>
        <p className="mx-auto mt-1 max-w-prose text-center text-sm text-muted-foreground">
          Six services, un seul interlocuteur, de la recherche du fournisseur jusqu'à votre porte.
        </p>

        <div className="cascade mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => {
            const Icone = s.icone;
            return (
              <Link
                key={s.to}
                to={s.to}
                className="carte-reactive group flex min-w-0 gap-3 overflow-hidden rounded-lg border bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-primary sm:flex-col sm:gap-0 sm:p-0"
              >
                <div className="relative w-28 shrink-0 self-stretch overflow-hidden rounded-md bg-muted sm:aspect-[16/9] sm:w-auto sm:self-auto sm:rounded-none">
                  <img
                    src={s.image}
                    alt={s.alt}
                    width={800}
                    height={450}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                <div className="flex min-w-0 flex-1 flex-col sm:p-4">
                  <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary-emphasis">
                    <Icone className="h-3 w-3 shrink-0" />
                    {s.famille}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 font-display font-bold text-foreground">
                    {s.titre}
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{s.phrase}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
