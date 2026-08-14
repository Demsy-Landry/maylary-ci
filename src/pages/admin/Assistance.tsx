import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import AdminNav from '@/components/AdminNav';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, LifeBuoy, AlertTriangle } from 'lucide-react';

/**
 * Les demandes que Le Déclarant n'a pas su résoudre.
 *
 * Un assistant qui dit « je transmets à l'équipe » sans que personne ne voie
 * rien arriver ment au client, poliment. Cet écran est l'autre bout du fil :
 * tout ce que l'assistant transmet atterrit ici, avec ce qu'il avait déjà
 * vérifié, pour que la réponse humaine ne reparte pas de zéro.
 *
 * Le délai annoncé au client est de vingt-quatre heures ouvrées. Il est écrit
 * dans la fonction qui ouvre la demande, pas dans une promesse commerciale :
 * c'est donc un délai qu'on peut mesurer, et manquer visiblement.
 */

const TABLE = 'app_e08c374bc4_demandes_assistance';

interface Demande {
  id: string;
  reference_liee: string | null;
  sujet: string;
  message: string;
  urgence: 'normale' | 'bloquante';
  statut: 'ouverte' | 'en_cours' | 'resolue' | 'close';
  resume_assistant: string | null;
  reponse: string | null;
  created_at: string;
  traite_le: string | null;
}

const STATUTS: Record<Demande['statut'], string> = {
  ouverte: 'À traiter',
  en_cours: 'En cours',
  resolue: 'Résolue',
  close: 'Close',
};

const quand = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

/** Heures écoulées depuis l'ouverture — le seul chiffre qui compte ici. */
const depuis = (iso: string) => {
  const heures = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (heures < 1) return "à l'instant";
  if (heures < 24) return `il y a ${heures} h`;
  return `il y a ${Math.floor(heures / 24)} j`;
};

export default function AdminAssistance() {
  const [demandes, setDemandes] = useState<Demande[] | null>(null);
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [voirCloses, setVoirCloses] = useState(false);

  const charger = useCallback(async () => {
    let q = supabase.from(TABLE).select('*').order('created_at', { ascending: false }).limit(100);
    if (!voirCloses) q = q.in('statut', ['ouverte', 'en_cours']);
    const { data, error } = await q;
    if (error) {
      toast.error('Lecture impossible.', { description: error.message });
      setDemandes([]);
      return;
    }
    setDemandes((data as Demande[]) ?? []);
  }, [voirCloses]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const repondre = async (d: Demande, statut: Demande['statut']) => {
    const texte = (reponses[d.id] ?? '').trim();
    setEnvoi(d.id);
    const { data: session } = await supabase.auth.getUser();
    const { error } = await supabase
      .from(TABLE)
      .update({
        statut,
        reponse: texte || d.reponse,
        traite_le: new Date().toISOString(),
        traite_par: session.user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', d.id);
    setEnvoi(null);

    if (error) {
      toast.error("La demande n'a pas pu être mise à jour.", { description: error.message });
      return;
    }
    toast.success(`Demande marquée « ${STATUTS[statut]} ».`);
    void charger();
  };

  const enRetard = (d: Demande) =>
    d.statut === 'ouverte' && Date.now() - new Date(d.created_at).getTime() > 24 * 3_600_000;

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />

      <main className="mx-auto max-w-screen-lg space-y-6 px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-primary" />
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Assistance client
              </h1>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Ce que Le Déclarant n’a pas pu résoudre seul. Délai annoncé au client :
              24 heures ouvrées.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setVoirCloses((v) => !v)}>
            {voirCloses ? 'Voir seulement les demandes actives' : 'Voir aussi les demandes closes'}
          </Button>
        </header>

        {demandes === null ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : demandes.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                Aucune demande en attente. Le Déclarant a répondu seul à tout ce qui lui a été
                posé — ou personne ne lui a encore rien demandé.
              </p>
            </CardContent>
          </Card>
        ) : (
          demandes.map((d) => (
            <Card key={d.id} className={enRetard(d) ? 'border-destructive/50' : undefined}>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-bold text-foreground">{d.sujet}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {quand(d.created_at)} — {depuis(d.created_at)}
                      {d.reference_liee && ` · dossier ${d.reference_liee}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {enRetard(d) && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Délai dépassé
                      </Badge>
                    )}
                    {d.urgence === 'bloquante' && <Badge variant="destructive">Bloquante</Badge>}
                    <Badge variant="secondary">{STATUTS[d.statut]}</Badge>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Le client écrit
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {d.message}
                  </p>
                </div>

                {d.resume_assistant && (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Ce que Le Déclarant a déjà vérifié
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {d.resume_assistant}
                    </p>
                  </div>
                )}

                {d.reponse && (
                  <div className="rounded-md border p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Réponse apportée {d.traite_le && `le ${quand(d.traite_le)}`}
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {d.reponse}
                    </p>
                  </div>
                )}

                {d.statut !== 'close' && (
                  <>
                    <Textarea
                      rows={3}
                      value={reponses[d.id] ?? ''}
                      onChange={(e) => setReponses((r) => ({ ...r, [d.id]: e.target.value }))}
                      placeholder="Ce qui a été répondu au client, et par quel canal."
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={envoi === d.id} onClick={() => void repondre(d, 'resolue')}>
                        {envoi === d.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Marquer résolue
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={envoi === d.id}
                        onClick={() => void repondre(d, 'en_cours')}
                      >
                        Je m’en occupe
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={envoi === d.id}
                        onClick={() => void repondre(d, 'close')}
                      >
                        Clore sans suite
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
