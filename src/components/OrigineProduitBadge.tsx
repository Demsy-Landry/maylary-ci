import { Globe2, Store } from 'lucide-react';
import { ORIGINE_PRODUIT_LABELS, type OrigineProduit } from '@/lib/supabase';
import { cn } from '@/lib/utils';

/**
 * Indique au client si l'article part d'un stock local (livraison rapide) ou
 * s'il est commandé à l'international par Maylary (délai plus long). C'est
 * l'information dont il a besoin pour choisir en connaissance de cause ; le
 * fournisseur réel n'est jamais nommé.
 */
export default function OrigineProduitBadge({
  origine,
  taille = 'normale',
  className,
}: {
  origine: OrigineProduit;
  taille?: 'compacte' | 'normale';
  className?: string;
}) {
  const estImport = origine === 'import_international';
  const Icone = estImport ? Globe2 : Store;

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full border font-medium',
        taille === 'compacte' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        estImport
          ? 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
        className,
      )}
    >
      <Icone className={taille === 'compacte' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {ORIGINE_PRODUIT_LABELS[origine]}
    </span>
  );
}
