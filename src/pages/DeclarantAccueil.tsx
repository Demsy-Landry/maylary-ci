import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import NavDeclarant from '@/components/NavDeclarant';
import SiteFooter from '@/components/SiteFooter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useReferencement } from '@/hooks/useReferencement';
import {
  supabase,
  STORAGE_PUBLIC_URL,
  PRODUIT_PHOTOS_BUCKET,
  FORMULES_IA_TABLE,
  type FormuleIA,
} from '@/lib/supabase';
import {
  Search,
  Sparkles,
  Calculator,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  Scale,
  BookOpenCheck,
  Printer,
  History,
} from 'lucide-react';

/**
 * La vitrine du Déclarant.
 *
 * Directive du fondateur : « c'est un service à part entière, un produit à
 * valoriser », qui mérite sa page comme les autres — image, animation, et de
 * quoi comprendre avant d'essayer.
 *
 * Ce que cette page doit réussir, et qui est particulier à ce service : le
 * visiteur qui arrive ne sait pas forcément ce qu'est une position tarifaire.
 * On ne lui vend donc pas « un moteur TEC UEMOA » — on lui vend la question
 * qu'il se pose vraiment : « ça va me coûter combien à la douane ? »
 *
 * Le chiffre de 6 298 positions n'est pas décoratif non plus. C'est la preuve
 * que le service ne devine pas. Sur un marché où l'estimation approximative est
 * la norme, dire d'où vient le taux EST l'argument.
 */

const photo = (nom: string) => `${STORAGE_PUBLIC_URL}/${PRODUIT_PHOTOS_BUCKET}/accueil/${nom}`;

const FONCTIONS = [
  {
    icone: Search,
    titre: 'Trouver la position tarifaire',
    accroche: 'Six mille deux cent quatre-vingt-dix-huit codes, et le bon.',
    texte:
      "Décrivez la marchandise en français, ou entrez un code partiel. Le Déclarant cherche dans le Tarif Extérieur Commun de l'UEMOA et rend les positions candidates avec leur désignation officielle, leur taux de droit et leur unité statistique.",
    pour: 'Quand vous savez ce que vous importez mais pas sous quel code il tombe.',
  },
  {
    icone: Sparkles,
    titre: 'Classer une marchandise',
    accroche: 'Le raisonnement, pas seulement la réponse.',
    texte:
      "Décrivez l'article, ses matières, son usage. Le Déclarant propose un classement en remontant les Règles Générales Interprétatives — section, chapitre, position, sous-position — et vérifie le code obtenu dans le corpus officiel avant de vous le donner.",
    pour: 'Quand la marchandise est ambiguë et que le classement se discute.',
  },
  {
    icone: Calculator,
    titre: 'Calculer les droits et taxes',
    accroche: 'Le montant exact, poste par poste.',
    texte:
      "Saisissez vos lignes, le fret, l'assurance et le régime douanier. Le Déclarant liquide : droit de douane, redevance statistique, prélèvements communautaires, TVA — chacun sur sa propre assiette. Le bulletin s'imprime.",
    pour: 'Quand il faut annoncer un chiffre à un client, ou vérifier une facture.',
  },
];

