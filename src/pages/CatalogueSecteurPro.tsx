import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ouvrirLeDeclarant } from '@/components/AssistantDeclarant';
import { Button } from '@/components/ui/button';
import PublicHeaderPro from '@/components/PublicHeaderPro';
import SiteFooter from '@/components/SiteFooter';
import {
  supabase,
  SECTEURS_TABLE,
  ENSEIGNES_TABLE,
  PRODUITS_PUBLIC_VIEW,
  PALIERS_PRIX_PUBLIC_VIEW,
  type Secteur,
  type Enseigne,
  type Produit,
} from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft } from 'lucide-react';
import ImageWithFallback from '@/components/ImageWithFallback';
import OrigineProduitBadge from '@/components/OrigineProduitBadge';

export default function CatalogueSecteurPro() {
  const { secteurId } = useParams<{ secteurId: string }>();
  const [secteur, setSecteur] = useState<Secteur | null>(null);
  const [enseignes, setEnseignes] = useState<Enseigne[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!secteurId) return;
    const load = async () => {
      setLoading(true);
      const [secteurRes, enseignesRes] = await Promise.all([
        supabase.from(SECTEURS_TABLE).select('*').eq('id', secteurId).maybeSingle(),
        supabase.from(ENSEIGNES_TABLE).select('*').eq('secteur_id', secteurId).eq('actif', true),
      ]);
      setSecteur((secteurRes.data as Secteur) ?? null);
      const enseignesList = (enseignesRes.data as Enseigne[]) ?? [];
      setEnseignes(enseignesList);

      const enseigneIds = enseignesList.map((e) => e.id);
      if (enseigneIds.length > 0) {
        const { data: produitsData } = await supabase
          .from(PRODUITS_PUBLIC_VIEW)
          .select('*')
          .in('enseigne_id', enseigneIds)
          .eq('espace', 'pro')
          .eq('actif', true);
        // Les grilles de gros arrivent à part : on les rattache à leur produit
        // pour afficher « à partir de » plutôt qu'un prix à l'unité qui donne
        // une image chère d'une offre en réalité dégressive.
        const liste = (produitsData as Produit[]) ?? [];
        const { data: paliersData } = await supabase
          .from(PALIERS_PRIX_PUBLIC_VIEW)
          .select('produit_id, quantite_min, prix_unitaire_fcfa')
          .in('produit_id', liste.map((p) => p.id))
          .order('quantite_min');
        const grilles = new Map<string, { quantite_min: number; prix_unitaire_fcfa: number }[]>();
        for (const ligne of (paliersData ?? []) as {
          produit_id: string;
          quantite_min: number;
          prix_unitaire_fcfa: number;
        }[]) {
          const g = grilles.get(ligne.produit_id) ?? [];
          g.push({
            quantite_min: Number(ligne.quantite_min),
            prix_unitaire_fcfa: Number(ligne.prix_unitaire_fcfa),
          });
          grilles.set(ligne.produit_id, g);
        }
        setProduits(liste.map((p) => ({ ...p, paliers: grilles.get(p.id) ?? [] })));
      } else {
        setProduits([]);
      }
      setLoading(false);
    };
    load();
  }, [secteurId]);

  const enseigneNom = (id: string | null) => enseignes.find((e) => e.id === id)?.nom ?? null;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderPro />
      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <Link
          to="/catalogue"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Retour aux secteurs
        </Link>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <div className="cascade grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-56 w-full" />
              ))}
            </div>
          </div>
        ) : !secteur ? (
          <p className="text-sm text-muted-foreground">Secteur introuvable.</p>
        ) : (
          <>
            <h1 className="font-display mb-1 text-2xl font-bold text-foreground">{secteur.nom}</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              {enseignes.length} enseigne(s) référencée(s) — {produits.length} produit(s)
            </p>

            {produits.length === 0 ? (
              /* Un rayon vide est une occasion manquée si on s'arrête là. Un
                 professionnel qui vient chercher de l'outillage et ne trouve
                 rien doit repartir avec une recherche lancée, pas avec un
                 écran vide. */
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="font-display text-base font-bold text-foreground">
                  Ce rayon n’est pas encore garni. Nous pouvons quand même vous l’approvisionner.
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Dites au Déclarant ce qu’il vous faut : il cherche chez nos fournisseurs et
                  ouvre une recherche de sourcing. Vous recevez un prix rendu Abidjan, droits
                  compris.
                </p>
                <Button
                  className="mt-5"
                  onClick={() =>
                    ouvrirLeDeclarant(
                      `Je cherche des articles du rayon « ${secteur.nom} » pour mon activité. Que pouvez-vous trouver chez vos fournisseurs ?`,
                    )
                  }
                >
                  Faire chercher par Le Déclarant
                </Button>
              </div>
            ) : (
              <div className="cascade grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {produits.map((p) => (
                  <Link
                    key={p.id}
                    to={`/catalogue/produit/${p.id}`}
                    className="group overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary"
                  >
                    <ImageWithFallback
                      src={p.photos?.[0]}
                      alt={p.nom}
                      className="h-36 w-full object-cover"
                      fallbackClassName="h-36 w-full"
                    />
                    <div className="p-3">
                      {enseigneNom(p.enseigne_id) && (
                        <p className="truncate text-xs text-muted-foreground">{enseigneNom(p.enseigne_id)}</p>
                      )}
                      {p.origine && (
                        <OrigineProduitBadge origine={p.origine} taille="compacte" className="mb-1" />
                      )}
                      <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                        {p.nom}
                      </p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-sm font-semibold text-primary">
                          {p.paliers && p.paliers.length > 1 && (
                            <span className="mr-1 text-xs font-normal text-muted-foreground">
                              dès
                            </span>
                          )}
                          {(p.paliers && p.paliers.length > 1
                            ? p.paliers[p.paliers.length - 1].prix_unitaire_fcfa
                            : p.prix_unitaire_fcfa
                          ).toLocaleString('fr-FR')}{' '}
                          FCFA
                        </span>
                        {p.stock_disponible === 'rupture' && (
                          <Badge variant="destructive" className="text-[10px]">
                            Rupture
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
