import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import ImageOuverture from '@/components/ImageOuverture';
import { useAuth } from '@/hooks/useAuth';
import {
  supabase,
  VENDEURS_TABLE,
  REVERSEMENTS_TABLE,
  PARAMETRES_MARKETPLACE_TABLE,
  PRODUITS_TABLE,
  LIGNES_COMMANDE_GP_TABLE,
  CATEGORIES_GP_TABLE,
  PRODUIT_PHOTOS_BUCKET,
  SECTEURS_TABLE,
  STATUT_VENDEUR_LABELS,
  STATUT_VENDEUR_MESSAGES,
  STATUT_REVERSEMENT_LABELS,
  MODE_REVERSEMENT_LABELS,
  type CategorieGP,
  type ModeReversement,
  type ParametresMarketplace,
  type Reversement,
  type Secteur,
  type StatutVendeur,
  type Vendeur,
  type VenteVendeur,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Store, Plus, Trash2, Eye, EyeOff, Wallet, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import GarantiePayeProtege from '@/components/GarantiePayeProtege';

/** Même habillage que le champ texte : le projet n'embarque pas de select. */
const selectClassName =
  'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm';

const BADGE_VARIANT: Record<StatutVendeur, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  en_attente: 'secondary',
  valide: 'default',
  suspendu: 'destructive',
  refuse: 'destructive',
};

interface ArticleVendeur {
  id: string;
  nom: string;
  description: string | null;
  prix_unitaire_fcfa: number;
  categorie_gp_id: string | null;
  stock_disponible: string;
  actif: boolean;
}

