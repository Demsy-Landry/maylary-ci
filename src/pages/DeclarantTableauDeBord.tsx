import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import NavDeclarant from '@/components/NavDeclarant';
import SiteFooter from '@/components/SiteFooter';
import { supabase, type TableauDeBordDeclarant } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useReferencement } from '@/hooks/useReferencement';
import {
  Gauge,
  Sparkles,
  Calculator,
  Coins,
  ArrowRight,
  CreditCard,
  Wrench,
  Lock,
} from 'lucide-react';

/**
 * Le tableau de bord de l'abonné.
 *
 * Un tableau de bord de service se juge à une question : « où j'en suis ? ».
 * Trois réponses, dans cet ordre :
 *
 *  1. **Ce qu'il me reste aujourd'hui.** C'est la seule information qui peut
 *     bloquer quelqu'un dans l'heure qui vient, donc elle passe devant.
 *  2. **Ce que j'ai produit.** Classifications, liquidations, droits calculés :
 *     un abonné qui voit ce que le service lui a fait gagner renouvelle.
 *  3. **Ce que j'ai fait récemment**, avec un lien pour y retourner.
 *
 * La courbe de consommation est dessinée à la main en SVG plutôt qu'avec une
 * bibliothèque : trente points ne justifient pas cent kilo-octets de plus à
 * charger sur une liaison mobile.
 */

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const jour = (s: string) =>
  new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

/** La courbe des trente derniers jours, en SVG nu. */
function Courbe({ points, plafond }: { points: { jour: string; n: number }[]; plafond: number }) {
  // On reconstitue les trente jours : les jours sans usage n'existent pas en
  // base, et une courbe qui saute les jours creux ment sur le rythme.
  const parJour = new Map(points.map((p) => [p.jour.slice(0, 10), p.n]));
  const serie = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const cle = d.toISOString().slice(0, 10);
    return { cle, n: parJour.get(cle) ?? 0 };
  });

  const max = Math.max(plafond, ...serie.map((s) => s.n), 1);
  const L = 600;
  const H = 90;
  const chemin = serie
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${(i / 29) * L} ${H - (s.n / max) * H}`)
    .join(' ');
  const aire = `${chemin} L ${L} ${H} L 0 ${H} Z`;
  const total = serie.reduce((t, s) => t + s.n, 0);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Trente derniers jours
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {total} requête{total > 1 ? 's' : ''}
        </p>
      </div>
      {total === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Aucune requête ce mois-ci. La courbe se dessinera dès la première.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${L} ${H}`}
          className="mt-3 h-24 w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${total} requêtes sur trente jours`}
        >
          <path d={aire} className="fill-primary/15" />
          <path d={chemin} className="fill-none stroke-primary" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </div>
  );
}

function Compteur({
  icone: Icone,
  titre,
  valeur,
  detail,
  accent,
}: {
  icone: typeof Gauge;
  titre: string;
  valeur: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        'carte-reactive reflet rounded-xl border p-5 ' +
        (accent ? 'border-primary/40 bg-primary/5' : 'bg-card')
      }
    >
      <div className="flex items-center gap-1.5">
        <Icone className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titre}</p>
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold tabular-nums text-foreground">{valeur}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

