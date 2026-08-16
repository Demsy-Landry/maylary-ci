import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  type Liquidation,
  type ClassificationHs,
} from '@/lib/supabase';
import {
  ligneVide,
  taxesOrdonnees,
  type LigneDeclaration,
} from '@/lib/declaration';
import type { Referentiels } from '@/hooks/useReferentiels';
import ChoixListe from '@/components/ChoixListe';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Calculator, Plus, Trash2, Sparkles, Loader2, CheckCircle2, AlertTriangle, ArrowDownToLine,
} from 'lucide-react';

/**
 * Le chiffrage douanier de l'atelier de cotation.
 *
 * CE QU'IL REMPLACE
 *
 * « Douane estimée » était un champ vide où l'administrateur tapait un nombre.
 * Rien ne disait d'où il venait. Sur un devis remis à un client, la ligne la
 * plus lourde après la marchandise reposait donc sur une estimation de tête —
 * et une estimation basse se paie au dédouanement, en trésorerie, une fois la
 * marchandise déjà achetée.
 *
 * LE MÊME MOTEUR QUE LE DÉCLARANT, PAS UN SECOND
 *
 * Le calcul part à `app_e08c374bc4_liquider_declaration`, exactement comme
 * l'écran de déclaration. Les lignes sont des `LigneDeclaration`, le document
 * est produit par le même module. Un second moteur « pour l'atelier » aurait
 * fini par diverger de celui qui fait foi, et c'est le client qui aurait
 * découvert l'écart entre son devis et sa facture.
 *
 * CE QUI RESTE INTERDIT ICI COMME AILLEURS
 *
 * Si la position n'est pas confirmée au tarif, aucun taux n'est retenu et
 * l'écran le dit. Un chiffre inventé sur un devis est pire que pas de chiffre :
 * le premier engage, le second fait poser la question.
 */

