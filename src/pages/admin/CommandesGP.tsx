import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  supabase,
  COMMANDES_GP_TABLE,
  HISTORIQUE_COMMANDE_GP_TABLE,
  STATUT_COMMANDE_GP_LABELS,
  MODE_PAIEMENT_LABELS,
  type CommandeGP,
  type StatutCommandeGP,
} from '@/lib/supabase';
import AdminNav from '@/components/AdminNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle2, AlertTriangle, Pencil } from 'lucide-react';

const STATUT_BADGE_VARIANT: Record<StatutCommandeGP, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  en_attente_paiement: 'secondary',
  paiement_recu_verification: 'outline',
  paiement_confirme: 'default',
  en_preparation: 'secondary',
  expediee: 'secondary',
  livree: 'default',
  annulee: 'destructive',
};

const STATUTS_ORDONNES: StatutCommandeGP[] = [
  'en_attente_paiement',
  'paiement_recu_verification',
  'paiement_confirme',
  'en_preparation',
  'expediee',
  'livree',
  'annulee',
];

type ProblemeAction = 'rembourser' | 'ajuster' | null;

export default function AdminCommandesGP() {
  const [commandes, setCommandes] = useState<CommandeGP[]>([]);
  const [loading, setLoading] = useState(true);
  const [gestion, setGestion] = useState<CommandeGP | null>(null);
  const [busy, setBusy] = useState(false);
  const [problemeAction, setProblemeAction] = useState<ProblemeAction>(null);
  const [commentaire, setCommentaire] = useState('');
  const [nouveauMontant, setNouveauMontant] = useState('');

  const loadCommandes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from(COMMANDES_GP_TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    setCommandes((data as CommandeGP[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadCommandes();
  }, []);

  const enVerification = commandes.filter((c) => c.statut === 'paiement_recu_verification');

  const openGestion = (commande: CommandeGP) => {
    setGestion(commande);
    setProblemeAction(null);
    setCommentaire('');
    setNouveauMontant(String(commande.montant_total_fcfa));
  };

  const closeGestion = () => {
    setGestion(null);
    setProblemeAction(null);
    setCommentaire('');
  };

  const majStatut = async (statut: StatutCommandeGP, commentaireAdmin: string | null) => {
    if (!gestion) return;
    setBusy(true);
    const { error: updateError } = await supabase
      .from(COMMANDES_GP_TABLE)
      .update({ statut })
      .eq('id', gestion.id);

    if (updateError) {
      toast.error('Impossible de mettre à jour la commande.');
      setBusy(false);
      return;
    }

    await supabase.from(HISTORIQUE_COMMANDE_GP_TABLE).insert({
      commande_id: gestion.id,
      statut,
      commentaire_admin: commentaireAdmin,
    });

    toast.success('Commande mise à jour.');
    setBusy(false);
    closeGestion();
    loadCommandes();
  };

  const handleConfirmer = () => majStatut('paiement_confirme', null);

  const handleRembourser = async () => {
    if (!commentaire.trim()) {
      toast.error('Merci de préciser le motif du remboursement.');
      return;
    }
    await majStatut('annulee', `Remboursement — ${commentaire.trim()}`);
  };

  const handleAjuster = async () => {
    if (!gestion) return;
    const montant = Number(nouveauMontant);
    if (!Number.isFinite(montant) || montant < 0) {
      toast.error('Montant invalide.');
      return;
    }
    if (!commentaire.trim()) {
      toast.error("Merci de préciser le motif de l'ajustement.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase
      .from(COMMANDES_GP_TABLE)
      .update({ montant_total_fcfa: montant })
      .eq('id', gestion.id);

    if (updateError) {
      toast.error("Impossible d'ajuster le montant.");
      setBusy(false);
      return;
    }

    await supabase.from(HISTORIQUE_COMMANDE_GP_TABLE).insert({
      commande_id: gestion.id,
      statut: gestion.statut,
      commentaire_admin: `Montant ajusté à ${montant.toLocaleString('fr-FR')} FCFA — ${commentaire.trim()}`,
    });

    toast.success('Montant ajusté.');
    setBusy(false);
    closeGestion();
    loadCommandes();
  };

  const handleAvancerStatut = async (statut: StatutCommandeGP) => {
    await majStatut(statut, null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="space-y-2">
            <AdminNav />
            <h1 className="font-display text-lg font-bold text-foreground">
              Admin — Commandes Boutique
            </h1>
          </div>
          {enVerification.length > 0 && (
            <Badge variant="outline" className="border-primary text-primary-emphasis">
              {enVerification.length} en attente de vérification
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
        ) : commandes.length === 0 ? (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aucune commande pour le moment.
          </p>
        ) : (
          <div className="divide-y rounded-md border">
            {commandes.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{c.reference_publique}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString('fr-FR')} · {c.nom_destinataire} ·{' '}
                    {c.telephone_destinataire} · {c.montant_total_fcfa.toLocaleString('fr-FR')} FCFA ·{' '}
                    {MODE_PAIEMENT_LABELS[c.mode_paiement]}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={STATUT_BADGE_VARIANT[c.statut]}>
                    {STATUT_COMMANDE_GP_LABELS[c.statut]}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => openGestion(c)}>
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
            <DialogTitle>Commande {gestion?.reference_publique}</DialogTitle>
          </DialogHeader>
          {gestion && (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm">
                <p className="text-muted-foreground">
                  Statut actuel :{' '}
                  <span className="font-medium text-foreground">
                    {STATUT_COMMANDE_GP_LABELS[gestion.statut]}
                  </span>
                </p>
                <p className="mt-1 text-muted-foreground">
                  Montant : <span className="font-medium text-foreground">
                    {gestion.montant_total_fcfa.toLocaleString('fr-FR')} FCFA
                  </span>
                </p>
              </div>

              {gestion.statut === 'paiement_recu_verification' && problemeAction === null && (
                <div className="space-y-2">
                  <Button className="w-full" onClick={handleConfirmer} disabled={busy}>
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Confirmer la commande
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setProblemeAction('rembourser')}
                    disabled={busy}
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Signaler un problème
                  </Button>
                </div>
              )}

              {problemeAction !== null && (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={problemeAction === 'rembourser' ? 'default' : 'outline'}
                      onClick={() => setProblemeAction('rembourser')}
                    >
                      Rembourser
                    </Button>
                    <Button
                      size="sm"
                      variant={problemeAction === 'ajuster' ? 'default' : 'outline'}
                      onClick={() => setProblemeAction('ajuster')}
                    >
                      Ajuster le montant
                    </Button>
                  </div>

                  {problemeAction === 'ajuster' && (
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Nouveau montant (FCFA)</label>
                      <Input
                        type="number"
                        value={nouveauMontant}
                        onChange={(e) => setNouveauMontant(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">
                      Motif ({problemeAction === 'rembourser' ? 'requis pour le client' : "requis"})
                    </label>
                    <Textarea
                      value={commentaire}
                      onChange={(e) => setCommentaire(e.target.value)}
                      rows={2}
                      placeholder={
                        problemeAction === 'rembourser'
                          ? 'ex: rupture de stock fournisseur, remboursement Mobile Money effectué'
                          : 'ex: écart de frais de livraison'
                      }
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setProblemeAction(null)} disabled={busy}>
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      onClick={problemeAction === 'rembourser' ? handleRembourser : handleAjuster}
                      disabled={busy}
                    >
                      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {problemeAction === 'rembourser' ? 'Confirmer le remboursement' : "Enregistrer l'ajustement"}
                    </Button>
                  </div>
                </div>
              )}

              {gestion.statut !== 'paiement_recu_verification' && problemeAction === null && (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Avancer manuellement le statut</label>
                  <div className="flex flex-wrap gap-2">
                    {STATUTS_ORDONNES.filter((s) => s !== gestion.statut).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant="outline"
                        onClick={() => handleAvancerStatut(s)}
                        disabled={busy}
                      >
                        {STATUT_COMMANDE_GP_LABELS[s]}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
