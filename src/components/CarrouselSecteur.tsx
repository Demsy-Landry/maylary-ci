import { useEffect, useState } from 'react';

/**
 * Visuels d'un rayon, en défilement lent.
 *
 * Trois partis pris :
 *
 *  - un rayon sans visuel ne rend rien et laisse l'appelant afficher son
 *    illustration dessinée. C'est ce qui permet de remplir les rayons un par un
 *    sans qu'aucune carte ne se retrouve vide en vitrine ;
 *
 *  - un seul visuel ne défile pas. Une animation sur une image unique donne
 *    l'impression d'un défaut ;
 *
 *  - le défilement s'arrête au survol et ne démarre pas du tout si la personne
 *    a demandé à son système de limiter les animations. Un fond qui bouge sans
 *    qu'on l'ait demandé gêne la lecture du titre posé par-dessus.
 */

/** Assez lent pour être lu comme une respiration, pas comme un clignotement. */
const INTERVALLE_MS = 5000;

export default function CarrouselSecteur({
  photos,
  alt,
  className = '',
}: {
  photos: string[];
  alt: string;
  className?: string;
}) {
  const [actif, setActif] = useState(0);
  const [enPause, setEnPause] = useState(false);

  const anime =
    photos.length > 1 &&
    !enPause &&
    typeof window !== 'undefined' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!anime) return;
    const minuterie = window.setInterval(
      () => setActif((i) => (i + 1) % photos.length),
      INTERVALLE_MS,
    );
    return () => window.clearInterval(minuterie);
  }, [anime, photos.length]);

  if (photos.length === 0) return null;

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      onMouseEnter={() => setEnPause(true)}
      onMouseLeave={() => setEnPause(false)}
    >
      {photos.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={i === 0 ? alt : ''}
          loading={i === 0 ? 'eager' : 'lazy'}
          aria-hidden={i !== actif}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            i === actif ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      {photos.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {photos.map((src, i) => (
            <span
              key={src}
              className={`h-1.5 rounded-full transition-all ${
                i === actif ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
