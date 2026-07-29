import { Link } from 'react-router-dom';
import {
  PackageSearch,
  Calculator,
  CheckCircle2,
  Truck,
  ShieldCheck,
  Ship,
  Plane,
  FileCheck2,
  ShoppingBag,
  Building2,
  ArrowRight,
  Globe,
} from 'lucide-react';
import PublicHeaderImport from '@/components/PublicHeaderImport';
import SiteFooter from '@/components/SiteFooter';

const ETAPES = [
  {
    icon: PackageSearch,
    title: '1. Décrivez votre besoin',
    text: "Un produit, un lien fournisseur, une photo — chez n'importe quel fournisseur, dans n'importe quel pays.",
  },
  {
    icon: Calculator,
    title: '2. Nous chiffrons tout',
    text: 'Marchandise, fret international, assurance, douane et transit local : un devis complet, un seul interlocuteur.',
  },
  {
    icon: CheckCircle2,
    title: '3. Vous validez',
    text: "Vous acceptez le devis, on s'occupe de l'achat et de toute la logistique.",
  },
  {
    icon: Truck,
    title: '4. Livré chez vous',
    text: 'Suivi en temps réel jusqu\'à la livraison dans vos locaux, partout en Côte d\'Ivoire.',
  },
];

const ATOUTS = [
  {
    icon: ShieldCheck,
    title: 'Expertise transit',
    text: "Piloté par une équipe transitaire agréée — pas juste une place de marché, un vrai savoir-faire douane et logistique.",
  },
  {
    icon: Ship,
    title: 'Tous les modes de transport',
    text: 'Aérien, maritime ou routier, et tous les incoterms (EXW, FOB, CIF, DDP...) selon votre besoin.',
  },
  {
    icon: FileCheck2,
    title: 'Douane gérée de bout en bout',
    text: 'Dédouanement pris en charge, documents (factures, BL, déclarations) centralisés et accessibles.',
  },
  {
    icon: Plane,
    title: 'Particuliers & entreprises',
    text: 'Une seule demande, que vous achetiez pour vous-même ou pour approvisionner votre entreprise.',
  },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderImport />

      <main>
        <section className="border-b bg-gradient-to-br from-foreground to-foreground/90 text-background">
          <div className="mx-auto max-w-screen-xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary-foreground">
                <PackageSearch className="h-3.5 w-3.5" />
                Maylary Import
              </span>
              <h1 className="font-display mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">
                Achetez n'importe où dans le monde.
                <br />
                On s'occupe de tout, jusqu'à votre porte.
              </h1>
              <p className="mt-4 max-w-xl text-base text-background/80 sm:text-lg">
                Sourcing, achat, fret international, douane, transit local et livraison : une
                seule demande, un devis clair, un suivi de bout en bout — pour les particuliers
                comme pour les entreprises de Côte d'Ivoire.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/import/nouvelle-demande"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-primary-emphasis"
                >
                  Faire une demande d'import
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#comment-ca-marche"
                  className="inline-flex items-center gap-2 rounded-md border border-background/30 px-6 py-3 text-sm font-semibold text-background hover:bg-background/10"
                >
                  Comment ça marche
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="comment-ca-marche" className="mx-auto max-w-screen-xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-center text-xl font-extrabold uppercase tracking-tight text-foreground sm:text-2xl">
            Comment ça marche
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ETAPES.map((etape) => (
              <div
                key={etape.title}
                className="rounded-lg border bg-card p-5 transition-shadow duration-300 hover:shadow-md"
              >
                <etape.icon className="h-6 w-6 text-primary" />
                <h3 className="font-display mt-3 font-bold text-foreground">{etape.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{etape.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              to="/import/nouvelle-demande"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 hover:bg-primary-emphasis"
            >
              Commencer ma demande
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="border-y bg-muted/40">
          <div className="mx-auto max-w-screen-xl px-4 py-14 sm:px-6">
            <h2 className="font-display text-center text-xl font-extrabold uppercase tracking-tight text-foreground sm:text-2xl">
              Pourquoi Maylary Import
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ATOUTS.map((atout) => (
                <div key={atout.title} className="rounded-lg border bg-card p-5">
                  <atout.icon className="h-6 w-6 text-primary" />
                  <h3 className="font-display mt-3 font-bold text-foreground">{atout.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{atout.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b bg-foreground text-background">
          <div className="mx-auto max-w-screen-xl px-4 py-14 sm:px-6">
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  Maylary Export
                </span>
                <h2 className="font-display mt-4 text-2xl font-extrabold leading-tight sm:text-3xl">
                  Vous produisez en Côte d'Ivoire ? Exportez vers le monde entier.
                </h2>
                <p className="mt-3 text-sm text-background/80 sm:text-base">
                  Collecte, dédouanement à l'export, fret international, certifications
                  (origine, phytosanitaire) et livraison à votre acheteur — un seul devis, un
                  seul interlocuteur.
                </p>
              </div>
              <Link
                to="/export/nouvelle-demande"
                className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-primary-emphasis"
              >
                Faire une demande d'export
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-screen-xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-center text-xl font-extrabold uppercase tracking-tight text-foreground sm:text-2xl">
            Besoin de quelque chose de plus simple et rapide ?
          </h2>
          <p className="mx-auto mt-1 max-w-prose text-center text-sm text-muted-foreground">
            Pour les achats standards déjà disponibles chez nous, sans passer par une demande
            d'import sur mesure.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link
              to="/boutique"
              className="group flex items-center justify-between rounded-lg border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary-emphasis">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-display font-bold text-foreground">Boutique</p>
                  <p className="text-sm text-muted-foreground">
                    Catalogue prêt à l'achat, livré rapidement en Côte d'Ivoire.
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/catalogue"
              className="group flex items-center justify-between rounded-lg border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-display font-bold text-foreground">Espace Pro</p>
                  <p className="text-sm text-muted-foreground">
                    Catalogue professionnel et devis pour l'équipement de votre entreprise.
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
