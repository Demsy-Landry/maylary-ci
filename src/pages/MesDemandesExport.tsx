import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import PublicHeaderImport from '@/components/PublicHeaderImport';
import SiteFooter from '@/components/SiteFooter';
import { useAuth } from '@/hooks/useAuth';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  DEMANDES_EXPORT_TABLE,
  HISTORIQUE_EXPORT_TABLE,
  DOCUMENTS_EXPORT_TABLE,
  STATUT_EXPORT_LABELS,
  STATUT_EXPORT_MESSAGES,
  TYPE_DOCUMENT_EXPORT_LABELS,
  type DemandeExport,
  type HistoriqueStatutExport,
  type DocumentExport,
  type StatutExport,
  EXPORT_PHOTOS_BUCKET,
  EXPORT_DOCUMENTS_BUCKET,
} from '@/lib/supabase';
import { GaleriePhotosPrivees, LienDocumentPrive } from '@/components/FichiersPrives';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Eye, Ship, FileText, ExternalLink } from 'lucide-react';
import BoutonFacture from '@/components/BoutonFacture';

/** Statuts à partir desquels le dossier est engagé : la facture est émise. */
const FACTURE_EXPORT_DISPONIBLE: StatutExport[] = [
  'validee',
  'collecte_effectuee',
  'dedouanement_export',
  'expedition_internationale',
  'arrivee_destination',
  'livree',
];

const STATUT_BADGE_VARIANT: Record<StatutExport, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  nouvelle: 'outline',
  en_cotation: 'secondary',
  devis_envoye: 'default',
  validee: 'default',
  collecte_effectuee: 'default',
  dedouanement_export: 'secondary',
  expedition_internationale: 'default',
  arrivee_destination: 'default',
  livree: 'default',
  annulee: 'destructive',
};

const LIGNES_DEVIS: { key: keyof DemandeExport; label: string }[] = [
  { key: 'transport_local_fcfa', label: 'Transport local (collecte)' },
  { key: 'douane_export_fcfa', label: 'Douane export' },
  { key: 'cout_fret_fcfa', label: 'Fret international' },
  { key: 'assurance_fcfa', label: 'Assurance' },
  { key: 'frais_certification_fcfa', label: 'Certifications' },
  { key: 'livraison_destination_fcfa', label: 'Livraison à destination' },
];

interface DemandeAvecDetail extends DemandeExport {
  historique: HistoriqueStatutExport[];
  documents: DocumentExport[];
}

