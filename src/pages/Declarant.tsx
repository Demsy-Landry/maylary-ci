import { useEffect, useMemo, useState } from 'react';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import AlerteMarchandiseReglementee from '@/components/AlerteMarchandiseReglementee';
import SiteFooter from '@/components/SiteFooter';
import { Link } from 'react-router-dom';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  REGIMES_DOUANIERS_TABLE,
  CLASSIFICATIONS_HS_TABLE,
  type PositionTec,
  type VerificationTec,
  type RegimeDouanier,
  type Liquidation,
  type ClassificationHs,
  type ClassificationEnregistree,
  type QuotaClassification,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Calculator,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  ShieldCheck,
  Printer,
  ChevronDown,
  Sparkles,
  HelpCircle,
  BookOpen,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  telechargerBulletinPdf,
  referenceSimulation,
  enTeteVide,
  type EnTeteBulletin,
} from '@/lib/bulletin-pdf';

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const pct = (n: number) => `${(n * 100).toFixed(n * 100 % 1 === 0 ? 0 : 1)} %`;

interface LigneSaisie {
  cle: number;
  numero: string;
  designation: string;
  position: string;
  taux_dd: string;
  fob: string;
  poids_brut: string;
}

/**
 * Les régimes se groupent par sens d'opération.
 *
 * Depuis que l'exportation se liquide, une liste unique mélangerait une mise à
 * la consommation et une réexportation, qui n'ont ni le même formulaire ni le
 * même montant. L'ordre est celui de l'usage : on importe plus souvent qu'on
 * n'exporte, et on place rarement sous transit.
 */
const GROUPES_REGIME = [
  { sens: 'import', libelle: 'Importation' },
  { sens: 'export', libelle: 'Exportation' },
  { sens: 'transit', libelle: 'Transit' },
  { sens: 'special', libelle: 'Régimes particuliers' },
] as const;

const ligneVide = (numero: string): LigneSaisie => ({
  cle: Date.now() + Math.random(),
  numero,
  designation: '',
  position: '',
  taux_dd: '',
  fob: '',
  poids_brut: '',
});

/**
 * Le Déclarant — recherche de position tarifaire et liquidation.
 *
 * Reconstruction dans MayLary Group de l'outil qui vivait sur `le-declarant.com`.
 * Deux règles gouvernent cet écran, et elles ne se négocient pas :
 *
 *  1. **Aucun taux qui ne vienne du corpus officiel.** Si un code n'est pas
 *     dans la base TEC, on ne montre rien — pas même une estimation. Un chiffre
 *     affiché devient un chiffre sur lequel quelqu'un s'engage, et une erreur
 *     de classement coûte un redressement au client.
 *  2. **Ce n'est pas une déclaration.** La mention le dit, en clair, en bas de
 *     chaque résultat. Un outil d'aide au calcul qu'on prendrait pour un
 *     document officiel ferait plus de mal que de bien.
 *
 * La page est publique : un transitaire qui vient vérifier un taux est
 * exactement le visiteur qu'on veut.
 */
