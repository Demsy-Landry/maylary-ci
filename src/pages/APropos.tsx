import PublicHeaderImport from '@/components/PublicHeaderImport';
import SiteFooter from '@/components/SiteFooter';
import { Link } from 'react-router-dom';
import { MarqueMaylary } from '@/components/MarqueMaylary';
import ImageOuverture from '@/components/ImageOuverture';
import { Button } from '@/components/ui/button';
import { useReferencement } from '@/hooks/useReferencement';
import {
  Ship,
  PackageSearch,
  ShieldCheck,
  Search,
  ShoppingBag,
  Building2,
  Users,
  Lock,
} from 'lucide-react';

/**
 * Ce que MayLary Group fait, et ce qu'il ne fait pas.
 *
 * La page précédente parlait surtout de qui a écrit le code. Elle répondait à
 * une question que personne ne pose. Un client qui arrive ici veut savoir ce
 * qu'on sait faire, ce que ça change pour lui, et à qui il confie sa
 * marchandise — dans cet ordre.
 *
 * Un point de méthode qui vaut d'être écrit : la barrière à l'entrée de ce
 * métier n'est pas technique, elle est réglementaire. Le dédouanement engage la
 * signature d'un commissionnaire agréé. C'est ce que la page met en avant,
 * parce que c'est ce qui distingue MayLary Group d'un site de commande.
 */

const SERVICES = [
  {
    icone: Ship,
    titre: 'Import',
    texte:
      "Vous décrivez ce que vous voulez acheter à l'étranger. Nous chiffrons la marchandise, le fret, l'assurance, les droits et taxes, le transit local et la livraison — puis nous exécutons.",
    lien: '/import',
  },
  {
    icone: PackageSearch,
    titre: 'Export',
    texte:
      "Collecte chez vous, dédouanement export, expédition et suivi jusqu'à votre acheteur. À l'exportation, seul le timbre statistique est dû — le reste, c'est du transport et de la conformité.",
    lien: '/export',
  },
  {
    icone: ShieldCheck,
    titre: 'Le Déclarant',
    texte:
      "Position tarifaire, classification assistée, calcul des droits et taxes, bulletin de liquidation imprimable. Les taux viennent du TEC UEMOA officiel — 6 298 codes, aucun taux estimé.",
    lien: '/declarant',
  },
  {
    icone: Search,
    titre: 'Sourcing',
    texte:
      "Vous savez ce que vous voulez mais pas où le trouver. Nous cherchons le fournisseur, nous vérifions sa fiabilité, et nous vous rendons un dossier chiffré.",
    lien: '/boutique/sourcing',
  },
  {
    icone: ShoppingBag,
    titre: 'Boutique',
    texte:
      "Un catalogue prêt à commander, prix rendu, livré partout en Côte d'Ivoire. Pour ce qui ne justifie pas une opération d'import sur mesure.",
    lien: '/boutique',
  },
  {
    icone: Building2,
    titre: 'Espace Pro',
    texte:
      'Catalogue professionnel, devis sur volumes, paliers de prix dégressifs. Pour les entreprises qui achètent régulièrement.',
    lien: '/catalogue',
  },
  {
    icone: Users,
    titre: 'Achat groupé',
    texte:
      "Plusieurs acheteurs réunis sur une même référence pour atteindre un prix de gros. Le prix est ferme dès la publication et ne bouge pas si le groupe grossit.",
    lien: '/boutique/achats-groupes',
  },
];

