import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase, EDGE_FUNCTIONS_URL, PROFILES_TABLE } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Building2, User } from 'lucide-react';

type TypeCompte = 'particulier' | 'entreprise_acheteuse';

export default function CompteGP() {
  const navigate = useNavigate();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [typeCompte, setTypeCompte] = useState<TypeCompte>('particulier');
  const [nomComplet, setNomComplet] = useState('');
  const [nomEntreprise, setNomEntreprise] = useState('');
  const [telephone, setTelephone] = useState('');
  const [ville, setVille] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Veuillez renseigner votre email et votre mot de passe.');
      return;
    }
    setLoginLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    if (error) {
      setLoginError('Email ou mot de passe incorrect.');
      setLoginLoading(false);
      return;
    }
    // Le profil décide de la destination. On le lit directement plutôt que
    // d'attendre le rafraîchissement du contexte : la redirection ne doit pas
    // dépendre d'un aller-retour supplémentaire.
    const { data: profileData } = await supabase
      .from(PROFILES_TABLE)
      .select('type_compte')
      .eq('user_id', data.user.id)
      .maybeSingle();
    toast.success('Connexion réussie.');
    setLoginLoading(false);
    navigate(
      profileData?.type_compte === 'admin'
        ? '/admin'
        : profileData?.type_compte === 'entreprise_acheteuse'
          ? '/catalogue/mes-devis'
          : '/boutique/mes-commandes',
    );
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setSignupError('');

    if (!nomComplet.trim() || !email.trim() || !password) {
      setSignupError("Le nom, l'email et le mot de passe sont obligatoires.");
      return;
    }
    if (typeCompte === 'entreprise_acheteuse' && !nomEntreprise.trim()) {
      setSignupError("Le nom de l'entreprise est obligatoire pour un compte professionnel.");
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
      setSignupError('Veuillez saisir une adresse email valide.');
      return;
    }
    if (password.length < 8) {
      setSignupError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setSignupLoading(true);
    try {
      const res = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_entreprise_signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          type_compte: typeCompte,
          nom_complet: nomComplet.trim(),
          nom_entreprise: nomEntreprise.trim(),
          telephone: telephone.trim(),
          ville: ville.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setSignupError(result.error ?? 'Une erreur est survenue.');
        setSignupLoading(false);
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        toast.success('Compte créé. Vous pouvez maintenant vous connecter.');
        setSignupLoading(false);
        return;
      }
      toast.success('Bienvenue sur Maylary !');
      setSignupLoading(false);
      navigate(typeCompte === 'entreprise_acheteuse' ? '/catalogue/mes-devis' : '/boutique/mes-commandes');
    } catch {
      setSignupError('Impossible de contacter le serveur. Veuillez réessayer.');
      setSignupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <main className="flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Mon compte Maylary</CardTitle>
            <CardDescription>Connectez-vous ou créez votre compte pour commander</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Créer un compte</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="pt-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email-gp">Email</Label>
                    <Input
                      id="login-email-gp"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password-gp">Mot de passe</Label>
                    <Input
                      id="login-password-gp"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  {loginError && (
                    <p className="text-sm text-destructive" role="alert">
                      {loginError}
                    </p>
                  )}
                  <Button type="submit" className="w-full" disabled={loginLoading}>
                    {loginLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Se connecter
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="pt-4">
                <form onSubmit={handleSignup} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTypeCompte('particulier')}
                      className={`flex flex-col items-center gap-1.5 rounded-md border p-3 text-sm transition-colors ${
                        typeCompte === 'particulier'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <User className="h-5 w-5" />
                      Particulier
                    </button>
                    <button
                      type="button"
                      onClick={() => setTypeCompte('entreprise_acheteuse')}
                      className={`flex flex-col items-center gap-1.5 rounded-md border p-3 text-sm transition-colors ${
                        typeCompte === 'entreprise_acheteuse'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <Building2 className="h-5 w-5" />
                      Entreprise
                    </button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-nom-gp">Nom complet</Label>
                    <Input id="signup-nom-gp" value={nomComplet} onChange={(e) => setNomComplet(e.target.value)} />
                  </div>
                  {typeCompte === 'entreprise_acheteuse' && (
                    <div className="space-y-2">
                      <Label htmlFor="signup-entreprise-gp">Nom de l'entreprise</Label>
                      <Input
                        id="signup-entreprise-gp"
                        value={nomEntreprise}
                        onChange={(e) => setNomEntreprise(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="signup-telephone-gp">Téléphone</Label>
                      <Input
                        id="signup-telephone-gp"
                        value={telephone}
                        onChange={(e) => setTelephone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-ville-gp">Ville</Label>
                      <Input id="signup-ville-gp" value={ville} onChange={(e) => setVille(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email-gp">Email</Label>
                    <Input
                      id="signup-email-gp"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password-gp">Mot de passe</Label>
                    <Input
                      id="signup-password-gp"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8 caractères minimum"
                    />
                  </div>
                  {signupError && (
                    <p className="text-sm text-destructive" role="alert">
                      {signupError}
                    </p>
                  )}
                  <Button type="submit" className="w-full" disabled={signupLoading}>
                    {signupLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Créer mon compte
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 border-t pt-4 text-center">
              <Link
                to="/admin/connexion"
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Vous êtes de l'équipe Maylary ? Se connecter en tant qu'admin
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
