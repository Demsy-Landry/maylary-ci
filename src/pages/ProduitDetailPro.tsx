import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PublicHeaderPro from '@/components/PublicHeaderPro';
import SiteFooter from '@/components/SiteFooter';
import {
  supabase,
  ENSEIGNES_TABLE,
  PRODUITS_PUBLIC_VIEW,
  PRODUITS_FAVORIS_TABLE,
  type Enseigne,
  type Produit,
} from '@/lib/supabase';
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
      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <Link
          to="/catalogue"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Retour à l'Espace Pro
        </Link>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2">
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
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
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

            <div>
              {enseigne && <p className="text-sm text-primary">{enseigne.nom}</p>}
              <h1 className="mt-1 text-2xl font-bold text-foreground">{produit.nom}</h1>
              <p className="mt-2 text-2xl font-semibold text-primary">
                {produit.prix_unitaire_fcfa.toLocaleString('fr-FR')} FCFA
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={produit.stock_disponible === 'rupture' ? 'destructive' : 'secondary'}>
                  {STOCK_LABELS[produit.stock_disponible]}
                </Badge>
                {produit.categorie && <Badge variant="outline">{produit.categorie}</Badge>}
              </div>

              {produit.delai_livraison_estime && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Délai de livraison estimé : {produit.delai_livraison_estime}
                </p>
              )}

              {produit.description && (
                <p className="mt-4 whitespace-pre-line text-sm text-foreground">{produit.description}</p>
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
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
