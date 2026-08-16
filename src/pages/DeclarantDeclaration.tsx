import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import NavDeclarant from '@/components/NavDeclarant';
import SiteFooter from '@/components/SiteFooter';
import ChoixListe, { type OptionListe } from '@/components/ChoixListe';
import { useReferentiels, libellesPourDocument } from '@/hooks/useReferentiels';
import { useAuth } from '@/hooks/useAuth';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  LIQUIDATIONS_TABLE,
  CLASSIFICATIONS_HS_TABLE,
  type Liquidation,
  type ClassificationHs,
  type LiquidationEnregistree,
  type ClassificationEnregistree,
} from '@/lib/supabase';
import {
  GROUPES_DECLARATION,
  CASES_ARTICLE,
  UNITES,
  MODES_TRANSPORT,
  PARITES_FIXES,
  valeursInitiales,
  ligneVide,
  prochainSousNumero,
  manquesAvantDocument,
  taxesOrdonnees,
  type ValeursDeclaration,
  type LigneDeclaration,
  type CaseDeclaration,
} from '@/lib/declaration';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  FileText, Printer, Plus, Trash2, Split, Sparkles, Loader2, CheckCircle2,
  AlertTriangle, ChevronDown, Calculator, Lock, Coins, Wand2, Save,
  Ship, Plane, Truck, TrainFront,
} from 'lucide-react';

