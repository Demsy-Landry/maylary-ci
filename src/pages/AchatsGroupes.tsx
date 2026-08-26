import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import ImageOuverture from '@/components/ImageOuverture';
import SiteFooter from '@/components/SiteFooter';
import ImageWithFallback from '@/components/ImageWithFallback';
import { useAuth } from '@/hooks/useAuth';
import {
  supabase,
  ACHATS_GROUPES_PUBLICS_VIEW,
  PARTICIPATIONS_ACHAT_GROUPE_TABLE,
  STATUT_ACHAT_GROUPE_LABELS,
  type AchatGroupePublic,
  type ParticipationAchatGroupe,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Clock, Loader2, PackageSearch, Check } from 'lucide-react';
import { toast } from 'sonner';

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

/** « dans 6 jours », « aujourd'hui » — une date brute ne dit pas l'urgence. */
function delaiRestant(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'terminé';
  const jours = Math.floor(ms / 86400000);
  if (jours >= 2) return `${jours} jours restants`;
  const heures = Math.floor(ms / 3600000);
  if (heures >= 2) return `${heures} heures restantes`;
  return 'dernière heure';
}

/**
 * Achats groupés — la seule offre de cette page qu'aucun concurrent ivoirien ne fait.
 *
 * Ce qui rend l'import cher à l'unité n'est pas la marchandise : ce sont les
 * frais qui ne dépendent pas de la quantité — police d'assurance, minimum de
 * taxation, forfait de dédouanement, part fixe du fret. Un acheteur seul les
 * paie en entier ; cinq acheteurs les divisent par cinq.
 *
 * On réserve sans payer, et c'est délibéré. Le montage habituel — payer puis
 * être remboursé d'une partie — violerait la règle de la maison (un prix ne
 * bouge jamais après paiement) et supposerait des remboursements Wave à la
 * main, un par client. Ici le prix est ferme dès la publication : si le seuil
 * est atteint, la réservation devient une commande à ce prix exactement ; sinon
 * personne n'a rien payé.
 */
