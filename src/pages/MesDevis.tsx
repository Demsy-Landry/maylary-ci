import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import PublicHeaderPro from '@/components/PublicHeaderPro';
import SiteFooter from '@/components/SiteFooter';
import { useAuth } from '@/hooks/useAuth';
import {
  supabase,
  DEMANDES_DEVIS_TABLE,
  LIGNES_DEVIS_TABLE,
  HISTORIQUE_STATUT_TABLE,
  STATUT_LABELS,
  type DemandeDevis,
  type LigneDevis,
  type HistoriqueStatutDevis,
  type StatutDevis,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Eye, ClipboardList } from 'lucide-react';

const STATUT_BADGE_VARIANT: Record<StatutDevis, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  nouvelle: 'secondary',
  en_traitement: 'secondary',
  devis_envoye: 'default',
  commande_confirmee: 'default',
  annulee: 'destructive',
};

interface DemandeAvecDetail extends DemandeDevis {
  lignes: LigneDevis[];
  historique: HistoriqueStatutDevis[];
}

export default function MesDevis() {
  const { user, loading: authLoading, isAdmin } = useAuth();

  const [demandes, setDemandes] = useState<DemandeDevis[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<DemandeAvecDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from(DEMANDES_DEVIS_TABLE)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setDemandes((data as DemandeDevis[]) ?? []);
      setLoading(false);
    };
    load();
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || isAdmin) {
    return <Navigate to="/boutique/compte" replace />;
  }

  const openDetail = async (demande: DemandeDevis) => {
    setDetailLoading(true);
    const [lignesRes, historiqueRes] = await Promise.all([
      supabase.from(LIGNES_DEVIS_TABLE).select('*').eq('demande_devis_id', demande.id),
      supabase
        .from(HISTORIQUE_STATUT_TABLE)
        .select('*')
        .eq('demande_devis_id', demande.id)
        .order('horodatage', { ascending: false }),
    ]);
    setDetail({
      ...demande,
      lignes: (lignesRes.data as LigneDevis[]) ?? [],
      historique: (historiqueRes.data as HistoriqueStatutDevis[]) ?? [],
    });
    setDetailLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderPro />
      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Mes devis</h1>
        <p className="text-sm text-muted-foreground">Suivi de vos demandes auprès des enseignes Maylary</p>

        {loading ? (
          <div className="mt-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : demandes.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed p-10 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Vous n'avez pas encore envoyé de demande de devis.
            </p>
            <Button asChild className="mt-4">
              <Link to="/catalogue">Voir l'Espace Pro</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 divide-y rounded-md border">
            {demandes.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{d.reference_publique}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString('fr-FR')} ·{' '}
                    {d.montant_total_estime_fcfa.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={STATUT_BADGE_VARIANT[d.statut]}>{STATUT_LABELS[d.statut]}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => openDetail(d)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog
        open={!!detail || detailLoading}
        onOpenChange={(open) => {
          if (!open) {
            setDetail(null);
            setDetailLoading(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Devis {detail?.reference_publique}</DialogTitle>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {detail.notes_client && (
                <div className="rounded-md border p-3 text-sm">
                  <p className="font-medium text-foreground">Vos notes</p>
                  <p className="mt-1 text-muted-foreground">{detail.notes_client}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-foreground">Produits demandés</p>
                <div className="mt-2 divide-y rounded-md border">
                  {detail.lignes.map((l) => (
                    <div key={l.id} className="flex items-center justify-between p-2 text-sm">
                      <span>Quantité : {l.quantite}</span>
                      <span className="font-medium">{l.sous_total.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-right text-sm font-semibold">
                  Total estimé : {detail.montant_total_estime_fcfa.toLocaleString('fr-FR')} FCFA
                </p>
              </div>

              {detail.historique.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground">Suivi de la demande</p>
                  <div className="mt-2 space-y-2">
                    {detail.historique.map((h) => (
                      <div key={h.id} className="rounded-md border p-2 text-xs">
                        <p className="font-medium">
                          {STATUT_LABELS[h.statut]} — {new Date(h.horodatage).toLocaleString('fr-FR')}
                        </p>
                        {h.commentaire_admin && (
                          <p className="mt-1 text-muted-foreground">{h.commentaire_admin}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <SiteFooter />
    </div>
  );
}
