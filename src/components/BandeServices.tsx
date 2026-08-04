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

interface Service {
  to: string;
  titre: string;
  phrase: string;
  icone: LucideIcon;
  /** Classes de la pastille, pour distinguer les métiers d'un coup d'œil. */
  teinte: string;
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
    phrase: "Achetez n'importe où dans le monde, livré chez vous, douane comprise.",
    icone: PackageSearch,
    teinte: 'bg-primary/15 text-primary-emphasis',
  },
  {
    to: '/export/nouvelle-demande',
    titre: 'Exporter',
    phrase: 'Vendez votre production ivoirienne à un acheteur étranger.',
    icone: Ship,
    teinte: 'bg-accent/15 text-accent',
  },
  {
    to: '/boutique',
    titre: 'Boutique',
    phrase: "Catalogue prêt à l'achat, livré rapidement en Côte d'Ivoire.",
    icone: ShoppingBag,
    teinte: 'bg-primary/15 text-primary-emphasis',
  },
  {
    to: '/catalogue',
    titre: 'Espace Pro',
    phrase: 'Équipement professionnel par rayon, sur devis, pour votre entreprise.',
    icone: Building2,
    teinte: 'bg-accent/15 text-accent',
  },
  {
    to: '/boutique/sourcing',
    titre: 'Sourcing sur demande',
    phrase: "L'article que vous cherchez n'est pas au catalogue ? Nous allons le chercher.",
    icone: Search,
    teinte: 'bg-primary/15 text-primary-emphasis',
  },
  {
    to: '/vendre',
    titre: 'Vendre sur Maylary',
    phrase: 'Entreprise ivoirienne ? Ouvrez votre boutique, nous sécurisons le paiement.',
    icone: Store,
    teinte: 'bg-accent/15 text-accent',
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
 * La bande se place juste sous le hero, donc à un demi-écran du chargement.
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

        <div className="cascade mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => {
            const Icone = s.icone;
            return (
              <Link
                key={s.to}
                to={s.to}
                className="carte-reactive group flex min-w-0 items-start gap-3 rounded-lg border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${s.teinte}`}
                >
                  <Icone className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-display font-bold text-foreground">
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
