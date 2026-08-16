import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import PublicHeaderImport from '@/components/PublicHeaderImport';
import SiteFooter from '@/components/SiteFooter';
import FriseSuivi from '@/components/FriseSuivi';
import { useAuth } from '@/hooks/useAuth';
import {
  supabase,
  EXPEDITIONS_TABLE,
  STATUT_EXPEDITION_LABELS,
  type Expedition,
} from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PackageSearch } from 'lucide-react';

/**
 * Où sont mes marchandises.
 *
 * Le client n'a pas à savoir si son colis voyage sous un numéro DHL ou dans un
 * conteneur groupé : il veut une réponse à « où est ma marchandise ». Une seule
 * page, une frise par expédition, et la même exigence partout — on distingue ce
 * que le transporteur dit de ce que MayLary constate, et on ne comble jamais un
 * silence par une supposition.
 *
 * POURQUOI IL FAUT ÊTRE CONNECTÉ
 *
 * Un suivi ouvert à qui saisit un numéro dit à n'importe qui ce que quelqu'un
 * importe et quand ça arrive. C'est une information commerciale, parfois une
 * information de sécurité : on ne l'expose pas derrière un simple numéro.
 */
export default function MesExpeditions() {
  const { user, loading: authLoading } = useAuth();
  const [expeditions, setExpeditions] = useState<Expedition[] | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from(EXPEDITIONS_TABLE)
      .select('*')
      .order('maj_le', { ascending: false })
      .then(({ data }) => setExpeditions((data as Expedition[]) ?? []));
  }, [user]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/boutique/compte?retour=/mes-expeditions" replace />;

  /* Ce qui roule d'abord : une expédition livrée intéresse moins que celle qui
   * est en mer. On garde les livrées, plus bas — un client vérifie souvent une
   * livraison passée pour retrouver une date. */
  const enCours = (expeditions ?? []).filter(
    (e) => e.statut !== 'livree' && e.statut !== 'annulee',
  );
  const terminees = (expeditions ?? []).filter(
    (e) => e.statut === 'livree' || e.statut === 'annulee',
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeaderImport />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Où sont mes marchandises</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chaque étape est datée et sa source est nommée : ce que le transporteur relève, et ce que
          MayLary constate sur place.
        </p>

        {expeditions === null ? (
          <div className="mt-6 space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : expeditions.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed p-10 text-center">
            <PackageSearch className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium text-foreground">Aucune expédition en cours.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Dès qu’une de vos commandes ou demandes prend la route, elle apparaît ici.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {enCours.map((e) => (
              <section key={e.id} className="rounded-lg border bg-card p-4 sm:p-5">
                <FriseSuivi expedition={e} />
              </section>
            ))}

            {terminees.length > 0 && (
              <>
                <h2 className="pt-4 text-sm font-semibold text-muted-foreground">
                  Expéditions terminées
                </h2>
                {terminees.map((e) => (
                  <details key={e.id} className="rounded-lg border bg-card">
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-4 text-sm">
                      <span className="font-medium text-foreground">
                        {e.numero}
                        {e.designation ? ` — ${e.designation}` : ''}
                      </span>
                      <Badge variant="outline">{STATUT_EXPEDITION_LABELS[e.statut]}</Badge>
                    </summary>
                    <div className="border-t p-4 sm:p-5">
                      <FriseSuivi expedition={e} />
                    </div>
                  </details>
                ))}
              </>
            )}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
