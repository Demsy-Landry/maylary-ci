import type { Produit } from '@/lib/supabase';
import type { Referencement } from '@/hooks/useReferencement';

/**
 * Ce qu'une fiche produit déclare aux moteurs de recherche.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI CES PAGES COMPTENT PLUS QUE LES AUTRES
 *
 * Personne ne cherche « MayLary Group » sur Google avant de nous connaître. On
 * cherche « perruque cheveux naturels Abidjan » ou « montre connectée pas
 * chère ». Ce sont les fiches produit — cent cinquante environ — qui peuvent
 * répondre à ces recherches-là. Les pages de service, elles, ne se trouvent
 * qu'une fois qu'on nous cherche déjà.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QU'ON NE MET PAS DEDANS, ET POURQUOI
 *
 * **Aucune note, aucun avis.** Déclarer une note que la page n'affiche pas est
 * sanctionné par Google, et à juste titre : c'est promettre dans le résultat de
 * recherche ce qu'on ne montre pas sur la page.
 *
 * **Aucun frais de port.** Le transport n'est coté qu'une fois le panier connu.
 * Annoncer ici un montant qu'on ne sait pas tenir, c'est afficher un prix qui
 * changera à l'étape suivante.
 *
 * **Aucune date de validité du prix.** Nous n'en avons pas ; l'inventer serait
 * l'inventer.
 *
 * **Ni fournisseur, ni coût de revient.** Ces deux-là ne sortent jamais de la
 * base — ni à l'écran, ni dans une balise que n'importe qui peut lire dans le
 * code source de la page.
 */

/** Adresse absolue : les moteurs et les robots d'aperçu n'ont pas de contexte. */
const SITE = 'https://maylarygroup.ci';

/**
 * La disponibilité, dans le vocabulaire de schema.org.
 *
 * `sur_commande` devient `BackOrder` et non `PreOrder` : le premier désigne un
 * article qu'on peut commander et qui sera approvisionné, le second un article
 * pas encore sorti. C'est bien du réapprovisionnement qu'il s'agit ici.
 */
const DISPONIBILITE: Record<Produit['stock_disponible'], string> = {
  en_stock: 'https://schema.org/InStock',
  sur_commande: 'https://schema.org/BackOrder',
  rupture: 'https://schema.org/OutOfStock',
};

/**
 * Une description de moteur de recherche se lit tronquée autour de cent
 * soixante caractères. On coupe donc nous-mêmes, sur un mot entier, plutôt que
 * de laisser Google couper au milieu d'un.
 */
function resumer(texte: string, limite = 155): string {
  const propre = texte.replace(/\s+/g, ' ').trim();
  if (propre.length <= limite) return propre;
  const coupe = propre.slice(0, limite);
  const dernierEspace = coupe.lastIndexOf(' ');
  return `${coupe.slice(0, dernierEspace > 60 ? dernierEspace : limite)}…`;
}

export function referencementProduit(
  produit: Produit,
  espace: 'boutique' | 'catalogue',
): Referencement {
  const chemin = `${SITE}/${espace}/produit/${produit.id}`;
  const photo = produit.photos?.[0] ?? null;

  // La description de la fiche d'abord, celle du fournisseur ensuite. Si les
  // deux manquent, on décrit ce qu'on sait avec certitude plutôt que de laisser
  // Google composer lui-même un extrait à partir du menu de navigation.
  const texte =
    produit.description?.trim() ||
    produit.description_fournisseur?.trim() ||
    `${produit.nom} — disponible chez MayLary Group, livré en Côte d'Ivoire.`;

  return {
    titre: produit.nom,
    description: resumer(texte),
    image: photo,
    type: 'product',
    donneesStructurees: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: produit.nom,
      description: resumer(texte, 300),
      ...(produit.photos?.length ? { image: produit.photos } : {}),
      ...(produit.categorie ? { category: produit.categorie } : {}),
      ...(produit.matiere ? { material: produit.matiere } : {}),
      ...(produit.poids_produit_g
        ? {
            weight: {
              '@type': 'QuantitativeValue',
              value: produit.poids_produit_g,
              unitCode: 'GRM',
            },
          }
        : {}),
      offers: {
        '@type': 'Offer',
        url: chemin,
        // Le franc CFA d'Afrique de l'Ouest, code ISO 4217. « FCFA » n'est pas
        // un code de devise : écrit tel quel, l'offre entière est rejetée.
        priceCurrency: 'XOF',
        price: produit.prix_unitaire_fcfa,
        availability: DISPONIBILITE[produit.stock_disponible],
        seller: { '@type': 'Organization', name: 'MayLary Group' },
      },
    },
  };
}
