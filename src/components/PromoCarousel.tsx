import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShoppingBag, Building2, Truck } from 'lucide-react';

interface Slide {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  icon: typeof ShoppingBag;
  gradient: string;
}

const SLIDES: Slide[] = [
  {
    eyebrow: "Côte d'Ivoire",
    title: 'Vos achats, en ligne, en toute confiance.',
    subtitle: 'Des produits tendance, livrés partout en Côte d\'Ivoire.',
    ctaLabel: 'Découvrir la boutique',
    ctaHref: '/boutique',
    icon: ShoppingBag,
    gradient: 'from-primary/25 via-primary/10 to-transparent',
  },
  {
    eyebrow: 'Entreprises',
    title: "Votre approvisionnement professionnel, simplifié.",
    subtitle: 'Mobilier, quincaillerie, automobile, tech et textile — demandez un devis.',
    ctaLabel: 'Voir l’Espace Pro',
    ctaHref: '/catalogue',
    icon: Building2,
    gradient: 'from-accent/25 via-accent/10 to-transparent',
  },
  {
    eyebrow: 'Livraison',
    title: 'Suivi de commande, du paiement à la livraison.',
    subtitle: 'Mobile Money ou virement, et un suivi clair à chaque étape.',
    ctaLabel: 'Comment ça marche',
    ctaHref: '/boutique',
    icon: Truck,
    gradient: 'from-secondary via-secondary/40 to-transparent',
  },
];

export default function PromoCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[index];
  const Icon = slide.icon;

  const goTo = (i: number) => setIndex((i + SLIDES.length) % SLIDES.length);

  return (
    <section className="relative overflow-hidden bg-secondary/40">
      <div className={`absolute inset-0 bg-gradient-to-br ${slide.gradient}`} />

      <div className="relative mx-auto max-w-screen-xl px-4 py-14 sm:px-6 sm:py-20">
        <div
          key={index}
          className="max-w-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary-emphasis">
            <Icon className="h-5 w-5" />
          </div>
          <p className="mt-4 text-sm font-bold uppercase tracking-widest text-primary-emphasis">
            {slide.eyebrow}
          </p>
          <h1 className="font-display mt-2 text-3xl font-extrabold leading-tight tracking-tight text-foreground text-balance sm:text-4xl">
            {slide.title}
          </h1>
          <p className="mt-3 max-w-prose text-base text-muted-foreground">{slide.subtitle}</p>
          <Link
            to={slide.ctaHref}
            className="mt-6 inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-emphasis hover:text-primary-foreground"
          >
            {slide.ctaLabel}
          </Link>
        </div>
      </div>

      <button
        aria-label="Précédent"
        onClick={() => goTo(index - 1)}
        className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm hover:bg-background sm:flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        aria-label="Suivant"
        onClick={() => goTo(index + 1)}
        className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm hover:bg-background sm:flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            aria-label={`Aller à la diapositive ${i + 1}`}
            onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? 'w-6 bg-primary' : 'w-1.5 bg-foreground/20'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
