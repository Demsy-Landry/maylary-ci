import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Boxes, ShieldCheck, LogOut, User, ShoppingBag, Building2, PackageSearch, Ship } from 'lucide-react';

export default function PublicHeaderImport() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-10 bg-foreground text-background">
      <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Maylary</span>
        </Link>

        <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/import/nouvelle-demande">
              <PackageSearch className="mr-1.5 h-4 w-4" />
              Importer
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/export/nouvelle-demande">
              <Ship className="mr-1.5 h-4 w-4" />
              Exporter
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/boutique">
              <ShoppingBag className="mr-1.5 h-4 w-4" />
              Boutique
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/catalogue">
              <Building2 className="mr-1.5 h-4 w-4" />
              Espace Pro
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
    </header>
  );
}
