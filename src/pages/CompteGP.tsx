import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase, EDGE_FUNCTIONS_URL, PROFILES_TABLE } from '@/lib/supabase';
import { messageDeConnexion } from '@/lib/erreurs-auth';
import { verifierMotDePasse } from '@/lib/force-mot-de-passe';
import { useReferencement } from '@/hooks/useReferencement';
import { PAGES } from '@/lib/referencement-pages';
import {
  Loader2,
  Building2,
  User,
  FileText,
  FolderCheck,
  UserCheck,
  Layers,
  ShieldCheck,
} from 'lucide-react';

type TypeCompte = 'particulier' | 'entreprise_acheteuse';

/**
 * Où renvoyer l'utilisateur une fois connecté.
 *
 * La page d'où il vient l'emporte sur la destination par défaut : quelqu'un
 * envoyé ici depuis Le Déclarant veut revenir au Déclarant, pas atterrir sur
 * ses commandes. Seuls les chemins internes sont acceptés — un `retour` qui
 * pointerait ailleurs ferait de cette page un tremplin vers un site tiers.
 */
const retourSur = (demande: string | null): string | null =>
  demande && /^\/[^/\\]/.test(demande) ? demande : null;

/**
 * Ce qu'un compte entreprise ouvre réellement.
 *
 * Directive du fondateur : « les connexions entreprise doivent avoir des
 * avantages et un style particulier, haut de gamme, de pointe ».
 *
 * Le style, on peut le poser tout de suite. Les avantages, non — pas
 * n'importe lesquels. Une remise, un délai de paiement ou une priorité de
 * traitement sont des engagements commerciaux qui n'existent nulle part dans
 * le produit : les afficher serait promettre au nom de la maison quelque
 * chose qu'elle n'a pas décidé.
 *
 * Ce panneau ne dit donc que ce que le code fait DÉJÀ pour un compte
 * entreprise : l'accès aux rayons professionnels, l'atelier de devis, le
 * dossier de transit numéroté et documenté, et l'interlocuteur unique. Quatre
 * choses vraies valent mieux que six avantages inventés — un acheteur
 * professionnel vérifie.
 */
const AVANTAGES_ENTREPRISE = [
  {
    icone: Layers,
    titre: 'Les rayons professionnels',
    texte: "L'Espace Pro et ses références déjà chiffrées vous sont ouverts dès la validation.",
  },
  {
    icone: FileText,
    titre: "L'atelier de devis",
    texte:
      'Constituez un panier de devis, recevez un chiffrage poste par poste — marchandise, fret, assurance, droits, livraison.',
  },
  {
    icone: FolderCheck,
    titre: 'Un dossier numéroté',
    texte:
      "Chaque opération ouvre un dossier qui porte sa documentation jusqu'au bordereau de livraison, puis s'archive.",
  },
  {
    icone: UserCheck,
    titre: 'Un seul interlocuteur',
    texte: "Du fournisseur à votre entrepôt, sans renvoi entre prestataires.",
  },
];

export default function CompteGP() {
  useReferencement(PAGES["/boutique/compte"]);

  const navigate = useNavigate();
  const [parametres] = useSearchParams();
  const retour = retourSur(parametres.get('retour'));

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
      setLoginError(messageDeConnexion(error));
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
      retour ??
        (profileData?.type_compte === 'admin'
          ? '/admin'
          : profileData?.type_compte === 'entreprise_acheteuse'
            ? '/catalogue/mes-devis'
            : '/boutique/mes-commandes'),
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
    const faiblesse = verifierMotDePasse(password);
    if (faiblesse) {
      setSignupError(faiblesse);
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
      toast.success('Bienvenue sur MayLary Group !');
      setSignupLoading(false);
      navigate(
        retour ??
          (typeCompte === 'entreprise_acheteuse'
            ? '/catalogue/mes-devis'
            : '/boutique/mes-commandes'),
      );
    } catch {
      setSignupError('Impossible de contacter le serveur. Veuillez réessayer.');
      setSignupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <main className="entree-page mx-auto grid w-full max-w-screen-lg items-start gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="w-full shadow-lg">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              {typeCompte === 'entreprise_acheteuse' ? (
                <Building2 className="h-6 w-6 text-primary" />
              ) : (
                <User className="h-6 w-6 text-primary" />
              )}
            </div>
            <CardTitle className="font-display text-2xl">Mon compte MayLary Group</CardTitle>
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
                    <div className="flex items-baseline justify-between gap-2">
                      <Label htmlFor="login-password-gp">Mot de passe</Label>
                      {/* Sans ce lien, un client qui oublie son mot de passe
                          n'a aucun moyen de revenir : il faut téléphoner. */}
                      <Link
                        to="/mot-de-passe-oublie"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Mot de passe oublié ?
                      </Link>
                    </div>
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
                  <div className="cascade grid grid-cols-2 gap-2">
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
                  <div className="cascade grid grid-cols-2 gap-3">
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
                Vous êtes de l'équipe MayLary Group ? Se connecter en tant qu'admin
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* ---------- La porte entreprise ----------
            Elle s'allume quand le visiteur choisit « Entreprise » : le panneau
            passe alors sur fond sombre, comme les écrans d'exploitation. Le
            reste du temps il reste sobre — un particulier n'a pas à recevoir
            un argumentaire qui ne le concerne pas. */}
        <aside
          className={`carte-reactive sticky top-24 overflow-hidden rounded-xl border transition-colors duration-500 ${
            typeCompte === 'entreprise_acheteuse'
              ? 'border-primary/40 bg-foreground text-background'
              : 'bg-card text-foreground'
          }`}
          data-revele
        >
          <div className="p-5">
            <p
              className={`font-display text-[0.65rem] font-semibold uppercase tracking-[0.28em] ${
                typeCompte === 'entreprise_acheteuse' ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              Compte entreprise
            </p>
            <h2 className="mt-2.5 font-display text-lg font-bold leading-snug">
              Ce que votre compte ouvre
            </h2>

            <ul className="mt-5 space-y-4">
              {AVANTAGES_ENTREPRISE.map((a, i) => {
                const Icone = a.icone;
                return (
                  <li key={a.titre} className="flex gap-3" style={{ animationDelay: `${i * 60}ms` }}>
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        typeCompte === 'entreprise_acheteuse' ? 'bg-primary/15' : 'bg-primary/10'
                      }`}
                    >
                      <Icone className="h-4 w-4 text-primary" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug">{a.titre}</p>
                      <p
                        className={`mt-0.5 text-xs leading-relaxed ${
                          typeCompte === 'entreprise_acheteuse'
                            ? 'text-background/70'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {a.texte}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p
              className={`mt-5 flex items-start gap-2 border-t pt-4 text-xs leading-relaxed ${
                typeCompte === 'entreprise_acheteuse'
                  ? 'border-background/15 text-background/60'
                  : 'text-muted-foreground'
              }`}
            >
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Le compte entreprise est validé par l’équipe avant ouverture des rayons
              professionnels. Le nom de l’entreprise est donc obligatoire.
            </p>
          </div>
        </aside>
      </main>
      <SiteFooter />
    </div>
  );
}
