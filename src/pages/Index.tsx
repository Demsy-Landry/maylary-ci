import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Boxes, ShieldCheck, ClipboardList, ShoppingBag, ArrowRight, Truck } from 'lucide-react';

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Boxes className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Maylary</span>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-screen-xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="max-w-2xl">
              <p className="text-sm font-medium uppercase tracking-wider text-primary">
                Côte d'Ivoire
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
                Maylary — vos achats, en ligne, en toute confiance.
              </h1>
              <p className="mt-4 max-w-prose text-lg text-muted-foreground">
                Des produits tendance, commandez directement en ligne et faites-vous livrer.
              </p>
            </div>

            <div className="mt-12 max-w-md">
              <Link
                to="/boutique"
                className="group relative overflow-hidden rounded-xl border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary hover:shadow-xl"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <ShoppingBag className="h-6 w-6 text-primary" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-foreground">Boutique Maylary</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Découvrez nos produits et commandez en toute simplicité.
                </p>
                <span className="mt-4 inline-flex items-center text-sm font-medium text-primary">
                  Découvrir la boutique
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-card p-5">
                <ClipboardList className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold text-foreground">Catalogues vérifiés</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Des produits réels, sélectionnés avec soin.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-5">
                <Truck className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold text-foreground">Livraison suivie</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Suivez chaque commande jusqu'à la livraison.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-5">
                <ShieldCheck className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold text-foreground">Paiement simple</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mobile Money ou virement, sans complication.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
