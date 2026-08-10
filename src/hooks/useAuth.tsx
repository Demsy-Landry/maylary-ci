import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile } from '@/lib/supabase';

/**
 * L'état de connexion de l'application.
 *
 * Ce fichier a été réécrit après le constat d'une connexion instable : on se
 * connectait, on arrivait sur l'écran d'administration, et on en était parfois
 * renvoyé sans rien avoir fait. Trois causes distinctes, corrigées ici.
 *
 * **Une course entre deux sources de vérité.** L'ancienne version appelait
 * `getSession()` *et* écoutait `onAuthStateChange`. Rien ne garantit l'ordre
 * d'arrivée : quand la promesse de `getSession()` — partie avant la connexion —
 * se résolvait après l'événement `SIGNED_IN`, elle réécrivait la session avec
 * sa valeur d'avant, c'est-à-dire `null`. L'utilisateur venait de se connecter
 * et se retrouvait déconnecté. `onAuthStateChange` émet `INITIAL_SESSION` dès
 * l'abonnement : il suffit seul, et il est désormais la seule source.
 *
 * **Un échec réseau valait déconnexion.** La lecture du profil porte le rôle.
 * En cas d'erreur, l'ancienne version posait `profile = null`, donc
 * `isAdmin = false`, donc redirection vers l'espace client — un simple
 * micro-coupure suffisait à éjecter un administrateur. On distingue maintenant
 * « pas de profil » de « lecture impossible », et on réessaie.
 *
 * **Rien ne bornait l'attente.** Le client Supabase sérialise ses appels
 * derrière un verrou partagé entre onglets ; si ce verrou reste pris, l'attente
 * ne se termine jamais et l'écran garde son rond qui tourne. Un garde-fou
 * relâche l'attente au bout de huit secondes.
 */

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /** Vrai tant qu'on ignore si un utilisateur est connecté. */
  loading: boolean;
  /** Vrai tant que le profil du connecté n'est pas lu : le rôle n'est pas encore connu. */
  profilEnCours: boolean;
  /** Vrai quand la lecture du profil a échoué : le rôle est inconnu, pas absent. */
  profilIndisponible: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Au-delà, on cesse d'attendre : mieux vaut un écran de connexion qu'un écran figé. */
const DELAI_MAX_ATTENTE_MS = 8_000;
const TENTATIVES_PROFIL = 3;

const patiente = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilEnCours, setProfilEnCours] = useState(true);
  const [profilIndisponible, setProfilIndisponible] = useState(false);

  const monte = useRef(true);
  /**
   * Numéro de la lecture de profil en cours. Une lecture lancée pour un
   * utilisateur puis dépassée par une autre ne doit pas écraser le résultat de
   * la plus récente — c'est le même genre de course que celle décrite plus haut.
   */
  const generation = useRef(0);
  /**
   * Le profil, lisible depuis l'écouteur. L'abonnement n'est posé qu'une fois :
   * il capture l'état du premier rendu et ne verrait jamais les suivants. Une
   * référence, elle, reste à jour.
   */
  const profilRef = useRef<Profile | null>(null);

  const poserProfil = (p: Profile | null) => {
    profilRef.current = p;
    setProfile(p);
  };

  const lireProfil = async (userId: string) => {
    const mienne = ++generation.current;
    setProfilEnCours(true);

    for (let essai = 1; essai <= TENTATIVES_PROFIL; essai++) {
      const { data, error } = await supabase
        .from('app_e08c374bc4_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!monte.current || generation.current !== mienne) return;

      if (!error) {
        poserProfil((data as Profile) ?? null);
        setProfilIndisponible(false);
        setProfilEnCours(false);
        return;
      }

      // Dernier essai perdu : on le dit plutôt que de faire passer une panne
      // de lecture pour une absence de droits.
      if (essai === TENTATIVES_PROFIL) {
        setProfilIndisponible(true);
        setProfilEnCours(false);
        return;
      }
      await patiente(400 * essai);
      if (!monte.current || generation.current !== mienne) return;
    }
  };

  const refreshProfile = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) await lireProfil(data.session.user.id);
  };

  useEffect(() => {
    monte.current = true;

    const garde = setTimeout(() => {
      if (monte.current) {
        setLoading(false);
        setProfilEnCours(false);
      }
    }, DELAI_MAX_ATTENTE_MS);

    // Source unique : `INITIAL_SESSION` arrive dès l'abonnement, puis
    // `SIGNED_IN`, `TOKEN_REFRESHED` et `SIGNED_OUT` au fil de la session.
    const { data: ecoute } = supabase.auth.onAuthStateChange((evenement, nouvelleSession) => {
      if (!monte.current) return;

      setSession(nouvelleSession);
      setLoading(false);
      clearTimeout(garde);

      if (!nouvelleSession?.user) {
        generation.current++;
        poserProfil(null);
        setProfilIndisponible(false);
        setProfilEnCours(false);
        return;
      }

      // Un rafraîchissement de jeton ne change pas l'utilisateur : relire le
      // profil à chaque renouvellement ferait clignoter les écrans protégés
      // toutes les heures.
      if (evenement === 'TOKEN_REFRESHED' && profilRef.current) return;

      setProfilEnCours(true);
      const utilisateur = nouvelleSession.user.id;
      // Le client Supabase tient un verrou pendant ce rappel : tout appel qui
      // en dépend et qui serait attendu ici s'y bloquerait, et la connexion
      // resterait sans effet. On sort donc du rappel avant de lire le profil.
      setTimeout(() => {
        if (monte.current) void lireProfil(utilisateur);
      }, 0);
    });

    return () => {
      monte.current = false;
      clearTimeout(garde);
      ecoute.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    poserProfil(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        profile,
        loading,
        profilEnCours,
        profilIndisponible,
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
