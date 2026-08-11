import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { STORAGE_PUBLIC_URL, PRODUIT_PHOTOS_BUCKET, LOGO_BUCKET } from '@/lib/supabase';
import { LogoMaylary } from '@/components/MarqueMaylary';
import SiteFooter from '@/components/SiteFooter';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Ship,
  Plane,
  Truck,
  ShieldCheck,
  Scale,
  Globe2,
  Store,
  PackageSearch,
  Users,
  ChevronDown,
} from 'lucide-react';

/**
 * La page de couverture.
 *
 * Le constat du fondateur : en arrivant sur l'application, on croyait qu'elle
 * ne faisait que de l'import. C'est vrai — l'ancienne page d'accueil ouvrait
 * sur un formulaire de demande, et un formulaire dit ce qu'il demande, pas ce
 * que la maison sait faire.
 *
 * Cette page-ci a un seul travail : qu'un visiteur entré par hasard comprenne
 * en dix secondes qu'il a devant lui un groupe de logistique complet, et qu'il
 * ait envie d'aller plus loin. L'ancienne page devient la seconde — celle où
 * l'on choisit son service.
 *
 * Trois partis pris.
 *
 * **De vraies photographies, pas des aplats.** Toutes viennent du stockage du
 * projet : le visuel de marque produit sur Canva, les prises de vue maritime,
 * aérienne et routière, les visuels de service et les quarante images
 * sectorielles. Une page de couverture qui parle de marchandises et ne montre
 * aucune marchandise ne convainc personne.
 *
 * **Le mouvement raconte le métier.** Le bandeau des rayons défile en continu,
 * comme un convoi ; les sections se révèlent au défilement ; les chiffres se
 * comptent à l'entrée dans l'écran. Rien ne bouge pour bouger — et tout
 * s'arrête si le visiteur a demandé moins d'animation.
 *
 * **Les chiffres sont vrais.** Le calcul de démonstration est celui du moteur,
 * pas une illustration. C'est la promesse du produit, tenue dès la première
 * page.
 */

const photo = (nom: string) => `${STORAGE_PUBLIC_URL}/${PRODUIT_PHOTOS_BUCKET}/accueil/${nom}`;
const secteur = (nom: string) => `${STORAGE_PUBLIC_URL}/${PRODUIT_PHOTOS_BUCKET}/secteurs/${nom}`;
const marque = (nom: string) => `${STORAGE_PUBLIC_URL}/${LOGO_BUCKET}/marque/${nom}`;

const MODES = [
  {
    titre: 'Maritime',
    icone: Ship,
    image: photo('mode-maritime.jpg'),
    texte: 'Groupage et conteneur complet, au départ de la Chine, de l’Europe et du Maghreb.',
    detail: 'Unité payante au m³ ou à la tonne, selon ce qui pèse le plus lourd sur votre facture.',
  },
  {
    titre: 'Aérien',
    icone: Plane,
    image: photo('mode-aerien.jpg'),
    texte: 'Pour l’urgent, le fragile et le périssable — de l’échantillon au fret de ligne.',
    detail: 'Poids taxable calculé au rapport officiel, jamais arrondi en notre faveur.',
  },
  {
    titre: 'Routier',
    icone: Truck,
    image: photo('mode-routier.jpg'),
    texte: 'Corridors CEDEAO. Accra est à une journée de route quand Shanghai est à quarante de mer.',
    detail: 'Origine CEDEAO : droit de douane nul sous certificat d’origine.',
  },
];

const SERVICES = [
  {
    titre: 'Importer',
    lien: '/import',
    image: photo('service-importer.jpg'),
    texte: 'Devis complet avant de commander : marchandise, fret, assurance, douane, livraison.',
  },
  {
    titre: 'Exporter',
    lien: '/export',
    image: photo('service-exporter.jpg'),
    texte: 'Cacao, karité, cajou, coton, ananas — du ramassage au port de destination.',
  },
  {
    titre: 'Le Déclarant',
    lien: '/declarant',
    image: photo('hero-import-maritime.jpg'),
    texte: 'Position tarifaire et droits de douane calculés sur le TEC officiel. Ouvert à tous.',
    phare: true,
  },
  {
    titre: 'La Boutique',
    lien: '/boutique',
    image: photo('service-boutique.jpg'),
    texte: 'Des produits déjà dédouanés, livrés partout en Côte d’Ivoire. Payé, protégé.',
  },
  {
    titre: 'Espace Pro',
    lien: '/catalogue',
    image: photo('service-espace-pro.jpg'),
    texte: 'Seize rayons professionnels, prix dégressifs, devis en ligne.',
  },
  {
    titre: 'Sourcing',
    lien: '/boutique/sourcing',
    image: photo('service-sourcing.jpg'),
    texte: 'Vous cherchez une référence introuvable ? Nous allons la chercher à la source.',
  },
];

