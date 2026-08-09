import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AdminNav from '@/components/AdminNav';
import { useAuth } from '@/hooks/useAuth';
import {
  supabase,
  PROFILES_TABLE,
  ROLE_EQUIPE_LABELS,
  ROLE_EQUIPE_DESCRIPTIONS,
  type Profile,
  type RoleEquipe,
} from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ShieldCheck, UserPlus, Search } from 'lucide-react';

const selectClassName =
  'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const ROLES: RoleEquipe[] = ['proprietaire', 'operations', 'catalogue'];

export default function AdminEquipeGestion() {
  const { profile } = useAuth();
  const [membres, setMembres] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [recherche, setRecherche] = useState('');
  const [candidats, setCandidats] = useState<Profile[]>([]);
  const [cherche, setCherche] = useState(false);

  const estProprietaire = profile?.role_equipe === 'proprietaire';

  const charger = async () => {
    setLoading(true);
    const { data } = await supabase
      .from(PROFILES_TABLE)
      .select('*')
      .eq('type_compte', 'admin')
      .order('created_at');
    setMembres((data as Profile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    charger();
  }, []);

  const chercherCompte = async () => {
    const q = recherche.trim();
    if (q.length < 3) {
      toast.error('Saisissez au moins trois caractères.');
      return;
    }
    setCherche(true);
    // On cherche parmi les comptes existants : rejoindre l'équipe suppose
    // d'avoir déjà créé son compte, ce qui garantit un mot de passe choisi par
    // l'intéressé et jamais transmis.
    const { data } = await supabase
      .from(PROFILES_TABLE)
      .select('*')
      .neq('type_compte', 'admin')
      .or(`nom_complet.ilike.%${q}%,telephone.ilike.%${q}%`)
      .limit(10);
    setCandidats((data as Profile[]) ?? []);
    setCherche(false);
  };

  const attribuer = async (p: Profile, role: RoleEquipe | null) => {
    setBusy(p.user_id);
    const { error } = await supabase
      .from(PROFILES_TABLE)
      .update(
        role === null
          ? { type_compte: 'particulier', role_equipe: null }
          : { type_compte: 'admin', role_equipe: role },
      )
      .eq('user_id', p.user_id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(role === null ? "Accès retiré." : `${ROLE_EQUIPE_LABELS[role]} attribué.`);
    setCandidats([]);
    setRecherche('');
    charger();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-screen-xl space-y-2 px-4 py-4 sm:px-6">
          <AdminNav />
          <h1 className="font-display text-lg font-bold text-foreground">Admin — Équipe MayLary Group</h1>
        </div>
      </header>

      <main className="entree-page mx-auto max-w-screen-lg space-y-6 px-4 py-8 sm:px-6">
        <section className="carte-reactive rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Déléguer sans tout ouvrir
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {ROLES.map((r) => (
              <li key={r}>
                · <strong className="text-foreground">{ROLE_EQUIPE_LABELS[r]}</strong> —{' '}
                {ROLE_EQUIPE_DESCRIPTIONS[r]}
              </li>
            ))}
          </ul>
        </section>

        {!estProprietaire ? (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Seul le propriétaire attribue les rôles de l'équipe.
          </p>
        ) : (
          <>
            <section className="carte-reactive rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">Ajouter un membre</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                La personne crée d'abord son compte sur MayLary Group, puis vous lui attribuez un rôle.
                Ainsi son mot de passe reste le sien et ne transite jamais par vous.
              </p>
              <div className="mt-3 flex gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="q" className="sr-only">
                    Nom ou téléphone
                  </Label>
                  <Input
                    id="q"
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Nom ou téléphone du collaborateur"
                  />
                </div>
                <Button variant="outline" onClick={chercherCompte} disabled={cherche}>
                  {cherche ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {candidats.length > 0 && (
                <div className="mt-3 divide-y rounded-md border">
                  {candidats.map((c) => (
                    <div key={c.user_id} className="flex flex-wrap items-center justify-between gap-2 p-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{c.nom_complet}</p>
                        <p className="text-xs text-muted-foreground">{c.telephone ?? '—'}</p>
                      </div>
                      <div className="flex gap-2">
                        {ROLES.filter((r) => r !== 'proprietaire').map((r) => (
                          <Button
                            key={r}
                            size="sm"
                            variant="outline"
                            onClick={() => attribuer(c, r)}
                            disabled={busy === c.user_id}
                          >
                            <UserPlus className="mr-1.5 h-4 w-4" />
                            {ROLE_EQUIPE_LABELS[r]}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold text-foreground">Membres actuels</h2>
              {loading ? (
                <div className="mt-3 space-y-2">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : (
                <div className="cascade mt-3 divide-y rounded-md border">
                  {membres.map((m) => {
                    const soiMeme = m.user_id === profile?.user_id;
                    return (
                      <div key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">
                            {m.nom_complet}
                            {soiMeme && <span className="ml-2 text-xs text-muted-foreground">(vous)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">{m.telephone ?? '—'}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={m.role_equipe === 'proprietaire' ? 'default' : 'secondary'}>
                            {m.role_equipe ? ROLE_EQUIPE_LABELS[m.role_equipe] : 'Sans rôle'}
                          </Badge>
                          {/* On ne se retire pas soi-même : l'application resterait
                              sans propriétaire, donc sans personne pour rouvrir. */}
                          {!soiMeme && (
                            <>
                              <select
                                className={selectClassName + ' w-36'}
                                value={m.role_equipe ?? ''}
                                onChange={(e) => attribuer(m, e.target.value as RoleEquipe)}
                                disabled={busy === m.user_id}
                              >
                                {ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {ROLE_EQUIPE_LABELS[r]}
                                  </option>
                                ))}
                              </select>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => attribuer(m, null)}
                                disabled={busy === m.user_id}
                              >
                                Retirer
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
