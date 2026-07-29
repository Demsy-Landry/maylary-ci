import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  CATEGORIES_GP_TABLE,
  type CategorieGP,
} from '@/lib/supabase';
import AdminNav from '@/components/AdminNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ImageOff, Loader2, PackagePlus } from 'lucide-react';

interface CjResult {
  reference_externe: string;
  nom: string;
  photo: string | null;
  prix_fournisseur_usd: number | null;
  stock: number | null;
}

async function callEdgeFunction<T>(slug: string, body: unknown): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Session expirée, reconnectez-vous.');

  const res = await fetch(`${EDGE_FUNCTIONS_URL}/${slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error ?? 'Une erreur est survenue.');
  }
  return json as T;
}

export default function CjDropshippingImport() {
  const [keyword, setKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<CjResult[]>([]);
  const [motCleTraduit, setMotCleTraduit] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategorieGP[]>([]);
  const [importedRefs, setImportedRefs] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase
        .from(CATEGORIES_GP_TABLE)
        .select('*')
        .order('ordre_affichage');
      setCategories((data as CategorieGP[]) ?? []);
    };
    loadCategories();
  }, []);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      const { produits, mot_cle_traduit } = await callEdgeFunction<{
        produits: CjResult[];
        mot_cle_traduit?: string;
      }>('app_e08c374bc4_cj_dropshipping_search', { keyword: keyword.trim() });
      setResults(produits);
      setMotCleTraduit(mot_cle_traduit ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Recherche impossible.');
      setResults([]);
      setMotCleTraduit(null);
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async (produit: CjResult, categorieId: string | null) => {
    try {
      await callEdgeFunction('app_e08c374bc4_cj_dropshipping_import', {
        reference_externe: produit.reference_externe,
        nom: produit.nom,
        photos: produit.photo ? [produit.photo] : [],
        prix_fournisseur_usd: produit.prix_fournisseur_usd,
        stock: produit.stock,
        categorie_gp_id: categorieId,
      });
      setImportedRefs((prev) => new Set(prev).add(produit.reference_externe));
      toast.success(`« ${produit.nom} » importé dans le catalogue.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'import.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="space-y-2">
            <AdminNav />
            <h1 className="font-display text-lg font-bold text-foreground">
              Admin — Import CJ Dropshipping
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <form onSubmit={handleSearch} className="flex max-w-lg gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Rechercher un produit chez CJ Dropshipping (ex: montre)"
          />
          <Button type="submit" disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="ml-1.5 hidden sm:inline">Rechercher</span>
          </Button>
        </form>

        {!searching && searched && motCleTraduit && (
          <p className="mt-3 text-xs text-muted-foreground">
            CJ Dropshipping recherche uniquement en anglais : traduit et cherché comme «&nbsp;
            {motCleTraduit}&nbsp;».
          </p>
        )}

        {searching ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : searched && results.length === 0 ? (
          <p className="mt-6 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aucun résultat CJ Dropshipping pour « {keyword} ».
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((p) => (
              <ResultCard
                key={p.reference_externe}
                produit={p}
                categories={categories}
                imported={importedRefs.has(p.reference_externe)}
                onImport={handleImport}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ResultCard({
  produit,
  categories,
  imported,
  onImport,
}: {
  produit: CjResult;
  categories: CategorieGP[];
  imported: boolean;
  onImport: (produit: CjResult, categorieId: string | null) => Promise<void>;
}) {
  const [categorieId, setCategorieId] = useState<string>('');
  const [importing, setImporting] = useState(false);

  const submit = async () => {
    setImporting(true);
    await onImport(produit, categorieId || null);
    setImporting(false);
  };

  return (
    <Card className="overflow-hidden py-0">
      {produit.photo ? (
        <img src={produit.photo} alt={produit.nom} className="h-40 w-full object-cover" />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-muted">
          <ImageOff className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <CardContent className="space-y-3 p-4">
        <p className="line-clamp-2 text-sm font-medium text-foreground">{produit.nom}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {produit.prix_fournisseur_usd != null
              ? `${produit.prix_fournisseur_usd.toFixed(2)} USD (achat)`
              : 'Prix inconnu'}
          </span>
          {produit.stock != null && (
            <Badge variant={produit.stock > 0 ? 'secondary' : 'destructive'} className="text-[10px]">
              {produit.stock > 0 ? `${produit.stock} en stock` : 'Rupture'}
            </Badge>
          )}
        </div>

        {imported ? (
          <Badge className="w-full justify-center py-1.5">Déjà importé</Badge>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor={`cat-${produit.reference_externe}`} className="text-xs">
                Catégorie boutique (optionnel)
              </Label>
              <select
                id={`cat-${produit.reference_externe}`}
                value={categorieId}
                onChange={(e) => setCategorieId(e.target.value)}
                className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
              >
                <option value="">Sans catégorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
            <Button className="w-full" size="sm" onClick={submit} disabled={importing}>
              {importing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PackagePlus className="mr-2 h-4 w-4" />
              )}
              Importer dans la boutique
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
