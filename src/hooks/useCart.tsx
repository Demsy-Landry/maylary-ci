import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { lireListeStockee, ecrireListeStockee } from '@/lib/stockage-local';

export interface CartItem {
  produit_id: string;
  nom: string;
  prix_unitaire_fcfa: number;
  quantite: number;
  photo: string | null;
  enseigne_id: string;
  enseigne_nom: string;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantite'>, quantite?: number) => void;
  updateQuantite: (produit_id: string, quantite: number) => void;
  removeItem: (produit_id: string) => void;
  clearCart: () => void;
  loadItems: (items: CartItem[]) => void;
  totalFcfa: number;
  totalArticles: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);
const STORAGE_KEY = 'maylary_panier_devis';

/**
 * Une ligne de panier utilisable.
 *
 * Le minimum sans lequel l'affichage et les totaux lèveraient : un identifiant
 * et une quantité qui est un nombre. Le reste se rattrape à l'écran ; ces
 * deux-là, non.
 */
const estLigneValide = (e: unknown): e is CartItem =>
  typeof e === 'object' &&
  e !== null &&
  typeof (e as CartItem).produit_id === 'string' &&
  Number.isFinite((e as CartItem).quantite);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() =>
    lireListeStockee(STORAGE_KEY, estLigneValide),
  );

  useEffect(() => {
    ecrireListeStockee(STORAGE_KEY, items);
  }, [items]);

  const addItem = (item: Omit<CartItem, 'quantite'>, quantite = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.produit_id === item.produit_id);
      if (existing) {
        return prev.map((i) =>
          i.produit_id === item.produit_id ? { ...i, quantite: i.quantite + quantite } : i,
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
    setItems((prev) => prev.map((i) => (i.produit_id === produit_id ? { ...i, quantite } : i)));
  };

  const removeItem = (produit_id: string) => {
    setItems((prev) => prev.filter((i) => i.produit_id !== produit_id));
  };

  const clearCart = () => setItems([]);

  const loadItems = (newItems: CartItem[]) => setItems(newItems);

  const totalFcfa = items.reduce((sum, i) => sum + i.prix_unitaire_fcfa * i.quantite, 0);
  const totalArticles = items.reduce((sum, i) => sum + i.quantite, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantite,
        removeItem,
        clearCart,
        loadItems,
        totalFcfa,
        totalArticles,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
