import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plane, Zap, Ship, Truck, ArrowRight, Loader2, Info } from 'lucide-react';
import { useReferencement } from '@/hooks/useReferencement';
import { PAGES } from '@/lib/referencement-pages';

/**
 * Le calculateur de poids taxable.
 *
 * C'est le cœur du métier de la maison — aérien, express, groupage et
 * dégroupage — rendu public et gratuit.
 *
 * Pourquoi cet outil plutôt qu'un autre : parce que la mauvaise surprise la
 * plus fréquente de l'import n'est pas le droit de douane, c'est le poids
 * facturé. On ne paie pas ce que la balance affiche, on paie le plus grand du
 * poids réel et du poids volumétrique. Quatre cartons de coussins pèsent 32 kg
 * et se facturent 80. Personne ne le dit avant, tout le monde le découvre
 * après.
 *
 * Le calcul vit en base, avec les diviseurs : ils varient d'une compagnie à
 * l'autre et doivent pouvoir être corrigés sans redéploiement. L'écran ne fait
 * que présenter.
 */

const MODES = [
  {
    code: 'aerien',
    nom: 'Aérien',
    icone: Plane,
    aide: 'Diviseur IATA de 6 000 cm³/kg',
  },
  {
    code: 'express',
    nom: 'Express',
    icone: Zap,
    aide: 'Diviseur de 5 000 cm³/kg',
  },
  {
    code: 'maritime',
    nom: 'Groupage maritime',
    icone: Ship,
    aide: 'Unité payante : le plus grand du m³ et de la tonne',
  },
  {
    code: 'routier',
    nom: 'Routier',
    icone: Truck,
    aide: 'Équivalence de 333 kg par m³',
  },
] as const;

interface Resultat {
  calculable: boolean;
  motif?: string;
  mode?: string;
  volume_m3?: number;
  poids_reel_kg?: number;
  poids_volumique_kg?: number;
  poids_taxable_kg?: number;
  facture_au_poids?: boolean;
  unite_facturation?: string;
  unites_payantes?: number | null;
  retenu?: 'volumique' | 'reel';
  diviseur_cm3_par_kg?: number | null;
  source?: string;
  explication?: string;
}

const nombre = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && v.trim() !== '' ? n : null;
};

