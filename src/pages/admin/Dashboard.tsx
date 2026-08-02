import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  COMMANDES_GP_TABLE,
  DEMANDES_DEVIS_TABLE,
  DEMANDES_IMPORT_TABLE,
  DEMANDES_EXPORT_TABLE,
  DEMANDES_SOURCING_TABLE,
  VENDEURS_TABLE,
  PRODUITS_TABLE,
  LIGNES_COMMANDE_GP_TABLE,
  REVERSEMENTS_TABLE,
  ROLES_PAR_ECRAN,
  type RoleEquipe,
} from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import AdminNav from '@/components/AdminNav';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShoppingCart,
  ClipboardList,
  ArrowRight,
  PackageSearch,
  Ship,
  Store,
  Sparkles,
  Wallet,
  AlertTriangle,
} from 'lucide-react';

/**
 * Une case du poste de pilotage.
 *
 * `enAttente` porte ce qui réclame une action : c'est ce qui décide de la mise
 * en avant. Une case à zéro reste affichée mais s'efface visuellement — on doit
 * voir d'un coup d'œil ce qui reste à faire, pas relire toute la liste.
 */
interface Case {
  to: string;
  titre: string;
  icone: typeof ShoppingCart;
  enAttente: number | null;
  libelle: (n: number) => string;
  repos: string;
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [n, setN] = useState<Record<string, number> | null>(null);
  const [solde, setSolde] = useState<number | null>(null);
  const [aVerser, setAVerser] = useState<number>(0);

  useEffect(() => {
    const charger = async () => {
      const compte = (t: string) => supabase.from(t).select('id', { count: 'exact', head: true });

      const [
        commandes,
        devis,
        imports,
        exports,
        sourcing,
        vendeurs,
        ruptures,
        lignes,
        versements,
      ] = await Promise.all([
        compte(COMMANDES_GP_TABLE).eq('statut', 'paiement_recu_verification'),
        compte(DEMANDES_DEVIS_TABLE).eq('statut', 'nouvelle'),
        compte(DEMANDES_IMPORT_TABLE).in('statut', ['nouvelle', 'en_cotation']),
        compte(DEMANDES_EXPORT_TABLE).in('statut', ['nouvelle', 'en_cotation']),
        compte(DEMANDES_SOURCING_TABLE).in('statut', ['nouvelle', 'transmise', 'cotee']),
        compte(VENDEURS_TABLE).eq('statut', 'en_attente'),
        compte(PRODUITS_TABLE).eq('actif', true).eq('stock_disponible', 'rupture'),
        supabase.from(LIGNES_COMMANDE_GP_TABLE).select('net_vendeur_fcfa').not('vendeur_id', 'is', null),
        supabase.from(REVERSEMENTS_TABLE).select('montant_fcfa, statut'),
      ]);

      setN({
        commandes: commandes.count ?? 0,
        devis: devis.count ?? 0,
        imports: imports.count ?? 0,
        exports: exports.count ?? 0,
        sourcing: sourcing.count ?? 0,
        vendeurs: vendeurs.count ?? 0,
        ruptures: ruptures.count ?? 0,
      });

      // Ce que Maylary doit encore aux vendeurs : le net de leurs ventes moins
      // ce qui a déjà été versé.
      const du = (lignes.data ?? []).reduce(
        (s: number, l: { net_vendeur_fcfa: number | null }) => s + Number(l.net_vendeur_fcfa ?? 0),
        0,
      );
      const verse = (versements.data ?? [])
        .filter((r: { statut: string }) => r.statut === 'paye')
        .reduce((s: number, r: { montant_fcfa: number }) => s + Number(r.montant_fcfa), 0);
      setAVerser(Math.max(0, du - verse));
    };
    charger();
  }, []);

