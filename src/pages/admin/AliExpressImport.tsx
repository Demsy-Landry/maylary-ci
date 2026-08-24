import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  CATEGORIES_GP_TABLE,
  SECTEURS_TABLE,
  PRODUITS_TABLE,
  type CategorieGP,
  type Secteur,
} from '@/lib/supabase';
import AdminNav from '@/components/AdminNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  ImageOff,
  Loader2,
  PackagePlus,
  Ship,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface ArticleAliExpress {
  reference_externe: string;
  nom: string;
  photo: string | null;
  prix_usd: number | null;
  poids_g: number | null;
  volume_cm3: number | null;
  services_expedition: string[];
  maritime_disponible: boolean;
  service_retenu: string | null;
  canal: 'boutique_ddp' | 'import_requis';
  manques: string[];
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
    throw new Error(json.erreur ?? json.error ?? 'Une erreur est survenue.');
  }
  return json as T;
}

/**
 * Le résultat du test de raccordement.
 *
 * On distingue trois issues, parce qu'elles ne se corrigent pas au même
 * endroit : un secret absent se dépose dans Supabase, une signature refusée est
 * un défaut de notre code, une autorisation refusée vient d'AliExpress.
 */
interface Diagnostic {
  etat: 'ok' | 'secrets' | 'refus';
  message: string;
  manquants?: string[];
  detail?: unknown;
}

