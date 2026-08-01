/**
 * Grilles de prix dégressives des produits affichés.
 *
 * Les paliers vivent dans leur propre table : un produit peut en avoir plusieurs
 * ou aucun. On les charge en une requête pour toute une liste de produits plutôt
 * qu'une requête par carte.
 */
import { useEffect, useState } from 'react';
import { supabase, PALIERS_PRIX_PUBLIC_VIEW } from '@/lib/supabase';
import type { PalierPrix } from '@/lib/cout-import';

type GrillesParProduit = Record<string, PalierPrix[]>;

export function usePaliers(produitIds: string[]): GrillesParProduit {
  const [grilles, setGrilles] = useState<GrillesParProduit>({});
  // Les tableaux changent d'identité à chaque rendu : on compare le contenu.
  const cle = [...produitIds].sort().join('|');

  useEffect(() => {
    if (produitIds.length === 0) {
      setGrilles({});
      return;
    }
    let annule = false;

    supabase
      .from(PALIERS_PRIX_PUBLIC_VIEW)
      .select('produit_id, quantite_min, prix_unitaire_fcfa')
      .in('produit_id', produitIds)
      .order('quantite_min')
      .then(({ data }) => {
        if (annule) return;
        const parProduit: GrillesParProduit = {};
        for (const ligne of data ?? []) {
          const l = ligne as { produit_id: string; quantite_min: number; prix_unitaire_fcfa: number };
          (parProduit[l.produit_id] ??= []).push({
            quantite_min: Number(l.quantite_min),
            prix_unitaire_fcfa: Number(l.prix_unitaire_fcfa),
          });
        }
        setGrilles(parProduit);
      });

    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  return grilles;
}