export default function APropos() {
  useReferencement({
    titre: "À propos de MayLary Group",
    description:
      "Qui nous sommes, ce que nous prenons en charge dans une opération d'import ou d'export, et où s'arrête notre rôle. MayLary Group est une marque de Dems'Inc, à Abidjan.",
  });

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderImport />
      {/* Le bureau à la baie vitrée, au crépuscule, le port derrière. Cette
          page-ci n'a pas de formulaire à protéger : l'ouverture peut donc
          respirer plus qu'ailleurs. Et c'est la seule page où une photographie
          de nos murs dit quelque chose de vrai — les autres parlent d'un
          service, celle-ci parle de la maison. */}
      <section className="relative flex h-48 items-end overflow-hidden bg-foreground sm:h-64">
        <ImageOuverture
          src="/visuels/bureau-vue-port.jpg"
          alt=""
          largeur={784}
          hauteur={1168}
          className="absolute inset-0 h-full w-full object-cover object-center opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/70 to-foreground/20" />
        <div className="relative mx-auto w-full max-w-screen-lg px-4 pb-5 sm:px-6">
          <p className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-primary">
            Dems'Inc — Abidjan, Côte d'Ivoire
          </p>
        </div>
      </section>
      <main className="entree-page mx-auto max-w-screen-lg px-4 py-12 sm:px-6">
        <div className="flex items-start gap-4">
          <MarqueMaylary className="h-14 w-14 rounded-xl" />
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-extrabold text-foreground">
              MayLary Group
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Transit, import, export et approvisionnement — Abidjan, Côte d'Ivoire
            </p>
          </div>
        </div>

        <p className="mt-8 max-w-prose text-base text-foreground">
          MayLary Group réunit sous un même toit ce qu'un importateur ivoirien doit aujourd'hui
          aller chercher chez quatre interlocuteurs différents : trouver le fournisseur, payer la
          marchandise, l'acheminer, la dédouaner, la faire livrer. Nous faisons les cinq.
        </p>
        <p className="mt-4 max-w-prose text-base text-muted-foreground">
          Ce qui nous distingue d'un site de commande tient en une ligne : le dédouanement engage la
          signature d'un <strong className="text-foreground">commissionnaire en douane agréé</strong>.
          C'est une responsabilité, pas une fonctionnalité — et c'est elle qui permet de chiffrer
          une opération avant de la lancer, au lieu de découvrir la facture douanière à l'arrivée.
        </p>

        <h2 data-revele className="font-display mt-12 text-xl font-extrabold text-foreground">Nos services</h2>
        <div data-revele data-revele-cascade className="mt-4 grid gap-4 sm:grid-cols-2">
          {SERVICES.map(({ icone: Icone, titre, texte, lien }) => (
            <Link
              key={titre}
              to={lien}
              className="group rounded-lg border bg-card p-5 transition hover:border-primary/50 hover:shadow-sm"
            >
              <Icone className="h-6 w-6 text-primary" />
              <h3 className="font-display mt-3 font-bold text-foreground group-hover:text-primary">
                {titre}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{texte}</p>
            </Link>
          ))}
        </div>

        <h2 data-revele className="font-display mt-12 text-xl font-extrabold text-foreground">
          Deux engagements qui ne se négocient pas
        </h2>
        <div data-revele data-revele-cascade className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-5">
            <Lock className="h-6 w-6 text-primary" />
            <h3 className="font-display mt-3 font-bold text-foreground">Payé, protégé</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Le paiement du fournisseur est retenu jusqu'à ce que vous confirmiez la réception. Ce
              n'est pas une promesse commerciale : c'est un mécanisme, et il est dans le code.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h3 className="font-display mt-3 font-bold text-foreground">Aucun taux inventé</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Un droit de douane vient du tarif officiel ou n'est pas affiché. Quand une donnée
              manque, nos écrans le disent au lieu de combler par une estimation — parce qu'un
              chiffre affiché devient un chiffre sur lequel quelqu'un s'engage.
            </p>
          </div>
        </div>

        <h2 data-revele className="font-display mt-12 text-xl font-extrabold text-foreground">Qui nous sommes</h2>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          MayLary Group est édité par <strong className="text-foreground">Dems'Inc</strong>, fondée
          par <strong className="text-foreground">Demsy Landry</strong>, responsable adjoint Aérien,
          Dégroupage et Express chez E-Transit, transitaire agréé à Abidjan. L'entreprise est née
          d'un constat de terrain : les outils qui existent servent les grands chargeurs, et
          laissent le petit importateur payer plus cher un service moins clair.
        </p>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          La plateforme est développée par Dems'Inc avec l'assistance de Claude Code.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/import">Faire une demande d'import</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/declarant">Essayer Le Déclarant</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
