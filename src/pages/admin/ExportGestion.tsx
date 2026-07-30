import { useMemo, useState, type ChangeEvent } from 'react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { calculerPrimeAssurance } from '@/lib/cout-import';
import { PARAMETRES_IMPORT_TABLE, type ParametresImport } from '@/lib/supabase';
import {
  supabase,
  EXPORT_DOCUMENTS_BUCKET,
  DEMANDES_EXPORT_TABLE,
  HISTORIQUE_EXPORT_TABLE,
  DOCUMENTS_EXPORT_TABLE,
  PROFILES_TABLE,
  STATUT_EXPORT_LABELS,
  INCOTERM_LABELS,
  MODE_TRANSPORT_LABELS,
  TYPE_DOCUMENT_EXPORT_LABELS,
  type DemandeExport,
  type DocumentExport,
  type StatutExport,
  type TypeDocumentExport,
  type Profile,
} from '@/lib/supabase';
import AdminNav from '@/components/AdminNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Pencil, Send, Upload, FileText, ExternalLink } from 'lucide-react';

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

const STATUTS_POST_VALIDATION: StatutExport[] = [
  'collecte_effectuee',
  'dedouanement_export',
  'expedition_internationale',
  'arrivee_destination',
  'livree',
];

const selectClassName =
  'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm';

interface CotationForm {
  transport_local_fcfa: string;
  douane_export_fcfa: string;
  cout_fret_fcfa: string;
  assurance_fcfa: string;
  frais_certification_fcfa: string;
  livraison_destination_fcfa: string;
  marge_fcfa: string;
  commentaire_admin_devis: string;
}

const emptyCotation: CotationForm = {
  transport_local_fcfa: '',
  douane_export_fcfa: '',
  cout_fret_fcfa: '',
  assurance_fcfa: '',
  frais_certification_fcfa: '',
  livraison_destination_fcfa: '',
  marge_fcfa: '',
  commentaire_admin_devis: '',
};

