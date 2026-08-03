import { Star } from 'lucide-react';

interface NoteEtoilesProps {
  /** Note sur 5. Les valeurs décimales remplissent partiellement l'étoile. */
  note: number;
  /** Taille en pixels d'une étoile. */
  taille?: number;
  /** Rend les étoiles cliquables et remonte la note choisie. */
  onChange?: (note: number) => void;
  className?: string;
}

/**
 * Cinq étoiles, en lecture ou en saisie.
 *
 * L'affichage part d'une moyenne, donc d'un nombre à virgule : 4,3 doit se voir
 * comme quatre étoiles pleines et un tiers de la cinquième, pas comme un
 * arrondi à quatre. Le remplissage partiel se fait par une étoile pleine
 * superposée à une étoile vide et rognée à la largeur voulue — plus fidèle
 * qu'une demi-étoile, et sans dépendance supplémentaire.
 */
export default function NoteEtoiles({ note, taille = 16, onChange, className }: NoteEtoilesProps) {
  const saisissable = typeof onChange === 'function';

  return (
    <div
      className={`inline-flex items-center gap-0.5 ${className ?? ''}`}
      role={saisissable ? 'radiogroup' : 'img'}
      aria-label={saisissable ? 'Votre note' : `Note de ${note.toFixed(1)} sur 5`}
    >
      {[1, 2, 3, 4, 5].map((rang) => {
        // Part de cette étoile-ci qui doit être colorée, entre 0 et 1.
        const remplissage = Math.max(0, Math.min(1, note - (rang - 1)));

        const etoile = (
          <span className="relative inline-block" style={{ width: taille, height: taille }}>
            <Star
              className="absolute inset-0 text-muted-foreground/40"
              style={{ width: taille, height: taille }}
            />
            {remplissage > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${remplissage * 100}%` }}
              >
                <Star
                  className="fill-amber-400 text-amber-400"
                  style={{ width: taille, height: taille }}
                />
              </span>
            )}
          </span>
        );

        if (!saisissable) return <span key={rang}>{etoile}</span>;

        return (
          <button
            key={rang}
            type="button"
            role="radio"
            aria-checked={Math.round(note) === rang}
            aria-label={`${rang} étoile${rang > 1 ? 's' : ''}`}
            onClick={() => onChange(rang)}
            className="rounded transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {etoile}
          </button>
        );
      })}
    </div>
  );
}
