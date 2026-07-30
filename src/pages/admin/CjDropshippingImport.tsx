import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  CATEGORIES_GP_TABLE,
  PARAMETRES_IMPORT_TABLE,
  type CategorieGP,
  type ParametresImport,
} from '@/lib/supabase';
import AdminNav from '@/components/AdminNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ImageOff, Loader2, PackagePlus, Settings, Calculator } from 'lucide-react';

interface CjResult {
  reference_externe: string;
  nom: string;
  photo: string | null;
  prix_fournisseur_usd: number | null;
  stock: number | null;
}

interface ImportResultat {
  prix_achat_fcfa: number;
  prix_unitaire_fcfa: number;
  taux_marge_applique: number;
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
  const [importResultats, setImportResultats] = useState<Record<string, ImportResultat>>({});
  const [parametres, setParametres] = useState<ParametresImport | null>(null);

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

  const loadParametres = async () => {
    const { data } = await supabase.from(PARAMETRES_IMPORT_TABLE).select('*').eq('id', 1).maybeSingle();
    setParametres(data as ParametresImport | null);
  };

  useEffect(() => {
    loadParametres();
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
      const result = await callEdgeFunction<{
        produit: { prix_achat_fcfa: number; prix_unitaire_fcfa: number };
        taux_marge_applique: number;
      }>('app_e08c374bc4_cj_dropshipping_import', {
        reference_externe: produit.reference_externe,
        nom: produit.nom,
        photos: produit.photo ? [produit.photo] : [],
        prix_fournisseur_usd: produit.prix_fournisseur_usd,
        stock: produit.stock,
        categorie_gp_id: categorieId,
      });
      setImportedRefs((prev) => new Set(prev).add(produit.reference_externe));
      setImportResultats((prev) => ({
        ...prev,
        [produit.reference_externe]: {
          prix_achat_fcfa: result.produit.prix_achat_fcfa,
          prix_unitaire_fcfa: result.produit.prix_unitaire_fcfa,
          taux_marge_applique: result.taux_marge_applique,
        },
      }));
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
        <ParametresMarge parametres={parametres} onSaved={loadParametres} />

        <form onSubmit={handleSearch} className="mt-8 flex max-w-lg gap-2">
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
                resultat={importResultats[p.reference_externe] ?? null}
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
  resultat,
  onImport,
}: {
  produit: CjResult;
  categories: CategorieGP[];
  imported: boolean;
  resultat: ImportResultat | null;
  onImport: (produit: CjResult, categorieId: string | null) => Promise<void>;
}) {
  const [categorieId, setCategorieId] = useState<string>('');
  const [importing, setImporting] = useState(false);

  const submit = async () => {
    if (!categorieId) {
      toast.error('Choisissez une catégorie avant d’importer ce produit.');
      return;
    }
    setImporting(true);
    await onImport(produit, categorieId);
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
          <div className="space-y-2">
            <Badge className="w-full justify-center py-1.5">Déjà importé</Badge>
            {resultat && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Prix d'achat</span>
                  <span className="font-medium text-foreground">
                    {resultat.prix_achat_fcfa.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Prix de vente (marge {Math.round(resultat.taux_marge_applique * 100)}%)
                  </span>
                  <span className="font-semibold text-primary-emphasis">
                    {resultat.prix_unitaire_fcfa.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor={`cat-${produit.reference_externe}`} className="text-xs">
                Catégorie boutique *
              </Label>
              <select
                id={`cat-${produit.reference_externe}`}
                value={categorieId}
                onChange={(e) => setCategorieId(e.target.value)}
                className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
              >
                <option value="">Choisir une catégorie…</option>
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

function ParametresMarge({
  parametres,
  onSaved,
}: {
  parametres: ParametresImport | null;
  onSaved: () => void;
}) {
  const [tauxMargePourcent, setTauxMargePourcent] = useState('');
  const [tauxChange, setTauxChange] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (parametres) {
      setTauxMargePourcent(String(Math.round(Number(parametres.taux_marge_defaut) * 100)));
      setTauxChange(String(parametres.taux_change_usd_fcfa));
    }
  }, [parametres]);

  const handleSave = async () => {
    const pourcent = parseFloat(tauxMargePourcent);
    const change = parseFloat(tauxChange);
    if (!Number.isFinite(pourcent) || pourcent < 0) {
      toast.error('Le taux de marge doit être un nombre positif.');
      return;
    }
    if (!Number.isFinite(change) || change <= 0) {
      toast.error('Le taux de change doit être un nombre positif.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from(PARAMETRES_IMPORT_TABLE)
      .update({ taux_marge_defaut: pourcent / 100, taux_change_usd_fcfa: change })
      .eq('id', 1);
    if (error) {
      toast.error("Impossible d'enregistrer les réglages.");
      setSaving(false);
      return;
    }
    toast.success('Réglages de marge mis à jour.');
    onSaved();
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <CardTitle>Réglages d'import</CardTitle>
        </div>
        <CardDescription>
          Ce taux de marge s'applique automatiquement à chaque import CJ Dropshipping — aucune
          saisie manuelle du prix de vente n'est nécessaire.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="taux-marge">Marge appliquée (%)</Label>
            <Input
              id="taux-marge"
              type="number"
              min={0}
              step={1}
              value={tauxMargePourcent}
              onChange={(e) => setTauxMargePourcent(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="taux-change">Taux de change (FCFA pour 1 USD)</Label>
            <Input
              id="taux-change"
              type="number"
              min={0}
              step={1}
              value={tauxChange}
              onChange={(e) => setTauxChange(e.target.value)}
            />
          </div>
        </div>
        {parametres && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calculator className="h-3.5 w-3.5" />
            Exemple : un produit acheté 10 $ devient{' '}
            {Math.round(10 * Number(tauxChange || parametres.taux_change_usd_fcfa)).toLocaleString('fr-FR')}{' '}
            FCFA d'achat, vendu{' '}
            {Math.round(
              10 *
                Number(tauxChange || parametres.taux_change_usd_fcfa) *
                (1 + Number(tauxMargePourcent || 0) / 100),
            ).toLocaleString('fr-FR')}{' '}
            FCFA.
          </p>
        )}
        <Button className="mt-4" size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enregistrer les réglages
        </Button>
      </CardContent>
    </Card>
  );
}
