import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ROLES_PAR_ECRAN } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

/**
 * Protège une route d'administration.
 *
 * Deux niveaux : être de l'équipe, puis avoir le rôle qui ouvre cet écran.
 * Le second est un confort d'interface — la vraie protection est posée en base
 * par les politiques RLS, qu'aucun navigateur ne contourne.
 */
export default function AdminRoute({ children, ecran }: { children: ReactNode; ecran?: string }) {
  const { loading, profilEnCours, user, isAdmin, profile } = useAuth();

  // Le rôle vient du profil : rediriger avant de l'avoir lu renverrait un
  // administrateur vers l'espace client.
  if (loading || (user && profilEnCours)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/boutique/compte" replace />;
  }

  const autorises = ecran ? ROLES_PAR_ECRAN[ecran] : undefined;
  const role = profile?.role_equipe ?? null;
  if (autorises && (role === null || !autorises.includes(role))) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
