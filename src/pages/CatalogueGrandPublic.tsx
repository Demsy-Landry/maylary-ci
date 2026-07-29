import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import { supabase, CATEGORIES_GP_TABLE, PRODUITS_PUBLIC_VIEW, type CategorieGP, type Produit } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Search, ImageOff, ShoppingCart } from 'lucide-react';
import SectorIllustration, { guessSector } from '@/components/illustrations/SectorIllustration';
import { useCartGP } from '@/hooks/useCartGP';
import { toast } from 'sonner';

export default function CatalogueGrandPublic() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<CategorieGP[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setSearch(q);
  }, [searchParams]);

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
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchParams(e.target.value ? { q: e.target.value } : {}, { replace: true });
              }}
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                {searchResults.map((p) => (
                  <ProductCardGP key={p.id} produit={p} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/boutique/categorie/${c.id}`}
                  className="group flex shrink-0 items-center gap-2 rounded-full border bg-card py-1.5 pl-1.5 pr-4 transition-colors hover:border-primary"
                >
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-primary/10">
                    {c.image_url ? (
                      <img src={c.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <SectorIllustration sector={guessSector(c.nom)} className="h-full w-full p-1" />
                    )}
                  </div>
                  <span className="whitespace-nowrap text-sm font-medium text-foreground group-hover:text-primary">
                    {c.nom}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({produitsCountByCategorie(c.id)})
                  </span>
                </Link>
              ))}
              {categories.length === 0 && (
                <p className="col-span-full rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  La boutique est en cours de préparation, revenez bientôt.
                </p>
              )}
            </div>

            {produits.length > 0 && (
              <div className="mt-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">Tous les produits</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
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
  const { addItem } = useCartGP();
  const [imgError, setImgError] = useState(false);
  const enRupture = produit.stock_disponible === 'rupture';

  const handleQuickAdd = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      produit_id: produit.id,
      nom: produit.nom,
      prix_unitaire_fcfa: produit.prix_unitaire_fcfa,
      photo: produit.photos?.[0] ?? null,
    });
    toast.success('Ajouté à votre panier.');
  };

  return (
    <Link
      to={`/boutique/produit/${produit.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-lg"
    >
      <div className="aspect-square w-full overflow-hidden bg-white p-2">
        {produit.photos?.[0] && !imgError ? (
          <img
            src={produit.photos[0]}
            alt={produit.nom}
            onError={() => setImgError(true)}
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <ImageOff className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm text-foreground">{produit.nom}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-base font-bold text-foreground">
            {produit.prix_unitaire_fcfa.toLocaleString('fr-FR')}
          </span>
          <span className="text-xs text-muted-foreground">FCFA</span>
        </div>
        {enRupture && (
          <Badge variant="destructive" className="mt-1 w-fit text-[10px]">
            Rupture
          </Badge>
        )}
        <div className="mt-auto pt-2">
          <button
            onClick={handleQuickAdd}
            disabled={enRupture}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-emphasis disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Ajouter au panier
          </button>
        </div>
      </div>
    </Link>
  );
}
