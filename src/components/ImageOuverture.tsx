/**
 * L'image qui ouvre un écran, servie au format le plus léger que le navigateur
 * accepte.
 *
 * POURQUOI ÇA COMPTE ICI PLUS QU'AILLEURS
 *
 * Ces images-là sont chargées en priorité : ce sont elles que le visiteur
 * attend avant de voir quoi que ce soit. Sur la page de couverture, la
 * photographie pesait 259 Ko à elle seule, contre 1 Ko de code — l'application
 * n'était pas lente, l'image l'était.
 *
 * Réencodées en WebP, les trois ouvertures passent de 659 à 257 Ko, soit 61 %
 * de moins, sans différence visible. Sur une liaison mobile abidjanaise, c'est
 * la seule optimisation qui se sente vraiment.
 *
 * LE REPLI N'EST PAS DÉCORATIF
 *
 * `<picture>` propose le WebP et garde le JPEG d'origine dans le `<img>` : un
 * navigateur qui ne connaît pas le WebP prend le JPEG sans rien casser, et un
 * navigateur qui le connaît ne télécharge jamais le JPEG. Les deux fichiers
 * restent donc dans le dépôt — c'est voulu, pas un oubli de nettoyage.
 *
 * Les dimensions sont obligatoires : sans elles, la page saute au moment où
 * l'image arrive, et ce sursaut est exactement ce qui donne l'impression d'un
 * site bricolé.
 */
interface Props {
  /** Chemin du JPEG d'origine, par exemple `/visuels/fret-aerien-abidjan.jpg`. */
  src: string;
  alt: string;
  largeur: number;
  hauteur: number;
  className?: string;
}

export default function ImageOuverture({ src, alt, largeur, hauteur, className }: Props) {
  /**
   * Le WebP n'est proposé que pour les images du site.
   *
   * Le repli de `<picture>` ne joue qu'au moment de CHOISIR la source : une
   * fois le WebP retenu, s'il répond 404, le navigateur affiche une image
   * cassée — il ne redescend pas sur le `<img>`. Or les visuels servis depuis
   * le stockage distant n'ont pas de jumeau WebP. Leur en proposer un
   * casserait l'ouverture au lieu de l'alléger.
   */
  const local = src.startsWith('/');
  const webp = local ? src.replace(/\.jpe?g$/i, '.webp') : null;

  return (
    <picture>
      {webp && <source srcSet={webp} type="image/webp" />}
      <img
        src={src}
        alt={alt}
        width={largeur}
        height={hauteur}
        fetchPriority="high"
        decoding="async"
        className={className}
      />
    </picture>
  );
}
