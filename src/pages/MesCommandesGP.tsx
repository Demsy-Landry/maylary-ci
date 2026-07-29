import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import { useAuth } from '@/hooks/useAuth';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  COMMANDES_GP_TABLE,
  LIGNES_COMMANDE_GP_TABLE,
  HISTORIQUE_COMMANDE_GP_TABLE,
  STATUT_COMMANDE_GP_LABELS,
  STATUT_COMMANDE_GP_MESSAGES,
  MODE_PAIEMENT_LABELS,
  type CommandeGP,
  type LigneCommandeGP,
  type HistoriqueStatutCommandeGP,
  type StatutCommandeGP,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Eye, Package, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const STATUT_BADGE_VARIANT: Record<StatutCommandeGP, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  en_attente_paiement: 'secondary',
  paiement_recu_verification: 'outline',
  paiement_confirme: 'default',
  en_preparation: 'secondary',
  expediee: 'secondary',
  livree: 'default',
  annulee: 'destructive',
};

interface CommandeAvecDetail extends CommandeGP {
  lignes: LigneCommandeGP[];
  historique: HistoriqueStatutCommandeGP[];
}

export default function MesCommandesGP() {
  const { user, loading: authLoading, isAdmin } = useAuth();

  const [commandes, setCommandes] = useState<CommandeGP[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<CommandeAvecDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [marquerPayeBusy, setMarquerPayeBusy] = useState<string | null>(null);

  const loadCommandes = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from(COMMANDES_GP_TABLE)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setCommandes((data as CommandeGP[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadCommandes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const openDetail = async (commande: CommandeGP) => {
    setDetailLoading(true);
    const [lignesRes, historiqueRes] = await Promise.all([
      supabase.from(LIGNES_COMMANDE_GP_TABLE).select('*').eq('commande_id', commande.id),
      supabase
        .from(HISTORIQUE_COMMANDE_GP_TABLE)
        .select('*')
        .eq('commande_id', commande.id)
        .order('horodatage', { ascending: false }),
    ]);
    setDetail({
      ...commande,
      lignes: (lignesRes.data as LigneCommandeGP[]) ?? [],
      historique: (historiqueRes.data as HistoriqueStatutCommandeGP[]) ?? [],
    });
    setDetailLoading(false);
  };

  const handleMarquerPaye = async (commandeId: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      toast.error('Session expirée, reconnectez-vous.');
      return;
    }

    setMarquerPayeBusy(commandeId);
    try {
      const res = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_commande_gp_marquer_paye`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commande_id: commandeId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? 'Une erreur est survenue.');
      }
      toast.success('Merci ! Nous vérifions la réception de votre paiement.');
      await loadCommandes();
      if (detail?.id === commandeId) {
        setDetail(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible de marquer la commande comme payée.');
    } finally {
      setMarquerPayeBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-foreground">Mes commandes</h1>
        <p className="text-sm text-muted-foreground">Suivi de vos achats sur la boutique Maylary</p>

        {loading ? (
          <div className="mt-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : commandes.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed p-10 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Vous n'avez pas encore passé de commande.
            </p>
            <Button asChild className="mt-4">
              <Link to="/boutique">Voir la boutique</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 divide-y rounded-md border">
            {commandes.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{c.reference_publique}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString('fr-FR')} ·{' '}
                    {c.montant_total_fcfa.toLocaleString('fr-FR')} FCFA ·{' '}
                    {MODE_PAIEMENT_LABELS[c.mode_paiement]}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={STATUT_BADGE_VARIANT[c.statut]}>
                    {STATUT_COMMANDE_GP_LABELS[c.statut]}
                  </Badge>
                  {c.statut === 'en_attente_paiement' && (
                    <Button
                      size="sm"
                      onClick={() => handleMarquerPaye(c.id)}
                      disabled={marquerPayeBusy === c.id}
                    >
                      {marquerPayeBusy === c.id ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      )}
                      J'ai payé
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openDetail(c)}>
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
            <DialogTitle>Commande {detail?.reference_publique}</DialogTitle>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                <p className="font-medium text-foreground">{STATUT_COMMANDE_GP_LABELS[detail.statut]}</p>
                <p className="mt-1 text-muted-foreground">{STATUT_COMMANDE_GP_MESSAGES[detail.statut]}</p>
                {detail.statut === 'en_attente_paiement' && (
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => handleMarquerPaye(detail.id)}
                    disabled={marquerPayeBusy === detail.id}
                  >
                    {marquerPayeBusy === detail.id ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    )}
                    J'ai payé
                  </Button>
                )}
              </div>

              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium text-foreground">{detail.nom_destinataire}</p>
                <p className="text-muted-foreground">{detail.telephone_destinataire}</p>
                <p className="text-muted-foreground">
                  {detail.adresse_livraison}, {detail.ville_livraison}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground">Produits</p>
                <div className="mt-2 divide-y rounded-md border">
                  {detail.lignes.map((l) => (
                    <div key={l.id} className="flex items-center justify-between p-2 text-sm">
                      <span>{l.nom_produit} × {l.quantite}</span>
                      <span className="font-medium">{l.sous_total.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-right text-sm font-semibold">
                  Total : {detail.montant_total_fcfa.toLocaleString('fr-FR')} FCFA
                </p>
              </div>

              {detail.historique.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground">Suivi de la commande</p>
                  <div className="mt-2 space-y-2">
                    {detail.historique.map((h) => (
                      <div key={h.id} className="rounded-md border p-2 text-xs">
                        <p className="font-medium">
                          {STATUT_COMMANDE_GP_LABELS[h.statut]} — {new Date(h.horodatage).toLocaleString('fr-FR')}
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