export default function AdminExportGestion() {
  const [demandes, setDemandes] = useState<DemandeExport[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [gestion, setGestion] = useState<DemandeExport | null>(null);
  const [documents, setDocuments] = useState<DocumentExport[]>([]);
  const [busy, setBusy] = useState(false);
  const [cotation, setCotation] = useState<CotationForm>(emptyCotation);
  const [docType, setDocType] = useState<TypeDocumentExport>('facture_commerciale');
  const [uploading, setUploading] = useState(false);
  const [parametresAssurance, setParametresAssurance] = useState<ParametresImport | null>(null);

  useEffect(() => {
    supabase
      .from(PARAMETRES_IMPORT_TABLE)
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setParametresAssurance(data as ParametresImport | null));
  }, []);

  /**
   * Prime d'assurance facultés à l'export : assise sur la valeur déclarée par
   * le client augmentée du fret, majorée du taux de couverture.
   */
  const apercuAssurance = useMemo(() => {
    const valeur = Number(gestion?.valeur_marchandise_estimee_fcfa ?? 0);
    if (!parametresAssurance || valeur <= 0) return null;
    return calculerPrimeAssurance({
      valeurMarchandiseFcfa: valeur,
      coutFretFcfa: parseFloat(cotation.cout_fret_fcfa) || 0,
      tauxAssurance: Number(parametresAssurance.taux_assurance),
      tauxCouverture: Number(parametresAssurance.taux_couverture_assurance),
      primeMinimumFcfa: Number(parametresAssurance.prime_assurance_minimum_fcfa),
    });
  }, [gestion, cotation.cout_fret_fcfa, parametresAssurance]);

  const calculerAssurance = () => {
    if (!apercuAssurance) {
      toast.error("Le client n'a pas déclaré de valeur de marchandise pour cette demande.");
      return;
    }
    setCotation((c) => ({ ...c, assurance_fcfa: String(apercuAssurance.prime_fcfa) }));
  };

  const loadDemandes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from(DEMANDES_EXPORT_TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    const list = (data as DemandeExport[]) ?? [];
    setDemandes(list);

    const userIds = [...new Set(list.map((d) => d.user_id))];
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase.from(PROFILES_TABLE).select('*').in('user_id', userIds);
      const map: Record<string, Profile> = {};
      for (const p of (profilesData as Profile[]) ?? []) map[p.user_id] = p;
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDemandes();
  }, []);

  const aCoter = demandes.filter((d) => d.statut === 'nouvelle' || d.statut === 'en_cotation');

  const openGestion = async (d: DemandeExport) => {
    setGestion(d);
    setCotation({
      transport_local_fcfa: d.transport_local_fcfa != null ? String(d.transport_local_fcfa) : '',
      douane_export_fcfa: d.douane_export_fcfa != null ? String(d.douane_export_fcfa) : '',
      cout_fret_fcfa: d.cout_fret_fcfa != null ? String(d.cout_fret_fcfa) : '',
      assurance_fcfa: d.assurance_fcfa != null ? String(d.assurance_fcfa) : '',
      frais_certification_fcfa: d.frais_certification_fcfa != null ? String(d.frais_certification_fcfa) : '',
      livraison_destination_fcfa:
        d.livraison_destination_fcfa != null ? String(d.livraison_destination_fcfa) : '',
      marge_fcfa: d.marge_fcfa != null ? String(d.marge_fcfa) : '',
      commentaire_admin_devis: d.commentaire_admin_devis ?? '',
    });
    const { data } = await supabase.from(DOCUMENTS_EXPORT_TABLE).select('*').eq('demande_export_id', d.id);
    setDocuments((data as DocumentExport[]) ?? []);
  };

  const closeGestion = () => {
    setGestion(null);
    setDocuments([]);
    setCotation(emptyCotation);
  };

  const clientLabel = (userId: string) => {
    const p = profiles[userId];
    if (!p) return '—';
    return p.nom_entreprise || p.nom_complet || '—';
  };

  const totalDevis = () => {
    const values = [
      cotation.transport_local_fcfa,
      cotation.douane_export_fcfa,
      cotation.cout_fret_fcfa,
      cotation.assurance_fcfa,
      cotation.frais_certification_fcfa,
      cotation.livraison_destination_fcfa,
      cotation.marge_fcfa,
    ];
    return values.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  };

  const majStatut = async (statut: StatutExport, extra: Record<string, unknown> = {}) => {
    if (!gestion) return false;
    const { error: updateError } = await supabase
      .from(DEMANDES_EXPORT_TABLE)
      .update({ statut, ...extra })
      .eq('id', gestion.id);
    if (updateError) {
      toast.error('Impossible de mettre à jour la demande.');
      return false;
    }
    await supabase.from(HISTORIQUE_EXPORT_TABLE).insert({
      demande_export_id: gestion.id,
      statut,
      commentaire_admin: null,
    });
    return true;
  };

  const passerEnCotation = async () => {
    if (!gestion) return;
    setBusy(true);
    if (await majStatut('en_cotation')) {
      toast.success('Demande passée en cotation.');
      closeGestion();
      loadDemandes();
    }
    setBusy(false);
  };

  const envoyerDevis = async () => {
    if (!gestion) return;
    const total = totalDevis();
    if (total <= 0) {
      toast.error('Renseignez au moins un poste de coût avant d’envoyer le devis.');
      return;
    }
    setBusy(true);
    const ok = await majStatut('devis_envoye', {
      transport_local_fcfa: parseFloat(cotation.transport_local_fcfa) || null,
      douane_export_fcfa: parseFloat(cotation.douane_export_fcfa) || null,
      cout_fret_fcfa: parseFloat(cotation.cout_fret_fcfa) || null,
      assurance_fcfa: parseFloat(cotation.assurance_fcfa) || null,
      frais_certification_fcfa: parseFloat(cotation.frais_certification_fcfa) || null,
      livraison_destination_fcfa: parseFloat(cotation.livraison_destination_fcfa) || null,
      marge_fcfa: parseFloat(cotation.marge_fcfa) || null,
      montant_total_devis_fcfa: total,
      commentaire_admin_devis: cotation.commentaire_admin_devis.trim() || null,
    });
    if (ok) {
      toast.success('Devis envoyé au client.');
      closeGestion();
      loadDemandes();
    }
    setBusy(false);
  };

  const avancerStatut = async (statut: StatutExport) => {
    setBusy(true);
    if (await majStatut(statut)) {
      toast.success('Demande mise à jour.');
      closeGestion();
      loadDemandes();
    }
    setBusy(false);
  };

  const handleUploadDocument = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !gestion) return;
    setUploading(true);

    const path = `${gestion.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from(EXPORT_DOCUMENTS_BUCKET).upload(path, file);
    if (uploadError) {
      toast.error("Impossible d'uploader le document.");
      setUploading(false);
      return;
    }
    const { data: publicUrl } = supabase.storage.from(EXPORT_DOCUMENTS_BUCKET).getPublicUrl(path);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: doc, error: insertError } = await supabase
      .from(DOCUMENTS_EXPORT_TABLE)
      .insert({
        demande_export_id: gestion.id,
        type_document: docType,
        nom_fichier: file.name,
        url: publicUrl.publicUrl,
        uploaded_by: user?.id ?? null,
      })
      .select('*')
      .single();

    if (insertError || !doc) {
      toast.error("Document uploadé mais impossible de l'enregistrer.");
    } else {
      setDocuments((prev) => [...prev, doc as DocumentExport]);
      toast.success('Document ajouté.');
    }
    setUploading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="space-y-2">
            <AdminNav />
            <h1 className="font-display text-lg font-bold text-foreground">Admin — Demandes d'export</h1>
          </div>
          {aCoter.length > 0 && (
            <Badge variant="outline" className="border-primary text-primary-emphasis">
              {aCoter.length} à coter
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
            Aucune demande d'export pour le moment.
          </p>
        ) : (
          <div className="divide-y rounded-md border">
            {demandes.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{d.reference_publique}</p>
                  <p className="truncate text-xs text-muted-foreground">{d.description_produit}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString('fr-FR')} · {clientLabel(d.user_id)} ·{' '}
                    {MODE_TRANSPORT_LABELS[d.mode_transport]}
                    {d.pays_destination ? ` · vers ${d.pays_destination}` : ''}
                    {d.montant_total_devis_fcfa
                      ? ` · ${d.montant_total_devis_fcfa.toLocaleString('fr-FR')} FCFA`
                      : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={STATUT_BADGE_VARIANT[d.statut]}>{STATUT_EXPORT_LABELS[d.statut]}</Badge>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Demande {gestion?.reference_publique}</DialogTitle>
          </DialogHeader>
          {gestion && (
            <div className="space-y-5">
              <div className="rounded-md border p-3 text-sm">
                <p className="text-muted-foreground">
                  Client : <span className="font-medium text-foreground">{clientLabel(gestion.user_id)}</span>
                  {' · '}
                  Statut :{' '}
                  <span className="font-medium text-foreground">{STATUT_EXPORT_LABELS[gestion.statut]}</span>
                </p>
                <p className="mt-2 font-medium text-foreground">{gestion.description_produit}</p>
                {gestion.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {gestion.photos.map((url, i) => (
                      <img key={i} src={url} alt="" className="h-16 w-16 rounded-md border object-cover" />
                    ))}
                  </div>
                )}
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                  <span>Quantité : {gestion.quantite}</span>
                  <span>Destination : {gestion.pays_destination ?? '—'}</span>
                  <span>Incoterm : {gestion.incoterm ? INCOTERM_LABELS[gestion.incoterm] : '—'}</span>
                  <span>Transport : {MODE_TRANSPORT_LABELS[gestion.mode_transport]}</span>
                  <span>Acheteur : {gestion.acheteur_destinataire ?? '—'}</span>
                  <span>Contact acheteur : {gestion.contact_acheteur ?? '—'}</span>
                  <span>Transporteur : {gestion.transporteur_souhaite ?? '—'}</span>
                  <span>Délai : {gestion.delai_souhaite ?? '—'}</span>
                  <span>Poids : {gestion.poids_estime_kg ?? '—'} kg</span>
                  <span>Volume : {gestion.volume_estime_m3 ?? '—'} m³</span>
                  <span>
                    Valeur estimée :{' '}
                    {gestion.valeur_marchandise_estimee_fcfa
                      ? `${gestion.valeur_marchandise_estimee_fcfa.toLocaleString('fr-FR')} FCFA`
                      : '—'}
                  </span>
                </div>
                {gestion.notes_client && (
                  <p className="mt-2 rounded-md bg-muted p-2 text-xs text-foreground">
                    « {gestion.notes_client} »
                  </p>
                )}
              </div>

              {(gestion.statut === 'nouvelle' || gestion.statut === 'en_cotation') && (
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium text-foreground">Atelier de cotation</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Transport local (FCFA)</Label>
                      <Input
                        type="number"
                        value={cotation.transport_local_fcfa}
                        onChange={(e) => setCotation((c) => ({ ...c, transport_local_fcfa: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Douane export (FCFA)</Label>
                      <Input
                        type="number"
                        value={cotation.douane_export_fcfa}
                        onChange={(e) => setCotation((c) => ({ ...c, douane_export_fcfa: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fret international (FCFA)</Label>
                      <Input
                        type="number"
                        value={cotation.cout_fret_fcfa}
                        onChange={(e) => setCotation((c) => ({ ...c, cout_fret_fcfa: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs">Assurance (FCFA)</Label>
                        <button
                          type="button"
                          onClick={calculerAssurance}
                          className="text-[11px] font-medium text-primary hover:underline"
                        >
                          Calculer
                        </button>
                      </div>
                      <Input
                        type="number"
                        value={cotation.assurance_fcfa}
                        onChange={(e) => setCotation((c) => ({ ...c, assurance_fcfa: e.target.value }))}
                      />
                      {apercuAssurance && (
                        <p className="text-[11px] text-muted-foreground">
                          Valeur assurée {apercuAssurance.valeur_assuree_fcfa.toLocaleString('fr-FR')} FCFA
                          {' '}(valeur déclarée + fret, × {Math.round(Number(parametresAssurance?.taux_couverture_assurance ?? 1.1) * 100)} %) →
                          prime {apercuAssurance.prime_fcfa.toLocaleString('fr-FR')} FCFA
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Certifications (FCFA)</Label>
                      <Input
                        type="number"
                        value={cotation.frais_certification_fcfa}
                        onChange={(e) =>
                          setCotation((c) => ({ ...c, frais_certification_fcfa: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Livraison à destination (FCFA)</Label>
                      <Input
                        type="number"
                        value={cotation.livraison_destination_fcfa}
                        onChange={(e) =>
                          setCotation((c) => ({ ...c, livraison_destination_fcfa: e.target.value }))
                        }
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Marge (FCFA)</Label>
                      <Input
                        type="number"
                        value={cotation.marge_fcfa}
                        onChange={(e) => setCotation((c) => ({ ...c, marge_fcfa: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Commentaire (visible par le client)</Label>
                    <Textarea
                      value={cotation.commentaire_admin_devis}
                      onChange={(e) => setCotation((c) => ({ ...c, commentaire_admin_devis: e.target.value }))}
                      rows={2}
                      placeholder="ex: certificat phytosanitaire inclus, délai estimé 20 jours..."
                    />
                  </div>
                  <p className="text-right text-sm font-semibold text-foreground">
                    Total devis : {totalDevis().toLocaleString('fr-FR')} FCFA
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {gestion.statut === 'nouvelle' && (
                      <Button variant="outline" size="sm" onClick={passerEnCotation} disabled={busy}>
                        Marquer « en cours de cotation »
                      </Button>
                    )}
                    <Button size="sm" onClick={envoyerDevis} disabled={busy}>
                      {busy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Envoyer le devis au client
                    </Button>
                  </div>
                </div>
              )}

              {gestion.montant_total_devis_fcfa != null &&
                gestion.statut !== 'nouvelle' &&
                gestion.statut !== 'en_cotation' && (
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-medium text-foreground">
                      Devis envoyé : {gestion.montant_total_devis_fcfa.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                )}

              {STATUTS_POST_VALIDATION.includes(gestion.statut) || gestion.statut === 'validee' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Avancer manuellement le statut</Label>
                  <div className="flex flex-wrap gap-2">
                    {STATUTS_POST_VALIDATION.filter((s) => s !== gestion.statut).map((s) => (
                      <Button key={s} size="sm" variant="outline" onClick={() => avancerStatut(s)} disabled={busy}>
                        {STATUT_EXPORT_LABELS[s]}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              {gestion.statut !== 'annulee' && gestion.statut !== 'livree' && (
                <Button variant="ghost" size="sm" onClick={() => avancerStatut('annulee')} disabled={busy}>
                  Annuler la demande
                </Button>
              )}

              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium text-foreground">Documents</p>
                <div className="space-y-1.5">
                  {documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {TYPE_DOCUMENT_EXPORT_LABELS[doc.type_document]} — {doc.nom_fichier}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={selectClassName}
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as TypeDocumentExport)}
                  >
                    {(Object.keys(TYPE_DOCUMENT_EXPORT_LABELS) as TypeDocumentExport[]).map((t) => (
                      <option key={t} value={t}>
                        {TYPE_DOCUMENT_EXPORT_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Uploader
                    <input type="file" className="hidden" onChange={handleUploadDocument} disabled={uploading} />
                  </label>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
