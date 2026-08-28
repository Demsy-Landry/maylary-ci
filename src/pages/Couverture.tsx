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
import { useAuth } from '@/hooks/useAuth';
import { useFondDeBarre } from '@/hooks/useFondDeBarre';
import { LogoMaylary } from '@/components/MarqueMaylary';
import SiteFooter from '@/components/SiteFooter';
import SystemeIntelligent from '@/components/SystemeIntelligent';
import ImageOuverture from '@/components/ImageOuverture';
import MenuServices from '@/components/MenuServices';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useReferencement } from '@/hooks/useReferencement';
import { PAGES } from '@/lib/referencement-pages';
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
  categorie_gp_id: string | null;
  marchands_vendeurs: number | null;
}

/**
 * Choisir ce qu'on met en devanture.
 *
 * POURQUOI PAS « LES PLUS RÉCENTS »
 *
 * La vitrine prenait les douze derniers articles créés. Le résultat dépendait
 * donc de ce qu'on avait importé la veille : après une soirée passée à garnir
 * la quincaillerie, la page d'accueil est devenue un magasin d'outillage. Le
 * fondateur l'a vu tout de suite — « il n'y a que des articles de mécanique ».
 *
 * Une devanture ne dit pas ce qui vient d'arriver. Elle dit ce que la maison
 * vend, et elle doit le dire en douze images.
 *
 * DEUX RÈGLES, DANS CET ORDRE
 *
 * D'abord la VARIÉTÉ : on tourne entre les rayons, un article chacun, puis on
 * recommence. Aucun rayon ne peut occuper la vitrine à lui seul, même s'il
 * contient la moitié du catalogue.
 *
 * Ensuite la QUALITÉ : dans chaque rayon, on prend d'abord l'article que le
 * plus de marchands revendent. C'est le seul signal de validation dont on
 * dispose, et il vaut mieux que l'ancienneté — un oxymètre revendu par trois
 * cent trente-trois boutiques a fait ses preuves, un article importé hier n'a
 * rien prouvé du tout.
 */
