import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { prixPourQuantite, type PalierPrix } from '@/lib/cout-import';
import type { ModeAcheminement } from '@/lib/marge-chaine';
import { lireListeStockee, ecrireListeStockee } from '@/lib/stockage-local';

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
  /**
   * PAR OÙ CET ARTICLE ARRIVE, ET POURQUOI C'EST DANS LE PANIER
   *
   * `cj_ddp` : CJ a coté le fret et livre droits acquittés. La commande part
   * tout de suite, et le client est livré en une à trois semaines.
   *
   * `groupage` : CJ ne cote pas cet article. Il part par notre consolidation
   * maritime, ce qui veut dire attendre le départ d'une campagne — mais aussi
   * un fret divisé par trente.
   *
   * Les deux ne peuvent pas voyager ensemble. Un panier qui les mélangerait
   * ferait attendre six semaines un article qui pouvait partir demain, ou
   * ferait payer l'express à un article qui n'en a pas besoin. D'où la
   * séparation, faite ici plutôt que laissée à la vigilance du client.
   */
  mode_acheminement?: ModeAcheminement;
  /**
   * LA DÉCLINAISON CHOISIE — TAILLE, COULEUR, OU LES DEUX
   *
   * Sans elle, le fournisseur recevait la première déclinaison venue. Mesuré le
   * 31 août sur « Robe fleurie col V » : quinze déclinaisons existaient, et
   * toute cliente aurait reçu la taille S.
   *
   * `declinaison_libelle` est recopié plutôt que recalculé : le panier vit dans
   * le téléphone du client, parfois pendant des jours. Si l'article change
   * entre-temps, la ligne doit continuer d'afficher ce qui a été choisi.
   */
  declinaison_id?: string | null;
  declinaison_libelle?: string | null;
}

/**
 * L'identité d'une ligne de panier.
 *
 * Ce n'est PAS le produit : une même robe en M et en L fait deux lignes. Les
 * indexer sur le seul `produit_id` les aurait fusionnées, et la cliente aurait
 * reçu deux fois la même taille.
 */
export function cleLigne(item: Pick<CartItemGP, 'produit_id' | 'declinaison_id'>): string {
  return `${item.produit_id}::${item.declinaison_id ?? ''}`;
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
  /** Ce qui part tout de suite, en porte-à-porte CJ. */
  itemsExpress: CartItemGP[];
  /** Ce qui rejoint la prochaine campagne de groupage. */
  itemsGroupage: CartItemGP[];
  /**
   * LE CLIENT PRÉFÈRE ATTENDRE LE GROUPAGE.
   *
   * La règle de la maison dit que le groupage s'impose pour ce que le
   * transporteur ne prend pas — « ou par choix du client ». Ce dernier cas
   * n'existait nulle part : un article que le transporteur acceptait partait
   * forcément en porte-à-porte, sans que le client puisse arbitrer entre le
   * prix et le délai.
   *
   * Le choix vaut pour TOUT le panier, et non ligne par ligne. Deux
   * acheminements ne voyagent pas ensemble : laisser le client cocher article
   * par article créerait deux expéditions là où il croit n'en payer qu'une.
   */
  prefereGroupage: boolean;
  setPrefereGroupage: (v: boolean) => void;
  /** Vrai quand au moins un article pourrait partir tout de suite : sans cela, le choix ne se pose pas. */
  groupageOptionnel: boolean;
  addItem: (item: Omit<CartItemGP, 'quantite'>, quantite?: number) => void;
  /** La clé vient de `cleLigne`, pas du produit : deux tailles font deux lignes. */
  updateQuantite: (cle: string, quantite: number) => void;
  removeItem: (cle: string) => void;
  clearCart: () => void;
  totalFcfa: number;
  totalArticles: number;
  totalExpressFcfa: number;
  totalGroupageFcfa: number;
}

const CartGPContext = createContext<CartGPContextValue | undefined>(undefined);
const STORAGE_KEY = 'maylary_panier_achat_gp';

/**
 * Une ligne de panier utilisable.
 *
 * Le prix doit être un nombre : la grille dégressive calcule dessus, et un
 * prix absent ferait afficher « NaN FCFA » au client, ce qui est pire qu'une
 * ligne manquante. `paliers` est ramené à un tableau quand il n'en est pas un,
 * plutôt que de faire tomber la ligne entière pour un champ accessoire.
 */
const estLigneValide = (e: unknown): e is CartItemGP => {
  if (typeof e !== 'object' || e === null) return false;
  const l = e as CartItemGP;
  if (typeof l.produit_id !== 'string') return false;
  if (!Number.isFinite(l.quantite) || !Number.isFinite(l.prix_unitaire_fcfa)) return false;
  if (l.paliers !== undefined && !Array.isArray(l.paliers)) l.paliers = [];
  return true;
};

