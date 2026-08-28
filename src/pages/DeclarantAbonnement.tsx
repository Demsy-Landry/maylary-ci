import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import NavDeclarant from '@/components/NavDeclarant';
import SiteFooter from '@/components/SiteFooter';
import {
  supabase,
  FORMULES_IA_TABLE,
  type FormuleIA,
  type TableauDeBordDeclarant,
} from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Gauge, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { useReferencement } from '@/hooks/useReferencement';

/**
 * Les formules du Déclarant.
 *
 * Deux règles tiennent cet écran, et elles ne sont pas négociables :
 *
 * **On n'invente pas un prix.** Tant que le fondateur n'a pas arrêté le tarif
 * d'une formule, l'écran dit « tarif à venir » et propose de le demander. Un
 * montant inventé sur une page publique devient un engagement commercial dès
 * que quelqu'un le lit.
 *
 * **On n'invente pas non plus un moyen de payer.** Il n'y a pas encore de
 * paiement en ligne pour l'abonnement : le bouton ouvre une demande, il ne
 * simule pas une souscription. Un bouton « S'abonner » qui ne débite rien et
 * n'ouvre aucun droit serait un mensonge poli.
 *
 * Ce qui EST vrai et affiché : le plafond quotidien de chaque formule, les
 * avantages tels qu'ils sont en base, et la formule dont le compte bénéficie
 * réellement aujourd'hui.
 */

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

const CONTACT = 'yaolandry67@gmail.com';
const lienDemande = (f: FormuleIA) =>
  `mailto:${CONTACT}?subject=${encodeURIComponent(
    `Le Déclarant — formule ${f.libelle}`,
  )}&body=${encodeURIComponent(
    `Bonjour,\n\nJe souhaite souscrire à la formule ${f.libelle} du Déclarant (${f.requetes_par_jour} requêtes par jour).\n\nMerci de me communiquer les modalités.\n`,
  )}`;