/**
 * La déclaration en détail — un seul écran, du premier champ au document.
 *
 * Il y avait deux écrans qui faisaient chacun la moitié du travail : un
 * simulateur qui calculait sans porter les numéros de cases ni le carnet
 * d'adresses, et une page de déclaration qui portait les cases sans rien
 * calculer. Le fondateur demande leur fusion, et il a raison : deux saisies
 * pour un seul document, c'est deux occasions de divergence.
 *
 * QUATRE BLOCS, DANS L'ORDRE OÙ ON TRAVAILLE
 *   1. l'en-tête — qui déclare, pour qui, sous quel régime
 *   2. l'origine, le transport et les valeurs
 *   3. les articles — c'est le cœur, et la partie la plus longue
 *   4. le récapitulatif, la liquidation, le document
 *
 * CE QUI NE BOUGE PAS
 *
 * Aucun droit, aucune taxe n'est calculé ici. Tout part à
 * `liquider_declaration`, en base. Ce que l'écran calcule en direct, ce sont
 * des SOMMES : le FOB total est l'addition des lignes, le CAF est
 * FOB + fret + assurance converti. Aucune assiette, aucun taux.
 */

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const nombre = (v: string) => {
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const ICONES_MODE = { ship: Ship, plane: Plane, truck: Truck, train: TrainFront } as const;

export default function DeclarantDeclaration() {
  const { user } = useAuth();
  const emplacement = useLocation();
  const ref = useReferentiels();

  const [valeurs, setValeurs] = useState<ValeursDeclaration>(valeursInitiales);
  const [lignes, setLignes] = useState<LigneDeclaration[]>([ligneVide('1', 1)]);
  const [prochaineCle, setProchaineCle] = useState(2);

  const [classement, setClassement] = useState<number | null>(null);
  const [liquidation, setLiquidation] = useState<Liquidation | null>(null);
  const [calcul, setCalcul] = useState(false);
  const [detailOuvert, setDetailOuvert] = useState<string | null>(null);
  const [enDocument, setEnDocument] = useState(false);
  const [archivage, setArchivage] = useState(false);
  const [numeroArchive, setNumeroArchive] = useState<string | null>(null);

  /* Le carnet d'adresses du compte, et les archives : reprendre plutôt que
   * ressaisir. Un transitaire retravaille avec les mêmes vingt fournisseurs. */
  const [carnet, setCarnet] = useState<
    { role: string; nom: string; adresse: string | null; ville: string | null; pays: string | null; identifiant: string | null }[]
  >([]);
  const [liquidations, setLiquidations] = useState<LiquidationEnregistree[]>([]);
  const [classifications, setClassifications] = useState<ClassificationEnregistree[]>([]);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from('app_e08c374bc4_intervenants')
      .select('role, nom, adresse, ville, pays, identifiant')
      .order('derniere_utilisation', { ascending: false })
      .limit(120)
      .then(({ data }) => setCarnet(data ?? []));
    void supabase
      .from(LIQUIDATIONS_TABLE)
      .select('*')
      .order('cree_le', { ascending: false })
      .limit(8)
      .then(({ data }) => setLiquidations((data as LiquidationEnregistree[]) ?? []));
    void supabase
      .from(CLASSIFICATIONS_HS_TABLE)
      .select('id, description, code_propose, designation_tec, verifie_en_base, taux_dd, cree_le')
      .order('cree_le', { ascending: false })
      .limit(8)
      .then(({ data }) => setClassifications((data as ClassificationEnregistree[]) ?? []));
  }, [user]);

  /* Arrivée depuis la page de classification : on pose le code sur le premier
   * article sans rien demander. */
  useEffect(() => {
    const etat = emplacement.state as {
      classification?: { code: string | null; designation: string | null; taux_dd: number | null; verifie: boolean };
    } | null;
    const c = etat?.classification;
    if (!c?.code) return;
    setLignes((a) => {
      const suite = [...a];
      suite[0] = {
        ...suite[0],
        code_hs: c.code ?? '',
        designation: c.designation ?? suite[0].designation,
        designation_tec: c.designation ?? null,
        taux_dd: c.verifie ? c.taux_dd : null,
        verifie: !!c.verifie,
      };
      return suite;
    });
    toast.success(`Position ${c.code} reprise depuis la classification.`);
  }, [emplacement.state]);

  const maj = (cle: string, v: string) => setValeurs((x) => ({ ...x, [cle]: v }));

  /** Changer de devise repose le taux quand il est de droit, et le vide
   *  sinon : un taux d'euro appliqué à des yuans est un faux. */
  const majDevise = (code: string) =>
    setValeurs((v) => ({
      ...v,
      devise: code,
      taux_change: PARITES_FIXES[code] !== undefined ? String(PARITES_FIXES[code]) : '',
    }));

  const pariteDeDroit = PARITES_FIXES[valeurs.devise] !== undefined;
  const taux = nombre(valeurs.taux_change);

  const majLigne = (cle: number, champ: keyof LigneDeclaration, v: string) =>
    setLignes((l) =>
      l.map((x) =>
        x.cle === cle
          ? {
              ...x,
              [champ]: v,
              // Toucher au code HS à la main invalide la vérification : un
              // badge de confiance qui survit à la modification de la valeur
              // qu'il certifiait est pire que pas de badge.
              ...(champ === 'code_hs' ? { verifie: false, taux_dd: null, designation_tec: null } : {}),
            }
          : x,
      ),
    );

  const ajouterLigne = () => {
    const racines = lignes.filter((l) => !l.numero.includes('.'));
    setLignes((l) => [...l, ligneVide(String(racines.length + 1), prochaineCle)]);
    setProchaineCle((c) => c + 1);
  };

  const eclater = (l: LigneDeclaration) => {
    const numero = prochainSousNumero(lignes, l.numero);
    setLignes((x) => [...x, { ...ligneVide(numero, prochaineCle), designation: l.designation }]);
    setProchaineCle((c) => c + 1);
    toast.success(`Sous-ligne ${numero} créée.`);
  };

  /** La classification assistée, ligne par ligne. Le taux n'est posé QUE s'il
   *  est confirmé au tarif ; sinon rien, et l'écran le dit. */
  const classer = async (l: LigneDeclaration) => {
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
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
        toast.warning("Code proposé mais non confirmé au tarif : aucun taux n'est retenu.");
      }
    } catch {
      toast.error('Le service est injoignable.');
    } finally {
      setClassement(null);
    }
  };

  /** Le calcul, au moteur officiel. Rien n'est calculé ici. */
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
    setNumeroArchive(null);
    const { data, error } = await supabase.rpc('app_e08c374bc4_liquider_declaration', {
      // Les montants partent en francs CFA : le moteur travaille dans cette
      // monnaie, la conversion se fait ici une fois pour toutes.
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
      p_poids_brut_total: nombre(valeurs.masse_brute) || null,
      p_regime: valeurs.regime,
    });
    setCalcul(false);
    if (error) {
      toast.error(error.message);
      setLiquidation(null);
      return;
    }
    setLiquidation(data as Liquidation);
  };

  /** Reprendre une liquidation archivée : régime, valeurs, lignes et résultat. */
  const reprendreLiquidation = (l: LiquidationEnregistree) => {
    const r = l.resultat as unknown as Liquidation;
    setValeurs((v) => ({
      ...v,
      regime: l.regime,
      reference: l.numero,
      fret: String(Math.round(l.fret_fcfa)),
      assurance: String(Math.round(l.assurance_fcfa)),
      // L'archive est en francs CFA : on repose la devise en conséquence,
      // sinon les montants repris seraient reconvertis une seconde fois.
      devise: 'XOF',
      taux_change: '1',
      masse_brute: r?.globaux?.poids_brut_total_kg ? String(r.globaux.poids_brut_total_kg) : (v.masse_brute ?? ''),
    }));
    if (Array.isArray(r?.lignes) && r.lignes.length > 0) {
      setLignes(
        r.lignes.map((ligne, i) => ({
          ...ligneVide(ligne.numero ?? String(i + 1), i + 1),
          designation: ligne.designation ?? '',
          code_hs: ligne.position ?? '',
          designation_tec: ligne.designation_tec,
          taux_dd: ligne.verifie_en_base ? ligne.taux_dd : null,
          verifie: ligne.verifie_en_base,
          poids_brut: ligne.poids_brut_kg ? String(ligne.poids_brut_kg) : '',
          fob: ligne.fob_fcfa ? String(Math.round(ligne.fob_fcfa)) : '',
          unite: ligne.unite_us ?? 'U',
        })),
      );
      setProchaineCle(r.lignes.length + 1);
    }
    setLiquidation(r);
    toast.success(`Liquidation ${l.numero} reprise.`);
  };

  const reprendreClassification = (c: ClassificationEnregistree) => {
    setLignes((a) => {
      const suite = [...a];
      const vide = suite.findIndex((x) => !x.code_hs && !x.designation);
      const cible = vide >= 0 ? vide : suite.length;
      const base = vide >= 0 ? suite[cible] : ligneVide(String(suite.length + 1), prochaineCle);
      suite[cible] = {
        ...base,
        code_hs: c.code_propose ?? '',
        designation: c.description,
        designation_tec: c.designation_tec,
        taux_dd: c.verifie_en_base ? c.taux_dd : null,
        verifie: c.verifie_en_base,
      };
      return suite;
    });
    toast.success(`Position ${c.code_propose ?? ''} reprise.`);
  };

  /* ---------- Sommes en direct ---------- */
  const fobTotal = useMemo(() => lignes.reduce((t, l) => t + nombre(l.fob), 0), [lignes]);
  const cafTotalXof = useMemo(
    () => (fobTotal + nombre(valeurs.fret) + nombre(valeurs.assurance)) * taux,
    [fobTotal, valeurs.fret, valeurs.assurance, taux],
  );
  const manques = useMemo(() => manquesAvantDocument(valeurs, lignes), [valeurs, lignes]);

  /* ---------- Listes ---------- */
  const optionsCarnet = (role: string): OptionListe[] =>
    carnet
      .filter((i) => i.role === role)
      .map((i) => ({
        valeur: [i.nom, i.adresse, [i.ville, i.pays].filter(Boolean).join(', '), i.identifiant]
          .filter(Boolean)
          .join('\n'),
        libelle: i.nom,
        detail: [i.ville, i.pays, i.identifiant].filter(Boolean).join(' · ') || undefined,
      }));

  const optionsDe = (source: string): OptionListe[] => {
    if (source.startsWith('intervenant:')) return optionsCarnet(source.split(':')[1]);
    return (ref[source as keyof typeof ref] as OptionListe[]) ?? [];
  };

  /* Les libellés du document viennent du module partagé : cet écran et
   * l'atelier de cotation produisent le MÊME document, et deux tables
   * construites séparément finiraient par nommer un code différemment. */
  const libellesCodes = useMemo(() => libellesPourDocument(ref), [ref]);

  /* ---------- Archivage et document ---------- */
  const archiver = async () => {
    if (!liquidation) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Connectez-vous pour conserver cette liquidation.');
      return;
    }
    setArchivage(true);
    const { data, error } = await supabase.rpc('app_e08c374bc4_enregistrer_liquidation', {
      p_lignee: lignes.filter((l) => nombre(l.fob) > 0),
      p_resultat: liquidation,
      p_regime: valeurs.regime,
      p_fret: nombre(valeurs.fret) * taux,
      p_assurance: nombre(valeurs.assurance) * taux,
      p_intitule: valeurs.importateur?.split('\n')[0] || valeurs.reference || null,
    });
    setArchivage(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const numero = (data as { numero: string }).numero;
    setNumeroArchive(numero);
    if (!valeurs.reference) maj('reference', numero);
    toast.success(`Liquidation enregistrée sous ${numero}.`);
  };

  const produireDocument = async () => {
    if (!liquidation) {
      toast.error('Calculez les droits et taxes avant de générer le document.');
      return;
    }
    if (manques.length > 0) {
      toast.error(`Il manque ${manques.join(', ')}.`);
      return;
    }
    setEnDocument(true);
    try {
      /* On retient les intervenants au moment du document, pas à la frappe :
       * c'est là que la déclaration est jugée prête, et retenir une saisie
       * abandonnée remplirait le carnet de brouillons. */
      for (const [cle, role] of [
        ['exportateur', 'exportateur'],
        ['importateur', 'importateur'],
        ['declarant', 'declarant'],
      ] as const) {
        const brut = (valeurs[cle] ?? '').trim();
        if (brut.length < 3) continue;
        const [nom, ...reste] = brut.split('\n');
        await supabase.rpc('app_e08c374bc4_retenir_intervenant', {
          p_role: role,
          p_nom: nom,
          p_adresse: reste.join('\n') || null,
          p_pays: valeurs.pays_expedition || null,
        });
      }

      const { telechargerDeclarationPdf } = await import('@/lib/declaration-pdf');
      telechargerDeclarationPdf({ valeurs, lignes, liquidation, libelles: libellesCodes });
      toast.success('Document téléchargé.');
    } catch {
      toast.error("Le document n'a pas pu être produit.");
    } finally {
      setEnDocument(false);
    }
  };

  /* ---------- Rendu d'une case ---------- */
  const champ = (c: CaseDeclaration) => (
    <div key={c.cle} className={c.type === 'long' || c.icones ? 'sm:col-span-2' : ''}>
      <Label htmlFor={c.cle} className="flex items-baseline gap-1.5 text-xs">
        {c.numero !== '—' && (
          <span className="font-display font-bold tabular-nums text-primary">{c.numero}</span>
        )}
        <span>{c.libelle}</span>
      </Label>

      {c.icones ? (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {MODES_TRANSPORT.map((m) => {
            const Icone = ICONES_MODE[m.icone];
            const actif = valeurs[c.cle] === m.code;
            return (
              <button
                key={m.code}
                type="button"
                onClick={() => maj(c.cle, m.code)}
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
      ) : c.liste ? (
        <ChoixListe
          id={c.cle}
          options={optionsDe(c.liste)}
          valeur={valeurs[c.cle] ?? ''}
          onChange={(v) => maj(c.cle, v)}
          libre={c.libre}
          placeholder={
            c.liste.startsWith('intervenant:') ? 'Chercher dans vos contacts, ou saisir' : 'Chercher dans la liste'
          }
          aideLibre={c.liste === 'bureaux' ? 'Bureau hors liste — vérifiez son code avant le dépôt.' : undefined}
        />
      ) : c.type === 'long' ? (
        <Textarea id={c.cle} rows={2} value={valeurs[c.cle] ?? ''} onChange={(e) => maj(c.cle, e.target.value)} />
      ) : (
        <Input
          id={c.cle}
          type={c.type === 'date' ? 'date' : undefined}
          inputMode={c.type === 'nombre' ? 'numeric' : undefined}
          value={valeurs[c.cle] ?? ''}
          onChange={(e) => maj(c.cle, e.target.value)}
          className={c.type === 'nombre' ? 'tabular-nums' : undefined}
        />
      )}

      {c.aide && <p className="mt-0.5 text-xs text-muted-foreground">{c.aide}</p>}
    </div>
  );

  const enTeteBloc = (numero: number, titre: string, description: string) => (
    <>
      <div className="flex items-baseline gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-display text-xs font-bold text-primary">
          {numero}
        </span>
        <h2 className="font-display text-base font-bold text-foreground">{titre}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </>
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
          Chiffrer et préparer la déclaration
        </h1>
        <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
          Un seul écran, de la première case au document. Les cases portent leur numéro du modèle —
          c’est par lui qu’on ressaisit dans SYDAM. Les droits et taxes sont calculés par le moteur
          officiel sur le Tarif Extérieur Commun, jamais estimés ici.
        </p>

        {/* Reprendre plutôt que ressaisir. */}
        {(liquidations.length > 0 || classifications.length > 0) && (
          <section className="carte-reactive mt-6 rounded-xl border bg-muted/30 p-4" data-revele>
            <h2 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
              <Wand2 className="h-4 w-4 text-primary" />
              Reprendre un travail déjà fait
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {liquidations.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Calculator className="h-3.5 w-3.5" />
                    Liquidations
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {liquidations.map((l) => (
                      <Button key={l.id} size="sm" variant="outline" onClick={() => reprendreLiquidation(l)}>
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

        {/* ===== BLOCS 1 et 2 ===== */}
        {GROUPES_DECLARATION.map((g) => (
          <section key={g.numero} className="carte-reactive mt-5 rounded-xl border bg-card p-5" data-revele>
            {enTeteBloc(g.numero, g.titre, g.description)}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">{g.cases.map(champ)}</div>

            {/* Les valeurs monétaires vivent avec le bloc 2 : elles dépendent
                de la devise choisie juste au-dessus. */}
            {g.numero === 2 && (
              <>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label htmlFor="devise" className="flex items-baseline gap-1.5 text-xs">
                      <span className="font-display font-bold tabular-nums text-primary">22</span>
                      Devise de la facture
                    </Label>
                    <ChoixListe
                      id="devise"
                      options={ref.monnaies}
                      valeur={valeurs.devise ?? ''}
                      onChange={majDevise}
                      placeholder="Chercher une devise"
                    />
                  </div>

                  <div>
                    <Label htmlFor="taux_change" className="flex items-baseline gap-1.5 text-xs">
                      <span className="font-display font-bold tabular-nums text-primary">23</span>
                      Taux de change vers le franc CFA
                    </Label>
                    <div className="relative">
                      <Input
                        id="taux_change"
                        inputMode="decimal"
                        value={valeurs.taux_change ?? ''}
                        readOnly={pariteDeDroit}
                        onChange={(e) => maj('taux_change', e.target.value)}
                        className={'tabular-nums ' + (pariteDeDroit ? 'bg-muted/50 pr-9' : '')}
                      />
                      {pariteDeDroit && (
                        <Lock className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {pariteDeDroit ? 'Parité fixe de droit — elle ne se saisit pas.' : 'Taux du jour retenu.'}
                    </p>
                  </div>

                  {(
                    [
                      ['fret', '12', 'Fret total'],
                      ['assurance', '12', 'Assurance totale'],
                    ] as const
                  ).map(([cle, num, libelle]) => (
                    <div key={cle}>
                      <Label htmlFor={cle} className="flex items-baseline gap-1.5 text-xs">
                        <span className="font-display font-bold tabular-nums text-primary">{num}</span>
                        {libelle}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={cle}
                          inputMode="decimal"
                          value={valeurs[cle] ?? ''}
                          onChange={(e) => maj(cle, e.target.value)}
                          className="tabular-nums"
                        />
                        <span className="shrink-0 text-sm font-medium text-muted-foreground">
                          {valeurs.devise}
                        </span>
                      </div>
                    </div>
                  ))}

                  {(
                    [
                      ['nombre_articles', '5', 'Nombre d’articles', true],
                      ['total_colis', '6', 'Total des colis', false],
                      ['masse_brute', '35', 'Masse brute totale (kg)', false],
                      ['masse_nette', '38', 'Masse nette totale (kg)', false],
                    ] as const
                  ).map(([cle, num, libelle, auto]) => (
                    <div key={cle}>
                      <Label htmlFor={cle} className="flex items-baseline gap-1.5 text-xs">
                        <span className="font-display font-bold tabular-nums text-primary">{num}</span>
                        {libelle}
                      </Label>
                      <Input
                        id={cle}
                        inputMode="numeric"
                        value={auto ? String(lignes.filter((l) => nombre(l.fob) > 0).length) : (valeurs[cle] ?? '')}
                        readOnly={auto}
                        onChange={(e) => maj(cle, e.target.value)}
                        className={'tabular-nums ' + (auto ? 'bg-muted/50' : '')}
                      />
                    </div>
                  ))}
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

                  <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-4">
                    <div className="flex items-center gap-1.5">
                      <Coins className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <span className="font-display font-bold text-primary">46</span> Valeur en
                        douane (CAF)
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
              </>
            )}
          </section>
        ))}

        {/* ===== BLOC 3 — ARTICLES ===== */}
        <section className="carte-reactive mt-5 rounded-xl border bg-card p-5" data-revele>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {enTeteBloc(
                3,
                'Articles et positions tarifaires',
                'Une ligne par position. Éclatez une ligne quand un même colis en porte deux.',
              )}
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
                    (sousLigne ? 'border-dashed bg-muted/20 sm:ml-6' : 'bg-card')
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-sm font-bold tabular-nums text-foreground">
                      <span className="mr-1.5 text-primary">32</span>
                      Article {l.numero}
                      {sousLigne && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">sous-ligne</span>
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

                  <div className="mt-3 space-y-3">
                    <div>
                      <Label htmlFor={`des-${l.cle}`} className="flex items-baseline gap-1.5 text-xs">
                        <span className="font-display font-bold tabular-nums text-primary">31</span>
                        Désignation des marchandises
                      </Label>
                      <Input
                        id={`des-${l.cle}`}
                        value={l.designation}
                        onChange={(e) => majLigne(l.cle, 'designation', e.target.value)}
                        placeholder="Matière, fonction, usage — plus c'est précis, mieux c'est classé"
                      />
                    </div>

                    <div>
                      <Label htmlFor={`hs-${l.cle}`} className="flex items-baseline gap-1.5 text-xs">
                        <span className="font-display font-bold tabular-nums text-primary">33</span>
                        Code des marchandises (HS)
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
                          className="bouton-anime shrink-0"
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

                  {(l.designation_tec || l.verifie) && (
                    <div
                      className={
                        'mt-3 rounded-md border p-3 ' +
                        (l.verifie ? 'border-emerald-600/40 bg-emerald-50/40' : 'border-amber-500/50 bg-amber-50/40')
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

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {CASES_ARTICLE.filter((c) => !['designation', 'code_hs'].includes(c.cle)).map((c) => (
                      <div key={c.cle}>
                        <Label htmlFor={`${c.cle}-${l.cle}`} className="flex items-baseline gap-1.5 text-xs">
                          <span className="font-display font-bold tabular-nums text-primary">{c.numero}</span>
                          {c.cle === 'fob' ? `Prix FOB (${valeurs.devise})` : c.libelle}
                        </Label>
                        {c.cle === 'unite' ? (
                          <ChoixListe
                            id={`unite-${l.cle}`}
                            options={UNITES.map((u) => ({ valeur: u.code, libelle: u.libelle }))}
                            valeur={l.unite}
                            onChange={(v) => majLigne(l.cle, 'unite', v)}
                            placeholder="Unité"
                          />
                        ) : c.liste ? (
                          <ChoixListe
                            id={`${c.cle}-${l.cle}`}
                            options={optionsDe(c.liste)}
                            valeur={l[c.cle as keyof LigneDeclaration] as string}
                            onChange={(v) => majLigne(l.cle, c.cle as keyof LigneDeclaration, v)}
                            placeholder="Chercher"
                          />
                        ) : (
                          <Input
                            id={`${c.cle}-${l.cle}`}
                            inputMode={c.type === 'nombre' ? 'decimal' : undefined}
                            value={l[c.cle as keyof LigneDeclaration] as string}
                            onChange={(e) => majLigne(l.cle, c.cle as keyof LigneDeclaration, e.target.value)}
                            className={c.type === 'nombre' ? 'tabular-nums' : undefined}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Le détail proratisé : repliable pour ne pas noyer l'écran,
                      jamais masqué — c'est une exigence de traçabilité. */}
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

        {/* ===== BLOC 4 — RÉCAPITULATIF ===== */}
        <section
          className="carte-reactive mt-5 rounded-xl border-2 border-primary/40 bg-primary/5 p-5"
          data-revele
        >
          {enTeteBloc(4, 'Récapitulatif et liquidation', 'Le calcul officiel, puis le document.')}

          <Button size="lg" className="bouton-anime mt-4" onClick={() => void liquider()} disabled={calcul}>
            {calcul ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
            Calculer les droits et taxes
          </Button>

          {liquidation && (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-4">
                {(
                  [
                    ['FOB total', liquidation.globaux.fob_total_fcfa],
                    ['Fret total', liquidation.globaux.fret_total_fcfa],
                    ['Assurance totale', liquidation.globaux.assurance_total_fcfa],
                    ['CAF total', liquidation.globaux.caf_total_fcfa],
                  ] as const
                ).map(([libelle, montant], i) => (
                  <div key={libelle}>
                    <p className="text-xs text-muted-foreground">{libelle}</p>
                    <p
                      className={
                        'font-display tabular-nums ' +
                        (i === 3 ? 'text-base font-extrabold text-foreground' : 'text-sm font-bold')
                      }
                    >
                      {fcfa(montant)}
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
                    {taxesOrdonnees(liquidation.totaux_taxes).map(([code, montant]) => (
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
                <Button size="lg" className="bouton-anime" onClick={() => void produireDocument()} disabled={enDocument}>
                  {enDocument ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                  Générer le document
                </Button>

                {numeroArchive ? (
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Enregistrée sous <strong className="tabular-nums text-foreground">{numeroArchive}</strong>
                    <Link to="/declarant/historique" className="font-medium text-primary hover:underline">
                      Voir l’historique
                    </Link>
                  </p>
                ) : (
                  <Button variant="outline" onClick={() => void archiver()} disabled={archivage}>
                    {archivage ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                    Enregistrer dans mon historique
                  </Button>
                )}

                {manques.length > 0 && (
                  <p className="text-xs text-amber-700">Il manque {manques.join(', ')}.</p>
                )}
              </div>

              <p className="rounded-md border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Document d’aide au calcul.</strong> Tarif
                appliqué : {liquidation.tarif.libelle}, version du{' '}
                {new Date(liquidation.tarif.date_version).toLocaleDateString('fr-FR')}. La
                déclaration officielle doit être saisie dans le système douanier (SYDAM).
              </p>
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
