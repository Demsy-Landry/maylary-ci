import { useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicHeaderImport from '@/components/PublicHeaderImport';
import SiteFooter from '@/components/SiteFooter';
import ImageOuverture from '@/components/ImageOuverture';
import { useAuth } from '@/hooks/useAuth';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  DEMANDES_EXPORT_TABLE,
  HISTORIQUE_EXPORT_TABLE,
  DOCUMENTS_EXPORT_TABLE,
  EXPORT_PHOTOS_BUCKET,
  EXPORT_DOCUMENTS_BUCKET,
  INCOTERM_LABELS,
  MODE_TRANSPORT_LABELS,
  TYPE_DOCUMENT_EXPORT_LABELS,
  DROITS_EXPORT_FCFA,
  type Incoterm,
  type ModeTransport,
  type TypeDocumentExport,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, ImagePlus, X, Ship, Calculator, FileText, FilePlus2 } from 'lucide-react';

type DocumentAJoindre = { file: File; type: TypeDocumentExport };

const selectClassName =
  'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm';

export default function NouvelleDemandeExport() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [descriptionProduit, setDescriptionProduit] = useState('');
  const [paysDestination, setPaysDestination] = useState('');
  const [acheteurDestinataire, setAcheteurDestinataire] = useState('');
  const [contactAcheteur, setContactAcheteur] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [incoterm, setIncoterm] = useState<Incoterm | ''>('');
  const [modeTransport, setModeTransport] = useState<ModeTransport>('maritime');
  const [transporteurSouhaite, setTransporteurSouhaite] = useState('');
  const [poidsEstime, setPoidsEstime] = useState('');
  const [volumeEstime, setVolumeEstime] = useState('');
  const [valeurEstimee, setValeurEstimee] = useState('');
  const [notesClient, setNotesClient] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [documents, setDocuments] = useState<DocumentAJoindre[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [referencePublique, setReferencePublique] = useState<string | null>(null);

  // À l'export, la part douanière n'a pas besoin d'être estimée : elle est
  // connue. Seul le timbre statistique est dû, une fois par déclaration.
  const marchandiseRenseignee = useMemo(() => {
    const valeur = parseFloat(valeurEstimee);
    return Boolean(valeur && valeur > 0);
  }, [valeurEstimee]);

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
      [...prev, ...files.map((file) => ({ file, type: 'facture_commerciale' as TypeDocumentExport }))].slice(0, 6),
    );
    e.target.value = '';
  };

  const removeDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const updateDocumentType = (index: number, type: TypeDocumentExport) => {
    setDocuments((prev) => prev.map((doc, i) => (i === index ? { ...doc, type } : doc)));
  };

  const handleSubmit = async () => {
    setFormError('');

    if (!user) {
      toast.info('Connectez-vous pour envoyer votre demande d’export.');
      navigate('/boutique/compte');
      return;
    }
    if (!descriptionProduit.trim()) {
      setFormError('Décrivez la marchandise que vous souhaitez exporter.');
      return;
    }
    const quantiteNum = parseInt(quantite, 10) || 1;

    setSubmitting(true);

    const photoUrls: string[] = [];
    for (const file of photos) {
      const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from(EXPORT_PHOTOS_BUCKET).upload(path, file);
      if (!uploadError) {
        // On garde le chemin, pas une URL : le bucket est privé, la lecture se
        // fait par lien signé au moment de l'affichage.
        photoUrls.push(path);
      }
    }

    const { data: demande, error: demandeError } = await supabase
      .from(DEMANDES_EXPORT_TABLE)
      .insert({
        user_id: user.id,
        description_produit: descriptionProduit.trim(),
        pays_destination: paysDestination.trim() || null,
        acheteur_destinataire: acheteurDestinataire.trim() || null,
        contact_acheteur: contactAcheteur.trim() || null,
        photos: photoUrls,
        quantite: quantiteNum,
        incoterm: incoterm || null,
        mode_transport: modeTransport,
        transporteur_souhaite: transporteurSouhaite.trim() || null,
        notes_client: notesClient.trim() || null,
        poids_estime_kg: poidsEstime ? parseFloat(poidsEstime) : null,
        volume_estime_m3: volumeEstime ? parseFloat(volumeEstime) : null,
        valeur_marchandise_estimee_fcfa: valeurEstimee ? parseFloat(valeurEstimee) : null,
        estimation_indicative_fcfa: null,
      })
      .select('id, reference_publique')
      .single();

    if (demandeError || !demande) {
      setFormError("Impossible d'enregistrer votre demande. Veuillez réessayer.");
      setSubmitting(false);
      return;
    }

    await supabase.from(HISTORIQUE_EXPORT_TABLE).insert({
      demande_export_id: demande.id,
      statut: 'nouvelle',
      commentaire_admin: null,
    });

    for (const doc of documents) {
      const path = `${user.id}/${crypto.randomUUID()}-${doc.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(EXPORT_DOCUMENTS_BUCKET)
        .upload(path, doc.file);
      if (!uploadError) {
        await supabase.from(DOCUMENTS_EXPORT_TABLE).insert({
          demande_export_id: demande.id,
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
        body: JSON.stringify({ type: 'export', reference_publique: demande.reference_publique }),
      }).catch(() => {});
    }

    setSubmitting(false);
    setReferencePublique(demande.reference_publique);
  };

  if (referencePublique) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeaderImport />
        <main className="entree-page mx-auto max-w-screen-md px-4 py-16 text-center sm:px-6">
          <div className="rounded-lg border bg-card p-8">
            <Ship className="mx-auto h-8 w-8 text-primary" />
            <h1 className="mt-3 text-xl font-bold text-foreground">Demande d'export envoyée !</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Référence : <span className="font-semibold text-foreground">{referencePublique}</span>
            </p>
            <p className="mt-4 text-sm text-foreground">
              Notre équipe transit va chiffrer votre demande (transport local, douane export, fret,
              certifications) et vous transmettre un devis complet. Vous pouvez suivre chaque étape
              depuis « Mes demandes d'export ».
            </p>
            <Button className="mt-6" onClick={() => navigate('/export/mes-demandes')}>
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
      {/* Une bande d'ouverture, pas un grand format : cette page est un
          formulaire, la photographie situe le service sans repousser le premier
          champ sous la ligne de flottaison. */}
      <section className="relative flex h-36 items-end overflow-hidden bg-foreground sm:h-44">
        <ImageOuverture
          src="/visuels/port-export-abidjan.jpg"
          alt=""
          largeur={1168}
          hauteur={784}
          className="absolute inset-0 h-full w-full object-cover object-center opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/70 to-foreground/20" />
        <div className="relative mx-auto w-full max-w-screen-md px-4 pb-4 sm:px-6">
          <p className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-primary">
            MayLary Group Export — Abidjan
          </p>
        </div>
      </section>
      <main className="entree-page mx-auto max-w-screen-md px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Faire une demande d'export</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Décrivez ce que vous voulez exporter — nous nous occupons de la collecte, de la douane,
          du fret international et de la livraison à l'acheteur.
        </p>

        <div className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="description-produit">Marchandise à exporter *</Label>
            <Textarea
              id="description-produit"
              value={descriptionProduit}
              onChange={(e) => setDescriptionProduit(e.target.value)}
              rows={3}
              placeholder="ex: 5 tonnes de cacao en fèves, qualité export..."
            />
          </div>

          <div className="cascade grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pays-destination">Pays de destination</Label>
              <Input
                id="pays-destination"
                value={paysDestination}
                onChange={(e) => setPaysDestination(e.target.value)}
                placeholder="ex: France, Pays-Bas, USA..."
              />
            </div>
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
          </div>

          <div className="cascade grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acheteur">Acheteur / société destinataire (optionnel)</Label>
              <Input
                id="acheteur"
                value={acheteurDestinataire}
                onChange={(e) => setAcheteurDestinataire(e.target.value)}
                placeholder="ex: déjà un acheteur ? indiquez son nom"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-acheteur">Contact acheteur (optionnel)</Label>
              <Input
                id="contact-acheteur"
                value={contactAcheteur}
                onChange={(e) => setContactAcheteur(e.target.value)}
                placeholder="email ou téléphone"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Photos de la marchandise (optionnel, 4 max)</Label>
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
              Un acheteur a déjà passé commande et vous cherchez uniquement un transitaire pour le
              transport et la douane export ? Scannez ou importez votre facture commerciale ici — notre
              équipe s'appuiera dessus pour chiffrer directement le transport, la douane et le fret.
            </p>
            <div className="space-y-2">
              {documents.map((doc, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border bg-card p-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground">{doc.file.name}</span>
                  <select
                    className="h-8 shrink-0 rounded-md border border-input bg-transparent px-2 text-xs outline-none"
                    value={doc.type}
                    onChange={(e) => updateDocumentType(i, e.target.value as TypeDocumentExport)}
                  >
                    {(Object.keys(TYPE_DOCUMENT_EXPORT_LABELS) as TypeDocumentExport[])
                      .filter((t) => t !== 'photo_produit')
                      .map((t) => (
                        <option key={t} value={t}>
                          {TYPE_DOCUMENT_EXPORT_LABELS[t]}
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

          <div className="cascade grid grid-cols-2 gap-3">
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

          <div className="cascade grid grid-cols-3 gap-3">
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

          {/* On ne demande pas au client sous combien de temps il veut sa
              marchandise : le délai ne dépend pas de nous. Il dépend de la
              ligne, du départ réservé, du dédouanement et du transit local.
              Poser la question, c'est laisser croire qu'on la maîtrise — et
              c'est prendre un engagement qu'on ne tiendra pas.

              Ce qui dépend de nous, c'est de l'annoncer avec le devis, une
              fois la compagnie confirmée. */}
          <div className="rounded-md border border-dashed p-4">
            <p className="text-sm font-medium text-foreground">Et le délai ?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Il vous sera annoncé avec le devis, une fois le départ confirmé par la compagnie.
              Nous ne l'inventons pas : il dépend de la ligne, de la date de départ réservée, du
              dédouanement export et de l’acheminement. Si vous avez une contrainte de date, dites-le en
              note ci-dessous — nous vous dirons franchement si elle est tenable.
            </p>
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

          {marchandiseRenseignee && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-start gap-3 pt-6">
                <Calculator className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Droits et taxes à l'exportation :{' '}
                    {DROITS_EXPORT_FCFA.toLocaleString('fr-FR')} FCFA
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ce chiffre n'est pas une estimation. À l'exportation, seul le timbre
                    statistique est dû, une fois par déclaration et quelle que soit la valeur de la
                    marchandise — ni droits de douane, ni TVA, ni prélèvements communautaires.
                    Restent à chiffrer le transport et les frais de transit, que nous couvrons dans
                    votre devis. Certaines marchandises supportent en plus un Droit Unique de
                    Sortie ; nous vous le signalons le cas échéant.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Envoyer ma demande d'export
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
