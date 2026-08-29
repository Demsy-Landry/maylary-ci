/**
 * Pose l'heure sur la page, et l'y maintient.
 *
 * Le calcul vit dans `src/lib/cycle-jour-nuit.ts` ; ce crochet ne fait que
 * l'appliquer au document et le tenir à jour. Il écrit trois choses sur la
 * racine, et rien d'autre :
 *
 *   --nuit          la part de nuit, de 0 à 1 — c'est elle qui pilote toutes
 *                   les couleurs, par interpolation dans `index.css` ;
 *   .dark           la classe historique, posée passé la moitié du chemin. Elle
 *                   ne sert plus aux couleurs mais reste nécessaire aux dix-sept
 *                   endroits qui utilisent encore la variante `dark:` de
 *                   Tailwind, et qui, eux, ne savent pas se dégrader ;
 *   color-scheme    pour que les ascenseurs, les champs et les menus du système
 *                   suivent aussi. Sans lui, on obtient une page sombre avec un
 *                   ascenseur blanc — le détail qui trahit un thème plaqué.
 *
 * POURQUOI UNE MINUTE, ET PAS PLUS SOUVENT
 *
 * Sur six heures de dérive, une minute représente moins de trois millièmes du
 * chemin : l'écart entre deux relevés est invisible. Rafraîchir à la seconde ne
 * changerait rien à l'œil et ferait travailler l'appareil pour rien — ce qui se
 * paie en batterie sur un téléphone.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  CLE_MODE,
  partDeNuitSelonMode,
  type ModeAffichage,
} from '@/lib/cycle-jour-nuit';
import { COUCHER, paletteALHeure, voileSurLesImages } from '@/lib/palette-cycle';

function lireModeEnregistre(): ModeAffichage {
  try {
    const brut = localStorage.getItem(CLE_MODE);
    if (brut === 'jour' || brut === 'nuit' || brut === 'auto') return brut;
  } catch {
    // Navigation privée, ou stockage refusé : on suit l'heure, c'est le défaut.
  }
  return 'auto';
}

export function useCycleJourNuit() {
  const [mode, definirMode] = useState<ModeAffichage>(lireModeEnregistre);
  const [part, definirPart] = useState<number>(() =>
    partDeNuitSelonMode(lireModeEnregistre(), new Date()),
  );

  // Le choix du visiteur le suit d'une visite à l'autre. Un échec d'écriture ne
  // doit rien casser : l'apparence reste juste, elle ne sera pas mémorisée.
  const changerMode = useCallback((suivant: ModeAffichage) => {
    definirMode(suivant);
    try {
      localStorage.setItem(CLE_MODE, suivant);
    } catch {
      /* stockage indisponible — sans conséquence sur l'affichage */
    }
  }, []);

  useEffect(() => {
    const racine = document.documentElement;

    const appliquer = () => {
      const valeur = partDeNuitSelonMode(mode, new Date());
      definirPart(valeur);

      // Les couleurs sont posées EN LIGNE sur la racine : une déclaration en
      // ligne l'emporte sur toute règle de la feuille de style, y compris sur
      // le bloc `.dark`. C'est ce qui permet de ne rien changer à `index.css`,
      // qui reste le repli exact — l'apparence d'aujourd'hui — si ce script ne
      // s'exécute jamais.
      for (const [propriete, valeurCss] of Object.entries(paletteALHeure(valeur))) {
        racine.style.setProperty(propriete, valeurCss);
      }
      racine.style.setProperty('--voile-nuit', voileSurLesImages(valeur));

      // La classe reste nécessaire aux dix-sept endroits qui utilisent encore la
      // variante `dark:` de Tailwind : eux ne savent pas se dégrader.
      racine.classList.toggle('dark', valeur >= COUCHER);
      // Sans cela, on obtient une page sombre avec un ascenseur blanc — le
      // détail qui trahit un thème plaqué.
      racine.style.colorScheme = valeur >= COUCHER ? 'dark' : 'light';
    };

    appliquer();

    // En mode figé, il n'y a plus rien à suivre : pas de minuterie qui tourne
    // pour rien dans un onglet laissé ouvert.
    if (mode !== 'auto') return;

    const minuterie = window.setInterval(appliquer, 60_000);

    // Un téléphone mis en veille suspend les minuteries. Au réveil, l'heure a
    // pu changer beaucoup : on rattrape à la reprise plutôt que d'attendre le
    // prochain tour.
    const auRetour = () => {
      if (document.visibilityState === 'visible') appliquer();
    };
    document.addEventListener('visibilitychange', auRetour);

    return () => {
      window.clearInterval(minuterie);
      document.removeEventListener('visibilitychange', auRetour);
    };
  }, [mode]);

  return { mode, changerMode, part };
}
