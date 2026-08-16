import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MarqueMaylary } from '@/components/MarqueMaylary';
import { Button } from '@/components/ui/button';
import MenuServices from '@/components/MenuServices';
import BoutonRetour from '@/components/BoutonRetour';
import { useAuth } from '@/hooks/useAuth';
import { useCartGP } from '@/hooks/useCartGP';
import {
  ShoppingCart,
  User,
  Building2,
  ShieldCheck,
  LogOut,
  Search,
  MapPin,
  PackageSearch,
  Ship,
} from 'lucide-react';

export default function PublicHeaderGP() {
  const { user, isAdmin, signOut } = useAuth();
  const { totalArticles } = useCartGP();
  const navigate = useNavigate();
  const [headerSearch, setHeaderSearch] = useState('');

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleHeaderSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(headerSearch.trim() ? `/boutique?q=${encodeURIComponent(headerSearch.trim())}` : '/boutique');
  };

  return (
    <header className="sticky top-0 z-10 bg-foreground pt-[env(safe-area-inset-top)] text-background">
      {/* La bascule vers une seule ligne — logo, recherche, navigation — attend
          `xl` et non `sm`. Dès 640 px les libellés apparaissent en toutes
          lettres ; les tenir sur une ligne avec la barre de recherche faisait
          déborder l'en-tête de 338 px sur une tablette de 768 px, et encore de
          82 px sur un portable de 1024 px. En dessous de 1280 px la barre reste
          donc sur deux rangées et la navigation se replie. */}
      <div className="mx-auto flex max-w-screen-xl flex-col gap-2 px-4 py-3 sm:px-6 xl:flex-row xl:items-center xl:gap-3">
        <div className="flex items-center justify-between gap-3 xl:contents">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <MarqueMaylary className="h-5 w-5" />
            </div>
            <span className="hidden text-lg font-semibold tracking-tight sm:inline">
              MayLary<span className="font-normal opacity-80"> Group</span>
            </span>
          </Link>

          {/* `shrink-0` empêchait la barre de céder, et `flex-wrap` seul ne
              suffit pas : un conteneur qui ne rétrécit pas garde sa largeur
              maximale et ne passe jamais à la ligne. Sur un écran de 320 px,
              la barre débordait de 74 px. Elle se replie désormais ; le
              comportement bureau, où elle reste sur une ligne à droite de la
              recherche, est préservé à partir de `xl`. */}
          <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2 xl:order-3 xl:shrink-0 xl:flex-nowrap">
          {/* Tous les métiers, y compris ceux que l'en-tête n'a pas la place
              d'afficher en toutes lettres sur un téléphone. */}
          <MenuServices />
          <Button asChild variant="outline" size="sm" className="text-foreground">
            <Link to="/import/nouvelle-demande">
              <PackageSearch className="mr-1.5 h-4 w-4" />
              Import
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="hidden text-foreground sm:inline-flex">
            <Link to="/export/nouvelle-demande">
              <Ship className="mr-1.5 h-4 w-4" />
              Export
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/boutique">Boutique</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/catalogue">
              <Building2 className="mr-1.5 h-4 w-4" />
              Espace Pro
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="relative">
            <Link to="/boutique/panier">
              <ShoppingCart className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Panier</span>
              {totalArticles > 0 && (
                <span
                  key={totalArticles}
                  className="pastille-animee absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
                >
                  {totalArticles}
                </span>
              )}
            </Link>
          </Button>
          {isAdmin && (
            <Button asChild variant="outline" size="sm" className="text-foreground">
              <Link to="/admin">
                <ShieldCheck className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            </Button>
          )}
          {user && !isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="text-foreground"
              onClick={() => navigate('/mon-compte')}
            >
              <User className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Mon compte</span>
            </Button>
          )}
          {user ? (
            <Button variant="outline" size="sm" className="text-foreground" onClick={handleSignOut}>
              <LogOut className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-foreground"
              onClick={() => navigate('/boutique/compte')}
            >
              <User className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Connexion</span>
            </Button>
          )}
          </nav>
        </div>

        <form onSubmit={handleHeaderSearch} className="flex w-full min-w-0 xl:order-2 xl:flex-1">
          <div className="flex w-full items-center rounded-md bg-background focus-within:ring-2 focus-within:ring-primary">
            <input
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
              placeholder="Rechercher un produit, une marque..."
              className="min-w-0 flex-1 rounded-l-md bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Rechercher"
              className="flex h-full items-center rounded-r-md bg-primary px-3 py-2 text-primary-foreground hover:bg-primary-emphasis"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>

      {/* La ligne du bas porte deux choses de nature différente — d'où le
          retour à gauche, l'information de livraison à droite. Le retour vit
          dans l'en-tête et non dans chaque page : posé une fois ici, il
          apparaît sur les vingt-huit écrans qui utilisent cet en-tête, et il
          ne peut plus être oublié sur l'un d'eux. */}
      <div className="border-t border-background/10 bg-foreground/95 text-background/80">
        <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1 text-xs sm:px-6">
          <BoutonRetour className="-ml-2 text-xs text-background/80 hover:text-background" />
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>Votre adresse de livraison : Côte d'Ivoire, partout dans le pays</span>
          </span>
        </div>
      </div>
    </header>
  );
}
