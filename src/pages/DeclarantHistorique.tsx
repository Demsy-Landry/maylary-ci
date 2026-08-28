import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { telechargerBulletinPdf, enTeteVide } from '@/lib/bulletin-pdf';
import {
  Calculator,
  Sparkles,
  Printer,
  Search,
  Lock,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { useReferencement } from '@/hooks/useReferencement';
import { PAGES } from '@/lib/referencement-pages';

/**
 * L'historique du Déclarant.
 *
 * Deux natures d'archives, séparées parce qu'elles ne se relisent pas pour la
 * même raison :
 *
 *  - **Les liquidations** se relisent pour REPRODUIRE un document. Le bulletin
 *    doit ressortir à l'identique des mois plus tard, d'où le résultat complet
 *    conservé en base et réimprimé tel quel — jamais recalculé. Les taux du TEC
 *    changent ; un recalcul ferait mentir l'archive.
 *  - **Les classifications** se relisent pour RETROUVER un code. Ce qui compte
 *    y est le code et son statut : confirmé au tarif, ou simple proposition.
 *
 * La distinction « vérifié en base » reste visible ici comme elle l'est dans
 * l'atelier. Un code non confirmé qui prendrait, avec le temps, l'apparence
 * d'un code confirmé serait la pire chose que cet écran puisse faire.
 */

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const dateHeure = (s: string) =>
  new Date(s).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

type Vue = 'liquidations' | 'classifications';

export default function DeclarantHistorique() {
  useReferencement(PAGES["/declarant/historique"]);

  const { user, loading: authLoading } = useAuth();
  const [vue, setVue] = useState<Vue>('liquidations');
  const [liquidations, setLiquidations] = useState<LiquidationEnregistree[] | null>(null);
  const [classifications, setClassifications] = useState<ClassificationEnregistree[] | null>(null);
  const [filtre, setFiltre] = useState('');
  const [ouvert, setOuvert] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from(LIQUIDATIONS_TABLE)
      .select('*')
      .order('cree_le', { ascending: false })
      .limit(200)
      .then(({ data }) => setLiquidations((data as LiquidationEnregistree[]) ?? []));
    void supabase
      .from(CLASSIFICATIONS_HS_TABLE)
      .select('id, description, code_propose, designation_tec, verifie_en_base, taux_dd, cree_le')
      .order('cree_le', { ascending: false })
      .limit(200)
      .then(({ data }) => setClassifications((data as ClassificationEnregistree[]) ?? []));
  }, [user]);

  const cherche = filtre.trim().toLowerCase();

  const liquidationsVues = useMemo(
    () =>
      (liquidations ?? []).filter(
        (l) =>
          !cherche ||
          l.numero.toLowerCase().includes(cherche) ||
          (l.intitule ?? '').toLowerCase().includes(cherche),
      ),
    [liquidations, cherche],
  );

  const classificationsVues = useMemo(
    () =>
      (classifications ?? []).filter(
        (c) =>
          !cherche ||
          c.description.toLowerCase().includes(cherche) ||
          (c.code_propose ?? '').includes(cherche) ||
          (c.designation_tec ?? '').toLowerCase().includes(cherche),
      ),
    [classifications, cherche],
  );

  /* Le bulletin est réédité depuis le résultat archivé, pas recalculé. */
  const reimprimer = (l: LiquidationEnregistree) => {
    try {
      telechargerBulletinPdf(l.resultat as unknown as Liquidation, {
        ...enTeteVide(),
        reference: l.numero,
        importateur: l.intitule ?? '',
      });
    } catch {
      toast.error("Ce bulletin ne peut pas être réédité : l'archive est incomplète.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <NavDeclarant />

      <main className="entree-page mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <h1 className="trait-anime font-display text-2xl font-extrabold text-foreground">
          Historique
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Tout ce que vous avez calculé et classé reste ici. Les bulletins se rééditent à
          l’identique : ils sont conservés tels qu’ils ont été calculés, jamais recalculés.
        </p>

        {authLoading ? (
          <div className="mt-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !user ? (
          <div className="mt-8 rounded-xl border border-dashed p-10 text-center">
            <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Votre historique n’appartient qu’à vous. Connectez-vous pour le consulter.
            </p>
            <Button asChild className="bouton-anime mt-5">
              <Link to="/boutique/compte?retour=/declarant/historique">Se connecter</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button
                variant={vue === 'liquidations' ? 'default' : 'outline'}
                size="sm"
                className="bouton-anime"
                onClick={() => setVue('liquidations')}
              >
                <Calculator className="mr-1.5 h-4 w-4" />
                Liquidations
                {liquidations && (
                  <Badge variant="secondary" className="ml-2 tabular-nums">
                    {liquidations.length}
                  </Badge>
                )}
              </Button>
              <Button
                variant={vue === 'classifications' ? 'default' : 'outline'}
                size="sm"
                className="bouton-anime"
                onClick={() => setVue('classifications')}
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                Classifications
                {classifications && (
                  <Badge variant="secondary" className="ml-2 tabular-nums">
                    {classifications.length}
                  </Badge>
                )}
              </Button>

              <div className="relative ml-auto w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filtre}
                  onChange={(e) => setFiltre(e.target.value)}
                  placeholder={vue === 'liquidations' ? 'Numéro ou intitulé' : 'Marchandise ou code'}
                  className="pl-8"
                />
              </div>
            </div>

            {vue === 'liquidations' &&
              (liquidations === null ? (
                <div className="mt-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : liquidationsVues.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed p-10 text-center">
                  <Calculator className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {liquidations.length === 0
                      ? 'Aucune liquidation enregistrée. Celles que vous calculerez dans l’atelier arriveront ici.'
                      : 'Aucune liquidation ne correspond à cette recherche.'}
                  </p>
                  {liquidations.length === 0 && (
                    <Button asChild className="bouton-anime mt-5">
                      <Link to="/declarant/atelier">
                        <Wrench className="mr-2 h-4 w-4" />
                        Ouvrir l’atelier
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <ul className="cascade mt-6 space-y-3">
                  {liquidationsVues.map((l) => (
                    <li key={l.id} className="carte-reactive rounded-xl border bg-card">
                      <div className="flex flex-wrap items-center gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-display text-sm font-bold tabular-nums text-foreground">
                              {l.numero}
                            </p>
                            <Badge variant="outline" className="tabular-nums">
                              Régime {l.regime}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {dateHeure(l.cree_le)}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {l.intitule ?? 'Sans intitulé'} ·{' '}
                            {l.nombre_lignes ?? 0} ligne{(l.nombre_lignes ?? 0) > 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Droits et taxes</p>
                          <p className="font-display text-base font-extrabold tabular-nums text-foreground">
                            {l.total_a_payer_fcfa !== null ? fcfa(l.total_a_payer_fcfa) : '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="bouton-anime"
                            onClick={() => reimprimer(l)}
                          >
                            <Printer className="mr-1.5 h-4 w-4" />
                            Bulletin
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-expanded={ouvert === l.id}
                            onClick={() => setOuvert(ouvert === l.id ? null : l.id)}
                          >
                            <ChevronDown
                              className={
                                'h-4 w-4 transition-transform ' +
                                (ouvert === l.id ? 'rotate-180' : '')
                              }
                            />
                            <span className="sr-only">Détail</span>
                          </Button>
                        </div>
                      </div>

                      {ouvert === l.id && (
                        <div className="rideau border-t px-4 py-3">
                          <div className="grid gap-3 text-sm sm:grid-cols-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Valeur en douane (CAF)</p>
                              <p className="font-semibold tabular-nums">
                                {l.caf_fcfa !== null ? fcfa(l.caf_fcfa) : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Fret</p>
                              <p className="tabular-nums">{fcfa(l.fret_fcfa)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Assurance</p>
                              <p className="tabular-nums">{fcfa(l.assurance_fcfa)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Lignes</p>
                              <p className="tabular-nums">{l.nombre_lignes ?? 0}</p>
                            </div>
                          </div>
                          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                            Cette liquidation est conservée telle qu’elle a été calculée. Le tarif
                            évolue : un même calcul refait aujourd’hui pourrait donner un autre
                            montant, et c’est celui-ci qui fait foi pour ce dossier.
                          </p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ))}

            {vue === 'classifications' &&
              (classifications === null ? (
                <div className="mt-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : classificationsVues.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed p-10 text-center">
                  <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {classifications.length === 0
                      ? 'Aucune marchandise classée pour l’instant.'
                      : 'Aucune classification ne correspond à cette recherche.'}
                  </p>
                  {classifications.length === 0 && (
                    <Button asChild className="bouton-anime mt-5">
                      <Link to="/declarant/atelier">
                        <Wrench className="mr-2 h-4 w-4" />
                        Classer une marchandise
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <ul className="cascade mt-6 divide-y rounded-xl border bg-card">
                  {classificationsVues.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-start gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">{c.description}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {c.designation_tec ?? 'Position non confirmée au tarif'} ·{' '}
                          {dateHeure(c.cree_le)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-display text-sm font-semibold tabular-nums text-foreground">
                          {c.code_propose ?? '—'}
                        </span>
                        {c.verifie_en_base ? (
                          <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />
                            {c.taux_dd !== null ? `DD ${c.taux_dd} %` : 'Confirmé'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-700">
                            <AlertTriangle className="h-3 w-3" />
                            À vérifier
                          </Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ))}
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