export default function Declarant() {
  const [onglet, setOnglet] = useState<'position' | 'classer' | 'liquidation'>('position');

  /* ---- Recherche de position ---- */
  const [requete, setRequete] = useState('');
  const [resultats, setResultats] = useState<PositionTec[] | null>(null);
  const [verification, setVerification] = useState<VerificationTec | null>(null);
  const [cherche, setCherche] = useState(false);

  /* ---- Classification assistée ----
   * Le modèle propose un code ; le corpus TEC le confirme ou le refuse. Les
   * deux moments restent distincts à l'écran, parce qu'ils n'engagent pas la
   * même chose : la proposition est un avis, la vérification est un fait. */
  const [marchandise, setMarchandise] = useState('');
  const [classification, setClassification] = useState<ClassificationHs | null>(null);
  const [classe, setClasse] = useState(false);
  const [quota, setQuota] = useState<QuotaClassification | null>(null);
  const [historique, setHistorique] = useState<ClassificationEnregistree[] | null>(null);

  /* ---- Liquidation ---- */
  const [regimes, setRegimes] = useState<RegimeDouanier[]>([]);
  const [regime, setRegime] = useState('4000');
  const [fret, setFret] = useState('');
  const [assurance, setAssurance] = useState('');
  const [lignes, setLignes] = useState<LigneSaisie[]>([ligneVide('1')]);
  const [liquidation, setLiquidation] = useState<Liquidation | null>(null);
  const [calcul, setCalcul] = useState(false);

  /* ---- En-tête du document imprimable ----
   * Rien ici n'entre dans le calcul : ces champs habillent le bulletin pour
   * qu'il soit remettable à un client et classable au dossier. Repliés par
   * défaut, pour que quelqu'un venu vérifier un taux n'ait pas dix cases à
   * ignorer avant d'arriver au bouton. */
  const [entete, setEntete] = useState<EnTeteBulletin>(enTeteVide);
  const [enteteOuvert, setEnteteOuvert] = useState(false);

  const majEntete = (champ: keyof EnTeteBulletin, valeur: string) =>
    setEntete((e) => ({ ...e, [champ]: valeur }));

  const imprimer = () => {
    if (!liquidation) return;
    const reference = entete.reference || referenceSimulation();
    if (!entete.reference) setEntete((e) => ({ ...e, reference }));
    telechargerBulletinPdf(liquidation, { ...entete, reference });
  };

  useEffect(() => {
    supabase
      .from(REGIMES_DOUANIERS_TABLE)
      .select('*')
      .order('ordre')
      .then(({ data }) => setRegimes((data as RegimeDouanier[]) ?? []));
  }, []);

  const regimeChoisi = useMemo(
    () => regimes.find((r) => r.code === regime) ?? null,
    [regimes, regime],
  );

  /* Quota et historique se lisent ensemble : l'un dit ce qu'il reste, l'autre
   * ce qui a déjà été demandé. Les deux dépendent du compte connecté, donc on
   * les relit à chaque passage sur l'onglet plutôt qu'une fois au montage. */
  const chargerClassifications = async () => {
    const { data: q } = await supabase.rpc('app_e08c374bc4_quota_classification');
    const quotaLu = q as QuotaClassification | null;
    setQuota(quotaLu);
    if (!quotaLu?.connecte) {
      setHistorique(null);
      return;
    }
    const { data } = await supabase
      .from(CLASSIFICATIONS_HS_TABLE)
      .select('id, description, code_propose, designation_tec, verifie_en_base, taux_dd, cree_le')
      .order('cree_le', { ascending: false })
      .limit(20);
    setHistorique((data as ClassificationEnregistree[]) ?? []);
  };

  useEffect(() => {
    if (onglet === 'classer') void chargerClassifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet]);

  const classer = async () => {
    const texte = marchandise.trim();
    if (texte.length < 3) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error('Connectez-vous pour utiliser la classification assistée.');
      return;
    }

    setClasse(true);
    setClassification(null);
    try {
      const reponse = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_classification_hs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ description: texte }),
      });
      const corps = await reponse.json();
      if (!reponse.ok) {
        toast.error(corps?.erreur ?? "La classification n'a pas abouti.");
        return;
      }
      setClassification(corps as ClassificationHs);
      void chargerClassifications();
    } catch {
      toast.error('Le service est injoignable. Vérifiez votre connexion.');
    } finally {
      setClasse(false);
    }
  };

  const chercher = async () => {
    const texte = requete.trim();
    if (texte.length < 2) return;
    setCherche(true);
    setVerification(null);

    // Une saisie qui ressemble à un code complet passe par la vérification :
    // c'est elle qui porte la règle du « non trouvé, donc aucun taux ».
    const chiffres = texte.replace(/\D/g, '');
    if (chiffres.length === 10) {
      const { data, error } = await supabase.rpc('app_e08c374bc4_tec_verifier', { p_code: texte });
      setCherche(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setVerification(data as VerificationTec);
      setResultats(null);
      return;
    }

    const { data, error } = await supabase.rpc('app_e08c374bc4_tec_chercher', {
      p_texte: texte,
      p_limite: 20,
    });
    setCherche(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResultats((data as PositionTec[]) ?? []);
  };

  // On ne recopie que le code, jamais le taux : un taux figé au moment du clic
  // survivrait à une correction du corpus sans que rien ne le signale. La
  // liquidation le relit elle-même dans le TEC.
  const reprendre = (code: string, designation: string) => {
    setLignes((l) => {
      const suite = [...l];
      const vide = suite.findIndex((x) => !x.position && !x.designation);
      const cible = vide >= 0 ? vide : suite.length;
      const base = vide >= 0 ? suite[cible] : ligneVide(String(suite.length + 1));
      suite[cible] = {
        ...base,
        position: code,
        designation: designation.slice(0, 120),
        taux_dd: '',
      };
      return suite;
    });
    setOnglet('liquidation');
    toast.success(`Position ${code} reprise dans le simulateur.`);
  };

  const liquider = async () => {
    const utiles = lignes.filter((l) => Number(l.fob) > 0);
    if (utiles.length === 0) {
      toast.error('Renseignez au moins une ligne avec une valeur FOB.');
      return;
    }
    setCalcul(true);
    const { data, error } = await supabase.rpc('app_e08c374bc4_liquider_declaration', {
      p_lignes: utiles.map((l) => ({
        numero: l.numero,
        designation: l.designation || null,
        position: l.position || null,
        taux_dd: l.taux_dd ? Number(l.taux_dd) : null,
        fob: Number(l.fob),
        poids_brut: Number(l.poids_brut) || 0,
      })),
      p_fret_total: Number(fret) || 0,
      p_assurance_total: Number(assurance) || 0,
      p_poids_brut_total: null,
      p_regime: regime,
    });
    setCalcul(false);
    if (error) {
      toast.error(error.message);
      setLiquidation(null);
      return;
    }
    setLiquidation(data as Liquidation);
  };

  const majLigne = (cle: number, champ: keyof LigneSaisie, valeur: string) =>
    setLignes((l) => l.map((x) => (x.cle === cle ? { ...x, [champ]: valeur } : x)));

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />

      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-extrabold text-foreground">Le Déclarant</h1>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              Trouvez la position tarifaire d'une marchandise et calculez les droits et taxes dus
              en Côte d'Ivoire, à l'importation comme à l'exportation. Les taux viennent du{' '}
              <strong className="text-foreground">TEC UEMOA officiel</strong> — 6 298 codes, aucun
              taux estimé.
            </p>
          </div>
        </div>

        {/* Onglets : deux outils distincts, qui se passent la main. */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            variant={onglet === 'position' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnglet('position')}
          >
            <Search className="mr-1.5 h-4 w-4" />
            Position tarifaire
          </Button>
          <Button
            variant={onglet === 'classer' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnglet('classer')}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            Classer une marchandise
          </Button>
          <Button
            variant={onglet === 'liquidation' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnglet('liquidation')}
          >
            <Calculator className="mr-1.5 h-4 w-4" />
            Droits et taxes
          </Button>
        </div>

        {/* ================= RECHERCHE DE POSITION ================= */}
        {onglet === 'position' && (
          <section className="mt-6 space-y-4">
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                chercher();
              }}
            >
              <Input
                className="min-w-0 flex-1"
                value={requete}
                onChange={(e) => setRequete(e.target.value)}
                placeholder="Décrivez la marchandise, ou saisissez un code (ex. groupe électrogène, 8502, 8471.30.00.00)"
              />
              <Button type="submit" disabled={cherche || requete.trim().length < 2}>
                {cherche ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}
                Chercher
              </Button>
            </form>

            {/* Vérification d'un code complet : c'est ici que vit la règle. */}
            {verification && (
              <div
                className={`rounded-md border p-4 ${
                  verification.trouve ? 'border-primary/40 bg-primary/5' : 'border-destructive/40 bg-destructive/5'
                }`}
              >
                {verification.trouve ? (
                  <>
                    <p className="flex items-center gap-2 font-display font-bold text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {verification.code_hs}
                    </p>
                    <p className="mt-1 text-sm text-foreground">{verification.designation}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                      <dt className="text-muted-foreground">Droit de douane</dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {verification.taux_dd_pourcent} %
                      </dd>
                      <dt className="text-muted-foreground">Catégorie TEC</dt>
                      <dd className="tabular-nums text-foreground">C{verification.categorie}</dd>
                      <dt className="text-muted-foreground">Unité statistique</dt>
                      <dd className="text-foreground">{verification.unite_us ?? '—'}</dd>
                      <dt className="text-muted-foreground">TVA</dt>
                      <dd className="tabular-nums text-foreground">18 %</dd>
                    </dl>
                    <p className="mt-3 text-xs text-muted-foreground">{verification.mention}</p>
                    {verification.statut === 'a_verifier' && (
                      <p className="mt-1 text-xs font-medium text-destructive">
                        Ligne signalée « à vérifier » : l'unité ou la désignation de la source était
                        ambiguë.
                      </p>
                    )}
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        reprendre(verification.code_hs!, verification.designation!)
                      }
                    >
                      Utiliser dans le calcul
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="flex items-center gap-2 font-display font-bold text-foreground">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Code non confirmé — aucun taux affiché
                    </p>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {verification.mention_utilisateur}
                    </p>
                    {verification.designation_proche && (
                      <p className="mt-2 rounded border border-dashed p-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {verification.code_proche_indicatif}
                        </span>{' '}
                        — {verification.designation_proche}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {resultats && (
              <div className="overflow-x-auto rounded-md border">
                {resultats.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Aucune position ne correspond. Essayez d'autres mots, ou décrivez la matière et
                    l'usage de l'article.
                  </p>
                ) : (
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Code</th>
                        <th className="px-3 py-2">Désignation</th>
                        <th className="px-3 py-2 text-right">DD</th>
                        <th className="px-3 py-2">US</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {resultats.map((r) => (
                        <tr key={r.code_hs} className="align-top">
                          <td className="whitespace-nowrap px-3 py-2 font-medium tabular-nums text-foreground">
                            {r.code_hs}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {r.designation.length > 160
                              ? `${r.designation.slice(0, 160)}…`
                              : r.designation}
                            {r.statut === 'a_verifier' && (
                              <Badge variant="secondary" className="ml-2">à vérifier</Badge>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                            {r.taux_dd} %
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                            {r.unite_us ?? '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reprendre(r.code_hs, r.designation)}
                            >
                              Utiliser
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
        )}

        {/* ================= CLASSIFICATION ASSISTÉE ================= */}
        {onglet === 'classer' && (
          <section className="mt-6 space-y-4">
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-sm text-foreground">
                Décrivez la marchandise comme vous la décririez à un collègue : la matière, la
                fonction, l'usage. L'assistant propose une position et le raisonnement qui la
                soutient — <strong>puis le code proposé est confronté au TEC officiel</strong>. Le
                taux ne vient jamais de l'assistant : il vient du corpus, ou il n'est pas affiché.
              </p>
            </div>

            {quota && !quota.connecte && (
              <div className="rounded-md border border-primary/40 bg-primary/5 p-4">
                <p className="text-sm font-medium text-foreground">
                  Connectez-vous pour utiliser la classification assistée.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  L'outil reste gratuit. Le compte sert seulement à tenir le quota de{' '}
                  {quota.plafond} classifications par jour et à garder votre historique.
                </p>
                <Button asChild size="sm" className="mt-3">
                  <Link to="/boutique/compte?retour=/declarant">Se connecter</Link>
                </Button>
              </div>
            )}

            {quota?.connecte && !quota.actif && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-foreground">
                La classification assistée est momentanément désactivée. La recherche par mots-clés
                et le calcul des droits restent disponibles.
              </div>
            )}

            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                classer();
              }}
            >
              <Label htmlFor="marchandise">Description de la marchandise</Label>
              <Textarea
                id="marchandise"
                rows={3}
                value={marchandise}
                maxLength={2000}
                onChange={(e) => setMarchandise(e.target.value)}
                placeholder="Ex. : groupe électrogène diesel insonorisé 15 kVA, triphasé, sur châssis avec réservoir"
                disabled={quota?.connecte === false}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {quota?.connecte
                    ? `${quota.restant} classification${quota.restant > 1 ? 's' : ''} restante${
                        quota.restant > 1 ? 's' : ''
                      } aujourd'hui sur ${quota.plafond}.`
                    : 'Matière, fonction et usage : ce sont eux qui décident du classement.'}
                </p>
                <Button
                  type="submit"
                  disabled={classe || marchandise.trim().length < 3 || quota?.connecte === false}
                >
                  {classe ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-4 w-4" />
                  )}
                  Classer
                </Button>
              </div>
            </form>

            {/* Avant le classement, avant le calcul : savoir si la marchandise
                peut seulement entrer. Une position tarifaire juste sur une
                marchandise qu'on n'a pas le droit d'importer ne sert à rien. */}
            <AlerteMarchandiseReglementee
              designation={marchandise}
              codeSh={classification?.code_propose ?? null}
              className="space-y-2"
            />

            {classification && (
              <article className="space-y-4 rounded-md border p-4">
                {/* Le résultat du corpus d'abord : c'est le seul fait de la page. */}
                {classification.verifie_en_base ? (
                  <div className="rounded-md border border-primary/40 bg-primary/5 p-4">
                    <p className="flex flex-wrap items-center gap-2 font-display text-lg font-extrabold text-foreground">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                      <span className="tabular-nums">{classification.code_propose}</span>
                      <Badge variant="secondary">Vérifié au TEC</Badge>
                    </p>
                    <p className="mt-2 text-sm text-foreground">{classification.designation_tec}</p>
                    <dl className="mt-3 grid max-w-lg grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                      <dt className="text-muted-foreground">Droit de douane</dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {classification.taux_dd} %
                      </dd>
                      <dt className="text-muted-foreground">Unité statistique</dt>
                      <dd className="text-foreground">{classification.unite_us ?? '—'}</dd>
                    </dl>
                    <p className="mt-3 text-xs text-muted-foreground">{classification.mention}</p>
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        reprendre(
                          classification.code_propose!,
                          classification.designation_tec ?? classification.description,
                        )
                      }
                    >
                      Utiliser dans le calcul
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
                    <p className="flex items-center gap-2 font-display font-bold text-foreground">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                      {classification.code_propose
                        ? `${classification.code_propose} — non confirmé, aucun taux affiché`
                        : 'Aucun code proposé — description insuffisante'}
                    </p>
                    {/* Sans code proposé, la mention du corpus parlerait d'« un
                        code non confirmé » qui n'a jamais existé. */}
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {classification.code_propose
                        ? classification.mention
                        : "L'assistant n'a pas pu trancher à partir de cette description. Précisez la matière, la fonction et l'usage de l'article, puis relancez."}
                    </p>
                    {classification.code_proche_indicatif && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Code voisin au corpus, à titre indicatif :{' '}
                        <span className="font-medium text-foreground">
                          {classification.code_proche_indicatif}
                        </span>
                      </p>
                    )}
                  </div>
                )}

                {classification.question && (
                  <div className="rounded-md border border-dashed p-3">
                    <p className="flex items-start gap-2 text-sm text-foreground">
                      <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>{classification.question}</span>
                    </p>
                  </div>
                )}

                {/* Ensuite l'avis du modèle, présenté comme tel. */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ['Section', classification.section],
                      ['Chapitre', classification.chapitre],
                      ['Position', classification.position_sh],
                      ['Sous-position', classification.sous_position],
                    ] as [string, string | null][]
                  )
                    .filter(([, valeur]) => Boolean(valeur))
                    .map(([libelle, valeur]) => (
                      <div key={libelle}>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {libelle}
                        </p>
                        <p className="text-sm text-foreground">{valeur}</p>
                      </div>
                    ))}
                </div>

                {classification.caracteristiques && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Caractéristiques retenues
                    </p>
                    <p className="mt-0.5 text-sm text-foreground">
                      {classification.caracteristiques}
                    </p>
                  </div>
                )}

                {classification.raisonnement_rgi && (
                  <div>
                    <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                      <BookOpen className="h-3.5 w-3.5" />
                      Règles générales interprétatives appliquées
                    </p>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-foreground">
                      {classification.raisonnement_rgi}
                    </p>
                  </div>
                )}

                {classification.notes_declarant && (
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      À vérifier au dossier
                    </p>
                    <p className="mt-0.5 text-sm text-foreground">
                      {classification.notes_declarant}
                    </p>
                  </div>
                )}

                <p className="border-t pt-3 text-xs text-muted-foreground">
                  Proposition établie par un modèle de langage ({classification.modele}) et
                  confrontée au corpus TEC. La classification tarifaire engage le déclarant :
                  contrôlez la position avant dépôt, et sollicitez un renseignement tarifaire
                  contraignant auprès de la Direction générale des douanes en cas de doute.
                </p>
              </article>
            )}

            {historique && historique.length > 0 && (
              <div className="rounded-md border">
                <p className="flex items-center gap-1.5 border-b px-3 py-2 text-sm font-medium text-foreground">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Vos dernières classifications
                </p>
                <ul className="divide-y">
                  {historique.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm">
                      <span className="whitespace-nowrap font-medium tabular-nums text-foreground">
                        {h.code_propose ?? '—'}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {h.description}
                      </span>
                      {h.verifie_en_base ? (
                        <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
                          {h.taux_dd} %
                        </span>
                      ) : (
                        <Badge variant="secondary">non confirmé</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* ================= LIQUIDATION ================= */}
        {onglet === 'liquidation' && (
          <section className="mt-6 space-y-4">
            {/* En-tête du document : facultatif, replié par défaut. */}
            <div className="rounded-md border">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                onClick={() => setEnteteOuvert((o) => !o)}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    En-tête du document
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Importateur, fournisseur, connaissement… N'entre pas dans le calcul, sert au
                    bulletin imprimable.
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    enteteOuvert ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {enteteOuvert && (
                <div className="grid gap-3 border-t p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(
                    [
                      ['importateur', 'Importateur / Déclarant'],
                      ['code_importateur', 'Code importateur'],
                      ['rccm_ncc', 'RCCM / NCC'],
                      ['bureau', 'Bureau de douane'],
                      ['fournisseur', 'Fournisseur'],
                      ['pays_origine', "Pays d'origine"],
                      ['mode_transport', 'Mode de transport'],
                      ['connaissement', 'N° connaissement / LTA'],
                      ['facture', 'N° facture'],
                    ] as [keyof EnTeteBulletin, string][]
                  ).map(([champ, libelle]) => (
                    <div key={champ} className="space-y-1.5">
                      <Label htmlFor={`ent-${champ}`}>{libelle}</Label>
                      <Input
                        id={`ent-${champ}`}
                        value={entete[champ]}
                        onChange={(e) => majEntete(champ, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="regime">Régime douanier</Label>
                {/* Quatre-vingt-un régimes officiels, mais tous ne se
                    liquident pas. Les séparer évite d'en choisir un au hasard
                    et de se heurter à un refus après avoir tout saisi. */}
                <select
                  id="regime"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={regime}
                  onChange={(e) => setRegime(e.target.value)}
                >
                  {GROUPES_REGIME.map(({ sens, libelle }) => {
                    const liste = regimes.filter(
                      (r) => r.liquidation_supportee && r.sens === sens,
                    );
                    if (liste.length === 0) return null;
                    return (
                      <optgroup key={sens} label={libelle}>
                        {liste.map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.code} — {r.libelle}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                  <optgroup label="Référentiel — calcul non proposé">
                    {regimes
                      .filter((r) => !r.liquidation_supportee)
                      .map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.code} — {r.libelle}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fret">Fret total (FCFA)</Label>
                <Input id="fret" type="number" value={fret} onChange={(e) => setFret(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assurance">Assurance totale (FCFA)</Label>
                <Input
                  id="assurance"
                  type="number"
                  value={assurance}
                  onChange={(e) => setAssurance(e.target.value)}
                />
              </div>
            </div>

            {regimeChoisi && (
              <p
                className={`rounded-md border p-3 text-xs ${
                  regimeChoisi.liquidation_supportee
                    ? 'border-dashed text-muted-foreground'
                    : 'border-destructive/40 bg-destructive/5 text-foreground'
                }`}
              >
                {!regimeChoisi.liquidation_supportee && (
                  <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 -translate-y-px text-destructive" />
                )}
                {regimeChoisi.mention}
              </p>
            )}

            <div className="space-y-3">
              {lignes.map((l, i) => (
                <div key={l.cle} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">Ligne {l.numero}</p>
                    {lignes.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setLignes((x) => x.filter((y) => y.cle !== l.cle))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <Input
                      className="lg:col-span-2"
                      placeholder="Désignation"
                      value={l.designation}
                      onChange={(e) => majLigne(l.cle, 'designation', e.target.value)}
                    />
                    <Input
                      placeholder="Code HS"
                      value={l.position}
                      onChange={(e) => majLigne(l.cle, 'position', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Valeur FOB"
                      value={l.fob}
                      onChange={(e) => majLigne(l.cle, 'fob', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Poids brut (kg)"
                      value={l.poids_brut}
                      onChange={(e) => majLigne(l.cle, 'poids_brut', e.target.value)}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Le taux de droit est lu dans le TEC à partir du code. Laissez le code vide et
                    saisissez un taux ci-dessous seulement si vous voulez forcer une valeur.
                  </p>
                  <Input
                    className="mt-1.5 w-40"
                    placeholder="Taux forcé (0.20)"
                    value={l.taux_dd}
                    onChange={(e) => majLigne(l.cle, 'taux_dd', e.target.value)}
                  />
                  {i === lignes.length - 1 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLignes((x) => [...x, ligneVide(String(x.length + 1))])}
                      >
                        <Plus className="mr-1.5 h-4 w-4" />
                        Ajouter une ligne
                      </Button>
                      {/* L'éclatement du § 3.5 : une sous-ligne porte son propre
                          code et hérite du prorata de sa ligne parente. */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setLignes((x) => {
                            const parent = x[x.length - 1].numero.split('.')[0];
                            const rang = x.filter((y) => y.numero.startsWith(`${parent}.`)).length + 1;
                            return [...x, ligneVide(`${parent}.${rang}`)];
                          })
                        }
                      >
                        Éclater la ligne
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button
              onClick={liquider}
              disabled={calcul || regimeChoisi?.liquidation_supportee === false}
              className="w-full sm:w-auto"
            >
              {calcul ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Calculator className="mr-1.5 h-4 w-4" />}
              Calculer les droits et taxes
            </Button>

            {liquidation && (
              <div className="space-y-4">
                <div className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">FOB total</p>
                    <p className="font-semibold tabular-nums">{fcfa(liquidation.globaux.fob_total_fcfa)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fret</p>
                    <p className="tabular-nums">{fcfa(liquidation.globaux.fret_total_fcfa)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Assurance</p>
                    <p className="tabular-nums">{fcfa(liquidation.globaux.assurance_total_fcfa)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valeur en douane (CAF)</p>
                    <p className="font-semibold tabular-nums text-foreground">
                      {fcfa(liquidation.globaux.caf_total_fcfa)}
                    </p>
                  </div>
                </div>

                {/* Le détail par ligne : le § 6.1 l'exige, et c'est ce qu'un
                    déclarant rapproche de son bulletin de liquidation. */}
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[44rem] text-sm">
                    <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Ligne</th>
                        <th className="px-3 py-2 text-right">FOB</th>
                        <th className="px-3 py-2 text-right">Fret</th>
                        <th className="px-3 py-2 text-right">Assur.</th>
                        <th className="px-3 py-2 text-right">CAF</th>
                        <th className="px-3 py-2 text-right">DD</th>
                        <th className="px-3 py-2 text-right">TVA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {liquidation.lignes.map((l) => {
                        const t = (code: string) =>
                          l.taxes.find((x) => x.code === code)?.montant_fcfa ?? 0;
                        return (
                          <tr key={l.numero ?? l.position} className="align-top">
                            <td className="px-3 py-2">
                              <p className="font-medium text-foreground">
                                {l.numero} · {l.position ?? '—'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {l.designation ?? l.designation_tec}
                              </p>
                              <p className="mt-0.5 text-xs">
                                {l.verifie_en_base ? (
                                  <span className="text-primary-emphasis">
                                    DD {pct(l.taux_dd)} — vérifié au TEC
                                  </span>
                                ) : (
                                  <span className="text-destructive">
                                    DD {pct(l.taux_dd)} — taux saisi, non vérifié
                                  </span>
                                )}
                                {' · '}
                                {(l.part_fret * 100).toFixed(1)} % du poids ·{' '}
                                {(l.part_valeur * 100).toFixed(1)} % de la valeur
                              </p>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{fcfa(l.fob_fcfa)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fcfa(l.fret_fcfa)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fcfa(l.assurance_fcfa)}</td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">
                              {fcfa(l.caf_fcfa)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{fcfa(t('DD'))}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fcfa(t('TVA'))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-md border border-primary/40 bg-primary/5 p-4">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                    {Object.entries(liquidation.totaux_taxes).map(([code, montant]) => (
                      <div key={code} className="flex items-baseline justify-between gap-2">
                        <dt className="text-muted-foreground">{code}</dt>
                        <dd className="tabular-nums text-foreground">{fcfa(montant)}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t pt-3">
                    <p className="font-display text-lg font-extrabold text-foreground">Total à payer</p>
                    <p className="font-display text-2xl font-extrabold tabular-nums text-primary">
                      {fcfa(liquidation.total_a_payer_fcfa)}
                    </p>
                  </div>
                  {liquidation.regime.caution_requise && (
                    <p className="mt-2 text-xs font-medium text-foreground">
                      Régime sous caution : aucun droit n'est payé maintenant, une caution ou un
                      acquit-à-caution est exigé à la place.
                    </p>
                  )}
                  {liquidation.regime.depend_autorisation && (
                    <p className="mt-2 text-xs font-medium text-destructive">
                      Montants indicatifs : l'exonération réelle dépend de votre autorisation.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" onClick={imprimer}>
                    <Printer className="mr-1.5 h-4 w-4" />
                    Télécharger le bulletin (PDF)
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Cases numérotées, détail par ligne et zone de signature. Renseignez l'en-tête
                    ci-dessus pour un document complet.
                  </p>
                </div>

                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  <strong className="text-foreground">
                    Document d'aide au calcul — ne remplace pas la déclaration officielle.
                  </strong>{' '}
                  Tarif appliqué : {liquidation.tarif.libelle}, version du{' '}
                  {new Date(liquidation.tarif.date_version).toLocaleDateString('fr-FR')}. La
                  déclaration officielle doit être saisie dans le système douanier.
                </p>
              </div>
            )}
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
