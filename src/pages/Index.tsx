import { Link } from 'react-router-dom';
import { Boxes, ShieldCheck, ClipboardList, ShoppingBag, ArrowRight, Truck, Building2 } from 'lucide-react';
import HeroScene from '@/components/HeroScene';

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Boxes className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">Maylary</span>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <HeroScene />

          <div className="relative mx-auto max-w-screen-xl px-4 pt-16 pb-44 sm:px-6 sm:pt-24 sm:pb-56">
            <div className="max-w-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700">
              <p className="text-sm font-bold uppercase tracking-widest text-primary">
                Côte d'Ivoire
              </p>
              <h1 className="font-display mt-3 text-4xl font-extrabold leading-tight tracking-tight text-foreground text-balance sm:text-5xl">
                Vos achats, en ligne, en toute confiance.
              </h1>
              <p className="mt-4 max-w-prose text-lg text-muted-foreground">
                Des produits tendance et du matériel professionnel, commandez directement en
                ligne et faites-vous livrer partout en Côte d'Ivoire.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:delay-150 motion-safe:fill-mode-both">
              <Link
                to="/boutique"
                className="group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <h2 className="font-display mt-4 text-xl font-bold text-foreground">Boutique</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Grand public — découvrez nos produits et commandez en toute simplicité.
                </p>
                <span className="mt-4 inline-flex items-center text-sm font-semibold text-primary">
                  Découvrir la boutique
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>

              <Link
                to="/catalogue"
                className="group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent transition-transform duration-300 group-hover:scale-110">
                  <Building2 className="h-6 w-6" />
                </div>
                <h2 className="font-display mt-4 text-xl font-bold text-foreground">Espace Pro</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Entreprises — mobilier, quincaillerie, automobile, tech et textile professionnel.
                </p>
                <span className="mt-4 inline-flex items-center text-sm font-semibold text-accent">
                  Demander un devis
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-screen-xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 sm:pb-24">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-5 transition-shadow duration-300 hover:shadow-md">
              <ClipboardList className="h-6 w-6 text-primary" />
              <h3 className="font-display mt-3 font-bold text-foreground">Catalogues vérifiés</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Des produits réels, sélectionnés avec soin.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5 transition-shadow duration-300 hover:shadow-md">
              <Truck className="h-6 w-6 text-primary" />
              <h3 className="font-display mt-3 font-bold text-foreground">Livraison suivie</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Suivez chaque commande jusqu'à la livraison.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5 transition-shadow duration-300 hover:shadow-md">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <h3 className="font-display mt-3 font-bold text-foreground">Paiement simple</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Mobile Money ou virement, sans complication.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
