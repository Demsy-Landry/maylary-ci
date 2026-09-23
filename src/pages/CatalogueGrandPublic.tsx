import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import {
  supabase,
  CATEGORIES_GP_TABLE,
  PRODUITS_PUBLIC_VIEW,
  PALIERS_PRIX_PUBLIC_VIEW,
  ORIGINE_PRODUIT_LABELS,
  type CategorieGP,
  type OrigineProduit,
  type Produit,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Search, ImageOff, ShoppingCart, PackageSearch } from 'lucide-react';
import SectorIllustration, { guessSector } from '@/components/illustrations/SectorIllustration';
import OrigineProduitBadge from '@/components/OrigineProduitBadge';
import { ouvrirLeDeclarant } from '@/components/AssistantDeclarant';
import { useCartGP } from '@/hooks/useCartGP';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useReferencement } from '@/hooks/useReferencement';
import { PAGES } from '@/lib/referencement-pages';

type FiltreOrigine = 'tous' | OrigineProduit;

export default function CatalogueGrandPublic() {
  useReferencement(PAGES["/boutique"]);

  // Combien de produits par page. La vitrine ne charge JAMAIS tout le catalogue
  // d'un coup : à des milliers d'articles, cela figerait le téléphone et, passé
  // 1000 lignes, la base couperait en silence — des produits disparaîtraient.
  // On charge une page, puis « Voir plus » va chercher la suivante.
  const PAGE = 48;

  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<CategorieGP[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [chargementPlus, setChargementPlus] = useState(false);
  const [aPlus, setAPlus] = useState(false);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [filtreOrigine, setFiltreOrigine] = useState<FiltreOrigine>('tous');
  // Résultats de recherche venus de la base (null = pas de recherche en cours).
  const [resultatsRecherche, setResultatsRecherche] = useState<Produit[] | null>(null);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setSearch(q);
  }, [searchParams]);

  // Les grilles de gros sont chargées SEULEMENT pour les produits réellement
  // affichés — jamais toutes les grilles du catalogue. On les rattache à leur
  // produit pour la carte « à partir de » et l'ajout rapide au bon palier.
  const attacherPaliers = useCallback(async (liste: Produit[]): Promise<Produit[]> => {
    if (liste.length === 0) return liste;
    const { data } = await supabase
      .from(PALIERS_PRIX_PUBLIC_VIEW)
      .select('produit_id, quantite_min, prix_unitaire_fcfa')
      .in('produit_id', liste.map((p) => p.id))
      .order('quantite_min');
    const grilles = new Map<string, { quantite_min: number; prix_unitaire_fcfa: number }[]>();
    for (const ligne of (data ?? []) as {
      produit_id: string;
      quantite_min: number;
      prix_unitaire_fcfa: number;
    }[]) {
      const arr = grilles.get(ligne.produit_id) ?? [];
      arr.push({
        quantite_min: Number(ligne.quantite_min),
        prix_unitaire_fcfa: Number(ligne.prix_unitaire_fcfa),
      });
      grilles.set(ligne.produit_id, arr);
    }
    return liste.map((p) => ({ ...p, paliers: grilles.get(p.id) ?? [] }));
  }, []);

  // Une page de produits, filtrée et paginée DANS LA BASE. `depuis` = combien
  // sont déjà chargés ; la base ne renvoie que la tranche suivante.
  const chargerPage = useCallback(
    async (depuis: number): Promise<Produit[]> => {
      let requete = supabase
        .from(PRODUITS_PUBLIC_VIEW)
        .select('*')
        .eq('espace', 'grand_public')
        .eq('actif', true);
      if (filtreOrigine !== 'tous') requete = requete.eq('origine', filtreOrigine);
      const { data } = await requete
        .order('created_at', { ascending: false })
        .range(depuis, depuis + PAGE - 1);
      const page = await attacherPaliers((data as Produit[]) ?? []);
      setAPlus(page.length === PAGE);
      return page;
    },
    [filtreOrigine, attacherPaliers],
  );

  // Les catégories : peu nombreuses, chargées une fois, indépendamment des
  // produits affichés (sinon une catégorie hors de la première page
  // disparaîtrait de la barre).
  useEffect(() => {
    void supabase
      .from(CATEGORIES_GP_TABLE)
      .select('*')
      .eq('actif', true)
      .order('ordre_affichage')
      .then(({ data }) => setCategories((data as CategorieGP[]) ?? []));
  }, []);

  // La grille : première page, rechargée quand le filtre d'origine change.
  useEffect(() => {
    let vivant = true;
    setLoading(true);
    void chargerPage(0).then((page) => {
      if (!vivant) return;
      setProduits(page);
      setLoading(false);
    });
    return () => {
      vivant = false;
    };
  }, [chargerPage]);

  const voirPlus = async () => {
    setChargementPlus(true);
    const suite = await chargerPage(produits.length);
    setProduits((prev) => [...prev, ...suite]);
    setChargementPlus(false);
  };

  // La recherche interroge la BASE sur tout le catalogue (pas seulement ce qui
  // est déjà chargé), avec un petit délai pour ne pas lancer une requête à
  // chaque touche. L'index trigramme sur le nom la garde instantanée à
  // n'importe quelle taille de catalogue.
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setResultatsRecherche(null);
      setRechercheEnCours(false);
      return;
    }
    setRechercheEnCours(true);
    const minuterie = setTimeout(() => {
      void (async () => {
        let requete = supabase
          .from(PRODUITS_PUBLIC_VIEW)
          .select('*')
          .eq('espace', 'grand_public')
          .eq('actif', true)
          .ilike('nom', `%${q}%`);
        if (filtreOrigine !== 'tous') requete = requete.eq('origine', filtreOrigine);
        const { data } = await requete.order('created_at', { ascending: false }).limit(48);
        const res = await attacherPaliers((data as Produit[]) ?? []);
        setResultatsRecherche(res);
        setRechercheEnCours(false);
      })();
    }, 300);
    return () => clearTimeout(minuterie);
  }, [search, filtreOrigine, attacherPaliers]);

  const searchResults = resultatsRecherche ?? [];

  const filtres: { valeur: FiltreOrigine; libelle: string }[] = [
    { valeur: 'tous', libelle: 'Tous les produits' },
    { valeur: 'local', libelle: ORIGINE_PRODUIT_LABELS.local },
    { valeur: 'import_international', libelle: ORIGINE_PRODUIT_LABELS.import_international },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <main className="entree-page mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="trait-anime text-2xl font-bold text-foreground">Boutique MayLary Group</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Des produits tendance, livrés chez vous. Parcourez les catégories ou recherchez directement.
          </p>
          <div className="relative mt-4 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchParams(e.target.value ? { q: e.target.value } : {}, { replace: true });
              }}
              placeholder="Rechercher un produit (ex: montre, sac, écouteurs...)"
              className="pl-9"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {filtres.map((f) => (
              <button
                key={f.valeur}
                type="button"
                onClick={() => setFiltreOrigine(f.valeur)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  filtreOrigine === f.valeur
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:border-primary hover:text-foreground',
                )}
              >
                {f.libelle}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Les articles « Import sur commande » sont commandés à l'étranger pour vous : le prix est
            négocié à la source, le délai de livraison est plus long qu'un article déjà en stock local.
          </p>
        </div>

        {loading ? (
          <div className="cascade grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : search.trim() ? (
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              {rechercheEnCours && resultatsRecherche === null
                ? 'Recherche…'
                : `${searchResults.length} résultat(s) pour « ${search} »`}
            </p>
            {rechercheEnCours && resultatsRecherche === null ? (
              <div className="cascade grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-56 w-full" />
                ))}
              </div>
            ) : searchResults.length === 0 ? (
              /* Une recherche vide n'est pas une impasse : c'est le moment où
                 la maison a quelque chose à offrir que la boutique n'a pas.
                 Le catalogue en ligne est une vitrine ; le métier, c'est
                 d'aller chercher. */
              <div className="rounded-lg border border-dashed p-8 text-center">
                <PackageSearch className="mx-auto h-8 w-8 text-primary" />
                <p className="mt-3 font-display text-base font-bold text-foreground">
                  Ce n’est pas en boutique. Ça ne veut pas dire qu’on ne peut pas l’avoir.
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Notre catalogue en ligne est une vitrine. Le Déclarant peut chercher
                  « {search.trim()} » directement chez nos fournisseurs et lancer une recherche
                  de sourcing : vous recevez un prix rendu Abidjan, droits et livraison compris.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Button
                    onClick={() =>
                      ouvrirLeDeclarant(
                        `Je cherche « ${search.trim()} ». Ce n'est pas dans votre boutique : pouvez-vous le chercher chez vos fournisseurs ?`,
                      )
                    }
                  >
                    Faire chercher par Le Déclarant
                  </Button>
                  <Button asChild variant="outline">
                    <Link to={`/boutique/sourcing?designation=${encodeURIComponent(search.trim())}`}>
                      Remplir une demande de sourcing
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="cascade grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                {searchResults.map((p) => (
                  <ProductCardGP key={p.id} produit={p} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/boutique/categorie/${c.id}`}
                  className="group flex shrink-0 items-center gap-2 rounded-full border bg-card py-1.5 pl-1.5 pr-4 transition-colors hover:border-primary"
                >
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-primary/10">
                    {c.image_url ? (
                      <img src={c.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <SectorIllustration sector={guessSector(c.nom)} className="h-full w-full p-1" />
                    )}
                  </div>
                  <span className="whitespace-nowrap text-sm font-medium text-foreground group-hover:text-primary">
                    {c.nom}
                  </span>
                </Link>
              ))}
              {categories.length === 0 && (
                <p className="col-span-full rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  La boutique est en cours de préparation, revenez bientôt.
                </p>
              )}
            </div>

            {produits.length > 0 ? (
              <div className="mt-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">
                  {filtreOrigine === 'tous'
                    ? 'Tous les produits'
                    : ORIGINE_PRODUIT_LABELS[filtreOrigine]}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({produits.length}
                    {aPlus ? '+' : ''})
                  </span>
                </h2>
                <div className="cascade grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                  {produits.map((p) => (
                    <ProductCardGP key={p.id} produit={p} />
                  ))}
                </div>

                {/* La suite du catalogue ne se charge qu'à la demande : la page
                    reste légère même avec des milliers d'articles. */}
                {aPlus && (
                  <div className="mt-6 flex justify-center">
                    <Button variant="outline" onClick={() => void voirPlus()} disabled={chargementPlus}>
                      {chargementPlus ? 'Chargement…' : 'Voir plus de produits'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-6 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Aucun produit dans cette sélection pour le moment.
              </p>
            )}
          </>
        )}

        {/* Le catalogue ne pourra jamais tout contenir : plutôt que de laisser
            repartir un client bredouille, on lui ouvre une porte. */}
        <section className="carte-reactive mt-10 rounded-lg border border-primary/30 bg-primary/5 p-5 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            Vous ne trouvez pas ce que vous cherchez ?
          </h2>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
            Décrivez-nous l'article : nous le cherchons chez nos fournisseurs et vous annonçons un
            prix ferme, transport et assurance compris. Vous décidez ensuite.
          </p>
          <Button asChild className="mt-4">
            <Link to="/boutique/sourcing">Demander un article</Link>
          </Button>
        </section>

        {/* La marketplace ne se remplit que si les entreprises savent qu'elle
            existe, et ce qu'elle leur coûte. */}
        <section className="carte-reactive mt-4 rounded-lg border bg-card p-5 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            Vous êtes une entreprise ivoirienne ?
          </h2>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
            Vendez vos produits sur MayLary Group. L'inscription et la publication de votre catalogue sont
            gratuites — nous ne prenons une commission que sur les ventes que nous vous apportons.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/vendre">Ouvrir ma boutique</Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export function ProductCardGP({ produit }: { produit: Produit }) {
  const { addItem } = useCartGP();
  const [imgError, setImgError] = useState(false);
  const enRupture = produit.stock_disponible === 'rupture';

  const handleQuickAdd = (e: MouseEvent) => {
    /* UN ARTICLE À DÉCLINER NE S'AJOUTE PAS DEPUIS LA LISTE.
       Sans taille ni couleur, la commande partirait au fournisseur avec la
       première déclinaison venue — c'est exactement le défaut qu'on corrige.
       On ne bloque pas le clic : on le laisse suivre le lien vers la fiche, où
       le choix est possible. Un bouton qui ne fait rien passerait pour cassé. */
    if (produit.choix_requis) return;
    e.preventDefault();
    e.stopPropagation();
    // Les articles vendus par lot entrent au panier à leur quantité minimum.
    const quantite = Math.max(1, produit.quantite_minimum ?? 1);
    addItem(
      {
        produit_id: produit.id,
        nom: produit.nom,
        prix_unitaire_fcfa: produit.prix_unitaire_fcfa,
        photo: produit.photos?.[0] ?? null,
        quantite_minimum: quantite,
        paliers: produit.paliers ?? [],
        mode_acheminement: produit.mode_acheminement,
      },
      quantite,
    );
    toast.success(
      quantite > 1 ? `Lot de ${quantite} ajouté à votre panier.` : 'Ajouté à votre panier.',
    );
  };

  return (
    <Link
      to={`/boutique/produit/${produit.id}`}
      className="carte-reactive reflet groupe-zoom group flex flex-col overflow-hidden rounded-lg border bg-card hover:border-primary/40"
    >
      <div className="cadre-zoom aspect-square w-full bg-white p-2">
        {produit.photos?.[0] && !imgError ? (
          <img
            src={produit.photos[0]}
            alt={produit.nom}
            onError={() => setImgError(true)}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <ImageOff className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        {produit.origine && <OrigineProduitBadge origine={produit.origine} taille="compacte" className="mb-1.5" />}
        <p className="line-clamp-2 text-sm text-foreground">{produit.nom}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-base font-bold text-foreground">
            {produit.prix_unitaire_fcfa.toLocaleString('fr-FR')}
          </span>
          <span className="text-xs text-muted-foreground">FCFA</span>
        </div>
        {produit.quantite_minimum > 1 && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Par lot de {produit.quantite_minimum}
          </p>
        )}
        {(produit.paliers?.length ?? 0) > 1 && (
          <p className="mt-1 text-[11px] font-medium text-emerald-600">
            Dès {produit.paliers!.at(-1)!.quantite_min} pièces :{' '}
            {produit.paliers!.at(-1)!.prix_unitaire_fcfa.toLocaleString('fr-FR')} FCFA
          </p>
        )}
        {enRupture && (
          <Badge variant="destructive" className="mt-1 w-fit text-[10px]">
            Rupture
          </Badge>
        )}
        <div className="mt-auto pt-2">
          <button
            onClick={handleQuickAdd}
            disabled={enRupture}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-emphasis disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Ajouter au panier
          </button>
        </div>
      </div>
    </Link>
  );
}
