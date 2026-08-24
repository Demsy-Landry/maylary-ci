import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import FretApresVerification from '@/components/FretApresVerification';
import AvisProduit from '@/components/AvisProduit';
import {
  supabase,
  CATEGORIES_GP_TABLE,
  PRODUITS_PUBLIC_VIEW,
  PRODUITS_FAVORIS_TABLE,
  ORIGINE_PRODUIT_DESCRIPTIONS,
  type CategorieGP,
  type Produit,
} from '@/lib/supabase';
import { GrilleDeGros } from '@/components/GrilleDeGros';
import { usePaliers } from '@/hooks/usePaliers';
import { prixPourQuantite } from '@/lib/cout-import';
import OrigineProduitBadge from '@/components/OrigineProduitBadge';
import { useAuth } from '@/hooks/useAuth';
import { useCartGP } from '@/hooks/useCartGP';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ChevronLeft, ImageOff, Heart, ShoppingCart, Minus, Plus } from 'lucide-react';

const STOCK_LABELS: Record<string, string> = {
  en_stock: 'En stock',
  sur_commande: 'Sur commande',
  rupture: 'Rupture de stock',
};

export default function ProduitDetailGP() {
  const { produitId } = useParams<{ produitId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCartGP();

  const [produit, setProduit] = useState<Produit | null>(null);
  const [categorie, setCategorie] = useState<CategorieGP | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const [brokenPhotos, setBrokenPhotos] = useState<Set<string>>(new Set());
  const [quantite, setQuantite] = useState(1);
  const grilles = usePaliers(produitId ? [produitId] : []);
  const paliers = (produitId && grilles[produitId]) || [];
  const [isFavori, setIsFavori] = useState(false);
  const [favoriBusy, setFavoriBusy] = useState(false);

  useEffect(() => {
    if (!produitId) return;
    const load = async () => {
      setLoading(true);
      const { data: produitData } = await supabase
        .from(PRODUITS_PUBLIC_VIEW)
        .select('*')
        .eq('id', produitId)
        .maybeSingle();
      if (produitData) {
        setProduit(produitData as Produit);
        // La quantité de départ ne peut pas être inférieure au minimum de vente.
        setQuantite(Math.max(1, (produitData as Produit).quantite_minimum ?? 1));
        const catId = (produitData as Produit).categorie_gp_id;
        if (catId) {
          const { data: categorieData } = await supabase
            .from(CATEGORIES_GP_TABLE)
            .select('*')
            .eq('id', catId)
            .maybeSingle();
          setCategorie((categorieData as CategorieGP) ?? null);
        }
      }
      if (user) {
        const { data: favoriData } = await supabase
          .from(PRODUITS_FAVORIS_TABLE)
          .select('id')
          .eq('user_id', user.id)
          .eq('produit_id', produitId)
          .maybeSingle();
        setIsFavori(!!favoriData);
      }
      setLoading(false);
    };
    load();
  }, [produitId, user]);

  const handleToggleFavori = async () => {
    if (!user) {
      toast.info('Connectez-vous pour ajouter ce produit à vos favoris.');
      navigate('/boutique/compte');
      return;
    }
    if (!produit) return;
    setFavoriBusy(true);
    if (isFavori) {
      await supabase
        .from(PRODUITS_FAVORIS_TABLE)
        .delete()
        .eq('user_id', user.id)
        .eq('produit_id', produit.id);
      setIsFavori(false);
      toast.success('Retiré des favoris.');
    } else {
      await supabase.from(PRODUITS_FAVORIS_TABLE).insert({ user_id: user.id, produit_id: produit.id });
      setIsFavori(true);
      toast.success('Ajouté aux favoris.');
    }
    setFavoriBusy(false);
  };

  const handleAddToCart = () => {
    if (!produit) return;
    addItem(
      {
        produit_id: produit.id,
        nom: produit.nom,
        prix_unitaire_fcfa: produit.prix_unitaire_fcfa,
        photo: produit.photos?.[0] ?? null,
        quantite_minimum: produit.quantite_minimum ?? 1,
        paliers,
        mode_acheminement: produit.mode_acheminement,
      },
      quantite,
    );
    toast.success('Ajouté à votre panier.');
  };

  const handleBuyNow = () => {
    handleAddToCart();
    navigate('/boutique/panier');
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <main className="entree-page mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
        <Link
          to="/boutique"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Retour à la boutique
        </Link>

        {loading ? (
          <div className="cascade grid gap-6 sm:grid-cols-2">
            <Skeleton className="h-80 w-full" />
            <div className="space-y-3">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ) : !produit ? (
          <p className="text-sm text-muted-foreground">Produit introuvable.</p>
        ) : (
          <div className="cascade grid gap-8 sm:grid-cols-2">
            {/* `min-w-0` sur les deux colonnes : un élément de grille a
                `min-width: auto`, donc la colonne se dimensionne sur le mot le
                plus long de la fiche. Une référence sans espace — et les noms
                venus du fournisseur en contiennent — faisait défiler la page
                entière horizontalement. */}
            <div className="min-w-0">
              {produit.photos?.length > 0 && !brokenPhotos.has(produit.photos[activePhoto]) ? (
                <>
                  <img
                    src={produit.photos[activePhoto]}
                    alt={produit.nom}
                    onError={() =>
                      setBrokenPhotos((prev) => new Set(prev).add(produit.photos[activePhoto]))
                    }
                    className="aspect-square w-full rounded-lg border bg-white object-contain p-3"
                  />
                  {produit.photos.length > 1 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {produit.photos.map((url, idx) => (
                        <button
                          key={url}
                          onClick={() => setActivePhoto(idx)}
                          className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-white ${
                            idx === activePhoto ? 'border-primary ring-1 ring-primary' : ''
                          }`}
                        >
                          <img src={url} alt="" className="h-full w-full object-contain p-1" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-lg border bg-muted">
                  <ImageOff className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              {categorie && (
                <Link
                  to={`/boutique/categorie/${categorie.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  {categorie.nom}
                </Link>
              )}
              <h1 className="mt-1 break-words text-2xl font-bold text-foreground">{produit.nom}</h1>
              <p className="mt-2 text-2xl font-semibold text-primary">
                {prixPourQuantite(paliers, produit.prix_unitaire_fcfa, quantite).toLocaleString(
                  'fr-FR',
                )}{' '}
                FCFA
                <span className="ml-1 text-sm font-normal text-muted-foreground">/ pièce</span>
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={produit.stock_disponible === 'rupture' ? 'destructive' : 'secondary'}>
                  {STOCK_LABELS[produit.stock_disponible]}
                </Badge>
                {produit.categorie && <Badge variant="outline">{produit.categorie}</Badge>}
                {produit.origine && <OrigineProduitBadge origine={produit.origine} />}
              </div>

              {produit.origine && (
                <p className="mt-3 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                  {ORIGINE_PRODUIT_DESCRIPTIONS[produit.origine]}
                </p>
              )}

              {produit.delai_livraison_estime && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Délai de livraison estimé : {produit.delai_livraison_estime}
                </p>
              )}

              {produit.description && (
                <p className="mt-4 whitespace-pre-line break-words text-sm text-foreground">
                  {produit.description}
                </p>
              )}

              {/* Même règle qu'ailleurs : on ne montre pas un chiffre qu'on ne
                  peut pas tenir. Le fret de groupage se dit, il ne s'estime pas. */}
              {produit.mode_acheminement === 'groupage' && <FretApresVerification />}

              {/* La fiche technique relevée chez le fournisseur. Elle est
                  courte et factuelle — matière, emballage, poids — donc elle
                  passe en pastilles plutôt qu'en paragraphe : c'est ce qu'un
                  acheteur cherche du regard avant de lire quoi que ce soit. */}
              {(produit.matiere || produit.emballage || produit.poids_produit_g) && (
                <dl className="mt-4 flex flex-wrap gap-2">
                  {produit.matiere && (
                    <div className="rounded-md border bg-muted/40 px-2.5 py-1.5">
                      <dt className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                        Matière
                      </dt>
                      <dd className="text-sm text-foreground">{produit.matiere}</dd>
                    </div>
                  )}
                  {produit.emballage && (
                    <div className="rounded-md border bg-muted/40 px-2.5 py-1.5">
                      <dt className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                        Emballage
                      </dt>
                      <dd className="text-sm text-foreground">{produit.emballage}</dd>
                    </div>
                  )}
                  {produit.poids_produit_g ? (
                    <div className="rounded-md border bg-muted/40 px-2.5 py-1.5">
                      <dt className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                        Poids
                      </dt>
                      <dd className="text-sm tabular-nums text-foreground">
                        {produit.poids_produit_g >= 1000
                          ? `${(produit.poids_produit_g / 1000).toFixed(2)} kg`
                          : `${Math.round(produit.poids_produit_g)} g`}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              )}

              {/* Le texte du fournisseur, en anglais tant que personne ne l'a
                  réécrit. Il est présenté comme tel : le donner pour une
                  description maison serait mentir sur son origine. */}
              {produit.description_fournisseur && (
                <details className="mt-4 rounded-md border bg-card p-3">
                  <summary className="cursor-pointer text-sm font-medium text-foreground">
                    Détail technique du fabricant
                  </summary>
                  <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
                    {produit.description_fournisseur}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Texte fourni par le fabricant, non traduit.
                  </p>
                </details>
              )}

              {produit.quantite_minimum > 1 && (
                <p className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
                  Vendu par lot de <strong>{produit.quantite_minimum}</strong> minimum. Grouper les
                  pièces dans un même envoi divise les frais de transport et d'assurance : c'est ce
                  qui rend ce prix unitaire possible.
                </p>
              )}

              {paliers.length > 1 && (
                <div className="mt-4">
                  <GrilleDeGros paliers={paliers} quantiteChoisie={quantite} />
                </div>
              )}

              <div className="mt-6 flex items-center gap-3">
                <div className="flex items-center rounded-md border">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={quantite <= produit.quantite_minimum}
                    onClick={() => setQuantite((q) => Math.max(produit.quantite_minimum, q - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center text-sm font-medium">{quantite}</span>
                  <Button variant="ghost" size="icon" onClick={() => setQuantite((q) => q + 1)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="outline" size="icon" onClick={handleToggleFavori} disabled={favoriBusy}>
                  <Heart className={`h-4 w-4 ${isFavori ? 'fill-primary text-primary' : ''}`} />
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={handleAddToCart}
                  disabled={produit.stock_disponible === 'rupture'}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Ajouter au panier
                </Button>
                <Button onClick={handleBuyNow} disabled={produit.stock_disponible === 'rupture'}>
                  Acheter maintenant
                </Button>
              </div>

              <AvisProduit produitId={produit.id} />
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
