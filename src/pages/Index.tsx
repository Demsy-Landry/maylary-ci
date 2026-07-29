import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { ShieldCheck, ClipboardList, Truck } from 'lucide-react';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import PromoCarousel from '@/components/PromoCarousel';
import RecommendationBlock from '@/components/RecommendationBlock';
import SectorIllustration, { SECTORS, SECTOR_PHOTOS } from '@/components/illustrations/SectorIllustration';
import { supabase, PRODUITS_PUBLIC_VIEW, type Produit } from '@/lib/supabase';

const THEMES = ['Produits tendance', 'Meilleures ventes', 'Nouveautés'];

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

  // Répartition simple en 3 blocs thématiques (pas de vraie recommandation
  // personnalisée pour l'instant, juste de quoi remplir plusieurs vitrines
  // façon Amazon plutôt qu'une seule grande grille).
  const blocs = THEMES.map((titre, i) => ({
    titre,
    produits: produits.slice(i * 4, i * 4 + 4),
  })).filter((b) => b.produits.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />

      <main>
        <PromoCarousel />

        {!loadingProduits && blocs.length > 0 && (
          <section className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {blocs.map((b) => (
                <RecommendationBlock
                  key={b.titre}
                  title={b.titre}
                  produits={b.produits}
                  viewAllHref="/boutique"
                />
              ))}
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
                className="group flex flex-col items-center rounded-lg border bg-card p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-lg"
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
            <div className="rounded-lg border bg-card p-5 transition-shadow duration-300 hover:shadow-md">
              <ClipboardList className="h-6 w-6 text-primary" />
              <h3 className="font-display mt-3 font-bold text-foreground">Catalogues vérifiés</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Des produits réels, sélectionnés avec soin.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-5 transition-shadow duration-300 hover:shadow-md">
              <Truck className="h-6 w-6 text-primary" />
              <h3 className="font-display mt-3 font-bold text-foreground">Livraison suivie</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Suivez chaque commande jusqu'à la livraison.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-5 transition-shadow duration-300 hover:shadow-md">
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
