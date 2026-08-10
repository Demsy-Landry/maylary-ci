import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, EDGE_FUNCTIONS_URL, ROLES_PAR_ECRAN, type RoleEquipe } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import AdminNav from '@/components/AdminNav';
import ScenePortAbidjan from '@/components/illustrations/ScenePortAbidjan';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ShoppingCart,
  ClipboardList,
  ArrowRight,
  PackageSearch,
  Ship,
  Store,
  Plane,
  Wallet,
  AlertTriangle,
  Anchor,
  Boxes,
  Globe,
  TrendingUp,
  Loader2,
} from 'lucide-react';

/**
 * La tour de contrôle.
 *
 * L'écran précédent alignait neuf compteurs : c'était une boîte de réception,
 * pas un poste de pilotage. Un transitaire ne se demande pas d'abord « combien
 * de messages non lus » — il se demande où sont ses marchandises, combien
 * d'argent flotte entre un fournisseur et Abidjan, et ce qui va coûter cher
 * s'il ne le traite pas aujourd'hui.
 *
 * D'où l'ordre de la page, qui est celui de l'urgence :
 *
 *  1. **Ce qui coûte à ne rien faire.** La franchise de magasinage court dès le
 *     déchargement ; un devis oublié vieillit avec son taux de fret.
 *  2. **La valeur engagée.** Ce qui est en mer est de l'argent immobilisé.
 *  3. **Le pipeline**, étape par étape. Dix cases pour l'import, neuf pour
 *     l'export — et les cases vides restent affichées : un flux dont les
 *     étapes bougent selon le jour ne se lit pas.
 *  4. Le reste : ce qu'il y a à traiter, le sourcing, le catalogue.
 *
 * Tout vient d'un seul appel. Neuf requêtes depuis le navigateur pour neuf
 * compteurs, c'était neuf allers-retours sur une liaison mobile abidjanaise.
 */

interface EtapePipeline {
  statut: string;
  libelle: string;
  rang: number;
  n: number;
  valeur_fcfa: number;
}

interface Alerte {
  code: string;
  gravite: 'haute' | 'moyenne';
  n: number;
  lien: string;
  libelle: string;
  explication: string;
}

