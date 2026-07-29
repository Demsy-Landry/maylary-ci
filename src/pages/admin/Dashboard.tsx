import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  supabase,
  COMMANDES_GP_TABLE,
  DEMANDES_DEVIS_TABLE,
  DEMANDES_IMPORT_TABLE,
  DEMANDES_EXPORT_TABLE,
} from '@/lib/supabase';
import AdminNav from '@/components/AdminNav';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingCart, ClipboardList, ArrowRight, PackageSearch, Ship } from 'lucide-react';

export default function AdminDashboard() {
  const [commandesEnVerif, setCommandesEnVerif] = useState<number | null>(null);
  const [devisNouvelles, setDevisNouvelles] = useState<number | null>(null);
  const [importsACoter, setImportsACoter] = useState<number | null>(null);
  const [exportsACoter, setExportsACoter] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const [commandesRes, devisRes, importsRes, exportsRes] = await Promise.all([
        supabase.from(COMMANDES_GP_TABLE).select('id').eq('statut', 'paiement_recu_verification'),
        supabase.from(DEMANDES_DEVIS_TABLE).select('id').eq('statut', 'nouvelle'),
        supabase.from(DEMANDES_IMPORT_TABLE).select('id').in('statut', ['nouvelle', 'en_cotation']),
        supabase.from(DEMANDES_EXPORT_TABLE).select('id').in('statut', ['nouvelle', 'en_cotation']),
      ]);
      setCommandesEnVerif(commandesRes.data?.length ?? 0);
      setDevisNouvelles(devisRes.data?.length ?? 0);
      setImportsACoter(importsRes.data?.length ?? 0);
      setExportsACoter(exportsRes.data?.length ?? 0);
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-screen-xl px-4 py-4 sm:px-6">
          <div className="space-y-2">
            <AdminNav />
            <h1 className="font-display text-lg font-bold text-foreground">Admin — Tableau de bord</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/admin/import"
            className="group flex items-center justify-between rounded-lg border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary-emphasis">
                <PackageSearch className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display font-bold text-foreground">Demandes d'import</p>
                {importsACoter === null ? (
                  <Skeleton className="mt-1 h-4 w-32" />
                ) : importsACoter > 0 ? (
                  <p className="text-sm font-semibold text-primary-emphasis">
                    {importsACoter} demande(s) à coter
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Rien à coter</p>
                )}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            to="/admin/export"
            className="group flex items-center justify-between rounded-lg border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary-emphasis">
                <Ship className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display font-bold text-foreground">Demandes d'export</p>
                {exportsACoter === null ? (
                  <Skeleton className="mt-1 h-4 w-32" />
                ) : exportsACoter > 0 ? (
                  <p className="text-sm font-semibold text-primary-emphasis">
                    {exportsACoter} demande(s) à coter
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Rien à coter</p>
                )}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            to="/admin/commandes"
            className="group flex items-center justify-between rounded-lg border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary-emphasis">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display font-bold text-foreground">Commandes Boutique</p>
                {commandesEnVerif === null ? (
                  <Skeleton className="mt-1 h-4 w-32" />
                ) : commandesEnVerif > 0 ? (
                  <p className="text-sm font-semibold text-primary-emphasis">
                    {commandesEnVerif} en attente de vérification
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Rien en attente</p>
                )}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            to="/admin/devis"
            className="group flex items-center justify-between rounded-lg border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display font-bold text-foreground">Demandes de devis</p>
                {devisNouvelles === null ? (
                  <Skeleton className="mt-1 h-4 w-32" />
                ) : devisNouvelles > 0 ? (
                  <p className="text-sm font-semibold text-primary-emphasis">
                    {devisNouvelles} nouvelle(s) demande(s)
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Rien de nouveau</p>
                )}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Actualisez cette page pour voir les nouvelles demandes.
        </p>
      </main>
    </div>
  );
}