const nombre = (v: string) => {
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export interface ChiffrageDouanier {
  regime: string;
  pays_origine: string;
  lignes: LigneDeclaration[];
  liquidation: Liquidation;
  calcule_le: string;
}

interface Props {
  /** Chargés une fois par l'écran parent, qui s'en sert aussi pour le document. */
  referentiels: Referentiels;
  /** Pré-remplit la première ligne : on ne resaisit pas ce que la demande dit déjà. */
  descriptionProduit: string;
  valeurMarchandiseFcfa: number;
  poidsKg: number | null;
  paysFournisseur: string | null;
  /** Déjà saisis dans la cotation : ils entrent dans la valeur en douane, pas une deuxième fois. */
  fretFcfa: number;
  assuranceFcfa: number;
  /** Chiffrage déjà enregistré sur la demande, repris tel quel. */
  initial: ChiffrageDouanier | null;
  /** Reporte le total dans « Douane estimée » et enregistre le chiffrage. */
  onRetenir: (chiffrage: ChiffrageDouanier) => void;
}

export default function ChiffrageDouanier({
  referentiels: ref,
  descriptionProduit,
  valeurMarchandiseFcfa,
  poidsKg,
  paysFournisseur,
  fretFcfa,
  assuranceFcfa,
  initial,
  onRetenir,
}: Props) {
  const [regime, setRegime] = useState(initial?.regime ?? '4000');
  const [origine, setOrigine] = useState(initial?.pays_origine ?? paysFournisseur ?? '');
  const [lignes, setLignes] = useState<LigneDeclaration[]>(
    initial?.lignes ?? [
      {
        ...ligneVide('1', 0),
        designation: descriptionProduit.slice(0, 300),
        fob: valeurMarchandiseFcfa > 0 ? String(Math.round(valeurMarchandiseFcfa)) : '',
        poids_brut: poidsKg ? String(poidsKg) : '',
        origine: paysFournisseur ?? '',
      },
    ],
  );
  const [prochaineCle, setProchaineCle] = useState((initial?.lignes.length ?? 1) + 1);
  const [liquidation, setLiquidation] = useState<Liquidation | null>(initial?.liquidation ?? null);
  const [refus, setRefus] = useState<string | null>(null);
  const [calcul, setCalcul] = useState(false);
  const [classement, setClassement] = useState<number | null>(null);

  const fobTotal = useMemo(() => lignes.reduce((t, l) => t + nombre(l.fob), 0), [lignes]);
  const cafTotal = fobTotal + fretFcfa + assuranceFcfa;

  const majLigne = (cle: number, champ: keyof LigneDeclaration, valeur: string) =>
    setLignes((a) =>
      a.map((l) =>
        l.cle === cle
          ? {
              ...l,
              [champ]: valeur,
              // Changer le code à la main invalide ce que la classification avait
              // confirmé : on ne garde pas un taux rattaché à un autre code.
              ...(champ === 'code_hs' ? { verifie: false, taux_dd: null, designation_tec: null } : {}),
            }
          : l,
      ),
    );

  const ajouterLigne = () => {
    setLignes((a) => [...a, { ...ligneVide(String(a.length + 1), prochaineCle), origine }]);
    setProchaineCle((c) => c + 1);
  };

  const retirerLigne = (cle: number) =>
    setLignes((a) => {
      const reste = a.filter((l) => l.cle !== cle);
      return reste.map((l, i) => ({ ...l, numero: String(i + 1) }));
    });

  /** La classification assistée, ligne par ligne — le même service que Le Déclarant. */
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
      toast.error('Session expirée, reconnectez-vous.');
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
      toast.error('Le service de classification est injoignable.');
    } finally {
      setClassement(null);
    }
  };

  /** Le calcul officiel. Rien n'est calculé dans le navigateur. */
  const liquider = async () => {
    const utiles = lignes.filter((l) => nombre(l.fob) > 0);
    if (utiles.length === 0) {
      toast.error('Renseignez au moins une ligne avec une valeur marchandise.');
      return;
    }
    if (utiles.some((l) => !l.code_hs.trim())) {
      toast.error('Chaque ligne a besoin de sa position tarifaire.');
      return;
    }
    setCalcul(true);
    setRefus(null);
    const { data, error } = await supabase.rpc('app_e08c374bc4_liquider_declaration', {
      p_lignes: utiles.map((l) => ({
        numero: l.numero,
        designation: l.designation || null,
        position: l.code_hs || null,
        taux_dd: null,
        fob: nombre(l.fob),
        poids_brut: nombre(l.poids_brut),
      })),
      p_fret_total: fretFcfa,
      p_assurance_total: assuranceFcfa,
      p_poids_brut_total: null,
      p_regime: regime,
    });
    setCalcul(false);
    if (error) {
      /* Le refus du moteur est une INFORMATION, pas un incident. Sous un
       * régime qui appelle des droits, une position absente du corpus TEC
       * fait échouer le calcul plutôt que de rendre un taux deviné. Le
       * message nomme l'article et le code fautifs : il doit rester à
       * l'écran, pas s'effacer avec une notification. */
      setRefus(error.message);
      setLiquidation(null);
      return;
    }
    setRefus(null);
    setLiquidation(data as Liquidation);
  };

  const retenir = () => {
    if (!liquidation) return;
    onRetenir({
      regime,
      pays_origine: origine,
      lignes: lignes.filter((l) => nombre(l.fob) > 0),
      liquidation,
      calcule_le: new Date().toISOString(),
    });
  };

  /**
   * Les positions absentes du corpus TEC.
   *
   * Sous un régime qui appelle des droits, ce cas n'arrive pas : le moteur
   * refuse le calcul plutôt que de deviner un taux. Il n'arrive que sous un
   * régime SANS droits — une exportation, un transit — et là le zéro n'est
   * pas une estimation manquante, c'est l'absence de droit. Le dire autrement
   * ferait douter d'un chiffre parfaitement juste.
   */
  const sansDroits = liquidation ? !liquidation.regime.droits_exigibles : false;
  const nonConfirmees = liquidation?.lignes.filter((l) => !l.verifie_en_base).length ?? 0;

  return (
    <div className="space-y-3 rounded-md border border-primary/30 bg-primary/[0.03] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Calculator className="h-4 w-4 text-primary" />
          Chiffrage douanier
        </p>
        <p className="text-[11px] text-muted-foreground">
          Moteur officiel — Tarif Extérieur Commun
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Régime douanier</Label>
          <ChoixListe
            options={ref.regimes}
            valeur={regime}
            onChange={setRegime}
            placeholder="Chercher un régime"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Pays d'origine</Label>
          <ChoixListe
            options={ref.pays}
            valeur={origine}
            onChange={(v) => {
              setOrigine(v);
              setLignes((a) => a.map((l) => (l.origine ? l : { ...l, origine: v })));
            }}
            placeholder="Chercher un pays"
          />
        </div>
      </div>

      {/* Le fret et l'assurance viennent de la cotation : les redemander ici
          ferait deux vérités pour un seul dossier. */}
      <p className="rounded-md bg-muted/60 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
        Valeur en douane = marchandise {fcfa(fobTotal)} + fret {fcfa(fretFcfa)} + assurance{' '}
        {fcfa(assuranceFcfa)} ={' '}
        <strong className="text-foreground">{fcfa(cafTotal)}</strong>
        {fretFcfa === 0 && (
          <span className="ml-1 text-amber-700">
            — le fret n'est pas encore saisi dans la cotation.
          </span>
        )}
      </p>

      <div className="space-y-2">
        {lignes.map((l) => (
          <div key={l.cle} className="space-y-2 rounded-md border bg-card p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">Article {l.numero}</span>
              <div className="flex items-center gap-1">
                {l.verifie && (
                  <Badge variant="outline" className="gap-1 border-emerald-500/40 text-[10px] text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    {l.taux_dd} % confirmé
                  </Badge>
                )}
                {lignes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => retirerLigne(l.cle)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label={`Retirer l'article ${l.numero}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <Input
              value={l.designation}
              onChange={(e) => majLigne(l.cle, 'designation', e.target.value)}
              placeholder="Matière, fonction, usage — plus c'est précis, mieux c'est classé"
              className="text-sm"
            />

            <div className="flex gap-2">
              <Input
                value={l.code_hs}
                onChange={(e) => majLigne(l.cle, 'code_hs', e.target.value)}
                placeholder="0000.00.00.00"
                className="font-mono text-sm tabular-nums"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => classer(l)}
                disabled={classement === l.cle}
              >
                {classement === l.cle ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5">Classer</span>
              </Button>
            </div>

            {l.designation_tec && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">{l.designation_tec}</p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Valeur marchandise (FCFA)</Label>
                <Input
                  inputMode="decimal"
                  value={l.fob}
                  onChange={(e) => majLigne(l.cle, 'fob', e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Masse brute (kg)</Label>
                <Input
                  inputMode="decimal"
                  value={l.poids_brut}
                  onChange={(e) => majLigne(l.cle, 'poids_brut', e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={ajouterLigne}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Ajouter un article
        </Button>
      </div>

      <Button type="button" size="sm" onClick={liquider} disabled={calcul} className="w-full sm:w-auto">
        {calcul ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
        Calculer les droits et taxes
      </Button>

      {refus && (
        <div className="flex items-start gap-2 rounded-md border border-amber-400/50 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="block">Le calcul n’a pas abouti.</strong>
            {refus}
            <span className="mt-1 block text-amber-800">
              Aucun montant n’est retenu : mieux vaut un devis en attente qu’un devis faux.
              Vérifiez la position au tarif, ou faites classer l’article.
            </span>
          </span>
        </div>
      )}

      {liquidation && (
        <div className="space-y-2 rounded-md border bg-card p-3">
          {sansDroits && (
            <p className="rounded-md bg-muted/60 p-2 text-[11px] leading-relaxed text-muted-foreground">
              Régime {liquidation.regime.code} — {liquidation.regime.libelle} : aucun droit de douane
              n’est exigible.
              {nonConfirmees > 0 && ' Les positions non confirmées au tarif ne changent donc rien au total.'}
            </p>
          )}

          <table className="w-full text-xs">
            <tbody className="divide-y">
              {taxesOrdonnees(liquidation.totaux_taxes).map(([code, montant]) => (
                <tr key={code}>
                  <td className="py-1.5 font-medium text-foreground">
                    {code}
                    {code === 'TS' && (
                      <span className="ml-1.5 font-normal text-muted-foreground">par déclaration</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-bold tabular-nums text-foreground">
                    {fcfa(montant)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
            <span className="text-sm font-semibold text-foreground">
              Total douane : {fcfa(liquidation.total_a_payer_fcfa)}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={retenir}>
              <ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" />
              Reporter dans « Douane estimée »
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
