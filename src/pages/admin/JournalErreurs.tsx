import { useEffect, useState } from 'react';
import {
  supabase,
  JOURNAL_ERREURS_TABLE,
  type ErreurJournalisee,
} from '@/lib/supabase';
import AdminNav from '@/components/AdminNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronRight, RefreshCw, ShieldAlert } from 'lucide-react';

/**
 * Les écrans qui se sont cassés chez les clients.
 *
 * POURQUOI CET ÉCRAN EXISTE
 *
 * Le fondateur a reçu « Cette page s'est arrêtée en chemin » sur son téléphone,
 * avec un code à nous communiquer. Ce code ne menait nulle part : il n'était
 * écrit que dans la console de son navigateur. Impossible de savoir quelle
 * page, quelle ligne, quel appareil.
 *
 * Une erreur de rendu vit entièrement dans le navigateur du visiteur. Aucun
 * journal d'hébergeur ne la voit. Sans cet écran, chaque page cassée reste une
 * devinette — et un client qui tombe sur une page morte referme l'onglet sans
 * jamais appeler.
 *
 * CE QU'ON REGARDE EN PREMIER
 *
 * Le nombre de fois qu'une même erreur revient, pas la dernière arrivée. Une
 * erreur vue une fois peut être une extension de navigateur ; la même vue
 * quarante fois est un défaut qui coûte des commandes.
 */

/** Regroupe par message : c'est le défaut qu'on compte, pas ses occurrences. */
interface Groupe {
  message: string;
  occurrences: ErreurJournalisee[];
  derniere: string;
  chemins: string[];
}

const grouper = (lignes: ErreurJournalisee[]): Groupe[] => {
  const par = new Map<string, ErreurJournalisee[]>();
  for (const l of lignes) {
    const cle = l.message;
    par.set(cle, [...(par.get(cle) ?? []), l]);
  }
  return [...par.entries()]
    .map(([message, occurrences]) => ({
      message,
      occurrences,
      derniere: occurrences[0].cree_le,
      chemins: [...new Set(occurrences.map((o) => o.chemin ?? '—'))],
    }))
    .sort((a, b) => b.occurrences.length - a.occurrences.length);
};

const quand = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

export default function JournalErreurs() {
  const [lignes, setLignes] = useState<ErreurJournalisee[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charger = async () => {
    setChargement(true);
    setEchec(null);
    const { data, error } = await supabase
      .from(JOURNAL_ERREURS_TABLE)
      .select('*')
      .order('cree_le', { ascending: false })
      .limit(500);
    /* Une requête qui échoue ne doit PAS s'afficher « aucun écran cassé ».
     * Sur cet écran plus qu'ailleurs : croire que tout va bien parce que la
     * lecture du journal est tombée, c'est exactement l'inverse du service
     * rendu. On dit que la lecture a échoué. */
    if (error) {
      setEchec(error.message);
      setLignes([]);
    } else {
      setLignes((data as ErreurJournalisee[]) ?? []);
    }
    setChargement(false);
  };

  useEffect(() => {
    charger();
  }, []);

  /* La recherche porte sur le CODE autant que sur le message : c'est le code
   * que le client lit au téléphone, et c'est par lui qu'on entre ici. */
  const terme = recherche.trim().toLowerCase();
  const filtrees = terme
    ? lignes.filter(
        (l) =>
          l.code.toLowerCase().includes(terme) ||
          l.message.toLowerCase().includes(terme) ||
          (l.chemin ?? '').toLowerCase().includes(terme),
      )
    : lignes;

  const groupes = grouper(filtrees);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-4 py-4 sm:px-6">
          <AdminNav />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-lg font-bold text-foreground">
              Admin — Écrans cassés chez les clients
            </h1>
            <Button variant="outline" size="sm" onClick={charger} disabled={chargement}>
              <RefreshCw className={'mr-1.5 h-4 w-4 ' + (chargement ? 'animate-spin' : '')} />
              Actualiser
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl space-y-4 px-4 py-8 sm:px-6">
        <Input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Code donné par le client (ex. 5NIA-5J36), message, ou adresse de page"
        />

        {chargement ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : echec ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-foreground">
              Le journal n’a pas pu être lu.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{echec}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Ce n’est pas « aucune erreur » : c’est « on ne sait pas ». Réessayez.
            </p>
          </div>
        ) : groupes.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">
              {terme ? 'Aucune erreur ne correspond.' : 'Aucun écran cassé enregistré.'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {terme
                ? 'Le code est peut-être antérieur à la mise en place du journal.'
                : 'C’est la bonne nouvelle : rien n’est tombé chez un client depuis la mise en place du journal.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {groupes.map((g) => {
              const estOuvert = ouvert === g.message;
              return (
                <div key={g.message} className="rounded-md border bg-card">
                  <button
                    type="button"
                    onClick={() => setOuvert(estOuvert ? null : g.message)}
                    className="flex w-full items-start gap-3 p-3 text-left hover:bg-muted/40"
                  >
                    {estOuvert ? (
                      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-medium text-foreground">
                        {g.message}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {g.chemins.slice(0, 3).join(' · ')}
                        {g.chemins.length > 3 ? ` · +${g.chemins.length - 3}` : ''} — dernière fois
                        le {quand(g.derniere)}
                      </span>
                    </span>
                    <Badge
                      variant={g.occurrences.length > 5 ? 'destructive' : 'secondary'}
                      className="shrink-0"
                    >
                      {g.occurrences.length}×
                    </Badge>
                  </button>

                  {estOuvert && (
                    <div className="space-y-3 border-t p-3">
                      {g.occurrences.slice(0, 10).map((o) => (
                        <div key={o.id} className="rounded border bg-muted/30 p-2.5 text-xs">
                          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <strong className="font-display tracking-widest text-foreground">
                              {o.code}
                            </strong>
                            <span className="text-muted-foreground">{quand(o.cree_le)}</span>
                            <span className="text-muted-foreground">{o.chemin ?? '—'}</span>
                            {o.utilisateur_id && (
                              <span className="text-muted-foreground">
                                compte {o.utilisateur_id.slice(0, 8)}
                              </span>
                            )}
                          </p>
                          {o.navigateur && (
                            <p className="mt-1 break-words text-[11px] text-muted-foreground">
                              {o.navigateur}
                            </p>
                          )}
                          {o.pile && (
                            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 text-[10px] leading-relaxed text-foreground">
                              {o.pile}
                            </pre>
                          )}
                          {o.composant && (
                            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 text-[10px] leading-relaxed text-muted-foreground">
                              {o.composant}
                            </pre>
                          )}
                        </div>
                      ))}
                      {g.occurrences.length > 10 && (
                        <p className="text-xs text-muted-foreground">
                          … et {g.occurrences.length - 10} autres occurrences identiques.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
