import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ROLES_PAR_ECRAN } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import BoutonRetour from '@/components/BoutonRetour';

const LINKS = [
  { to: '/admin', label: 'Tableau de bord' },
  { to: '/admin/dossiers', label: 'Dossiers' },
  { to: '/admin/produits', label: 'Articles' },
  { to: '/admin/declarant', label: 'Le Déclarant' },
  { to: '/admin/import', label: "Demandes d'import" },
  { to: '/admin/export', label: "Demandes d'export" },
  { to: '/admin/commandes', label: 'Commandes Boutique' },
  { to: '/admin/assistance', label: 'Assistance client' },
  { to: '/admin/sourcing', label: 'Sourcing sur demande' },
  { to: '/admin/vendeurs', label: 'Vendeurs marketplace' },
  { to: '/admin/achats-groupes', label: 'Achats groupés' },
  { to: '/admin/devis', label: 'Demandes de devis' },
  { to: '/admin/cj-dropshipping', label: 'Catalogue CJ Dropshipping' },
  { to: '/admin/fournisseurs', label: 'Fournisseurs et origines' },
  { to: '/admin/prospection', label: 'Prospection fournisseurs' },
  { to: '/admin/qualite-fournisseurs', label: 'Qualité fournisseurs' },
  { to: '/admin/comptabilite', label: 'Comptabilité' },
  { to: '/admin/equipe', label: 'Équipe' },
  { to: '/admin/parametres', label: 'Paramètres' },
  { to: '/admin/journal-erreurs', label: 'Écrans cassés' },
];

export default function AdminNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  // On n'affiche que les écrans réellement accessibles : un lien qui renvoie
  // vers un refus use la confiance dans l'outil.
  const role = profile?.role_equipe ?? null;
  const liens = LINKS.filter((l) => {
    const autorises = ROLES_PAR_ECRAN[l.to];
    if (!autorises) return true;
    return role !== null && autorises.includes(role);
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Accueil
        </Link>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          <LogOut className="mr-1.5 h-4 w-4" />
          Déconnexion
        </Button>
      </div>
      <BoutonRetour className="-ml-2 mb-1 text-xs text-muted-foreground hover:text-foreground" />
      <nav className="flex flex-wrap gap-x-4 gap-y-1.5">
        {liens.map((link) => (
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
