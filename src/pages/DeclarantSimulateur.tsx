import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import NavDeclarant from '@/components/NavDeclarant';
import SiteFooter from '@/components/SiteFooter';
import ChoixListe from '@/components/ChoixListe';
import { Button } from '@/components/ui/button';
import { useReferentiels } from '@/hooks/useReferentiels';
import {
  MODES_TRANSPORT,
  UNITES,
  PARITES_FIXES,
  prochainSousNumero,
  manquesAvantDocument,
  enTeteVide,
  valeursVides,
  ligneVide,
  type EnTeteSimulateur,
  type ValeursGlobales,
  type LigneSimulateur,
} from '@/lib/simulateur-declaration';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  type Liquidation,
  type ClassificationHs,
} from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Ship, Plane, Truck, TrainFront, FileSpreadsheet, Lock, Coins,
  Plus, Trash2, Split, Sparkles, Loader2, CheckCircle2, AlertTriangle,
  ChevronDown, Calculator, Printer,
} from 'lucide-react';

/**
 * Le simulateur de déclaration douanière.
 *
 * Cahier du fondateur, transitaire de métier : quatre blocs successifs, puis un
 * document imprimable. Cette page est NEUVE — l'atelier et la page de
 * déclaration existants ne sont pas touchés, comme demandé.
 *
 * LE POINT QUI NE BOUGE PAS
 *
 * Aucun calcul de droits et taxes n'est fait ici. Ils viennent de
 * `app_e08c374bc4_liquider_declaration`, en base. Un moteur dupliqué côté
 * navigateur finit toujours par diverger de celui qui fait foi, et c'est le
 * client qui découvre l'écart sur sa facture.
 *
 * Ce que l'écran calcule en direct, ce sont seulement des SOMMES : le FOB total
 * est l'addition des lignes, le CAF total est FOB + fret + assurance converti.
 * Aucune assiette, aucun taux.
 */

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const nombre = (v: string) => {
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const ICONES_MODE = { ship: Ship, plane: Plane, truck: Truck, train: TrainFront } as const;

export default function DeclarantSimulateur() {
  const ref = useReferentiels();

  const [entete, setEntete] = useState<EnTeteSimulateur>(enTeteVide);
  const [valeurs, setValeurs] = useState<ValeursGlobales>(valeursVides);
  const [lignes, setLignes] = useState<LigneSimulateur[]>([ligneVide('1', 1)]);
  const [prochaineCle, setProchaineCle] = useState(2);
  /** Classification en cours, par clé de ligne. */
  const [classement, setClassement] = useState<number | null>(null);
  const [liquidation, setLiquidation] = useState<Liquidation | null>(null);
  const [calcul, setCalcul] = useState(false);
  const [detailOuvert, setDetailOuvert] = useState<string | null>(null);
  const [document_, setDocument] = useState(false);

  const majLigne = (cle: number, champ: keyof LigneSimulateur, v: string) =>
    setLignes((l) =>
      l.map((x) =>
        x.cle === cle
          ? {
              ...x,
              [champ]: v,
              // Toucher au code HS à la main invalide la vérification : le
              // badge « vérifié » ne doit jamais survivre à une saisie
              // manuelle, sinon il ment.
              ...(champ === 'code_hs'
                ? { verifie: false, taux_dd: null, designation_tec: null }
                : {}),
            }
          : x,
      ),
    );

  const ajouterLigne = () => {
    const racines = lignes.filter((l) => !l.numero.includes('.'));
    setLignes((l) => [...l, ligneVide(String(racines.length + 1), prochaineCle)]);
    setProchaineCle((c) => c + 1);
  };

  const eclater = (l: LigneSimulateur) => {
    const numero = prochainSousNumero(lignes, l.numero);
    setLignes((x) => [...x, { ...ligneVide(numero, prochaineCle), designation: l.designation }]);
    setProchaineCle((c) => c + 1);
    toast.success(`Sous-ligne ${numero} créée.`);
  };

  /** La classification assistée, ligne par ligne. Elle écrit le code, la
   *  désignation officielle et le taux — mais seulement s'il est CONFIRMÉ au
   *  tarif. Sans confirmation, aucun taux n'est posé. */
  const classer = async (l: LigneSimulateur) => {
    const texte = l.designation.trim();
    if (texte.length < 3) {
      toast.error('Décrivez la marchandise avant de la faire classer.');
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error('Connectez-vous pour utiliser la classification assistée.');
      return;
    }
    setClassement(l.cle);
    try {
      const r = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_classification_hs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ description: texte }),
      });
      const corps = await r.json();
      if (!r.ok) {
        toast.error(corps?.erreur ?? "La classification n'a pas abouti.");
        return;
      }
      const c = corps as ClassificationHs;
      setLignes((x) =>
        x.map((y) =>
          y.cle === l.cle
            ? {
                ...y,
                code_hs: c.code_propose ?? y.code_hs,
                designation_tec: c.designation_tec,
                taux_dd: c.verifie_en_base ? c.taux_dd : null,
                verifie: c.verifie_en_base,
                unite: c.unite_us ?? y.unite,
              }
            : y,
        ),
      );
      if (!c.verifie_en_base) {
        toast.warning(
          "Code proposé mais non confirmé au tarif : aucun taux n'est retenu. Vérifiez-le.",
        );
      }
    } catch {
      toast.error('Le service est injoignable.');
    } finally {
      setClassement(null);
    }
  };

  /** Le calcul. Il part au moteur officiel et rien n'est calculé ici. */
  const liquider = async () => {
    const utiles = lignes.filter((l) => nombre(l.fob) > 0);
    if (utiles.length === 0) {
      toast.error('Renseignez au moins une ligne avec une valeur FOB.');
      return;
    }
    if (!taux) {
      toast.error('Renseignez le taux de change vers le franc CFA.');
      return;
    }
    setCalcul(true);
    const { data, error } = await supabase.rpc('app_e08c374bc4_liquider_declaration', {
      // Les montants partent en francs CFA : le moteur travaille dans cette
      // monnaie, la conversion est faite ici une fois pour toutes.
      p_lignes: utiles.map((l) => ({
        numero: l.numero,
        designation: l.designation || null,
        position: l.code_hs || null,
        taux_dd: null,
        fob: nombre(l.fob) * taux,
        poids_brut: nombre(l.poids_brut),
      })),
      p_fret_total: nombre(valeurs.fret) * taux,
      p_assurance_total: nombre(valeurs.assurance) * taux,
      p_poids_brut_total: nombre(valeurs.poids_brut_total) || null,
      p_regime: entete.regime,
    });
    setCalcul(false);
    if (error) {
      toast.error(error.message);
      setLiquidation(null);
      return;
    }
    setLiquidation(data as Liquidation);
  };

  const manques = useMemo(
    () => manquesAvantDocument(entete, valeurs, lignes),
    [entete, valeurs, lignes],
  );

  /** Le document. Il ne se génère pas sans liquidation : un papier qui montre
   *  des cases remplies et un total vide fait douter de tout le reste. */
  const produireDocument = async () => {
    if (!liquidation) {
      toast.error('Calculez les droits et taxes avant de générer le document.');
      return;
    }
    if (manques.length > 0) {
      toast.error(`Il manque ${manques.join(', ')}.`);
      return;
    }
    setDocument(true);
    try {
      // Le dictionnaire code → libellé, pour que le document n'imprime jamais
      // un code nu : « 1 » seul ne dit rien au client à qui on le remet.
      const libelles: Record<string, string> = {};
      for (const liste of [ref.regimes, ref.bureaux, ref.pays, ref.monnaies, ref.modesTransport]) {
        for (const o of liste) libelles[o.valeur] = o.libelle;
      }
      const { telechargerSimulationPdf } = await import('@/lib/simulateur-pdf');
      telechargerSimulationPdf({ entete, valeurs, lignes, liquidation, libelles });
      toast.success('Document téléchargé.');
    } catch {
      toast.error("Le document n'a pas pu être produit.");
    } finally {
      setDocument(false);
    }
  };

  const majEntete = (c: keyof EnTeteSimulateur, v: string) =>
    setEntete((e) => ({ ...e, [c]: v }));

  /** Changer de devise repose le taux quand il est de droit, et le vide
   *  sinon : garder l'ancien taux sur une nouvelle devise serait un faux. */
  const majDevise = (code: string) =>
    setValeurs((v) => ({
      ...v,
      devise: code,
      taux_change: PARITES_FIXES[code] !== undefined ? String(PARITES_FIXES[code]) : '',
    }));

  const pariteDeDroit = PARITES_FIXES[valeurs.devise] !== undefined;

  /* Le FOB total n'est pas saisi : c'est la somme des lignes, et elle se
   * recalcule à chaque frappe. Le fondateur insiste, et il a raison — un FOB
   * total saisi à part finit toujours par ne plus correspondre aux lignes. */
  const fobTotal = useMemo(
    () => lignes.reduce((t, l) => t + nombre(l.fob), 0),
    [lignes],
  );

  const taux = nombre(valeurs.taux_change);
  const cafTotalXof = useMemo(
    () => (fobTotal + nombre(valeurs.fret) + nombre(valeurs.assurance)) * taux,
    [fobTotal, valeurs.fret, valeurs.assurance, taux],
  );

  const champ = (
    cle: keyof EnTeteSimulateur,
    libelle: string,
    options?: { type?: string; aide?: string; placeholder?: string },
  ) => (
    <div>
      <Label htmlFor={cle} className="text-xs">
        {libelle}
      </Label>
      <Input
        id={cle}
        type={options?.type}
        value={entete[cle]}
        onChange={(e) => majEntete(cle, e.target.value)}
        placeholder={options?.placeholder}
      />
      {options?.aide && <p className="mt-0.5 text-xs text-muted-foreground">{options.aide}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <NavDeclarant />

      <main className="entree-page mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          <FileSpreadsheet className="h-4 w-4" />
          Simulateur de déclaration
        </p>
        <h1 className="trait-anime mt-3 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Chiffrer une déclaration, ligne par ligne
        </h1>
        <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
          Saisissez l’en-tête, les valeurs globales et vos positions tarifaires. Les droits et taxes
          sont calculés par le moteur officiel, sur le Tarif Extérieur Commun — jamais estimés ici.
        </p>

        {/* ================= BLOC 1 — EN-TÊTE ================= */}
        <section className="carte-reactive mt-7 rounded-xl border bg-card p-5" data-revele>
          <div className="flex items-baseline gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-display text-xs font-bold text-primary">
              1
            </span>
            <h2 className="font-display text-base font-bold text-foreground">
              En-tête de la déclaration
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Qui déclare, pour qui, sous quel régime et à quel bureau.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {champ('reference', 'Référence déclaration', {
              placeholder: 'Votre référence de dossier',
            })}

            <div>
              <Label htmlFor="regime" className="text-xs">
                Régime douanier
              </Label>
              <ChoixListe
                id="regime"
                options={ref.regimes}
                valeur={entete.regime}
                onChange={(v) => majEntete('regime', v)}
                placeholder="Chercher un régime"
              />
            </div>

            <div>
              <Label htmlFor="bureau" className="text-xs">
                Bureau de douane
              </Label>
              <ChoixListe
                id="bureau"
                options={ref.bureaux}
                valeur={entete.bureau}
                onChange={(v) => majEntete('bureau', v)}
                libre
                placeholder="Chercher un bureau"
                aideLibre="Bureau hors liste — vérifiez son code avant le dépôt."
              />
            </div>

            {champ('date', 'Date', { type: 'date' })}
            {champ('importateur', 'Importateur / Déclarant')}
            {champ('fournisseur', 'Fournisseur')}

            <div>
              <Label htmlFor="pays_origine" className="text-xs">
                Pays d’origine
              </Label>
              <ChoixListe
                id="pays_origine"
                options={ref.pays}
                valeur={entete.pays_origine}
                onChange={(v) => majEntete('pays_origine', v)}
                placeholder="Chercher un pays"
              />
              <p className="mt-0.5 text-xs text-muted-foreground">
                Origine réelle de fabrication — elle décide du régime préférentiel.
              </p>
            </div>

            {champ('numero_facture', 'N° Facture')}
            {champ('numero_connaissement', 'N° Connaissement (BL / LTA)')}
            {champ('rccm_cc', 'N° RCCM / CC de l’importateur')}

            {/* Le mode de transport : des icônes plutôt qu'une liste. On
                remplit ce champ vingt fois par jour, et l'œil va plus vite
                que la lecture. */}
            <div className="sm:col-span-2">
              <Label className="text-xs">Mode de transport</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {MODES_TRANSPORT.map((m) => {
                  const Icone = ICONES_MODE[m.icone];
                  const actif = entete.mode_transport === m.code;
                  return (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => majEntete('mode_transport', m.code)}
                      aria-pressed={actif}
                      className={
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ' +
                        (actif
                          ? 'border-primary bg-primary/10 text-primary-emphasis'
                          : 'text-muted-foreground hover:border-primary/40 hover:text-foreground')
                      }
                    >
                      <Icone className="h-4 w-4" />
                      {m.libelle}
                      <span className="font-mono text-xs opacity-60">{m.code}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ================= BLOC 2 — VALEURS GLOBALES ================= */}
        <section className="carte-reactive mt-5 rounded-xl border bg-card p-5" data-revele>
          <div className="flex items-baseline gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-display text-xs font-bold text-primary">
              2
            </span>
            <h2 className="font-display text-base font-bold text-foreground">Valeurs globales</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Ce qui s’applique à toute la déclaration et se répartit ensuite sur les lignes.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="devise" className="text-xs">
                Devise de la facture
              </Label>
              <ChoixListe
                id="devise"
                options={ref.monnaies}
                valeur={valeurs.devise}
                onChange={majDevise}
                placeholder="Chercher une devise"
              />
            </div>

            {/* Le taux : verrouillé quand il est de droit, exigé sinon. On ne
                va JAMAIS le chercher dans une API de change — l'euro est
                ancré au franc CFA par la loi, pas par un marché. */}
            <div>
              <Label htmlFor="taux_change" className="text-xs">
                Taux de change vers le franc CFA
              </Label>
              <div className="relative">
                <Input
                  id="taux_change"
                  inputMode="decimal"
                  value={valeurs.taux_change}
                  readOnly={pariteDeDroit}
                  onChange={(e) => setValeurs((v) => ({ ...v, taux_change: e.target.value }))}
                  className={'tabular-nums ' + (pariteDeDroit ? 'bg-muted/50 pr-9' : '')}
                />
                {pariteDeDroit && (
                  <Lock className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {pariteDeDroit
                  ? 'Parité fixe de droit — elle ne se saisit pas.'
                  : 'Taux du jour retenu pour la déclaration.'}
              </p>
            </div>

            <div>
              <Label htmlFor="fret" className="text-xs">
                Fret total
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="fret"
                  inputMode="decimal"
                  value={valeurs.fret}
                  onChange={(e) => setValeurs((v) => ({ ...v, fret: e.target.value }))}
                  className="tabular-nums"
                />
                <span className="shrink-0 text-sm font-medium text-muted-foreground">
                  {valeurs.devise}
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="assurance" className="text-xs">
                Assurance totale
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="assurance"
                  inputMode="decimal"
                  value={valeurs.assurance}
                  onChange={(e) => setValeurs((v) => ({ ...v, assurance: e.target.value }))}
                  className="tabular-nums"
                />
                <span className="shrink-0 text-sm font-medium text-muted-foreground">
                  {valeurs.devise}
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="poids_brut_total" className="text-xs">
                Poids brut total (kg)
              </Label>
              <Input
                id="poids_brut_total"
                inputMode="decimal"
                value={valeurs.poids_brut_total}
                onChange={(e) => setValeurs((v) => ({ ...v, poids_brut_total: e.target.value }))}
                className="tabular-nums"
              />
            </div>

            <div>
              <Label htmlFor="poids_net_total" className="text-xs">
                Poids net total (kg)
              </Label>
              <Input
                id="poids_net_total"
                inputMode="decimal"
                value={valeurs.poids_net_total}
                onChange={(e) => setValeurs((v) => ({ ...v, poids_net_total: e.target.value }))}
                className="tabular-nums"
              />
            </div>
          </div>

          {/* Les deux valeurs qui ne se saisissent pas. */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  FOB total
                </p>
              </div>
              <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-foreground">
                {fobTotal.toLocaleString('fr-FR')}{' '}
                <span className="text-sm font-medium text-muted-foreground">{valeurs.devise}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Somme des lignes — il ne se saisit pas.
              </p>
            </div>

            {/* La valeur pivot de tout le calcul : elle doit se voir. */}
            <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-4">
              <div className="flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-primary" />
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Valeur en douane (CAF)
                </p>
              </div>
              <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-foreground">
                {fcfa(cafTotalXof)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                FOB + fret + assurance, converti. C’est l’assiette de tout le calcul.
              </p>
              {!taux && (
                <Badge variant="outline" className="mt-2 border-amber-500/50 text-amber-700">
                  Taux de change manquant
                </Badge>
              )}
            </div>
          </div>
        </section>

        {/* ================= BLOC 3 — LIGNES TARIFAIRES ================= */}
        <section className="carte-reactive mt-5 rounded-xl border bg-card p-5" data-revele>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-display text-xs font-bold text-primary">
                  3
                </span>
                <h2 className="font-display text-base font-bold text-foreground">
                  Lignes tarifaires
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Une ligne par position. Éclatez une ligne quand un même colis porte deux positions.
              </p>
            </div>
            <Badge variant="secondary" className="tabular-nums">
              {lignes.length} ligne{lignes.length > 1 ? 's' : ''}
            </Badge>
          </div>

          <div className="mt-4 space-y-4">
            {lignes.map((l) => {
              const liquidee = liquidation?.lignes.find((x) => x.numero === l.numero) ?? null;
              const sousLigne = l.numero.includes('.');
              return (
                <div
                  key={l.cle}
                  className={
                    'rounded-lg border p-4 ' +
                    (sousLigne ? 'ml-0 border-dashed bg-muted/20 sm:ml-6' : 'bg-card')
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-sm font-bold tabular-nums text-foreground">
                      Ligne {l.numero}
                      {sousLigne && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          sous-ligne
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1">
                      {!sousLigne && (
                        <Button size="sm" variant="ghost" onClick={() => eclater(l)} title="Éclater cette ligne">
                          <Split className="h-4 w-4" />
                          <span className="ml-1 hidden sm:inline">Éclater</span>
                        </Button>
                      )}
                      {lignes.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/5"
                          onClick={() => setLignes((x) => x.filter((y) => y.cle !== l.cle))}
                          title="Supprimer la ligne"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor={`des-${l.cle}`} className="text-xs">
                        Désignation de la marchandise
                      </Label>
                      <Input
                        id={`des-${l.cle}`}
                        value={l.designation}
                        onChange={(e) => majLigne(l.cle, 'designation', e.target.value)}
                        placeholder="Matière, fonction, usage — plus c'est précis, mieux c'est classé"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor={`hs-${l.cle}`} className="text-xs">
                        Code HS
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id={`hs-${l.cle}`}
                          value={l.code_hs}
                          onChange={(e) => majLigne(l.cle, 'code_hs', e.target.value)}
                          placeholder="0000.00.00.00"
                          className="tabular-nums"
                        />
                        <Button
                          variant="outline"
                          className="shrink-0 bouton-anime"
                          onClick={() => void classer(l)}
                          disabled={classement === l.cle}
                        >
                          {classement === l.cle ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          <span className="ml-1.5 hidden sm:inline">Classer</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Le résultat du classement, encadré et distinct. Le badge de
                      confiance n'apparaît QUE si le corpus a confirmé le code —
                      il ne survit pas à une retouche manuelle. */}
                  {(l.designation_tec || l.verifie) && (
                    <div
                      className={
                        'mt-3 rounded-md border p-3 ' +
                        (l.verifie
                          ? 'border-emerald-600/40 bg-emerald-50/40'
                          : 'border-amber-500/50 bg-amber-50/40')
                      }
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-bold tabular-nums text-foreground">
                          {l.code_hs}
                        </span>
                        {l.verifie ? (
                          <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Vérifié — Base TEC UEMOA officielle
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-700">
                            <AlertTriangle className="h-3 w-3" />
                            Non confirmé — aucun taux retenu
                          </Badge>
                        )}
                        {l.taux_dd !== null && (
                          <span className="font-display text-sm font-bold tabular-nums text-foreground">
                            DD {l.taux_dd} %
                          </span>
                        )}
                      </div>
                      {l.designation_tec && (
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {l.designation_tec}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                      <Label htmlFor={`fob-${l.cle}`} className="text-xs">
                        FOB ({valeurs.devise})
                      </Label>
                      <Input
                        id={`fob-${l.cle}`}
                        inputMode="decimal"
                        value={l.fob}
                        onChange={(e) => majLigne(l.cle, 'fob', e.target.value)}
                        className="tabular-nums"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`pb-${l.cle}`} className="text-xs">
                        Poids brut (kg)
                      </Label>
                      <Input
                        id={`pb-${l.cle}`}
                        inputMode="decimal"
                        value={l.poids_brut}
                        onChange={(e) => majLigne(l.cle, 'poids_brut', e.target.value)}
                        className="tabular-nums"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`pn-${l.cle}`} className="text-xs">
                        Poids net (kg)
                      </Label>
                      <Input
                        id={`pn-${l.cle}`}
                        inputMode="decimal"
                        value={l.poids_net}
                        onChange={(e) => majLigne(l.cle, 'poids_net', e.target.value)}
                        className="tabular-nums"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`qte-${l.cle}`} className="text-xs">
                        Quantité
                      </Label>
                      <Input
                        id={`qte-${l.cle}`}
                        inputMode="decimal"
                        value={l.quantite}
                        onChange={(e) => majLigne(l.cle, 'quantite', e.target.value)}
                        className="tabular-nums"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`u-${l.cle}`} className="text-xs">
                        Unité
                      </Label>
                      <ChoixListe
                        id={`u-${l.cle}`}
                        options={UNITES.map((u) => ({ valeur: u.code, libelle: u.libelle }))}
                        valeur={l.unite}
                        onChange={(v) => majLigne(l.cle, 'unite', v)}
                        placeholder="Unité"
                      />
                    </div>
                  </div>

                  {/* Le détail de la ligne, une fois calculée. Repliable pour ne
                      pas noyer l'écran, mais JAMAIS masqué : le fret et
                      l'assurance proratisés sont une exigence de traçabilité. */}
                  {liquidee && (
                    <div className="mt-3 rounded-md border bg-muted/30">
                      <button
                        type="button"
                        onClick={() => setDetailOuvert(detailOuvert === l.numero ? null : l.numero)}
                        aria-expanded={detailOuvert === l.numero}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                      >
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Détail du calcul — CAF {fcfa(liquidee.caf_fcfa)}
                        </span>
                        <ChevronDown
                          className={
                            'h-4 w-4 shrink-0 text-muted-foreground transition-transform ' +
                            (detailOuvert === l.numero ? 'rotate-180' : '')
                          }
                        />
                      </button>
                      {detailOuvert === l.numero && (
                        <div className="overflow-x-auto border-t px-3 py-2">
                          <table className="w-full min-w-[30rem] text-sm">
                            <tbody className="divide-y">
                              <tr>
                                <td className="py-1.5 text-muted-foreground">Fret proratisé</td>
                                <td className="py-1.5 text-right font-semibold tabular-nums">
                                  {fcfa(liquidee.fret_fcfa)}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-1.5 text-muted-foreground">Assurance proratisée</td>
                                <td className="py-1.5 text-right font-semibold tabular-nums">
                                  {fcfa(liquidee.assurance_fcfa)}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-1.5 text-foreground">CAF de la ligne</td>
                                <td className="py-1.5 text-right font-bold tabular-nums text-foreground">
                                  {fcfa(liquidee.caf_fcfa)}
                                </td>
                              </tr>
                              {liquidee.taxes.map((t) => (
                                <tr key={t.code}>
                                  <td className="py-1.5 text-muted-foreground">
                                    {t.code}
                                    <span className="ml-1.5 text-xs">{t.libelle}</span>
                                    {t.taux > 0 && (
                                      <span className="ml-1.5 text-xs tabular-nums">
                                        ({(t.taux * 100).toFixed(2).replace(/\.00$/, '')} %)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-1.5 text-right font-semibold tabular-nums">
                                    {fcfa(t.montant_fcfa)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Button variant="outline" className="bouton-anime mt-4" onClick={ajouterLigne}>
            <Plus className="mr-1.5 h-4 w-4" />
            Ajouter une ligne
          </Button>
        </section>

        {/* ================= BLOC 4 — RÉCAPITULATIF ================= */}
        <section
          className="carte-reactive mt-5 rounded-xl border-2 border-primary/40 bg-primary/5 p-5"
          data-revele
        >
          <div className="flex items-baseline gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 font-display text-xs font-bold text-primary">
              4
            </span>
            <h2 className="font-display text-base font-bold text-foreground">
              Récapitulatif et liquidation
            </h2>
          </div>

          <Button size="lg" className="bouton-anime mt-4" onClick={() => void liquider()} disabled={calcul}>
            {calcul ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Calculator className="mr-2 h-4 w-4" />
            )}
            Calculer les droits et taxes
          </Button>

          {liquidation && (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-4">
                {[
                  ['FOB total', liquidation.globaux.fob_total_fcfa],
                  ['Fret total', liquidation.globaux.fret_total_fcfa],
                  ['Assurance totale', liquidation.globaux.assurance_total_fcfa],
                  ['CAF total', liquidation.globaux.caf_total_fcfa],
                ].map(([libelle, montant], i) => (
                  <div key={libelle as string}>
                    <p className="text-xs text-muted-foreground">{libelle}</p>
                    <p
                      className={
                        'font-display tabular-nums ' +
                        (i === 3 ? 'text-base font-extrabold text-foreground' : 'text-sm font-bold')
                      }
                    >
                      {fcfa(montant as number)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-lg border bg-card">
                <table className="w-full min-w-[26rem] text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Taxe</th>
                      <th className="px-3 py-2 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Object.entries(liquidation.totaux_taxes).map(([code, montant]) => (
                      <tr key={code}>
                        <td className="px-3 py-2 font-medium text-foreground">
                          {code}
                          {code === 'TS' && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              par déclaration
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-foreground">
                          {fcfa(montant)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* La valeur la plus visible de tout l'écran. */}
              <div className="rounded-xl border-2 border-primary bg-card p-5 text-center">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Total à payer
                </p>
                <p className="mt-1 font-display text-3xl font-extrabold tabular-nums text-primary-emphasis sm:text-4xl">
                  {fcfa(liquidation.total_a_payer_fcfa)}
                </p>
              </div>

              {liquidation.regime.caution_requise && (
                <p className="rounded-md border border-amber-500/40 bg-amber-50/40 p-3 text-sm text-foreground">
                  Régime sous caution : aucun droit n’est payé maintenant, une caution ou un
                  acquit-à-caution est exigé à la place.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  variant="outline"
                  className="bouton-anime"
                  onClick={() => void produireDocument()}
                  disabled={document_}
                >
                  {document_ ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="mr-2 h-4 w-4" />
                  )}
                  Générer le document
                </Button>
                {manques.length > 0 && (
                  <p className="text-xs text-amber-700">
                    Il manque {manques.join(', ')}.
                  </p>
                )}
              </div>

              <p className="rounded-md border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Document d’aide au calcul.</strong> Tarif
                appliqué : {liquidation.tarif.libelle}, version du{' '}
                {new Date(liquidation.tarif.date_version).toLocaleDateString('fr-FR')}. La
                déclaration officielle doit être saisie dans le système douanier (SYDAM).{' '}
                <Link to="/declarant/classer" className="font-medium text-primary hover:underline">
                  Classer une autre marchandise
                </Link>
              </p>
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
