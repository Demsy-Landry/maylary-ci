import { useEffect, useState } from 'react';
import { supabase, AVIS_PUBLIC_VIEW, type AvisPublic } from '@/lib/supabase';
import NoteEtoiles from '@/components/NoteEtoiles';

interface AvisProduitProps {
  produitId: string;
}

/**
 * Avis publiés d'un article.
 *
 * Rien ne s'affiche tant qu'aucun client n'a noté : une note vide, un « 0 avis »
 * ou cinq étoiles grises donneraient l'impression d'un article mal jugé, alors
 * qu'il n'a simplement pas encore été livré. Le silence est plus honnête.
 */
export default function AvisProduit({ produitId }: AvisProduitProps) {
  const [avis, setAvis] = useState<AvisPublic[]>([]);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from(AVIS_PUBLIC_VIEW)
        .select('*')
        .eq('produit_id', produitId)
        .order('created_at', { ascending: false })
        .limit(20);
      setAvis((data as AvisPublic[]) ?? []);
      setCharge(true);
    };
    load();
  }, [produitId]);

  if (!charge || avis.length === 0) return null;

  const moyenne = avis.reduce((somme, a) => somme + a.note, 0) / avis.length;

  return (
    <div className="mt-6 rounded-md border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <NoteEtoiles note={moyenne} taille={18} />
        <span className="text-sm font-semibold text-foreground">{moyenne.toFixed(1)} / 5</span>
        <span className="text-sm text-muted-foreground">
          · {avis.length} avis {avis.length > 1 ? 'clients' : 'client'}
        </span>
      </div>

      {/* Ce que valent ces avis tient à leur provenance : ils ne viennent que de
          commandes livrées, et un client ne peut noter que ce qu'il a reçu. */}
      <p className="mt-1 text-xs text-muted-foreground">
        Avis de clients MayLary Group ayant reçu cet article.
      </p>

      <div className="mt-4 space-y-3">
        {avis
          .filter((a) => a.commentaire)
          .map((a) => (
            <div key={a.id} className="border-t pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-center gap-2">
                <NoteEtoiles note={a.note} taille={13} />
                <span className="text-xs font-medium text-foreground">{a.auteur}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground">{a.commentaire}</p>
            </div>
          ))}
      </div>
    </div>
  );
}
