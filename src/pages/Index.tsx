import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ClipboardList, ShoppingBag, ArrowRight, Truck, Building2 } from 'lucide-react';
import HeroScene from '@/components/HeroScene';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import SectorIllustration, { SECTORS, SECTOR_PHOTOS } from '@/components/illustrations/SectorIllustration';
import { supabase, PRODUITS_PUBLIC_VIEW, type Produit } from '@/lib/supabase';
import { ProductCardGP } from '@/pages/CatalogueGrandPublic';
import { Skeleton } from '@/components/ui/skeleton';

export default function Index() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loadingProduits, setLoadingProduits] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from(PRODUITS_PUBLIC_VIEW)
        .select('*')
        .eq('espace', 'grand_public')
        .eq('actif', true)
        .limit(12);
      setProduits((data as Produit[]) ?? []);
      setLoadingProduits(false);
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />

      <main>
        <section className="relative overflow-hidden">
          <HeroScene />

          <div className="relative mx-auto max-w-screen-xl px-4 pt-16 pb-16 sm:px-6 sm:pt-24 sm:pb-20">
            <div className="max-w-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-600 motion-safe:delay-[350ms] motion-safe:fill-mode-both">
              <p className="text-sm font-bold uppercase tracking-widest text-primary-emphasis">
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

            <div className="mt-12 grid gap-4 sm:grid-cols-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-600 motion-safe:delay-[500ms] motion-safe:fill-mode-both">
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
                <span className="mt-4 inline-flex items-center text-sm font-semibold text-primary-emphasis">
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

        {(loadingProduits || produits.length > 0) && (
          <section className="mx-auto max-w-screen-xl px-4 pb-10 sm:px-6">
            <div className="flex items-end justify-between">
              <h2 className="font-display text-2xl font-bold text-foreground">Produits tendance</h2>
              <Link
                to="/boutique"
                className="text-sm font-semibold text-primary-emphasis hover:underline"
              >
                Voir toute la boutique
              </Link>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {loadingProduits
                ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square w-full" />)
                : produits.map((p) => <ProductCardGP key={p.id} produit={p} />)}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-screen-xl px-4 pb-6 sm:px-6">
          <h2 className="font-display text-2xl font-bold text-foreground">Nos secteurs</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Les univers de boutiques et d'entreprises pour lesquels Maylary vend et livre en
            Côte d'Ivoire.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {SECTORS.map((s, i) => (
              <div
                key={s.key}
                className="group flex flex-col items-center rounded-2xl border bg-card p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-lg"
              >
                {SECTOR_PHOTOS[s.key] ? (
                  <div className="h-20 w-20 overflow-hidden rounded-full border border-primary/15">
                    <img
                      src={SECTOR_PHOTOS[s.key]}
                      alt={s.label}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  </div>
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                    <SectorIllustration
                      sector={s.key}
                      animated
                      className="h-12 w-12"
                      style={
                        {
                          '--float-x': `${6 + (i % 3) * 3}px`,
                          '--float-y': `${-8 - (i % 2) * 4}px`,
                          '--float-rot-from': `${-3 - i}deg`,
                          '--float-rot-to': `${3 + i}deg`,
                          '--float-duration': `${7 + i}s`,
                        } as CSSProperties
                      }
                    />
                  </div>
                )}
                <h3 className="font-display mt-3 text-sm font-bold text-foreground">{s.label}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
              </div>
            ))}
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

      <SiteFooter />
    </div>
  );
}
