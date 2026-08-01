import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { prixPourQuantite, type PalierPrix } from '@/lib/cout-import';

export interface CartItemGP {
  produit_id: string;
  nom: string;
  /** Prix du palier d'entrée, appliqué tant qu'aucun seuil de gros n'est atteint. */
  prix_unitaire_fcfa: number;
  quantite: number;
  photo: string | null;
  /** Quantité minimum de vente : le lot dilue la part fixe du transport. */
  quantite_minimum?: number;
  /** Grille dégressive du produit. Vide pour un article vendu à prix unique. */
  paliers?: PalierPrix[];
}

/**
 * Prix réellement facturé pour une ligne, une fois la grille de gros appliquée.
 * Le panier ne fige pas le prix à l'ajout : il suit la quantité.
 */
export function prixLigne(item: CartItemGP): number {
  return prixPourQuantite(item.paliers ?? [], item.prix_unitaire_fcfa, item.quantite);
}

interface CartGPContextValue {
  items: CartItemGP[];
  addItem: (item: Omit<CartItemGP, 'quantite'>, quantite?: number) => void;
  updateQuantite: (produit_id: string, quantite: number) => void;
  removeItem: (produit_id: string) => void;
  clearCart: () => void;
  totalFcfa: number;
  totalArticles: number;
}

const CartGPContext = createContext<CartGPContextValue | undefined>(undefined);
const STORAGE_KEY = 'maylary_panier_achat_gp';

export function CartGPProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItemGP[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItemGP[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (item: Omit<CartItemGP, 'quantite'>, quantite = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.produit_id === item.produit_id);
      if (existing) {
        return prev.map((i) =>
          i.produit_id === item.produit_id ? { ...i, quantite: i.quantite + quantite } : i
        );
      }
      return [...prev, { ...item, quantite }];
    });
  };

  const updateQuantite = (produit_id: string, quantite: number) => {
    if (quantite <= 0) {
      removeItem(produit_id);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.produit_id === produit_id
          ? // On ne descend pas sous la quantité minimum de vente : en dessous,
            // la part fixe du transport ne serait plus couverte.
            { ...i, quantite: Math.max(quantite, i.quantite_minimum ?? 1) }
          : i,
      ),
    );
  };

  const removeItem = (produit_id: string) => {
    setItems((prev) => prev.filter((i) => i.produit_id !== produit_id));
  };

  const clearCart = () => setItems([]);

  const totalFcfa = items.reduce((sum, i) => sum + prixLigne(i) * i.quantite, 0);
  const totalArticles = items.reduce((sum, i) => sum + i.quantite, 0);

  return (
    <CartGPContext.Provider
      value={{ items, addItem, updateQuantite, removeItem, clearCart, totalFcfa, totalArticles }}
    >
      {children}
    </CartGPContext.Provider>
  );
}

export function useCartGP() {
  const ctx = useContext(CartGPContext);
  if (!ctx) throw new Error('useCartGP must be used within CartGPProvider');
  return ctx;
}
