import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import PublicHeaderImport from '@/components/PublicHeaderImport';
import SiteFooter from '@/components/SiteFooter';
import { useAuth } from '@/hooks/useAuth';
import {
  supabase,
  PROFILES_TABLE,
  DEMANDES_IMPORT_TABLE,
  DEMANDES_EXPORT_TABLE,
  DEMANDES_DEVIS_TABLE,
  COMMANDES_GP_TABLE,
  DOCUMENTS_IMPORT_TABLE,
  DOCUMENTS_EXPORT_TABLE,
  STATUT_IMPORT_LABELS,
  STATUT_EXPORT_LABELS,
  STATUT_LABELS,
  STATUT_COMMANDE_GP_LABELS,
  TYPE_DOCUMENT_LABELS,
  TYPE_DOCUMENT_EXPORT_LABELS,
  FACTURES_TABLE,
  SOURCE_FACTURE_LABELS,
  type DemandeImport,
  type DemandeExport,
  type DemandeDevis,
  type CommandeGP,
  type DocumentImport,
  type DocumentExport,
  type Facture,
  IMPORT_DOCUMENTS_BUCKET,
  EXPORT_DOCUMENTS_BUCKET,
} from '@/lib/supabase';
import { GaleriePhotosPrivees, LienDocumentPrive } from '@/components/FichiersPrives';
import MesDonneesPersonnelles from '@/components/MesDonneesPersonnelles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, User, FileText, ExternalLink, History, ArrowRight, Inbox, Receipt, Download } from 'lucide-react';

interface HistoriqueLigne {
  module: string;
  reference: string;
  statutLabel: string;
  date: string;
  detailHref: string;
}

interface DocumentLigne {
  module: string;
  reference: string;
  typeLabel: string;
  nomFichier: string;
  url: string;
  date: string;
}

