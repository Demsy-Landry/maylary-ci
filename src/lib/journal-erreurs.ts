import { supabase, JOURNAL_ERREURS_TABLE } from '@/lib/supabase';

/**
 * Le dépôt d'une erreur d'écran.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * L'écran de secours affiche un code court et invite le client à le donner par
 * téléphone. Jusqu'ici ce code n'était écrit que dans la console de son
 * navigateur : personne ne le lisait jamais. Le fondateur a reçu 5NIA-5J36 sur
 * son téléphone, et il n'y avait rigoureusement rien à en faire.
 *
 * Une erreur de rendu vit entièrement dans le navigateur. L'hébergeur
 * n'enregistre que les fonctions serveur ; il ne voit RIEN de ce qui casse
 * dans la page. Sans ce dépôt, chaque écran cassé reste un mystère, et on ne
 * peut que deviner.
 *
 * CE QUI EST ENVOYÉ, ET CE QUI NE L'EST PAS
 *
 * Le message, la pile, le composant fautif, l'adresse de la page et le
 * navigateur. Rien de ce que le client a saisi : ni champ de formulaire, ni
 * panier, ni identité au-delà de son identifiant de compte s'il est connecté.
 * Une remontée d'erreurs qui emporte des données personnelles au passage est un
 * problème de plus, pas une solution.
 *
 * Les textes sont tronqués : une pile d'appels peut faire des dizaines de
 * milliers de caractères, et un journal qui gonfle sans limite finit par
 * coûter plus cher que les pannes qu'il documente.
 */

/** Assez pour retrouver la ligne fautive, pas assez pour gonfler la table. */
const couper = (v: string | null | undefined, max: number): string | null =>
  v ? v.slice(0, max) : null;

export interface ErreurADeposer {
  code: string;
  erreur: Error;
  composant: string | null;
}

export async function deposerErreur({ code, erreur, composant }: ErreurADeposer): Promise<void> {
  try {
    /* L'identifiant sert à rappeler le client concerné. On le lit sans
     * rafraîchir la session : si c'est justement l'authentification qui a
     * cassé, insister ferait perdre l'enregistrement. */
    let utilisateur: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      utilisateur = data.session?.user?.id ?? null;
    } catch {
      /* Tant pis : une erreur anonyme reste bien plus utile qu'aucune. */
    }

    await supabase.from(JOURNAL_ERREURS_TABLE).insert({
      code,
      message: couper(erreur?.message, 500) ?? 'erreur sans message',
      pile: couper(erreur?.stack, 4000),
      composant: couper(composant, 4000),
      chemin: couper(window.location.pathname + window.location.search, 500),
      navigateur: couper(navigator.userAgent, 300),
      utilisateur_id: utilisateur,
    });
  } catch {
    /* Le dépôt est le dernier recours, jamais une cause de panne
       supplémentaire. On perd la trace, on garde l'écran. */
  }
}