export default function AliExpressImport() {
  const [keyword, setKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<ArticleAliExpress[]>([]);
  const [exploitables, setExploitables] = useState(0);
  const [maritime, setMaritime] = useState(0);
  const [categories, setCategories] = useState<CategorieGP[]>([]);
  const [secteurs, setSecteurs] = useState<Secteur[]>([]);
  const [importedRefs, setImportedRefs] = useState<Set<string>>(new Set());
  const [derniereCategorie, setDerniereCategorie] = useState('');
  const [dernierSecteur, setDernierSecteur] = useState('');
  /* Le raccordement se teste AVANT de chercher quoi que ce soit : trois valeurs
     sont nécessaires, et une recherche qui échoue ne dit pas laquelle manque. */
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [testEnCours, setTestEnCours] = useState(false);
  /* Le parcours d'autorisation se fait ICI, et pas au terminal : le code reçu
     n'est valable que trente minutes, et le fondateur travaille au téléphone. */
  const [adresseRetour, setAdresseRetour] = useState('https://maylarygroup.ci/admin/aliexpress');
  const [lienAutorisation, setLienAutorisation] = useState('');
  const [code, setCode] = useState('');
  const [echangeEnCours, setEchangeEnCours] = useState(false);
  const [destination, setDestination] = useState<'grand_public' | 'pro'>('grand_public');

  useEffect(() => {
    const load = async () => {
      const [catRes, secRes] = await Promise.all([
        supabase.from(CATEGORIES_GP_TABLE).select('*').order('ordre_affichage'),
        supabase.from(SECTEURS_TABLE).select('*').eq('actif', true).order('ordre_affichage'),
      ]);
      setCategories((catRes.data as CategorieGP[]) ?? []);
      setSecteurs((secRes.data as Secteur[]) ?? []);
    };
    load();
  }, []);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      const data = await callEdgeFunction<{
        articles: ArticleAliExpress[];
        exploitables: number;
        maritime: number;
      }>('app_e08c374bc4_aliexpress', {
        action: 'rechercher',
        mots_cles: keyword.trim(),
        limite: 24,
      });
      setResults(data.articles ?? []);
      setExploitables(data.exploitables ?? 0);
      setMaritime(data.maritime ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Recherche impossible.');
      setResults([]);
      setExploitables(0);
      setMaritime(0);
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async (article: ArticleAliExpress, rangement: string | null) => {
    if (!rangement) {
      toast.error(
        destination === 'pro'
          ? 'Choisissez un secteur avant d’importer.'
          : 'Choisissez une catégorie avant d’importer.',
      );
      return;
    }

    // Conversion approximative USD → FCFA (le calcul de revient complet
    // utilisera les mêmes paramètres que CJ une fois le pipeline d’import
    // AliExpress branché côté Edge Function).
    const tauxChange = 600;
    const prixFcfa =
      article.prix_usd != null ? Math.round(article.prix_usd * tauxChange * 1.35) : 0;

    try {
      const { error } = await supabase.from(PRODUITS_TABLE).insert({
        nom: article.nom,
        description: `Importé depuis AliExpress (réf. ${article.reference_externe}).`,
        photos: article.photo ? [article.photo] : [],
        prix_unitaire_fcfa: prixFcfa,
        prix_achat_fcfa: article.prix_usd != null ? Math.round(article.prix_usd * tauxChange) : null,
        espace: destination,
        categorie_gp_id: destination === 'grand_public' ? rangement : null,
        enseigne_id: null,
        stock_disponible: 'sur_commande',
        origine: 'import_international',
        quantite_minimum: 1,
        actif: true,
        poids_produit_g: article.poids_g,
        delai_livraison_estime: article.maritime_disponible
          ? '30–45 jours (maritime)'
          : '7–15 jours (express)',
      });

      if (error) throw new Error(error.message);

      setImportedRefs((prev) => new Set(prev).add(article.reference_externe));
      toast.success(
        `« ${article.nom} » importé ${destination === 'pro' ? "dans l'espace pro" : 'dans la boutique'}.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'import.");
    }
  };

  /* Le code d'autorisation revient dans l'adresse. On le ramasse au chargement
     plutôt que de demander à quelqu'un de le recopier depuis la barre du
     navigateur — c'est là que les erreurs de frappe se glissent. */
  useEffect(() => {
    const recu = new URLSearchParams(window.location.search).get('code');
    if (recu) {
      setCode(recu);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const appelerAliExpress = async (corps: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('Session expirée, reconnectez-vous.');
    const res = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_aliexpress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(corps),
    });
    return { res, json: await res.json().catch(() => ({})) };
  };

  const construireLien = async () => {
    try {
      const { res, json } = await appelerAliExpress({
        action: 'lien_autorisation',
        redirect_uri: adresseRetour.trim(),
      });
      if (!res.ok) throw new Error(json.erreur ?? 'Lien impossible à construire.');
      setLienAutorisation(json.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec.');
    }
  };

  const echangerCode = async () => {
    setEchangeEnCours(true);
    try {
      const { res, json } = await appelerAliExpress({ action: 'echanger_code', code: code.trim() });
      if (!res.ok) throw new Error(json.erreur ?? 'Échange refusé.');
      toast.success(
        json.expire_dans_jours
          ? `Compte autorisé. Le jeton vaut ${json.expire_dans_jours} jours et se renouvellera tout seul.`
          : 'Compte autorisé.',
      );
      setCode('');
      setLienAutorisation('');
      await tester();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec.');
    } finally {
      setEchangeEnCours(false);
    }
  };

  const tester = async () => {
    setTestEnCours(true);
    setDiagnostic(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Session expirée, reconnectez-vous.');

      const res = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_aliexpress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'diagnostic' }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok) {
        setDiagnostic({ etat: 'ok', message: 'AliExpress répond et accepte notre signature.', detail: json });
      } else if (Array.isArray(json.secrets_manquants) && json.secrets_manquants.length > 0) {
        setDiagnostic({ etat: 'secrets', message: json.erreur, manquants: json.secrets_manquants });
      } else {
        setDiagnostic({ etat: 'refus', message: json.erreur ?? `Refus (${res.status}).`, detail: json.reponse_brute });
      }
    } catch (err) {
      setDiagnostic({ etat: 'refus', message: err instanceof Error ? err.message : 'Échec du test.' });
    } finally {
      setTestEnCours(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="space-y-2">
            <AdminNav />
            <h1 className="font-display text-lg font-bold text-foreground">
              Admin — Catalogue AliExpress
            </h1>
            <p className="text-sm text-muted-foreground">
              Recherchez des produits et privilégiez ceux qui proposent un acheminement maritime
              (moins cher que l’express).
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        {/* LE RACCORDEMENT SE TESTE D'ABORD.
            Une recherche qui échoue ne dit pas pourquoi : mauvaise clé, jeton
            manquant, signature refusée, tout se ressemble à l'écran. Ce bouton
            appelle une méthode minimale et nomme l'empêchement. */}
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">Raccordement AliExpress</p>
                <p className="text-xs text-muted-foreground">
                  Trois secrets sont nécessaires : la clé et le secret identifient
                  l’application, le jeton autorise le programme dropshipping.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={tester} disabled={testEnCours}>
                {testEnCours ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Tester la connexion
              </Button>
            </div>

            {/* LE PARCOURS D'AUTORISATION, EN DEUX GESTES.
                Le code d'autorisation ne vit que trente minutes et ne sert
                qu'une fois : le faire transiter par un terminal ou par une note
                serait le perdre. Ici on ouvre le lien, on accepte, et le code
                revient dans l'adresse — il est ramassé tout seul. */}
            <details className="rounded-md border bg-muted/30 p-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                Autoriser le compte AliExpress
              </summary>
              <div className="mt-3 space-y-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  À faire une seule fois. Le compte doit d’abord avoir rejoint le programme
                  dropshipping d’AliExpress, sinon l’autorisation est accordée mais les méthodes
                  restent refusées.
                </p>

                <div className="space-y-1.5">
                  <Label htmlFor="retour" className="text-xs">
                    Adresse de retour — la même que celle déclarée sur votre application AliExpress
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id="retour"
                      value={adresseRetour}
                      onChange={(e) => setAdresseRetour(e.target.value)}
                      className="min-w-0 flex-1 font-mono text-xs"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={construireLien}>
                      Construire le lien
                    </Button>
                  </div>
                </div>

                {lienAutorisation && (
                  <a
                    href={lienAutorisation}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-emphasis underline"
                  >
                    Ouvrir l’autorisation AliExpress
                  </a>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="code" className="text-xs">
                    Code d’autorisation — valable trente minutes, une seule fois
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="collé automatiquement au retour"
                      className="min-w-0 flex-1 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={echangerCode}
                      disabled={echangeEnCours || !code.trim()}
                    >
                      {echangeEnCours ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                      Enregistrer
                    </Button>
                  </div>
                </div>
              </div>
            </details>

            {diagnostic && (
              <div
                className={
                  diagnostic.etat === 'ok'
                    ? 'flex gap-2.5 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3'
                    : 'flex gap-2.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-3'
                }
              >
                {diagnostic.etat === 'ok' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                )}
                <div className="min-w-0 text-sm">
                  <p className="leading-relaxed text-foreground">{diagnostic.message}</p>
                  {diagnostic.manquants && (
                    <ul className="mt-2 space-y-1">
                      {diagnostic.manquants.map((m) => (
                        <li key={m} className="font-mono text-xs text-muted-foreground">
                          {m} — à déposer dans Supabase → Edge Functions → Secrets
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Importer vers :</span>
          {([
            ['grand_public', 'Boutique (détail)'],
            ['pro', 'Espace Pro (gros)'],
          ] as const).map(([valeur, libelle]) => (
            <Button
              key={valeur}
              type="button"
              size="sm"
              variant={destination === valeur ? 'default' : 'outline'}
              onClick={() => setDestination(valeur)}
            >
              {libelle}
            </Button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="mt-4 flex max-w-lg gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Rechercher sur AliExpress (ex: chargeur solaire)"
          />
          <Button type="submit" disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="ml-1.5 hidden sm:inline">Rechercher</span>
          </Button>
        </form>

        {!searching && searched && results.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {results.length} résultat{results.length > 1 ? 's' : ''} —{' '}
            <span className="font-medium text-foreground">{exploitables} exploitable{exploitables > 1 ? 's' : ''}</span>{' '}
            (poids + dimensions) —{' '}
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              {maritime} avec maritime
            </span>
          </p>
        )}

        {searching ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72 w-full" />
            ))}
          </div>
        ) : searched && results.length === 0 ? (
          <p className="mt-6 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aucun résultat AliExpress pour « {keyword} ».
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((a) => (
              <ResultCard
                key={a.reference_externe}
                article={a}
                categories={categories}
                secteurs={secteurs}
                categorieParDefaut={derniereCategorie}
                secteurParDefaut={dernierSecteur}
                onCategorieChoisie={setDerniereCategorie}
                onSecteurChoisi={setDernierSecteur}
                imported={importedRefs.has(a.reference_externe)}
                onImport={handleImport}
                destination={destination}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ResultCard({
  article,
  categories,
  secteurs,
  categorieParDefaut,
  secteurParDefaut,
  onCategorieChoisie,
  onSecteurChoisi,
  imported,
  onImport,
  destination,
}: {
  article: ArticleAliExpress;
  categories: CategorieGP[];
  secteurs: Secteur[];
  categorieParDefaut: string;
  secteurParDefaut: string;
  onCategorieChoisie: (id: string) => void;
  onSecteurChoisi: (id: string) => void;
  imported: boolean;
  onImport: (article: ArticleAliExpress, rangement: string | null) => Promise<void>;
  destination: 'grand_public' | 'pro';
}) {
  const [categorieId, setCategorieId] = useState(categorieParDefaut);
  const [secteurId, setSecteurId] = useState(secteurParDefaut);
  const [importing, setImporting] = useState(false);

  const versPro = destination === 'pro';
  const rangement = versPro ? secteurId : categorieId;
  const incomplets = article.manques.length > 0;

  const submit = async () => {
    setImporting(true);
    await onImport(article, rangement || null);
    setImporting(false);
  };

  return (
    <Card className="overflow-hidden py-0">
      {article.photo ? (
        <img src={article.photo} alt={article.nom} className="h-40 w-full object-cover" />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-muted">
          <ImageOff className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <CardContent className="space-y-3 p-4">
        <p className="line-clamp-2 text-sm font-medium text-foreground">{article.nom}</p>

        <div className="flex flex-wrap items-center gap-1.5">
          {article.prix_usd != null && (
            <Badge variant="secondary" className="text-[10px]">
              {article.prix_usd.toFixed(2)} USD
            </Badge>
          )}
          {article.maritime_disponible ? (
            <Badge className="bg-emerald-600 text-[10px] hover:bg-emerald-600">
              <Ship className="mr-1 h-3 w-3" />
              Maritime
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              Express uniquement
            </Badge>
          )}
          {incomplets && (
            <Badge variant="destructive" className="text-[10px]">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {article.manques.join(', ')}
            </Badge>
          )}
          {!incomplets && (
            <Badge variant="secondary" className="text-[10px]">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Complet
            </Badge>
          )}
        </div>

        <div className="space-y-0.5 text-[11px] text-muted-foreground">
          {article.poids_g != null && <p>Poids : {article.poids_g} g</p>}
          {article.volume_cm3 != null && <p>Volume : {article.volume_cm3} cm³</p>}
          {article.service_retenu && <p>Service : {article.service_retenu}</p>}
        </div>

        {imported ? (
          <Badge className="w-full justify-center py-1.5">Déjà importé</Badge>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor={`rangement-${article.reference_externe}`} className="text-xs">
                {versPro ? 'Secteur de l’espace pro *' : 'Catégorie boutique *'}
              </Label>
              <select
                id={`rangement-${article.reference_externe}`}
                value={rangement}
                onChange={(e) => {
                  const v = e.target.value;
                  if (versPro) {
                    setSecteurId(v);
                    if (v) onSecteurChoisi(v);
                  } else {
                    setCategorieId(v);
                    if (v) onCategorieChoisie(v);
                  }
                }}
                className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
              >
                <option value="">{versPro ? 'Choisir un secteur…' : 'Choisir une catégorie…'}</option>
                {(versPro ? secteurs : categories).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nom}
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