/** Les rayons défilent : quarante visuels réels, en convoi continu. */
const RAYONS = [
  { nom: 'Quincaillerie', img: secteur('quincaillerie-1.jpg') },
  { nom: 'Électroménager', img: secteur('electromenager-1.jpg') },
  { nom: 'Textile', img: secteur('textile-1.jpg') },
  { nom: 'Agroalimentaire', img: secteur('agroalimentaire-1.jpg') },
  { nom: 'Informatique', img: secteur('informatique-1.jpg') },
  { nom: 'Mobilier de bureau', img: secteur('mobilier-bureau-1.jpg') },
  { nom: 'Solaire', img: secteur('solaire-1.jpg') },
  { nom: 'Hôtellerie', img: secteur('hotellerie-1.jpg') },
  { nom: 'Sécurité', img: secteur('securite-1.jpg') },
  { nom: 'Automobile', img: secteur('automobile-1.jpg') },
  { nom: 'Emballage', img: secteur('emballage-1.jpg') },
  { nom: 'Beauté', img: secteur('beaute-1.jpg') },
  { nom: 'Hygiène', img: secteur('hygiene-1.jpg') },
  { nom: 'Décoration', img: secteur('decoration-1.jpg') },
  { nom: 'Imprimerie', img: secteur('imprimerie-1.jpg') },
  { nom: 'Santé', img: secteur('sante-1.jpg') },
];

const PREUVES = [
  { label: 'Ne fournit pas', valeur: 0, suffixe: '', libelle: 'taux estimé affiché', mise: 'Jamais.' },
  { label: 'TEC', valeur: 6298, suffixe: '', libelle: 'positions tarifaires officielles', mise: 'Chargées en base.' },
  { label: 'Modes', valeur: 3, suffixe: '', libelle: 'modes de transport', mise: 'Maritime, aérien, routier.' },
  { label: 'Origines', valeur: 4, suffixe: '', libelle: 'régimes d’origine outillés', mise: 'Dont l’APE et la CEDEAO.' },
];

/**
 * Un nombre qui se compte quand il entre dans l'écran.
 *
 * Le compteur ne part qu'une fois, et pas du tout si le visiteur a demandé
 * moins d'animation — auquel cas la valeur finale s'affiche directement.
 */
function useCompteur(cible: number, actif: boolean) {
  const [valeur, setValeur] = useState(0);

  useEffect(() => {
    if (!actif) return;
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduit || cible === 0) {
      setValeur(cible);
      return;
    }
    const duree = 1100;
    const depart = performance.now();
    let image = 0;
    const avancer = (maintenant: number) => {
      const t = Math.min(1, (maintenant - depart) / duree);
      // Décélération : le chiffre se pose au lieu de s'arrêter net.
      const adouci = 1 - Math.pow(1 - t, 3);
      setValeur(Math.round(cible * adouci));
      if (t < 1) image = requestAnimationFrame(avancer);
    };
    image = requestAnimationFrame(avancer);
    return () => cancelAnimationFrame(image);
  }, [cible, actif]);

  return valeur;
}

function Preuve({ p }: { p: (typeof PREUVES)[number] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vu, setVu] = useState(false);
  const n = useCompteur(p.valeur, vu);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVu(true);
      return;
    }
    const o = new IntersectionObserver(
      (e) => {
        // Intersecter n'est pas la seule raison de compter. Un défilement
        // rapide, une ancre cliquée, un retour sur la page : l'élément se
        // retrouve au-dessus de l'écran sans l'avoir jamais croisé, et le
        // chiffre resterait à zéro pour toujours. Mesuré à la capture — les
        // trois compteurs affichaient 0 après un saut de page.
        if (e.some((x) => x.isIntersecting || x.boundingClientRect.bottom < 0)) {
          setVu(true);
          o.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    o.observe(el);
    return () => o.disconnect();
  }, []);

  return (
    <div ref={ref} className="border-l-2 border-primary/40 pl-4">
      <p className="font-display text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
        {n.toLocaleString('fr-FR')}
        {p.suffixe}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{p.libelle}</p>
      <p className="mt-0.5 text-xs font-medium text-primary">{p.mise}</p>
    </div>
  );
}

