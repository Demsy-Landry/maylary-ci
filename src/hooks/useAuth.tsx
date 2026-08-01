import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile } from '@/lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /** Vrai tant qu'on ignore si un utilisateur est connecté. */
  loading: boolean;
  /** Vrai tant que le profil du connecté n'est pas lu : le rôle n'est pas encore connu. */
  profilEnCours: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilEnCours, setProfilEnCours] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('app_e08c374bc4_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      setProfile((data as Profile) ?? null);
    } finally {
      setProfilEnCours(false);
    }
  };

  const refreshProfile = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      await fetchProfile(data.session.user.id);
    }
  };

  useEffect(() => {
    let monte = true;

    /**
     * La session commande l'affichage : tant qu'on ne sait pas si l'utilisateur
     * est connecté, les pages protégées attendent. Cette attente doit donc se
     * terminer quoi qu'il arrive, y compris si la lecture du profil échoue.
     */
    supabase.auth
      .getSession()
      .then(({ data: { session: sessionCourante } }) => {
        if (!monte) return;
        setSession(sessionCourante);
        if (sessionCourante?.user) {
          // Sans await : le profil complète l'affichage, il ne le conditionne pas.
          fetchProfile(sessionCourante.user.id).catch(() => setProfile(null));
        } else {
          setProfilEnCours(false);
        }
      })
      .catch(() => {
        if (monte) setSession(null);
      })
      .finally(() => {
        if (monte) setLoading(false);
      });

    const { data: ecoute } = supabase.auth.onAuthStateChange((_evenement, nouvelleSession) => {
      if (!monte) return;
      setSession(nouvelleSession);
      setLoading(false);

      if (!nouvelleSession?.user) {
        setProfile(null);
        setProfilEnCours(false);
        return;
      }

      setProfilEnCours(true);

      // Le client Supabase tient un verrou pendant ce rappel : tout appel qui
      // en dépend et qui serait attendu ici s'y bloquerait, et la connexion
      // resterait sans effet. On sort donc du rappel avant de lire le profil.
      setTimeout(() => {
        if (monte) fetchProfile(nouvelleSession.user.id).catch(() => setProfile(null));
      }, 0);
    });

    return () => {
      monte = false;
      ecoute.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        profile,
        loading,
        profilEnCours,
        isAdmin: profile?.type_compte === 'admin',
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
