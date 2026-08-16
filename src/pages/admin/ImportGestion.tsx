import { useMemo, useState, type ChangeEvent } from 'react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { calculerPrimeAssurance } from '@/lib/cout-import';
import {
  supabase,
  PARAMETRES_IMPORT_TABLE,
  type ParametresImport,
  IMPORT_DOCUMENTS_BUCKET,
  DEMANDES_IMPORT_TABLE,
  HISTORIQUE_IMPORT_TABLE,
  DOCUMENTS_IMPORT_TABLE,
  PROFILES_TABLE,
  STATUT_IMPORT_LABELS,
  INCOTERM_LABELS,
  MODE_TRANSPORT_LABELS,
  TYPE_DOCUMENT_LABELS,
  type DemandeImport,
  type DocumentImport,
  type StatutImport,
  type TypeDocumentImport,
  type Profile,
  type ModeTransport,
  IMPORT_PHOTOS_BUCKET,
} from '@/lib/supabase';
import { useReferentiels, libellesPourDocument } from '@/hooks/useReferentiels';
import { GaleriePhotosPrivees, LienDocumentPrive } from '@/components/FichiersPrives';
import ChiffrageDouanierPanneau, { type ChiffrageDouanier } from '@/components/ChiffrageDouanier';
import AdminNav from '@/components/AdminNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Pencil, Send, Upload, FileText, ExternalLink, Paperclip } from 'lucide-react';

const STATUT_BADGE_VARIANT: Record<StatutImport, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  nouvelle: 'outline',
  en_cotation: 'secondary',
  devis_envoye: 'default',
  validee: 'default',
  achat_effectue: 'default',
  expedition_internationale: 'default',
  arrivee_ci: 'default',
  dedouanement: 'secondary',
  transit_local: 'default',
  livree: 'default',
  annulee: 'destructive',
};

/**
 * Le mode de transport du dossier, dit dans la langue de la douane.
 *
 * Le module d'import parle en mots (« maritime ») parce qu'un client remplit
 * un formulaire, pas une déclaration. La case 25 du modèle SYDAM attend le
 * code du Document Administratif Unique. La traduction se fait ici, une fois,
 * plutôt que dans le document.
 */
const MODE_TRANSPORT_CODE: Record<ModeTransport, string> = {
  maritime: '1',
  routier: '3',
  aerien: '4',
};

const STATUTS_POST_VALIDATION: StatutImport[] = [
  'achat_effectue',
  'expedition_internationale',
  'arrivee_ci',
  'dedouanement',
  'transit_local',
  'livree',
];

const selectClassName =
  'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm';

interface CotationForm {
  cout_marchandise_fcfa: string;
  cout_fret_fcfa: string;
  assurance_fcfa: string;
  douane_estimee_fcfa: string;
  transit_local_fcfa: string;
  livraison_fcfa: string;
  marge_fcfa: string;
  commentaire_admin_devis: string;
}

const emptyCotation: CotationForm = {
  cout_marchandise_fcfa: '',
  cout_fret_fcfa: '',
  assurance_fcfa: '',
  douane_estimee_fcfa: '',
  transit_local_fcfa: '',
  livraison_fcfa: '',
  marge_fcfa: '',
  commentaire_admin_devis: '',
};

