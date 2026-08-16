import { useEffect, useState } from 'react';
import {
  supabase,
  EXPEDITION_EVENEMENTS_TABLE,
  ETAPES_EXPEDITION,
  STATUT_EXPEDITION_LABELS,
  MODE_EXPEDITION_LABELS,
  type Expedition,
  type EvenementExpedition,
} from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Ship, Plane, Truck, Zap, Building2, Radio, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';

/**
 * La frise d'une expédition.
 *
 * UNE SEULE FRISE, TROIS SOURCES
 *
 * Dans le métier de MayLary, l'essentiel du trajet n'est PAS suivi par une API.
 * Le petit colis express a un numéro de suivi ; le conteneur en groupage n'en a
 * pas, et le dédouanement encore moins. Une frise qui n'afficherait que ce
 * qu'un transporteur renvoie serait vide pendant les trois quarts du voyage —
 * exactement les moments où le client s'inquiète.
 *
 * Elle mêle donc les relevés du transporteur et les étapes notées par MayLary,
 * dans le même fil, par ordre chronologique.
 *
 * MAIS ELLE DIT TOUJOURS QUI PARLE
 *
 * Chaque ligne porte sa source. « Le transporteur dit » et « MayLary dit »
 * n'engagent pas de la même façon, et le client doit pouvoir faire la
 * différence sans nous croire sur parole. C'est la même exigence que sur le
 * tarif douanier : on nomme ce qui est vérifié.
 *
 * ET QUAND PERSONNE NE PARLE
 *
 * Si le transporteur est muet depuis plusieurs jours, la frise le DIT. Elle
 * n'invente pas une position intermédiaire pour rassurer. Un client qui
 * organise sa trésorerie sur une position devinée le paie deux fois.
 */

const ICONES_MODE = { maritime: Ship, aerien: Plane, routier: Truck, express: Zap } as const;

const jour = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Le nombre de jours pleins écoulés depuis une date. */
const joursDepuis = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

interface Props {
  expedition: Expedition;
  /** Rafraîchi de l'extérieur après une note ou une relève. */
  cle?: number;
  /**
   * Événements fournis par l'appelant, quand il les a déjà.
   *
   * Une liste de dix expéditions qui laisserait chaque frise chercher les
   * siennes ferait dix allers-retours là où un seul suffit. Absent, la frise
   * se débrouille — c'est le cas le plus courant.
   */
  evenements?: EvenementExpedition[];
}

