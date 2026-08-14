import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, MessagesSquare } from 'lucide-react';

/**
 * Former Le Déclarant sans livrer de code.
 *
 * Une partie de la formation d'un assistant est du code : les outils qui lui
 * permettent de lire une commande, un dossier, une position tarifaire. Cette
 * part-là est faite une fois. L'autre partie est du langage — ce qu'on veut
 * lui voir dire, ce qu'on veut lui voir écarter, comment on veut qu'il tourne
 * une mauvaise nouvelle. Celle-là change souvent, et elle ne doit pas attendre
 * une livraison.
 *
 * Ce que l'on écrit ici s'ajoute à sa personnalité et prime sur elle. Ce qui
 * ne peut PAS être défait ici : l'interdiction de citer un taux, un montant ou
 * un délai de mémoire. Cette règle est dans le code, hors de portée du texte.
 */

const TABLE = 'app_e08c374bc4_parametres_classification';

export default function ConsigneDeclarantCard() {
  const [consigne, setConsigne] = useState('');
  const [initial, setInitial] = useState('');
  const [id, setId] = useState<string | number | null>(null);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    void supabase
      .from(TABLE)
      .select('id, consigne_complement')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const texte = (data?.consigne_complement as string) ?? '';
        setConsigne(texte);
        setInitial(texte);
        setId((data?.id as string | number) ?? null);
        setChargement(false);
      });
  }, []);

  const enregistrer = async () => {
    if (id === null) return;
    setEnvoi(true);
    const { error } = await supabase
      .from(TABLE)
      .update({ consigne_complement: consigne })
      .eq('id', id);
    setEnvoi(false);

    if (error) {
      toast.error("La consigne n'a pas pu être enregistrée.", { description: error.message });
      return;
    }
    setInitial(consigne);
    toast.success('Consigne enregistrée.', {
      description: 'Elle est prise en compte dès la prochaine question posée au Déclarant.',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessagesSquare className="h-5 w-5 text-primary" />
          <CardTitle>Former Le Déclarant</CardTitle>
        </div>
        <CardDescription>
          Ce texte s’ajoute à ce que l’assistant sait déjà et prime sur sa manière de
          répondre. Il est relu à chaque question — aucune mise en ligne n’est nécessaire.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {chargement ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : id === null ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Les paramètres de l’assistant ne sont pas encore initialisés en base.
          </p>
        ) : (
          <>
            <Textarea
              value={consigne}
              onChange={(e) => setConsigne(e.target.value)}
              rows={14}
              className="font-mono text-xs leading-relaxed"
              placeholder="Ce que Le Déclarant doit dire, écarter, ou proposer."
            />

            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Ce que ce texte ne peut pas changer.</strong> Le
              Déclarant ne citera jamais un taux de douane, un montant ou un délai réglementaire
              de mémoire : il interroge les moteurs, ou il dit qu’il ne peut pas confirmer.
              Cette règle est dans le code, pas dans ce champ — aucune consigne ne la lève.
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={enregistrer} disabled={envoi || consigne === initial}>
                {envoi && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer la consigne
              </Button>
              {consigne !== initial && (
                <button
                  type="button"
                  onClick={() => setConsigne(initial)}
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Annuler mes modifications
                </button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