export default function MonCompte() {
  const { user, profile, loading: authLoading, profilEnCours, isAdmin, refreshProfile } = useAuth();

  const [nomComplet, setNomComplet] = useState('');
  const [telephone, setTelephone] = useState('');
  const [ville, setVille] = useState('');
  const [nomEntreprise, setNomEntreprise] = useState('');
  const [adresseLivraisonDefaut, setAdresseLivraisonDefaut] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [historique, setHistorique] = useState<HistoriqueLigne[]>([]);
  const [documents, setDocuments] = useState<DocumentLigne[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  /** La librairie PDF n'est téléchargée qu'au premier clic sur « Télécharger ». */
  const telechargerFacture = async (facture: Facture) => {
    const { telechargerFacturePdf } = await import('@/lib/facture-pdf');
    telechargerFacturePdf(facture);
  };

  useEffect(() => {
    if (profile) {
      setNomComplet(profile.nom_complet ?? '');
      setTelephone(profile.telephone ?? '');
      setVille(profile.ville ?? '');
      setNomEntreprise(profile.nom_entreprise ?? '');
      setAdresseLivraisonDefaut(profile.adresse_livraison_defaut ?? '');
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoadingData(true);
      const [importsRes, exportsRes, devisRes, commandesRes, docsImportRes, docsExportRes, facturesRes] =
        await Promise.all([
          supabase
            .from(DEMANDES_IMPORT_TABLE)
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from(DEMANDES_EXPORT_TABLE)
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from(DEMANDES_DEVIS_TABLE)
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from(COMMANDES_GP_TABLE)
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase.from(DOCUMENTS_IMPORT_TABLE).select('*'),
          supabase.from(DOCUMENTS_EXPORT_TABLE).select('*'),
          supabase
            .from(FACTURES_TABLE)
            .select('*')
            .eq('user_id', user.id)
            .order('date_emission', { ascending: false }),
        ]);

      setFactures((facturesRes.data as Facture[]) ?? []);

      const imports = (importsRes.data as DemandeImport[]) ?? [];
      const exportsList = (exportsRes.data as DemandeExport[]) ?? [];
      const devis = (devisRes.data as DemandeDevis[]) ?? [];
      const commandes = (commandesRes.data as CommandeGP[]) ?? [];

      const lignesHistorique: HistoriqueLigne[] = [
        ...imports.map((d) => ({
          module: 'Import',
          reference: d.reference_publique,
          statutLabel: STATUT_IMPORT_LABELS[d.statut],
          date: d.created_at,
          detailHref: `/import/mes-demandes?ref=${d.reference_publique}`,
        })),
        ...exportsList.map((d) => ({
          module: 'Export',
          reference: d.reference_publique,
          statutLabel: STATUT_EXPORT_LABELS[d.statut],
          date: d.created_at,
          detailHref: `/export/mes-demandes?ref=${d.reference_publique}`,
        })),
        ...devis.map((d) => ({
          module: 'Espace Pro',
          reference: d.reference_publique,
          statutLabel: STATUT_LABELS[d.statut],
          date: d.created_at,
          detailHref: `/catalogue/mes-devis?ref=${d.reference_publique}`,
        })),
        ...commandes.map((c) => ({
          module: 'Boutique',
          reference: c.reference_publique,
          statutLabel: STATUT_COMMANDE_GP_LABELS[c.statut],
          date: c.created_at,
          detailHref: `/boutique/mes-commandes?ref=${c.reference_publique}`,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const importRefById = new Map(imports.map((d) => [d.id, d.reference_publique]));
      const exportRefById = new Map(exportsList.map((d) => [d.id, d.reference_publique]));

      const docsImport = (docsImportRes.data as DocumentImport[]) ?? [];
      const docsExport = (docsExportRes.data as DocumentExport[]) ?? [];

      const lignesDocuments: DocumentLigne[] = [
        ...docsImport
          .filter((doc) => importRefById.has(doc.demande_import_id))
          .map((doc) => ({
            module: 'Import',
            reference: importRefById.get(doc.demande_import_id)!,
            typeLabel: TYPE_DOCUMENT_LABELS[doc.type_document],
            nomFichier: doc.nom_fichier,
            url: doc.url,
            date: doc.created_at,
          })),
        ...docsExport
          .filter((doc) => exportRefById.has(doc.demande_export_id))
          .map((doc) => ({
            module: 'Export',
            reference: exportRefById.get(doc.demande_export_id)!,
            typeLabel: TYPE_DOCUMENT_EXPORT_LABELS[doc.type_document],
            nomFichier: doc.nom_fichier,
            url: doc.url,
            date: doc.created_at,
          })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setHistorique(lignesHistorique);
      setDocuments(lignesDocuments);
      setLoadingData(false);
    };
    load();
  }, [user]);

  const isEntreprise = useMemo(() => profile?.type_compte === 'entreprise_acheteuse', [profile]);

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

  const handleSaveProfile = async () => {
    if (!nomComplet.trim()) {
      toast.error('Le nom complet est obligatoire.');
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from(PROFILES_TABLE)
      .update({
        nom_complet: nomComplet.trim(),
        telephone: telephone.trim() || null,
        ville: ville.trim() || null,
        nom_entreprise: isEntreprise ? nomEntreprise.trim() || null : nomEntreprise.trim() || null,
        adresse_livraison_defaut: adresseLivraisonDefaut.trim() || null,
      })
      .eq('user_id', user.id);

    if (error) {
      toast.error('Impossible d’enregistrer vos informations.');
      setSavingProfile(false);
      return;
    }

    await refreshProfile();
    toast.success('Profil mis à jour.');
    setSavingProfile(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderImport />
      <main className="entree-page mx-auto max-w-screen-lg px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Mon compte</h1>
        <p className="text-sm text-muted-foreground">
          Vos informations, vos documents et l'historique de toutes vos demandes, en un seul endroit.
        </p>

        <div className="mt-8 space-y-10">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>Profil</CardTitle>
              </div>
              <CardDescription>Connecté en tant que {user.email}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="cascade grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nom-complet">Nom complet</Label>
                  <Input id="nom-complet" value={nomComplet} onChange={(e) => setNomComplet(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input id="telephone" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nom-entreprise">Nom de l'entreprise (si applicable)</Label>
                  <Input
                    id="nom-entreprise"
                    value={nomEntreprise}
                    onChange={(e) => setNomEntreprise(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ville">Ville</Label>
                  <Input id="ville" value={ville} onChange={(e) => setVille(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="adresse-livraison">Adresse de livraison par défaut</Label>
                  <Textarea
                    id="adresse-livraison"
                    rows={2}
                    value={adresseLivraisonDefaut}
                    onChange={(e) => setAdresseLivraisonDefaut(e.target.value)}
                    placeholder="ex: Cocody Angré, rue des Jardins, villa 12"
                  />
                </div>
              </div>
              <Button className="mt-4" onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer les modifications
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                <CardTitle>Mes factures</CardTitle>
              </div>
              <CardDescription>
                Toutes les factures et proformas déjà émises à votre nom, téléchargeables en PDF.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : factures.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Aucune facture émise pour le moment. Vos factures apparaîtront ici dès votre première
                  commande confirmée.
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {factures.map((f) => (
                    <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={f.type_document === 'facture' ? 'default' : 'outline'}>
                            {f.type_document === 'facture' ? 'Facture' : 'Proforma'}
                          </Badge>
                          <span className="font-medium text-foreground">{f.numero}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {SOURCE_FACTURE_LABELS[f.source_type]}
                          {f.reference_source ? ` — ${f.reference_source}` : ''} ·{' '}
                          {new Date(f.date_emission).toLocaleDateString('fr-FR')} ·{' '}
                          {Number(f.montant_ttc).toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => telechargerFacture(f)}>
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle>Documents centralisés</CardTitle>
              </div>
              <CardDescription>
                Toutes vos factures, connaissements, déclarations et certificats, tous modules confondus.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : documents.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Aucun document disponible pour le moment.
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {documents.map((doc, i) => (
                    <LienDocumentPrive
                      key={i}
                      bucket={doc.module === 'Import' ? IMPORT_DOCUMENTS_BUCKET : EXPORT_DOCUMENTS_BUCKET}
                      valeur={doc.url}
                      className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-sm hover:bg-muted"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{doc.module}</Badge>
                        <span className="font-medium text-foreground">{doc.typeLabel}</span>
                        <span className="text-muted-foreground">— {doc.reference}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-xs">{new Date(doc.date).toLocaleDateString('fr-FR')}</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </div>
                    </LienDocumentPrive>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <CardTitle>Historique complet</CardTitle>
              </div>
              <CardDescription>Toutes vos demandes, tous modules confondus.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : historique.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center">
                  <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">Aucune demande pour le moment.</p>
                  <Button asChild className="mt-4">
                    <Link to="/import/nouvelle-demande">Faire une demande d'import</Link>
                  </Button>
                </div>
              ) : (
                <div className="divide-y rounded-md border">
                  {historique.map((ligne, i) => (
                    <Link
                      key={i}
                      to={ligne.detailHref}
                      className="group flex flex-wrap items-center justify-between gap-2 p-3 text-sm hover:bg-muted"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{ligne.module}</Badge>
                        <span className="font-medium text-foreground">{ligne.reference}</span>
                        <span className="text-muted-foreground">
                          {new Date(ligne.date).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>{ligne.statutLabel}</Badge>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Les droits sur ses données, en dernier : on ne met pas « fermer
              mon compte » en tête d'un écran qui sert surtout à suivre ses
              commandes. */}
          <MesDonneesPersonnelles email={user.email ?? ''} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