export default function FriseSuivi({ expedition, cle, evenements: fournis }: Props) {
  const [charges, setCharges] = useState<EvenementExpedition[] | null>(null);
  const evenements = fournis ?? charges;

  useEffect(() => {
    if (fournis) return;
    let annule = false;
    supabase
      .from(EXPEDITION_EVENEMENTS_TABLE)
      .select('*')
      .eq('expedition_id', expedition.id)
      .order('survenu_le', { ascending: false })
      .then(({ data }) => {
        if (!annule) setCharges((data as EvenementExpedition[]) ?? []);
      });
    return () => {
      annule = true;
    };
  }, [expedition.id, cle, fournis]);

  const IconeMode = ICONES_MODE[expedition.mode] ?? Ship;
  const rangActuel = ETAPES_EXPEDITION.findIndex((e) => e.code === expedition.statut);
  const enIncident = expedition.statut === 'incident';

  /* Le silence du transporteur est une information, pas un vide à masquer. On
   * ne le signale qu'au-delà de trois jours : un colis n'est pas scanné toutes
   * les heures, et alerter trop tôt userait l'attention du client. */
  const silence =
    expedition.numero_suivi && expedition.derniere_reponse_le
      ? joursDepuis(expedition.derniere_reponse_le)
      : null;
  const muet = silence !== null && silence >= 3 && expedition.statut !== 'livree';

  return (
    <div className="space-y-4">
      {/* ---------- L'en-tête ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display font-bold text-foreground">
            <IconeMode className="h-4 w-4 shrink-0 text-primary" />
            {expedition.numero}
          </p>
          {expedition.designation && (
            <p className="mt-0.5 text-sm text-muted-foreground">{expedition.designation}</p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{MODE_EXPEDITION_LABELS[expedition.mode]}</span>
            {expedition.transporteur && <span>{expedition.transporteur}</span>}
            {expedition.numero_suivi && (
              <span className="font-mono tabular-nums">{expedition.numero_suivi}</span>
            )}
          </p>
        </div>
        <Badge variant={enIncident ? 'destructive' : expedition.statut === 'livree' ? 'default' : 'secondary'}>
          {STATUT_EXPEDITION_LABELS[expedition.statut]}
        </Badge>
      </div>

      {/* ---------- La progression ---------- */}
      {!enIncident && expedition.statut !== 'annulee' && (
        <ol className="flex gap-1">
          {ETAPES_EXPEDITION.map((etape, i) => {
            const atteinte = rangActuel >= 0 && i <= rangActuel;
            return (
              <li key={etape.code} className="flex-1">
                <span
                  className={
                    'block h-1.5 rounded-full ' + (atteinte ? 'bg-primary' : 'bg-muted')
                  }
                  aria-hidden
                />
                <span
                  className={
                    'mt-1.5 block text-[10px] leading-tight ' +
                    (atteinte ? 'font-medium text-foreground' : 'text-muted-foreground')
                  }
                >
                  {etape.libelle}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* ---------- La date annoncée, si le transporteur en donne une ---------- */}
      {expedition.eta && expedition.statut !== 'livree' && (
        <p className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Arrivée annoncée par le transporteur : <strong className="text-foreground">{jour(expedition.eta)}</strong>
        </p>
      )}

      {/* ---------- Le silence, dit franchement ---------- */}
      {muet && (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-400/50 bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Pas de nouvelle du transporteur depuis {silence} jours. Ce n’est pas
            forcément mauvais signe — un colis n’est pas scanné en mer — mais nous
            préférons vous le dire plutôt que d’afficher une position supposée.
          </span>
        </p>
      )}

      {expedition.releve_erreur && (
        <p className="rounded-md border border-amber-400/50 bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-900">
          Dernière interrogation du transporteur sans réponse exploitable :{' '}
          {expedition.releve_erreur}
        </p>
      )}

      {/* ---------- Le fil ---------- */}
      {evenements === null ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : evenements.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Aucune étape enregistrée pour l’instant.
        </p>
      ) : (
        <ol className="space-y-0">
          {evenements.map((e, i) => {
            const duTransporteur = e.source === 'transporteur';
            const dernier = i === evenements.length - 1;
            return (
              <li key={e.id} className="flex gap-3">
                {/* La colonne du fil : pastille + trait de liaison. */}
                <div className="flex flex-col items-center">
                  <span
                    className={
                      'mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ' +
                      (i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')
                    }
                  >
                    {i === 0 ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : duTransporteur ? (
                      <Radio className="h-3 w-3" />
                    ) : (
                      <Building2 className="h-3 w-3" />
                    )}
                  </span>
                  {!dernier && <span className="w-px flex-1 bg-border" aria-hidden />}
                </div>

                <div className={'min-w-0 flex-1 ' + (dernier ? 'pb-0' : 'pb-4')}>
                  <p className="text-sm font-medium text-foreground">{e.libelle}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span>
                      {jour(e.survenu_le)} à {heure(e.survenu_le)}
                    </span>
                    {e.lieu && <span>· {e.lieu}</span>}
                    {/* La source, jamais implicite. */}
                    <span className={duTransporteur ? 'text-muted-foreground' : 'text-primary-emphasis'}>
                      · {duTransporteur ? 'relevé chez le transporteur' : 'constaté par MayLary'}
                    </span>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
