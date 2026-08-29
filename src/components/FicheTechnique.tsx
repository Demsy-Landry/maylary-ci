import { Weight, Box, Package, Ship, Plane, MapPin, Layers } from 'lucide-react';

/**
 * Les caractéristiques d'un article, en français, pour un acheteur qui achète
 * en gros.
 *
 * POURQUOI CE BLOC MANQUAIT, ET POURQUOI IL COMPTE
 *
 * La fiche montrait le prix et la grille dégressive. Rien d'autre. Or un
 * commerçant qui achète cinquante pièces ne décide pas sur un prix : il calcule
 * sa place en boutique, son transport local, sa marge au détail. Sans poids ni
 * encombrement, il ne peut rien calculer — et il va voir ailleurs.
 *
 * CE QU'ON NE SAIT PAS SE DIT, IL NE DISPARAÎT PAS
 *
 * La règle qui tient dans tout le reste de l'application vaut ici : un poste
 * qu'on ignore doit se VOIR. Une ligne « poids » qui s'efface quand la valeur
 * manque laisse croire que l'information n'existe pas ; une ligne qui affiche
 * « à confirmer » dit qu'elle existe et qu'on va la chercher.
 *
 * C'est aussi ce qui rend le manque réparable : le fondateur voit d'un coup
 * d'œil, sur la fiche publique, ce que le catalogue n'a pas encore.
 *
 * LES UNITÉS SONT CELLES DU MÉTIER
 *
 * Les grammes se lisent en kilos au-delà de mille — un acheteur professionnel
 * raisonne en kilos. Les centimètres cubes se lisent en litres au-delà de mille,
 * parce que c'est ainsi qu'on estime une place en rayon.
 */

interface Props {
  poids_unitaire_g?: number | null;
  volume_unitaire_cm3?: number | null;
  unite_vente?: string | null;
  quantite_minimum?: number | null;
  mode_acheminement?: 'cj_ddp' | 'groupage' | null;
  delai_livraison_estime?: string | null;
  origine?: string | null;
}

const poids = (g?: number | null) => {
  if (!g || g <= 0) return null;
  return g >= 1000 ? `${(g / 1000).toFixed(2).replace('.', ',')} kg` : `${Math.round(g)} g`;
};

const volume = (cm3?: number | null) => {
  if (!cm3 || cm3 <= 0) return null;
  return cm3 >= 1000
    ? `${(cm3 / 1000).toFixed(1).replace('.', ',')} L`
    : `${Math.round(cm3)} cm³`;
};

const ORIGINES: Record<string, string> = {
  import_international: 'Importé — Chine',
  vendeur_local: 'Vendeur partenaire — Côte d’Ivoire',
  local: 'Stock local — Abidjan',
};

export default function FicheTechnique(p: Props) {
  const groupage = p.mode_acheminement === 'groupage';

  const lignes: { icone: typeof Weight; libelle: string; valeur: string | null }[] = [
    { icone: Weight, libelle: 'Poids unitaire', valeur: poids(p.poids_unitaire_g) },
    { icone: Box, libelle: 'Encombrement', valeur: volume(p.volume_unitaire_cm3) },
    { icone: Package, libelle: 'Unité de vente', valeur: p.unite_vente || null },
    {
      icone: Layers,
      libelle: 'Commande minimum',
      valeur:
        p.quantite_minimum && p.quantite_minimum > 1
          ? `${p.quantite_minimum} pièces`
          : '1 pièce',
    },
    {
      icone: groupage ? Ship : Plane,
      libelle: 'Acheminement',
      valeur: groupage
        ? 'Groupage maritime — 35 à 45 jours'
        : `Expédition rapide${p.delai_livraison_estime ? ` — ${p.delai_livraison_estime}` : ''}`,
    },
    {
      icone: MapPin,
      libelle: 'Provenance',
      valeur: p.origine ? (ORIGINES[p.origine] ?? p.origine) : null,
    },
  ];

  return (
    <div className="mt-6 overflow-hidden rounded-md border">
      <p className="border-b bg-muted/50 px-3 py-2 font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Caractéristiques
      </p>
      {/* `cascade` est la classe maison : chaque ligne suit la précédente d'un
          souffle, et le décalage cesse au dixième élément. Elle respecte déjà
          `prefers-reduced-motion`. En réécrire une ici ferait diverger deux
          animations qui doivent se ressembler. */}
      {/* QUI REND LA PLACE, DU LIBELLÉ OU DE LA VALEUR
          La valeur portait `shrink-0` et le libellé `flex-1` : sur un
          téléphone, « Groupage maritime — 35 à 45 jours » gardait toute sa
          largeur et « Acheminement » débordait par-dessus. Les deux textes se
          chevauchaient, illisibles.
          C'est l'inverse qu'il faut : le libellé est court et connu, il ne
          bouge pas ; la valeur est longue et variable, c'est elle qui prend la
          place restante et passe à la ligne quand il n'y en a plus. */}
      <dl className="cascade divide-y">
        {lignes.map((l) => (
          <div key={l.libelle} className="flex items-start gap-3 px-3 py-2.5">
            <l.icone className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <dt className="shrink-0 text-sm text-muted-foreground">{l.libelle}</dt>
            <dd
              className={`min-w-0 flex-1 text-right text-sm font-medium ${
                l.valeur ? 'text-foreground' : 'italic text-muted-foreground/70'
              }`}
            >
              {l.valeur ?? 'à confirmer'}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
