import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeaderPro from '@/components/PublicHeaderPro';
import SiteFooter from '@/components/SiteFooter';
import { supabase, SECTEURS_TABLE, type Secteur } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import SectorIllustration, { SECTOR_PHOTOS, guessSector } from '@/components/illustrations/SectorIllustration';
import CarrouselSecteur from '@/components/CarrouselSecteur';

export default function CataloguePro() {
  const [secteurs, setSecteurs] = useState<Secteur[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from(SECTEURS_TABLE)
        .select('*')
        .eq('actif', true)
        .order('ordre_affichage');
      setSecteurs((data as Secteur[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderPro />
      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground">Espace Pro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mobilier, quincaillerie, automobile, tech, textile professionnel — demandez un devis
            auprès des enseignes référencées sur Maylary.
          </p>
        </div>

        {loading ? (
          <div className="cascade grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : secteurs.length === 0 ? (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            L'espace Pro est en cours de constitution, revenez bientôt.
          </p>
        ) : (
          <div className="cascade grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {secteurs.map((s) => {
              // Les visuels du rayon priment ; à défaut on garde la photo
              // générique, puis l'illustration dessinée. Aucune carte ne peut
              // se retrouver vide pendant qu'on remplit les rayons un par un.
              const visuels = s.photos ?? [];
              const photo = SECTOR_PHOTOS[guessSector(s.nom)];
              return (
                <Link
                  key={s.id}
                  to={`/catalogue/secteur/${s.id}`}
                  className="carte-reactive group overflow-hidden rounded-lg border bg-card transition-all hover:-translate-y-1 hover:border-primary "
                >
                  <div className="relative h-32 w-full overflow-hidden">
                    {visuels.length > 0 ? (
                      <CarrouselSecteur photos={visuels} alt={s.nom} />
                    ) : photo ? (
                      <img
                        src={photo}
                        alt={s.nom}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-primary/10">
                        <SectorIllustration sector={guessSector(s.nom)} className="h-14 w-14" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  </div>
                  <div className="p-4">
                    <h3 className="font-display font-semibold text-foreground group-hover:text-primary">
                      {s.nom}
                    </h3>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