export default function EspaceVendeur() {
  const { user, loading: authLoading, profilEnCours } = useAuth();
  const navigate = useNavigate();

  const [vendeur, setVendeur] = useState<Vendeur | null>(null);
  const [parametres, setParametres] = useState<ParametresMarketplace | null>(null);
  const [secteurs, setSecteurs] = useState<Secteur[]>([]);
  const [categories, setCategories] = useState<CategorieGP[]>([]);
  const [articles, setArticles] = useState<ArticleVendeur[]>([]);
  const [ventes, setVentes] = useState<VenteVendeur[]>([]);
  const [reversements, setReversements] = useState<Reversement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Formulaire d'inscription / de fiche
  const [nomEntreprise, setNomEntreprise] = useState('');
  const [telephone, setTelephone] = useState('');
  const [ville, setVille] = useState('');
  const [adresse, setAdresse] = useState('');
  const [description, setDescription] = useState('');
  const [secteurId, setSecteurId] = useState<string>('');
  const [registre, setRegistre] = useState('');
  const [contribuable, setContribuable] = useState('');
  const [modeReversement, setModeReversement] = useState<ModeReversement>('mobile_money');
  const [compte, setCompte] = useState('');
  const [titulaire, setTitulaire] = useState('');

  // Formulaire d'article
  const [artNom, setArtNom] = useState('');
  const [artPrix, setArtPrix] = useState('');
  const [artCategorie, setArtCategorie] = useState<string>('');
  const [artDescription, setArtDescription] = useState('');
  /** Photos choisies pour l'article en cours de publication. */
  const [artPhotos, setArtPhotos] = useState<File[]>([]);

  const remplirDepuis = (v: Vendeur) => {
    setNomEntreprise(v.nom_entreprise);
    setTelephone(v.telephone);
    setVille(v.ville ?? '');
    setAdresse(v.adresse ?? '');
    setDescription(v.description ?? '');
    setSecteurId(v.secteur_id ?? '');
    setRegistre(v.registre_commerce ?? '');
    setContribuable(v.numero_contribuable ?? '');
    setModeReversement(v.mode_reversement);
    setCompte(v.compte_reversement ?? '');
    setTitulaire(v.titulaire_compte ?? '');
  };

  const charger = async () => {
    if (!user) return;
    setLoading(true);
    const [vRes, pRes, sRes, cRes] = await Promise.all([
      supabase.from(VENDEURS_TABLE).select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from(PARAMETRES_MARKETPLACE_TABLE).select('*').eq('id', 1).maybeSingle(),
      supabase.from(SECTEURS_TABLE).select('*').eq('actif', true).order('ordre_affichage'),
      supabase.from(CATEGORIES_GP_TABLE).select('*').eq('actif', true).order('ordre_affichage'),
    ]);

    const v = vRes.data as Vendeur | null;
    setVendeur(v);
    setParametres(pRes.data as ParametresMarketplace | null);
    setSecteurs((sRes.data as Secteur[]) ?? []);
    setCategories((cRes.data as CategorieGP[]) ?? []);
    if (v) remplirDepuis(v);

    if (v) {
      const [aRes, veRes, rRes] = await Promise.all([
        supabase
          .from(PRODUITS_TABLE)
          .select('id, nom, description, prix_unitaire_fcfa, categorie_gp_id, stock_disponible, actif')
          .eq('vendeur_id', v.id)
          .order('created_at', { ascending: false }),
        supabase
          .from(LIGNES_COMMANDE_GP_TABLE)
          .select('id, commande_id, nom_produit, quantite, sous_total, commission_fcfa, net_vendeur_fcfa, taux_commission_applique')
          .eq('vendeur_id', v.id),
        supabase
          .from(REVERSEMENTS_TABLE)
          .select('*')
          .eq('vendeur_id', v.id)
          .order('created_at', { ascending: false }),
      ]);
      setArticles((aRes.data as ArticleVendeur[]) ?? []);
      setVentes((veRes.data as VenteVendeur[]) ?? []);
      setReversements((rRes.data as Reversement[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /**
   * Ce que MayLary Group doit au vendeur : le net de ses ventes, moins ce qui lui a
   * déjà été versé. Calculé à l'affichage plutôt que stocké, pour qu'un chiffre
   * périmé ne puisse pas s'installer.
   */
  const solde = useMemo(() => {
    const gagne = ventes.reduce((s, v) => s + Number(v.net_vendeur_fcfa ?? 0), 0);
    const verse = reversements
      .filter((r) => r.statut === 'paye')
      .reduce((s, r) => s + Number(r.montant_fcfa), 0);
    return { gagne, verse, du: gagne - verse };
  }, [ventes, reversements]);

  const tauxAffiche =
    vendeur?.taux_commission != null
      ? vendeur.taux_commission
      : (parametres?.taux_commission_defaut ?? 0);

  const enregistrerFiche = async () => {
    if (!user) return;
    if (nomEntreprise.trim().length < 2 || telephone.trim().length < 8) {
      toast.error("Le nom de l'entreprise et un téléphone joignable sont requis.");
      return;
    }
    setBusy(true);
    const champs = {
      nom_entreprise: nomEntreprise.trim(),
      telephone: telephone.trim(),
      ville: ville.trim() || null,
      adresse: adresse.trim() || null,
      description: description.trim() || null,
      secteur_id: secteurId || null,
      registre_commerce: registre.trim() || null,
      numero_contribuable: contribuable.trim() || null,
      mode_reversement: modeReversement,
      compte_reversement: compte.trim() || null,
      titulaire_compte: titulaire.trim() || null,
    };

    const { error } = vendeur
      ? await supabase.from(VENDEURS_TABLE).update(champs).eq('id', vendeur.id)
      : await supabase.from(VENDEURS_TABLE).insert({ ...champs, user_id: user.id });

    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(vendeur ? 'Fiche mise à jour.' : 'Dossier déposé. Nous revenons vers vous rapidement.');
    charger();
  };

  const publierArticle = async () => {
    if (!vendeur) return;
    const prix = Number(artPrix);
    if (artNom.trim().length < 2 || !Number.isFinite(prix) || prix <= 0 || !artCategorie) {
      toast.error('Nom, prix et catégorie sont requis.');
      return;
    }
    if (artPhotos.length === 0) {
      toast.error('Ajoutez au moins une photo : un article sans image ne se vend pas.');
      return;
    }
    setBusy(true);

    // Le dépôt est public en lecture : on garde l'adresse définitive, pas un
    // lien signé qui expirerait au milieu d'une fiche produit.
    const adresses: string[] = [];
    for (const fichier of artPhotos) {
      const chemin = `vendeurs/${vendeur.id}/${crypto.randomUUID()}-${fichier.name}`;
      const { error: envoiError } = await supabase.storage
        .from(PRODUIT_PHOTOS_BUCKET)
        .upload(chemin, fichier);
      if (envoiError) {
        setBusy(false);
        toast.error("L'envoi de la photo a échoué. Réessayez.");
        return;
      }
      const { data } = supabase.storage.from(PRODUIT_PHOTOS_BUCKET).getPublicUrl(chemin);
      adresses.push(data.publicUrl);
    }

    const { error } = await supabase.from(PRODUITS_TABLE).insert({
      nom: artNom.trim(),
      description: artDescription.trim() || null,
      prix_unitaire_fcfa: Math.round(prix),
      categorie_gp_id: artCategorie,
      espace: 'grand_public',
      vendeur_id: vendeur.id,
      photos: adresses,
      actif: true,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Article publié.');
    setArtNom('');
    setArtPrix('');
    setArtDescription('');
    setArtPhotos([]);
    charger();
  };

  const basculerArticle = async (a: ArticleVendeur) => {
    const { error } = await supabase
      .from(PRODUITS_TABLE)
      .update({ actif: !a.actif })
      .eq('id', a.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    charger();
  };

  const supprimerArticle = async (a: ArticleVendeur) => {
    const { error } = await supabase.from(PRODUITS_TABLE).delete().eq('id', a.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Article retiré.');
    charger();
  };

  if (authLoading || (user && profilEnCours)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeaderGP />
        {/* C'est ici qu'arrive un vendeur qui ne nous connaît pas encore : la
            seule page de la marketplace qui ait quelque chose à vendre plutôt
            qu'à afficher. Le bureau donnant sur le port dit le sérieux de la
            maison mieux qu'un pictogramme seul. */}
        <section className="relative flex h-36 items-end overflow-hidden bg-foreground sm:h-44">
          <ImageOuverture
            src="/visuels/bureau-espace-pro.jpg"
            alt=""
            largeur={784}
            hauteur={580}
            className="absolute inset-0 h-full w-full object-cover object-center opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/70 to-foreground/20" />
          <div className="relative mx-auto w-full max-w-screen-md px-4 pb-4 sm:px-6">
            <p className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-primary">
              MayLary Group — Espace vendeur
            </p>
          </div>
        </section>
        <main className="entree-page mx-auto max-w-screen-md px-4 py-16 text-center sm:px-6">
          <Store className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-2xl font-bold text-foreground">Vendez sur MayLary Group</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Inscription gratuite, publication gratuite. MayLary Group ne se rémunère que sur les ventes
            réellement conclues.
          </p>
          <Button className="mt-6" onClick={() => navigate('/boutique/compte')}>
            Créer mon compte
          </Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const peutPublier = vendeur?.statut === 'valide';

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <main className="entree-page mx-auto max-w-screen-lg px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">
              {vendeur ? vendeur.nom_entreprise : 'Vendre sur MayLary Group'}
            </h1>
          </div>
          {vendeur && (
            <Badge variant={BADGE_VARIANT[vendeur.statut]}>
              {STATUT_VENDEUR_LABELS[vendeur.statut]}
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="cascade mt-6 space-y-6">
            {/* Ce qui rassure un vendeur n'est pas ce qui rassure un acheteur :
                lui, ce qu'il veut savoir, c'est quand il est payé. */}
            <GarantiePayeProtege variante="vendeur" />

            {/* Ce que coûte le service, dit avant qu'on le demande. */}
            <section className="carte-reactive rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <BadgeCheck className="h-4 w-4 text-primary" />
                Nos conditions, sans petites lignes
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>· Inscription et publication : <strong className="text-foreground">gratuites</strong></li>
                <li>
                  · Commission de service :{' '}
                  <strong className="text-foreground">
                    {(tauxAffiche * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %
                  </strong>{' '}
                  du montant de chaque vente, prélevée uniquement quand vous vendez
                  {vendeur?.taux_commission != null && ' (taux négocié pour votre entreprise)'}
                </li>
                <li>
                  · Reversement sous{' '}
                  <strong className="text-foreground">
                    {parametres?.delai_reversement_jours ?? 7} jours
                  </strong>{' '}
                  après livraison
                </li>
              </ul>
            </section>

            {vendeur && (
              <section className="rounded-md border p-4 text-sm">
                <p className="font-medium text-foreground">
                  {STATUT_VENDEUR_LABELS[vendeur.statut]}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {STATUT_VENDEUR_MESSAGES[vendeur.statut]}
                </p>
                {vendeur.motif_statut && (
                  <p className="mt-2 rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                    {vendeur.motif_statut}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Référence vendeur : {vendeur.reference_publique}
                </p>
              </section>
            )}

            {/* ---- Fiche entreprise ---- */}
            <section className="carte-reactive rounded-lg border bg-card p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-foreground">
                {vendeur ? 'Ma fiche entreprise' : 'Inscrire mon entreprise'}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nom">Nom de l'entreprise</Label>
                  <Input id="nom" value={nomEntreprise} onChange={(e) => setNomEntreprise(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tel">Téléphone</Label>
                  <Input id="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+225…" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ville">Ville</Label>
                  <Input id="ville" value={ville} onChange={(e) => setVille(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="secteur">Secteur d'activité</Label>
                  <select
                    id="secteur"
                    className={selectClassName}
                    value={secteurId}
                    onChange={(e) => setSecteurId(e.target.value)}
                  >
                    <option value="">Choisir</option>
                    {secteurs.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="adr">Adresse</Label>
                  <Input id="adr" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="desc">Présentation de votre activité</Label>
                  <Textarea id="desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rc">Registre de commerce</Label>
                  <Input id="rc" value={registre} onChange={(e) => setRegistre(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cc">Numéro de contribuable</Label>
                  <Input id="cc" value={contribuable} onChange={(e) => setContribuable(e.target.value)} />
                </div>
              </div>

              <div className="mt-4 rounded-md border bg-muted/30 p-3">
                <p className="text-sm font-medium text-foreground">Où vous verser vos ventes</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="mode">Mode</Label>
                    <select
                      id="mode"
                      className={selectClassName}
                      value={modeReversement}
                      onChange={(e) => setModeReversement(e.target.value as ModeReversement)}
                    >
                      {(Object.keys(MODE_REVERSEMENT_LABELS) as ModeReversement[]).map((m) => (
                        <option key={m} value={m}>
                          {MODE_REVERSEMENT_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="compte">
                      {modeReversement === 'mobile_money' ? 'Numéro Mobile Money' : 'IBAN / RIB'}
                    </Label>
                    <Input id="compte" value={compte} onChange={(e) => setCompte(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tit">Titulaire du compte</Label>
                    <Input id="tit" value={titulaire} onChange={(e) => setTitulaire(e.target.value)} />
                  </div>
                </div>
              </div>

              <Button className="mt-4" onClick={enregistrerFiche} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {vendeur ? 'Enregistrer' : 'Déposer mon dossier'}
              </Button>
            </section>

            {/* ---- Catalogue ---- */}
            {vendeur && (
              <section className="carte-reactive rounded-lg border bg-card p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-foreground">Mon catalogue</h2>
                {!peutPublier ? (
                  <p className="mt-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    La publication s'ouvre dès que votre dossier est validé.
                  </p>
                ) : (
                  <>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="an">Nom de l'article</Label>
                        <Input id="an" value={artNom} onChange={(e) => setArtNom(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ap">Prix de vente (FCFA)</Label>
                        <Input
                          id="ap"
                          type="number"
                          value={artPrix}
                          onChange={(e) => setArtPrix(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ac">Catégorie</Label>
                        <select
                          id="ac"
                          className={selectClassName}
                          value={artCategorie}
                          onChange={(e) => setArtCategorie(e.target.value)}
                        >
                          <option value="">Choisir</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nom}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5 sm:col-span-4">
                        <Label htmlFor="aphotos">Photos de l'article *</Label>
                        <Input
                          id="aphotos"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => setArtPhotos(Array.from(e.target.files ?? []))}
                        />
                        <p className="text-xs text-muted-foreground">
                          {artPhotos.length > 0
                            ? `${artPhotos.length} photo(s) prête(s) à être publiée(s).`
                            : 'La première photo sert de vignette dans la boutique.'}
                        </p>
                      </div>
                      <div className="space-y-1.5 sm:col-span-4">
                        <Label htmlFor="ad">Description</Label>
                        <Textarea
                          id="ad"
                          rows={2}
                          value={artDescription}
                          onChange={(e) => setArtDescription(e.target.value)}
                        />
                      </div>
                    </div>
                    {artPrix && Number(artPrix) > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Sur une vente à {Number(artPrix).toLocaleString('fr-FR')} FCFA, vous percevez{' '}
                        <strong className="text-foreground">
                          {Math.round(Number(artPrix) * (1 - tauxAffiche)).toLocaleString('fr-FR')} FCFA
                        </strong>{' '}
                        après commission de service.
                      </p>
                    )}
                    <Button className="mt-3" onClick={publierArticle} disabled={busy}>
                      {busy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Publier l'article
                    </Button>
                  </>
                )}

                {articles.length > 0 && (
                  <div className="mt-5 divide-y rounded-md border">
                    {articles.map((a) => (
                      <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{a.nom}</p>
                          <p className="text-xs text-muted-foreground">
                            {Number(a.prix_unitaire_fcfa).toLocaleString('fr-FR')} FCFA
                            {!a.actif && ' · retiré de la vitrine'}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button variant="outline" size="sm" onClick={() => basculerArticle(a)}>
                            {a.actif ? (
                              <EyeOff className="mr-1.5 h-4 w-4" />
                            ) : (
                              <Eye className="mr-1.5 h-4 w-4" />
                            )}
                            {a.actif ? 'Masquer' : 'Afficher'}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => supprimerArticle(a)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ---- Ventes et argent ---- */}
            {vendeur && (
              <section className="carte-reactive rounded-lg border bg-card p-4 sm:p-5">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Wallet className="h-5 w-5 text-primary" />
                  Mes ventes
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Ventes encaissées</p>
                    <p className="text-lg font-semibold text-foreground">
                      {solde.gagne.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Déjà versé</p>
                    <p className="text-lg font-semibold text-foreground">
                      {solde.verse.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                    <p className="text-xs text-muted-foreground">Reste à vous verser</p>
                    <p className="text-lg font-semibold text-foreground">
                      {solde.du.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                </div>

                {ventes.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Aucune vente pour le moment.
                  </p>
                ) : (
                  <div className="mt-4 divide-y rounded-md border">
                    {ventes.map((v) => (
                      <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                        <span className="min-w-0">
                          {v.nom_produit} × {v.quantite}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          vente {Number(v.sous_total).toLocaleString('fr-FR')} · service{' '}
                          {Number(v.commission_fcfa ?? 0).toLocaleString('fr-FR')} ·{' '}
                          <strong className="text-foreground">
                            net {Number(v.net_vendeur_fcfa ?? 0).toLocaleString('fr-FR')} FCFA
                          </strong>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {reversements.length > 0 && (
                  <div className="mt-5">
                    <p className="text-sm font-medium text-foreground">Versements</p>
                    <div className="mt-2 divide-y rounded-md border">
                      {reversements.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-2 p-2 text-sm">
                          <span>
                            {Number(r.montant_fcfa).toLocaleString('fr-FR')} FCFA
                            <span className="ml-2 text-xs text-muted-foreground">
                              {new Date(r.created_at).toLocaleDateString('fr-FR')}
                            </span>
                          </span>
                          <Badge variant={r.statut === 'paye' ? 'default' : 'secondary'}>
                            {STATUT_REVERSEMENT_LABELS[r.statut]}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Une question sur la marketplace ?{' '}
              <Link to="/a-propos" className="underline">
                Nous contacter
              </Link>
            </p>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