export default function AdminImportGestion() {
  const referentiels = useReferentiels();
  const [demandes, setDemandes] = useState<DemandeImport[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [gestion, setGestion] = useState<DemandeImport | null>(null);
  const [documents, setDocuments] = useState<DocumentImport[]>([]);
  const [busy, setBusy] = useState(false);
  const [cotation, setCotation] = useState<CotationForm>(emptyCotation);
  const [docType, setDocType] = useState<TypeDocumentImport>('facture_fournisseur');
  const [uploading, setUploading] = useState(false);
  const [parametresAssurance, setParametresAssurance] = useState<ParametresImport | null>(null);
  const [chiffrage, setChiffrage] = useState<ChiffrageDouanier | null>(null);
  const [documentEnCours, setDocumentEnCours] = useState(false);

  useEffect(() => {
    supabase
      .from(PARAMETRES_IMPORT_TABLE)
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setParametresAssurance(data as ParametresImport | null));
  }, []);

  /**
   * Prime d'assurance facultés : assise sur la valeur CIF (marchandise + fret)
   * majorée du taux de couverture, jamais sur la seule valeur marchandise.
   */
  const apercuAssurance = useMemo(() => {
    if (!parametresAssurance) return null;
    const marchandise = parseFloat(cotation.cout_marchandise_fcfa);
    if (!Number.isFinite(marchandise) || marchandise <= 0) return null;
    return calculerPrimeAssurance({
      valeurMarchandiseFcfa: marchandise,
      coutFretFcfa: parseFloat(cotation.cout_fret_fcfa) || 0,
      tauxAssurance: Number(parametresAssurance.taux_assurance),
      tauxCouverture: Number(parametresAssurance.taux_couverture_assurance),
      fraisPoliceFcfa: Number(parametresAssurance.frais_police_assurance_fcfa),
      tauxTaxe: Number(parametresAssurance.taux_taxe_assurance),
    });
  }, [cotation.cout_marchandise_fcfa, cotation.cout_fret_fcfa, parametresAssurance]);

  const calculerAssurance = () => {
    if (!apercuAssurance) {
      toast.error("Renseignez d'abord la valeur de la marchandise.");
      return;
    }
    setCotation((c) => ({ ...c, assurance_fcfa: String(apercuAssurance.prime_fcfa) }));
  };

  const loadDemandes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from(DEMANDES_IMPORT_TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    const list = (data as DemandeImport[]) ?? [];
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

  const openGestion = async (d: DemandeImport) => {
    setGestion(d);
    setCotation({
      cout_marchandise_fcfa: d.cout_marchandise_fcfa != null ? String(d.cout_marchandise_fcfa) : '',
      cout_fret_fcfa: d.cout_fret_fcfa != null ? String(d.cout_fret_fcfa) : '',
      assurance_fcfa: d.assurance_fcfa != null ? String(d.assurance_fcfa) : '',
      douane_estimee_fcfa: d.douane_estimee_fcfa != null ? String(d.douane_estimee_fcfa) : '',
      transit_local_fcfa: d.transit_local_fcfa != null ? String(d.transit_local_fcfa) : '',
      livraison_fcfa: d.livraison_fcfa != null ? String(d.livraison_fcfa) : '',
      marge_fcfa: d.marge_fcfa != null ? String(d.marge_fcfa) : '',
      commentaire_admin_devis: d.commentaire_admin_devis ?? '',
    });
    setChiffrage((d.chiffrage_douanier as ChiffrageDouanier | null) ?? null);
    const { data } = await supabase.from(DOCUMENTS_IMPORT_TABLE).select('*').eq('demande_import_id', d.id);
    setDocuments((data as DocumentImport[]) ?? []);
  };

  const closeGestion = () => {
    setGestion(null);
    setDocuments([]);
    setCotation(emptyCotation);
    setChiffrage(null);
  };

  const clientLabel = (userId: string) => {
    const p = profiles[userId];
    if (!p) return '—';
    return p.nom_entreprise || p.nom_complet || '—';
  };

  const totalDevis = () => {
    const values = [
      cotation.cout_marchandise_fcfa,
      cotation.cout_fret_fcfa,
      cotation.assurance_fcfa,
      cotation.douane_estimee_fcfa,
      cotation.transit_local_fcfa,
      cotation.livraison_fcfa,
      cotation.marge_fcfa,
    ];
    return values.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  };

  /**
   * Le chiffrage retenu : il remplit « Douane estimée » et se range avec la
   * demande. On archive la SAISIE et le RÉSULTAT, pas seulement le total —
   * sans quoi personne ne saurait plus, dans trois mois, d'où sort le chiffre
   * qu'on a facturé.
   */
  const retenirChiffrage = async (c: ChiffrageDouanier) => {
    if (!gestion) return;
    setChiffrage(c);
    setCotation((f) => ({ ...f, douane_estimee_fcfa: String(Math.round(c.liquidation.total_a_payer_fcfa)) }));
    const { error } = await supabase
      .from(DEMANDES_IMPORT_TABLE)
      .update({ chiffrage_douanier: c })
      .eq('id', gestion.id);
    if (error) {
      toast.error('Chiffrage reporté à l’écran mais non enregistré.');
      return;
    }
    toast.success('Douane estimée mise à jour depuis le calcul officiel.');
  };

  /**
   * Le document douanier, joint au devis.
   *
   * Il part dans le même dépôt que les autres pièces du dossier et s'inscrit
   * dans la liste des documents de la demande : le client le retrouve dans son
   * espace, à côté de son devis, sans qu'on ait à le lui envoyer.
   */
  const joindreDocumentDouanier = async () => {
    if (!gestion || !chiffrage) return;
    setDocumentEnCours(true);
    try {
      const { declarationPdfBlob, nomDeclarationPdf } = await import('@/lib/declaration-pdf');

      const valeurs = {
        type_declaration: 'IM',
        reference: gestion.reference_publique,
        regime: chiffrage.regime,
        date: new Date().toISOString().slice(0, 10),
        importateur: clientLabel(gestion.user_id),
        pays_origine: chiffrage.pays_origine,
        pays_expedition: chiffrage.pays_origine,
        pays_destination: 'CI',
        mode_transport: MODE_TRANSPORT_CODE[gestion.mode_transport] ?? '',
        incoterm: gestion.incoterm ?? '',
        declarant: 'MayLary Group — Dems’Inc, Abidjan',
        devise: 'XOF',
        taux_change: '1',
        masse_brute: gestion.poids_estime_kg != null ? String(gestion.poids_estime_kg) : '',
        documents_joints: 'Devis MayLary Group — pièces du dossier en cours de constitution.',
      };

      const blob = declarationPdfBlob({
        valeurs,
        lignes: chiffrage.lignes,
        liquidation: chiffrage.liquidation,
        libelles: libellesPourDocument(referentiels),
      });

      const nom = nomDeclarationPdf(gestion.reference_publique);
      const path = `${gestion.id}/${crypto.randomUUID()}-${nom}`;
      const { error: uploadError } = await supabase.storage
        .from(IMPORT_DOCUMENTS_BUCKET)
        .upload(path, blob, { contentType: 'application/pdf' });
      if (uploadError) {
        toast.error("Le document n'a pas pu être déposé.");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: doc, error: insertError } = await supabase
        .from(DOCUMENTS_IMPORT_TABLE)
        .insert({
          demande_import_id: gestion.id,
          type_document: 'declaration_douaniere',
          nom_fichier: nom,
          url: path,
          uploaded_by: user?.id ?? null,
        })
        .select('*')
        .single();

      if (insertError || !doc) {
        toast.error("Document déposé mais impossible de l'enregistrer.");
        return;
      }
      setDocuments((prev) => [...prev, doc as DocumentImport]);
      toast.success('Document douanier joint au dossier du client.');
    } finally {
      setDocumentEnCours(false);
    }
  };

  const majStatut = async (statut: StatutImport, extra: Record<string, unknown> = {}) => {
    if (!gestion) return false;
    const { error: updateError } = await supabase
      .from(DEMANDES_IMPORT_TABLE)
      .update({ statut, ...extra })
      .eq('id', gestion.id);
    if (updateError) {
      toast.error('Impossible de mettre à jour la demande.');
      return false;
    }
    await supabase.from(HISTORIQUE_IMPORT_TABLE).insert({
      demande_import_id: gestion.id,
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
      cout_marchandise_fcfa: parseFloat(cotation.cout_marchandise_fcfa) || null,
      cout_fret_fcfa: parseFloat(cotation.cout_fret_fcfa) || null,
      assurance_fcfa: parseFloat(cotation.assurance_fcfa) || null,
      douane_estimee_fcfa: parseFloat(cotation.douane_estimee_fcfa) || null,
      transit_local_fcfa: parseFloat(cotation.transit_local_fcfa) || null,
      livraison_fcfa: parseFloat(cotation.livraison_fcfa) || null,
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

  const avancerStatut = async (statut: StatutImport) => {
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
    const { error: uploadError } = await supabase.storage.from(IMPORT_DOCUMENTS_BUCKET).upload(path, file);
    if (uploadError) {
      toast.error("Impossible d'uploader le document.");
      setUploading(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: doc, error: insertError } = await supabase
      .from(DOCUMENTS_IMPORT_TABLE)
      .insert({
        demande_import_id: gestion.id,
        type_document: docType,
        nom_fichier: file.name,
        url: path,
        uploaded_by: user?.id ?? null,
      })
      .select('*')
      .single();

    if (insertError || !doc) {
      toast.error("Document uploadé mais impossible de l'enregistrer.");
    } else {
      setDocuments((prev) => [...prev, doc as DocumentImport]);
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
            <h1 className="font-display text-lg font-bold text-foreground">Admin — Demandes d'import</h1>
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
            Aucune demande d'import pour le moment.
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
                    {d.montant_total_devis_fcfa
                      ? ` · ${d.montant_total_devis_fcfa.toLocaleString('fr-FR')} FCFA`
                      : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={STATUT_BADGE_VARIANT[d.statut]}>{STATUT_IMPORT_LABELS[d.statut]}</Badge>
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
                  <span className="font-medium text-foreground">{STATUT_IMPORT_LABELS[gestion.statut]}</span>
                </p>
                <p className="mt-2 font-medium text-foreground">{gestion.description_produit}</p>
                {gestion.lien_produit && (
                  <a
                    href={gestion.lien_produit}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Lien produit <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <GaleriePhotosPrivees bucket={IMPORT_PHOTOS_BUCKET} valeurs={gestion.photos} />
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                  <span>Quantité : {gestion.quantite}</span>
                  <span>Pays : {gestion.pays_fournisseur ?? '—'}</span>
                  <span>Incoterm : {gestion.incoterm ? INCOTERM_LABELS[gestion.incoterm] : '—'}</span>
                  <span>Transport : {MODE_TRANSPORT_LABELS[gestion.mode_transport]}</span>
                  <span>Transporteur : {gestion.transporteur_souhaite ?? '—'}</span>
                  <span>Contrainte de date annoncée : {gestion.delai_souhaite ?? 'aucune'}</span>
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
                  <div className="cascade grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Marchandise (FCFA)</Label>
                      <Input
                        type="number"
                        value={cotation.cout_marchandise_fcfa}
                        onChange={(e) => setCotation((c) => ({ ...c, cout_marchandise_fcfa: e.target.value }))}
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
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          Valeur assurée {apercuAssurance.valeur_assuree_fcfa.toLocaleString('fr-FR')} (CIF ×{' '}
                          {Math.round(Number(parametresAssurance?.taux_couverture_assurance ?? 1.1) * 100)} %) ·
                          prime nette {apercuAssurance.prime_nette_fcfa.toLocaleString('fr-FR')} · frais de police{' '}
                          {apercuAssurance.frais_police_fcfa.toLocaleString('fr-FR')} · taxe{' '}
                          {apercuAssurance.taxe_fcfa.toLocaleString('fr-FR')} →{' '}
                          <strong className="text-foreground">
                            {apercuAssurance.prime_fcfa.toLocaleString('fr-FR')} FCFA
                          </strong>
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Douane estimée (FCFA)</Label>
                      <Input
                        type="number"
                        value={cotation.douane_estimee_fcfa}
                        onChange={(e) => setCotation((c) => ({ ...c, douane_estimee_fcfa: e.target.value }))}
                      />
                      {chiffrage && (
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          Chiffré au tarif le{' '}
                          {new Date(chiffrage.calcule_le).toLocaleDateString('fr-FR')} sur{' '}
                          {chiffrage.lignes.length} article{chiffrage.lignes.length > 1 ? 's' : ''} —
                          régime {chiffrage.regime}.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Transit local (FCFA)</Label>
                      <Input
                        type="number"
                        value={cotation.transit_local_fcfa}
                        onChange={(e) => setCotation((c) => ({ ...c, transit_local_fcfa: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Livraison (FCFA)</Label>
                      <Input
                        type="number"
                        value={cotation.livraison_fcfa}
                        onChange={(e) => setCotation((c) => ({ ...c, livraison_fcfa: e.target.value }))}
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
                  {/* Le chiffrage douanier prend la place où l'on devinait un
                      nombre. Il est sous la grille des coûts parce qu'il a
                      besoin du fret et de l'assurance déjà saisis au-dessus. */}
                  <ChiffrageDouanierPanneau
                    key={gestion.id}
                    referentiels={referentiels}
                    descriptionProduit={gestion.description_produit}
                    valeurMarchandiseFcfa={
                      parseFloat(cotation.cout_marchandise_fcfa) ||
                      gestion.valeur_marchandise_estimee_fcfa ||
                      0
                    }
                    poidsKg={gestion.poids_estime_kg}
                    paysFournisseur={gestion.pays_fournisseur}
                    fretFcfa={parseFloat(cotation.cout_fret_fcfa) || 0}
                    assuranceFcfa={parseFloat(cotation.assurance_fcfa) || 0}
                    initial={chiffrage}
                    onRetenir={retenirChiffrage}
                  />

                  {chiffrage && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={joindreDocumentDouanier}
                      disabled={documentEnCours}
                    >
                      {documentEnCours ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Paperclip className="mr-2 h-4 w-4" />
                      )}
                      Joindre le document douanier au dossier
                    </Button>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs">Commentaire (visible par le client)</Label>
                    <Textarea
                      value={cotation.commentaire_admin_devis}
                      onChange={(e) => setCotation((c) => ({ ...c, commentaire_admin_devis: e.target.value }))}
                      rows={2}
                      placeholder="ex: délai estimé 25 jours, dédouanement inclus..."
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
                        {STATUT_IMPORT_LABELS[s]}
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
                    <LienDocumentPrive
                      key={doc.id}
                      bucket={IMPORT_DOCUMENTS_BUCKET}
                      valeur={doc.url}
                      className="flex w-full items-center justify-between rounded-md border p-2 text-sm hover:bg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {TYPE_DOCUMENT_LABELS[doc.type_document]} — {doc.nom_fichier}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </LienDocumentPrive>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={selectClassName}
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as TypeDocumentImport)}
                  >
                    {(Object.keys(TYPE_DOCUMENT_LABELS) as TypeDocumentImport[]).map((t) => (
                      <option key={t} value={t}>
                        {TYPE_DOCUMENT_LABELS[t]}
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
