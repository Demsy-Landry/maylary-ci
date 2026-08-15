import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Le filet contre l'écran blanc.
 *
 * Sans lui, une seule erreur JavaScript n'importe où dans l'arbre démonte toute
 * l'application : React retire le contenu et le client se retrouve devant une
 * page blanche. Pas de message, pas de bouton, rien à quoi se raccrocher — et
 * la maison n'en sait jamais rien, parce que personne n'appelle pour dire
 * « votre site est blanc », on referme l'onglet.
 *
 * Ce composant intercepte ces erreurs et affiche quelque chose d'utilisable.
 *
 * TROIS CHOIX QUI COMPTENT
 *
 * **On ne montre pas la pile d'erreur au client.** Elle ne lui dit rien, et
 * elle expose la structure interne de l'application. Elle est écrite dans la
 * console pour la maison, et un code court s'affiche à l'écran : le client
 * peut le lire au téléphone, et il se retrouve dans les journaux.
 *
 * **Le rechargement est proposé, pas imposé.** Un rechargement automatique sur
 * une erreur qui se reproduit à chaque montage boucle à l'infini et vide la
 * batterie. C'est le client qui décide.
 *
 * **Il est écrit en classe, et ce n'est pas un oubli.** React n'expose
 * `componentDidCatch` que sur les composants de classe ; il n'existe pas
 * d'équivalent en hook. C'est le seul endroit de l'application où la forme
 * classe est nécessaire.
 */

interface Props {
  children: ReactNode;
}

interface State {
  erreur: Error | null;
  code: string;
}

/** Un code court, lisible au téléphone, qu'on retrouve dans les journaux. */
const codeCourt = () =>
  `${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

export default class FrontiereErreur extends Component<Props, State> {
  state: State = { erreur: null, code: '' };

  static getDerivedStateFromError(erreur: Error): Partial<State> {
    return { erreur, code: codeCourt() };
  }

  componentDidCatch(erreur: Error, infos: ErrorInfo) {
    // Le seul canal disponible aujourd'hui. Le jour où une remontée d'erreurs
    // est branchée, c'est ici qu'elle se pose — un seul endroit à changer.
    console.error('[MayLary] Erreur non rattrapée', this.state.code, erreur, infos.componentStack);
  }

  render() {
    if (!this.state.erreur) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            {/* Pas d'icône importée : si le paquet d'icônes est justement ce
                qui a cassé, l'écran de secours casserait avec lui. */}
            <span aria-hidden="true" className="font-display text-2xl font-extrabold text-primary">
              !
            </span>
          </div>

          <h1 className="mt-5 font-display text-xl font-extrabold text-foreground">
            Cette page s’est arrêtée en chemin
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Le problème vient de nous, pas de vous. Rien de ce que vous avez saisi n’a été perdu
            côté serveur : vos commandes, vos demandes et vos documents sont intacts.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Recharger la page
            </button>
            {/* Une vraie navigation, pas un lien de routeur : le routeur fait
                partie de ce qui vient peut-être de tomber. */}
            <a
              href="/"
              className="rounded-md border px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Revenir à l’accueil
            </a>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Si cela se reproduit, donnez-nous ce code par téléphone ou par courriel :
            <br />
            <strong className="mt-1 inline-block font-display tracking-widest text-foreground">
              {this.state.code}
            </strong>
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            <a href="mailto:yaolandry67@gmail.com" className="text-primary hover:underline">
              yaolandry67@gmail.com
            </a>
          </p>
        </div>
      </div>
    );
  }
}
