import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  DEMANDES_DEVIS_TABLE,
  HISTORIQUE_STATUT_TABLE,
  PROFILES_TABLE,
  STATUT_LABELS,
  type DemandeDevis,
  type StatutDevis,
  type Profile,
} from '@/lib/supabase';
import AdminNav from '@/components/AdminNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Pencil, Send } from 'lucide-react';

const STATUT_BADGE_VARIANT: Record<StatutDevis, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  nouvelle: 'outline',
  en_traitement: 'secondary',
  devis_envoye: 'default',
  commande_confirmee: 'default',
  annulee: 'destructive',
};

const PROCHAIN_STATUT: Partial<Record<StatutDevis, StatutDevis>> = {
  nouvelle: 'en_traitement',
  en_traitement: 'devis_envoye',
  devis_envoye: 'commande_confirmee',
};

export default function AdminDevisGestion() {
  const [demandes, setDemandes] = useState<DemandeDevis[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [gestion, setGestion] = useState<DemandeDevis | null>(null);
  const [busy, setBusy] = useState(false);
  const [commentaire, setCommentaire] = useState('');

  const loadDemandes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from(DEMANDES_DEVIS_TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    const list = (data as DemandeDevis[]) ?? [];
    setDemandes(list);

    const userIds = [...new Set(list.map((d) => d.user_id))];
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from(PROFILES_TABLE)
        .select('*')
        .in('user_id', userIds);
      const map: Record<string, Profile> = {};
      for (const p of (profilesData as Profile[]) ?? []) {
        map[p.user_id] = p;
      }
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDemandes();
  }, []);

  const nouvelles = demandes.filter((d) => d.statut === 'nouvelle');

  const openGestion = (d: DemandeDevis) => {
    setGestion(d);
    setCommentaire('');
  };

  const closeGestion = () => {
    setGestion(null);
    setCommentaire('');
  };

  const changerStatut = async (statut: StatutDevis) => {
    if (!gestion) return;
    setBusy(true);

    const { error: updateError } = await supabase
      .from(DEMANDES_DEVIS_TABLE)
      .update({ statut })
      .eq('id', gestion.id);

    if (updateError) {
      toast.error('Impossible de mettre à jour la demande.');
      setBusy(false);
      return;
    }

    await supabase.from(HISTORIQUE_STATUT_TABLE).insert({
      demande_devis_id: gestion.id,
      statut,
      commentaire_admin: commentaire.trim() || null,
    });

    // Notifie le client par email si RESEND_API_KEY est configurée côté
    // Supabase ; la fonction se contente de ne rien envoyer sinon (pas
    // bloquant, le statut est déjà mis à jour).
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_devis_notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ demande_devis_id: gestion.id }),
      }).catch(() => {});
    }

    toast.success('Demande mise à jour.');
    setBusy(false);
    closeGestion();
    loadDemandes();
  };

  const clientLabel = (userId: string) => {
    const p = profiles[userId];
    if (!p) return '—';
    return p.nom_entreprise || p.nom_complet || '—';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="space-y-2">
            <AdminNav />
            <h1 className="font-display text-lg font-bold text-foreground">
              Admin — Demandes de devis
            </h1>
          </div>
          {nouvelles.length > 0 && (
            <Badge variant="outline" className="border-primary text-primary-emphasis">
              {nouvelles.length} nouvelle(s) demande(s)
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : demandes.length === 0 ? (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aucune demande de devis pour le moment.
          </p>
        ) : (
          <div className="divide-y rounded-md border">
            {demandes.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{d.reference_publique}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString('fr-FR')} · {clientLabel(d.user_id)} ·{' '}
                    {d.montant_total_estime_fcfa.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={STATUT_BADGE_VARIANT[d.statut]}>{STATUT_LABELS[d.statut]}</Badge>
                  <Button variant="outline" size="sm" onClick={() => openGestion(d)}>
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Gérer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!gestion} onOpenChange={(open) => !open && closeGestion()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Demande {gestion?.reference_publique}</DialogTitle>
          </DialogHeader>
          {gestion && (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm">
                <p className="text-muted-foreground">
                  Client : <span className="font-medium text-foreground">{clientLabel(gestion.user_id)}</span>
                </p>
                <p className="mt-1 text-muted-foreground">
                  Statut actuel :{' '}
                  <span className="font-medium text-foreground">{STATUT_LABELS[gestion.statut]}</span>
                </p>
                <p className="mt-1 text-muted-foreground">
                  Montant estimé :{' '}
                  <span className="font-medium text-foreground">
                    {gestion.montant_total_estime_fcfa.toLocaleString('fr-FR')} FCFA
                  </span>
                </p>
                {gestion.notes_client && (
                  <p className="mt-2 rounded-md bg-muted p-2 text-xs text-foreground">
                    « {gestion.notes_client} »
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Commentaire (optionnel, visible par le client)
                </label>
                <Textarea
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  rows={2}
                  placeholder="ex: devis détaillé envoyé par téléphone, délai de livraison 5 jours..."
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {PROCHAIN_STATUT[gestion.statut] && (
                  <Button onClick={() => changerStatut(PROCHAIN_STATUT[gestion.statut]!)} disabled={busy}>
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Passer à « {STATUT_LABELS[PROCHAIN_STATUT[gestion.statut]!]} »
                  </Button>
                )}
                {gestion.statut !== 'annulee' && gestion.statut !== 'commande_confirmee' && (
                  <Button variant="outline" onClick={() => changerStatut('annulee')} disabled={busy}>
                    Annuler la demande
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
