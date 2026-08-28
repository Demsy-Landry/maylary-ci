import { useEffect } from 'react';

/**
 * Ce que chaque page dit d'elle-même aux moteurs de recherche.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE DÉFAUT QU'IL CORRIGE, ET CE QU'IL COÛTAIT
 *
 * L'application est une page unique : l'hébergeur renvoie le MÊME `index.html`
 * pour les cent soixante-huit adresses du site — l'accueil, les rayons, chaque
 * fiche produit. Ce fichier portait, écrite en dur :
 *
 *     <link rel="canonical" href="https://maylarygroup.ci/" />
 *
 * Une balise « canonique » ne décrit pas la page : elle DÉSIGNE l'adresse que
 * le moteur doit retenir à sa place. Chaque fiche produit annonçait donc « la
 * vraie version de cette page, c'est l'accueil ». Nous soumettions un sitemap
 * de cent soixante-huit adresses, et sur chacune nous demandions à Google de
 * n'en garder qu'une. Il obéissait.
 *
 * Le titre et la description étaient identiques partout, pour la même raison.
 * Cent soixante-huit pages portant le même titre se concurrencent entre elles :
 * le moteur en choisit une et écarte les autres comme doublons.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI CELA MARCHE MALGRÉ LA PAGE UNIQUE
 *
 * Google exécute le JavaScript avant d'indexer. Les balises posées ici, après
 * le rendu, sont donc bien celles qu'il lit — c'est le fonctionnement normal
 * d'un site en page unique, pas un contournement.
 *
 * ⚠️ EN REVANCHE, ET IL FAUT LE SAVOIR : les robots d'aperçu de WhatsApp,
 * Facebook et LinkedIn, eux, N'EXÉCUTENT PAS le JavaScript. Ils ne verront que
 * ce qui est écrit dans `index.html`. Les balises `og:` posées ici corrigent
 * donc Google, pas l'aperçu d'un lien collé dans une conversation. Rendre ces
 * aperçus justes demande d'écrire le `<head>` côté serveur — un autre chantier,
 * volontairement laissé de côté ici.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QU'IL RESTITUE EN PARTANT
 *
 * En quittant une page, on ne remet pas les valeurs de la page précédente : on
 * remet celles d'`index.html`, relevées une seule fois au chargement. C'est la
 * défaillance la moins nuisible — un écran qui oublierait d'appeler ce crochet
 * afficherait le titre de la maison, jamais le nom d'un produit qu'il ne montre
 * pas.
 */

/**
 * L'adresse de production, en dur, et non `window.location.origin`.
 *
 * Chaque déploiement d'essai reçoit une adresse en `.vercel.app`. Si la balise
 * canonique reprenait l'adresse courante, ces déploiements se déclareraient
 * eux-mêmes canoniques et entreraient en concurrence avec le vrai site. En
 * pointant toujours vers `maylarygroup.ci`, un essai indexé par accident
 * renvoie le moteur vers la page officielle.
 */
const SITE = 'https://maylarygroup.ci';

const MARQUE = 'MayLary Group';
const IMAGE_PAR_DEFAUT = `${SITE}/og-image.png`;

/** Marqueur posé sur les balises que ce crochet a créées lui-même. */
const MARQUEUR = 'data-referencement';

export interface Referencement {
  /**
   * Le titre de la page, SANS le nom de la maison : il est ajouté à la fin.
   *
   * Les mots distinctifs viennent en premier. Un onglet, comme un résultat de
   * recherche, se lit tronqué : « MayLary Group — … » répété soixante fois
   * n'apprend rien à personne.
   */
  titre: string;
  /** Une à deux phrases. C'est ce que le moteur affiche sous le titre. */
  description: string;
  /**
   * Image de partage, en adresse ABSOLUE. Par défaut, la vignette de la maison.
   * Une photographie de produit vaut mieux quand la page en montre un.
   */
  image?: string | null;
  /** `website` pour une page de service, `product` pour une fiche article. */
  type?: 'website' | 'article' | 'product';
  /**
   * Vrai sur les écrans qui n'ont rien à faire dans un index : panier, compte,
   * suivi de dossier, administration.
   *
   * `robots.txt` demande déjà de ne pas les parcourir, mais une adresse
   * découverte autrement — un lien collé quelque part — peut être indexée sans
   * avoir été parcourue. Seule cette balise-ci l'interdit vraiment.
   */
  horsIndex?: boolean;
  /**
   * Données structurées propres à la page : fiche produit, fil d'Ariane.
   * Le bloc « Organisation » d'`index.html` reste en place et s'y ajoute.
   */
  donneesStructurees?: Record<string, unknown> | null;
}

/** Relevé une seule fois, au tout premier import : l'état d'`index.html`. */
const ORIGINE = {
  titre: typeof document === 'undefined' ? '' : document.title,
  description: lireContenu('meta[name="description"]'),
  canonique: lireAttribut('link[rel="canonical"]', 'href'),
  ogTitre: lireContenu('meta[property="og:title"]'),
  ogDescription: lireContenu('meta[property="og:description"]'),
  ogUrl: lireContenu('meta[property="og:url"]'),
  ogImage: lireContenu('meta[property="og:image"]'),
  ogType: lireContenu('meta[property="og:type"]'),
  twTitre: lireContenu('meta[name="twitter:title"]'),
  twDescription: lireContenu('meta[name="twitter:description"]'),
  twImage: lireContenu('meta[name="twitter:image"]'),
};

