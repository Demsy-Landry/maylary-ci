import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PackageSearch,
  Calculator,
  CheckCircle2,
  Truck,
  ShieldCheck,
  Ship,
  Plane,
  FileCheck2,
  ArrowRight,
  Globe,
  ClipboardList,
  Send,
} from 'lucide-react';
import PublicHeaderImport from '@/components/PublicHeaderImport';
import EmplacementPublicitaire from '@/components/EmplacementPublicitaire';
import BandeServices from '@/components/BandeServices';
import ImageOuverture from '@/components/ImageOuverture';
import SiteFooter from '@/components/SiteFooter';
import { STORAGE_PUBLIC_URL, VISUELS_MARQUE_TABLE, supabase } from '@/lib/supabase';
import { useReferencement } from '@/hooks/useReferencement';
import { PAGES } from '@/lib/referencement-pages';

const STORAGE_BASE = `${STORAGE_PUBLIC_URL}/app_e08c374bc4_produit_photos/accueil`;

/* Les deux ouvertures de l'accueil restent celles d'origine. Les photographies
   de port fournies par le fondateur sont allées aux pages de demande d'import
   et d'export, qui n'avaient aucune image — remplacer ici ce qui existait
   déjà aurait été déshabiller un écran pour en habiller un autre.
   Un visuel activé en base les remplace toujours, sans redéploiement. */
const HERO_IMPORT_IMAGE = `${STORAGE_BASE}/hero-import-maritime.jpg`;

/**
 * Le bandeau d'accueil peut être remplacé depuis la base, sans redéploiement.
 *
 * Les visuels de marque sont produits dans Canva et rapatriés dans le stockage.
 * Tant qu'un visuel n'a pas été activé par quelqu'un qui l'a regardé, l'écran
 * garde celui d'origine : une image jamais vue ne s'affiche pas d'elle-même.
 */
function useVisuelMarque(cle: string, defaut: string): string {
  const [url, setUrl] = useState(defaut);
  useEffect(() => {
    supabase
      .from(VISUELS_MARQUE_TABLE)
      .select('url')
      .eq('cle', cle)
      .eq('actif', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.url) setUrl(data.url as string);
      });
  }, [cle]);
  return url;
}
const HERO_EXPORT_IMAGE = `${STORAGE_BASE}/hero-export-aerien.jpg`;

const MODES_TRANSPORT = [
  { key: 'aerien', label: 'Aérien', image: `${STORAGE_BASE}/mode-aerien.jpg`, icon: Plane },
  { key: 'maritime', label: 'Maritime', image: `${STORAGE_BASE}/mode-maritime.jpg`, icon: Ship },
  { key: 'routier', label: 'Routier', image: `${STORAGE_BASE}/mode-routier.jpg`, icon: Truck },
];

const ETAPES_IMPORT = [
  {
    icon: PackageSearch,
    title: '1. Décrivez votre besoin',
    text: "Un produit, un lien fournisseur, une photo — chez n'importe quel fournisseur, dans n'importe quel pays.",
  },
  {
    icon: Calculator,
    title: '2. Nous chiffrons tout',
    text: 'Marchandise, fret international, assurance, douane et transit local : un devis complet, un seul interlocuteur.',
  },
  {
    icon: CheckCircle2,
    title: '3. Vous validez',
    text: "Vous acceptez le devis, on s'occupe de l'achat et de toute la logistique.",
  },
  {
    icon: Truck,
    title: '4. Livré chez vous',
    text: 'Suivi en temps réel jusqu\'à la livraison dans vos locaux, partout en Côte d\'Ivoire.',
  },
];

const ATOUTS_IMPORT = [
  {
    icon: ShieldCheck,
    title: 'Expertise transit',
    text: "Piloté par une équipe transitaire agréée — pas juste une place de marché, un vrai savoir-faire douane et logistique.",
  },
  {
    icon: Ship,
    title: 'Tous les modes de transport',
    text: 'Aérien, maritime ou routier, et tous les incoterms (EXW, FOB, CIF, DDP...) selon votre besoin.',
  },
  {
    icon: FileCheck2,
    title: 'Douane gérée de bout en bout',
    text: 'Dédouanement pris en charge, documents (factures, BL, déclarations) centralisés et accessibles.',
  },
  {
    icon: Plane,
    title: 'Particuliers & entreprises',
    text: 'Une seule demande, que vous achetiez pour vous-même ou pour approvisionner votre entreprise.',
  },
];

