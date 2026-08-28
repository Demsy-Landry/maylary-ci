import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { verifierMotDePasse } from '@/lib/force-mot-de-passe';
import { toast } from 'sonner';
import { KeyRound, Loader2, MailCheck, ShieldCheck } from 'lucide-react';
import { useReferencement } from '@/hooks/useReferencement';

/**
 * Le mot de passe oublié — et pourquoi cet écran fait DEUX choses.
 *
 * Il manquait purement et simplement. Un client qui oubliait son mot de passe
 * était enfermé dehors définitivement : aucun écran ne permettait de le
 * reprendre, et il fallait décrocher le téléphone. Avant une première vente,
 * c'est le genre de trou qui coûte le client ET la confiance.
 *
 * Supabase renvoie l'utilisateur sur cette même adresse depuis le lien reçu
 * par courriel, en posant une session de récupération. L'écran doit donc
 * savoir dans lequel des deux moments il se trouve :
 *
 *   1. **Demander** le courriel — l'utilisateur arrive par le lien « mot de
 *      passe oublié » de la page de connexion.
 *   2. **Reprendre** le mot de passe — l'utilisateur arrive depuis son
 *      courriel, avec une session déjà ouverte par Supabase.
 *
 * Deux pages séparées obligeraient à faire transiter le jeton de l'une à
 * l'autre. Une seule page, qui lit l'état réel de la session, ne le fait pas.
 *
 * UN POINT QUI N'EST PAS UN DÉTAIL : la demande répond toujours la même chose,
 * que l'adresse existe ou non. Un écran qui dirait « cette adresse est
 * inconnue » offrirait à n'importe qui la liste des clients de la maison, une
 * adresse à la fois.
 */

type Moment = 'inconnu' | 'demander' | 'reprendre';

export default function MotDePasseOublie() {
  useReferencement({
    titre: "Réinitialiser votre mot de passe",
    description:
      "Recevez un lien de réinitialisation.",
    horsIndex: true,
  });

  const navigate = useNavigate();
  const [moment, setMoment] = useState<Moment>('inconnu');

  const [email, setEmail] = useState('');
  const [envoye, setEnvoye] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  /* Supabase émet PASSWORD_RECOVERY en traitant le lien du courriel. On
   * écoute l'événement plutôt que de lire l'adresse : le jeton est consommé
   * puis retiré de l'URL, et une lecture arrivée trop tard ne verrait rien. */
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evenement) => {
      if (evenement === 'PASSWORD_RECOVERY') setMoment('reprendre');
    });

    // Le lien peut aussi avoir été traité avant notre abonnement.
    void supabase.auth.getSession().then(({ data: { session } }) => {
      const parLeLien =
        window.location.hash.includes('type=recovery') ||
        new URLSearchParams(window.location.search).get('type') === 'recovery';
      setMoment((m) => (m === 'reprendre' ? m : session && parLeLien ? 'reprendre' : 'demander'));
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const demander = async (e: FormEvent) => {
    e.preventDefault();
    const adresse = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse)) {
      setErreur('Veuillez saisir une adresse email valide.');
      return;
    }
    setErreur('');
    setEnvoi(true);
    await supabase.auth.resetPasswordForEmail(adresse, {
      redirectTo: `${window.location.origin}/mot-de-passe-oublie`,
    });
    setEnvoi(false);
    // Réponse identique dans tous les cas, y compris en erreur : voir plus haut.
    setEnvoye(true);
  };

  const reprendre = async (e: FormEvent) => {
    e.preventDefault();
    const faiblesse = verifierMotDePasse(motDePasse);
    if (faiblesse) {
      setErreur(faiblesse);
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur('Les deux mots de passe ne sont pas identiques.');
      return;
    }
    setErreur('');
    setEnregistrement(true);
    const { error } = await supabase.auth.updateUser({ password: motDePasse });
    setEnregistrement(false);
    if (error) {
      setErreur(
        "Le lien a peut-être expiré. Demandez-en un nouveau depuis la page de connexion.",
      );
      return;
    }
    toast.success('Mot de passe modifié. Vous êtes connecté.');
    navigate('/boutique/mes-commandes');
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />

      <main className="entree-page mx-auto w-full max-w-md px-4 py-12">
        <Card className="shadow-lg">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              {moment === 'reprendre' ? (
                <ShieldCheck className="h-6 w-6 text-primary" />
              ) : (
                <KeyRound className="h-6 w-6 text-primary" />
              )}
            </div>
            <CardTitle className="font-display text-xl font-extrabold">
              {moment === 'reprendre' ? 'Choisissez un nouveau mot de passe' : 'Mot de passe oublié'}
            </CardTitle>
            <CardDescription>
              {moment === 'reprendre'
                ? 'Ce lien n’est valable qu’une fois. Choisissez maintenant.'
                : 'Nous vous envoyons un lien pour en choisir un nouveau.'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {moment === 'inconnu' && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {moment === 'demander' &&
              (envoye ? (
                <div className="space-y-4 text-center">
                  <MailCheck className="mx-auto h-8 w-8 text-emerald-600" />
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Si un compte existe pour <strong className="text-foreground">{email.trim()}</strong>,
                    un lien vient d’y être envoyé. Il est valable une heure.
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Pensez à regarder dans les indésirables. Le message vient de Supabase pour le
                    compte de MayLary Group.
                  </p>
                  <Button asChild variant="outline" className="bouton-anime w-full">
                    <Link to="/boutique/compte">Retour à la connexion</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={demander} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-oubli">Votre adresse email</Label>
                    <Input
                      id="email-oubli"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="vous@exemple.ci"
                    />
                  </div>
                  {erreur && (
                    <p className="text-sm text-destructive" role="alert">
                      {erreur}
                    </p>
                  )}
                  <Button type="submit" className="bouton-anime w-full" disabled={envoi}>
                    {envoi && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Envoyer le lien
                  </Button>
                  <Button asChild variant="ghost" className="w-full">
                    <Link to="/boutique/compte">Je me souviens finalement</Link>
                  </Button>
                </form>
              ))}

            {moment === 'reprendre' && (
              <form onSubmit={reprendre} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nouveau-mdp">Nouveau mot de passe</Label>
                  <Input
                    id="nouveau-mdp"
                    type="password"
                    value={motDePasse}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmation-mdp">Confirmez-le</Label>
                  <Input
                    id="confirmation-mdp"
                    type="password"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                {erreur && (
                  <p className="text-sm text-destructive" role="alert">
                    {erreur}
                  </p>
                )}
                <Button type="submit" className="bouton-anime w-full" disabled={enregistrement}>
                  {enregistrement && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer et me connecter
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}
