/**
 * La marque MayLary Group.
 *
 * LE DESSIN EST CELUI DU FONDATEUR
 *
 * Il y avait ici un SVG que j'avais dessiné faute de mieux : deux silhouettes
 * devant des caisses, ramenées à des formes pleines pour rester lisibles à
 * 32 px. C'était un provisoire, et il est remplacé par le logo réel.
 *
 * Le logo montre une pile de conteneurs qui compose un M, et dans son creux
 * une femme et une fillette qui se tiennent la main, en pagne à motifs. Autour,
 * un réseau de lignes et de points d'or — les liaisons d'un transitaire. Le
 * dessin dit donc les deux choses à la fois, le métier et la transmission, là
 * où mon provisoire les juxtaposait.
 *
 * POURQUOI LA MARQUE PORTE SON PROPRE FOND BLANC
 *
 * Le logo est bleu nuit et or. Sur un en-tête clair il passe, sur un fond
 * sombre le bleu disparaît — et l'application se regarde dans les deux thèmes.
 * La marque embarque donc sa tuile blanche : elle ne dépend plus de ce sur quoi
 * on la pose, y compris une photographie d'ouverture.
 *
 * C'est aussi pour ça que le fichier n'est pas détouré. Un PNG transparent
 * obligerait chaque écran à lui fournir un fond clair, et il suffirait d'un
 * oubli pour que la marque s'efface.
 *
 * DEUX FORMATS, UN SEUL TÉLÉCHARGEMENT
 *
 * `<picture>` sert le WebP — 47 Ko contre 300 pour le PNG — et garde le PNG en
 * repli. Un navigateur qui connaît le WebP ne télécharge jamais le second.
 */

export function MarqueMaylary({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-black/5 ${className}`}
    >
      <picture>
        <source srcSet="/logo-maylary.webp" type="image/webp" />
        <img
          src="/logo-maylary.png"
          alt="MayLary Group"
          width={512}
          height={512}
          decoding="async"
          className="h-full w-full object-contain"
        />
      </picture>
    </span>
  );
}

/**
 * Marque et nom, tels qu'ils apparaissent en en-tête et en pied de page.
 *
 * « MayLary » et « Group » sont graissés différemment : le nom porte
 * l'identité, « Group » dit seulement la structure, et les mettre au même
 * poids ferait lire deux mots au lieu d'un nom.
 */
export function LogoMaylary({
  className = '',
  tailleMarque = 'h-9 w-9',
  tailleTexte = 'text-lg',
}: {
  className?: string;
  tailleMarque?: string;
  tailleTexte?: string;
}) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <MarqueMaylary className={tailleMarque} />
      <span className={`${tailleTexte} font-semibold tracking-tight`}>
        MayLary<span className="font-normal opacity-80"> Group</span>
      </span>
    </span>
  );
}
