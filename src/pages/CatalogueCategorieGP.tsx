import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import { supabase, CATEGORIES_GP_TABLE, PRODUITS_PUBLIC_VIEW, type CategorieGP, type Produit } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCardGP } from '@/pages/CatalogueGrandPublic';
import { ImageOff, ChevronLeft } from 'lucide-react';

export default function CatalogueCategorieGP() {
  const { categorieId } = useParams<{ categorieId: string }>();
  const [categorie, setCategorie] = useState<CategorieGP | null>(null);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!categorieId) return;
    const load = async () => {
      setLoading(true);
      const [categorieRes, produitsRes] = await Promise.all([
        supabase.from(CATEGORIES_GP_TABLE).select('*').eq('id', categorieId).maybeSingle(),
        supabase
          .from(PRODUITS_PUBLIC_VIEW)
          .select('*')
          .eq('categorie_gp_id', categorieId)
          .eq('espace', 'grand_public')
          .eq('actif', true),
      ]);
      setCategorie((categorieRes.data as CategorieGP) ?? null);
      setProduits((produitsRes.data as Produit[]) ?? []);
      setLoading(false);
    };
    load();
  }, [categorieId]);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <Link
          to="/boutique"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Retour à la boutique
        </Link>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          </div>
        ) : !categorie ? (
          <p className="text-sm text-muted-foreground">Catégorie introuvable.</p>
        ) : (
          <>
            <div className="relative mb-6 overflow-hidden rounded-lg">
              {categorie.image_url ? (
                <img
                  src={categorie.image_url}
                  alt={categorie.nom}
                  className="h-40 w-full object-cover sm:h-52"
                />
              ) : (
                <div className="flex h-40 w-full items-center justify-center bg-muted sm:h-52">
                  <ImageOff className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/20 to-transparent p-5">
                <h1 className="text-2xl font-bold text-white drop-shadow-sm sm:text-3xl">
                  {categorie.nom}
                </h1>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {produits.map((p) => (
                <ProductCardGP key={p.id} produit={p} />
              ))}
              {produits.length === 0 && (
                <p className="col-span-full rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Aucun produit disponible pour le moment dans cette catégorie.
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
