import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import type { Produit } from '@/lib/supabase';

export default function RecommendationBlock({
  title,
  produits,
  viewAllHref,
}: {
  title: string;
  produits: Produit[];
  viewAllHref: string;
}) {
  if (produits.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {produits.slice(0, 4).map((p) => (
          <Link
            key={p.id}
            to={`/boutique/produit/${p.id}`}
            className="group flex flex-col items-center rounded-md p-1 text-center hover:bg-muted"
          >
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden bg-white">
              {p.photos?.[0] ? (
                <img
                  src={p.photos[0]}
                  alt={p.nom}
                  className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <ImageOff className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs text-foreground">{p.nom}</p>
          </Link>
        ))}
      </div>
      <Link
        to={viewAllHref}
        className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
      >
        Voir plus
      </Link>
    </div>
  );
}
