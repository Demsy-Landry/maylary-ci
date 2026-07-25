import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface CartItemGP {
  produit_id: string;
  nom: string;
  prix_unitaire_fcfa: number;
  quantite: number;
  photo: string | null;
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
      prev.map((i) => (i.produit_id === produit_id ? { ...i, quantite } : i))
    );
  };

  const removeItem = (produit_id: string) => {
    setItems((prev) => prev.filter((i) => i.produit_id !== produit_id));
  };

  const clearCart = () => setItems([]);

  const totalFcfa = items.reduce((sum, i) => sum + i.prix_unitaire_fcfa * i.quantite, 0);
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
