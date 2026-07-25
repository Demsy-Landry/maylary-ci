import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

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

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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