export default function MesDemandesExport() {
  const { user, loading: authLoading, profilEnCours, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();

  const [demandes, setDemandes] = useState<DemandeExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<DemandeAvecDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [validating, setValidating] = useState(false);

  const loadDemandes = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from(DEMANDES_EXPORT_TABLE)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setDemandes((data as DemandeExport[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadDemandes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openDetail = async (demande: DemandeExport) => {
    setDetailLoading(true);
    const [historiqueRes, documentsRes] = await Promise.all([
      supabase
        .from(HISTORIQUE_EXPORT_TABLE)
        .select('*')
        .eq('demande_export_id', demande.id)
        .order('horodatage', { ascending: false }),
      supabase.from(DOCUMENTS_EXPORT_TABLE).select('*').eq('demande_export_id', demande.id),
    ]);
    setDetail({
      ...demande,
      historique: (historiqueRes.data as HistoriqueStatutExport[]) ?? [],
      documents: (documentsRes.data as DocumentExport[]) ?? [],
    });
    setDetailLoading(false);
  };

  // Ouvre automatiquement le détail si on arrive via un lien "Mon compte"
  // pointant vers une référence précise.
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (!ref || demandes.length === 0) return;
    const match = demandes.find((d) => d.reference_publique === ref);
    if (match) openDetail(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandes, searchParams]);

  // Les redirections viennent après tous les hooks : un `return` anticipé
  // placé au-dessus changerait le nombre de hooks entre deux rendus et ferait
  // planter React au moment où l'authentification finit de charger.
  if (authLoading || (user && profilEnCours)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || isAdmin) {
    return <Navigate to="/boutique/compte" replace />;
  }

  const validerDevis = async () => {
    if (!detail) return;
    setValidating(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setValidating(false);
      return;
    }
    const res = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_export_valider_devis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ demande_export_id: detail.id }),
    });
    if (!res.ok) {
      toast.error("Impossible de valider le devis. Réessayez.");
      setValidating(false);
      return;
    }
    toast.success('Devis validé ! Nous organisons la collecte.');
    setValidating(false);
    setDetail(null);
    loadDemandes();
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderImport />
      <main className="entree-page mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Mes demandes d'export</h1>
        <p className="text-sm text-muted-foreground">Suivi de vos demandes d'exportation</p>

        {loading ? (
          <div className="mt-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : demandes.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed p-10 text-center">
            <Ship className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Vous n'avez pas encore fait de demande d'export.
            </p>
            <Button asChild className="mt-4">
              <a href="/export/nouvelle-demande">Faire une demande d'export</a>
            </Button>
          </div>
        ) : (
          <div className="mt-6 divide-y rounded-md border">
            {demandes.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{d.reference_publique}</p>
                  <p className="truncate text-xs text-muted-foreground">{d.description_produit}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString('fr-FR')}
                    {d.montant_total_devis_fcfa
                      ? ` · ${d.montant_total_devis_fcfa.toLocaleString('fr-FR')} FCFA`
                      : d.estimation_indicative_fcfa
                        ? ` · ~${d.estimation_indicative_fcfa.toLocaleString('fr-FR')} FCFA (estimation)`
                        : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={STATUT_BADGE_VARIANT[d.statut]}>{STATUT_EXPORT_LABELS[d.statut]}</Badge>
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
            <DialogTitle>Demande {detail?.reference_publique}</DialogTitle>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium text-foreground">{STATUT_EXPORT_LABELS[detail.statut]}</p>
                <p className="mt-1 text-muted-foreground">{STATUT_EXPORT_MESSAGES[detail.statut]}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground">Marchandise à exporter</p>
                <p className="mt-1 text-sm text-muted-foreground">{detail.description_produit}</p>
                <GaleriePhotosPrivees bucket={EXPORT_PHOTOS_BUCKET} valeurs={detail.photos} />
              </div>

              {detail.montant_total_devis_fcfa ? (
                <div>
                  <p className="text-sm font-medium text-foreground">Détail du devis</p>
                  <div className="mt-2 divide-y rounded-md border text-sm">
                    {LIGNES_DEVIS.filter((l) => detail[l.key] != null).map((l) => (
                      <div key={l.key} className="flex items-center justify-between p-2">
                        <span className="text-muted-foreground">{l.label}</span>
                        <span className="font-medium">
                          {(detail[l.key] as number).toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-right text-sm font-semibold text-foreground">
                    Total : {detail.montant_total_devis_fcfa.toLocaleString('fr-FR')} FCFA
                  </p>
                  {detail.commentaire_admin_devis && (
                    <p className="mt-2 rounded-md bg-muted p-2 text-xs text-foreground">
                      « {detail.commentaire_admin_devis} »
                    </p>
                  )}
                  {detail.statut === 'devis_envoye' && (
                    <Button className="mt-3 w-full" onClick={validerDevis} disabled={validating}>
                      {validating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Valider ce devis et lancer mon export
                    </Button>
                  )}

                  <div className="mt-4 rounded-md border p-3">
                    <p className="text-sm font-medium text-foreground">Documents comptables</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {FACTURE_EXPORT_DISPONIBLE.includes(detail.statut)
                        ? 'Votre facture définitive est disponible au téléchargement (PDF).'
                        : 'Téléchargez la proforma de ce devis. La facture définitive sera émise une fois le devis validé.'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <BoutonFacture sourceType="demande_export" sourceId={detail.id} typeDocument="proforma" />
                      {FACTURE_EXPORT_DISPONIBLE.includes(detail.statut) && (
                        <BoutonFacture
                          sourceType="demande_export"
                          sourceId={detail.id}
                          typeDocument="facture"
                          variant="default"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                detail.estimation_indicative_fcfa && (
                  <p className="text-sm text-muted-foreground">
                    Estimation indicative : ~{detail.estimation_indicative_fcfa.toLocaleString('fr-FR')} FCFA
                    (devis ferme à venir)
                  </p>
                )
              )}

              {detail.documents.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground">Documents</p>
                  <div className="mt-2 space-y-1.5">
                    {detail.documents.map((doc) => (
                      <LienDocumentPrive
                        key={doc.id}
                        bucket={EXPORT_DOCUMENTS_BUCKET}
                        valeur={doc.url}
                        className="flex w-full items-center justify-between rounded-md border p-2 text-sm hover:bg-muted"
                      >
                        <span className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {TYPE_DOCUMENT_EXPORT_LABELS[doc.type_document]}
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </LienDocumentPrive>
                    ))}
                  </div>
                </div>
              )}

              {detail.historique.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground">Suivi de la demande</p>
                  <div className="mt-2 space-y-2">
                    {detail.historique.map((h) => (
                      <div key={h.id} className="rounded-md border p-2 text-xs">
                        <p className="font-medium">
                          {STATUT_EXPORT_LABELS[h.statut]} — {new Date(h.horodatage).toLocaleString('fr-FR')}
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
