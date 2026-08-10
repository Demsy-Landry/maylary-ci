import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase, PROFILES_TABLE } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { messageDeConnexion } from '@/lib/erreurs-auth';
import { Loader2, ShieldCheck, Boxes } from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Veuillez renseigner votre email et votre mot de passe.');
      return;
    }
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError(messageDeConnexion(signInError));
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from(PROFILES_TABLE)
      .select('type_compte')
      .eq('user_id', data.user.id)
      .maybeSingle();

    // La lecture a échoué : on ignore le rôle, on ne l'infirme pas. Déconnecter
    // ici — ce que faisait la version précédente — annonçait « ce compte n'est
    // pas administrateur » à un administrateur dont la requête avait simplement
    // échoué. La session est valide : on la garde et on invite à réessayer.
    if (profileError) {
      setError(
        "Connexion établie, mais vos droits n'ont pas pu être vérifiés. Réessayez dans un instant.",
      );
      setLoading(false);
      return;
    }

    if (profileData?.type_compte !== 'admin') {
      await supabase.auth.signOut();
      setError("Ce compte n'est pas un compte administrateur.");
      setLoading(false);
      return;
    }

    await refreshProfile();
    toast.success('Connexion admin réussie.');
    setLoading(false);
    navigate('/admin');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-foreground px-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Espace Administration</CardTitle>
          <CardDescription>Réservé à l'équipe MayLary Group</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Mot de passe</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Se connecter en tant qu'admin
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-1.5 border-t pt-4 text-xs text-muted-foreground">
            <Boxes className="h-3.5 w-3.5" />
            <Link to="/" className="hover:text-foreground hover:underline">
              Retour au site MayLary Group
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
