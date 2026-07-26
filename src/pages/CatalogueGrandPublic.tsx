import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import { supabase, CATEGORIES_GP_TABLE, PRODUITS_PUBLIC_VIEW, type CategorieGP, type Produit } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Search, ImageOff } from 'lucide-react';
import SectorIllustration, { guessSector } from '@/components/illustrations/SectorIllustration';

export default function CatalogueGrandPublic() {
  const [categories, setCategories] = useState<CategorieGP[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [categoriesRes, produitsRes] = await Promise.all([
        supabase
          .from(CATEGORIES_GP_TABLE)
          .select('*')
          .eq('actif', true)
          .order('ordre_affichage'),
        supabase
          .from(PRODUITS_PUBLIC_VIEW)
          .select('*')
          .eq('espace', 'grand_public')
          .eq('actif', true),
      ]);
      setCategories((categoriesRes.data as CategorieGP[]) ?? []);
      setProduits((produitsRes.data as Produit[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const produitsCountByCategorie = (categorieId: string) =>
    produits.filter((p) => p.categorie_gp_id === categorieId).length;

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    return produits.filter((p) => p.nom.toLowerCase().includes(q));
  }, [search, produits]);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Boutique Maylary</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Des produits tendance, livrés chez vous. Parcourez les catégories ou recherchez directement.
          </p>
          <div className="relative mt-4 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit (ex: montre, sac, écouteurs...)"
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : search.trim() ? (
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              {searchResults.length} résultat(s) pour « {search} »
            </p>
            {searchResults.length === 0 ? (
              <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Aucun produit ne correspond à votre recherche.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {searchResults.map((p) => (
                  <ProductCardGP key={p.id} produit={p} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/boutique/categorie/${c.id}`}
                  className="group relative isolate overflow-hidden rounded-lg border bg-card transition-all hover:-translate-y-1 hover:border-primary hover:shadow-xl"
                >
                  <div className="relative h-32 w-full overflow-hidden">
                    {c.image_url ? (
                      <img
                        src={c.image_url}
                        alt={c.nom}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-primary/10">
                        <SectorIllustration sector={guessSector(c.nom)} className="h-14 w-14" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-foreground group-hover:text-primary">
                      {c.nom}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {produitsCountByCategorie(c.id)} produit(s)
                    </p>
                  </div>
                </Link>
              ))}
              {categories.length === 0 && (
                <p className="col-span-full rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  La boutique est en cours de préparation, revenez bientôt.
                </p>
              )}
            </div>

            {produits.length > 0 && (
              <div className="mt-10">
                <h2 className="mb-4 text-lg font-semibold text-foreground">Tous les produits</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {produits.map((p) => (
                    <ProductCardGP key={p.id} produit={p} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export function ProductCardGP({ produit }: { produit: Produit }) {
  return (
    <Link
      to={`/boutique/produit/${produit.id}`}
      className="group overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary"
    >
      {produit.photos?.[0] ? (
        <img
          src={produit.photos[0]}
          alt={produit.nom}
          className="h-36 w-full object-cover"
        />
      ) : (
        <div className="flex h-36 w-full items-center justify-center bg-muted">
          <ImageOff className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="p-3">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
          {produit.nom}
        </p>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-primary">
            {produit.prix_unitaire_fcfa.toLocaleString('fr-FR')} FCFA
          </span>
          {produit.stock_disponible === 'rupture' && (
            <Badge variant="destructive" className="text-[10px]">
              Rupture
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
