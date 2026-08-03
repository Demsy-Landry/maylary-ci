import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Boxes, ClipboardList, User, ShoppingBag, LogOut, PackageSearch, Ship } from 'lucide-react';

export default function PublicHeaderPro() {
  const { user, isAdmin, signOut } = useAuth();
  const { totalArticles } = useCart();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-10 bg-foreground text-background">
      {/* Le logo et la barre d'actions étaient tous deux `shrink-0` : plus rien
          ne pouvait céder, et la ligne débordait de l'écran sur mobile. Le logo
          se rétrécit maintenant, la barre passe à la ligne si nécessaire. */}
      <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        <Link to="/" className="flex min-w-0 shrink items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-5 w-5" />
          </div>
          <span className="truncate text-lg font-semibold tracking-tight">Maylary</span>
          <span className="hidden rounded-full bg-background/10 px-2 py-0.5 text-xs font-medium sm:inline">
            Espace Pro
          </span>
        </Link>
        {/* Pas de `shrink-0` ici : un conteneur qui ne rétrécit pas garde sa
            largeur maximale et ne passe jamais à la ligne, `flex-wrap` ou non. */}
        <nav className="flex flex-wrap items-center justify-end gap-1 sm:shrink-0 sm:flex-nowrap sm:gap-2">
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
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/boutique">
              <ShoppingBag className="mr-1.5 h-4 w-4" />
              Boutique
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/catalogue">Catalogue</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="relative">
            <Link to="/catalogue/devis">
              <ClipboardList className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Devis</span>
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
            <Button asChild variant="outline" size="sm" className="hidden text-foreground sm:inline-flex">
              <Link to="/admin">Admin</Link>
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
    </header>
  );
}
