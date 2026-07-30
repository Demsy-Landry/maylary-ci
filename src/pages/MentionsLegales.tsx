import PublicHeaderImport from '@/components/PublicHeaderImport';
import SiteFooter from '@/components/SiteFooter';

export default function MentionsLegales() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderImport />
      <main className="mx-auto max-w-screen-md px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl font-extrabold text-foreground">Mentions légales</h1>

        <div className="mt-8 space-y-8">
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">Éditeur du site</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Le site Maylary est édité par Dems'Inc, représenté par Demsy Landry, fondateur.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">Développement</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Développement et codage : Demsy Landry (Dems'Inc), avec l'assistance de Claude Code
              (Anthropic).
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">Hébergement</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Hébergement de l'application : Vercel Inc.
              <br />
              Hébergement des données et de l'infrastructure : Supabase.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">Propriété intellectuelle</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              L'ensemble des contenus présents sur ce site (textes, logos, visuels) est la
              propriété de Dems'Inc, sauf mention contraire. Toute reproduction sans autorisation
              est interdite.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">Responsabilité</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Maylary agit en tant qu'intermédiaire pour le sourcing, l'achat, le transport et le
              dédouanement des marchandises de ses clients. Les estimations indicatives affichées
              avant cotation ferme peuvent varier selon les conditions réelles du marché, du fret
              et de la douane.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">Contact</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Pour toute question relative à ce site ou à nos services, contactez-nous via votre
              espace client.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