interface TableauDeBord {
  pipeline_import: EtapePipeline[];
  pipeline_export: EtapePipeline[];
  alertes: Alerte[];
  engage: { dossiers: number; valeur_fcfa: number };
  a_traiter: Record<string, number>;
  argent: { a_reverser_fcfa: number; encaisse_30j_fcfa: number };
  sourcing: {
    fournisseurs: number;
    api_branchees: number;
    api_a_obtenir: number;
    pistes_a_contacter: number;
  };
  catalogue: { produits_actifs: number; ruptures: number };
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

/** Un montant qui se lit d'un coup d'œil : les millions ne s'épellent pas. */
const abrege = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)} M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} k`;
  return String(Math.round(n));
};

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [tb, setTb] = useState<TableauDeBord | null>(null);
  const [solde, setSolde] = useState<number | null>(null);
  const [demo, setDemo] = useState<{ actif: boolean; imports: number; exports: number } | null>(null);
  const [demoEnCours, setDemoEnCours] = useState(false);

  const charger = () =>
    Promise.all([
      supabase.rpc('app_e08c374bc4_tableau_de_bord'),
      supabase.rpc('app_e08c374bc4_demonstration', { p_action: 'etat' }),
    ]).then(([t, d]) => {
      if (t.data) setTb(t.data as TableauDeBord);
      if (d.data) setDemo(d.data as { actif: boolean; imports: number; exports: number });
    });

  useEffect(() => {
    void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const basculerDemo = async (action: 'charger' | 'purger') => {
    setDemoEnCours(true);
    const { error } = await supabase.rpc('app_e08c374bc4_demonstration', { p_action: action });
    if (error) toast.error('Action impossible : ' + error.message);
    else toast.success(action === 'charger' ? 'Jeu de démonstration chargé.' : 'Démonstration purgée.');
    await charger();
    setDemoEnCours(false);
  };

  // Le solde fournisseur conditionne toute transmission de commande : sa place
  // est sur la première page. Son absence n'empêche rien, on ne bloque pas.
  useEffect(() => {
    const lire = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_cj_commande`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'solde' }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && typeof json?.solde_usd === 'number') setSolde(json.solde_usd);
      } catch {
        /* information de confort */
      }
    };
    void lire();
  }, []);

  const role = profile?.role_equipe ?? null;
  const autorise = (chemin: string) => {
    const roles = ROLES_PAR_ECRAN[chemin] as RoleEquipe[] | undefined;
    return !roles || (role !== null && roles.includes(role));
  };

  const aTraiter = [
    { to: '/admin/import', cle: 'imports', titre: "Demandes d'import", icone: Ship },
    { to: '/admin/export', cle: 'exports', titre: "Demandes d'export", icone: Plane },
    { to: '/admin/devis', cle: 'devis', titre: 'Demandes de devis', icone: ClipboardList },
    { to: '/admin/sourcing', cle: 'sourcing', titre: 'Sourcing sur demande', icone: PackageSearch },
    { to: '/admin/commandes', cle: 'commandes', titre: 'Paiements à vérifier', icone: ShoppingCart },
    { to: '/admin/vendeurs', cle: 'vendeurs', titre: 'Vendeurs à valider', icone: Store },
  ].filter((c) => autorise(c.to));

  return (
    <div className="min-h-screen bg-background">
      {/* Le bandeau porte l'identité du métier : un port, des grues, des
          conteneurs. Une administration de transitaire n'a pas de raison de
          ressembler à un tableur. */}
      <header className="relative overflow-hidden border-b bg-foreground">
        <ScenePortAbidjan className="absolute inset-0 h-full w-full opacity-30" />
        <div className="relative mx-auto max-w-screen-xl px-4 py-4 sm:px-6">
          <div className="space-y-3 [&_a]:text-background/70 [&_a:hover]:text-background">
            <AdminNav />
            <div>
              <h1 className="font-display text-xl font-bold text-background">
                Tour de contrôle — MayLary Group
              </h1>
              <p className="text-sm text-background/70">
                Où sont les marchandises, ce qui est engagé, ce qui presse.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl space-y-8 px-4 py-8 sm:px-6">
        {/* Le bandeau ne se referme pas. Tant qu'une seule ligne fictive existe,
            personne ne doit pouvoir confondre ces chiffres avec de l'activité —
            c'est la contrepartie du droit de remplir la base pour montrer
            l'outil. */}
        {demo?.actif && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
            <p className="text-sm text-foreground">
              <span className="font-semibold">Mode démonstration actif</span> — {demo.imports} dossier
              {demo.imports > 1 ? 's' : ''} d'import et {demo.exports} d'export fictifs, marqués
              « DEMO ». Ces montants ne sont pas de l'activité réelle.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={demoEnCours}
              onClick={() => void basculerDemo('purger')}
            >
              {demoEnCours && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Purger
            </Button>
          </div>
        )}

        {!tb ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            {/* 1. Ce qui coûte à ne rien faire. */}
            {tb.alertes.length > 0 && (
              <section className="space-y-2">
                {tb.alertes.map((a) => (
                  <Link
                    key={a.code}
                    to={a.lien}
                    className={
                      'flex items-start gap-3 rounded-lg border p-4 transition hover:shadow-sm ' +
                      (a.gravite === 'haute'
                        ? 'border-destructive/40 bg-destructive/5'
                        : 'border-amber-500/40 bg-amber-500/5')
                    }
                  >
                    <AlertTriangle
                      className={
                        'mt-0.5 h-4 w-4 shrink-0 ' +
                        (a.gravite === 'haute' ? 'text-destructive' : 'text-amber-600')
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{a.libelle}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.explication}</p>
                    </div>
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </section>
            )}

            {/* 2. L'argent, en trois chiffres. */}
            <section className="grid gap-4 sm:grid-cols-3">
              <Chiffre
                icone={Anchor}
                titre="Engagé en transit"
                valeur={abrege(tb.engage.valeur_fcfa)}
                unite="FCFA"
                detail={`${tb.engage.dossiers} dossier${tb.engage.dossiers > 1 ? 's' : ''} entre le fournisseur et la livraison`}
                accent
              />
              <Chiffre
                icone={TrendingUp}
                titre="Encaissé sur 30 jours"
                valeur={abrege(tb.argent.encaisse_30j_fcfa)}
                unite="FCFA"
                detail="Commandes boutique payées"
              />
              <Chiffre
                icone={Wallet}
                titre="À reverser aux vendeurs"
                valeur={abrege(tb.argent.a_reverser_fcfa)}
                unite="FCFA"
                detail={
                  solde !== null
                    ? `Solde fournisseur CJ : ${solde.toFixed(2)} USD`
                    : 'Net des ventes moins ce qui a déjà été versé'
                }
              />
            </section>

            {/* 3. Le pipeline : c'est là que le métier se voit. */}
            <Pipeline
              titre="Dossiers d'import"
              icone={Ship}
              etapes={tb.pipeline_import}
              lien="/admin/import"
            />
            <Pipeline
              titre="Dossiers d'export"
              icone={Plane}
              etapes={tb.pipeline_export}
              lien="/admin/export"
            />

            {/* 4. Le reste. */}
            {aTraiter.length > 0 && (
              <section>
                <h2 className="font-display text-base font-semibold text-foreground">À traiter</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {aTraiter.map((c) => {
                    const n = tb.a_traiter[c.cle] ?? 0;
                    const Icone = c.icone;
                    return (
                      <Link
                        key={c.to}
                        to={c.to}
                        className={
                          'flex items-center gap-3 rounded-lg border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm ' +
                          (n === 0 ? 'opacity-60' : '')
                        }
                      >
                        <Icone className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{c.titre}</p>
                          <p className="text-xs text-muted-foreground">
                            {n === 0 ? 'Rien en attente' : `${n} en attente`}
                          </p>
                        </div>
                        {n > 0 && (
                          <Badge className="tabular-nums">{n}</Badge>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="grid gap-4 sm:grid-cols-2">
              {autorise('/admin/fournisseurs') && (
                <Link
                  to="/admin/fournisseurs"
                  className="rounded-lg border bg-card p-4 transition hover:border-primary/50"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Sourcing et origines</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {tb.sourcing.fournisseurs} fournisseur
                    {tb.sourcing.fournisseurs > 1 ? 's' : ''} enregistré
                    {tb.sourcing.fournisseurs > 1 ? 's' : ''} — {tb.sourcing.api_branchees} API
                    branchée{tb.sourcing.api_branchees > 1 ? 's' : ''},{' '}
                    {tb.sourcing.api_a_obtenir} à obtenir.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tb.sourcing.pistes_a_contacter} piste
                    {tb.sourcing.pistes_a_contacter > 1 ? 's' : ''} de prospection à contacter.
                  </p>
                </Link>
              )}
              {autorise('/admin/cj-dropshipping') && (
                <Link
                  to="/admin/cj-dropshipping"
                  className="rounded-lg border bg-card p-4 transition hover:border-primary/50"
                >
                  <div className="flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Catalogue</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {tb.catalogue.produits_actifs} produit
                    {tb.catalogue.produits_actifs > 1 ? 's' : ''} en ligne
                    {tb.catalogue.ruptures > 0
                      ? ` — ${tb.catalogue.ruptures} en rupture`
                      : ', aucune rupture'}
                    .
                  </p>
                </Link>
              )}
            </section>

            {/* La démonstration se pilote depuis la tour de contrôle plutôt que
                depuis un écran de réglages : c'est là qu'on la regarde. */}
            {!demo?.actif && (
              <section className="rounded-lg border border-dashed p-4">
                <p className="text-sm font-medium text-foreground">Présenter l'outil</p>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Charge une douzaine de dossiers fictifs répartis sur toutes les étapes du pipeline,
                  datés pour que les alertes de délai se déclenchent. Tout est marqué « DEMO » et se
                  purge en un clic. À utiliser pour une présentation, jamais devant un client.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  disabled={demoEnCours}
                  onClick={() => void basculerDemo('charger')}
                >
                  {demoEnCours && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Charger le jeu de démonstration
                </Button>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Chiffre({
  icone: Icone,
  titre,
  valeur,
  unite,
  detail,
  accent,
}: {
  icone: typeof Ship;
  titre: string;
  valeur: string;
  unite: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        'rounded-lg border p-4 ' + (accent ? 'border-primary/40 bg-primary/5' : 'bg-card')
      }
    >
      <div className="flex items-center gap-1.5">
        <Icone className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titre}</p>
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums text-foreground">
        {valeur}
        <span className="ml-1 text-sm font-normal text-muted-foreground">{unite}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

/**
 * Le flux, étape par étape.
 *
 * Les cases vides restent affichées. C'est délibéré : un pipeline dont les
 * étapes apparaissent et disparaissent selon les dossiers du jour oblige à
 * relire l'ensemble à chaque fois. Là, l'œil retrouve toujours la même place.
 */
function Pipeline({
  titre,
  icone: Icone,
  etapes,
  lien,
}: {
  titre: string;
  icone: typeof Ship;
  etapes: EtapePipeline[];
  lien: string;
}) {
  const total = etapes.reduce((s, e) => s + e.n, 0);
  const enCours = etapes.filter((e) => e.statut !== 'livree').reduce((s, e) => s + e.n, 0);

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
          <Icone className="h-4 w-4 text-muted-foreground" />
          {titre}
        </h2>
        <Link to={lien} className="text-xs text-primary hover:underline">
          {enCours} en cours sur {total} — tout voir
        </Link>
      </div>

      {/* Défilement horizontal plutôt que retour à la ligne : un flux se lit de
          gauche à droite, y compris sur un téléphone. */}
      <div className="mt-3 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2">
          {etapes.map((e) => (
            <div
              key={e.statut}
              className={
                'w-36 shrink-0 rounded-lg border p-3 ' +
                (e.n > 0 ? 'border-primary/40 bg-primary/5' : 'bg-card opacity-60')
              }
            >
              <p className="text-[11px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
                {e.libelle}
              </p>
              <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-foreground">
                {e.n}
              </p>
              {e.valeur_fcfa > 0 && (
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {fcfa(e.valeur_fcfa)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
