import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PublicHeaderPro from '@/components/PublicHeaderPro';
import SiteFooter from '@/components/SiteFooter';
import {
  supabase,
  ENSEIGNES_TABLE,
  PRODUITS_PUBLIC_VIEW,
  PALIERS_PRIX_PUBLIC_VIEW,
  PRODUITS_FAVORIS_TABLE,
  ORIGINE_PRODUIT_DESCRIPTIONS,
  type Enseigne,
  type Produit,
} from '@/lib/supabase';
import OrigineProduitBadge from '@/components/OrigineProduitBadge';
import AvisProduit from '@/components/AvisProduit';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ChevronLeft, ImageOff, Heart, ClipboardList, Minus, Plus } from 'lucide-react';

const STOCK_LABELS: Record<string, string> = {
  en_stock: 'En stock',
  sur_commande: 'Sur commande',
  rupture: 'Rupture de stock',
};

export default function ProduitDetailPro() {
  const { produitId } = useParams<{ produitId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();

  const [produit, setProduit] = useState<Produit | null>(null);
  const [enseigne, setEnseigne] = useState<Enseigne | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const [brokenPhotos, setBrokenPhotos] = useState<Set<string>>(new Set());
  const [quantite, setQuantite] = useState(1);
  /**
   * Grille de gros mesurée chez le transporteur. Vide pour un article qui n'en
   * a pas : on n'invente pas une remise qu'on ne sait pas tenir.
   */
  const [paliers, setPaliers] = useState<{ quantite_min: number; prix_unitaire_fcfa: number }[]>([]);
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
        const { data: paliersData } = await supabase
          .from(PALIERS_PRIX_PUBLIC_VIEW)
          .select('quantite_min, prix_unitaire_fcfa')
          .eq('produit_id', produitId)
          .order('quantite_min');
        setPaliers(
          ((paliersData ?? []) as { quantite_min: number; prix_unitaire_fcfa: number }[]).map((p) => ({
            quantite_min: Number(p.quantite_min),
            prix_unitaire_fcfa: Number(p.prix_unitaire_fcfa),
          })),
        );
        const enseigneId = (produitData as Produit).enseigne_id;
        if (enseigneId) {
          const { data: enseigneData } = await supabase
            .from(ENSEIGNES_TABLE)
            .select('*')
            .eq('id', enseigneId)
            .maybeSingle();
          setEnseigne((enseigneData as Enseigne) ?? null);
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

  const handleAddToDevis = () => {
    if (!produit) return;
    addItem(
      {
        produit_id: produit.id,
        nom: produit.nom,
        prix_unitaire_fcfa: produit.prix_unitaire_fcfa,
        photo: produit.photos?.[0] ?? null,
        enseigne_id: produit.enseigne_id ?? '',
        enseigne_nom: enseigne?.nom ?? '',
      },
      quantite,
    );
    toast.success('Ajouté à votre demande de devis.');
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderPro />
      <main className="entree-page mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <Link
          to="/catalogue"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Retour à l'Espace Pro
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
                    className="h-80 w-full rounded-lg border object-cover"
                  />
                  {produit.photos.length > 1 && (
                    <div className="mt-2 flex gap-2">
                      {produit.photos.map((url, idx) => (
                        <button
                          key={url}
                          onClick={() => setActivePhoto(idx)}
                          className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border ${
                            idx === activePhoto ? 'border-primary' : ''
                          }`}
                        >
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-80 w-full items-center justify-center rounded-lg border bg-muted">
                  <ImageOff className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              {enseigne && <p className="truncate text-sm text-primary">{enseigne.nom}</p>}
              <h1 className="mt-1 break-words text-2xl font-bold text-foreground">{produit.nom}</h1>
              <p className="mt-2 text-2xl font-semibold text-primary">
                {paliers.length > 1 && (
                  <span className="mr-1 text-sm font-normal text-muted-foreground">à partir de</span>
                )}
                {(paliers.length > 1
                  ? paliers[paliers.length - 1].prix_unitaire_fcfa
                  : produit.prix_unitaire_fcfa
                ).toLocaleString('fr-FR')}{' '}
                FCFA
                {produit.unite_vente ? (
                  <span className="text-sm font-normal text-muted-foreground"> / {produit.unite_vente}</span>
                ) : null}
              </p>

              {/* Le prix est celui de la marchandise. Le transport se cote sur
                  l'expédition réelle, donc sur la quantité effectivement
                  commandée : l'annoncer ici évite de le découvrir au devis. */}
              <p className="mt-1 text-xs text-muted-foreground">
                Hors livraison. Le transport est coté sur votre commande complète et facturé
                séparément — plus la quantité est importante, moins il pèse par pièce.
              </p>

              {/* La grille vient de devis de transport réellement obtenus, un par
                  quantité. Un palier n'y figure que si son prix baisse vraiment. */}
              {paliers.length > 1 && (
                <div className="mt-3 overflow-hidden rounded-md border">
                  <div className="flex items-center justify-between bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
                    <span>Quantité commandée</span>
                    <span>Prix unitaire</span>
                  </div>
                  {paliers.map((pal, i) => {
                    const suivant = paliers[i + 1];
                    const plage = suivant
                      ? `${pal.quantite_min} à ${suivant.quantite_min - 1}`
                      : `${pal.quantite_min} et plus`;
                    const atteint = quantite >= pal.quantite_min && (!suivant || quantite < suivant.quantite_min);
                    const economie =
                      i > 0
                        ? Math.round((1 - pal.prix_unitaire_fcfa / paliers[0].prix_unitaire_fcfa) * 100)
                        : 0;
                    return (
                      <div
                        key={pal.quantite_min}
                        className={`flex items-center justify-between border-t px-3 py-2 text-sm ${
                          atteint ? 'bg-primary/5 font-medium text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        <span>
                          {plage}
                          {economie > 0 && (
                            <span className="ml-2 text-xs text-primary">−{economie} %</span>
                          )}
                        </span>
                        <span>{pal.prix_unitaire_fcfa.toLocaleString('fr-FR')} FCFA</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {produit.quantite_minimum > 1 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Commande minimum : {produit.quantite_minimum} unités.
                </p>
              )}

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

              <div className="mt-6 flex items-center gap-3">
                <div className="flex items-center rounded-md border">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantite((q) => Math.max(1, q - 1))}
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

              <Button className="mt-3 w-full" onClick={handleAddToDevis}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Ajouter à ma demande de devis
              </Button>

              <AvisProduit produitId={produit.id} />
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
