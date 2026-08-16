import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Lock, ArrowRight } from 'lucide-react';

/**
 * Notre système intelligent — la version que le public a le droit de lire.
 *
 * DEUX REPROCHES DU FONDATEUR, TOUS DEUX FONDÉS
 *
 * **« Tu donnes trop de détails qui doivent être aux administrateurs. »** La
 * première version détaillait, fonction par fonction, quelle IA travaille où et
 * quel garde-fou la borne : classification, rédaction des fiches, génération
 * des visuels. C'est la carte de notre chaîne de production. Un concurrent la
 * lit et sait exactement comment nous refaire — et un client n'en a aucun
 * usage. Ces détails restent à l'administration.
 *
 * **« C'est Claude qui dirige toute l'application. »** Exact, et la première
 * version le noyait : en nommant une IA par fonction, elle mettait sur le même
 * plan l'outil qui dirige et celui qui dépanne. On nomme donc Claude, et lui
 * seul.
 *
 * CE QUI RESTE, ET POURQUOI
 *
 * La moitié « ce que l'IA ne décide pas ». Ce n'est pas une précaution
 * juridique, c'est l'argument de vente : n'importe qui peut brancher un modèle
 * sur un chiffrage douanier et sortir un nombre convaincant. Ce qui distingue
 * MayLary, c'est que les droits sortent du Tarif Extérieur Commun et qu'un code
 * absent du tarif fait REFUSER le calcul.
 *
 * Rien ici n'est lu en base : il n'y a plus de nom réglable à afficher, donc
 * plus d'appel réseau et plus rien à faire fuir.
 */
export default function SystemeIntelligent() {
  const jamais = [
    'Les droits et taxes de douane — calculés sur le Tarif Extérieur Commun officiel, ligne par ligne, assiette par assiette.',
    'Le prix que vous payez — une formule, pas une estimation.',
    'Le coût du transport — les grilles réelles des transporteurs.',
    'La position de vos colis — relevée chez le transporteur, ou constatée par nous sur place. Jamais supposée.',
  ];

  return (
    <section className="border-t bg-card">
      <div className="mx-auto max-w-screen-xl px-4 py-16 sm:px-6 sm:py-20">
        <div data-revele className="max-w-3xl">
          <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary-emphasis">
            <Sparkles className="h-3.5 w-3.5" />
            Notre système intelligent
          </Badge>
          <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            L’intelligence artificielle nous fait gagner du temps.
            <span className="mt-1 block text-muted-foreground">
              Elle ne décide jamais de ce que vous payez.
            </span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            La maison est assistée par l’IA partout où elle peut l’être — classement douanier,
            préparation des dossiers, réponses à vos questions. Elle est dirigée par{' '}
            <strong className="font-semibold text-foreground">Claude, d’Anthropic</strong>. Ce qui
            compte davantage, c’est là où elle n’entre pas.
          </p>
        </div>

        <div
          data-revele
          className="mt-8 rounded-lg border border-primary/30 bg-primary/[0.04] p-5 sm:p-6"
        >
          <p className="flex items-center gap-2 font-display font-bold text-foreground">
            <Lock className="h-4 w-4 text-primary" />
            Ce que l’IA ne décide pas, et ne décidera pas
          </p>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {jamais.map((j) => (
              <li key={j} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {j}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-foreground">
            Un taux de douane inventé engage votre trésorerie et votre responsabilité. Nous
            préférons vous dire « ce code n’est pas au tarif, il faut le vérifier » plutôt que vous
            donner un nombre qui a l’air juste.
          </p>
          <Link
            to="/declarant"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-emphasis hover:underline"
          >
            Voir Le Déclarant en détail
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