const CLE_PREFERENCE_GROUPAGE = 'maylary_panier_gp_prefere_groupage';

export function CartGPProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItemGP[]>(() =>
    lireListeStockee(STORAGE_KEY, estLigneValide),
  );

  /*
   * Le choix survit au rechargement, comme le panier lui-même. Un client qui
   * ferme son téléphone et revient le lendemain ne doit pas redécouvrir sa
   * commande passée en express alors qu'il avait choisi d'attendre.
   *
   * La lecture est enveloppée : un navigateur en navigation privée, ou dont le
   * stockage est refusé, lève à la simple lecture. Le panier fonctionne alors
   * sans mémoire du choix, ce qui vaut mieux qu'un écran blanc.
   */
  const [prefereGroupage, setPrefereGroupageEtat] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CLE_PREFERENCE_GROUPAGE) === '1';
    } catch {
      return false;
    }
  });

  const setPrefereGroupage = (v: boolean) => {
    setPrefereGroupageEtat(v);
    try {
      localStorage.setItem(CLE_PREFERENCE_GROUPAGE, v ? '1' : '0');
    } catch {
      /* stockage refusé : le choix vaut pour cette visite seulement */
    }
  };

  useEffect(() => {
    ecrireListeStockee(STORAGE_KEY, items);
  }, [items]);

  const addItem = (item: Omit<CartItemGP, 'quantite'>, quantite = 1) => {
    const cle = cleLigne(item);
    setItems((prev) => {
      // Le regroupement se fait sur la DÉCLINAISON, pas sur le produit : ajouter
      // une robe en L alors qu'une M est déjà au panier doit créer une seconde
      // ligne, pas doubler la première.
      const existing = prev.find((i) => cleLigne(i) === cle);
      if (existing) {
        return prev.map((i) =>
          cleLigne(i) === cle ? { ...i, quantite: i.quantite + quantite } : i,
        );
      }
      return [...prev, { ...item, quantite }];
    });
  };

  const updateQuantite = (cle: string, quantite: number) => {
    if (quantite <= 0) {
      removeItem(cle);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        cleLigne(i) === cle
          ? // On ne descend pas sous la quantité minimum de vente : en dessous,
            // la part fixe du transport ne serait plus couverte.
            { ...i, quantite: Math.max(quantite, i.quantite_minimum ?? 1) }
          : i,
      ),
    );
  };

  const removeItem = (cle: string) => {
    setItems((prev) => prev.filter((i) => cleLigne(i) !== cle));
  };

  const clearCart = () => setItems([]);

  // La séparation se fait ici, une fois, plutôt que dans chaque écran : un
  // écran qui oublierait de la faire mélangerait les deux acheminements sans
  // que rien ne le signale.
  //
  // L'absence de mode vaut `cj_ddp` : c'est le cas des paniers déjà enregistrés
  // sur le téléphone d'un client avant cette séparation, et les articles qu'ils
  // contiennent étaient tous expédiables par CJ.
  /*
   * Un article rejoint la file maritime pour DEUX raisons, et il faut les
   * garder distinctes : le transporteur le refuse, ou le client l'a choisi.
   *
   * `groupageImpose` est ce que dit l'article. `prefereGroupage` est ce que dit
   * le client. La seconde ne peut qu'ajouter à la première : un article que le
   * transporteur refuse ne repassera jamais en express, quel que soit le choix.
   */
  const groupageImpose = (i: CartItemGP) => i.mode_acheminement === 'groupage';
  const estGroupage = (i: CartItemGP) => groupageImpose(i) || prefereGroupage;

  // Le choix ne se pose que s'il y a quelque chose à arbitrer : proposer
  // « attendre le groupage » sur un panier déjà entièrement maritime serait une
  // case à cocher sans effet, et le client se demanderait ce qu'elle change.
  const groupageOptionnel = items.some((i) => !groupageImpose(i));
  const itemsExpress = items.filter((i) => !estGroupage(i));
  const itemsGroupage = items.filter(estGroupage);

  const somme = (liste: CartItemGP[]) =>
    liste.reduce((sum, i) => sum + prixLigne(i) * i.quantite, 0);

  const totalFcfa = somme(items);
  const totalExpressFcfa = somme(itemsExpress);
  const totalGroupageFcfa = somme(itemsGroupage);
  const totalArticles = items.reduce((sum, i) => sum + i.quantite, 0);

  return (
    <CartGPContext.Provider
      value={{
        items,
        itemsExpress,
        itemsGroupage,
        prefereGroupage,
        setPrefereGroupage,
        groupageOptionnel,
        addItem,
        updateQuantite,
        removeItem,
        clearCart,
        totalFcfa,
        totalArticles,
        totalExpressFcfa,
        totalGroupageFcfa,
      }}
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
