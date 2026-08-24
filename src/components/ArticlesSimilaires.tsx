import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, PRODUITS_PUBLIC_VIEW } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageOff, Ship } from 'lucide-react';

/**
 * « À chaque fois qu'on clique sur un article, d'autres articles similaires
 * s'affichent en bas. »
 *
 * POURQUOI CE BLOC RAPPORTE PLUS QUE N'IMPORTE QUEL AUTRE
 *
 * Une fiche produit est un cul-de-sac. Le visiteur qui n'est pas convaincu par
 * l'article n'a que deux gestes possibles : revenir en arrière, ou fermer. Le
 * second l'emporte souvent. Proposer trois ou quatre voisins au bas de la page
 * transforme ce cul-de-sac en couloir — et c'est le mécanisme qui fait vendre
 * plus d'un article par visite sur toutes les grandes places de marché.
 *
 * CE QU'ON APPELLE « SIMILAIRE », ET POURQUOI ON NE FAIT PAS PLUS MALIN
 *
 * Même rayon, prix voisin. Rien de plus.
 *
 * On aurait pu écrire une recommandation par mots-clés du titre ou par
 * historique d'achat. Ce serait prématuré : la boutique compte cent vingt
 * articles, pas cent vingt mille, et un moteur sophistiqué sur un petit
 * catalogue produit surtout des rapprochements incongrus — le genre qui fait
 * douter du sérieux de la maison.
 *
 * Le tri par écart de prix est le plus honnête à cette taille : quelqu'un qui
 * regarde une multiprise à 3 000 F est plus proche d'une autre multiprise à
 * 4 500 F que du fauteuil de pédicure du même rayon.
 *
 * ET SI LE RAYON EST TROP MAIGRE
 *
 * Un rayon qui n'a qu'un article ne peut rien proposer. On ne montre alors ni
 * bloc vide ni titre orphelin : le composant ne rend rien du tout. Un bandeau
 * « Articles similaires » suivi du vide dit au visiteur que la boutique est
 * vide, ce qui est exactement l'inverse du but.
 */

interface Voisin {
  id: string;
  nom: string;
  prix_unitaire_fcfa: number;
  photos: string[] | null;
  mode_acheminement: 'cj_ddp' | 'groupage' | null;
}

interface Props {
  /** L'article regardé — il ne doit évidemment pas se proposer lui-même. */
  produitId: string;
  espace: 'grand_public' | 'pro';
  /** Le rayon, côté boutique grand public. */
  categorieGpId?: string | null;
  /** L'enseigne, côté Espace Pro : c'est elle qui porte le secteur. */
  enseigneId?: string | null;
  /** Sert à classer les voisins du plus proche au plus lointain en prix. */
  prixReference: number;
}

const COMBIEN = 4;

export default function ArticlesSimilaires({
  produitId,
  espace,
  categorieGpId,
  enseigneId,
  prixReference,
}: Props) {
  const [voisins, setVoisins] = useState<Voisin[] | null>(null);

  useEffect(() => {
    let annule = false;

    const charger = async () => {
      setVoisins(null);

      let requete = supabase
        .from(PRODUITS_PUBLIC_VIEW)
        .select('id, nom, prix_unitaire_fcfa, photos, mode_acheminement')
        .eq('espace', espace)
        .neq('id', produitId)
        .gt('prix_unitaire_fcfa', 0)
        // On en demande davantage que les quatre affichés : le tri par écart de
        // prix se fait ici, et il n'a de sens que sur un échantillon plus large
        // que le résultat.
        .limit(40);

      if (espace === 'grand_public' && categorieGpId) {
        requete = requete.eq('categorie_gp_id', categorieGpId);
      } else if (espace === 'pro' && enseigneId) {
        requete = requete.eq('enseigne_id', enseigneId);
      }

      const { data } = await requete;
      if (annule) return;

      const classes = ((data as Voisin[] | null) ?? [])
        .slice()
        .sort(
          (a, b) =>
            Math.abs(a.prix_unitaire_fcfa - prixReference) -
            Math.abs(b.prix_unitaire_fcfa - prixReference),
        )
        .slice(0, COMBIEN);

      setVoisins(classes);
    };

    void charger();
    return () => {
      annule = true;
    };
  }, [produitId, espace, categorieGpId, enseigneId, prixReference]);

  // En cours de chargement : des emplacements, pour que le bas de page ne
  // sursaute pas quand les voisins arrivent.
  if (voisins === null) {
    return (
      <section className="mt-12">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Articles similaires
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: COMBIEN }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full" />
          ))}
        </div>
      </section>
    );
  }

  if (voisins.length === 0) return null;

  const base = espace === 'pro' ? '/catalogue/produit' : '/boutique/produit';

  return (
    <section className="mt-12">
      <h2 className="font-display text-lg font-semibold text-foreground">Articles similaires</h2>
      <p className="mt-1 text-sm text-muted-foreground">Dans le même rayon, à un prix voisin.</p>

      <div className="cascade mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {voisins.map((v) => {
          const photo = v.photos?.[0];
          return (
            <Link
              key={v.id}
              to={`${base}/${v.id}`}
              className="cadre-zoom group flex flex-col overflow-hidden rounded-md border bg-card transition-colors hover:border-primary"
            >
              <div className="aspect-square w-full bg-white">
                {photo ? (
                  <img
                    src={photo}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <ImageOff className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col p-3">
                <p className="line-clamp-2 text-sm font-medium text-foreground group-hover:text-primary">
                  {v.nom}
                </p>
                <p className="mt-auto pt-2 font-display font-semibold tabular-nums text-primary">
                  {v.prix_unitaire_fcfa.toLocaleString('fr-FR')} FCFA
                </p>
                {/* Le même avertissement que sur la fiche : en groupage, le
                    transport n'est pas dans ce prix et n'est pas encore chiffré.
                    L'omettre ici ferait comparer deux prix qui ne se comparent
                    pas. */}
                {v.mode_acheminement === 'groupage' && (
                  <p className="mt-1 flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                    <Ship className="h-3 w-3 shrink-0" aria-hidden="true" />
                    transport communiqué après vérification
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
