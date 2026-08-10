import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
  const { loading, profilEnCours, profilIndisponible, user, isAdmin, profile, refreshProfile } =
    useAuth();

  // Le rôle vient du profil : rediriger avant de l'avoir lu renverrait un
  // administrateur vers l'espace client.
  if (loading || (user && profilEnCours)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Rôle inconnu parce que la lecture a échoué — ce n'est pas un refus. Une
  // coupure de quelques secondes ne doit pas éjecter l'administrateur de son
  // écran : on propose de réessayer, on ne redirige pas.
  if (user && profilIndisponible) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          Vos droits n'ont pas pu être vérifiés — la connexion à la base a échoué. Votre session est
          intacte.
        </p>
        <Button onClick={() => void refreshProfile()} variant="outline" size="sm">
          Réessayer
        </Button>
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
