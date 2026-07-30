import PublicHeaderImport from '@/components/PublicHeaderImport';
import SiteFooter from '@/components/SiteFooter';
import { Globe, PackageSearch, Code2 } from 'lucide-react';

export default function APropos() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderImport />
      <main className="mx-auto max-w-screen-md px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl font-extrabold text-foreground">À propos de Maylary</h1>
        <p className="mt-4 text-base text-muted-foreground">
          Maylary est une plateforme ivoirienne qui simplifie l'importation et l'exportation pour
          les particuliers et les entreprises de Côte d'Ivoire : sourcing, achat, fret
          international, douane, transit local et livraison, gérés de bout en bout par une équipe
          transitaire agréée. Maylary propose aussi une Boutique et un Espace Pro pour les achats
          standards, sans passer par une demande sur mesure.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-5">
            <PackageSearch className="h-6 w-6 text-primary" />
            <h2 className="font-display mt-3 font-bold text-foreground">Fondateur</h2>
            <p className="mt-1 text-sm text-muted-foreground">Demsy Landry</p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <Globe className="h-6 w-6 text-primary" />
            <h2 className="font-display mt-3 font-bold text-foreground">Développeur</h2>
            <p className="mt-1 text-sm text-muted-foreground">Dems'Inc (Demsy Landry)</p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <Code2 className="h-6 w-6 text-primary" />
            <h2 className="font-display mt-3 font-bold text-foreground">Codage</h2>
            <p className="mt-1 text-sm text-muted-foreground">Demsy Landry et Claude Code</p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