function lireContenu(selecteur: string): string {
  if (typeof document === 'undefined') return '';
  return document.querySelector(selecteur)?.getAttribute('content') ?? '';
}

function lireAttribut(selecteur: string, attribut: string): string {
  if (typeof document === 'undefined') return '';
  return document.querySelector(selecteur)?.getAttribute(attribut) ?? '';
}

/**
 * Pose une balise `<meta>`, en la créant si elle n'existe pas.
 *
 * `og:` s'écrit avec `property`, tout le reste avec `name` : deux vocabulaires
 * pour la même idée, et se tromper d'attribut rend la balise invisible.
 */
function poserMeta(cle: string, valeur: string, parPropriete: boolean) {
  const attribut = parPropriete ? 'property' : 'name';
  let balise = document.querySelector<HTMLMetaElement>(`meta[${attribut}="${cle}"]`);

  if (!valeur) {
    // Une balise vide vaut mieux absente — sauf si elle venait d'`index.html`,
    // auquel cas on n'y touche pas : elle sera restituée au départ.
    if (balise?.hasAttribute(MARQUEUR)) balise.remove();
    return;
  }

  if (!balise) {
    balise = document.createElement('meta');
    balise.setAttribute(attribut, cle);
    balise.setAttribute(MARQUEUR, '');
    document.head.appendChild(balise);
  }
  balise.setAttribute('content', valeur);
}

function poserCanonique(adresse: string) {
  let balise = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  // `index.html` n'en porte pas — voir le commentaire qui l'explique là-bas. En
  // partant, on retire donc la nôtre au lieu de laisser une canonique orpheline
  // qui désignerait l'accueil depuis la page suivante.
  if (!adresse) {
    balise?.remove();
    return;
  }

  if (!balise) {
    balise = document.createElement('link');
    balise.setAttribute('rel', 'canonical');
    balise.setAttribute(MARQUEUR, '');
    document.head.appendChild(balise);
  }
  balise.setAttribute('href', adresse);
}

/** Le bloc de données structurées de la page. Retiré au départ. */
function poserDonneesStructurees(donnees: Record<string, unknown> | null | undefined) {
  document.querySelectorAll(`script[${MARQUEUR}]`).forEach((n) => n.remove());
  if (!donnees) return;

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute(MARQUEUR, '');
  script.textContent = JSON.stringify(donnees);
  document.head.appendChild(script);
}

export function useReferencement(page: Referencement) {
  const {
    titre,
    description,
    image,
    type = 'website',
    horsIndex = false,
    donneesStructurees = null,
  } = page;

  // Les données structurées sont un objet reconstruit à chaque rendu : le
  // comparer par référence relancerait l'effet en boucle. On le compare sur sa
  // forme sérialisée, qui est ce qui compte réellement.
  const empreinteDonnees = donneesStructurees ? JSON.stringify(donneesStructurees) : '';

  useEffect(() => {
    // Le chemin réel de la page, sans les paramètres de requête : deux adresses
    // qui ne diffèrent que par un `?utm_source=` sont la même page, et le dire
    // évite qu'un lien de campagne soit indexé comme un doublon.
    //
    // La barre finale se retire, SAUF sur l'accueil : le sitemap annonce
    // `https://maylarygroup.ci/` et `https://maylarygroup.ci/boutique`. Une
    // canonique qui différerait de l'adresse listée, ne serait-ce que d'une
    // barre, désignerait une page que le sitemap ne mentionne pas.
    const chemin = window.location.pathname.replace(/\/+$/, '');
    const canonique = chemin ? SITE + chemin : `${SITE}/`;
    const titreComplet = titre.includes(MARQUE) ? titre : `${titre} — ${MARQUE}`;
    const illustration = image || IMAGE_PAR_DEFAUT;

    document.title = titreComplet;
    poserMeta('description', description, false);
    poserCanonique(canonique);

    poserMeta('og:title', titreComplet, true);
    poserMeta('og:description', description, true);
    poserMeta('og:url', canonique, true);
    poserMeta('og:image', illustration, true);
    poserMeta('og:type', type, true);

    poserMeta('twitter:title', titreComplet, false);
    poserMeta('twitter:description', description, false);
    poserMeta('twitter:image', illustration, false);

    // `noindex` retire la page de l'index ; `nofollow` empêche en plus de
    // suivre ses liens, ce qui n'aurait pas de sens sur une page publique.
    poserMeta('robots', horsIndex ? 'noindex, nofollow' : '', false);

    poserDonneesStructurees(empreinteDonnees ? JSON.parse(empreinteDonnees) : null);

    return () => {
      document.title = ORIGINE.titre;
      poserMeta('description', ORIGINE.description, false);
      poserCanonique(ORIGINE.canonique);

      poserMeta('og:title', ORIGINE.ogTitre, true);
      poserMeta('og:description', ORIGINE.ogDescription, true);
      poserMeta('og:url', ORIGINE.ogUrl, true);
      poserMeta('og:image', ORIGINE.ogImage, true);
      poserMeta('og:type', ORIGINE.ogType, true);

      poserMeta('twitter:title', ORIGINE.twTitre, false);
      poserMeta('twitter:description', ORIGINE.twDescription, false);
      poserMeta('twitter:image', ORIGINE.twImage, false);

      poserMeta('robots', '', false);
      poserDonneesStructurees(null);
    };
  }, [titre, description, image, type, horsIndex, empreinteDonnees]);
}
