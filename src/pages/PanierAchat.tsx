import { Link, useNavigate } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import { useCartGP, prixLigne, type CartItemGP } from '@/hooks/useCartGP';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, ShoppingCart, ArrowRight } from 'lucide-react';
import ImageWithFallback from '@/components/ImageWithFallback';
import GarantiePayeProtege from '@/components/GarantiePayeProtege';
import FileGroupage from '@/components/FileGroupage';
import FretApresVerification from '@/components/FretApresVerification';
import { useReferencement } from '@/hooks/useReferencement';
import { PAGES } from '@/lib/referencement-pages';

export default function PanierAchat() {
  useReferencement(PAGES["/boutique/panier"]);

  const { items, itemsExpress, itemsGroupage, updateQuantite, removeItem, totalFcfa } =
    useCartGP();
  const navigate = useNavigate();

  /* La même carte sert aux deux files. La dupliquer ferait diverger les deux
     affichages dès la première retouche — et c'est toujours la seconde qu'on
     oublie. */
  const carteArticle = (item: CartItemGP) => (
                <div
      key={item.produit_id}
      /* Sur un téléphone, la rangée unique écrasait le nom : « Écouteurs Bl… »
         pour un article qui s'appelle « Écouteurs Bluetooth sans fil ». Les
         commandes ont une largeur fixe, c'est donc toujours le nom qui cède.
         En dessous de `sm`, la ligne se replie et le nom reprend toute la
         largeur. */
      className="flex flex-wrap items-center gap-3 rounded-md border p-3 sm:flex-nowrap"
    >
                  <ImageWithFallback
                    src={item.photo}
                    alt={item.nom}
                    className="h-16 w-16 shrink-0 rounded-md border object-cover"
                    fallbackClassName="h-16 w-16 shrink-0 rounded-md border"
                  />
                  <div className="min-w-0 flex-1 basis-[calc(100%-5.5rem)] sm:basis-auto">
                    <p className="font-medium text-foreground [overflow-wrap:anywhere] line-clamp-2 sm:truncate">
                      {item.nom}
                    </p>
                    <p className="text-sm font-semibold text-primary">
                      {prixLigne(item).toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center rounded-md border">
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => removeItem(item.produit_id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <main className="entree-page mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
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
            {/* `min-w-0` sur l'élément de grille : sans lui, la colonne se
                dimensionne sur le contenu le plus large — ici le nom de produit,
                que `truncate` empêche de se couper — et la page entière défile
                horizontalement sur mobile. */}
            <div className="min-w-0 space-y-3 lg:col-span-2">
              {/* LES DEUX FILES NE SE MÉLANGENT PAS
                  Un article que CJ porte part demain ; un article de groupage
                  attend le conteneur. Les afficher dans une liste unique ferait
                  croire au client que tout arrive ensemble — et la déception se
                  découvrirait trois semaines plus tard, sur le suivi. */}
              {itemsGroupage.length > 0 && itemsExpress.length > 0 && (
                <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Expédition rapide
                </p>
              )}
              {itemsExpress.map(carteArticle)}

              {itemsGroupage.length > 0 && (
                <div className="space-y-3 pt-2">
                  <FileGroupage nombreArticles={itemsGroupage.length} />
                  <FretApresVerification compact />
                  {itemsGroupage.map(carteArticle)}
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-md border p-4">
              <div>
                <p className="text-sm text-muted-foreground">Sous-total marchandise</p>
                <p className="text-2xl font-bold text-primary">{totalFcfa.toLocaleString('fr-FR')} FCFA</p>
                {/* Le transport n'est plus fondu dans les prix : le dire ici,
                    pas au moment de payer. Une somme qui grossit à la dernière
                    étape fait abandonner le panier. */}
                {/* Deux acheminements, deux phrases. Promettre « un seul
                    colis » quand le panier contient du groupage serait un
                    engagement que la maison ne peut pas tenir — et c'est le
                    genre de promesse qu'un client retient. */}
                <p className="mt-1 text-xs text-muted-foreground">
                  {itemsGroupage.length > 0 && itemsExpress.length > 0 ? (
                    <>
                      Hors livraison. Votre commande part en{' '}
                      <strong>deux envois</strong> : les articles en expédition rapide
                      d’abord, ceux en groupage au départ du prochain conteneur. Le
                      transport rapide est coté à l’étape suivante ; celui du groupage
                      vous est communiqué après vérification du volume.
                    </>
                  ) : itemsGroupage.length > 0 ? (
                    <>
                      Hors livraison. Votre commande part au{' '}
                      <strong>prochain départ de groupage</strong>. Le transport n’est pas
                      encore chiffré : il vous sera communiqué après vérification du volume,
                      et <strong>aucun paiement ne part avant</strong>.
                    </>
                  ) : (
                    <>
                      Hors livraison. Vos articles partent dans un seul colis : le transport
                      est coté à l’étape suivante et vous choisissez entre plusieurs
                      transporteurs, du plus économique au plus rapide.
                    </>
                  )}
                </p>
              </div>
              <Button className="w-full" onClick={() => navigate('/boutique/commande')}>
                Passer la commande
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              {/* L'engagement se dit ici, juste avant le geste qui fait peur —
                  pas sur une page « conditions » que personne n'ouvre. */}
              <GarantiePayeProtege />
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
