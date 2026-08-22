import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeaderPro from '@/components/PublicHeaderPro';
import SiteFooter from '@/components/SiteFooter';
import ImageOuverture from '@/components/ImageOuverture';
import { supabase, SECTEURS_TABLE, type Secteur } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import SectorIllustration, { SECTOR_PHOTOS, guessSector } from '@/components/illustrations/SectorIllustration';
import CarrouselSecteur from '@/components/CarrouselSecteur';
import {
  ArrowRight,
  FileText,
  FolderCheck,
  Layers,
  PackageSearch,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

/**
 * L'Espace Pro.
 *
 * Directive du fondateur : « L'espace pro doit avoir un style pro, encore plus
 * beau et dynamique que les pages grand public et boutique. »
 *
 * La différence ne se joue pas sur la décoration — un acheteur professionnel
 * n'est pas impressionné par des dégradés. Elle se joue sur ce que la page
 * affirme et sur la façon dont elle est tenue :
 *
 *  - **Une ouverture éditoriale, sombre, avec un chiffre.** Le grand public
 *    ouvre sur une promesse ; le professionnel ouvre sur une capacité. Le
 *    nombre de rayons est lu en base, jamais écrit en dur : une page qui
 *    annonce « 16 rayons » quand il y en a 12 se disqualifie au premier coup
 *    d'œil de quelqu'un qui compte.
 *  - **Quatre engagements**, dits en une ligne chacun, sans superlatif. Ce
 *    sont exactement les quatre choses que la maison exécute et qu'un acheteur
 *    vérifie : le devis chiffré, le prix rendu, le dossier documenté,
 *    l'interlocuteur unique.
 *  - **Des cartes de rayon plus grandes et plus calmes** que celles de la
 *    boutique, avec le zoom lent et le reflet au survol. Le mouvement dit le
 *    soin ; l'espace dit le sérieux.
 */

const ENGAGEMENTS = [
  {
    icone: FileText,
    titre: 'Un devis chiffré, pas une fourchette',
    texte:
      'Marchandise, fret, assurance, droits de douane et livraison, poste par poste. Ce qui n’est pas connu est annoncé comme tel — jamais comblé par une estimation.',
  },
  {
    icone: ShieldCheck,
    titre: 'Le prix rendu Abidjan',
    texte:
      'Droits et taxes compris dans le chiffre annoncé. Personne ne vous rappelle pour un supplément à l’arrivée.',
  },
  {
    icone: FolderCheck,
    titre: 'Un dossier numéroté et documenté',
    texte:
      'FDI, RFCV, certificat d’origine, BSC : chaque pièce est suivie jusqu’au bordereau de livraison. Un dossier ne se clôt pas s’il en manque une.',
  },
  {
    icone: UserCheck,
    titre: 'Un seul interlocuteur',
    texte:
      'Du fournisseur à votre entrepôt. Vous ne courez pas derrière trois prestataires qui se renvoient la responsabilité.',
  },
];

export default function CataloguePro() {
  const [secteurs, setSecteurs] = useState<Secteur[] | null>(null);

  useEffect(() => {
    void supabase
      .from(SECTEURS_TABLE)
      .select('*')
      .eq('actif', true)
      .order('ordre_affichage')
      .then(({ data }) => setSecteurs((data as Secteur[]) ?? []));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderPro />

      {/* ---------- Ouverture ---------- */}
      <section className="relative flex min-h-[22rem] items-center overflow-hidden bg-foreground sm:min-h-[26rem]">
        <ImageOuverture
          src="/visuels/sourcing-entrepot.jpg"
          alt=""
          largeur={784}
          hauteur={580}
          className="absolute inset-0 h-full w-full scale-105 object-cover object-[70%_center] opacity-70 motion-safe:animate-[respiration_28s_ease-in-out_infinite]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground via-foreground/85 to-foreground/40" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />

        <div className="relative mx-auto w-full max-w-screen-xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="rideau max-w-2xl">
            <p className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary sm:text-xs">
              Espace Pro — Approvisionnement des entreprises
            </p>
            <h1 className="mt-4 font-display text-[2.1rem] font-extrabold leading-[1.02] tracking-tight text-white sm:text-5xl">
              Équipez votre entreprise
              <span className="mt-1 block bg-gradient-to-r from-primary via-amber-300 to-primary bg-clip-text text-transparent">
                au prix rendu Abidjan.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80">
              Mobilier, quincaillerie, automobile, informatique, textile professionnel. Vous
              décrivez votre besoin, nous le chiffrons droits compris et nous montons le dossier
              de transit jusqu’à votre entrepôt.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="bouton-anime">
                <Link to="/catalogue/devis">
                  Demander un devis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="bouton-anime">
                <Link to="/boutique/sourcing">
                  <PackageSearch className="mr-2 h-4 w-4" />
                  Faire chercher une référence
                </Link>
              </Button>
            </div>

            {/* Le compteur est lu en base. Une page qui annonce un chiffre faux
                se disqualifie devant quelqu'un dont le métier est de compter. */}
            <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-2 text-sm text-white/75">
              <span className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                {secteurs === null ? (
                  <span className="inline-block h-4 w-24 animate-pulse rounded bg-white/20" />
                ) : (
                  <span className="tabular-nums">
                    {secteurs.length} rayon{secteurs.length > 1 ? 's' : ''} professionnels
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Droits et taxes compris au devis
              </span>
            </div>
          </div>
        </div>
      </section>

      <main className="entree-page mx-auto max-w-screen-xl px-4 py-12 sm:px-6">
        {/* ---------- Les engagements ---------- */}
        <section data-revele>
          <h2 className="trait-anime font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Ce qu’un acheteur professionnel attend de nous
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" data-revele-cascade>
            {ENGAGEMENTS.map((e) => {
              const Icone = e.icone;
              return (
                <div key={e.titre} className="carte-reactive reflet rounded-xl border bg-card p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icone className="h-5 w-5 text-primary" />
                  </span>
                  <h3 className="mt-3.5 font-display text-base font-bold leading-snug text-foreground">
                    {e.titre}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{e.texte}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------- Les rayons ---------- */}
        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3" data-revele>
            <div>
              <h2 className="trait-anime font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Les rayons
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Chaque rayon regroupe les références déjà chiffrées. Ce qui n’y figure pas, nous
                allons le chercher.
              </p>
            </div>
            <Button asChild variant="outline" className="bouton-anime">
              <Link to="/catalogue/mes-devis">Mes devis</Link>
            </Button>
          </div>

          {secteurs === null ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-52 w-full" />
              ))}
            </div>
          ) : secteurs.length === 0 ? (
            <p className="mt-8 rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
              Les rayons sont en cours de constitution. Décrivez-nous votre besoin en attendant :
              nous chiffrons sur demande.
            </p>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-revele-cascade>
              {secteurs.map((s) => {
                // Les visuels du rayon priment ; à défaut la photo générique,
                // puis l'illustration dessinée. Aucune carte ne peut se
                // retrouver vide pendant qu'on remplit les rayons un par un.
                const visuels = s.photos ?? [];
                const photo = SECTOR_PHOTOS[guessSector(s.nom)];
                return (
                  <Link
                    key={s.id}
                    to={`/catalogue/secteur/${s.id}`}
                    className="groupe-zoom carte-reactive reflet group block overflow-hidden rounded-xl border bg-card hover:border-primary/50"
                  >
                    <div className="cadre-zoom relative aspect-[16/10] w-full bg-muted">
                      {visuels.length > 0 ? (
                        <CarrouselSecteur photos={visuels} alt={s.nom} />
                      ) : photo ? (
                        <img src={photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-primary/10">
                          <SectorIllustration sector={guessSector(s.nom)} className="h-16 w-16" />
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/15 to-transparent" />
                      <h3 className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] p-4 font-display text-lg font-bold leading-tight text-white">
                        {s.nom}
                      </h3>
                    </div>
                    <div className="relative z-[2] flex items-center justify-between gap-2 px-4 py-3">
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Voir les références
                      </span>
                      <ArrowRight className="h-4 w-4 -translate-x-1 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ---------- Rappel ---------- */}
        <section
          className="carte-reactive mt-14 overflow-hidden rounded-xl border bg-muted/40 p-6 sm:p-8"
          data-revele
        >
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="max-w-xl">
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Une référence introuvable, une commande à grouper ?
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Décrivez ce que vous cherchez. Nous interrogeons nos fournisseurs, nous contrôlons
                la marchandise avant expédition, et nous vous annonçons un prix rendu Abidjan.
              </p>
            </div>
            <Button asChild size="lg" className="bouton-anime">
              <Link to="/boutique/sourcing">
                <PackageSearch className="mr-2 h-4 w-4" />
                Ouvrir une recherche
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
