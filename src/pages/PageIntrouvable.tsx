/**
 * Page affichée pour une adresse inconnue.
 *
 * Sans elle, une URL erronée — un lien partagé tronqué, un signet périmé —
 * rendait une page entièrement blanche. Pour un service qui vend sa fiabilité,
 * une page blanche est pire qu'une erreur assumée.
 */
import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SiteFooter from '@/components/SiteFooter';
import { useReferencement } from '@/hooks/useReferencement';

export default function PageIntrouvable() {
  useReferencement({
    titre: "Page introuvable",
    description:
      "Cette adresse ne correspond à aucune page du site.",
    horsIndex: true,
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="entree-page flex flex-1 items-center justify-center px-4 py-20">
        <div className="animate-apparition-bas w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Compass className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold text-foreground">
            Cette page n'existe pas
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            L'adresse demandée est introuvable. Elle a peut-être été déplacée, ou le lien que vous
            avez suivi est incomplet.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/">
                <Home className="mr-1.5 h-4 w-4" />
                Retour à l'accueil
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/boutique">Voir la boutique</Link>
            </Button>
          </div>

          <div className="mt-10 grid gap-2 text-sm">
            <Link to="/import/nouvelle-demande" className="text-primary hover:underline">
              Faire importer une marchandise
            </Link>
            <Link to="/export/nouvelle-demande" className="text-primary hover:underline">
              Faire exporter une marchandise
            </Link>
            <Link to="/mon-compte" className="text-primary hover:underline">
              Accéder à mon compte
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
