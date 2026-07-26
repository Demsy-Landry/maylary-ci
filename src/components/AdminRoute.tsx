import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

/** Protège une route : accessible uniquement aux comptes type_compte = 'admin'. */
export default function AdminRoute({ children }: { children: ReactNode }) {
  const { loading, user, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/boutique/compte" replace />;
  }

  return <>{children}</>;
}
