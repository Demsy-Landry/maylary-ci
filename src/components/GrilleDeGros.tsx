/**
 * Grille de prix dégressive affichée sur la fiche produit.
 *
 * Chaque ligne correspond à un devis de transport réellement obtenu pour cette
 * quantité : le prix baisse parce que le coût baisse, jamais par geste
 * commercial. C'est ce qui permet de l'annoncer sans réserve.
 */
import { Badge } from '@/components/ui/badge';
import type { PalierPrix } from '@/lib/cout-import';

const montant = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} FCFA`;

export function GrilleDeGros({
  paliers,
  quantiteChoisie,
}: {
  paliers: PalierPrix[];
  quantiteChoisie?: number;
}) {
  if (paliers.length < 2) return null;

  const grille = [...paliers].sort((a, b) => a.quantite_min - b.quantite_min);
  const base = grille[0].prix_unitaire_fcfa;

  // Le palier appliqué est le plus avantageux dont le seuil est atteint.
  const seuilApplique =
    quantiteChoisie != null
      ? grille.filter((p) => quantiteChoisie >= p.quantite_min).at(-1)?.quantite_min
      : undefined;

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-sm font-medium text-foreground">Tarif dégressif</p>
        <Badge variant="secondary">Prix de gros</Badge>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {grille.map((p) => {
            const remise = Math.round((1 - p.prix_unitaire_fcfa / base) * 100);
            const actif = p.quantite_min === seuilApplique;
            return (
              <tr key={p.quantite_min} className={actif ? 'bg-muted/60' : undefined}>
                <td className="px-3 py-2 text-muted-foreground">
                  À partir de {p.quantite_min} {p.quantite_min > 1 ? 'pièces' : 'pièce'}
                </td>
                <td className="px-3 py-2 text-right font-medium text-foreground">
                  {montant(p.prix_unitaire_fcfa)}
                </td>
                <td className="w-20 px-3 py-2 text-right">
                  {remise > 0 && <span className="text-xs text-emerald-600">−{remise} %</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        Le transport se paie en grande partie par colis, pas par article : commander en quantité en
        répartit le coût.
      </p>
    </div>
  );
}
