import { Link } from 'react-router-dom';
import { Boxes } from 'lucide-react';

const COLUMNS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: 'Import / Export',
    links: [
      { label: "Faire une demande d'import", to: '/import/nouvelle-demande' },
      { label: 'Mes demandes d’import', to: '/import/mes-demandes' },
      { label: "Faire une demande d'export", to: '/export/nouvelle-demande' },
      { label: 'Mes demandes d’export', to: '/export/mes-demandes' },
    ],
  },
  {
    title: 'Boutique',
    links: [
      { label: 'Tous les produits', to: '/boutique' },
      { label: 'Mes commandes', to: '/boutique/mes-commandes' },
      { label: 'Mon panier', to: '/boutique/panier' },
      { label: 'Mon compte', to: '/boutique/compte' },
    ],
  },
  {
    title: 'Espace Pro',
    links: [
      { label: 'Catalogue professionnel', to: '/catalogue' },
      { label: 'Mes demandes de devis', to: '/catalogue/mes-devis' },
    ],
  },
  {
    title: 'Aide',
    links: [
      { label: 'Suivi de commande', to: '/boutique/mes-commandes' },
      { label: 'Paiement (Mobile Money, virement)', to: '/boutique/compte' },
      { label: 'Livraison en Côte d’Ivoire', to: '/boutique' },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t bg-foreground text-background">
      <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Boxes className="h-4 w-4" />
              </div>
              <span className="text-base font-semibold tracking-tight">Maylary</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-background/70">
              Vos achats et votre approvisionnement professionnel, livrés partout en Côte
              d'Ivoire.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-background">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-sm text-background/70 hover:text-background hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-background/15 pt-6 text-xs text-background/60">
          © {new Date().getFullYear()} Maylary. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