const GARANTIES = [
  {
    icone: BookOpenCheck,
    titre: 'Aucun taux inventé',
    texte:
      "Les taux viennent du corpus TEC UEMOA chargé en base. Si un code n'y figure pas, le Déclarant le dit — il ne comble jamais un trou par une estimation.",
  },
  {
    icone: Scale,
    titre: 'Chaque taxe sur son assiette',
    texte:
      "La TVA se calcule sur la valeur en douane augmentée des droits et de la redevance statistique — jamais sur les prélèvements communautaires. C'est cette nuance qui fausse la plupart des calculs faits à la main.",
  },
  {
    icone: Printer,
    titre: 'Un bulletin imprimable',
    texte:
      "Le détail de la liquidation, ligne par ligne, avec l'en-tête de votre dossier. À joindre au dossier ou à présenter au client.",
  },
  {
    icone: History,
    titre: 'Tout est conservé',
    texte:
      'Classifications et liquidations restent dans votre historique, avec leur résultat tel qu’il a été calculé. Une archive ne se recalcule pas : les taux changent, elle non.',
  },
];

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export default function DeclarantAccueil() {
  useReferencement({
    titre: "Le Déclarant — position tarifaire et calcul des droits de douane",
    description:
      "Trouvez la position tarifaire d'une marchandise dans le Tarif Extérieur Commun UEMOA et calculez les droits et taxes exigibles. Un outil de préparation : la déclaration en détail reste signée par un commissionnaire agréé.",
  });

  const [formules, setFormules] = useState<FormuleIA[] | null>(null);

  useEffect(() => {
    void supabase
      .from(FORMULES_IA_TABLE)
      .select('*')
      .eq('actif', true)
      .order('ordre')
      .then(({ data }) => setFormules((data as FormuleIA[]) ?? []));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <NavDeclarant />

      {/* ---------- Ouverture ---------- */}
      <section className="relative flex min-h-[24rem] items-center overflow-hidden bg-foreground sm:min-h-[30rem]">
        <img
          src={photo('service-importer.jpg')}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full scale-105 object-cover object-center opacity-80 motion-safe:animate-[respiration_26s_ease-in-out_infinite]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground via-foreground/88 to-foreground/45" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />

        <div className="relative mx-auto w-full max-w-screen-xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="rideau max-w-2xl">
            <p className="flex items-center gap-2 font-display text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-primary sm:text-xs">
              <ShieldCheck className="h-4 w-4" />
              Le Déclarant — Tarif et liquidation douanière
            </p>
            <h1 className="mt-4 font-display text-[2.2rem] font-extrabold leading-[1.02] tracking-tight text-white sm:text-6xl">
              Combien la douane
              <span className="mt-1 block bg-gradient-to-r from-primary via-amber-300 to-primary bg-clip-text text-transparent">
                va vous coûter, exactement.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
              Trouvez la position tarifaire, faites classer une marchandise, calculez les droits et
              taxes. Les taux viennent du Tarif Extérieur Commun officiel — pas d’une estimation.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="bouton-anime">
                <Link to="/declarant/atelier">
                  Ouvrir l’atelier
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="bouton-anime">
                <Link to="/declarant/abonnement">Voir les formules</Link>
              </Button>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-2 text-sm text-white/75">
              <span className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-primary" />
                <span className="tabular-nums">6 298 positions tarifaires officielles</span>
              </span>
              <span className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                81 régimes douaniers
              </span>
            </div>
          </div>
        </div>
      </section>

      <main className="entree-page mx-auto max-w-screen-xl px-4 py-14 sm:px-6">
        {/* ---------- Les trois fonctions ---------- */}
        <section data-revele>
          <h2 className="trait-anime font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Trois fonctions, qui se passent la main
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            On cherche un code, on le fait vérifier, on liquide. Chaque étape reprend le résultat de
            la précédente — vous ne ressaisissez rien.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-3" data-revele-cascade>
            {FONCTIONS.map((f, i) => {
              const Icone = f.icone;
              return (
                <article
                  key={f.titre}
                  className="carte-reactive reflet flex flex-col rounded-xl border bg-card p-6"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                      <Icone className="h-5 w-5 text-primary" />
                    </span>
                    <span className="font-display text-xs font-bold tabular-nums text-muted-foreground">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold leading-snug text-foreground">
                    {f.titre}
                  </h3>
                  <p className="mt-1 font-display text-sm font-semibold text-primary-emphasis">
                    {f.accroche}
                  </p>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{f.texte}</p>
                  <p className="mt-4 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">Utile quand : </span>
                    {f.pour}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ---------- Ce qui distingue le service ---------- */}
        <section className="mt-16" data-revele>
          <h2 className="trait-anime font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Pourquoi le chiffre est juste
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2" data-revele-cascade>
            {GARANTIES.map((g) => {
              const Icone = g.icone;
              return (
                <div key={g.titre} className="flex gap-4">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icone className="h-4 w-4 text-primary" />
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-foreground">{g.titre}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{g.texte}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------- Les formules ---------- */}
        <section className="mt-16" data-revele>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="trait-anime font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Les formules
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Le nombre de requêtes par jour est ce qui change. Les fonctions, elles, sont les
                mêmes pour tous.
              </p>
            </div>
            <Button asChild variant="outline" className="bouton-anime">
              <Link to="/declarant/abonnement">Comparer en détail</Link>
            </Button>
          </div>

          {formules === null ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-56 w-full" />
              ))}
            </div>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-3" data-revele-cascade>
              {formules.map((f, i) => (
                <div
                  key={f.code}
                  className={`carte-reactive reflet flex flex-col rounded-xl border p-6 ${
                    i === 1 ? 'border-primary/50 bg-primary/5' : 'bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-foreground">{f.libelle}</h3>
                    {i === 1 && (
                      <Badge variant="outline" className="border-primary text-primary-emphasis">
                        Le plus courant
                      </Badge>
                    )}
                  </div>

                  {/* Un prix à zéro n'est pas « gratuit » : c'est un prix qui
                      n'a pas encore été fixé. On ne l'affiche donc pas comme
                      une offre — sauf pour la formule d'entrée, qui l'est. */}
                  <p className="mt-3 font-display text-2xl font-extrabold tabular-nums text-foreground">
                    {f.prix_mensuel_fcfa > 0 ? (
                      <>
                        {fcfa(f.prix_mensuel_fcfa)}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">/ mois</span>
                      </>
                    ) : i === 0 ? (
                      'Gratuit'
                    ) : (
                      <span className="text-base font-semibold text-muted-foreground">
                        Tarif à venir
                      </span>
                    )}
                  </p>

                  <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                    {f.requetes_par_jour} requête{f.requetes_par_jour > 1 ? 's' : ''} par jour
                  </p>

                  {f.avantages?.length ? (
                    <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted-foreground">
                      {f.avantages.map((a) => (
                        <li key={a} className="flex gap-2">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex-1" />
                  )}

                  <Button asChild variant={i === 1 ? 'default' : 'outline'} className="bouton-anime mt-5">
                    <Link to="/declarant/abonnement">Choisir</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---------- Appel ---------- */}
        <section
          className="carte-reactive mt-16 overflow-hidden rounded-xl border bg-muted/40 p-6 sm:p-8"
          data-revele
        >
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="max-w-xl">
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Essayez sur une marchandise que vous connaissez
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                C’est la seule façon de juger un outil de tarif : prenez un article dont vous
                connaissez déjà le taux, et regardez si le chiffre tombe juste.
              </p>
            </div>
            <Button asChild size="lg" className="bouton-anime">
              <Link to="/declarant/atelier">
                Ouvrir l’atelier
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
