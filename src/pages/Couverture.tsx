import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  supabase,
  STORAGE_PUBLIC_URL,
  PRODUIT_PHOTOS_BUCKET,
  PRODUITS_PUBLIC_VIEW,
  CATEGORIES_GP_TABLE,
  type CategorieGP,
} from '@/lib/supabase';
import { LogoMaylary } from '@/components/MarqueMaylary';
import SiteFooter from '@/components/SiteFooter';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowRight,
  ShieldCheck,
  Truck,
  Users,
  Store,
  Ship,
  Plane,
  PackageSearch,
  Scale,
  Search,
} from 'lucide-react';

/**
 * La page de couverture.
 *
 * Deuxième version, après trois reproches du fondateur, tous fondés.
 *
 * **« C'est pas fast. »** La première version chargeait trente-deux vignettes
 * sectorielles de 150 à 350 ko dans un bandeau défilant, plus trois photos de
 * mode, six de service et deux fonds pleine page : plusieurs mégaoctets avant
 * même le premier défilement, sur une liaison mobile abidjanaise. Ici, une
 * seule image est chargée en priorité — celle de l'ouverture. Tout le reste
 * est différé, et le bandeau défilant réutilise exactement les photos déjà
 * affichées dans la grille : il ne coûte pas un octet de plus.
 *
 * **« Le TEC, c'est de l'interne. »** Exact. La liquidation douanière et les
 * six mille positions tarifaires impressionnent un confrère et n'intéressent
 * pas quelqu'un qui veut acheter un réfrigérateur. Cette page ne parle plus
 * que de ce que le visiteur peut faire.
 *
 * **« Le marketplace, c'est par là que MayLary se fera connaître. »** C'est
 * l'axe de la page. Le premier écran mène à la boutique, le deuxième montre de
 * vrais produits avec de vrais prix, et le troisième explique pourquoi payer
 * en ligne ici est sûr. Le transit passe après, en une bande sobre — il reste
 * le métier, il n'est plus la porte d'entrée.
 */

const photo = (nom: string) => `${STORAGE_PUBLIC_URL}/${PRODUIT_PHOTOS_BUCKET}/accueil/${nom}`;