export default function AchatsGroupes() {
  const { user } = useAuth();
  const [campagnes, setCampagnes] = useState<AchatGroupePublic[]>([]);
  const [miennes, setMiennes] = useState<Record<string, ParticipationAchatGroupe>>({});
  const [quantites, setQuantites] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const charger = async () => {
    const [cRes, pRes] = await Promise.all([
      supabase
        .from(ACHATS_GROUPES_PUBLICS_VIEW)
        .select('*')
        .order('statut', { ascending: true })
        .order('cloture_prevue_le', { ascending: true })
        // Page publique : sans plafond, une campagne populaire ferait
        // télécharger toute la table à chaque visiteur.
        .limit(120),
      user
        ? supabase.from(PARTICIPATIONS_ACHAT_GROUPE_TABLE).select('*')
        : Promise.resolve({ data: [] as ParticipationAchatGroupe[] }),
    ]);

    const liste = (cRes.data as AchatGroupePublic[]) ?? [];
    setCampagnes(liste);

    const mes: Record<string, ParticipationAchatGroupe> = {};
    for (const p of ((pRes.data ?? []) as ParticipationAchatGroupe[])) mes[p.campagne_id] = p;
    setMiennes(mes);

    setQuantites((q) => {
      const suite = { ...q };
      for (const c of liste) suite[c.id] ??= String(mes[c.id]?.quantite ?? 1);
      return suite;
    });
    setLoading(false);
  };

  useEffect(() => {
    charger();
    // `user` change à la connexion : les réservations personnelles suivent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const rejoindre = async (campagne: AchatGroupePublic) => {
    setBusy(campagne.id);
    const { error } = await supabase.rpc('app_e08c374bc4_rejoindre_achat_groupe', {
      p_campagne: campagne.id,
      p_quantite: Math.max(1, Math.round(Number(quantites[campagne.id] ?? 1))),
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Réservation enregistrée. Vous ne payez rien tant que l’objectif n’est pas atteint.');
    charger();
  };

  const quitter = async (campagne: AchatGroupePublic) => {
    setBusy(campagne.id);
    const { error } = await supabase.rpc('app_e08c374bc4_quitter_achat_groupe', {
      p_campagne: campagne.id,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Réservation retirée.');
    charger();
  };

  const ouvertes = useMemo(() => campagnes.filter((c) => c.statut === 'ouverte'), [campagnes]);
  const closes = useMemo(() => campagnes.filter((c) => c.statut !== 'ouverte'), [campagnes]);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      {/* L'entrepôt dit le service mieux qu'un titre : l'achat groupé, c'est
          du volume mis en commun. */}
      <section className="relative flex h-36 items-end overflow-hidden bg-foreground sm:h-44">
        <ImageOuverture
          src="/visuels/sourcing-entrepot.jpg"
          alt=""
          largeur={1168}
          hauteur={784}
          className="absolute inset-0 h-full w-full object-cover object-center opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/70 to-foreground/20" />
        <div className="relative mx-auto w-full max-w-[1600px] px-4 pb-4 sm:px-6">
          <p className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-primary">
            Acheter à plusieurs, au prix du gros
          </p>
        </div>
      </section>

      <main className="entree-page mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-extrabold text-foreground">Achats groupés</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Importer coûte cher à l’unité à cause de ce qui ne dépend pas de la quantité : assurance,
          minimum de taxation, dédouanement, part fixe du fret. À plusieurs sur la même référence,
          on les divise. <strong className="text-foreground">Vous réservez sans payer</strong> : si
          l’objectif est atteint avant la date limite, votre réservation devient une commande au
          prix annoncé — jamais un autre. Sinon, personne n’est débité.
        </p>

        {loading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72 w-full" />
            ))}
          </div>
        ) : campagnes.length === 0 ? (
          <div className="mt-8 rounded-md border border-dashed p-10 text-center">
            <PackageSearch className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun achat groupé en cours pour le moment. Dites-nous ce que vous cherchez : c’est
              souvent une demande de sourcing qui en fait naître un.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link to="/boutique/sourcing">Demander un article</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="cascade mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ouvertes.map((c) => {
                const mienne = miennes[c.id];
                const avance = Math.min(100, Math.round((c.quantite_reservee / c.quantite_objectif) * 100));
                const atteint = c.quantite_reservee >= c.quantite_objectif;
                return (
                  <article
                    key={c.id}
                    className="carte-reactive flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                      <ImageWithFallback
                        src={c.photos?.[0] ?? null}
                        alt={c.titre}
                        className="absolute inset-0 h-full w-full object-cover"
                        fallbackClassName="absolute inset-0 h-full w-full"
                      />
                      <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
                        −{fcfa(c.economie_unitaire_fcfa)} / unité
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-display font-bold text-foreground">{c.titre}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{c.reference_publique}</p>
                      </div>

                      <div>
                        <p className="text-xl font-bold text-primary">
                          {fcfa(c.prix_unitaire_groupe_fcfa)}
                          <span className="ml-2 text-sm font-normal text-muted-foreground line-through">
                            {fcfa(c.prix_unitaire_normal_fcfa)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">Prix rendu chez vous, tout compris.</p>
                      </div>

                      {/* La barre est l'argument : elle montre qu'il manque peu. */}
                      <div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${avance}%` }}
                          />
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {c.quantite_reservee} / {c.quantite_objectif} unités
                            {c.participants > 0 && ` · ${c.participants} acheteur${c.participants > 1 ? 's' : ''}`}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {delaiRestant(c.cloture_prevue_le)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-foreground">
                          {atteint
                            ? 'Objectif atteint — la commande partira.'
                            : `Il manque ${c.quantite_manquante} unité${c.quantite_manquante > 1 ? 's' : ''}.`}
                        </p>
                      </div>

                      <div className="mt-auto">
                        {!user ? (
                          <Button asChild className="w-full" variant="outline">
                            <Link to="/boutique/compte">Se connecter pour réserver</Link>
                          </Button>
                        ) : (
                          <div className="space-y-2">
                            {mienne && (
                              <p className="inline-flex items-center gap-1 text-xs font-medium text-primary-emphasis">
                                <Check className="h-3.5 w-3.5" />
                                Vous avez réservé {mienne.quantite} unité
                                {mienne.quantite > 1 ? 's' : ''}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                min={1}
                                max={c.quantite_max_par_client}
                                className="w-20"
                                aria-label="Quantité"
                                value={quantites[c.id] ?? '1'}
                                onChange={(e) =>
                                  setQuantites((q) => ({ ...q, [c.id]: e.target.value }))
                                }
                              />
                              <Button
                                className="flex-1"
                                onClick={() => rejoindre(c)}
                                disabled={busy === c.id}
                              >
                                {busy === c.id && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                                {mienne ? 'Modifier' : 'Réserver'}
                              </Button>
                            </div>
                            {mienne && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full"
                                onClick={() => quitter(c)}
                                disabled={busy === c.id}
                              >
                                Retirer ma réservation
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {closes.length > 0 && (
              <section className="mt-10">
                <h2 className="font-display text-lg font-bold text-foreground">Achats groupés clos</h2>
                <div className="mt-3 divide-y rounded-md border">
                  {closes.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{c.titre}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.reference_publique} · {c.quantite_reservee} / {c.quantite_objectif} unités
                          {miennes[c.id]?.commande_id && ' · votre commande a été créée'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={c.statut === 'reussie' ? 'default' : 'secondary'}>
                          {STATUT_ACHAT_GROUPE_LABELS[c.statut]}
                        </Badge>
                        {miennes[c.id]?.commande_id && (
                          <Button asChild size="sm" variant="outline">
                            <Link to="/boutique/mes-commandes">Voir ma commande</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
