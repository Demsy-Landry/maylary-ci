import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import NavDeclarant from '@/components/NavDeclarant';
import SiteFooter from '@/components/SiteFooter';
import {
  supabase,
  LIQUIDATIONS_TABLE,
  CLASSIFICATIONS_HS_TABLE,
  type LiquidationEnregistree,
  type ClassificationEnregistree,
  type Liquidation,
} from '@/lib/supabase';
import {
  GROUPES_DECLARATION,
  CASES_ARTICLE,
  CASES_INDISPENSABLES,
  articleVide,
  type ValeursDeclaration,
  type ArticleDeclaration,
  type CaseDeclaration,
} from '@/lib/declaration-sydam';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  FileText,
  Printer,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  Calculator,
  AlertTriangle,
  Lock,
  Wand2,
} from 'lucide-react';

/**
 * La déclaration en détail, au modèle SYDAM World.
 *
 * Demande du fondateur : « établir une déclaration en douane doit aussi avoir
 * sa propre page avec tous les champs (modèle SYDAM World), imprimable ou
 * disponible en PDF lorsque tout est prêt ».
 *
 * DEUX PARTIS PRIS QUI TIENNENT TOUTE LA PAGE
 *
 * **Les cases portent leur numéro, à l'écran comme sur le papier.** Un
 * déclarant qui prépare un document et le ressaisit ensuite dans SYDAM World
 * travaille par numéro de case, pas par libellé. Sans les numéros, le document
 * est joli et inutilisable.
 *
 * **On ne bloque pas la saisie sur ce qui manque.** Personne ne remplit une
 * déclaration dans l'ordre : on note ce qu'on sait, on appelle le
 * transitaire, on complète. Un formulaire qui refuse d'avancer fait
 * abandonner. Les manques sont comptés et rappelés au moment de l'impression —
 * c'est là qu'ils coûtent.
 *
 * CE QUE LE DOCUMENT PRODUIT N'EST PAS
 *
 * Une déclaration déposable. Le dépôt se fait dans SYDAM World sous la
 * signature d'un commissionnaire agréé. Ce qui sort d'ici est un brouillon de
 * déclaration — à relire, à joindre au dossier, à ressaisir. La mention est
 * portée sur le document, pas seulement à l'écran : un papier qui ressemble à
 * une déclaration officielle sans en être une est un risque.
 */

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export default function DeclarantDeclaration() {
  const { user } = useAuth();
  const emplacement = useLocation();

  const [valeurs, setValeurs] = useState<ValeursDeclaration>({
    type_declaration: 'IM',
    regime: '4000',
    pays_destination: "Côte d'Ivoire",
    taux_change: '655,957 (euro, taux légal fixe)',
  });
  const [articles, setArticles] = useState<ArticleDeclaration[]>([articleVide(1)]);
  const [impression, setImpression] = useState(false);

  /* Les archives du compte, pour reprendre un travail déjà fait plutôt que de
   * le refaire. C'est la demande explicite du fondateur : « au lieu de tout
   * recommencer ». */
  const [liquidations, setLiquidations] = useState<LiquidationEnregistree[]>([]);
  const [classifications, setClassifications] = useState<ClassificationEnregistree[]>([]);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from(LIQUIDATIONS_TABLE)
      .select('*')
      .order('cree_le', { ascending: false })
      .limit(10)
      .then(({ data }) => setLiquidations((data as LiquidationEnregistree[]) ?? []));
    void supabase
      .from(CLASSIFICATIONS_HS_TABLE)
      .select('id, description, code_propose, designation_tec, verifie_en_base, taux_dd, cree_le')
      .order('cree_le', { ascending: false })
      .limit(10)
      .then(({ data }) => setClassifications((data as ClassificationEnregistree[]) ?? []));
  }, [user]);

  /* Arrivée depuis la page de classification : on pose le code sur le premier
   * article sans rien demander. C'est tout l'intérêt du passage direct. */
  useEffect(() => {
    const etat = emplacement.state as {
      classification?: { code: string | null; designation: string | null };
    } | null;
    const c = etat?.classification;
    if (!c?.code) return;
    setArticles((a) => {
      const suite = [...a];
      suite[0] = { ...suite[0], position: c.code ?? '', designation: c.designation ?? '' };
      return suite;
    });
    toast.success(`Position ${c.code} reprise depuis la classification.`);
  }, [emplacement.state]);

  const maj = (cle: string, v: string) => setValeurs((x) => ({ ...x, [cle]: v }));
  const majArticle = (i: number, cle: keyof ArticleDeclaration, v: string) =>
    setArticles((a) => a.map((x, j) => (j === i ? { ...x, [cle]: v } : x)));

  /** Reprendre une liquidation archivée : elle porte déjà les lignes, la CAF et
   *  les masses. Tout ce qui est recopié ici a été calculé, pas ressaisi. */
  const reprendreLiquidation = (l: LiquidationEnregistree) => {
    const r = l.resultat as unknown as Liquidation;
    setValeurs((v) => ({
      ...v,
      regime: l.regime,
      numero_reference: l.numero,
      valeur_statistique: String(Math.round(l.caf_fcfa ?? 0)),
      elements_valeur: `Fret ${fcfa(l.fret_fcfa)} · Assurance ${fcfa(l.assurance_fcfa)}`,
      nombre_articles: String(l.nombre_lignes ?? 0),
      masse_brute: r?.globaux?.poids_brut_total_kg ? String(r.globaux.poids_brut_total_kg) : (v.masse_brute ?? ''),
    }));
    if (Array.isArray(r?.lignes) && r.lignes.length > 0) {
      setArticles(
        r.lignes.map((ligne, i) => ({
          ...articleVide(i + 1),
          numero: ligne.numero ?? String(i + 1),
          designation: ligne.designation ?? '',
          position: ligne.position ?? '',
          masse_brute: ligne.poids_brut_kg ? String(ligne.poids_brut_kg) : '',
          prix_article: ligne.fob_fcfa ? String(Math.round(ligne.fob_fcfa)) : '',
        })),
      );
    }
    toast.success(`Liquidation ${l.numero} reprise.`);
  };

  const reprendreClassification = (c: ClassificationEnregistree) => {
    setArticles((a) => {
      const suite = [...a];
      const vide = suite.findIndex((x) => !x.position && !x.designation);
      const cible = vide >= 0 ? vide : suite.length;
      const base = vide >= 0 ? suite[cible] : articleVide(suite.length + 1);
      suite[cible] = {
        ...base,
        position: c.code_propose ?? '',
        designation: c.designation_tec ?? c.description,
      };
      return suite;
    });
    toast.success(`Position ${c.code_propose ?? ''} reprise.`);
  };

  const manquants = useMemo(
    () => CASES_INDISPENSABLES.filter((c) => !valeurs[c]?.trim()),
    [valeurs],
  );

  const imprimer = async () => {
    setImpression(true);
    try {
      const { telechargerDeclarationPdf } = await import('@/lib/declaration-pdf');
      telechargerDeclarationPdf(valeurs, articles);
      toast.success('Brouillon de déclaration téléchargé.');
    } catch {
      toast.error("Le document n'a pas pu être produit.");
    } finally {
      setImpression(false);
    }
  };

  const champ = (c: CaseDeclaration) => (
    <div key={c.cle} className={c.type === 'long' ? 'sm:col-span-2' : ''}>
      <Label htmlFor={c.cle} className="flex items-baseline gap-1.5 text-xs">
        <span className="font-display font-bold tabular-nums text-primary">{c.numero}</span>
        <span>{c.libelle}</span>
        {c.auto && (
          <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[0.65rem]">
            auto
          </Badge>
        )}
      </Label>
      {c.type === 'long' ? (
        <Textarea
          id={c.cle}
          rows={2}
          value={valeurs[c.cle] ?? ''}
          onChange={(e) => maj(c.cle, e.target.value)}
        />
      ) : (
        <Input
          id={c.cle}
          inputMode={c.type === 'nombre' ? 'numeric' : undefined}
          value={valeurs[c.cle] ?? ''}
          onChange={(e) => maj(c.cle, e.target.value)}
          className={c.type === 'nombre' ? 'tabular-nums' : undefined}
        />
      )}
      {c.aide && <p className="mt-0.5 text-xs text-muted-foreground">{c.aide}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <NavDeclarant />

      <main className="entree-page mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          <FileText className="h-4 w-4" />
          Déclaration en détail — modèle SYDAM World
        </p>
        <h1 className="trait-anime mt-3 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Préparer la déclaration
        </h1>
        <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
          Les cases portent leur numéro du modèle, à l’écran comme sur le document imprimé : c’est
          par ces numéros qu’on ressaisit dans SYDAM World. Ce qui vient d’une classification ou
          d’une liquidation est repris tel quel — vous ne ressaisissez rien.
        </p>

        {!user ? (
          <div className="mt-8 rounded-xl border border-dashed p-10 text-center">
            <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Connectez-vous pour préparer une déclaration et reprendre vos classifications.
            </p>
            <Button asChild className="bouton-anime mt-5">
              <Link to="/boutique/compte?retour=/declarant/declaration">Se connecter</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Reprendre plutôt que ressaisir. */}
            {(liquidations.length > 0 || classifications.length > 0) && (
              <section className="carte-reactive mt-7 rounded-xl border bg-muted/30 p-5" data-revele>
                <h2 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                  <Wand2 className="h-4 w-4 text-primary" />
                  Reprendre un travail déjà fait
                </h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {liquidations.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <Calculator className="h-3.5 w-3.5" />
                        Liquidations
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {liquidations.slice(0, 5).map((l) => (
                          <Button
                            key={l.id}
                            size="sm"
                            variant="outline"
                            onClick={() => reprendreLiquidation(l)}
                          >
                            {l.numero}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {classifications.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5" />
                        Classifications
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {classifications
                          .filter((c) => c.code_propose)
                          .slice(0, 5)
                          .map((c) => (
                            <Button
                              key={c.id}
                              size="sm"
                              variant="outline"
                              onClick={() => reprendreClassification(c)}
                              title={c.description}
                            >
                              {c.code_propose}
                            </Button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Les cases, par groupe. */}
            <div className="mt-7 space-y-5">
              {GROUPES_DECLARATION.map((g) => (
                <section key={g.titre} className="rounded-xl border bg-card p-5" data-revele>
                  <h2 className="font-display text-base font-bold text-foreground">{g.titre}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{g.description}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">{g.cases.map(champ)}</div>
                </section>
              ))}
            </div>

            {/* Le détail des articles. */}
            <section className="mt-5 rounded-xl border bg-card p-5" data-revele>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">
                    Détail des articles
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Une ligne par position tarifaire. Cases 31 à 42 du modèle.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="bouton-anime"
                  onClick={() => setArticles((a) => [...a, articleVide(a.length + 1)])}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Ajouter un article
                </Button>
              </div>

              <div className="mt-4 space-y-4">
                {articles.map((a, i) => (
                  <div key={i} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-sm font-bold text-foreground">
                        Article {a.numero}
                      </p>
                      {articles.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/5"
                          onClick={() => setArticles((x) => x.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Retirer</span>
                        </Button>
                      )}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {CASES_ARTICLE.filter((c) => c.cle !== 'numero').map((c) => (
                        <div key={c.cle} className={c.type === 'long' ? 'sm:col-span-2' : ''}>
                          <Label htmlFor={`${c.cle}-${i}`} className="flex items-baseline gap-1.5 text-xs">
                            <span className="font-display font-bold tabular-nums text-primary">
                              {c.numero}
                            </span>
                            <span>{c.libelle}</span>
                          </Label>
                          {c.type === 'long' ? (
                            <Textarea
                              id={`${c.cle}-${i}`}
                              rows={2}
                              value={a[c.cle as keyof ArticleDeclaration]}
                              onChange={(e) =>
                                majArticle(i, c.cle as keyof ArticleDeclaration, e.target.value)
                              }
                            />
                          ) : (
                            <Input
                              id={`${c.cle}-${i}`}
                              inputMode={c.type === 'nombre' ? 'numeric' : undefined}
                              value={a[c.cle as keyof ArticleDeclaration]}
                              onChange={(e) =>
                                majArticle(i, c.cle as keyof ArticleDeclaration, e.target.value)
                              }
                              className={c.type === 'nombre' ? 'tabular-nums' : undefined}
                            />
                          )}
                          {c.aide && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{c.aide}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* L'impression, et ce qui manque avant. */}
            <section className="mt-6 rounded-xl border bg-card p-5" data-revele>
              {manquants.length > 0 && (
                <div className="mb-4 flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-50/40 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="text-sm leading-relaxed text-muted-foreground">
                    <p className="font-semibold text-foreground">
                      {manquants.length} case{manquants.length > 1 ? 's' : ''} indispensable
                      {manquants.length > 1 ? 's' : ''} encore vide
                      {manquants.length > 1 ? 's' : ''}
                    </p>
                    <p className="mt-1">
                      Vous pouvez imprimer quand même — un brouillon incomplet se complète au
                      téléphone. Mais ces cases-là bloqueront la saisie dans SYDAM World.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" className="bouton-anime" onClick={() => void imprimer()} disabled={impression}>
                  {impression ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="mr-2 h-4 w-4" />
                  )}
                  Télécharger le brouillon (PDF)
                </Button>
                <Button asChild variant="outline" size="lg" className="bouton-anime">
                  <Link to="/declarant/classer">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Classer une autre marchandise
                  </Link>
                </Button>
              </div>

              <p className="mt-4 rounded-md border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">
                  Brouillon de déclaration — ne vaut pas dépôt.
                </strong>{' '}
                Le dépôt se fait dans SYDAM World, sous la signature d’un commissionnaire en douane
                agréé. Ce document sert à préparer le dossier, à le faire relire, et à servir de
                bordereau de saisie. Il ne remplace pas la déclaration officielle.
              </p>
            </section>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