export default function PoidsTaxable() {
  useReferencement(PAGES["/poids-taxable"]);

  const [mode, setMode] = useState<string>('aerien');
  const [poids, setPoids] = useState('');
  const [longueur, setLongueur] = useState('');
  const [largeur, setLargeur] = useState('');
  const [hauteur, setHauteur] = useState('');
  const [colis, setColis] = useState('1');
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [calcul, setCalcul] = useState(false);
  const [erreur, setErreur] = useState('');

  const calculer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');
    const l = nombre(longueur);
    const w = nombre(largeur);
    const h = nombre(hauteur);
    if (l === null || w === null || h === null) {
      setErreur('Renseignez les trois dimensions, en centimètres.');
      return;
    }
    setCalcul(true);
    const { data, error } = await supabase.rpc('app_e08c374bc4_poids_taxable', {
      p_mode: mode,
      p_poids_reel_kg: nombre(poids) ?? 0,
      p_longueur_cm: l,
      p_largeur_cm: w,
      p_hauteur_cm: h,
      p_colis: Math.max(1, Math.round(nombre(colis) ?? 1)),
    });
    setCalcul(false);
    if (error) {
      setErreur('Calcul impossible pour le moment. Réessayez.');
      return;
    }
    setResultat(data as Resultat);
  };

  const modeChoisi = MODES.find((m) => m.code === mode)!;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />

      <main className="entree-page mx-auto max-w-screen-lg px-4 py-10 sm:px-6">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Combien pèse vraiment votre envoi ?
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            La mauvaise surprise la plus fréquente de l’import n’est pas la douane, c’est le poids
            facturé. On ne paie pas ce qu’affiche la balance : on paie{' '}
            <strong className="text-foreground">le plus grand du poids réel et du poids volumétrique</strong>.
            Quatre cartons de coussins pèsent 32 kg et se facturent 80.
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* ---------- La saisie ---------- */}
          <form onSubmit={calculer} className="rounded-xl border bg-card p-6">
            <fieldset>
              <legend className="text-sm font-semibold text-foreground">Mode d’expédition</legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {MODES.map((m) => {
                  const Icone = m.icone;
                  const actif = m.code === mode;
                  return (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => {
                        setMode(m.code);
                        setResultat(null);
                      }}
                      aria-pressed={actif}
                      className={
                        'flex items-center gap-2 rounded-lg border p-3 text-left text-sm font-medium transition ' +
                        (actif
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'text-muted-foreground hover:border-primary/40 hover:text-foreground')
                      }
                    >
                      <Icone className="h-4 w-4 shrink-0" />
                      {m.nom}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {modeChoisi.aide}
              </p>
            </fieldset>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="poids">Poids réel total (kg)</Label>
                <Input
                  id="poids"
                  inputMode="decimal"
                  value={poids}
                  onChange={(e) => setPoids(e.target.value)}
                  placeholder="32"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="colis">Nombre de colis</Label>
                <Input
                  id="colis"
                  inputMode="numeric"
                  value={colis}
                  onChange={(e) => setColis(e.target.value)}
                />
              </div>
            </div>

            <p className="mt-5 text-sm font-semibold text-foreground">
              Dimensions d’un colis, en centimètres
            </p>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {[
                { id: 'longueur', label: 'Longueur', v: longueur, set: setLongueur, ex: '60' },
                { id: 'largeur', label: 'Largeur', v: largeur, set: setLargeur, ex: '40' },
                { id: 'hauteur', label: 'Hauteur', v: hauteur, set: setHauteur, ex: '50' },
              ].map((c) => (
                <div key={c.id} className="space-y-1.5">
                  <Label htmlFor={c.id} className="text-xs">
                    {c.label}
                  </Label>
                  <Input
                    id={c.id}
                    inputMode="decimal"
                    value={c.v}
                    onChange={(e) => c.set(e.target.value)}
                    placeholder={c.ex}
                  />
                </div>
              ))}
            </div>

            {erreur && (
              <p className="mt-4 text-sm text-destructive" role="alert">
                {erreur}
              </p>
            )}

            <Button type="submit" size="lg" className="mt-6 w-full" disabled={calcul}>
              {calcul && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Calculer le poids taxable
            </Button>
          </form>

          {/* ---------- Le résultat ---------- */}
          <div>
            {!resultat ? (
              <div className="flex h-full min-h-64 items-center justify-center rounded-xl border border-dashed p-8 text-center">
                <p className="max-w-xs text-sm text-muted-foreground">
                  Renseignez les dimensions d’un colis et son poids : le calcul suit la méthode
                  appliquée par les compagnies, pas une approximation.
                </p>
              </div>
            ) : !resultat.calculable ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
                <p className="text-sm text-foreground">{resultat.motif}</p>
              </div>
            ) : (
              <div className="rounded-xl border bg-card p-6">
                <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {resultat.facture_au_poids ? 'Poids taxable' : 'Unités payantes'}
                </p>
                <p className="mt-2 font-display text-5xl font-extrabold tabular-nums text-primary">
                  {resultat.facture_au_poids
                    ? resultat.poids_taxable_kg?.toLocaleString('fr-FR')
                    : resultat.unites_payantes?.toLocaleString('fr-FR')}
                  <span className="ml-2 text-xl font-semibold text-foreground">
                    {resultat.unite_facturation}
                  </span>
                </p>

                <dl className="mt-6 space-y-2 border-t pt-4 text-sm">
                  {[
                    ['Volume total', `${resultat.volume_m3?.toLocaleString('fr-FR')} m³`],
                    ['Poids réel', `${resultat.poids_reel_kg?.toLocaleString('fr-FR')} kg`],
                    [
                      'Poids volumétrique',
                      `${resultat.poids_volumique_kg?.toLocaleString('fr-FR')} kg`,
                    ],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="tabular-nums text-foreground">{v}</dd>
                    </div>
                  ))}
                  {resultat.diviseur_cm3_par_kg && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Diviseur appliqué</dt>
                      <dd className="tabular-nums text-foreground">
                        {resultat.diviseur_cm3_par_kg.toLocaleString('fr-FR')} cm³/kg
                      </dd>
                    </div>
                  )}
                </dl>

                <p className="mt-5 rounded-lg bg-muted/60 p-4 text-sm leading-relaxed text-foreground">
                  {resultat.explication}
                </p>

                {/* Le fret n'est pas une constante : le dire ici évite qu'un
                    visiteur prenne ce calcul pour un devis. */}
                <p className="mt-4 text-xs text-muted-foreground">
                  Ce calcul donne le poids que la compagnie facturera. Le tarif au kilo, lui, varie
                  selon la période, la ligne et le volume traité — il se demande avant chaque envoi.
                </p>

                <Button asChild className="mt-5 w-full">
                  <Link to="/import/nouvelle-demande">
                    Obtenir une cotation pour cet envoi
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ---------- Ce que le calcul change ---------- */}
        <section className="mt-16 rounded-xl border bg-muted/40 p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold text-foreground">
            Trois choses que ce calcul vous fait gagner
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {[
              {
                titre: 'Choisir le bon mode',
                texte:
                  'Une marchandise dense part souvent moins cher en aérien qu’on ne le croit ; une marchandise volumineuse coûte beaucoup plus. Le comparatif se fait avant, pas après.',
              },
              {
                titre: 'Négocier le bon emballage',
                texte:
                  'Cinq centimètres de carton en moins par colis peuvent faire descendre une expédition d’une tranche de poids entière.',
              },
              {
                titre: 'Vérifier une facture',
                texte:
                  'Si le poids facturé ne correspond pas à ce calcul, vous avez de quoi le dire — avec la méthode et le diviseur à l’appui.',
              },
            ].map((c) => (
              <div key={c.titre}>
                <h3 className="font-display text-base font-bold text-foreground">{c.titre}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.texte}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