export default function DeclarantAbonnement() {
  useReferencement({
    titre: "Formules d'abonnement au Déclarant",
    description:
      "Les formules d'accès aux outils douaniers de MayLary Group et ce que chacune permet : nombre de classements, de liquidations et de questions à l'assistant.",
  });

  const { user, loading: authLoading } = useAuth();
  const [formules, setFormules] = useState<FormuleIA[] | null>(null);
  const [tb, setTb] = useState<TableauDeBordDeclarant | null>(null);

  useEffect(() => {
    void supabase
      .from(FORMULES_IA_TABLE)
      .select('*')
      .eq('actif', true)
      .order('ordre')
      .then(({ data }) => setFormules((data as FormuleIA[]) ?? []));
  }, []);

  useEffect(() => {
    if (!user) return;
    void supabase
      .rpc('app_e08c374bc4_declarant_tableau_de_bord')
      .then(({ data }) => setTb((data as TableauDeBordDeclarant) ?? null));
  }, [user]);

  const codeActuel = tb?.formule.code ?? null;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <NavDeclarant />

      <main className="entree-page mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <h1 className="trait-anime font-display text-2xl font-extrabold text-foreground">
          Abonnement
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Le plafond est quotidien et se remet à zéro chaque jour. Il porte sur les requêtes
          assistées — la recherche au tarif et le calcul des droits restent libres.
        </p>

        {/* Là où en est ce compte, avant de parler de ce qu'il pourrait prendre. */}
        {authLoading || (user && !tb) ? (
          <Skeleton className="mt-6 h-24 w-full" />
        ) : !user ? (
          <div className="carte-reactive mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Connectez-vous pour voir la formule dont vous bénéficiez et ce qu’il vous reste
              aujourd’hui.
            </p>
            <Button asChild className="bouton-anime">
              <Link to="/boutique/compte?retour=/declarant/abonnement">Se connecter</Link>
            </Button>
          </div>
        ) : (
          tb && (
            <section
              className="carte-reactive mt-6 rounded-xl border border-primary/40 bg-primary/5 p-5"
              data-revele
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Votre formule
                  </p>
                  <p className="mt-1 font-display text-xl font-extrabold text-foreground">
                    {tb.formule.libelle}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {tb.formule.abonnement_actif
                      ? 'Abonnement actif.'
                      : 'Formule d’entrée, sans abonnement.'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Aujourd’hui</p>
                  <p className="font-display text-xl font-extrabold tabular-nums text-foreground">
                    {tb.aujourdhui.restant} / {tb.aujourdhui.plafond}
                  </p>
                  <p className="text-xs text-muted-foreground">requêtes restantes</p>
                </div>
              </div>
            </section>
          )
        )}

        {/* Les formules. */}
        {formules === null ? (
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72 w-full" />
            ))}
          </div>
        ) : (
          <div className="cascade mt-8 grid gap-4 md:grid-cols-3">
            {formules.map((f, i) => {
              const actuelle = f.code === codeActuel;
              // Le premier palier est la formule d'entrée : à zéro franc, elle
              // est réellement gratuite. Au-delà, zéro veut dire « pas encore
              // fixé », et on le dit plutôt que de laisser croire à la gratuité.
              const entree = i === 0;
              const tarifConnu = f.prix_mensuel_fcfa > 0;

              return (
                <div
                  key={f.code}
                  className={
                    'carte-reactive reflet flex flex-col rounded-2xl border p-6 ' +
                    (actuelle ? 'border-primary bg-primary/5 shadow-sm' : 'bg-card')
                  }
                  data-revele
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-lg font-extrabold text-foreground">
                      {f.libelle}
                    </h2>
                    {actuelle && <Badge className="shrink-0">Votre formule</Badge>}
                  </div>

                  <p className="mt-4 font-display text-2xl font-extrabold tabular-nums text-foreground">
                    {tarifConnu ? (
                      <>
                        {fcfa(f.prix_mensuel_fcfa)}
                        <span className="ml-1 text-sm font-medium text-muted-foreground">
                          / mois
                        </span>
                      </>
                    ) : entree ? (
                      'Gratuit'
                    ) : (
                      <span className="text-base font-bold text-muted-foreground">
                        Tarif à venir
                      </span>
                    )}
                  </p>

                  <p className="mt-3 flex items-center gap-1.5 text-sm text-foreground">
                    <Gauge className="h-4 w-4 text-primary" />
                    <span className="font-semibold tabular-nums">{f.requetes_par_jour}</span>
                    requête{f.requetes_par_jour > 1 ? 's' : ''} assistée
                    {f.requetes_par_jour > 1 ? 's' : ''} par jour
                  </p>

                  {f.avantages && f.avantages.length > 0 && (
                    <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                      {f.avantages.map((a) => (
                        <li key={a} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-6 flex-1" />

                  {actuelle ? (
                    <Button asChild variant="outline" className="bouton-anime w-full">
                      <Link to="/declarant/atelier">
                        Ouvrir l’atelier
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : entree && !tarifConnu ? (
                    <Button asChild variant="outline" className="bouton-anime w-full">
                      <Link to="/declarant/atelier">Essayer maintenant</Link>
                    </Button>
                  ) : (
                    <Button asChild className="bouton-anime w-full">
                      <a href={lienDemande(f)}>
                        <Mail className="mr-2 h-4 w-4" />
                        {tarifConnu ? 'Souscrire' : 'Demander le tarif'}
                      </a>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <section className="mt-10 grid gap-4 sm:grid-cols-2" data-revele>
          <div className="rounded-xl border bg-muted/30 p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Ce que consomme une requête
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Seule la classification assistée décompte : c’est elle qui fait travailler le modèle.
              La recherche d’une position au tarif, la vérification d’un code et le calcul des
              droits et taxes ne consomment rien et restent disponibles sans limite.
            </p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-5">
            <h2 className="font-display text-base font-bold text-foreground">
              Souscription et facturation
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Le paiement en ligne de l’abonnement n’est pas encore ouvert. La souscription se fait
              de la main à la main, avec une facture au nom de votre société. Écrivez-nous et la
              formule est activée sur votre compte.
            </p>
            <a
              href={`mailto:${CONTACT}?subject=${encodeURIComponent('Le Déclarant — abonnement')}`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Mail className="h-4 w-4" />
              {CONTACT}
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