const ETAPES_EXPORT = [
  {
    icon: ClipboardList,
    title: '1. Décrivez votre marchandise',
    text: 'Produit, quantité, pays de destination et acheteur si vous en avez déjà un.',
  },
  {
    icon: Calculator,
    title: '2. Nous chiffrons tout',
    text: 'Transport local, douane export, fret international, assurance et certifications.',
  },
  {
    icon: CheckCircle2,
    title: '3. Vous validez',
    text: 'Vous acceptez le devis, on lance la collecte de votre marchandise.',
  },
  {
    icon: Send,
    title: '4. Livré à votre acheteur',
    text: "Suivi jusqu'à la livraison à destination, où que soit votre acheteur.",
  },
];

const ATOUTS_EXPORT = [
  {
    icon: Globe,
    title: 'Accès aux marchés mondiaux',
    text: "Exportez sans avoir besoin d'un réseau international existant — on s'occupe de la logistique jusqu'à l'acheteur.",
  },
  {
    icon: FileCheck2,
    title: 'Certifications gérées',
    text: "Certificat d'origine, certificat phytosanitaire, déclaration d'exportation — pris en charge de bout en bout.",
  },
  {
    icon: Ship,
    title: 'Tous les modes de transport',
    text: 'Aérien, maritime ou routier selon la nature et la destination de votre marchandise.',
  },
  {
    icon: ShieldCheck,
    title: 'Expertise transit',
    text: 'Même équipe transitaire agréée que pour vos imports — un seul partenaire pour tout votre commerce international.',
  },
];

