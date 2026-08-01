import { Link, useNavigate } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import { useCartGP, prixLigne } from '@/hooks/useCartGP';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, ShoppingCart, ArrowRight } from 'lucide-react';
import ImageWithFallback from '@/components/ImageWithFallback';

export default function PanierAchat() {
  const { items, updateQuantite, removeItem, totalFcfa } = useCartGP();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-foreground">Mon panier</h1>

        {items.length === 0 ? (
          <div className="mt-8 rounded-md border border-dashed p-10 text-center">
            <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Votre panier est vide. Parcourez la boutique pour ajouter des produits.
            </p>
            <Button asChild className="mt-4">
              <Link to="/boutique">Voir la boutique</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              {items.map((item) => (
                <div key={item.produit_id} className="flex items-center gap-3 rounded-md border p-3">
                  <ImageWithFallback
                    src={item.photo}
                    alt={item.nom}
                    className="h-16 w-16 rounded-md border object-cover"
                    fallbackClassName="h-16 w-16 rounded-md border"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{item.nom}</p>
                    <p className="text-sm font-semibold text-primary">
                      {prixLigne(item).toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                  <div className="flex items-center rounded-md border">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateQuantite(item.produit_id, item.quantite - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center text-sm">{item.quantite}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateQuantite(item.produit_id, item.quantite + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(item.produit_id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-4 rounded-md border p-4">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-primary">{totalFcfa.toLocaleString('fr-FR')} FCFA</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Frais de livraison précisés à l'étape suivante selon votre ville.
                </p>
              </div>
              <Button className="w-full" onClick={() => navigate('/boutique/commande')}>
                Passer la commande
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
