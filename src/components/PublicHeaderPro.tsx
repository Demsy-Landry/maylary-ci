import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Boxes, ClipboardList, User, ShoppingBag, LogOut } from 'lucide-react';

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
      <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Maylary</span>
          <span className="hidden rounded-full bg-background/10 px-2 py-0.5 text-xs font-medium sm:inline">
            Espace Pro
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
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
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
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
          {user && isAdmin ? (
            <Button variant="outline" size="sm" className="text-foreground" onClick={handleSignOut}>
              <LogOut className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          ) : user ? (
            <Button
              variant="outline"
              size="sm"
              className="text-foreground"
              onClick={() => navigate('/catalogue/mes-devis')}
            >
              <User className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Mes devis</span>
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