export default function DeclarantTableauDeBord() {
  useReferencement({
    titre: "Tableau de bord du Déclarant",
    description:
      "Votre activité sur les outils douaniers.",
    horsIndex: true,
  });

  const { user, loading: authLoading } = useAuth();
  const [tb, setTb] = useState<TableauDeBordDeclarant | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void supabase.rpc('app_e08c374bc4_declarant_tableau_de_bord').then(({ data, error }) => {
      if (error) setErreur(error.message);
      else setTb(data as TableauDeBordDeclarant);
    });
  }, [user]);

  const part =
    tb && tb.aujourdhui.plafond > 0
      ? Math.min(100, Math.round((tb.aujourdhui.utilisees / tb.aujourdhui.plafond) * 100))
      : 0;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <NavDeclarant />

      <main className="entree-page mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <h1 className="trait-anime font-display text-2xl font-extrabold text-foreground">
          Tableau de bord
        </h1>

        {authLoading ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : !user ? (
          <div className="mt-8 rounded-xl border border-dashed p-10 text-center">
            <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Votre tableau de bord suit votre consommation et votre production. Il faut être
              connecté pour le voir.
            </p>
            <Button asChild className="bouton-anime mt-5">
              <Link to="/boutique/compte?retour=/declarant/tableau-de-bord">Se connecter</Link>
            </Button>
          </div>
        ) : erreur ? (
          <p className="mt-8 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {erreur}
          </p>
        ) : !tb ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* 1. Ce qui peut bloquer aujourd'hui. */}
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-revele-cascade>
              <Compteur
                icone={Gauge}
                titre="Requêtes restantes aujourd’hui"
                valeur={`${tb.aujourdhui.restant} / ${tb.aujourdhui.plafond}`}
                detail={`Formule ${tb.formule.libelle}. Le compteur repart à zéro chaque jour.`}
                accent
              />
              <Compteur
                icone={Sparkles}
                titre="Classifications"
                valeur={tb.production.classifications.toLocaleString('fr-FR')}
                detail="Marchandises classées et conservées dans votre historique."
              />
              <Compteur
                icone={Calculator}
                titre="Liquidations"
                valeur={tb.production.liquidations.toLocaleString('fr-FR')}
                detail="Bulletins calculés, réimprimables à l’identique."
              />
              <Compteur
                icone={Coins}
                titre="Droits calculés"
                valeur={fcfa(tb.production.droits_calcules_fcfa)}
                detail="Somme des liquidations enregistrées sur ce compte."
              />
            </section>

            {/* La jauge du jour, lisible d'un coup d'œil. */}
            <section className="carte-reactive mt-6 rounded-xl border bg-card p-5" data-revele>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-base font-bold text-foreground">
                    {tb.aujourdhui.utilisees} requête{tb.aujourdhui.utilisees > 1 ? 's' : ''} utilisée
                    {tb.aujourdhui.utilisees > 1 ? 's' : ''} aujourd’hui
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {tb.formule.abonnement_actif
                      ? `Abonnement ${tb.formule.libelle} actif.`
                      : `Formule ${tb.formule.libelle}, sans abonnement.`}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    part >= 90
                      ? 'border-destructive/50 text-destructive'
                      : part >= 60
                        ? 'border-amber-500/50 text-amber-700'
                        : 'border-emerald-600/50 text-emerald-700'
                  }
                >
                  {part} % du plafond
                </Badge>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${part}%` }}
                />
              </div>
              {tb.aujourdhui.restant === 0 && (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  Vous avez atteint votre plafond du jour.
                  <Link to="/declarant/abonnement" className="font-medium text-primary hover:underline">
                    Voir les formules
                  </Link>
                </p>
              )}
            </section>

            <section className="carte-reactive mt-6 rounded-xl border bg-card p-5" data-revele>
              <Courbe points={tb.consommation_30j} plafond={tb.formule.requetes_par_jour} />
            </section>

            {/* 3. Ce qui a été fait récemment. */}
            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <div data-revele>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="trait-anime font-display text-base font-bold text-foreground">
                    Dernières classifications
                  </h2>
                  <Link
                    to="/declarant/historique"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Tout l’historique
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {tb.dernieres_classifications.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Aucune classification pour l’instant.
                  </p>
                ) : (
                  <ul className="cascade mt-4 divide-y rounded-xl border bg-card">
                    {tb.dernieres_classifications.map((c) => (
                      <li key={c.id} className="flex items-start justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{c.description}</p>
                          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                            {c.code ?? '—'} · {jour(c.cree_le)}
                          </p>
                        </div>
                        {c.taux_dd !== null && (
                          <Badge variant="secondary" className="shrink-0 tabular-nums">
                            {c.taux_dd} %
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div data-revele>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="trait-anime font-display text-base font-bold text-foreground">
                    Dernières liquidations
                  </h2>
                  <Link
                    to="/declarant/historique"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Tout l’historique
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {tb.dernieres_liquidations.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Aucune liquidation pour l’instant.
                  </p>
                ) : (
                  <ul className="cascade mt-4 divide-y rounded-xl border bg-card">
                    {tb.dernieres_liquidations.map((l) => (
                      <li key={l.id} className="flex items-start justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="font-display text-sm font-semibold tabular-nums text-foreground">
                            {l.numero}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {l.intitule ?? `Régime ${l.regime}`} · {jour(l.cree_le)}
                          </p>
                        </div>
                        <span className="shrink-0 font-display text-sm font-bold tabular-nums text-foreground">
                          {l.total_a_payer_fcfa !== null ? fcfa(l.total_a_payer_fcfa) : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bouton-anime">
                <Link to="/declarant/atelier">
                  <Wrench className="mr-2 h-4 w-4" />
                  Ouvrir l’atelier
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bouton-anime">
                <Link to="/declarant/abonnement">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Ma formule
                </Link>
              </Button>
            </div>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