export default function Couverture() {
  return (
    <div className="min-h-screen bg-background">
      {/* ---------- Bandeau flottant ---------- */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-4 sm:px-6">
          {/* `LogoMaylary` porte déjà la marque ET le nom : y ajouter un
              libellé le dédoublait. */}
          <Link to="/" aria-label="MayLary Group, accueil">
            <LogoMaylary className="font-display text-white" tailleTexte="text-lg" />
          </Link>
          <div className="flex items-center gap-2">
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

      {/* ---------- Ouverture plein écran ---------- */}
      <section className="relative flex min-h-[92vh] items-center overflow-hidden bg-foreground">
        <img
          src={marque('maylary-group-accueil.png')}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
          onError={(e) => {
            // Si le visuel de marque manque, la photographie du port prend le
            // relais : une couverture sans image n'est pas une couverture.
            e.currentTarget.src = photo('hero-import-maritime.jpg');
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/20" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />

        <div className="relative mx-auto w-full max-w-screen-xl px-4 py-28 sm:px-6">
          <div className="max-w-2xl" data-revele-cascade>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Abidjan · Côte d’Ivoire
            </p>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Faire venir vos marchandises
              <span className="block text-primary">sans mauvaise surprise.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
              Import, export, achat en ligne et conseil douanier. Le prix rendu Abidjan est
              calculé avant que vous commandiez — droits et taxes compris, sur le tarif officiel.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="text-base">
                <Link to="/services">
                  Découvrir MayLary Group
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-white/5 text-base text-white hover:bg-white/15 hover:text-white"
              >
                <Link to="/declarant">Calculer mes droits de douane</Link>
              </Button>
            </div>
          </div>
        </div>

        <a
          href="#metier"
          aria-label="Descendre"
          className="absolute inset-x-0 bottom-6 mx-auto flex w-10 justify-center text-white/60 transition hover:text-white"
        >
          <ChevronDown className="h-6 w-6 animate-bounce" />
        </a>
      </section>

      {/* ---------- Le convoi : les rayons défilent ---------- */}
      <section className="overflow-hidden border-y bg-card py-5" aria-hidden="true">
        <div className="convoi flex w-max gap-3">
          {[...RAYONS, ...RAYONS].map((r, i) => (
            <div
              key={`${r.nom}-${i}`}
              className="relative h-20 w-36 shrink-0 overflow-hidden rounded-md sm:h-24 sm:w-44"
            >
              <img src={r.img} alt="" loading="lazy" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
              <span className="absolute bottom-1.5 left-2 text-[11px] font-semibold text-white">
                {r.nom}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Le métier ---------- */}
      <section id="metier" className="mx-auto max-w-screen-xl scroll-mt-8 px-4 py-20 sm:px-6">
        <div className="max-w-3xl" data-revele>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Nous ne vendons pas du transport.
            <span className="block text-muted-foreground">
              Nous vendons la certitude de ce que vous paierez.
            </span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Un importateur découvre trop souvent le coût réel de son opération à l’arrivée : une
            taxe oubliée, une autorisation manquante, des frais de séjour qui courent au terminal.
            MayLary Group fait le calcul avant — et refuse d’afficher un chiffre qu’il n’a pas
            vérifié.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3" data-revele-cascade>
          {MODES.map((m) => {
            const Icone = m.icone;
            return (
              <article
                key={m.titre}
                className="group overflow-hidden rounded-xl border bg-card transition hover:shadow-lg"
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={m.image}
                    alt={`Transport ${m.titre.toLowerCase()}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-3 left-4 flex items-center gap-2">
                    <Icone className="h-5 w-5 text-white" />
                    <h3 className="font-display text-xl font-bold text-white">{m.titre}</h3>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-foreground">{m.texte}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{m.detail}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ---------- La preuve ---------- */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto max-w-screen-xl px-4 py-20 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div data-revele>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                La preuve, pas la promesse
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Un conteneur, calculé devant vous
              </h2>
              <p className="mt-5 text-muted-foreground">
                Marchandise à 15 000 000 FCFA, groupage maritime depuis la France, position à 20 %
                de droit de douane. Voici ce que notre moteur liquide — droit par droit, sur le
                tarif extérieur commun officiel.
              </p>

              <dl className="mt-8 space-y-2 rounded-lg border bg-card p-5 text-sm">
                {[
                  ['Valeur en douane (CAF)', '16 901 935'],
                  ['Droit de douane 20 %', '3 380 387'],
                  ['TVA 18 %', '3 681 241'],
                  ['Autres droits et redevances', '555 048'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="tabular-nums text-foreground">{v}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-t pt-2 font-semibold">
                  <dt className="text-foreground">Total dû au Trésor</dt>
                  <dd className="tabular-nums text-foreground">7 616 676 FCFA</dd>
                </div>
              </dl>

              <div className="mt-5 rounded-lg border border-primary/40 bg-primary/5 p-4">
                <p className="text-sm text-foreground">
                  <strong>La même marchandise d’origine européenne, avec un certificat EUR.1 :</strong>{' '}
                  le droit de douane tombe à zéro.{' '}
                  <span className="font-semibold text-primary">3 380 387 FCFA économisés</span> —
                  pour un papier que la plupart des importateurs ne pensent pas à demander.
                </p>
              </div>

              <Button asChild variant="outline" className="mt-6">
                <Link to="/declarant">
                  Faire le calcul sur ma marchandise
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-10 self-center">
              {PREUVES.map((p) => (
                <Preuve key={p.libelle} p={p} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Les services ---------- */}
      <section className="mx-auto max-w-screen-xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl" data-revele>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Six manières d’entrer chez nous
          </h2>
          <p className="mt-4 text-muted-foreground">
            Que vous ayez un conteneur à faire venir ou une seule référence à acheter, la porte
            est la même — et le calcul derrière aussi.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-revele-cascade>
          {SERVICES.map((s) => (
            <Link
              key={s.titre}
              to={s.lien}
              className={
                'group relative overflow-hidden rounded-xl border bg-card transition hover:shadow-lg ' +
                (s.phare ? 'sm:col-span-2 lg:col-span-1 lg:row-span-1 ring-1 ring-primary/30' : '')
              }
            >
              <div className="relative h-40 overflow-hidden">
                <img
                  src={s.image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                {s.phare && (
                  <span className="absolute right-3 top-3 rounded bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    Gratuit
                  </span>
                )}
              </div>
              <div className="p-5">
                <h3 className="flex items-center gap-1.5 font-display text-lg font-bold text-foreground">
                  {s.titre}
                  <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.texte}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- La confiance ---------- */}
      <section className="border-y bg-foreground">
        <div className="mx-auto max-w-screen-xl px-4 py-20 sm:px-6">
          <h2
            className="max-w-2xl font-display text-3xl font-bold tracking-tight text-background sm:text-4xl"
            data-revele
          >
            Pourquoi nos clients nous confient leur argent
          </h2>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4" data-revele-cascade>
            {[
              {
                icone: Scale,
                titre: 'Aucun taux inventé',
                texte:
                  'Si une position n’est pas au tarif officiel, nous n’affichons rien — pas même une estimation.',
              },
              {
                icone: ShieldCheck,
                titre: 'Payé, protégé',
                texte:
                  'L’argent d’une commande n’est reversé au vendeur qu’après votre confirmation de réception.',
              },
              {
                icone: Globe2,
                titre: 'Quatre origines',
                texte:
                  'Europe, Maghreb, CEDEAO, reste du monde. Nous comparons le coût rendu Abidjan, pas le prix d’achat.',
              },
              {
                icone: Users,
                titre: 'Un métier, pas un site',
                texte:
                  'MayLary Group est né dans le transit. Nous connaissons le port parce que nous y travaillons.',
              },
            ].map((c) => {
              const Icone = c.icone;
              return (
                <div key={c.titre}>
                  <Icone className="h-6 w-6 text-primary" />
                  <h3 className="mt-3 font-display text-base font-bold text-background">
                    {c.titre}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-background/70">{c.texte}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- Dernier appel ---------- */}
      <section className="relative overflow-hidden">
        <img
          src={photo('carousel-3-livraison.jpg')}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative mx-auto max-w-screen-xl px-4 py-24 text-center sm:px-6">
          <div data-revele>
            <h2 className="mx-auto max-w-3xl font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Dites-nous ce que vous voulez faire venir.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/80">
              Vous aurez un chiffrage complet — marchandise, fret, assurance, douane, livraison —
              avant d’engager le moindre franc.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="text-base">
                <Link to="/import/nouvelle-demande">
                  Demander un devis d’import
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-white/5 text-base text-white hover:bg-white/15 hover:text-white"
              >
                <Link to="/boutique">
                  <Store className="mr-2 h-4 w-4" />
                  Voir la boutique
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-white/5 text-base text-white hover:bg-white/15 hover:text-white"
              >
                <Link to="/boutique/sourcing">
                  <PackageSearch className="mr-2 h-4 w-4" />
                  Faire chercher un produit
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
