import { useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicHeaderImport from '@/components/PublicHeaderImport';
import SiteFooter from '@/components/SiteFooter';
import { useAuth } from '@/hooks/useAuth';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  DEMANDES_IMPORT_TABLE,
  HISTORIQUE_IMPORT_TABLE,
  DOCUMENTS_IMPORT_TABLE,
  IMPORT_PHOTOS_BUCKET,
  IMPORT_DOCUMENTS_BUCKET,
  INCOTERM_LABELS,
  MODE_TRANSPORT_LABELS,
  TYPE_DOCUMENT_LABELS,
  estimerCoutIndicatifFcfa,
  type Incoterm,
  type ModeTransport,
  type TypeDocumentImport,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, ImagePlus, X, PackageSearch, Calculator, FileText, FilePlus2 } from 'lucide-react';

type DocumentAJoindre = { file: File; type: TypeDocumentImport };

const selectClassName =
  'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm';

export default function NouvelleDemandeImport() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [descriptionProduit, setDescriptionProduit] = useState('');
  const [lienProduit, setLienProduit] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [paysFournisseur, setPaysFournisseur] = useState('');
  const [incoterm, setIncoterm] = useState<Incoterm | ''>('');
  const [modeTransport, setModeTransport] = useState<ModeTransport>('maritime');
  const [transporteurSouhaite, setTransporteurSouhaite] = useState('');
  const [delaiSouhaite, setDelaiSouhaite] = useState('');
  const [poidsEstime, setPoidsEstime] = useState('');
  const [volumeEstime, setVolumeEstime] = useState('');
  const [valeurEstimee, setValeurEstimee] = useState('');
  const [notesClient, setNotesClient] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [documents, setDocuments] = useState<DocumentAJoindre[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [referencePublique, setReferencePublique] = useState<string | null>(null);

  const estimationIndicative = useMemo(() => {
    const poids = parseFloat(poidsEstime);
    const valeur = parseFloat(valeurEstimee);
    if (!poids || !valeur || poids <= 0 || valeur <= 0) return null;
    return estimerCoutIndicatifFcfa({
      poidsKg: poids,
      valeurMarchandiseFcfa: valeur,
      modeTransport,
      incoterm: incoterm || null,
    });
  }, [poidsEstime, valeurEstimee, modeTransport, incoterm]);

  const handlePhotosChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4);
    setPhotos((prev) => [...prev, ...files].slice(0, 4));
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDocumentsChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 6);
    setDocuments((prev) =>
      [...prev, ...files.map((file) => ({ file, type: 'facture_fournisseur' as TypeDocumentImport }))].slice(0, 6),
    );
    e.target.value = '';
  };

  const removeDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const updateDocumentType = (index: number, type: TypeDocumentImport) => {
    setDocuments((prev) => prev.map((doc, i) => (i === index ? { ...doc, type } : doc)));
  };

  const handleSubmit = async () => {
    setFormError('');

    if (!user) {
      toast.info('Connectez-vous pour envoyer votre demande d’import.');
      navigate('/boutique/compte');
      return;
    }
    if (!descriptionProduit.trim()) {
      setFormError('Décrivez le produit que vous souhaitez importer.');
      return;
    }
    const quantiteNum = parseInt(quantite, 10) || 1;

    setSubmitting(true);

    const photoUrls: string[] = [];
    for (const file of photos) {
      const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(IMPORT_PHOTOS_BUCKET)
        .upload(path, file);
      if (!uploadError) {
        // On garde le chemin, pas une URL : le bucket est privé, la lecture se
        // fait par lien signé au moment de l'affichage.
        photoUrls.push(path);
      }
    }

    const { data: demande, error: demandeError } = await supabase
      .from(DEMANDES_IMPORT_TABLE)
      .insert({
        user_id: user.id,
        description_produit: descriptionProduit.trim(),
        lien_produit: lienProduit.trim() || null,
        photos: photoUrls,
        quantite: quantiteNum,
        pays_fournisseur: paysFournisseur.trim() || null,
        incoterm: incoterm || null,
        mode_transport: modeTransport,
        transporteur_souhaite: transporteurSouhaite.trim() || null,
        delai_souhaite: delaiSouhaite.trim() || null,
        notes_client: notesClient.trim() || null,
        poids_estime_kg: poidsEstime ? parseFloat(poidsEstime) : null,
        volume_estime_m3: volumeEstime ? parseFloat(volumeEstime) : null,
        valeur_marchandise_estimee_fcfa: valeurEstimee ? parseFloat(valeurEstimee) : null,
        estimation_indicative_fcfa: estimationIndicative,
      })
      .select('id, reference_publique')
      .single();

    if (demandeError || !demande) {
      setFormError("Impossible d'enregistrer votre demande. Veuillez réessayer.");
      setSubmitting(false);
      return;
    }

    await supabase.from(HISTORIQUE_IMPORT_TABLE).insert({
      demande_import_id: demande.id,
      statut: 'nouvelle',
      commentaire_admin: null,
    });

    for (const doc of documents) {
      const path = `${user.id}/${crypto.randomUUID()}-${doc.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(IMPORT_DOCUMENTS_BUCKET)
        .upload(path, doc.file);
      if (!uploadError) {
        await supabase.from(DOCUMENTS_IMPORT_TABLE).insert({
          demande_import_id: demande.id,
          type_document: doc.type,
          nom_fichier: doc.file.name,
          url: path,
          uploaded_by: user.id,
        });
      }
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_admin_notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: 'import', reference_publique: demande.reference_publique }),
      }).catch(() => {});
    }

    setSubmitting(false);
    setReferencePublique(demande.reference_publique);
  };

  if (referencePublique) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeaderImport />
        <main className="mx-auto max-w-screen-md px-4 py-16 text-center sm:px-6">
          <div className="rounded-lg border bg-card p-8">
            <PackageSearch className="mx-auto h-8 w-8 text-primary" />
            <h1 className="mt-3 text-xl font-bold text-foreground">Demande d'import envoyée !</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Référence : <span className="font-semibold text-foreground">{referencePublique}</span>
            </p>
            <p className="mt-4 text-sm text-foreground">
              Notre équipe transit va chiffrer votre demande (marchandise, fret, douane, transit
              local) et vous transmettre un devis complet. Vous pouvez suivre chaque étape depuis
              « Mes demandes ».
            </p>
            <Button className="mt-6" onClick={() => navigate('/import/mes-demandes')}>
              Suivre ma demande
            </Button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderImport />
      <main className="mx-auto max-w-screen-md px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Faire une demande d'import</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Décrivez ce que vous voulez acheter à l'étranger — nous nous occupons de l'achat, du fret,
          de la douane et de la livraison chez vous.
        </p>

        <div className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="description-produit">Produit recherché *</Label>
            <Textarea
              id="description-produit"
              value={descriptionProduit}
              onChange={(e) => setDescriptionProduit(e.target.value)}
              rows={3}
              placeholder="ex: 200 casques audio Bluetooth, modèle X, référence fournisseur..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lien-produit">Lien vers le produit / fournisseur (optionnel)</Label>
            <Input
              id="lien-produit"
              value={lienProduit}
              onChange={(e) => setLienProduit(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Photos du produit (optionnel, 4 max)</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((file, i) => (
                <div key={i} className="relative h-16 w-16 overflow-hidden rounded-md border">
                  <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute right-0 top-0 rounded-bl-md bg-foreground/70 p-0.5 text-background"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < 4 && (
                <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-muted">
                  <ImagePlus className="h-5 w-5" />
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotosChange} />
                </label>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Documents (facture, bon de commande... optionnel, 6 max)</Label>
            <p className="text-xs text-muted-foreground">
              Vous avez déjà acheté cette marchandise et cherchez uniquement un transitaire pour le
              transport et la douane ? Scannez ou importez votre facture ici — notre équipe s'appuiera
              dessus pour chiffrer directement le fret, la douane et la livraison, sans repasser par l'achat.
            </p>
            <div className="space-y-2">
              {documents.map((doc, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border bg-card p-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground">{doc.file.name}</span>
                  <select
                    className="h-8 shrink-0 rounded-md border border-input bg-transparent px-2 text-xs outline-none"
                    value={doc.type}
                    onChange={(e) => updateDocumentType(i, e.target.value as TypeDocumentImport)}
                  >
                    {(Object.keys(TYPE_DOCUMENT_LABELS) as TypeDocumentImport[])
                      .filter((t) => t !== 'photo_produit')
                      .map((t) => (
                        <option key={t} value={t}>
                          {TYPE_DOCUMENT_LABELS[t]}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeDocument(i)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {documents.length < 6 && (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground hover:bg-muted">
                  <FilePlus2 className="h-4 w-4" />
                  Scanner / ajouter un document (photo ou PDF)
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="hidden"
                    onChange={handleDocumentsChange}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quantite">Quantité</Label>
              <Input
                id="quantite"
                type="number"
                min={1}
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pays-fournisseur">Pays du fournisseur</Label>
              <Input
                id="pays-fournisseur"
                value={paysFournisseur}
                onChange={(e) => setPaysFournisseur(e.target.value)}
                placeholder="ex: Chine, Turquie, France..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="incoterm">Incoterm souhaité</Label>
              <select
                id="incoterm"
                className={selectClassName}
                value={incoterm}
                onChange={(e) => setIncoterm(e.target.value as Incoterm | '')}
              >
                <option value="">Je ne sais pas — conseillez-moi</option>
                {(Object.keys(INCOTERM_LABELS) as Incoterm[]).map((code) => (
                  <option key={code} value={code}>
                    {INCOTERM_LABELS[code]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mode-transport">Mode de transport *</Label>
              <select
                id="mode-transport"
                className={selectClassName}
                value={modeTransport}
                onChange={(e) => setModeTransport(e.target.value as ModeTransport)}
              >
                {(Object.keys(MODE_TRANSPORT_LABELS) as ModeTransport[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {MODE_TRANSPORT_LABELS[mode]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transporteur">Compagnie de transport souhaitée (optionnel)</Label>
            <Input
              id="transporteur"
              value={transporteurSouhaite}
              onChange={(e) => setTransporteurSouhaite(e.target.value)}
              placeholder="ex: déjà en contact avec un transporteur ? indiquez-le ici"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="poids">Poids estimé (kg)</Label>
              <Input
                id="poids"
                type="number"
                min={0}
                value={poidsEstime}
                onChange={(e) => setPoidsEstime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="volume">Volume estimé (m³)</Label>
              <Input
                id="volume"
                type="number"
                min={0}
                value={volumeEstime}
                onChange={(e) => setVolumeEstime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valeur">Valeur marchandise (FCFA)</Label>
              <Input
                id="valeur"
                type="number"
                min={0}
                value={valeurEstimee}
                onChange={(e) => setValeurEstimee(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="delai">Délai souhaité (optionnel)</Label>
            <Input
              id="delai"
              value={delaiSouhaite}
              onChange={(e) => setDelaiSouhaite(e.target.value)}
              placeholder="ex: sous 4 semaines"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes complémentaires (optionnel)</Label>
            <Textarea
              id="notes"
              value={notesClient}
              onChange={(e) => setNotesClient(e.target.value)}
              rows={2}
            />
          </div>

          {estimationIndicative && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-start gap-3 pt-6">
                <Calculator className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Estimation indicative : {estimationIndicative.toLocaleString('fr-FR')} FCFA
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ordre de grandeur (marchandise + fret + douane/transit) à titre indicatif
                    uniquement. Le devis ferme de notre équipe transit prévaudra toujours.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Envoyer ma demande d'import
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
