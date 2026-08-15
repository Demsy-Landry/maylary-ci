import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Le retour, et pourquoi il ne peut pas être un simple `history.back()`.
 *
 * Reproche du fondateur, exact : « Il n'y a pas de bouton retour lorsqu'on
 * ouvre une page. » Sur téléphone, le geste système existe ; sur ordinateur, et
 * surtout quand la page a été ouverte depuis un lien partagé ou un signet, le
 * visiteur se retrouve dans un cul-de-sac. Il ferme l'onglet.
 *
 * Un `navigate(-1)` seul ne suffit pas, pour une raison que l'on ne voit qu'en
 * testant : si la page est le PREMIER écran de la session — lien WhatsApp,
 * favori, retour d'un paiement — l'historique de l'application est vide.
 * Reculer ferait alors sortir du site, vers le moteur de recherche ou la page
 * blanche. Le bouton renverrait le client dehors : exactement le contraire de
 * ce qu'on lui demande.
 *
 * D'où deux comportements, choisis selon ce que l'historique contient
 * réellement :
 *
 *   1. Il y a un écran précédent DANS l'application → on y retourne, et le
 *      libellé reste neutre (« Retour »), parce qu'on ne sait pas d'où l'on
 *      vient.
 *   2. Il n'y en a pas → on remonte d'un cran dans l'arborescence, et le
 *      libellé nomme la destination (« Retour à la boutique »). Le visiteur
 *      sait où il va avant de cliquer.
 *
 * Le test de l'historique s'appuie sur `window.history.state.idx`, que React
 * Router incrémente à chaque navigation interne. À zéro, la page est le point
 * d'entrée de la session.
 */

/**
 * Le parent d'un chemin, quand l'historique ne peut rien dire.
 *
 * On remonte d'un segment, sauf là où la hiérarchie réelle ne suit pas l'URL :
 * la fiche produit appartient à la boutique et non à `/boutique/produit`, et
 * les écrans d'administration retournent tous au tableau de bord.
 */
function parent(chemin: string): { vers: string; nom: string } | null {
  const p = chemin.replace(/\/+$/, '');
  if (p === '' || p === '/') return null;

  const exact: Record<string, { vers: string; nom: string }> = {
    '/services': { vers: '/', nom: "l'accueil" },
    '/boutique': { vers: '/', nom: "l'accueil" },
    '/catalogue': { vers: '/', nom: "l'accueil" },
    '/import': { vers: '/services', nom: 'nos services' },
    '/export': { vers: '/services', nom: 'nos services' },
    '/vendre': { vers: '/', nom: "l'accueil" },
    '/declarant': { vers: '/', nom: "l'accueil" },
    '/poids-taxable': { vers: '/services', nom: 'nos services' },
    '/mon-compte': { vers: '/', nom: "l'accueil" },
    '/mot-de-passe-oublie': { vers: '/boutique/compte', nom: 'la connexion' },
    '/a-propos': { vers: '/', nom: "l'accueil" },
    '/mentions-legales': { vers: '/', nom: "l'accueil" },
    '/confidentialite': { vers: '/', nom: "l'accueil" },
    '/admin': { vers: '/', nom: "l'accueil" },
  };
  if (exact[p]) return exact[p];

  if (p.startsWith('/admin/')) return { vers: '/admin', nom: 'le tableau de bord' };
  if (p.startsWith('/boutique/produit/') || p.startsWith('/boutique/categorie/'))
    return { vers: '/boutique', nom: 'la boutique' };
  if (p.startsWith('/boutique/')) return { vers: '/boutique', nom: 'la boutique' };
  if (p.startsWith('/catalogue/produit/') || p.startsWith('/catalogue/secteur/'))
    return { vers: '/catalogue', nom: "l'espace pro" };
  if (p.startsWith('/catalogue/')) return { vers: '/catalogue', nom: "l'espace pro" };
  if (p.startsWith('/import/')) return { vers: '/services', nom: 'nos services' };
  if (p.startsWith('/export/')) return { vers: '/services', nom: 'nos services' };
  if (p.startsWith('/vendre/')) return { vers: '/vendre', nom: "l'espace vendeur" };
  if (p.startsWith('/declarant/')) return { vers: '/declarant', nom: "l'espace Déclarant" };

  const coupe = p.lastIndexOf('/');
  return coupe > 0 ? { vers: p.slice(0, coupe), nom: 'la page précédente' } : { vers: '/', nom: "l'accueil" };
}

export default function BoutonRetour({ className = '' }: { className?: string }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // La couverture est la racine : il n'y a rien derrière elle.
  const cible = parent(pathname);
  if (!cible) return null;

  const historique =
    typeof window !== 'undefined' &&
    typeof (window.history.state as { idx?: number } | null)?.idx === 'number' &&
    ((window.history.state as { idx: number }).idx ?? 0) > 0;

  const classes =
    'inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium ' +
    'text-current/80 transition hover:text-current focus-visible:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-primary ' +
    className;

  if (historique) {
    return (
      <button type="button" onClick={() => navigate(-1)} className={classes} aria-label="Revenir à l'écran précédent">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour
      </button>
    );
  }

  return (
    <Link to={cible.vers} className={classes}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span>
        Retour à <span className="hidden sm:inline">{cible.nom}</span>
        <span className="sm:hidden">{cible.nom.replace(/^(l'|la |le |nos )/, '')}</span>
      </span>
    </Link>
  );
}