  // Le solde fournisseur conditionne toute transmission de commande : il a sa
  // place sur la première page, pas au fond d'un écran.
  useEffect(() => {
    const lireSolde = async () => {
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
        // Le solde est une information de confort : son absence n'empêche rien.
      }
    };
    lireSolde();
  }, []);

  const role = (profile?.role_equipe ?? null) as RoleEquipe | null;

  const cases: Case[] = useMemo(
    () => [
      {
        to: '/admin/vendeurs',
        titre: 'Vendeurs marketplace',
        icone: Store,
        enAttente: n?.vendeurs ?? null,
        libelle: (x) => `${x} dossier(s) à examiner`,
        repos: 'Aucun dossier en attente',
      },
      {
        to: '/admin/commandes',
        titre: 'Commandes Boutique',
        icone: ShoppingCart,
        enAttente: n?.commandes ?? null,
        libelle: (x) => `${x} paiement(s) à vérifier`,
        repos: 'Rien en attente',
      },
      {
        to: '/admin/sourcing',
        titre: 'Sourcing sur demande',
        icone: Sparkles,
        enAttente: n?.sourcing ?? null,
        libelle: (x) => `${x} demande(s) à traiter`,
        repos: 'Rien à traiter',
      },
      {
        to: '/admin/import',
        titre: "Demandes d'import",
        icone: PackageSearch,
        enAttente: n?.imports ?? null,
        libelle: (x) => `${x} demande(s) à coter`,
        repos: 'Rien à coter',
      },
      {
        to: '/admin/export',
        titre: "Demandes d'export",
        icone: Ship,
        enAttente: n?.exports ?? null,
        libelle: (x) => `${x} demande(s) à coter`,
        repos: 'Rien à coter',
      },
      {
        to: '/admin/devis',
        titre: 'Demandes de devis',
        icone: ClipboardList,
        enAttente: n?.devis ?? null,
        libelle: (x) => `${x} nouvelle(s) demande(s)`,
        repos: 'Rien de nouveau',
      },
    ],
    [n],
  );

  // On n'affiche que les écrans que ce rôle peut réellement ouvrir : une case
  // qui mène à un refus abîme la confiance dans l'outil.
  const visibles = cases.filter((c) => {
    const autorises = ROLES_PAR_ECRAN[c.to];
    return !autorises || (role !== null && autorises.includes(role));
  });

  const total = visibles.reduce((s, c) => s + (c.enAttente ?? 0), 0);
  const estProprietaire = role === 'proprietaire';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-screen-xl space-y-2 px-4 py-4 sm:px-6">
          <AdminNav />
          <h1 className="font-display text-lg font-bold text-foreground">Admin — Tableau de bord</h1>
        </div>
      </header>

      <main className="entree-page mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">
          {n === null
            ? 'Relevé en cours…'
            : total === 0
              ? 'Rien ne vous attend. Tout est traité.'
              : `${total} point(s) réclament votre attention.`}
        </p>

        {/* Deux chiffres d'argent, placés avant les files d'attente : ils
            décident de ce qu'on peut engager aujourd'hui. */}
        {estProprietaire && (
          <div className="cascade mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" />
                Provision fournisseur
              </p>
              {solde === null ? (
                <Skeleton className="mt-1.5 h-6 w-24" />
              ) : (
                <p
                  className={`text-xl font-semibold ${solde > 0 ? 'text-foreground' : 'text-destructive'}`}
                >
                  {solde.toFixed(2)} $
                </p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {solde !== null && solde <= 0
                  ? 'Aucune commande ne peut partir chez le fournisseur.'
                  : 'Disponible pour engager des commandes.'}
              </p>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Store className="h-3.5 w-3.5" />
                Dû aux vendeurs
              </p>
              <p className="text-xl font-semibold text-foreground">
                {aVerser.toLocaleString('fr-FR')} FCFA
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {aVerser > 0 ? 'À reverser après livraison.' : 'Rien à reverser.'}
              </p>
            </div>

            {(n?.ruptures ?? 0) > 0 && (
              <Link
                to="/admin/cj-dropshipping"
                className="carte-reactive rounded-lg border border-destructive/40 bg-destructive/5 p-4"
              >
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Articles en rupture
                </p>
                <p className="text-xl font-semibold text-foreground">{n?.ruptures}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  En vitrine mais indisponibles chez le fournisseur.
                </p>
              </Link>
            )}
          </div>
        )}

        <div className="cascade mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((c) => {
            const Icone = c.icone;
            const attend = (c.enAttente ?? 0) > 0;
            return (
              <Link
                key={c.to}
                to={c.to}
                className={`carte-reactive group flex items-center justify-between rounded-lg border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary ${
                  attend ? 'border-primary/40' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${
                      attend
                        ? 'bg-primary/15 text-primary-emphasis'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-foreground">{c.titre}</p>
                    {c.enAttente === null ? (
                      <Skeleton className="mt-1 h-4 w-32" />
                    ) : attend ? (
                      <p className="text-sm font-semibold text-primary-emphasis">
                        {c.libelle(c.enAttente)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">{c.repos}</p>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Actualisez cette page pour relever les nouvelles demandes.
        </p>
      </main>
    </div>
  );
}
