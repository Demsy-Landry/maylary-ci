import { useEffect, useMemo, useState } from 'react';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import {
  supabase,
  REGIMES_DOUANIERS_TABLE,
  type PositionTec,
  type VerificationTec,
  type RegimeDouanier,
  type Liquidation,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from 'lucide-react';
import { toast } from 'sonner';

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
 * Reconstruction dans Maylary de l'outil qui vivait sur `le-declarant.com`.
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
  const [onglet, setOnglet] = useState<'position' | 'liquidation'>('position');

  /* ---- Recherche de position ---- */
  const [requete, setRequete] = useState('');
  const [resultats, setResultats] = useState<PositionTec[] | null>(null);
  const [verification, setVerification] = useState<VerificationTec | null>(null);
  const [cherche, setCherche] = useState(false);

  /* ---- Liquidation ---- */
  const [regimes, setRegimes] = useState<RegimeDouanier[]>([]);
  const [regime, setRegime] = useState('4000');
  const [fret, setFret] = useState('');
  const [assurance, setAssurance] = useState('');
  const [lignes, setLignes] = useState<LigneSaisie[]>([ligneVide('1')]);
  const [liquidation, setLiquidation] = useState<Liquidation | null>(null);
  const [calcul, setCalcul] = useState(false);

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

  const reprendre = (code: string, designation: string, taux: number) => {
    setLignes((l) => {
      const suite = [...l];
      const vide = suite.findIndex((x) => !x.position && !x.designation);
      const cible = vide >= 0 ? vide : suite.length;
      const base = vide >= 0 ? suite[cible] : ligneVide(String(suite.length + 1));
      suite[cible] = {
        ...base,
        position: code,
        designation: designation.slice(0, 120),
        taux_dd: String(taux / 100),
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
              Trouvez la position tarifaire d'une marchandise et calculez les droits et taxes dus à
              l'importation en Côte d'Ivoire. Les taux viennent du{' '}
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
                        reprendre(
                          verification.code_hs!,
                          verification.designation!,
                          verification.taux_dd_pourcent!,
                        )
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
                              onClick={() => reprendre(r.code_hs, r.designation, r.taux_dd)}
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

        {/* ================= LIQUIDATION ================= */}
        {onglet === 'liquidation' && (
          <section className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="regime">Régime douanier</Label>
                <select
                  id="regime"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={regime}
                  onChange={(e) => setRegime(e.target.value)}
                >
                  {regimes.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.code} — {r.libelle}
                    </option>
                  ))}
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
              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
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

            <Button onClick={liquider} disabled={calcul} className="w-full sm:w-auto">
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