function vitrineVariee(tous: Vitrine[], combien: number): Vitrine[] {
  const parRayon = new Map<string, Vitrine[]>();
  for (const p of tous) {
    const cle = p.categorie_gp_id ?? 'sans-rayon';
    const liste = parRayon.get(cle) ?? [];
    liste.push(p);
    parRayon.set(cle, liste);
  }
  // Le mieux validé en tête de chaque rayon.
  for (const liste of parRayon.values()) {
    liste.sort((a, b) => (b.marchands_vendeurs ?? 0) - (a.marchands_vendeurs ?? 0));
  }

  const files = [...parRayon.values()];
  const choisis: Vitrine[] = [];
  let rang = 0;
  // Un tour de table : un article par rayon, puis on recommence. On s'arrête
  // quand la vitrine est pleine ou qu'il n'y a plus rien à prendre.
  while (choisis.length < combien && files.some((f) => f.length > rang)) {
    for (const f of files) {
      if (choisis.length >= combien) break;
      if (f.length > rang) choisis.push(f[rang]);
    }
    rang++;
  }
  return choisis;
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export default function Couverture() {
  useReferencement(PAGES["/"]);

  /* L'ouverture est une photographie sombre : la bande système doit l'être
     aussi, sans quoi l'écran commence par un bandeau crème au-dessus de
     l'image. Même valeur que `bg-foreground`, qui habille la section. */
  useFondDeBarre('oklch(0.19 0.02 250)');

  const { user, isAdmin } = useAuth();
  const [produits, setProduits] = useState<Vitrine[] | null>(null);
  const [categories, setCategories] = useState<CategorieGP[]>([]);
  const [recherche, setRecherche] = useState('');
  /* LES IMAGES QUI NE RÉPONDENT PAS.
     La vitrine n'avait aucun repli : une photo qui échoue laissait un cadre
     vide, et le fondateur a vu des articles sans image. Une image distante
     échoue pour des raisons qu'on ne maîtrise pas — le fournisseur retire un
     fichier, la liaison coupe au mauvais moment. Ce qu'on maîtrise, c'est ce
     qu'on montre à la place : jamais un trou. */
  const [imagesCassees, setImagesCassees] = useState<Set<string>>(new Set());
  const marquerCassee = (url: string) =>
    setImagesCassees((s) => (s.has(url) ? s : new Set(s).add(url)));

  useEffect(() => {
    // Deux lectures légères et une seule fois. La vitrine n'a pas besoin de
    // tout le catalogue : huit articles suffisent à prouver qu'il existe.
    void Promise.all([
      supabase
        .from(PRODUITS_PUBLIC_VIEW)
        .select('id, nom, prix_unitaire_fcfa, photos, categorie_gp_id, marchands_vendeurs')
        .eq('espace', 'grand_public')
        .not('photos', 'is', null)
        // On ramène large pour pouvoir CHOISIR : la variété se construit ici,
        // pas dans la requête. Quatre-vingts lignes de quatre colonnes légères
        // coûtent moins qu'une image, et permettent de couvrir tous les rayons.
        .order('marchands_vendeurs', { ascending: false, nullsFirst: false })
        .limit(80),
      supabase
        .from(CATEGORIES_GP_TABLE)
        .select('id, nom, image_url, ordre_affichage, actif, created_at, updated_at')
        .eq('actif', true)
        .order('ordre_affichage'),
    ]).then(([p, c]) => {
      // Douze : une grille de tuiles se juge pleine. Huit laissaient une
      // dernière rangée à moitié vide sur grand écran, et une vitrine à trous
      // se lit comme un stock qui s'épuise.
      setProduits(
        vitrineVariee(((p.data as Vitrine[]) ?? []).filter((x) => x.photos?.length), 12),
      );
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
      <header className="absolute inset-x-0 top-0 z-20 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" aria-label="MayLary Group, accueil">
            {/* `whitespace-nowrap` : le bandeau a gagné le bouton « Services »,
                et sur un téléphone de 390 px le nom de la marque se coupait
                entre « MayLary » et « Group ». Un nom qui passe à la ligne se
                lit comme deux mots. */}
            <LogoMaylary
              className="whitespace-nowrap font-display text-white"
              tailleMarque="h-8 w-8 sm:h-9 sm:w-9"
              tailleTexte="text-base sm:text-lg"
            />
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            {/* HUIT MÉTIERS, DEUX PORTES : LE COMPTE N'Y ÉTAIT PAS.
                Cet en-tête menait à la boutique et à la page de présentation
                des services — rien d'autre. Importer, Exporter, l'Espace Pro,
                le Sourcing, les Achats groupés, Vendre, Le Déclarant : sept
                métiers n'avaient AUCUN accès depuis la page d'accueil, la
                seule que voit un visiteur qui arrive par le nom de domaine.

                Le panneau latéral existait déjà et sert toutes les autres
                pages. Il manquait ici, précisément là où il manquait le plus.

                La page de présentation reste accessible : le panneau ouvre les
                métiers un par un, « Nos services » les raconte ensemble. Les
                deux ne font pas le même travail. */}
            <MenuServices surFondSombre />
            <Link
              to="/boutique"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-white/85 transition hover:text-white sm:block"
            >
              Boutique
            </Link>
            <Link
              to="/services"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-white/85 transition hover:text-white sm:block"
            >
              Nos services
            </Link>
            {/* La couverture est la seule page qui affichait « Se connecter »
                sans jamais regarder si quelqu'un l'était. Un client déjà
                connecté y lisait donc qu'il ne l'était pas, cliquait, et
                retombait sur l'écran de connexion — de quoi douter d'avoir
                jamais eu un compte. */}
            {user ? (
              <Button asChild size="sm" variant="secondary">
                <Link to={isAdmin ? '/admin' : '/mon-compte'}>
                  {isAdmin ? 'Administration' : 'Mon compte'}
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="secondary">
                <Link to="/boutique/compte">Se connecter</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ---------- Ouverture ----------
          Une seule image chargée en priorité sur toute la page. Le reste vient
          après, et seulement quand il approche de l'écran. */}
      {/* PLEINE HAUTEUR D'ÉCRAN, ET `svh` PLUTÔT QUE `vh`.
          L'ouverture s'arrêtait à 34 rem : sur un téléphone de 844 px elle en
          occupait 661, et laissait une bande claire sous la photographie avant
          la section suivante. Le premier écran d'un groupe ne se termine pas
          sur un blanc.

          `svh` — la « petite » hauteur d'écran, barres du navigateur DÉPLOYÉES.
          Avec `vh`, la bannière est dimensionnée sur l'écran barres repliées :
          au chargement, quand elles sont visibles, le bas est coupé et le
          bouton « Chercher » peut tomber hors de vue. Avec `svh` elle tient
          toujours, au prix d'un léger vide quand les barres se replient — un
          vide que la photographie remplit, puisqu'elle déborde déjà. */}
      {/* SUR ORDINATEUR AUSSI, ET C'ÉTAIT LE DÉFAUT.
          `sm:min-h-[86vh]` ramenait l'ouverture à 86 % de l'écran dès qu'on
          quittait le téléphone : sur un moniteur de 1080 px, cent cinquante
          pixels de section suivante montraient déjà le bas, et la
          photographie s'arrêtait avant le bord. Le premier écran d'un groupe
          se tient sur un écran entier, quel que soit l'écran. */}
      <section className="relative flex min-h-[100svh] items-center overflow-hidden bg-foreground">
        {/* L'image d'ouverture est servie par le site, pas par le stockage
            distant : même origine, une connexion de moins à ouvrir, et elle
            arrive avant tout le reste. C'est le premier écran d'un groupe —
            il n'a pas le droit d'être lent. */}
        <ImageOuverture
          src="/visuels/fret-aerien-abidjan.jpg"
          alt=""
          largeur={1168}
          hauteur={784}
          className="absolute inset-0 h-full w-full scale-105 object-cover object-[60%_center] sm:object-[center_58%] motion-safe:animate-[respiration_24s_ease-in-out_infinite]"
        />
        {/* Deux voiles superposés plutôt qu'un seul aplat : le premier assure
            la lisibilité du texte à gauche, le second rattache le bas de
            l'image au fond de la page. La photographie reste visible — c'est
            elle qui dit le métier. */}
        {/* LES VOILES SE RESSERRENT QUAND L'ÉCRAN S'ÉLARGIT.
            Ils étaient réglés pour un téléphone, où le texte occupe toute la
            largeur : il faut assombrir partout pour qu'il reste lisible. Sur
            un moniteur, ce même réglage laissait la photographie à 75 % de
            voile en son milieu et à 60 % en haut — l'avion, les conteneurs,
            le chariot élévateur disparaissaient sous le gris, et il ne
            restait qu'une bande claire au centre. D'où l'impression, juste,
            d'une image « centrée » qui n'occupe pas l'écran.
            Elle l'occupait ; on ne la voyait plus.

            À partir de `sm`, le voile horizontal s'éteint dès 45 % — juste
            après la colonne de texte — et le voile vertical s'allège. Le
            contraste du titre est conservé là où il y a du titre, et la
            photographie reprend les deux tiers droits de l'écran. */}
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/95 via-foreground/75 to-foreground/20 sm:via-foreground/70 sm:via-45% sm:to-foreground/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-foreground/40 sm:from-foreground/45 sm:to-foreground/20" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent" />

        {/* Le bandeau flotte AU-DESSUS de cette ouverture : son dégagement de
            6 rem lui suffisait tant qu'il mesurait sa seule hauteur. Sous une
            encoche il gagne la hauteur de la barre système, et le logo venait
            se poser sur la ligne « Aérien · Express ». Le dégagement suit
            désormais l'encoche. */}
        <div className="relative mx-auto w-full max-w-screen-xl px-4 py-24 pt-[calc(6rem+env(safe-area-inset-top))] sm:px-6">
          {/* `rideau` plutôt que `data-revele` : ce bloc est déjà à l'écran
              quand la page arrive. La révélation au défilement ne se
              déclencherait donc sur rien de visible — il faut une entrée au
              montage, échelonnée dans l'ordre de lecture. */}
          <div className="rideau max-w-2xl">
            <p className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary sm:text-xs">
              Aérien · Express · Groupage — Abidjan
            </p>
            <h1 className="mt-5 font-display text-[2.6rem] font-extrabold leading-[0.98] tracking-tight text-white sm:text-7xl">
              Le monde produit.
              <span className="mt-1 block bg-gradient-to-r from-primary via-amber-300 to-primary bg-clip-text text-transparent">
                Nous vous l’apportons.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
              Transitaires de métier, commerçants par vocation. Nous achetons à la source,
              groupons, dédouanons et livrons. Vous ne voyez qu’une chose : un prix, une
              date, et votre marchandise devant vous.
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
            <h2 className="trait-anime font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
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
            {/* TUILE À BANDEAU-LÉGENDE, à la manière des vitrines de marque.
                L'image occupe toute la tuile et le texte se tient dans une
                bande sous elle, séparée par un trait. C'est ce qui donne à une
                grille son allure de rayon : ce sont les PHOTOS qui s'alignent,
                pas des cartes bordées de gris.

                La bordure du haut disparaît donc, et l'ombre porte le relief.
                Une carte cernée d'un trait à chaque tuile fabrique un
                quadrillage — l'œil compte les cases au lieu de regarder les
                objets. */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {produits.map((p) => (
                <Link
                  key={p.id}
                  to={`/boutique/produit/${p.id}`}
                  className="groupe-zoom carte-reactive reflet block overflow-hidden rounded-lg bg-card shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md"
                >
                  {/* `object-contain`, et non `object-cover` : un article se
                      montre en entier. Recadrer au carré coupait les pieds
                      d'un meuble et la moitié d'un réfrigérateur — sur un
                      téléphone, où la vignette est deux fois plus petite,
                      cela donnait des images qui ne ressemblaient à rien. */}
                  <div className="cadre-zoom aspect-square bg-white p-3">
                    {imagesCassees.has(p.photos![0]) ? (
                      <div className="flex h-full w-full items-center justify-center rounded bg-muted">
                        <PackageSearch className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
                      </div>
                    ) : (
                      <img
                        src={p.photos![0]}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={() => marquerCassee(p.photos![0])}
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>
                  <div className="relative z-[2] border-t bg-card px-3 py-2.5">
                    <p className="line-clamp-2 text-xs leading-snug text-muted-foreground sm:text-sm">
                      {p.nom}
                    </p>
                    <p className="mt-1 font-display text-sm font-bold tabular-nums text-foreground sm:text-base">
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

        {/* LES RAYONS EN TUILES, ET NON PLUS EN PASTILLES.
            Une rangée de pastilles grises se lit comme des filtres : on la
            survole sans la voir. Une tuile avec l'image du rayon se regarde,
            et donne envie d'entrer — c'est la différence entre une liste de
            mots et une devanture.

            Le rayon qui n'a pas encore de photographie ne laisse pas un trou :
            son illustration sectorielle prend la place, dessinée aux couleurs
            de la maison. */}
        {categories.length > 0 && (
          <div className="mt-12">
            <h3 className="font-display text-lg font-semibold text-foreground">
              Parcourir par rayon
            </h3>
            <div className="cascade mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/boutique/categorie/${c.id}`}
                  className="cadre-zoom group block overflow-hidden rounded-lg bg-card shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md"
                >
                  <div className="aspect-square bg-muted">
                    {c.image_url && !imagesCassees.has(c.image_url) ? (
                      <img
                        src={c.image_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={() => marquerCassee(c.image_url!)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      /* PAS DE PICTOGRAMME DE REPLI.
                         Le repli précédent devinait un « secteur » à partir du
                         nom du rayon, et se trompait : le même dessin de sac
                         est apparu sur Montres, Sacs, Bébé et Maison — quatre
                         rayons, une seule image. Un visiteur y lit une
                         boutique bâclée, et il a raison.

                         Une initiale sur un aplat de marque ne prétend rien.
                         Elle dit « ce rayon n'a pas encore de photo », ce qui
                         est vrai, au lieu d'annoncer des sacs à main sous
                         l'étiquette Montres. */
                      <div className="flex h-full w-full items-center justify-center bg-primary/10">
                        <span className="font-display text-3xl font-bold text-primary/70">
                          {c.nom.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="border-t bg-card px-2 py-2.5 text-center text-xs font-medium leading-tight text-foreground group-hover:text-primary sm:text-sm">
                    {c.nom}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ---------- Pourquoi acheter ici ---------- */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto max-w-screen-xl px-4 py-16 sm:px-6">
          <h2
            className="trait-anime max-w-2xl font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
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
          <h2 className="trait-anime font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
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
              // Servie par le site et non par le stockage distant. Le
              // sourcing, c'est d'abord CHOISIR : comparer des références,
              // vérifier une matière, arbitrer un prix. L'entrepôt vient
              // après — il illustre le contrôle, pas la recherche.
              image: '/visuels/sourcing-selection.jpg',
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
            <div
              key={e.etape}
              className="groupe-zoom carte-reactive overflow-hidden rounded-xl border bg-card hover:border-primary/40"
            >
              {/* Rapport fixe : quelle que soit la taille de la photo d'origine,
                  la vignette garde la même forme et ne déforme jamais l'image. */}
              <div className="cadre-zoom aspect-[4/3] bg-muted">
                <img
                  // Une étape peut porter une image du site (chemin absolu) ou
                  // une photographie du stockage distant (simple nom de
                  // fichier). Le test sur la barre oblique évite de préfixer
                  // deux fois la première.
                  src={e.image.startsWith('/') ? e.image : photo(e.image)}
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
            <h2 className="trait-anime mt-3 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
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

          <div className="cadre-zoom relative rounded-xl border" data-revele>
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
            <h2 className="trait-anime font-display text-2xl font-bold tracking-tight text-background sm:text-3xl">
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
                  className="carte-reactive reflet group rounded-lg border border-background/15 p-5 hover:border-primary/60 hover:bg-background/5"
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

      {/* Placée en fin de page, après les services : on montre d'abord ce
          qu'on fait, on explique ensuite comment. Un visiteur qui descend
          jusqu'ici cherche à comprendre — c'est le moment de dire où l'IA
          travaille, et surtout où elle n'entre pas. */}
      <SystemeIntelligent />

      <SiteFooter />
    </div>
  );
}
