import { useEffect } from 'react';

/**
 * La couleur de la bande système, en haut de l'écran.
 *
 * LE DÉFAUT QU'IL CORRIGE
 *
 * Sur iPhone, Safari ne laisse pas la page peindre derrière la barre d'état :
 * il peint cette bande LUI-MÊME, avec la couleur de fond du `body`. Le `body`
 * de l'application est crème. Sur la page de couverture, dont l'ouverture est
 * une photographie sombre, on voyait donc une bande claire au-dessus de
 * l'image — comme si le fond s'arrêtait avant le haut de l'écran.
 *
 * POURQUOI PAS `theme-color`
 *
 * La balise `theme-color` existe déjà et vaut l'orange de la marque. Elle n'a
 * rien changé : ce Safari-là ne l'applique qu'en mode application installée,
 * pas dans l'onglet. C'est bien le fond du `body` qu'il échantillonne, donc
 * c'est le fond du `body` qu'il faut poser.
 *
 * POURQUOI PAS `viewport-fit=cover`
 *
 * Ce serait l'autre voie : laisser la page s'étendre sous la barre d'état.
 * Mais alors TOUS les écrans y passent, et chaque en-tête fixe doit apprendre
 * à s'écarter de l'encoche — sur des pages que je ne peux pas vérifier ici,
 * faute d'un vrai iPhone. Poser une couleur ne peut décaler aucune mise en
 * page ; c'est le geste sûr.
 *
 * Le fond du `body` n'est visible QUE dans cette bande et lors d'un
 * débordement élastique : l'enveloppe de la page, elle, porte déjà sa propre
 * couleur et couvre tout le reste.
 */
export function useFondDeBarre(couleur: string) {
  useEffect(() => {
    const precedent = document.body.style.backgroundColor;
    document.body.style.backgroundColor = couleur;

    /* On accorde aussi `theme-color` : sans effet dans l'onglet Safari, mais
     * c'est elle qui compte une fois l'application ajoutée à l'écran d'accueil,
     * et sur Android. Deux réglages pour un seul résultat visible. */
    const balise = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const themePrecedent = balise?.content ?? null;
    if (balise) balise.content = couleur;

    return () => {
      document.body.style.backgroundColor = precedent;
      if (balise && themePrecedent !== null) balise.content = themePrecedent;
    };
  }, [couleur]);
}
