/**
 * La marque MayLary Group.
 *
 * Le fondateur voulait « une femme et une fille dans l'univers de la
 * logistique ». Le dessin porte donc deux silhouettes — une adulte, une
 * enfant — devant une pile de caisses, et la plus petite tient la main de la
 * plus grande.
 *
 * Deux contraintes ont dicté la forme. D'abord la taille : la marque vit à
 * 32 px dans un en-tête, où un visage ou un pli de vêtement devient une tache.
 * Tout est donc ramené à des formes pleines, sans trait fin, lisibles en
 * silhouette. Ensuite le sens : deux figures de tailles différentes se lisent
 * d'emblée comme une transmission — ce qu'une entreprise familiale ivoirienne
 * a de plus juste à raconter, et ce qu'un empilement de cartons ne dit pas.
 *
 * Le dessin est en SVG plutôt qu'en image : il reste net sur un écran à haute
 * densité, pèse deux kilo-octets, hérite de la couleur du texte parent, et ne
 * demande aucune requête réseau.
 */

export function MarqueMaylary({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label="MayLary Group"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Les caisses, en retrait : elles situent le métier sans voler la
          lecture aux deux figures. */}
      <g opacity="0.42" fill="currentColor">
        <rect x="3" y="26" width="11" height="9" rx="1.4" />
        <rect x="34" y="26" width="11" height="9" rx="1.4" />
        <rect x="34" y="15" width="11" height="9" rx="1.4" />
      </g>

      {/* La ligne de sol : elle pose les silhouettes au lieu de les laisser
          flotter, et sert de socle visuel au petit format. */}
      <rect x="2" y="37" width="44" height="3" rx="1.5" fill="currentColor" />

      {/* La femme. */}
      <g fill="currentColor">
        <circle cx="20" cy="10.5" r="4.6" />
        <path d="M20 16.4c-4.5 0-7.4 2.9-7.9 7.3l-.9 8.1a1.9 1.9 0 0 0 1.9 2.1h2.2l.5 2.6h8.4l.5-2.6h2.2a1.9 1.9 0 0 0 1.9-2.1l-.9-8.1c-.5-4.4-3.4-7.3-7.9-7.3z" />
      </g>

      {/* La fille, plus petite, et la main tenue entre les deux. */}
      <g fill="currentColor">
        <circle cx="33" cy="19.5" r="3.4" />
        <path d="M33 24c-3.2 0-5.2 2-5.6 5.1l-.6 4.5a1.6 1.6 0 0 0 1.6 1.8h1.5l.4 2.2h5.4l.4-2.2h1.5a1.6 1.6 0 0 0 1.6-1.8l-.6-4.5c-.4-3.1-2.4-5.1-5.6-5.1z" />
      </g>
      <rect x="25.4" y="26.2" width="4.6" height="2.6" rx="1.3" fill="currentColor" />
    </svg>
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
  tailleMarque = 'h-5 w-5',
  tailleTexte = 'text-lg',
}: {
  className?: string;
  tailleMarque?: string;
  tailleTexte?: string;
}) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <MarqueMaylary className={tailleMarque} />
      </span>
      <span className={`${tailleTexte} font-semibold tracking-tight`}>
        MayLary<span className="font-normal opacity-80"> Group</span>
      </span>
    </span>
  );
}