export default function Index() {
  useReferencement(PAGES["/services"]);

  // La photographie d'origine reste le fond par défaut. L'illustration dessinée
  // ne sert que si la photo venait à manquer — elle évite une page nue, elle ne
  // la remplace pas.
  const heroAccueil = useVisuelMarque('accueil_hero', HERO_IMPORT_IMAGE);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderImport />

      <main className="entree-page">
        <section className="relative overflow-hidden border-b text-background">
          {/* L'illustration remplace la photographie de fond : dessinée pour
              cette page, elle garde sa gauche sombre pour le titre et reste
              nette à toute taille. Un visuel activé en base la remplace. */}
          {heroAccueil.startsWith('/') ? (
            <ImageOuverture
              src={heroAccueil}
              alt=""
              largeur={1168}
              hauteur={784}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <img
              src={heroAccueil}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/75 to-foreground/25 sm:bg-gradient-to-r sm:from-foreground sm:via-foreground/85 sm:to-foreground/50" />
          <div className="relative mx-auto max-w-screen-xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary-foreground">
                <PackageSearch className="h-3.5 w-3.5" />
                MayLary Group Import
              </span>
              <h1 className="font-display mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">
                Achetez n'importe où dans le monde.
                <br />
                On s'occupe de tout, jusqu'à votre porte.
              </h1>
              <p className="mt-4 max-w-xl text-base text-background/80 sm:text-lg">
                Sourcing, achat, fret international, douane, transit local et livraison : une
                seule demande, un devis clair, un suivi de bout en bout — pour les particuliers
                comme pour les entreprises de Côte d'Ivoire.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/import/nouvelle-demande"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-primary-emphasis"
                >
                  Faire une demande d'import
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#comment-ca-marche"
                  className="inline-flex items-center gap-2 rounded-md border border-background/30 px-6 py-3 text-sm font-semibold text-background hover:bg-background/10"
                >
                  Comment ça marche
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Placée ici et pas plus bas : c'est le premier endroit où le visiteur
            regarde après le hero, et la moitié de l'offre lui était invisible
            tant qu'il ne déroulait pas la page entière. */}
        <BandeServices />

        <section data-revele id="comment-ca-marche" className="mx-auto max-w-screen-xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-center text-xl font-extrabold uppercase tracking-tight text-foreground sm:text-2xl">
            Comment ça marche
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ETAPES_IMPORT.map((etape) => (
              <div
                key={etape.title}
                className="carte-reactive rounded-lg border bg-card p-5"
              >
                <etape.icon className="h-6 w-6 text-primary" />
                <h3 className="font-display mt-3 font-bold text-foreground">{etape.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{etape.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              to="/import/nouvelle-demande"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 hover:bg-primary-emphasis"
            >
              Commencer ma demande
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section data-revele className="border-y bg-muted/40">
          <div className="mx-auto max-w-screen-xl px-4 py-14 sm:px-6">
            <h2 className="font-display text-center text-xl font-extrabold uppercase tracking-tight text-foreground sm:text-2xl">
              Pourquoi MayLary Group Import
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ATOUTS_IMPORT.map((atout) => (
                <div key={atout.title} className="rounded-lg border bg-card p-5">
                  <atout.icon className="h-6 w-6 text-primary" />
                  <h3 className="font-display mt-3 font-bold text-foreground">{atout.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{atout.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section data-revele className="mx-auto max-w-screen-xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-center text-xl font-extrabold uppercase tracking-tight text-foreground sm:text-2xl">
            Tous les modes de transport
          </h2>
          <p className="mx-auto mt-1 max-w-prose text-center text-sm text-muted-foreground">
            Aérien, maritime ou routier — nous choisissons le mode adapté à votre marchandise, votre
            délai et votre budget.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {MODES_TRANSPORT.map((mode) => (
              <div
                key={mode.key}
                className="group relative h-56 overflow-hidden rounded-lg border shadow-sm"
              >
                <img
                  src={mode.image}
                  alt={mode.label}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/10 to-transparent" />
                <div className="absolute bottom-4 left-4 flex items-center gap-2 text-background">
                  <mode.icon className="h-5 w-5" />
                  <span className="font-display text-lg font-bold">{mode.label}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section data-revele className="relative overflow-hidden border-y text-background">
          <ImageOuverture
            src={HERO_EXPORT_IMAGE}
            alt=""
            largeur={1168}
            hauteur={784}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/75 to-foreground/25 sm:bg-gradient-to-r sm:from-foreground sm:via-foreground/85 sm:to-foreground/50" />
          <div className="relative mx-auto max-w-screen-xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary-foreground">
                <Globe className="h-3.5 w-3.5" />
                MayLary Group Export
              </span>
              <h2 className="font-display mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
                Vous produisez en Côte d'Ivoire ? Exportez vers le monde entier.
              </h2>
              <p className="mt-4 max-w-xl text-base text-background/80 sm:text-lg">
                Collecte, dédouanement à l'export, fret international, certifications (origine,
                phytosanitaire) et livraison à votre acheteur — un seul devis, un seul
                interlocuteur.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/export/nouvelle-demande"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-primary-emphasis"
                >
                  Faire une demande d'export
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#comment-exporter"
                  className="inline-flex items-center gap-2 rounded-md border border-background/30 px-6 py-3 text-sm font-semibold text-background hover:bg-background/10"
                >
                  Comment ça marche
                </a>
              </div>
            </div>
          </div>
        </section>

        <section data-revele id="comment-exporter" className="mx-auto max-w-screen-xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-center text-xl font-extrabold uppercase tracking-tight text-foreground sm:text-2xl">
            Comment exporter avec MayLary Group
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ETAPES_EXPORT.map((etape) => (
              <div
                key={etape.title}
                className="carte-reactive rounded-lg border bg-card p-5"
              >
                <etape.icon className="h-6 w-6 text-primary" />
                <h3 className="font-display mt-3 font-bold text-foreground">{etape.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{etape.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section data-revele className="border-y bg-muted/40">
          <div className="mx-auto max-w-screen-xl px-4 py-14 sm:px-6">
            <h2 className="font-display text-center text-xl font-extrabold uppercase tracking-tight text-foreground sm:text-2xl">
              Pourquoi exporter avec MayLary Group
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ATOUTS_EXPORT.map((atout) => (
                <div key={atout.title} className="rounded-lg border bg-card p-5">
                  <atout.icon className="h-6 w-6 text-primary" />
                  <h3 className="font-display mt-3 font-bold text-foreground">{atout.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{atout.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                to="/export/nouvelle-demande"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 hover:bg-primary-emphasis"
              >
                Commencer ma demande d'export
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Emplacement publicitaire : rien ne s'affiche tant qu'aucune annonce
            n'est vendue. Un cadre « espace disponible » dirait surtout que nous
            n'avons pas d'annonceurs. */}
        <div data-revele className="mx-auto max-w-screen-xl px-4 pb-14 sm:px-6">
          <EmplacementPublicitaire code="accueil_bas" />
        </div>

      </main>

      <SiteFooter />
    </div>
  );
}
