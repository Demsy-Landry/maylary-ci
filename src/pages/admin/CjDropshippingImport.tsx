import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  CATEGORIES_GP_TABLE,
  PARAMETRES_IMPORT_TABLE,
  PARAMETRES_INCOTERM_TABLE,
  type CategorieGP,
  type ParametresImport,
  type ParametresIncoterm,
} from '@/lib/supabase';
import { calculerCoutImport } from '@/lib/cout-import';
import AdminNav from '@/components/AdminNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ImageOff, Loader2, PackagePlus, Settings, Calculator, Truck, ShieldCheck } from 'lucide-react';

interface CjResult {
  reference_externe: string;
  nom: string;
  photo: string | null;
  prix_fournisseur_usd: number | null;
  stock: number | null;
}

interface ImportResultat {
  prix_achat_fcfa: number;
  cout_fret_fcfa: number;
  cout_assurance_fcfa: number;
  cout_revient_fcfa: number;
  prix_unitaire_fcfa: number;
  plancher_applique: boolean;
  incoterm: string;
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
  const [incoterms, setIncoterms] = useState<ParametresIncoterm[]>([]);
  /**
   * Dernière catégorie choisie : elle pré-remplit les fiches suivantes, pour
   * enchaîner l'import d'une série d'articles d'une même famille sans
   * resélectionner la catégorie à chaque fois.
   */
  const [derniereCategorie, setDerniereCategorie] = useState<string>('');

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
    const [parametresRes, incotermsRes] = await Promise.all([
      supabase.from(PARAMETRES_IMPORT_TABLE).select('*').eq('id', 1).maybeSingle(),
      supabase.from(PARAMETRES_INCOTERM_TABLE).select('*').order('ordre_affichage'),
    ]);
    setParametres(parametresRes.data as ParametresImport | null);
    setIncoterms((incotermsRes.data as ParametresIncoterm[]) ?? []);
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
        taux_marge_applique: number;
        detail_cout: {
          prix_achat_fcfa: number;
          cout_fret_fcfa: number;
          cout_assurance_fcfa: number;
          cout_revient_fcfa: number;
          prix_unitaire_fcfa: number;
          plancher_applique: boolean;
          incoterm: string;
        };
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
          ...result.detail_cout,
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
        <ParametresMarge parametres={parametres} incoterms={incoterms} onSaved={loadParametres} />

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
                categorieParDefaut={derniereCategorie}
                onCategorieChoisie={setDerniereCategorie}
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
  categorieParDefaut,
  onCategorieChoisie,
  imported,
  resultat,
  onImport,
}: {
  produit: CjResult;
  categories: CategorieGP[];
  categorieParDefaut: string;
  onCategorieChoisie: (id: string) => void;
  imported: boolean;
  resultat: ImportResultat | null;
  onImport: (produit: CjResult, categorieId: string | null) => Promise<void>;
}) {
  const [categorieId, setCategorieId] = useState<string>(categorieParDefaut);
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
              <div className="space-y-1 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
                <Ligne libelle="Prix d'achat" valeur={resultat.prix_achat_fcfa.toLocaleString('fr-FR')} />
                <Ligne
                  libelle={`Fret (${resultat.incoterm})`}
                  valeur={resultat.cout_fret_fcfa.toLocaleString('fr-FR')}
                />
                <Ligne libelle="Assurance" valeur={resultat.cout_assurance_fcfa.toLocaleString('fr-FR')} />
                <Ligne
                  libelle="Coût de revient"
                  valeur={resultat.cout_revient_fcfa.toLocaleString('fr-FR')}
                  fort
                />
                <div className="flex items-center justify-between border-t pt-1">
                  <span className="text-muted-foreground">
                    Prix de vente (marge {Math.round(resultat.taux_marge_applique * 100)} %)
                  </span>
                  <span className="font-semibold text-primary-emphasis">
                    {resultat.prix_unitaire_fcfa.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                {resultat.plancher_applique && (
                  <p className="text-amber-700 dark:text-amber-500">
                    Prix plancher appliqué (la marge seule donnait un prix inférieur au minimum).
                  </p>
                )}
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
                onChange={(e) => {
                  setCategorieId(e.target.value);
                  if (e.target.value) onCategorieChoisie(e.target.value);
                }}
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
  incoterms,
  onSaved,
}: {
  parametres: ParametresImport | null;
  incoterms: ParametresIncoterm[];
  onSaved: () => void;
}) {
  const [champs, setChamps] = useState({
    tauxMargePourcent: '',
    tauxChange: '',
    fretBase: '',
    prixPlancher: '',
    tauxAssurancePourcent: '',
    couverturePourcent: '',
    primeMinimum: '',
    incotermDefaut: 'FOB',
  });
  const [saving, setSaving] = useState(false);
  const [simulationUsd, setSimulationUsd] = useState('10');

  useEffect(() => {
    if (!parametres) return;
    setChamps({
      tauxMargePourcent: String(Math.round(Number(parametres.taux_marge_defaut) * 100)),
      tauxChange: String(Number(parametres.taux_change_usd_fcfa)),
      fretBase: String(Number(parametres.fret_base_article_fcfa)),
      prixPlancher: String(Number(parametres.prix_plancher_fcfa)),
      tauxAssurancePourcent: String(Number(parametres.taux_assurance) * 100),
      couverturePourcent: String(Math.round(Number(parametres.taux_couverture_assurance) * 100)),
      primeMinimum: String(Number(parametres.prime_assurance_minimum_fcfa)),
      incotermDefaut: parametres.incoterm_achat_defaut,
    });
  }, [parametres]);

  const maj = (cle: keyof typeof champs, valeur: string) =>
    setChamps((prev) => ({ ...prev, [cle]: valeur }));

  /** Aperçu en direct : reflète exactement la formule appliquée par le serveur. */
  const simulation = useMemo(() => {
    const incoterm = incoterms.find((i) => i.incoterm === champs.incotermDefaut);
    const prixUsd = parseFloat(simulationUsd);
    if (!incoterm || !Number.isFinite(prixUsd)) return null;
    return calculerCoutImport({
      prixFournisseurUsd: prixUsd,
      parametres: {
        taux_change_usd_fcfa: parseFloat(champs.tauxChange) || 0,
        taux_marge_defaut: (parseFloat(champs.tauxMargePourcent) || 0) / 100,
        fret_base_article_fcfa: parseFloat(champs.fretBase) || 0,
        prix_plancher_fcfa: parseFloat(champs.prixPlancher) || 0,
        taux_assurance: (parseFloat(champs.tauxAssurancePourcent) || 0) / 100,
        taux_couverture_assurance: (parseFloat(champs.couverturePourcent) || 100) / 100,
        prime_assurance_minimum_fcfa: parseFloat(champs.primeMinimum) || 0,
      },
      incoterm: { part_fret: Number(incoterm.part_fret), assurance_a_charge: incoterm.assurance_a_charge },
    });
  }, [champs, incoterms, simulationUsd]);

  const handleSave = async () => {
    const nombres: [string, number, string][] = [
      ['marge', parseFloat(champs.tauxMargePourcent), 'Le taux de marge'],
      ['change', parseFloat(champs.tauxChange), 'Le taux de change'],
      ['fret', parseFloat(champs.fretBase), 'Le fret par article'],
      ['plancher', parseFloat(champs.prixPlancher), 'Le prix plancher'],
      ['assurance', parseFloat(champs.tauxAssurancePourcent), "Le taux d'assurance"],
      ['couverture', parseFloat(champs.couverturePourcent), 'Le taux de couverture'],
      ['prime', parseFloat(champs.primeMinimum), 'La prime minimum'],
    ];
    for (const [, valeur, libelle] of nombres) {
      if (!Number.isFinite(valeur) || valeur < 0) {
        toast.error(`${libelle} doit être un nombre positif.`);
        return;
      }
    }
    if (parseFloat(champs.tauxChange) <= 0) {
      toast.error('Le taux de change doit être strictement positif.');
      return;
    }
    if (parseFloat(champs.couverturePourcent) < 100) {
      toast.error('Le taux de couverture ne peut pas être inférieur à 100 % de la valeur CIF.');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from(PARAMETRES_IMPORT_TABLE)
      .update({
        taux_marge_defaut: parseFloat(champs.tauxMargePourcent) / 100,
        taux_change_usd_fcfa: parseFloat(champs.tauxChange),
        fret_base_article_fcfa: parseFloat(champs.fretBase),
        prix_plancher_fcfa: parseFloat(champs.prixPlancher),
        taux_assurance: parseFloat(champs.tauxAssurancePourcent) / 100,
        taux_couverture_assurance: parseFloat(champs.couverturePourcent) / 100,
        prime_assurance_minimum_fcfa: parseFloat(champs.primeMinimum),
        incoterm_achat_defaut: champs.incotermDefaut,
      })
      .eq('id', 1);
    if (error) {
      toast.error("Impossible d'enregistrer les réglages.");
      setSaving(false);
      return;
    }
    toast.success("Réglages d'import mis à jour.");
    onSaved();
    setSaving(false);
  };

  const fcfa = (v: number) => v.toLocaleString('fr-FR');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <CardTitle>Réglages d'import</CardTitle>
        </div>
        <CardDescription>
          Le prix de vente est calculé automatiquement à chaque import : prix d'achat, fret réparti
          selon l'incoterm, assurance facultés, puis marge et prix plancher.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="taux-marge">Marge appliquée (%)</Label>
            <Input id="taux-marge" type="number" min={0} step={1}
              value={champs.tauxMargePourcent}
              onChange={(e) => maj('tauxMargePourcent', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="taux-change">Taux de change (FCFA / USD)</Label>
            <Input id="taux-change" type="number" min={0} step={1}
              value={champs.tauxChange}
              onChange={(e) => maj('tauxChange', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="incoterm-defaut">Incoterm d'achat par défaut</Label>
            <select
              id="incoterm-defaut"
              value={champs.incotermDefaut}
              onChange={(e) => maj('incotermDefaut', e.target.value)}
              className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              {incoterms.map((i) => (
                <option key={i.incoterm} value={i.incoterm}>{i.incoterm}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-foreground">Fret et prix plancher</p>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fret-base">Fret par article (FCFA)</Label>
              <Input id="fret-base" type="number" min={0} step={100}
                value={champs.fretBase}
                onChange={(e) => maj('fretBase', e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Coût d'acheminement complet d'un article. La part réellement ajoutée dépend de
                l'incoterm (voir tableau ci-dessous).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prix-plancher">Prix de vente plancher (FCFA)</Label>
              <Input id="prix-plancher" type="number" min={0} step={100}
                value={champs.prixPlancher}
                onChange={(e) => maj('prixPlancher', e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Aucun article ne sera mis en vente sous ce prix, même si la marge calculée donne
                un montant inférieur.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-md border p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-foreground">Assurance marchandise (facultés)</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Prime = valeur assurée × taux, avec valeur assurée = valeur CIF × taux de couverture
            (usage international : 110 %). Les marchandises importées en Côte d'Ivoire doivent être
            assurées localement.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="taux-assurance">Taux de prime (%)</Label>
              <Input id="taux-assurance" type="number" min={0} step={0.05}
                value={champs.tauxAssurancePourcent}
                onChange={(e) => maj('tauxAssurancePourcent', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="couverture">Couverture (% de la valeur CIF)</Label>
              <Input id="couverture" type="number" min={100} step={5}
                value={champs.couverturePourcent}
                onChange={(e) => maj('couverturePourcent', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prime-min">Prime minimum (FCFA)</Label>
              <Input id="prime-min" type="number" min={0} step={100}
                value={champs.primeMinimum}
                onChange={(e) => maj('primeMinimum', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="rounded-md border p-3">
          <p className="text-sm font-medium text-foreground">Répartition du fret par incoterm</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Part du fret restant à votre charge selon l'incoterm négocié avec le fournisseur.
          </p>
          <div className="mt-3 divide-y rounded-md border text-xs">
            {incoterms.map((i) => (
              <div key={i.incoterm} className="flex items-center justify-between gap-2 p-2">
                <span className="font-medium text-foreground">{i.incoterm}</span>
                <span className="flex-1 truncate text-muted-foreground">{i.libelle}</span>
                <span className="shrink-0 text-muted-foreground">
                  fret {Math.round(Number(i.part_fret) * 100)} %
                </span>
                <span className={i.assurance_a_charge ? 'shrink-0 text-foreground' : 'shrink-0 text-muted-foreground'}>
                  {i.assurance_a_charge ? 'assurance à notre charge' : 'assuré par le fournisseur'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-foreground">Simulation</p>
            <span className="text-xs text-muted-foreground">produit acheté</span>
            <Input type="number" min={0} step={1} value={simulationUsd}
              onChange={(e) => setSimulationUsd(e.target.value)} className="h-7 w-20 text-xs" />
            <span className="text-xs text-muted-foreground">USD en {champs.incotermDefaut}</span>
          </div>
          {simulation && (
            <div className="mt-3 space-y-1 text-xs">
              <Ligne libelle="Prix d'achat" valeur={fcfa(simulation.prix_achat_fcfa)} />
              <Ligne libelle="Fret à notre charge" valeur={fcfa(simulation.cout_fret_fcfa)} />
              <Ligne libelle="Valeur CIF" valeur={fcfa(simulation.valeur_cif_fcfa)} />
              <Ligne
                libelle={`Assurance (sur ${fcfa(simulation.valeur_assuree_fcfa)} assurés)`}
                valeur={fcfa(simulation.cout_assurance_fcfa)}
              />
              <Ligne libelle="Coût de revient" valeur={fcfa(simulation.cout_revient_fcfa)} fort />
              <Ligne
                libelle={`Prix de vente (marge ${Math.round(simulation.taux_marge_applique * 100)} %)`}
                valeur={fcfa(simulation.prix_unitaire_fcfa)}
                fort
              />
              {simulation.plancher_applique && (
                <p className="pt-1 text-amber-700 dark:text-amber-500">
                  Prix plancher appliqué : la marge seule donnait{' '}
                  {fcfa(simulation.prix_avant_plancher_fcfa)} FCFA, en dessous du minimum fixé.
                </p>
              )}
            </div>
          )}
        </div>

        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enregistrer les réglages
        </Button>
      </CardContent>
    </Card>
  );
}

function Ligne({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{libelle}</span>
      <span className={fort ? 'font-semibold text-foreground' : 'text-foreground'}>{valeur} FCFA</span>
    </div>
  );
}