interface Vitrine {
  id: string;
  nom: string;
  prix_unitaire_fcfa: number;
  photos: string[] | null;
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export default function Couverture() {
  const [produits, setProduits] = useState<Vitrine[] | null>(null);
  const [categories, setCategories] = useState<CategorieGP[]>([]);
  const [recherche, setRecherche] = useState('');

  useEffect(() => {
    // Deux lectures légères et une seule fois. La vitrine n'a pas besoin de
    // tout le catalogue : huit articles suffisent à prouver qu'il existe.
    void Promise.all([
      supabase
        .from(PRODUITS_PUBLIC_VIEW)
        .select('id, nom, prix_unitaire_fcfa, photos')
        .not('photos', 'is', null)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from(CATEGORIES_GP_TABLE)
        .select('id, nom, image_url, ordre_affichage, actif, created_at, updated_at')
        .eq('actif', true)
        .order('ordre_affichage'),
    ]).then(([p, c]) => {
      setProduits(((p.data as Vitrine[]) ?? []).filter((x) => x.photos?.length));
      setCategories((c.data as CategorieGP[]) ?? []);
    });
  }, []);

  const chercher = (e: React.FormEvent) => {
    e.preventDefault();
    const q = recherche.trim();
    window.location.href = q ? `/boutique?q=${encodeURIComponent(q)}` : '/boutique';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ---------- Bandeau flottant ---------- */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" aria-label="MayLary Group, accueil">
            <LogoMaylary className="font-display text-white" tailleTexte="text-lg" />
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/boutique"
              className="rounded-md px-3 py-2 text-sm font-medium text-white/85 transition hover:text-white"
            >
              Boutique
            </Link>
            <Link
              to="/services"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-white/85 transition hover:text-white sm:block"
            >
              Nos services
            </Link>
            <Button asChild size="sm" variant="secondary">
              <Link to="/boutique/compte">Se connecter</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ---------- Ouverture ----------
          Une seule image chargée en priorité sur toute la page. Le reste vient
          après, et seulement quand il approche de l'écran. */}
      <section className="relative flex min-h-[34rem] items-center overflow-hidden bg-foreground sm:min-h-[86vh]">
        {/* L'ouverture portait jusqu'ici la couverture Facebook de la marque,
            une bannière de 735 x 272 pixels étirée sur une hauteur d'écran :
            à cette échelle elle était floue et recadrée n'importe comment.
            Une photographie de boutique, au format paysage, dit ce que le
            visiteur vient chercher.

            Sur un téléphone, une image paysage tenue sur 86 % de la hauteur
            d'écran se recadre si violemment qu'on n'y reconnaît plus rien :
            d'où la hauteur fixe en dessous de 640 pixels de large, et le
            cadrage calé sur le centre haut plutôt que sur le milieu. */}
        <img
          src={photo('carousel-1-boutique.jpg')}
          alt=""
          width={1600}
          height={900}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-[center_35%]"
          onError={(e) => {
            e.currentTarget.src = photo('carousel-3-livraison.jpg');
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/25" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />

        <div className="relative mx-auto w-full max-w-screen-xl px-4 py-24 sm:px-6">
          <div className="max-w-2xl">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Livré partout en Côte d’Ivoire
            </p>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
              Achetez ici ce qui vient
              <span className="block text-primary">de partout ailleurs.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
              Électroménager, quincaillerie, mobilier, informatique — déjà dédouanés, prix
              affiché toutes taxes comprises, payé seulement si vous recevez.
            </p>

            {/* La recherche mène directement à la boutique : c'est le geste
                naturel de quelqu'un qui arrive sur un site marchand. */}
            <form onSubmit={chercher} className="mt-8 flex max-w-lg gap-2" role="search">
              <label htmlFor="recherche-accueil" className="sr-only">
                Rechercher un produit
              </label>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="recherche-accueil"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Réfrigérateur, perceuse, bureau…"
                  className="h-12 w-full rounded-md border border-white/20 bg-white/95 pl-9 pr-3 text-base text-foreground shadow-lg outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
              <Button type="submit" size="lg" className="h-12 shrink-0 text-base">
                Chercher
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/75">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Payé, protégé
              </span>
              <span className="flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-primary" />
                Livraison dans tout le pays
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-primary" />
                Achat groupé à prix de gros
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- La vitrine : de vrais produits, de vrais prix ---------- */}
      <section className="mx-auto max-w-screen-xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Déjà en boutique
            </h2>
            <p className="mt-1.5 text-muted-foreground">
              Prix rendus Abidjan, droits de douane compris. Rien à ajouter à l’arrivée.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/boutique">
              Tout le catalogue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {produits === null ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
        ) : produits.length === 0 ? (
          <p className="mt-8 rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
            Le catalogue arrive. Écrivez-nous ce que vous cherchez, nous irons le chercher.
          </p>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {produits.map((p) => (
                <Link
                  key={p.id}
                  to={`/boutique/produit/${p.id}`}
                  className="group overflow-hidden rounded-lg border bg-card transition hover:shadow-md"
                >
                  {/* `object-contain`, et non `object-cover` : un article se
                      montre en entier. Recadrer au carré coupait les pieds
                      d'un meuble et la moitié d'un réfrigérateur — sur un
                      téléphone, où la vignette est deux fois plus petite,
                      cela donnait des images qui ne ressemblaient à rien. */}
                  <div className="aspect-square overflow-hidden bg-white p-3">
                    <img
                      src={p.photos![0]}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm leading-snug text-foreground">{p.nom}</p>
                    <p className="mt-1.5 font-display font-bold tabular-nums text-foreground">
                      {fcfa(p.prix_unitaire_fcfa)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Le bandeau défilant réutilise les photos déjà chargées ci-dessus :
                le navigateur les a en cache, il ne retélécharge rien. */}
            <div className="mt-10 overflow-hidden rounded-lg border bg-card py-4" aria-hidden="true">
              <div className="convoi flex w-max gap-4 px-4">
                {[...produits, ...produits].map((p, i) => (
                  <div key={`${p.id}-${i}`} className="flex shrink-0 items-center gap-3">
                    <img
                      src={p.photos![0]}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-12 w-12 rounded bg-white object-contain p-0.5"
                    />
                    <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                      {fcfa(p.prix_unitaire_fcfa)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {categories.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                to={`/boutique/categorie/${c.id}`}
                className="rounded-full border px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:bg-primary/5"
              >
                {c.nom}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Pourquoi acheter ici ---------- */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto max-w-screen-xl px-4 py-16 sm:px-6">
          <h2
            className="max-w-2xl font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            data-revele
          >
            Acheter en ligne sans se faire avoir
          </h2>

          <div className="mt-10 grid gap-8 sm:grid-cols-3" data-revele-cascade>
            {[
              {
                icone: ShieldCheck,
                titre: 'Payé, protégé',
                texte:
                  'Votre argent n’est versé au vendeur qu’après votre confirmation de réception. C’est inscrit dans le système, pas dans des conditions générales.',
              },
              {
                icone: Truck,
                titre: 'Le prix affiché est le prix final',
                texte:
                  'Droits de douane et taxes déjà compris. Personne ne vous rappellera pour un supplément à l’arrivée.',
              },
              {
                icone: Users,
                titre: 'Achat groupé',
                texte:
                  'Rejoignez une commande collective et payez au prix de gros. Le lot n’est acheté que si l’objectif est atteint.',
              },
            ].map((c) => {
              const Icone = c.icone;
              return (
                <div key={c.titre}>
                  <Icone className="h-6 w-6 text-primary" />
                  <h3 className="mt-3 font-display text-lg font-bold text-foreground">{c.titre}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.texte}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/boutique">
                <Store className="mr-2 h-4 w-4" />
                Entrer dans la boutique
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/boutique/achats-groupes">Voir les achats groupés</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ---------- Ce qu'on fait, en images ----------
          Le fondateur a eu raison de dire que les photographies n'illustraient
          pas le métier : trois images de décor ne racontent pas une chaîne
          logistique. Ici chaque photo porte une étape, et les quatre étapes
          mises bout à bout sont exactement ce que la maison exécute entre le
          fournisseur et la porte du client. */}
      <section className="mx-auto max-w-screen-xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl" data-revele>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Entre l’usine et votre porte, ce que nous faisons
          </h2>
          <p className="mt-2 text-muted-foreground">
            Vous voyez un prix et une date. Derrière, il y a quatre métiers — et c’est
            précisément ce que vous n’avez pas à apprendre.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" data-revele-cascade>
          {[
            {
              image: 'service-sourcing.jpg',
              etape: '1',
              titre: 'On trouve la marchandise',
              texte:
                'Chine, Turquie, Europe, Maghreb. On compare les fournisseurs, on vérifie l’origine, et on choisit celle qui coûte le moins cher droits compris.',
            },
            {
              image: 'mode-aerien.jpg',
              etape: '2',
              titre: 'On groupe et on expédie',
              texte:
                'Aérien, express, groupage maritime. Votre colis voyage avec d’autres : vous ne payez que la place qu’il occupe.',
            },
            {
              image: 'service-importer.jpg',
              etape: '3',
              titre: 'On dédouane',
              texte:
                'Position tarifaire, valeur en douane, droits et taxes. La déclaration est signée par notre commissionnaire agréé partenaire.',
            },
            {
              image: 'carousel-3-livraison.jpg',
              etape: '4',
              titre: 'On livre chez vous',
              texte:
                'Transit local jusqu’à votre adresse. Vous confirmez la réception, et c’est seulement là que le vendeur est réglé.',
            },
          ].map((e) => (
            <div key={e.etape} className="overflow-hidden rounded-xl border bg-card">
              {/* Rapport fixe : quelle que soit la taille de la photo d'origine,
                  la vignette garde la même forme et ne déforme jamais l'image. */}
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={photo(e.image)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-4">
                <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Étape {e.etape}
                </p>
                <h3 className="mt-1.5 font-display text-base font-bold text-foreground">{e.titre}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{e.texte}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Vendre chez nous ---------- */}
      <section className="mx-auto max-w-screen-xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div data-revele>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Vous vendez déjà quelque chose ?
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Ouvrez votre boutique sur MayLary
            </h2>
            <p className="mt-4 text-muted-foreground">
              Commerçants, ateliers, importateurs : mettez vos produits devant des clients qui
              cherchent déjà. Vous gardez vos prix, nous apportons le paiement sécurisé, la
              logistique et la visibilité.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-foreground">
              <li>— Inscription gratuite, validation sous quelques jours.</li>
              <li>— Vous êtes réglé après confirmation de réception par l’acheteur.</li>
              <li>— Les avis clients construisent votre réputation, visible par tous.</li>
            </ul>
            <Button asChild size="lg" className="mt-7">
              <Link to="/vendre">
                Devenir vendeur
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="relative overflow-hidden rounded-xl border" data-revele>
            <img
              src={photo('service-vendre.jpg')}
              alt="Un commerçant prépare une commande"
              loading="lazy"
              decoding="async"
              className="h-72 w-full object-cover sm:h-96"
            />
          </div>
        </div>
      </section>

      {/* ---------- Le transit, en bande sobre ----------
          Il reste le métier de la maison, mais il n'est plus la porte
          d'entrée : quelqu'un qui arrive par hasard vient acheter, pas
          dédouaner. */}
      <section className="relative overflow-hidden border-y bg-foreground">
        {/* Une photographie d'aérien plutôt qu'un aplat : c'est le métier
            d'origine de la maison, et le fond reste assez sombre pour que le
            texte garde son contraste. Chargée en différé, elle n'entre pas
            dans le temps d'affichage du premier écran. */}
        <img
          src={photo('mode-aerien.jpg')}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground via-foreground/85 to-foreground/50" />
        <div className="relative mx-auto max-w-screen-xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl" data-revele>
            <h2 className="font-display text-2xl font-bold tracking-tight text-background sm:text-3xl">
              Et si vous importez vous-même
            </h2>
            <p className="mt-3 text-background/70">
              MayLary Group est né dans le transit aérien, l’express et le dégroupage. Pour les
              professionnels, les mêmes équipes prennent en charge le dossier complet — du
              fournisseur à votre entrepôt.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-revele-cascade>
            {[
              // L'ordre suit le métier de la maison : l'aérien et l'express
              // d'abord, puis le groupage. C'est là qu'est la spécialité, et
              // c'est ce qu'on met devant.
              { icone: Plane, titre: 'Aérien & Express', texte: 'Notre spécialité. Du colis urgent au fret de ligne.', lien: '/import/nouvelle-demande' },
              { icone: Ship, titre: 'Groupage & dégroupage', texte: 'Maritime et aérien. Vous ne payez que votre part.', lien: '/import' },
              { icone: Scale, titre: 'Poids taxable', texte: 'Ce que la compagnie vous facturera vraiment. Gratuit.', lien: '/poids-taxable' },
              { icone: PackageSearch, titre: 'Sourcing', texte: 'Nous trouvons ce qui est introuvable.', lien: '/boutique/sourcing' },
            ].map((s) => {
              const Icone = s.icone;
              return (
                <Link
                  key={s.titre}
                  to={s.lien}
                  className="group rounded-lg border border-background/15 p-5 transition hover:border-primary/60 hover:bg-background/5"
                >
                  <Icone className="h-5 w-5 text-primary" />
                  <h3 className="mt-3 flex items-center gap-1.5 font-display text-base font-bold text-background">
                    {s.titre}
                    <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </h3>
                  <p className="mt-1 text-sm text-background/65">{s.texte}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- Dernier appel ---------- */}
      <section className="mx-auto max-w-screen-xl px-4 py-20 text-center sm:px-6">
        <div data-revele>
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Ce que vous cherchez existe. Nous savons où.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Si ce n’est pas encore en boutique, dites-le-nous : nous allons le chercher à la source
            et vous donnons le prix rendu Abidjan.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/boutique">
                <Store className="mr-2 h-4 w-4" />
                Voir la boutique
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/boutique/sourcing">
                <PackageSearch className="mr-2 h-4 w-4" />
                Faire chercher un produit
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
