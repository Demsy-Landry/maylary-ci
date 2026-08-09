import { useEffect, useState } from 'react';
import { supabase, PARAMETRES_GARANTIE_TABLE } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';

interface Props {
  commandeId: string;
  livreeLe: string | null;
  receptionConfirmeeLe: string | null;
  /** Remonte la date de confirmation pour que l'écran se mette à jour sans recharger. */
  onConfirme: (horodatage: string) => void;
}

const jour = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Confirmation de réception — le geste sur lequel repose la garantie.
 *
 * Ce n'est pas une politesse : tant que le client n'a pas dit qu'il avait reçu
 * sa commande, l'argent d'un vendeur de la place de marché n'est pas reversé.
 * C'est ce qui permet de payer d'avance sans payer à l'aveugle, et c'est la
 * base qui l'applique — l'écran ne fait que le rendre visible.
 *
 * Le délai est affiché pour que l'engagement soit lisible des deux côtés : le
 * client sait jusqu'à quand il peut se manifester, et le vendeur sait quand il
 * sera payé même en face d'un acheteur silencieux.
 */
export default function ConfirmerReception({
  commandeId,
  livreeLe,
  receptionConfirmeeLe,
  onConfirme,
}: Props) {
  const [delaiJours, setDelaiJours] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (receptionConfirmeeLe) return;
    let vivant = true;
    supabase
      .from(PARAMETRES_GARANTIE_TABLE)
      .select('delai_confirmation_jours')
      .maybeSingle()
      .then(({ data }) => {
        if (vivant && data) setDelaiJours(data.delai_confirmation_jours as number);
      });
    return () => {
      vivant = false;
    };
  }, [receptionConfirmeeLe]);

  const confirmer = async () => {
    setEnvoi(true);
    setErreur(null);
    const { data, error } = await supabase.rpc('app_e08c374bc4_confirmer_reception', {
      p_commande: commandeId,
    });
    setEnvoi(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    onConfirme((data as string) ?? new Date().toISOString());
  };

  if (receptionConfirmeeLe) {
    return (
      <div className="flex items-start gap-2.5 rounded-md border border-primary/40 bg-primary/5 p-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 text-sm">
          <p className="font-medium text-foreground">
            Réception confirmée le {jour(receptionConfirmeeLe)}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            Merci. Le vendeur peut maintenant être réglé.
          </p>
        </div>
      </div>
    );
  }

  const limite =
    livreeLe && delaiJours !== null
      ? jour(new Date(new Date(livreeLe).getTime() + delaiJours * 86400000).toISOString())
      : null;

  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 text-sm">
          <p className="font-medium text-foreground">Avez-vous bien reçu votre commande ?</p>
          <p className="mt-0.5 text-muted-foreground">
            Votre règlement est retenu par MayLary Group tant que vous ne l'avez pas confirmé. Si
            quelque chose ne va pas, signalez-le nous avant de confirmer.
            {limite && ` Sans réponse de votre part, la commande sera considérée comme reçue le ${limite}.`}
          </p>
        </div>
      </div>

      {erreur && <p className="mt-2 text-sm text-destructive">{erreur}</p>}

      <Button size="sm" className="mt-3" onClick={confirmer} disabled={envoi}>
        {envoi ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
        J'ai bien reçu ma commande
      </Button>
    </div>
  );
}
