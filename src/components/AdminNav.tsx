import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const LINKS = [
  { to: '/admin', label: 'Tableau de bord' },
  { to: '/admin/commandes', label: 'Commandes Boutique' },
  { to: '/admin/devis', label: 'Demandes de devis' },
  { to: '/admin/cj-dropshipping', label: 'Import CJ Dropshipping' },
  { to: '/admin/prospection', label: 'Prospection fournisseurs' },
];

export default function AdminNav() {
  const location = useLocation();

  return (
    <div>
      <Link
        to="/"
        className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Accueil
      </Link>
      <nav className="flex flex-wrap gap-3">
        {LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`text-sm font-medium ${
              location.pathname === link.to
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
